#!/usr/bin/env node
/**
 * Ingest curated web sources into Konstancia knowledge store + training datasets.
 *
 *   node scripts/ingest-knowledge-sources.mjs
 *   node scripts/ingest-knowledge-sources.mjs --ids habr-ml-resources,wiki-ml-ru
 */
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowledgeIngestService } from '../server/knowledge-ingest-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const userData = path.join(os.homedir(), '.shkf-knowledge-ingest');

const args = process.argv.slice(2);
let sourceIds = null;
const idsIdx = args.indexOf('--ids');
if (idsIdx !== -1 && args[idsIdx + 1]) {
  sourceIds = args[idsIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);
}

const service = new KnowledgeIngestService(userData, { agentService: null });
console.log('Konstancia knowledge ingest — sources from config/konstancia-knowledge-sources.json');
const result = await service.ingestAll({
  sourceIds,
  onProgress: (p) => console.log(`[${p.index}/${p.total}] ${p.title}`),
});
console.log(JSON.stringify({
  ingested: result.ingested,
  failed: result.failed,
  stats: result.stats,
  export: result.export,
  failures: result.results.filter((r) => !r.ok),
}, null, 2));
