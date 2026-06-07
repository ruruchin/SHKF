import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  getFigmaPath,
  launchFigmaWithDebug,
  focusFigmaWindow,
  isFigmaProcessRunning,
} from './figma-launcher.js';
import { playYandexMusicTrack } from './yandex-music-desktop.js';
import { buildDesktopSuggestion } from '../shared/desktop-agent-suggest.js';

const execFileAsync = promisify(execFile);

function localAppData() {
  return process.env.LOCALAPPDATA || '';
}

function appData() {
  return process.env.APPDATA || '';
}

function programFiles() {
  return process.env['ProgramFiles'] || 'C:\\Program Files';
}

function programFilesX86() {
  return process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
}

const APP_CATALOG = {
  figma: { type: 'figma' },
  фигма: { type: 'figma' },
  chrome: {
    paths: [
      join(programFiles(), 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData(), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
  },
  хром: {
    paths: [
      join(programFiles(), 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData(), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
  },
  edge: {
    paths: [
      join(programFilesX86(), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles(), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
  },
  cursor: {
    paths: [
      join(localAppData(), 'Programs', 'cursor', 'Cursor.exe'),
      join(localAppData(), 'Programs', 'Cursor', 'Cursor.exe'),
    ],
  },
  vscode: {
    paths: [
      join(localAppData(), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      join(programFiles(), 'Microsoft VS Code', 'Code.exe'),
    ],
  },
  code: {
    paths: [
      join(localAppData(), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      join(programFiles(), 'Microsoft VS Code', 'Code.exe'),
    ],
  },
  notepad: { cmd: 'notepad.exe' },
  блокнот: { cmd: 'notepad.exe' },
  explorer: { cmd: 'explorer.exe' },
  проводник: { cmd: 'explorer.exe' },
  calc: { cmd: 'calc.exe' },
  калькулятор: { cmd: 'calc.exe' },
  telegram: {
    paths: [
      join(appData(), 'Telegram Desktop', 'Telegram.exe'),
    ],
  },
  телеграм: {
    paths: [
      join(appData(), 'Telegram Desktop', 'Telegram.exe'),
    ],
  },
  discord: {
    paths: [
      join(localAppData(), 'Discord', 'Update.exe'),
      join(localAppData(), 'Discord', 'app-1.0.9', 'Discord.exe'),
    ],
    args: ['--processStart', 'Discord.exe'],
  },
  spotify: {
    paths: [
      join(appData(), 'Spotify', 'Spotify.exe'),
    ],
  },
  slack: {
    paths: [
      join(localAppData(), 'slack', 'slack.exe'),
    ],
  },
  powershell: { cmd: 'powershell.exe' },
  terminal: { cmd: 'wt.exe' },
  'windows terminal': { cmd: 'wt.exe' },
  'yandex music': {
    label: 'Яндекс Музыка',
    paths: [
      join(localAppData(), 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
      join(localAppData(), 'Programs', 'YandexMusic', 'YandexMusic.exe'),
      join(programFiles(), 'YandexMusic', 'YandexMusic.exe'),
    ],
  },
  'яндекс музыка': {
    label: 'Яндекс Музыка',
    paths: [
      join(localAppData(), 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
      join(localAppData(), 'Programs', 'YandexMusic', 'YandexMusic.exe'),
    ],
  },
  'яндекс музыку': {
    label: 'Яндекс Музыка',
    paths: [
      join(localAppData(), 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
      join(localAppData(), 'Programs', 'YandexMusic', 'YandexMusic.exe'),
    ],
  },
  'яндексмузыка': {
    label: 'Яндекс Музыка',
    paths: [
      join(localAppData(), 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
      join(localAppData(), 'Programs', 'YandexMusic', 'YandexMusic.exe'),
    ],
  },
  illustrator: {
    label: 'Adobe Illustrator',
    resolve: () => findAdobeExe('Adobe Illustrator', 'Illustrator.exe'),
  },
  иллюстратор: {
    label: 'Adobe Illustrator',
    resolve: () => findAdobeExe('Adobe Illustrator', 'Illustrator.exe'),
  },
  photoshop: {
    label: 'Adobe Photoshop',
    resolve: () => findAdobeExe('Adobe Photoshop', 'Photoshop.exe'),
  },
  фотошоп: {
    label: 'Adobe Photoshop',
    resolve: () => findAdobeExe('Adobe Photoshop', 'Photoshop.exe'),
  },
  'after effects': {
    label: 'Adobe After Effects',
    resolve: () => findAdobeExe('Adobe After Effects', 'AfterFX.exe'),
  },
  aftereffects: {
    label: 'Adobe After Effects',
    resolve: () => findAdobeExe('Adobe After Effects', 'AfterFX.exe'),
  },
  'after fx': {
    label: 'Adobe After Effects',
    resolve: () => findAdobeExe('Adobe After Effects', 'AfterFX.exe'),
  },
  'афтер эффектс': {
    label: 'Adobe After Effects',
    resolve: () => findAdobeExe('Adobe After Effects', 'AfterFX.exe'),
  },
  happ: {
    label: 'HApp',
    paths: [
      join(localAppData(), 'Programs', 'HApp', 'HApp.exe'),
      join(localAppData(), 'Programs', 'Happ', 'Happ.exe'),
      join(programFiles(), 'HApp', 'HApp.exe'),
      join(programFiles(), 'Happ', 'Happ.exe'),
    ],
  },
  nekobox: {
    label: 'NekoBox',
    paths: [
      join(programFiles(), 'NekoBox', 'nekobox.exe'),
      join(programFiles(), 'nekobox', 'nekobox.exe'),
      join(localAppData(), 'Programs', 'NekoBox', 'nekobox.exe'),
      join(localAppData(), 'nekobox', 'nekobox.exe'),
    ],
  },
  'amnezia vpn': {
    label: 'Amnezia VPN',
    paths: [
      join(programFiles(), 'AmneziaVPN', 'AmneziaVPN.exe'),
      join(localAppData(), 'Programs', 'AmneziaVPN', 'AmneziaVPN.exe'),
    ],
  },
  amnezia: {
    label: 'Amnezia VPN',
    paths: [
      join(programFiles(), 'AmneziaVPN', 'AmneziaVPN.exe'),
      join(localAppData(), 'Programs', 'AmneziaVPN', 'AmneziaVPN.exe'),
    ],
  },
  'амнезия': {
    label: 'Amnezia VPN',
    paths: [
      join(programFiles(), 'AmneziaVPN', 'AmneziaVPN.exe'),
      join(localAppData(), 'Programs', 'AmneziaVPN', 'AmneziaVPN.exe'),
    ],
  },
};

const FOLDER_PATHS = {
  downloads: () => join(process.env.USERPROFILE || '', 'Downloads'),
  desktop: () => join(process.env.USERPROFILE || '', 'Desktop'),
  documents: () => join(process.env.USERPROFILE || '', 'Documents'),
  pictures: () => join(process.env.USERPROFILE || '', 'Pictures'),
};

function findAdobeExe(productPrefix, exeName) {
  const adobeDir = join(programFiles(), 'Adobe');
  if (!existsSync(adobeDir)) return null;

  let folders = [];
  try {
    folders = readdirSync(adobeDir)
      .filter((d) => d.startsWith(productPrefix))
      .sort()
      .reverse();
  } catch {
    return null;
  }

  for (const folder of folders) {
    const base = join(adobeDir, folder);
    const candidates = [
      join(base, exeName),
      join(base, 'Support Files', exeName),
      join(base, 'Support Files', 'Contents', 'Windows', exeName),
    ];
    const found = findExistingPath(candidates);
    if (found) return found;
  }
  return null;
}

function resolveAppEntry(target) {
  const key = String(target || '').trim().toLowerCase();
  if (!key) return null;
  if (APP_CATALOG[key]) return { key, ...APP_CATALOG[key] };

  const aliases = Object.keys(APP_CATALOG).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (key === alias || key.includes(alias)) {
      return { key: alias, ...APP_CATALOG[alias] };
    }
  }
  return null;
}

export function buildPinterestSearchUrl(query) {
  const q = String(query || '').trim();
  if (!q) return 'https://www.pinterest.com/';
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
}

function findExistingPath(paths = []) {
  return paths.find((p) => p && existsSync(p)) || null;
}

async function spawnDetached(command, args = []) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
  });
  child.unref();
}

async function startViaCmd(target) {
  await new Promise((resolve, reject) => {
    const child = spawn('cmd', ['/c', 'start', '', target], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

export async function openApplication(target) {
  const key = String(target || '').trim().toLowerCase();
  const entry = resolveAppEntry(key);
  const label = entry?.label || key;

  if (entry?.type === 'figma') {
    return openFigma({ cdp: false });
  }

  if (entry?.cmd) {
    await spawnDetached(entry.cmd, entry.args || []);
    return { ok: true, action: 'open_app', target: key, message: `Запустил **${label}**.` };
  }

  if (typeof entry?.resolve === 'function') {
    const exe = entry.resolve();
    if (!exe) {
      throw new Error(`Не нашёл ${label} на этом компьютере. Проверьте установку Adobe.`);
    }
    await spawnDetached(exe, entry.args || []);
    return { ok: true, action: 'open_app', target: key, message: `Запустил **${label}**.` };
  }

  if (entry?.paths?.length) {
    const exe = findExistingPath(entry.paths);
    if (!exe) {
      throw new Error(`Не нашёл ${label} на этом компьютере. Укажите полный путь к .exe.`);
    }
    await spawnDetached(exe, entry.args || []);
    return { ok: true, action: 'open_app', target: key, message: `Запустил **${label}**.` };
  }

  if (/\.exe$/i.test(key) && existsSync(key)) {
    await spawnDetached(key);
    return { ok: true, action: 'open_app', target: key, message: `Запустил **${key}**.` };
  }

  const suggestion = buildDesktopSuggestion(key, key);
  if (suggestion.type === 'music' && suggestion.query) {
    return playYandexMusicTrack(suggestion.query);
  }
  if (suggestion.type === 'app' && suggestion.target) {
    return openApplication(suggestion.target);
  }
  throw new Error(suggestion.message.replace(/\*\*/g, ''));
}

export async function openPinterest(query) {
  const topic = String(query || '').trim();
  const url = buildPinterestSearchUrl(topic);
  await startViaCmd(url);
  if (topic) {
    return {
      ok: true,
      action: 'open_pinterest',
      target: topic,
      query: topic,
      message: `Открыл Pinterest по теме: **${topic}**.`,
    };
  }
  return {
    ok: true,
    action: 'open_pinterest',
    target: '',
    message: 'Открыл Pinterest. Уточни тему — например: «открой pinterest на тему fintech dashboard».',
  };
}

export async function openFigma({ cdp = false } = {}) {
  if (cdp) {
    const result = await launchFigmaWithDebug();
    return {
      ok: true,
      action: 'open_figma_cdp',
      target: 'figma',
      message: result.message || 'Figma запущена с CDP.',
    };
  }

  const running = await isFigmaProcessRunning();
  if (running) {
    await focusFigmaWindow();
    return { ok: true, action: 'open_app', target: 'figma', message: 'Figma уже была открыта — переключил фокус.' };
  }

  const figmaPath = getFigmaPath();
  if (!figmaPath) {
    throw new Error('Figma Desktop не найдена. Установите Figma для Windows.');
  }
  await spawnDetached(figmaPath);
  return { ok: true, action: 'open_app', target: 'figma', message: 'Запустил **Figma**.' };
}

export async function openUrl(url) {
  const normalized = String(url || '').trim();
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('Нужна ссылка вида https://...');
  }
  await startViaCmd(normalized);
  return { ok: true, action: 'open_url', target: normalized, message: `Открыл в браузере: ${normalized}` };
}

export async function openFolder(target) {
  const key = String(target || '').trim().toLowerCase();
  const resolver = FOLDER_PATHS[key];
  const folderPath = resolver ? resolver() : target;
  if (!folderPath || !existsSync(folderPath)) {
    throw new Error(`Папка не найдена: ${target}`);
  }
  await spawnDetached('explorer.exe', [folderPath]);
  return { ok: true, action: 'open_folder', target: folderPath, message: `Открыл папку: ${folderPath}` };
}

export async function focusWindow(target) {
  const key = String(target || '').trim().toLowerCase();
  if (/figma|фигма/.test(key)) {
    await focusFigmaWindow();
    return { ok: true, action: 'focus_window', target: key, message: 'Переключил фокус на **Figma**.' };
  }

  const ps = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    $pattern = '${key.replace(/'/g, "''")}'
    $p = Get-Process | Where-Object { $_.MainWindowTitle -match $pattern -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($p) {
      [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
      'ok'
    } else { 'notfound' }
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
  });
  if (stdout.trim() === 'notfound') {
    throw new Error(`Окно «${target}» не найдено. Сначала откройте приложение.`);
  }
  return { ok: true, action: 'focus_window', target: key, message: `Переключил фокус на **${target}**.` };
}

export async function executeDesktopAction(command) {
  if (process.platform !== 'win32') {
    throw new Error('Управление компьютером пока только для Windows.');
  }

  const action = String(command?.action || '').trim();
  const target = command?.target != null ? String(command.target).trim() : '';

  const query = command?.query != null ? String(command.query).trim() : '';

  switch (action) {
    case 'open_app':
      return openApplication(target);
    case 'open_figma_cdp':
      return openFigma({ cdp: true });
    case 'open_url':
      return openUrl(target);
    case 'open_pinterest':
      return openPinterest(query || target);
    case 'open_folder':
      return openFolder(target);
    case 'focus_window':
      return focusWindow(target);
    case 'play_yandex_music':
      return playYandexMusicTrack(query || target);
    default:
      throw new Error(`Неизвестное действие: ${action}`);
  }
}

export function listDesktopApps() {
  return Object.keys(APP_CATALOG);
}
