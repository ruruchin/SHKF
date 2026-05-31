/** Конфиг и сопоставление баннеров из библиотеки Figma. */

export const BANNER_SIZE_TOLERANCE = 12;

export const DEFAULT_BANNER_MOCKUPS = {
  version: 1,
  slotNames: {
    image: ['img', 'slot-image', 'image', 'photo', 'bg-photo'],
    title: ['text-title', 'title', 'heading', 'заголовок'],
    subtitle: ['text-subtitle', 'subtitle', 'description', 'подзаголовок'],
    cta: ['text-cta', 'cta', 'button-text', 'кнопка'],
  },
  presets: [
    { id: 'banner-1200x400', label: 'Main 1200×400', width: 1200, height: 400 },
    { id: 'banner-1200x560', label: '1200×560', width: 1200, height: 560, imageLayout: 'center' },
    { id: 'banner-360x488', label: '360×488', width: 360, height: 488, imageLayout: 'center' },
    { id: 'banner-388x203', label: '388×203', width: 388, height: 203, imageLayout: 'center' },
    { id: 'banner-354x168', label: 'Mobile 354×168', width: 354, height: 168 },
  ],
};

export function normalizeSlotName(name) {
  return String(name || '').trim().toLowerCase();
}

export function layerNameMatches(name, aliases) {
  const n = normalizeSlotName(name);
  if (!n || !Array.isArray(aliases)) return false;
  return aliases.some((a) => normalizeSlotName(a) === n);
}

export function sizeMatches(w, h, targetW, targetH, tolerance = BANNER_SIZE_TOLERANCE) {
  const tw = Number(targetW) || 0;
  const th = Number(targetH) || 0;
  const iw = Number(w) || 0;
  const ih = Number(h) || 0;
  if (!tw || !th || !iw || !ih) return false;
  return Math.abs(iw - tw) <= tolerance && Math.abs(ih - th) <= tolerance;
}

export function isBannerLikeItem(item) {
  if (!item?.figma) return false;
  const name = `${item.name || ''} ${item.category || ''}`.toLowerCase();
  if (/баннер|banner|mobile banner|main banner/i.test(name)) return true;
  const w = item.figma.width;
  const h = item.figma.height;
  return DEFAULT_BANNER_MOCKUPS.presets.some((p) => sizeMatches(w, h, p.width, p.height));
}

export function findTemplateForPreset(preset, libraryItems, tolerance = BANNER_SIZE_TOLERANCE) {
  const items = (libraryItems || []).filter((i) => i.user && i.figma);
  const exact = items.find((i) => sizeMatches(i.figma.width, i.figma.height, preset.width, preset.height, tolerance));
  if (exact) return exact;

  const sizeTag = `${preset.width}x${preset.height}`;
  const byName = items.find((i) => {
    const n = String(i.name || '').toLowerCase().replace(/\×/g, 'x');
    return n.includes(sizeTag) || n.includes(String(preset.width)) && n.includes(String(preset.height));
  });
  if (byName) return byName;

  const bannerItems = items.filter(isBannerLikeItem);
  let best = null;
  let bestScore = Infinity;
  for (const item of bannerItems) {
    const dw = Math.abs((item.figma.width || 0) - preset.width);
    const dh = Math.abs((item.figma.height || 0) - preset.height);
    const score = dw + dh;
    if (score < bestScore && score <= tolerance * 4) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

export function mergeBannerMockupConfig(raw) {
  const base = structuredClone(DEFAULT_BANNER_MOCKUPS);
  if (!raw || typeof raw !== 'object') return base;
  if (raw.slotNames && typeof raw.slotNames === 'object') {
    base.slotNames = { ...base.slotNames, ...raw.slotNames };
  }
  if (Array.isArray(raw.presets) && raw.presets.length) {
    base.presets = raw.presets;
  }
  base.version = raw.version || base.version;
  return base;
}

export function buildPresetsWithTemplates(config, libraryItems) {
  return (config.presets || []).map((preset) => {
    const template = findTemplateForPreset(preset, libraryItems);
    return {
      ...preset,
      templateId: template?.id || null,
      templateName: template?.name || null,
      templateWidth: template?.figma?.width || null,
      templateHeight: template?.figma?.height || null,
      hasThumb: !!template?.hasThumb,
      hasThumbNoImg: !!template?.hasThumbNoImg,
      bannerSlots: template?.bannerSlots || null,
      linked: !!template,
    };
  });
}

export function defaultPreviewSlots(preset) {
  const w = preset?.width || 1200;
  const h = preset?.height || 400;
  const wide = w / h > 1.8;
  const tall = h / w > 1.15;
  if (wide) {
    return {
      image: { x: 0.52, y: 0, w: 0.48, h: 1 },
    };
  }
  if (tall) {
    return {
      image: { x: 0, y: 0.38, w: 1, h: 0.62 },
    };
  }
  return {
    image: { x: 0.5, y: 0, w: 0.5, h: 1 },
  };
}
