import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { hashPassword } from '../utils/auth.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobauto';
let client = null;
let db = null;

// Connect to MongoDB
async function getDb() {
  if (db) return db;
  
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log('Conectado a MongoDB con éxito en:', uri.split('@').pop());
  }
  
  db = client.db(process.env.MONGODB_DB || 'jobauto');
  return db;
}

export async function initDb() {
  try {
    await getDb();
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
  }
}

// Helpers for mappings
function mapId(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: rest.id, ...rest };
}

export const mongoAdapter = {
  // --- AUTH METHODS ---
  findUserByEmail: async (email) => {
    const database = await getDb();
    const doc = await database.collection('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    return mapId(doc);
  },

  getAllUsers: async () => {
    const database = await getDb();
    const docs = await database.collection('users').find({}).toArray();
    return docs.map(mapId);
  },

  updateUser: async (email, updateData) => {
    const database = await getDb();
    await database.collection('users').updateOne(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      { $set: updateData }
    );
    const updated = await database.collection('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    return mapId(updated);
  },

  getPendingUser: async (email) => {
    const database = await getDb();
    const doc = await database.collection('pendingUsers').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    return doc;
  },

  updatePendingUser: async (email, updateData) => {
    const database = await getDb();
    await database.collection('pendingUsers').updateOne(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      { $set: updateData }
    );
    const doc = await database.collection('pendingUsers').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    return doc;
  },

  createPendingUser: async (email, password, code) => {
    const database = await getDb();
    
    // Check if user already exists
    const exists = await database.collection('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (exists) {
      throw new Error('El correo ya está registrado.');
    }

    // Clean old registrations
    await database.collection('pendingUsers').deleteMany({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    const { hash, salt } = hashPassword(password);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    const pending = { email, passwordHash: hash, salt, code, expiresAt };
    await database.collection('pendingUsers').insertOne(pending);
    return pending;
  },

  deletePendingUser: async (email) => {
    const database = await getDb();
    await database.collection('pendingUsers').deleteMany({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    return true;
  },

  createUser: async (email, passwordHash, salt) => {
    const database = await getDb();
    
    const exists = await database.collection('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (exists) {
      throw new Error('El correo ya está registrado.');
    }
    
    const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const newUser = { id: userId, email, passwordHash, salt };
    await database.collection('users').insertOne(newUser);

    // Seed defaults
    const defaultSettings = {
      userId,
      provider: 'groq', 
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

    const defaultProfiles = {
      userId,
      jobProfile: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', cvText: '', experienceSummary: '' },
      freelanceProfile: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', hourlyRate: '25', freelanceOverview: '' }
    };

    await database.collection('settings').insertOne(defaultSettings);
    await database.collection('profiles').insertOne(defaultProfiles);
    
    return { id: userId, email };
  },

  // --- MULTI-USER DATA METHODS ---
  getSettings: async (userId) => {
    const database = await getDb();
    const doc = await database.collection('settings').findOne({ userId });
    return doc || {};
  },

  updateSettings: async (userId, settingsData) => {
    const database = await getDb();
    const { _id, userId: uid, ...cleanData } = settingsData;
    await database.collection('settings').updateOne(
      { userId },
      { $set: cleanData },
      { upsert: true }
    );
    return await mongoAdapter.getSettings(userId);
  },

  getAlerts: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('alerts').find({ userId }).sort({ dateAdded: -1 }).toArray();
    return docs.map(mapId);
  },

  addAlert: async (userId, alert) => {
    const database = await getDb();
    if (alert.url) {
      const exists = await database.collection('alerts').findOne({ userId, url: alert.url });
      if (exists) return null;
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
    await database.collection('alerts').insertOne(newAlert);
    return newAlert;
  },

  markAlertsAsRead: async (userId) => {
    const database = await getDb();
    await database.collection('alerts').updateMany({ userId }, { $set: { read: true } });
    return await mongoAdapter.getAlerts(userId);
  },

  deleteAlert: async (userId, id) => {
    const database = await getDb();
    await database.collection('alerts').deleteOne({ userId, id });
    return true;
  },

  getJobProfile: async (userId) => {
    const database = await getDb();
    const doc = await database.collection('profiles').findOne({ userId });
    return doc?.jobProfile || {};
  },

  updateJobProfile: async (userId, profileData) => {
    const database = await getDb();
    await database.collection('profiles').updateOne(
      { userId },
      { $set: { jobProfile: profileData } },
      { upsert: true }
    );
    return await mongoAdapter.getJobProfile(userId);
  },

  getApplications: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('applications').find({ userId }).toArray();
    return docs.map(mapId);
  },

  getApplication: async (userId, id) => {
    const database = await getDb();
    const doc = await database.collection('applications').findOne({ userId, id });
    return mapId(doc);
  },

  addApplication: async (userId, app) => {
    const database = await getDb();
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
    await database.collection('applications').insertOne(newApp);
    return newApp;
  },

  updateApplication: async (userId, id, appData) => {
    const database = await getDb();
    const oldApp = await database.collection('applications').findOne({ userId, id });
    if (!oldApp) throw new Error('Postulación no encontrada');
    
    let dateApplied = oldApp.dateApplied;
    if (appData.status === 'Applied' && oldApp.status !== 'Applied') {
      dateApplied = new Date().toISOString();
    }
    
    const { _id, userId: uid, id: appId, ...cleanData } = appData;
    await database.collection('applications').updateOne(
      { userId, id },
      { $set: { ...cleanData, dateApplied } }
    );
    return await mongoAdapter.getApplication(userId, id);
  },

  deleteApplication: async (userId, id) => {
    const database = await getDb();
    await database.collection('applications').deleteOne({ userId, id });
    await database.collection('interviews').deleteMany({ userId, applicationId: id });
    return true;
  },

  getInterviews: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('interviews').find({ userId }).toArray();
    return docs.map(mapId);
  },

  addInterview: async (userId, interview) => {
    const database = await getDb();
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
    await database.collection('interviews').insertOne(newInterview);
    
    if (newInterview.applicationId) {
      await database.collection('applications').updateOne(
        { userId, id: newInterview.applicationId, status: { $ne: 'Interviewing' } },
        { $set: { status: 'Interviewing' } }
      );
    }
    return newInterview;
  },

  deleteInterview: async (userId, id) => {
    const database = await getDb();
    await database.collection('interviews').deleteOne({ userId, id });
    return true;
  },

  getFreelanceProfile: async (userId) => {
    const database = await getDb();
    const doc = await database.collection('profiles').findOne({ userId });
    return doc?.freelanceProfile || {};
  },

  updateFreelanceProfile: async (userId, profileData) => {
    const database = await getDb();
    await database.collection('profiles').updateOne(
      { userId },
      { $set: { freelanceProfile: profileData } }
    );
    return await mongoAdapter.getFreelanceProfile(userId);
  },

  getPortfolio: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('portfolio').find({ userId }).toArray();
    return docs.map(mapId);
  },

  addPortfolioItem: async (userId, item) => {
    const database = await getDb();
    const newItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      userId,
      title: item.title || 'Proyecto sin título',
      description: item.description || '',
      technologies: item.technologies || '',
      link: item.link || ''
    };
    await database.collection('portfolio').insertOne(newItem);
    return newItem;
  },

  updatePortfolioItem: async (userId, id, itemData) => {
    const database = await getDb();
    const { _id, userId: uid, id: itemId, ...cleanData } = itemData;
    await database.collection('portfolio').updateOne(
      { userId, id },
      { $set: cleanData }
    );
    const updated = await database.collection('portfolio').findOne({ userId, id });
    return mapId(updated);
  },

  deletePortfolioItem: async (userId, id) => {
    const database = await getDb();
    await database.collection('portfolio').deleteOne({ userId, id });
    return true;
  },

  getProposals: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('proposals').find({ userId }).toArray();
    return docs.map(mapId);
  },

  getProposal: async (userId, id) => {
    const database = await getDb();
    const doc = await database.collection('proposals').findOne({ userId, id });
    return mapId(doc);
  },

  addProposal: async (userId, proposal) => {
    const database = await getDb();
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
    await database.collection('proposals').insertOne(newProp);
    return newProp;
  },

  updateProposal: async (userId, id, propData) => {
    const database = await getDb();
    const oldProp = await database.collection('proposals').findOne({ userId, id });
    if (!oldProp) throw new Error('Propuesta no encontrada');

    let dateApplied = oldProp.dateApplied;
    if (propData.status === 'Applied' && oldProp.status !== 'Applied') {
      dateApplied = new Date().toISOString();
    }

    const { _id, userId: uid, id: propId, ...cleanData } = propData;
    await database.collection('proposals').updateOne(
      { userId, id },
      { $set: { ...cleanData, dateApplied } }
    );
    return await mongoAdapter.getProposal(userId, id);
  },

  deleteProposal: async (userId, id) => {
    const database = await getDb();
    await database.collection('proposals').deleteOne({ userId, id });
    await database.collection('meetings').deleteMany({ userId, proposalId: id });
    return true;
  },

  getMeetings: async (userId) => {
    const database = await getDb();
    const docs = await database.collection('meetings').find({ userId }).toArray();
    return docs.map(mapId);
  },

  addMeeting: async (userId, meeting) => {
    const database = await getDb();
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
    await database.collection('meetings').insertOne(newMeeting);
    
    if (newMeeting.proposalId) {
      await database.collection('proposals').updateOne(
        { userId, id: newMeeting.proposalId, status: { $ne: 'Interviewing' } },
        { $set: { status: 'Interviewing' } }
      );
    }
    return newMeeting;
  },

  deleteMeeting: async (userId, id) => {
    const database = await getDb();
    await database.collection('meetings').deleteOne({ userId, id });
    return true;
  }
};
