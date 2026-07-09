import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Rocket, 
  Settings, 
  User, 
  Plus, 
  Save, 
  Eye, 
  EyeOff, 
  Trash2, 
  Sparkles, 
  Copy, 
  Mail, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  X, 
  FolderGit, 
  HelpCircle,
  Clock,
  MapPin,
  DollarSign,
  AlertTriangle,
  Bell,
  CheckCircle,
  Globe,
  Paperclip,
  TrendingUp,
  MessageSquare,
  Lock,
  LogOut,
  Target,
  Phone,
  Star,
  Building,
  Edit3
} from 'lucide-react';
import OnboardingWizard from './OnboardingWizard.jsx';

const API_BASE = '/api';

function AssignUserDropdown({ value, token, onChange }) {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/users/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => {});
  }, [token]);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div onClick={() => setOpen(!open)} style={{
        background: '#121829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
        padding: '6px 10px', color: value ? 'white' : '#6b7280', fontSize: '12px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span>{value || 'Seleccionar encargado...'}</span>
        <span style={{ fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#121829', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
          marginTop: '4px', maxHeight: '150px', overflowY: 'auto'
        }}>
          <div onClick={() => { onChange(''); setOpen(false); }} style={{
            padding: '6px 10px', fontSize: '12px', color: '#6b7280', cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>Sin asignar</div>
          {users.map(u => (
            <div key={u.id} onClick={() => { onChange(u.email); setOpen(false); }} style={{
              padding: '6px 10px', fontSize: '12px', color: value === u.email ? '#a5b4fc' : '#d1d5db', cursor: 'pointer',
              background: value === u.email ? 'rgba(99,102,241,0.1)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{u.email.charAt(0).toUpperCase()}</span>
              {u.email}
            </div>
          ))}
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
    </div>
  );
}

function safeStr(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.price) return String(val.price);
    if (val.text) return String(val.text);
    if (val.value) return String(val.value);
    return JSON.stringify(val);
  }
  return String(val);
}

const statusColors = {
  Saved: { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc' },
  Applied: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  Interviewing: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  Offer: { bg: 'rgba(16,185,129,0.2)', text: '#10b981' },
  Rejected: { bg: 'rgba(239,68,68,0.12)', text: '#f87171' }
};

// ────────────────────────────────────────────────────────────────────────────
// CvImportPanel – mini panel inside Profile tab to import/update from CV
// ────────────────────────────────────────────────────────────────────────────
function CvImportPanel({ token, mode, onProfileExtracted }) {
  const [open, setOpen] = React.useState(false);
  const [inputMode, setInputMode] = React.useState('file');
  const [cvFile, setCvFile] = React.useState(null);
  const [cvText, setCvText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState({ text: '', type: '' });
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef();

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const handleExtract = async () => {
    setLoading(true);
    try {
      let res;
      if (inputMode === 'file' && cvFile) {
        const fd = new FormData();
        fd.append('cvFile', cvFile);
        res = await fetch(`${API_BASE}/profile/extract-cv`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      } else if (inputMode === 'text' && cvText.trim()) {
        res = await fetch(`${API_BASE}/profile/extract-cv`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ cvText }) });
      } else { showMsg('Sube un archivo o pega texto del CV.', 'error'); setLoading(false); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const profile = data.data;
      const mapped = mode === 'freelance'
        ? { name: profile.name, email: profile.email, phone: profile.phone, location: profile.location, linkedin: profile.linkedin, github: profile.github, website: profile.website, hourlyRate: profile.hourlyRate, freelanceOverview: profile.freelanceOverview || profile.experienceSummary }
        : { name: profile.name, email: profile.email, phone: profile.phone, location: profile.location, linkedin: profile.linkedin, github: profile.github, website: profile.website, cvText: profile.cvText, experienceSummary: profile.experienceSummary };

      onProfileExtracted(mapped);
      showMsg('¡CV analizado y perfil actualizado!');
      setOpen(false);
      setCvFile(null); setCvText('');
    } catch (err) { showMsg(err.message || 'Error al analizar el CV.', 'error'); }
    finally { setLoading(false); }
  };

  const inputStyle = { background: '#121829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ marginBottom: '0' }}>
      {!open ? (
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div>
            <div style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>🤖 Importar perfil desde CV</div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Analiza tu CV (PDF, Word, texto) con IA y rellena tu perfil automáticamente</div>
          </div>
          <button className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setOpen(true)}>Importar CV</button>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px', border: '1px solid rgba(99,102,241,0.3)', maxWidth: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, color: 'white', fontSize: '15px' }}>🤖 Analizar CV con IA</h4>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          {msg.text && (
            <div style={{ background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, color: msg.type === 'error' ? '#f87171' : '#34d399', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>{msg.text}</div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {['file', 'text'].map(m => (
              <button key={m} onClick={() => setInputMode(m)} style={{ flex: 1, padding: '7px', borderRadius: '8px', fontSize: '12px', border: inputMode === m ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)', background: inputMode === m ? 'rgba(99,102,241,0.12)' : 'transparent', color: inputMode === m ? '#a5b4fc' : '#6b7280', cursor: 'pointer' }}>
                {m === 'file' ? '📎 Subir Archivo' : '📝 Pegar Texto'}
              </button>
            ))}
          </div>
          {inputMode === 'file' ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); setCvFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(99,102,241,0.05)' : 'transparent', marginBottom: '12px' }}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => setCvFile(e.target.files[0])} />
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>{cvFile ? '✅' : '📄'}</div>
              <div style={{ color: cvFile ? '#34d399' : '#6b7280', fontSize: '13px' }}>{cvFile ? cvFile.name : 'Arrastra o haz clic para seleccionar PDF, DOCX, TXT'}</div>
            </div>
          ) : (
            <textarea value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Pega aquí el texto de tu CV..." rows={6} style={{ ...inputStyle, resize: 'vertical', marginBottom: '12px' }} />
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' }} onClick={() => setOpen(false)}>Cancelar</button>
            <button style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }} onClick={handleExtract} disabled={loading}>
              {loading ? '🤖 Analizando...' : '🤖 Analizar y Actualizar Perfil'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AiProjectPanel – button + inline panel to generate portfolio project from text
// ────────────────────────────────────────────────────────────────────────────
function AiProjectPanel({ token, onProjectCreated }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [msg, setMsg] = React.useState({ text: '', type: '' });

  const showMsg = (t, type = 'success') => { setMsg({ text: t, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const inputStyle = { background: '#121829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  const handleGenerate = async () => {
    if (!text.trim()) { showMsg('Describe tu proyecto primero.', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/extract-project`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.data);
      showMsg('¡Proyecto generado! Revisa y guarda.');
    } catch (err) { showMsg(err.message || 'Error al generar el proyecto.', 'error'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!preview) return;
    await onProjectCreated(preview);
    setOpen(false); setText(''); setPreview(null);
  };

  if (!open) {
    return (
      <button className="btn btn-secondary" onClick={() => setOpen(true)} style={{ whiteSpace: 'nowrap' }}>
        🤖 Generar con IA
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, color: 'white', fontSize: '16px' }}>🤖 Generar Proyecto con IA</h4>
          <button onClick={() => { setOpen(false); setPreview(null); setText(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        {msg.text && (
          <div style={{ background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, color: msg.type === 'error' ? '#f87171' : '#34d399', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>{msg.text}</div>
        )}
        <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>Describe tu proyecto en lenguaje natural y la IA lo estructurará automáticamente.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={'Ej: "Desarrollé una app de gestión de inventario con React Native y Firebase para una empresa de distribución..."'} rows={5} style={{ ...inputStyle, resize: 'vertical', marginBottom: '12px' }} />
        <button style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }} onClick={handleGenerate} disabled={loading}>
          {loading ? '🤖 Generando...' : '🤖 Generar Proyecto'}
        </button>
        {preview && (
          <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#a5b4fc', fontWeight: '600', fontSize: '13px' }}>✅ Resultado — Verifica y corrige:</div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Título</label>
              <input style={inputStyle} value={preview.title || ''} onChange={e => setPreview({ ...preview, title: e.target.value })} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Descripción</label>
              <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={preview.description || ''} onChange={e => setPreview({ ...preview, description: e.target.value })} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Tecnologías (separadas por coma)</label>
              <input style={inputStyle} value={Array.isArray(preview.technologies) ? preview.technologies.join(', ') : preview.technologies || ''} onChange={e => setPreview({ ...preview, technologies: e.target.value.split(',').map(t => t.trim()) })} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>URL del Proyecto</label>
              <input style={inputStyle} value={preview.link || ''} onChange={e => setPreview({ ...preview, link: e.target.value })} placeholder="https://..." />
            </div>
            <button style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }} onClick={handleSave}>
              💾 Guardar en Portafolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('jobauto_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('jobauto_email') || '');
  const [authMode, setAuthMode] = useState('login'); // login, register
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [isOtpPending, setIsOtpPending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);
  const [is2faPending, setIs2faPending] = useState(false);
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // starts true to avoid flash

  // Global modes and tabs
  const [mode, setMode] = useState('freelance'); // freelance, business, job
  const [activeTab, setActiveTab] = useState('board');
  const [boardMode, setBoardMode] = useState('freelance'); // sub-tab for Kanban: freelance, business, job
  
  // Data State
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', cvText: '', experienceSummary: '',
    hourlyRate: '25', freelanceOverview: ''
  });
  const [settings, setSettings] = useState({
    provider: 'gemini', geminiApiKey: '', groqApiKey: '', ollamaModel: 'llama3', ollamaUrl: 'http://localhost:11434',
    defaultEmailTemplate: '', emailSignature: '', rssFeeds: [], monthlyTarget: '3000', alertKeywords: '', calendarLink: ''
  });
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [leads, setLeads] = useState([]);
  
  // UI State
  const [toast, setToast] = useState({ message: '', type: 'success', active: false });
  const [showPassword, setShowPassword] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAiTab, setActiveAiTab] = useState('cv'); // cv, letter, email, prep, redflags, followups
  
  // Bio Generator State
  const [bioForm, setBioForm] = useState({ platform: 'Upwork', niche: 'Full Stack React & Node Developer' });
  const [generatedBio, setGeneratedBio] = useState(null);

  // Follow-up Generator State
  const [generatedFollowUp, setGeneratedFollowUp] = useState('');

  // Modals
  const [currentAppId, setCurrentAppId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showJobFormModal, setShowJobFormModal] = useState(false);
  const [showPortfolioFormModal, setShowPortfolioFormModal] = useState(false);
  const [showMeetingFormModal, setShowMeetingFormModal] = useState(false);
  
  // Forms bindings
  const [jobForm, setJobForm] = useState({ 
    id: '', title: '', company: '', url: '', status: 'Saved', description: '', budget: '', contactEmail: '',
    estimatedHours: '', portfolioAttachments: '', publicProfileLinks: '', platform: 'General'
  });
  const [portfolioForm, setPortfolioForm] = useState({ id: '', title: '', description: '', technologies: '', link: '' });
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', location: '', notes: '', applicationId: '', proposalId: '' });
  const [rssInput, setRssInput] = useState('');

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Load Data only when logged in
  useEffect(() => {
    if (token) {
      loadSettings();
      loadProfile();
      loadBoardData();
      loadInterviews();
      loadPortfolio();
      loadAlerts();
    }
  }, [mode, token]);

  // Periodically refresh alerts every 1 minute
  useEffect(() => {
    if (token) {
      const interval = setInterval(loadAlerts, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);
  // Sincronizar cambio de modo con la extensión en tiempo real
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('JobAutoDashboardModeChanged', { detail: { mode } }));
  }, [mode]);

  useEffect(() => {
    const handleExtModeChange = (e) => {
      if (e.detail && e.detail.mode && e.detail.mode !== mode) {
        setMode(e.detail.mode);
      }
    };
    window.addEventListener('JobAutoModeChanged', handleExtModeChange);
    return () => window.removeEventListener('JobAutoModeChanged', handleExtModeChange);
  }, [mode]);
  // Sincronizar sesión (token/email) con la extensión
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('JobAutoSessionChanged', { detail: { token, email: userEmail } }));
  }, [token, userEmail]);

  useEffect(() => {
    const handleRequestSession = () => {
      window.dispatchEvent(new CustomEvent('JobAutoSessionChanged', { detail: { token, email: userEmail } }));
    };
    window.addEventListener('JobAutoRequestSession', handleRequestSession);
    return () => window.removeEventListener('JobAutoRequestSession', handleRequestSession);
  }, [token, userEmail]);

  // Temporizador para reenviar código
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type, active: true });
    setTimeout(() => setToast(prev => ({ ...prev, active: false })), 3500);
  };

  // Helper for Authenticated Fetches
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      // Session expired or invalid
      handleLogout();
      throw new Error('Sesión expirada o no autorizada.');
    }
    return res;
  };

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsAiLoading(true);
    
    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'error');
      setIsAiLoading(false);
      return;
    }

    const endpoint = authMode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (authMode === 'register' && data.status === 'pending_verification') {
          setIsOtpPending(true);
          setResendTimer(60);
          showToast('Código de verificación enviado. Revisa tu correo.', 'success');
        } else if (authMode === 'login' && data.status === 'pending_2fa') {
          setIs2faPending(true);
          setResendTimer(60);
          showToast('Código de seguridad 2FA enviado. Revisa tu correo.', 'success');
        } else {
          localStorage.setItem('jobauto_token', data.token);
          localStorage.setItem('jobauto_email', data.email);
          setToken(data.token);
          setUserEmail(data.email);
          showToast('¡Sesión iniciada!');
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message || 'Error de autenticación.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, code: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('jobauto_token', data.token);
        localStorage.setItem('jobauto_email', data.email);
        setToken(data.token);
        setUserEmail(data.email);
        setIsOtpPending(false);
        setOtpCode('');
        showToast('¡Cuenta verificada y sesión iniciada!', 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message || 'Código incorrecto o expirado.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVerify2fa = async (e) => {
    e.preventDefault();
    setIsAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, code: loginOtpCode })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('jobauto_token', data.token);
        localStorage.setItem('jobauto_email', data.email);
        setToken(data.token);
        setUserEmail(data.email);
        setIs2faPending(false);
        setLoginOtpCode('');
        showToast('¡Sesión iniciada correctamente!', 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message || 'Código de seguridad incorrecto o expirado.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email })
      });
      const data = await res.json();
      if (res.ok) {
        setResendTimer(60);
        showToast('Código de verificación reenviado a tu correo.', 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message || 'Error al reenviar el código.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleResend2faOtp = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email })
      });
      const data = await res.json();
      if (res.ok) {
        setResendTimer(60);
        showToast('Código de seguridad 2FA reenviado a tu correo.', 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message || 'Error al reenviar el código.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jobauto_token');
    localStorage.removeItem('jobauto_email');
    setToken('');
    setUserEmail('');
    setApplications([]);
    setAlerts([]);
    setOnboardingCompleted(true); // reset to avoid flashing onboarding on next login
    showToast('Sesión cerrada.');
  };

  // Finalizar onboarding: guardar perfil, portafolio, modo y marcar como completado
  const handleOnboardingComplete = async (profileData, portfolioItem, selectedMode) => {
    try {
      // 1. Guardar modo seleccionado
      setMode(selectedMode);

      // 2. Guardar perfil si se extrajo desde CV
      if (profileData) {
        const profileEndpoint = selectedMode === 'freelance'
          ? `${API_BASE}/freelance/profile`
          : `${API_BASE}/profile`;

        const profilePayload = selectedMode === 'freelance'
          ? {
              name: profileData.name || '',
              email: profileData.email || '',
              phone: profileData.phone || '',
              location: profileData.location || '',
              linkedin: profileData.linkedin || '',
              github: profileData.github || '',
              website: profileData.website || '',
              hourlyRate: profileData.hourlyRate || '25',
              freelanceOverview: profileData.freelanceOverview || profileData.experienceSummary || '',
            }
          : {
              name: profileData.name || '',
              email: profileData.email || '',
              phone: profileData.phone || '',
              location: profileData.location || '',
              linkedin: profileData.linkedin || '',
              github: profileData.github || '',
              website: profileData.website || '',
              cvText: profileData.cvText || '',
              experienceSummary: profileData.experienceSummary || '',
            };

        await authFetch(profileEndpoint, {
          method: 'POST',
          body: JSON.stringify(profilePayload),
        });
        setProfile(prev => ({ ...prev, ...profilePayload }));
      }

      // 3. Guardar primer proyecto en portafolio si se generó
      if (portfolioItem && portfolioItem.title) {
        await authFetch(`${API_BASE}/freelance/portfolio`, {
          method: 'POST',
          body: JSON.stringify({
            title: portfolioItem.title || '',
            description: portfolioItem.description || '',
            technologies: Array.isArray(portfolioItem.technologies)
              ? portfolioItem.technologies.join(', ')
              : portfolioItem.technologies || '',
            link: portfolioItem.link || '',
          }),
        });
        await loadPortfolio();
      }

      // 4. Marcar onboarding como completado en el servidor
      await authFetch(`${API_BASE}/settings`, {
        method: 'POST',
        body: JSON.stringify({ onboardingCompleted: true }),
      });
      setOnboardingCompleted(true);
      showToast('¡Perfil configurado! Bienvenido a JobAuto 🚀', 'success');
    } catch (err) {
      console.error('Error al completar onboarding:', err);
      // Aun así desbloquear el dashboard
      setOnboardingCompleted(true);
    }
  };



  // API Loaders
  const loadProfile = async () => {
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/profile` : `${API_BASE}/freelance/profile`;
      const res = await authFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => ({ ...prev, ...data }));
      }
    } catch (e) {}
  };

  const loadSettings = async () => {
    try {
      const res = await authFetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setRssInput(data.rssFeeds ? data.rssFeeds.join('\n') : '');
        // Detectar si el onboarding fue completado
        setOnboardingCompleted(data.onboardingCompleted === true);
      }
    } catch (e) {}
  };

  const loadBoardData = async () => {
    if (mode === 'business') {
      try {
        const res = await authFetch(`${API_BASE}/freelance/proposals`);
        if (res.ok) setApplications(await res.json());
      } catch (e) {}
      return;
    }
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications` : `${API_BASE}/freelance/proposals`;
      const res = await authFetch(endpoint);
      if (res.ok) setApplications(await res.json());
    } catch (e) {}
  };

  const loadApplications = async () => {
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications` : `${API_BASE}/freelance/proposals`;
      const res = await authFetch(endpoint);
      if (res.ok) setApplications(await res.json());
    } catch (e) {}
  };

  const loadInterviews = async () => {
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/interviews` : `${API_BASE}/freelance/meetings`;
      const res = await authFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setInterviews(data);
      }
    } catch (e) {}
  };

  const loadPortfolio = async () => {
    try {
      const res = await authFetch(`${API_BASE}/freelance/portfolio`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (e) {}
  };

  const loadAlerts = async () => {
    try {
      const res = await authFetch(`${API_BASE}/alerts`);
      if (res.ok) {
        const data = await res.json();
        
        const unreadCount = data.filter(a => !a.read).length;
        const currentUnreadCount = alerts.filter(a => !a.read).length;
        
        if (unreadCount > currentUnreadCount && unreadCount > 0) {
          const latestAlert = data.find(a => !a.read);
          if (latestAlert && 'Notification' in window && Notification.permission === 'granted') {
            new Notification("¡Nueva vacante/proyecto compatible >50%!", {
              body: `${latestAlert.title} (${latestAlert.compatibilityScore}% compatibilidad)`
            });
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');
              audio.volume = 0.3;
              audio.play();
            } catch (soundErr) {}
          }
        }
        
        setAlerts(data);
      }
    } catch (e) {}
  };

  const loadLeads = async () => {
    try {
      const res = await authFetch(`${API_BASE}/leads`);
      if (res.ok) setLeads(await res.json());
    } catch (e) {}
  };

  // Actions
  const handleMarkAlertsRead = async () => {
    try {
      await authFetch(`${API_BASE}/alerts/read`, { method: 'POST' });
      loadAlerts();
    } catch (e) {}
  };

  const handleDeleteAlert = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Alerta descartada');
        loadAlerts();
      }
    } catch (e) {
      showToast('Error al descartar alerta', 'error');
    }
  };

  const handleImportAlertToBoard = async (alert) => {
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications` : `${API_BASE}/freelance/proposals`;
      const payload = {
        title: alert.title,
        company: alert.company,
        url: alert.url,
        description: alert.description,
        budget: alert.budget,
        compatibilityScore: alert.compatibilityScore,
        compatibilityRationale: alert.compatibilityRationale,
        clientRedFlags: alert.clientRedFlags,
        status: 'Saved'
      };

      const res = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('¡Importado al tablero correctamente!');
        await authFetch(`${API_BASE}/alerts/${alert.id}`, { method: 'DELETE' });
        loadAlerts();
        loadApplications();
      }
    } catch (e) {
      showToast('Error al importar alerta', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/profile` : `${API_BASE}/freelance/profile`;
      const res = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        showToast('Perfil profesional guardado con éxito');
        loadProfile();
      }
    } catch (e) {
      showToast('Fallo al guardar el perfil', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const parsedFeeds = rssInput.split('\n').map(l => l.trim()).filter(Boolean);
      const updatedSettings = {
        ...settings,
        rssFeeds: parsedFeeds
      };
      
      const res = await authFetch(`${API_BASE}/settings`, {
        method: 'POST',
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        showToast('Ajustes y feeds RSS guardados con éxito');
        loadSettings();
      }
    } catch (e) {
      showToast('Fallo al guardar los ajustes', 'error');
    }
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications` : `${API_BASE}/freelance/proposals`;
      const isEdit = !!jobForm.id;
      const url = isEdit ? `${endpoint}/${jobForm.id}` : endpoint;
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...jobForm,
        portfolioAttachments: typeof jobForm.portfolioAttachments === 'string' ? jobForm.portfolioAttachments.split(',').map(s => s.trim()).filter(Boolean) : jobForm.portfolioAttachments,
        publicProfileLinks: typeof jobForm.publicProfileLinks === 'string' ? jobForm.publicProfileLinks.split('\n').map(s => s.trim()).filter(Boolean) : jobForm.publicProfileLinks
      };

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? 'Registro actualizado' : 'Oferta guardada en el tablero');
        setShowJobFormModal(false);
        loadApplications();
      }
    } catch (e) {
      showToast('Fallo al guardar la oferta', 'error');
    }
  };

  const handleSavePortfolioItem = async (e) => {
    e.preventDefault();
    try {
      const isEdit = !!portfolioForm.id;
      const url = isEdit ? `${API_BASE}/freelance/portfolio/${portfolioForm.id}` : `${API_BASE}/freelance/portfolio`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(portfolioForm)
      });

      if (res.ok) {
        showToast(isEdit ? 'Proyecto de portafolio modificado' : 'Nuevo proyecto agregado al portafolio');
        setShowPortfolioFormModal(false);
        loadPortfolio();
      }
    } catch (e) {
      showToast('Fallo al guardar el proyecto', 'error');
    }
  };

  const handleSaveMeeting = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/interviews` : `${API_BASE}/freelance/meetings`;
      const payload = { ...meetingForm };
      if (mode === 'job') {
        payload.applicationId = payload.applicationId || currentAppId;
      } else {
        payload.proposalId = payload.proposalId || currentAppId;
      }

      const res = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(mode === 'job' ? 'Entrevista agendada' : 'Reunión agendada');
        setShowMeetingFormModal(false);
        loadInterviews();
        loadApplications();
      }
    } catch (e) {
      showToast('Fallo al agendar evento', 'error');
    }
  };

  // AI Actions
  const handleTailorApp = async () => {
    if (!currentAppId) return;
    
    if (mode === 'job' && !profile.cvText) {
      showToast('Ingresa tu CV maestro en tu Perfil antes de adaptar.', 'error');
      return;
    }
    if (mode === 'freelance' && !profile.freelanceOverview) {
      showToast('Completa tu descripción freelance en tu Perfil antes de adaptar.', 'error');
      return;
    }

    setIsAiLoading(true);
    try {
      const endpoint = mode === 'job' 
        ? `${API_BASE}/applications/${currentAppId}/tailor` 
        : `${API_BASE}/freelance/proposals/${currentAppId}/tailor`;
      
      const res = await authFetch(endpoint, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        showToast('¡Materiales optimizados con Inteligencia Artificial!');
        setApplications(prev => prev.map(a => a.id === currentAppId ? data : a));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast(e.message || 'Error durante la optimización con IA', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateInterviewPrep = async () => {
    if (!currentAppId) return;
    setIsAiLoading(true);
    try {
      const endpoint = mode === 'job'
        ? `${API_BASE}/applications/${currentAppId}/interview-prep`
        : `${API_BASE}/freelance/proposals/${currentAppId}/interview-prep`;

      const res = await authFetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        showToast('¡Guía de entrevista generada!');
        setApplications(prev => prev.map(a => a.id === currentAppId ? data : a));
        setActiveAiTab('prep');
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast(e.message || 'Error generando guía', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateBio = async (e) => {
    e.preventDefault();
    setIsAiLoading(true);
    setGeneratedBio(null);
    try {
      const res = await authFetch(`${API_BASE}/freelance/generate-bio`, {
        method: 'POST',
        body: JSON.stringify(bioForm)
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedBio(data);
        showToast('¡Biografía optimizada con IA para la plataforma!');
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast(e.message || 'Error al generar biografía', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateFollowUp = async (days) => {
    if (!currentAppId) return;
    setIsAiLoading(true);
    setGeneratedFollowUp('');
    try {
      const res = await authFetch(`${API_BASE}/freelance/proposals/${currentAppId}/follow-up`, {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedFollowUp(data.message);
        showToast('¡Mensaje de seguimiento redactado!');
        setApplications(prev => prev.map(a => a.id === currentAppId ? { ...a, followUpsCount: data.followUpsCount } : a));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      showToast(e.message || 'Error al generar follow-up', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteApp = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este elemento de tu tablero?')) return;
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications/${id}` : `${API_BASE}/freelance/proposals/${id}`;
      const res = await authFetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        showToast('Registro eliminado');
        setShowDetailModal(false);
        loadApplications();
        loadInterviews();
      }
    } catch (e) {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleDeleteInterview = async (id) => {
    if (!confirm('¿Deseas cancelar y borrar este evento?')) return;
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/interviews/${id}` : `${API_BASE}/freelance/meetings/${id}`;
      const res = await authFetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        showToast('Reunión/Entrevista eliminada');
        loadInterviews();
      }
    } catch (e) {
      showToast('Error al eliminar evento', 'error');
    }
  };

  const handleDeletePortfolioItem = async (id) => {
    if (!confirm('¿Deseas eliminar este proyecto de tu portafolio?')) return;
    try {
      const res = await authFetch(`${API_BASE}/freelance/portfolio/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Proyecto eliminado');
        loadPortfolio();
      }
    } catch (e) {
      showToast('Error al eliminar proyecto', 'error');
    }
  };

  // Card status drag and drop
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications/${id}` : `${API_BASE}/freelance/proposals/${id}`;
      const res = await authFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Estado cambiado a ${getFriendlyStatusName(newStatus)}`);
        loadApplications();
      }
    } catch (e) {
      showToast('Fallo al mover tarjeta', 'error');
    }
  };

  const handleUpdateStatusInModal = async (newStatus) => {
    if (!currentAppId) return;
    try {
      const endpoint = mode === 'job' ? `${API_BASE}/applications/${currentAppId}` : `${API_BASE}/freelance/proposals/${currentAppId}`;
      const res = await authFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Estado actualizado`);
        setApplications(prev => prev.map(a => a.id === currentAppId ? { ...a, status: newStatus } : a));
        loadApplications();
      }
    } catch (e) {
      showToast('Error al actualizar estado', 'error');
    }
  };

  // Mail
  const handleOpenMailto = (app) => {
    const emailBody = app.customEmail || app.customPitch;
    const subject = mode === 'job'
      ? `Postulación para el puesto de ${app.title} - ${profile.name}`
      : `Propuesta para el proyecto: ${app.title} - ${profile.name}`;
    
    const mailtoUrl = `mailto:${app.contactEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copiado al portapapeles');
    }).catch(() => {
      showToast('Error al copiar', 'error');
    });
  };

  const parseBudgetAmount = (bStr) => {
    if (!bStr) return 0;
    const clean = bStr.replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  const getFriendlyStatusName = (status) => {
    const jobMap = { Saved: 'Guardadas', Applied: 'Postuladas', Interviewing: 'Entrevistas', Rejected: 'Rechazadas', Offer: 'Ofertas' };
    const freelanceMap = { Saved: 'Guardadas', Applied: 'Enviadas', Interviewing: 'En Conversación', Offer: 'Ganadas', Rejected: 'Perdidas' };
    const businessMap = { Saved: 'Guardado', Applied: 'Contactando', Interviewing: 'En Espera', Offer: 'Confirmado', Rejected: 'Negado' };
    if (mode === 'business') return businessMap[status] || status;
    return mode === 'job' ? jobMap[status] || status : freelanceMap[status] || status;
  };

  const currentApp = applications.find(a => a.id === currentAppId);

  const renderMarkdown = (md) => {
    if (!md) return '';
    let html = md;
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Calculations
  const wonProposals = applications.filter(a => a.status === 'Offer');
  const totalEarned = wonProposals.reduce((sum, app) => sum + parseBudgetAmount(app.budget), 0);
  const targetEarnings = parseFloat(settings.monthlyTarget) || 3000;
  const targetPercent = Math.min(Math.round((totalEarned / targetEarnings) * 100), 100);

  const unreadAlertsCount = alerts.filter(a => !a.read).length;

  const isProposalInactive = (app) => {
    if (mode !== 'freelance' || (app.status !== 'Applied' && app.status !== 'Interviewing')) return false;
    if (!app.dateApplied) return false;
    const diffTime = Math.abs(new Date() - new Date(app.dateApplied));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 3;
  };

  // --- RENDER UNAUTHENTICATED LOGIN/REGISTER SCREEN ---
  if (!token) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#060913', minHeight: '100vh', padding: '20px' }}>
        
        {/* Toast Notification */}
        <div className={`toast ${toast.active ? 'active' : 'hidden'} ${toast.type}`}>
          {toast.message}
        </div>

        {isOtpPending ? (
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
                <Mail size={24} style={{ color: 'white' }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'white', margin: '8px 0 0 0' }}>Verifica tu Cuenta</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Introduce el código de verificación de 6 dígitos enviado.</p>
            </div>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Código de Verificación (OTP)</label>
                <input 
                  type="text" 
                  value={otpCode} 
                  onChange={e => setOtpCode(e.target.value)} 
                  placeholder="Ej. 123456" 
                  required 
                  maxLength={6}
                  style={{ backgroundColor: 'var(--bg-tertiary)', textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={isAiLoading}>
                <span>{isAiLoading ? 'Verificando...' : 'Verificar Código'}</span>
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                {resendTimer > 0 ? (
                  <span>Reenviar código en <strong style={{ color: 'white' }}>{resendTimer}s</strong></span>
                ) : (
                  <span 
                    onClick={handleResendRegisterOtp} 
                    style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Reenviar código de verificación
                  </span>
                )}
              </div>
              <div>
                ¿No recibiste el código? <span onClick={() => setIsOtpPending(false)} style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer' }}>Volver a Registrarse</span>
              </div>
            </div>
          </div>
        ) : is2faPending ? (
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>
                <Lock size={24} style={{ color: 'white' }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'white', margin: '8px 0 0 0' }}>Seguridad de Acceso (2FA)</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Introduce el código OTP enviado para iniciar sesión de forma segura.</p>
            </div>

            <form onSubmit={handleVerify2fa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Código de Seguridad 2FA</label>
                <input 
                  type="text" 
                  value={loginOtpCode} 
                  onChange={e => setLoginOtpCode(e.target.value)} 
                  placeholder="Ej. 123456" 
                  required 
                  maxLength={6}
                  style={{ backgroundColor: 'var(--bg-tertiary)', textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={isAiLoading}>
                <span>{isAiLoading ? 'Verificando...' : 'Confirmar Acceso'}</span>
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                {resendTimer > 0 ? (
                  <span>Reenviar código en <strong style={{ color: 'white' }}>{resendTimer}s</strong></span>
                ) : (
                  <span 
                    onClick={handleResend2faOtp} 
                    style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Reenviar código de seguridad
                  </span>
                )}
              </div>
              <div>
                ¿Problemas para acceder? <span onClick={() => setIs2faPending(false)} style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer' }}>Volver al Login</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>
                <Rocket size={24} style={{ color: 'white' }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'white', margin: '8px 0 0 0' }}>Bienvenido a JobAuto</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Crea propuestas comerciales e importa vacantes desde tu navegador con IA.</p>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input 
                  type="email" 
                  value={authForm.email} 
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })} 
                  placeholder="nombre@correo.com" 
                  required 
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-with-icon">
                  <input 
                    type={showAuthPassword ? 'text' : 'password'} 
                    value={authForm.password} 
                    onChange={e => setAuthForm({ ...authForm, password: e.target.value })} 
                    placeholder="••••••••" 
                    required 
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  />
                  <button type="button" className="btn-toggle-pass" onClick={() => setShowAuthPassword(!showAuthPassword)}>
                    {showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div className="form-group">
                  <label>Confirmar Contraseña</label>
                  <div className="input-with-icon">
                    <input 
                      type={showAuthConfirmPassword ? 'text' : 'password'} 
                      value={authForm.confirmPassword} 
                      onChange={e => setAuthForm({ ...authForm, confirmPassword: e.target.value })} 
                      placeholder="••••••••" 
                      required 
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    />
                    <button type="button" className="btn-toggle-pass" onClick={() => setShowAuthConfirmPassword(!showAuthConfirmPassword)}>
                      {showAuthConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={isAiLoading}>
                <Lock size={16} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
                <span>{isAiLoading ? 'Procesando...' : (authMode === 'login' ? 'Iniciar Sesión' : 'Registrarse')}</span>
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <>¿No tienes cuenta? <span onClick={() => setAuthMode('register')} style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer' }}>Regístrate gratis</span></>
              ) : (
                <>¿Ya tienes una cuenta? <span onClick={() => setAuthMode('login')} style={{ color: 'var(--accent-primary)', fontWeight: '600', cursor: 'pointer' }}>Inicia sesión</span></>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ONBOARDING (authenticated but not yet completed onboarding) ---
  if (token && !onboardingCompleted) {
    return (
      <>
        <div className={`toast ${toast.active ? 'active' : 'hidden'} ${toast.type}`}>
          {toast.message}
        </div>
        <OnboardingWizard token={token} onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // --- MAIN RENDER (AUTHENTICATED) ---
  return (
    <div className="app-container">
      
      {/* Toast Notification */}
      <div className={`toast ${toast.active ? 'active' : 'hidden'} ${toast.type}`}>
        {toast.message}
      </div>

      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon">
            <Rocket style={{ color: 'white' }} />
          </div>
          <h1>JobAuto</h1>
        </div>
        
        {/* Mode Switch Toggle */}
        <div className="mode-select-container" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <span className="mode-label" style={{ fontSize: '11px' }}>Modo Activo</span>
          <div className="mode-switch-group">
            <button 
              className={`mode-btn ${mode === 'freelance' ? 'active' : ''}`}
              onClick={() => { setMode('freelance'); setActiveTab('board'); }}
            >🚀 Freelance</button>
            <button 
              className={`mode-btn ${mode === 'business' ? 'active' : ''}`}
              onClick={() => { setMode('business'); setActiveTab('board'); }}
            >🏢 Empresa</button>
            <button 
              className={`mode-btn ${mode === 'job' ? 'active' : ''}`}
              onClick={() => { setMode('job'); setActiveTab('board'); }}
            >💼 Trabajo</button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'board' ? 'active' : ''}`} onClick={() => setActiveTab('board')}>
            <Briefcase size={18} />
            <span>{mode === 'job' ? 'Tablero Trabajos' : mode === 'business' ? 'Tablero Prospeccion' : 'Tablero Proyectos'}</span>
          </button>
          <button className={`nav-item ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>
            <FolderGit size={18} />
            <span>Recursos</span>
          </button>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <User size={18} />
            <span>Perfil</span>
          </button>
          {mode === 'freelance' && (
            <button className={`nav-item ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>
              <Briefcase size={18} />
              <span>Portafolio</span>
            </button>
          )}
          <button className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
            <CalendarIcon size={18} />
            <span>Calendario</span>
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} />
            <span>Ajustes</span>
          </button>
        </nav>
        
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Sesión: <strong>{userEmail}</strong>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px', padding: '6px' }}>
            <LogOut size={12} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="status-indicator">
            <span className="dot active"></span>
            <span>Servidor Activo</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        
        <header className="content-header">
          <div className="header-title">
            <h2>{
              activeTab === 'board' ? (mode === 'business' ? 'Tablero de Prospeccion' : `Tablero de ${mode === 'job' ? 'Postulaciones' : 'Proyectos'}`) :
              activeTab === 'resources' ? 'Recursos y Plantillas' :
              activeTab === 'profile' ? 'Mi Perfil' :
              activeTab === 'portfolio' ? 'Portafolio de Proyectos' :
              activeTab === 'calendar' ? 'Calendario' : 'Ajustes del Sistema'
            }</h2>
            <p>
              {activeTab === 'board' && mode === 'business' ? 'Gestiona clientes potenciales encontrados en Google Maps' :
               activeTab === 'board' ? 'Organiza, adapta tus propuestas con IA y da seguimiento' :
               activeTab === 'resources' ? 'Plantillas de correo, propuestas, documentos y recursos para contactar clientes' :
               activeTab === 'profile' ? 'Configura tu perfil profesional y datos de empresa' :
               activeTab === 'portfolio' ? 'Gestiona tus proyectos anteriores para que la IA los use como referencia' :
               activeTab === 'calendar' ? 'Gestiona tus reuniones y sincroniza con Google Calendar' :
               'Configura la IA, conexiones y preferencias del sistema'}
            </p>
          </div>
          {activeTab === 'board' && (
            <button className="btn btn-primary" onClick={() => {
              setJobForm({ 
                id: '', title: '', company: '', url: '', status: 'Saved', description: '', budget: '', contactEmail: '',
                estimatedHours: '', portfolioAttachments: '', publicProfileLinks: '', platform: 'General'
              });
              setShowJobFormModal(true);
            }}>
              <Plus size={16} />
              <span>Nueva {mode === 'job' ? 'Oferta' : 'Propuesta'}</span>
            </button>
          )}
        </header>

        {/* Section: Board (los 3 modos) */}
        {activeTab === 'board' && (
          <section className="content-section active">
            
            {/* Earnings monthly tracker - only for freelance */}
            {mode === 'freelance' && (
              <div className="card" style={{ maxWidth: 'none', padding: '16px 24px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} style={{ color: 'var(--color-offer)' }} /> Meta Financiera Mensual:</span>
                  <span><strong>${totalEarned} USD</strong> ganados de <strong>${targetEarnings} USD</strong> de meta ({targetPercent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${targetPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #6366f1 100%)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}

            <div className="kanban-board">
              {['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected'].map(col => {
                const colApps = applications.filter(a => a.status === col);
                return (
                  <div 
                    key={col}
                    className="kanban-column"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col)}
                  >
                    <div className="column-header">
                      <span>{getFriendlyStatusName(col)}</span>
                      <span className="badge">{colApps.length}</span>
                    </div>
                    <div className="column-cards">
      {colApps.map(app => {
        const appInterview = interviews.find(i => 
          (mode === 'job' ? i.applicationId === app.id : i.proposalId === app.id)
        );

        const inactiveAlert = isProposalInactive(app);
        const descSnippet = safeStr(app.description, '').substring(0, 120);
        const compScoreClass = (app.compatibilityScore || 0) >= 70 ? 'compatibility-high' : ((app.compatibilityScore || 0) >= 40 ? 'compatibility-medium' : 'compatibility-low');
        const budgetStr = safeStr(app.budget, '');
        const platformStr = safeStr(app.platform, '');
        const titleStr = safeStr(app.title, '');
        const companyStr = safeStr(app.company, '');
        const urlStr = safeStr(app.url, '');

                        return (
                          <div 
                            key={app.id} 
                            className="job-card" 
                            draggable 
                            onDragStart={(e) => handleDragStart(e, app.id)}
                            onClick={() => {
                              setCurrentAppId(app.id);
                              setShowDetailModal(true);
                              setGeneratedFollowUp('');
                              setActiveAiTab('cv');
                            }}
                            style={{ borderLeft: inactiveAlert ? '3px solid var(--color-interviewing)' : '1px solid var(--border-color)', position: 'relative' }}
                          >
                            {/* Status badge */}
                            <div style={{
                              position: 'absolute', top: '8px', right: '8px',
                              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                              background: statusColors[app.status]?.bg || 'rgba(107,114,128,0.15)',
                              color: statusColors[app.status]?.text || '#9ca3af',
                              zIndex: 1
                            }}>
                              {getFriendlyStatusName(app.status)}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', paddingRight: '50px' }}>
                              <h4 style={{ flex: 1, margin: 0 }}>{titleStr}</h4>
                              {urlStr && (
                                <a href={urlStr} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  title="Abrir publicacion original"
                                  style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '1px' }}>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                            <div className="company">{companyStr}</div>

                            {(platformStr || budgetStr) && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {platformStr && (
                                  <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                    {platformStr}
                                  </span>
                                )}
                                {budgetStr && (
                                  <span style={{ fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <DollarSign size={10} /> {budgetStr}
                                  </span>
                                )}
                              </div>
                            )}

                            {descSnippet && (
                              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.4', maxHeight: '32px', overflow: 'hidden' }}>
                                {descSnippet}{app.description && app.description.length > 120 ? '...' : ''}
                              </div>
                            )}

                            <div className="job-card-footer">
                              <span className="date">{new Date(app.dateAdded).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</span>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {app.compatibilityScore ? <span className={`compatibility-pill ${compScoreClass}`}>{app.compatibilityScore}%</span> : null}
                              </div>
                            </div>

                            {/* Assigned avatar (Jira style) */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {app.assignedTo ? (
                                  <div title={app.assignedTo} style={{
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white', fontSize: '10px', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'default'
                                  }}>
                                    {app.assignedTo.charAt(0).toUpperCase()}
                                  </div>
                                ) : (
                                  <div style={{
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    border: '1px dashed rgba(255,255,255,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: 0.4
                                  }}>
                                    <User size={11} style={{ color: '#6b7280' }} />
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '3px' }}>
                                <button style={{ fontSize: '10px', padding: '3px 5px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'transparent', color: '#6b7280', cursor: 'pointer', lineHeight: 1 }}
                                  onClick={(e) => { e.stopPropagation(); setCurrentAppId(app.id); setShowDetailModal(true); }}
                                  title="Editar">
                                  <Edit3 size={10} />
                                </button>
                                <button style={{ fontSize: '10px', padding: '3px 5px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', background: 'transparent', color: '#6b7280', cursor: 'pointer', lineHeight: 1 }}
                                  onClick={async (e) => { e.stopPropagation(); if (confirm('Eliminar?')) await handleDeleteApp(app.id); }}
                                  title="Eliminar">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>

                            {inactiveAlert && (
                              <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-interviewing)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                                <AlertTriangle size={11} /> <span>Seguimiento pendiente</span>
                              </div>
                            )}

                            {appInterview && (
                              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-interviewing)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> <span>{appInterview.date} a las {appInterview.time}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section: Recursos y Plantillas */}
        {activeTab === 'resources' && (
          <section className="content-section active">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              
              {/* Email Templates */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📧</div>
                <h4 style={{ margin: '0 0 6px 0' }}>Plantillas de Correo</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Guarda y reutiliza plantillas de correo para propuestas, seguimientos y presentacion.
                </p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#6b7280' }}>
                  Proximamente: editor de plantillas con variables como [Nombre], [Empresa], [Proyecto]
                </div>
              </div>

              {/* Propuestas guardadas */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                <h4 style={{ margin: '0 0 6px 0' }}>Propuestas Guardadas</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Historial de propuestas enviadas con IA. Revisa y reutiliza las que funcionaron.
                </p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#6b7280' }}>
                  Las propuestas generadas con IA se guardan automaticamente en cada proyecto.
                </div>
              </div>

              {/* Documentos */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                <h4 style={{ margin: '0 0 6px 0' }}>Documentos</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  CVs, portafolios PDF, brochures y documentos para compartir con clientes.
                </p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#6b7280' }}>
                  Proximamente: subida de archivos PDF, DOCX, imagenes.
                </div>
              </div>

              {/* Videos / Presentaciones */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎥</div>
                <h4 style={{ margin: '0 0 6px 0' }}>Presentaciones y Videos</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Links de Loom, YouTube, Google Slides para compartir en tus propuestas.
                </p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#6b7280' }}>
                  Agrega URLs de videos demostrativos o presentaciones de servicios.
                </div>
              </div>

              {/* Enlaces utiles */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔗</div>
                <h4 style={{ margin: '0 0 6px 0' }}>Enlaces Rapidos</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Calendly, WhatsApp Business, Google Drive y otras herramientas que usas a diario.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input placeholder="+ Agregar enlace..." style={{ background: '#121829', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '11px' }} />
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Section: Profile */}
        {activeTab === 'profile' && (
          <section className="content-section active" style={{ gap: '24px' }}>
            {/* CV Import Banner */}
            <CvImportPanel token={token} mode={mode} onProfileExtracted={(data) => {
              setProfile(prev => ({ ...prev, ...data }));
              showToast('¡Perfil actualizado desde CV!', 'success');
            }} />

            <div className="card">
              <h3>Datos del Candidato</h3>
              <p className="section-description">Información usada por la IA para redactar pitches y adaptar currículums.</p>
              
              <form onSubmit={handleSaveProfile}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre Completo</label>
                    <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Correo de Contacto</label>
                    <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="text" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ubicación</label>
                    <input type="text" value={profile.location} onChange={e => setProfile({...profile, location: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>LinkedIn URL</label>
                    <input type="url" value={profile.linkedin} onChange={e => setProfile({...profile, linkedin: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>GitHub URL</label>
                    <input type="url" value={profile.github} onChange={e => setProfile({...profile, github: e.target.value})} />
                  </div>
                  <div className="form-group form-fullwidth">
                    <label>Sitio Web Portafolio</label>
                    <input type="url" value={profile.website} onChange={e => setProfile({...profile, website: e.target.value})} />
                  </div>

                  {mode === 'job' ? (
                    <>
                      <div className="form-group form-fullwidth">
                        <label>Resumen Corto de Perfil</label>
                        <textarea value={profile.experienceSummary} onChange={e => setProfile({...profile, experienceSummary: e.target.value})} rows={3}></textarea>
                      </div>
                      <div className="form-group form-fullwidth">
                        <label>Currículum Completo (Texto Plano)</label>
                        <textarea value={profile.cvText} onChange={e => setProfile({...profile, cvText: e.target.value})} rows={10} required></textarea>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label>Tarifa Horaria Base (USD)</label>
                        <input type="number" value={profile.hourlyRate} onChange={e => setProfile({...profile, hourlyRate: e.target.value})} />
                      </div>
                      <div className="form-group form-fullwidth">
                        <label>Resumen Comercial Freelance (Carta de Servicios / Elevator Pitch)</label>
                        <textarea value={profile.freelanceOverview} onChange={e => setProfile({...profile, freelanceOverview: e.target.value})} rows={8} required></textarea>
                      </div>
                    </>
                  )}
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    <Save size={16} />
                    <span>Guardar Perfil</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Profile Bio Generator box */}
            {mode === 'freelance' && (
              <div className="card" style={{ maxWidth: '800px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles style={{ color: 'var(--accent-primary)' }} /> Optimizador de Perfiles Freelance (Bio Generator)</h3>
                <p className="section-description">Genera copias optimizadas de perfil, títulos y descripciones adaptados a cada plataforma freelance.</p>
                <form onSubmit={handleGenerateBio}>
                  <div className="form-grid" style={{ gap: '16px' }}>
                    <div className="form-group">
                      <label>Plataforma Objetivo</label>
                      <select value={bioForm.platform} onChange={e => setBioForm({...bioForm, platform: e.target.value})}>
                        <option value="LinkedIn">LinkedIn Profile Bio</option>
                        <option value="Upwork">Upwork Profile Overview</option>
                        <option value="Freelancer">Freelancer.com Summary</option>
                        <option value="Workana">Workana Bio</option>
                        <option value="Fiverr">Fiverr Seller Bio</option>
                        <option value="Malt">Malt Profile Summary</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Nicho Tecnológico o Rol</label>
                      <input type="text" value={bioForm.niche} onChange={e => setBioForm({...bioForm, niche: e.target.value})} placeholder="Ej. Desarrollador Web Full Stack React/Node" required />
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-magic" disabled={isAiLoading}>
                      <Sparkles size={14} /> {isAiLoading ? 'Optimizando...' : 'Optimizar mi Biografía'}
                    </button>
                  </div>
                </form>

                {generatedBio && (
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Título/Headline Sugerido:</strong>
                        <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(generatedBio.headline)}><Copy size={10} /></button>
                      </div>
                      <div className="text-display" style={{ padding: '12px', marginTop: '6px', fontSize: '13px', backgroundColor: 'var(--bg-tertiary)' }}>
                        {generatedBio.headline}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Biografía / Resumen de Perfil:</strong>
                        <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(generatedBio.bioOverview)}><Copy size={10} /></button>
                      </div>
                      <textarea className="text-display" style={{ padding: '12px', marginTop: '6px', fontSize: '13px', backgroundColor: 'var(--bg-tertiary)', resize: 'vertical', width: '100%', fontFamily: 'inherit', color: 'white' }} value={generatedBio.bioOverview} rows={8} readOnly />
                    </div>

                    <div>
                      <strong>Etiquetas / Palabras Clave recomendadas:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {generatedBio.keywords && generatedBio.keywords.map((kw, idx) => (
                          <span key={idx} className="badge badge-primary">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Section: Portfolio */}
        {activeTab === 'portfolio' && mode === 'freelance' && (
          <section className="content-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px' }}>Proyectos de mi Portafolio</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <AiProjectPanel token={token} onProjectCreated={async (data) => {
                  await authFetch(`${API_BASE}/freelance/portfolio`, {
                    method: 'POST',
                    body: JSON.stringify({
                      title: data.title || '',
                      description: data.description || '',
                      technologies: Array.isArray(data.technologies) ? data.technologies.join(', ') : data.technologies || '',
                      link: data.link || '',
                    }),
                  });
                  await loadPortfolio();
                  showToast('¡Proyecto generado con IA y agregado!', 'success');
                }} />
                <button className="btn btn-primary" onClick={() => {
                  setPortfolioForm({ id: '', title: '', description: '', technologies: '', link: '' });
                  setShowPortfolioFormModal(true);
                }}>
                  <Plus size={16} />
                  <span>Agregar Proyecto</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {portfolio.map(project => (
                <div key={project.id} className="card" style={{ padding: '20px', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{project.title}</h4>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-small btn-secondary" onClick={() => {
                        setPortfolioForm(project);
                        setShowPortfolioFormModal(true);
                      }}>Editar</button>
                      <button className="btn btn-small btn-danger btn-icon" onClick={() => handleDeletePortfolioItem(project.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4', flexGrow: '1' }}>{project.description}</p>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', width: 'fit-content' }}>
                    ID Portafolio: <code>{project.id}</code>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '600' }}>{project.technologies}</div>
                  {project.link && (
                    <a href={project.link} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Enlace a demo <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section: Calendar */}
        {activeTab === 'calendar' && (
          <section className="content-section active">
            {/* Google Calendar integration card */}
            <div className="card" style={{ maxWidth: 'none', padding: '20px', marginBottom: '20px', background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px' }}>📅</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', color: '#4285f4' }}>Google Calendar</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 8px 0' }}>
                    Conecta tu Google Calendar para ver tus eventos y permitir que clientes agenden reuniones segun tu disponibilidad.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
                      style={{ background: '#4285f4', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>
                      Abrir Google Calendar
                    </a>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280' }}>
                      <input placeholder="Link de Calendly o Google Calendar..." style={{ background: '#121829', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '11px', width: '240px' }}
                        value={settings.calendarLink || ''}
                        onChange={e => setSettings({...settings, calendarLink: e.target.value})} />
                    </span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>
                    Comparti este link con clientes para que agenden segun tu horario. Se sincroniza con tu calendario.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', margin: 0 }}>Reuniones Programadas</h3>
              <button className="btn btn-primary" onClick={() => {
                setMeetingForm({ title: '', date: '', time: '', location: '', notes: '', applicationId: '', proposalId: '' });
                setShowMeetingFormModal(true);
              }}>
                <Plus size={16} />
                <span>Programar Reunión</span>
              </button>
            </div>

            <div className="card" style={{ maxWidth: 'none', padding: '24px' }}>
              {interviews.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tienes reuniones programadas todavía.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {interviews.map(meet => {
                    const linkedApp = applications.find(a => a.id === (meet.applicationId || meet.proposalId));
                    return (
                      <div key={meet.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'white' }}>{meet.title}</h4>
                          {linkedApp && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{mode === 'job' ? 'Empleo' : 'Proyecto'}: {linkedApp.title} en {linkedApp.company}</div>}
                          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {meet.date} a las {meet.time}</span>
                            {meet.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> <a href={meet.location} target="_blank" rel="noreferrer">{meet.location}</a></span>}
                          </div>
                          {meet.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}><strong>Notas:</strong> {meet.notes}</p>}
                        </div>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDeleteInterview(meet.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section: Settings */}
        {activeTab === 'settings' && (
          <section className="content-section active">
            <div className="card">
              <h3>Configuración del Sistema</h3>
              <p className="section-description">Ajusta tus claves de IA y configura tus feeds RSS de Upwork y Freelancer en segundo plano.</p>
              
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label>Proveedor de IA</label>
                  <select value={settings.provider} onChange={e => setSettings({...settings, provider: e.target.value})}>
                    <option value="gemini">Google Gemini API (Premium)</option>
                    <option value="groq">Groq Cloud API (Rápido y Gratis)</option>
                    <option value="ollama">Ollama (Local / Offline)</option>
                  </select>
                </div>

                {settings.provider === 'gemini' && (
                  <div className="form-group">
                    <label>Gemini API Key</label>
                    <div className="input-with-icon">
                      <input type={showPassword ? 'text' : 'password'} value={settings.geminiApiKey || ''} onChange={e => setSettings({...settings, geminiApiKey: e.target.value})} placeholder="Pega tu API Key de Google Studio" />
                      <button type="button" className="btn-toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <small className="form-tip">Consigue tu API Key gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">aistudio.google.com</a></small>
                  </div>
                )}

                {settings.provider === 'groq' && (
                  <div className="form-group">
                    <label>Groq API Key</label>
                    <div className="input-with-icon">
                      <input type={showPassword ? 'text' : 'password'} value={settings.groqApiKey || ''} onChange={e => setSettings({...settings, groqApiKey: e.target.value})} placeholder="Pega tu API Key de Groq" />
                      <button type="button" className="btn-toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <small className="form-tip">Consigue tu API Key en <a href="https://console.groq.com/" target="_blank" rel="noreferrer">console.groq.com</a></small>
                  </div>
                )}

                {settings.provider === 'ollama' && (
                  <>
                    <div className="form-group">
                      <label>Nombre del Modelo Ollama</label>
                      <input type="text" value={settings.ollamaModel} onChange={e => setSettings({...settings, ollamaModel: e.target.value})} placeholder="Ej. llama3 o gemma2" />
                    </div>
                    <div className="form-group">
                      <label>URL del Servidor Ollama</label>
                      <input type="url" value={settings.ollamaUrl} onChange={e => setSettings({...settings, ollamaUrl: e.target.value})} />
                    </div>
                  </>
                )}

                <div className="form-group" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <label>Meta Mensual de Facturación Freelance (USD)</label>
                  <input type="number" value={settings.monthlyTarget || '3000'} onChange={e => setSettings({...settings, monthlyTarget: e.target.value})} placeholder="Ej. 3000" />
                </div>

                <div className="form-group" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <label>Monitoreo Automatico de Proyectos (RSS)</label>
                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                    <strong style={{ color: '#a5b4fc' }}>Como funciona:</strong> El servidor revisa estas URLs cada <strong>15 minutos</strong>. Cuando encuentra proyectos nuevos, los evalua con IA contra tu perfil. Si la compatibilidad supera el <strong>50%</strong>, aparece en la pestaña <strong>Alertas</strong>.
                    <br /><br />
                    <strong style={{ color: '#f59e0b' }}>Como obtener URLs RSS:</strong><br />
                    • <strong>Upwork:</strong> Busca algo → scroll al final → clic en el icono <strong>RSS</strong> naranja → copia la URL<br />
                    • <strong>Freelancer:</strong> Busca → abajo a la derecha clic en <strong>"RSS Feed"</strong> → copia la URL<br />
                    • <strong>InfoJobs:</strong> Busca → final de pagina → <strong>"Sindicar busqueda (RSS)"</strong>
                  </div>

                  <label style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>Palabras clave para filtrar alertas (separadas por coma)</label>
                  <input
                    type="text"
                    value={settings.alertKeywords || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setSettings({...settings, alertKeywords: val});
                    }}
                    placeholder="wordpress, elementor, woocommerce, php"
                    style={{ marginBottom: '12px', background: '#121829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />

                  <label style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>URLs de Feeds RSS (una por linea)</label>
                  <textarea 
                    value={rssInput} 
                    onChange={e => setRssInput(e.target.value)} 
                    rows={5} 
                    style={{ background: '#121829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    placeholder="https://www.upwork.com/ab/feed/topics/rss?securityToken=...&#10;https://www.freelancer.com/rss/..."
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    <Save size={16} />
                    <span>Guardar Ajustes</span>
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

      </main>

      {/* MODAL: Nueva/Editar Oferta */}
      {showJobFormModal && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{jobForm.id ? 'Editar Registro' : `Nueva ${mode === 'job' ? 'Oferta de Trabajo' : 'Propuesta Freelance'}`}</h3>
              <button className="btn-close" onClick={() => setShowJobFormModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveJob}>
                <div className="form-group">
                  <label>{mode === 'job' ? 'Título del Puesto *' : 'Título del Proyecto *'}</label>
                  <input type="text" value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} placeholder="Ej. React Developer" required />
                </div>
                <div className="form-group">
                  <label>{mode === 'job' ? 'Empresa *' : 'Cliente *'}</label>
                  <input type="text" value={jobForm.company} onChange={e => setJobForm({...jobForm, company: e.target.value})} placeholder="Ej. Microsoft" required />
                </div>
                
                <div className="form-grid" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label>Correo de Contacto</label>
                    <input type="email" value={jobForm.contactEmail} onChange={e => setJobForm({...jobForm, contactEmail: e.target.value})} placeholder="reclutador@empresa.com" />
                  </div>
                  
                  {mode === 'freelance' ? (
                    <div className="form-group">
                      <label>Plataforma</label>
                      <select value={jobForm.platform} onChange={e => setJobForm({...jobForm, platform: e.target.value})}>
                        <option value="Upwork">Upwork</option>
                        <option value="Workana">Workana</option>
                        <option value="Freelancer">Freelancer.com</option>
                        <option value="Guru.com">Guru.com</option>
                        <option value="Fiverr">Fiverr</option>
                        <option value="General">Otro / General</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Enlace (URL)</label>
                      <input type="url" value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})} placeholder="https://..." />
                    </div>
                  )}
                </div>

                {mode === 'freelance' && (
                  <div className="form-grid" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Presupuesto</label>
                      <input type="text" value={jobForm.budget} onChange={e => setJobForm({...jobForm, budget: e.target.value})} placeholder="Ej. $1,500 o $35/hr" />
                    </div>
                    <div className="form-group">
                      <label>Estimación de Horas</label>
                      <input type="text" value={jobForm.estimatedHours} onChange={e => setJobForm({...jobForm, estimatedHours: e.target.value})} placeholder="Ej. 40 o 120" />
                    </div>
                  </div>
                )}

                {mode === 'freelance' && (
                  <>
                    <div className="form-group">
                      <label>Enlace original del proyecto (URL)</label>
                      <input type="url" value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})} placeholder="https://..." />
                    </div>
                    <div className="form-group">
                      <label>ID de Proyectos del Portafolio a adjuntar (Separados por coma)</label>
                      <input type="text" value={jobForm.portfolioAttachments} onChange={e => setJobForm({...jobForm, portfolioAttachments: e.target.value})} placeholder="Pegar IDs de tus proyectos, ej: a8b3, c9d2" />
                    </div>
                    <div className="form-group">
                      <label>Enlaces de Perfiles Públicos (Uno por línea)</label>
                      <textarea value={jobForm.publicProfileLinks} onChange={e => setJobForm({...jobForm, publicProfileLinks: e.target.value})} rows={2} placeholder="https://github.com/usuario&#10;https://upwork.com/freelancers/~..."></textarea>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Estado Inicial</label>
                  <select value={jobForm.status} onChange={e => setJobForm({...jobForm, status: e.target.value})}>
                    <option value="Saved">Guardada</option>
                    <option value="Applied">{mode === 'job' ? 'Postulada' : 'Propuesta Enviada'}</option>
                    <option value="Interviewing">{mode === 'job' ? 'Entrevista' : 'En Conversación'}</option>
                    <option value="Offer">{mode === 'job' ? 'Oferta' : 'Ganada'}</option>
                    <option value="Rejected">{mode === 'job' ? 'Rechazada' : 'Perdida'}</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Descripción / Requisitos</label>
                  <textarea value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} rows={5} placeholder="Detalles de la vacante..."></textarea>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowJobFormModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nuevo Proyecto de Portafolio */}
      {showPortfolioFormModal && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{portfolioForm.id ? 'Editar Proyecto' : 'Agregar Proyecto al Portafolio'}</h3>
              <button className="btn-close" onClick={() => setShowPortfolioFormModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSavePortfolioItem}>
                <div className="form-group">
                  <label>Título del Proyecto *</label>
                  <input type="text" value={portfolioForm.title} onChange={e => setPortfolioForm({...portfolioForm, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Descripción del Trabajo</label>
                  <textarea value={portfolioForm.description} onChange={e => setPortfolioForm({...portfolioForm, description: e.target.value})} rows={4} placeholder="Detalla qué hiciste, problemas resueltos..." required></textarea>
                </div>
                <div className="form-group">
                  <label>Tecnologías Utilizadas</label>
                  <input type="text" value={portfolioForm.technologies} onChange={e => setPortfolioForm({...portfolioForm, technologies: e.target.value})} placeholder="Ej. React, Node.js, AWS, MongoDB" required />
                </div>
                <div className="form-group">
                  <label>Enlace Demo (GitHub, Web)</label>
                  <input type="url" value={portfolioForm.link} onChange={e => setPortfolioForm({...portfolioForm, link: e.target.value})} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPortfolioFormModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Programar Entrevista/Reunión */}
      {showMeetingFormModal && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Agendar Reunión / Entrevista</h3>
              <button className="btn-close" onClick={() => setShowMeetingFormModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveMeeting}>
                <div className="form-group">
                  <label>Título de la Reunión *</label>
                  <input type="text" value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} placeholder="Ej. Entrevista Técnica Inicial" required />
                </div>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Hora *</label>
                  <input type="time" value={meetingForm.time} onChange={e => setMeetingForm({...meetingForm, time: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Ubicación (Enlace a Meet, Zoom o Dirección)</label>
                  <input type="text" value={meetingForm.location} onChange={e => setMeetingForm({...meetingForm, location: e.target.value})} placeholder="Ej. Google Meet URL" />
                </div>
                <div className="form-group">
                  <label>Notas Adicionales</label>
                  <textarea value={meetingForm.notes} onChange={e => setMeetingForm({...meetingForm, notes: e.target.value})} rows={3}></textarea>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMeetingFormModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Agendar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE & OPTIMIZACIÓN (The Gatekeeper) */}
      {showDetailModal && currentApp && (
        <div className="modal modal-large active">
          <div className="modal-content">
            
            <div className="modal-header">
              <div className="header-job-info">
                <h3>{currentApp.title}</h3>
                <p>
                  <span className="company-tag">{currentApp.company}</span>
                  {currentApp.platform && <span className="badge badge-primary" style={{ marginLeft: '8px', fontSize: '10px' }}>{currentApp.platform}</span>}
                  {currentApp.url && (
                    <> • <a href={currentApp.url} target="_blank" rel="noreferrer" className="url-link">Ver publicación <ExternalLink size={12} style={{ display: 'inline', marginLeft: '2px' }} /></a></>
                  )}
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}><X size={18} /></button>
            </div>

            <div className="modal-body layout-split">
              
              {/* Left Column: Job detail description */}
              <div className="split-left">
                
                {isProposalInactive(currentApp) && (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderLeft: '4px solid var(--color-interviewing)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Propuesta sin respuesta</div>
                    <span>Han pasado más de 3 días desde el envío. Se recomienda generar un mensaje de seguimiento con IA para reactivar la conversación.</span>
                  </div>
                )}

                <div className="job-meta-box">
                  <h4>Descripción</h4>
                  <div className="description-scrollable" style={{ fontSize: '13px' }}>
                    {currentApp.description || 'Sin descripción detallada.'}
                  </div>
                </div>

                {mode === 'freelance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h5 style={{ fontSize: '12.5px', color: 'white', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Datos de la Propuesta</h5>
                    {currentApp.budget && <div style={{ fontSize: '13px' }}><strong>Presupuesto:</strong> {currentApp.budget}</div>}
                    {currentApp.estimatedHours && <div style={{ fontSize: '13px' }}><strong>Horas Estimadas:</strong> {currentApp.estimatedHours} horas</div>}
                    
                    {currentApp.portfolioAttachments && currentApp.portfolioAttachments.length > 0 && (
                      <div style={{ fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        <strong>Adjuntos:</strong>
                        {currentApp.portfolioAttachments.map((pId, idx) => {
                          const pItem = portfolio.find(p => p.id === pId);
                          return (
                            <span key={idx} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Paperclip size={10} /> {pItem ? pItem.title : pId}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {currentApp.publicProfileLinks && currentApp.publicProfileLinks.length > 0 && (
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        <strong>Perfiles Incluidos:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          {currentApp.publicProfileLinks.map((link, idx) => (
                            <a key={idx} href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                              <Globe size={11} /> {link.length > 30 ? link.substring(0, 30) + '...' : link}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      <strong>Seguimientos enviados:</strong> {currentApp.followUpsCount || 0}
                    </div>
                  </div>
                )}

                {currentApp.contactEmail && (
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                    <strong>Contacto:</strong> <a href={`mailto:${currentApp.contactEmail}`}>{currentApp.contactEmail}</a>
                  </div>
                )}

                {/* Asignar responsable */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>Responsable</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: currentApp.assignedTo ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                      border: currentApp.assignedTo ? 'none' : '1px dashed rgba(255,255,255,0.15)',
                      color: 'white', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {currentApp.assignedTo ? currentApp.assignedTo.charAt(0).toUpperCase() : <User size={14} style={{ color: '#6b7280' }} />}
                    </div>
                    <AssignUserDropdown
                      value={currentApp.assignedTo || ''}
                      token={token}
                      onChange={async (email) => {
                        setApplications(prev => prev.map(a => a.id === currentApp.id ? { ...a, assignedTo: email } : a));
                        const ep = mode === 'job' ? `${API_BASE}/applications/${currentApp.id}` : `${API_BASE}/freelance/proposals/${currentApp.id}`;
                        await authFetch(ep, { method: 'PUT', body: JSON.stringify({ assignedTo: email }) });
                      }}
                    />
                  </div>
                </div>

                <div className="status-control">
                  <label>Estado:</label>
                  <select value={currentApp.status} onChange={e => handleUpdateStatusInModal(e.target.value)}>
                    <option value="Saved">Guardada</option>
                    <option value="Applied">{mode === 'job' ? 'Postulada' : 'Propuesta Enviada'}</option>
                    <option value="Interviewing">{mode === 'job' ? 'Entrevista' : 'En Conversación'}</option>
                    <option value="Offer">{mode === 'job' ? 'Oferta' : 'Ganada'}</option>
                    <option value="Rejected">{mode === 'job' ? 'Rechazada' : 'Perdida'}</option>
                  </select>
                  
                  <button className="btn btn-secondary btn-icon" title="Agendar Reunión" onClick={() => {
                    setMeetingForm(prev => ({ ...prev, applicationId: currentApp.id, proposalId: currentApp.id }));
                    setShowMeetingFormModal(true);
                  }}>
                    <CalendarIcon size={16} />
                  </button>

                  <button className="btn btn-danger btn-icon" onClick={() => handleDeleteApp(currentApp.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Right Column: AI Tailoring and Materials */}
              <div className="split-right">
                
                {!currentApp.compatibilityScore && !isAiLoading && (
                  <div className="ai-header-actions">
                    <button className="btn btn-magic btn-full" onClick={handleTailorApp}>
                      <Sparkles size={16} />
                      <span>{mode === 'job' ? 'Adaptar Perfil y Generar Cartas' : 'Seleccionar Portafolio y Generar Propuesta'}</span>
                    </button>
                  </div>
                )}

                {isAiLoading && (
                  <div className="ai-loader">
                    <div className="spinner"></div>
                    <p>El motor de Inteligencia Artificial está procesando tus materiales...</p>
                  </div>
                )}

                {/* AI Results */}
                {currentApp.compatibilityScore && !isAiLoading && (
                  <div className="ai-results">
                    
                    <div className="compatibility-container">
                      <div className="score-ring">
                        <span className="score-number">{currentApp.compatibilityScore}%</span>
                        <span className="score-label">Afinidad</span>
                      </div>
                      <div className="score-rational">
                        <strong>Compatibilidad de Perfil:</strong>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentApp.compatibilityRationale}</p>
                      </div>
                    </div>

                    <div className="results-tabs">
                      <button className={`tab-btn ${activeAiTab === 'cv' ? 'active' : ''}`} onClick={() => setActiveAiTab('cv')}>
                        {mode === 'job' ? 'CV Adaptado' : 'Portafolio Sugerido'}
                      </button>
                      <button className={`tab-btn ${activeAiTab === 'letter' ? 'active' : ''}`} onClick={() => setActiveAiTab('letter')}>
                        {mode === 'job' ? 'Carta de Presentación' : 'Propuesta (Pitch)'}
                      </button>
                      <button className={`tab-btn ${activeAiTab === 'email' ? 'active' : ''}`} onClick={() => setActiveAiTab('email')}>
                        Borrador de Correo
                      </button>
                      
                      {mode === 'freelance' && (
                        <button className={`tab-btn ${activeAiTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveAiTab('followups')}>
                          Seguimientos
                        </button>
                      )}
                      
                      <button className={`tab-btn ${activeAiTab === 'prep' ? 'active' : ''}`} onClick={() => {
                        if (!currentApp.interviewPrep) {
                          handleGenerateInterviewPrep();
                        } else {
                          setActiveAiTab('prep');
                        }
                      }}>
                        Guía de Entrevista
                      </button>
                      
                      {currentApp.clientRedFlags && currentApp.clientRedFlags.length > 0 && (
                        <button className={`tab-btn ${activeAiTab === 'redflags' ? 'active' : ''}`} onClick={() => setActiveAiTab('redflags')} style={{ color: 'var(--color-rejected)' }}>
                          Riesgos ({currentApp.clientRedFlags.length})
                        </button>
                      )}
                    </div>

                    {/* Tab: CV / Portfolio */}
                    {activeAiTab === 'cv' && (
                      <div className="tab-content-panel active">
                        {mode === 'job' ? (
                          <>
                            <div className="tab-actions">
                              <span>Ajustes específicos a tu currículum:</span>
                              <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(currentApp.customCV)}>
                                <Copy size={12} /> Copiar
                              </button>
                            </div>
                            <div className="text-display">
                              {renderMarkdown(currentApp.customCV)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tab-actions">
                              <span>Proyectos de tu portafolio sugeridos por la IA:</span>
                            </div>
                            <div className="text-display" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {currentApp.suggestedProjects && currentApp.suggestedProjects.length > 0 ? (
                                currentApp.suggestedProjects.map(projId => {
                                  const pItem = portfolio.find(p => p.id === projId);
                                  if (!pItem) return null;
                                  return (
                                    <div key={projId} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                      <h5 style={{ color: 'white', fontSize: '13px', margin: '0 0 4px 0' }}>{pItem.title}</h5>
                                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{pItem.description}</p>
                                      <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px' }}>{pItem.technologies}</div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  La IA no sugirió ningún proyecto o tu portafolio está vacío. Agrega proyectos en la sección "Mi Portafolio".
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Tab: Cover Letter / Pitch */}
                    {activeAiTab === 'letter' && (
                      <div className="tab-content-panel active">
                        <div className="tab-actions">
                          <span>{mode === 'job' ? 'Carta de presentación personalizada:' : 'Propuesta comercial para bid:'}</span>
                          <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(currentApp.customCoverLetter || currentApp.customPitch)}>
                            <Copy size={12} /> Copiar
                          </button>
                        </div>
                        <textarea 
                          className="text-display text-editable"
                          value={currentApp.customCoverLetter || currentApp.customPitch}
                          onChange={e => {
                            const updatedVal = e.target.value;
                            setApplications(prev => prev.map(a => a.id === currentApp.id 
                              ? (mode === 'job' ? { ...a, customCoverLetter: updatedVal } : { ...a, customPitch: updatedVal }) 
                              : a
                            ));
                          }}
                          rows={12}
                        />
                      </div>
                    )}

                    {/* Tab: Recruiter Email */}
                    {activeAiTab === 'email' && (
                      <div className="tab-content-panel active">
                        <div className="tab-actions">
                          <span>Correo de contacto para aplicar/hacer seguimiento:</span>
                          <div className="button-group" style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(currentApp.customEmail)}>
                              <Copy size={12} /> Copiar
                            </button>
                            <button className="btn btn-small btn-primary" onClick={() => handleOpenMailto(currentApp)}>
                              <Mail size={12} /> Preparar Correo
                            </button>
                          </div>
                        </div>
                        <textarea 
                          className="text-display text-editable"
                          value={currentApp.customEmail}
                          onChange={e => {
                            const updatedVal = e.target.value;
                            setApplications(prev => prev.map(a => a.id === currentApp.id ? { ...a, customEmail: updatedVal } : a));
                          }}
                          rows={10}
                        />
                      </div>
                    )}

                    {/* Tab: Follow-ups Generator */}
                    {activeAiTab === 'followups' && (
                      <div className="tab-content-panel active">
                        <div className="tab-actions">
                          <span>Generar mensaje de seguimiento personalizado:</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-small btn-secondary" onClick={() => handleGenerateFollowUp(3)}>Seguimiento 3 Días</button>
                            <button className="btn btn-small btn-secondary" onClick={() => handleGenerateFollowUp(7)}>Seguimiento 7 Días</button>
                          </div>
                        </div>
                        
                        {generatedFollowUp ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: '1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mensaje generado para copiar:</span>
                              <button className="btn btn-small btn-secondary" onClick={() => copyToClipboard(generatedFollowUp)}>
                                <Copy size={12} /> Copiar
                              </button>
                            </div>
                            <textarea 
                              className="text-display text-editable"
                              value={generatedFollowUp}
                              onChange={e => setGeneratedFollowUp(e.target.value)}
                              rows={8}
                            />
                          </div>
                        ) : (
                          <div className="text-display" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Haz clic en alguno de los botones de arriba para redactar un recordatorio adaptado al proyecto.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Interview Prep FAQ */}
                    {activeAiTab === 'prep' && (
                      <div className="tab-content-panel active">
                        <div className="tab-actions">
                          <span>Preguntas probables y respuestas simuladas:</span>
                        </div>
                        <div className="text-display" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {currentApp.interviewPrep?.questions ? (
                            currentApp.interviewPrep.questions.map((item, idx) => (
                              <div key={idx} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <h5 style={{ color: 'var(--color-interviewing)', fontSize: '13.5px', margin: '0 0 6px 0' }}>Q{idx + 1}: {item.question}</h5>
                                <p style={{ fontSize: '12.5px', color: '#e5e7eb', margin: '0 0 6px 0' }}><strong>Respuesta sugerida:</strong> {item.suggestedAnswer}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>💡 <em>Consejo: {item.tips}</em></p>
                              </div>
                            ))
                          ) : (
                            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Cargando preparación...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab: Red Flags Analysis */}
                    {activeAiTab === 'redflags' && (
                      <div className="tab-content-panel active">
                        <div className="tab-actions">
                          <span style={{ color: 'var(--color-rejected)' }}><strong>Alertas de Riesgo Detectadas en el Proyecto:</strong></span>
                        </div>
                        <div className="text-display" style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '4px solid var(--color-rejected)' }}>
                          {currentApp.clientRedFlags.map((flag, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', padding: '6px 0' }}>
                              <AlertTriangle size={16} style={{ color: 'var(--color-rejected)', flexShrink: 0 }} />
                              <span>{flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
