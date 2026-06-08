import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import { GlobalKeyboardListener } from 'node-global-key-listener';
import { combosEqual, keysFromEvent } from '../shared/keys.js';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../shared/templates.js';
import { FigmaCDP } from './figma-cdp.js';
import { launchFigmaWithDebug } from './figma-launcher.js';
import { PluginBridge } from './plugin-bridge.js';
import { copyTemplateToClipboard, copyUserTemplateToClipboard } from './template-clipboard.js';
import { UserLibrary } from './user-library.js';
import { CustomThemeStore } from './custom-theme-store.js';
import { NotesStore } from './notes-store.js';
import { normalizeConfig, patchSettings, DEFAULT_APP_SETTINGS, prepareSettingsForDisk } from '../shared/app-settings.js';
import { normalizeCustomTheme, isCustomThemeId } from '../shared/custom-themes.js';
import { mergeBannerMockupConfig, buildPresetsWithTemplates } from '../shared/banner-mockups.js';

const MODIFIER_ALIASES = {
  'LEFT CTRL': ['LEFT CTRL', 'RIGHT CTRL'],
  'RIGHT CTRL': ['LEFT CTRL', 'RIGHT CTRL'],
  'LEFT ALT': ['LEFT ALT', 'RIGHT ALT'],
  'RIGHT ALT': ['LEFT ALT', 'RIGHT ALT'],
  'LEFT SHIFT': ['LEFT SHIFT', 'RIGHT SHIFT'],
  'RIGHT SHIFT': ['LEFT SHIFT', 'RIGHT SHIFT'],
};

function keysMatch(required, down) {
  for (const key of required) {
    const aliases = MODIFIER_ALIASES[key] || [key];
    if (!aliases.some((alias) => down[alias])) return false;
  }
  const needsCtrl = required.some((k) => k.includes('CTRL'));
  const needsAlt = required.some((k) => k.includes('ALT'));
  const needsShift = required.some((k) => k.includes('SHIFT'));
  const ctrlDown = down['LEFT CTRL'] || down['RIGHT CTRL'];
  const altDown = down['LEFT ALT'] || down['RIGHT ALT'];
  const shiftDown = down['LEFT SHIFT'] || down['RIGHT SHIFT'];
  if (needsCtrl !== !!ctrlDown) return false;
  if (needsAlt !== !!altDown) return false;
  if (needsShift !== !!shiftDown) return false;
  return true;
}

export class HotkeyService extends EventEmitter {
  constructor(configPath, userLibraryPaths, customThemeAssetsDir, notesLibraryPath) {
    super();
    this.configPath = configPath;
    this.userLibrary = new UserLibrary(userLibraryPaths.libraryPath, userLibraryPaths.assetsDir);
    this.customThemes = new CustomThemeStore(customThemeAssetsDir);
    this.notesStore = new NotesStore(notesLibraryPath);
    this.config = this.loadConfig();
    this.listener = null;
    this.running = false;
    this.recording = false;
    this.recordCallback = null;
    this._listenerFn = null;
    this.figma = new FigmaCDP(this.config.figmaCdpPort || 9222);
    this.cdpReady = false;
    this.pluginBridge = new PluginBridge(this.config.port || 3847);
    this.pluginConnected = false;

    this._bindPluginBridgeHandlers = () => {
      this.pluginBridge.onChange = (connected) => {
        this.pluginConnected = connected;
        if (connected) {
          this.pluginBridge.sendConfig(this.config.hotkeys || []);
          this.emit('log', 'Плагин Figma подключён — хоткеи готовы');
        } else {
          this.emit('log', 'Плагин Figma отключён');
        }
        this.emit('status', this.getStatus());
      };
      this.pluginBridge.onPortChange = (p) => {
        this.config = { ...this.config, port: p };
        if (this.config.settings?.connection) this.config.settings.connection.pluginPort = p;
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        this.emit('log', `Порт плагина: ${p}`);
        this.emit('status', this.getStatus());
      };
      this.pluginBridge.onUserTemplateExport = (payload) => {
        this.importUserTemplateFromFigma(payload).catch((err) => {
          this.emit('log', 'Библиотека: ' + err.message);
        });
      };
    };
    this._bindPluginBridgeHandlers();

    this.figma.startPolling(async (cdpUp) => {
      const wasReady = this.cdpReady;
      if (cdpUp) {
        this.cdpReady = await this.figma.hasFigmaApi();
      } else {
        this.cdpReady = false;
      }
      if (wasReady !== this.cdpReady) {
        this.emit('status', this.getStatus());
        if (this.cdpReady) {
          this.emit('log', 'Figma CDP готов — API доступен');
        }
      }
    });
  }

  loadConfig() {
    const raw = readFileSync(this.configPath, 'utf-8');
    return normalizeConfig(JSON.parse(raw));
  }

  getAppSettings() {
    return this.config.settings || DEFAULT_APP_SETTINGS;
  }

  updateAppSettings(updates) {
    const prevPort = this.config.port;
    const config = patchSettings(this.config, updates);
    this.saveConfig(config);

    if (config.port !== prevPort && this.running) {
      this.restartPluginBridge(config.port);
    }

    if (updates.hotkeys?.serverEnabled === false && this.running) {
      this.stop();
    } else if (updates.hotkeys?.serverEnabled === true && !this.running) {
      this.start();
    }

    return this.config;
  }

  restartPluginBridge(port) {
    this.pluginBridge.stop();
    this.pluginConnected = false;
    this.pluginBridge = new PluginBridge(port);
    this._bindPluginBridgeHandlers();
    this.pluginBridge.start().catch((err) => {
      this.emit('log', 'Мост плагина: ' + err.message);
    });
    this.emit('log', `Порт плагина изменён на ${port} — переподключите плагин в Figma`);
    this.emit('status', this.getStatus());
  }

  resetAppSettings() {
    const config = {
      ...this.config,
      settings: JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS)),
    };
    config.port = config.settings.connection.pluginPort;
    config.figmaCdpPort = config.settings.connection.cdpPort;
    this.saveConfig(normalizeConfig(config));
    return this.config;
  }

  saveConfig(config) {
    this.config = normalizeConfig(config);
    const diskConfig = {
      ...this.config,
      settings: prepareSettingsForDisk(this.config.settings),
    };
    writeFileSync(this.configPath, JSON.stringify(diskConfig, null, 2), 'utf-8');
    if (this.figma.port !== (config.figmaCdpPort || 9222)) {
      this.figma.disconnect();
      this.figma = new FigmaCDP(config.figmaCdpPort || 9222);
      this.cdpReady = false;
      this.figma.startPolling(async (cdpUp) => {
        this.cdpReady = cdpUp ? await this.figma.hasFigmaApi() : false;
        this.emit('status', this.getStatus());
      });
    }
    this.pluginBridge.sendConfig(config.hotkeys || []);
    this.emit('config-changed', config);
    if (this.running) this.reloadListener();
  }

  getStatus() {
    const figmaConnected = this.pluginConnected || this.cdpReady;
    return {
      running: this.running,
      figmaConnected,
      pluginConnected: this.pluginConnected,
      cdpReady: this.cdpReady,
      figmaCdpPort: this.config.figmaCdpPort || 9222,
      pluginPort: this.config.port || 3847,
      hotkeyCount: this.config.hotkeys?.length || 0,
      recording: this.recording,
    };
  }

  async connectFigma() {
    const port = this.config.figmaCdpPort || 9222;
    try {
      const result = await launchFigmaWithDebug(port);
      await new Promise((r) => setTimeout(r, 2000));
      const cdpUp = await this.figma.checkConnection();
      this.cdpReady = cdpUp ? await this.figma.hasFigmaApi() : false;
      this.emit('status', this.getStatus());

      let message = result.message;
      if (this.pluginConnected) {
        message += ' · Плагин подключён — можно работать';
      } else if (this.cdpReady) {
        message += ' · CDP API готов';
      } else if (cdpUp) {
        message += ' · Откройте плагин «SHKF Bridge» в Figma и нажмите «Подключиться»';
      } else {
        message += ' · Запустите плагин в Figma (Plugins → Development → SHKF Bridge)';
      }

      this.emit('log', message);
      return { ...result, connected: this.getStatus().figmaConnected, message };
    } catch (err) {
      this.cdpReady = false;
      this.emit('status', this.getStatus());
      throw err;
    }
  }

  start() {
    if (this.running) return;
    this.pluginBridge.start().catch((err) => {
      this.emit('log', 'Мост плагина: ' + err.message);
    });
    this._startListener();
    this.running = true;
    this.figma.checkConnection().then(async (ok) => {
      this.cdpReady = ok ? await this.figma.hasFigmaApi() : false;
      this.emit('status', this.getStatus());
    });
    this.emit('status', this.getStatus());
    this.emit('log', 'Сервер хоткеев запущен (порт плагина: ' + (this.config.port || 3847) + ')');
  }

  stop() {
    if (!this.running) return;
    this.stopRecording();
    if (this._listenerFn && this.listener) {
      this.listener.removeListener(this._listenerFn);
    }
    if (this.listener) {
      this.listener.kill();
      this.listener = null;
    }
    this.pluginBridge.stop();
    this.pluginConnected = false;
    this.running = false;
    this.emit('status', this.getStatus());
    this.emit('log', 'Сервер остановлен');
  }

  reloadListener() {
    if (!this.running) return;
    if (this._listenerFn && this.listener) {
      this.listener.removeListener(this._listenerFn);
    }
    this._startListener();
    this.pluginBridge.sendConfig(this.config.hotkeys || []);
    this.emit('log', 'Хоткеи перезагружены');
  }

  _shouldLogFooter() {
    return this.getAppSettings().hotkeys?.logToFooter !== false;
  }

  _notifyAction(action) {
    if (this.getAppSettings().hotkeys?.notifyOnAction !== false) {
      this.emit('action-fired', action);
    }
  }

  _logFooter(msg) {
    if (this._shouldLogFooter()) this.emit('log', msg);
  }

  async _sendAction(action) {
    if (this.pluginConnected) {
      try {
        this.pluginBridge.sendAction(action);
        this._notifyAction(action);
        this._logFooter(`Выполнено (плагин): ${action}`);
        return true;
      } catch (err) {
        this._logFooter('Ошибка плагина: ' + err.message);
      }
    }

    if (this.cdpReady) {
      try {
        const result = await this.figma.runAction(action);
        this._notifyAction(action);
        this._logFooter(`Выполнено (${result.mode}): ${action}`);
        return true;
      } catch (err) {
        this._logFooter('CDP: ' + err.message);
      }
    }

    if (!this.pluginConnected && !this.cdpReady) {
      this._logFooter('Figma не подключена — откройте плагин «SHKF Bridge» в Figma');
      this.emit('action-failed', { action, reason: 'not-connected' });
      return false;
    }

    this.emit('action-failed', { action, reason: 'failed' });
    return false;
  }

  _startListener() {
    if (!this.listener) {
      this.listener = new GlobalKeyboardListener();
    }
    const sorted = [...(this.config.hotkeys || [])].sort(
      (a, b) => b.keys.length - a.keys.length
    );

    this._listenerFn = (event, down) => {
      if (event.state !== 'DOWN') return;

      if (this.recording && this.recordCallback) {
        const combo = keysFromEvent(down, event.name);
        const hasMainKey = combo.some(
          (k) =>
            !k.includes('CTRL') &&
            !k.includes('ALT') &&
            !k.includes('SHIFT') &&
            !k.includes('META')
        );
        if (hasMainKey) {
          const cb = this.recordCallback;
          this.stopRecording();
          cb(combo);
        }
        return;
      }

      for (const hk of sorted) {
        const triggerKey = hk.keys[hk.keys.length - 1];
        if (event.name !== triggerKey) continue;
        const modifiers = hk.keys.slice(0, -1);
        if (!keysMatch(modifiers, down)) continue;
        this._logFooter(hk.name);
        this._sendAction(hk.action);
        return;
      }
    };

    try {
      const attach = this.listener.addListener(this._listenerFn);
      if (attach && typeof attach.catch === 'function') {
        attach.catch((err) => {
          this.emit('log', 'Глобальные хоткеи недоступны: ' + err.message);
        });
      }
    } catch (err) {
      this.emit('log', 'Глобальные хоткеи недоступны: ' + err.message);
    }
  }

  startRecording(callback) {
    this.recording = true;
    this.recordCallback = callback;
    this.emit('status', this.getStatus());
    this.emit('log', 'Запись хоткея — нажмите комбинацию...');
  }

  stopRecording() {
    this.recording = false;
    this.recordCallback = null;
    this.emit('status', this.getStatus());
  }

  testAction(action) {
    return this._sendAction(action);
  }

  async copyTemplate(templateId) {
    try {
      let result;
      if (String(templateId).startsWith('user-')) {
        result = copyUserTemplateToClipboard(this.userLibrary, templateId);
        if (this.pluginConnected) {
          try {
            const item = this.userLibrary.getItem(templateId);
            const inserted = await this.pluginBridge.sendInsertUserTemplate(item);
            if (inserted?.ok) {
              this.emit('log', `«${result.name}» вставлен в Figma через плагин`);
              return { ok: true, name: result.name, mode: 'plugin' };
            }
          } catch {
            /* fallback to clipboard */
          }
        }
      } else {
        result = copyTemplateToClipboard(templateId);
      }
      this.emit('log', `«${result.name}» скопирован — Ctrl+V в Figma`);
      return result;
    } catch (err) {
      this.emit('log', 'Буфер: ' + err.message);
      return { ok: false, message: err.message };
    }
  }

  getTemplatesCatalog() {
    const builtIn = TEMPLATES.map((t) => ({ ...t, user: false, source: 'builtin' }));
    const userItems = this.userLibrary.listPublic();
    const userCategories = this.userLibrary.getCategories();
    const categories = [...new Set([...TEMPLATE_CATEGORIES, ...userCategories])];
    return {
      templates: [...userItems, ...builtIn],
      categories,
      builtInCount: builtIn.length,
      userCount: userItems.length,
      userCategories,
    };
  }

  async importUserTemplateFromFigma(payload) {
    if (!payload?.svg || !payload?.thumbnail) {
      throw new Error('Неполные данные от Figma');
    }
    const item = await this.userLibrary.addFromFigma(payload);
    this.emit('log', `«${item.name}» добавлен в вашу библиотеку`);
    this.emit('library-updated', { action: 'add', item: this.userLibrary.toPublicItem(item) });
    return item;
  }

  updateUserTemplate(id, patch) {
    const item = this.userLibrary.updateItem(id, patch);
    this.emit('library-updated', { action: 'update', item: this.userLibrary.toPublicItem(item) });
    return this.userLibrary.toPublicItem(item);
  }

  deleteUserTemplate(id) {
    this.userLibrary.deleteItem(id);
    this.emit('log', 'Компонент удалён из библиотеки');
    this.emit('library-updated', { action: 'delete', id });
    return { ok: true };
  }

  getUserTemplateThumb(templateId, { withoutImg = false, strict = false } = {}) {
    if (withoutImg) {
      const noImgPath = this.userLibrary.getThumbNoImgPath(templateId);
      if (noImgPath && existsSync(noImgPath)) {
        const buf = readFileSync(noImgPath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
      if (strict) return null;
    }
    const p = this.userLibrary.getThumbPath(templateId);
    if (!p || !existsSync(p)) return null;
    const buf = readFileSync(p);
    return `data:image/png;base64,${buf.toString('base64')}`;
  }

  getCustomThemes() {
    return this.config.settings?.appearance?.customThemes || [];
  }

  getCustomTheme(themeId) {
    return this.getCustomThemes().find((t) => t.id === themeId) || null;
  }

  saveCustomTheme(rawTheme) {
    const theme = normalizeCustomTheme(rawTheme);
    theme.updatedAt = new Date().toISOString();
    const list = this.getCustomThemes();
    const idx = list.findIndex((t) => t.id === theme.id);
    const next = idx >= 0 ? list.map((t, i) => (i === idx ? theme : t)) : [...list, theme];
    return this.updateAppSettings({ appearance: { customThemes: next } });
  }

  deleteCustomTheme(themeId) {
    if (!isCustomThemeId(themeId)) return this.config;
    this.customThemes.deleteTheme(themeId);
    const next = this.getCustomThemes().filter((t) => t.id !== themeId);
    const config = this.updateAppSettings({ appearance: { customThemes: next } });
    if (this.config.theme === themeId) {
      const fallback = { ...this.config, theme: 'mobbin' };
      this.saveConfig(fallback);
    }
    return this.config;
  }

  copyCustomThemeMedia(themeId, sourcePath, role) {
    const result = this.customThemes.copyMedia(themeId, sourcePath, role);
    const theme = this.getCustomTheme(themeId) || normalizeCustomTheme({ id: themeId });
    if (role === 'poster') {
      theme.media.posterFile = result.filename;
    } else {
      theme.media.sidebarFile = result.filename;
      theme.media.sidebarType = result.type === 'video' ? 'video' : 'image';
    }
    this.saveCustomTheme(theme);
    return {
      filename: result.filename,
      sidebarType: theme.media.sidebarType,
      url: this.customThemes.mediaUrl(themeId, result.filename),
    };
  }

  getCustomThemeMediaUrl(themeId, filename) {
    return this.customThemes.mediaUrl(themeId, filename);
  }

  getNotesLibrary() {
    return this.notesStore.getAll();
  }

  saveBookmark(data) {
    const item = this.notesStore.upsertBookmark(data);
    this.emit('notes-updated', this.notesStore.getAll());
    return item;
  }

  deleteBookmark(id) {
    const result = this.notesStore.deleteBookmark(id);
    this.emit('notes-updated', this.notesStore.getAll());
    return result;
  }

  saveNote(data) {
    const item = this.notesStore.upsertNote(data);
    this.emit('notes-updated', this.notesStore.getAll());
    return item;
  }

  deleteNote(id) {
    const result = this.notesStore.deleteNote(id);
    this.emit('notes-updated', this.notesStore.getAll());
    return result;
  }

  loadBannerMockupsConfig() {
    const configPath = join(dirname(this.userLibrary.libraryPath), 'banner-mockups.json');
    if (!existsSync(configPath)) return mergeBannerMockupConfig(null);
    try {
      return mergeBannerMockupConfig(JSON.parse(readFileSync(configPath, 'utf-8')));
    } catch {
      return mergeBannerMockupConfig(null);
    }
  }

  getBannerMockupPresets() {
    const config = this.loadBannerMockupsConfig();
    const libraryItems = this.userLibrary.listPublic();
    return {
      ok: true,
      slotNames: config.slotNames,
      presets: buildPresetsWithTemplates(config, libraryItems),
    };
  }

  async applyBannerMockup({ templateId, imageUrl, texts }) {
    const item = this.userLibrary.getItem(templateId);
    if (!item) throw new Error('Шаблон баннера не найден в библиотеке');
    if (!this.pluginConnected) {
      throw new Error('Плагин Figma не подключён — откройте SHKF Bridge в файле SHKF banners');
    }
    await this.pluginBridge.sendApplyBannerMockup({
      template: {
        id: item.id,
        name: item.name,
        nodeId: item.figma?.nodeId,
        componentKey: item.figma?.componentKey,
      },
      imageUrl: String(imageUrl || '').trim(),
      texts: {
        title: texts?.title || '',
        subtitle: texts?.subtitle || '',
        cta: texts?.cta || '',
      },
    });
    this.emit('log', `Баннер «${item.name}» вставлен в Figma с картинкой`);
    return { ok: true, name: item.name };
  }

  async readBannerTextsFromFigma(templateId) {
    const item = this.userLibrary.getItem(templateId);
    if (!item?.figma?.nodeId) throw new Error('Шаблон баннера не найден');
    if (!this.pluginConnected) {
      throw new Error('Плагин Figma не подключён — откройте SHKF Bridge в файле SHKF banners');
    }
    const result = await this.pluginBridge.sendReadBannerTexts({
      nodeId: item.figma.nodeId,
    });
    const data = result?.data || {};
    if (data.bannerSlots && item.bannerSlots !== data.bannerSlots) {
      item.bannerSlots = data.bannerSlots;
      item.updatedAt = new Date().toISOString();
      this.userLibrary.save();
    }
    return {
      ok: true,
      texts: {
        title: data.title || '',
        subtitle: data.subtitle || '',
        cta: data.cta || '',
      },
      layers: data.layers || {},
      bannerSlots: data.bannerSlots || item.bannerSlots || null,
    };
  }

  async readFigmaSelectionBrief({ optional = false } = {}) {
    if (!this.pluginConnected) {
      if (optional) {
        return { ok: true, selection: null, pluginConnected: false };
      }
      throw new Error('Плагин Figma не подключён — откройте SHKF Bridge в нужном файле Figma');
    }
    const result = await this.pluginBridge.sendReadSelectionBrief({});
    return {
      ok: true,
      selection: result?.data || null,
      pluginConnected: true,
    };
  }

  async applyFigmaDesignOps(operations = []) {
    if (!this.pluginConnected) {
      throw new Error('Плагин Figma не подключён — откройте SHKF Bridge в нужном файле Figma');
    }
    const safeOps = Array.isArray(operations) ? operations.slice(0, 220) : [];
    const result = await this.pluginBridge.sendApplyDesignOps({
      operations: safeOps,
    });
    return {
      ok: !!result?.ok,
      applied: Number(result?.data?.applied || 0),
      failed: Number(result?.data?.failed || 0),
      errors: Array.isArray(result?.data?.errors) ? result.data.errors : [],
    };
  }

  shutdown() {
    this.stop();
    this.figma.disconnect();
  }
}
