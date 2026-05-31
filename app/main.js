import { app, BrowserWindow, BrowserView, ipcMain, Tray, Menu, nativeImage, shell, dialog, session, Notification } from 'electron';
import electronUpdater from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { HotkeyService } from '../server/hotkey-service.js';
import { AuthService } from '../server/auth-service.js';
import { CloudSettingsService } from '../server/cloud-settings-service.js';
import { MetaskService } from '../server/metask-service.js';
import { ZimbraService } from '../server/zimbra-service.js';
import { AgentService } from '../server/agent-service.js';
import { TaskLinkerService } from '../server/task-linker-service.js';
import { pairKey } from '../shared/task-linker.js';
import {
  getLaborDisplayEntries,
  filterLaborEntriesByQuery,
  isLaborCostQuery,
} from '../shared/labor-costs.js';
import { buildMorningBrief } from '../shared/morning-brief.js';
import { buildSystemPromptForRole } from '../shared/agent-prompts.js';
import { sendMakePrompt } from '../server/figma-make.js';
import {
  recognizeSpeechOnce,
  cancelSpeechRecognition,
  isSpeechRecognitionSupported,
  listInstalledSpeechLanguages,
} from '../server/speech-input.js';
import { ACTIONS, checkConflict, formatKeys, generateId, ACTION_META } from '../shared/keys.js';
import { patchSettings } from '../shared/app-settings.js';
import { getConfigPath, getPluginPath, getUserLibraryPaths, getCustomThemeAssetsDir, getNotesLibraryPath, getNanobananaGalleryPath } from './paths.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = getConfigPath(__dirname);
const pluginPath = getPluginPath(__dirname);
const userLibraryPaths = getUserLibraryPaths(__dirname);
const customThemeAssetsDir = getCustomThemeAssetsDir(__dirname);
const notesLibraryPath = getNotesLibraryPath(__dirname);
const nanobananaGalleryPath = getNanobananaGalleryPath(__dirname);

app.setPath('userData', path.join(app.getPath('appData'), 'FIRURU'));
if (process.platform === 'win32') {
  app.setAppUserModelId('com.firuru.app');
}
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('enable-speech-input');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
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
const taskLinkerService = new TaskLinkerService(agentService);
const nanobananaService = new NanobananaService();
const nanobananaGallery = createNanobananaGalleryStore(nanobananaGalleryPath);
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
      partition: 'persist:metask',
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

async function clearMetaskSession() {
  const ses = session.fromPartition('persist:metask');
  await ses.clearStorageData();
  await ses.clearCache();
  metaskBoardLoaded = false;
  metaskPendingLogin = false;
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
  if (!profile?.role) return service.config;
  const currentRole = service.config.settings?.user?.role;
  if (currentRole === profile.role) return service.config;
  return service.updateAppSettings({
    user: {
      role: profile.role,
      roleSelectedAt: new Date().toISOString(),
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || '',
    },
  });
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

function showMetaskUpdateNotifications(updates) {
  const enabled = service.config.settings?.metask?.notifyOnUpdate !== false;
  if (!enabled || !updates?.length || !Notification.isSupported()) return;

  for (const task of updates) {
    const notification = new Notification({
      title: `Канбан · задача #${task.id}`,
      body: task.subject || 'Задача обновлена',
    });
    notification.on('click', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      }
      broadcast('metask-open-task', { id: task.id, url: task.url });
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
  agentService.configure(c.settings?.agent || {});
  nanobananaService.configure(c.settings?.nanobanana || {});
});
service.on('library-updated', (data) => broadcast('library-updated', data));
service.on('notes-updated', (data) => broadcast('notes-updated', data));

const DEFAULT_WIDTH = 1180;
const DEFAULT_HEIGHT = 720;

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
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4T2NkYGD4z0AEYBxVSFUBAPF/BQpWvXkMAAAAAElFTkSuQmCC'
  );
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
  const ws = service.config.settings?.window || {};
  if (ws.showSplash !== false) createSplash();
  createWindow();
  createTray();
  setupAutoUpdater();
  startUpdaterPolling();
  scheduleMetaskPolling();
  zimbraService.configure(service.config.settings?.zimbra || {});
  agentService.configure(service.config.settings?.agent || {});

  const metaskSession = session.fromPartition('persist:metask');
  metaskSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(true));

  const zimbraSession = session.fromPartition('persist:zimbra');
  zimbraSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(true));

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone') {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone') {
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
        applyAuthProfileToConfig(result.profile);
        await pullCloudSettingsIntoConfig();
      }
      return { ...result, config: service.config };
    } catch (err) {
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
      const result = await authService.signIn(payload?.email || '', payload?.password || '');
      if (result.ok && result.profile) {
        applyAuthProfileToConfig(result.profile);
        await pullCloudSettingsIntoConfig();
        await pushCloudSettingsFromConfig();
        broadcast('auth-changed', { profile: result.profile, user: result.user });
        broadcast('config', service.config);
      }
      return { ...result, config: service.config };
    } catch (err) {
      return { ok: false, message: err?.message || 'Ошибка входа', config: service.config };
    }
  });
  ipcMain.handle('auth-logout', async () => {
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
  ipcMain.handle('updater-check-now', () => checkForUpdates());
  ipcMain.handle('updater-install-now', () => {
    if (!app.isPackaged) return { ok: false, message: 'Доступно только в установленной сборке' };
    autoUpdater.quitAndInstall(false, true);
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
    metaskService.configure(service.config.settings?.metask || {});
    return metaskService.addIssueComment(payload?.issueId, payload?.notes);
  });
  ipcMain.handle('metask-add-labor-log', async (_e, payload) => {
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
      const brief = buildMorningBrief({
        tasks: result.tasks || [],
        updates: result.updates || [],
        userName: result.user || metaskService.userName || '',
      });
      return { ok: true, brief, tasks: result.tasks || [] };
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
    const ses = session.fromPartition('persist:zimbra');
    await ses.clearStorageData();
    await ses.clearCache();
    return { ok: true };
  });
  ipcMain.handle('mail-save-credentials', (_e, creds) => {
    const prev = service.config.settings?.zimbra || {};
    const config = service.updateAppSettings({
      zimbra: {
        ...prev,
        ...creds,
        password: creds?.password ? creds.password : (prev.password || ''),
      },
    });
    zimbraService.configure(config.settings?.zimbra || {});
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
  ipcMain.handle('agent-send-message', async (_e, payload) => {
    agentService.configure(service.config.settings?.agent || {});
    let task = payload?.task || null;
    if (task?.id) {
      metaskService.configure(service.config.settings?.metask || {});
      try {
        const full = await metaskService.fetchIssueForAgent(task.id);
        if (full) task = { ...task, ...full };
      } catch { /* list fields only */ }
    }
    const role = payload?.role || service.config.settings?.user?.role || null;
    const chatResult = await agentService.chat({
      message: payload?.message,
      history: payload?.history,
      task,
      systemPrompt: buildSystemPromptForRole(role),
      allowFollowups: payload?.allowFollowups === true,
      images: payload?.images,
    });

    let laborEntries = null;
    if (task?.id && isLaborCostQuery(payload?.message)) {
      const all = getLaborDisplayEntries(task);
      laborEntries = filterLaborEntriesByQuery(all, payload?.message || '');
    }

    return { ...chatResult, laborEntries };
  });

  ipcMain.handle('agent-banner-to-nanobanana', async (_e, payload) => {
    agentService.configure(service.config.settings?.agent || {});
    nanobananaService.configure(service.config.settings?.nanobanana || {});

    if (!agentService.isConfigured()) {
      return {
        ok: false,
        message: 'Подключите GigaChat: Настройки → ИИ Агент',
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
    agentService.configure(service.config.settings?.agent || {});
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
    metaskService.configure(service.config.settings?.metask || {});
    const issueId = Number(payload?.issueId);
    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (!issueId) return { ok: false, message: 'Не выбрана задача Redmine' };
    if (!images.length) return { ok: false, message: 'Нет мокапов для отправки' };
    return metaskService.addIssueCommentWithImages(issueId, 'Сделал вариант баннера.', images);
  });

  ipcMain.handle('agent-notify-background', async (_e, payload) => {
    const title = String(payload?.title || 'ИИ Агент').trim() || 'ИИ Агент';
    const body = String(payload?.body || '').trim().slice(0, 280);
    if (!body) return { ok: false, message: 'empty-body' };
    try {
      if (Notification.isSupported()) {
        const note = new Notification({
          title,
          body,
          silent: false,
        });
        note.show();
        return { ok: true };
      }
      return { ok: false, message: 'notifications-not-supported' };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('agent-test-connection', async () => {
    agentService.configure(service.config.settings?.agent || {});
    return agentService.testConnection();
  });
  ipcMain.handle('agent-save-credentials', (_e, creds) => {
    const config = service.updateAppSettings({
      agent: {
        ...service.config.settings?.agent,
        ...creds,
      },
    });
    agentService.configure(config.settings?.agent || {});
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
      try {
        if (Notification.isSupported()) {
          new Notification({ title: 'NanoBanana', body: `Сохранено: ${path.basename(outPath)}` }).show();
        }
      } catch { /* ignore */ }
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
      title: 'Изображение для агента',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
    try {
      const filePath = filePaths[0];
      const buf = readFileSync(filePath);
      if (buf.length > 15 * 1024 * 1024) {
        return { ok: false, message: 'Изображение больше 15 МБ' };
      }
      const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const name = path.basename(filePath);
      return {
        ok: true,
        image: {
          dataUrl: `data:image/${mime};base64,${buf.toString('base64')}`,
          filename: name,
        },
      };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось прочитать файл' };
    }
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
      defaultPath: 'firuru-config.json',
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
});

app.on('window-all-closed', (e) => e.preventDefault());

app.on('before-quit', () => {
  app.isQuitting = true;
  service.shutdown();
});
