// JobAuto Extension Popup — State Machine
// States: login | 2fa | guide | main

// ─── State ───────────────────────────────────────────────────────────────────
let pendingEmail = '';   // email during 2FA flow
let resendTimer  = 0;
let resendInterval = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindButtons();

  // Show extension version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('ext-version');
  if (versionEl && manifest.version) {
    versionEl.textContent = 'v' + manifest.version;
  }

  chrome.storage.local.get(['token', 'email', 'apiUrl', 'mode', 'guideSeen', 'autopilotKeywords', 'autopilotPlatform'], async (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    document.getElementById('api-url-input').value = apiUrl;
    checkServerStatus(apiUrl);

    if (s.autopilotKeywords) document.getElementById('autopilot-keywords').value = s.autopilotKeywords;
    if (s.autopilotPlatform) document.getElementById('autopilot-platform').value = s.autopilotPlatform;

    if (s.token && s.email) {
      const valid = await validateToken(apiUrl, s.token);
      if (valid || valid === true) {
        updateAutopilotUI(s.mode || 'freelance');
        if (!s.guideSeen) {
          showView('guide');
          animateGuideSteps();
        } else {
          showView('main');
          populateMain(s.email, s.mode || 'freelance');
        }
      } else {
        chrome.storage.local.remove(['token', 'email']);
        showView('login');
      }
    } else {
      showView('login');
    }
    
    checkAutopilotState();
  });
});

// ─── Views ────────────────────────────────────────────────────────────────────
function showView(name) {
  ['view-login', 'view-2fa', 'view-guide', 'view-main'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (name === 'login') {
    const v = document.getElementById('view-login');
    v.style.display = 'flex';
  } else if (name === '2fa') {
    const v = document.getElementById('view-2fa');
    v.style.display = 'flex';
  } else if (name === 'guide') {
    const v = document.getElementById('view-guide');
    v.style.display = 'flex';
    animateGuideSteps();
  } else if (name === 'main') {
    const v = document.getElementById('view-main');
    v.style.display = 'flex';
    v.style.flexDirection = 'column';
    // Reload mode from storage
    chrome.storage.local.get(['email', 'mode'], (s) => {
      populateMain(s.email || '—', s.mode || 'freelance');
    });
  }
}

function animateGuideSteps() {
  const steps = document.querySelectorAll('.guide-step');
  steps.forEach((s, i) => {
    setTimeout(() => s.classList.add('visible'), 150 + i * 120);
  });
}

function populateMain(email, mode) {
  const emailEl  = document.getElementById('user-email-label');
  const avatarEl = document.getElementById('user-avatar');
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = email ? email[0].toUpperCase() : '?';
  updateModeUI(mode);
  chrome.storage.local.get(['apiUrl'], s => checkServerStatus(s.apiUrl || 'http://localhost:3000'));
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
function bindButtons() {

  // LOGIN
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-password').focus(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('btn-toggle-password').addEventListener('click', () => {
    const pw = document.getElementById('login-password');
    const btn = document.getElementById('btn-toggle-password');
    if (pw.type === 'password') { pw.type = 'text'; btn.textContent = '🙈'; }
    else { pw.type = 'password'; btn.textContent = '👁️'; }
  });
  document.getElementById('btn-open-web').addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], s => chrome.tabs.create({ url: s.apiUrl || 'http://localhost:3000' }));
  });

  // 2FA
  document.getElementById('btn-verify').addEventListener('click', do2FA);
  document.getElementById('code-input').addEventListener('keydown', e => { if (e.key === 'Enter') do2FA(); });
  document.getElementById('resend-link').addEventListener('click', doResend);
  document.getElementById('btn-back-login').addEventListener('click', () => showView('login'));

  // GUIDE
  document.getElementById('btn-guide-finish').addEventListener('click', () => {
    chrome.storage.local.set({ guideSeen: true }, () => {
      chrome.storage.local.get(['email', 'mode'], s => {
        showView('main');
        populateMain(s.email || '—', s.mode || 'freelance');
      });
    });
  });

  // MAIN
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('mode-freelance-btn').addEventListener('click', () => setMode('freelance'));
  document.getElementById('mode-business-btn').addEventListener('click', () => setMode('business'));
  document.getElementById('mode-job-btn').addEventListener('click', () => setMode('job'));
  document.getElementById('btn-open-dashboard').addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], s => chrome.tabs.create({ url: s.apiUrl || 'http://localhost:3000' }));
  });
  document.getElementById('btn-extract-now').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSidebar' });
        window.close();
      } else {
        showMainToast('Navega a una página de oferta primero.', 'error');
      }
    });
  });
  document.getElementById('btn-show-guide-again').addEventListener('click', () => showView('guide'));
  document.getElementById('btn-save-url').addEventListener('click', saveApiUrl);
  document.getElementById('btn-start-autopilot-business')?.addEventListener('click', startAutopilot);
  document.getElementById('btn-start-autopilot-freelance')?.addEventListener('click', startAutopilot);
  document.getElementById('btn-start-autopilot-job')?.addEventListener('click', startAutopilot);
  document.getElementById('btn-stop-autopilot').addEventListener('click', stopAutopilot);

  // Threshold sliders
  ['ap-freelance-threshold', 'ap-job-threshold'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const lbl = document.getElementById(id.replace('threshold', 'lbl'));
      if (lbl) lbl.textContent = el.value + '%';
    });
  });

  // Update autopilot UI on initial load
  chrome.storage.local.get(['mode'], (s) => updateAutopilotUI(s.mode || 'freelance'));
}

// ─── Auth flows ───────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember')?.checked || false;

  if (!email || !password) { showLoginToast('Completa correo y contraseña.', 'error'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Verificando...';

  chrome.storage.local.get(['apiUrl'], async (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    try {
      const res  = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

      if (data.status === 'pending_2fa') {
        pendingEmail = email;
        showView('2fa');
        startResendTimer();
      } else {
        chrome.storage.local.set({ token: data.token, email: data.email, remember }, () => afterLogin(data.email));
      }
    } catch (err) {
      showLoginToast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Iniciar Sesión';
    }
  });
}

async function do2FA() {
  const code = document.getElementById('code-input').value.trim();
  if (!code) { showToast('twofa-toast', 'Introduce el código.', 'error'); return; }

  const btn = document.getElementById('btn-verify');
  btn.disabled = true; btn.textContent = 'Verificando...';

  chrome.storage.local.get(['apiUrl', 'remember'], async (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    try {
      const res  = await fetch(`${apiUrl}/api/auth/login-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      chrome.storage.local.set({ token: data.token, email: data.email, remember: s.remember }, () => afterLogin(data.email));
    } catch (err) {
      showToast('twofa-toast', err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Confirmar Acceso';
    }
  });
}

async function doResend() {
  chrome.storage.local.get(['apiUrl'], async (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    try {
      const res = await fetch(`${apiUrl}/api/auth/resend-2fa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      startResendTimer();
      showToast('twofa-toast', 'Código reenviado a tu correo.');
    } catch (err) {
      showToast('twofa-toast', err.message, 'error');
    }
  });
}

function afterLogin(email) {
  // Check if guide has been seen before
  chrome.storage.local.get(['guideSeen', 'mode'], (s) => {
    if (!s.guideSeen) {
      showView('guide');
    } else {
      showView('main');
      populateMain(email, s.mode || 'freelance');
    }
  });
}

function doLogout() {
  chrome.storage.local.remove(['token', 'email', 'remember'], () => {
    pendingEmail = '';
    ['login-email', 'login-password', 'code-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    showView('login');
  });
}

// ─── Resend timer ─────────────────────────────────────────────────────────────
function startResendTimer() {
  resendTimer = 60;
  const label = document.getElementById('resend-label');
  const link  = document.getElementById('resend-link');
  if (link)  link.style.display = 'none';
  if (label) { label.style.display = 'inline'; label.textContent = `Reenviar en ${resendTimer}s`; }

  if (resendInterval) clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    resendTimer--;
    if (resendTimer <= 0) {
      clearInterval(resendInterval);
      if (label) label.style.display = 'none';
      if (link)  link.style.display  = 'inline';
    } else {
      if (label) label.textContent = `Reenviar en ${resendTimer}s`;
    }
  }, 1000);
}

// ─── Mode ──────────────────────────────────────────────────────────────────────
function setMode(mode) {
  chrome.storage.local.set({ mode }, () => {
    updateModeUI(mode);
    updateAutopilotUI(mode);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { action: 'modeChanged', mode });
    });
    const names = { freelance: 'Freelance', business: 'Empresa', job: 'Trabajo' };
    showMainToast(`Modo cambiado a ${names[mode] || mode}`);
  });
}

function updateAutopilotUI(mode) {
  const sections = { business: 'ap-business', freelance: 'ap-freelance', job: 'ap-job' };
  Object.entries(sections).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === mode ? 'flex' : 'none';
  });
}

function updateModeUI(mode) {
  const fBtn = document.getElementById('mode-freelance-btn');
  const bBtn = document.getElementById('mode-business-btn');
  const jBtn = document.getElementById('mode-job-btn');
  if (!fBtn || !bBtn || !jBtn) return;
  fBtn.classList.toggle('active', mode === 'freelance');
  bBtn.classList.toggle('active', mode === 'business');
  jBtn.classList.toggle('active', mode === 'job');
}

// ─── Server ───────────────────────────────────────────────────────────────────
async function validateToken(apiUrl, token) {
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.email) chrome.storage.local.set({ email: data.email });
      return true;
    }
    // Server returned error (401/403) = token invalid
    if (res.status === 401 || res.status === 403) return false;
    // Other errors = server issue, keep token
    return true;
  } catch {
    // Network error = server not reachable, keep token
    return true;
  }
}

async function checkServerStatus(apiUrl) {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (!dot || !label) return;
  try {
    const res = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className   = 'dot online';
      label.textContent = 'Online';
      label.style.color = '#10b981';
    } else { throw new Error(); }
  } catch {
    dot.className   = 'dot offline';
    label.textContent = 'Offline';
    label.style.color = '#ef4444';
  }
}

function saveApiUrl() {
  const raw = document.getElementById('api-url-input').value.trim();
  if (!raw) return;
  const url = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  chrome.storage.local.set({ apiUrl: url }, () => {
    checkServerStatus(url);
    showMainToast('URL del servidor guardada.');
  });
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
function showToast(id, msg, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
  el.style.color  = type === 'error' ? '#f87171' : '#34d399';
  el.style.border = `1px solid ${type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`;
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showLoginToast(msg, type) { showToast('login-toast', msg, type); }
function showMainToast(msg, type)  { showToast('main-toast', msg, type); }

// ─── Autopilot Logic ─────────────────────────────────────────────────────────
let autopilotInterval = null;

function checkAutopilotState() {
  chrome.storage.local.get(['autopilot'], (s) => {
    const ap = s.autopilot || { active: false };
    const configDiv = document.getElementById('autopilot-config');
    const runningDiv = document.getElementById('autopilot-running');
    if (!configDiv || !runningDiv) return;

    if (ap.active) {
      configDiv.style.display = 'none';
      runningDiv.style.display = 'flex';

      document.getElementById('lbl-auto-platform').textContent = ap.platform || '—';
      document.getElementById('lbl-auto-status').textContent = ap.status || 'Ejecutando...';

      const total = ap.total || 0;
      const current = ap.savedCount !== undefined
        ? `${ap.savedCount || 0} guardadas`
        : (ap.currentIdx >= 0 ? ap.currentIdx + 1 : 0) + '/' + total;
      document.getElementById('lbl-auto-progress').textContent = `Guardadas: ${ap.savedCount || 0} | Omitidas: ${ap.skippedCount || 0} | Total: ${total || '?'}`;

      const pct = total > 0 ? Math.round(((ap.savedCount || 0) / total) * 100) : 0;
      document.getElementById('pb-auto-progress').style.width = `${Math.min(pct, 100)}%`;

      if (!autopilotInterval) {
        autopilotInterval = setInterval(checkAutopilotState, 1500);
      }
    } else {
      configDiv.style.display = 'flex';
      runningDiv.style.display = 'none';
      if (autopilotInterval) {
        clearInterval(autopilotInterval);
        autopilotInterval = null;
      }
    }
  });
}

function startAutopilot() {
  chrome.storage.local.get(['mode'], (s) => {
    const mode = s.mode || 'freelance';

    // === EMPRESA: Google Maps ===
    if (mode === 'business') {
      const category = document.getElementById('ap-business-category')?.value?.trim();
      const location = document.getElementById('ap-business-location')?.value?.trim() || 'Lima';
      if (!category) { showMainToast('Ingresa la categoria del negocio.', 'error'); return; }
      const keywords = `${category} ${location}`;
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keywords)}`;
      const ap = { active: true, keywords, platform: 'googlemaps', mode: 'business', minScore: 0, maxPages: 3, searchUrl, status: 'Escaneando Google Maps...', total: 0, savedCount: 0, timestamp: Date.now() };
      chrome.storage.local.set({ autopilot: ap, autopilotKeywords: keywords, autopilotPlatform: 'googlemaps' }, () => {
        checkAutopilotState();
        showMainToast(`Buscando "${category}" en ${location}...`);
        chrome.tabs.create({ url: searchUrl });
      });
      return;
    }

    // === FREELANCE ===
    if (mode === 'freelance') {
      const keywords = document.getElementById('ap-freelance-keywords')?.value?.trim();
      const platform = document.getElementById('ap-freelance-platform')?.value;
      const threshold = parseInt(document.getElementById('ap-freelance-threshold')?.value || '0', 10);
      if (!keywords) { showMainToast('Ingresa palabras clave.', 'error'); return; }
      startPlatformSearch(mode, keywords, platform, threshold, {
        upwork: `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(keywords)}&sort=recency`,
        freelancer: `https://www.freelancer.com/jobs/${encodeURIComponent(keywords)}/?sort=submitdate`,
        fiverr: `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keywords)}&sort=recency`,
        workana: `https://www.workana.com/jobs?query=${encodeURIComponent(keywords)}&sort=recent`,
        contra: `https://contra.com/search?query=${encodeURIComponent(keywords)}`,
        peopleperhour: `https://www.peopleperhour.com/freelance-jobs?keywords=${encodeURIComponent(keywords)}`,
        guru: `https://www.guru.com/d/jobs/skill/${encodeURIComponent(keywords.replace(/\s+/g, '-'))}/`,
        toptal: `https://www.toptal.com/freelance-jobs?search=${encodeURIComponent(keywords)}`
      });
      return;
    }

    // === TRABAJO ===
    if (mode === 'job') {
      const keywords = document.getElementById('ap-job-keywords')?.value?.trim();
      const platform = document.getElementById('ap-job-platform')?.value;
      const threshold = parseInt(document.getElementById('ap-job-threshold')?.value || '0', 10);
      if (!keywords) { showMainToast('Ingresa palabras clave.', 'error'); return; }
      startPlatformSearch(mode, keywords, platform, threshold, {
        linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&sortBy=DD`,
        indeed: `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}&sort=date`,
        computrabajo: `https://www.computrabajo.com/trabajo-de-${encodeURIComponent(keywords)}?ord=fecha`,
        getonbrd: `https://www.getonbrd.com/trabajos?search=${encodeURIComponent(keywords)}`,
        infojobs: `https://www.infojobs.net/jobsearch/search?keyword=${encodeURIComponent(keywords)}&sort=date`,
        wellfound: `https://wellfound.com/jobs?search=${encodeURIComponent(keywords)}`,
        remoteok: `https://remoteok.com/remote-${encodeURIComponent(keywords.replace(/\s+/g, '-'))}-jobs`,
        weworkremotely: `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(keywords)}`,
        arc: `https://arc.dev/remote-jobs?search=${encodeURIComponent(keywords)}`,
        bumeran: `https://www.bumeran.com.pe/empleos-busqueda-${encodeURIComponent(keywords)}.html?orden=2`
      });
      return;
    }
  });
}

function startPlatformSearch(mode, keywords, platform, threshold, searchUrls) {
  const searchUrl = searchUrls[platform];
  if (!searchUrl) { showMainToast('Plataforma no soportada.', 'error'); return; }
  const ap = { active: true, keywords, platform, mode, minScore: threshold, maxPages: 3, searchUrl, status: 'Escaneando...', total: 0, savedCount: 0, skippedCount: 0, timestamp: Date.now() };
  chrome.storage.local.set({ autopilot: ap, autopilotKeywords: keywords, autopilotPlatform: platform }, () => {
    checkAutopilotState();
    showMainToast(`Buscando "${keywords}"...`);
    chrome.tabs.create({ url: searchUrl });
  });
}

function stopAutopilot() {
  chrome.storage.local.get(['autopilot'], (s) => {
    const ap = s.autopilot || {};
    ap.active = false;
    ap.status = 'Detenido';
    chrome.storage.local.set({ autopilot: ap }, () => {
      checkAutopilotState();
      showMainToast('Autopiloto detenido.');
    });
  });
}

