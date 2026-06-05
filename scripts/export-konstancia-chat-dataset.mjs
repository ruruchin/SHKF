#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'ml', 'data', 'konstancia-chat.jsonl');
const FEEDBACK = path.join(ROOT, 'config', 'konstancia-chat-feedback.jsonl');
const OUT = path.join(ROOT, 'ml', 'data', 'konstancia-chat.merged.jsonl');

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
  if (!Array.isArray(row.messages) || row.messages.length < 2) continue;
  const key = JSON.stringify(row.messages.map((m) => `${m.role}:${m.content}`));
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push({ messages: row.messages });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, unique.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`Wrote ${unique.length} chat dialogs -> ${OUT}`);
