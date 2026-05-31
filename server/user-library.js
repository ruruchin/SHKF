import { readFileSync, writeFileSync, existsSync, mkdirSync, writeFile, unlinkSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const writeFileAsync = promisify(writeFile);

const DEFAULT_LIBRARY = {
  version: 1,
  items: [],
  customCategories: [],
};

export class UserLibrary {
  constructor(libraryPath, assetsDir) {
    this.libraryPath = libraryPath;
    this.assetsDir = assetsDir;
    this.data = this.load();
  }

  load() {
    if (!existsSync(this.libraryPath)) {
      return structuredClone(DEFAULT_LIBRARY);
    }
    try {
      const raw = JSON.parse(readFileSync(this.libraryPath, 'utf-8'));
      return {
        version: raw.version || 1,
        items: Array.isArray(raw.items) ? raw.items : [],
        customCategories: Array.isArray(raw.customCategories) ? raw.customCategories : [],
      };
    } catch {
      return structuredClone(DEFAULT_LIBRARY);
    }
  }

  save() {
    mkdirSync(this.assetsDir, { recursive: true });
    writeFileSync(this.libraryPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getItems() {
    return this.data.items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getItem(id) {
    return this.data.items.find((item) => item.id === id) || null;
  }

  getCategories() {
    const fromItems = this.data.items.map((i) => i.category).filter(Boolean);
    const merged = [...new Set([...this.data.customCategories, ...fromItems])];
    return merged.sort((a, b) => a.localeCompare(b, 'ru'));
  }

  async addFromFigma(payload) {
    const id = 'user-' + randomBytes(6).toString('hex');
    mkdirSync(this.assetsDir, { recursive: true });

    const svgPath = join(this.assetsDir, id + '.svg');
    const thumbPath = join(this.assetsDir, id + '.png');
    const thumbNoImgPath = payload.thumbnailNoImg ? join(this.assetsDir, id + '-noimg.png') : null;

    const svg = Buffer.from(payload.svg, 'base64').toString('utf-8');
    await writeFileAsync(svgPath, svg, 'utf-8');
    await writeFileAsync(thumbPath, Buffer.from(payload.thumbnail, 'base64'));
    if (thumbNoImgPath && payload.thumbnailNoImg) {
      await writeFileAsync(thumbNoImgPath, Buffer.from(payload.thumbnailNoImg, 'base64'));
    }

    const category = payload.category || guessCategory(payload.name) || 'Мои компоненты';

    const item = {
      id,
      name: payload.name || 'Компонент',
      category,
      description: payload.description || ('Из Figma · ' + (payload.fileName || 'файл')),
      source: 'figma',
      user: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview: id,
      figma: {
        fileName: payload.fileName || '',
        nodeId: payload.nodeId || '',
        nodeType: payload.nodeType || '',
        componentKey: payload.componentKey || '',
        width: payload.width || 0,
        height: payload.height || 0,
      },
      assets: {
        svg: id + '.svg',
        thumb: id + '.png',
        ...(thumbNoImgPath ? { thumbNoImg: id + '-noimg.png' } : {}),
      },
    };

    if (payload.bannerSlots && typeof payload.bannerSlots === 'object') {
      item.bannerSlots = payload.bannerSlots;
    }

    this.data.items.unshift(item);
    if (category && !this.data.customCategories.includes(category)) {
      this.data.customCategories.push(category);
    }
    this.save();
    return item;
  }

  updateItem(id, patch) {
    const item = this.getItem(id);
    if (!item) throw new Error('Компонент не найден');
    if (patch.name) item.name = patch.name.trim();
    if (patch.category) item.category = patch.category.trim();
    if (patch.description !== undefined) item.description = patch.description.trim();
    item.updatedAt = new Date().toISOString();
    this.save();
    return item;
  }

  deleteItem(id) {
    const idx = this.data.items.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error('Компонент не найден');
    const item = this.data.items[idx];
    if (item.assets?.svg) {
      const svgPath = join(this.assetsDir, item.assets.svg);
      if (existsSync(svgPath)) unlinkSync(svgPath);
    }
    if (item.assets?.thumb) {
      const thumbPath = join(this.assetsDir, item.assets.thumb);
      if (existsSync(thumbPath)) unlinkSync(thumbPath);
    }
    if (item.assets?.thumbNoImg) {
      const thumbNoImgPath = join(this.assetsDir, item.assets.thumbNoImg);
      if (existsSync(thumbNoImgPath)) unlinkSync(thumbNoImgPath);
    }
    this.data.items.splice(idx, 1);
    this.save();
    return { ok: true };
  }

  getSvgPath(id) {
    const item = this.getItem(id);
    if (!item?.assets?.svg) return null;
    return join(this.assetsDir, item.assets.svg);
  }

  getThumbPath(id) {
    const item = this.getItem(id);
    if (!item?.assets?.thumb) return null;
    return join(this.assetsDir, item.assets.thumb);
  }

  getThumbNoImgPath(id) {
    const item = this.getItem(id);
    if (!item?.assets?.thumbNoImg) return null;
    return join(this.assetsDir, item.assets.thumbNoImg);
  }

  readSvg(id) {
    const p = this.getSvgPath(id);
    if (!p || !existsSync(p)) return null;
    return readFileSync(p, 'utf-8');
  }

  toPublicItem(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      preview: item.preview || item.id,
      user: true,
      source: item.source,
      createdAt: item.createdAt,
      figma: item.figma,
      hasThumb: !!(item.assets?.thumb),
      hasThumbNoImg: !!(item.assets?.thumbNoImg),
      bannerSlots: item.bannerSlots || null,
    };
  }

  listPublic() {
    return this.getItems().map((i) => this.toPublicItem(i));
  }
}

function guessCategory(name) {
  const n = (name || '').toLowerCase();
  if (/btn|button|кноп/i.test(n)) return 'Кнопки';
  if (/input|field|form|поле|форма/i.test(n)) return 'Формы';
  if (/card|карточ/i.test(n)) return 'Карточки';
  if (/nav|menu|header|bar/i.test(n)) return 'Навигация';
  if (/modal|dialog|popup/i.test(n)) return 'UI элементы';
  if (/banner|баннер|mobile banner|main banner/i.test(n)) return 'Баннеры';
  return 'Мои компоненты';
}
