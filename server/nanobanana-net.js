import { net } from 'electron';
import { sniffImageExtFromBuffer } from '../shared/nanobanana-download.js';

/**
 * Download bytes via Chromium net stack (same as the UI that shows the image).
 * @param {string} url
 * @param {Record<string, string>} [headers]
 */
export function fetchUrlBytesWithNet(url, headers = {}) {
  const target = String(url || '').trim();
  if (!target) return Promise.reject(new Error('Нет URL'));

  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url: target, redirect: 'follow' });
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) request.setHeader(key, String(value));
    }

    const chunks = [];
    let status = 0;

    request.on('response', (response) => {
      status = response.statusCode || 0;
      if (status >= 400) {
        let body = '';
        response.on('data', (chunk) => { body += chunk.toString('utf8').slice(0, 200); });
        response.on('end', () => {
          reject(new Error(body ? `HTTP ${status}: ${body}` : `HTTP ${status}`));
        });
        return;
      }

      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!buf.length) {
          reject(new Error('Пустой ответ сервера'));
          return;
        }
        if (buf[0] === 0x7b && buf[1] === 0x22) {
          reject(new Error('Сервер вернул JSON вместо изображения'));
          return;
        }
        resolve(buf);
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

export async function fetchNanobananaImageWithNet(url, { apiKey } = {}) {
  const headers = {
    Accept: 'image/*,*/*;q=0.8',
    'User-Agent': 'SHKF/1.0',
    Referer: 'https://www.nananobanana.com/',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let lastErr = null;
  const attempts = [
    headers,
    { Accept: 'image/*,*/*;q=0.8', 'User-Agent': 'SHKF/1.0' },
  ];

  for (const h of attempts) {
    try {
      const buf = await fetchUrlBytesWithNet(url, h);
      return { buf, ext: sniffImageExtFromBuffer(buf) };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Не удалось скачать изображение');
}
