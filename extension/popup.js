// JobAuto Extension Popup — State Machine
// States: login | 2fa | guide | main

// ─── State ───────────────────────────────────────────────────────────────────
let pendingEmail = '';   // email during 2FA flow
let resendTimer  = 0;
let resendInterval = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindButtons();

  chrome.storage.local.get(['token', 'email', 'apiUrl', 'mode', 'guideSeen', 'autopilotKeywords', 'autopilotPlatform'], (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    document.getElementById('api-url-input').value = apiUrl;
    checkServerStatus(apiUrl);

    if (s.autopilotKeywords) {
      document.getElementById('autopilot-keywords').value = s.autopilotKeywords;
    }
    if (s.autopilotPlatform) {
      document.getElementById('autopilot-platform').value = s.autopilotPlatform;
    }

    if (s.token && s.email) {
      // Already authenticated
      if (!s.guideSeen) {
        showView('guide');
        animateGuideSteps();
      } else {
        showView('main');
        populateMain(s.email, s.mode || 'freelance');
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
  document.getElementById('btn-start-autopilot').addEventListener('click', startAutopilot);
  document.getElementById('btn-stop-autopilot').addEventListener('click', stopAutopilot);
  const thresholdSlider = document.getElementById('autopilot-threshold');
  if (thresholdSlider) {
    thresholdSlider.addEventListener('input', () => {
      document.getElementById('lbl-threshold').textContent = thresholdSlider.value + '%';
    });
  }
}

// ─── Auth flows ───────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

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
        // Direct login (no 2FA configured)
        chrome.storage.local.set({ token: data.token, email: data.email }, () => afterLogin(data.email));
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

  chrome.storage.local.get(['apiUrl'], async (s) => {
    const apiUrl = s.apiUrl || 'http://localhost:3000';
    try {
      const res  = await fetch(`${apiUrl}/api/auth/login-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      chrome.storage.local.set({ token: data.token, email: data.email }, () => afterLogin(data.email));
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
  chrome.storage.local.remove(['token', 'email'], () => {
    pendingEmail = '';
    // Clear inputs
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
    // Sync with web app via content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { action: 'modeChanged', mode });
    });
    showMainToast(`Modo cambiado a ${mode === 'freelance' ? '🚀 Freelance' : '💼 Trabajo'}`);
  });
}

function updateModeUI(mode) {
  const freelanceBtn = document.getElementById('mode-freelance-btn');
  const jobBtn       = document.getElementById('mode-job-btn');
  if (!freelanceBtn || !jobBtn) return;
  if (mode === 'job') {
    jobBtn.classList.add('active');       freelanceBtn.classList.remove('active');
  } else {
    freelanceBtn.classList.add('active'); jobBtn.classList.remove('active');
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────
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
  const keywords = document.getElementById('autopilot-keywords').value.trim();
  const platform = document.getElementById('autopilot-platform').value;
  const threshold = parseInt(document.getElementById('autopilot-threshold')?.value || '20', 10);

  if (!keywords) {
    showMainToast('Describe que buscas (ej: React, Node.js, Diseño)', 'error');
    return;
  }

  chrome.storage.local.get(['mode'], (s) => {
    const mode = s.mode || 'job';

    const searchUrls = {
      upwork: `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(keywords)}`,
      freelancer: `https://www.freelancer.com/jobs/?q=${encodeURIComponent(keywords)}`,
      workana: `https://www.workana.com/jobs?query=${encodeURIComponent(keywords)}`,
      fiverr: `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keywords)}`,
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}`,
      indeed: `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}`,
      computrabajo: `https://www.computrabajo.com/trabajo-de-${encodeURIComponent(keywords)}`,
      getonbrd: `https://www.getonbrd.com/trabajos?search=${encodeURIComponent(keywords)}`,
      bumeran: `https://www.bumeran.com.pe/empleos-busqueda-${encodeURIComponent(keywords)}.html`
    };

    const searchUrl = searchUrls[platform];
    if (!searchUrl) {
      showMainToast('Plataforma no soportada.', 'error');
      return;
    }

    const ap = {
      active: true,
      keywords,
      platform,
      mode,
      minScore: threshold,
      searchUrl,
      urls: [],
      currentIdx: -1,
      status: 'Escaneando pagina de resultados...',
      total: 0,
      savedCount: 0,
      skippedCount: 0,
      timestamp: Date.now()
    };

    chrome.storage.local.set({
      autopilot: ap,
      autopilotKeywords: keywords,
      autopilotPlatform: platform
    }, () => {
      checkAutopilotState();
      showMainToast(`Buscando "${keywords}" en modo ${mode}...`);
      chrome.tabs.create({ url: searchUrl });
    });
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

