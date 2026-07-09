import { useState, useRef } from 'react';

const API_BASE = '/api';

/**
 * OnboardingWizard – Guía al nuevo usuario en 3 pasos:
 * 1. Elegir modo (Freelance o Empleo)
 * 2. Cargar/pegar CV para extracción con IA
 * 3. Agregar primer proyecto (opcional)
 * Al finalizar llama a onComplete(profileData, portfolioItem, selectedMode)
 */
export default function OnboardingWizard({ token, onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState('freelance');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  // Paso 2: CV
  const [cvInputMode, setCvInputMode] = useState('file'); // 'file' | 'text'
  const [cvText, setCvText] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState(null);
  const fileInputRef = useRef();

  // Paso 3: Proyecto
  const [projectText, setProjectText] = useState('');
  const [extractedProject, setExtractedProject] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 4000);
  };

  // --- Paso 2: Extracción de CV ---
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
      showToast('¡CV analizado! Revisa y corrige los datos si es necesario.');
    } catch (err) {
      showToast(err.message || 'Error al analizar el CV.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Paso 3: Extracción de Proyecto ---
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
      showToast('¡Proyecto generado con IA! Revisa los datos.');
    } catch (err) {
      showToast(err.message || 'Error al generar el proyecto.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Finalizar Onboarding ---
  const handleFinish = () => {
    onComplete(extractedProfile, extractedProject, selectedMode);
  };

  // --- Drag & Drop ---
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setCvFile(file);
  };

  // --- Render ---
  const stepTitles = [
    '¿Cómo usarás JobAuto?',
    'Importa tu Currículum',
    'Agrega tu primer proyecto',
  ];

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
    maxWidth: '520px',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  };

  const btnPrimary = {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white', border: 'none', borderRadius: '10px',
    padding: '12px 24px', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', width: '100%', marginTop: '4px',
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
            {stepTitles[step - 1]}
          </h2>
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

        {/* ===== PASO 1: MODO ===== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
              Selecciona tu modo de trabajo principal. Esto determina qué perfil y datos se usarán por defecto. Siempre podrás cambiar el modo después.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { id: 'freelance', emoji: '🚀', title: 'Freelance', desc: 'Proyectos, propuestas y portafolio' },
                { id: 'job', emoji: '💼', title: 'Empleo', desc: 'Vacantes, aplicaciones y entrevistas' },
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
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{m.emoji}</div>
                  <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>{m.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>{m.desc}</div>
                </div>
              ))}
            </div>
            <button style={btnPrimary} onClick={() => setStep(2)}>
              Continuar →
            </button>
          </div>
        )}

        {/* ===== PASO 2: CV ===== */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
              La IA extraerá tu nombre, contacto, experiencia y más para rellenar tu perfil automáticamente. Soporta PDF, Word (.docx) y texto.
            </p>

            {/* Selector de modo de entrada */}
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

            {/* Subida de archivo */}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => setCvFile(e.target.files[0])}
                />
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                  {cvFile ? '✅' : '📄'}
                </div>
                <div style={{ color: cvFile ? '#34d399' : '#6b7280', fontSize: '13px' }}>
                  {cvFile ? cvFile.name : 'Arrastra tu CV aquí o haz clic para seleccionarlo'}
                </div>
                <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '4px' }}>
                  PDF, DOCX, TXT · Máx. 10MB
                </div>
              </div>
            )}

            {/* Área de texto */}
            {cvInputMode === 'text' && (
              <textarea
                value={cvText}
                onChange={e => setCvText(e.target.value)}
                placeholder="Pega aquí el texto completo de tu currículum..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            )}

            {/* Resultados extraídos */}
            {extractedProfile && (
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#34d399', fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
                  ✅ Datos extraídos — Verifica y corrige:
                </div>
                {['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website'].map(field => (
                  <div key={field} style={{ marginBottom: '8px' }}>
                    <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px', textTransform: 'capitalize' }}>
                      {field}
                    </label>
                    <input
                      style={inputStyle}
                      value={extractedProfile[field] || ''}
                      onChange={e => setExtractedProfile({ ...extractedProfile, [field]: e.target.value })}
                      placeholder={field}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Resumen Profesional</label>
                  <textarea
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={extractedProfile.experienceSummary || ''}
                    onChange={e => setExtractedProfile({ ...extractedProfile, experienceSummary: e.target.value })}
                  />
                </div>
                {selectedMode === 'freelance' && (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Tarifa/Hora (USD)</label>
                      <input style={inputStyle} value={extractedProfile.hourlyRate || ''} onChange={e => setExtractedProfile({ ...extractedProfile, hourlyRate: e.target.value })} />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Overview Freelance</label>
                      <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={extractedProfile.freelanceOverview || ''} onChange={e => setExtractedProfile({ ...extractedProfile, freelanceOverview: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={btnSecondary} onClick={() => setStep(1)}>← Atrás</button>
              <button style={btnPrimary} onClick={handleExtractCv} disabled={loading}>
                {loading ? '🤖 Analizando CV...' : extractedProfile ? '🔄 Re-analizar' : '🤖 Analizar con IA'}
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

        {/* ===== PASO 3: PROYECTO ===== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
              Describe un proyecto que hayas realizado en lenguaje natural. La IA lo estructurará para tu portafolio.
            </p>
            <textarea
              value={projectText}
              onChange={e => setProjectText(e.target.value)}
              placeholder={'Ejemplo: "Desarrollé un e-commerce completo para una tienda de ropa usando React en el frontend y Node.js con MongoDB en el backend. Implementé pasarela de pagos con Stripe y panel admin..."'}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
            />

            {extractedProject && (
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#a5b4fc', fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
                  ✅ Proyecto generado — Verifica:
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Título</label>
                  <input style={inputStyle} value={extractedProject.title || ''} onChange={e => setExtractedProject({ ...extractedProject, title: e.target.value })} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Descripción</label>
                  <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={extractedProject.description || ''} onChange={e => setExtractedProject({ ...extractedProject, description: e.target.value })} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>Tecnologías (separadas por coma)</label>
                  <input
                    style={inputStyle}
                    value={Array.isArray(extractedProject.technologies) ? extractedProject.technologies.join(', ') : ''}
                    onChange={e => setExtractedProject({ ...extractedProject, technologies: e.target.value.split(',').map(t => t.trim()) })}
                  />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '11px', display: 'block', marginBottom: '3px' }}>URL del Proyecto</label>
                  <input style={inputStyle} value={extractedProject.link || ''} onChange={e => setExtractedProject({ ...extractedProject, link: e.target.value })} placeholder="https://..." />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={btnSecondary} onClick={() => setStep(2)}>← Atrás</button>
              <button style={btnPrimary} onClick={handleExtractProject} disabled={loading}>
                {loading ? '🤖 Generando...' : extractedProject ? '🔄 Regenerar' : '🤖 Generar con IA'}
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
