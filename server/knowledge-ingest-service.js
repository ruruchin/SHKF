import { createHash, randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  chunkText,
  cleanText,
  extractTextFromHtml,
  makeQuestionFromChunk,
} from '../shared/knowledge-text-utils.js';
import { GeneralKnowledgeStore } from './general-knowledge-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'config', 'konstancia-knowledge-sources.json');
const ML_DATA = path.join(ROOT, 'ml', 'data');

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function contentHash(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

export class KnowledgeIngestService {
  constructor(userDataPath, deps = {}) {
    this.store = new GeneralKnowledgeStore(userDataPath, {
      maxChunks: deps.maxChunks,
    });
    this.agentService = deps.agentService || null;
    this.settings = {
      enabled: true,
      autoIngestOnStart: false,
      chunkSize: 900,
      maxChunksPerSource: 40,
    };
  }

  configure(settings = {}) {
    this.settings = { ...this.settings, ...settings };
  }

  loadSourcesConfig() {
    if (!existsSync(SOURCES_PATH)) return { sources: [] };
    return JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
  }

  async fetchUrl(url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SHKF-Konstancia-KnowledgeBot/1.0 (+https://github.com/ruruchin/SHKF)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    return extractTextFromHtml(html);
  }

  async embedChunks(chunks) {
    if (!this.agentService?.embed || !chunks.length) return;
    const texts = chunks.map((c) => c.text);
    const vecs = await this.agentService.embed(texts);
    if (!Array.isArray(vecs)) return;
    for (let i = 0; i < chunks.length; i++) {
      if (Array.isArray(vecs[i])) chunks[i].embedding = vecs[i];
    }
  }

  buildChunksFromSource(source, text) {
    const pieces = chunkText(text, { chunkSize: this.settings.chunkSize });
    const limit = Math.max(1, Number(this.settings.maxChunksPerSource) || 40);
    return pieces.slice(0, limit).map((piece, idx) => ({
      id: randomUUID(),
      sourceId: source.id,
      title: source.title,
      url: source.url,
      category: source.category || 'other',
      tags: Array.isArray(source.tags) ? source.tags : [],
      chunkIndex: idx,
      text: piece,
      hash: contentHash(piece),
      ingestedAt: new Date().toISOString(),
    }));
  }

  async ingestSource(source) {
    if (!source?.url || !source?.id) {
      return { ok: false, message: 'invalid source' };
    }
    const text = await this.fetchUrl(source.url);
    if (!text || text.length < 120) {
      return { ok: false, message: 'empty or too short page', sourceId: source.id };
    }
    const chunks = this.buildChunksFromSource(source, text);
    this.store.removeChunksForSource(source.id);
    await this.embedChunks(chunks);
    this.store.addChunks(chunks);
    this.store.setSourceMeta(source.id, {
      title: source.title,
      url: source.url,
      category: source.category,
      tags: source.tags || [],
      chunks: chunks.length,
      textLength: text.length,
      ingestedAt: new Date().toISOString(),
    });
    return { ok: true, sourceId: source.id, chunks: chunks.length, textLength: text.length };
  }

  async ingestAll({ sourceIds = null, onProgress = null } = {}) {
    const cfg = this.loadSourcesConfig();
    let list = Array.isArray(cfg.sources) ? cfg.sources : [];
    if (Array.isArray(sourceIds) && sourceIds.length) {
      const set = new Set(sourceIds.map(String));
      list = list.filter((s) => set.has(String(s.id)));
    }
    const results = [];
    for (let i = 0; i < list.length; i++) {
      const source = list[i];
      onProgress?.({ phase: 'ingest', index: i + 1, total: list.length, sourceId: source.id, title: source.title });
      try {
        const r = await this.ingestSource(source);
        results.push(r);
      } catch (err) {
        results.push({ ok: false, sourceId: source.id, message: err?.message || String(err) });
      }
      await new Promise((res) => setTimeout(res, 800));
    }
    this.store.data.lastIngestAt = new Date().toISOString();
    this.store.save();
    const exportResult = this.exportTrainingArtifacts();
    return {
      ok: true,
      ingested: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
      export: exportResult,
      stats: this.store.stats(),
    };
  }

  exportTrainingArtifacts() {
    mkdirSync(ML_DATA, { recursive: true });
    const chunks = this.store.listChunks();
    const chunkPath = path.join(ML_DATA, 'konstancia-knowledge-chunks.jsonl');
    const retrievalPath = path.join(ML_DATA, 'konstancia-knowledge-retrieval.jsonl');
    const qaPath = path.join(ML_DATA, 'konstancia-knowledge-qa.jsonl');

    const chunkLines = chunks.map((c) => JSON.stringify({
      sourceId: c.sourceId,
      title: c.title,
      url: c.url,
      category: c.category,
      tags: c.tags,
      text: c.text,
    }));
    writeFileSync(chunkPath, chunkLines.join('\n') + (chunkLines.length ? '\n' : ''), 'utf8');

    const retrievalRows = [];
    const qaRows = [];
    const system = 'Ты — Konstancia, умный ассистент в desktop-приложении SHKF. Отвечай точно, со ссылкой на факты из источников.';
    for (const c of chunks) {
      const query = makeQuestionFromChunk(c.title, c.text);
      retrievalRows.push({ query, positive: cleanText(c.text).slice(0, 500) });
      qaRows.push({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query },
          {
            role: 'assistant',
            content: `${cleanText(c.text).slice(0, 700)}${c.url ? `\n\nИсточник: ${c.url}` : ''}`,
          },
        ],
      });
    }
    writeFileSync(retrievalPath, retrievalRows.map((r) => JSON.stringify(r)).join('\n') + (retrievalRows.length ? '\n' : ''), 'utf8');
    writeFileSync(qaPath, qaRows.map((r) => JSON.stringify(r)).join('\n') + (qaRows.length ? '\n' : ''), 'utf8');

    return {
      chunks: chunkLines.length,
      retrieval: retrievalRows.length,
      qa: qaRows.length,
      paths: { chunkPath, retrievalPath, qaPath },
    };
  }

  async search(query, { limit = 6, category = null } = {}) {
    const q = cleanText(query);
    if (!q) return [];

    let chunks = this.store.listChunks();
    if (category) chunks = chunks.filter((c) => c.category === category);

    const needEmbed = chunks.some((c) => !c.embedding);
    if (needEmbed && this.agentService?.embed) {
      const batch = chunks.filter((c) => !c.embedding).slice(0, 24);
      await this.embedChunks(batch);
      this.store.save();
    }

    let queryVec = null;
    if (this.agentService?.embed) {
      const ev = await this.agentService.embed([q]);
      queryVec = ev?.[0] || null;
    }

    const tokens = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const scored = chunks.map((chunk) => {
      let score = 0;
      if (queryVec && Array.isArray(chunk.embedding)) {
        score = cosineSimilarity(queryVec, chunk.embedding);
      } else {
        const hay = `${chunk.title} ${chunk.text} ${(chunk.tags || []).join(' ')}`.toLowerCase();
        score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0) / Math.max(1, tokens.length);
      }
      return { chunk, score };
    });

    return scored
      .filter((x) => x.score > 0.03)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(12, Number(limit) || 6)))
      .map((x) => ({ ...x.chunk, score: x.score }));
  }

  stats() {
    return this.store.stats();
  }

  clearAll() {
    this.store.clearAll();
  }
}

export function formatKnowledgeRagBlock(chunks = []) {
  if (!chunks.length) return '';
  const lines = chunks.map((c, i) => {
    const url = c.url ? ` (${c.url})` : '';
    const excerpt = cleanText(c.text).slice(0, 420);
    return `${i + 1}. **${c.title || 'Источник'}** [${c.category || 'knowledge'}] — ${excerpt}${url}`;
  });
  return [
    '## База знаний Konstancia (статьи, курсы, справочники)',
    '',
    'Используй эти фрагменты для анализа. Сопоставь факты, сделай вывод. Если данных недостаточно — скажи честно.',
    '',
    ...lines,
  ].join('\n');
}
