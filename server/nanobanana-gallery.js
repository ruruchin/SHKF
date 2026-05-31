import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const MAX_ITEMS = 120;

export function createNanobananaGalleryStore(filePath) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  function read() {
    if (!existsSync(filePath)) return { items: [] };
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      return { items: Array.isArray(raw?.items) ? raw.items : [] };
    } catch {
      return { items: [] };
    }
  }

  function write(data) {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  return {
    list() {
      return read().items;
    },

    add(entry) {
      const data = read();
      const item = {
        id: entry.id || `nb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        generationId: entry.generationId || null,
        prompt: entry.prompt || '',
        model: entry.model || '',
        resolution: entry.resolution || '',
        aspectRatio: entry.aspectRatio || 'auto',
        imageUrls: entry.imageUrls || [],
        creditsUsed: entry.creditsUsed ?? null,
        createdAt: entry.createdAt || new Date().toISOString(),
      };
      data.items.unshift(item);
      if (data.items.length > MAX_ITEMS) data.items.length = MAX_ITEMS;
      write(data);
      return item;
    },

    remove(id) {
      const data = read();
      data.items = data.items.filter((i) => i.id !== id);
      write(data);
      return data.items;
    },

    clear() {
      write({ items: [] });
      return [];
    },
  };
}
