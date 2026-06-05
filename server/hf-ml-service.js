import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ML_DIR = path.join(ROOT, 'ml');
const INFERENCE = path.join(ML_DIR, 'inference.py');
const INTENT_MODEL = path.join(ML_DIR, 'models', 'konstancia-intent');

function resolvePythonCmd() {
  if (process.env.SHKF_PYTHON) return process.env.SHKF_PYTHON;
  const localApp = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localApp, 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(localApp, 'Programs', 'Python', 'Python311', 'python.exe'),
    'python',
  ];
  for (const cmd of candidates) {
    if (cmd === 'python' || fs.existsSync(cmd)) return cmd;
  }
  return 'python';
}

let pythonCmd = resolvePythonCmd();
let intentModelReady = null;

function runPython(args, { timeoutMs = 45000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, args, {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('HF inference timeout'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `python exit ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export function isIntentModelReady() {
  if (intentModelReady !== null) return intentModelReady;
  intentModelReady = fs.existsSync(INTENT_MODEL)
    && fs.existsSync(path.join(INTENT_MODEL, 'config.json'));
  return intentModelReady;
}

export async function classifyIntent(text) {
  const query = String(text || '').trim();
  if (!query) return { ok: false, message: 'empty query' };
  try {
    const raw = await runPython([INFERENCE, 'intent', query], { timeoutMs: 120000 });
    return JSON.parse(raw);
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export async function embedQuery(text) {
  const query = String(text || '').trim();
  if (!query) return { ok: false, message: 'empty query' };
  try {
    const raw = await runPython([INFERENCE, 'embed', query], { timeoutMs: 60000 });
    return JSON.parse(raw);
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export function getMlStatus() {
  return {
    python: pythonCmd,
    intentModelReady: isIntentModelReady(),
    intentModelPath: INTENT_MODEL,
    retrievalModelReady: fs.existsSync(path.join(ML_DIR, 'models', 'konstancia-retrieval')),
  };
}
