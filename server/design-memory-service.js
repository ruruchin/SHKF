import { existsSync, readFileSync, writeFileSync } from 'fs';
import { topicTagsFromQuery } from '../shared/mobbin-search-query.js';

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || '').trim();
  if (!url) return null;
  return {
    id: String(raw.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    source: String(raw.source || 'manual').trim() || 'manual',
    title: String(raw.title || 'Untitled reference').trim() || 'Untitled reference',
    url,
    platform: String(raw.platform || '').trim().toLowerCase(),
    surface: String(raw.surface || '').trim().toLowerCase(),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [],
    quality: Math.max(1, Math.min(5, Number(raw.quality || 3))),
    note: String(raw.note || '').trim(),
  };
}

function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

export class DesignMemoryService {
  constructor(seedPath, deps = {}) {
    this.seedPath = seedPath;
    this.authService = deps.authService || null;
    this.agentService = deps.agentService || null;
    this.data = { version: 1, items: [] };
    this.reload();
  }

  reload() {
    if (!existsSync(this.seedPath)) {
      this.data = { version: 1, items: [] };
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.seedPath, 'utf8'));
      const items = Array.isArray(parsed?.items) ? parsed.items.map(normalizeItem).filter(Boolean) : [];
      this.data = {
        version: Number(parsed?.version || 1),
        items,
      };
    } catch {
      this.data = { version: 1, items: [] };
    }
  }

  list() {
    return this.data.items.slice();
  }

  add(item) {
    const normalized = normalizeItem(item);
    if (!normalized) throw new Error('Некорректный референс: укажите хотя бы URL');
    this.data.items.unshift(normalized);
    writeFileSync(this.seedPath, JSON.stringify(this.data, null, 2), 'utf8');
    return normalized;
  }

  retrieveLocal(query, { limit = 6, platform } = {}) {
    const q = tokenize(query);
    const topicTags = topicTagsFromQuery(query);
    const plat = String(platform || '').toLowerCase();

    const list = this.data.items.map((item) => {
      const itemTags = (item.tags || []).map((t) => String(t).toLowerCase());
      const haystack = tokenize([
        item.title,
        item.platform,
        item.surface,
        item.note,
        ...itemTags,
      ].join(' '));
      const set = new Set(haystack);
      let score = 0;
      for (const token of q) {
        if (set.has(token)) score += 2;
        else if (itemTags.some((tag) => tag.includes(token) || token.includes(tag))) score += 1;
      }
      for (const tag of topicTags) {
        if (set.has(tag)) score += 2;
        else if (itemTags.some((t) => t.includes(tag) || tag.includes(t))) score += 1.5;
      }
      if (plat && item.platform === plat) score += 0.5;
      score += (Number(item.quality || 3) - 3) * 0.25;
      return { item, score };
    });

    const ranked = list.sort((a, b) => b.score - a.score);
    const matched = ranked.filter((x) => x.score >= 1);
    const pool = matched.length ? matched : ranked;
    let items = pool
      .slice(0, Math.max(1, Math.min(40, Number(limit || 6) * 3)))
      .map((x) => x.item);
    if (plat === 'ios' || plat === 'web') {
      const filtered = items.filter((item) => !item.platform || item.platform === plat);
      if (filtered.length) items = filtered;
    }
    return items.slice(0, Math.max(1, Math.min(20, Number(limit || 6))));
  }

  vectorLiteral(vec) {
    return `[${(Array.isArray(vec) ? vec : []).map((n) => Number(n) || 0).join(',')}]`;
  }

  refText(item) {
    return [
      item.title || '',
      item.platform || '',
      item.surface || '',
      (item.tags || []).join(' '),
      item.note || '',
      item.source || '',
    ].join('\n');
  }

  async retrieveSupabase(query, { limit = 6 } = {}) {
    if (!this.authService?.client || !this.authService?.session?.access_token || !this.agentService) {
      return [];
    }
    const vectors = await this.agentService.embed([query]);
    const qv = vectors?.[0];
    if (!Array.isArray(qv) || !qv.length) return [];

    const sessionOk = await this.authService.ensureClientSession?.().catch(() => false);
    if (sessionOk === false && this.authService.session) {
      return [];
    }
    let data;
    let error;
    try {
      ({ data, error } = await this.authService.client.rpc('match_design_references', {
        query_embedding_text: this.vectorLiteral(qv),
        match_count: Math.max(1, Math.min(20, Number(limit || 6))),
      }));
    } catch {
      return [];
    }
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.id,
      source: row.source || 'supabase',
      title: row.title || 'Untitled reference',
      url: row.url || '',
      platform: row.platform || '',
      surface: row.surface || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      quality: Number(row.quality || 3),
      note: row.note || '',
      similarity: Number(row.similarity || 0),
    })).filter((x) => x.url);
  }

  dedupe(items) {
    const map = new Map();
    for (const item of items || []) {
      const key = String(item?.url || item?.id || '');
      if (!key) continue;
      if (!map.has(key)) map.set(key, item);
    }
    return [...map.values()];
  }

  async retrieve(query, { limit = 6, mode = 'hybrid', platform } = {}) {
    const local = this.retrieveLocal(query, { limit, platform });
    if (mode === 'local') return local;
    const remote = await this.retrieveSupabase(query, { limit }).catch(() => []);
    if (mode === 'supabase') return remote;
    const plat = String(platform || '').toLowerCase();
    let merged = this.dedupe([...remote, ...local]);
    if (plat === 'ios' || plat === 'web') {
      const filtered = merged.filter((item) => !item.platform || item.platform === plat);
      if (filtered.length) merged = filtered;
    }
    return merged.slice(0, Math.max(1, Math.min(20, Number(limit || 6))));
  }

  buildContextBlockFromRefs(refs, source = 'mixed') {
    if (!refs.length) return '## Reference signals\nNo reference data.';
    const lines = [`## Reference signals (${source})`];
    refs.forEach((ref, idx) => {
      const tags = (ref.tags || []).slice(0, 8).join(', ');
      lines.push(
        `${idx + 1}. ${ref.title} (${ref.source}, ${ref.platform || 'unknown'} ${ref.surface || ''})`,
      );
      if (tags) lines.push(`   tags: ${tags}`);
      lines.push(`   url: ${ref.url}`);
    });
    return lines.join('\n');
  }

  async getPromptContext(query, { limit = 6, mode = 'hybrid' } = {}) {
    const refs = await this.retrieve(query, { limit, mode });
    return {
      refs,
      context: this.buildContextBlockFromRefs(refs, mode),
    };
  }

  async syncSeedToSupabase({ limit = 200 } = {}) {
    if (!this.authService?.client || !this.authService?.session?.access_token || !this.agentService) {
      return { ok: false, message: 'Supabase auth или embedding-модель не готовы' };
    }
    await this.authService.ensureClientSession?.();
    const rows = this.list().slice(0, Math.max(1, Math.min(500, Number(limit || 200))));
    if (!rows.length) return { ok: true, total: 0, synced: 0, failed: 0 };

    const vectors = await this.agentService.embed(rows.map((r) => this.refText(r)));
    if (!vectors || vectors.length !== rows.length) {
      return { ok: false, message: 'Не удалось получить embeddings для seed-референсов' };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { data, error } = await this.authService.client
          .from('design_references')
          .upsert({
            source: row.source || 'seed',
            title: row.title,
            url: row.url,
            platform: row.platform || '',
            surface: row.surface || '',
            tags: row.tags || [],
            quality: Number(row.quality || 3),
            note: row.note || '',
          }, { onConflict: 'url' })
          .select('id')
          .single();
        if (error || !data?.id) {
          failed++;
          errors.push(`${row.title}: ${error?.message || 'upsert failed'}`);
          continue;
        }

        const emb = vectors[i];
        const { error: embErr } = await this.authService.client.rpc('upsert_design_reference_embedding', {
          p_reference_id: data.id,
          p_model: 'gigachat-embeddings',
          p_embedding_text: this.vectorLiteral(emb),
        });
        if (embErr) {
          failed++;
          errors.push(`${row.title}: ${embErr.message}`);
          continue;
        }
        synced++;
      } catch (err) {
        failed++;
        errors.push(`${row.title}: ${err.message || String(err)}`);
      }
    }

    return {
      ok: true,
      total: rows.length,
      synced,
      failed,
      errors: errors.slice(0, 20),
    };
  }
}
