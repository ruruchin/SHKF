/**
 * use_figma script — Soft consumer iOS app (приложения), 4 screens.
 * Palette: bg #FFF7ED, surface #FFFFFF, accent #F97316, text #292524, muted #78716C
 */
export const SOFT_CONSUMER_FIGMA_USE_SCRIPT = `
const FRAME_W = 390;
const FRAME_H = 844;
const GAP_X = 48;
const ORIGIN_X = 2800;
const ORIGIN_Y = 120;
const PAD = 20;
const createdNodeIds = [];

const C = {
  bg: { r: 255/255, g: 247/255, b: 237/255 },
  surface: { r: 1, g: 1, b: 1 },
  accent: { r: 249/255, g: 115/255, b: 22/255 },
  accentSoft: { r: 255/255, g: 237/255, b: 213/255 },
  text: { r: 41/255, g: 37/255, b: 36/255 },
  muted: { r: 120/255, g: 113/255, b: 108/255 },
  border: { r: 231/255, g: 229/255, b: 228/255 },
  white: { r: 1, g: 1, b: 1 },
  pastelPink: { r: 252/255, g: 231/255, b: 243/255 },
  pastelPurple: { r: 237/255, g: 233/255, b: 254/255 },
  pastelGreen: { r: 220/255, g: 252/255, b: 231/255 },
  pastelBlue: { r: 219/255, g: 234/255, b: 254/255 },
  pastelYellow: { r: 254/255, g: 249/255, b: 195/255 },
};

await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

function solid(fill, opacity = 1) {
  return [{ type: 'SOLID', color: fill, opacity, visible: true }];
}

function softShadow(node) {
  node.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 41/255, g: 37/255, b: 36/255, a: 0.08 },
    offset: { x: 0, y: 8 },
    radius: 24,
    spread: -4,
    visible: true,
    blendMode: 'NORMAL',
  }];
}

function addText(parent, chars, size, weight, color, opts = {}) {
  const style = weight >= 700 ? 'Bold' : weight >= 600 ? 'Semi Bold' : weight >= 500 ? 'Medium' : 'Regular';
  const t = figma.createText();
  t.fontName = { family: 'Inter', style };
  t.characters = chars;
  t.fontSize = size;
  t.fills = solid(color);
  if (opts.name) t.name = opts.name;
  if (opts.width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(opts.width, t.height);
  }
  if (opts.lineHeight) t.lineHeight = { unit: 'PIXELS', value: opts.lineHeight };
  parent.appendChild(t);
  if (parent.layoutMode !== 'NONE') t.layoutSizingHorizontal = opts.fill === false ? 'HUG' : 'FILL';
  createdNodeIds.push(t.id);
  return t;
}

function pillBtn(parent, label, fill, textColor, fixed = false, radius = 24) {
  const btn = figma.createAutoLayout('HORIZONTAL', {
    name: label,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 14,
    paddingBottom: 14,
    cornerRadius: radius,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  btn.fills = solid(fill);
  parent.appendChild(btn);
  if (fixed) {
    btn.layoutSizingHorizontal = 'FILL';
    btn.resize(FRAME_W - PAD * 2, 52);
  }
  addText(btn, label, 16, 600, textColor, { fill: false });
  createdNodeIds.push(btn.id);
  return btn;
}

function statusBar(parent) {
  const bar = figma.createAutoLayout('HORIZONTAL', {
    name: 'Status bar',
    paddingLeft: PAD,
    paddingRight: PAD,
    paddingTop: 14,
    paddingBottom: 8,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  bar.resize(FRAME_W, 54);
  bar.fills = solid(C.bg);
  parent.appendChild(bar);
  bar.layoutSizingHorizontal = 'FILL';
  addText(bar, '9:41', 15, 600, C.text, { fill: false });
  const spacer = figma.createFrame();
  spacer.fills = [];
  bar.appendChild(spacer);
  spacer.layoutSizingHorizontal = 'FILL';
  spacer.resize(1, 1);
  addText(bar, '●●● ▮▮▮ ▮', 12, 400, C.text, { fill: false });
  createdNodeIds.push(bar.id);
}

function homeIndicator(parent) {
  const ind = figma.createFrame();
  ind.name = 'Home indicator';
  ind.resize(134, 5);
  ind.cornerRadius = 3;
  ind.fills = solid(C.text);
  parent.appendChild(ind);
  ind.layoutSizingHorizontal = 'CENTER';
  createdNodeIds.push(ind.id);
}

function screenFrame(name, index) {
  const x = ORIGIN_X + index * (FRAME_W + GAP_X);
  const frame = figma.createAutoLayout('VERTICAL', {
    name,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 16,
    itemSpacing: 0,
    primaryAxisAlignItems: 'MIN',
  });
  frame.resize(FRAME_W, FRAME_H);
  frame.fills = solid(C.bg);
  frame.clipsContent = true;
  frame.x = x;
  frame.y = ORIGIN_Y;
  figma.currentPage.appendChild(frame);
  createdNodeIds.push(frame.id);
  return frame;
}

function inputField(parent, label, placeholder) {
  const wrap = figma.createAutoLayout('VERTICAL', { name: label, itemSpacing: 8 });
  parent.appendChild(wrap);
  wrap.layoutSizingHorizontal = 'FILL';
  addText(wrap, label, 14, 500, C.muted);
  const field = figma.createAutoLayout('VERTICAL', {
    name: label + ' field',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
    cornerRadius: 20,
  });
  field.fills = solid(C.surface);
  field.strokes = solid(C.border);
  field.strokeWeight = 1;
  wrap.appendChild(field);
  field.layoutSizingHorizontal = 'FILL';
  softShadow(field);
  addText(field, placeholder, 15, 400, C.muted);
  createdNodeIds.push(wrap.id);
  return wrap;
}

function chipRow(parent, labels, active = 0) {
  const row = figma.createAutoLayout('HORIZONTAL', {
    name: 'Chip filters',
    itemSpacing: 8,
    paddingLeft: PAD,
    paddingRight: PAD,
    paddingTop: 4,
    paddingBottom: 4,
  });
  parent.appendChild(row);
  row.layoutSizingHorizontal = 'FILL';
  labels.forEach((label, i) => {
    const chip = figma.createAutoLayout('HORIZONTAL', {
      name: 'Chip / ' + label,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      cornerRadius: 20,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    const on = i === active;
    chip.fills = solid(on ? C.accent : C.surface);
    if (!on) { chip.strokes = solid(C.border); chip.strokeWeight = 1; }
    row.appendChild(chip);
    addText(chip, label, 14, on ? 600 : 400, on ? C.white : C.muted, { fill: false });
    createdNodeIds.push(chip.id);
  });
  createdNodeIds.push(row.id);
  return row;
}

function tabBar(parent, active = 0) {
  const bar = figma.createAutoLayout('HORIZONTAL', {
    name: 'Tab bar',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 24,
    itemSpacing: 0,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  bar.fills = solid(C.surface);
  bar.strokes = solid(C.border);
  bar.strokeWeight = 1;
  bar.cornerRadius = 28;
  bar.resize(FRAME_W - PAD * 2, 64);
  parent.appendChild(bar);
  bar.layoutSizingHorizontal = 'FILL';
  const labels = ['Главная', 'Подборка', 'Избранное', 'Профиль'];
  labels.forEach((label, i) => {
    const tab = figma.createAutoLayout('VERTICAL', {
      name: label,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 6,
      paddingBottom: 6,
      cornerRadius: 20,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    if (i === active) tab.fills = solid(C.accentSoft);
    bar.appendChild(tab);
    addText(tab, label, 11, i === active ? 600 : 400, i === active ? C.accent : C.muted, { fill: false });
    createdNodeIds.push(tab.id);
  });
  createdNodeIds.push(bar.id);
}

// —— 1. Онбординг ——
const onboarding = screenFrame('приложения · Онбординг', 0);
statusBar(onboarding);

const onbBody = figma.createAutoLayout('VERTICAL', {
  name: 'Content',
  itemSpacing: 20,
  paddingLeft: PAD,
  paddingRight: PAD,
  paddingTop: 16,
  paddingBottom: 24,
});
onboarding.appendChild(onbBody);
onbBody.layoutSizingHorizontal = 'FILL';

const heroIll = figma.createAutoLayout('VERTICAL', {
  name: 'Hero Illustration | imagePrompt: soft pastel mobile onboarding friendly rounded shapes warm orange peach minimal',
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 20,
  paddingBottom: 20,
  cornerRadius: 24,
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
});
heroIll.resize(FRAME_W - PAD * 2, 240);
heroIll.fills = solid(C.accentSoft);
onbBody.appendChild(heroIll);
heroIll.layoutSizingHorizontal = 'FILL';
const heroBlock = figma.createFrame();
heroBlock.name = 'Illustration block';
heroBlock.resize(200, 160);
heroBlock.cornerRadius = 20;
heroBlock.fills = solid(C.pastelYellow);
heroIll.appendChild(heroBlock);
createdNodeIds.push(heroIll.id, heroBlock.id);

addText(onbBody, 'Добро пожаловать в приложения', 24, 600, C.text, { width: FRAME_W - PAD * 2, lineHeight: 30 });
addText(onbBody, 'Лёгкий способ находить идеи, сохранять подборки и возвращаться к важному без лишнего шума.', 15, 400, C.muted, { width: FRAME_W - PAD * 2, lineHeight: 22 });
pillBtn(onbBody, 'Начать', C.accent, C.white, true);
const secBtn = figma.createAutoLayout('HORIZONTAL', {
  name: 'Secondary CTA',
  paddingTop: 14,
  paddingBottom: 14,
  cornerRadius: 24,
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
});
secBtn.fills = solid(C.surface);
secBtn.strokes = solid(C.accent);
secBtn.strokeWeight = 1;
onbBody.appendChild(secBtn);
secBtn.layoutSizingHorizontal = 'FILL';
addText(secBtn, 'Уже есть аккаунт', 15, 600, C.accent, { fill: false });
createdNodeIds.push(secBtn.id, onbBody.id);
homeIndicator(onboarding);

// —— 2. Вход ——
const login = screenFrame('приложения · Вход', 1);
statusBar(login);
const loginBody = figma.createAutoLayout('VERTICAL', {
  name: 'Content',
  itemSpacing: 18,
  paddingLeft: PAD,
  paddingRight: PAD,
  paddingTop: 20,
  paddingBottom: 24,
});
login.appendChild(loginBody);
loginBody.layoutSizingHorizontal = 'FILL';

const loginHeader = figma.createAutoLayout('HORIZONTAL', {
  name: 'Header',
  itemSpacing: 12,
  counterAxisAlignItems: 'CENTER',
});
loginBody.appendChild(loginHeader);
loginHeader.layoutSizingHorizontal = 'FILL';
addText(loginHeader, '←', 22, 400, C.text, { fill: false });
const mark = figma.createFrame();
mark.resize(36, 36);
mark.cornerRadius = 12;
mark.fills = solid(C.accentSoft);
loginHeader.appendChild(mark);
addText(mark, 'А', 16, 700, C.accent, { fill: false });
addText(loginHeader, 'приложения', 16, 600, C.text, { fill: false });
createdNodeIds.push(loginHeader.id, mark.id);

addText(loginBody, 'Вход', 24, 600, C.text);
addText(loginBody, 'Введите данные, чтобы продолжить', 15, 400, C.muted);
inputField(loginBody, 'Электронная почта', 'name@example.com');
inputField(loginBody, 'Пароль', '••••••••');
addText(loginBody, 'Забыли пароль?', 14, 500, C.accent);
pillBtn(loginBody, 'Войти', C.accent, C.white, true);
addText(loginBody, 'Нет аккаунта? Создать', 14, 400, C.muted, { width: FRAME_W - PAD * 2 });
createdNodeIds.push(loginBody.id);
homeIndicator(login);

// —— 3. Главная ——
const home = screenFrame('приложения · Главная', 2);
statusBar(home);
const homeBody = figma.createAutoLayout('VERTICAL', {
  name: 'Content',
  itemSpacing: 16,
  paddingLeft: PAD,
  paddingRight: PAD,
  paddingTop: 12,
  paddingBottom: 8,
});
home.appendChild(homeBody);
homeBody.layoutSizingHorizontal = 'FILL';

const homeHeader = figma.createAutoLayout('HORIZONTAL', {
  name: 'Header',
  counterAxisAlignItems: 'CENTER',
  primaryAxisAlignItems: 'SPACE_BETWEEN',
});
homeBody.appendChild(homeHeader);
homeHeader.layoutSizingHorizontal = 'FILL';
const greetCol = figma.createAutoLayout('VERTICAL', { name: 'Greeting', itemSpacing: 4 });
homeHeader.appendChild(greetCol);
addText(greetCol, 'Привет!', 14, 400, C.muted);
addText(greetCol, 'Ваша лента', 24, 600, C.text);
const avatar = figma.createFrame();
avatar.resize(44, 44);
avatar.cornerRadius = 22;
avatar.fills = solid(C.accentSoft);
homeHeader.appendChild(avatar);
addText(avatar, 'АК', 14, 600, C.accent, { fill: false });
createdNodeIds.push(homeHeader.id, greetCol.id, avatar.id);

const heroCard = figma.createAutoLayout('HORIZONTAL', {
  name: 'Hero card',
  itemSpacing: 16,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 16,
  paddingBottom: 16,
  cornerRadius: 24,
  counterAxisAlignItems: 'CENTER',
});
heroCard.fills = solid(C.surface);
heroCard.strokes = solid(C.border);
heroCard.strokeWeight = 1;
softShadow(heroCard);
homeBody.appendChild(heroCard);
heroCard.layoutSizingHorizontal = 'FILL';
const heroThumb = figma.createFrame();
heroThumb.name = 'Hero thumb | imagePrompt: soft pastel abstract sun clouds warm friendly illustration';
heroThumb.resize(88, 88);
heroThumb.cornerRadius = 20;
heroThumb.fills = solid(C.pastelYellow);
heroCard.appendChild(heroThumb);
const heroText = figma.createAutoLayout('VERTICAL', { name: 'Hero text', itemSpacing: 8 });
heroCard.appendChild(heroText);
heroText.layoutSizingHorizontal = 'FILL';
addText(heroText, 'Соберите свой день', 18, 600, C.text, { lineHeight: 24 });
addText(heroText, 'Подборки, заметки и напоминания в одном месте', 14, 400, C.muted, { lineHeight: 20 });
pillBtn(heroText, 'Открыть', C.accent, C.white, false, 20);
createdNodeIds.push(heroCard.id, heroThumb.id, heroText.id);

chipRow(homeBody, ['Все', 'Новое', 'Избранное', 'Идеи'], 0);
addText(homeBody, 'Рекомендации', 18, 600, C.text);

const feed = figma.createAutoLayout('VERTICAL', { name: 'Feed', itemSpacing: 12 });
homeBody.appendChild(feed);
feed.layoutSizingHorizontal = 'FILL';
[
  { title: 'Утренняя подборка', sub: '5 идей на сегодня', fill: C.pastelPink },
  { title: 'Спокойные цвета', sub: 'Пастель и мягкие формы', fill: C.pastelPurple },
  { title: 'Новые карточки', sub: 'Обновлено 2 часа назад', fill: C.pastelGreen },
].forEach((item, i) => {
  const card = figma.createAutoLayout('HORIZONTAL', {
    name: 'Card ' + (i + 1),
    itemSpacing: 12,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    cornerRadius: 20,
    counterAxisAlignItems: 'CENTER',
  });
  card.fills = solid(C.surface);
  card.strokes = solid(C.border);
  card.strokeWeight = 1;
  softShadow(card);
  feed.appendChild(card);
  card.layoutSizingHorizontal = 'FILL';
  const thumb = figma.createFrame();
  thumb.name = 'Thumb | imagePrompt: soft pastel card thumbnail abstract minimal';
  thumb.resize(64, 64);
  thumb.cornerRadius = 16;
  thumb.fills = solid(item.fill);
  card.appendChild(thumb);
  const col = figma.createAutoLayout('VERTICAL', { name: 'Text', itemSpacing: 4 });
  card.appendChild(col);
  col.layoutSizingHorizontal = 'FILL';
  addText(col, item.title, 15, 600, C.text);
  addText(col, item.sub, 14, 400, C.muted);
  createdNodeIds.push(card.id, thumb.id, col.id);
});
createdNodeIds.push(feed.id, homeBody.id);
tabBar(home, 0);
homeIndicator(home);

// —— 4. Подборка (inner) ——
const feedScreen = screenFrame('приложения · Подборка', 3);
statusBar(feedScreen);
const feedBody = figma.createAutoLayout('VERTICAL', {
  name: 'Content',
  itemSpacing: 16,
  paddingLeft: PAD,
  paddingRight: PAD,
  paddingTop: 12,
  paddingBottom: 8,
});
feedScreen.appendChild(feedBody);
feedBody.layoutSizingHorizontal = 'FILL';

const feedHeader = figma.createAutoLayout('HORIZONTAL', {
  name: 'Header',
  counterAxisAlignItems: 'CENTER',
  primaryAxisAlignItems: 'SPACE_BETWEEN',
});
feedBody.appendChild(feedHeader);
feedHeader.layoutSizingHorizontal = 'FILL';
const backTitle = figma.createAutoLayout('HORIZONTAL', { name: 'Back+Title', itemSpacing: 8, counterAxisAlignItems: 'CENTER' });
feedHeader.appendChild(backTitle);
addText(backTitle, '←', 22, 400, C.text, { fill: false });
addText(backTitle, 'Выбор стиля', 24, 600, C.text, { fill: false });
const doneBtn = figma.createAutoLayout('HORIZONTAL', {
  name: 'Done',
  paddingLeft: 14,
  paddingRight: 14,
  paddingTop: 10,
  paddingBottom: 10,
  cornerRadius: 22,
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
});
doneBtn.fills = solid(C.accent);
feedHeader.appendChild(doneBtn);
addText(doneBtn, '✓', 18, 600, C.white, { fill: false });
createdNodeIds.push(feedHeader.id, backTitle.id, doneBtn.id);

const preview = figma.createAutoLayout('VERTICAL', {
  name: 'Preview | imagePrompt: soft consumer app style preview friendly rounded illustration warm orange pastel',
  paddingTop: 24,
  paddingBottom: 24,
  cornerRadius: 24,
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
});
preview.resize(FRAME_W - PAD * 2, 200);
preview.fills = solid(C.surface);
preview.strokes = solid(C.border);
preview.strokeWeight = 1;
softShadow(preview);
feedBody.appendChild(preview);
preview.layoutSizingHorizontal = 'FILL';
const previewInner = figma.createFrame();
previewInner.resize(120, 120);
previewInner.cornerRadius = 24;
previewInner.fills = solid(C.pastelYellow);
preview.appendChild(previewInner);
createdNodeIds.push(preview.id, previewInner.id);

chipRow(feedBody, ['Цвета', 'Иконки', 'Фото'], 0);

const grid = figma.createAutoLayout('HORIZONTAL', {
  name: 'Style grid row 1',
  itemSpacing: 12,
  layoutWrap: 'WRAP',
});
feedBody.appendChild(grid);
grid.layoutSizingHorizontal = 'FILL';
[
  { label: 'Пастель', fill: C.pastelPink, active: true },
  { label: 'Тёплый', fill: C.pastelYellow, active: false },
  { label: 'Свежий', fill: C.pastelGreen, active: false },
  { label: 'Спокойный', fill: C.pastelBlue, active: false },
  { label: 'Мягкий', fill: C.pastelPurple, active: false },
  { label: 'Светлый', fill: C.accentSoft, active: false },
].forEach((tile) => {
  const cell = figma.createAutoLayout('VERTICAL', {
    name: 'Tile / ' + tile.label,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 8,
    paddingRight: 8,
    cornerRadius: 20,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  cell.resize(104, 104);
  cell.fills = solid(tile.fill);
  if (tile.active) { cell.strokes = solid(C.accent); cell.strokeWeight = 2; }
  else { cell.strokes = solid(C.border); cell.strokeWeight = 1; }
  grid.appendChild(cell);
  addText(cell, tile.label, 12, 600, C.text, { fill: false });
  createdNodeIds.push(cell.id);
});
createdNodeIds.push(grid.id, feedBody.id);
tabBar(feedScreen, 1);
homeIndicator(feedScreen);

const topFrames = createdNodeIds
  .map((id) => figma.getNodeById(id))
  .filter((n) => n && n.parent === figma.currentPage);
figma.viewport.scrollAndZoomIntoView(topFrames);

return {
  page: figma.currentPage.name,
  createdNodeIds,
  frames: [
    { name: 'приложения · Онбординг', x: ORIGIN_X, y: ORIGIN_Y },
    { name: 'приложения · Вход', x: ORIGIN_X + FRAME_W + GAP_X, y: ORIGIN_Y },
    { name: 'приложения · Главная', x: ORIGIN_X + 2 * (FRAME_W + GAP_X), y: ORIGIN_Y },
    { name: 'приложения · Подборка', x: ORIGIN_X + 3 * (FRAME_W + GAP_X), y: ORIGIN_Y },
  ],
  gap: GAP_X,
};
`;
