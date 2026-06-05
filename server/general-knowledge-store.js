import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const STORE_VERSION = 1;
const DEFAULT_MAX_CHUNKS = 50000;

function emptyStore() {
  return {
    version: STORE_VERSION,
    sources: {},
    chunks: [],
    lastIngestAt: null,
  };
}

export class GeneralKnowledgeStore {
  constructor(userDataPath, { maxChunks = DEFAULT_MAX_CHUNKS } = {}) {
    this.dir = path.join(userDataPath, 'general-knowledge');
    this.storePath = path.join(this.dir, 'store.json');
    this.maxChunks = Math.max(500, Number(maxChunks) || DEFAULT_MAX_CHUNKS);
    this.data = emptyStore();
    this.load();
  }

  load() {
    try {
      if (!existsSync(this.storePath)) {
        this.data = emptyStore();
        return;
      }
      const parsed = JSON.parse(readFileSync(this.storePath, 'utf8'));
      this.data = {
        ...emptyStore(),
        ...parsed,
        sources: parsed?.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
        chunks: Array.isArray(parsed?.chunks) ? parsed.chunks : [],
      };
    } catch {
      this.data = emptyStore();
    }
  }

  save() {
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {
      /* ignore disk errors */
    }
  }

  setSourceMeta(sourceId, meta) {
    this.data.sources[String(sourceId)] = { ...meta, sourceId: String(sourceId) };
  }

  removeChunksForSource(sourceId) {
    const id = String(sourceId);
    this.data.chunks = this.data.chunks.filter((c) => c.sourceId !== id);
  }

  addChunks(newChunks) {
    for (const chunk of newChunks) this.data.chunks.push(chunk);
    if (this.data.chunks.length > this.maxChunks) {
      this.data.chunks = this.data.chunks.slice(-this.maxChunks);
    }
  }

  listChunks() {
    return this.data.chunks.slice();
  }

  stats() {
    const byCategory = {};
    for (const c of this.data.chunks) {
      const cat = c.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    return {
      chunks: this.data.chunks.length,
      sources: Object.keys(this.data.sources).length,
      lastIngestAt: this.data.lastIngestAt,
      byCategory,
    };
  }

  clearAll() {
    this.data = emptyStore();
    this.save();
  }
}
