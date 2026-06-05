/**
 * Превью экранов Mobbin без API key — парсинг og:image со страницы.
 */

import https from 'https';

function preferPngMobbinUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || !/bytescale\.mobbin|mobbin\.com/i.test(raw)) return raw;
  if (/[?&]enc=|[?&](sig|signature|token)=/i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.searchParams.get('f') === 'png') return raw;
    u.searchParams.set('f', 'png');
    if (!u.searchParams.has('w')) u.searchParams.set('w', '1080');
    return u.href;
  } catch {
    return raw;
  }
}

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function httpsGetText(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'SHKF/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(httpsGetText(new URL(res.headers.location, url).href, timeoutMs));
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Mobbin preview timeout'));
    });
    req.end();
  });
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseOgImageFromHtml(html) {
  const match = String(html || '').match(/property="og:image"[^>]+content="([^"]+)"/i)
    || String(html || '').match(/content="([^"]+)"[^>]+property="og:image"/i);
  return decodeHtmlAttr(match?.[1] || '');
}

function previewsFromOgUrl(ogUrl) {
  try {
    const u = new URL(ogUrl);
    const raw = u.searchParams.get('appPreviewScreensUrls') || '';
    if (!raw) return [];
    return raw.split(',').map((part) => decodeURIComponent(part.trim())).filter(Boolean);
  } catch {
    return [];
  }
}

function pickPreviewForScreen(mobbinUrl, previews) {
  if (!previews.length) return null;
  const parts = String(mobbinUrl || '').split('/').filter(Boolean);
  const screenId = parts.find((p) => /^[0-9a-f-]{36}$/i.test(p));
  if (!screenId) return previews[0];
  let hash = 0;
  for (let i = 0; i < screenId.length; i++) hash = (hash + screenId.charCodeAt(i)) % previews.length;
  return previews[hash] || previews[0];
}

/**
 * @param {string} mobbinUrl
 * @returns {Promise<string|null>}
 */
export async function resolveMobbinPreviewUrls(mobbinUrl) {
  const url = String(mobbinUrl || '').trim();
  if (!url || !/mobbin\.com/i.test(url)) return [];

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const list = [cached.primary, ...(cached.previews || [])].filter(Boolean);
    return [...new Set(list)];
  }

  try {
    const html = await httpsGetText(url);
    const og = parseOgImageFromHtml(html);
    const previews = previewsFromOgUrl(og);
    const primary = pickPreviewForScreen(url, previews) || previews[0] || null;
    cache.set(url, { at: Date.now(), primary, previews });
    return [...new Set([primary, ...previews].filter(Boolean))];
  } catch {
    return [];
  }
}

export async function resolveMobbinPreviewUrl(mobbinUrl) {
  const url = String(mobbinUrl || '').trim();
  if (!url || !/mobbin\.com/i.test(url)) return null;

  const list = await resolveMobbinPreviewUrls(url);
  return list[0] || null;
}

/**
 * Обогащает список экранов полем image_url (без Mobbin API).
 * @param {Array<{ mobbin_url?: string, image_url?: string|null }>} screens
 * @param {{ limit?: number }} [options]
 */
export async function enrichScreensWithPreviews(screens, { limit = 40 } = {}) {
  const list = (screens || []).slice(0, Math.max(1, limit));
  const concurrency = 4;
  const out = new Array(list.length);

  async function enrichOne(screen, index) {
    if (screen.image_url || screen.imageUrl) {
      const rawImg = screen.image_url || screen.imageUrl;
      const img = preferPngMobbinUrl(rawImg) || rawImg;
      out[index] = { ...screen, image_url: img, imageUrl: img };
      return;
    }
    const mobbinUrl = screen.mobbin_url || screen.url;
    const imageUrl = mobbinUrl ? await resolveMobbinPreviewUrl(mobbinUrl) : null;
    out[index] = {
      ...screen,
      image_url: imageUrl || null,
      imageUrl: imageUrl || null,
    };
  }

  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency);
    await Promise.all(batch.map((screen, j) => enrichOne(screen, i + j)));
  }

  return out.filter(Boolean);
}
