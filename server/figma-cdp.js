import WebSocket from 'ws';
import { getActionEvalScript, KEYBOARD_ACTIONS } from '../shared/figma-actions-script.js';
import { sendKeysToFigma, focusFigmaWindow } from './figma-launcher.js';

export class FigmaCDP {
  constructor(port = 9222) {
    this.port = port;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
    this.target = null;
    this.connected = false;
    this._checkTimer = null;
    this._figmaTarget = null;
  }

  async checkConnection() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      const targets = await res.json();
      const figmaPage = targets.find(
        (t) =>
          t.type === 'page' &&
          t.url &&
          (t.url.includes('figma.com/design') ||
            t.url.includes('figma.com/file') ||
            t.url.includes('figma.com/board') ||
            t.url.includes('figma.com/proto'))
      );
      if (!figmaPage) {
        this.connected = false;
        this.target = null;
        this._figmaTarget = null;
        return false;
      }
      this.target = figmaPage;
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      this.target = null;
      this._figmaTarget = null;
      return false;
    }
  }

  async hasFigmaApi() {
    if (!this.connected && !(await this.checkConnection())) return false;
    this._figmaTarget = await this._findFigmaContext();
    return !!this._figmaTarget;
  }

  startPolling(onChange, intervalMs = 3000) {
    this.stopPolling();
    const tick = async () => {
      const was = this.connected;
      await this.checkConnection();
      if (was !== this.connected) onChange(this.connected);
    };
    tick();
    this._checkTimer = setInterval(tick, intervalMs);
  }

  stopPolling() {
    if (this._checkTimer) clearInterval(this._checkTimer);
    this._checkTimer = null;
  }

  async _connectWs(url) {
    if (this.ws?.readyState === WebSocket.OPEN && this._wsUrl === url) return;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const wsUrl = url || this.target?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('CDP target not found');

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('CDP timeout'));
      }, 8000);

      ws.on('open', () => {
        clearTimeout(timer);
        this.ws = ws;
        this._wsUrl = wsUrl;
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          const p = this.pending.get(msg.id);
          if (!p) return;
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message));
          else if (msg.result?.exceptionDetails) {
            const ex = msg.result.exceptionDetails;
            p.reject(new Error(ex.exception?.description || ex.text || 'CDP error'));
          } else p.resolve(msg.result);
        });
        ws.on('close', () => {
          if (this.ws === ws) {
            this.ws = null;
            this._wsUrl = null;
          }
        });
        resolve();
      });
      ws.on('error', () => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket failed'));
      });
    });
  }

  async _send(method, params = {}, wsUrl) {
    await this._connectWs(wsUrl);
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP command timeout'));
      }, 20000);
      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async _findFigmaContext(prefetchedTargets) {
    const targets =
      prefetchedTargets ||
      (await fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json()));
    const candidates = targets.filter((t) => t.webSocketDebuggerUrl);

    for (const t of candidates) {
      try {
        const result = await this._send(
          'Runtime.evaluate',
          { expression: 'typeof figma !== "undefined"', returnByValue: true },
          t.webSocketDebuggerUrl
        );
        if (result?.result?.value === true) return t;
      } catch {
        /* try next target */
      }
    }
    return null;
  }

  async runAction(action) {
    if (KEYBOARD_ACTIONS[action]) {
      await focusFigmaWindow();
      await sendKeysToFigma(KEYBOARD_ACTIONS[action]);
      return { ok: true, mode: 'keyboard' };
    }

    if (!this._figmaTarget) {
      this._figmaTarget = await this._findFigmaContext();
    }

    if (this._figmaTarget) {
      const script = getActionEvalScript(action);
      await this._send(
        'Runtime.evaluate',
        { expression: script, awaitPromise: true, returnByValue: true },
        this._figmaTarget.webSocketDebuggerUrl
      );
      return { ok: true, mode: 'cdp-direct' };
    }

    if (this.target) {
      const script = getActionEvalScript(action);
      try {
        await this._send('Runtime.evaluate', {
          expression: script,
          awaitPromise: true,
          returnByValue: true,
        });
        return { ok: true, mode: 'cdp-page' };
      } catch {
        /* fall through */
      }
    }

    throw new Error(
      'Откройте файл в Figma и нажмите «Запустить Figma» — приложение подключится напрямую через CDP.'
    );
  }

  async findMakeTarget() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/list`, {
        signal: AbortSignal.timeout(3000),
      });
      const targets = await res.json();
      return targets.find(
        (t) => t.type === 'page' && t.url && t.url.includes('figma.com/make') && t.webSocketDebuggerUrl
      );
    } catch {
      return null;
    }
  }

  async submitMakePrompt(maxAttempts = 8) {
    for (let i = 0; i < maxAttempts; i++) {
      const target = await this.findMakeTarget();
      if (target) {
        try {
          const result = await this._send(
            'Runtime.evaluate',
            {
              expression: `(function() {
                const buttons = [...document.querySelectorAll('button')];
                const submit = buttons.find((b) => {
                  if (b.disabled) return false;
                  const t = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
                  return /submit|create|generate|make it|go|отправ|созда|генер/i.test(t);
                });
                if (submit) { submit.click(); return 'clicked'; }
                const input = document.querySelector('textarea, [contenteditable="true"]');
                if (input) {
                  input.focus();
                  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                  return 'enter';
                }
                return 'not-found';
              })()`,
              returnByValue: true,
            },
            target.webSocketDebuggerUrl
          );
          const val = result?.result?.value;
          if (val === 'clicked' || val === 'enter') {
            return { ok: true, mode: val };
          }
        } catch {
          /* retry */
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    try {
      await focusFigmaWindow();
      await sendKeysToFigma(['ENTER']);
      return { ok: true, mode: 'keyboard-enter' };
    } catch {
      return { ok: false, reason: 'no-make-page' };
    }
  }

  disconnect() {
    this.stopPolling();
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this._figmaTarget = null;
  }
}
