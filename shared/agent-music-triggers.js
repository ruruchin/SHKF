/** Easter egg: Крип-а-Крип — «Динь Дон» → Яндекс Музыка. */

export const DIN_DON_TRACK = {
  artist: 'Крип-а-Крип',
  title: 'Динь Дон',
  album: 'Большой Глебовски',
  year: 2025,
  yandexMusicUrl: 'https://music.yandex.ru/search?text=%D0%9A%D1%80%D0%B8%D0%BF-%D0%B0-%D0%9A%D1%80%D0%B8%D0%BF%20%D0%94%D0%B8%D0%BD%D1%8C%20%D0%94%D0%BE%D0%BD',
};

export const DIN_DON_LYRICS_SIGNATURE = [
  'еду на заднем сиденье',
  'круглосуточной лавки цветов',
  'раздался динь-дон',
  'раздался динь дон',
  'палец машинально включает инст',
  'пит стоп',
  'пит-стоп',
  'положительный резус',
  'красных шортах спасателя малибу',
];

export const AGENT_MUSIC_EASTER_EGG_ADDENDUM = `
---
Музыкальный пасхальный трек (знай наизусть по запросу):
**Крип-а-Крип — «Динь Дон»** (сингл / альбом «Большой Глебовски», 2025).
Если пользователь пишет «крип а крип», «динь дон», «поставь …», «включи трек …» — приложение само откроет desktop Яндекс Музыку, найдёт трек и нажмёт play. Ответь коротко и по делу. Не требуй задачу Redmine.
Ключевые образы: заднее сиденье и небо, цвет глаз ×1967, положительный резус, Малибу, круглосуточная лавка цветов, пит-стоп, «динь-дон» у двери, Меладзе в салоне.`;

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const PLAY_MUSIC_VERB_RE = /^(?:поставь|включи|запусти|играй|play|слушаем|давай|врубай)(?:\s|$)/i;

export function isDinDonMusicIntent(text) {
  const t = norm(text);
  if (!t) return false;

  const hasArtist = /крип[\s-]*а[\s-]*крип|krip[\s-]*a[\s-]*krip|крипл/.test(t);
  const hasTitle = /динь[\s-]*дон|диньдон|дин дон/.test(t);
  if (hasArtist && hasTitle) return true;

  if (PLAY_MUSIC_VERB_RE.test(t) && (hasArtist || hasTitle)) {
    return true;
  }

  if (/лавк[аи].{0,50}цветов/.test(t) && hasTitle) return true;

  const signatureHits = DIN_DON_LYRICS_SIGNATURE.filter((line) => t.includes(norm(line))).length;
  if (signatureHits >= 2) return true;
  if (signatureHits >= 1 && (hasTitle || /меладзе|пит[\s-]*стоп|инст/.test(t))) return true;

  return false;
}

export function isVaguePlayMusicRequest(text) {
  const t = norm(String(text || '').trim());
  if (!t) return false;
  if (isPlayMusicIntent(text)) return false;
  return /^(?:включи|поставь|запусти|играй|play|врубай)\s+(?:музыку|песню|песни|трек|композицию)(?:\s|$)/i.test(t)
    || /^(?:включи|поставь)\s+что[\s-]*нибудь/i.test(t);
}

export function isPlayMusicIntent(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (isDinDonMusicIntent(raw)) return true;

  const t = norm(raw);
  const match = t.match(
    /^(?:поставь|включи|запусти|играй|play|слушаем|давай|врубай)\s+(?:(?:песню|трек|музыку|композицию|в яндекс(?:\s+музык[еу])?)\s+)?(.{2,})$/i,
  );
  if (!match) return false;

  const tail = norm(match[1]);
  if (/^(?:яндекс(?:\s+музык[аеу])?|yandex music)$/i.test(tail)) return false;
  if (/^(?:figma|фигма|chrome|хром|photoshop|фотошоп)$/i.test(tail)) return false;
  return true;
}

const MUSIC_EXECUTE_FOLLOWUP_RE = /^да\s*[—-]\s*включить\s+[«"'](.+?)[»"']\s*$/i;
const MUSIC_EXECUTE_PREFIX_RE = /^(?:включить\s+)?(?:в\s+)?яндекс(?:\s+музык[еу])?[:\s]+(.+)$/i;

export function parseMusicExecuteFollowup(text) {
  const raw = String(text || '').trim();
  const followup = raw.match(MUSIC_EXECUTE_FOLLOWUP_RE);
  if (followup) return followup[1].trim();
  const prefixed = raw.match(MUSIC_EXECUTE_PREFIX_RE);
  if (prefixed) return prefixed[1].trim();
  if (/^(?:да|ок|окей|включай|давай|yes)(?:[,.!?\s]|$)/i.test(raw) && raw.length < 24) return null;
  return null;
}

export function shouldExecuteMusicPlay(text, { confirm = false } = {}) {
  if (confirm) return true;
  const raw = String(text || '').trim();
  if (parseMusicExecuteFollowup(raw)) return true;
  if (isPlayMusicIntent(raw) && parseMusicPlayQuery(raw)) return true;
  if (/^(?:да,?\s*)?включи(?:ть)?\s+(?:уже\s+)?(?:в\s+)?яндекс/i.test(raw)) return true;
  return false;
}

export function parseMusicPlayQuery(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  if (isDinDonMusicIntent(raw)) {
    return `${DIN_DON_TRACK.artist} ${DIN_DON_TRACK.title}`;
  }

  const match = raw.match(
    /^(?:поставь|включи|запусти|играй|play|слушаем|давай|врубай)\s+(?:(?:песню|трек|музыку|композицию|в яндекс(?:\s+музык[еу])?)\s+)?(.+)$/i,
  );
  if (!match) return null;

  return String(match[1] || '')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim() || null;
}

export function getPlayMusicReply(query, { dinDon = false, trackLabel = '' } = {}) {
  const label = trackLabel || (dinDon ? `${DIN_DON_TRACK.artist} — «${DIN_DON_TRACK.title}»` : query);
  if (dinDon) {
    return [
      `**${DIN_DON_TRACK.artist} — «${DIN_DON_TRACK.title}»**`,
      '',
      'Включаю в desktop Яндекс Музыке — пит-стоп у лавки цветов, динь-дон.',
    ].join('\n');
  }
  return `Включаю в Яндекс Музыке: **${label}**.`;
}

export function getDinDonMusicPayload() {
  return {
    url: DIN_DON_TRACK.yandexMusicUrl,
    query: `${DIN_DON_TRACK.artist} ${DIN_DON_TRACK.title}`,
    reply: getPlayMusicReply(`${DIN_DON_TRACK.artist} ${DIN_DON_TRACK.title}`, { dinDon: true }),
    track: DIN_DON_TRACK,
    direct: true,
  };
}
