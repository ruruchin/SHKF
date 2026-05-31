import { clipboard } from 'electron';
import { getTemplateSvg, getTemplateName } from '../shared/template-svgs.js';

function writeSvgClipboard(svg, name) {
  const html = `<!DOCTYPE html><html><body><!--StartFragment-->${svg}<!--EndFragment--></body></html>`;
  clipboard.write({ text: svg, html });
  return { ok: true, name, mode: 'clipboard' };
}

export function copyTemplateToClipboard(templateId) {
  const svg = getTemplateSvg(templateId);
  if (!svg) throw new Error('Неизвестный шаблон: ' + templateId);
  return writeSvgClipboard(svg, getTemplateName(templateId));
}

export function copyUserTemplateToClipboard(userLibrary, templateId) {
  const item = userLibrary.getItem(templateId);
  if (!item) throw new Error('Компонент не найден');
  const svg = userLibrary.readSvg(templateId);
  if (!svg) throw new Error('SVG компонента отсутствует');
  return writeSvgClipboard(svg, item.name);
}
