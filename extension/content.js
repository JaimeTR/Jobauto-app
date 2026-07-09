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

  // 12. Generic scraper for new platforms (Contra, Wellfound, RemoteOK, WWR, Toptal, Arc, PPH)
  else if (host.includes('contra.com') || host.includes('wellfound.com') || host.includes('remoteok.com') || 
           host.includes('weworkremotely.com') || host.includes('toptal.com') || host.includes('arc.dev') ||
           host.includes('peopleperhour.com')) {
    const titleEl = document.querySelector('h1, h2, [class*="title"], [class*="heading"], [itemprop="title"]');
    const companyEl = document.querySelector('[class*="company"], [class*="employer"], [class*="client"], [class*="organization"]');
    const descEl = document.querySelector('[class*="description"], [class*="content"], [class*="details"], [itemprop="description"], article p');
    const budgetEl = document.querySelector('[class*="budget"], [class*="salary"], [class*="rate"], [class*="price"], [class*="compensation"]');
    if (titleEl) title = titleEl.innerText.trim();
    if (companyEl) company = companyEl.innerText.split('\n')[0].trim();
    if (descEl) description = descEl.innerText.trim();
    if (budgetEl) budget = budgetEl.innerText.trim();
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
  else if (host.includes('contra')) platform = 'Contra';
  else if (host.includes('peopleperhour')) platform = 'PeoplePerHour';
  else if (host.includes('toptal')) platform = 'Toptal';
  else if (host.includes('wellfound')) platform = 'Wellfound';
  else if (host.includes('remoteok')) platform = 'RemoteOK';
  else if (host.includes('weworkremotely')) platform = 'WeWorkRemotely';
  else if (host.includes('arc.dev')) platform = 'Arc';
  else if (host.includes('getonbrd')) platform = 'GetOnBoard';

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

// ─── Autopilot: Scrape Search Results ─────────────────────────────────────────
function scrapeSearchResults(platform) {
  const host = window.location.hostname;
  const origin = window.location.origin;
  const listings = [];

  function cleanText(el) {
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
  }

  // ── LinkedIn ──
  if (host.includes('linkedin.com')) {
    document.querySelectorAll('.job-card-container, .jobs-search-results__list-item, [data-job-id]').forEach(card => {
      const title = cleanText(card.querySelector('.job-card-list__title, .job-card-container__link, .job-card-list__entity-lockup a, a[href*="/jobs/view/"]'));
      const company = cleanText(card.querySelector('.job-card-container__company-name, .job-card-container__primary-description, .artdeco-entity-lockup__subtitle'));
      const snippet = cleanText(card.querySelector('.job-card-container__metadata-wrapper, .job-card-list__metadata-wrapper'));
      const link = card.querySelector('a[href*="/jobs/view/"], a[data-control-name="jobdetails"]')?.getAttribute('href') || '';
      const url = link.startsWith('/') ? origin + link : link;
      if (title) listings.push({ title, company, snippet, budget: '', url });
    });
  }

  // ── Indeed ──
  else if (host.includes('indeed.com')) {
    document.querySelectorAll('.job_seen_beacon, .resultContent, [data-testid="jobListing"]').forEach(card => {
      const title = cleanText(card.querySelector('h2 a, .jobTitle, [data-testid="jobTitle"]'));
      const company = cleanText(card.querySelector('[data-testid="company-name"], .companyName, .company_location'));
      const snippet = cleanText(card.querySelector('.job-snippet, .job-snippet-container, .jobMetaDataGroup'));
      const url = card.querySelector('h2 a, [data-testid="jobTitle"] a, a[href*="/viewjob/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? origin + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── InfoJobs ──
  else if (host.includes('infojobs.net')) {
    document.querySelectorAll('[data-qa="offer-item"], .ij-OfferCard, .card-offer').forEach(card => {
      const title = cleanText(card.querySelector('[data-qa="offer-title"], .ij-OfferCard-title, h2 a'));
      const company = cleanText(card.querySelector('[data-qa="offer-company"], .ij-OfferCard-company, .company-name'));
      const snippet = cleanText(card.querySelector('[data-qa="offer-description"], .ij-OfferCard-description'));
      const url = card.querySelector('a[href*="/oferta-de-trabajo/"], h2 a, [data-qa="offer-link"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? origin + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── Computrabajo ──
  else if (host.includes('computrabajo.com')) {
    document.querySelectorAll('.box_border, .iO, article, .box_offer, [class*="card"]').forEach(card => {
      const title = cleanText(card.querySelector('h1 a, h2 a, .title_offer a, [class*="title"] a'));
      const company = cleanText(card.querySelector('.link_emp, .info_company, .company, [class*="company"]'));
      const snippet = cleanText(card.querySelector('.dO, p.descripcion, [class*="desc"]'));
      const url = card.querySelector('a[href*="/trabajo-"], a[href*="/oferta-de-trabajo/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? origin + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── Upwork (freelance) ──
  else if (host.includes('upwork.com')) {
    document.querySelectorAll('.job-tile, [data-test="JobTile"], .up-card-section, section[data-test="JobsList"] > div > div').forEach(card => {
      const title = cleanText(card.querySelector('.job-tile-title a, h2 a, h3 a, [data-test="jobTitle"]'));
      const company = cleanText(card.querySelector('.client-rating-label, [data-test="clientCountry"], .text-muted'));
      const snippet = cleanText(card.querySelector('.job-description-text, [data-test="jobDescription"], .job-description p'));
      const budget = cleanText(card.querySelector('.is-featured, strong[data-test="jobBudget"], .job-tile-rate, [data-test="price"]'));
      const url = card.querySelector('.job-tile-title a, h2 a, h3 a, [data-test="jobTitle"] a')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.upwork.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Freelancer ──
  else if (host.includes('freelancer.com')) {
    document.querySelectorAll('.JobSearchCard-item, .project-card, [class*="ProjectSearchCard"]').forEach(card => {
      const title = cleanText(card.querySelector('.JobSearchCard-primary-heading-link, .project-title a, a[href*="/projects/"]'));
      const company = cleanText(card.querySelector('.JobSearchCard-secondary-heading, .project-client, .user-name'));
      const snippet = cleanText(card.querySelector('.JobSearchCard-primary-description, .project-description, .desc'));
      const budget = cleanText(card.querySelector('.JobSearchCard-primary-heading-price, .project-budget, [class*="budget"]'));
      const url = card.querySelector('.JobSearchCard-primary-heading-link, a[href*="/projects/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.freelancer.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Workana ──
  else if (host.includes('workana.com')) {
    document.querySelectorAll('.project-item, .project-card, article[class*="project"], .card-project').forEach(card => {
      const title = cleanText(card.querySelector('h2 a, .project-title a, h3 a, a[href*="/job/"]'));
      const company = cleanText(card.querySelector('.client-name, .project-client, .user-name'));
      const snippet = cleanText(card.querySelector('.project-description, .project-desc, [class*="desc"]'));
      const budget = cleanText(card.querySelector('.project-budget, .budget, [class*="budget"]'));
      const url = card.querySelector('h2 a, h3 a, a[href*="/job/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.workana.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Guru ──
  else if (host.includes('guru.com')) {
    document.querySelectorAll('.jobRecord, .job-record, [class*="jobItem"], [class*="jobList"] > div').forEach(card => {
      const title = cleanText(card.querySelector('h2 a, h3 a, .title a, a[href*="/d/jobs/"]'));
      const company = cleanText(card.querySelector('.employer, .client, [class*="employer"]'));
      const snippet = cleanText(card.querySelector('.description, .desc, [class*="desc"]'));
      const budget = cleanText(card.querySelector('.budget, .price, [class*="budget"]'));
      const url = card.querySelector('a[href*="/d/jobs/"], a[href*="/jobs/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.guru.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Fiverr (buyer requests / briefs) ──
  else if (host.includes('fiverr.com')) {
    document.querySelectorAll('.gig-card, .gig-wrapper, .seller-card, [class*="gig"]').forEach(card => {
      const title = cleanText(card.querySelector('h3 a, .gig-title, .seller-title a, a[href*="/gig/"]'));
      const company = cleanText(card.querySelector('.seller-name, .username, .seller-info'));
      const snippet = cleanText(card.querySelector('.gig-description, [class*="desc"]'));
      const budget = cleanText(card.querySelector('.price, .gig-price, [class*="price"]'));
      const url = card.querySelector('a[href*="/gig/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.fiverr.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Bumeran ──
  else if (host.includes('bumeran.com')) {
    document.querySelectorAll('[class*="aviso"], [class*="card"], .result-item, article').forEach(card => {
      const title = cleanText(card.querySelector('h2 a, h3 a, [class*="title"] a'));
      const company = cleanText(card.querySelector('[class*="company"], [class*="empresa"], h3'));
      const snippet = cleanText(card.querySelector('[class*="desc"], p'));
      const url = card.querySelector('a[href*="/aviso/"], a[href*="/empleo/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? origin + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── Contra ──
  else if (host.includes('contra.com')) {
    document.querySelectorAll('[class*="project"], [class*="opportunity"], [class*="job"]').forEach(card => {
      const title = cleanText(card.querySelector('h2, h3, [class*="title"] a'));
      const company = cleanText(card.querySelector('[class*="company"], [class*="client"]'));
      const snippet = cleanText(card.querySelector('[class*="desc"], p'));
      const budget = cleanText(card.querySelector('[class*="budget"], [class*="rate"], [class*="price"]'));
      const url = card.querySelector('a[href*="/opportunity/"], a[href*="/project/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://contra.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── PeoplePerHour ──
  else if (host.includes('peopleperhour.com')) {
    document.querySelectorAll('.project-item, .job-listing, [class*="project"], [class*="job-card"]').forEach(card => {
      const title = cleanText(card.querySelector('h2 a, h3 a, .title a'));
      const company = cleanText(card.querySelector('.client-name, .buyer, [class*="client"]'));
      const snippet = cleanText(card.querySelector('.description, [class*="desc"], p'));
      const budget = cleanText(card.querySelector('.budget, .price, [class*="price"], [class*="budget"]'));
      const url = card.querySelector('h2 a, h3 a')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.peopleperhour.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Toptal ──
  else if (host.includes('toptal.com')) {
    document.querySelectorAll('[class*="job"], [class*="project"], [class*="listing"]').forEach(card => {
      const title = cleanText(card.querySelector('h2, h3, [class*="title"]'));
      const company = cleanText(card.querySelector('[class*="company"], [class*="client"]'));
      const snippet = cleanText(card.querySelector('[class*="desc"], p'));
      const budget = cleanText(card.querySelector('[class*="budget"], [class*="rate"]'));
      const url = card.querySelector('a')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://www.toptal.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Wellfound (AngelList) ──
  else if (host.includes('wellfound.com')) {
    document.querySelectorAll('[class*="job"], [class*="listing"], [class*="startup"]').forEach(card => {
      const title = cleanText(card.querySelector('h2, h3, [class*="title"] a'));
      const company = cleanText(card.querySelector('[class*="company"], [class*="startup"]'));
      const snippet = cleanText(card.querySelector('[class*="desc"], [class*="tagline"], p'));
      const budget = cleanText(card.querySelector('[class*="salary"], [class*="compensation"]'));
      const url = card.querySelector('a[href*="/jobs/"], a[href*="/recruiting/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://wellfound.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // ── Remote OK ──
  else if (host.includes('remoteok.com')) {
    document.querySelectorAll('tr.job, [class*="job"], [data-id]').forEach(card => {
      const title = cleanText(card.querySelector('h2, [class*="title"], a[href*="/remote-jobs/"]'));
      const company = cleanText(card.querySelector('[class*="company"], h3, .company'));
      const snippet = cleanText(card.querySelector('[class*="desc"], .description, .tags'));
      const url = card.querySelector('a[href*="/remote-jobs/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://remoteok.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── We Work Remotely ──
  else if (host.includes('weworkremotely.com')) {
    document.querySelectorAll('li.feature, .job, [class*="job"], [class*="listing"]').forEach(card => {
      const title = cleanText(card.querySelector('h2, h3, [class*="title"] a, a[href*="/jobs/"]'));
      const company = cleanText(card.querySelector('.company, [class*="company"], h4'));
      const snippet = cleanText(card.querySelector('[class*="desc"], p'));
      const url = card.querySelector('a[href*="/jobs/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://weworkremotely.com' + url : '');
      if (title) listings.push({ title, company, snippet, budget: '', url: fullUrl });
    });
  }

  // ── Arc () ──
  else if (host.includes('arc.dev')) {
    document.querySelectorAll('[class*="job"], [class*="listing"], article').forEach(card => {
      const title = cleanText(card.querySelector('h2, h3, [class*="title"] a'));
      const company = cleanText(card.querySelector('[class*="company"], h4'));
      const snippet = cleanText(card.querySelector('[class*="desc"], p'));
      const budget = cleanText(card.querySelector('[class*="salary"], [class*="comp"]'));
      const url = card.querySelector('a[href*="/jobs/"], a[href*="/job/"]')?.getAttribute('href') || '';
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? 'https://arc.dev' + url : '');
      if (title) listings.push({ title, company, snippet, budget, url: fullUrl });
    });
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = [];
  for (const l of listings) {
    const key = l.url || l.title;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
  }

  return unique;
}

// ─── Autopilot: Find next page button ──────────────────────────────────────────
function findNextPageButton() {
  const host = window.location.hostname;
  const selectors = [
    '[aria-label="Next"]', '[aria-label="Siguiente"]',
    '.pagination-next:not(.disabled)', '.next:not(.disabled)',
    'a[rel="next"]', 'button[rel="next"]',
    '.pagination a:not(.active):not(.disabled)', '.page-link.next',
    '[data-testid="pagination-next"]', '[data-qa="pagination-next"]',
    'nav a[href*="page="]', '.pagination li:last-child a',
    'a.next_page', '.next_page a', '#next', '.next-button',
    'button[aria-label*="next" i]', 'a[aria-label*="next" i]',
  ];

  if (host.includes('upwork.com')) {
    return document.querySelector('[data-test="pagination-next"], .up-pagination-item:last-child button:not(.up-pagination-item-active)');
  }
  if (host.includes('linkedin.com')) {
    return document.querySelector('.jobs-search-pagination__button[aria-label*="Siguiente"], .jobs-search-pagination__button[aria-label*="Next"], button[aria-label*="next" i], button[aria-label*="siguiente" i]');
  }
  if (host.includes('freelancer.com')) {
    return document.querySelector('.pagination .next:not(.disabled), .pagination li:last-child a:not(.disabled)');
  }
  if (host.includes('indeed.com')) {
    return document.querySelector('a[data-testid="pagination-page-next"], nav a[aria-label="Next"]');
  }
  if (host.includes('computrabajo.com')) {
    return document.querySelector('.pag_numeros a:last-child, .pagination .next, a[rel="next"]');
  }

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && !el.classList.contains('disabled') && !el.hasAttribute('aria-disabled')) {
      return el;
    }
  }
  return null;
}

// ─── Autopilot: Main Runner ────────────────────────────────────────────────────
function runAutopilotStep(ap, token, apiUrl, mode) {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
    @keyframes hud-pulse { 0% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.6; } }
    #jobauto-autopilot-hud a { color: #a5b4fc; text-decoration: none; }
  `;
  document.head.appendChild(styleSheet);

  const hud = document.createElement('div');
  hud.id = 'jobauto-autopilot-hud';
  hud.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 1000000;
    background: rgba(10, 15, 30, 0.96); color: #f1f5f9;
    border: 1px solid rgba(99, 102, 241, 0.5); border-radius: 14px;
    padding: 18px; width: 320px; max-height: 85vh; overflow-y: auto;
    box-shadow: 0 12px 30px rgba(0,0,0,0.6);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px; line-height: 1.5;
  `;
  hud.innerHTML = `
    <div style="font-weight:700; display:flex; align-items:center; gap:8px; color:#a5b4fc; margin-bottom:10px; font-size:14px;">
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#a5b4fc; animation: hud-pulse 1.5s infinite;"></span>
      Autopiloto JobAuto
    </div>
    <div style="font-size:12px; color:#94a3b8; margin-bottom:2px;" id="hud-status">Escaneando...</div>
    <div style="font-size:11px; color:#64748b; margin-bottom:2px;" id="hud-page">Pagina: 1</div>
    <div style="font-size:11px; color:#64748b; margin-bottom:6px;" id="hud-progress">Progreso: -</div>
    <div id="hud-results" style="display:none; margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; max-height:300px; overflow-y:auto;"></div>
  `;
  document.body.appendChild(hud);

  let savedCount = 0;
  let totalCount = 0;
  let currentPage = 1;
  const maxPages = ap.maxPages || 5;

  const updateStatus = (statusText, updates = {}) => {
    const el = document.getElementById('hud-status');
    if (el) el.textContent = statusText;
    const pageEl = document.getElementById('hud-page');
    if (pageEl) pageEl.textContent = `Pag: ${currentPage}/${maxPages} | Guardados: ${savedCount} | Total: ${totalCount}`;
    chrome.storage.local.set({ autopilot: { ...ap, status: statusText, savedCount, totalCount, ...updates } });
  };

  async function scrapeAndSavePage() {
    await new Promise(r => setTimeout(r, 2000));

    const listings = scrapeSearchResults(ap.platform);
    if (listings.length === 0 && currentPage === 1) {
      updateStatus('No se encontraron ofertas en esta plataforma.', { active: false });
      setTimeout(() => hud.remove(), 6000);
      return;
    }

    totalCount += listings.length;
    updateStatus(`${listings.length} ofertas en pagina ${currentPage}. Guardando...`);

    const resultsEl = document.getElementById('hud-results');
    resultsEl.style.display = 'block';

    const endpoint = mode === 'job'
      ? `${apiUrl}/api/applications`
      : `${apiUrl}/api/freelance/proposals`;

    let i = 0;
    for (const listing of listings) {
      i++;
      const stored = await new Promise(resolve => chrome.storage.local.get(['autopilot'], resolve));
      if (!stored.autopilot?.active) {
        updateStatus('Detenido.');
        return;
      }

      const progressEl = document.getElementById('hud-progress');
      if (progressEl) progressEl.textContent = `Guardando: ${i}/${listings.length} | Pag ${currentPage}`;

      // Skip empty titles
      if (!listing.title || listing.title.length < 3) continue;

      try {
        const payload = {
          title: listing.title,
          company: listing.company || 'Sin empresa',
          url: listing.url || window.location.href,
          description: listing.snippet || '',
          budget: listing.budget || '',
          status: 'Saved',
          platform: ap.platform.charAt(0).toUpperCase() + ap.platform.slice(1),
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          savedCount++;
          const itemEl = document.createElement('div');
          itemEl.style.cssText = 'padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:11px;';
          const lnk = listing.url || '#';
          itemEl.innerHTML = `
            <div style="color:#10b981; font-weight:600;">+ ${listing.title.substring(0, 55)}</div>
            <div style="color:#64748b;">${listing.company || ''}${listing.budget ? ' · ' + listing.budget : ''}</div>
            ${lnk !== '#' ? `<a href="${lnk}" target="_blank" style="color:#6366f1; font-size:10px;">Abrir →</a>` : ''}
          `;
          resultsEl.appendChild(itemEl);
        }
      } catch (e) {
        // silently skip
      }

      await new Promise(r => setTimeout(r, 250));
    }

    updateStatus(`Pagina ${currentPage} completada.`);
  }

  async function runAllPages() {
    while (currentPage <= maxPages) {
      const stored = await new Promise(resolve => chrome.storage.local.get(['autopilot'], resolve));
      if (!stored.autopilot?.active) {
        updateStatus('Detenido por el usuario.', { active: false });
        return;
      }

      await scrapeAndSavePage();

      if (currentPage >= maxPages) break;

      const nextBtn = findNextPageButton();
      if (!nextBtn) {
        updateStatus(`Sin mas paginas.`);
        break;
      }

      currentPage++;
      updateStatus(`Navegando a pagina ${currentPage}...`);
      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 1500));
      nextBtn.click();
      await new Promise(r => setTimeout(r, 3500));
    }

    const resultsEl = document.getElementById('hud-results');
    const footerEl = document.createElement('div');
    footerEl.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); text-align:center;';
    footerEl.innerHTML = `
      <div style="color:#34d399; font-size:12px; font-weight:600; margin-bottom:4px;">${savedCount} proyectos guardados en ${currentPage} paginas</div>
      <div style="color:#94a3b8; font-size:10px; margin-bottom:8px;">Usa "Tailor con IA" en el Dashboard para analisis detallado</div>
      <a href="${apiUrl}" style="display:inline-block; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:#fff; padding:8px 16px; border-radius:8px; text-decoration:none; font-weight:600; font-size:12px;">Ir al Dashboard →</a>
    `;
    resultsEl.appendChild(footerEl);
    updateStatus(`Completado.`, { active: false, savedCount, totalCount });
    chrome.storage.local.set({ autopilot: { ...ap, active: false, savedCount, totalCount } });
    setTimeout(() => { if (hud.parentNode) hud.remove(); }, 60000);
  }

  runAllPages().catch(err => {
    updateStatus(`Error: ${err.message}`, { active: false });
    setTimeout(() => hud.remove(), 10000);
  });
}
