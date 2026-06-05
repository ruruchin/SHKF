/** When to inject learned Redmine experience into Konstancia chat. */

import { isGeneralKnowledgeQuery } from './general-knowledge-intent.js';

export function wantsLearnedExperience(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return /похож|как\s+мы\s+(делали|закрывали)|выучил|выучен|опыт\s+по|урок|playbook|что\s+(konstancia|kost-in)\s+знает|оптимиз.*процесс|узкие\s+места|прошлые\s+задач|сопостав|трудозатрат.*опыт|анализ.*опыт|конкретн/i.test(t);
}

/** Learned experience / lessons — not a Redmine file catalog search. */
export function isLearnedExperienceQuery(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (wantsFileSearch(t) || wantsReindexTasks(t)) return false;
  return wantsLearnedExperience(t);
}

/** Общий вопрос / идея / совет — без привязки к выбранной карточке Kanban. */
export function isGeneralAdvisoryQuery(text) {
  const t = String(text || '').trim();
  if (!t) return false;

  if (/текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|эту\s+задач|описани[ея]\s+задачи\s+целиком|разбей\s+работу\s+по\s+задач|трудозатрат.*по\s+этой|из\s+текста\s+задачи|под\s+эту\s+задач|задач[аеуи]\s*#\s*\d|#\d{3,}\b|issue\s*#\s*\d/i.test(t)) {
    return false;
  }

  return /(?:^|\s)(?:какой|что|как)\s+бы\b|если\s+бы|мог\s+бы|сделал\s+бы|хотел\s+бы|стоит\s+ли|имеет\s+ли\s+смысл|предложи\s+иде|иде[ия]\s+для|придумай|в\s+целом|вообще|в\s+теории|гипотет|что\s+думаешь|тво[её]\s+мнение|посоветуй|советуешь|рекомендуешь|как\s+можно\s+улучш|как\s+улучшить|как\s+лучше|лучшие\s+практик|плагин|интеграц|автоматиз|оптимизир(?:овать|уй)\s+(?:задач|работу\s+в)|что\s+такое|зачем\s+нужн|почему\s+(?:в\s+)?(?:redmine|редмайн)/i.test(t);
}

/** Prompts that need a selected Redmine issue to compare against. */
export function requiresCurrentTask(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isGeneralAdvisoryQuery(t)) return false;
  if (isLearnedExperienceQuery(t)) return true;
  if (wantsProcessInsights(t) && /по\s+этой\s+задач|текущ(ей|ую|ая)\s+задач/i.test(t)) return true;
  return /текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|описание\s+задачи\s+целиком|разбей\s+работу\s+по\s+задач|трудозатрат.*по\s+этой|по\s+описанию\s+задачи|из\s+текста\s+задачи|под\s+эту\s+задач/i.test(t);
}

export function wantsProcessInsights(text) {
  const t = String(text || '').trim();
  return /оптимиз|процесс|узкие\s+мест|продуктив|bottleneck|инсайт/i.test(t);
}

export function wantsFileSearch(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return false;
  return /\.(psd|pdf|fig|sketch|ai|zip|docx?|xlsx?|png|jpe?g|svg|mp4|mov)\b/.test(t)
    || /файл[а-я]*\s+[\w.-]+\.\w{2,5}/i.test(t)
    || /флаер|flyer|листовк|брошюр|баннер|banner|макет/i.test(t);
}

export function wantsRedmineKnowledge(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isGeneralKnowledgeQuery(t)) return false;
  if (isLearnedExperienceQuery(t)) return false;
  if (wantsFileSearch(text)) return true;
  if (wantsReindexTasks(text)) return true;
  return /найди|найти|ищ[уиё]|поиск|где\s+(лежит|лежать|находится|искать|может)|в\s+какой\s+задач|какой\s+задач|каких\s+задач|(?:найди|найти|ищ|поиск|где).{0,40}(?:redmine|редмайн)|(?:redmine|редмайн).{0,30}(?:файл|найди|поиск|задач)|файл|вложен|attachment|макет|документ|листовк|флаер|flyer|проиндексир|проиндексирован|каталог|база\s+задач|архив\s+задач|закрыт(?:ы|ые|ую).*задач|внедр.*задач|что\s+знаешь\s+о\s+задач/i.test(t);
}

export function wantsReindexTasks(text) {
  const t = String(text || '').trim();
  return /проиндексир|переиндексир|обнови\s+каталог|обнови\s+индекс|сам\s+проиндексир|запусти\s+индекс|построй\s+каталог|научись\s+на\s+задач/i.test(t);
}

/** Сколько результатов просит пользователь: «5 штук», «предложи 3 ссылки», «топ 7». */
export function extractRequestedCount(text, { defaultLimit = 8, min = 1, max = 15 } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return defaultLimit;

  const patterns = [
    /(\d{1,2})\s*(?:штук|штуки|шт\.?|ссылок|ссылк[аиуе]?|вариант(?:ов|а|ы)?|кандидат(?:ов|а|ы)?|мест(?:а|о)?|результат(?:ов|а|ы)?|задач(?:и|е|ах)?)/i,
    /(?:предложи|дай|покажи|найди|найти|ищи|нужно|хочу|верни|выведи|составь|пришли)\s+(\d{1,2})\b/i,
    /(?:top|топ)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:top|топ)\b/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    const n = Number(m?.[1]);
    if (Number.isFinite(n) && n >= min) return Math.min(max, n);
  }

  return defaultLimit;
}

export function extractKnowledgeTokens(query) {
  const stop = new Set([
    'найди', 'найти', 'ищи', 'где', 'лежит', 'лежать', 'может', 'файл', 'файла', 'файлу',
    'задач', 'задаче', 'задачах', 'задачи', 'redmine', 'редмайн', 'вложен', 'вложение',
    'проиндексированных', 'проиндексирован', 'включая', 'закрытые', 'закрытых', 'внедрен',
    'кост', 'kost', 'найди', 'покажи', 'дай', 'мне', 'нужен', 'нужно', 'этот', 'этого',
    'который', 'которая', 'такой', 'такая', 'сам', 'сама', 'само', 'пожалуйста', 'листовка',
    'листовку', 'флаер', 'flyer', 'брошюра', 'макет', 'материал', 'лежать', 'лежит',
  ]);
  const tokens = new Set();
  for (const m of String(query || '').matchAll(/['"]([^'"]+)['"]/g)) {
    for (const w of m[1].toLowerCase().split(/\s+/)) {
      if (w.length >= 3 && !stop.has(w)) tokens.add(w);
    }
  }
  for (const w of String(query || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .split(/\s+/)) {
    if (w.length >= 3 && !stop.has(w)) tokens.add(w);
  }
  return [...tokens];
}

/** Phrases for Redmine /search.json (incl. quoted «листовка фк черноморец»). */
export function extractSearchPhrases(query) {
  const phrases = [];
  const raw = String(query || '');
  for (const m of raw.matchAll(/['"]([^'"]+)['"]/g)) {
    const p = m[1].trim();
    if (p.length >= 3) phrases.push(p);
  }
  const dashTopic = raw.match(/[—\-–]\s*([^.?\n]{3,120})/);
  if (dashTopic?.[1]) {
    const p = dashTopic[1].replace(/\.\s*Только\s+факты.*$/i, '').trim();
    if (p.length >= 3) phrases.push(p);
  }
  const tailTopic = raw.match(/\.\s*([а-яёa-z][^.]{2,100})\.\s*Только\s+факты/i);
  if (tailTopic?.[1]) phrases.push(tailTopic[1].trim());
  const colonTopic = raw.match(/(?:найди\s+файл|найти\s+файл|тема)\s*[:—\-–]\s*(.+)$/i);
  if (colonTopic?.[1]) phrases.push(colonTopic[1].trim());

  const tokens = extractKnowledgeTokens(query);
  if (tokens.length) phrases.push(tokens.join(' '));
  for (const t of tokens.filter((w) => w.length >= 5)) phrases.push(t);
  if (tokens.some((t) => t.includes('черномор'))) {
    phrases.push('черноморец');
    phrases.push('черномор');
    phrases.push('фк черноморец');
  }
  return [...new Set(phrases.map((p) => p.trim()).filter((p) => p.length >= 3))];
}

export function isRedmineFileSearch(text, { force = false } = {}) {
  if (force) return true;
  if (isLearnedExperienceQuery(text)) return false;
  if (wantsFileSearch(text) || wantsReindexTasks(text)) return true;
  return wantsRedmineKnowledge(text);
}

export const TASK_REQUIRED_REPLY = 'Сначала выберите **задачу Redmine** в списке сверху («— Без задачи —» → нужная карточка). Без текущей задачи не с чем сопоставлять опыт и нельзя разбирать ТЗ.';
