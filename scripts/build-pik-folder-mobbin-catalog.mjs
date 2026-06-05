#!/usr/bin/env node
/**
 * Собирает config/pik-folder.mobbin-catalog.json из Mobbin API.
 * Берёт API key из config/hotkeys.json → settings.agent.mobbinApiKey
 *
 * node scripts/build-pik-folder-mobbin-catalog.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { MobbinService } from '../server/mobbin-service.js';
import {
  buildMobbinCatalog,
  saveMobbinCatalog,
} from '../server/pik-folder-mobbin-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadMobbinKey() {
  const configPath = path.join(root, 'config', 'hotkeys.json');
  if (!existsSync(configPath)) {
    console.error('Нет config/hotkeys.json');
    process.exit(1);
  }
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  const key = String(cfg?.settings?.agent?.mobbinApiKey || '').trim();
  if (!key) {
    console.error('Укажите settings.agent.mobbinApiKey в config/hotkeys.json');
    process.exit(1);
  }
  return key;
}

async function main() {
  const mobbin = new MobbinService();
  mobbin.configure({ mobbinApiKey: loadMobbinKey(), mobbinEnabled: true });

  const outPath = path.join(root, 'config', 'pik-folder.mobbin-catalog.json');
  const designRefsPath = path.join(root, 'config', 'design-references.seed.json');

  console.log('Сборка каталога Mobbin →', outPath);
  console.log('(это займёт несколько минут)\n');

  const catalog = await buildMobbinCatalog({
    mobbinService: mobbin,
    designRefsPath,
    onProgress: (msg) => console.log(msg),
    perQueryLimit: 28,
    delayMs: 200,
  });

  saveMobbinCatalog(outPath, catalog);

  console.log('\nГотово:', catalog.items.length, 'референсов');
  console.log('По темам:', JSON.stringify(catalog.stats?.byTopic || {}, null, 2));
  console.log('Файл:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
