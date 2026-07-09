import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../utils/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data.json');

// Default Multi-user Schema
const defaultMultiUserData = {
  users: [],
  pendingUsers: [], // Usuarios temporales en espera de verificación OTP
  profiles: {},     // userId -> { jobProfile: {...}, freelanceProfile: {...} }
  settings: {},     // userId -> { ...settings }
  applications: [], // Array of items with { ..., userId }
  proposals: [],    // Array of items with { ..., userId }
  portfolio: [],    // Array of items with { ..., userId }
  interviews: [],   // Array of items with { ..., userId }
  meetings: [],     // Array of items with { ..., userId }
  alerts: []        // Array of items with { ..., userId }
};

export async function initDb() {
  try {
    await fs.access(DB_FILE);
    const content = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(content);
    let modified = false;

    if (!data.alerts) {
      data.alerts = [];
      modified = true;
    }
    if (!data.pendingUsers) {
      data.pendingUsers = [];
      modified = true;
    }
    
    // Check if we are in the old single-user schema
    if (data.jobMode || data.freelanceMode) {
      console.log('Detectado esquema antiguo de usuario único. Preparando migración...');
      
      const migrated = { ...defaultMultiUserData };
      
      // Save old data in a temp backup property so we can migrate it to the first registered user
      migrated.migrationBackup = {
        jobProfile: data.jobMode?.profile || {},
        freelanceProfile: data.freelanceMode?.profile || {},
        applications: data.jobMode?.applications || [],
        interviews: data.jobMode?.interviews || [],
        proposals: data.freelanceMode?.proposals || [],
        portfolio: data.freelanceMode?.portfolio || [],
        meetings: data.freelanceMode?.meetings || [],
        alerts: data.alerts || [],
        settings: data.settings || {}
      };
      
      await fs.writeFile(DB_FILE, JSON.stringify(migrated, null, 2), 'utf8');
      console.log('Migración preliminar completada. Esperando registro del primer usuario.');
      return;
    }

    if (modified) {
      await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultMultiUserData, null, 2), 'utf8');
  }
}

async function readDb() {
  await initDb();
  const content = await fs.readFile(DB_FILE, 'utf8');
  return JSON.parse(content);
}

async function writeDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export const jsonAdapter = {
  // --- AUTH METHODS ---
  findUserByEmail: async (email) => {
    const db = await readDb();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getAllUsers: async () => {
    const db = await readDb();
    return db.users;
  },

  updateUser: async (email, updateData) => {
    const db = await readDb();
    const index = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) throw new Error('Usuario no encontrado');
    db.users[index] = { ...db.users[index], ...updateData };
    await writeDb(db);
    return db.users[index];
  },

  // Manejo de registros pendientes (OTP)
  getPendingUser: async (email) => {
    const db = await readDb();
    return db.pendingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  updatePendingUser: async (email, updateData) => {
    const db = await readDb();
    const index = db.pendingUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) throw new Error('Solicitud pendiente no encontrada');
    db.pendingUsers[index] = { ...db.pendingUsers[index], ...updateData };
    await writeDb(db);
    return db.pendingUsers[index];
  },

  createPendingUser: async (email, password, code) => {
    const db = await readDb();
    
    // Check if user already exists in main table
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('El correo ya está registrado.');
    }
    
    // Clean old pending records for the same email
    db.pendingUsers = db.pendingUsers.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    
    const { hash, salt } = hashPassword(password);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos de validez
    
    const pending = { email, passwordHash: hash, salt, code, expiresAt };
    db.pendingUsers.push(pending);
    await writeDb(db);
    return pending;
  },

  deletePendingUser: async (email) => {
    const db = await readDb();
    db.pendingUsers = db.pendingUsers.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    await writeDb(db);
    return true;
  },

  createUser: async (email, passwordHash, salt) => {
    const db = await readDb();
    
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('El correo ya está registrado.');
    }
    
    const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const newUser = { id: userId, email, passwordHash, salt };
    db.users.push(newUser);

    // Default settings
    const defaultSettings = {
      userId,
      provider: 'gemini', 
      geminiApiKey: '',
      groqApiKey: '',
      ollamaModel: 'llama3',
      ollamaUrl: 'http://localhost:11434',
      rssFeeds: [], 
      monthlyTarget: '3000',
      defaultEmailTemplate: 'Hola [Name],\n\nMe pongo en contacto contigo para presentarte mi postulación al puesto de [Role] en [Company]...\n\nAtentamente,\n[MyName]',
      emailSignature: 'Saludos cordiales',
      onboardingCompleted: false
    };

    // Default profiles
    const defaultProfiles = {
      userId,
      jobProfile: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', cvText: '', experienceSummary: '' },
      freelanceProfile: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', hourlyRate: '25', freelanceOverview: '' }
    };

    // Migración del primer usuario
    if (db.users.length === 1 && db.migrationBackup) {
      console.log(`Migrando datos heredados al primer usuario verificado: ${email}`);
      const backup = db.migrationBackup;
      
      db.profiles[userId] = {
        jobProfile: { ...defaultProfiles.jobProfile, ...backup.jobProfile },
        freelanceProfile: { ...defaultProfiles.freelanceProfile, ...backup.freelanceProfile }
      };
      
      db.settings[userId] = { ...defaultSettings, ...backup.settings };
      db.applications = backup.applications.map(item => ({ ...item, userId }));
      db.proposals = backup.proposals.map(item => ({ ...item, userId }));
      db.portfolio = backup.portfolio.map(item => ({ ...item, userId }));
      db.interviews = backup.interviews.map(item => ({ ...item, userId }));
      db.meetings = backup.meetings.map(item => ({ ...item, userId }));
      db.alerts = backup.alerts.map(item => ({ ...item, userId }));
      
      delete db.migrationBackup;
    } else {
      db.profiles[userId] = defaultProfiles;
      db.settings[userId] = defaultSettings;
    }
    
    await writeDb(db);
    return { id: newUser.id, email: newUser.email };
  },

  // --- MULTI-USER DATA METHODS ---
  getSettings: async (userId) => {
    const db = await readDb();
    return db.settings[userId] || {};
  },

  updateSettings: async (userId, settingsData) => {
    const db = await readDb();
    db.settings[userId] = { ...(db.settings[userId] || {}), ...settingsData };
    await writeDb(db);
    return db.settings[userId];
  },

  getAlerts: async (userId) => {
    const db = await readDb();
    return db.alerts.filter(a => a.userId === userId);
  },

  addAlert: async (userId, alert) => {
    const db = await readDb();
    if (alert.url && db.alerts.some(a => a.userId === userId && a.url === alert.url)) {
      return null;
    }
    const newAlert = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      title: alert.title || 'Proyecto sin título',
      company: alert.company || 'Cliente sin especificar',
      url: alert.url || '',
      description: alert.description || '',
      budget: alert.budget || '',
      compatibilityScore: alert.compatibilityScore || null,
      compatibilityRationale: alert.compatibilityRationale || '',
      clientRedFlags: alert.clientRedFlags || [],
      dateAdded: new Date().toISOString(),
      read: false
    };
    db.alerts.unshift(newAlert);
    if (db.alerts.length > 100) {
      db.alerts = db.alerts.slice(0, 100);
    }
    await writeDb(db);
    return newAlert;
  },

  markAlertsAsRead: async (userId) => {
    const db = await readDb();
    db.alerts = db.alerts.map(a => a.userId === userId ? { ...a, read: true } : a);
    await writeDb(db);
    return db.alerts.filter(a => a.userId === userId);
  },

  deleteAlert: async (userId, id) => {
    const db = await readDb();
    db.alerts = db.alerts.filter(a => !(a.userId === userId && a.id === id));
    await writeDb(db);
    return true;
  },

  getJobProfile: async (userId) => {
    const db = await readDb();
    return db.profiles[userId]?.jobProfile || {};
  },

  updateJobProfile: async (userId, profileData) => {
    const db = await readDb();
    if (!db.profiles[userId]) db.profiles[userId] = {};
    db.profiles[userId].jobProfile = { ...(db.profiles[userId].jobProfile || {}), ...profileData };
    await writeDb(db);
    return db.profiles[userId].jobProfile;
  },

  getApplications: async (userId) => {
    const db = await readDb();
    return db.applications.filter(app => app.userId === userId);
  },

  getApplication: async (userId, id) => {
    const db = await readDb();
    return db.applications.find(app => app.userId === userId && app.id === id);
  },

  addApplication: async (userId, app) => {
    const db = await readDb();
    const newApp = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      title: app.title || 'Puesto no especificado',
      company: app.company || 'Empresa no especificada',
      url: app.url || '',
      description: app.description || '',
      status: app.status || 'Saved', 
      contactEmail: app.contactEmail || '',
      dateAdded: new Date().toISOString(),
      dateApplied: app.status === 'Applied' ? new Date().toISOString() : null,
      customCV: app.customCV || '',
      customCoverLetter: app.customCoverLetter || '',
      customEmail: app.customEmail || '',
      compatibilityScore: app.compatibilityScore || null,
      compatibilityRationale: app.compatibilityRationale || '',
      interviewPrep: app.interviewPrep || null,
      clientRedFlags: app.clientRedFlags || []
    };
    db.applications.push(newApp);
    await writeDb(db);
    return newApp;
  },

  updateApplication: async (userId, id, appData) => {
    const db = await readDb();
    const index = db.applications.findIndex(app => app.userId === userId && app.id === id);
    if (index === -1) throw new Error('Postulación no encontrada');
    const oldApp = db.applications[index];
    let dateApplied = oldApp.dateApplied;
    if (appData.status === 'Applied' && oldApp.status !== 'Applied') {
      dateApplied = new Date().toISOString();
    }
    db.applications[index] = {
      ...oldApp,
      ...appData,
      dateApplied
    };
    await writeDb(db);
    return db.applications[index];
  },

  deleteApplication: async (userId, id) => {
    const db = await readDb();
    db.applications = db.applications.filter(app => !(app.userId === userId && app.id === id));
    db.interviews = db.interviews.filter(item => !(item.userId === userId && item.applicationId === id));
    await writeDb(db);
    return true;
  },

  getInterviews: async (userId) => {
    const db = await readDb();
    return db.interviews.filter(item => item.userId === userId);
  },

  addInterview: async (userId, interview) => {
    const db = await readDb();
    const newInterview = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      applicationId: interview.applicationId || '',
      title: interview.title || 'Entrevista',
      date: interview.date || new Date().toISOString().split('T')[0],
      time: interview.time || '10:00',
      location: interview.location || '',
      notes: interview.notes || ''
    };
    db.interviews.push(newInterview);
    await writeDb(db);
    if (newInterview.applicationId) {
      const appIndex = db.applications.findIndex(a => a.userId === userId && a.id === newInterview.applicationId);
      if (appIndex !== -1 && db.applications[appIndex].status !== 'Interviewing') {
        db.applications[appIndex].status = 'Interviewing';
        await writeDb(db);
      }
    }
    return newInterview;
  },

  deleteInterview: async (userId, id) => {
    const db = await readDb();
    db.interviews = db.interviews.filter(item => !(item.userId === userId && item.id === id));
    await writeDb(db);
    return true;
  },

  getFreelanceProfile: async (userId) => {
    const db = await readDb();
    return db.profiles[userId]?.freelanceProfile || {};
  },

  updateFreelanceProfile: async (userId, profileData) => {
    const db = await readDb();
    if (!db.profiles[userId]) db.profiles[userId] = {};
    db.profiles[userId].freelanceProfile = { ...(db.profiles[userId].freelanceProfile || {}), ...profileData };
    await writeDb(db);
    return db.profiles[userId].freelanceProfile;
  },

  getPortfolio: async (userId) => {
    const db = await readDb();
    return db.portfolio.filter(item => item.userId === userId);
  },

  addPortfolioItem: async (userId, item) => {
    const db = await readDb();
    const newItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      title: item.title || 'Proyecto sin título',
      description: item.description || '',
      technologies: item.technologies || '',
      link: item.link || ''
    };
    db.portfolio.push(newItem);
    await writeDb(db);
    return newItem;
  },

  updatePortfolioItem: async (userId, id, itemData) => {
    const db = await readDb();
    const index = db.portfolio.findIndex(item => item.userId === userId && item.id === id);
    if (index === -1) throw new Error('Proyecto de portafolio no encontrado');
    db.portfolio[index] = { ...db.portfolio[index], ...itemData };
    await writeDb(db);
    return db.portfolio[index];
  },

  deletePortfolioItem: async (userId, id) => {
    const db = await readDb();
    db.portfolio = db.portfolio.filter(item => !(item.userId === userId && item.id === id));
    await writeDb(db);
    return true;
  },

  getProposals: async (userId) => {
    const db = await readDb();
    return db.proposals.filter(prop => prop.userId === userId);
  },

  getProposal: async (userId, id) => {
    const db = await readDb();
    return db.proposals.find(prop => prop.userId === userId && prop.id === id);
  },

  addProposal: async (userId, proposal) => {
    const db = await readDb();
    const newProp = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      title: proposal.title || 'Proyecto sin título',
      company: proposal.company || 'Cliente sin especificar',
      url: proposal.url || '',
      description: proposal.description || '',
      status: proposal.status || 'Saved', 
      contactEmail: proposal.contactEmail || '',
      budget: proposal.budget || '',
      estimatedHours: proposal.estimatedHours || '', 
      portfolioAttachments: proposal.portfolioAttachments || [], 
      publicProfileLinks: proposal.publicProfileLinks || [], 
      platform: proposal.platform || 'General', 
      clientRedFlags: proposal.clientRedFlags || [], 
      dateAdded: new Date().toISOString(),
      dateApplied: proposal.status === 'Applied' ? new Date().toISOString() : null,
      followUpsCount: proposal.followUpsCount || 0,
      customPitch: proposal.customPitch || '', 
      suggestedProjects: proposal.suggestedProjects || [], 
      compatibilityScore: proposal.compatibilityScore || null,
      compatibilityRationale: proposal.compatibilityRationale || '',
      interviewPrep: proposal.interviewPrep || null
    };
    db.proposals.push(newProp);
    await writeDb(db);
    return newProp;
  },

  updateProposal: async (userId, id, propData) => {
    const db = await readDb();
    const index = db.proposals.findIndex(prop => prop.userId === userId && prop.id === id);
    if (index === -1) throw new Error('Propuesta no encontrada');
    const oldProp = db.proposals[index];
    let dateApplied = oldProp.dateApplied;
    if (propData.status === 'Applied' && oldProp.status !== 'Applied') {
      dateApplied = new Date().toISOString();
    }
    db.proposals[index] = { 
      ...oldProp, 
      ...propData,
      dateApplied
    };
    await writeDb(db);
    return db.proposals[index];
  },

  deleteProposal: async (userId, id) => {
    const db = await readDb();
    db.proposals = db.proposals.filter(prop => !(prop.userId === userId && prop.id === id));
    db.meetings = db.meetings.filter(item => !(item.userId === userId && item.proposalId === id));
    await writeDb(db);
    return true;
  },

  getMeetings: async (userId) => {
    const db = await readDb();
    return db.meetings.filter(item => item.userId === userId);
  },

  addMeeting: async (userId, meeting) => {
    const db = await readDb();
    const newMeeting = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      proposalId: meeting.proposalId || '',
      title: meeting.title || 'Reunión de proyecto',
      date: meeting.date || new Date().toISOString().split('T')[0],
      time: meeting.time || '10:00',
      location: meeting.location || '',
      notes: meeting.notes || ''
    };
    db.meetings.push(newMeeting);
    await writeDb(db);
    if (newMeeting.proposalId) {
      const propIndex = db.proposals.findIndex(p => p.userId === userId && p.id === newMeeting.proposalId);
      if (propIndex !== -1 && db.proposals[propIndex].status !== 'Interviewing') {
        db.proposals[propIndex].status = 'Interviewing';
        await writeDb(db);
      }
    }
    return newMeeting;
  },

  deleteMeeting: async (userId, id) => {
    const db = await readDb();
    db.meetings = db.meetings.filter(item => !(item.userId === userId && item.id === id));
    await writeDb(db);
    return true;
  }
};
