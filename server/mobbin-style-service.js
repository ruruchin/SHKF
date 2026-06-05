import { resolveKnowledgeModel, knowledgeChatParams } from '../shared/gigachat-knowledge.js';
import {
  MOBBIN_STYLE_PROPOSAL_SYSTEM,
  buildMobbinStyleProposalMessage,
} from '../shared/mobbin-style-proposals.js';
import { inferMobbinPlatform } from './mobbin-service.js';

function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackStyles(screens, message) {
  const pool = (screens || []).slice(0, 6);
  const templates = [
    {
      id: 'style-clean',
      name: 'Чистый fintech',
      tagline: 'Светлый фон, карточки, акцент teal/blue',
      mood: 'спокойный, доверительный',
      colors: { background: '#F8FAFC', surface: '#FFFFFF', accent: '#0D9488', text: '#0F172A', muted: '#64748B' },
      typography: 'SF Pro / Inter: заголовок 28 semibold, body 15 regular',
      layoutPatterns: ['hero-карточка', 'ряд метрик 3 колонки', 'список с иконками'],
      uiTraits: ['скругление 16', 'много воздуха', 'outline tab bar'],
    },
    {
      id: 'style-bold',
      name: 'Контрастный premium',
      tagline: 'Тёмный hero, яркий CTA, крупная типографика',
      mood: 'уверенный, premium',
      colors: { background: '#0F172A', surface: '#1E293B', accent: '#38BDF8', text: '#F8FAFC', muted: '#94A3B8' },
      typography: 'крупные заголовки 32–36, контрастные кнопки',
      layoutPatterns: ['full-bleed hero', 'крупные CTA', 'минимум вторичных блоков'],
      uiTraits: ['gradient accent', 'glass cards', 'bold headlines'],
    },
    {
      id: 'style-soft',
      name: 'Мягкий consumer',
      tagline: 'Пастель, иллюстрации, дружелюбные формы',
      mood: 'лёгкий, approachable',
      colors: { background: '#FFF7ED', surface: '#FFFFFF', accent: '#F97316', text: '#292524', muted: '#78716C' },
      typography: 'округлые заголовки 24, body 14–15',
      layoutPatterns: ['иллюстративный hero', 'chip filters', 'вертикальный feed'],
      uiTraits: ['radius 20+', 'soft shadows', 'pastel fills'],
    },
  ];

  return templates.map((tpl, idx) => ({
    ...tpl,
    referenceScreenId: pool[idx % pool.length]?.id || pool[0]?.id || null,
    rationale: `Запасной вариант по теме: ${message?.slice(0, 80) || 'приложение'}`,
  }));
}

export class MobbinStyleService {
  constructor(agentService) {
    this.agent = agentService;
  }

  /**
   * @param {{ message: string, screens: object[] }} input
   */
  async proposeStyles({ message, screens = [] } = {}) {
    const list = Array.isArray(screens) ? screens.filter((s) => s?.id) : [];
    const platform = inferMobbinPlatform(message);
    if (!list.length) {
      return { ok: false, message: 'Нет экранов Mobbin для анализа стиля' };
    }

    if (!this.agent?.isConfigured?.()) {
      const styles = fallbackStyles(list, message);
      return { ok: true, styles, platform, fallback: true };
    }

    const model = resolveKnowledgeModel(this.agent.settings?.model);
    const result = await this.agent.chat({
      message: buildMobbinStyleProposalMessage({ message, screens: list, platform }),
      history: [],
      systemPrompt: MOBBIN_STYLE_PROPOSAL_SYSTEM,
      allowFollowups: false,
      ...knowledgeChatParams({ smart: true }),
      modelOverride: model,
    });

    if (!result?.ok) {
      const styles = fallbackStyles(list, message);
      return {
        ok: true,
        styles,
        platform,
        fallback: true,
        warning: result?.message,
      };
    }

    const parsed = extractJsonObject(result.content);
    let styles = Array.isArray(parsed?.styles) ? parsed.styles : [];
    styles = styles.slice(0, 3).map((s, i) => {
      const refId = String(s.referenceScreenId || '').trim();
      const validRef = list.find((sc) => String(sc.id) === refId)?.id
        || list[i % list.length]?.id
        || list[0]?.id;
      return {
        id: s.id || `style-${i + 1}`,
        name: String(s.name || `Стиль ${i + 1}`).slice(0, 80),
        tagline: String(s.tagline || '').slice(0, 200),
        mood: String(s.mood || '').slice(0, 200),
        colors: s.colors || {},
        typography: String(s.typography || '').slice(0, 400),
        layoutPatterns: Array.isArray(s.layoutPatterns) ? s.layoutPatterns.map(String).slice(0, 8) : [],
        uiTraits: Array.isArray(s.uiTraits) ? s.uiTraits.map(String).slice(0, 8) : [],
        referenceScreenId: validRef,
        rationale: String(s.rationale || '').slice(0, 500),
      };
    });

    if (styles.length < 3) {
      const fb = fallbackStyles(list, message);
      const ids = new Set(styles.map((s) => s.id));
      for (const s of fb) {
        if (styles.length >= 3) break;
        if (!ids.has(s.id)) styles.push(s);
      }
    }

    return { ok: true, styles: styles.slice(0, 3), platform, model: result.model };
  }

  resolveReferenceScreen(screens, style) {
    const list = screens || [];
    const id = style?.referenceScreenId;
    return list.find((s) => String(s.id) === String(id)) || list[0] || null;
  }
}
