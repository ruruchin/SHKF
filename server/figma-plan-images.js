/**
 * Генерация иллюстраций NanoBanana для слотов imagePrompt в плане Figma.
 */

import { fetchNanobananaImageWithNet } from './nanobanana-net.js';
import { extractUserRequirements } from '../shared/figma-user-requirements.js';

function stylePrefix(message) {
  const reqs = extractUserRequirements(message);
  const fintech = /инвест|fintech|банк/i.test(String(message || ''));
  return [
    fintech ? 'Modern fintech mobile app UI illustration, clean minimal' : 'Modern mobile app UI illustration',
    ...reqs.slice(0, 2),
  ].join('. ');
}

/**
 * @param {object} plan
 * @param {{ message?: string, nanobananaService?: object, settings?: object }} deps
 */
export async function enrichFigmaPlanWithNanobananaImages(plan, { message = '', nanobananaService, settings = {} } = {}) {
  if (!plan?.operations?.length || !nanobananaService) return { plan, generated: 0, skipped: true };

  const apiKey = String(settings.apiKey || '').trim();
  if (!apiKey) {
    return { plan, generated: 0, skipped: true, reason: 'no-nanobanana-key' };
  }

  nanobananaService.configure(settings);
  const prefix = stylePrefix(message);
  const extra = [];
  let generated = 0;
  const maxSlots = Math.min(6, Number(settings.figmaImageSlotsMax) || 4);

  for (const op of plan.operations) {
    if (generated >= maxSlots) break;
    const prompt = String(op.imagePrompt || '').trim();
    if (!prompt || !op.key) continue;

    try {
      const result = await nanobananaService.generate({
        prompt: `${prefix}. ${prompt}. No text in image, no watermark.`,
        model: settings.defaultModel || settings.model || 'nanobanan-2',
        resolution: settings.resolution || '1K',
        aspectRatio: '9:16',
        mode: settings.requestMode || 'sync',
      });
      const url = result?.imageUrls?.[0];
      if (!url) continue;

      let imageBase64 = null;
      try {
        const { buf } = await fetchNanobananaImageWithNet(url, { apiKey });
        imageBase64 = buf.toString('base64');
      } catch {
        extra.push({ op: 'set_image_fill', key: op.key, imageUrl: url });
        generated += 1;
        continue;
      }

      extra.push({
        op: 'set_image_fill',
        key: op.key,
        imageUrl: url,
        imageBase64,
        mimeType: 'image/png',
      });
      generated += 1;
    } catch {
      /* слот остаётся плейсхолдером */
    }
  }

  if (!extra.length) return { plan, generated: 0 };

  return {
    plan: {
      ...plan,
      assumptions: [
        ...(plan.assumptions || []),
        `NanoBanana: сгенерировано ${generated} иллюстраций для image-блоков.`,
      ],
      operations: [...plan.operations, ...extra],
    },
    generated,
  };
}
