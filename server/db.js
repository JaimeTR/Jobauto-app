import { jsonAdapter, initDb as jsonInit } from './db/jsonAdapter.js';
import { mongoAdapter, initDb as mongoInit } from './db/mongoAdapter.js';

const dbType = process.env.DATABASE_TYPE || 'json';
const adapter = dbType === 'mongodb' ? mongoAdapter : jsonAdapter;

export async function initDb() {
  if (dbType === 'mongodb') {
    await mongoInit();
  } else {
    await jsonInit();
  }
}

// Exportamos la interfaz unificada de base de datos
export const createUser = adapter.createUser;
export const findUserByEmail = adapter.findUserByEmail;
export const getAllUsers = adapter.getAllUsers;
export const createPendingUser = adapter.createPendingUser;
export const getPendingUser = adapter.getPendingUser;
export const deletePendingUser = adapter.deletePendingUser;
export const updatePendingUser = adapter.updatePendingUser;
export const updateUser = adapter.updateUser;

export const getSettings = adapter.getSettings;
export const updateSettings = adapter.updateSettings;

export const getAlerts = adapter.getAlerts;
export const addAlert = adapter.addAlert;
export const markAlertsAsRead = adapter.markAlertsAsRead;
export const deleteAlert = adapter.deleteAlert;

export const getJobProfile = adapter.getJobProfile;
export const updateJobProfile = adapter.updateJobProfile;
export const getApplications = adapter.getApplications;
export const getApplication = adapter.getApplication;
export const addApplication = adapter.addApplication;
export const updateApplication = adapter.updateApplication;
export const deleteApplication = adapter.deleteApplication;

export const getInterviews = adapter.getInterviews;
export const addInterview = adapter.addInterview;
export const deleteInterview = adapter.deleteInterview;

export const getFreelanceProfile = adapter.getFreelanceProfile;
export const updateFreelanceProfile = adapter.updateFreelanceProfile;
export const getPortfolio = adapter.getPortfolio;
export const addPortfolioItem = adapter.addPortfolioItem;
export const updatePortfolioItem = adapter.updatePortfolioItem;
export const deletePortfolioItem = adapter.deletePortfolioItem;

export const getProposals = adapter.getProposals;
export const getProposal = adapter.getProposal;
export const addProposal = adapter.addProposal;
export const updateProposal = adapter.updateProposal;
export const deleteProposal = adapter.deleteProposal;

export const getMeetings = adapter.getMeetings;
export const addMeeting = adapter.addMeeting;
export const deleteMeeting = adapter.deleteMeeting;
