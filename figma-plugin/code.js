// SHKF Bridge — main thread (Figma plugin sandbox)
figma.showUI(__html__, { width: 480, height: 780, themeColors: false });

figma.ui.onmessage = function (msg) {
  if (msg.type === 'run-action') {
    runAction(msg.action).catch(function (err) {
      figma.notify('Ошибка: ' + err.message, { error: true });
    });
  }
  if (msg.type === 'export-to-library') {
    exportSelectionToLibrary().catch(function (err) {
      figma.notify('Ошибка: ' + err.message, { error: true });
    });
  }
  if (msg.type === 'insert-user-template') {
    insertUserTemplate(msg.template, msg.requestId).catch(function (err) {
      sendTemplateResult(msg.requestId, false, err.message);
    });
  }
  if (msg.type === 'apply-banner-mockup') {
    applyBannerMockup(msg.payload, msg.requestId).catch(function (err) {
      sendTemplateResult(msg.requestId, false, err.message);
    });
  }
  if (msg.type === 'read-banner-texts') {
    readBannerTexts(msg.payload, msg.requestId).catch(function (err) {
      sendTemplateResult(msg.requestId, false, err.message);
    });
  }
  if (msg.type === 'read-selection-brief') {
    readSelectionBrief(msg.payload, msg.requestId).catch(function (err) {
      sendTemplateResult(msg.requestId, false, err.message);
    });
  }
  if (msg.type === 'apply-design-ops') {
    applyDesignOps(msg.payload, msg.requestId).catch(function (err) {
      sendTemplateResult(msg.requestId, false, err.message);
    });
  }
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }
};

function runAction(action) {
  if (CREATE_ACTIONS[action]) {
    return runCreateAction(action).catch(function (err) {
      figma.notify('Ошибка: ' + err.message, { error: true });
    });
  }

  var selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Выберите объект(ы)', { error: true });
    return Promise.resolve();
  }

  switch (action) {
    case 'centerInFrame':
      centerInParent(selection, 'both');
      figma.notify('Alt+B · Центр в родительском фрейме');
      break;
    case 'centerInFrameX':
      centerInParent(selection, 'x');
      figma.notify('Alt+X · Центр по X в родителе');
      break;
    case 'centerInFrameY':
      centerInParent(selection, 'y');
      figma.notify('Alt+Y · Центр по Y в родителе');
      break;
    case 'fillParentFrame':
      fillParentFrame(selection);
      figma.notify('Alt+F · Заполнить родительский фрейм');
      break;
    case 'matchParentSize':
      matchParentSize(selection);
      figma.notify('Alt+M · Размер как у родителя');
      break;
    case 'distributeHorizontal':
      distribute(selection, 'horizontal');
      figma.notify('Alt+Shift+J · Распределено по горизонтали');
      break;
    case 'distributeVertical':
      distribute(selection, 'vertical');
      figma.notify('Alt+Shift+K · Распределено по вертикали');
      break;
    case 'swapFillStroke':
      swapFillStroke(selection);
      figma.notify('Alt+Shift+W · Заливка ↔ Обводка');
      break;
    case 'toggleAutoLayout':
      toggleAutoLayout(selection);
      break;
    case 'centerInViewport':
      centerInViewport(selection);
      figma.notify('Alt+Shift+O · Центр на экране');
      break;
    default:
      figma.notify('Неизвестное действие: ' + action, { error: true });
  }
  return Promise.resolve();
}

function getParentFrame(node) {
  var parent = node.parent;
  while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    if (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE') {
      return parent;
    }
    parent = parent.parent;
  }
  return null;
}

function centerInParent(nodes, axis) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var parent = getParentFrame(node);
    if (!parent) continue;

    var parentBox = absoluteBox(parent);
    var nodeBox = absoluteBox(node);
    var nodeW = nodeBox.width;
    var nodeH = nodeBox.height;
    var targetCenterX = parentBox.x + parentBox.width / 2;
    var targetCenterY = parentBox.y + parentBox.height / 2;
    var newX = node.x;
    var newY = node.y;

    if (axis === 'both' || axis === 'x') {
      newX = node.x + (targetCenterX - (nodeBox.x + nodeW / 2));
    }
    if (axis === 'both' || axis === 'y') {
      newY = node.y + (targetCenterY - (nodeBox.y + nodeH / 2));
    }

    node.x = newX;
    node.y = newY;
  }
}

function absoluteBox(node) {
  var t = node.absoluteTransform;
  var w = 'width' in node ? node.width : 0;
  var h = 'height' in node ? node.height : 0;
  return { x: t[0][2], y: t[1][2], width: w, height: h };
}

function fillParentFrame(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var parent = getParentFrame(node);
    if (!parent || !('resize' in node)) continue;
    node.x = 0;
    node.y = 0;
    node.resize(parent.width, parent.height);
  }
}

function matchParentSize(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var parent = getParentFrame(node);
    if (!parent || !('resize' in node)) continue;
    node.resize(parent.width, parent.height);
  }
}

function distribute(nodes, direction) {
  if (nodes.length < 2) {
    figma.notify('Выберите минимум 2 объекта', { error: true });
    return;
  }

  var sorted = nodes.slice().sort(function (a, b) {
    return direction === 'horizontal' ? a.x - b.x : a.y - b.y;
  });

  var first = sorted[0];
  var last = sorted[sorted.length - 1];

  if (direction === 'horizontal') {
    var totalWidth = 0;
    for (var i = 0; i < sorted.length; i++) {
      totalWidth += 'width' in sorted[i] ? sorted[i].width : 0;
    }
    var spanH = (last.x + ('width' in last ? last.width : 0)) - first.x;
    var gapH = (spanH - totalWidth) / (sorted.length - 1);
    var cursorH = first.x;
    for (var j = 0; j < sorted.length; j++) {
      sorted[j].x = cursorH;
      cursorH += ('width' in sorted[j] ? sorted[j].width : 0) + gapH;
    }
  } else {
    var totalHeight = 0;
    for (var k = 0; k < sorted.length; k++) {
      totalHeight += 'height' in sorted[k] ? sorted[k].height : 0;
    }
    var spanV = (last.y + ('height' in last ? last.height : 0)) - first.y;
    var gapV = (spanV - totalHeight) / (sorted.length - 1);
    var cursorV = first.y;
    for (var m = 0; m < sorted.length; m++) {
      sorted[m].y = cursorV;
      cursorV += ('height' in sorted[m] ? sorted[m].height : 0) + gapV;
    }
  }
}

function swapFillStroke(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (!('fills' in node) || !('strokes' in node)) continue;

    var fills = JSON.parse(JSON.stringify(node.fills));
    var strokes = JSON.parse(JSON.stringify(node.strokes));
    var strokeWeight = node.strokeWeight;
    var hasStroke = strokes.length > 0 && strokes[0].type !== 'NONE';
    var hasFill = fills.length > 0 && fills[0].type !== 'NONE';

    if (hasStroke && hasFill) {
      node.fills = strokes;
      node.strokes = fills;
    } else if (hasFill) {
      node.strokes = fills;
      node.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }];
      node.strokeWeight = strokeWeight || 1;
    } else if (hasStroke) {
      node.fills = strokes;
      node.strokes = [];
    }
  }
}

function toggleAutoLayout(nodes) {
  var changed = 0;
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.type !== 'FRAME' && node.type !== 'COMPONENT') continue;

    if (node.layoutMode === 'NONE') {
      node.layoutMode = 'VERTICAL';
      node.primaryAxisSizingMode = 'AUTO';
      node.counterAxisSizingMode = 'AUTO';
      node.paddingLeft = 16;
      node.paddingRight = 16;
      node.paddingTop = 16;
      node.paddingBottom = 16;
      node.itemSpacing = 8;
      changed++;
    } else {
      node.layoutMode = 'NONE';
      changed++;
    }
  }
  if (changed === 0) {
    figma.notify('Выберите Frame или Component', { error: true });
  } else {
    figma.notify('Alt+Shift+L · Auto Layout переключён');
  }
}

function centerInViewport(nodes) {
  var center = figma.viewport.center;
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (!('width' in node)) continue;
    var abs = absoluteBox(node);
    node.x += center.x - (abs.x + abs.width / 2);
    node.y += center.y - (abs.y + abs.height / 2);
  }
}

var DESKTOP_W = 1920;
var DESKTOP_H = 1080;

function applyDesktopFrameSetup(frame) {
  if (!frame || !('resize' in frame)) return;
  if (frame.layoutMode && frame.layoutMode !== 'NONE') {
    frame.layoutMode = 'NONE';
  }
  frame.resize(DESKTOP_W, DESKTOP_H);
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }];
  frame.layoutGrids = [{
    pattern: 'COLUMNS',
    alignment: 'STRETCH',
    count: 12,
    gutterSize: 20,
    offset: 0,
    visible: true,
    color: { r: 1, g: 0, b: 0, a: 0.1 },
  }];
}

function setupDesktopFrame(nodes) {
  var targets = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      targets.push(node);
    }
  }

  if (targets.length === 0) {
    var frame = figma.createFrame();
    frame.name = 'Desktop 1920×1080';
    figma.currentPage.appendChild(frame);
    var center = figma.viewport.center;
    frame.x = center.x - DESKTOP_W / 2;
    frame.y = center.y - DESKTOP_H / 2;
    applyDesktopFrameSetup(frame);
    targets = [frame];
  } else {
    for (var j = 0; j < targets.length; j++) {
      applyDesktopFrameSetup(targets[j]);
    }
  }

  figma.currentPage.selection = targets;
  figma.viewport.scrollAndZoomIntoView(targets);
  figma.notify('Alt+Shift+G · Desktop 1920×1080 · 12 колонок · белый фон');
  return Promise.resolve();
}

var CREATE_ACTIONS = {
  setupDesktopFrame: true,
  createMobileFrame: true,
  createTabletFrame: true,
  createButton: true,
  createCard: true,
  createInput: true,
  createNavbar: true,
  createHeroSection: true,
  createFeatureRow: true,
  createMegaLandingPage: true,
};

var FONT_FAMILY = 'Roboto';

function solidColor(r, g, b, a) {
  return [{ type: 'SOLID', color: { r: r / 255, g: g / 255, b: b / 255 }, opacity: a == null ? 1 : a, visible: true }];
}

function ensureFonts() {
  function loadFamily(family) {
    var styles = ['Regular', 'Medium', 'Bold'];
    return Promise.all(styles.map(function (style) {
      return figma.loadFontAsync({ family: family, style: style });
    })).then(function () {
      FONT_FAMILY = family;
    });
  }
  return loadFamily('Inter').catch(function () {
    return loadFamily('Roboto');
  });
}

function fontWeightName(weight) {
  if (weight === 'bold') return 'Bold';
  if (weight === 'medium') return 'Medium';
  return 'Regular';
}

function makeText(chars, size, weight, rgbArr) {
  var t = figma.createText();
  t.fontName = { family: FONT_FAMILY, style: fontWeightName(weight) };
  t.characters = String(chars);
  t.fontSize = size;
  t.fills = solidColor(rgbArr[0], rgbArr[1], rgbArr[2]);
  return t;
}

function layoutVertical(frame, gap, pad) {
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.itemSpacing = gap == null ? 16 : gap;
  var p = pad == null ? 0 : pad;
  frame.paddingLeft = p;
  frame.paddingRight = p;
  frame.paddingTop = p;
  frame.paddingBottom = p;
}

function layoutHorizontal(frame, gap, padX, padY) {
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.itemSpacing = gap == null ? 12 : gap;
  frame.paddingLeft = padX == null ? 0 : padX;
  frame.paddingRight = padX == null ? 0 : padX;
  frame.paddingTop = padY == null ? 0 : padY;
  frame.paddingBottom = padY == null ? 0 : padY;
}

function placeNewFrame(frame, w, h) {
  var center = figma.viewport.center;
  frame.resize(w, h);
  frame.x = center.x - w / 2;
  frame.y = center.y - h / 2;
  figma.currentPage.appendChild(frame);
  return frame;
}

function finishCreate(nodes, message) {
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  if (message) figma.notify(message);
}

function createDeviceFrame(w, h, name, bg) {
  var frame = figma.createFrame();
  frame.name = name;
  frame.fills = solidColor(bg[0], bg[1], bg[2]);
  frame.clipsContent = true;
  placeNewFrame(frame, w, h);
  finishCreate([frame], name + ' · ' + w + '×' + h);
  return Promise.resolve();
}

function createButtonNode() {
  var btn = figma.createFrame();
  btn.name = 'Button / Primary';
  btn.fills = solidColor(28, 28, 30);
  btn.cornerRadius = 999;
  layoutHorizontal(btn, 8, 20, 12);
  btn.primaryAxisAlignItems = 'CENTER';
  btn.counterAxisAlignItems = 'CENTER';
  var label = makeText('Добавить', 14, 'medium', [250, 250, 248]);
  btn.appendChild(label);
  placeNewFrame(btn, Math.max(140, label.width + 40), 44);
  finishCreate([btn], 'Кнопка создана');
  return Promise.resolve();
}

function createCardNode() {
  var card = figma.createFrame();
  card.name = 'Card';
  card.fills = solidColor(255, 255, 255);
  card.strokes = solidColor(28, 28, 30, 0.09);
  card.strokeWeight = 1;
  card.cornerRadius = 16;
  layoutVertical(card, 8, 20);
  card.appendChild(makeText('Заголовок карточки', 18, 'bold', [28, 28, 30]));
  card.appendChild(makeText('Краткое описание блока. Замените текст на свой.', 13, 'regular', [110, 110, 115]));
  placeNewFrame(card, 320, 160);
  finishCreate([card], 'Карточка создана');
  return Promise.resolve();
}

function createInputNode() {
  var wrap = figma.createFrame();
  wrap.name = 'Input / Text';
  wrap.fills = solidColor(255, 255, 255, 0);
  layoutVertical(wrap, 6, 0);
  wrap.appendChild(makeText('Email', 12, 'medium', [110, 110, 115]));
  var field = figma.createFrame();
  field.name = 'Field';
  field.fills = solidColor(250, 250, 248);
  field.strokes = solidColor(28, 28, 30, 0.12);
  field.strokeWeight = 1;
  field.cornerRadius = 10;
  layoutHorizontal(field, 0, 14, 12);
  field.appendChild(makeText('you@company.com', 14, 'regular', [142, 142, 147]));
  field.resize(280, 44);
  wrap.appendChild(field);
  placeNewFrame(wrap, 280, 70);
  finishCreate([wrap], 'Поле ввода создано');
  return Promise.resolve();
}

function createNavbarNode() {
  var nav = figma.createFrame();
  nav.name = 'Navbar';
  nav.fills = solidColor(255, 255, 255);
  nav.strokes = solidColor(28, 28, 30, 0.08);
  nav.strokeWeight = 1;
  layoutHorizontal(nav, 24, 32, 16);
  nav.primaryAxisAlignItems = 'CENTER';
  nav.counterAxisAlignItems = 'CENTER';
  nav.appendChild(makeText('SHKF', 16, 'bold', [28, 28, 30]));
  var links = figma.createFrame();
  links.name = 'Links';
  links.fills = solidColor(255, 255, 255, 0);
  layoutHorizontal(links, 20, 0, 0);
  ['Продукт', 'Цены', 'О нас'].forEach(function (l) {
    links.appendChild(makeText(l, 13, 'regular', [110, 110, 115]));
  });
  nav.appendChild(links);
  var cta = figma.createFrame();
  cta.name = 'CTA';
  cta.fills = solidColor(249, 115, 22);
  cta.cornerRadius = 999;
  layoutHorizontal(cta, 0, 16, 8);
  cta.appendChild(makeText('Начать', 13, 'medium', [255, 255, 255]));
  nav.appendChild(cta);
  placeNewFrame(nav, 960, 64);
  finishCreate([nav], 'Навбар создан');
  return Promise.resolve();
}

function createHeroSectionNode() {
  var hero = figma.createFrame();
  hero.name = 'Hero Section';
  hero.fills = solidColor(247, 246, 242);
  hero.cornerRadius = 20;
  layoutVertical(hero, 16, 48);
  hero.primaryAxisAlignItems = 'CENTER';
  hero.counterAxisAlignItems = 'CENTER';
  hero.appendChild(makeText('Заголовок продукта', 40, 'bold', [28, 28, 30]));
  hero.appendChild(makeText('Подзаголовок — одно предложение о ценности.', 16, 'regular', [110, 110, 115]));
  var row = figma.createFrame();
  row.fills = solidColor(247, 246, 242, 0);
  layoutHorizontal(row, 12, 0, 0);
  var primary = figma.createFrame();
  primary.fills = solidColor(28, 28, 30);
  primary.cornerRadius = 999;
  layoutHorizontal(primary, 0, 24, 12);
  primary.appendChild(makeText('Попробовать', 14, 'medium', [250, 250, 248]));
  row.appendChild(primary);
  var ghost = figma.createFrame();
  ghost.fills = solidColor(255, 255, 255);
  ghost.strokes = solidColor(28, 28, 30, 0.12);
  ghost.strokeWeight = 1;
  ghost.cornerRadius = 999;
  layoutHorizontal(ghost, 0, 24, 12);
  ghost.appendChild(makeText('Подробнее', 14, 'medium', [28, 28, 30]));
  row.appendChild(ghost);
  hero.appendChild(row);
  placeNewFrame(hero, 900, 360);
  finishCreate([hero], 'Hero-секция создана');
  return Promise.resolve();
}

function createFeatureRowNode() {
  function feature(title, desc) {
    var f = figma.createFrame();
    f.name = title;
    f.fills = solidColor(250, 250, 248);
    f.cornerRadius = 14;
    layoutVertical(f, 8, 20);
    f.appendChild(makeText(title, 16, 'bold', [28, 28, 30]));
    f.appendChild(makeText(desc, 12, 'regular', [110, 110, 115]));
    f.resize(240, 140);
    return f;
  }
  var row = figma.createFrame();
  row.name = 'Features';
  row.fills = solidColor(255, 255, 255, 0);
  layoutHorizontal(row, 20, 0, 0);
  row.appendChild(feature('Быстро', 'Старт макета за секунды'));
  row.appendChild(feature('Адаптивно', 'Desktop, tablet и mobile'));
  row.appendChild(feature('SHKF', 'Хоткеи прямо в Figma'));
  placeNewFrame(row, 760, 140);
  finishCreate([row], 'Ряд фич создан');
  return Promise.resolve();
}

function sectionBlock(name, w, h, bg, title, body) {
  var s = figma.createFrame();
  s.name = name;
  s.fills = solidColor(bg[0], bg[1], bg[2]);
  layoutVertical(s, 12, 24);
  s.appendChild(makeText(title, 14, 'bold', [28, 28, 30]));
  if (body) s.appendChild(makeText(body, 11, 'regular', [110, 110, 115]));
  s.resize(w, h);
  return s;
}

function buildPageColumn(width, height, label, compact) {
  var col = figma.createFrame();
  col.name = label;
  col.fills = solidColor(255, 255, 255);
  col.strokes = solidColor(28, 28, 30, 0.08);
  col.strokeWeight = 1;
  col.cornerRadius = 12;
  col.clipsContent = true;
  layoutVertical(col, 0, 0);
  var navH = compact ? 52 : 64;
  var heroH = compact ? 280 : 320;
  var featH = compact ? 200 : 160;
  col.appendChild(sectionBlock('Header', width, navH, [255, 255, 255], label + ' · Nav', compact ? 'Logo + menu' : 'Logo · Links · CTA'));
  col.appendChild(sectionBlock('Hero', width, heroH, [247, 246, 242], 'Hero', compact ? 'Title + CTA' : 'Заголовок · подзаголовок · кнопки'));
  col.appendChild(sectionBlock('Features', width, featH, [250, 250, 248], 'Features', compact ? '3 stacked' : '3 columns'));
  col.appendChild(sectionBlock('CTA', width, compact ? 120 : 140, [28, 28, 30], 'CTA', 'Final call to action'));
  col.appendChild(sectionBlock('Footer', width, compact ? 80 : 96, [232, 230, 225], 'Footer', '© Links'));
  col.resize(width, height);
  return col;
}

function createMegaLandingPage() {
  var kit = figma.createFrame();
  kit.name = '🌐 Adaptive Landing Page';
  kit.fills = solidColor(232, 230, 225);
  layoutHorizontal(kit, 48, 48, 48);
  kit.primaryAxisAlignItems = 'MIN';
  kit.counterAxisAlignItems = 'MIN';
  kit.appendChild(buildPageColumn(1440, 900, 'Desktop 1440', false));
  kit.appendChild(buildPageColumn(834, 1100, 'Tablet 834', true));
  kit.appendChild(buildPageColumn(390, 844, 'Mobile 390', true));
  var totalW = 1440 + 834 + 390 + 48 * 4;
  var totalH = 1100 + 96;
  placeNewFrame(kit, totalW, totalH);
  finishCreate([kit], '🌐 Mega: Desktop + Tablet + Mobile landing');
  return Promise.resolve();
}

function runCreateAction(action) {
  return ensureFonts().then(function () {
    switch (action) {
      case 'setupDesktopFrame':
        return setupDesktopFrame(figma.currentPage.selection);
      case 'createMobileFrame':
        return createDeviceFrame(390, 844, 'Mobile 390', [250, 250, 248]);
      case 'createTabletFrame':
        return createDeviceFrame(834, 1194, 'Tablet 834', [250, 250, 248]);
      case 'createButton':
        return createButtonNode();
      case 'createCard':
        return createCardNode();
      case 'createInput':
        return createInputNode();
      case 'createNavbar':
        return createNavbarNode();
      case 'createHeroSection':
        return createHeroSectionNode();
      case 'createFeatureRow':
        return createFeatureRowNode();
      case 'createMegaLandingPage':
        return createMegaLandingPage();
      default:
        figma.notify('Неизвестное действие: ' + action, { error: true });
        return Promise.resolve();
    }
  });
}

function exportSelectionToLibrary() {
  var selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify('Выберите компонент или frame в Figma', { error: true });
    figma.ui.postMessage({ type: 'library-export-failed', error: 'Ничего не выделено' });
    return Promise.resolve();
  }

  var node = selection[0];
  if (!('exportAsync' in node)) {
    figma.notify('Этот объект нельзя экспортировать', { error: true });
    figma.ui.postMessage({ type: 'library-export-failed', error: 'Объект нельзя экспортировать' });
    return Promise.resolve();
  }

  var svgPromise = node.exportAsync({ format: 'SVG', svgIdAttribute: false });
  var designW = 'width' in node ? Math.round(node.width) : 480;
  // 3× макета (мин. 960px) — иначе текст в превью размывается при увеличении
  var thumbWidth = Math.min(3200, Math.max(960, designW * 3));
  var thumbOpts = { format: 'PNG', constraint: { type: 'WIDTH', value: thumbWidth } };
  var bannerSlots = (function () {
    try { return collectBannerSlots(node); } catch (e) { return null; }
  })();
  var imgLayer = findBannerImgLayer(node, bannerSlots);

  function exportPng() {
    return node.exportAsync(thumbOpts);
  }

  function exportPngWithoutImg() {
    var toggled = hideNonUiBannerLayers(node, imgLayer, bannerSlots);
    return exportPng().then(function (bytes) {
      restoreBannerLayerVisibility(toggled);
      return bytes;
    }).catch(function (err) {
      restoreBannerLayerVisibility(toggled);
      throw err;
    });
  }

  return Promise.all([svgPromise, exportPng(), exportPngWithoutImg()]).then(function (results) {
    var svgBytes = results[0];
    var pngBytes = results[1];
    var pngNoImgBytes = results[2];
    var componentKey = '';

    if (node.type === 'COMPONENT') {
      componentKey = node.key;
    } else if (node.type === 'INSTANCE' && node.mainComponent) {
      componentKey = node.mainComponent.key;
    }

    var payload = {
      name: node.name,
      nodeId: node.id,
      nodeType: node.type,
      componentKey: componentKey,
      fileName: figma.root.name,
      width: 'width' in node ? node.width : 0,
      height: 'height' in node ? node.height : 0,
      svg: figma.base64Encode(svgBytes),
      thumbnail: figma.base64Encode(pngBytes),
      bannerSlots: bannerSlots,
    };
    if (pngNoImgBytes) {
      payload.thumbnailNoImg = figma.base64Encode(pngNoImgBytes);
    }

    figma.ui.postMessage({
      type: 'library-export-ready',
      payload: payload,
    });

    figma.notify('«' + node.name + '» отправлен в SHKF');
  }).catch(function (err) {
    figma.notify('Ошибка экспорта: ' + (err.message || err), { error: true });
    figma.ui.postMessage({ type: 'library-export-failed', error: err.message || String(err) });
  });
}

function insertUserTemplate(template, requestId) {
  if (!template) {
    sendTemplateResult(requestId, false, 'Нет данных компонента');
    return Promise.resolve();
  }

  var nodeId = template.nodeId;
  var node = nodeId ? figma.getNodeById(nodeId) : null;

  if (node && !node.removed && 'clone' in node) {
    var clone = node.clone();
    figma.currentPage.appendChild(clone);
    var center = figma.viewport.center;
    if ('width' in clone) {
      clone.x = center.x - clone.width / 2;
      clone.y = center.y - clone.height / 2;
    }
    figma.currentPage.selection = [clone];
    figma.viewport.scrollAndZoomIntoView([clone]);
    figma.notify('«' + (template.name || 'Компонент') + '» вставлен');
    sendTemplateResult(requestId, true);
    return Promise.resolve();
  }

  if (template.componentKey) {
    return figma.importComponentByKeyAsync(template.componentKey).then(function (comp) {
      var inst = comp.createInstance();
      figma.currentPage.appendChild(inst);
      var c = figma.viewport.center;
      inst.x = c.x - inst.width / 2;
      inst.y = c.y - inst.height / 2;
      figma.currentPage.selection = [inst];
      figma.viewport.scrollAndZoomIntoView([inst]);
      figma.notify('«' + (template.name || 'Компонент') + '» вставлен (instance)');
      sendTemplateResult(requestId, true);
    }).catch(function () {
      sendTemplateResult(requestId, false, 'Компонент не найден — используйте Ctrl+V');
    });
  }

  sendTemplateResult(requestId, false, 'Исходный объект не найден — используйте Ctrl+V');
  return Promise.resolve();
}

function sendTemplateResult(requestId, ok, error, data) {
  figma.ui.postMessage({
    type: 'template-result',
    requestId: requestId,
    ok: ok,
    error: error || '',
    data: data || null,
  });
}

var BANNER_SLOT_ALIASES = {
  image: ['img', 'slot-image', 'image', 'photo', 'bg-photo'],
  title: ['text-title', 'title', 'heading', 'заголовок'],
  subtitle: ['text-subtitle', 'subtitle', 'description', 'подзаголовок'],
  cta: ['text-cta', 'cta', 'button-text', 'кнопка'],
};

function slotNameMatches(nodeName, aliases) {
  var n = String(nodeName || '').trim().toLowerCase();
  for (var i = 0; i < aliases.length; i++) {
    if (n === String(aliases[i]).toLowerCase()) return true;
  }
  return false;
}

function relSlotBounds(node, root) {
  if (!node || !root || !('width' in root) || !('width' in node)) return null;
  var ax = node.x;
  var ay = node.y;
  var p = node.parent;
  while (p && p !== root && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    ax += p.x;
    ay += p.y;
    p = p.parent;
  }
  var rw = root.width || 1;
  var rh = root.height || 1;
  return {
    x: ax / rw,
    y: ay / rh,
    w: node.width / rw,
    h: node.height / rh,
    layerName: node.name,
  };
}

function walkNodes(node, fn) {
  if (!node) return;
  fn(node);
  if ('children' in node && node.children) {
    for (var i = 0; i < node.children.length; i++) {
      walkNodes(node.children[i], fn);
    }
  }
}

function rgbToCss(color, opacity) {
  if (!color) return '';
  var r = Math.round((color.r || 0) * 255);
  var g = Math.round((color.g || 0) * 255);
  var b = Math.round((color.b || 0) * 255);
  var a = opacity != null ? opacity : 1;
  if (a >= 0.999) return 'rgb(' + r + ',' + g + ',' + b + ')';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function readTextStyle(node) {
  var style = {};
  if (!node || node.type !== 'TEXT') return style;
  var fontSize = node.fontSize;
  if (fontSize === figma.mixed && node.characters.length) {
    fontSize = node.getRangeFontSize(0, 1);
  }
  if (typeof fontSize === 'number') style.fontSize = fontSize;

  var fontName = node.fontName;
  if (fontName === figma.mixed && node.characters.length) {
    fontName = node.getRangeFontName(0, 1);
  }
  if (fontName && fontName.style) {
    style.fontFamily = fontName.family || '';
    style.fontStyle = fontName.style || '';
    if (/bold|black|heavy|semibold|medium/i.test(fontName.style)) style.fontWeight = 700;
  }

  var fills = node.fills;
  if (fills && fills !== figma.mixed && fills.length) {
    for (var i = 0; i < fills.length; i++) {
      var fill = fills[i];
      if (fill && fill.type === 'SOLID' && fill.visible !== false) {
        style.color = rgbToCss(fill.color, fill.opacity);
        break;
      }
    }
  }

  if (typeof node.lineHeight !== 'undefined' && node.lineHeight !== figma.mixed) {
    var lh = node.lineHeight;
    if (lh && lh.unit === 'PIXELS') style.lineHeight = lh.value;
    else if (lh && lh.unit === 'PERCENT') style.lineHeight = (fontSize || 16) * (lh.value / 100);
  }

  return style;
}

function assignTextSlot(slots, key, bounds, node) {
  if (!bounds || !node) return;
  slots[key] = bounds;
  slots[key].defaultText = node.characters;
  slots[key].layerName = node.name;
  var textStyle = readTextStyle(node);
  if (textStyle.fontSize) slots[key].fontSize = textStyle.fontSize;
  if (textStyle.color) slots[key].color = textStyle.color;
  if (textStyle.fontWeight) slots[key].fontWeight = textStyle.fontWeight;
  if (textStyle.fontFamily) slots[key].fontFamily = textStyle.fontFamily;
  if (textStyle.fontStyle) slots[key].fontStyle = textStyle.fontStyle;
  if (textStyle.lineHeight) slots[key].lineHeight = textStyle.lineHeight;
}

function collectBannerSlots(root) {
  if (!root || !('width' in root)) return null;
  var slots = {};
  var looseTexts = [];

  try {
    walkNodes(root, function (n) {
      if (n === root) return;
      var name = n.name || '';
      if (!slots.image && slotNameMatches(name, BANNER_SLOT_ALIASES.image)) {
        if ('fills' in n || n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'RECTANGLE') {
          slots.image = relSlotBounds(n, root);
          if (slots.image) slots.image.layerName = n.name;
        }
      }
      if (n.type === 'TEXT') {
        var bounds = relSlotBounds(n, root);
        if (slotNameMatches(name, BANNER_SLOT_ALIASES.title)) {
          assignTextSlot(slots, 'title', bounds, n);
        } else if (slotNameMatches(name, BANNER_SLOT_ALIASES.subtitle)) {
          assignTextSlot(slots, 'subtitle', bounds, n);
        } else if (slotNameMatches(name, BANNER_SLOT_ALIASES.cta)) {
          assignTextSlot(slots, 'cta', bounds, n);
        } else if (bounds) {
          looseTexts.push({ node: n, bounds: bounds, y: bounds.y });
        }
      }
    });

    looseTexts.sort(function (a, b) { return a.y - b.y; });
    if (!slots.title && looseTexts[0]) assignTextSlot(slots, 'title', looseTexts[0].bounds, looseTexts[0].node);
    if (!slots.subtitle && looseTexts[1]) assignTextSlot(slots, 'subtitle', looseTexts[1].bounds, looseTexts[1].node);
    if (!slots.cta && looseTexts[2]) assignTextSlot(slots, 'cta', looseTexts[2].bounds, looseTexts[2].node);
  } catch (err) {
    return null;
  }

  return Object.keys(slots).length ? slots : null;
}

function slotField(slot, key, fallback) {
  if (!slot) return fallback || '';
  var val = slot[key];
  return val != null && val !== '' ? val : (fallback || '');
}

function readBannerTextsFromFrame(root) {
  var slots = collectBannerSlots(root) || {};
  return {
    title: slotField(slots.title, 'defaultText', ''),
    subtitle: slotField(slots.subtitle, 'defaultText', ''),
    cta: slotField(slots.cta, 'defaultText', ''),
    layers: {
      title: slotField(slots.title, 'layerName', ''),
      subtitle: slotField(slots.subtitle, 'layerName', ''),
      cta: slotField(slots.cta, 'layerName', ''),
      image: slotField(slots.image, 'layerName', ''),
    },
    bannerSlots: slots,
  };
}

function readBannerTexts(payload, requestId) {
  var nodeId = payload && payload.nodeId;
  var node = nodeId ? figma.getNodeById(nodeId) : null;
  if (!node || node.removed) {
    sendTemplateResult(requestId, false, 'Frame баннера не найден — откройте файл SHKF banners');
    return Promise.resolve();
  }
  var data = readBannerTextsFromFrame(node);
  sendTemplateResult(requestId, true, '', data);
  return Promise.resolve();
}

function findNodeBySlot(root, aliases) {
  var found = null;
  walkNodes(root, function (n) {
    if (found) return;
    if (n === root) return;
    if (slotNameMatches(n.name, aliases)) found = n;
  });
  return found;
}

function isBannerUiNode(node) {
  if (!node || node.type === 'PAGE' || node.type === 'DOCUMENT') return false;
  var name = node.name || '';
  if (slotNameMatches(name, BANNER_SLOT_ALIASES.title)) return true;
  if (slotNameMatches(name, BANNER_SLOT_ALIASES.subtitle)) return true;
  if (slotNameMatches(name, BANNER_SLOT_ALIASES.cta)) return true;
  if (node.type === 'TEXT') return true;
  if (/button|btn|кноп/i.test(name)) return true;
  return false;
}

function markBannerUiAncestors(node, root, keepIds) {
  var p = node;
  while (p && p !== root && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    keepIds[p.id] = true;
    p = p.parent;
  }
}

function hideNonUiBannerLayers(root, imgLayer, bannerSlots) {
  if (!root || !('children' in root)) return [];
  var keepIds = {};
  keepIds[root.id] = true;

  walkNodes(root, function (n) {
    if (n === root) return;
    if (isBannerUiNode(n)) markBannerUiAncestors(n, root, keepIds);
  });

  if (imgLayer) keepIds[imgLayer.id] = false;

  var toggled = [];
  walkNodes(root, function (n) {
    if (n === root) return;
    if (keepIds[n.id]) return;
    if (n.visible) {
      toggled.push({ node: n, visible: true });
      n.visible = false;
    }
  });

  if (imgLayer && imgLayer.visible) {
    toggled.push({ node: imgLayer, visible: true });
    imgLayer.visible = false;
  }

  return toggled;
}

function restoreBannerLayerVisibility(toggled) {
  for (var i = 0; i < toggled.length; i++) {
    toggled[i].node.visible = toggled[i].visible;
  }
}

function findBannerImgLayer(root, bannerSlots) {
  var slotName = bannerSlots && bannerSlots.image && bannerSlots.image.layerName;
  if (slotName) {
    var bySlot = findNodeBySlot(root, [slotName]);
    if (bySlot) return bySlot;
  }
  return findNodeBySlot(root, BANNER_SLOT_ALIASES.image);
}

function decodeBase64ToBytes(b64) {
  return figma.base64Decode(b64);
}

function fetchImageBytes(url) {
  var raw = String(url || '').trim();
  if (!raw) return Promise.reject(new Error('Нет URL изображения'));
  if (raw.indexOf('data:image/') === 0) {
    var comma = raw.indexOf(',');
    var b64 = comma >= 0 ? raw.slice(comma + 1) : '';
    return Promise.resolve(decodeBase64ToBytes(b64));
  }
  return fetch(raw).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.arrayBuffer();
  }).then(function (buf) {
    return new Uint8Array(buf);
  });
}

function setTextOnNode(node, text) {
  if (!node || node.type !== 'TEXT') return Promise.resolve(false);
  var value = String(text || '');
  if (!value) return Promise.resolve(false);
  var fontName = node.fontName;
  if (fontName === figma.mixed) {
    var len = node.characters.length;
    if (!len) return Promise.resolve(false);
    fontName = node.getRangeFontName(0, 1);
  }
  return figma.loadFontAsync(fontName).then(function () {
    node.characters = value;
    return true;
  });
}

function setImageFillOnNode(node, bytes) {
  if (!node || !('fills' in node) || !bytes || !bytes.length) return false;
  var image = figma.createImage(bytes);
  node.fills = [{
    type: 'IMAGE',
    scaleMode: 'FILL',
    imageHash: image.hash,
  }];
  return true;
}

function cloneBannerTemplate(template) {
  var nodeId = template && template.nodeId;
  var node = nodeId ? figma.getNodeById(nodeId) : null;
  if (node && !node.removed && 'clone' in node) {
    var clone = node.clone();
    figma.currentPage.appendChild(clone);
    return Promise.resolve(clone);
  }
  if (template && template.componentKey) {
    return figma.importComponentByKeyAsync(template.componentKey).then(function (comp) {
      var inst = comp.createInstance();
      figma.currentPage.appendChild(inst);
      return inst;
    });
  }
  return Promise.reject(new Error('Баннер не найден в файле Figma — откройте SHKF banners и переэкспортируйте frame'));
}

function applyBannerMockup(payload, requestId) {
  var template = payload && payload.template;
  var texts = (payload && payload.texts) || {};
  var imageUrl = payload && payload.imageUrl;

  return cloneBannerTemplate(template).then(function (root) {
    var center = figma.viewport.center;
    if ('width' in root) {
      root.x = center.x - root.width / 2;
      root.y = center.y - root.height / 2;
    }

    var chain = Promise.resolve();
    var imgNode = findNodeBySlot(root, BANNER_SLOT_ALIASES.image);
    if (imgNode && imageUrl) {
      chain = chain.then(function () {
        return fetchImageBytes(imageUrl).then(function (bytes) {
          setImageFillOnNode(imgNode, bytes);
        });
      });
    }

    var titleNode = findNodeBySlot(root, BANNER_SLOT_ALIASES.title);
    var subtitleNode = findNodeBySlot(root, BANNER_SLOT_ALIASES.subtitle);
    var ctaNode = findNodeBySlot(root, BANNER_SLOT_ALIASES.cta);

    chain = chain.then(function () { return setTextOnNode(titleNode, texts.title); });
    chain = chain.then(function () { return setTextOnNode(subtitleNode, texts.subtitle); });
    chain = chain.then(function () { return setTextOnNode(ctaNode, texts.cta); });

    return chain.then(function () {
      figma.currentPage.selection = [root];
      figma.viewport.scrollAndZoomIntoView([root]);
      figma.notify('Баннер «' + (template.name || 'мокап') + '» обновлён');
      sendTemplateResult(requestId, true);
    });
  }).catch(function (err) {
    sendTemplateResult(requestId, false, err.message || String(err));
  });
}

function briefNode(node, depth, maxDepth) {
  var item = {
    id: node.id,
    name: node.name || '',
    type: node.type,
    visible: node.visible !== false,
    x: typeof node.x === 'number' ? Math.round(node.x) : null,
    y: typeof node.y === 'number' ? Math.round(node.y) : null,
    width: 'width' in node ? Math.round(node.width) : null,
    height: 'height' in node ? Math.round(node.height) : null,
  };

  if (node.type === 'TEXT') {
    item.text = String(node.characters || '').slice(0, 240);
  }
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    item.layoutMode = node.layoutMode;
    item.itemSpacing = node.itemSpacing;
    item.padding = {
      left: node.paddingLeft || 0,
      right: node.paddingRight || 0,
      top: node.paddingTop || 0,
      bottom: node.paddingBottom || 0,
    };
  }

  if (depth < maxDepth && 'children' in node && node.children && node.children.length) {
    item.children = [];
    for (var i = 0; i < node.children.length && i < 20; i++) {
      item.children.push(briefNode(node.children[i], depth + 1, maxDepth));
    }
  }
  return item;
}

function readSelectionBrief(payload, requestId) {
  var selection = figma.currentPage.selection || [];
  var maxDepth = payload && payload.maxDepth != null ? Number(payload.maxDepth) : 2;
  if (!Number.isFinite(maxDepth) || maxDepth < 0) maxDepth = 2;
  if (maxDepth > 4) maxDepth = 4;

  var nodes = [];
  for (var i = 0; i < selection.length && i < 20; i++) {
    nodes.push(briefNode(selection[i], 0, maxDepth));
  }
  var data = {
    fileName: figma.root && figma.root.name ? figma.root.name : '',
    pageName: figma.currentPage && figma.currentPage.name ? figma.currentPage.name : '',
    selectedCount: selection.length,
    nodes: nodes,
  };
  sendTemplateResult(requestId, true, '', data);
  return Promise.resolve();
}

function parseTargetNodes(operation, ctx) {
  if (operation && operation.targetKey && ctx && ctx.created && ctx.created[operation.targetKey]) {
    return [ctx.created[operation.targetKey]];
  }
  if (operation && operation.targetName) {
    var byName = figma.currentPage.findOne(function (n) {
      return n.name === String(operation.targetName);
    });
    return byName && !byName.removed ? [byName] : [];
  }
  if (operation && operation.target === 'nodeId' && operation.nodeId) {
    var node = figma.getNodeById(operation.nodeId);
    return node && !node.removed ? [node] : [];
  }
  return (figma.currentPage.selection || []).slice();
}

function resolveParentNode(operation, ctx) {
  if (operation && operation.parentKey && ctx && ctx.created && ctx.created[operation.parentKey]) {
    return ctx.created[operation.parentKey];
  }
  if (operation && operation.parentName) {
    var parentName = String(operation.parentName);
    var candidates = figma.currentPage.findAll(function (n) {
      return n.name === parentName && 'appendChild' in n;
    });
    if (candidates.length) {
      if (operation.parentX != null) {
        var px = Number(operation.parentX);
        var matched = [];
        for (var ci = 0; ci < candidates.length; ci++) {
          if (Math.abs(candidates[ci].x - px) < 2) matched.push(candidates[ci]);
        }
        if (matched.length) return matched[matched.length - 1];
      }
      return candidates[candidates.length - 1];
    }
  }
  if (operation && operation.target === 'nodeId' && operation.nodeId) {
    var explicit = figma.getNodeById(operation.nodeId);
    if (explicit && !explicit.removed && 'appendChild' in explicit) return explicit;
  }
  var selection = figma.currentPage.selection || [];
  if (selection.length === 1 && 'appendChild' in selection[0]) return selection[0];
  return figma.currentPage;
}

function toSolidPaint(color) {
  if (!color) return null;
  var r = Number(color.r);
  var g = Number(color.g);
  var b = Number(color.b);
  var a = color.a == null ? 1 : Number(color.a);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  if (!Number.isFinite(a)) a = 1;
  return {
    type: 'SOLID',
    color: {
      r: Math.max(0, Math.min(1, r / 255)),
      g: Math.max(0, Math.min(1, g / 255)),
      b: Math.max(0, Math.min(1, b / 255)),
    },
    opacity: Math.max(0, Math.min(1, a)),
    visible: true,
  };
}

function appendToParent(node, parent) {
  if (!node) return;
  var host = parent && 'appendChild' in parent ? parent : figma.currentPage;
  host.appendChild(node);
}

function normalizeLayoutGrid(grid) {
  if (!grid || typeof grid !== 'object') return null;
  var pattern = String(grid.pattern || 'COLUMNS').toUpperCase();
  if (pattern !== 'COLUMNS') return null;
  var alignment = String(grid.alignment || 'STRETCH').toUpperCase();
  if (alignment !== 'CENTER') alignment = 'STRETCH';
  var color = grid.color || { r: 1, g: 0, b: 0, a: 0.1 };
  var cr = color.r != null && color.r <= 1 ? color.r : (Number(color.r) || 255) / 255;
  var cg = color.g != null && color.g <= 1 ? color.g : (Number(color.g) || 0) / 255;
  var cb = color.b != null && color.b <= 1 ? color.b : (Number(color.b) || 0) / 255;
  var ca = color.a != null ? color.a : 0.1;
  return {
    pattern: 'COLUMNS',
    alignment: alignment,
    visible: grid.visible !== false,
    color: { r: cr, g: cg, b: cb, a: ca },
    count: Math.max(1, Number(grid.count || 4)),
    gutterSize: Number(grid.gutterSize != null ? grid.gutterSize : 12),
    offset: Number(grid.offset != null ? grid.offset : 16),
  };
}

function applyLayoutGridsToFrame(frame, grids) {
  if (!frame || !('layoutGrids' in frame) || !Array.isArray(grids)) return;
  var normalized = grids.map(normalizeLayoutGrid).filter(Boolean);
  if (normalized.length) frame.layoutGrids = normalized;
}

function applyFrameStyle(frame, operation) {
  if (!frame || !operation) return;
  if (operation.name != null) frame.name = String(operation.name);
  if (operation.width != null && operation.height != null) {
    frame.resize(Number(operation.width), Number(operation.height));
  }
  if (operation.x != null) frame.x = Number(operation.x);
  if (operation.y != null) frame.y = Number(operation.y);
  if (operation.radius != null && 'cornerRadius' in frame) frame.cornerRadius = Number(operation.radius);
  if (operation.fill) {
    var fill = toSolidPaint(operation.fill);
    if (fill && 'fills' in frame) frame.fills = [fill];
  }
  if (operation.stroke) {
    var strokePaint = toSolidPaint(operation.stroke);
    if (strokePaint && 'strokes' in frame) {
      frame.strokes = [strokePaint];
      frame.strokeWeight = Number(operation.strokeWeight) || 1;
    }
  }
  if (operation.layoutGrids && Array.isArray(operation.layoutGrids)) {
    applyLayoutGridsToFrame(frame, operation.layoutGrids);
  }
  if (operation.layoutMode) {
    var mode = String(operation.layoutMode).toUpperCase();
    if (mode === 'NONE' || mode === 'HORIZONTAL' || mode === 'VERTICAL') frame.layoutMode = mode;
  }
  if (operation.spacing != null && 'itemSpacing' in frame) frame.itemSpacing = Number(operation.spacing);
  if (operation.padding != null) {
    frame.paddingLeft = Number(operation.padding);
    frame.paddingRight = Number(operation.padding);
    frame.paddingTop = Number(operation.padding);
    frame.paddingBottom = Number(operation.padding);
  } else {
    if (operation.paddingLeft != null) frame.paddingLeft = Number(operation.paddingLeft);
    if (operation.paddingRight != null) frame.paddingRight = Number(operation.paddingRight);
    if (operation.paddingTop != null) frame.paddingTop = Number(operation.paddingTop);
    if (operation.paddingBottom != null) frame.paddingBottom = Number(operation.paddingBottom);
  }
}

function loadFontByWeight(weight) {
  var w = Number(weight);
  var style = 'Regular';
  if (w >= 700) style = 'Bold';
  else if (w >= 500) style = 'Medium';
  return figma.loadFontAsync({ family: 'Inter', style: style })
    .then(function () {
      return { family: 'Inter', style: style };
    })
    .catch(function () {
      return figma.loadFontAsync({ family: 'Roboto', style: style }).then(function () {
        return { family: 'Roboto', style: style };
      });
    })
    .catch(function () {
      return figma.loadFontAsync({ family: 'Roboto', style: 'Regular' }).then(function () {
        return { family: 'Roboto', style: 'Regular' };
      });
    });
}

function createTextNode(operation) {
  return loadFontByWeight(operation.fontWeight).then(function (fontName) {
    var node = figma.createText();
    node.fontName = fontName;
    node.characters = String(operation.text || operation.label || 'Text');
    if (operation.fontSize != null) node.fontSize = Number(operation.fontSize);
    if (operation.name != null) node.name = String(operation.name);
    if (operation.x != null) node.x = Number(operation.x);
    if (operation.y != null) node.y = Number(operation.y);
    var fill = toSolidPaint(operation.fill);
    if (fill) node.fills = [fill];
    if (operation.width != null && Number(operation.width) > 0) {
      var resizeMode = String(operation.textAutoResize || 'HEIGHT').toUpperCase();
      if (resizeMode === 'WIDTH_AND_HEIGHT' || resizeMode === 'HEIGHT' || resizeMode === 'NONE' || resizeMode === 'TRUNCATE') {
        node.textAutoResize = resizeMode;
      } else {
        node.textAutoResize = 'HEIGHT';
      }
      if (node.textAutoResize === 'HEIGHT' || node.textAutoResize === 'NONE') {
        node.resize(Number(operation.width), node.height);
      }
    }
    if (operation.lineHeight != null && 'lineHeight' in node) {
      node.lineHeight = { value: Number(operation.lineHeight), unit: 'PIXELS' };
    }
    return node;
  });
}

function createInputFromOperation(operation) {
  return loadFontByWeight(500).then(function (labelFont) {
    return loadFontByWeight(400).then(function (fieldFont) {
      var wrap = figma.createFrame();
      wrap.name = String(operation.name || operation.label || 'Input');
      wrap.fills = solidColor(255, 255, 255, 0);
      layoutVertical(wrap, 6, 0);
      if (operation.x != null) wrap.x = Number(operation.x);
      if (operation.y != null) wrap.y = Number(operation.y);

      var label = figma.createText();
      label.fontName = labelFont;
      label.characters = String(operation.label || 'Label');
      label.fontSize = 12;
      var labelFill = toSolidPaint(operation.labelFill || { r: 100, g: 116, b: 139, a: 1 });
      if (labelFill) label.fills = [labelFill];
      wrap.appendChild(label);

      var field = figma.createFrame();
      field.name = 'Field';
      var fieldFill = toSolidPaint(operation.fieldFill || { r: 255, g: 255, b: 255, a: 1 });
      if (fieldFill) field.fills = [fieldFill];
      var border = toSolidPaint(operation.border || { r: 226, g: 232, b: 240, a: 1 });
      if (border) {
        field.strokes = [border];
        field.strokeWeight = 1;
      }
      field.cornerRadius = operation.radius != null ? Number(operation.radius) : 10;
      layoutHorizontal(field, 0, 14, 12);
      var placeholder = figma.createText();
      placeholder.fontName = fieldFont;
      placeholder.characters = String(operation.placeholder || '');
      placeholder.fontSize = 14;
      var phFill = toSolidPaint(operation.placeholderFill || { r: 148, g: 163, b: 184, a: 1 });
      if (phFill) placeholder.fills = [phFill];
      field.appendChild(placeholder);
      var w = Number(operation.width || 280);
      field.resize(w, 44);
      wrap.appendChild(field);
      wrap.resize(w, 68);
      return wrap;
    });
  });
}

function createButtonPrimitive(operation) {
  return loadFontByWeight(operation.fontWeight || 600).then(function (fontName) {
    var btn = figma.createFrame();
    btn.name = String(operation.name || 'Button');
    btn.layoutMode = 'HORIZONTAL';
    btn.primaryAxisSizingMode = 'AUTO';
    btn.counterAxisSizingMode = 'AUTO';
    btn.primaryAxisAlignItems = 'CENTER';
    btn.counterAxisAlignItems = 'CENTER';
    btn.paddingLeft = 20;
    btn.paddingRight = 20;
    btn.paddingTop = 12;
    btn.paddingBottom = 12;
    btn.itemSpacing = 8;
    btn.cornerRadius = operation.radius != null ? Number(operation.radius) : 12;
    btn.fills = [toSolidPaint(operation.fill || { r: 28, g: 28, b: 30, a: 1 }) || {
      type: 'SOLID',
      color: { r: 28 / 255, g: 28 / 255, b: 30 / 255 },
      opacity: 1,
      visible: true,
    }];

    var label = figma.createText();
    label.fontName = fontName;
    label.characters = String(operation.label || operation.text || 'Кнопка');
    label.fontSize = Number(operation.fontSize || 16);
    label.fills = [toSolidPaint(operation.stroke || { r: 255, g: 255, b: 255, a: 1 }) || {
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 },
      opacity: 1,
      visible: true,
    }];
    btn.appendChild(label);

    if (operation.width != null && operation.height != null) {
      btn.primaryAxisSizingMode = 'FIXED';
      btn.counterAxisSizingMode = 'FIXED';
      btn.resize(Number(operation.width), Number(operation.height));
    }
    if (operation.x != null) btn.x = Number(operation.x);
    if (operation.y != null) btn.y = Number(operation.y);
    return btn;
  });
}

function loadTextNodeFont(node) {
  if (!node || node.type !== 'TEXT') return Promise.resolve();
  var fontName = node.fontName;
  if (fontName === figma.mixed && node.characters && node.characters.length) {
    fontName = node.getRangeFontName(0, 1);
  }
  if (fontName === figma.mixed || !fontName) {
    fontName = { family: 'Inter', style: 'Regular' };
  }
  return figma.loadFontAsync(fontName);
}

function applyOperation(operation, ctx) {
  var op = String(operation.op || '');

  if (op === 'create_frame') {
    var frame = figma.createFrame();
    applyFrameStyle(frame, operation);
    appendToParent(frame, resolveParentNode(operation, ctx));
    if (operation.key && ctx && ctx.created) ctx.created[operation.key] = frame;
    return Promise.resolve({ ok: true });
  }

  if (op === 'create_rect') {
    var rect = figma.createRectangle();
    if (operation.name != null) rect.name = String(operation.name);
    if (operation.width != null && operation.height != null) rect.resize(Number(operation.width), Number(operation.height));
    if (operation.x != null) rect.x = Number(operation.x);
    if (operation.y != null) rect.y = Number(operation.y);
    if (operation.radius != null) rect.cornerRadius = Number(operation.radius);
    var rectFill = toSolidPaint(operation.fill || { r: 232, g: 230, b: 225, a: 1 });
    if (rectFill) rect.fills = [rectFill];
    appendToParent(rect, resolveParentNode(operation, ctx));
    if (operation.key && ctx && ctx.created) ctx.created[operation.key] = rect;
    return Promise.resolve({ ok: true });
  }

  if (op === 'create_text') {
    return createTextNode(operation).then(function (node) {
      appendToParent(node, resolveParentNode(operation, ctx));
      if (operation.key && ctx && ctx.created) ctx.created[operation.key] = node;
      return { ok: true };
    });
  }

  if (op === 'create_button') {
    return createButtonPrimitive(operation).then(function (node) {
      appendToParent(node, resolveParentNode(operation, ctx));
      if (operation.key && ctx && ctx.created) ctx.created[operation.key] = node;
      return { ok: true };
    });
  }

  if (op === 'create_input') {
    return createInputFromOperation(operation).then(function (node) {
      appendToParent(node, resolveParentNode(operation, ctx));
      if (operation.key && ctx && ctx.created) ctx.created[operation.key] = node;
      return { ok: true };
    });
  }

  if (op === 'set_image_fill') {
    var imgNode = operation.key && ctx && ctx.created ? ctx.created[operation.key] : null;
    if (!imgNode || !('fills' in imgNode)) return Promise.resolve({ ok: false, reason: 'image-target-not-found' });
    var bytesPromise;
    if (operation.imageBase64) {
      bytesPromise = Promise.resolve(decodeBase64ToBytes(String(operation.imageBase64)));
    } else if (operation.imageUrl) {
      bytesPromise = fetchImageBytes(String(operation.imageUrl));
    } else {
      return Promise.resolve({ ok: false, reason: 'no-image-data' });
    }
    return bytesPromise.then(function (bytes) {
      if (setImageFillOnNode(imgNode, bytes)) return { ok: true };
      return { ok: false, reason: 'fill-failed' };
    });
  }

  var targets = parseTargetNodes(operation, ctx);
  if (!targets.length) return Promise.resolve({ ok: false, reason: 'target-not-found' });
  var tasks = [];
  for (var i = 0; i < targets.length; i++) {
    (function (node) {
      if (op === 'rename') {
        node.name = String(operation.name || node.name || '');
        tasks.push(Promise.resolve());
      } else if (op === 'set_text') {
        if (node.type !== 'TEXT') return;
        tasks.push(loadTextNodeFont(node).then(function () {
          node.characters = String(operation.text || '');
        }));
      } else if (op === 'resize') {
        if ('resize' in node && operation.width != null && operation.height != null) {
          node.resize(Number(operation.width), Number(operation.height));
        }
        tasks.push(Promise.resolve());
      } else if (op === 'move') {
        if (operation.x != null) node.x = Number(operation.x);
        if (operation.y != null) node.y = Number(operation.y);
        tasks.push(Promise.resolve());
      } else if (op === 'set_fill_solid') {
        var fill = toSolidPaint(operation.fill);
        if (fill && 'fills' in node) node.fills = [fill];
        tasks.push(Promise.resolve());
      } else if (op === 'set_stroke_solid') {
        var stroke = toSolidPaint(operation.stroke || operation.fill);
        if (stroke && 'strokes' in node) node.strokes = [stroke];
        tasks.push(Promise.resolve());
      } else if (op === 'set_corner_radius') {
        if ('cornerRadius' in node && operation.radius != null) {
          node.cornerRadius = Number(operation.radius);
        }
        tasks.push(Promise.resolve());
      } else if (op === 'set_auto_layout') {
        if (node.type === 'FRAME' || node.type === 'COMPONENT') {
          var mode = String(operation.layoutMode || 'NONE').toUpperCase();
          if (mode === 'HORIZONTAL' || mode === 'VERTICAL' || mode === 'NONE') {
            node.layoutMode = mode;
          }
        }
        tasks.push(Promise.resolve());
      } else if (op === 'set_padding') {
        if (node.type === 'FRAME' || node.type === 'COMPONENT') {
          var all = operation.padding;
          if (all != null) {
            node.paddingLeft = Number(all);
            node.paddingRight = Number(all);
            node.paddingTop = Number(all);
            node.paddingBottom = Number(all);
          } else {
            if (operation.paddingLeft != null) node.paddingLeft = Number(operation.paddingLeft);
            if (operation.paddingRight != null) node.paddingRight = Number(operation.paddingRight);
            if (operation.paddingTop != null) node.paddingTop = Number(operation.paddingTop);
            if (operation.paddingBottom != null) node.paddingBottom = Number(operation.paddingBottom);
          }
        }
        tasks.push(Promise.resolve());
      } else if (op === 'set_spacing') {
        if ((node.type === 'FRAME' || node.type === 'COMPONENT') && operation.spacing != null) {
          node.itemSpacing = Number(operation.spacing);
        }
        tasks.push(Promise.resolve());
      } else if (op === 'set_visibility') {
        if (operation.visible != null) node.visible = !!operation.visible;
        tasks.push(Promise.resolve());
      } else if (op === 'set_layout_grids' || op === 'set_layoutGrids') {
        if (node.type === 'FRAME' || node.type === 'COMPONENT') {
          tasks.push(Promise.resolve().then(function () {
            applyLayoutGridsToFrame(node, operation.layoutGrids || []);
          }));
        } else {
          tasks.push(Promise.resolve());
        }
      }
    })(targets[i]);
  }
  return Promise.all(tasks).then(function () {
    return { ok: true };
  });
}

function applyDesignOps(payload, requestId) {
  var operations = payload && Array.isArray(payload.operations) ? payload.operations.slice(0, 220) : [];
  if (!operations.length) {
    sendTemplateResult(requestId, false, 'Пустой список операций');
    return Promise.resolve();
  }

  var applied = 0;
  var failed = 0;
  var errors = [];
  var ctx = { created: {} };
  var chain = Promise.resolve();
  operations.forEach(function (op, idx) {
    chain = chain.then(function () {
      return applyOperation(op, ctx).then(function () {
        applied++;
      }).catch(function (err) {
        failed++;
        errors.push({ index: idx, op: op && op.op, error: err && err.message ? err.message : String(err) });
      });
    });
  });

  return chain.then(function () {
    if (figma.currentPage.selection && figma.currentPage.selection.length) {
      figma.viewport.scrollAndZoomIntoView(figma.currentPage.selection);
    }
    figma.notify('AI-правки применены: ' + applied + ', ошибок: ' + failed);
    sendTemplateResult(requestId, true, '', { applied: applied, failed: failed, errors: errors });
  });
}
