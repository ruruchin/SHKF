#!/usr/bin/env node
/**
 * Run Python with a real interpreter on Windows (avoids WindowsApps python stub).
 *
 *   node scripts/run-python.mjs ml/train_chat_model.py
 *   set SHKF_PYTHON=C:\...\python.exe
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/run-python.mjs <script.py> [args...]');
  process.exit(1);
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function candidates() {
  const list = [];
  if (process.env.SHKF_PYTHON) list.push(process.env.SHKF_PYTHON);
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    list.push(path.join(local, 'Programs', 'Python', 'Python312', 'python.exe'));
    list.push(path.join(local, 'Programs', 'Python', 'Python311', 'python.exe'));
    list.push('py');
  }
  list.push('python3', 'python');
  return [...new Set(list.filter(Boolean))];
}

const ROOT = path.resolve(__dirname, '..');
const CWD = process.env.SHKF_PYTHON_CWD
  ? path.resolve(ROOT, process.env.SHKF_PYTHON_CWD)
  : ROOT;

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    cwd: CWD,
    env: process.env,
    shell: false,
  });
  if (r.error?.code === 'ENOENT') return null;
  return r.status ?? 1;
}

let status = 1;
let ran = false;
for (const cmd of candidates()) {
  if (cmd !== 'py' && cmd !== 'python' && cmd !== 'python3' && !exists(cmd)) continue;
  const cmdArgs = cmd === 'py' ? ['-3', ...args] : args;
  const code = run(cmd, cmdArgs);
  if (code === null) continue;
  ran = true;
  status = code;
  break;
}

if (!ran) {
  console.error('\nPython not found. Install Python 3.12 or set SHKF_PYTHON to python.exe path.');
}
process.exit(status);
