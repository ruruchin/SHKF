import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARD_WIDTH = 392;
const CARD_MARGIN = 16;
const CARD_TOP = 16;
const CARD_MIN_HEIGHT = 120;
const CARD_MAX_HEIGHT = 560;

const BADGE_BY_ICON = {
  kanban: 'Канбан',
  agent: 'Konstancia',
  redmine: 'Redmine',
  spark: 'SHKF',
  ok: 'SHKF',
  error: 'SHKF',
};

export class PillNotifyService {
  /**
   * @param {{ getMainWindow?: () => import('electron').BrowserWindow | null, onAction?: (action: object) => void }} opts
   */
  constructor(opts = {}) {
    this.getMainWindow = opts.getMainWindow || (() => null);
    this.onInApp = opts.onInApp || null;
    this.onAction = opts.onAction || (() => {});
    this.win = null;
    this.ready = false;
    this.pending = [];
  }

  _displayBounds() {
    const display = screen.getPrimaryDisplay();
    const { workArea } = display;
    const x = Math.round(workArea.x + workArea.width - CARD_WIDTH - CARD_MARGIN);
    const y = Math.round(workArea.y + CARD_TOP);
    return { x, y, width: CARD_WIDTH };
  }

  ensureWindow() {
    if (this.win && !this.win.isDestroyed()) return this.win;

    const { x, y, width } = this._displayBounds();

    this.win = new BrowserWindow({
      width,
      height: CARD_MIN_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      show: false,
      hasShadow: false,
      thickFrame: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'app', 'pill-notify-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    this.win.loadFile(path.join(__dirname, '..', 'app', 'renderer', 'pill-notify.html'));

    this.win.webContents.on('did-finish-load', () => {
      this.ready = true;
      const queue = this.pending.splice(0);
      for (const item of queue) this._pushToWindow(item);
    });

    this.win.on('closed', () => {
      this.win = null;
      this.ready = false;
    });

    return this.win;
  }

  _pushToWindow(payload) {
    const win = this.ensureWindow();
    if (!this.ready) {
      this.pending.push(payload);
      return;
    }
    if (!win.isVisible()) win.showInactive();
    win.webContents.send('pill-notify-push', payload);
  }

  resize(height) {
    if (!this.win || this.win.isDestroyed()) return;
    const { x, y, width } = this._displayBounds();
    const h = Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, Number(height) || CARD_MIN_HEIGHT));
    this.win.setBounds({ x, y, width, height: h });
    if (!this.win.isVisible()) this.win.showInactive();
  }

  hideIfEmpty() {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.hide();
  }

  _normalizePayload(payload = {}) {
    const title = String(payload.title || 'SHKF').trim() || 'SHKF';
    const subtitle = String(payload.subtitle || payload.body || '').trim();
    const body = String(payload.body || subtitle).trim();
    const meta = String(payload.meta || payload.date || '').trim();
    const icon = String(payload.icon || 'spark').trim() || 'spark';
    const badge = String(payload.badge || BADGE_BY_ICON[icon] || '').trim();
    const tag = String(payload.tag || '').trim();
    const imageUrl = String(payload.imageUrl || payload.thumbUrl || '').trim();

    return {
      id: payload.id || randomUUID(),
      title,
      subtitle: body || subtitle,
      body: body || subtitle,
      meta,
      badge,
      tag,
      tags: Array.isArray(payload.tags) ? payload.tags : undefined,
      imageUrl,
      thumbUrl: imageUrl,
      icon,
      durationMs: payload.durationMs ?? 12000,
      action: payload.action || null,
    };
  }

  isAppHidden() {
    const main = this.getMainWindow?.();
    return !main || main.isDestroyed() || !main.isVisible() || main.isMinimized();
  }

  /**
   * @param {{ title?: string, subtitle?: string, body?: string, meta?: string, badge?: string, tag?: string, tags?: Array, imageUrl?: string, thumbUrl?: string, icon?: string, durationMs?: number, action?: object, forceOverlay?: boolean }} payload
   */
  show(payload = {}) {
    const item = this._normalizePayload(payload);
    if (!item.body && !item.subtitle && !payload.allowEmptySubtitle) {
      return { ok: false, message: 'empty-subtitle' };
    }

    const useOverlay = payload.forceOverlay === true || this.isAppHidden();
    if (useOverlay) {
      this._pushToWindow(item);
    } else if (typeof this.onInApp === 'function') {
      this.onInApp(item);
    } else {
      this._pushToWindow(item);
    }
    return { ok: true, id: item.id, overlay: useOverlay };
  }

  bindIpc(ipcMain) {
    ipcMain.on('pill-notify-resize', (_e, height) => {
      this.resize(height);
    });

    ipcMain.on('pill-notify-hide', () => {
      this.hideIfEmpty();
    });

    ipcMain.on('pill-notify-click', (_e, action) => {
      if (!action || typeof action !== 'object') return;
      this.hideIfEmpty();
      this.onAction(action);
    });

    ipcMain.handle('pill-notify-show', (_e, payload) => this.show(payload));
  }
}
