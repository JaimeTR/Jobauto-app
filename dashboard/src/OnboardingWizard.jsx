import { useState, useRef } from 'react';

const API_BASE = '/api';

export default function OnboardingWizard({ token, onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState('freelance');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  // === JOB: CV ===
  const [cvInputMode, setCvInputMode] = useState('file');
  const [cvText, setCvText] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState(null);
  const fileInputRef = useRef();

  // === FREELANCE: Portfolio + Overview ===
  const [freelanceOverview, setFreelanceOverview] = useState('');
  const [hourlyRate, setHourlyRate] = useState('25');
  const [portfolioLinks, setPortfolioLinks] = useState(['', '', '']);

  // === STEP 3: Project ===
  const [projectText, setProjectText] = useState('');
  const [extractedProject, setExtractedProject] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 4000);
  };

  // === JOB: Extraer CV ===
  const handleExtractCv = async () => {
    setLoading(true);
    try {
      let res;
      if (cvInputMode === 'file' && cvFile) {
        const formData = new FormData();
        formData.append('cvFile', cvFile);
        res = await fetch(`${API_BASE}/profile/extract-cv`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else if (cvInputMode === 'text' && cvText.trim()) {
        res = await fetch(`${API_BASE}/profile/extract-cv`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvText }),
        });
      } else {
        showToast('Sube un archivo o pega el texto de tu CV.', 'error');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractedProfile(data.data);
      showToast('CV analizado! Revisa y corrige los datos.');
    } catch (err) {
      showToast(err.message || 'Error al analizar el CV.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // === FREELANCE: Extraer perfil desde portfolio + overview ===
  const handleExtractFreelance = async () => {
    if (!freelanceOverview.trim() && portfolioLinks.every(l => !l.trim())) {
      showToast('Describe tu perfil o agrega al menos un link de portafolio.', 'error');
      return;
    }
    setLoading(true);
    try {
      const links = portfolioLinks.map(l => l.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/profile/extract-freelance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overview: freelanceOverview,
          portfolioLinks: links,
          hourlyRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractedProfile(data.data);
      showToast('Perfil analizado! Revisa los datos.');
    } catch (err) {
      showToast(err.message || 'Error al analizar el perfil freelance.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // === STEP 3: Extraer proyecto ===
  const handleExtractProject = async () => {
    if (!projectText.trim()) {
      showToast('Describe tu proyecto primero.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/extract-project`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: projectText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractedProject(data.data);
      showToast('Proyecto generado con IA! Revisa los datos.');
    } catch (err) {
      showToast(err.message || 'Error al generar el proyecto.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    const profileData = extractedProfile || {};
    if (!extractedProfile && selectedMode === 'freelance') {
      profileData.freelanceOverview = freelanceOverview;
      profileData.hourlyRate = hourlyRate;
      profileData.name = '';
      profileData.email = '';
    }
    onComplete(profileData, extractedProject, selectedMode, {
      freelanceOverview,
      hourlyRate,
      portfolioLinks: portfolioLinks.filter(l => l.trim()),
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setCvFile(file);
  };

  const updatePortfolioLink = (index, value) => {
    const updated = [...portfolioLinks];
    updated[index] = value;
    setPortfolioLinks(updated);
  };

  const addPortfolioLink = () => {
    setPortfolioLinks([...portfolioLinks, '']);
  };

  const removePortfolioLink = (index) => {
    if (portfolioLinks.length <= 1) return;
    setPortfolioLinks(portfolioLinks.filter((_, i) => i !== index));
  };

  const titles = {
    job: ['Como usaras JobAuto?', 'Importa tu Curriculum', 'Agrega tu primer proyecto'],
    freelance: ['Como usaras JobAuto?', 'Configura tu Perfil Freelance', 'Agrega tu primer proyecto'],
  };

  const containerStyle = {
    position: 'fixed', inset: 0, background: '#060913',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '20px',
  };

  const cardStyle = {
    background: 'rgba(17,24,39,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '540px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  };

  const btnPrimary = {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white', border: 'none', borderRadius: '10px',
    padding: '12px 24px', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', width: '100%', marginTop: '2px',
    transition: 'opacity 0.2s',
  };

  const btnSecondary = {
    background: 'rgba(255,255,255,0.06)', color: '#9ca3af',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    padding: '10px 24px', fontSize: '13px', cursor: 'pointer', width: '100%',
  };

  const inputStyle = {
    background: '#121829', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', padding: '10px 14px', color: 'white',
    fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const currentTitles = titles[selectedMode];

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{
                width: n === step ? '28px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: n <= step ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Paso {step} de 3
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'white', margin: 0 }}>
            {currentTitles[step - 1]}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px' }}>
            {selectedMode === 'freelance' ? 'Modo Freelance' : 'Modo Empleo'}
          </p>
        </div>

        {/* Toast */}
        {toast.msg && (
          <div style={{
            background: toast.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            color: toast.type === 'error' ? '#f87171' : '#34d399',
            borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
          }}>
            {toast.msg}
          </div>
        )}

        {/* ===== STEP 1: MODE ===== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
              Selecciona tu modo de trabajo principal. Este se usara por defecto al iniciar. Podes cambiarlo despues.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { id: 'freelance', emoji: '🚀', title: 'Freelance', desc: 'Proyectos, propuestas y portafolio', note: 'Analiza tu portafolio y genera pitches' },
                { id: 'job', emoji: '💼', title: 'Empleo', desc: 'Vacantes, CVs y entrevistas', note: 'Analiza tu CV y genera cartas adaptadas' },
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  style={{
                    flex: 1, border: selectedMode === m.id
                      ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px', padding: '20px 14px', cursor: 'pointer',
                    background: selectedMode === m.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                    textAlign: 'center', transition: 'all 0.2s',
                    boxShadow: selectedMode === m.id ? '0 0 20px rgba(99,102,241,0.2)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '6px' }}>{m.emoji}</div>
                  <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>{m.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '3px' }}>{m.desc}</div>
                  <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '5px', lineHeight: '1.4' }}>{m.note}</div>
                </div>
              ))}
            </div>

            <button style={btnPrimary} onClick={() => setStep(2)}>
              Continuar →
            </button>
          </div>
        )}

        {/* ===== STEP 2: JOB - CV ===== */}
        {step === 2 && selectedMode === 'job' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
              Subi tu CV. La IA extraera tu nombre, contacto, experiencia y habilidades.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              {['file', 'text'].map(m => (
                <button key={m} onClick={() => setCvInputMode(m)} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                  border: cvInputMode === m ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: cvInputMode === m ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: cvInputMode === m ? '#a5b4fc' : '#6b7280', cursor: 'pointer',
                }}>
                  {m === 'file' ? '📎 Subir Archivo' : '📝 Pegar Texto'}
                </button>
              ))}
            </div>

            {cvInputMode === 'file' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? '#6366f1' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '12px', padding: '28px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'rgba(99,102,241,0.05)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                  onChange={e => setCvFile(e.target.files[0])} />
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{cvFile ? '✅' : '📄'}</div>
                <div style={{ color: cvFile ? '#34d399' : '#6b7280', fontSize: '13px' }}>
                  {cvFile ? cvFile.name : 'Arrastra tu CV o haz clic'}
                </div>
                <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '4px' }}>PDF, DOCX, TXT · Max. 10MB</div>
              </div>
            )}

            {cvInputMode === 'text' && (
              <textarea value={cvText} onChange={e => setCvText(e.target.value)}
                placeholder="Pega el texto completo de tu curriculum..." rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }} />
            )}

            {extractedProfile && (
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#34d399', fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
                  ✅ Datos extraidos — Verifica y corrige:
                </div>
                {['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website'].map(field => (
                  <div key={field} style={{ marginBottom: '8px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px', textTransform: 'capitalize' }}>{field}</label>
                    <input style={inputStyle} value={extractedProfile[field] || ''}
                      onChange={e => setExtractedProfile({ ...extractedProfile, [field]: e.target.value })} placeholder={field} />
                  </div>
                ))}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Resumen Profesional</label>
                  <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                    value={extractedProfile.experienceSummary || ''}
                    onChange={e => setExtractedProfile({ ...extractedProfile, experienceSummary: e.target.value })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={btnSecondary} onClick={() => setStep(1)}>← Atras</button>
              <button style={btnPrimary} onClick={handleExtractCv} disabled={loading}>
                {loading ? 'Analizando...' : extractedProfile ? 'Re-analizar' : 'Analizar CV con IA'}
              </button>
            </div>
            {extractedProfile && (
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={() => setStep(3)}>
                Guardar y Continuar →
              </button>
            )}
            <button style={{ ...btnSecondary, fontSize: '12px' }} onClick={() => setStep(3)}>
              Omitir por ahora →
            </button>
          </div>
        )}

        {/* ===== STEP 2: FREELANCE - Portfolio + Overview ===== */}
        {step === 2 && selectedMode === 'freelance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
              Describe tu perfil profesional y tus habilidades. Agrega links de tu portafolio (GitHub, Behance, web personal, etc). La IA analizara todo.
            </p>

            {/* Overview */}
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Descripcion profesional *</label>
              <textarea
                value={freelanceOverview}
                onChange={e => setFreelanceOverview(e.target.value)}
                placeholder="Ej: Soy desarrollador full-stack con 5 anios de experiencia en React, Node.js y MongoDB. Especializado en e-commerce y dashboards administrativos..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            </div>

            {/* Hourly Rate */}
            <div>
              <label style={{ color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Tarifa por hora (USD)</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                style={{ ...inputStyle, width: '140px' }}
                min="1"
              />
            </div>

            {/* Portfolio Links */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ color: '#9ca3af', fontSize: '12px' }}>Links de Portafolio</label>
                <button
                  onClick={addPortfolioLink}
                  style={{
                    background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: '6px',
                    color: '#a5b4fc', fontSize: '11px', cursor: 'pointer', padding: '4px 10px',
                  }}
                >
                  + Agregar link
                </button>
              </div>
              {portfolioLinks.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <input
                    value={link}
                    onChange={e => updatePortfolioLink(i, e.target.value)}
                    placeholder={`https://github.com/tuusuario o https://tuweb.com`}
                    style={inputStyle}
                  />
                  {portfolioLinks.length > 1 && (
                    <button
                      onClick={() => removePortfolioLink(i)}
                      style={{
                        background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px',
                        color: '#f87171', fontSize: '14px', cursor: 'pointer', padding: '0 8px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Extracted profile */}
            {extractedProfile && (
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#34d399', fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
                  ✅ Datos extraidos — Verifica y corrige:
                </div>
                {['name', 'email', 'location', 'linkedin', 'github', 'website'].map(field => (
                  <div key={field} style={{ marginBottom: '8px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px', textTransform: 'capitalize' }}>{field}</label>
                    <input style={inputStyle} value={extractedProfile[field] || ''}
                      onChange={e => setExtractedProfile({ ...extractedProfile, [field]: e.target.value })} placeholder={field} />
                  </div>
                ))}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Overview Freelance</label>
                  <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                    value={extractedProfile.freelanceOverview || freelanceOverview}
                    onChange={e => setExtractedProfile({ ...extractedProfile, freelanceOverview: e.target.value })} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Tarifa/Hora (USD)</label>
                  <input style={{ ...inputStyle, width: '140px' }}
                    value={extractedProfile.hourlyRate || hourlyRate}
                    onChange={e => setExtractedProfile({ ...extractedProfile, hourlyRate: e.target.value })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={btnSecondary} onClick={() => setStep(1)}>← Atras</button>
              <button style={btnPrimary} onClick={handleExtractFreelance} disabled={loading}>
                {loading ? 'Analizando...' : extractedProfile ? 'Re-analizar' : 'Analizar con IA'}
              </button>
            </div>
            {extractedProfile && (
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={() => setStep(3)}>
                Guardar y Continuar →
              </button>
            )}
            <button style={{ ...btnSecondary, fontSize: '12px' }} onClick={() => setStep(3)}>
              Omitir por ahora →
            </button>
          </div>
        )}

        {/* ===== STEP 3: PROJECT ===== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
              Describe un proyecto que hayas realizado. La IA lo estructurara para tu portafolio.
            </p>
            <textarea
              value={projectText}
              onChange={e => setProjectText(e.target.value)}
              placeholder='Ej: "Desarrolle un e-commerce completo para una tienda de ropa usando React y Node.js con MongoDB..."'
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
            />

            {extractedProject && (
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#a5b4fc', fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
                  ✅ Proyecto generado — Verifica:
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Titulo</label>
                  <input style={inputStyle} value={extractedProject.title || ''} onChange={e => setExtractedProject({ ...extractedProject, title: e.target.value })} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Descripcion</label>
                  <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={extractedProject.description || ''} onChange={e => setExtractedProject({ ...extractedProject, description: e.target.value })} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Tecnologias (separadas por coma)</label>
                  <input style={inputStyle}
                    value={Array.isArray(extractedProject.technologies) ? extractedProject.technologies.join(', ') : ''}
                    onChange={e => setExtractedProject({ ...extractedProject, technologies: e.target.value.split(',').map(t => t.trim()) })} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>URL del Proyecto</label>
                  <input style={inputStyle} value={extractedProject.link || ''} onChange={e => setExtractedProject({ ...extractedProject, link: e.target.value })} placeholder="https://..." />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={btnSecondary} onClick={() => setStep(2)}>← Atras</button>
              <button style={btnPrimary} onClick={handleExtractProject} disabled={loading}>
                {loading ? 'Generando...' : extractedProject ? 'Regenerar' : 'Generar con IA'}
              </button>
            </div>

            <button
              style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '15px', padding: '14px' }}
              onClick={handleFinish}
            >
              🎉 {extractedProject ? 'Guardar y Empezar' : 'Empezar sin proyecto'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
