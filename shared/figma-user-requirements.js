/**
 * Требования пользователя из текста запроса — для Vision и доп. экранов.
 */

export function extractUserRequirements(message) {
  const text = String(message || '').trim();
  const lines = [];
  if (!text) return lines;

  if (/onboarding|онбординг/i.test(text)) {
    lines.push('Онбординг: три отдельных экрана (шаг 1/3, 2/3, 3/3) с прогрессом, заголовком, иллюстрацией и CTA «Далее» / «Готово».');
  }
  if (/3\s*шаг|тр[её]х\s*шаг|three\s*step/i.test(text)) {
    lines.push('Обязательно 3 шага онбординга — три фрейма, не один экран с тремя точками.');
  }
  if (/login|вход/i.test(text)) lines.push('Экран входа: форма email + пароль, кнопка входа.');
  if (/register|регистрац/i.test(text)) lines.push('Экран регистрации: поля и CTA создания аккаунта.');
  if (/инвест|fintech|портфел/i.test(text)) {
    lines.push('Стиль fintech: чистый UI, карточки, цифры, графики; палитра как на референсе Mobbin.');
  }
  if (/многостранич|несколько\s*экран|экранов/i.test(text)) {
    lines.push('Несколько экранов приложения в ряд, каждый 390×844.');
  }
  lines.push('Текст не обрезать: width ~342px, перенос строк (textAutoResize HEIGHT). Поля ввода — create_input, не линии.');
  lines.push('Сетка: layoutGrids только COLUMNS (4 col, offset 16, gutter 12).');
  lines.push('Каждый UI-блок — отдельная карточка create_frame (radius 12–20, padding), внутри content; assumptions: block:имя — описание.');
  lines.push('Цвета и отступы как на референсе Mobbin, не generic шаблон.');
  lines.push('Не копируй бренд/английский копирайт с Mobbin (Revolut и т.д.) — язык и продукт из запроса пользователя.');
  lines.push('Новые фреймы — в колонке справа (x≈2800), не поверх существующих макетов на странице.');
  lines.push('Блоки с фото/превью: вложенный frame с imagePrompt по смыслу скрина.');

  return lines;
}

export function shouldExpandAppScreens(message) {
  const text = String(message || '').toLowerCase();
  return /многостранич|несколько\s*экран|onboarding|онбординг|login.*register|вход.*регистрац|3\s*шаг|тр[её]х\s*шаг/i.test(text);
}
