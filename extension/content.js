// JobAuto Extension Content Script

// Keep track of DOM elements we inject
let floatingBtn = null;
let sidebar = null;
let currentMode = 'freelance'; // Default mode: job, freelance

// Initialize when page loads
init();

async function init() {
  const host = window.location.hostname;

  // Verificar si hay una búsqueda automática (autopiloto) activa
  chrome.storage.local.get(['autopilot', 'token', 'apiUrl', 'mode'], (s) => {
    if (s.autopilot && s.autopilot.active) {
      runAutopilotStep(s.autopilot, s.token, s.apiUrl, s.mode || 'freelance');
    }
  });
  
  // Si estamos en la app web del dashboard (localhost), no inyectar interfaz, solo servir de puente
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    window.addEventListener('JobAutoDashboardModeChanged', (e) => {
      if (e.detail && e.detail.mode) {
        chrome.storage.local.set({ mode: e.detail.mode });
      }
    });

    window.addEventListener('JobAutoSessionChanged', (e) => {
      if (e.detail) {
        const { token, email } = e.detail;
        if (token) {
          chrome.storage.local.set({ token, email });
        } else {
          chrome.storage.local.remove(['token', 'email']);
        }
      }
    });

    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'modeChanged') {
        window.dispatchEvent(new CustomEvent('JobAutoModeChanged', { detail: { mode: request.mode } }));
      }
    });

    // Solicitar sesión activa en la inicialización
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('JobAutoRequestSession'));
    }, 100);
    return;
  }

  if (document.getElementById('jobauto-floating-trigger')) return;

  chrome.storage.local.get(['mode'], (result) => {
    // Freelance platforms auto-detect
    if (host.includes('freelancer') || host.includes('workana') || host.includes('upwork') || host.includes('guru.com') || host.includes('fiverr.com')) {
      currentMode = 'freelance';
    } else {
      currentMode = result.mode || 'freelance';
    }
    
    createFloatingButton();
    createSidebar();
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'modeChanged') {
      currentMode = request.mode;
      updateSidebarModeDropdown();
    }
  });
}

function createFloatingButton() {
  floatingBtn = document.createElement('div');
  floatingBtn.id = 'jobauto-floating-trigger';
  floatingBtn.title = 'Abrir JobAuto Extractor';
  
  floatingBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  `;
  
  floatingBtn.addEventListener('click', toggleSidebar);
  document.body.appendChild(floatingBtn);
}

function createSidebar() {
  sidebar = document.createElement('div');
  sidebar.id = 'jobauto-sidebar-container';
  
  sidebar.innerHTML = `
    <div class="jobauto-header">
      <div class="jobauto-logo-area">
        <div class="jobauto-logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <h2 class="jobauto-logo-title">JobAuto</h2>
      </div>
      <button class="jobauto-btn-close" id="jobauto-close-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    
    <div class="jobauto-body">
      <div class="jobauto-form-group">
        <label>Modo de Extracción</label>
        <select id="ja-input-mode" style="background-color: #1b2336; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; color: white; outline: none; width: 100%;">
          <option value="freelance">🚀 Buscar Freelance</option>
          <option value="job">💼 Buscar Trabajo</option>
        </select>
      </div>

      <h3 style="margin-top: 12px;" id="ja-section-title">Verificar Datos</h3>
      
      <div class="jobauto-form-group">
        <label id="ja-label-role">Puesto / Rol *</label>
        <input type="text" id="ja-input-role" placeholder="Ej. Frontend Developer">
      </div>
      
      <div class="jobauto-form-group">
        <label id="ja-label-company">Empresa / Cliente *</label>
        <input type="text" id="ja-input-company" placeholder="Ej. Acme Corp">
      </div>

      <div class="jobauto-form-group">
        <label>Correo de Contacto Detectado</label>
        <input type="email" id="ja-input-email" placeholder="reclutador@empresa.com">
      </div>

      <div class="jobauto-form-group" id="ja-group-budget">
        <label>Presupuesto / Tarifa</label>
        <input type="text" id="ja-input-budget" placeholder="Ej. $1000 - $2000 / $30/hr">
      </div>
      
      <div class="jobauto-form-group">
        <label>Enlace / URL</label>
        <input type="url" id="ja-input-url" placeholder="https://...">
      </div>
      
      <div class="jobauto-form-group">
        <label>Descripción / Requisitos</label>
        <textarea id="ja-input-desc" rows="8" placeholder="Requisitos del puesto..."></textarea>
      </div>
    </div>
    
    <div class="jobauto-footer">
      <button class="jobauto-btn jobauto-btn-primary" id="jobauto-save-btn">
        Guardar en Tablero
      </button>
      <button class="jobauto-btn jobauto-btn-secondary" id="jobauto-cancel-btn">
        Cancelar
      </button>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  document.getElementById('jobauto-close-btn').addEventListener('click', toggleSidebar);
  document.getElementById('jobauto-cancel-btn').addEventListener('click', toggleSidebar);
  document.getElementById('jobauto-save-btn').addEventListener('click', saveToBackend);
  
  const modeSelect = document.getElementById('ja-input-mode');
  modeSelect.addEventListener('change', (e) => {
    currentMode = e.target.value;
    updateUIForSelectedMode();
  });

  updateSidebarModeDropdown();
}

function updateSidebarModeDropdown() {
  if (!sidebar) return;
  const select = document.getElementById('ja-input-mode');
  if (select) select.value = currentMode;
  updateUIForSelectedMode();
}

function updateUIForSelectedMode() {
  const labelRole = document.getElementById('ja-label-role');
  const labelCompany = document.getElementById('ja-label-company');
  const groupBudget = document.getElementById('ja-group-budget');
  const sectionTitle = document.getElementById('ja-section-title');

  if (currentMode === 'job') {
    labelRole.textContent = 'Puesto / Rol *';
    labelCompany.textContent = 'Empresa *';
    groupBudget.style.display = 'none';
    sectionTitle.textContent = 'Verificar Datos de Oferta';
  } else {
    labelRole.textContent = 'Título del Proyecto *';
    labelCompany.textContent = 'Cliente *';
    groupBudget.style.display = 'flex';
    sectionTitle.textContent = 'Verificar Datos del Proyecto';
  }
}

function toggleSidebar() {
  if (sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  } else {
    const data = scrapeJobData();
    
    document.getElementById('ja-input-role').value = data.title;
    document.getElementById('ja-input-company').value = data.company;
    document.getElementById('ja-input-email').value = data.contactEmail;
    document.getElementById('ja-input-url').value = data.url;
    document.getElementById('ja-input-desc').value = data.description;
    
    const budgetInput = document.getElementById('ja-input-budget');
    if (budgetInput) budgetInput.value = data.budget || '';

    updateSidebarModeDropdown();
    sidebar.classList.add('active');
  }
}

function extractEmailFromText(text) {
  if (!text) return '';
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : '';
}

function scrapeJobData() {
  const url = window.location.href;
  const host = window.location.hostname;
  let title = '';
  let company = '';
  let description = '';
  let budget = '';

  // 1. LinkedIn
  if (url.includes('linkedin.com')) {
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
    const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-details-top-card__company-url');
    const descEl = document.querySelector('#job-details, .jobs-description__content, .jobs-box__html-content');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.split('\n')[0].trim();
    if (descEl) description = descEl.innerText.trim();
  }
  
  // 2. Indeed
  else if (url.includes('indeed.com')) {
    const titleEl = document.querySelector('.jobsearch-JobInfoHeader-title, h1');
    const companyEl = document.querySelector('[data-company-name="true"], .jobsearch-CompanyInfoContainer');
    const descEl = document.querySelector('#jobDescriptionText');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.split('\n')[0].trim();
    if (descEl) description = descEl.innerText.trim();
  }

  // 3. InfoJobs
  else if (url.includes('infojobs.net')) {
    const titleEl = document.querySelector('h1, [data-qa="job-title"]');
    const companyEl = document.querySelector('[data-qa="company-name"], .link-bold');
    const descEl = document.querySelector('#job-description-container, .job-description');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
  }

  // 4. Computrabajo
  else if (url.includes('computrabajo.com')) {
    const titleEl = document.querySelector('h1.title_offer, h1');
    const companyEl = document.querySelector('a.link_emp, .info_company a, h1 + p');
    const descEl = document.querySelector('.box_border p, p.descripcion');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
  }

  // 5. Bumeran
  else if (url.includes('bumeran.com')) {
    const titleEl = document.querySelector('h1, [class*="Title"]');
    const companyEl = document.querySelector('h2, [class*="Company"], [class*="SubTitle"]');
    const descEl = document.querySelector('#descripcion, [class*="Description"]');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
  }

  // 6. Freelancer.com
  else if (url.includes('freelancer.com')) {
    const titleEl = document.querySelector('.PageProjectViewcard-header-title, h1');
    const companyEl = document.querySelector('.PageProjectViewcard-detail-client, .client-name');
    const descEl = document.querySelector('.PageProjectViewcard-detail-description, .project-description');
    const budgetEl = document.querySelector('.PageProjectViewcard-header-budget, .project-budget');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
  }

  // 7. Workana
  else if (url.includes('workana.com')) {
    const titleEl = document.querySelector('h1.title, h1');
    const companyEl = document.querySelector('.client-name, h3');
    const descEl = document.querySelector('.project-details, .description');
    const budgetEl = document.querySelector('.budget, .budget-range');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
  }

  // 8. Upwork
  else if (url.includes('upwork.com')) {
    const titleEl = document.querySelector('.fe-proposal-job-title, h1');
    const companyEl = document.querySelector('.fe-proposal-client-name, .client-location'); 
    const descEl = document.querySelector('.job-description, [itemprop="description"]');
    const budgetEl = document.querySelector('.job-features, .js-budget');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
  }

  // 9. Guru.com
  else if (url.includes('guru.com')) {
    const titleEl = document.querySelector('.job-title, h1, .page-title');
    const companyEl = document.querySelector('.company-name, .employer-name, .about-employer');
    const descEl = document.querySelector('.job-description, .job-desc, #job-description');
    const budgetEl = document.querySelector('.budget, .project-budget, .job-budget');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.split('\n')[0].trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
  }

  // 10. Fiverr.com
  else if (url.includes('fiverr.com')) {
    const titleEl = document.querySelector('.gig-title-text, h1, .brief-title');
    const companyEl = document.querySelector('.seller-name, .buyer-name, h3');
    const descEl = document.querySelector('.description-wrapper, .gig-description, .brief-description');
    const budgetEl = document.querySelector('.package-price, .price, .budget-amount');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
  }

  // 11. Google Jobs
  else if (url.includes('google.com')) {
    const titleEl = document.querySelector('[role="main"] h2, .QrTe2b, h2');
    const companyEl = document.querySelector('.nTvPKe, .XbghZd');
    const descEl = document.querySelector('.HBvzbc, .Yg2S1e');

    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.trim();
    if (descEl) description = descEl.innerText.trim();
  }

  // Fallbacks
  if (!title) title = document.title.split('|')[0].split('-')[0].trim() || 'Proyecto no detectado';
  if (!company) company = currentMode === 'job' ? 'Empresa no detectada' : 'Cliente no detectado';

  const contactEmail = extractEmailFromText(description);

  // Set platform name
  let platform = 'General';
  if (host.includes('linkedin')) platform = 'LinkedIn';
  else if (host.includes('indeed')) platform = 'Indeed';
  else if (host.includes('infojobs')) platform = 'InfoJobs';
  else if (host.includes('computrabajo')) platform = 'Computrabajo';
  else if (host.includes('bumeran')) platform = 'Bumeran';
  else if (host.includes('freelancer')) platform = 'Freelancer.com';
  else if (host.includes('workana')) platform = 'Workana';
  else if (host.includes('upwork')) platform = 'Upwork';
  else if (host.includes('guru')) platform = 'Guru.com';
  else if (host.includes('fiverr')) platform = 'Fiverr';

  return {
    title,
    company,
    url,
    description,
    budget,
    contactEmail,
    platform
  };
}

async function saveToBackend() {
  const role = document.getElementById('ja-input-role').value.trim();
  const company = document.getElementById('ja-input-company').value.trim();
  const contactEmail = document.getElementById('ja-input-email').value.trim();
  const url = document.getElementById('ja-input-url').value.trim();
  const description = document.getElementById('ja-input-desc').value.trim();
  const budget = document.getElementById('ja-input-budget').value.trim();

  if (!role || !company) {
    showToast('Por favor, completa los campos requeridos (*).', 'error');
    return;
  }

  // Re-read platform from details
  const scraped = scrapeJobData();

  const payload = {
    title: role,
    company,
    contactEmail,
    url,
    description,
    platform: scraped.platform,
    status: 'Saved'
  };

  if (currentMode === 'freelance') {
    payload.budget = budget;
  }

  chrome.storage.local.get(['apiUrl', 'token'], async (result) => {
    const apiUrl = result.apiUrl || 'http://localhost:3000';
    const token = result.token;
    const endpoint = currentMode === 'job' 
      ? `${apiUrl}/api/applications`
      : `${apiUrl}/api/freelance/proposals`;

    const saveBtn = document.getElementById('jobauto-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Guardando...';

    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast(currentMode === 'job' 
          ? '¡Oferta guardada en JobAuto!'
          : '¡Proyecto freelance guardado en JobAuto!'
        );
        setTimeout(() => {
          toggleSidebar();
        }, 1000);
      } else {
        throw new Error();
      }
    } catch (error) {
      console.error('Error saving:', error);
      showToast(`Error: ¿Está encendido el servidor en ${apiUrl}?`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Guardar en Tablero';
    }
  });
}

function showToast(message, type = 'success') {
  let oldToast = document.querySelector('.jobauto-toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.className = `jobauto-toast active ${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Autopilot Helper Functions ─────────────────────────────────────────────
function findJobLinks(platform) {
  const links = Array.from(document.querySelectorAll('a'));
  const urls = [];
  const origin = window.location.origin;

  links.forEach(a => {
    let href = a.getAttribute('href');
    if (!href) return;
    
    // Convert relative to absolute
    if (href.startsWith('/')) {
      href = origin + href;
    } else if (!href.startsWith('http')) {
      return;
    }

    if (platform === 'freelancer' && href.includes('/projects/')) {
      if (!href.includes('?') && !href.includes('/dashboard') && !href.includes('/project/')) {
        urls.push(href);
      }
    }
    else if (platform === 'workana' && (href.includes('/job/') || href.includes('/proyecto/'))) {
      if (!href.includes('?') && !href.includes('/projects')) {
        urls.push(href);
      }
    }
    else if (platform === 'upwork' && (href.includes('/jobs/~') || href.includes('/nx/jobs/search/details/') || href.includes('/jobs/view/'))) {
      urls.push(href);
    }
    else if (platform === 'linkedin' && (href.includes('/view/') || href.includes('/jobs/view/'))) {
      urls.push(href);
    }
    else if (platform === 'computrabajo' && (href.includes('/oferta-de-trabajo/') || href.includes('/trabajo/'))) {
      urls.push(href);
    }
  });

  // Return unique links, capped at 6 to avoid rate limits
  return [...new Set(urls)].slice(0, 6);
}

function runAutopilotStep(ap, token, apiUrl, mode) {
  // Inject keyframe animation for HUD pulsing dot
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
    @keyframes hud-pulse { 0% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.6; } }
  `;
  document.head.appendChild(styleSheet);

  // Create HUD overlay
  const hud = document.createElement('div');
  hud.id = 'jobauto-autopilot-hud';
  hud.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 1000000;
    background: rgba(10, 15, 30, 0.95); color: #f1f5f9;
    border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px;
    padding: 16px; width: 260px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px; line-height: 1.5; pointer-events: none;
  `;
  hud.innerHTML = `
    <div style="font-weight:700; display:flex; align-items:center; gap:6px; color:#a5b4fc; margin-bottom:8px;">
      <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#a5b4fc; animation: hud-pulse 1.5s infinite;"></span>
      🤖 Autopiloto JobAuto
    </div>
    <div style="font-size:11.5px; color:#94a3b8;" id="hud-status">Iniciando...</div>
    <div style="font-size:11.5px; color:#94a3b8; margin-top:4px;" id="hud-progress">Progreso: 0/0</div>
  `;
  document.body.appendChild(hud);

  // Helper to update status in HUD & storage
  const updateStatus = (statusText, updates = {}) => {
    const el = document.getElementById('hud-status');
    if (el) el.textContent = statusText;
    const progressEl = document.getElementById('hud-progress');
    if (progressEl) {
      const current = ap.currentIdx >= 0 ? ap.currentIdx + 1 : 0;
      progressEl.textContent = `Progreso: ${current} de ${ap.total}`;
    }
    chrome.storage.local.set({ autopilot: { ...ap, status: statusText, ...updates } });
  };

  // 1. Check if we are on the Search Page (URLs is empty or currentIdx is -1)
  if (ap.currentIdx === -1) {
    updateStatus('Escaneando ofertas en la página...');
    
    // Wait for page to render jobs list
    setTimeout(() => {
      const jobUrls = findJobLinks(ap.platform);
      
      if (jobUrls.length === 0) {
        updateStatus('No se encontraron ofertas. Deteniendo.', { active: false });
        setTimeout(() => hud.remove(), 4000);
        return;
      }

      ap.urls = jobUrls;
      ap.total = jobUrls.length;
      ap.currentIdx = 0;
      
      updateStatus('Ofertas encontradas. Redireccionando...', {
        urls: jobUrls,
        total: jobUrls.length,
        currentIdx: 0
      });

      // Redirect to first job page
      setTimeout(() => {
        window.location.href = jobUrls[0];
      }, 1500);

    }, 3000);
  } else {
    // 2. We are on a job details page
    updateStatus(`Analizando oferta actual...`);

    setTimeout(async () => {
      try {
        const jobData = scrapeJobData();
        if (!jobData.title) {
          throw new Error('No se pudo extraer el título de la oferta.');
        }

        // Send to backend
        updateStatus(`Guardando oferta en tablero...`);
        const endpoint = mode === 'job' 
          ? `${apiUrl}/api/applications`
          : `${apiUrl}/api/freelance/proposals`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: jobData.title,
            company: jobData.company || 'Cliente / Desconocido',
            url: jobData.url || window.location.href,
            description: jobData.description || 'Sin descripción',
            budget: jobData.budget || '',
            status: 'Saved',
            platform: ap.platform.charAt(0).toUpperCase() + ap.platform.slice(1)
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error del servidor');
        }

        updateStatus(`✅ Oferta guardada exitosamente.`);
      } catch (err) {
        updateStatus(`⚠️ Omitida: ${err.message}`);
      }

      // Wait and proceed to next URL
      setTimeout(() => {
        const nextIdx = ap.currentIdx + 1;
        if (nextIdx < ap.urls.length) {
          updateStatus('Cargando siguiente oferta...', { currentIdx: nextIdx });
          setTimeout(() => {
            window.location.href = ap.urls[nextIdx];
          }, 1500);
        } else {
          updateStatus('🎉 ¡Autopiloto completado!', { active: false });
          setTimeout(() => {
            hud.remove();
            // Redirect to dashboard
            window.location.href = apiUrl;
          }, 2500);
        }
      }, 2500);

    }, 3500);
  }
}
