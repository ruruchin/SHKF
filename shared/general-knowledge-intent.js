/** Open Q&A — not Redmine/task/file search (encyclopedic + web). */

function normalizeCasualText(text) {
  return String(text || '').trim().replace(/[?!.,…]+$/g, '').replace(/\s+/g, ' ').trim();
}

const CASUAL_GREETING_RE = /^(?:привет|здравствуй|здрав|хай|hello|хелло|йо|yo|хэй|салют|добр(?:ый|ое)\s+(?:день|утро|вечер)|спасибо|благодар|пока|до\s+свидан)/i;

const CASUAL_SMALLTALK_RE = /^(?:как\s+дела|как\s+ты|как\s+сам|как\s+жизнь|что\s+делаешь|чем\s+занят|как\s+настроение|как\s+у\s+тебя|чо\s+ты|чё\s+ты|че\s+ты|ты\s+тут|ты\s+здесь|норм|нормально|эй|алло|ау)$/i;

const ASSISTANT_NAME_RE = /(?:^|\s)(?:konstancia|konstantsi|konstantsiya|констанци[яи]|констancia|kost-?in)(?:\s|$|[?!.,])/i;

const ENCYCLOPEDIA_MARKERS_RE = /что\s+такое|кто\s+такой|кто\s+такая|расскажи\s+о|объясни\s+(?:что|как|почему)|история\s+|в\s+интернет|погугли/i;

const TASK_OR_WORK_RE = /текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|эту\s+задач|описани[ея]\s+задачи\s+целиком|разбей\s+работу\s+по\s+задач|трудозатрат.*по\s+этой|из\s+текста\s+задачи|под\s+эту\s+задач|задач[аеуи]\s*#\s*\d|#\d{3,}\b|issue\s*#\s*\d|трудозатрат|figma\s+make|промпт.*(?:баннер|лендинг|макет)/i;

const FILE_SEARCH_RE = /\.(psd|pdf|fig|sketch|ai|zip|docx?|xlsx?|png|jpe?g|svg|mp4|mov)\b|файл[а-я]*\s+[\w.-]+\.\w{2,5}|флаер|flyer|листовк|брошюр|баннер|banner|макет/i;

const REDMINE_OPS_RE = /проиндексир|переиндексир|обнови\s+каталог|обнови\s+индекс|найди\s+файл|найти\s+файл|ищ[уиё].{0,30}(?:redmine|редмайн|вложен|файл)|(?:redmine|редмайн).{0,30}(?:файл|найди|поиск)/i;

const LEARNED_RE = /похож|как\s+мы\s+(делали|закрывали)|выучил|выучен|опыт\s+по|урок|playbook|что\s+(konstancia|kost-in)\s+знает|прошлые\s+задач|сопостав.*задач/i;

const OPEN_QUESTION_RE = /^(?:что|кто|где|когда|почему|зачем|как|какой|какая|какие|какое|сколько|можно\s+ли|нужно\s+ли|есть\s+ли|расскажи|объясни|опиши|перечисли|назови|подскажи|посоветуй|сравни|чем\s+отличается|дай\s+информацию|что\s+знаешь\s+о|что\s+такое|кто\s+такой|как\s+работает|как\s+устроен|история\s+)/i;

/** Greetings and small talk — no RAG, no web search, no encyclopedia mode. */
export function isCasualChatQuery(text) {
  const raw = String(text || '').trim();
  const t = normalizeCasualText(raw);
  if (!t || t.length < 2) return false;
  if (ENCYCLOPEDIA_MARKERS_RE.test(t)) return false;
  if (TASK_OR_WORK_RE.test(t)) return false;

  if (CASUAL_GREETING_RE.test(t) || CASUAL_GREETING_RE.test(raw)) return true;
  if (CASUAL_SMALLTALK_RE.test(t)) return true;
  if (/как\s+дела|как\s+ты|как\s+сам|как\s+настроение|как\s+у\s+тебя/.test(t) && t.length <= 40) return true;

  if (t.length <= 80 && ASSISTANT_NAME_RE.test(t)) {
    if (/кто\s+такая?\s+констанци|что\s+такое\s+констанци|история\s+констанци/i.test(t)) return false;
    return true;
  }

  if (t.length <= 24 && /^(?:ок|окей|ага|угу|лол|хаха|хм+|эм+|ого|класс|круто|понял|ясно|спс|thanks)[\s!?.]*$/i.test(t)) {
    return true;
  }

  return false;
}

export function isGeneralKnowledgeQuery(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 3) return false;
  if (isCasualChatQuery(t)) return false;
  if (TASK_OR_WORK_RE.test(t)) return false;
  if (FILE_SEARCH_RE.test(t)) return false;
  if (REDMINE_OPS_RE.test(t)) return false;
  if (LEARNED_RE.test(t)) return false;

  if (/\?/.test(t)) return true;
  if (OPEN_QUESTION_RE.test(t)) return true;
  if (/в\s+интернет|из\s+интернет|погугли|загугли|найди\s+в\s+сети|поищи\s+в\s+интернет/i.test(t)) return true;

  return false;
}

export function wantsWebSearch(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (!isGeneralKnowledgeQuery(t)) return false;
  return /в\s+интернет|из\s+интернет|погугли|загугли|найди\s+в\s+сети|поищи\s+в\s+интернет|актуальн|сейчас|сегодня|вчера|202[4-9]|новост|курс\s+(?:доллар|евро|биткоин)|погода|последн/i.test(t)
    || (/\?/.test(t) && /кто|когда|где|сколько|какой\s+сейчас|что\s+случилось/i.test(t));
}
