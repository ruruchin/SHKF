import { existsSync, readFileSync, writeFileSync } from 'fs';

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
  constructor(seedPath) {
    this.seedPath = seedPath;
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

  /**
   * Первая версия retrieval: keyword match (title + tags + platform + surface + note).
   * В следующем шаге это заменяется на pgvector similarity.
   */
  retrieve(query, { limit = 6 } = {}) {
    const q = tokenize(query);
    const list = this.data.items.map((item) => {
      const haystack = tokenize([
        item.title,
        item.platform,
        item.surface,
        item.note,
        ...(item.tags || []),
      ].join(' '));
      const set = new Set(haystack);
      let score = 0;
      for (const token of q) {
        if (set.has(token)) score += 1;
      }
      score += (Number(item.quality || 3) - 3) * 0.25;
      return { item, score };
    });

    return list
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, Number(limit || 6))))
      .map((x) => x.item);
  }

  buildContextBlock(query, limit = 6) {
    const refs = this.retrieve(query, { limit });
    if (!refs.length) return '## Reference signals\nNo reference data.';
    const lines = ['## Reference signals (Mobbin seed)'];
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
}
