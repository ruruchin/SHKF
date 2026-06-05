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
Если пользователь пишет «крип а крип», «динь дон», просит включить трек или кидает текст песни — приложение само откроет Яндекс Музыку. Ответь коротко и по делу, можно отсылкой к строкам трека. Не требуй задачу Redmine.
Ключевые образы: заднее сиденье и небо, цвет глаз ×1967, положительный резус, Малибу, круглосуточная лавка цветов, пит-стоп, «динь-дон» у двери, Меладзе в салоне.`;

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function isDinDonMusicIntent(text) {
  const t = norm(text);
  if (!t) return false;

  const hasArtist = /крип[\s-]*а[\s-]*крип|krip[\s-]*a[\s-]*krip|крипл/.test(t);
  const hasTitle = /динь[\s-]*дон|диньдон|дин дон/.test(t);
  if (hasArtist && hasTitle) return true;

  if (/^(?:включи|поставь|запусти|играй|play|слушаем|давай)(?:\s|$)/.test(t) && (hasArtist || hasTitle)) {
    return true;
  }

  if (/лавк[аи].{0,50}цветов/.test(t) && hasTitle) return true;

  const signatureHits = DIN_DON_LYRICS_SIGNATURE.filter((line) => t.includes(norm(line))).length;
  if (signatureHits >= 2) return true;
  if (signatureHits >= 1 && (hasTitle || /меладзе|пит[\s-]*стоп|инст/.test(t))) return true;

  return false;
}

export function getDinDonMusicPayload() {
  return {
    url: DIN_DON_TRACK.yandexMusicUrl,
    reply: [
      `**${DIN_DON_TRACK.artist} — «${DIN_DON_TRACK.title}»**`,
      '',
      'Открываю Яндекс Музыку — пит-стоп у лавки цветов, динь-дон.',
      '',
      `<<<YANDEXMUSIC ${DIN_DON_TRACK.yandexMusicUrl}>>>`,
    ].join('\n'),
    track: DIN_DON_TRACK,
    direct: true,
  };
}
