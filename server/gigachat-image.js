/**
 * GigaChat Files API принимает PNG/JPEG, не WebP/AVIF.
 */

import { nativeImage } from 'electron';

const SUPPORTED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg']);

export function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return 'application/octet-stream';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand.includes('avif') || brand.includes('avis')) return 'image/avif';
  }
  if (buf[0] === 0x3c || (buf[0] === 0x7b && buf[1] === 0x22)) return 'text/html';
  return 'application/octet-stream';
}

export function filenameForMime(mime, base = 'image') {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return `${base}.jpg`;
  return `${base}.png`;
}

let sharpPromise = null;

async function decodeViaSharp(buf) {
  try {
    if (!sharpPromise) {
      sharpPromise = import('sharp').then((m) => m.default).catch(() => null);
    }
    const sharp = await sharpPromise;
    if (!sharp) return null;
    return sharp(buf).png().toBuffer();
  } catch {
    return null;
  }
}

async function decodeViaNativeImage(buf, mime) {
  let img = nativeImage.createFromBuffer(buf);
  if (!img || img.isEmpty()) {
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    img = nativeImage.createFromDataURL(dataUrl);
  }
  if (!img || img.isEmpty()) return null;
  return img.toPNG();
}

export function canRewriteMobbinCdnUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/bytescale\.mobbin|mobbin\.com/i.test(u.hostname)) return false;
    if (u.searchParams.has('enc')) return false;
    if (u.searchParams.has('sig') || u.searchParams.has('signature') || u.searchParams.has('token')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function preferPngMobbinUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || !canRewriteMobbinCdnUrl(raw)) return raw;
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

/**
 * @param {{ buffer: Buffer, mimeType?: string, filename?: string }}
 * @returns {{ buffer: Buffer, mimeType: string, filename: string }}
 */
export function isRiskyMobbinCdnUrl(url) {
  const u = String(url || '');
  return /[?&]enc=/i.test(u) || /\.webp(\?|$)/i.test(u);
}

export async function normalizeImageForGigaChat({ buffer, mimeType, filename }) {
  let buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!buf.length) throw new Error('Пустое изображение');

  const sniffed = sniffImageMime(buf);
  let mime = String(mimeType || sniffed).toLowerCase();
  let name = String(filename || filenameForMime(mime));

  if (sniffed === 'text/html') {
    throw new Error('Сервер вернул HTML вместо изображения');
  }
  if (sniffed === 'image/avif' || mime === 'image/avif') {
    throw new Error('AVIF_NEEDS_FALLBACK');
  }

  if (sniffed === 'image/jpeg' || sniffed === 'image/png') {
    mime = sniffed === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return {
      buffer: buf,
      mimeType: mime,
      filename: filenameForMime(mime, 'mobbin-ref'),
    };
  }

  if (sniffed === 'image/webp' || mime === 'image/webp') {
    let png = await decodeViaSharp(buf);
    if (!png?.length) png = await decodeViaNativeImage(buf, 'image/webp');
    if (png?.length) {
      return { buffer: png, mimeType: 'image/png', filename: 'mobbin-ref.png' };
    }
    throw new Error('WEBP_DECODE_FAILED');
  }

  let png = await decodeViaSharp(buf);
  if (!png?.length) png = await decodeViaNativeImage(buf, mime || 'image/png');
  if (png?.length) {
    return { buffer: png, mimeType: 'image/png', filename: 'mobbin-ref.png' };
  }

  throw new Error('Не удалось декодировать изображение для GigaChat');
}
