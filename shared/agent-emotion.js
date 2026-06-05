/** Map Konstancia response context → VTube Studio emotion slot. */

export const AGENT_EMOTIONS = Object.freeze({
  neutral: 'neutral',
  joy: 'joy',
  anger: 'anger',
  thoughtful: 'thoughtful',
  epiphany: 'epiphany',
});

export const AGENT_EMOTION_LABELS = Object.freeze({
  neutral: 'Нейтральная',
  joy: 'Радость',
  anger: 'Гнев',
  thoughtful: 'Задумчивость',
  epiphany: 'Озарение',
});

/**
 * @param {{
 *   phase?: 'thinking'|'response'|'error',
 *   ok?: boolean,
 *   userText?: string,
 *   assistantText?: string,
 *   meta?: string,
 *   direct?: boolean,
 * }} ctx
 */
export function detectAgentEmotion(ctx = {}) {
  const phase = ctx.phase || 'response';
  if (phase === 'thinking') return AGENT_EMOTIONS.thoughtful;
  if (phase === 'error' || ctx.ok === false) return AGENT_EMOTIONS.anger;

  const text = `${ctx.assistantText || ''}\n${ctx.meta || ''}`.toLowerCase();
  const user = String(ctx.userText || '').toLowerCase();

  if (
    ctx.direct === true
    || /taskcard|taskfile|нашёл|нашел|кандидат|озарен|ключевой вывод|главный вывод|инсайт/i.test(text)
  ) {
    return AGENT_EMOTIONS.epiphany;
  }

  if (/ошибк|не удалось|нет доступа|отказ|невозможн|не могу|провал|не найдено/i.test(text)) {
    return AGENT_EMOTIONS.anger;
  }

  if (/готово|успеш|отлично|супер|записал|вписал|собрал проект|мокап.*готов|подключение успешно/i.test(text)) {
    return AGENT_EMOTIONS.joy;
  }

  if (/черт|блин|не работ|опять|надоел|почему не/i.test(user)) {
    return AGENT_EMOTIONS.anger;
  }

  if (/redmine · поиск файлов/i.test(text)) {
    return AGENT_EMOTIONS.epiphany;
  }

  return AGENT_EMOTIONS.neutral;
}
