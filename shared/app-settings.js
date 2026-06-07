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
    provider: 'konstancia',
    credentials: '',
    scope: 'GIGACHAT_API_PERS',
    model: 'Konstancia',
    ignoreTls: true,
    keepChatHistory: true,
    clearInputAfterSend: true,
    useTaskContext: true,
    designMemoryMode: 'hybrid',
    figmaCriticEnabled: true,
    mobbinApiKey: '',
    figmaNanobananaImages: false,
    mobbinEnabled: true,
    siteBuilderEnabled: false,
    cursorApiKey: '',
    cursorModel: 'composer-2.5',
    cursorFigmaBuildEnabled: false,
    webSearchEnabled: true,
    knowledgeLearningEnabled: true,
    knowledgeAutoIngest: false,
    konstanciaCloudUrl: '',
    konstanciaCloudApiKey: '',
    desktopAgentEnabled: true,
  },
  vtubeStudio: {
    enabled: false,
    live2dModelPath: '',
    live2dCostume: 'costume_v0052.exp3.json',
    showDock: true,
    emotions: {
      neutral: '',
      joy: '',
      anger: '',
      thoughtful: '',
      epiphany: '',
    },
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
  taskLearning: {
    enabled: true,
    scope: 'all_visible',
    maxIssuesPerSync: 100,
    distillOnClose: true,
    indexComments: true,
    indexAttachments: true,
    catalogOnlyOnSync: true,
    maxChunks: 80000,
    cloudSync: false,
    hfMl: {
      enabled: true,
      intentThreshold: 0.45,
    },
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

function normalizeLive2dSettings(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled === true,
    live2dModelPath: String(src.live2dModelPath || '').trim(),
    live2dCostume: String(src.live2dCostume || 'costume_v0052.exp3.json').trim() || 'costume_v0052.exp3.json',
    showDock: src.showDock !== false,
    emotions: {
      neutral: String(src.emotions?.neutral || '').trim(),
      joy: String(src.emotions?.joy || '').trim(),
      anger: String(src.emotions?.anger || '').trim(),
      thoughtful: String(src.emotions?.thoughtful || '').trim(),
      epiphany: String(src.emotions?.epiphany || '').trim(),
    },
  };
}

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

  settings.vtubeStudio = normalizeLive2dSettings(settings.vtubeStudio);

  return {
    ...config,
    port: settings.connection.pluginPort,
    figmaCdpPort: settings.connection.cdpPort,
    theme: config.theme || 'mobbin',
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
