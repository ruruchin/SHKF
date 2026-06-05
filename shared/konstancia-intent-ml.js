/** Map Hugging Face intent labels to Konstancia routing (Habr transformers fine-tune). */

export const ML_INTENT_LABELS = [
  'general_chat',
  'task_work',
  'file_search',
  'learned_experience',
  'music_easter_egg',
  'reindex',
  'kanban_wide',
];

export function getTopMlIntent(mlResult, { threshold = 0.55 } = {}) {
  if (!mlResult?.ok || !Array.isArray(mlResult.intent) || !mlResult.intent.length) return null;
  const top = mlResult.intent[0];
  const second = mlResult.intent[1];
  const score = Number(top?.score ?? 0);
  const label = String(top?.label || '').trim();
  const margin = score - Number(second?.score ?? 0);
  const source = String(mlResult.source || 'fine_tuned');
  const minScore = source === 'zero_shot' ? Math.min(threshold, 0.22) : threshold;
  const confident = score >= minScore && (source === 'fine_tuned' || margin >= 0.04);
  if (!label || !confident) return null;
  return { label, score, margin, source, all: mlResult.intent };
}

export function mlOverridesTaskRequirement(topIntent) {
  return topIntent?.label === 'general_chat' || topIntent?.label === 'music_easter_egg';
}

export function mlWantsFileSearch(topIntent) {
  return topIntent?.label === 'file_search';
}

export function mlWantsReindex(topIntent) {
  return topIntent?.label === 'reindex';
}

export function mlWantsLearnedExperience(topIntent) {
  return topIntent?.label === 'learned_experience' || topIntent?.label === 'kanban_wide';
}

export function mlWantsTaskWork(topIntent) {
  return topIntent?.label === 'task_work';
}
