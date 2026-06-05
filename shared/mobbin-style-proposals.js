/** Prompts and helpers for Mobbin-derived app style directions. */

export const MOBBIN_STYLE_PROPOSAL_SYSTEM = `Ты — lead product designer. По списку экранов из Mobbin предложи ровно 3 РАЗНЫХ направления стиля для нового приложения пользователя.

Правила:
- Стили должны заметно отличаться (например: минимализм vs неоморфизм vs яркий fintech; не три варианта одного и того же).
- Опирайся только на переданные экраны (названия приложений, теги, платформа) — не выдумывай несуществующие референсы.
- Для каждого стиля укажи referenceScreenId — id экрана из списка, который лучше всего иллюстрирует стиль.
- Цвета — hex или rgb 0-255.
- Ответ ТОЛЬКО JSON без markdown:
{"styles":[{"id":"style-1","name":"Короткое имя","tagline":"одна фраза","mood":"...","colors":{"background":"#...","surface":"#...","accent":"#...","text":"#...","muted":"#..."},"typography":"шрифт и иерархия","layoutPatterns":["..."],"uiTraits":["..."],"referenceScreenId":"id из списка","rationale":"почему этот стиль под запрос"}]}`;

export function buildMobbinStyleProposalMessage({ message, screens = [], platform = 'ios' }) {
  const list = (screens || []).slice(0, 14).map((s, i) => {
    const tags = Array.isArray(s.tags) ? s.tags.join(', ') : '';
    return `${i + 1}. id=${s.id} · ${s.app_name || 'Screen'} · ${s.platform || platform}${tags ? ` · ${tags}` : ''}`;
  }).join('\n');

  return [
    `Запрос пользователя: ${String(message || '').trim()}`,
    `Платформа: ${platform === 'web' ? 'Web' : 'iOS mobile'}`,
    '',
    'Экраны Mobbin (выбери referenceScreenId из id=...):',
    list || '(пусто)',
  ].join('\n');
}

/**
 * @param {object} style
 * @returns {string}
 */
export function formatMobbinStyleBlock(style) {
  if (!style?.name) return '';
  const colors = style.colors || {};
  const lines = [
    `## Выбранный стиль: ${style.name}`,
    style.tagline ? `Направление: ${style.tagline}` : '',
    style.mood ? `Настроение: ${style.mood}` : '',
    '### Палитра (обязательно)',
    colors.background ? `- Фон: ${colors.background}` : '',
    colors.surface ? `- Поверхности/карточки: ${colors.surface}` : '',
    colors.accent ? `- Акцент/CTA: ${colors.accent}` : '',
    colors.text ? `- Текст: ${colors.text}` : '',
    colors.muted ? `- Вторичный текст: ${colors.muted}` : '',
    style.typography ? `### Типографика\n${style.typography}` : '',
    (style.layoutPatterns || []).length
      ? `### Паттерны layout\n${style.layoutPatterns.map((p) => `- ${p}`).join('\n')}`
      : '',
    (style.uiTraits || []).length
      ? `### UI-черты\n${style.uiTraits.map((t) => `- ${t}`).join('\n')}`
      : '',
    style.rationale ? `### Обоснование\n${style.rationale}` : '',
    '',
    'Собери **полное приложение** в этом стиле: все экраны визуально единообразны (одна дизайн-система). Mobbin-референс — только пропорции и паттерны, не копируй чужой бренд и тексты.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function isMobbinStyleRedesignIntent(text) {
  const t = String(text || '').trim();
  if (/^\/style\b/i.test(t)) return true;
  return /(?:в\s+каком\s+стил|предлож\w*\s+стил|выбери\s+стил|направлен\w*\s+стил|редизайн|переделай\s+прилож|оформи\s+прилож|дизайн.систем|visual\s+style|стиль\s+прилож)/i.test(t)
    || (/\b(mobbin|моббин)\b/i.test(t) && /стил|редизайн|приложен|макет/i.test(t));
}
