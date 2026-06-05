#!/usr/bin/env node
/**
 * Export Konstancia training rows for HF fine-tuning (intent JSONL).
 * Merges seed data + optional feedback file config/agent-training-feedback.jsonl
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'ml', 'data', 'konstancia-intents.jsonl');
const FEEDBACK = path.join(ROOT, 'config', 'agent-training-feedback.jsonl');
const OUT = path.join(ROOT, 'ml', 'data', 'konstancia-intents.merged.jsonl');

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

const rows = [...readJsonl(SEED), ...readJsonl(FEEDBACK)];
const seen = new Set();
const unique = [];
for (const row of rows) {
  const key = `${row.label}::${String(row.text || '').trim().toLowerCase()}`;
  if (!row.text || !row.label || seen.has(key)) continue;
  seen.add(key);
  unique.push({ text: String(row.text).trim(), label: String(row.label).trim() });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, unique.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`Wrote ${unique.length} rows -> ${OUT}`);
