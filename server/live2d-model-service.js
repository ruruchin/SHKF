import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const MODEL_JSON_RE = /\.(model3?\.json|vtube\.json)$/i;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function findModelSettingsInDir(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const files = entries.filter((ent) => ent.isFile()).map((ent) => ent.name);
  const model3 = files.find((name) => name.toLowerCase().endsWith('.model3.json'));
  if (model3) return path.join(dir, model3);

  const vtube = files.find((name) => name.toLowerCase().endsWith('.vtube.json'));
  if (vtube) return path.join(dir, vtube);

  const model2 = files.find((name) => name.toLowerCase().endsWith('.model.json'));
  if (model2) return path.join(dir, model2);

  return null;
}

function verifyModelAssets(settingsPath) {
  try {
    const settings = readJson(settingsPath);
    const dir = path.dirname(settingsPath);
    const mocRel = String(settings?.FileReferences?.Moc || '').trim();
    if (!mocRel) {
      return { ok: false, message: 'В model3.json не указан файл .moc3' };
    }
    const mocPath = path.join(dir, mocRel);
    if (!existsSync(mocPath)) {
      return { ok: false, message: `Не найден файл модели: ${mocRel}` };
    }
    const textures = settings?.FileReferences?.Textures;
    if (Array.isArray(textures)) {
      for (const rel of textures) {
        const texPath = path.join(dir, String(rel || '').trim());
        if (rel && !existsSync(texPath)) {
          return { ok: false, message: `Не найдена текстура: ${rel}` };
        }
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Не удалось прочитать model3.json' };
  }
}

export function resolveModelEntryPath(inputPath = '') {
  const raw = String(inputPath || '').trim();
  if (!raw || !existsSync(raw)) return null;

  try {
    if (statSync(raw).isFile()) {
      if (isModelJsonCandidate(raw)) return path.normalize(raw);
      if (/\.moc3$/i.test(raw)) {
        const hit = findModelSettingsInDir(path.dirname(raw));
        if (hit) return hit;
      }
      if (/\.json$/i.test(raw)) {
        const hit = findModelSettingsInDir(path.dirname(raw));
        if (hit) return hit;
      }
      return null;
    }
  } catch {
    return null;
  }

  try {
    if (statSync(raw).isDirectory()) {
      const hit = findModelSettingsInDir(raw);
      if (hit) return hit;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveLive2dSettingsPath(entryPath = '') {
  const entry = resolveModelEntryPath(entryPath);
  if (!entry) return null;

  const base = path.basename(entry).toLowerCase();
  if (base.endsWith('.vtube.json')) {
    try {
      const vtube = readJson(entry);
      const modelRel = String(vtube?.FileReferences?.Model || '').trim();
      if (modelRel) {
        const modelPath = path.normalize(path.join(path.dirname(entry), modelRel));
        if (existsSync(modelPath)) return modelPath;
      }
    } catch {
      /* fall through */
    }
  }

  if (base.endsWith('.model3.json') || base.endsWith('.model.json')) {
    return entry;
  }

  return null;
}

export function readLive2dMeta(entryPath = '') {
  const entry = resolveModelEntryPath(entryPath);
  const settingsPath = resolveLive2dSettingsPath(entryPath);
  if (!settingsPath) {
    return {
      ok: false,
      message: 'Нужен *.model3.json, *.vtube.json, *.moc3 (найдём model3.json рядом) или папка модели',
    };
  }

  const assets = verifyModelAssets(settingsPath);
  if (!assets.ok) return assets;

  let idleMotion = '';
  let modelName = path.basename(path.dirname(settingsPath));

  const entryBase = entry ? path.basename(entry).toLowerCase() : '';
  if (entryBase.endsWith('.vtube.json')) {
    try {
      const vtube = readJson(entry);
      modelName = String(vtube?.Name || modelName).trim() || modelName;
      idleMotion = String(vtube?.FileReferences?.IdleAnimation || '').trim();
    } catch {
      /* ignore */
    }
  }

  let motionGroups = [];
  try {
    const settings = readJson(settingsPath);
    const motions = settings?.FileReferences?.Motions || settings?.motions || {};
    motionGroups = Object.keys(motions);
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    entryPath: entry || settingsPath,
    settingsPath,
    modelDir: path.dirname(settingsPath),
    modelName,
    idleMotion,
    motionGroups,
  };
}

export function toLive2dProtocolUrl(filePath = '') {
  const normalized = path.normalize(String(filePath || '').trim()).replace(/\\/g, '/');
  if (!normalized) return '';
  const slashPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `kostin-live2d://${encodeURI(slashPath)}`;
}

export function fromLive2dProtocolUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw.startsWith('kostin-live2d://')) return '';

  if (raw.startsWith('kostin-live2d://local/')) {
    try {
      return path.normalize(decodeURIComponent(raw.slice('kostin-live2d://local/'.length)));
    } catch {
      return '';
    }
  }

  try {
    const parsed = new URL(raw);
    let filePath = decodeURI(parsed.pathname);
    if (/^\/[A-Za-z]:/.test(filePath)) filePath = filePath.slice(1);
    return path.normalize(filePath);
  } catch {
    return '';
  }
}

export function resolveLive2dAssetUrl(baseFileUrl = '', relativePath = '') {
  try {
    return new URL(String(relativePath || ''), String(baseFileUrl || '')).href;
  } catch {
    return '';
  }
}

export function isModelJsonCandidate(filePath = '') {
  return MODEL_JSON_RE.test(String(filePath || ''));
}
