/**
 * Воссоздание выбранного экрана Mobbin в Figma через GigaChat Vision.
 */

import { fetchUrlBytesWithNet } from './nanobanana-net.js';
import { resolveMobbinPreviewUrl, resolveMobbinPreviewUrls } from './mobbin-preview.js';
import { normalizeImageForGigaChat, preferPngMobbinUrl, sniffImageMime, isRiskyMobbinCdnUrl } from './gigachat-image.js';
import {
  extractFigmaPlan,
  diagnoseFigmaPlanParse,
  normalizeFigmaPlanOperations,
  pageIndexFromOpKey,
} from './figma-design-agent.js';
import { buildDeterministicAppPlan } from './figma-app-plan.js';
import { inferBlueprintFromMessage } from '../shared/site-builder-blueprint.js';
import { extractUserRequirements } from '../shared/figma-user-requirements.js';
import { buildMobbinCopyRules } from '../shared/figma-copy-context.js';
import { formatMobbinStyleBlock } from '../shared/mobbin-style-proposals.js';
import { MOBBIN_PLAN_ORIGIN_X, shiftPlanToFreeColumn } from '../shared/figma-plan-layout.js';
import {
  isGigaChatVisionModel,
  isGigaChatLiteModel,
  defaultGigaChatLiteModel,
  GIGACHAT_VISION_HINT,
  GIGACHAT_LITE_MOBBIN_HINT,
} from '../shared/gigachat-vision.js';
import { isGigaChatBillingError } from './agent-service.js';

export const FIGMA_FROM_MOBBIN_VISION_PROMPT = `Ты — senior product designer и Figma-автоматизатор.
На скриншоте — реальный экран из Mobbin. Воссоздай его в Figma максимально точно по стилю, отступам и иерархии.

## Корень
- Один фрейм key="screen", 390×844, x=${MOBBIN_PLAN_ORIGIN_X}, y=120, fill = фон экрана со скрина (светлый, как на референсе — не чёрный).
- layoutGrids на screen: только COLUMNS (count 4, offset 16, gutterSize 12, alignment STRETCH).
- Внутри screen обязателен контейнер key="content", width 390, layoutMode VERTICAL, padding 16, spacing 16 — ВСЕ блоки UI только внутри content (не вешай текст на screen напрямую).

## Контейнеры (критично)
- Каждый визуальный блок = отдельный create_frame-карточка: hero, stats, promo, список, форма, таб-бар, превью приложения и т.д.
- Карточка: fill белый/серый со скрина, radius 12–20, layoutMode VERTICAL или HORIZONTAL, padding 12–20, spacing 8–12.
- Ряд метрик (3 колонки) = frame statsRow (HORIZONTAL) → внутри 3 frame statCard с radius 10–14.
- Сетка карточек = frame cardsRow (HORIZONTAL) или вертикальный список cardItem frames.
- CTA-кнопка внутри карточки hero, не отдельно на canvas.
- create_rect только для мини-графиков, баров, разделителей внутри карточки.
- Никогда не клади create_text/create_input без parentKey на корень.

## Копирайт (критично)
- Язык и название продукта — из блока «Копирайт» в запросе пользователя.
- Mobbin — только layout/цвета; НЕ пиши Revolut/Monzo и чужие слоганы с референса.

## Стилистика 1:1 с референсом
- Цвета RGB 0–255 снимай со скрина: фон страницы, карточки, accent кнопок, текст title/body/muted.
- fontSize и fontWeight как на скрине (заголовок 24–32 bold, body 13–15, labels 11–12).
- create_text: width ~310–342, textAutoResize HEIGHT.
- create_input для полей; create_button с fill accent, radius 10–14, height 44–52.
- Иллюстрации/превью: create_frame + imagePrompt (кратко, по смыслу блока на скрине).

## assumptions (обязательно 6–12 пунктов)
Перечисли каждый блок: "block:hero — белая карточка r16, заголовок, подзаголовок, teal CTA"; "block:stats — 3 ячейки в ряд"; и т.д.

## operations
- 38–55 ops, parentKey и key уникальны, порядок: родитель раньше детей.
- op только snake_case: create_frame, create_text, create_rect, create_button, create_input.

Ответ ТОЛЬКО JSON:
<<<FIGMA_PLAN_JSON
{"summary":"...","assumptions":["block:..."],"operations":[...]}
FIGMA_PLAN_JSON>>>`;

const FIGMA_MOBBIN_LITE_PROMPT = `Ты — senior product designer. Скриншота Mobbin нет (модель Lite без Vision).
Собери структурный мобильный макет fintech в Figma JSON по запросу пользователя и названию референса.

## Корень
- screen 390×844, x=${MOBBIN_PLAN_ORIGIN_X}, y=120, светлый фон (#F8FAFC).
- content внутри screen: VERTICAL, padding 16, spacing 16.
- Каждый блок UI — create_frame-карточка (radius 12–20), тексты/поля только с parentKey.

## Копирайт
- Язык и продукт — из запроса; не копируй Revolut/чужие бренды с Mobbin.

## operations
- 32–48 ops, snake_case: create_frame, create_text, create_rect, create_button, create_input.

Ответ ТОЛЬКО JSON:
<<<FIGMA_PLAN_JSON
{"summary":"...","assumptions":["block:..."],"operations":[...]}
FIGMA_PLAN_JSON>>>`;

const FIGMA_JSON_REPAIR_PROMPT = `Верни ТОЛЬКО валидный JSON:
{"summary":"...","assumptions":["block:имя — описание карточки"],"operations":[...]}
Правила: screen 390×844; content (VERTICAL padding 16) внутри screen; каждый UI-блок — create_frame-карточка с radius и layoutMode; тексты/инпуты только с parentKey; минимум 30 ops; op в snake_case.`;

function buildMobbinVisionFallbackPlan({ screen, message, refs }) {
  const blueprint = inferBlueprintFromMessage(message, refs);
  const pages = (blueprint.pages || []).filter((p) => p.id === 'home');
  const plan = buildDeterministicAppPlan({
    message,
    refs,
    blueprint: { ...blueprint, pages: pages.length ? pages : [blueprint.pages[0]].filter(Boolean) },
  });
  plan.summary = `Запасной макет (Vision не вернул JSON): ${screen?.app_name || screen?.title || 'экран'}`;
  plan.assumptions = [
    'GigaChat ответил без распознаваемого JSON — применён структурный макет по теме запроса, не копия скриншота.',
    'Повторите с другим референсом или уточните запрос, если нужна точная копия Mobbin.',
    ...(plan.assumptions || []),
  ];
  return plan;
}

async function downloadImageBuffer(url) {
  const candidates = [url];
  const rewritten = preferPngMobbinUrl(url);
  if (rewritten && rewritten !== url) candidates.push(rewritten);

  let lastErr = null;
  for (const candidate of candidates) {
    try {
      return await fetchUrlBytesWithNet(candidate, {
        Accept: 'image/png,image/jpeg,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'SHKF/1.0',
        Referer: 'https://mobbin.com/',
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(lastErr?.message || 'Не удалось скачать превью Mobbin');
}

async function packImagePayload(buf) {
  const normalized = await normalizeImageForGigaChat({
    buffer: buf,
    mimeType: sniffImageMime(buf),
    filename: 'mobbin-ref.png',
  });
  return {
    buffer: normalized.buffer,
    mimeType: normalized.mimeType,
    filename: normalized.filename,
    dataUrl: `data:${normalized.mimeType};base64,${normalized.buffer.toString('base64')}`,
  };
}

export async function fetchMobbinImagePayload(imageUrl, { mobbinPageUrl } = {}) {
  const raw = String(imageUrl || '').trim();
  if (!raw && !mobbinPageUrl) throw new Error('Нет URL превью Mobbin');

  const tryUrls = [];
  if (mobbinPageUrl) {
    for (const og of await resolveMobbinPreviewUrls(mobbinPageUrl)) {
      if (og && !tryUrls.includes(og)) tryUrls.push(og);
    }
  }
  if (raw && !isRiskyMobbinCdnUrl(raw) && !tryUrls.includes(raw)) {
    tryUrls.push(raw);
  }
  if (raw && isRiskyMobbinCdnUrl(raw) && !tryUrls.length) {
    tryUrls.push(raw);
  }

  let lastErr = null;
  for (const url of tryUrls) {
    try {
      const buf = await downloadImageBuffer(url);
      return await packImagePayload(buf);
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || '');
      if (!/AVIF|WEBP_DECODE|декодировать/i.test(msg)) throw err;
    }
  }

  throw new Error(lastErr?.message || 'Не удалось подготовить превью для GigaChat');
}

async function buildFigmaPlanFromMobbinLite({
  message,
  screen,
  agentService,
  expandApp = false,
  refs = [],
  modelOverride = null,
  selectedStyle = null,
}) {
  const requirements = extractUserRequirements(message);
  const copyRules = buildMobbinCopyRules(message, screen);
  const liteModel = modelOverride || (isGigaChatLiteModel(agentService.settings.model)
    ? agentService.settings.model
    : defaultGigaChatLiteModel());

  const styleBlock = selectedStyle ? formatMobbinStyleBlock(selectedStyle) : '';
  const userText = [
    `Запрос: ${message}`,
    `Референс Mobbin (только тема/UI-паттерн, без скрина): ${screen?.app_name || screen?.title || 'fintech app'}`,
    screen?.mobbin_url ? `Ссылка: ${screen.mobbin_url}` : '',
    styleBlock,
    '',
    'Копирайт:',
    ...copyRules.map((r) => `• ${r}`),
    requirements.length ? ['Требования:', ...requirements.map((r) => `• ${r}`)].join('\n') : '',
    expandApp || selectedStyle ? 'Полное приложение: 3–4 экрана в едином стиле (home, onboarding/login, внутренний экран).' : '',
  ].filter(Boolean).join('\n');

  const chatResult = await agentService.chat({
    message: userText,
    history: [],
    systemPrompt: FIGMA_MOBBIN_LITE_PROMPT,
    allowFollowups: false,
    maxTokens: 8192,
    temperature: 0.55,
    modelOverride: liteModel,
  });

  if (!chatResult?.ok) {
    return {
      ok: false,
      message: chatResult?.message || 'Ошибка GigaChat Lite',
      billing: chatResult?.billing,
    };
  }

  const parsedLite = extractFigmaPlan(chatResult.content);
  let plan = parsedLite;
  if (!plan?.operations?.length) {
    plan = buildMobbinVisionFallbackPlan({ screen, message, refs });
  }

  plan.summary = plan.summary || `Макет (Lite): ${screen?.app_name || 'Mobbin'}`;
  plan.assumptions = [
    GIGACHAT_LITE_MOBBIN_HINT,
    `Модель: ${liteModel} — без Vision, структура по запросу.`,
    ...(plan.assumptions || []),
  ];

  if (expandApp || selectedStyle) {
    const blueprint = inferBlueprintFromMessage(message, refs);
    const skipPageIds = new Set(['home']);
    const pageIndices = (blueprint.pages || []).map((p, i) => ({ id: p.id, i }))
      .filter((x) => !skipPageIds.has(x.id))
      .map((x) => x.i);
    const appPlan = buildDeterministicAppPlan({ message, refs, blueprint });
    const shiftX = 390 + 64;
    const baseX = MOBBIN_PLAN_ORIGIN_X;
    const renameKeys = (op, suffix) => {
      const copy = { ...op };
      if (copy.key) copy.key = `${copy.key}${suffix}`;
      if (copy.parentKey) copy.parentKey = `${copy.parentKey}${suffix}`;
      return copy;
    };
    const visionOps = plan.operations.map((op) => renameKeys(op, '_ref'));
    const extraOps = [];
    const pageSlots = new Map();
    let slot = 0;
    (appPlan.operations || []).forEach((op) => {
      if (op.key === 'prototypeRoot') return;
      const idx = pageIndexFromOpKey(op);
      if (idx == null || !pageIndices.includes(idx)) return;
      const suffix = `_p${idx}`;
      if (op.key && /^page\d+$/.test(op.key)) {
        if (!pageSlots.has(idx)) pageSlots.set(idx, slot++);
        const copy = renameKeys(op, suffix);
        copy.x = baseX + shiftX * (pageSlots.get(idx) + 1);
        extraOps.push(copy);
        return;
      }
      extraOps.push(renameKeys(op, suffix));
    });
    plan = {
      summary: `${plan.summary}. + ${pageIndices.length} доп. экранов.`,
      assumptions: plan.assumptions,
      operations: normalizeFigmaPlanOperations([...visionOps, ...extraOps]),
    };
  }

  plan.operations = normalizeFigmaPlanOperations(plan.operations || []);
  plan = shiftPlanToFreeColumn(plan);

  return {
    ok: true,
    plan,
    model: `figma-mobbin-lite-v1 (${liteModel})`,
    liteMode: true,
    visionFallback: !parsedLite?.operations?.length,
    referenceScreen: screen,
  };
}

export async function buildFigmaPlanFromMobbinScreen({
  message,
  screen,
  agentService,
  expandApp = false,
  refs = [],
  selectedStyle = null,
}) {
  if (!agentService?.isConfigured()) {
    return { ok: false, message: 'Подключите GigaChat в настройках' };
  }

  const model = agentService.settings.model;
  if (isGigaChatLiteModel(model)) {
    return buildFigmaPlanFromMobbinLite({
      message,
      screen,
      agentService,
      expandApp: expandApp || !!selectedStyle,
      refs,
      selectedStyle,
    });
  }

  if (!isGigaChatVisionModel(model)) {
    return { ok: false, message: GIGACHAT_VISION_HINT };
  }

  const ogFirst = screen?.mobbin_url
    ? (await resolveMobbinPreviewUrl(screen.mobbin_url) || '')
    : '';
  const apiUrl = String(screen?.imageUrl || '').trim();
  const imageUrl = ogFirst || apiUrl;

  let imagePayload = null;
  if (imageUrl || screen?.mobbin_url) {
    try {
      imagePayload = await fetchMobbinImagePayload(apiUrl || ogFirst, { mobbinPageUrl: screen?.mobbin_url });
    } catch (err) {
      return { ok: false, message: `Не удалось загрузить превью Mobbin: ${err.message}` };
    }
  } else {
    return { ok: false, message: 'Нет превью экрана. Откройте ссылку Mobbin в браузере или соберите макет без референса.' };
  }

  const requirements = extractUserRequirements(message);
  const copyRules = buildMobbinCopyRules(message, screen);
  const styleBlock = selectedStyle ? formatMobbinStyleBlock(selectedStyle) : '';
  const fullRedesign = !!selectedStyle;
  const userText = [
    `Запрос пользователя: ${message}`,
    '',
    `Референс Mobbin (скриншот — layout и стиль, НЕ текст бренда): ${screen?.app_name || screen?.title || 'Screen'}`,
    screen?.mobbin_url ? `Ссылка: ${screen.mobbin_url}` : '',
    styleBlock,
    '',
    'Копирайт:',
    ...copyRules.map((r) => `• ${r}`),
    '',
    fullRedesign
      ? 'Задача: полный редизайн приложения в ВЫБРАННОМ стиле — не копия 1:1 пикселей, а единая дизайн-система на 3–4 экранах.'
      : 'Задача: повтори стилистику референса 1:1 — фон, карточки, скругления, accent, типографика.',
    'Для каждого видимого блока: отдельная frame-карточка внутри content; в assumptions опиши каждый block:имя.',
    'Не оставляй «голый» текст на canvas. Ряды метрик и превью — вложенные frame с HORIZONTAL layout.',
    requirements.length ? ['Требования:', ...requirements.map((r) => `• ${r}`)].join('\n') : '',
    expandApp || fullRedesign
      ? 'Собери несколько экранов приложения в одном стиле (рядом, gap 48px).'
      : '',
  ].filter(Boolean).join('\n');

  const images = imagePayload
    ? [{ buffer: imagePayload.buffer, mimeType: imagePayload.mimeType, filename: imagePayload.filename }]
    : [];

  const chatResult = await agentService.chat({
    message: userText,
    history: [],
    systemPrompt: FIGMA_FROM_MOBBIN_VISION_PROMPT,
    allowFollowups: false,
    images,
    maxTokens: 8192,
    temperature: 0.45,
  });

  if (!chatResult?.ok) {
    const billing = chatResult?.billing || isGigaChatBillingError(chatResult?.message);
    if (billing) {
      const liteResult = await buildFigmaPlanFromMobbinLite({
        message,
        screen,
        agentService,
        expandApp: expandApp || !!selectedStyle,
        refs,
        selectedStyle,
        modelOverride: defaultGigaChatLiteModel(),
      });
      if (liteResult.ok) {
        liteResult.assumptions = [
          'Pro/Max без токенов — автоматически собрано через GigaChat Lite (без скриншота).',
          ...(liteResult.assumptions || []),
        ];
        return liteResult;
      }
    }
    return {
      ok: false,
      message: billing
        ? `${chatResult?.message || 'Нет токенов Pro/Max'}. Выберите GigaChat (Lite) в шапке агента — осталось ~600k токенов на Lite.`
        : (chatResult?.message || 'Ошибка Vision'),
      billing,
    };
  }

  let plan = extractFigmaPlan(chatResult.content);
  const modelName = agentService.settings?.model || 'GigaChat';
  let visionFallback = false;
  let billingBlocked = !!(chatResult?.billing);

  const runRepair = async (hint, { withImages = true, jsonOnly = false } = {}) => {
    if (billingBlocked) return null;
    const repair = await agentService.chat({
      message: hint,
      history: [],
      systemPrompt: jsonOnly ? FIGMA_JSON_REPAIR_PROMPT : FIGMA_FROM_MOBBIN_VISION_PROMPT,
      allowFollowups: false,
      images: withImages ? images : [],
      maxTokens: 8192,
      temperature: jsonOnly ? 0.15 : 0.35,
    });
    if (!repair?.ok) {
      if (repair?.billing || isGigaChatBillingError(repair?.message)) {
        billingBlocked = true;
      }
      return null;
    }
    return extractFigmaPlan(repair.content);
  };

  if (!plan?.operations?.length) {
    plan = await runRepair(
      'Ответ без валидного JSON. Верни ТОЛЬКО блок <<<FIGMA_PLAN_JSON ... FIGMA_PLAN_JSON>>> с operations (минимум 18 ops, key screen 390×844).',
      { withImages: true, jsonOnly: false },
    );
  }
  if (!plan?.operations?.length) {
    plan = await runRepair(
      `Преобразуй в JSON operations для Figma 390×844.\n\n${String(chatResult.content || '').slice(0, 8000)}`,
      { withImages: false, jsonOnly: true },
    );
  }
  if (!plan?.operations?.length) {
    plan = await runRepair(
      'Скриншот Mobbin приложен. Верни только JSON с operations (op в snake_case), без текста до и после.',
      { withImages: true, jsonOnly: true },
    );
  }

  if (!plan?.operations?.length) {
    const diag = diagnoseFigmaPlanParse(chatResult.content);
    if (diag.rawOpCount > 0 && diag.sanitizedOpCount === 0) {
      return {
        ok: false,
        message: `Vision вернул ${diag.rawOpCount} операций, но формат op не распознан (примеры: ${diag.sampleKinds.join(', ')}). Обновите SHKF и повторите.`,
        debug: diag,
      };
    }
    plan = buildMobbinVisionFallbackPlan({ screen, message, refs });
    visionFallback = true;
  }

  plan.summary = plan.summary || `Макет по Mobbin: ${screen?.app_name || screen?.title || 'экран'}`;
  plan.assumptions = [
    ...(plan.assumptions || []),
    `Источник: ${screen?.app_name || screen?.title} (${screen?.mobbin_url || 'Mobbin'})`,
    'Сгенерировано по превью через GigaChat Vision.',
  ];

  if (expandApp || selectedStyle) {
    const blueprint = inferBlueprintFromMessage(message, refs);
    const skipPageIds = new Set(['home']);
    const pageIndices = (blueprint.pages || []).map((p, i) => ({ id: p.id, i }))
      .filter((x) => !skipPageIds.has(x.id))
      .map((x) => x.i);
    const appPlan = buildDeterministicAppPlan({ message, refs, blueprint });
    const shiftX = 390 + 64;
    const baseX = MOBBIN_PLAN_ORIGIN_X;

    const renameKeys = (op, suffix) => {
      const copy = { ...op };
      if (copy.key) copy.key = `${copy.key}${suffix}`;
      if (copy.parentKey) copy.parentKey = `${copy.parentKey}${suffix}`;
      return copy;
    };

    const visionOps = plan.operations.map((op) => renameKeys(op, '_ref'));

    const extraOps = [];
    const pageSlots = new Map();
    let slot = 0;
    (appPlan.operations || []).forEach((op) => {
      if (op.key === 'prototypeRoot') return;
      const idx = pageIndexFromOpKey(op);
      if (idx == null || !pageIndices.includes(idx)) return;
      const suffix = `_p${idx}`;
      if (op.key && /^page\d+$/.test(op.key)) {
        if (!pageSlots.has(idx)) pageSlots.set(idx, slot++);
        const copy = renameKeys(op, suffix);
        copy.x = baseX + shiftX * (pageSlots.get(idx) + 1);
        extraOps.push(copy);
        return;
      }
      extraOps.push(renameKeys(op, suffix));
    });

    plan = {
      summary: `${plan.summary}. + ${pageIndices.length} доп. экранов (онбординг, вход и т.д.).`,
      assumptions: [
        ...(plan.assumptions || []),
        'Первый экран — копия Mobbin (Vision). Остальные — по запросу, с NanoBanana для иллюстраций.',
      ],
      operations: normalizeFigmaPlanOperations([...visionOps, ...extraOps]),
      pages: [
        { route: '/ref', name: screen?.app_name || 'Mobbin ref', purpose: 'vision' },
        ...(blueprint.pages || []).filter((p) => !skipPageIds.has(p.id)),
      ],
    };
  }

  plan.operations = normalizeFigmaPlanOperations(plan.operations || []);
  plan = shiftPlanToFreeColumn(plan);

  return {
    ok: true,
    plan,
    model: visionFallback ? 'figma-mobbin-fallback-v1' : 'figma-mobbin-vision-v1',
    visionFallback,
    referenceScreen: screen,
    previewDataUrl: imagePayload?.dataUrl || null,
  };
}
