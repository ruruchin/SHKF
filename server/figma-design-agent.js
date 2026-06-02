const PLAN_BLOCK_RE = /<<<FIGMA_PLAN_JSON\s*([\s\S]*?)\s*FIGMA_PLAN_JSON>>>/i;
const CRITIC_BLOCK_RE = /<<<FIGMA_CRITIC_JSON\s*([\s\S]*?)\s*FIGMA_CRITIC_JSON>>>/i;

const ALLOWED_OPS = new Set([
  'create_frame',
  'create_text',
  'create_rect',
  'create_button',
  'rename',
  'set_text',
  'resize',
  'move',
  'set_fill_solid',
  'set_stroke_solid',
  'set_corner_radius',
  'set_auto_layout',
  'set_padding',
  'set_spacing',
  'set_visibility',
]);

function clampNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function normalizeColor(color) {
  if (!color || typeof color !== 'object') return null;
  return {
    r: clampNumber(color.r, 0, 255, 0),
    g: clampNumber(color.g, 0, 255, 0),
    b: clampNumber(color.b, 0, 255, 0),
    a: color.a == null ? 1 : clampNumber(color.a, 0, 1, 1),
  };
}

function normalizeJsonText(text) {
  return String(text || '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function extractBalancedChunk(text, openChar, closeChar) {
  const src = String(text || '');
  const start = src.indexOf(openChar);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstJsonObject(text) {
  return extractBalancedChunk(text, '{', '}');
}

function extractFirstJsonArray(text) {
  return extractBalancedChunk(text, '[', ']');
}

function parseJsonLoose(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const attempts = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const block = text.match(PLAN_BLOCK_RE);
  if (block?.[1]) attempts.push(block[1].trim());
  const firstObj = extractFirstJsonObject(text);
  if (firstObj) attempts.push(firstObj.trim());
  const firstArr = extractFirstJsonArray(text);
  if (firstArr) attempts.push(firstArr.trim());

  for (const chunk of attempts) {
    const normalized = normalizeJsonText(chunk);
    const variants = [normalized];
    for (const variant of variants) {
      try {
        const parsed = JSON.parse(variant);
        if (Array.isArray(parsed)) {
          return { summary: '', assumptions: [], operations: parsed };
        }
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.operations)) return parsed;
          if (parsed.plan && typeof parsed.plan === 'object' && Array.isArray(parsed.plan.operations)) return parsed.plan;
          if (parsed.op) return { summary: '', assumptions: [], operations: [parsed] };
          const embeddedArr = extractFirstJsonArray(variant);
          if (embeddedArr) {
            try {
              const arr = JSON.parse(normalizeJsonText(embeddedArr));
              if (Array.isArray(arr) && arr.length && arr.some((x) => x && typeof x === 'object' && x.op)) {
                return { summary: '', assumptions: [], operations: arr };
              }
            } catch {
              // ignore
            }
          }
          return parsed;
        }
      } catch {
        // next variant
      }
    }
  }
  return null;
}

function parseCriticJsonLoose(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const attempts = [text];
  const block = text.match(CRITIC_BLOCK_RE);
  if (block?.[1]) attempts.push(block[1].trim());
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const firstObj = extractFirstJsonObject(text);
  if (firstObj) attempts.push(firstObj.trim());
  for (const chunk of attempts) {
    try {
      const parsed = JSON.parse(normalizeJsonText(chunk));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // next attempt
    }
  }
  return null;
}

export function extractFigmaPlan(raw) {
  const parsed = parseJsonLoose(raw);
  if (!parsed) return null;

  const operations = Array.isArray(parsed.operations) ? parsed.operations : [];
  const sanitizedOps = operations
    .map((op) => sanitizeOperation(op))
    .filter(Boolean)
    .slice(0, 80);

  return {
    summary: String(parsed.summary || '').trim(),
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10)
      : [],
    operations: sanitizedOps,
  };
}

export function extractFigmaCritic(raw) {
  const parsed = parseCriticJsonLoose(raw);
  if (!parsed) return null;
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
    : [];
  let improvedPlan = null;
  if (parsed.improvedPlan && typeof parsed.improvedPlan === 'object') {
    const candidate = extractFigmaPlan(JSON.stringify(parsed.improvedPlan));
    if (candidate?.operations?.length) improvedPlan = candidate;
  }
  return {
    verdict: String(parsed.verdict || 'unknown').trim().toLowerCase(),
    score: clampNumber(parsed.score, 0, 100, 0),
    issues,
    improvedPlan,
  };
}

function sanitizeOperation(op) {
  if (!op || typeof op !== 'object') return null;
  const kind = String(op.op || '').trim();
  if (!ALLOWED_OPS.has(kind)) return null;

  const safe = {
    op: kind,
    target: String(op.target || 'selection').trim() || 'selection',
    key: op.key ? String(op.key).trim() : undefined,
    parentKey: op.parentKey ? String(op.parentKey).trim() : undefined,
    nodeId: op.nodeId ? String(op.nodeId) : undefined,
    name: op.name != null ? String(op.name) : undefined,
    text: op.text != null ? String(op.text) : undefined,
    label: op.label != null ? String(op.label) : undefined,
    visible: op.visible == null ? undefined : !!op.visible,
    layoutMode: op.layoutMode ? String(op.layoutMode).toUpperCase() : undefined,
  };

  if (op.width != null) safe.width = clampNumber(op.width, 1, 10000, 100);
  if (op.height != null) safe.height = clampNumber(op.height, 1, 10000, 100);
  if (op.x != null) safe.x = clampNumber(op.x, -50000, 50000, 0);
  if (op.y != null) safe.y = clampNumber(op.y, -50000, 50000, 0);
  if (op.radius != null) safe.radius = clampNumber(op.radius, 0, 2000, 0);
  if (op.spacing != null) safe.spacing = clampNumber(op.spacing, -1000, 1000, 0);
  if (op.fontSize != null) safe.fontSize = clampNumber(op.fontSize, 8, 400, 16);
  if (op.fontWeight != null) safe.fontWeight = clampNumber(op.fontWeight, 100, 900, 400);
  if (op.padding != null) safe.padding = clampNumber(op.padding, 0, 2000, 0);
  if (op.paddingLeft != null) safe.paddingLeft = clampNumber(op.paddingLeft, 0, 2000, 0);
  if (op.paddingRight != null) safe.paddingRight = clampNumber(op.paddingRight, 0, 2000, 0);
  if (op.paddingTop != null) safe.paddingTop = clampNumber(op.paddingTop, 0, 2000, 0);
  if (op.paddingBottom != null) safe.paddingBottom = clampNumber(op.paddingBottom, 0, 2000, 0);

  const fill = normalizeColor(op.fill || op.color);
  if (fill) safe.fill = fill;
  const stroke = normalizeColor(op.stroke);
  if (stroke) safe.stroke = stroke;

  return safe;
}

export const FIGMA_DESIGN_SYSTEM_PROMPT = `Ты — AI-агент правок макета в Figma.
Твоя задача: по переписке, контексту задачи и структуре выделения в Figma выдать ПЛАН ПРАВОК/СОЗДАНИЯ в виде JSON операций.

В сообщении может быть блок "Reference signals". Используй его как ориентир по композиции, визуальной плотности и паттернам UI, но не копируй один-в-один.

Ключевые правила:
- Никакого prose, только валидный JSON в блоке:
<<<FIGMA_PLAN_JSON
{...}
FIGMA_PLAN_JSON>>>
- Операции должны быть безопасными и минимальными (точечные правки, без "снести всё").
- Используй только разрешённые op:
  create_frame, create_text, create_rect, create_button, rename, set_text, resize, move, set_fill_solid, set_stroke_solid, set_corner_radius, set_auto_layout, set_padding, set_spacing, set_visibility.
- target:
  - "selection" — применить к выделенным объектам.
  - "nodeId" + nodeId — если нужно попасть в конкретный узел.
- Для операций создания:
  - key: уникальный алиас созданного узла (например "root", "heroTitle", "ctaBtn")
  - parentKey: key родителя, если создаёшь дочерний узел
  - если parentKey не задан, узел создаётся на текущей странице
- Если данных не хватает, запиши это в assumptions и выдай максимально безопасный вариант.

Формат ответа:
{
  "summary": "коротко что будет изменено",
  "assumptions": ["..."],
  "operations": [
    {"op":"create_frame","key":"root","name":"Landing","width":1440,"height":1024,"x":120,"y":120,"fill":{"r":255,"g":255,"b":255,"a":1}},
    {"op":"create_text","key":"title","parentKey":"root","name":"Hero Title","text":"Заголовок","fontSize":56,"x":80,"y":120},
    {"op":"create_button","key":"cta","parentKey":"root","name":"CTA","label":"Начать","x":80,"y":260}
  ]
}`;

export const FIGMA_DESIGN_CRITIC_PROMPT = `Ты — строгий AI-критик UI-макета.
Тебе дают:
1) запрос пользователя,
2) план JSON операций для Figma,
3) контекст выделения и reference signals.

Проверь план по критериям:
- иерархия контента и читаемость,
- структура секций и композиция,
- типографика и визуальный ритм,
- контраст и доступность,
- консистентность отступов/размеров,
- соответствие запросу.

Если план слабый, верни improvedPlan с исправлениями.
Если план хороший, improvedPlan оставь null.

Отвечай ТОЛЬКО JSON в блоке:
<<<FIGMA_CRITIC_JSON
{
  "verdict": "approved|needs_improvement",
  "score": 0-100,
  "issues": ["..."],
  "improvedPlan": { "summary": "...", "assumptions": [], "operations": [...] } | null
}
FIGMA_CRITIC_JSON>>>`;

export function buildFigmaContextBlock(selectionBrief) {
  if (!selectionBrief) return 'Figma контекст недоступен.';
  const lines = [
    '## Контекст выделения в Figma',
    `- page: ${selectionBrief.pageName || '—'}`,
    `- file: ${selectionBrief.fileName || '—'}`,
    `- selectedCount: ${selectionBrief.selectedCount || 0}`,
    '',
    '```json',
    JSON.stringify(selectionBrief, null, 2).slice(0, 12000),
    '```',
  ];
  return lines.join('\n');
}
