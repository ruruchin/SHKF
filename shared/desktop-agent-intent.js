/** Detect and parse desktop control commands (open apps, URLs, folders). */

import { isPlayMusicIntent } from './agent-music-triggers.js';
import { isKnownDesktopApp } from './desktop-agent-suggest.js';

const OPEN_PINTEREST_RE = /^(?:открой|запусти|включи|открыть|запустить|launch|open|start)\s+(?:pinterest|пинтерест)(?:\s+(?:на\s+тему|про|по\s+теме|по\s+запросу|для|поиск(?:ать)?|search))?\s*(.*)$/i;
const OPEN_APP_RE = /^(?:открой|запусти|включи|открыть|запустить|включить|launch|open|start|run)\s+(?:приложение\s+|прог(?:у|рамму)\s+)?(.+?)(?:[.!?]|$)/i;
const OPEN_URL_RE = /^(?:открой|перейди|зайди|open|go to)\s+(?:сайт\s+|url\s+|ссылку\s+)?(https?:\/\/\S+)/i;
const OPEN_FOLDER_RE = /^(?:открой|покажи|open)\s+(?:папку\s+)?(.+?)(?:[.!?]|$)/i;
const FOCUS_RE = /^(?:переключись|переключи|фокус|focus)\s+(?:на\s+)?(.+?)(?:[.!?]|$)/i;

const FOLDER_ALIASES = {
  downloads: ['downloads', 'загрузки'],
  desktop: ['desktop', 'рабочий стол', 'рабочийстол'],
  documents: ['documents', 'документы'],
  pictures: ['pictures', 'изображения', 'картинки'],
};

const DESKTOP_BLOCK_RE = /<<<DESKTOP\s*([\s\S]*?)\s*DESKTOP>>>/i;

export function isDesktopControlQuery(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isPlayMusicIntent(t)) return false;
  if (OPEN_URL_RE.test(t)) return true;
  if (OPEN_PINTEREST_RE.test(t)) return true;
  if (FOCUS_RE.test(t)) return true;
  if (OPEN_FOLDER_RE.test(t) && looksLikeFolderIntent(t)) return true;
  if (OPEN_APP_RE.test(t) && !looksLikeKnowledgeQuestion(t)) return true;
  return false;
}

function cleanPinterestQuery(raw) {
  return String(raw || '')
    .trim()
    .replace(/^["'`«]|["'`»]$/g, '')
    .replace(/[.!?]+$/, '')
    .trim();
}

function looksLikeFolderIntent(text) {
  const m = text.match(OPEN_FOLDER_RE);
  if (!m) return false;
  const target = normalizeTarget(m[1]);
  if (resolveFolderAlias(target)) return true;
  return /[\\/]|^[a-z]:/i.test(target) || target.includes('папк');
}

function looksLikeKnowledgeQuestion(text) {
  return /^(?:что|как|где|когда|почему|зачем|кто|какой|какая|какие|расскажи|объясни)\b/i.test(text);
}

function normalizeTarget(raw) {
  return String(raw || '')
    .trim()
    .replace(/^["'`«]|["'`»]$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function resolveFolderAlias(target) {
  for (const [key, aliases] of Object.entries(FOLDER_ALIASES)) {
    if (aliases.some((a) => target === a || target.includes(a))) return key;
  }
  return null;
}

export function parseDesktopCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (isPlayMusicIntent(raw)) return null;

  const urlMatch = raw.match(OPEN_URL_RE);
  if (urlMatch) {
    return { action: 'open_url', target: urlMatch[1].replace(/[.,;]+$/, '') };
  }

  const pinterestMatch = raw.match(OPEN_PINTEREST_RE);
  if (pinterestMatch) {
    const query = cleanPinterestQuery(pinterestMatch[1]);
    return { action: 'open_pinterest', target: 'pinterest', query };
  }

  const focusMatch = raw.match(FOCUS_RE);
  if (focusMatch) {
    const target = normalizeTarget(focusMatch[1]);
    if (target) return { action: 'focus_window', target };
  }

  const folderMatch = raw.match(OPEN_FOLDER_RE);
  if (folderMatch && looksLikeFolderIntent(raw)) {
    const target = normalizeTarget(folderMatch[1]);
    const alias = resolveFolderAlias(target);
    return { action: 'open_folder', target: alias || target };
  }

  const appMatch = raw.match(OPEN_APP_RE);
  if (appMatch && !looksLikeKnowledgeQuestion(raw)) {
    let target = normalizeTarget(appMatch[1]);
    target = target
      .replace(/\s+с\s+cdp$/, '')
      .replace(/\s+debug$/, '')
      .trim();
    if (!target) return null;
    if (/^(?:pinterest|пинтерест)\b/.test(target)) {
      const query = cleanPinterestQuery(target.replace(/^(?:pinterest|пинтерест)\s*/, ''));
      return { action: 'open_pinterest', target: 'pinterest', query };
    }
    if (/^(?:в\s+)?яндекс(?:\s+музык[аеу])?\s+/.test(target)) {
      const query = cleanPinterestQuery(target.replace(/^(?:в\s+)?яндекс(?:\s+музык[аеу])?\s+/, ''));
      return { action: 'play_yandex_music', target: 'yandex music', query };
    }
    if (/^(?:поставь|включи|запусти|играй|play)\b/.test(raw) && !isKnownDesktopApp(target)) {
      return { action: 'play_yandex_music', target: 'yandex music', query: target };
    }
    const withCdp = /\bcdp\b|debug/i.test(raw) && /figma|фигма/i.test(target);
    return { action: withCdp ? 'open_figma_cdp' : 'open_app', target };
  }

  return null;
}

export function extractDesktopToolFromResponse(content) {
  const match = String(content || '').match(DESKTOP_BLOCK_RE);
  if (!match) return null;

  const attempts = [match[1].trim()];
  const jsonMatch = match[1].match(/\{[\s\S]*\}/);
  if (jsonMatch) attempts.push(jsonMatch[0]);

  for (const chunk of attempts) {
    try {
      const parsed = JSON.parse(chunk);
      const action = String(parsed?.action || '').trim();
      const target = parsed?.target != null ? String(parsed.target).trim() : '';
      const query = parsed?.query != null ? String(parsed.query).trim() : '';
      if (!action) continue;
      return { action, target, query };
    } catch { /* next */ }
  }
  return null;
}

export function stripDesktopToolFromResponse(content) {
  return String(content || '')
    .replace(DESKTOP_BLOCK_RE, '')
    .replace(/<<<DESKTOP[\s\S]*?DESKTOP>>>/gi, '')
    .trim();
}
