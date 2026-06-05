import WebSocket from 'ws';
import { randomBytes } from 'crypto';
import {
  clearPortraitCache,
  findNewestPortrait,
  isLikelyPortrait,
  readPortraitCache,
  resolvePortraitFromDisk,
  writePortraitCache,
} from './vtube-model-portrait.js';

const PLUGIN_NAME = 'Konstancia';
const PLUGIN_DEVELOPER = 'SHKF';

function requestId() {
  return randomBytes(8).toString('hex');
}

export class VTubeStudioService {
  constructor() {
    this.settings = {};
    this.userDataPath = '';
    this.ws = null;
    this.authenticated = false;
    this.connecting = null;
    this.pending = new Map();
    this.lastEmotion = 'neutral';
    this.lastError = '';
    this.modelName = '';
    this.apiActive = false;
    this.connectPhase = 'idle';
  }

  configure(settings = {}, options = {}) {
    this.settings = { ...settings };
    if (options.userDataPath) this.userDataPath = options.userDataPath;
  }

  getStatus() {
    return {
      enabled: this.settings.enabled === true,
      connected: this.ws?.readyState === WebSocket.OPEN,
      authenticated: this.authenticated,
      apiActive: this.apiActive,
      port: Number(this.settings.port) || 8001,
      modelName: this.modelName || '',
      lastEmotion: this.lastEmotion,
      lastError: this.lastError || '',
      hasToken: Boolean(this.settings.authToken?.trim()),
      phase: this.connectPhase,
    };
  }

  async ensureConnected() {
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      return {
        authenticated: true,
        modelName: this.modelName,
        authToken: this.settings.authToken || '',
      };
    }
    if (this.connecting) return this.connecting;
    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async _openSocket(port) {
    const hosts = ['127.0.0.1', 'localhost'];
    let lastErr = null;

    for (const host of hosts) {
      const url = `ws://${host}:${port}`;
      try {
        await new Promise((resolve, reject) => {
          const ws = new WebSocket(url);
          const timer = setTimeout(() => {
            try { ws.terminate(); } catch { /* */ }
            reject(new Error(`Таймаут подключения к ${url}`));
          }, 8000);

          ws.once('open', () => {
            clearTimeout(timer);
            this.ws = ws;
            ws.on('message', (raw) => this._onMessage(raw));
            ws.on('close', () => {
              this.authenticated = false;
              if (this.ws === ws) this.ws = null;
            });
            ws.on('error', () => { /* handled on first error */ });
            resolve();
          });

          ws.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });
        return url;
      } catch (err) {
        lastErr = err;
      }
    }

    throw new Error(
      `VTube Studio недоступен на порту ${port}. ${lastErr?.message || 'Запустите VTS и включите «Start API (allow plugins)».'}`,
    );
  }

  async connect() {
    this.connectPhase = 'socket';
    this.lastError = '';

    const port = Number(this.settings.port) || 8001;

    if (this.ws) {
      try { this.ws.close(); } catch { /* */ }
      this.ws = null;
    }
    this.authenticated = false;
    this.apiActive = false;

    try {
      await this._openSocket(port);

      this.connectPhase = 'api-state';
      const stateRes = await this._send('APIStateRequest', {}, 6000);
      this.apiActive = stateRes?.data?.active === true;
      if (!this.apiActive) {
        throw new Error(
          'API VTube Studio выключен. В VTS: главный экран → «Allow Plugin API access» (Разрешить доступ плагинам).',
        );
      }

      this.connectPhase = 'auth';
      const auth = await this._authenticate();
      this.connectPhase = 'ready';
      return auth;
    } catch (err) {
      this.connectPhase = 'error';
      this.lastError = err?.message || String(err);
      this.disconnect();
      throw err;
    }
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const id = msg?.requestID;
    if (!id || !this.pending.has(id)) return;
    const { resolve, reject } = this.pending.get(id);
    this.pending.delete(id);
    if (msg.messageType === 'APIError') {
      const err = new Error(msg?.data?.message || `VTube Studio API error ${msg?.data?.errorID || ''}`);
      err.errorID = msg?.data?.errorID;
      reject(err);
      return;
    }
    resolve(msg);
  }

  _send(messageType, data = {}, timeoutMs = 8000) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('VTube Studio не подключён'));
    }
    const requestID = requestId();
    const payload = {
      apiName: 'VTubeStudioPublicAPI',
      apiVersion: '1.0',
      requestID,
      messageType,
      data,
    };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestID);
        const hint = messageType === 'AuthenticationTokenRequest'
          ? 'Подтвердите доступ во всплывающем окне VTube Studio (Allow).'
          : '';
        reject(new Error(`Таймаут ${messageType}. ${hint}`.trim()));
      }, timeoutMs);
      this.pending.set(requestID, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      ws.send(JSON.stringify(payload));
    });
  }

  async _authenticate() {
    const pluginName = String(this.settings.pluginName || PLUGIN_NAME).trim() || PLUGIN_NAME;
    const pluginDeveloper = String(this.settings.pluginDeveloper || PLUGIN_DEVELOPER).trim() || PLUGIN_DEVELOPER;
    let token = String(this.settings.authToken || '').trim();

    const tryAuth = async (authToken) => {
      const authRes = await this._send('AuthenticationRequest', {
        pluginName,
        pluginDeveloper,
        authenticationToken: authToken,
      }, 15000);
      if (!authRes?.data?.authenticated) {
        throw new Error(authRes?.data?.reason || 'VTube Studio отклонил токен');
      }
      return authToken;
    };

    if (token) {
      try {
        token = await tryAuth(token);
      } catch (err) {
        if (err?.errorID === 50 || err?.errorID === 51 || /token|auth/i.test(err?.message || '')) {
          token = '';
          this.settings.authToken = '';
        } else {
          throw err;
        }
      }
    }

    if (!token) {
      this.connectPhase = 'auth-wait';
      let tokenRes;
      try {
        tokenRes = await this._send('AuthenticationTokenRequest', {
          pluginName,
          pluginDeveloper,
        }, 180000);
      } catch (err) {
        if (err?.errorID === 51 || /currently ongoing/i.test(err?.message || '')) {
          throw new Error(
            'В VTube Studio уже открыто окно Allow. Найдите его (Alt+Tab), нажмите Allow или Deny, затем «Подключить VTS» ещё раз.',
          );
        }
        throw err;
      }
      token = String(tokenRes?.data?.authenticationToken || '').trim();
      if (!token) throw new Error('VTube Studio не выдал токен');
      this.settings.authToken = token;
      token = await tryAuth(token);
    }

    this.authenticated = true;
    this.lastError = '';
    try {
      const modelRes = await this._send('CurrentModelRequest', {});
      this.modelName = String(modelRes?.data?.modelName || '').trim();
    } catch {
      this.modelName = '';
    }
    return {
      authenticated: true,
      authToken: this.settings.authToken || '',
      modelName: this.modelName,
    };
  }

  async listHotkeys() {
    await this.ensureConnected();
    const res = await this._send('HotkeysInCurrentModelRequest', {});
    const list = res?.data?.availableHotkeys;
    if (!Array.isArray(list)) return [];
    return list.map((h) => ({
      id: h.hotkeyID,
      name: h.name || '',
      type: h.type || '',
      file: h.file || '',
    }));
  }

  async resolveHotkeyRef(ref) {
    const raw = String(ref || '').trim();
    if (!raw) return '';
    if (/^[0-9a-f-]{36}$/i.test(raw)) return raw;
    const hotkeys = await this.listHotkeys();
    const needle = raw.toLowerCase();
    const hit = hotkeys.find((h) => (
      String(h.name || '').toLowerCase() === needle
      || String(h.file || '').toLowerCase() === needle
    ));
    return hit?.id || raw;
  }

  async triggerHotkey(hotkeyRef) {
    const id = await this.resolveHotkeyRef(hotkeyRef);
    if (!id) return { ok: false, skipped: true };
    await this.ensureConnected();
    await this._send('HotkeyTriggerRequest', { hotkeyID: id });
    return { ok: true, hotkeyID: id };
  }

  async getModelPortrait({ refresh = false } = {}) {
    const userDataPath = this.userDataPath;
    const manualPath = String(this.settings.modelPortraitPath || '').trim();
    const cached = userDataPath ? readPortraitCache(userDataPath) : null;

    let modelName = String(this.settings.cachedModelName || cached?.modelName || '').trim();
    let vtsModelName = '';
    let iconName = '';

    if (this.authenticated || refresh) {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const modelRes = await this._send('CurrentModelRequest', {});
          const data = modelRes?.data || {};
          if (data.modelLoaded) {
            modelName = String(data.modelName || modelName).trim();
            vtsModelName = String(data.vtsModelName || '').trim();
            iconName = String(data.vtsModelIconName || '').trim();
            this.modelName = modelName;
          }
        }
      } catch {
        /* disk/cache fallback */
      }
    }

    const extraRoots = Array.isArray(this.settings.modelSearchRoots)
      ? this.settings.modelSearchRoots
      : [];

    let disk = resolvePortraitFromDisk({
      modelName,
      vtsModelName,
      iconName,
      manualPath,
      extraRoots,
    });

    if (!disk?.dataUrl) {
      disk = findNewestPortrait(extraRoots);
    }

    if (disk?.dataUrl && isLikelyPortrait(disk.filePath)) {
      const payload = {
        ok: true,
        dataUrl: disk.dataUrl,
        modelName: disk.modelName || modelName,
        source: disk.source,
        filePath: disk.filePath || '',
        cached: false,
      };
      if (userDataPath) {
        writePortraitCache(userDataPath, {
          ...payload,
          cached: true,
          updatedAt: new Date().toISOString(),
        });
      }
      return payload;
    }

    if (cached?.dataUrl && (!cached.filePath || isLikelyPortrait(cached.filePath))) {
      return {
        ok: true,
        dataUrl: cached.dataUrl,
        modelName: cached.modelName || modelName,
        source: 'cache',
        filePath: cached.filePath || '',
        cached: true,
      };
    }

    if (userDataPath && cached && !isLikelyPortrait(cached.filePath)) {
      clearPortraitCache(userDataPath);
    }

    return {
      ok: false,
      message: 'Портрет модели не найден. Один раз подключите VTS или укажите путь к PNG в настройках.',
    };
  }

  async setEmotion(emotion) {
    const key = String(emotion || 'neutral').trim().toLowerCase();
    const map = this.settings.emotions || {};
    const hotkeyID = String(map[key] || '').trim();
    this.lastEmotion = key;

    if (!this.settings.enabled) {
      return { ok: true, skipped: true, reason: 'disabled' };
    }
    if (!hotkeyID) {
      if (key === 'neutral') return { ok: true, skipped: true, reason: 'neutral' };
      return { ok: true, skipped: true, reason: 'no_hotkey', emotion: key };
    }

    try {
      await this.triggerHotkey(hotkeyID);
      this.lastError = '';
      return { ok: true, emotion: key, hotkeyID };
    } catch (err) {
      this.lastError = err?.message || String(err);
      if (err?.errorID === 50 || err?.errorID === 51) {
        this.settings.authToken = '';
        this.authenticated = false;
      }
      return { ok: false, message: this.lastError, emotion: key };
    }
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* */ }
      this.ws = null;
    }
    this.authenticated = false;
    if (this.connectPhase !== 'error') this.connectPhase = 'idle';
  }
}

export const vtubeStudioService = new VTubeStudioService();
