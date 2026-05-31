/**
 * Чистая логика поиска связей между задачами (без сети).
 * Используется и сервером (оркестрация с эмбеддингами/LLM), и в тестах.
 *
 * Главная цель — НЕ связывать всё подряд: связь дают только редкие,
 * специфичные термины и/или высокая семантическая близость, а не общая лексика.
 */

export const LINKER_CONFIG = {
  SEM_SIM_STRONG: 0.8, // очень высокая близость — кандидат даже без общих редких слов
  SEM_SIM_MIN: 0.62, // близость + 1 общий редкий токен — кандидат
  MIN_RARE_STRONG: 2, // столько общих редких токенов делают пару кандидатом независимо от косинуса
  MIN_SCORE: 0.4, // итоговый порог скоринга (ранжирование + базовый отсев)
  TOP_K: 14, // сколько кандидатов уходит на проверку LLM
  MAX_SUGGESTIONS: 8, // максимум предложений в выдаче
  RARE_DF_RATIO: 0.34, // токен «редкий», если встречается не чаще, чем в этой доле задач
  MIN_RARE_LEN: 3, // минимальная длина значимого токена
};

const RU_STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
  'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее',
  'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
  'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до',
  'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей',
  'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем',
  'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет',
  'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь',
  'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'были', 'куда', 'зачем', 'всех',
  'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после', 'над',
  'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'разве',
  'эту', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более',
  'всегда', 'конечно', 'всю', 'между', 'это', 'нужно', 'нужен', 'нужна', 'сделать', 'задача',
  'задачи', 'задаче', 'задачу', 'добавить', 'необходимо', 'также', 'который', 'которые',
]);

const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'to', 'of', 'in', 'on',
  'at', 'by', 'is', 'are', 'be', 'was', 'were', 'this', 'that', 'with', 'as', 'it', 'from',
  'task', 'todo', 'add', 'make', 'need', 'should', 'can', 'will',
]);

const RU_ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ой', 'ый', 'ий', 'ая',
  'яя', 'ое', 'ее', 'ие', 'ые', 'ов', 'ев', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ах', 'у',
  'ю', 'ы', 'и', 'е', 'а', 'я', 'о',
];

function lightStem(token) {
  if (token.length <= 4) return token;
  for (const end of RU_ENDINGS) {
    if (token.length - end.length >= 4 && token.endsWith(end)) {
      return token.slice(0, -end.length);
    }
  }
  return token;
}

export function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  const parts = raw.split(/[^a-zа-яё0-9]+/i).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length < LINKER_CONFIG.MIN_RARE_LEN) continue;
    if (RU_STOPWORDS.has(p) || EN_STOPWORDS.has(p)) continue;
    out.push(lightStem(p));
  }
  return out;
}

function taskText(task) {
  return `${task?.subject || ''} ${task?.description || ''}`.trim();
}

/** Document frequency по всему корпусу задач. */
export function buildCorpusStats(tasks) {
  const df = new Map();
  for (const task of tasks) {
    const uniq = new Set(tokenize(taskText(task)));
    for (const tok of uniq) df.set(tok, (df.get(tok) || 0) + 1);
  }
  return { df, n: tasks.length };
}

/** Сигнатура задачи: множество токенов и подмножество «редких» (специфичных). */
export function buildSignature(task, stats) {
  const { df, n } = stats;
  const tokens = tokenize(taskText(task));
  const subjectTokens = new Set(tokenize(task?.subject || ''));
  const maxDf = Math.max(2, Math.ceil(n * LINKER_CONFIG.RARE_DF_RATIO));
  const all = new Set(tokens);
  const rare = new Set();
  for (const tok of all) {
    const freq = df.get(tok) || 0;
    // редкий = встречается не у всех; слова из заголовка ценим выше
    if (freq <= maxDf || subjectTokens.has(tok)) rare.add(tok);
  }
  // вес токена для TF-IDF-вектора (fallback без эмбеддингов)
  const weights = new Map();
  for (const tok of tokens) {
    const freq = df.get(tok) || 1;
    const idf = Math.log((n + 1) / (freq + 0.5)) + 1;
    const boost = subjectTokens.has(tok) ? 2 : 1;
    weights.set(tok, (weights.get(tok) || 0) + idf * boost);
  }
  return { id: task.id, tokens: all, rare, weights, subjectTokens };
}

export function cosineSparse(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, w] of a) na += w * w;
  for (const [, w] of b) nb += w * w;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const [tok, w] of small) {
    const w2 = big.get(tok);
    if (w2) dot += w * w2;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function cosineDense(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function pairKey(aId, bId) {
  const x = Number(aId);
  const y = Number(bId);
  return x < y ? `${x}:${y}` : `${y}:${x}`;
}

function intersectionSize(a, b) {
  let count = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const v of small) if (big.has(v)) count += 1;
  return count;
}

function hasExplicitRef(taskA, taskB) {
  const reA = new RegExp(`#${Number(taskB.id)}\\b`);
  const reB = new RegExp(`#${Number(taskA.id)}\\b`);
  return reA.test(taskText(taskA)) || reB.test(taskText(taskB));
}

function sharedAssignee(taskA, taskB) {
  const ids = new Set((taskA.assignees || []).map((p) => p.id));
  return (taskB.assignees || []).some((p) => ids.has(p.id));
}

/**
 * Оценивает пару задач. semSim передаётся снаружи (эмбеддинги),
 * либо считается по TF-IDF, если эмбеддингов нет.
 */
export function scorePair(taskA, taskB, sigA, sigB, semSim) {
  const sim = typeof semSim === 'number' ? semSim : cosineSparse(sigA.weights, sigB.weights);
  const sharedRare = intersectionSize(sigA.rare, sigB.rare);
  const explicitRef = hasExplicitRef(taskA, taskB);

  let score = 0.6 * sim + 0.25 * Math.min(1, sharedRare / 3);
  if (taskA.project && taskA.project === taskB.project) score += 0.1;
  if (sharedAssignee(taskA, taskB)) score += 0.05;
  if (taskA.tracker && taskA.tracker === taskB.tracker) score += 0.03;
  if (explicitRef) score += 0.4;

  return { score: Math.min(1, score), sim, sharedRare, explicitRef };
}

/**
 * Главный предохранитель: пара не проходит на одной только общей лексике.
 * Кандидат, если выполнено хотя бы одно сильное условие:
 *  - прямая ссылка #id в тексте;
 *  - очень высокая семантическая близость;
 *  - 2+ общих РЕДКИХ (специфичных) токена;
 *  - средняя близость + хотя бы 1 общий редкий токен.
 * Общие частые слова в редкие токены не попадают, поэтому «связать всё» не происходит.
 */
export function isCandidate(metrics) {
  const { sim, sharedRare, explicitRef, score } = metrics;
  if (explicitRef) return true;
  if (sim >= LINKER_CONFIG.SEM_SIM_STRONG) return true;
  if (score < LINKER_CONFIG.MIN_SCORE) return false;
  if (sharedRare >= LINKER_CONFIG.MIN_RARE_STRONG) return true;
  if (sim >= LINKER_CONFIG.SEM_SIM_MIN && sharedRare >= 1) return true;
  return false;
}

/**
 * Полный проход: строит кандидатов по задачам.
 * @param tasks - массив задач
 * @param vectors - Map(id -> number[]) эмбеддинги, либо null (тогда TF-IDF)
 */
export function buildCandidates(tasks, vectors, dismissed = new Set()) {
  const stats = buildCorpusStats(tasks);
  const sigs = new Map();
  for (const t of tasks) sigs.set(t.id, buildSignature(t, stats));

  const candidates = [];
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (dismissed.has(pairKey(a.id, b.id))) continue;

      let semSim;
      if (vectors) {
        const va = vectors.get(a.id);
        const vb = vectors.get(b.id);
        if (va && vb) semSim = cosineDense(va, vb);
      }
      const metrics = scorePair(a, b, sigs.get(a.id), sigs.get(b.id), semSim);
      if (!isCandidate(metrics)) continue;
      candidates.push({ aId: a.id, bId: b.id, ...metrics });
    }
  }

  candidates.sort((x, y) => y.score - x.score);
  return candidates.slice(0, LINKER_CONFIG.TOP_K);
}

/** Тип связи LLM -> тип отношения Redmine. */
export function relationTypeForRedmine(type) {
  switch (String(type || '').toLowerCase()) {
    case 'duplicate':
    case 'duplicates':
      return 'duplicates';
    case 'blocks':
      return 'blocks';
    case 'precedes':
      return 'precedes';
    default:
      return 'relates';
  }
}

export function relationTypeLabel(type) {
  switch (relationTypeForRedmine(type)) {
    case 'duplicates':
      return 'дубликат';
    case 'blocks':
      return 'блокирует';
    case 'precedes':
      return 'предшествует';
    default:
      return 'связана';
  }
}
