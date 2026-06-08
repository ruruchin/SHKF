import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const DEFAULT_DATA = {
  version: 1,
  events: [],
};

function newId() {
  return `cal-${randomBytes(6).toString('hex')}`;
}

export class AgentCalendarStore {
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
        events: Array.isArray(raw.events) ? raw.events : [],
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  save() {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  list({ from = null, to = null } = {}) {
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() : null;
    return this.data.events
      .slice()
      .filter((event) => {
        const start = new Date(event.startAt).getTime();
        if (fromTs != null && start < fromTs) return false;
        if (toTs != null && start > toTs) return false;
        return true;
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }

  upsert(payload = {}) {
    const now = new Date().toISOString();
    const id = payload.id || newId();
    const item = {
      id,
      title: String(payload.title || '').trim() || 'Без названия',
      body: String(payload.body || '').trim(),
      startAt: payload.startAt || now,
      endAt: payload.endAt || payload.startAt || now,
      allDay: payload.allDay === true,
      source: payload.source || 'manual',
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    const idx = this.data.events.findIndex((e) => e.id === id);
    if (idx >= 0) this.data.events[idx] = { ...this.data.events[idx], ...item };
    else this.data.events.push(item);
    this.save();
    return item;
  }

  delete(id) {
    this.data.events = this.data.events.filter((e) => e.id !== id);
    this.save();
    return { ok: true };
  }
}
