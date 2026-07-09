import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import pathNode from 'path';
import dotenv from 'dotenv';

import { 
  initDb, 
  getSettings, 
  updateSettings,
  createUser,
  findUserByEmail,
  createPendingUser,
  getPendingUser,
  deletePendingUser,
  updatePendingUser,
  updateUser,
  // Job
  getJobProfile, 
  updateJobProfile, 
  getApplications, 
  getApplication, 
  addApplication, 
  updateApplication, 
  deleteApplication,
  getInterviews,
  addInterview,
  deleteInterview,
  // Freelance
  getFreelanceProfile,
  updateFreelanceProfile,
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getProposals,
  getProposal,
  addProposal,
  updateProposal,
  deleteProposal,
  getMeetings,
  addMeeting,
  deleteMeeting,
  // Alerts
  getAlerts,
  markAlertsAsRead,
  deleteAlert
} from './db.js';
import { 
  generateTailoredMaterials, 
  generateInterviewPrep, 
  generateFreelanceProposal,
  generatePlatformBio,
  generateFollowUpMessage
} from './ai.js';
import { pollAllFeeds } from './services/rssListener.js';
import { verifyToken, generateToken, verifyPassword } from './utils/auth.js';
import { sendVerificationEmail } from './services/emailService.js';
import multer from 'multer';
import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathNode.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Multer: memoria (no guarda en disco)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Servir la interfaz web del Dashboard compilado
app.use(express.static(pathNode.join(__dirname, 'public')));

// Tarea en segundo plano para escuchar feeds RSS cada 15 minutos
const RSS_POLL_INTERVAL = 15 * 60 * 1000;
setInterval(pollAllFeeds, RSS_POLL_INTERVAL);

// Disparar primer consulta en diferido
setTimeout(pollAllFeeds, 5000);


// --- MIDDLEWARE DE AUTENTICACIÓN ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
  
  req.userId = decoded.userId;
  req.userEmail = decoded.email;
  next();
}


// --- API Endpoints Públicos ---

// Healthcheck (para verificar conexión de la extensión)
app.get('/api/health', (req, res) => {
  res.json({ status: 'online' });
});

// Registro de Usuario (Paso 1: Generación de OTP)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Debes proporcionar correo y contraseña.' });
    }

    // Comprobar si ya existe
    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }
    
    // Generar OTP de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar en la tabla temporal de pendientes
    await createPendingUser(email, password, code);
    
    // Enviar código por correo electrónico (con fallback automático a consola)
    await sendVerificationEmail(email, code);
    
    res.status(200).json({ status: 'pending_verification', email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verificación de Registro (Paso 2: Validar OTP y Crear Cuenta)
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Debes proporcionar correo y código de verificación.' });
    }

    const pending = await getPendingUser(email);
    if (!pending) {
      return res.status(400).json({ error: 'No hay solicitudes de registro pendientes para este correo.' });
    }

    if (Date.now() > pending.expiresAt) {
      await deletePendingUser(email);
      return res.status(400).json({ error: 'El código ha expirado. Por favor, regístrate de nuevo.' });
    }

    if (pending.code !== code.toString().trim()) {
      return res.status(400).json({ error: 'Código de verificación incorrecto.' });
    }

    // Código válido: Registrar usuario definitivo
    const user = await createUser(email, pending.passwordHash, pending.salt);
    
    // Eliminar de pendientes
    await deletePendingUser(email);

    // Generar token JWT de sesión
    const token = generateToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, email: user.email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Inicio de Sesión (Login)
// Inicio de Sesión - Paso 1: Validar credenciales y generar OTP 2FA
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Debes proporcionar correo y contraseña.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar código OTP de inicio de sesión de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // Válido por 10 minutos
    
    // Guardar OTP en el documento de usuario
    await updateUser(email, { loginOtpCode: code, loginOtpExpiresAt: expiresAt });

    // Enviar código por correo electrónico (con fallback automático a consola)
    await sendVerificationEmail(email, code);

    res.json({ status: 'pending_2fa', email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicio de Sesión - Paso 2: Validar OTP 2FA y devolver Token JWT
app.post('/api/auth/login-verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Debes proporcionar correo y código de verificación.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    if (!user.loginOtpCode || Date.now() > user.loginOtpExpiresAt) {
      return res.status(400).json({ error: 'El código ha expirado o no se ha solicitado.' });
    }

    if (user.loginOtpCode !== code.toString().trim()) {
      return res.status(400).json({ error: 'Código de verificación incorrecto.' });
    }

    // Limpiar campos OTP tras validar con éxito
    await updateUser(email, { loginOtpCode: null, loginOtpExpiresAt: null });

    // Generar token JWT definitivo
    const token = generateToken({ userId: user.id, email: user.email });
    res.json({ token, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reenviar código OTP de Registro
app.post('/api/auth/resend-register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Debes proporcionar un correo electrónico.' });
    }

    const pending = await getPendingUser(email);
    if (!pending) {
      return res.status(400).json({ error: 'No hay solicitudes de registro pendientes para este correo.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await updatePendingUser(email, { code, expiresAt });
    await sendVerificationEmail(email, code, 'register');

    res.json({ success: true, status: 'pending_verification', message: 'Código de registro reenviado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reenviar código OTP 2FA de Inicio de Sesión
app.post('/api/auth/resend-2fa', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Debes proporcionar un correo electrónico.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await updateUser(email, { loginOtpCode: code, loginOtpExpiresAt: expiresAt });
    await sendVerificationEmail(email, code, 'login');

    res.json({ success: true, status: 'pending_2fa', message: 'Código de seguridad 2FA reenviado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- API Endpoints Privados (Protegidos con Token JWT) ---

// Ajustes Generales
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await getSettings(req.userId);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await updateSettings(req.userId, req.body);
    setTimeout(pollAllFeeds, 2000);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Extracción de CV con IA ---
async function extractTextFromBuffer(buffer, mimetype, originalname) {
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // Texto plano / TXT
  return buffer.toString('utf8');
}

async function extractCvDataWithAI(text, apiKey) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Analiza el siguiente currículum vitae y extrae los datos estructurados. Responde SOLO con un objeto JSON válido sin markdown ni código envolvente.

El JSON debe tener esta estructura exacta:
{
  "name": "Nombre Completo",
  "email": "correo@ejemplo.com",
  "phone": "+1234567890",
  "location": "Ciudad, País",
  "linkedin": "https://linkedin.com/in/usuario",
  "github": "https://github.com/usuario",
  "website": "https://mi-sitio.com",
  "experienceSummary": "Resumen profesional en 2-3 frases",
  "cvText": "Texto completo o resumen del CV para uso interno",
  "hourlyRate": "30",
  "freelanceOverview": "Descripción de servicios freelance en 2-3 frases",
  "technologies": ["React", "Node.js", "Python"],
  "jobTitle": "Título del puesto más reciente"
}

Si algún campo no aparece en el CV, usa una cadena vacía "". Para hourlyRate, sugiere una tarifa razonable basada en la experiencia detectada (solo el número).

CURRÍCULUM:
${text.slice(0, 8000)}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(jsonStr);
}

// POST /api/profile/extract-cv
app.post('/api/profile/extract-cv', authenticateToken, upload.single('cvFile'), async (req, res) => {
  try {
    const settings = await getSettings(req.userId);
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Se requiere una API Key de Gemini. Configúrala en Ajustes.' });
    }

    let text = '';
    if (req.file) {
      text = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    } else if (req.body.cvText) {
      text = req.body.cvText;
    } else {
      return res.status(400).json({ error: 'Debes subir un archivo (PDF, DOCX, TXT) o proporcionar texto del CV.' });
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'El documento está vacío o no se pudo extraer texto legible.' });
    }

    const extracted = await extractCvDataWithAI(text, apiKey);
    res.json({ success: true, data: extracted });
  } catch (error) {
    console.error('[CV Extract Error]', error.message);
    res.status(500).json({ error: `Error al analizar el CV: ${error.message}` });
  }
});

// POST /api/portfolio/extract-project
app.post('/api/portfolio/extract-project', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Proporciona una descripción del proyecto (mínimo 20 caracteres).' });
    }

    const settings = await getSettings(req.userId);
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Se requiere una API Key de Gemini. Configúrala en Ajustes.' });
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Con base en la siguiente descripción de un proyecto profesional, genera un objeto JSON estructurado para un portafolio. Responde SOLO con el JSON, sin markdown.

Estructura:
{
  "title": "Título del proyecto",
  "description": "Descripción breve y profesional de 2-3 oraciones del proyecto, logros y tecnologías",
  "technologies": ["Tecnología1", "Tecnología2"],
  "link": ""
}

DESCRIPCIÓN DEL PROYECTO:
${text}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const data = JSON.parse(jsonStr);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Project Extract Error]', error.message);
    res.status(500).json({ error: `Error al generar el proyecto: ${error.message}` });
  }
});



// Alertas RSS
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = await getAlerts(req.userId);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/read', authenticateToken, async (req, res) => {
  try {
    const alerts = await markAlertsAsRead(req.userId);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    await deleteAlert(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MODO EMPLEO (JOB MODE) API
// ==========================================

// Perfil Empleo
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getJobProfile(req.userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await updateJobProfile(req.userId, req.body);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Postulaciones
app.get('/api/applications', authenticateToken, async (req, res) => {
  try {
    const apps = await getApplications(req.userId);
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/applications/:id', authenticateToken, async (req, res) => {
  try {
    const appItem = await getApplication(req.userId, req.params.id);
    if (!appItem) return res.status(404).json({ error: 'Postulación no encontrada' });
    res.json(appItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/applications', authenticateToken, async (req, res) => {
  try {
    const newApp = await addApplication(req.userId, req.body);
    res.status(201).json(newApp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/applications/:id', authenticateToken, async (req, res) => {
  try {
    const updatedApp = await updateApplication(req.userId, req.params.id, req.body);
    res.json(updatedApp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/applications/:id', authenticateToken, async (req, res) => {
  try {
    await deleteApplication(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Entrevistas
app.get('/api/interviews', authenticateToken, async (req, res) => {
  try {
    const interviews = await getInterviews(req.userId);
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/interviews', authenticateToken, async (req, res) => {
  try {
    const newInt = await addInterview(req.userId, req.body);
    res.status(201).json(newInt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/interviews/:id', authenticateToken, async (req, res) => {
  try {
    await deleteInterview(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI - Adaptar materiales de Empleo
app.post('/api/applications/:id/tailor', authenticateToken, async (req, res) => {
  try {
    const appItem = await getApplication(req.userId, req.params.id);
    if (!appItem) return res.status(404).json({ error: 'Postulación no encontrada' });

    const profile = await getJobProfile(req.userId);
    if (!profile.cvText) {
      return res.status(400).json({ error: 'Debes ingresar el texto base de tu CV en tu Perfil antes de adaptar.' });
    }

    const materials = await generateTailoredMaterials(req.userId, profile, appItem);

    const updatedApp = await updateApplication(req.userId, req.params.id, {
      customCoverLetter: materials.customCoverLetter,
      customEmail: materials.customEmail,
      customCV: materials.cvAdjustments,
      compatibilityScore: materials.compatibilityScore,
      compatibilityRationale: materials.compatibilityRationale,
      clientRedFlags: materials.clientRedFlags || []
    });

    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI - Preguntas entrevista Empleo
app.post('/api/applications/:id/interview-prep', authenticateToken, async (req, res) => {
  try {
    const appItem = await getApplication(req.userId, req.params.id);
    if (!appItem) return res.status(404).json({ error: 'Postulación no encontrada' });

    const profile = await getJobProfile(req.userId);
    if (!profile.cvText) {
      return res.status(400).json({ error: 'Debes ingresar el texto base de tu CV en tu Perfil antes de preparar la entrevista.' });
    }

    const prepData = await generateInterviewPrep(req.userId, profile, appItem);

    const updatedApp = await updateApplication(req.userId, req.params.id, {
      interviewPrep: prepData
    });

    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// MODO FREELANCE (FREELANCE MODE) API
// ==========================================

// Perfil Freelance
app.get('/api/freelance/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getFreelanceProfile(req.userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/freelance/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await updateFreelanceProfile(req.userId, req.body);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Portafolio
app.get('/api/freelance/portfolio', authenticateToken, async (req, res) => {
  try {
    const port = await getPortfolio(req.userId);
    res.json(port);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/freelance/portfolio', authenticateToken, async (req, res) => {
  try {
    const newItem = await addPortfolioItem(req.userId, req.body);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/freelance/portfolio/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await updatePortfolioItem(req.userId, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/freelance/portfolio/:id', authenticateToken, async (req, res) => {
  try {
    await deletePortfolioItem(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Propuestas Freelance
app.get('/api/freelance/proposals', authenticateToken, async (req, res) => {
  try {
    const props = await getProposals(req.userId);
    res.json(props);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/freelance/proposals/:id', authenticateToken, async (req, res) => {
  try {
    const propItem = await getProposal(req.userId, req.params.id);
    if (!propItem) return res.status(404).json({ error: 'Propuesta no encontrada' });
    res.json(propItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/freelance/proposals', authenticateToken, async (req, res) => {
  try {
    const newProp = await addProposal(req.userId, req.body);
    res.status(201).json(newProp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/freelance/proposals/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await updateProposal(req.userId, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/freelance/proposals/:id', authenticateToken, async (req, res) => {
  try {
    await deleteProposal(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reuniones
app.get('/api/freelance/meetings', authenticateToken, async (req, res) => {
  try {
    const meetings = await getMeetings(req.userId);
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/freelance/meetings', authenticateToken, async (req, res) => {
  try {
    const newMeet = await addMeeting(req.userId, req.body);
    res.status(201).json(newMeet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/freelance/meetings/:id', authenticateToken, async (req, res) => {
  try {
    await deleteMeeting(req.userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI - Adaptar Propuesta y Sugerir Portafolio Freelance
app.post('/api/freelance/proposals/:id/tailor', authenticateToken, async (req, res) => {
  try {
    const propItem = await getProposal(req.userId, req.params.id);
    if (!propItem) return res.status(404).json({ error: 'Propuesta no encontrada' });

    const profile = await getFreelanceProfile(req.userId);
    const portfolio = await getPortfolio(req.userId);

    if (!profile.freelanceOverview) {
      return res.status(400).json({ error: 'Debes completar tu perfil freelance antes de generar propuestas.' });
    }

    const proposalData = await generateFreelanceProposal(req.userId, profile, portfolio, propItem);

    const updatedProp = await updateProposal(req.userId, req.params.id, {
      customPitch: proposalData.customPitch,
      suggestedProjects: proposalData.suggestedProjects,
      compatibilityScore: proposalData.compatibilityScore,
      compatibilityRationale: proposalData.compatibilityRationale,
      budget: proposalData.suggestedBid || propItem.budget,
      clientRedFlags: proposalData.clientRedFlags || []
    });

    res.json(updatedProp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI - Preguntas entrevista Reuniones Freelance
app.post('/api/freelance/proposals/:id/interview-prep', authenticateToken, async (req, res) => {
  try {
    const propItem = await getProposal(req.userId, req.params.id);
    if (!propItem) return res.status(404).json({ error: 'Propuesta no encontrada' });

    const profile = await getFreelanceProfile(req.userId);
    if (!profile.freelanceOverview) {
      return res.status(400).json({ error: 'Debes rellenar tu perfil freelance antes de preparar reuniones.' });
    }

    const prepData = await generateInterviewPrep(req.userId, profile, propItem);

    const updatedProp = await updateProposal(req.userId, req.params.id, {
      interviewPrep: prepData
    });

    res.json(updatedProp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI - Optimizar Biografía/Perfil Freelance
app.post('/api/freelance/generate-bio', authenticateToken, async (req, res) => {
  try {
    const profile = await getFreelanceProfile(req.userId);
    if (!profile.freelanceOverview) {
      const jobProfile = await getJobProfile(req.userId);
      profile.freelanceOverview = jobProfile.cvText;
    }
    
    if (!profile.freelanceOverview) {
      return res.status(400).json({ error: 'Debes rellenar tu CV base o perfil freelance antes de generar biografías.' });
    }

    const { platform, niche } = req.body;
    const bioData = await generatePlatformBio(req.userId, profile, platform, niche);
    res.json(bioData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// AI - Generar mensaje de seguimiento (Follow-up)
app.post('/api/freelance/proposals/:id/follow-up', authenticateToken, async (req, res) => {
  try {
    const propItem = await getProposal(req.userId, req.params.id);
    if (!propItem) return res.status(404).json({ error: 'Propuesta no encontrada' });

    const profile = await getFreelanceProfile(req.userId);
    const { days } = req.body;

    const followUpData = await generateFollowUpMessage(req.userId, profile, propItem, days);

    const updatedCount = (propItem.followUpsCount || 0) + 1;
    await updateProposal(req.userId, req.params.id, {
      followUpsCount: updatedCount
    });

    res.json({
      message: followUpData.message,
      followUpsCount: updatedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


// Comodín redirigir SPA (solo rutas no-API)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(pathNode.join(__dirname, 'public', 'index.html'));
});

try {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Servidor de JobAuto corriendo en http://localhost:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('Modo producción - CORS restringido a:', process.env.CORS_ORIGIN || '*');
    }
  });
} catch (err) {
  console.error('Error al inicializar la base de datos:', err);
  process.exit(1);
}
