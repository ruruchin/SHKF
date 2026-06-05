import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ML_DIR = path.join(ROOT, 'ml');
const INFERENCE_CHAT = path.join(ML_DIR, 'inference_chat.py');
const CHAT_MODEL = path.join(ML_DIR, 'models', 'konstancia-chat');

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
let statusCache = null;
let cloudConfig = { url: '', apiKey: '' };

export function configureKonstanciaCloud({ url = '', apiKey = '' } = {}) {
  cloudConfig = {
    url: String(url || '').trim().replace(/\/+$/, ''),
    apiKey: String(apiKey || '').trim(),
  };
}

function useCloud() {
  return !!cloudConfig.url;
}

async function cloudFetch(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cloudConfig.apiKey) headers.Authorization = `Bearer ${cloudConfig.apiKey}`;
  const res = await fetch(`${cloudConfig.url}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.detail || json.message || `cloud HTTP ${res.status}`);
  }
  return json;
}

function runPython(args, { timeoutMs = 300000, input = null } = {}) {
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
      reject(new Error('Konstancia LLM timeout'));
    }, timeoutMs);
    if (input) child.stdin.write(input);
    child.stdin.end();
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

export function isKonstanciaLlmTrained() {
  return fs.existsSync(CHAT_MODEL)
    && (fs.existsSync(path.join(CHAT_MODEL, 'adapter_config.json'))
      || fs.existsSync(path.join(CHAT_MODEL, 'config.json')));
}

export function isKonstanciaLlmReady() {
  return fs.existsSync(INFERENCE_CHAT);
}

export async function getKonstanciaLlmStatus() {
  if (useCloud()) {
    try {
      const headers = cloudConfig.apiKey ? { Authorization: `Bearer ${cloudConfig.apiKey}` } : {};
      const res = await fetch(`${cloudConfig.url}/status`, { headers });
      const parsed = await res.json();
      return { ...parsed, mode: 'cloud', cloudUrl: cloudConfig.url };
    } catch (err) {
      return { ok: false, ready: false, mode: 'cloud', message: err?.message || String(err) };
    }
  }
  try {
    const raw = await runPython([INFERENCE_CHAT, 'status'], { timeoutMs: 15000 });
    const parsed = JSON.parse(raw);
    statusCache = parsed;
    return { ...parsed, python: pythonCmd };
  } catch (err) {
    return {
      ok: false,
      ready: false,
      trained: false,
      python: pythonCmd,
      message: err?.message || String(err),
    };
  }
}

export async function konstanciaChat({ messages = [], maxTokens = 640, temperature = 0.75 } = {}) {
  if (useCloud()) {
    try {
      const parsed = await cloudFetch('/v1/chat', {
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      return {
        ok: true,
        content: parsed.content,
        model: parsed.model || 'konstancia-cloud',
        followups: [],
        usage: null,
      };
    } catch (err) {
      return { ok: false, message: err?.message || String(err) };
    }
  }
  const payload = JSON.stringify({
    messages,
    max_tokens: maxTokens,
    temperature,
  });
  try {
    const raw = await runPython([INFERENCE_CHAT, 'chat', payload], { timeoutMs: 300000 });
    const parsed = JSON.parse(raw);
    if (!parsed.ok && !parsed.content) {
      return { ok: false, message: parsed.message || 'empty Konstancia response' };
    }
    return {
      ok: true,
      content: parsed.content,
      model: parsed.model || 'konstancia',
      followups: [],
      usage: null,
    };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export async function konstanciaEmbed(texts = []) {
  const list = (Array.isArray(texts) ? texts : [])
    .map((t) => String(t || '').slice(0, 3500))
    .filter((t) => t.trim());
  if (!list.length) return null;
  if (useCloud()) {
    try {
      const parsed = await cloudFetch('/v1/embed', { texts: list });
      return Array.isArray(parsed.vectors) ? parsed.vectors : null;
    } catch {
      return null;
    }
  }
  try {
    const payload = JSON.stringify({ texts: list });
    const raw = await runPython([INFERENCE_CHAT, 'embed', payload], { timeoutMs: 120000 });
    const parsed = JSON.parse(raw);
    if (!parsed.ok || !Array.isArray(parsed.vectors)) return null;
    return parsed.vectors;
  } catch {
    return null;
  }
}
