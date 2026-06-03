/**
 * Детерминированный многостраничный макет в Figma (не React-код).
 * Страницы и блоки — из site-builder-blueprint, операции — для Figma plugin.
 */

import { inferBlueprintFromMessage } from '../shared/site-builder-blueprint.js';

const FRAME_W = 390;
const FRAME_H = 844;
const GAP_X = 64;
const ORIGIN_X = 120;
const ORIGIN_Y = 120;
const PAD = 24;

function inferStyleFromRefs(refs, message = '') {
  const tags = new Set();
  for (const ref of refs || []) {
    for (const tag of (ref.tags || [])) tags.add(String(tag).toLowerCase());
  }
  const text = String(message || '').toLowerCase();
  const fintech = tags.has('fintech') || tags.has('dashboard') || tags.has('portfolio')
    || /инвест|fintech|portfolio|брокер/.test(text);
  if (fintech || tags.size === 0) {
    return {
      bg: { r: 248, g: 250, b: 252, a: 1 },
      surface: { r: 255, g: 255, b: 255, a: 1 },
      accent: { r: 15, g: 118, b: 110, a: 1 },
      title: { r: 15, g: 23, b: 42, a: 1 },
      body: { r: 71, g: 85, b: 105, a: 1 },
      muted: { r: 148, g: 163, b: 184, a: 1 },
      border: { r: 226, g: 232, b: 240, a: 1 },
    };
  }
  return {
    bg: { r: 255, g: 252, b: 247, a: 1 },
    surface: { r: 255, g: 255, b: 255, a: 1 },
    accent: { r: 110, g: 86, b: 207, a: 1 },
    title: { r: 32, g: 26, b: 22, a: 1 },
    body: { r: 90, g: 84, b: 80, a: 1 },
    muted: { r: 140, g: 130, b: 120, a: 1 },
    border: { r: 230, g: 225, b: 220, a: 1 },
  };
}

function t(text, max = 80) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function sectionOps(section, ctx) {
  const { prefix, parentKey, style } = ctx;
  let y = ctx.y;
  const ops = [];
  const bump = (h) => { y += h; };

  const frame = (key, name, h, fill = style.surface) => {
    ops.push({
      op: 'create_frame',
      key: `${prefix}${key}`,
      parentKey,
      name,
      x: PAD,
      y,
      width: FRAME_W - PAD * 2,
      height: h,
      fill,
    });
    return `${prefix}${key}`;
  };

  const text = (key, parent, name, content, fontSize, fontWeight, fill, ty) => {
    ops.push({
      op: 'create_text',
      key: `${prefix}${key}`,
      parentKey: parent,
      name,
      text: t(content),
      x: PAD + 12,
      y: ty,
      fontSize,
      fontWeight,
      fill,
    });
  };

  const button = (key, parent, label, ty) => {
    ops.push({
      op: 'create_button',
      key: `${prefix}${key}`,
      parentKey: parent,
      name: label,
      label: t(label, 24),
      x: PAD + 12,
      y: ty,
      width: FRAME_W - PAD * 2 - 24,
      height: 48,
      radius: 12,
      fontSize: 16,
      fontWeight: 600,
      fill: style.accent,
    });
  };

  const rect = (key, parent, name, h, fill, ty) => {
    ops.push({
      op: 'create_rect',
      key: `${prefix}${key}`,
      parentKey: parent,
      name,
      x: PAD + 12,
      y: ty,
      width: FRAME_W - PAD * 2 - 24,
      height: h,
      fill,
      radius: 10,
    });
  };

  switch (section.type) {
    case 'hero': {
      const h = 280;
      const fk = frame('hero', 'Hero', h, style.surface);
      text('heroT', fk, 'Title', section.title || 'Заголовок', 28, 700, style.title, 20);
      text('heroB', fk, 'Body', section.subtitle || '', 15, 400, style.body, 72);
      button('heroCta', fk, section.primaryCta || 'Начать', 130);
      bump(h + 16);
      break;
    }
    case 'split-hero': {
      const h = 200;
      const fk = frame('split', 'Split Hero', h, style.surface);
      text('spT', fk, 'Title', section.title, 24, 700, style.title, 20);
      text('spB', fk, 'Body', section.subtitle, 14, 400, style.body, 56);
      button('spCta', fk, section.primaryCta || 'Далее', 100);
      bump(h + 16);
      break;
    }
    case 'auth-panel': {
      const h = 340;
      const fk = frame('auth', section.mode === 'register' ? 'Register' : 'Login', h, style.surface);
      text('auT', fk, 'Title', section.title || 'Вход', 22, 700, style.title, 20);
      text('auS', fk, 'Subtitle', section.subtitle || '', 13, 400, style.body, 52);
      rect('auE', fk, 'Email field', 44, style.bg, 88);
      text('auEl', fk, 'Email label', 'Email', 12, 500, style.muted, 92);
      rect('auP', fk, 'Password field', 44, style.bg, 148);
      text('auPl', fk, 'Password label', 'Пароль', 12, 500, style.muted, 152);
      if (section.mode === 'register') {
        rect('auN', fk, 'Name field', 44, style.bg, 208);
        text('auNl', fk, 'Name label', 'Имя', 12, 500, style.muted, 212);
        button('auBtn', fk, 'Создать аккаунт', 268);
      } else {
        button('auBtn', fk, 'Войти', 208);
      }
      bump(h + 16);
      break;
    }
    case 'stat-row': {
      const h = 100;
      const fk = frame('stats', 'Stats', h, style.surface);
      const stats = section.stats || [];
      stats.slice(0, 3).forEach((stat, i) => {
        const colW = Math.floor((FRAME_W - PAD * 2 - 24) / 3);
        ops.push({
          op: 'create_frame',
          key: `${prefix}st${i}`,
          parentKey: fk,
          name: `Stat ${i + 1}`,
          x: PAD + 12 + i * (colW + 6),
          y: 16,
          width: colW,
          height: 68,
          fill: style.bg,
        });
        ops.push({
          op: 'create_text',
          key: `${prefix}stv${i}`,
          parentKey: `${prefix}st${i}`,
          name: 'Value',
          text: t(stat.value, 12),
          x: 8,
          y: 12,
          fontSize: 18,
          fontWeight: 700,
          fill: style.title,
        });
        ops.push({
          op: 'create_text',
          key: `${prefix}stl${i}`,
          parentKey: `${prefix}st${i}`,
          name: 'Label',
          text: t(stat.label, 16),
          x: 8,
          y: 38,
          fontSize: 11,
          fontWeight: 400,
          fill: style.body,
        });
      });
      bump(h + 16);
      break;
    }
    case 'card-grid': {
      const items = section.items || [];
      const h = 56 + items.length * 88;
      const fk = frame('cards', 'Cards', h, style.surface);
      if (section.title) {
        text('cgT', fk, 'Section title', section.title, 18, 700, style.title, 16);
      }
      items.slice(0, 4).forEach((item, i) => {
        const cardY = (section.title ? 48 : 12) + i * 88;
        ops.push({
          op: 'create_frame',
          key: `${prefix}cd${i}`,
          parentKey: fk,
          name: `Card ${i + 1}`,
          x: PAD + 12,
          y: cardY,
          width: FRAME_W - PAD * 2 - 24,
          height: 76,
          fill: style.bg,
        });
        ops.push({
          op: 'create_text',
          key: `${prefix}cdt${i}`,
          parentKey: `${prefix}cd${i}`,
          name: 'Card title',
          text: t(item.title, 28),
          x: 12,
          y: 12,
          fontSize: 15,
          fontWeight: 600,
          fill: style.title,
        });
        ops.push({
          op: 'create_text',
          key: `${prefix}cdb${i}`,
          parentKey: `${prefix}cd${i}`,
          name: 'Card body',
          text: t(item.text, 48),
          x: 12,
          y: 36,
          fontSize: 13,
          fontWeight: 400,
          fill: style.body,
        });
      });
      bump(h + 16);
      break;
    }
    case 'chart-panel': {
      const h = 220;
      const fk = frame('chart', 'Chart', h, style.surface);
      text('chT', fk, 'Title', section.title || 'График', 17, 700, style.title, 16);
      rect('chArea', fk, 'Chart area', 140, style.bg, 48);
      [40, 65, 50, 80, 70, 95, 85].forEach((pct, i) => {
        ops.push({
          op: 'create_rect',
          key: `${prefix}bar${i}`,
          parentKey: `${prefix}chArea`,
          name: `Bar ${i}`,
          x: 16 + i * 42,
          y: 140 - pct,
          width: 28,
          height: pct,
          fill: style.accent,
          radius: 4,
        });
      });
      bump(h + 16);
      break;
    }
    case 'data-table': {
      const rows = section.rows || [];
      const h = 72 + Math.min(rows.length, 4) * 36;
      const fk = frame('table', 'Table', h, style.surface);
      text('tbT', fk, 'Title', section.title || 'Таблица', 17, 700, style.title, 12);
      rect('tbHead', fk, 'Header', 32, style.bg, 44);
      const cols = (section.columns || []).join('   ');
      text('tbH', fk, 'Header text', cols, 11, 600, style.muted, 52);
      rows.slice(0, 4).forEach((row, i) => {
        rect(`tbR${i}`, fk, `Row ${i}`, 30, i % 2 ? style.surface : style.bg, 80 + i * 34);
        text(`tbRt${i}`, fk, `Row ${i} text`, row.join('   '), 11, 400, style.body, 86 + i * 34);
      });
      bump(h + 16);
      break;
    }
    case 'profile-header': {
      const h = 140;
      const fk = frame('profile', 'Profile Header', h, style.surface);
      ops.push({
        op: 'create_rect',
        key: `${prefix}av`,
        parentKey: fk,
        name: 'Avatar',
        x: PAD + 12,
        y: 20,
        width: 56,
        height: 56,
        fill: style.accent,
        radius: 28,
      });
      text('pfN', fk, 'Name', section.name || 'Пользователь', 20, 700, style.title, 24);
      text('pfR', fk, 'Role', section.role || '', 13, 500, style.body, 52);
      text('pfE', fk, 'Email', section.email || '', 12, 400, style.muted, 76);
      bump(h + 16);
      break;
    }
    case 'settings-form': {
      const fields = section.fields || [];
      const h = 48 + fields.length * 52;
      const fk = frame('settings', section.title || 'Settings', h, style.surface);
      text('sfT', fk, 'Title', section.title || 'Настройки', 17, 700, style.title, 12);
      fields.slice(0, 5).forEach((field, i) => {
        rect(`sf${i}`, fk, `Field ${i}`, 40, style.bg, 44 + i * 52);
        text(`sfl${i}`, fk, `Label ${i}`, field, 12, 500, style.muted, 48 + i * 52);
      });
      bump(h + 16);
      break;
    }
    case 'onboarding-steps': {
      const steps = section.steps || [];
      const h = 72;
      const fk = frame('steps', 'Onboarding', h, style.surface);
      steps.slice(0, 4).forEach((step, i) => {
        ops.push({
          op: 'create_rect',
          key: `${prefix}stp${i}`,
          parentKey: fk,
          name: `Step ${i + 1}`,
          x: PAD + 12 + i * 88,
          y: 20,
          width: 80,
          height: 32,
          fill: i === (section.active || 0) ? style.accent : style.bg,
          radius: 16,
        });
        ops.push({
          op: 'create_text',
          key: `${prefix}stpt${i}`,
          parentKey: `${prefix}stp${i}`,
          name: 'Step label',
          text: t(step, 10),
          x: 10,
          y: 8,
          fontSize: 11,
          fontWeight: 600,
          fill: i === (section.active || 0) ? { r: 255, g: 255, b: 255, a: 1 } : style.body,
        });
      });
      bump(h + 16);
      break;
    }
    case 'cta-band': {
      const h = 160;
      const fk = frame('cta', 'CTA', h, style.accent);
      text('ctaT', fk, 'Title', section.title, 20, 700, { r: 255, g: 255, b: 255, a: 1 }, 24);
      text('ctaB', fk, 'Body', section.text, 13, 400, { r: 255, g: 255, b: 255, a: 0.9 }, 56);
      ops.push({
        op: 'create_button',
        key: `${prefix}ctaBtn`,
        parentKey: fk,
        name: 'CTA',
        label: t(section.cta || 'Продолжить', 20),
        x: PAD + 12,
        y: 100,
        width: 160,
        height: 44,
        radius: 12,
        fontSize: 14,
        fontWeight: 600,
        fill: { r: 255, g: 255, b: 255, a: 1 },
      });
      bump(h + 16);
      break;
    }
    case 'logo-strip': {
      const h = 56;
      const fk = frame('logos', 'Logos', h, style.surface);
      text('lg', fk, 'Logos', (section.logos || []).join(' · '), 12, 500, style.muted, 20);
      bump(h + 16);
      break;
    }
    default: {
      const h = 80;
      const fk = frame('block', section.type || 'Block', h, style.surface);
      text('defT', fk, 'Title', section.title || section.type, 16, 600, style.title, 20);
      bump(h + 16);
    }
  }

  ctx.y = y;
  return ops;
}

function buildPageOps(page, pageIndex, style) {
  const prefix = `p${pageIndex}_`;
  const pageKey = `page${pageIndex}`;
  const ops = [];
  const x = ORIGIN_X + pageIndex * (FRAME_W + GAP_X);

  ops.push({
    op: 'create_frame',
    key: pageKey,
    name: `${page.name} (${page.route})`,
    width: FRAME_W,
    height: FRAME_H,
    x,
    y: ORIGIN_Y,
    fill: style.bg,
  });

  ops.push({
    op: 'create_frame',
    key: `${prefix}status`,
    parentKey: pageKey,
    name: 'Status bar',
    x: 0,
    y: 0,
    width: FRAME_W,
    height: 44,
    fill: style.surface,
  });

  ops.push({
    op: 'create_text',
    key: `${prefix}statusT`,
    parentKey: `${prefix}status`,
    name: 'Screen title',
    text: t(page.name, 24),
    x: PAD,
    y: 12,
    fontSize: 15,
    fontWeight: 600,
    fill: style.title,
  });

  const ctx = {
    prefix,
    parentKey: pageKey,
    style,
    y: 52,
  };

  for (const section of page.sections || []) {
    ops.push(...sectionOps(section, ctx));
    if (ctx.y > FRAME_H - 40) break;
  }

  return ops;
}

export function shouldBuildFigmaAppPlan(message) {
  const text = String(message || '').trim();
  if (/(react|vite|npm|код|code|tsx|jsx|верстк.*код)/i.test(text)) return false;
  if (/(макет|figma|фигм|прототип|экран|screen|ui\s*kit)/i.test(text)) return true;
  if (/(приложени[ея]|onboarding|login|register|регистрац|профил|dashboard|инвест|fintech|многостранич|сайт|app)/i.test(text)) return true;
  return false;
}

export function buildDeterministicAppPlan({ message, refs = [], blueprint: rawBlueprint } = {}) {
  const blueprint = rawBlueprint || inferBlueprintFromMessage(message, refs);
  const style = inferStyleFromRefs(refs, message);
  const pages = blueprint.pages || [];
  const ops = [];

  ops.push({
    op: 'create_frame',
    key: 'prototypeRoot',
    name: `${blueprint.productName || 'App'} — Prototype`,
    width: pages.length * (FRAME_W + GAP_X) + 80,
    height: FRAME_H + 160,
    x: ORIGIN_X - 40,
    y: ORIGIN_Y - 40,
    fill: { r: 241, g: 245, b: 249, a: 1 },
  });

  pages.forEach((page, idx) => {
    ops.push(...buildPageOps(page, idx, style));
  });

  const sectionCount = pages.reduce((n, p) => n + (p.sections?.length || 0), 0);

  return {
    summary: `Макет Figma: ${blueprint.productName} — ${pages.length} экранов, ${sectionCount} UI-блоков (Mobbin → Figma)`,
    assumptions: [
      `Формат: мобильные фреймы ${FRAME_W}×${FRAME_H}px, экраны в ряд.`,
      'Каждый экран: status bar + секции (hero, формы, таблицы, графики, карточки).',
      'Стиль палитры по тегам Mobbin / fintech.',
      'Нажмите «Применить в Figma» — фреймы появятся на текущей странице файла.',
    ],
    operations: ops,
    pages: pages.map((p) => ({
      route: p.route,
      name: p.name,
      purpose: (p.sections || []).map((s) => s.type).join(', '),
    })),
  };
}
