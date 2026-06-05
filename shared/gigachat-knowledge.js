/** Model selection for Konstancia learning / distill (text-only, no Vision required). */

import { defaultGigaChatLiteModel, isGigaChatLiteModel } from './gigachat-vision.js';

const SMART_MODEL_ORDER = ['GigaChat-2-Max', 'GigaChat-2-Pro', 'GigaChat-2', 'GigaChat-2-Lite', 'GigaChat'];

/**
 * Best available text model for knowledge distill / RAG synthesis.
 * Uses user's agent model when it is Pro/Max; otherwise prefers Pro, then Lite.
 */
export function resolveKnowledgeModel(agentModel) {
  const m = String(agentModel || '').trim();
  if (isGigaChatLiteModel(m)) return defaultGigaChatLiteModel();
  if (/max/i.test(m)) return m;
  if (/pro/i.test(m)) return m;
  if (/^GigaChat-2$/i.test(m)) return 'GigaChat-2-Pro';
  if (m) return m;
  return 'GigaChat-2-Pro';
}

export function knowledgeChatParams({ smart = true } = {}) {
  return {
    temperature: smart ? 0.42 : 0.35,
    maxTokens: smart ? 4096 : 2048,
  };
}
