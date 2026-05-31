export const ACTION_META = {
  centerInFrame: {
    description: 'Мгновенно перемещает выделенный объект в геометрический центр родительского фрейма — по обеим осям одновременно.',
    whyUseful: 'В Figma нет такого шортката из коробки. Экономит 5–10 секунд на каждом выравнивании — особенно при вёрстке карточек, модалок и UI-китов.',
    demo: 'center-both',
  },
  centerInFrameX: {
    description: 'Центрирует объект только по горизонтали внутри родительского фрейма, не трогая вертикальную позицию.',
    whyUseful: 'Идеально для выравнивания кнопок, текста и иконок по центру строки, когда высота уже зафиксирована.',
    demo: 'center-x',
  },
  centerInFrameY: {
    description: 'Центрирует объект только по вертикали внутри родительского фрейма.',
    whyUseful: 'Полезно для боковых панелей, сайдбаров и элементов с фиксированной шириной.',
    demo: 'center-y',
  },
  centerInViewport: {
    description: 'Перемещает объект к центру текущего viewport — туда, куда вы смотрите на canvas.',
    whyUseful: 'Быстро «найти» объект на экране или подготовить его к презентации/скриншоту.',
    demo: 'center-viewport',
  },
  fillParentFrame: {
    description: 'Растягивает объект на весь родительский фрейм: позиция 0,0 и размер как у родителя.',
    whyUseful: 'Создание фоновых слоёв, overlay, fill-изображений — одно нажатие вместо ручного drag.',
    demo: 'fill',
  },
  matchParentSize: {
    description: 'Подгоняет ширину и высоту объекта под размер родительского фрейма, не меняя позицию.',
    whyUseful: 'Когда нужно совпасть по размеру, но оставить текущие координаты — например, для placeholder-блоков.',
    demo: 'match-size',
  },
  distributeHorizontal: {
    description: 'Равномерно распределяет 2+ выделенных объекта между крайним левым и правым.',
    whyUseful: 'Figma умеет distribute только между выделенными — этот хоткей делает то же, но одной привычной клавишей.',
    demo: 'distribute-h',
  },
  distributeVertical: {
    description: 'Равномерно распределяет объекты по вертикали между верхним и нижним.',
    whyUseful: 'Списки, меню, стеки элементов — ровные отступы без ручного подбора.',
    demo: 'distribute-v',
  },
  swapFillStroke: {
    description: 'Меняет местами заливку (fill) и обводку (stroke) выделенного объекта.',
    whyUseful: 'Быстрый эксперимент с контрастом и стилем — быстрее, чем Shift+X в некоторых сценариях.',
    demo: 'swap',
  },
  toggleAutoLayout: {
    description: 'Включает Auto Layout на фрейме (вертикальный, с отступами) или выключает его.',
    whyUseful: 'Мгновенное превращение группы в адаптивный контейнер — без поиска Shift+A.',
    demo: 'auto-layout',
  },
  setupDesktopFrame: {
    description: 'Создаёт или настраивает фрейм под десктоп: 1920×1080, layout grid на 12 колонок (gutter 20px) и белая заливка.',
    whyUseful: 'Старт макета за одно нажатие — не нужно вручную выставлять размер, фон и column grid.',
    demo: 'desktop-frame',
  },
  createMobileFrame: {
    description: 'Создаёт фрейм смартфона 390×844 с фоном Studio — готовая точка для mobile-макета.',
    whyUseful: 'Не нужно искать пресет iPhone в меню Figma — фрейм появляется в центре viewport.',
    demo: 'mobile-frame',
  },
  createTabletFrame: {
    description: 'Создаёт tablet-фрейм 834×1194 для iPad-подобных макетов.',
    whyUseful: 'Быстрый старт среднего breakpoint без ручной настройки размеров.',
    demo: 'tablet-frame',
  },
  createButton: {
    description: 'Создаёт primary-кнопку с pill-скруглением и текстом «Добавить» в стиле FIRURU Studio.',
    whyUseful: 'Готовый UI-элемент для форм и CTA — сразу в auto layout.',
    demo: 'create-button',
  },
  createCard: {
    description: 'Создаёт карточку с заголовком, описанием, белым фоном и скруглением 16px.',
    whyUseful: 'Базовый блок для списков, pricing и feature-секций.',
    demo: 'create-card',
  },
  createInput: {
    description: 'Создаёт поле ввода с лейблом Email и placeholder.',
    whyUseful: 'Формы и onboarding — не собирать label + field вручную.',
    demo: 'create-input',
  },
  createNavbar: {
    description: 'Создаёт навигационную панель: логотип, ссылки и оранжевая CTA-кнопка.',
    whyUseful: 'Header сайта или приложения за одно нажатие.',
    demo: 'create-navbar',
  },
  createHeroSection: {
    description: 'Создаёт hero-блок: крупный заголовок, подзаголовок и две кнопки (primary + ghost).',
    whyUseful: 'Первый экран лендинга без копирования из другого файла.',
    demo: 'create-hero',
  },
  createFeatureRow: {
    description: 'Создаёт ряд из трёх feature-карточек в горизонтальном auto layout.',
    whyUseful: 'Секция «Почему мы» или benefits — типовой паттерн лендинга.',
    demo: 'create-features',
  },
  createMegaLandingPage: {
    description: 'Мега-действие: создаёт набор Desktop 1440 + Tablet 834 + Mobile 390 с секциями Nav, Hero, Features, CTA и Footer на каждом breakpoint.',
    whyUseful: 'Целая адаптивная структура сайта за одно нажатие — основа для быстрого прототипа.',
    demo: 'create-mega',
  },
};

export const ACTIONS = [
  { id: 'centerInFrame', name: 'Центр в родительском фрейме', category: 'Выравнивание' },
  { id: 'centerInFrameX', name: 'Центр по X в родителе', category: 'Выравнивание' },
  { id: 'centerInFrameY', name: 'Центр по Y в родителе', category: 'Выравнивание' },
  { id: 'centerInViewport', name: 'Центр на экране (viewport)', category: 'Выравнивание' },
  { id: 'fillParentFrame', name: 'Заполнить родительский фрейм', category: 'Размер' },
  { id: 'matchParentSize', name: 'Размер как у родителя', category: 'Размер' },
  { id: 'distributeHorizontal', name: 'Распределить по горизонтали', category: 'Распределение' },
  { id: 'distributeVertical', name: 'Распределить по вертикали', category: 'Распределение' },
  { id: 'swapFillStroke', name: 'Поменять заливку и обводку', category: 'Стиль' },
  { id: 'toggleAutoLayout', name: 'Вкл / выкл Auto Layout', category: 'Layout' },
  { id: 'setupDesktopFrame', name: 'Desktop 1920×1080 + сетка', category: 'Создание' },
  { id: 'createMobileFrame', name: 'Mobile фрейм 390×844', category: 'Создание' },
  { id: 'createTabletFrame', name: 'Tablet фрейм 834×1194', category: 'Создание' },
  { id: 'createButton', name: 'Создать кнопку', category: 'Создание' },
  { id: 'createCard', name: 'Создать карточку', category: 'Создание' },
  { id: 'createInput', name: 'Создать поле ввода', category: 'Создание' },
  { id: 'createNavbar', name: 'Создать навбар', category: 'Создание' },
  { id: 'createHeroSection', name: 'Создать Hero-секцию', category: 'Создание' },
  { id: 'createFeatureRow', name: 'Создать ряд фич', category: 'Создание' },
  { id: 'createMegaLandingPage', name: '🌐 Mega: адаптивный лендинг', category: 'Создание' },
];

export const FIGMA_CONFLICTS = [
  { keys: ['LEFT ALT', 'A'], reason: 'Figma: выравнивание влево' },
  { keys: ['LEFT ALT', 'D'], reason: 'Figma: выравнивание вправо' },
  { keys: ['LEFT ALT', 'W'], reason: 'Figma: выравнивание вверх' },
  { keys: ['LEFT ALT', 'S'], reason: 'Figma: выравнивание вниз' },
  { keys: ['LEFT ALT', 'H'], reason: 'Figma: выравнивание по центру (H)' },
  { keys: ['LEFT ALT', 'V'], reason: 'Figma: выравнивание по центру (V)' },
  { keys: ['LEFT ALT', '1'], reason: 'Figma: панель Layers' },
  { keys: ['LEFT ALT', '2'], reason: 'Figma: панель Assets' },
  { keys: ['LEFT ALT', '8'], reason: 'Figma: Design panel' },
  { keys: ['LEFT ALT', '9'], reason: 'Figma: Prototype panel' },
  { keys: ['LEFT ALT', 'I'], reason: 'Figma: Components menu' },
  { keys: ['LEFT ALT', '/'], reason: 'Figma: убрать заливку' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'C'], reason: 'Figma: копировать свойства' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'V'], reason: 'Figma: вставить свойства' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'G'], reason: 'Figma: Frame selection' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'K'], reason: 'Figma: создать компонент' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'B'], reason: 'Figma: Detach instance' },
  { keys: ['LEFT CTRL', 'LEFT ALT', 'S'], reason: 'Figma: сохранить в историю' },
  { keys: ['LEFT SHIFT', 'A'], reason: 'Figma: Auto Layout' },
  { keys: ['LEFT SHIFT', 'X'], reason: 'Figma: swap fill/stroke' },
  { keys: ['LEFT ALT', 'LEFT SHIFT', 'H'], reason: 'Figma: distribute horizontal' },
  { keys: ['LEFT ALT', 'LEFT SHIFT', 'V'], reason: 'Figma: distribute vertical' },
];

const MODIFIERS = new Set([
  'LEFT CTRL', 'RIGHT CTRL', 'LEFT ALT', 'RIGHT ALT', 'LEFT SHIFT', 'RIGHT SHIFT',
  'LEFT META', 'RIGHT META', 'LEFT WIN', 'RIGHT WIN',
]);

export function formatKeys(keys) {
  return keys
    .map((k) => {
      const map = {
        'LEFT CTRL': 'Ctrl', 'RIGHT CTRL': 'Ctrl',
        'LEFT ALT': 'Alt', 'RIGHT ALT': 'Alt',
        'LEFT SHIFT': 'Shift', 'RIGHT SHIFT': 'Shift',
        'LEFT META': 'Win', 'RIGHT META': 'Win',
        'SPACE': 'Space', 'LEFT': '←', 'RIGHT': '→', 'UP': '↑', 'DOWN': '↓',
      };
      return map[k] || k;
    })
    .join(' + ');
}

export function normalizeCombo(keys) {
  const order = ['LEFT CTRL', 'RIGHT CTRL', 'LEFT ALT', 'RIGHT ALT', 'LEFT SHIFT', 'RIGHT SHIFT'];
  const mods = keys.filter((k) => MODIFIERS.has(k));
  const main = keys.filter((k) => !MODIFIERS.has(k));
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...mods, ...main];
}

export function combosEqual(a, b) {
  const na = normalizeCombo(a).join('|');
  const nb = normalizeCombo(b).join('|');
  const alias = (k) => k.replace('LEFT ', '').replace('RIGHT ', '');
  const na2 = normalizeCombo(a).map(alias).join('|');
  const nb2 = normalizeCombo(b).map(alias).join('|');
  return na === nb || na2 === nb2;
}

export function checkConflict(keys, hotkeys, excludeId) {
  for (const hk of hotkeys) {
    if (excludeId && hk.id === excludeId) continue;
    if (combosEqual(keys, hk.keys)) {
      return { type: 'internal', message: `Уже назначено: «${hk.name}»` };
    }
  }
  for (const c of FIGMA_CONFLICTS) {
    if (combosEqual(keys, c.keys)) {
      return { type: 'figma', message: c.reason };
    }
  }
  return null;
}

export function keysFromEvent(down, triggerKey) {
  const result = [];
  for (const [key, pressed] of Object.entries(down)) {
    if (pressed && MODIFIERS.has(key)) result.push(key);
  }
  if (triggerKey && !MODIFIERS.has(triggerKey)) {
    result.push(triggerKey);
  }
  return normalizeCombo(result);
}

export function generateId() {
  return 'hk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

