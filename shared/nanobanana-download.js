const CDN_HOST_RE = /cloudflarer2\.nananobanana\.com|r2\.nananobanana/i;

export function resolveNanobananaImageUrl(raw, baseUrl = 'https://www.nananobanana.com') {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^data:image\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/') && base) return `${base}${url}`;
  return url;
}

export function isNanobananaCdnUrl(url) {
  try {
    return CDN_HOST_RE.test(new URL(url).hostname);
  } catch {
    return CDN_HOST_RE.test(String(url));
  }
}

export function sniffImageExtFromBuffer(buf) {
  if (!buf || buf.length < 12) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'webp';
  return 'png';
}

function sniffImageExt(buf) {
  return sniffImageExtFromBuffer(buf);
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
  if (!match) throw new Error('Некорректный data URL');
  const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
  const buf = Buffer.from(match[2], 'base64');
  if (!buf.length) throw new Error('Пустое изображение');
  return { buf, ext };
}

/**
 * @param {string} url
 * @param {{ apiKey?: string, baseUrl?: string, timeoutMs?: number }} [opts]
 */
export async function fetchNanobananaImageBytes(url, opts = {}) {
  const resolved = resolveNanobananaImageUrl(url, opts.baseUrl);
  if (!resolved) throw new Error('Нет URL изображения');

  if (resolved.startsWith('data:image/')) {
    const { buf, ext } = parseDataUrl(resolved);
    return { buf, ext, resolved };
  }

  const apiKey = String(opts.apiKey || '').trim();
  const isCdn = isNanobananaCdnUrl(resolved);
  const attempts = [];

  attempts.push({
    label: 'direct',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'SHKF/1.0',
    },
  });

  if (apiKey && !isCdn) {
    attempts.push({
      label: 'bearer',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        Authorization: `Bearer ${apiKey}`,
        Referer: 'https://www.nananobanana.com/',
        'User-Agent': 'SHKF/1.0',
      },
    });
  }

  if (apiKey && isCdn) {
    attempts.push({
      label: 'cdn-referer',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        Referer: 'https://www.nananobanana.com/',
        Origin: 'https://www.nananobanana.com',
        'User-Agent': 'SHKF/1.0',
      },
    });
  }

  let lastError = null;
  const timeoutMs = opts.timeoutMs ?? 45000;

  for (const attempt of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(resolved, {
        headers: attempt.headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('Пустой ответ');
      if (ct.includes('json') || (buf[0] === 0x7b && buf[1] === 0x22)) {
        throw new Error('Сервер вернул JSON вместо изображения');
      }
      const ext = ct.includes('jpeg') || ct.includes('jpg')
        ? 'jpg'
        : ct.includes('webp')
          ? 'webp'
          : sniffImageExt(buf);
      return { buf, ext, resolved };
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  const msg = lastError?.name === 'AbortError'
    ? 'Превышено время ожидания загрузки'
    : (lastError?.message || 'Не удалось скачать');
  throw new Error(msg);
}

export function ensureFileExtension(filePath, ext) {
  const safeExt = String(ext || 'png').replace(/^\./, '').toLowerCase();
  const pathStr = String(filePath || '');
  if (/\.(png|jpe?g|webp)$/i.test(pathStr)) return pathStr;
  return `${pathStr}.${safeExt === 'jpeg' ? 'jpg' : safeExt}`;
}
