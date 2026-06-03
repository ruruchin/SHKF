/**
 * Воссоздание выбранного экрана Mobbin в Figma через GigaChat Vision.
 */

import { fetchUrlBytesWithNet } from './nanobanana-net.js';
import { extractFigmaPlan } from './figma-design-agent.js';
import { buildDeterministicAppPlan } from './figma-app-plan.js';
import { inferBlueprintFromMessage } from '../shared/site-builder-blueprint.js';
import { isGigaChatVisionModel, GIGACHAT_VISION_HINT } from '../shared/gigachat-vision.js';

export const FIGMA_FROM_MOBBIN_VISION_PROMPT = `Ты — senior product designer и Figma-автоматизатор.
На приложенном скриншоте — реальный UI из Mobbin. Твоя задача: воссоздать этот экран в Figma максимально близко к референсу.

Правила:
- Один мобильный фрейм 390×844 px, ключ "screen", name = название экрана из запроса.
- Сохрани иерархию: status bar, header, hero, карточки, списки, табы, графики, CTA, tab bar — всё что видно на скрине.
- Цвета fill/stroke — RGB 0-255 из скрина (не выдумывай generic purple gradient).
- Типографика: реалистичные fontSize (11–34), fontWeight 400/600/700.
- Используй create_frame для контейнеров, create_rect для полей/карточек/чартов, create_text для подписей, create_button для CTA.
- Вложенность через parentKey. Минимум 35 операций для плотного UI как в Mobbin.
- Где видны вертикальные/горизонтальные стеки — set_auto_layout (VERTICAL/HORIZONTAL) + set_padding + set_spacing.
- Скругления: set_corner_radius на карточках и кнопках.
- Тексты на русском, если на скрине русский, иначе как на скрине.
- x,y внутри родителя; корневой screen: x=120, y=120.

Ответ ТОЛЬКО JSON:
<<<FIGMA_PLAN_JSON
{"summary":"...","assumptions":["..."],"operations":[...]}
FIGMA_PLAN_JSON>>>`;

function mimeFromBuffer(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  return 'image/webp';
}

export async function fetchMobbinImagePayload(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) throw new Error('Нет URL превью Mobbin');
  const buf = await fetchUrlBytesWithNet(url, {
    Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    'User-Agent': 'FIRURU/1.0',
    Referer: 'https://mobbin.com/',
  });
  const mimeType = mimeFromBuffer(buf);
  const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : 'webp';
  return {
    buffer: buf,
    mimeType,
    filename: `mobbin-ref.${ext}`,
    dataUrl: `data:${mimeType};base64,${buf.toString('base64')}`,
  };
}

export async function buildFigmaPlanFromMobbinScreen({
  message,
  screen,
  agentService,
  expandApp = false,
  refs = [],
}) {
  if (!agentService?.isConfigured()) {
    return { ok: false, message: 'Подключите GigaChat в настройках' };
  }
  if (!isGigaChatVisionModel(agentService.settings.model)) {
    return { ok: false, message: GIGACHAT_VISION_HINT };
  }

  let imagePayload = null;
  if (screen?.imageUrl) {
    try {
      imagePayload = await fetchMobbinImagePayload(screen.imageUrl);
    } catch (err) {
      return { ok: false, message: `Не удалось загрузить превью Mobbin: ${err.message}` };
    }
  }

  const userText = [
    `Запрос пользователя: ${message}`,
    '',
    `Референс Mobbin: ${screen?.app_name || screen?.title || 'Screen'}`,
    screen?.mobbin_url ? `Ссылка: ${screen.mobbin_url}` : '',
    expandApp ? 'После этого экрана будут добавлены остальные экраны приложения в том же стиле.' : '',
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
  });

  if (!chatResult?.ok) {
    return { ok: false, message: chatResult?.message || 'Ошибка Vision' };
  }

  let plan = extractFigmaPlan(chatResult.content);
  if (!plan?.operations?.length) {
    const repair = await agentService.chat({
      message: `Верни только блок FIGMA_PLAN_JSON с operations (минимум 30 ops) для экрана 390×844 по скриншоту.\n\n${chatResult.content}`,
      history: [],
      systemPrompt: FIGMA_FROM_MOBBIN_VISION_PROMPT,
      allowFollowups: false,
      images,
      maxTokens: 8192,
    });
    if (repair?.ok) plan = extractFigmaPlan(repair.content);
  }

  if (!plan?.operations?.length) {
    return { ok: false, message: 'Vision не собрал план Figma. Попробуйте GigaChat-2-Pro или другой референс.' };
  }

  plan.summary = plan.summary || `Макет по Mobbin: ${screen?.app_name || screen?.title || 'экран'}`;
  plan.assumptions = [
    ...(plan.assumptions || []),
    `Источник: ${screen?.app_name || screen?.title} (${screen?.mobbin_url || 'Mobbin'})`,
    'Сгенерировано по превью через GigaChat Vision.',
  ];

  if (expandApp) {
    const blueprint = inferBlueprintFromMessage(message, refs);
    const appPlan = buildDeterministicAppPlan({ message, refs, blueprint });
    const shiftX = 390 + 64;

    const renameKeys = (op, suffix) => {
      const copy = { ...op };
      if (copy.key) copy.key = `${copy.key}${suffix}`;
      if (copy.parentKey) copy.parentKey = `${copy.parentKey}${suffix}`;
      return copy;
    };

    const visionOps = plan.operations.map((op) => renameKeys(op, '_ref'));

    const extraOps = [];
    (appPlan.operations || []).forEach((op) => {
      if (op.key === 'prototypeRoot') return;
      const pageMatch = String(op.key || '').match(/^page(\d+)$/);
      if (pageMatch) {
        const idx = Number(pageMatch[1]);
        const copy = renameKeys(op, `_p${idx}`);
        copy.x = 120 + shiftX * (idx + 1);
        extraOps.push(copy);
        return;
      }
      const parentPage = String(op.parentKey || '').match(/^page(\d+)$/);
      if (parentPage) {
        const idx = Number(parentPage[1]);
        const copy = renameKeys(op, `_p${idx}`);
        extraOps.push(copy);
        return;
      }
      if (String(op.parentKey || '').match(/^page\d+_p\d+$/)) {
        extraOps.push(renameKeys(op, ''));
      }
    });

    plan = {
      summary: `${plan.summary}. + ${(appPlan.pages || []).length} экранов в стиле приложения.`,
      assumptions: [...(plan.assumptions || []), ...(appPlan.assumptions || [])],
      operations: [...visionOps, ...extraOps],
      pages: [
        { route: '/ref', name: screen?.app_name || 'Mobbin ref', purpose: 'vision' },
        ...(appPlan.pages || []),
      ],
    };
  }

  return {
    ok: true,
    plan,
    model: 'figma-mobbin-vision-v1',
    referenceScreen: screen,
    previewDataUrl: imagePayload?.dataUrl || null,
  };
}
