/**
 * Org-wide secrets bundled with SHKF releases (main process only).
 * Loaded from resources/org-secrets.json — not exposed to renderer or settings UI.
 */
import fs from 'fs';

export const ORG_SECRET_KEYS = [
  'KONSTANCIA_YANDEX_API_KEY',
  'KONSTANCIA_YANDEX_FOLDER_ID',
  'KONSTANCIA_CLOUD_URL',
  'KONSTANCIA_CLOUD_API_KEY',
  'CURSOR_API_KEY',
  'MOBBIN_API_KEY',
  'NANOBANANA_API_KEY',
];

function readSecretsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Apply bundled org secrets to process.env (skip keys already set unless override). */
export function applyOrgSecrets({ paths = [], override = false } = {}) {
  const applied = [];
  for (const filePath of paths) {
    const parsed = readSecretsFile(filePath);
    if (!parsed) continue;
    for (const key of ORG_SECRET_KEYS) {
      const value = String(parsed[key] || '').trim();
      if (!value) continue;
      if (!override && process.env[key]) continue;
      process.env[key] = value;
      if (!applied.includes(key)) applied.push(key);
    }
  }
  return applied;
}
