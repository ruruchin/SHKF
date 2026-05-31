import { getCreateActionEvalScript, CREATE_ACTION_IDS } from './figma-create-script.js';

export function getActionEvalScript(action) {
  if (CREATE_ACTION_IDS.includes(action)) {
    const script = getCreateActionEvalScript(action);
    if (script) return script;
  }

  return `(async () => {
    if (typeof figma === 'undefined') throw new Error('Figma API недоступен. Запустите Figma через кнопку в приложении.');
    const action = ${JSON.stringify(action)};
    const selection = figma.currentPage.selection;
    if (selection.length === 0) { figma.notify('Выберите объект(ы)', { error: true }); return { ok: false }; }

    function getParentFrame(node) {
      let parent = node.parent;
      while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
        if (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE') return parent;
        parent = parent.parent;
      }
      return null;
    }
    function absoluteBox(node) {
      const t = node.absoluteTransform;
      const w = 'width' in node ? node.width : 0;
      const h = 'height' in node ? node.height : 0;
      return { x: t[0][2], y: t[1][2], width: w, height: h };
    }
    function centerInParent(nodes, axis) {
      for (const node of nodes) {
        const parent = getParentFrame(node);
        if (!parent) continue;
        const parentBox = absoluteBox(parent);
        const nodeBox = absoluteBox(node);
        let newX = node.x, newY = node.y;
        if (axis === 'both' || axis === 'x') newX = node.x + (parentBox.x + parentBox.width / 2 - (nodeBox.x + nodeBox.width / 2));
        if (axis === 'both' || axis === 'y') newY = node.y + (parentBox.y + parentBox.height / 2 - (nodeBox.y + nodeBox.height / 2));
        node.x = newX; node.y = newY;
      }
    }
    function fillParentFrame(nodes) {
      for (const node of nodes) {
        const parent = getParentFrame(node);
        if (!parent || !('resize' in node)) continue;
        node.x = 0; node.y = 0;
        node.resize(parent.width, parent.height);
      }
    }
    function matchParentSize(nodes) {
      for (const node of nodes) {
        const parent = getParentFrame(node);
        if (!parent || !('resize' in node)) continue;
        node.resize(parent.width, parent.height);
      }
    }
    function distribute(nodes, direction) {
      if (nodes.length < 2) { figma.notify('Выберите минимум 2 объекта', { error: true }); return; }
      const sorted = [...nodes].sort((a, b) => direction === 'horizontal' ? a.x - b.x : a.y - b.y);
      const first = sorted[0], last = sorted[sorted.length - 1];
      if (direction === 'horizontal') {
        const totalWidth = sorted.reduce((s, n) => s + ('width' in n ? n.width : 0), 0);
        const span = (last.x + last.width) - first.x;
        const gap = (span - totalWidth) / (sorted.length - 1);
        let cursor = first.x;
        for (const node of sorted) { node.x = cursor; cursor += node.width + gap; }
      } else {
        const totalHeight = sorted.reduce((s, n) => s + ('height' in n ? n.height : 0), 0);
        const span = (last.y + last.height) - first.y;
        const gap = (span - totalHeight) / (sorted.length - 1);
        let cursor = first.y;
        for (const node of sorted) { node.y = cursor; cursor += node.height + gap; }
      }
    }
    function swapFillStroke(nodes) {
      for (const node of nodes) {
        if (!('fills' in node) || !('strokes' in node)) continue;
        const fills = JSON.parse(JSON.stringify(node.fills));
        const strokes = JSON.parse(JSON.stringify(node.strokes));
        const hasStroke = strokes.length > 0 && strokes[0].type !== 'NONE';
        const hasFill = fills.length > 0 && fills[0].type !== 'NONE';
        if (hasStroke && hasFill) { node.fills = strokes; node.strokes = fills; }
        else if (hasFill) { node.strokes = fills; node.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }]; node.strokeWeight = node.strokeWeight || 1; }
        else if (hasStroke) { node.fills = strokes; node.strokes = []; }
      }
    }
    function toggleAutoLayout(nodes) {
      let changed = 0;
      for (const node of nodes) {
        if (node.type !== 'FRAME' && node.type !== 'COMPONENT') continue;
        if (node.layoutMode === 'NONE') {
          node.layoutMode = 'VERTICAL';
          node.primaryAxisSizingMode = 'AUTO'; node.counterAxisSizingMode = 'AUTO';
          node.paddingLeft = 16; node.paddingRight = 16; node.paddingTop = 16; node.paddingBottom = 16;
          node.itemSpacing = 8; changed++;
        } else { node.layoutMode = 'NONE'; changed++; }
      }
      if (!changed) figma.notify('Выберите Frame', { error: true });
    }
    function centerInViewport(nodes) {
      const center = figma.viewport.center;
      for (const node of nodes) {
        if (!('width' in node)) continue;
        const abs = absoluteBox(node);
        node.x += center.x - (abs.x + abs.width / 2);
        node.y += center.y - (abs.y + abs.height / 2);
      }
    }

    switch (action) {
      case 'centerInFrame': centerInParent(selection, 'both'); figma.notify('Центр в родителе'); break;
      case 'centerInFrameX': centerInParent(selection, 'x'); figma.notify('Центр по X'); break;
      case 'centerInFrameY': centerInParent(selection, 'y'); figma.notify('Центр по Y'); break;
      case 'fillParentFrame': fillParentFrame(selection); figma.notify('Заполнить фрейм'); break;
      case 'matchParentSize': matchParentSize(selection); figma.notify('Размер как у родителя'); break;
      case 'distributeHorizontal': distribute(selection, 'horizontal'); figma.notify('Распределено H'); break;
      case 'distributeVertical': distribute(selection, 'vertical'); figma.notify('Распределено V'); break;
      case 'swapFillStroke': swapFillStroke(selection); figma.notify('Fill ↔ Stroke'); break;
      case 'toggleAutoLayout': toggleAutoLayout(selection); break;
      case 'centerInViewport': centerInViewport(selection); figma.notify('Центр на экране'); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return { ok: true };
  })()`;
}

export const KEYBOARD_ACTIONS = {
  swapFillStroke: ['SHIFT', 'X'],
  toggleAutoLayout: ['SHIFT', 'A'],
};
