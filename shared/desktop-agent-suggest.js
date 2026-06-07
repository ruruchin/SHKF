/** Suggest closest desktop action when exact app not found. */

const KNOWN_APPS = [
  { key: 'figma', aliases: ['figma', 'фигма'] },
  { key: 'chrome', aliases: ['chrome', 'хром', 'google chrome'] },
  { key: 'yandex music', aliases: ['yandex music', 'яндекс музыка', 'яндекс музыку', 'яндексмузыка'] },
  { key: 'illustrator', aliases: ['illustrator', 'иллюстратор', 'adobe illustrator'] },
  { key: 'photoshop', aliases: ['photoshop', 'фотошоп', 'adobe photoshop'] },
  { key: 'after effects', aliases: ['after effects', 'aftereffects', 'after fx', 'афтер эффектс'] },
  { key: 'cursor', aliases: ['cursor'] },
  { key: 'vscode', aliases: ['vscode', 'code', 'visual studio code'] },
  { key: 'notepad', aliases: ['notepad', 'блокнот'] },
  { key: 'explorer', aliases: ['explorer', 'проводник'] },
  { key: 'telegram', aliases: ['telegram', 'телеграм'] },
  { key: 'discord', aliases: ['discord', 'дискорд'] },
  { key: 'happ', aliases: ['happ', 'happ'] },
  { key: 'nekobox', aliases: ['nekobox', 'некобокс'] },
  { key: 'amnezia vpn', aliases: ['amnezia vpn', 'amnezia', 'амнезия'] },
  { key: 'pinterest', aliases: ['pinterest', 'пинтерест'] },
];

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function isKnownDesktopApp(target) {
  const t = norm(target);
  if (!t) return false;
  return KNOWN_APPS.some((app) => app.aliases.some((a) => t === a || t.startsWith(`${a} `) || t.includes(a)));
}

export function findClosestDesktopApp(target) {
  const t = norm(target);
  if (!t) return null;

  let best = null;
  let bestScore = 0;
  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      if (t === alias || t.includes(alias) || alias.includes(t)) {
        const score = alias.length + (t === alias ? 100 : 0);
        if (score > bestScore) {
          best = app;
          bestScore = score;
        }
      }
    }
  }
  return best?.key || null;
}

export function extractMusicQueryFromTarget(target, rawMessage = '') {
  let q = norm(target);
  q = q
    .replace(/^(?:в\s+)?яндекс(?:\s+музык[аеу])?\s+/, '')
    .replace(/^(?:песню|трек|музыку|композицию)\s+/, '')
    .trim();
  if (q) return q;

  const fromMsg = String(rawMessage || '').match(
    /^(?:поставь|включи|запусти|играй|play|слушаем|давай|врубай)\s+(?:(?:песню|трек|музыку|композицию|в\s+яндекс(?:\s+музык[еу])?)\s+)?(.+)$/i,
  );
  return fromMsg?.[1]?.trim() || null;
}

export function looksLikeMusicQuery(target, rawMessage = '') {
  const t = norm(target);
  if (!t) return false;
  if (isKnownDesktopApp(t)) return false;
  if (/^(?:в\s+)?яндекс(?:\s+музык[аеу])?\s+/.test(t)) return true;
  if (/\s/.test(t) && !/\.exe$/i.test(t)) return true;
  if (/^(?:поставь|включи|запусти|играй|play)\b/i.test(String(rawMessage || ''))) return true;
  return false;
}

export function buildDesktopSuggestion(target, rawMessage = '') {
  const musicQuery = extractMusicQueryFromTarget(target, rawMessage);
  if (looksLikeMusicQuery(target, rawMessage) && musicQuery) {
    return {
      type: 'music',
      query: musicQuery,
      message: `Похоже, вы хотите включить в **Яндекс Музыке**: **${musicQuery}**.`,
      followups: [`Да — включить «${musicQuery}»`, 'Отмена'],
    };
  }

  const closest = findClosestDesktopApp(target);
  if (closest) {
    return {
      type: 'app',
      target: closest,
      message: `Не нашёл «${target}». Возможно, вы имели в виду **${closest}**?`,
      followups: [`Да — открыть ${closest}`, 'Отмена'],
    };
  }

  if (musicQuery) {
    return {
      type: 'music',
      query: musicQuery,
      message: `Не нашёл приложение «${target}». Может, включить в **Яндекс Музыке**: **${musicQuery}**?`,
      followups: [`Да — включить «${musicQuery}»`, 'Отмена'],
    };
  }

  return {
    type: 'unknown',
    message: `Не поняла команду «${target}». Напишите, например: **включи скриптонит рабские лекции** или **открой figma**.`,
    followups: null,
  };
}
