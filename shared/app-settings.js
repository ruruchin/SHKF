import { normalizeCustomThemes } from './custom-themes.js';

export const DEFAULT_APP_SETTINGS = {
  appearance: {
    fontSize: 'medium',
    compactLayout: false,
    showPlayerBar: true,
    animationsEnabled: true,
    customThemes: [],
  },
  hotkeys: {
    serverEnabled: true,
    notifyOnAction: true,
    logToFooter: true,
  },
  connection: {
    pluginPort: 3847,
    cdpPort: 9222,
  },
  figma: {
    autoConnectOnStart: false,
    makeAutoSubmit: true,
    makeAutoFocus: true,
    preferDesktopApp: true,
  },
  make: {
    showSuggestions: true,
    clearInputAfterSend: true,
    keepChatHistory: true,
    speechLanguage: 'ru-RU',
  },
  agent: {
    provider: 'gigachat',
    credentials: '',
    scope: 'GIGACHAT_API_PERS',
    model: 'GigaChat-2-Pro',
    ignoreTls: true,
    keepChatHistory: true,
    clearInputAfterSend: true,
    useTaskContext: true,
    designMemoryMode: 'hybrid',
    figmaCriticEnabled: true,
    mobbinApiKey: '',
    mobbinEnabled: true,
    siteBuilderEnabled: false,
  },
  nanobanana: {
    apiKey: '',
    baseUrl: 'https://www.nananobanana.com',
    defaultModel: 'nanobanan-2',
    defaultAspectRatio: 'auto',
    defaultResolution: '1K',
    requestMode: 'sync',
    numOutputs: 1,
  },
  templates: {
    showCopyToast: true,
    showImportBanner: true,
  },
  metask: {
    baseUrl: '',
    boardPath: '/kanban/board',
    username: '',
    password: '',
    apiKey: '',
    notifyOnUpdate: true,
    pollIntervalMinutes: 5,
  },
  zimbra: {
    baseUrl: '',
    username: '',
    password: '',
  },
  window: {
    closeToTray: true,
    startMinimized: false,
    startServerOnLaunch: true,
    showSplash: true,
    splashDurationMs: 2400,
    width: 1180,
    height: 720,
  },
  search: {
    maxResults: 12,
  },
  advanced: {
    verboseLogs: false,
  },
  user: {
    role: null,
    roleSelectedAt: null,
  },
};

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function normalizeConfig(config) {
  const settings = deepMerge(DEFAULT_APP_SETTINGS, config.settings || {});

  if (config.port != null) settings.connection.pluginPort = Number(config.port);
  if (config.figmaCdpPort != null) settings.connection.cdpPort = Number(config.figmaCdpPort);

  settings.appearance.customThemes = normalizeCustomThemes(settings.appearance.customThemes);

  if (settings.user && settings.user.role != null && settings.user.role !== '') {
    settings.user.role = String(settings.user.role).trim() || null;
  }

  return {
    ...config,
    port: settings.connection.pluginPort,
    figmaCdpPort: settings.connection.cdpPort,
    theme: config.theme || 'dark',
    settings,
  };
}

export function patchSettings(config, updates) {
  const next = normalizeConfig({
    ...config,
    settings: deepMerge(config.settings || DEFAULT_APP_SETTINGS, updates),
  });
  next.port = next.settings.connection.pluginPort;
  next.figmaCdpPort = next.settings.connection.cdpPort;
  return next;
}

export const SPEECH_LANGUAGES = [
  { value: 'ru-RU', label: 'Русский' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'uk-UA', label: 'Українська' },
  { value: 'de-DE', label: 'Deutsch' },
];
