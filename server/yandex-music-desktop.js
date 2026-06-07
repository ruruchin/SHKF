import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  clickWindowRelative,
  focusWindow,
  isProcessRunning,
  maximizeWindow,
  playMediaSession,
  pressKey,
  sleep,
} from './windows-input.js';

const YANDEX_MUSIC_WINDOW = {
  titlePattern: 'Яндекс|Yandex|Музык',
  processPattern: 'Яндекс Музыка|YandexMusic',
  pathPattern: 'YandexMusic',
};

// Жёлтый Play в нижнем плеере (центр, правее сердечка-лайка)
const BOTTOM_PLAY_CANDIDATES = [
  [0.522, 0.968],
  [0.518, 0.965],
  [0.526, 0.968],
  [0.515, 0.962],
];

// Кнопка «Слушать» в правой панели трека (ниже иконки лайка)
const SIDEBAR_LISTEN_CANDIDATES = [
  [0.82, 0.41],
  [0.80, 0.43],
  [0.84, 0.40],
];

// «Слушать» в шапке альбома
const HEADER_LISTEN_CANDIDATES = [
  [0.50, 0.14],
  [0.48, 0.15],
];

const TRACK_CLICK_CANDIDATES = [
  [0.42, 0.28],
  [0.42, 0.34],
  [0.38, 0.31],
];

function localAppData() {
  return process.env.LOCALAPPDATA || '';
}

function programFiles() {
  return process.env['ProgramFiles'] || 'C:\\Program Files';
}

export function getYandexMusicExePath() {
  const candidates = [
    join(localAppData(), 'Programs', 'YandexMusic', 'Яндекс Музыка.exe'),
    join(localAppData(), 'Programs', 'YandexMusic', 'YandexMusic.exe'),
    join(programFiles(), 'YandexMusic', 'YandexMusic.exe'),
  ];
  return candidates.find((p) => p && existsSync(p)) || null;
}

export function buildYandexMusicSearchUrl(query) {
  const q = String(query || '').trim();
  return `https://music.yandex.ru/search?text=${encodeURIComponent(q)}`;
}

export function buildYandexMusicTrackUrl(albumId, trackId) {
  return `https://music.yandex.ru/album/${albumId}/track/${trackId}`;
}

export function buildYandexMusicDeepLink(albumId, trackId) {
  return `yandexmusic://album/${albumId}/track/${trackId}`;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9',
};

async function fetchYandexHtml(url) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return '';
  return res.text();
}

async function enrichTrackMetadata(track, fallbackQuery) {
  const html = await fetchYandexHtml(track.trackUrl);
  if (!html) return track;

  const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1]?.trim();
  const ogDesc = html.match(/property="og:description" content="([^"]+)"/)?.[1]?.trim();
  const artist = ogDesc?.split('•')?.[0]?.trim() || track.artist;

  return {
    ...track,
    title: ogTitle && ogTitle !== 'default' ? ogTitle : (track.title || fallbackQuery),
    artist: artist && artist !== 'Unknown' ? artist : track.artist,
  };
}

/**
 * Resolve first track from public search page HTML (no API key).
 */
export async function resolveYandexMusicTrack(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  const searchUrl = buildYandexMusicSearchUrl(q);
  const html = await fetchYandexHtml(searchUrl);
  const trackMatch = html.match(/album\/(\d+)\/track\/(\d+)/);
  if (!trackMatch) return null;

  const base = {
    albumId: trackMatch[1],
    trackId: trackMatch[2],
    title: q,
    artist: '',
    searchUrl,
    trackUrl: buildYandexMusicTrackUrl(trackMatch[1], trackMatch[2]),
    deepLink: buildYandexMusicDeepLink(trackMatch[1], trackMatch[2]),
  };

  return enrichTrackMetadata(base, q);
}

async function launchYandexMusicWithUrl(url) {
  const exe = getYandexMusicExePath();
  if (!exe) {
    throw new Error('Яндекс Музыка не найдена. Установите desktop-приложение для Windows.');
  }

  const child = spawn(exe, [url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return exe;
}

async function prepareYandexMusicWindow() {
  await maximizeWindow(YANDEX_MUSIC_WINDOW);
  for (let i = 0; i < 14; i++) {
    if (await focusWindow(YANDEX_MUSIC_WINDOW)) {
      await sleep(450);
      return true;
    }
    await sleep(300);
  }
  return false;
}

async function clickCandidates(candidates) {
  for (const [x, y] of candidates) {
    if (await clickWindowRelative('', x, y, YANDEX_MUSIC_WINDOW)) {
      await sleep(650);
      return true;
    }
    await sleep(100);
  }
  return false;
}

async function startPlayback() {
  // 1) Windows SMTC — только Play, без кликов по UI
  if (await playMediaSession('Yandex|Music|Музык')) {
    await sleep(500);
    return true;
  }

  // 2) Медиаклавиша Play (не Play/Pause — не лайк и не toggle)
  await pressKey('MEDIA_PLAY');
  await sleep(550);

  // 3) Жёлтая кнопка Play внизу (не сердечко слева от неё)
  if (await clickCandidates(BOTTOM_PLAY_CANDIDATES)) return true;

  // 4) «Слушать» в боковой панели / шапке
  if (await clickCandidates(SIDEBAR_LISTEN_CANDIDATES)) return true;
  if (await clickCandidates(HEADER_LISTEN_CANDIDATES)) return true;

  await pressKey('MEDIA_PLAY');
  await sleep(400);
  return true;
}

async function fallbackClickFirstSearchResult() {
  for (const [x, y] of TRACK_CLICK_CANDIDATES) {
    if (await clickWindowRelative('', x, y, YANDEX_MUSIC_WINDOW)) {
      await sleep(500);
      await startPlayback();
      return true;
    }
  }
  return false;
}

async function openTrackInDesktop(track) {
  const urls = [track.deepLink, track.trackUrl, track.searchUrl].filter(Boolean);
  for (const url of urls) {
    try {
      await launchYandexMusicWithUrl(url);
      return url;
    } catch {
      /* try next */
    }
  }
  throw new Error('Не удалось открыть трек в Яндекс Музыке.');
}

function formatTrackLabel(track, fallbackQuery) {
  if (track?.artist && track?.title) return `${track.artist} — «${track.title}»`;
  if (track?.title) return track.title;
  return fallbackQuery;
}

/**
 * Open Yandex Music desktop and play track matching query.
 */
export async function playYandexMusicTrack(searchQuery) {
  if (process.platform !== 'win32') {
    throw new Error('Воспроизведение в Яндекс Музыке пока только для Windows.');
  }

  const query = String(searchQuery || '').trim();
  if (!query) {
    throw new Error('Укажите название трека или исполнителя.');
  }

  let track = await resolveYandexMusicTrack(query);
  const wasRunning = await isProcessRunning(YANDEX_MUSIC_WINDOW.processPattern);

  if (track) {
    const opened = await openTrackInDesktop(track);
    await sleep(wasRunning ? 4000 : 7000);
    const focused = await prepareYandexMusicWindow();
    if (!focused) {
      throw new Error('Не удалось переключиться на окно Яндекс Музыки.');
    }
    await startPlayback();

    const label = formatTrackLabel(track, query);
    return {
      ok: true,
      action: 'play_yandex_music',
      query,
      track,
      url: opened,
      message: `Включаю в Яндекс Музыке: **${label}**.`,
    };
  }

  // Запасной путь: страница поиска + клик по первому результату
  const searchUrl = buildYandexMusicSearchUrl(query);
  await launchYandexMusicWithUrl(searchUrl);
  await sleep(wasRunning ? 5000 : 9000);
  const focused = await prepareYandexMusicWindow();
  if (!focused) {
    throw new Error('Не удалось переключиться на окно Яндекс Музыки.');
  }
  await fallbackClickFirstSearchResult();

  return {
    ok: true,
    action: 'play_yandex_music',
    query,
    url: searchUrl,
    message: `Включаю в Яндекс Музыке: **${query}** (поиск без точного ID).`,
  };
}

export async function playYandexMusicDirect({ albumId, trackId, label = '' } = {}) {
  if (!albumId || !trackId) {
    throw new Error('Нужны albumId и trackId для прямого воспроизведения.');
  }
  const track = {
    albumId: String(albumId),
    trackId: String(trackId),
    title: label,
    trackUrl: buildYandexMusicTrackUrl(albumId, trackId),
    deepLink: buildYandexMusicDeepLink(albumId, trackId),
  };
  const opened = await openTrackInDesktop(track);
  await sleep(5000);
  await prepareYandexMusicWindow();
  await startPlayback();

  return {
    ok: true,
    action: 'play_yandex_music',
    query: label || `${albumId}/${trackId}`,
    track,
    url: opened,
    message: `Включаю в Яндекс Музыке: **${label || 'трек'}**.`,
  };
}
