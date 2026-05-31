/** Inline Figma sandbox script for CDP — creation actions (mirrors figma-plugin/code.js). */

export const CREATE_ACTION_IDS = [
  'setupDesktopFrame',
  'createMobileFrame',
  'createTabletFrame',
  'createButton',
  'createCard',
  'createInput',
  'createNavbar',
  'createHeroSection',
  'createFeatureRow',
  'createMegaLandingPage',
];

export function getCreateActionEvalScript(action) {
  if (!CREATE_ACTION_IDS.includes(action)) return null;
  return `(async () => {
    if (typeof figma === 'undefined') throw new Error('Figma API недоступен');
    const action = ${JSON.stringify(action)};
    ${CREATE_HELPERS}
    await runCreateAction(action);
    return { ok: true };
  })()`;
}

const CREATE_HELPERS = String.raw`
let FONT_FAMILY = 'Roboto';
async function ensureFonts() {
  const tries = [
    ['Inter', ['Regular', 'Medium', 'Bold']],
    ['Roboto', ['Regular', 'Medium', 'Bold']],
  ];
  for (const [family, styles] of tries) {
    let ok = true;
    for (const style of styles) {
      try { await figma.loadFontAsync({ family, style }); } catch (e) { ok = false; break; }
    }
    if (ok) { FONT_FAMILY = family; return; }
  }
}
function pickFont(weight) {
  const style = weight === 'bold' ? 'Bold' : weight === 'medium' ? 'Medium' : 'Regular';
  return { family: FONT_FAMILY, style };
}
function rgb(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
function solid(r, g, b, a) {
  return [{ type: 'SOLID', color: rgb(r, g, b), opacity: a == null ? 1 : a, visible: true }];
}
function makeText(chars, size, weight, color) {
  const t = figma.createText();
  t.fontName = pickFont(weight);
  t.characters = String(chars);
  t.fontSize = size;
  t.fills = solid(color[0], color[1], color[2]);
  return t;
}
function layoutV(f, gap, pad) {
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap == null ? 16 : gap;
  const p = pad == null ? 0 : pad;
  f.paddingLeft = p; f.paddingRight = p; f.paddingTop = p; f.paddingBottom = p;
}
function layoutH(f, gap, padX, padY) {
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap == null ? 12 : gap;
  f.paddingLeft = padX == null ? 0 : padX;
  f.paddingRight = padX == null ? 0 : padX;
  f.paddingTop = padY == null ? 0 : padY;
  f.paddingBottom = padY == null ? 0 : padY;
}
function placeFrame(f, w, h) {
  const c = figma.viewport.center;
  f.resize(w, h);
  f.x = c.x - w / 2;
  f.y = c.y - h / 2;
}
function appendPage(f) {
  figma.currentPage.appendChild(f);
  return f;
}
function finish(nodes, msg) {
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  if (msg) figma.notify(msg);
}
async function createDeviceFrame(w, h, name, bg) {
  await ensureFonts();
  const f = figma.createFrame();
  f.name = name;
  f.fills = solid(bg[0], bg[1], bg[2]);
  f.clipsContent = true;
  placeFrame(f, w, h);
  appendPage(f);
  finish([f], name + ' · ' + w + '×' + h);
}
async function createButtonNode(label) {
  await ensureFonts();
  const btn = figma.createFrame();
  btn.name = 'Button / Primary';
  btn.fills = solid(28, 28, 30);
  btn.cornerRadius = 999;
  layoutH(btn, 8, 20, 12);
  btn.primaryAxisAlignItems = 'CENTER';
  btn.counterAxisAlignItems = 'CENTER';
  const t = makeText(label || 'Добавить', 14, 'medium', [250, 250, 248]);
  btn.appendChild(t);
  placeFrame(btn, Math.max(140, t.width + 40), 44);
  appendPage(btn);
  finish([btn], 'Кнопка создана');
}
async function createCardNode() {
  await ensureFonts();
  const card = figma.createFrame();
  card.name = 'Card';
  card.fills = solid(255, 255, 255);
  card.strokes = solid(28, 28, 30, 0.09);
  card.strokeWeight = 1;
  card.cornerRadius = 16;
  layoutV(card, 8, 20);
  card.appendChild(makeText('Заголовок карточки', 18, 'bold', [28, 28, 30]));
  card.appendChild(makeText('Краткое описание блока. Замените текст на свой.', 13, 'regular', [110, 110, 115]));
  card.resize(320, 160);
  placeFrame(card, 320, 160);
  appendPage(card);
  finish([card], 'Карточка создана');
}
async function createInputNode() {
  await ensureFonts();
  const wrap = figma.createFrame();
  wrap.name = 'Input / Text';
  wrap.fills = solid(255, 255, 255, 0);
  layoutV(wrap, 6, 0);
  wrap.appendChild(makeText('Email', 12, 'medium', [110, 110, 115]));
  const field = figma.createFrame();
  field.name = 'Field';
  field.fills = solid(250, 250, 248);
  field.strokes = solid(28, 28, 30, 0.12);
  field.strokeWeight = 1;
  field.cornerRadius = 10;
  layoutH(field, 0, 14, 12);
  field.appendChild(makeText('you@company.com', 14, 'regular', [142, 142, 147]));
  field.resize(280, 44);
  wrap.appendChild(field);
  wrap.resize(280, 70);
  placeFrame(wrap, 280, 70);
  appendPage(wrap);
  finish([wrap], 'Поле ввода создано');
}
async function createNavbarNode() {
  await ensureFonts();
  const nav = figma.createFrame();
  nav.name = 'Navbar';
  nav.fills = solid(255, 255, 255);
  nav.strokes = solid(28, 28, 30, 0.08);
  nav.strokeWeight = 1;
  layoutH(nav, 24, 32, 16);
  nav.primaryAxisAlignItems = 'CENTER';
  nav.counterAxisAlignItems = 'CENTER';
  nav.appendChild(makeText('SHKF', 16, 'bold', [28, 28, 30]));
  const links = figma.createFrame();
  links.name = 'Links';
  links.fills = solid(255, 255, 255, 0);
  layoutH(links, 20, 0, 0);
  ['Продукт', 'Цены', 'О нас'].forEach((l) => links.appendChild(makeText(l, 13, 'regular', [110, 110, 115])));
  nav.appendChild(links);
  const cta = figma.createFrame();
  cta.name = 'CTA';
  cta.fills = solid(249, 115, 22);
  cta.cornerRadius = 999;
  layoutH(cta, 0, 16, 8);
  cta.appendChild(makeText('Начать', 13, 'medium', [255, 255, 255]));
  nav.appendChild(cta);
  nav.resize(960, 64);
  placeFrame(nav, 960, 64);
  appendPage(nav);
  finish([nav], 'Навбар создан');
}
async function createHeroSectionNode() {
  await ensureFonts();
  const hero = figma.createFrame();
  hero.name = 'Hero Section';
  hero.fills = solid(247, 246, 242);
  hero.cornerRadius = 20;
  layoutV(hero, 16, 48);
  hero.primaryAxisAlignItems = 'CENTER';
  hero.counterAxisAlignItems = 'CENTER';
  hero.appendChild(makeText('Заголовок продукта', 40, 'bold', [28, 28, 30]));
  hero.appendChild(makeText('Подзаголовок — одно предложение о ценности.', 16, 'regular', [110, 110, 115]));
  const row = figma.createFrame();
  row.fills = solid(247, 246, 242, 0);
  layoutH(row, 12, 0, 0);
  const primary = figma.createFrame();
  primary.fills = solid(28, 28, 30);
  primary.cornerRadius = 999;
  layoutH(primary, 0, 24, 12);
  primary.appendChild(makeText('Попробовать', 14, 'medium', [250, 250, 248]));
  row.appendChild(primary);
  const ghost = figma.createFrame();
  ghost.fills = solid(255, 255, 255);
  ghost.strokes = solid(28, 28, 30, 0.12);
  ghost.strokeWeight = 1;
  ghost.cornerRadius = 999;
  layoutH(ghost, 0, 24, 12);
  ghost.appendChild(makeText('Подробнее', 14, 'medium', [28, 28, 30]));
  row.appendChild(ghost);
  hero.appendChild(row);
  hero.resize(900, 360);
  placeFrame(hero, 900, 360);
  appendPage(hero);
  finish([hero], 'Hero-секция создана');
}
async function createFeatureRowNode() {
  await ensureFonts();
  const row = figma.createFrame();
  row.name = 'Features';
  row.fills = solid(255, 255, 255, 0);
  layoutH(row, 20, 0, 0);
  function feature(title, desc) {
    const f = figma.createFrame();
    f.name = title;
    f.fills = solid(250, 250, 248);
    f.cornerRadius = 14;
    layoutV(f, 8, 20);
    f.appendChild(makeText(title, 16, 'bold', [28, 28, 30]));
    f.appendChild(makeText(desc, 12, 'regular', [110, 110, 115]));
    f.resize(240, 140);
    return f;
  }
  row.appendChild(feature('Быстро', 'Старт макета за секунды'));
  row.appendChild(feature('Адаптивно', 'Desktop, tablet и mobile'));
  row.appendChild(feature('SHKF', 'Хоткеи прямо в Figma'));
  row.resize(760, 140);
  placeFrame(row, 760, 140);
  appendPage(row);
  finish([row], 'Ряд фич создан');
}
function sectionBlock(name, w, h, bg, title, body) {
  const s = figma.createFrame();
  s.name = name;
  s.fills = solid(bg[0], bg[1], bg[2]);
  layoutV(s, 12, 24);
  s.appendChild(makeText(title, 14, 'bold', [28, 28, 30]));
  if (body) s.appendChild(makeText(body, 11, 'regular', [110, 110, 115]));
  s.resize(w, h);
  return s;
}
function buildPageColumn(width, height, label, compact) {
  const col = figma.createFrame();
  col.name = label;
  col.fills = solid(255, 255, 255);
  col.strokes = solid(28, 28, 30, 0.08);
  col.strokeWeight = 1;
  col.cornerRadius = 12;
  col.clipsContent = true;
  layoutV(col, 0, 0);
  const navH = compact ? 52 : 64;
  const heroH = compact ? 280 : 320;
  const featH = compact ? 200 : 160;
  col.appendChild(sectionBlock('Header', width, navH, [255, 255, 255], label + ' · Nav', compact ? 'Logo + menu' : 'Logo · Links · CTA'));
  col.appendChild(sectionBlock('Hero', width, heroH, [247, 246, 242], 'Hero', compact ? 'Title + CTA' : 'Заголовок · подзаголовок · кнопки'));
  col.appendChild(sectionBlock('Features', width, featH, [250, 250, 248], 'Features', compact ? '3 stacked' : '3 columns'));
  col.appendChild(sectionBlock('CTA', width, compact ? 120 : 140, [28, 28, 30], 'CTA', 'Final call to action'));
  col.appendChild(sectionBlock('Footer', width, compact ? 80 : 96, [232, 230, 225], 'Footer', '© Links'));
  col.resize(width, height);
  return col;
}
async function createMegaLandingPage() {
  await ensureFonts();
  const kit = figma.createFrame();
  kit.name = '🌐 Adaptive Landing Page';
  kit.fills = solid(232, 230, 225);
  layoutH(kit, 48, 48, 48);
  kit.primaryAxisAlignItems = 'MIN';
  kit.counterAxisAlignItems = 'MIN';
  kit.appendChild(buildPageColumn(1440, 900, 'Desktop 1440', false));
  kit.appendChild(buildPageColumn(834, 1100, 'Tablet 834', true));
  kit.appendChild(buildPageColumn(390, 844, 'Mobile 390', true));
  kit.resize(1440 + 834 + 390 + 48 * 2 + 48 * 2, 1100 + 96);
  placeFrame(kit, kit.width, kit.height);
  appendPage(kit);
  finish([kit], '🌐 Adaptive Landing: Desktop + Tablet + Mobile');
}
async function setupDesktopFrameCreate() {
  const DESKTOP_W = 1920;
  const DESKTOP_H = 1080;
  function applyDesktopFrameSetup(frame) {
    if (!frame || !('resize' in frame)) return;
    if (frame.layoutMode && frame.layoutMode !== 'NONE') frame.layoutMode = 'NONE';
    frame.resize(DESKTOP_W, DESKTOP_H);
    frame.fills = solid(255, 255, 255);
    frame.layoutGrids = [{
      pattern: 'COLUMNS', alignment: 'STRETCH', count: 12, gutterSize: 20,
      offset: 0, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 },
    }];
  }
  const nodes = figma.currentPage.selection;
  let targets = nodes.filter((n) => n.type === 'FRAME' || n.type === 'COMPONENT');
  if (targets.length === 0) {
    const frame = figma.createFrame();
    frame.name = 'Desktop 1920×1080';
    appendPage(frame);
    placeFrame(frame, DESKTOP_W, DESKTOP_H);
    applyDesktopFrameSetup(frame);
    targets = [frame];
  } else {
    for (const frame of targets) applyDesktopFrameSetup(frame);
  }
  finish(targets, 'Desktop 1920×1080 · 12 колонок');
}
async function runCreateAction(action) {
  switch (action) {
    case 'setupDesktopFrame': return setupDesktopFrameCreate();
    case 'createMobileFrame': return createDeviceFrame(390, 844, 'Mobile 390', [250, 250, 248]);
    case 'createTabletFrame': return createDeviceFrame(834, 1194, 'Tablet 834', [250, 250, 248]);
    case 'createButton': return createButtonNode('Добавить');
    case 'createCard': return createCardNode();
    case 'createInput': return createInputNode();
    case 'createNavbar': return createNavbarNode();
    case 'createHeroSection': return createHeroSectionNode();
    case 'createFeatureRow': return createFeatureRowNode();
    case 'createMegaLandingPage': return createMegaLandingPage();
    default: throw new Error('Unknown create action: ' + action);
  }
}
`;
