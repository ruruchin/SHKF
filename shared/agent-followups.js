/** Classify Konstancia follow-up chips: task comment vs chat vs music vs open app. */

const MUSIC_EXECUTE_FOLLOWUP_RE = /^да\s*[—-]\s*включить\s+[«"'](.+?)[»"']\s*$/i;
const RESOURCE_OPEN_FOLLOWUP_RE = /^да\s*[—-]\s*открыть\s+(.+)$/i;
const PLAY_MUSIC_VERB_RE = /^(?:поставь|включи|запусти|играй|play|слушаем|давай|врубай)(?:\s|$)/i;

export function parseMusicFollowupQuery(text) {
  const raw = String(text || '').trim();
  const followup = raw.match(MUSIC_EXECUTE_FOLLOWUP_RE);
  if (followup) return followup[1].trim();
  const prefixed = raw.match(/^(?:включить\s+)?(?:в\s+)?яндекс(?:\s+музык[еу])?[:\s]+(.+)$/i);
  if (prefixed) return prefixed[1].trim();
  return null;
}

export function isTaskCommentFollowupText(text) {
  const t = String(text || '');
  return /уточн|заказчик|вопрос\w*\s+заказчик|риск|оцен|разбить|с\s+чего\s+начать|промпт|баннер|лендинг|figma\s*make|прочитай\s+описание\s+задач/i.test(t);
}

export function classifyAgentFollowupKind(text, { defaultKind = 'chat', hasTask = false } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return 'chat';
  if (/^отмена$/i.test(raw)) return 'chat';
  if (parseMusicFollowupQuery(raw)) return 'music';
  if (/^да\s*[—-]\s*включить/i.test(raw)) return 'music';
  if (RESOURCE_OPEN_FOLLOWUP_RE.test(raw)) return 'resource';
  if (hasTask && isTaskCommentFollowupText(raw)) return 'task';
  if (PLAY_MUSIC_VERB_RE.test(raw) && !/^(?:figma|фигма|chrome|хром)$/i.test(raw)) return 'music';
  return defaultKind;
}

export function followupUsesTaskComment(followups, taskId) {
  if (!taskId || !Array.isArray(followups) || !followups.length) return false;
  return followups.some((item) => classifyAgentFollowupKind(item, { defaultKind: 'task', hasTask: true }) === 'task');
}
