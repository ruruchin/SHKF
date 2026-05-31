/**
 * Поиск связей между задачами Redmine.
 * Воронка: эмбеддинги/TF-IDF → кандидаты по скорингу → строгая проверка LLM.
 */
import {
  LINKER_CONFIG,
  buildCandidates,
  relationTypeForRedmine,
  relationTypeLabel,
} from '../shared/task-linker.js';

function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function taskById(tasks, id) {
  return tasks.find((t) => Number(t.id) === Number(id)) || null;
}

const VERIFY_SYSTEM_PROMPT = `Ты — строгий аналитик задач трекера Redmine. Тебе дают пары задач-кандидатов.
Реши по каждой паре: связаны ли задачи НАСТОЛЬКО, что работа над одной реально пересекается, зависит или дублирует другую (общий конкретный объект, модуль, экран, фича или баг).
Правила:
- Будь СТРОГИМ. Общая тема, общий проект или похожие слова — НЕ повод связывать. Нужен общий конкретный объект работы.
- Тип: "duplicate" (по сути одно и то же), "blocks" (одна блокирует другую), "part_of_feature" (части одной фичи/области), "same_area" (один модуль/экран). Если не уверен — related=false.
- reason — одна короткая фраза с НАЗВАНИЕМ общего объекта (напр. «обе про модальное окно Redmine»).
Ответ — ТОЛЬКО валидный JSON-массив, без markdown и текста вокруг:
[{"pair":1,"related":true,"type":"part_of_feature","reason":"..."},{"pair":2,"related":false}]`;

function buildVerifyMessage(pairs, tasks) {
  const lines = pairs.map((c, idx) => {
    const a = taskById(tasks, c.aId);
    const b = taskById(tasks, c.bId);
    return [
      `Пара ${idx + 1}:`,
      `  A (#${a.id}) [${a.project || '—'}]: ${clip(a.subject, 160)}`,
      `     описание: ${clip(a.description, 320) || '—'}`,
      `  B (#${b.id}) [${b.project || '—'}]: ${clip(b.subject, 160)}`,
      `     описание: ${clip(b.description, 320) || '—'}`,
    ].join('\n');
  });
  return `Оцени пары задач и верни JSON-массив решений (поле pair = номер пары):\n\n${lines.join('\n\n')}`;
}

function extractJsonArray(text) {
  if (!text) return null;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export class TaskLinkerService {
  constructor(agentService) {
    this.agent = agentService;
  }

  /**
   * @param {Array} tasks - задачи [{id, subject, description, project, tracker, assignees}]
   * @param {Set<string>} dismissed - отклонённые пары (pairKey)
   * @returns {Promise<{ok, suggestions, usedEmbeddings, candidatesCount, message?}>}
   */
  async suggest(tasks, dismissed = new Set()) {
    const list = Array.isArray(tasks) ? tasks.filter((t) => t && t.id && t.subject) : [];
    if (list.length < 2) {
      return { ok: true, suggestions: [], candidatesCount: 0, usedEmbeddings: false };
    }

    // 1. Эмбеддинги (если есть) → векторы по id
    let vectors = null;
    let usedEmbeddings = false;
    const texts = list.map((t) => `${t.subject}. ${t.description || ''}`);
    const embedded = await this.agent.embed(texts);
    if (Array.isArray(embedded) && embedded.length === list.length) {
      vectors = new Map();
      list.forEach((t, i) => vectors.set(t.id, embedded[i]));
      usedEmbeddings = true;
    }

    // 2. Кандидаты по скорингу с предохранителями
    const candidates = buildCandidates(list, vectors, dismissed);
    if (!candidates.length) {
      return { ok: true, suggestions: [], candidatesCount: 0, usedEmbeddings };
    }

    // 3. Строгая проверка LLM одним запросом
    let decisions = null;
    if (this.agent.isConfigured()) {
      const verify = await this.agent.chat({
        message: buildVerifyMessage(candidates, list),
        history: [],
        task: null,
        systemPrompt: VERIFY_SYSTEM_PROMPT,
        allowFollowups: false,
      });
      if (verify?.ok) decisions = extractJsonArray(verify.content);
    }

    const suggestions = [];
    candidates.forEach((c, idx) => {
      const a = taskById(list, c.aId);
      const b = taskById(list, c.bId);
      if (!a || !b) return;

      let related;
      let type = 'related';
      let reason = '';
      if (decisions) {
        const d = decisions.find((x) => Number(x.pair) === idx + 1);
        related = d ? d.related === true : false;
        type = d?.type || 'related';
        reason = clip(d?.reason || '', 160);
      } else {
        // LLM недоступна — отдаём только очень уверенные пары
        related = c.explicitRef || c.sim >= LINKER_CONFIG.SEM_SIM_STRONG;
        reason = c.explicitRef ? 'есть прямая ссылка на задачу в тексте' : 'высокая смысловая близость';
      }
      if (!related) return;

      suggestions.push({
        aId: a.id,
        bId: b.id,
        aSubject: a.subject,
        bSubject: b.subject,
        aUrl: a.url || '',
        bUrl: b.url || '',
        type,
        relationType: relationTypeForRedmine(type),
        relationLabel: relationTypeLabel(type),
        reason,
        confidence: Math.round(c.score * 100) / 100,
      });
    });

    suggestions.sort((x, y) => y.confidence - x.confidence);
    return {
      ok: true,
      suggestions: suggestions.slice(0, LINKER_CONFIG.MAX_SUGGESTIONS),
      candidatesCount: candidates.length,
      usedEmbeddings,
    };
  }
}
