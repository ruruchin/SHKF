import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import path from 'path';
import os from 'os';

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const TEXTURE_RE = /texture|artmesh|_00\d|mask|normal|shadow|specular|physics|\.2048|\.1024|render|atlas/i;
const PREFERRED_ICON_NAMES = [
  'icon.png',
  'Icon.png',
  'thumbnail.png',
  'preview.png',
  'avatar.png',
  'model.png',
];

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function toDataUrl(filePath) {
  const buf = readFileSync(filePath);
  return `data:${mimeFor(filePath)};base64,${buf.toString('base64')}`;
}

function steamVtsModelRoots() {
  const roots = [];
  const suffix = path.join('VTube Studio', 'VTube Studio_Data', 'StreamingAssets', 'Live2DModels');
  for (const letter of 'CDEFG') {
    roots.push(path.join(`${letter}:`, 'Program Files (x86)', 'Steam', 'steamapps', 'common', suffix));
    roots.push(path.join(`${letter}:`, 'SteamLibrary', 'steamapps', 'common', suffix));
    roots.push(path.join(`${letter}:`, 'Program Files', 'Steam', 'steamapps', 'common', suffix));
  }
  return roots;
}

export function modelSearchRoots(extra = []) {
  const home = os.homedir();
  const candidates = [
    ...extra,
    path.join(home, 'VTube Studio', 'Live2DModels'),
    path.join(home, 'Documents', 'VTube Studio', 'Live2DModels'),
    path.join(process.env.APPDATA || '', 'VTube Studio', 'Live2DModels'),
    path.join(process.env.LOCALAPPDATA || '', 'VTube Studio', 'Live2DModels'),
    path.join(process.env.LOCALAPPDATA || '', 'DenchiSoft', 'VTube Studio', 'Live2DModels'),
    path.join(process.env.LOCALAPPDATA || '', 'VTube Studio', 'UserData', 'Live2DModels'),
    ...steamVtsModelRoots(),
  ];
  return [...new Set(candidates.filter((p) => p && existsSync(p)))];
}

export function isLikelyPortrait(filePath) {
  if (!filePath || !existsSync(filePath)) return false;

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalized);

  if (/[\\/]textures?[\\/]|[\\/]moc[\\/]|[\\/]physics[\\/]|[\\/]motions?[\\/]|[\\/]expressions?[\\/]/.test(normalized)) {
    return false;
  }
  if (TEXTURE_RE.test(base)) return false;

  try {
    const { size } = statSync(filePath);
    if (size > 900_000) return false;
    if (size < 1024) return false;
  } catch {
    return false;
  }

  return IMAGE_EXT.test(base);
}

function listRootImageFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((ent) => ent.isFile() && IMAGE_EXT.test(ent.name))
      .map((ent) => path.join(dir, ent.name));
  } catch {
    return [];
  }
}

function readVtubeIconName(modelDir) {
  try {
    const vtubeFiles = readdirSync(modelDir).filter((name) => name.toLowerCase().endsWith('.vtube.json'));
    for (const name of vtubeFiles) {
      const raw = readFileSync(path.join(modelDir, name), 'utf-8');
      const json = JSON.parse(raw);
      const icon = String(
        json?.FileReferences?.Icon
        || json?.fileReferences?.icon
        || json?.Icon
        || '',
      ).trim();
      if (icon) return path.basename(icon);
    }
  } catch {
    /* ignore broken vtube.json */
  }
  return '';
}

function scorePortrait(filePath) {
  const base = path.basename(filePath).toLowerCase();
  let score = 0;

  if (/^icon\.(png|jpe?g|webp)$/.test(base)) score += 10_000;
  if (/icon|thumb|preview|avatar|model/.test(base)) score += 5_000;
  if (TEXTURE_RE.test(base)) score -= 20_000;

  try {
    const { size } = statSync(filePath);
    if (size >= 20_000 && size <= 600_000) score += 2_000;
    if (size > 700_000) score -= 5_000;
  } catch {
    return -1;
  }

  return score;
}

function pickBestPortrait(modelDir, iconName = '') {
  const candidates = new Set();

  const addCandidate = (filePath) => {
    if (filePath && isLikelyPortrait(filePath)) candidates.add(filePath);
  };

  const resolvedIcon = String(iconName || '').trim() || readVtubeIconName(modelDir);
  if (resolvedIcon) addCandidate(path.join(modelDir, resolvedIcon));

  for (const name of PREFERRED_ICON_NAMES) {
    addCandidate(path.join(modelDir, name));
  }

  for (const filePath of listRootImageFiles(modelDir)) {
    addCandidate(filePath);
  }

  const scored = [...candidates]
    .map((filePath) => ({ filePath, score: scorePortrait(filePath) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.filePath || null;
}

export function findModelDirectory({ modelName = '', vtsModelName = '' } = {}, extraRoots = []) {
  const roots = modelSearchRoots(extraRoots);
  const vtsFile = String(vtsModelName || '').trim();
  const name = String(modelName || '').trim();

  for (const root of roots) {
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const dir = path.join(root, ent.name);
      if (vtsFile && existsSync(path.join(dir, vtsFile))) return dir;
      if (name && ent.name.toLowerCase() === name.toLowerCase()) return dir;
    }
  }

  if (name) {
    for (const root of roots) {
      let entries = [];
      try {
        entries = readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }
      const hit = entries.find((ent) => ent.isDirectory()
        && ent.name.toLowerCase().includes(name.toLowerCase()));
      if (hit) return path.join(root, hit.name);
    }
  }

  return null;
}

export function cachePath(userDataPath) {
  return path.join(userDataPath, 'vtube-model-portrait.json');
}

export function clearPortraitCache(userDataPath) {
  if (!userDataPath) return;
  try {
    unlinkSync(cachePath(userDataPath));
  } catch {
    /* no cache */
  }
}

export function readPortraitCache(userDataPath) {
  try {
    const raw = JSON.parse(readFileSync(cachePath(userDataPath), 'utf-8'));
    if (!raw?.dataUrl) return null;

    const filePath = String(raw.filePath || '').trim();
    if (filePath) {
      if (!isLikelyPortrait(filePath)) {
        clearPortraitCache(userDataPath);
        return null;
      }
      return raw;
    }

    // Старый кэш без filePath — часто это была текстура Live2D.
    if (String(raw.dataUrl).length > 1_100_000) {
      clearPortraitCache(userDataPath);
      return null;
    }

    return raw;
  } catch {
    /* no cache */
  }
  return null;
}

export function writePortraitCache(userDataPath, payload) {
  mkdirSync(userDataPath, { recursive: true });
  writeFileSync(cachePath(userDataPath), JSON.stringify(payload, null, 2), 'utf-8');
}

export function findNewestPortrait(extraRoots = []) {
  const roots = modelSearchRoots(extraRoots);
  let best = null;

  for (const root of roots) {
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const modelDir = path.join(root, ent.name);
      const filePath = pickBestPortrait(modelDir);
      if (!filePath) continue;
      const mtime = statSync(filePath).mtimeMs;
      if (!best || mtime > best.mtime) {
        best = { filePath, mtime, modelName: ent.name, modelDir };
      }
    }
  }

  if (!best) return null;
  return {
    dataUrl: toDataUrl(best.filePath),
    source: 'disk-scan',
    modelName: best.modelName,
    filePath: best.filePath,
    modelDir: best.modelDir,
  };
}

export function resolvePortraitFromDisk({
  modelName = '',
  vtsModelName = '',
  iconName = '',
  manualPath = '',
  extraRoots = [],
} = {}) {
  const manual = String(manualPath || '').trim();
  if (manual && existsSync(manual) && isLikelyPortrait(manual)) {
    return {
      dataUrl: toDataUrl(manual),
      source: 'manual',
      modelName: modelName || path.basename(manual),
      filePath: manual,
    };
  }

  const modelDir = findModelDirectory({ modelName, vtsModelName }, extraRoots);
  if (!modelDir) return null;

  const filePath = pickBestPortrait(modelDir, iconName);
  if (!filePath) return null;

  return {
    dataUrl: toDataUrl(filePath),
    source: 'disk',
    modelName: modelName || path.basename(modelDir),
    filePath,
    modelDir,
  };
}
