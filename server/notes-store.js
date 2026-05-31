import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const DEFAULT_DATA = {
  version: 1,
  bookmarks: [],
  notes: [],
};

function newId(prefix) {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}

export class NotesStore {
  constructor(filePath) {
    this.filePath = filePath;
    mkdirSync(filePath.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
    this.data = this.load();
  }

  load() {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_DATA);
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      return {
        version: raw.version || 1,
        bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [],
        notes: Array.isArray(raw.notes) ? raw.notes : [],
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  save() {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getAll() {
    return {
      bookmarks: this.data.bookmarks.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      notes: this.data.notes.slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }),
    };
  }

  upsertBookmark(payload) {
    const now = new Date().toISOString();
    const id = payload.id || newId('bm');
    const item = {
      id,
      title: String(payload.title || '').trim() || 'Без названия',
      url: String(payload.url || '').trim(),
      tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    const idx = this.data.bookmarks.findIndex((b) => b.id === id);
    if (idx >= 0) this.data.bookmarks[idx] = { ...this.data.bookmarks[idx], ...item };
    else this.data.bookmarks.push(item);
    this.save();
    return item;
  }

  deleteBookmark(id) {
    this.data.bookmarks = this.data.bookmarks.filter((b) => b.id !== id);
    this.save();
    return { ok: true };
  }

  upsertNote(payload) {
    const now = new Date().toISOString();
    const id = payload.id || newId('note');
    const item = {
      id,
      title: String(payload.title || '').trim() || 'Без названия',
      contentHtml: String(payload.contentHtml || ''),
      tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
      pinned: !!payload.pinned,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    const idx = this.data.notes.findIndex((n) => n.id === id);
    if (idx >= 0) this.data.notes[idx] = { ...this.data.notes[idx], ...item };
    else this.data.notes.push(item);
    this.save();
    return item;
  }

  deleteNote(id) {
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this.save();
    return { ok: true };
  }
}
