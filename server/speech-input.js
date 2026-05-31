import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import electron from 'electron';

const electronApp = electron.app;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePsScript() {
  const candidates = [];
  if (electronApp?.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'scripts', 'speech-once.ps1'));
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'speech-once.ps1'));
  }
  candidates.push(path.join(__dirname, '..', 'scripts', 'speech-once.ps1'));
  return candidates.find((candidate) => existsSync(candidate)) || candidates[candidates.length - 1];
}

const PS_SCRIPT = resolvePsScript();

let activeProcess = null;
let activeReject = null;

const KNOWN_SPEECH_LANGS = ['ru-RU', 'en-US', 'uk-UA', 'de-DE'];

function mapLang(lang) {
  const value = String(lang || 'ru-RU').trim();
  if (KNOWN_SPEECH_LANGS.includes(value)) return value;
  if (value.startsWith('en')) return 'en-US';
  if (value.startsWith('ru')) return 'ru-RU';
  if (value.startsWith('uk')) return 'uk-UA';
  if (value.startsWith('de')) return 'de-DE';
  return value;
}

function missingSpeechLangMessage(requestedLang, installed = []) {
  const installedText = installed.length ? installed.join(', ') : 'нет';
  return (
    `На компьютере не установлено распознавание для «${requestedLang}». `
    + `Доступно: ${installedText}. `
    + 'Установите русский: Параметры Windows → Время и язык → Речь → '
    + 'Управление голосовыми функциями → Добавить языки → Русский → '
    + 'скачайте «Распознавание речи». '
    + 'Или выберите English (en-US) в настройках FIRURU.'
  );
}

export function cancelSpeechRecognition() {
  if (!activeProcess) return;
  const proc = activeProcess;
  activeProcess = null;
  try {
    proc.kill();
  } catch { /* ignore */ }
  if (activeReject) {
    activeReject(Object.assign(new Error('cancelled'), { code: 'cancelled' }));
    activeReject = null;
  }
}

export function isSpeechRecognitionSupported() {
  return process.platform === 'win32';
}

function formatSpeechError(stderr, requestedLang) {
  const raw = String(stderr || '').trim();
  if (raw === 'SPEECH_NONE' || /installed recognizers/i.test(raw)) {
    return 'На этом компьютере не установлено распознавание речи Windows. Откройте Параметры → Время и язык → Речь и добавьте язык.';
  }
  if (raw.startsWith('SPEECH_MISSING:')) {
    const rest = raw.slice('SPEECH_MISSING:'.length);
    const [missingLang, installedList] = rest.split('|');
    const installed = installedList ? installedList.split(',').map((item) => item.trim()).filter(Boolean) : [];
    return missingSpeechLangMessage(missingLang || requestedLang, installed);
  }
  if (/No recognizer/i.test(raw)) {
    return missingSpeechLangMessage(requestedLang);
  }
  return raw || 'Не удалось распознать речь';
}

export function listInstalledSpeechLanguages() {
  if (process.platform !== 'win32') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT,
      '-ListOnly',
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    proc.on('error', () => resolve([]));
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }
      const line = stdout.split(/\r?\n/).map((item) => item.trim()).find((item) => item.startsWith('LIST:'));
      const list = line
        ? line.slice('LIST:'.length).split(',').map((item) => item.trim()).filter(Boolean)
        : [];
      resolve(list);
    });
  });
}

export function missingSpeechLangMessageFor(requestedLang, installed = []) {
  return missingSpeechLangMessage(mapLang(requestedLang), installed);
}

export function recognizeSpeechOnce({ lang = 'ru-RU', timeoutSec = 90, onInterim } = {}) {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Голосовой ввод поддерживается только в Windows'));
  }

  cancelSpeechRecognition();

  return new Promise((resolve, reject) => {
    activeReject = reject;
    const mappedLang = mapLang(lang);
    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT,
      '-Lang', mappedLang,
      '-TimeoutSec', String(Math.max(5, Number(timeoutSec) || 90)),
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeProcess = proc;
    let stdout = '';
    let stderr = '';
    let lineBuffer = '';

    proc.stdout.on('data', (chunk) => {
      const piece = chunk.toString('utf8');
      stdout += piece;
      lineBuffer += piece;
      const parts = lineBuffer.split(/\r?\n/);
      lineBuffer = parts.pop() || '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed.startsWith('INTERIM:') && onInterim) {
          onInterim(trimmed.slice('INTERIM:'.length).trim());
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    proc.on('error', (err) => {
      if (activeProcess === proc) activeProcess = null;
      activeReject = null;
      reject(err);
    });

    proc.on('close', (code) => {
      if (activeProcess === proc) activeProcess = null;
      activeReject = null;

      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const langLine = lines.find((line) => line.startsWith('LANG:'));
      const usedLang = langLine ? langLine.slice('LANG:'.length).trim() : '';
      const finalLine = [...lines].reverse().find((line) => line.startsWith('FINAL:'));
      const interimLines = lines.filter((line) => line.startsWith('INTERIM:'));
      const interim = interimLines.length
        ? interimLines[interimLines.length - 1].slice('INTERIM:'.length).trim()
        : '';
      const finalText = finalLine ? finalLine.slice('FINAL:'.length).trim() : '';

      if (code === null) {
        reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }));
        return;
      }

      if (code !== 0) {
        reject(new Error(formatSpeechError(stderr, mappedLang)));
        return;
      }

      if (usedLang && usedLang !== mappedLang) {
        reject(new Error(missingSpeechLangMessage(mappedLang, [usedLang])));
        return;
      }

      resolve({ text: finalText || interim, interim, final: finalText, lang: usedLang || mappedLang });
    });
  });
}
