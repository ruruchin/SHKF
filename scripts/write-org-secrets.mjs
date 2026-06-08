/**
 * Writes config/org-secrets.json from env vars before electron-builder.
 * CI: GitHub Actions secrets → env → this script → bundled in installer.
 * Local: copy .env.example values or export vars, then npm run secrets:org
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ORG_SECRET_KEYS } from '../server/load-org-secrets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'config', 'org-secrets.json');

const payload = {};
for (const key of ORG_SECRET_KEYS) {
  const value = String(process.env[key] || '').trim();
  if (value) payload[key] = value;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const names = Object.keys(payload);
console.log(`[org-secrets] wrote ${outPath} (${names.length} key(s): ${names.join(', ') || 'none — Konstancia will need admin .env override'})`);
