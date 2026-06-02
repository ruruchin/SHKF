import { createServer } from 'http';
import { WebSocketServer } from 'ws';

export class PluginBridge {
  constructor(port = 3847) {
    this.port = port;
    this.httpServer = null;
    this.wss = null;
    this.client = null;
    this.connected = false;
    this.onChange = null;
    this.onPortChange = null;
    this.onUserTemplateExport = null;
    this._starting = null;
    this._templateWaiters = new Map();
  }

  start() {
    if (this.wss) return Promise.resolve(this.port);
    if (this._starting) return this._starting;
    this._starting = this._bind();
    return this._starting;
  }

  async _bind() {
    const base = this.port;
    let lastError = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const port = base + attempt;
      try {
        await this._listenOn(port);
        this.port = port;
        if (attempt > 0) this.onPortChange?.(port);
        return port;
      } catch (err) {
        lastError = err;
        if (err.code !== 'EADDRINUSE') throw err;
      }
    }

    throw lastError || new Error(`Порты ${base}–${base + 9} заняты`);
  }

  _listenOn(port) {
    return new Promise((resolve, reject) => {
      const server = createServer();
      const wss = new WebSocketServer({ server });

      const onError = (err) => {
        server.close();
        wss.close();
        reject(err);
      };

      server.once('error', onError);
      wss.once('error', onError);

      wss.on('connection', (ws) => {
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'register' && msg.client === 'figma-plugin') {
              this.client = ws;
              this.setConnected(true);
              return;
            }
            if (msg.type === 'template-result' && msg.requestId) {
              const waiter = this._templateWaiters.get(msg.requestId);
              if (waiter) {
                clearTimeout(waiter.timer);
                this._templateWaiters.delete(msg.requestId);
                if (msg.ok) waiter.resolve(msg);
                else waiter.reject(new Error(msg.error || 'Ошибка вставки шаблона'));
              }
              return;
            }
            if (msg.type === 'user-template-export') {
              this.onUserTemplateExport?.(msg);
              return;
            }
          } catch {
            /* ignore */
          }
        });

        ws.on('close', () => {
          if (this.client === ws) {
            this.client = null;
            this.setConnected(false);
          }
        });
      });

      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError);
        wss.removeListener('error', onError);
        server.on('error', (err) => {
          console.error('[plugin-bridge]', err.message);
        });
        this.httpServer = server;
        this.wss = wss;
        resolve();
      });
    });
  }

  setConnected(value) {
    if (this.connected === value) return;
    this.connected = value;
    this.onChange?.(value);
  }

  sendAction(action) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    this.client.send(JSON.stringify({ type: 'action', action }));
    return { ok: true, mode: 'plugin' };
  }

  sendTemplate(templateId) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = templateId + '-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут — перезапустите плагин Figma (Plugins → Development → FIRURU Bridge)'));
      }, 15000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({ type: 'insert-template', templateId, requestId }));
    });
  }

  sendInsertUserTemplate(item) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = item.id + '-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут вставки компонента'));
      }, 15000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({
        type: 'insert-user-template',
        requestId,
        template: {
          id: item.id,
          name: item.name,
          nodeId: item.figma?.nodeId,
          componentKey: item.figma?.componentKey,
        },
      }));
    });
  }

  sendApplyBannerMockup(payload) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = 'banner-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут вставки баннера'));
      }, 30000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({
        type: 'apply-banner-mockup',
        requestId,
        payload,
      }));
    });
  }

  sendReadBannerTexts(payload) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = 'banner-read-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут чтения текста из Figma'));
      }, 15000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({
        type: 'read-banner-texts',
        requestId,
        payload,
      }));
    });
  }

  sendReadSelectionBrief(payload = {}) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = 'figma-read-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут чтения контекста Figma'));
      }, 15000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({
        type: 'read-selection-brief',
        requestId,
        payload,
      }));
    });
  }

  sendApplyDesignOps(payload = {}) {
    if (!this.client || this.client.readyState !== 1) {
      throw new Error('Плагин Figma не подключён');
    }
    const requestId = 'figma-apply-' + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._templateWaiters.delete(requestId);
        reject(new Error('Таймаут применения правок Figma'));
      }, 30000);
      this._templateWaiters.set(requestId, { resolve, reject, timer });
      this.client.send(JSON.stringify({
        type: 'apply-design-ops',
        requestId,
        payload,
      }));
    });
  }

  sendConfig(hotkeys) {
    if (this.client?.readyState === 1) {
      this.client.send(JSON.stringify({ type: 'config', hotkeys }));
    }
  }

  stop() {
    this.client?.close();
    this.client = null;
    this.wss?.close();
    this.wss = null;
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.connected = false;
    this._starting = null;
  }
}
