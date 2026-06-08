import 'dotenv/config';
import { app, BrowserWindow, BrowserView, ipcMain, Tray, Menu, nativeImage, shell, dialog, session, Notification, clipboard, protocol, net } from 'electron';
import electronUpdater from 'electron-updater';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import https from 'node:https';
import { HotkeyService } from '../server/hotkey-service.js';
import { AuthService } from '../server/auth-service.js';
import { CloudSettingsService } from '../server/cloud-settings-service.js';
import { MetaskService } from '../server/metask-service.js';
import { ZimbraService } from '../server/zimbra-service.js';
import { AgentService } from '../server/agent-service.js';
import { AgentChatShareService } from '../server/agent-chat-share-service.js';
import { TeamChatService } from '../server/team-chat-service.js';
import { TaskLinkerService } from '../server/task-linker-service.js';
import { pairKey } from '../shared/task-linker.js';
import {
  getLaborDisplayEntries,
  filterLaborEntriesByQuery,
  isLaborCostQuery,
} from '../shared/labor-costs.js';
import { buildMorningBrief } from '../shared/morning-brief.js';
import { buildSystemPromptForRole, buildLearnedExperienceBlock, buildRedmineKnowledgeBlock } from '../shared/agent-prompts.js';
import { resolveReferencedIssuesForLearning, searchKanbanTasksForKnowledge, formatRedmineSearchReply } from '../shared/task-knowledge-prompts.js';
import { assertMetaskUserGesture } from '../shared/metask-write-guard.js';
import { runRedmineFileSearch } from '../server/redmine-file-search.js';
import {
  fromLive2dProtocolUrl,
  readLive2dMeta,
  resolveEffectiveLive2dEntryPath,
  resolveModelEntryPath,
  toLive2dProtocolUrl,
} from '../server/live2d-model-service.js';
import { stopAllLive2dStaticServers } from '../server/live2d-static-server.js';
import { isRedmineFileSearch, wantsLearnedExperience, wantsProcessInsights, wantsRedmineKnowledge, wantsFileSearch, wantsReindexTasks, isLearnedExperienceQuery } from '../shared/task-learning-intent.js';
import {
  buildTaskOptionalPrompt,
  requiresTaskSelection,
} from '../shared/task-optional-prompt.js';
import { isGeneralKnowledgeQuery, isCasualChatQuery, wantsWebSearch } from '../shared/general-knowledge-intent.js';
import { searchWeb, formatWebSearchBlock } from '../server/web-search-service.js';
import { KnowledgeIngestService, formatKnowledgeRagBlock } from '../server/knowledge-ingest-service.js';
import { getTopMlIntent, mlOverridesTaskRequirement, mlWantsFileSearch, mlWantsReindex, mlWantsLearnedExperience } from '../shared/konstancia-intent-ml.js';
import { classifyIntent as classifyMlIntent, getMlStatus } from '../server/hf-ml-service.js';
import {
  getKonstanciaLlmStatus,
  configureKonstanciaCloud,
  configureKonstanciaYandex,
  isKonstanciaLlmTrained,
} from '../server/konstancia-llm-service.js';
import {
  isDinDonMusicIntent,
  isPlayMusicIntent,
  isVaguePlayMusicRequest,
  parseMusicPlayQuery,
  parseMusicExecuteFollowup,
  shouldExecuteMusicPlay,
  getPlayMusicReply,
} from '../shared/agent-music-triggers.js';
import { buildDesktopSuggestion } from '../shared/desktop-agent-suggest.js';
import { getCasualChatReply } from '../shared/casual-chat-replies.js';
import { playYandexMusicTrack } from '../server/yandex-music-desktop.js';
import {
  isDesktopControlQuery,
  parseDesktopCommand,
  extractDesktopToolFromResponse,
  stripDesktopToolFromResponse,
} from '../shared/desktop-agent-intent.js';
import { executeDesktopAction } from '../server/desktop-agent-service.js';
import { createMetaskReadOnly } from '../server/metask-readonly.js';
import { TaskKnowledgeService } from '../server/task-knowledge-service.js';
import { ProcessAnalyticsService } from '../server/process-analytics-service.js';
import { PillNotifyService } from '../server/pill-notify-service.js';
import { sendMakePrompt } from '../server/figma-make.js';
import {
  recognizeSpeechOnce,
  cancelSpeechRecognition,
  isSpeechRecognitionSupported,
  listInstalledSpeechLanguages,
} from '../server/speech-input.js';
import { ACTIONS, checkConflict, formatKeys, generateId, ACTION_META } from '../shared/keys.js';
import { patchSettings } from '../shared/app-settings.js';
import {
  buildUserIntegrationPatch,
  emptyUserIntegrations,
  extractUserIntegrations,
} from '../shared/user-scoped-settings.js';
import {
  getConfigPath,
  getPluginPath,
  getBundledLive2dModelPath,
  getUserLibraryPaths,
  getCustomThemeAssetsDir,
  getNotesLibraryPath,
  getNanobananaGalleryPath,
} from './paths.js';
import { NanobananaService, resolveModelForResolution } from '../server/nanobanana-service.js';
import {
  fetchNanobananaImageBytes,
  ensureFileExtension,
  resolveNanobananaImageUrl,
} from '../shared/nanobanana-download.js';
import { fetchNanobananaImageWithNet } from '../server/nanobanana-net.js';
import { createNanobananaGalleryStore } from '../server/nanobanana-gallery.js';
import {
  BANNER_NANOBANANA_BUILDER_PROMPT,
  buildBannerBuilderUserMessage,
  extractNanobananaPrompt,
} from '../shared/banner-nanobanana.js';
import {
  FIGMA_MAKE_BUILDER_PROMPT,
  FIGMA_MAKE_ENHANCE_PROMPT,
  FIGMA_MAKE_ENHANCEMENTS,
  buildMakeBuilderUserMessage,
  buildMakeEnhanceUserMessage,
  extractMakePrompt,
} from '../shared/figma-make-agent.js';
import { DesignMemoryService } from '../server/design-memory-service.js';
import { PikFolderService } from '../server/pik-folder-service.js';
import { MobbinService } from '../server/mobbin-service.js';
import { SiteBuilderService } from '../server/site-builder-service.js';
import { isSiteBuildIntent } from '../shared/site-builder-prompts.js';
import { MagnificMcpService } from '../server/magnific-mcp-service.js';
import {
  FIGMA_DESIGN_CRITIC_PROMPT,
  FIGMA_DESIGN_SYSTEM_PROMPT,
  buildDeterministicLandingPlan,
  extractFigmaCritic,
  extractFigmaPlan,
  buildFigmaContextBlock,
} from '../server/figma-design-agent.js';
import {
  buildDeterministicAppPlan,
  shouldBuildFigmaAppPlan,
} from '../server/figma-app-plan.js';
import { buildFigmaPlanFromMobbinScreen } from '../server/figma-from-mobbin.js';
import { MobbinStyleService } from '../server/mobbin-style-service.js';
import { formatMobbinStyleBlock } from '../shared/mobbin-style-proposals.js';
import { inferMobbinPlatform } from '../server/mobbin-service.js';
import { mobbinPlatformLabel, mobbinSearchQuerySuffix } from '../shared/mobbin-search-query.js';
import { extractMobbinSearchQuery } from '../shared/mobbin-search-query.js';
import { enrichScreensWithPreviews, resolveMobbinPreviewUrl } from '../server/mobbin-preview.js';
import { enrichFigmaPlanWithNanobananaImages } from '../server/figma-plan-images.js';
import { shouldExpandAppScreens } from '../shared/figma-user-requirements.js';
import { isGigaChatVisionModel, GIGACHAT_VISION_HINT } from '../shared/gigachat-vision.js';
import { buildFigmaDesignBrief } from '../shared/figma-design-brief.js';
import {
  checkFigmaMcpReady,
  isCursorFigmaBuildConfigured,
  runCursorFigmaBuild,
} from '../server/cursor-figma-build-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = getConfigPath(__dirname);
const pluginPath = getPluginPath(__dirname);
const userLibraryPaths = getUserLibraryPaths(__dirname);
const customThemeAssetsDir = getCustomThemeAssetsDir(__dirname);
const notesLibraryPath = getNotesLibraryPath(__dirname);
const nanobananaGalleryPath = getNanobananaGalleryPath(__dirname);
const designReferencesSeedPath = path.join(__dirname, '../config/design-references.seed.json');
const pikFolderSeedPath = path.join(__dirname, '../config/pik-folder.seed.json');
const pikFolderMobbinCatalogPath = path.join(__dirname, '../config/pik-folder.mobbin-catalog.json');

const shkfUserData = path.join(app.getPath('appData'), 'SHKF');
const legacyFiruruUserData = path.join(app.getPath('appData'), 'FIRURU');
if (!existsSync(shkfUserData) && existsSync(legacyFiruruUserData)) {
  try {
    cpSync(legacyFiruruUserData, shkfUserData, { recursive: true });
  } catch { /* first launch on new path */ }
}
app.setPath('userData', shkfUserData);
if (process.platform === 'win32') {
  app.setAppUserModelId('com.shkf.app');
}
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('enable-speech-input');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kostin-live2d',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let pillNotifyService = null;
let splashWindow = null;
let keyboardWindow = null;
let keyboardSplashWindow = null;

const SPLASH_WIDTH = 400;
const SPLASH_HEIGHT = 380;
const KEYBOARD_WIDTH = 1280;
const KEYBOARD_HEIGHT = 680;
let tray = null;
const service = new HotkeyService(configPath, userLibraryPaths, customThemeAssetsDir, notesLibraryPath);
const authService = new AuthService(app.getPath('userData'));
const cloudSettingsService = new CloudSettingsService(authService);
const metaskService = new MetaskService();
const zimbraService = new ZimbraService();
const agentService = new AgentService();
const teamChatService = new TeamChatService(authService);
const agentChatShareService = new AgentChatShareService(authService, teamChatService);
agentChatShareService.onSharePingComplete = (detail) => {
  broadcast('teamchat-konstancia-share-sent', detail || {});
};
agentChatShareService.onSharePingFailed = (detail) => {
  broadcast('teamchat-konstancia-share-ping-failed', detail || {});
};
const taskLinkerService = new TaskLinkerService(agentService);
const nanobananaService = new NanobananaService();
const nanobananaGallery = createNanobananaGalleryStore(nanobananaGalleryPath);
const designMemoryService = new DesignMemoryService(designReferencesSeedPath, {
  authService,
  agentService,
});
const mobbinService = new MobbinService();
const pikFolderService = new PikFolderService(pikFolderSeedPath, {
  authService,
  mobbinService,
  mobbinCatalogPath: pikFolderMobbinCatalogPath,
  designRefsPath: designReferencesSeedPath,
  getMobbinSettings: () => service.config.settings?.agent || {},
});

const PIK_FETCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function pikImageFetchHeaders(url) {
  const raw = String(url || '').trim();
  if (/mobbin\.com|bytescale/i.test(raw)) {
    return {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://mobbin.com/',
      Origin: 'https://mobbin.com',
      'User-Agent': PIK_FETCH_UA,
    };
  }
  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': PIK_FETCH_UA,
  };
  if (/logo\.clearbit\.com/i.test(raw)) headers.Referer = 'https://clearbit.com/';
  if (/google\.com\/s2\/favicons/i.test(raw)) headers.Referer = 'https://www.google.com/';
  if (!/^https?:\/\//i.test(raw) || !/mobbin\.com|bytescale/i.test(raw)) {
    try {
      const host = new URL(raw).hostname;
      if (host && host !== 'www.google.com' && !host.endsWith('duckduckgo.com')) {
        headers.Referer = `https://${host}/`;
      }
    } catch { /* ignore */ }
  }
  return headers;
}

async function fetchPikCdnImageViaHttps(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const headers = pikImageFetchHeaders(raw);
  return new Promise((resolve) => {
    try {
      const parsed = new URL(raw);
      const req = https.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers,
      }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          fetchPikCdnImage(res.headers.location).then(resolve);
          return;
        }
        if (status !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (!buf.length) {
            resolve(null);
            return;
          }
          const mime = String(res.headers['content-type'] || 'image/webp').split(';')[0];
          resolve({ buf, mime, dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
        });
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

async function fetchPikCdnImage(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const res = await fetch(raw, {
      headers: pikImageFetchHeaders(raw),
      redirect: 'follow',
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length) {
        const mime = String(res.headers.get('content-type') || 'image/webp').split(';')[0];
        return { buf, mime, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
      }
    }
  } catch { /* fallback below */ }
  return fetchPikCdnImageViaHttps(raw);
}

function registerPikFolderIpcHandlers() {
  ipcMain.handle('pik-folder-list', async (_e, payload) => pikFolderService.list(payload || {}));
  ipcMain.handle('pik-folder-app-screens', (_e, payload) => pikFolderService.getAppScreens(payload || {}));
  ipcMain.handle('pik-folder-ready', () => ({ ready: pikFolderService.isReady(), total: pikFolderService.getCatalogItems().length }));
  ipcMain.handle('pik-folder-reload-seed', () => {
    pikFolderService.reload();
    return { ok: true, count: pikFolderService.getCatalogItems().length };
  });
  ipcMain.handle('pik-folder-sync-seed', async () => pikFolderService.syncSeedToDatabase((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pik-folder-sync-progress', progress);
    }
  }));
  ipcMain.handle('pik-folder-remote-status', () => pikFolderService.remoteStatus());
  ipcMain.handle('pik-folder-fetch-image', async (_e, { url } = {}) => {
    const payload = await fetchPikCdnImage(url);
    return payload?.dataUrl || null;
  });
  ipcMain.handle('pik-folder-copy-text', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  });
  ipcMain.handle('clipboard-write-text', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  });
  ipcMain.handle('pik-folder-copy-image', async (_e, { url } = {}) => {
    const raw = String(url || '').trim();
    if (!raw) throw new Error('Нет URL изображения');
    const payload = await fetchPikCdnImage(raw);
    if (!payload?.buf) throw new Error('Не удалось загрузить изображение');
    const img = nativeImage.createFromBuffer(payload.buf);
    if (img.isEmpty()) throw new Error('Формат не поддерживается для копирования');
    clipboard.writeImage(img);
    return { ok: true };
  });
  ipcMain.handle('pik-folder-save-image', async (_e, { url, filename } = {}) => {
    const raw = String(url || '').trim();
    if (!raw) throw new Error('Нет URL изображения');
    const payload = await fetchPikCdnImage(raw);
    if (!payload?.buf) throw new Error('Не удалось загрузить изображение');
    const ext = /\.jpe?g/i.test(raw) ? 'jpg' : /\.webp/i.test(raw) ? 'webp' : /\.gif/i.test(raw) ? 'gif' : 'png';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить референс',
      defaultPath: String(filename || `pik-reference.${ext}`).replace(/[^\w.\-]+/g, '-'),
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    writeFileSync(filePath, payload.buf);
    return { ok: true, path: filePath };
  });
  ipcMain.handle('pik-folder-sync-mobbin', async () => {
    configureAgentIntegrations();
    return pikFolderService.syncMobbinCatalog((msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pik-folder-sync-progress', { message: msg });
      }
    });
  });
  ipcMain.handle('pik-folder-mobbin-status', () => {
    pikFolderService.reloadMobbinCatalog();
    const total = pikFolderService.getCatalogItems().length;
    return {
      total,
      builtAt: pikFolderService.mobbinCatalog.builtAt,
      mobbinConfigured: mobbinService.isConfigured(),
    };
  });
}
registerPikFolderIpcHandlers();
const mobbinStyleService = new MobbinStyleService(agentService);
const siteBuilderService = new SiteBuilderService({
  mobbinService,
  designMemoryService,
  agentService,
});
const magnificMcpService = new MagnificMcpService(service);
const metaskReadOnly = createMetaskReadOnly(metaskService);
const taskKnowledgeService = new TaskKnowledgeService(app.getPath('userData'), {
  metaskReadOnly,
  metaskService,
  agentService,
  authService,
});
const knowledgeIngestService = new KnowledgeIngestService(app.getPath('userData'), {
  agentService,
});
const processAnalyticsService = new ProcessAnalyticsService({
  taskKnowledge: taskKnowledgeService,
  taskLinker: taskLinkerService,
});

function configureTaskLearning() {
  taskKnowledgeService.configure(service.config.settings?.taskLearning || {});
}

function configureAgentIntegrations() {
  let agentSettings = service.config.settings?.agent || {};
  if (
    isKonstanciaLlmTrained()
    && agentSettings.provider !== 'konstancia'
    && !agentSettings.konstanciaCloudUrl
  ) {
    agentSettings = {
      ...agentSettings,
      provider: 'konstancia',
      model: 'Konstancia',
    };
    service.updateAppSettings({ agent: agentSettings });
  }
  configureKonstanciaYandex({
    apiKey: process.env.KONSTANCIA_YANDEX_API_KEY || '',
    folderId: process.env.KONSTANCIA_YANDEX_FOLDER_ID || '',
  });
  configureKonstanciaCloud({
    url: process.env.KONSTANCIA_CLOUD_URL || agentSettings.konstanciaCloudUrl || '',
    apiKey: process.env.KONSTANCIA_CLOUD_API_KEY || agentSettings.konstanciaCloudApiKey || '',
  });
  agentService.configure(agentSettings);
  mobbinService.configure(agentSettings);
  siteBuilderService.configure(agentSettings);
  knowledgeIngestService.configure({
    enabled: agentSettings.knowledgeLearningEnabled !== false,
    autoIngestOnStart: agentSettings.knowledgeAutoIngest === true,
  });
  configureTaskLearning();
}

let knowledgeAutoIngestStarted = false;
async function maybeAutoIngestKnowledge() {
  const agentSettings = service.config.settings?.agent || {};
  if (agentSettings.knowledgeAutoIngest !== true) return;
  if (knowledgeAutoIngestStarted) return;
  const stats = knowledgeIngestService.stats();
  if (stats.chunks > 0) return;
  knowledgeAutoIngestStarted = true;
  knowledgeIngestService.ingestAll().catch((err) => {
    console.warn('[knowledge-ingest]', err?.message || err);
  });
}

async function handleRedmineFileSearchIpc(_e, payload) {
  configureAgentIntegrations();
  metaskService.configure(service.config.settings?.metask || {});
  metaskReadOnly.configure(service.config.settings?.metask || {});
  await metaskService.resolveCurrentUser?.().catch(() => {});
  return runRedmineFileSearch({
    query: payload?.query || payload?.message || '',
    kanbanTasks: payload?.kanbanTasks || [],
    metaskService,
    taskKnowledgeService,
    userId: metaskService.userId,
  });
}

function registerRedmineFileSearchIpc() {
  ipcMain.handle('agent-redmine-file-search', handleRedmineFileSearchIpc);
}
registerRedmineFileSearchIpc();

function vtubeDialogParent() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return BrowserWindow.getFocusedWindow() || null;
}

const LIVE2D_MIME = {
  '.json': 'application/json;charset=utf-8',
  '.moc3': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.motion3.json': 'application/json;charset=utf-8',
  '.cdi3.json': 'application/json;charset=utf-8',
  '.physics3.json': 'application/json;charset=utf-8',
};

function live2dMimeType(filePath = '') {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.motion3.json')) return LIVE2D_MIME['.motion3.json'];
  if (lower.endsWith('.cdi3.json')) return LIVE2D_MIME['.cdi3.json'];
  if (lower.endsWith('.physics3.json')) return LIVE2D_MIME['.physics3.json'];
  const ext = path.extname(lower);
  return LIVE2D_MIME[ext] || 'application/octet-stream';
}

function registerLive2dProtocol() {
  protocol.handle('kostin-live2d', (request) => {
    const filePath = fromLive2dProtocolUrl(request.url);
    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const data = readFileSync(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': live2dMimeType(filePath),
          'Content-Length': String(data.byteLength),
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response('Read error', { status: 500 });
    }
  });
}

function registerLive2dIpcHandlers() {
  for (const channel of ['live2d-get-model', 'live2d-pick-model', 'live2d-fetch-asset']) {
    try { ipcMain.removeHandler(channel); } catch { /* first run */ }
  }

  ipcMain.handle('live2d-get-model', async () => {
    const cfg = service.config.settings?.vtubeStudio || {};
    const userPath = String(cfg.live2dModelPath || '').trim();
    const bundledPath = getBundledLive2dModelPath(__dirname);
    const entryPath = resolveEffectiveLive2dEntryPath(userPath, bundledPath);
    if (!entryPath) {
      return { ok: false, message: 'Не найдена Live2D-модель (встроенная или в настройках)' };
    }
    const meta = readLive2dMeta(entryPath);
    if (!meta.ok) return meta;
    const modelUrl = toLive2dProtocolUrl(meta.settingsPath);
    if (!modelUrl) {
      return { ok: false, message: 'Не удалось сформировать URL модели Live2D' };
    }
    const usesBundled = !userPath || !resolveModelEntryPath(userPath);
    return {
      ...meta,
      modelUrl,
      emotions: cfg.emotions || {},
      costume: String(cfg.live2dCostume || '').trim(),
      bundled: usesBundled,
    };
  });

  ipcMain.handle('live2d-fetch-asset', (_e, url) => {
    const filePath = fromLive2dProtocolUrl(url);
    if (!filePath || !existsSync(filePath)) {
      return { ok: false, message: `Файл не найден: ${filePath || url}` };
    }
    try {
      const data = readFileSync(filePath);
      const mimeType = live2dMimeType(filePath);
      const lower = filePath.toLowerCase();
      if (lower.endsWith('.json') || mimeType.includes('json')) {
        return { ok: true, mimeType, text: data.toString('utf-8') };
      }
      return { ok: true, mimeType, base64: data.toString('base64') };
    } catch (err) {
      return { ok: false, message: err?.message || 'Не удалось прочитать файл модели' };
    }
  });

  ipcMain.handle('live2d-pick-model', async (_e, payload) => {
    const pickDir = payload?.mode === 'directory';
    const { filePaths, canceled } = await dialog.showOpenDialog(vtubeDialogParent(), {
      title: pickDir ? 'Папка Live2D модели' : 'model3.json или .vtube.json',
      filters: pickDir
        ? undefined
        : [
          { name: 'Live2D model3 / vtube', extensions: ['model3.json', 'vtube.json', 'model.json'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      properties: pickDir ? ['openDirectory'] : ['openFile'],
    });
    if (canceled || !filePaths?.[0]) return { ok: false };
    const picked = filePaths[0];
    const entryPath = resolveModelEntryPath(picked);
    if (!entryPath) {
      return {
        ok: false,
        message: 'В этой папке нет model3.json. Выберите ulvm2_0001.model3.json, .vtube.json или папку модели.',
      };
    }
    const meta = readLive2dMeta(entryPath);
    if (!meta.ok) {
      return { ok: false, message: meta.message || 'Не найден model3.json в выбранном месте' };
    }
    const modelUrl = toLive2dProtocolUrl(meta.settingsPath);
    if (!modelUrl) {
      return { ok: false, message: 'Не удалось сформировать URL модели Live2D' };
    }
    const config = service.updateAppSettings({
      vtubeStudio: {
        ...service.config.settings?.vtubeStudio,
        live2dModelPath: entryPath,
      },
    });
    return {
      ok: true,
      entryPath,
      settingsPath: meta.settingsPath,
      modelUrl,
      modelName: meta.modelName,
      config,
    };
  });
}

registerLive2dIpcHandlers();

const { autoUpdater } = electronUpdater;
const APP_UPDATE_FEED_URL = 'https://github.com/ruruchin/SHKF/releases/latest/download';
const METASK_DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
let metaskBrowserView = null;
let metaskBoardLoaded = false;
let metaskBoardAttached = false;
let metaskLoginBusy = false;
let metaskPendingLogin = false;
let lastMetaskBounds = null;
let updaterPollTimer = null;
let updaterCheckInFlight = false;

function getMetaskBrowserView() {
  if (metaskBrowserView && !metaskBrowserView.webContents.isDestroyed()) {
    return metaskBrowserView;
  }

  metaskBrowserView = new BrowserView({
    webPreferences: {
      partition: metaskService.getSessionPartition(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const wc = metaskBrowserView.webContents;
  wc.setUserAgent(METASK_DESKTOP_UA);
  wc.setVisualZoomLevelLimits(1, 3);
  wc.on('did-finish-load', async () => {
    if (!wc.isDestroyed()) wc.setZoomFactor(1);
    const url = wc.getURL();
    if (url && url !== 'about:blank') {
      metaskService.configure(service.config.settings?.metask || {});
      if (url.includes('/login')) {
        await tryMetaskAutoLogin();
      } else {
        metaskBoardLoaded = true;
        await metaskService.persistSessionCookies();
        broadcast('metask-session-ready', { url });
        metaskPendingLogin = false;
      }
      resizeMetaskBoard().catch(() => {});
      broadcastMetaskIssueActive(url);
    }
  });

  wc.on('did-navigate-in-page', async (_event, url) => {
    if (url && !url.includes('/login') && url !== 'about:blank') {
      metaskBoardLoaded = true;
      metaskService.configure(service.config.settings?.metask || {});
      await metaskService.persistSessionCookies();
    }
    broadcastMetaskIssueActive(url);
  });

  wc.on('did-navigate', async (_event, url) => {
    broadcastMetaskIssueActive(url);
  });

  return metaskBrowserView;
}

async function tryMetaskAutoLogin() {
  const bv = metaskBrowserView;
  if (!bv || metaskLoginBusy) return;
  const wc = bv.webContents;
  if (wc.isDestroyed()) return;
  const url = wc.getURL();
  if (!url || url === 'about:blank' || !url.includes('/login')) return;

  metaskService.configure(service.config.settings?.metask || {});
  const script = metaskService.buildAutoLoginScript();
  if (!script) return;

  metaskLoginBusy = true;
  try {
    await wc.executeJavaScript(script);
  } catch {
    /* navigation in progress */
  } finally {
    setTimeout(() => { metaskLoginBusy = false; }, 2500);
  }
}

async function reloadMetaskBoard() {
  metaskService.configure(service.config.settings?.metask || {});
  const boardUrl = metaskService.getBoardUrl();
  if (!boardUrl) return { ok: false, reason: 'no-url' };
  const bv = getMetaskBrowserView();
  metaskPendingLogin = true;
  metaskBoardLoaded = false;
  await bv.webContents.loadURL(boardUrl);
  return { ok: true, url: boardUrl };
}

function parseIssueIdFromUrl(url) {
  const m = String(url || '').match(/\/issues\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function broadcastMetaskIssueActive(url) {
  const id = parseIssueIdFromUrl(url);
  broadcast('metask-issue-active', { id, url: url || '' });
}

function applyMetaskBoardBounds(bounds) {
  if (!mainWindow || mainWindow.isDestroyed() || !bounds?.width || !bounds?.height) return;
  const bv = getMetaskBrowserView();
  const [winW, winH] = mainWindow.getContentSize();
  const x = Math.max(0, Math.round(bounds.x));
  const y = Math.max(0, Math.round(bounds.y));
  const width = Math.max(1, Math.min(Math.round(bounds.width), winW - x));
  const height = Math.max(1, Math.min(Math.round(bounds.height), winH - y));
  const next = { x, y, width, height };

  if (
    metaskBoardAttached
    && mainWindow.getBrowserView() === bv
    && lastMetaskBounds
    && lastMetaskBounds.x === next.x
    && lastMetaskBounds.y === next.y
    && lastMetaskBounds.width === next.width
    && lastMetaskBounds.height === next.height
  ) {
    return;
  }

  lastMetaskBounds = next;
  if (mainWindow.getBrowserView() !== bv) {
    mainWindow.setBrowserView(bv);
    metaskBoardAttached = true;
  }
  bv.setBounds(next);
}

async function readMetaskHostBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    return await mainWindow.webContents.executeJavaScript(`(() => {
      const page = document.getElementById('page-metask');
      if (!page?.classList.contains('active')) return null;
      const host = document.getElementById('metask-board-host');
      const split = document.getElementById('metask-split');
      if (!host || !split) return null;
      const r = host.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return null;
      let x = Math.round(r.left);
      let y = Math.round(r.top);
      let width = Math.round(r.width);
      let height = Math.round(r.height);

      const clampTop = (el) => {
        if (!el) return;
        const tr = el.getBoundingClientRect();
        const bottom = Math.round(tr.bottom);
        if (y < bottom) {
          height = Math.max(1, height - (bottom - y));
          y = bottom;
        }
      };
      clampTop(document.querySelector('.metask-toolbar'));
      const auth = document.getElementById('metask-auth');
      if (auth && !auth.classList.contains('hidden')) clampTop(auth);

      if (!split.classList.contains('metask-split--list-collapsed')) {
        const listPanel = document.querySelector('.metask-list-panel');
        if (listPanel) {
          const lr = listPanel.getBoundingClientRect();
          const listRight = Math.round(lr.right);
          if (x < listRight) {
            width = Math.max(1, width - (listRight - x));
            x = listRight;
          }
        }
      }

      const seam = document.getElementById('metask-list-expand-seam');
      if (seam && split.classList.contains('metask-split--list-collapsed')) {
        const sr = seam.getBoundingClientRect();
        if (sr.width > 0 && x < Math.round(sr.right)) {
          const shift = Math.round(sr.right) - x;
          x += shift;
          width = Math.max(1, width - shift);
        }
      }

      if (width < 8 || height < 8) return null;
      return { x, y, width, height };
    })()`, true);
  } catch {
    return null;
  }
}

async function attachMetaskBoard() {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
  const pageActive = await mainWindow.webContents.executeJavaScript(
    "document.getElementById('page-metask')?.classList.contains('active') === true",
    true,
  ).catch(() => false);
  if (!pageActive) {
    detachMetaskBoard();
    return { ok: false };
  }

  const bounds = await readMetaskHostBounds();
  if (!bounds) {
    detachMetaskBoard();
    return { ok: false };
  }
  applyMetaskBoardBounds(bounds);

  const s = service.config.settings?.metask || {};
  metaskService.configure(s);
  const bv = metaskBrowserView;
  if (!bv) return { ok: true };
  const boardUrl = metaskService.getBoardUrl();
  if (!boardUrl) return { ok: true };
  const currentUrl = bv.webContents.getURL();
  const base = metaskService.settings.baseUrl;
  if (!currentUrl || currentUrl === 'about:blank') {
    bv.webContents.loadURL(boardUrl);
  } else if (base && !currentUrl.startsWith(base)) {
    bv.webContents.loadURL(boardUrl);
  }
  return { ok: true };
}

function detachMetaskBoard() {
  if (!mainWindow || mainWindow.isDestroyed() || !metaskBrowserView) return;
  if (mainWindow.getBrowserView() === metaskBrowserView) {
    mainWindow.removeBrowserView(metaskBrowserView);
  }
  metaskBoardAttached = false;
  lastMetaskBounds = null;
}

async function resizeMetaskBoard() {
  const bounds = await readMetaskHostBounds();
  if (bounds) {
    lastMetaskBounds = null;
    applyMetaskBoardBounds(bounds);
  } else {
    detachMetaskBoard();
  }
  return { ok: true };
}

let pendingMetaskUpdates = [];
let pendingMetaskCommentUpdates = [];
let metaskCommentBaselineReady = false;

function enqueueMetaskUpdates(updates) {
  if (!updates?.length) return;
  const seen = new Set(pendingMetaskUpdates.map((t) => `${t.id}:${normalizeUpdatedOn(t.updatedOn)}`));
  for (const task of updates) {
    const key = `${task.id}:${normalizeUpdatedOn(task.updatedOn)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pendingMetaskUpdates.push(task);
  }
}

function enqueueMetaskCommentUpdates(events) {
  if (!events?.length) return;
  const seen = new Set(pendingMetaskCommentUpdates.map((e) => String(e?.key || '')));
  for (const event of events) {
    const key = String(event?.key || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pendingMetaskCommentUpdates.push(event);
  }
}

function normalizeUpdatedOn(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString();
  } catch {
    return String(iso);
  }
}

function applyAuthProfileToConfig(profile) {
  if (!profile?.id) return service.config;
  const prev = service.config.settings?.user || {};
  const nextUser = {
    ...prev,
    role: profile.role || prev.role || null,
    roleSelectedAt: prev.role === profile.role ? prev.roleSelectedAt : new Date().toISOString(),
    id: profile.id,
    email: profile.email || '',
    username: profile.username || '',
    fullName: profile.full_name || '',
  };
  if (
    prev.id === nextUser.id
    && prev.role === nextUser.role
    && prev.email === nextUser.email
    && prev.username === nextUser.username
    && prev.fullName === nextUser.fullName
  ) {
    return service.config;
  }
  return service.updateAppSettings({ user: nextUser });
}

function applyUserIntegrationsToRuntime(integrations = emptyUserIntegrations()) {
  const next = extractUserIntegrations(integrations);
  const config = service.updateAppSettings({
    metask: next.metask,
    zimbra: next.zimbra,
  });
  metaskService.configure(config.settings?.metask || {});
  zimbraService.configure(config.settings?.zimbra || {});
  return config;
}

function resetRuntimeIntegrations() {
  metaskService.setSessionUser('');
  zimbraService.setSessionUser('');
  return applyUserIntegrationsToRuntime(emptyUserIntegrations());
}

async function pullUserIntegrationsIntoConfig() {
  if (!authService.session) return service.config;
  try {
    const data = await authService.fetchUserSettings();
    return applyUserIntegrationsToRuntime(data?.settings || {});
  } catch {
    return applyUserIntegrationsToRuntime(emptyUserIntegrations());
  }
}

async function pushUserIntegrationsFromConfig() {
  if (!authService.session) return { ok: false, skipped: true };
  try {
    const existing = await authService.fetchUserSettings();
    return authService.updateUserSettings({
      ...(existing?.settings || {}),
      ...buildUserIntegrationPatch(service.config.settings || {}),
    });
  } catch {
    return { ok: false };
  }
}

function destroyMetaskBrowserView() {
  if (!metaskBrowserView) return;
  try {
    detachMetaskBoard();
    if (!metaskBrowserView.webContents.isDestroyed()) {
      metaskBrowserView.webContents.destroy();
    }
  } catch {
    /* ignore */
  }
  metaskBrowserView = null;
  metaskBoardLoaded = false;
  metaskPendingLogin = false;
}

async function clearMetaskSession() {
  const ses = session.fromPartition(metaskService.getSessionPartition());
  await ses.clearStorageData();
  await ses.clearCache();
  metaskBoardLoaded = false;
  metaskPendingLogin = false;
}

async function clearZimbraSession() {
  const ses = session.fromPartition(zimbraService.getSessionPartition());
  await ses.clearStorageData();
  await ses.clearCache();
}

async function switchIntegrationSessionsForUser(userId = '') {
  destroyMetaskBrowserView();
  metaskService.setSessionUser(userId);
  zimbraService.setSessionUser(userId);
  metaskService.configure(service.config.settings?.metask || {});
  zimbraService.configure(service.config.settings?.zimbra || {});
  await clearMetaskSession();
  await clearZimbraSession();
}

async function activateAuthenticatedUserContext(profile) {
  if (!profile?.id) return service.config;
  applyAuthProfileToConfig(profile);
  await pullCloudSettingsIntoConfig();
  await pullUserIntegrationsIntoConfig();
  await switchIntegrationSessionsForUser(profile.id);
  broadcast('config', service.config);
  return service.config;
}

async function deactivateAuthenticatedUserContext() {
  await pushUserIntegrationsFromConfig();
  destroyMetaskBrowserView();
  await clearMetaskSession();
  await clearZimbraSession();
  resetRuntimeIntegrations();
  broadcast('config', service.config);
}

async function pullCloudSettingsIntoConfig() {
  if (!authService.session) return service.config;
  try {
    const cloudSettings = await cloudSettingsService.pull();
    if (!cloudSettings || !Object.keys(cloudSettings).length) return service.config;
    const merged = patchSettings(service.config, cloudSettings);
    service.saveConfig(merged);
  } catch {
    /* offline/cloud settings failures should not block local app */
  }
  return service.config;
}

async function pushCloudSettingsFromConfig() {
  try {
    await cloudSettingsService.push(service.config.settings || {});
  } catch {
    /* best effort sync */
  }
}

function initPillNotifyService() {
  if (pillNotifyService) return pillNotifyService;
  pillNotifyService = new PillNotifyService({
    getMainWindow: () => mainWindow,
    onInApp: (item) => broadcast('pill-notify-in-app', item),
    onAction: (action) => {
      const type = String(action?.type || '');
      if (type === 'metask-open-task') {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
        broadcast('metask-open-task', { id: action.id, url: action.url });
        return;
      }
      if (type === 'focus-agent') {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
        broadcast('pill-notify-focus-agent', {});
        return;
      }
      if (type === 'konstancia-open-share') {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
        broadcast('konstancia-open-share', { shareId: action.shareId });
      }
    },
  });
  pillNotifyService.bindIpc(ipcMain);
  return pillNotifyService;
}

function showPillNotification(payload = {}) {
  initPillNotifyService();
  return pillNotifyService.show(payload);
}

function showMetaskUpdateNotifications(updates) {
  const enabled = service.config.settings?.metask?.notifyOnUpdate !== false;
  if (!enabled || !updates?.length) return;

  for (const task of updates) {
    showPillNotification({
      title: task.subject || 'Задача обновлена',
      body: 'Изменения в Redmine — откройте задачу в канбане.',
      meta: `#${task.id}`,
      badge: 'Канбан',
      tag: 'Redmine',
      icon: 'kanban',
      action: { type: 'metask-open-task', id: task.id, url: task.url },
    });
  }
}

async function runMetaskSync({ notify = true } = {}) {
  const s = service.config.settings?.metask || {};
  metaskService.configure(s);
  const wc = metaskBrowserView?.webContents;
  const webContents = wc && !wc.isDestroyed() ? wc : null;
  const result = await metaskService.sync(s, webContents);
  if (!result?.ok) return result;
  if (result.fetchOk === false) return result;

  if (result.updates?.length) {
    enqueueMetaskUpdates(result.updates);
    if (notify) showMetaskUpdateNotifications(result.updates);
    broadcast('metask-task-updates', result.updates);
  }

  try {
    const commentTargets = result.tasks || [];
    if (commentTargets.length) {
      const commentUpdates = await metaskService.detectCommentUpdates(commentTargets);
      metaskCommentBaselineReady = true;
      if (commentUpdates?.length) {
        enqueueMetaskCommentUpdates(commentUpdates);
        broadcast('metask-comment-updates', commentUpdates);
      }
    }
  } catch {
    /* ignore comment notifications errors */
  }
  broadcast('metask-tasks-updated', result);

  try {
    configureTaskLearning();
    metaskReadOnly.configure(service.config.settings?.metask || {});
    taskKnowledgeService.enqueueFromSync({
      tasks: result.tasks || [],
      updates: result.updates || [],
      userId: metaskService.userId,
    });
  } catch {
    /* learning must not break sync */
  }

  return result;
}

let metaskPollTimer = null;

function scheduleMetaskPolling() {
  if (metaskPollTimer) clearInterval(metaskPollTimer);
  metaskPollTimer = null;

  const s = service.config.settings?.metask || {};
  const configured = !!(String(s.baseUrl || '').trim() && String(s.apiKey || '').trim());
  if (!configured) return;

  const mins = Math.max(2, Number(s.pollIntervalMinutes) || 5);
  const tick = () => runMetaskSync({ notify: true }).catch(() => {});
  tick();
  metaskPollTimer = setInterval(tick, mins * 60 * 1000);
}

function broadcast(channel, data) {
  for (const win of [mainWindow, keyboardWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function setupAutoUpdater() {
  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: APP_UPDATE_FEED_URL,
    });
  } catch {
    /* keep default feed on failure */
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => broadcast('updater-status', { state: 'checking' }));
  autoUpdater.on('update-available', (info) => broadcast('updater-status', { state: 'available', info }));
  autoUpdater.on('update-not-available', (info) => broadcast('updater-status', { state: 'not-available', info }));
  autoUpdater.on('download-progress', (progress) => broadcast('updater-status', { state: 'downloading', progress }));
  autoUpdater.on('update-downloaded', (info) => {
    broadcast('updater-status', {
      state: 'downloaded',
      info,
      message: 'Обновление скачано и будет установлено автоматически после закрытия приложения.',
    });
  });
  autoUpdater.on('error', (err) => {
    const raw = String(err?.message || err || '');
    const knownLatestNotFound = /unable to find latest version|releases\/latest|httperror:\s*404|httperror:\s*406/i.test(raw);
    const message = knownLatestNotFound
      ? 'Релиз обновления не опубликован. Нужен GitHub Release (не draft) для текущего тега версии.'
      : raw;
    broadcast('updater-status', { state: 'error', message });
  });
}

function checkForUpdates({ silent = false } = {}) {
  if (updaterCheckInFlight) return { state: 'busy' };
  if (!app.isPackaged) {
    const payload = { state: 'disabled', message: 'Обновления доступны только в установленной сборке.' };
    if (!silent) broadcast('updater-status', payload);
    return payload;
  }
  updaterCheckInFlight = true;
  autoUpdater.checkForUpdates().catch((err) => {
    broadcast('updater-status', { state: 'error', message: err?.message || String(err) });
  }).finally(() => {
    updaterCheckInFlight = false;
  });
  return { state: 'checking' };
}

function startUpdaterPolling() {
  if (updaterPollTimer) clearInterval(updaterPollTimer);
  updaterPollTimer = null;
  if (!app.isPackaged) return;
  updaterPollTimer = setInterval(() => {
    checkForUpdates({ silent: true });
  }, 2 * 60 * 1000);
}

service.on('status', (s) => broadcast('status', s));
service.on('log', (msg) => broadcast('log', msg));
service.on('action-fired', (a) => broadcast('action-fired', a));
service.on('config-changed', (c) => {
  broadcast('config', c);
  scheduleMetaskPolling();
  configureAgentIntegrations();
  nanobananaService.configure(c.settings?.nanobanana || {});
});
service.on('library-updated', (data) => broadcast('library-updated', data));
service.on('notes-updated', (data) => broadcast('notes-updated', data));

const DEFAULT_WIDTH = 1180;
const DEFAULT_HEIGHT = 720;
const APP_ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'brand', 'logo.png');

function createSplash() {
  splashWindow = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    transparent: true,
    center: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));
}

function createWindow() {
  const ws = service.config.settings?.window || {};
  const width = ws.width || DEFAULT_WIDTH;
  const height = ws.height || DEFAULT_HEIGHT;
  const splashMs = ws.showSplash === false ? 0 : (ws.splashDurationMs ?? 2400);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 960,
    minHeight: 640,
    center: true,
    title: 'SHKF',
    icon: APP_ICON_PATH,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  mainWindow.setMaxListeners(20);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    const show = () => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (ws.startMinimized) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    };
    if (splashMs > 0) setTimeout(show, splashMs);
    else show();
  });

  mainWindow.on('close', (e) => {
    const closeToTray = service.config.settings?.window?.closeToTray !== false;
    if (!app.isQuitting && closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => {
    broadcast('metask-window-resized', null);
  });
}

function closeKeyboardSplash() {
  if (keyboardSplashWindow && !keyboardSplashWindow.isDestroyed()) {
    keyboardSplashWindow.close();
    keyboardSplashWindow = null;
  }
}

function createKeyboardSplash() {
  keyboardSplashWindow = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    transparent: true,
    center: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false },
  });
  keyboardSplashWindow.loadFile(path.join(__dirname, 'renderer', 'keyboard-splash.html'));
}

function showKeyboardWindow() {
  if (!keyboardWindow || keyboardWindow.isDestroyed()) return;
  if (!keyboardWindow.isVisible()) keyboardWindow.show();
  keyboardWindow.focus();
}

function createKeyboardWindow() {
  if (keyboardWindow && !keyboardWindow.isDestroyed()) {
    closeKeyboardSplash();
    showKeyboardWindow();
    return keyboardWindow;
  }

  const ws = service.config.settings?.window || {};
  const splashMs = ws.showSplash === false ? 0 : (ws.splashDurationMs ?? 2400);

  if (splashMs > 0) createKeyboardSplash();

  keyboardWindow = new BrowserWindow({
    width: KEYBOARD_WIDTH,
    height: KEYBOARD_HEIGHT,
    minWidth: 1100,
    minHeight: 560,
    center: true,
    show: false,
    title: 'SHKF — Клавиатура',
    autoHideMenuBar: true,
    backgroundColor: '#F7F6F2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  keyboardWindow.loadFile(path.join(__dirname, 'renderer', 'keyboard.html'));

  keyboardWindow.once('ready-to-show', () => {
    const show = () => {
      closeKeyboardSplash();
      showKeyboardWindow();
    };
    if (splashMs > 0) setTimeout(show, splashMs);
    else show();
  });

  keyboardWindow.on('closed', () => {
    closeKeyboardSplash();
    keyboardWindow = null;
  });

  return keyboardWindow;
}

function createTray() {
  const icon = nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('SHKF');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Выход', click: () => { app.isQuitting = true; app.quit(); } },
    ])
  );
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  initPillNotifyService();
  registerLive2dProtocol();
  const ws = service.config.settings?.window || {};
  if (ws.showSplash !== false) createSplash();
  createWindow();
  createTray();
  if (authService.session) {
    authService.applyRestAuth?.();
    setTimeout(() => {
      teamChatService.listDirectory({ previews: false }).catch(() => {});
    }, 400);
  }
  setupAutoUpdater();
  startUpdaterPolling();
  scheduleMetaskPolling();
  if (authService.session) {
    zimbraService.configure(service.config.settings?.zimbra || {});
  } else {
    resetRuntimeIntegrations();
  }
  configureAgentIntegrations();
  maybeAutoIngestKnowledge();

  const metaskSession = session.fromPartition(metaskService.getSessionPartition());
  metaskSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(true));

  const zimbraSession = session.fromPartition(zimbraService.getSessionPartition());
  zimbraSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(true));

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone' || permission === 'videoCapture') {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone' || permission === 'videoCapture') {
      return true;
    }
    return false;
  });

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setUserAgent(METASK_DESKTOP_UA);
      contents.on('did-fail-load', (_e, errorCode, _desc, validatedURL) => {
        if (errorCode === -3 && (!validatedURL || validatedURL === 'about:blank')) {
          return;
        }
      });
    }
  });

  if (service.config.settings?.window?.startServerOnLaunch !== false) {
    service.start();
  }

  if (service.config.settings?.figma?.autoConnectOnStart) {
    service.connectFigma().catch(() => {});
  }

  setTimeout(() => checkForUpdates(), 5000);

  ipcMain.handle('auth-get-session', async () => {
    try {
      const result = await authService.getSession();
      if (result.profile) {
        await activateAuthenticatedUserContext(result.profile);
      } else {
        resetRuntimeIntegrations();
      }
      return { ...result, config: service.config };
    } catch (err) {
      if (authService.session) {
        const offline = authService.buildOfflineSessionResponse?.();
        if (offline) {
          if (offline.profile) applyAuthProfileToConfig(offline.profile);
          return { ...offline, config: service.config };
        }
      }
      return {
        ok: false,
        configured: authService.isConfigured?.() || false,
        session: null,
        user: null,
        profile: null,
        message: err?.message || 'Ошибка инициализации авторизации',
        config: service.config,
      };
    }
  });
  ipcMain.handle('auth-login', async (_e, payload) => {
    try {
      const result = await authService.signIn(payload?.login ?? payload?.email ?? '', payload?.password || '');
      if (result.ok && result.profile) {
        await activateAuthenticatedUserContext(result.profile);
        broadcast('auth-changed', { profile: result.profile, user: result.user });
      }
      return { ...result, config: service.config };
    } catch (err) {
      return { ok: false, message: err?.message || 'Ошибка входа', config: service.config };
    }
  });
  ipcMain.handle('auth-logout', async () => {
    await deactivateAuthenticatedUserContext();
    const result = await authService.signOut();
    broadcast('auth-changed', { profile: null, user: null });
    return result;
  });
  ipcMain.handle('auth-get-profile', async () => {
    try {
      const profile = await authService.fetchProfile();
      if (profile) applyAuthProfileToConfig(profile);
      return { ok: true, profile, config: service.config };
    } catch (err) {
      return { ok: false, message: err.message || String(err), profile: null };
    }
  });
  ipcMain.handle('auth-update-settings', async (_e, payload) => {
    const result = await authService.updateUserSettings(payload?.settings || {});
    return result;
  });
  ipcMain.handle('auth-change-password', async (_e, payload) => {
    try {
      const result = await authService.changePassword(payload?.password || '');
      if (result.ok && result.profile) {
        broadcast('auth-changed', { profile: result.profile, user: { id: result.profile.id, email: result.profile.email } });
      }
      return { ...result, config: service.config };
    } catch (err) {
      return { ok: false, message: err?.message || 'Не удалось сменить пароль' };
    }
  });
  ipcMain.handle('auth-update-profile', async (_e, payload) => {
    try {
      const result = await authService.updateProfile(payload || {});
      if (result.ok && result.profile) {
        applyAuthProfileToConfig(result.profile);
        broadcast('auth-changed', { profile: result.profile, user: { id: result.profile.id, email: result.profile.email } });
      }
      return { ...result, config: service.config };
    } catch (err) {
      return { ok: false, message: err?.message || 'Не удалось обновить профиль' };
    }
  });
  ipcMain.handle('auth-upload-avatar', async (_e, payload) => {
    try {
      const result = await authService.uploadAvatar(payload?.dataUrl || '', {
        full_name: payload?.full_name,
        position: payload?.position,
      });
      if (result.ok && result.profile) {
        applyAuthProfileToConfig(result.profile);
        broadcast('auth-changed', { profile: result.profile, user: { id: result.profile.id, email: result.profile.email } });
      }
      return result;
    } catch (err) {
      return { ok: false, message: err?.message || 'Не удалось загрузить аватар' };
    }
  });
  ipcMain.handle('app-get-version', () => app.getVersion());
  ipcMain.handle('updater-check-now', () => checkForUpdates());
  ipcMain.handle('updater-install-now', () => {
    if (!app.isPackaged) return { ok: false, message: 'Доступно только в установленной сборке' };
    // isSilent=true — без окна установщика NSIS: приложение тихо обновится и перезапустится.
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  });

  ipcMain.handle('get-config', () => service.config);
  ipcMain.handle('get-status', () => service.getStatus());
  ipcMain.handle('get-actions', () => ACTIONS);
  ipcMain.handle('get-action-meta', () => ACTION_META);
  ipcMain.handle('save-config', (_e, config) => {
    service.saveConfig(config);
    pushCloudSettingsFromConfig();
    return service.config;
  });
  ipcMain.handle('save-hotkey', (_e, hotkey) => {
    const config = { ...service.config, hotkeys: [...service.config.hotkeys] };
    const idx = config.hotkeys.findIndex((h) => h.id === hotkey.id);
    if (idx >= 0) config.hotkeys[idx] = hotkey;
    else config.hotkeys.push({ ...hotkey, id: hotkey.id || generateId() });
    service.saveConfig(config);
    pushCloudSettingsFromConfig();
    return config;
  });
  ipcMain.handle('delete-hotkey', (_e, id) => {
    const config = { ...service.config, hotkeys: service.config.hotkeys.filter((h) => h.id !== id) };
    service.saveConfig(config);
    return config;
  });
  ipcMain.handle('check-conflict', (_e, { keys, excludeId }) =>
    checkConflict(keys, service.config.hotkeys, excludeId)
  );
  ipcMain.handle('format-keys', (_e, keys) => formatKeys(keys));
  ipcMain.handle('start-recording', () => new Promise((resolve) => {
    service.startRecording((combo) => resolve(combo));
    setTimeout(() => { if (service.recording) { service.stopRecording(); resolve(null); } }, 10000);
  }));
  ipcMain.handle('stop-recording', () => service.stopRecording());
  ipcMain.handle('test-action', (_e, action) => service.testAction(action));
  ipcMain.handle('toggle-server', (_e, run) => {
    if (run) service.start(); else service.stop();
    return service.getStatus();
  });
  ipcMain.handle('connect-figma', async () => {
    try {
      const result = await service.connectFigma();
      return { ...result, connected: service.getStatus().figmaConnected, message: result.message };
    } catch (err) {
      return { success: false, connected: false, message: err.message };
    }
  });
  ipcMain.handle('set-theme', (_e, theme) => {
    const config = { ...service.config, theme };
    service.saveConfig(config);
    pushCloudSettingsFromConfig();
    return service.config;
  });
  ipcMain.handle('set-cdp-port', (_e, port) => {
    const config = { ...service.config, figmaCdpPort: Number(port) };
    service.saveConfig(config);
    return service.getStatus();
  });
  ipcMain.handle('open-config-folder', () => shell.openPath(path.dirname(configPath)));
  ipcMain.handle('open-plugin-folder', () => shell.openPath(pluginPath));
  ipcMain.handle('open-keyboard-mapper', () => {
    createKeyboardWindow();
    return { ok: true };
  });
  ipcMain.handle('complete-onboarding', () => {
    const config = { ...service.config, onboardingCompleted: true };
    service.saveConfig(config);
    return service.config;
  });
  ipcMain.handle('figma-make-send', async (_e, prompt) => {
    const figmaOpts = service.config.settings?.figma || {};
    try {
      return await sendMakePrompt(prompt, service.figma, (url) => shell.openExternal(url), {
        makeAutoSubmit: figmaOpts.makeAutoSubmit !== false,
        preferDesktopApp: figmaOpts.preferDesktopApp !== false,
        makeAutoFocus: figmaOpts.makeAutoFocus !== false,
      });
    } catch (err) {
      return { success: false, message: err.message || 'Ошибка отправки в Make' };
    }
  });

  ipcMain.handle('agent-figma-make-send', async (_e, payload) => {
    configureAgentIntegrations();

    if (!agentService.isConfigured()) {
      return {
        ok: false,
        message: 'Подключите Konstancia: Настройки → Konstancia',
      };
    }

    let task = payload?.task || null;
    if (task?.id) {
      metaskService.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch { /* list fields only */ }
    }

    const enhancement = FIGMA_MAKE_ENHANCEMENTS.find((item) => item.id === payload?.enhancementId) || null;
    const systemPrompt = enhancement ? FIGMA_MAKE_ENHANCE_PROMPT : FIGMA_MAKE_BUILDER_PROMPT;
    const builderMessage = enhancement
      ? buildMakeEnhanceUserMessage({
        basePrompt: payload?.basePrompt,
        enhancement,
        userMessage: payload?.message,
      })
      : buildMakeBuilderUserMessage({
        userMessage: payload?.message,
        task,
      });

    const chatResult = await agentService.chat({
      message: builderMessage,
      history: [],
      task,
      systemPrompt,
      allowFollowups: false,
    });

    if (!chatResult.ok) {
      return { ok: false, message: chatResult.message || 'Ошибка Konstancia' };
    }

    let extracted = extractMakePrompt(chatResult.content);
    if (!extracted.prompt) {
      const retry = await agentService.chat({
        message: `${builderMessage}\n\nВАЖНО: Верни ТОЛЬКО блок <<<MAKE_PROMPT ... MAKE_PROMPT>>> без пояснений.`,
        history: [],
        task,
        systemPrompt,
        allowFollowups: false,
      });
      if (retry.ok) extracted = extractMakePrompt(retry.content);
    }

    const { prompt, summary } = extracted;
    if (!prompt) {
      return {
        ok: false,
        message: 'Не удалось получить промпт в блоке MAKE_PROMPT. Опишите интерфейс конкретнее.',
        rawAssistant: chatResult.content,
      };
    }

    const summaryText = summary || chatResult.content.replace(/<<<MAKE_PROMPT[\s\S]*?MAKE_PROMPT>>>/i, '').trim();
    if (payload?.buildOnly === true) {
      return {
        ok: true,
        summary: summaryText,
        prompt,
        enhancementId: enhancement?.id || null,
        model: chatResult.model,
      };
    }

    const figmaOpts = service.config.settings?.figma || {};
    let sendResult = null;
    try {
      sendResult = await sendMakePrompt(prompt, service.figma, (url) => shell.openExternal(url), {
        makeAutoSubmit: figmaOpts.makeAutoSubmit !== false,
        preferDesktopApp: figmaOpts.preferDesktopApp !== false,
        makeAutoFocus: figmaOpts.makeAutoFocus !== false,
      });
    } catch (err) {
      return {
        ok: false,
        message: err.message || 'Не удалось открыть Figma Make',
        prompt,
        summary: summaryText,
      };
    }

    return {
      ok: true,
      summary: summaryText,
      prompt,
      enhancementId: enhancement?.id || null,
      sendResult,
      enhancements: FIGMA_MAKE_ENHANCEMENTS,
      model: chatResult.model,
    };
  });
  ipcMain.handle('speech-supported', () => isSpeechRecognitionSupported());
  ipcMain.handle('speech-list-languages', () => listInstalledSpeechLanguages());
  ipcMain.handle('speech-start', async (event, { lang } = {}) => {
    const sender = event.sender;
    try {
      const result = await recognizeSpeechOnce({
        lang: lang || service.config.settings?.make?.speechLanguage || 'ru-RU',
        onInterim: (text) => {
          if (!sender.isDestroyed()) sender.send('speech-interim', { text });
        },
      });
      if (!sender.isDestroyed()) sender.send('speech-result', result);
      return { ok: true, ...result };
    } catch (err) {
      if (err?.code === 'cancelled') {
        return { ok: false, cancelled: true };
      }
      const message = err?.message || 'Ошибка распознавания речи';
      return { ok: false, message };
    }
  });
  ipcMain.handle('speech-stop', () => {
    cancelSpeechRecognition();
    return { ok: true };
  });
  ipcMain.handle('get-templates', () => service.getTemplatesCatalog());
  ipcMain.handle('banner-mockup-get-presets', () => service.getBannerMockupPresets());
  ipcMain.handle('banner-mockup-apply', async (_e, payload) => {
    try {
      return await service.applyBannerMockup(payload || {});
    } catch (err) {
      return { ok: false, message: err.message || 'Ошибка вставки баннера' };
    }
  });
  ipcMain.handle('banner-mockup-read-figma-texts', async (_e, payload) => {
    try {
      return await service.readBannerTextsFromFigma(payload?.templateId);
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось прочитать текст из Figma' };
    }
  });
  ipcMain.handle('copy-template', (_e, templateId) => service.copyTemplate(templateId));
  ipcMain.handle('get-user-template-thumb', (_e, templateId, options) => service.getUserTemplateThumb(templateId, options));
  ipcMain.handle('update-user-template', (_e, { id, patch }) => service.updateUserTemplate(id, patch));
  ipcMain.handle('delete-user-template', (_e, id) => service.deleteUserTemplate(id));
  ipcMain.handle('metask-sync', async () => {
    try {
      return await runMetaskSync({ notify: true });
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });
  ipcMain.handle('metask-consume-pending-updates', () => {
    const updates = pendingMetaskUpdates;
    pendingMetaskUpdates = [];
    return updates;
  });
  ipcMain.handle('metask-consume-pending-comment-updates', () => {
    const events = pendingMetaskCommentUpdates;
    pendingMetaskCommentUpdates = [];
    return events;
  });
  ipcMain.handle('metask-attach-board', async () => attachMetaskBoard());
  ipcMain.handle('metask-detach-board', () => {
    detachMetaskBoard();
    return { ok: true };
  });
  ipcMain.handle('metask-resize-board', async () => resizeMetaskBoard());
  ipcMain.handle('metask-open-issue', (_e, url) => {
    if (metaskBrowserView && url && !metaskBrowserView.webContents.isDestroyed()) {
      metaskBrowserView.webContents.loadURL(url);
      broadcastMetaskIssueActive(url);
    }
  });
  ipcMain.handle('metask-get-info', () => ({
    partition: metaskService.getSessionPartition(),
    boardUrl: metaskService.getBoardUrl(),
    settings: service.config.settings?.metask || {},
  }));
  ipcMain.handle('metask-save-credentials', async (_e, creds) => {
    const prev = service.config.settings?.metask || {};
    const mergedCreds = {
      ...prev,
      ...creds,
      password: creds?.password ? creds.password : (prev.password || ''),
    };
    const config = service.updateAppSettings({
      metask: mergedCreds,
    });
    metaskService.configure(config.settings?.metask || {});
    await pushUserIntegrationsFromConfig();
    const next = config.settings?.metask || {};
    const baseChanged = (prev.baseUrl || '') !== (next.baseUrl || '');
    const boardChanged = (prev.boardPath || '') !== (next.boardPath || '');
    const loginChanged = (prev.username || '') !== (next.username || '')
      || (prev.password || '') !== (next.password || '');
    if (baseChanged || boardChanged || loginChanged) {
      await clearMetaskSession();
      await reloadMetaskBoard();
    }
    return next;
  });
  ipcMain.handle('metask-get-login-script', (_e, creds) => {
    const base = service.config.settings?.metask || {};
    metaskService.configure(creds ? { ...base, ...creds } : base);
    return metaskService.buildAutoLoginScript();
  });
  ipcMain.handle('metask-clear-session', async () => {
    await clearMetaskSession();
    return { ok: true };
  });
  ipcMain.handle('metask-reload-board', async () => reloadMetaskBoard());
  ipcMain.handle('metask-open-external', (_e, url) => {
    if (url) shell.openExternal(url);
  });
  ipcMain.handle('metask-add-comment', async (_e, payload) => {
    const blocked = assertMetaskUserGesture(payload, 'metask-add-comment');
    if (blocked) return blocked;
    metaskService.configure(service.config.settings?.metask || {});
    return metaskService.addIssueComment(payload?.issueId, payload?.notes);
  });
  ipcMain.handle('metask-add-labor-log', async (_e, payload) => {
    const blocked = assertMetaskUserGesture(payload, 'metask-add-labor-log');
    if (blocked) return blocked;
    metaskService.configure(service.config.settings?.metask || {});
    return metaskService.addLaborLog(payload?.issueId, {
      hours: payload?.hours,
      description: payload?.description,
    });
  });

  ipcMain.handle('agent-get-morning-brief', async () => {
    try {
      const result = await runMetaskSync({ notify: false });
      if (!result?.fetchOk) {
        return {
          ok: false,
          message: result?.lastError || 'Не удалось загрузить задачи Kanban. Проверьте URL и API-ключ.',
          brief: null,
        };
      }
      const tasks = result.tasks || [];
      let linkerSuggestions = [];
      try {
        const linkRes = await taskLinkerService.suggest(tasks, new Set());
        linkerSuggestions = linkRes?.suggestions || [];
      } catch { /* optional */ }
      const analytics = processAnalyticsService.analyze({ tasks, linkerSuggestions });
      const brief = buildMorningBrief({
        tasks,
        updates: result.updates || [],
        userName: result.user || metaskService.userName || '',
        processInsights: analytics.insights,
      });
      return { ok: true, brief, tasks, processAnalytics: analytics };
    } catch (err) {
      return { ok: false, message: err.message || String(err), brief: null };
    }
  });

  ipcMain.handle('mail-get-info', () => {
    zimbraService.configure(service.config.settings?.zimbra || {});
    return {
      partition: zimbraService.getSessionPartition(),
      mailUrl: zimbraService.getMailUrl(),
      settings: {
        baseUrl: zimbraService.settings.baseUrl,
        username: zimbraService.settings.username,
        password: zimbraService.settings.password,
      },
    };
  });
  ipcMain.handle('mail-get-login-script', (_e, creds) => {
    const base = service.config.settings?.zimbra || {};
    zimbraService.configure(creds ? { ...base, ...creds } : base);
    const { username, password } = zimbraService.settings;
    if (!username || !password) return null;
    return zimbraService.buildAutoLoginScript(
      zimbraService.resolveLoginUsername(username),
      password
    );
  });
  ipcMain.handle('mail-clear-session', async () => {
    await clearZimbraSession();
    return { ok: true };
  });
  ipcMain.handle('mail-save-credentials', async (_e, creds) => {
    const prev = service.config.settings?.zimbra || {};
    const config = service.updateAppSettings({
      zimbra: {
        ...prev,
        ...creds,
        password: creds?.password ? creds.password : (prev.password || ''),
      },
    });
    zimbraService.configure(config.settings?.zimbra || {});
    await pushUserIntegrationsFromConfig();
    return config.settings?.zimbra;
  });
  ipcMain.handle('mail-open-external', (_e, url) => {
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('webtab-open-external', (_e, url) => {
    if (url) shell.openExternal(url);
  });
  ipcMain.handle('webtab-clear-session', async (_e, partition) => {
    const name = String(partition || '').trim();
    if (!name) return { ok: false };
    try {
      const ses = session.fromPartition(name);
      await ses.clearStorageData();
      await ses.clearCache();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('agent-get-status', () => agentService.getStatus());
  ipcMain.handle('agent-get-ml-status', () => getMlStatus());
  ipcMain.handle('agent-get-konstancia-llm-status', () => getKonstanciaLlmStatus());

  ipcMain.handle('agent-chat-share-colleagues', async () => agentChatShareService.listColleagues());
  ipcMain.handle('agent-chat-share-send', async (_e, payload) => agentChatShareService.shareChat(payload || {}));
  ipcMain.handle('agent-chat-share-incoming', async (_e, payload) => agentChatShareService.listIncoming(payload || {}));
  ipcMain.handle('agent-chat-share-get', async (_e, payload) => agentChatShareService.getShare(payload?.shareId));
  ipcMain.handle('agent-chat-share-accept', async (_e, payload) => agentChatShareService.acceptShare(payload?.shareId));
  ipcMain.handle('agent-chat-share-dismiss', async (_e, payload) => agentChatShareService.dismissShare(payload?.shareId));

  ipcMain.handle('team-chat-colleagues', async () => teamChatService.listColleagues());
  ipcMain.handle('team-chat-directory', async (_e, payload) => teamChatService.listDirectory(payload || {}));
  ipcMain.handle('team-chat-list-rooms', async () => teamChatService.listRooms());
  ipcMain.handle('team-chat-list-messages', async (_e, payload) => teamChatService.listMessages(payload || {}));
  ipcMain.handle('team-chat-open-dm', async (_e, payload) => teamChatService.openDmRoom(payload?.recipientId));
  ipcMain.handle('team-chat-open-task-room', async (_e, payload) => teamChatService.openTaskRoom(payload?.taskId, payload?.subject));
  ipcMain.handle('team-chat-send-message', async (_e, payload) => teamChatService.sendMessage(payload || {}));
  ipcMain.handle('team-chat-upload-attachment', async (_e, payload) => teamChatService.uploadAttachment(payload || {}));
  ipcMain.handle('team-chat-mark-read', async (_e, payload) => teamChatService.markRead(payload?.roomId));
  ipcMain.handle('team-chat-pin-room', async (_e, payload) => teamChatService.pinRoom(payload?.roomId));
  ipcMain.handle('team-chat-unpin-room', async (_e, payload) => teamChatService.unpinRoom(payload?.roomId));
  ipcMain.handle('team-chat-pin-message', async (_e, payload) => teamChatService.pinMessage(payload || {}));
  ipcMain.handle('team-chat-unpin-message', async (_e, payload) => teamChatService.unpinMessage(payload || {}));
  ipcMain.handle('team-chat-forward-message', async (_e, payload) => teamChatService.forwardMessage(payload || {}));

  ipcMain.handle('agent-play-yandex-music', async (_e, payload) => {
    try {
      const query = parseMusicPlayQuery(payload?.message || payload?.query || '');
      if (!query) {
        return { ok: false, message: 'Укажите название трека.' };
      }
      const result = await playYandexMusicTrack(query);
      const dinDon = isDinDonMusicIntent(payload?.message || query);
      const trackLabel = result?.track?.artist
        ? `${result.track.artist} — «${result.track.title}»`
        : result?.track?.title;
      return {
        ok: true,
        content: getPlayMusicReply(query, { dinDon, trackLabel }),
        ...result,
      };
    } catch (err) {
      return { ok: false, message: err?.message || String(err) };
    }
  });

  ipcMain.handle('agent-send-message', async (_e, payload) => {
    configureAgentIntegrations();
    metaskService.configure(service.config.settings?.metask || {});

    const learningSettings = service.config.settings?.taskLearning || {};
    const hfMlSettings = learningSettings.hfMl || {};
    const messageText = String(payload?.message || '').trim();

    let mlIntentTop = null;
    if (hfMlSettings.enabled !== false) {
      const mlResult = await classifyMlIntent(messageText);
      mlIntentTop = getTopMlIntent(mlResult, { threshold: hfMlSettings.intentThreshold ?? 0.55 });
    }

    let task = payload?.task || null;
    if (task?.id) {
      metaskReadOnly.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch { /* list fields only */ }
    }

    const skipTaskRequirement = payload?.skipTaskRequirement === true;
    if (skipTaskRequirement) task = null;
    if (!skipTaskRequirement && requiresTaskSelection(messageText) && !task?.id && !mlOverridesTaskRequirement(mlIntentTop)) {
      const prompt = buildTaskOptionalPrompt(messageText, payload?.kanbanTasks || []);
      return {
        ok: true,
        content: prompt.content,
        followups: prompt.followups,
        taskOptionalPrompt: true,
        laborEntries: null,
        learnedChunkIds: [],
        direct: true,
        directMeta: 'Konstancia',
      };
    }

    if (isVaguePlayMusicRequest(messageText)) {
      return {
        ok: true,
        content: 'Какой трек включить? Напиши, например: **поставь крип а крип динь дон** или **включи billie eilish bad guy**.',
        laborEntries: null,
        learnedChunkIds: [],
        direct: true,
        directMeta: 'Яндекс Музыка',
      };
    }

    if (/^отмена$/i.test(messageText.trim())) {
      return {
        ok: true,
        content: 'Ок, отменила.',
        laborEntries: null,
        learnedChunkIds: [],
        direct: true,
      };
    }

    const musicFollowupQuery = parseMusicExecuteFollowup(messageText);
    if (musicFollowupQuery) {
      try {
        const played = await playYandexMusicTrack(musicFollowupQuery);
        return {
          ok: true,
          content: getPlayMusicReply(musicFollowupQuery, { trackLabel: played?.track?.artist ? `${played.track.artist} — «${played.track.title}»` : played?.track?.title }),
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
          directMeta: 'Яндекс Музыка',
          musicAction: { query: musicFollowupQuery },
        };
      } catch (err) {
        return {
          ok: true,
          content: `Не удалось включить в Яндекс Музыке: ${err?.message || err}`,
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
          directMeta: 'Яндекс Музыка',
        };
      }
    }

    if (isPlayMusicIntent(messageText)) {
      const query = parseMusicPlayQuery(messageText);
      const dinDon = isDinDonMusicIntent(messageText);
      const executeNow = shouldExecuteMusicPlay(messageText, {
        confirm: payload?.confirmMusicPlay === true,
      });

      if (!executeNow) {
        const suggestion = buildDesktopSuggestion(query, messageText);
        return {
          ok: true,
          content: suggestion.message,
          followups: suggestion.followups,
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
          directMeta: 'Яндекс Музыка',
          pendingMusicQuery: query,
        };
      }

      try {
        const played = await playYandexMusicTrack(query);
        const trackLabel = played?.track?.artist
          ? `${played.track.artist} — «${played.track.title}»`
          : played?.track?.title;
        return {
          ok: true,
          content: getPlayMusicReply(query, { dinDon, trackLabel }),
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
          directMeta: 'Яндекс Музыка',
          musicAction: { query, dinDon },
        };
      } catch (err) {
        return {
          ok: true,
          content: `Не удалось включить в Яндекс Музыке: ${err?.message || err}`,
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
          directMeta: 'Яндекс Музыка',
        };
      }
    }

    if (isCasualChatQuery(messageText)) {
      return {
        ok: true,
        content: getCasualChatReply(messageText),
        laborEntries: null,
        learnedChunkIds: [],
        direct: true,
      };
    }

    const agentSettingsEarly = service.config.settings?.agent || {};
    if (
      agentSettingsEarly.desktopAgentEnabled !== false
      && process.platform === 'win32'
      && isDesktopControlQuery(messageText)
    ) {
      const desktopCmd = parseDesktopCommand(messageText);
      if (desktopCmd) {
        try {
          const desktopResult = await executeDesktopAction(desktopCmd);
          return {
            ok: true,
            content: desktopResult.message,
            laborEntries: null,
            learnedChunkIds: [],
            direct: true,
            directMeta: desktopResult.action === 'play_yandex_music' ? 'Яндекс Музыка' : 'Компьютер',
            desktopAction: desktopResult,
            musicAction: desktopResult.action === 'play_yandex_music' ? { query: desktopResult.query } : null,
          };
        } catch (err) {
          const suggestion = buildDesktopSuggestion(desktopCmd.target || messageText, messageText);
          if (suggestion.type === 'music' || suggestion.type === 'app') {
            return {
              ok: true,
              content: suggestion.message,
              followups: suggestion.followups,
              laborEntries: null,
              learnedChunkIds: [],
              direct: true,
              directMeta: suggestion.type === 'music' ? 'Яндекс Музыка' : 'Компьютер',
            };
          }
          return {
            ok: true,
            content: suggestion.message,
            laborEntries: null,
            learnedChunkIds: [],
            direct: true,
            directMeta: 'Компьютер',
          };
        }
      }
    }

    const fileSearchIntent = payload?.forceRedmineFileSearch === true
      || mlWantsFileSearch(mlIntentTop)
      || isRedmineFileSearch(messageText, {
        force: payload?.includeRedmineKnowledge === true,
      });

    if (fileSearchIntent) {
      metaskReadOnly.configure(service.config.settings?.metask || {});
      await metaskService.resolveCurrentUser?.().catch(() => {});
      try {
        const searchResult = await runRedmineFileSearch({
          query: payload?.message || '',
          kanbanTasks: payload?.kanbanTasks || [],
          metaskService,
          taskKnowledgeService,
          userId: metaskService.userId,
        });
        return {
          ok: true,
          content: searchResult.content || searchResult.message || 'Поиск не вернул результат.',
          laborEntries: null,
          learnedChunkIds: [],
          indexingStatus: searchResult.indexingStatus || null,
          direct: true,
        };
      } catch (err) {
        return {
          ok: true,
          content: `Ошибка поиска Redmine: ${err?.message || err}`,
          laborEntries: null,
          learnedChunkIds: [],
          direct: true,
        };
      }
    }

    const role = payload?.role || service.config.settings?.user?.role || null;
    let message = payload?.message;
    const agentSettings = service.config.settings?.agent || {};
    const attachTask = !skipTaskRequirement && payload?.includeTaskContext === true && task?.id;
    const casualChatMode = isCasualChatQuery(messageText);
    const desktopControlMode = agentSettings.desktopAgentEnabled !== false
      && process.platform === 'win32'
      && isDesktopControlQuery(messageText);
    const generalKnowledgeMode = !casualChatMode && (
      isGeneralKnowledgeQuery(messageText)
      || mlIntentTop?.label === 'general_chat'
    );
    const injectLearning = !skipTaskRequirement
      && !generalKnowledgeMode
      && learningSettings.enabled !== false
      && (payload?.includeLearnedExperience === true
        || mlWantsLearnedExperience(mlIntentTop)
        || wantsLearnedExperience(message)
        || wantsProcessInsights(message));
    const injectRedmineKb = !skipTaskRequirement
      && !generalKnowledgeMode
      && learningSettings.enabled !== false
      && !isLearnedExperienceQuery(message)
      && (payload?.includeRedmineKnowledge === true
        || wantsRedmineKnowledge(message)
        || wantsFileSearch(message));

    if (generalKnowledgeMode && !casualChatMode && agentSettings.knowledgeLearningEnabled !== false) {
      const ragHits = await knowledgeIngestService.search(messageText, { limit: 5 });
      const ragBlock = formatKnowledgeRagBlock(ragHits);
      if (ragBlock) message = `${ragBlock}\n\n---\n\n${message}`;
    }
    if (generalKnowledgeMode && agentSettings.webSearchEnabled !== false) {
      const web = await searchWeb(messageText, { limit: wantsWebSearch(messageText) ? 6 : 4 });
      const block = formatWebSearchBlock(web);
      if (block) message = `${block}\n\n---\n\n${message}`;
    }
    if (
      agentSettings.siteBuilderEnabled === true
      && isSiteBuildIntent(message)
      && !payload?.skipMobbinContext
    ) {
      const refsBundle = await siteBuilderService.gatherReferences(message);
      if (refsBundle.context) {
        message = `${refsBundle.context}\n\n---\n\n${message}`;
      }
    }
    let learnedExperienceBlock = '';
    let learnedChunkIds = [];
    let indexingStatus = null;
    const kanbanList = Array.isArray(payload?.kanbanTasks) ? payload.kanbanTasks : [];
    const knowledgeQuery = [message, task?.subject, task?.project, task?.description].filter(Boolean).join(' ');

    if (injectLearning || injectRedmineKb) {
      metaskService.configure(service.config.settings?.metask || {});

      if (injectRedmineKb && (mlWantsReindex(mlIntentTop) || wantsReindexTasks(message))) {
        indexingStatus = { started: true, indexed: 0, pending: kanbanList.length, total: kanbanList.length };
        taskKnowledgeService.startBackgroundReindex(kanbanList, metaskService.userId, {
          onProgress: (p) => broadcast('task-knowledge-reindex-progress', p),
        });
        return {
          ok: true,
          content: [
            `Запустил индексацию **${kanbanList.length}** задач из Kanban в фоне.`,
            '',
            'Через 1–2 минуты повторите поиск по файлу — подтянутся вложения и описания.',
            'Закрытые задачи ищутся сразу через Redmine search (не нужно ждать).',
          ].join('\n'),
          laborEntries: null,
          learnedChunkIds: [],
          indexingStatus,
        };
      }

      if (injectRedmineKb) {
        const statsBefore = taskKnowledgeService.listLearnedSummary();
        const needIndex = statsBefore.issuesIndexed < Math.min(kanbanList.length, 10);
        if (needIndex && kanbanList.length) {
          indexingStatus = await taskKnowledgeService.ensureCatalogCoverage(
            kanbanList,
            metaskService.userId,
            { maxBatch: 60 },
          );
        }
      }

      let apiHits = [];
      if (injectRedmineKb) {
        try {
          apiHits = await metaskService.searchIssuesForKnowledge(knowledgeQuery, { limit: 12 });
        } catch {
          apiHits = [];
        }
        for (const hit of apiHits.slice(0, 8)) {
          try {
            await taskKnowledgeService.indexIssue(hit.issueId, {
              listTask: {
                id: hit.issueId,
                subject: hit.subject,
                description: hit.description || hit.snippet || '',
                project: hit.project,
                status: hit.status,
                url: hit.url,
              },
              liteOnly: true,
            });
          } catch { /* continue */ }
        }
      }

      const kanbanHits = injectRedmineKb
        ? searchKanbanTasksForKnowledge(knowledgeQuery, kanbanList, { limit: 10 })
        : [];
      const metaHits = injectRedmineKb
        ? taskKnowledgeService.searchIssueMeta(knowledgeQuery, { limit: 8 })
        : [];

      const chunks = await taskKnowledgeService.retrieveForAgent(knowledgeQuery, {
        task,
        limit: injectRedmineKb ? 12 : 8,
        preferAttachments: injectRedmineKb,
      });

      for (const hit of metaHits) {
        const id = Number(hit.issueId);
        if (!id || chunks.some((c) => Number(c.issueId) === id)) continue;
        chunks.push({
          id: `meta-${id}`,
          issueId: id,
          project: hit.project,
          type: 'summary',
          text: `${hit.subject}. ${hit.project || ''} ${hit.status || ''}`.trim(),
          tags: [],
        });
      }

      let attachmentHits = injectRedmineKb
        ? taskKnowledgeService.searchAttachments(knowledgeQuery, { limit: 10 })
        : [];
      const issueDetails = await resolveReferencedIssuesForLearning(chunks, {
        kanbanTasks: kanbanList,
        fetchIssue: (id) => metaskService.fetchIssueForAgent(id),
        limit: injectRedmineKb ? 12 : 6,
      });
      const enrichIds = [...attachmentHits, ...kanbanHits, ...metaHits, ...apiHits];
      for (const hit of enrichIds) {
        const id = Number(hit.issueId);
        if (!id || issueDetails.has(id)) continue;
        const fromKanban = kanbanList.find((t) => Number(t.id) === id);
        if (fromKanban) {
          issueDetails.set(id, fromKanban);
          continue;
        }
        try {
          const full = await metaskService.fetchIssueForAgent(id);
          if (full) issueDetails.set(id, full);
        } catch { /* partial */ }
      }

      if (injectRedmineKb) {
        attachmentHits = taskKnowledgeService.searchAttachments(knowledgeQuery, { limit: 12 });
        const stats = taskKnowledgeService.listLearnedSummary();
        learnedChunkIds = chunks.map((c) => c.id).filter(Boolean);
        const directContent = formatRedmineSearchReply({
          query: payload?.message || message,
          kanbanHits,
          metaHits,
          attachmentHits,
          apiHits,
          chunks,
          issueDetails,
          stats,
          indexingStatus,
          kanbanCount: kanbanList.length,
        });
        return {
          ok: true,
          content: directContent,
          laborEntries: null,
          learnedChunkIds,
          indexingStatus,
          direct: true,
        };
      }

      const synthesis = injectLearning && chunks.length
        ? await taskKnowledgeService.synthesizeRetrieval(knowledgeQuery, chunks, task, issueDetails)
        : '';
      learnedChunkIds = chunks.map((c) => c.id).filter(Boolean);
      const stats = taskKnowledgeService.listLearnedSummary();
      if (injectRedmineKb) {
        if (wantsReindexTasks(message)) {
          learnedExperienceBlock = [
            '## Каталог Redmine — индексация',
            '',
            `Запущена фоновая индексация ${kanbanList.length} задач из Kanban.`,
            'Сообщи пользователю что индексация идёт; через 1–2 минуты можно повторить поиск по файлам.',
            'Не проси искать вручную в Redmine.',
          ].join('\n');
        } else {
          learnedExperienceBlock = buildRedmineKnowledgeBlock({
            chunks,
            attachmentHits,
            kanbanHits,
            issueDetails,
            stats,
            indexingStatus,
          });
        }
        if (injectLearning && (synthesis || chunks.length) && !wantsReindexTasks(message)) {
          learnedExperienceBlock += `\n\n${buildLearnedExperienceBlock(chunks, synthesis, { issueDetails })}`;
        }
      } else {
        learnedExperienceBlock = buildLearnedExperienceBlock(chunks, synthesis, { issueDetails });
      }
      const playbook = taskKnowledgeService.getPlaybook(task?.project);
      if (playbook?.tips?.length && injectLearning) {
        learnedExperienceBlock += `\n\n## Playbook проекта «${task?.project || 'общий'}»\n`
          + playbook.tips.map((t, i) => `${i + 1}. ${t}`).join('\n');
      }
      if (wantsProcessInsights(message)) {
        const tasks = payload?.kanbanTasks || [];
        const analytics = processAnalyticsService.analyze({ tasks });
        const processInsightsBlock = processAnalyticsService.formatInsightsMarkdown(analytics);
        message = `${processInsightsBlock}\n\n---\n\n${message}`;
      }
    }
    const chatResult = await agentService.chat({
      message,
      history: payload?.history,
      task: generalKnowledgeMode ? null : (attachTask ? task : null),
      systemPrompt: buildSystemPromptForRole(role, {
        taskLearningEnabled: learningSettings.enabled !== false && !generalKnowledgeMode && !casualChatMode,
        redmineKnowledgeMode: injectRedmineKb,
        generalKnowledgeMode,
        casualChatMode,
        desktopControlMode,
      }),
      allowFollowups: payload?.allowFollowups === true,
      images: payload?.images,
      learnedExperienceBlock: (generalKnowledgeMode || casualChatMode) ? '' : learnedExperienceBlock,
      temperature: casualChatMode ? 0.9 : (generalKnowledgeMode ? 0.82 : (injectLearning || injectRedmineKb ? 0.52 : undefined)),
      maxTokens: casualChatMode ? 1024 : (generalKnowledgeMode ? 8192 : (injectLearning || injectRedmineKb ? 6144 : undefined)),
    });

    let laborEntries = null;
    if (task?.id && isLaborCostQuery(payload?.message)) {
      const all = getLaborDisplayEntries(task);
      laborEntries = filterLaborEntriesByQuery(all, payload?.message || '');
    }

    if (
      chatResult?.ok
      && agentSettings.desktopAgentEnabled !== false
      && process.platform === 'win32'
    ) {
      const desktopTool = extractDesktopToolFromResponse(chatResult.content);
      if (desktopTool) {
        try {
          const desktopResult = await executeDesktopAction(desktopTool);
          const cleaned = stripDesktopToolFromResponse(chatResult.content);
          return {
            ...chatResult,
            content: [cleaned, desktopResult.message].filter(Boolean).join('\n\n'),
            laborEntries,
            learnedChunkIds,
            indexingStatus,
            desktopAction: desktopResult,
          };
        } catch (err) {
          const cleaned = stripDesktopToolFromResponse(chatResult.content);
          return {
            ...chatResult,
            content: [cleaned, `Не удалось: ${err?.message || err}`].filter(Boolean).join('\n\n'),
            laborEntries,
            learnedChunkIds,
            indexingStatus,
          };
        }
      }
    }

    return { ...chatResult, laborEntries, learnedChunkIds, indexingStatus };
  });

  ipcMain.handle('agent-site-build', async (_e, payload) => {
    configureAgentIntegrations();
    if (!agentService.isConfigured()) {
      return { ok: false, message: 'Подключите GigaChat: Настройки → Konstancia' };
    }

    let task = payload?.task || null;
    if (task?.id) {
      metaskService.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch { /* partial task */ }
    }

    const message = String(payload?.message || '').trim();
    if (!message) {
      return { ok: false, message: 'Опишите, какой сайт или приложение нужно собрать' };
    }

    return siteBuilderService.build({
      message,
      task,
      history: payload?.history || [],
    });
  });

  ipcMain.handle('agent-site-build-copy', (_e, payload) => {
    const files = payload?.plan?.files || payload?.files || [];
    if (!files.length) {
      return { ok: false, message: 'Нет файлов для копирования' };
    }
    const bundle = files
      .map((f) => `// === ${f.path} ===\n${f.content || ''}`)
      .join('\n\n');
    try {
      clipboard.writeText(bundle);
      return { ok: true, chars: bundle.length };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось записать в буфер обмена' };
    }
  });

  ipcMain.handle('agent-site-build-export', async (_e, payload) => {
    const plan = payload?.plan;
    const files = plan?.files || [];
    if (!files.length) {
      return { ok: false, message: 'Нет файлов для экспорта' };
    }

    let baseDir = String(payload?.dir || '').trim();
    if (!baseDir) {
      const picked = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите папку для проекта',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (picked.canceled || !picked.filePaths?.[0]) {
        return { ok: false, message: 'Экспорт отменён' };
      }
      const slug = String(plan?.summary || 'generated-site')
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'generated-site';
      baseDir = path.join(picked.filePaths[0], slug);
    }

    try {
      for (const file of files) {
        const rel = String(file.path || '').replace(/^\/+/, '');
        if (!rel || rel.includes('..')) continue;
        const full = path.join(baseDir, rel);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, String(file.content || ''), 'utf8');
      }
      return { ok: true, dir: baseDir, fileCount: files.length };
    } catch (err) {
      return { ok: false, message: err.message || 'Ошибка записи файлов' };
    }
  });

  ipcMain.handle('agent-mobbin-status', () => ({
    ok: true,
    ...mobbinService.getStatus(),
    designMemoryCount: designMemoryService.list().length,
  }));

  ipcMain.handle('agent-mobbin-propose-styles', async (_e, payload) => {
    configureAgentIntegrations();
    const message = String(payload?.message || '').trim();
    const screens = Array.isArray(payload?.screens) ? payload.screens : [];
    if (!message) return { ok: false, message: 'Пустой запрос' };
    if (!screens.length) return { ok: false, message: 'Нет экранов Mobbin' };
    try {
      return await mobbinStyleService.proposeStyles({ message, screens });
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('agent-mobbin-search', async (_e, payload) => {
    configureAgentIntegrations();
    const message = String(payload?.message || '').trim();
    if (!message) return { ok: false, message: 'Введите запрос для поиска' };

    const searchQuery = extractMobbinSearchQuery(message);
    const platform = inferMobbinPlatform(message);
    const retrievalMode = service.config.settings?.agent?.designMemoryMode || 'hybrid';
    const screens = [];
    const seen = new Set();
    const liveConfigured = mobbinService.isConfigured();

    const MOBBIN_GALLERY_LIMIT = 20;
    const addScreens = (list, source) => {
      for (const s of list || []) {
        const key = s.id || s.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        screens.push({
          id: s.id,
          app_name: s.title || s.app_name,
          mobbin_url: s.url || s.mobbin_url,
          image_url: s.imageUrl || s.image_url || null,
          platform: s.platform,
          source,
        });
      }
    };

    let mobbinNetworkFailed = false;
    if (liveConfigured) {
      const queries = [searchQuery];
      const suffix = mobbinSearchQuerySuffix(platform);
      if (!/app|screen|ui|web|site|mobile|website/i.test(searchQuery)) {
        queries.push(`${searchQuery} ${suffix}`);
      }
      for (const q of queries) {
        if (screens.length >= MOBBIN_GALLERY_LIMIT * 2) break;
        const live = await mobbinService.searchScreens(q, { platform, limit: MOBBIN_GALLERY_LIMIT, mode: 'deep' });
        if (live.networkError) mobbinNetworkFailed = true;
        addScreens(
          (live.screens || []).filter((s) => !s.platform || s.platform === platform),
          'mobbin',
        );
      }
    }

    const needLocalFallback = !liveConfigured || screens.length === 0;
    if (needLocalFallback) {
      const local = await designMemoryService.retrieve(searchQuery, {
        limit: MOBBIN_GALLERY_LIMIT,
        mode: retrievalMode,
        platform,
      });
      for (const ref of local) {
        const key = ref.id || ref.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        screens.push({
          id: ref.id,
          app_name: ref.title,
          mobbin_url: ref.url,
          image_url: ref.imageUrl || null,
          platform: ref.platform || platform,
          source: ref.source || 'memory',
          tags: ref.tags || [],
        });
      }
    }

    const platformOnly = screens.filter((s) => !s.platform || s.platform === platform);
    const enriched = await enrichScreensWithPreviews(platformOnly, { limit: platformOnly.length || 40 });

    return {
      ok: true,
      screens: enriched,
      total: enriched.length,
      live: liveConfigured,
      localOnly: !liveConfigured,
      platform,
      searchQuery,
      hint: mobbinNetworkFailed
        ? `Mobbin API недоступен (DNS/сеть). Показано ${enriched.length} референсов из локальной библиотеки и превью mobbin.com.`
        : liveConfigured
          ? `Показано ${enriched.length} референсов Mobbin (${mobbinPlatformLabel(platform)}).`
          : 'Mobbin API key не нужен: локальная библиотека + превью со страниц Mobbin.',
    };
  });

  ipcMain.handle('agent-cursor-figma-mcp-check', async () => {
    try {
      return { ok: true, ...(await checkFigmaMcpReady()) };
    } catch (err) {
      return { ok: false, message: String(err?.message || err) };
    }
  });

  ipcMain.handle('agent-figma-plan', async (_e, payload) => {
    try {
    configureAgentIntegrations();
    if (!agentService.isConfigured()) {
      return { ok: false, message: 'Подключите GigaChat: Настройки → Konstancia' };
    }

    let selection = null;
    let figmaPluginConnected = !!service.pluginConnected;
    const messageEarly = String(payload?.message || '').trim();
    const needsFigmaPlugin = payload?.requireFigmaPlugin === true
      || /выделен|selection|примени\s+в\s+figma|внеси\s+в\s+figma|текущ(ий|ее)\s+макет/i.test(messageEarly);
    try {
      const result = await service.readFigmaSelectionBrief({ optional: !needsFigmaPlugin });
      selection = result?.selection || null;
      figmaPluginConnected = result?.pluginConnected !== false;
    } catch (err) {
      if (needsFigmaPlugin) {
        return { ok: false, message: err.message || 'Не удалось прочитать контекст Figma' };
      }
      selection = null;
      figmaPluginConnected = false;
    }

    let task = payload?.task || null;
    if (task?.id) {
      metaskService.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch {
        // keep partial task
      }
    }

    const message = String(payload?.message || '').trim();
    const selectedScreen = payload?.selectedScreen || null;
    const selectedStyle = payload?.selectedStyle || null;
    const forceFigmaApp = shouldBuildFigmaAppPlan(message) || payload?.figmaApp === true || !!selectedStyle;
    const forceDeterministicLayout = !forceFigmaApp
      && /(лендинг|landing|сайт|website|web\s*page|главная|homepage|hero)/i.test(message);
    const contextPrefix = buildFigmaContextBlock(selection);
    const retrievalMode = service.config.settings?.agent?.designMemoryMode || 'hybrid';
    let refsResult = await designMemoryService.getPromptContext(message, {
      limit: 6,
      mode: retrievalMode,
    });
    if (!selectedScreen && service.config.settings?.agent?.mobbinEnabled !== false) {
      try {
        const live = await siteBuilderService.gatherReferences(message);
        if (live.refs?.length) {
          refsResult = {
            refs: live.refs,
            context: live.context || refsResult.context,
          };
        }
      } catch {
        // live Mobbin optional when building without a picked screen
      }
    }
    const refsPrefix = refsResult.context;
    const mobbinLive = mobbinService.isConfigured();

    if (selectedScreen?.mobbin_url || selectedScreen?.imageUrl || selectedScreen?.image_url || selectedScreen?.url) {
      let imageUrl = selectedScreen.image_url || selectedScreen.imageUrl || null;
      const mobbinUrl = selectedScreen.mobbin_url || selectedScreen.url || null;
      if (!imageUrl && mobbinUrl) {
        try {
          imageUrl = await resolveMobbinPreviewUrl(mobbinUrl);
        } catch {
          imageUrl = null;
        }
      }
      const normalized = {
        app_name: selectedScreen.app_name || selectedScreen.title,
        mobbin_url: mobbinUrl,
        imageUrl,
        id: selectedScreen.id,
        tags: selectedScreen.tags || [],
      };
      const refForStyle = {
        title: normalized.app_name,
        url: normalized.mobbin_url,
        tags: normalized.tags,
        platform: selectedScreen.platform,
      };
      const styleRefs = refsResult.refs?.length
        ? refsResult.refs
        : (refForStyle.url ? [refForStyle] : []);

      if (!imageUrl) {
        return {
          ok: false,
          message: 'Не удалось загрузить превью Mobbin для Vision. Проверьте ссылку или выберите другой экран.',
          referenceScreen: normalized,
        };
      }

      const expandApp = !!selectedStyle
        || (payload?.expandApp !== false
          && shouldExpandAppScreens(message)
          && shouldBuildFigmaAppPlan(message));
      const buildMessage = selectedStyle
        ? `${message}\n\n${formatMobbinStyleBlock(selectedStyle)}`
        : message;

      const agentSettings = service.config.settings?.agent || {};
      const forceVision = /\/vision\b/i.test(message);
      const useCursorMcp = !forceVision && isCursorFigmaBuildConfigured(agentSettings);
      let cursorFallbackNote = null;

      if (useCursorMcp) {
        const brief = buildFigmaDesignBrief({
          message: buildMessage,
          screen: { ...normalized, platform: selectedScreen.platform },
          refs: styleRefs,
          selection,
          task,
          expandApp,
          selectedStyle,
        });
        let cursorResult;
        try {
          cursorResult = await runCursorFigmaBuild({
            brief,
            apiKey: agentSettings.cursorApiKey || process.env.CURSOR_API_KEY,
            model: agentSettings.cursorModel || 'composer-2.5',
            cwd: path.join(__dirname, '..'),
            userDataDir: app.getPath('userData'),
            timeoutMs: 25 * 60 * 1000,
            onProgress: (p) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                try {
                  mainWindow.webContents.send('cursor-figma-build-progress', p);
                } catch {
                  // window closed mid-run
                }
              }
            },
          });
        } catch (cursorErr) {
          cursorResult = {
            ok: false,
            message: String(cursorErr?.message || cursorErr || 'Сбой Cursor build'),
          };
        }
        if (cursorResult?.ok) {
          return {
            ok: true,
            mode: 'cursor',
            message: cursorResult.message,
            summary: cursorResult.summary,
            model: cursorResult.model,
            selection,
            refs: styleRefs,
            referenceScreen: normalized,
          };
        }
        cursorFallbackNote = cursorResult?.message
          || 'Cursor Agent не смог записать в Figma — пробуем GigaChat + плагин.';
      }

      const visionResult = await buildFigmaPlanFromMobbinScreen({
        message: buildMessage,
        screen: normalized,
        agentService,
        expandApp,
        refs: styleRefs,
        selectedStyle,
      });
      if (!visionResult.ok) {
        const model = agentService.settings?.model || '';
        if (!isGigaChatVisionModel(model)) {
          return {
            ok: false,
            message: visionResult.message || GIGACHAT_VISION_HINT,
            referenceScreen: normalized,
          };
        }
        return {
          ok: false,
          message: visionResult.message || 'Vision не смог повторить референс. Выберите GigaChat-2-Max (если Pro без токенов) и попробуйте снова.',
          referenceScreen: normalized,
        };
      }

      let plan = visionResult.plan;
      const nb = service.config.settings?.nanobanana || {};
      if (nb.apiKey && service.config.settings?.agent?.figmaNanobananaImages !== false) {
        const enriched = await enrichFigmaPlanWithNanobananaImages(plan, {
          message,
          nanobananaService,
          settings: nb,
        });
        plan = enriched.plan;
      }

      if (cursorFallbackNote) {
        plan.assumptions = [
          `Cursor: ${cursorFallbackNote}`,
          ...(plan.assumptions || []),
        ];
      }

      return {
        ok: true,
        plan,
        selection,
        refs: styleRefs,
        model: visionResult.model,
        visionFallback: !!visionResult.visionFallback,
        liteMode: !!visionResult.liteMode,
        cursorFallback: !!cursorFallbackNote,
        referenceScreen: normalized,
      };
    }

    if (forceFigmaApp && !selectedScreen && mobbinLive) {
      return {
        ok: false,
        needsMobbinPick: true,
        message: 'Выберите референс из галереи Mobbin — затем агент отрисует макет в Figma по превью.',
        refs: refsResult.refs,
      };
    }

    if (forceFigmaApp || forceDeterministicLayout) {
      let plan = forceFigmaApp
        ? buildDeterministicAppPlan({ message, refs: refsResult.refs })
        : buildDeterministicLandingPlan({ message, refs: refsResult.refs });
      let critic = null;
      if (service.config.settings?.agent?.figmaCriticEnabled !== false && !forceFigmaApp) {
        const criticInput = [
          'Пользовательский запрос:',
          message,
          '',
          'План (JSON):',
          JSON.stringify(plan, null, 2),
          '',
          contextPrefix,
          '',
          refsPrefix,
        ].join('\n');
        const criticResult = await agentService.chat({
          message: criticInput,
          history: [],
          task,
          systemPrompt: FIGMA_DESIGN_CRITIC_PROMPT,
          allowFollowups: false,
        });
        if (criticResult?.ok) {
          critic = extractFigmaCritic(criticResult.content);
          if (critic?.improvedPlan?.operations?.length) {
            plan = critic.improvedPlan;
          }
        }
      }

      const nb = service.config.settings?.nanobanana || {};
      if (nb.apiKey && service.config.settings?.agent?.figmaNanobananaImages !== false) {
        const enriched = await enrichFigmaPlanWithNanobananaImages(plan, {
          message,
          nanobananaService,
          settings: nb,
        });
        plan = enriched.plan;
      }

      return {
        ok: true,
        plan,
        selection,
        critic,
        refs: refsResult.refs,
        model: forceFigmaApp ? 'figma-app-mobbin-v1' : 'deterministic-layout-v3',
      };
    }

    const chatResult = await agentService.chat({
      message: `${contextPrefix}\n\n${refsPrefix}\n\n---\nЗапрос пользователя:\n${message}`,
      history: payload?.history,
      task,
      systemPrompt: FIGMA_DESIGN_SYSTEM_PROMPT,
      allowFollowups: false,
    });

    if (!chatResult?.ok) {
      return { ok: false, message: chatResult?.message || 'Ошибка генерации плана' };
    }

    let plan = extractFigmaPlan(chatResult.content);
    if ((!plan || !plan.operations?.length) && chatResult?.content) {
      const repair = await agentService.chat({
        message: [
          'Преобразуй ответ в строгий JSON-план операций Figma.',
          'Верни только JSON в формате {"summary":"","assumptions":[],"operations":[...]} без markdown.',
          '',
          'Исходный ответ:',
          chatResult.content,
        ].join('\n'),
        history: [],
        task,
        systemPrompt: FIGMA_DESIGN_SYSTEM_PROMPT,
        allowFollowups: false,
      });
      if (repair?.ok) {
        plan = extractFigmaPlan(repair.content);
      }
    }
    if (!plan || !plan.operations?.length) {
      return {
        ok: false,
        message: 'Модель не вернула валидный JSON-план правок. Попробуйте уточнить запрос.',
      };
    }

    let critic = null;
    if (service.config.settings?.agent?.figmaCriticEnabled !== false) {
      const criticInput = [
        'Пользовательский запрос:',
        message,
        '',
        'План (JSON):',
        JSON.stringify(plan, null, 2),
        '',
        contextPrefix,
        '',
        refsPrefix,
      ].join('\n');
      const criticResult = await agentService.chat({
        message: criticInput,
        history: [],
        task,
        systemPrompt: FIGMA_DESIGN_CRITIC_PROMPT,
        allowFollowups: false,
      });
      if (criticResult?.ok) {
        critic = extractFigmaCritic(criticResult.content);
        if (critic?.improvedPlan?.operations?.length) {
          plan = critic.improvedPlan;
        }
      }
    }

    return {
      ok: true,
      plan,
      selection,
      critic,
      refs: refsResult.refs,
      model: chatResult.model || null,
    };
    } catch (err) {
      const msg = String(err?.message || err || 'Ошибка agent-figma-plan');
      if (/ENOTFOUND|EAI_AGAIN|api\.mobbin\.com/i.test(msg)) {
        return {
          ok: false,
          message: 'Mobbin API недоступен (DNS). Макет по выбранному экрану можно собрать без live-поиска — перезапустите SHKF и повторите. При блокировке сети включите VPN.',
        };
      }
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle('design-memory-list', () => {
    return { ok: true, items: designMemoryService.list() };
  });

  ipcMain.handle('design-memory-add', (_e, payload) => {
    try {
      const item = designMemoryService.add(payload || {});
      return { ok: true, item };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось добавить референс' };
    }
  });

  ipcMain.handle('design-memory-sync', async (_e, payload) => {
    try {
      return await designMemoryService.syncSeedToSupabase({
        limit: payload?.limit || 200,
      });
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось синхронизировать design memory' };
    }
  });

  ipcMain.handle('agent-figma-apply', async (_e, payload) => {
    try {
      const result = await service.applyFigmaDesignOps(payload?.operations || []);
      return {
        ok: !!result?.ok,
        applied: result?.applied || 0,
        failed: result?.failed || 0,
        errors: result?.errors || [],
      };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось применить правки в Figma' };
    }
  });

  ipcMain.handle('agent-banner-to-nanobanana', async (_e, payload) => {
    configureAgentIntegrations();
    nanobananaService.configure(service.config.settings?.nanobanana || {});

    if (!agentService.isConfigured()) {
      return {
        ok: false,
        message: 'Подключите GigaChat: Настройки → Konstancia',
      };
    }

    const nbSettings = service.config.settings?.nanobanana || {};
    if (!String(nbSettings.apiKey || '').trim()) {
      return {
        ok: false,
        message: 'Укажите API-ключ NanoBanana в настройках',
      };
    }

    let task = payload?.task || null;
    if (task?.id) {
      metaskService.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch { /* list fields only */ }
    }

    const builderMessage = buildBannerBuilderUserMessage({
      userMessage: payload?.message,
      task,
    });

    const chatResult = await agentService.chat({
      message: builderMessage,
      history: [],
      task,
      systemPrompt: BANNER_NANOBANANA_BUILDER_PROMPT,
      allowFollowups: false,
    });

    if (!chatResult.ok) {
      return { ok: false, message: chatResult.message || 'Ошибка GigaChat' };
    }

    let extracted = extractNanobananaPrompt(chatResult.content);
    if (!extracted.prompt) {
      // Часто модель забывает маркеры. Делаем один быстрый ретрай с жёсткой инструкцией.
      const retry = await agentService.chat({
        message: `${builderMessage}\n\nВАЖНО: Верни ТОЛЬКО блок <<<NB_PROMPT ... NB_PROMPT>>> без каких-либо пояснений и без других блоков.`,
        history: [],
        task,
        systemPrompt: BANNER_NANOBANANA_BUILDER_PROMPT,
        allowFollowups: false,
      });
      if (retry.ok) extracted = extractNanobananaPrompt(retry.content);
    }

    const { prompt, summary } = extracted;
    if (!prompt) {
      return {
        ok: false,
        message: 'Не удалось получить промпт в блоке NB_PROMPT. Попробуйте написать тему баннера одной фразой (например: «сделай баннер на тему образовательный кредит»).',
        rawAssistant: chatResult.content,
      };
    }

    const WHITE_BG_RULE = 'Фон должен быть строго чисто белым (#FFFFFF), без градиента, текстуры, шума и серого оттенка.';
    const promptFinal = /#ffffff|чисто бел/i.test(prompt)
      ? prompt.trim()
      : `${prompt.trim()}\n\n${WHITE_BG_RULE}`;

    const refs = Array.isArray(payload?.referenceImageUrls)
      ? payload.referenceImageUrls.filter(Boolean).slice(0, 9)
      : [];

    const summaryText = summary || chatResult.content.replace(/<<<NB_PROMPT[\s\S]*?NB_PROMPT>>>/i, '').trim();
    if (payload?.buildOnly === true) {
      return {
        ok: true,
        summary: summaryText,
        prompt: promptFinal,
        referenceImageUrls: refs,
        model: chatResult.model,
      };
    }

    const resolution = payload?.resolution || nbSettings.defaultResolution || '1K';
    const aspectRatio = payload?.aspectRatio || nbSettings.defaultAspectRatio || 'auto';
    let model = payload?.model;
    if (!model) {
      try {
        const { models } = await nanobananaService.getModels();
        model = resolveModelForResolution(
          models,
          nbSettings.defaultModel || 'nanobanan-2',
          resolution,
        );
      } catch {
        model = nbSettings.defaultModel || 'nanobanan-2';
      }
    }

    const genPayload = {
      prompt: promptFinal,
      model,
      aspectRatio,
      resolution,
      numOutputs: 1,
      referenceImageUrls: refs.length ? refs : undefined,
    };

    try {
      const result = await nanobananaService.generate(genPayload);
      const galleryItem = nanobananaGallery.add({
        generationId: result.generationId,
        prompt,
        model: genPayload.model,
        aspectRatio: genPayload.aspectRatio,
        imageUrls: result.imageUrls,
        creditsUsed: result.creditsUsed,
      });
      return {
        ok: true,
        summary: summaryText,
        prompt: promptFinal,
        imageUrls: result.imageUrls || [],
        galleryItem,
        creditsUsed: result.creditsUsed,
        model: chatResult.model,
      };
    } catch (err) {
      return {
        ok: false,
        message: err.message || 'Ошибка NanoBanana',
        prompt: promptFinal,
        summary: summaryText,
      };
    }
  });

  ipcMain.handle('agent-find-task-links', async (_e, payload) => {
    configureAgentIntegrations();
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
    const dismissedList = service.config.settings?.taskLinks?.dismissed || [];
    const dismissed = new Set(dismissedList);
    try {
      const result = await taskLinkerService.suggest(tasks, dismissed);
      return result;
    } catch (err) {
      return { ok: false, message: err.message || String(err), suggestions: [] };
    }
  });

  ipcMain.handle('agent-link-tasks', async (_e, payload) => {
    const blocked = assertMetaskUserGesture(payload, 'agent-link-tasks');
    if (blocked) return blocked;
    metaskService.configure(service.config.settings?.metask || {});
    const fromId = Number(payload?.fromId);
    const toId = Number(payload?.toId);
    const relationType = payload?.relationType || 'relates';
    if (!fromId || !toId) return { ok: false, message: 'Нужны две задачи' };
    try {
      return await metaskService.createIssueRelation(fromId, toId, relationType);
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('agent-dismiss-task-link', (_e, payload) => {
    const key = pairKey(payload?.aId, payload?.bId);
    const prev = service.config.settings?.taskLinks?.dismissed || [];
    const next = prev.includes(key) ? prev : [...prev, key];
    service.updateAppSettings({
      taskLinks: { ...(service.config.settings?.taskLinks || {}), dismissed: next },
    });
    return { ok: true, dismissed: key };
  });

  ipcMain.handle('agent-post-mockups-to-task', async (_e, payload) => {
    const blocked = assertMetaskUserGesture(payload, 'agent-post-mockups-to-task');
    if (blocked) return blocked;
    metaskService.configure(service.config.settings?.metask || {});
    const issueId = Number(payload?.issueId);
    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (!issueId) return { ok: false, message: 'Не выбрана задача Redmine' };
    if (!images.length) return { ok: false, message: 'Нет мокапов для отправки' };
    return metaskService.addIssueCommentWithImages(issueId, 'Сделал вариант баннера.', images);
  });

  ipcMain.handle('task-knowledge-stats', () => {
    configureTaskLearning();
    return { ok: true, stats: taskKnowledgeService.listLearnedSummary() };
  });

  ipcMain.handle('task-knowledge-search', async (_e, payload) => {
    configureTaskLearning();
    const chunks = await taskKnowledgeService.retrieveForAgent(String(payload?.query || ''), {
      task: payload?.task || null,
      limit: Number(payload?.limit) || 8,
    });
    return { ok: true, chunks };
  });

  ipcMain.handle('task-knowledge-reindex', async (_e, payload) => {
    configureTaskLearning();
    metaskReadOnly.configure(service.config.settings?.metask || {});
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
    const liteOnly = payload?.liteOnly !== false;
    return taskKnowledgeService.reindexAll(tasks, metaskService.userId, {
      liteOnly,
      force: true,
      onProgress: (progress) => {
        broadcast('task-knowledge-reindex-progress', progress);
      },
    });
  });

  ipcMain.handle('metask-open-attachment', async (_e, payload) => {
    const url = String(payload?.url || '').trim();
    if (!url) return { ok: false, message: 'empty-url' };
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'open-failed' };
    }
  });

  ipcMain.handle('task-knowledge-clear', () => {
    return taskKnowledgeService.clearLocal();
  });

  ipcMain.handle('task-knowledge-feedback', (_e, payload) => {
    return taskKnowledgeService.recordFeedback(payload || {});
  });

  ipcMain.handle('task-knowledge-pin', (_e, payload) => {
    return taskKnowledgeService.pinLesson(payload || {});
  });

  ipcMain.handle('task-knowledge-attachment', (_e, payload) => {
    configureTaskLearning();
    const issueId = Number(payload?.issueId);
    const attachmentId = Number(payload?.attachmentId);
    if (!issueId || !attachmentId) return { ok: false };
    const meta = taskKnowledgeService.getIssueCatalog(issueId);
    const att = (meta?.attachments || []).find((a) => Number(a.id) === attachmentId);
    if (!att?.contentUrl) return { ok: false, message: 'not-found' };
    return { ok: true, ...att, issueId, subject: meta?.subject || '' };
  });

  ipcMain.handle('task-knowledge-save-settings', (_e, patch) => {
    const config = service.updateAppSettings({
      taskLearning: {
        ...(service.config.settings?.taskLearning || {}),
        ...(patch || {}),
      },
    });
    configureTaskLearning();
    return config.settings?.taskLearning;
  });

  ipcMain.handle('knowledge-learning-stats', () => {
    configureAgentIntegrations();
    return { ok: true, stats: knowledgeIngestService.stats() };
  });

  ipcMain.handle('knowledge-learning-ingest', async () => {
    configureAgentIntegrations();
    return knowledgeIngestService.ingestAll({
      onProgress: (p) => broadcast('knowledge-learning-ingest-progress', p),
    });
  });

  ipcMain.handle('knowledge-learning-clear', () => {
    knowledgeIngestService.clearAll();
    return { ok: true };
  });

  ipcMain.handle('agent-process-insights', async (_e, payload) => {
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
    let linkerSuggestions = [];
    try {
      const linkRes = await taskLinkerService.suggest(tasks, new Set());
      linkerSuggestions = linkRes?.suggestions || [];
    } catch { /* optional */ }
    const report = processAnalyticsService.analyze({ tasks, linkerSuggestions });
    return {
      ok: true,
      report,
      markdown: processAnalyticsService.formatInsightsMarkdown(report),
    };
  });

  ipcMain.handle('agent-notify-background', async (_e, payload) => {
    const title = String(payload?.title || 'Konstancia').trim() || 'Konstancia';
    const subtitle = String(payload?.subtitle || payload?.body || '').trim().slice(0, 280);
    if (!subtitle) return { ok: false, message: 'empty-body' };
    return showPillNotification({
      title,
      subtitle,
      body: subtitle,
      meta: payload?.meta || '',
      badge: payload?.badge || 'Konstancia',
      tag: payload?.tag || '',
      imageUrl: payload?.imageUrl || payload?.thumbUrl || '',
      icon: payload?.icon || 'agent',
      durationMs: payload?.durationMs,
      action: payload?.action || { type: 'focus-agent' },
    });
  });

  ipcMain.handle('agent-test-connection', async () => {
    configureAgentIntegrations();
    return agentService.testConnection();
  });
  ipcMain.handle('agent-save-credentials', (_e, creds) => {
    const config = service.updateAppSettings({
      agent: {
        ...service.config.settings?.agent,
        ...creds,
      },
    });
    configureAgentIntegrations();
    return config.settings?.agent;
  });
  ipcMain.handle('agent-open-gigachat-docs', () => {
    shell.openExternal('https://developers.sber.ru/studio/workspaces/my-space/get/gigachat-api');
    return { ok: true };
  });

  nanobananaService.configure(service.config.settings?.nanobanana || {});

  ipcMain.handle('nanobanana-get-models', async () => {
    nanobananaService.configure(service.config.settings?.nanobanana || {});
    try {
      const { models } = await nanobananaService.getModels();
      return { ok: true, models };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('nanobanana-get-credits', async () => {
    nanobananaService.configure(service.config.settings?.nanobanana || {});
    try {
      const { credits } = await nanobananaService.getCredits();
      return { ok: true, credits };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('nanobanana-generate', async (_e, payload) => {
    nanobananaService.configure(service.config.settings?.nanobanana || {});
    try {
      const result = await nanobananaService.generate(payload || {});
      const item = nanobananaGallery.add({
        generationId: result.generationId,
        prompt: payload?.prompt,
        model: result.modelUsed || payload?.model,
        resolution: result.resolution || payload?.resolution,
        aspectRatio: payload?.aspectRatio,
        imageUrls: result.imageUrls,
        creditsUsed: result.creditsUsed,
      });
      return { ok: true, ...result, galleryItem: item };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('nanobanana-get-gallery', () => ({
    ok: true,
    items: nanobananaGallery.list(),
  }));

  ipcMain.handle('nanobanana-delete-gallery-item', (_e, id) => {
    const items = nanobananaGallery.remove(id);
    return { ok: true, items };
  });

  ipcMain.handle('nanobanana-clear-gallery', () => {
    const items = nanobananaGallery.clear();
    return { ok: true, items };
  });

  ipcMain.handle('nanobanana-save-credentials', (_e, creds) => {
    const config = service.updateAppSettings({
      nanobanana: {
        ...service.config.settings?.nanobanana,
        ...creds,
      },
    });
    nanobananaService.configure(config.settings?.nanobanana || {});
    return config.settings?.nanobanana;
  });

  ipcMain.handle('nanobanana-open-docs', () => {
    shell.openExternal('https://docs.nananobanana.com/en/api');
    return { ok: true };
  });

  ipcMain.handle('nanobanana-download-image', async (_e, payload = {}) => {
    const dataUrl = String(payload.dataUrl || '').trim();
    const rawUrl = String(payload.url || '').trim();
    if (!dataUrl.startsWith('data:image/') && !rawUrl) {
      return { ok: false, message: 'Нет изображения для сохранения' };
    }

    const saveWin = BrowserWindow.getFocusedWindow() || mainWindow;
    const defaultName = String(payload.filename || 'nanobanana.png').replace(/[<>:"/\\|?*]+/g, '_');
    const defaultPath = path.join(app.getPath('downloads'), defaultName);

    const { filePath, canceled } = await dialog.showSaveDialog(saveWin, {
      title: 'Сохранить изображение',
      defaultPath,
      filters: [
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'Все изображения', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    nanobananaService.configure(service.config.settings?.nanobanana || {});
    const nbSettings = service.config.settings?.nanobanana || {};
    const apiKey = String(nbSettings.apiKey || '').trim();
    const baseUrl = nbSettings.baseUrl || 'https://www.nananobanana.com';

    try {
      let buf;
      let ext = 'png';

      if (dataUrl.startsWith('data:image/')) {
        ({ buf, ext } = await fetchNanobananaImageBytes(dataUrl, { baseUrl }));
      } else {
        const resolved = resolveNanobananaImageUrl(rawUrl, baseUrl);
        const errors = [];
        const tryNet = async () => fetchNanobananaImageWithNet(resolved, { apiKey });
        const tryFetch = async () => fetchNanobananaImageBytes(resolved, { apiKey, baseUrl });
        const tryGeneration = async () => {
          const generationId = String(payload.generationId || '').trim();
          if (!generationId) throw new Error('no-generation');
          const record = await nanobananaService.getGeneration(generationId);
          const alt = record.outputImageUrls?.[0] || record.outputImageUrl;
          if (!alt) throw new Error('no-url-in-generation');
          return fetchNanobananaImageWithNet(alt, { apiKey });
        };

        let loaded = false;
        for (const fn of [tryNet, tryFetch, tryGeneration]) {
          try {
            const result = await fn();
            buf = result.buf;
            ext = result.ext;
            loaded = true;
            break;
          } catch (err) {
            errors.push(err?.message || String(err));
          }
        }
        if (!loaded || !buf?.length) {
          throw new Error(errors[errors.length - 1] || 'Не удалось загрузить файл');
        }
      }

      const outPath = ensureFileExtension(filePath, ext);
      writeFileSync(outPath, buf);
      if (saveWin && !saveWin.isDestroyed()) saveWin.focus();
      showPillNotification({
        title: 'NanoBanana',
        subtitle: `Сохранено: ${path.basename(outPath)}`,
        icon: 'ok',
        durationMs: 8000,
      });
      return { ok: true, path: outPath };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось сохранить изображение' };
    }
  });

  ipcMain.handle('nanobanana-resolve-image-data-url', async (_e, payload = {}) => {
    const rawUrl = String(payload.url || '').trim();
    const generationId = String(payload.generationId || '').trim();
    if (!rawUrl && !generationId) {
      return { ok: false, message: 'Нет изображения для подготовки' };
    }

    nanobananaService.configure(service.config.settings?.nanobanana || {});
    const nbSettings = service.config.settings?.nanobanana || {};
    const apiKey = String(nbSettings.apiKey || '').trim();
    const baseUrl = nbSettings.baseUrl || 'https://www.nananobanana.com';

    const toDataUrl = (buf, ext = 'png') => {
      const e = String(ext || 'png').toLowerCase();
      const mime = e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : (e === 'webp' ? 'image/webp' : 'image/png');
      return `data:${mime};base64,${buf.toString('base64')}`;
    };

    try {
      let buf = null;
      let ext = 'png';
      const errors = [];
      const tryByUrl = async () => {
        const resolved = resolveNanobananaImageUrl(rawUrl, baseUrl);
        if (!resolved) throw new Error('empty-url');
        const netRes = await fetchNanobananaImageWithNet(resolved, { apiKey });
        return netRes;
      };
      const tryByFetch = async () => {
        const resolved = resolveNanobananaImageUrl(rawUrl, baseUrl);
        if (!resolved) throw new Error('empty-url');
        return fetchNanobananaImageBytes(resolved, { apiKey, baseUrl });
      };
      const tryByGeneration = async () => {
        if (!generationId) throw new Error('no-generation');
        const record = await nanobananaService.getGeneration(generationId);
        const alt = record.outputImageUrls?.[0] || record.outputImageUrl;
        if (!alt) throw new Error('no-url-in-generation');
        return fetchNanobananaImageWithNet(alt, { apiKey });
      };

      for (const fn of [tryByUrl, tryByFetch, tryByGeneration]) {
        try {
          const res = await fn();
          buf = res.buf;
          ext = res.ext || ext;
          if (buf?.length) break;
        } catch (err) {
          errors.push(err?.message || String(err));
        }
      }
      if (!buf?.length) {
        throw new Error(errors[errors.length - 1] || 'Не удалось загрузить изображение');
      }
      return { ok: true, dataUrl: toDataUrl(buf, ext) };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось подготовить изображение' };
    }
  });

  ipcMain.handle('nanobanana-pick-reference-images', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Референсные изображения',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    const refs = [];
    for (const filePath of filePaths.slice(0, 9)) {
      try {
        const buf = readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        refs.push(`data:image/${mime};base64,${buf.toString('base64')}`);
      } catch { /* skip */ }
    }
    return { ok: true, referenceImageUrls: refs };
  });

  ipcMain.handle('agent-pick-image', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Изображения для агента',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    const images = [];
    for (const filePath of filePaths.slice(0, 4)) {
      try {
        const buf = readFileSync(filePath);
        if (buf.length > 15 * 1024 * 1024) continue;
        const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        images.push({
          dataUrl: `data:image/${mime};base64,${buf.toString('base64')}`,
          filename: path.basename(filePath),
        });
      } catch {
        /* skip unreadable file */
      }
    }
    if (!images.length) return { ok: false, message: 'Не удалось прочитать выбранные файлы' };
    return { ok: true, images, image: images[0] || null };
  });

  ipcMain.handle('notes-get-library', () => service.getNotesLibrary());
  ipcMain.handle('notes-save-bookmark', (_e, data) => service.saveBookmark(data));
  ipcMain.handle('notes-delete-bookmark', (_e, id) => service.deleteBookmark(id));
  ipcMain.handle('notes-save-note', (_e, data) => service.saveNote(data));
  ipcMain.handle('notes-delete-note', (_e, id) => service.deleteNote(id));
  ipcMain.handle('notes-open-url', (_e, url) => {
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('update-app-settings', (_e, updates) => {
    const config = service.updateAppSettings(updates);
    pushCloudSettingsFromConfig();
    return config;
  });
  ipcMain.handle('reset-app-settings', () => {
    const config = service.resetAppSettings();
    pushCloudSettingsFromConfig();
    return config;
  });
  ipcMain.handle('reset-onboarding', () => {
    const config = { ...service.config, onboardingCompleted: false };
    service.saveConfig(config);
    return service.config;
  });
  ipcMain.handle('resize-window', (_e, { width, height }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSize(width, height);
      mainWindow.center();
    }
  });
  ipcMain.handle('export-config', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт config',
      defaultPath: 'SHKF-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    writeFileSync(filePath, JSON.stringify(service.config, null, 2), 'utf-8');
    return { ok: true, path: filePath };
  });
  ipcMain.handle('import-config', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Импорт config',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.[0]) return { ok: false };
    try {
      const raw = readFileSync(filePaths[0], 'utf-8');
      service.saveConfig(JSON.parse(raw));
      return { ok: true, config: service.config };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('custom-theme-save', (_e, theme) => service.saveCustomTheme(theme));
  ipcMain.handle('custom-theme-delete', (_e, themeId) => service.deleteCustomTheme(themeId));
  ipcMain.handle('custom-theme-media-url', (_e, { themeId, filename }) =>
    service.getCustomThemeMediaUrl(themeId, filename)
  );
  ipcMain.handle('custom-theme-pick-media', async (_e, { themeId, role }) => {
    const filters = role === 'poster'
      ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      : [{ name: 'Media', extensions: ['mp4', 'webm', 'mov', 'png', 'jpg', 'jpeg', 'gif', 'webp'] }];
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: role === 'poster' ? 'Постер для видео' : 'Картинка или видео для сайдбара',
      filters,
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.[0]) return { ok: false };
    try {
      const result = service.copyCustomThemeMedia(themeId, filePaths[0], role || 'sidebar');
      return { ok: true, ...result, config: service.config };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('magnific-status', () => {
    const status = magnificMcpService.getStatus();
    return { ok: true, ...status };
  });

  ipcMain.handle('magnific-connect', async (_e, payload) => {
    try {
      const forceLogin = Boolean(payload?.forceLogin);
      if (forceLogin) magnificMcpService.clearSession();
      await magnificMcpService.connect({ forceLogin });
      return { ok: true, ...magnificMcpService.getStatus() };
    } catch (err) {
      const status = magnificMcpService.getStatus();
      return { ok: false, message: err.message || String(err), ...status };
    }
  });

  ipcMain.handle('magnific-disconnect', () => {
    magnificMcpService.clearSession();
    return { ok: true, ...magnificMcpService.getStatus() };
  });

  ipcMain.handle('magnific-get-tools', async () => {
    try {
      const tools = await magnificMcpService.getTools();
      return { ok: true, tools: tools.tools };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('magnific-call-tool', async (_e, payload) => {
    try {
      const result = await magnificMcpService.callTool(payload.name, payload.arguments);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('magnific-pick-reference-images', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Референсы для Magnific',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    const images = [];
    for (const filePath of filePaths.slice(0, 8)) {
      try {
        const buf = readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        images.push({
          name: path.basename(filePath),
          dataUrl: `data:image/${mime};base64,${buf.toString('base64')}`,
        });
      } catch {
        /* skip unreadable files */
      }
    }
    return { ok: true, images };
  });
});

app.on('window-all-closed', (e) => e.preventDefault());

app.on('before-quit', () => {
  app.isQuitting = true;
  stopAllLive2dStaticServers();
  service.shutdown();
});
