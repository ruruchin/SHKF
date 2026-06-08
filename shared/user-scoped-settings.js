import { DEFAULT_APP_SETTINGS } from './app-settings.js';

export const USER_INTEGRATION_SECTIONS = ['metask', 'zimbra'];

export function emptyUserIntegrations() {
  return {
    metask: { ...DEFAULT_APP_SETTINGS.metask },
    zimbra: { ...DEFAULT_APP_SETTINGS.zimbra },
  };
}

export function extractUserIntegrations(settings = {}) {
  const src = settings && typeof settings === 'object' ? settings : {};
  const defaults = emptyUserIntegrations();
  return {
    metask: { ...defaults.metask, ...(src.metask || {}) },
    zimbra: { ...defaults.zimbra, ...(src.zimbra || {}) },
  };
}

export function mergeUserIntegrationsIntoSettings(settings = {}, integrations = {}) {
  const next = settings && typeof settings === 'object' ? { ...settings } : {};
  const extracted = extractUserIntegrations(integrations);
  next.metask = extracted.metask;
  next.zimbra = extracted.zimbra;
  return next;
}

export function buildUserIntegrationPatch(settings = {}) {
  const extracted = extractUserIntegrations(settings);
  return {
    metask: extracted.metask,
    zimbra: extracted.zimbra,
  };
}

export function sessionPartitionPrefix(serviceName, userId = '') {
  const uid = String(userId || '').trim();
  return uid ? `persist:${serviceName}-${uid}` : `persist:${serviceName}-guest`;
}
