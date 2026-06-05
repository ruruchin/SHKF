import http from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const MIME = {
  '.json': 'application/json;charset=utf-8',
  '.moc3': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function mimeType(filePath = '') {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.motion3.json')) return MIME['.json'];
  if (lower.endsWith('.physics3.json')) return MIME['.json'];
  if (lower.endsWith('.cdi3.json')) return MIME['.json'];
  if (lower.endsWith('.model3.json')) return MIME['.json'];
  const ext = path.extname(lower);
  return MIME[ext] || 'application/octet-stream';
}

/** @type {Map<string, { server: import('http').Server, port: number, modelUrl: string }>} */
const roots = new Map();

function normalizeRoot(dir = '') {
  return path.normalize(String(dir || '').trim());
}

function isInsideRoot(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Serves a Live2D model folder over http://127.0.0.1:<port>/ so pixi-live2d XHR can load assets.
 */
export async function getLive2dModelHttpUrl(settingsPath = '') {
  const settings = normalizeRoot(settingsPath);
  if (!settings || !existsSync(settings)) {
    return { ok: false, message: 'model3.json не найден' };
  }

  const modelDir = normalizeRoot(path.dirname(settings));
  const cached = roots.get(modelDir);
  if (cached) {
    return {
      ok: true,
      modelDir,
      settingsPath: settings,
      modelUrl: cached.modelUrl,
      port: cached.port,
    };
  }

  return await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        let rel = decodeURIComponent(reqUrl.pathname);
        if (rel.startsWith('/')) rel = rel.slice(1);
        rel = rel.split('?')[0];
        const filePath = normalizeRoot(path.join(modelDir, rel));
        if (!isInsideRoot(modelDir, filePath) || !existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        const data = readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': mimeType(filePath),
          'Content-Length': String(data.byteLength),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Read error');
      }
    });

    server.on('error', (err) => {
      resolve({ ok: false, message: err?.message || 'Не удалось запустить локальный сервер Live2D' });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const fileName = path.basename(settings).replace(/\\/g, '/');
      const modelUrl = `http://127.0.0.1:${port}/${encodeURI(fileName)}`;
      roots.set(modelDir, { server, port, modelUrl });
      resolve({
        ok: true,
        modelDir,
        settingsPath: settings,
        modelUrl,
        port,
      });
    });
  });
}

export function stopAllLive2dStaticServers() {
  for (const entry of roots.values()) {
    try { entry.server.close(); } catch { /* */ }
  }
  roots.clear();
}
