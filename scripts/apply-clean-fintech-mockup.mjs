/**
 * Clean fintech iOS mockup → Figma via SHKF plugin bridge (parentName for cross-batch).
 */
import WebSocket from 'ws';
import { normalizeFigmaPlanOperations } from '../server/figma-design-agent.js';

const FRAME_W = 390;
const FRAME_H = 844;
const GAP_X = 48;
const ORIGIN_X = 2800;
const ORIGIN_Y = 120;
const PAD = 20;

const SCREENS = {
  onboarding: 'приложения · Онбординг',
  login: 'приложения · Вход',
  home: 'приложения · Главная',
  analytics: 'приложения · Аналитика',
};

const SCREEN_X = {
  [SCREENS.onboarding]: ORIGIN_X,
  [SCREENS.login]: ORIGIN_X + (FRAME_W + GAP_X),
  [SCREENS.home]: ORIGIN_X + 2 * (FRAME_W + GAP_X),
  [SCREENS.analytics]: ORIGIN_X + 3 * (FRAME_W + GAP_X),
};

function onScreen(screen, extra = {}) {
  return { parentName: screen, parentX: SCREEN_X[screen], ...extra };
}

const C = {
  bg: { r: 248, g: 250, b: 252, a: 1 },
  surface: { r: 255, g: 255, b: 255, a: 1 },
  accent: { r: 13, g: 148, b: 136, a: 1 },
  accentLight: { r: 204, g: 251, b: 241, a: 1 },
  text: { r: 15, g: 23, b: 42, a: 1 },
  muted: { r: 100, g: 116, b: 139, a: 1 },
  border: { r: 226, g: 232, b: 240, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
};

function shell(name, index) {
  return {
    op: 'create_frame',
    name,
    width: FRAME_W,
    height: FRAME_H,
    x: ORIGIN_X + index * (FRAME_W + GAP_X),
    y: ORIGIN_Y,
    fill: C.bg,
    layoutMode: 'VERTICAL',
    padding: 0,
    spacing: 0,
  };
}

function statusBar(screen, prefix) {
  const bar = `${prefix} / Status bar`;
  return [
    {
      op: 'create_frame',
      ...onScreen(screen),
      name: bar,
      x: 0,
      y: 0,
      width: FRAME_W,
      height: 54,
      fill: C.bg,
    },
    {
      op: 'create_text',
      parentName: bar,
      name: 'Time',
      text: '9:41',
      x: PAD,
      y: 16,
      fontSize: 15,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      parentName: bar,
      name: 'Status icons',
      text: '●●● ▮▮▮ ▮',
      x: FRAME_W - 88,
      y: 16,
      fontSize: 12,
      fontWeight: 400,
      fill: C.text,
    },
  ];
}

function homeIndicator(screen) {
  return {
    op: 'create_rect',
    ...onScreen(screen),
    name: 'Home indicator',
    x: (FRAME_W - 134) / 2,
    y: FRAME_H - 28,
    width: 134,
    height: 5,
    fill: C.text,
    radius: 3,
  };
}

function outlineTabBar(screen, prefix, activeIndex = 0) {
  const wrap = `${prefix} / Tab bar`;
  const labels = ['Главная', 'Аналитика', 'Карты', 'Профиль'];
  const tabW = FRAME_W - PAD * 2;
  const itemW = (tabW - 12) / 4;
  const ops = [
    {
      op: 'create_frame',
      ...onScreen(screen),
      name: wrap,
      x: PAD,
      y: FRAME_H - 96,
      width: tabW,
      height: 56,
      fill: C.surface,
      stroke: C.border,
      strokeWeight: 1,
      radius: 28,
      layoutMode: 'HORIZONTAL',
      padding: 6,
      spacing: 0,
    },
  ];
  labels.forEach((label, i) => {
    const tab = `${wrap} / ${label}`;
    const active = i === activeIndex;
    ops.push(
      {
        op: 'create_frame',
        parentName: wrap,
        name: tab,
        x: 6 + i * itemW,
        y: 6,
        width: itemW,
        height: 44,
        fill: active ? C.accentLight : C.surface,
        radius: 22,
      },
      {
        op: 'create_text',
        parentName: tab,
        name: 'Label',
        text: label,
        x: 8,
        y: 14,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        fill: active ? C.accent : C.muted,
      },
    );
  });
  return ops;
}

function buildOnboardingOps() {
  const s = SCREENS.onboarding;
  return [
    ...statusBar(s, 'Онбординг'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: 'Hero Illustration | imagePrompt: calm fintech dashboard abstract teal gradient waves minimal',
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 220,
      fill: C.accentLight,
      radius: 16,
    },
    {
      op: 'create_rect',
      parentName: 'Hero Illustration | imagePrompt: calm fintech dashboard abstract teal gradient waves minimal',
      name: 'Accent shape',
      x: 24,
      y: 40,
      width: 120,
      height: 140,
      fill: { r: 13, g: 148, b: 136, a: 0.15 },
      radius: 16,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Title',
      text: 'Финансы под контролем',
      x: PAD,
      y: 300,
      fontSize: 28,
      fontWeight: 600,
      fill: C.text,
      width: FRAME_W - PAD * 2,
      lineHeight: 34,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Subtitle',
      text: 'Приложения помогают отслеживать баланс, цели и расходы в одном месте.',
      x: PAD,
      y: 380,
      fontSize: 15,
      fontWeight: 400,
      fill: C.muted,
      width: FRAME_W - PAD * 2,
      lineHeight: 22,
    },
    {
      op: 'create_button',
      ...onScreen(s),
      name: 'Primary CTA',
      label: 'Начать',
      x: PAD,
      y: 480,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.accent,
      stroke: C.white,
      radius: 16,
      fontSize: 16,
      fontWeight: 600,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: 'Онбординг / Secondary CTA',
      x: PAD,
      y: 544,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.surface,
      stroke: C.accent,
      strokeWeight: 1,
      radius: 16,
    },
    {
      op: 'create_text',
      parentName: 'Онбординг / Secondary CTA',
      name: 'Label',
      text: 'Войти',
      x: (FRAME_W - PAD * 2 - 40) / 2,
      y: 16,
      fontSize: 16,
      fontWeight: 600,
      fill: C.accent,
    },
    homeIndicator(s),
  ];
}

function buildLoginOps() {
  const s = SCREENS.login;
  const header = 'Вход / Header row';
  return [
    ...statusBar(s, 'Вход'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: header,
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 40,
      fill: C.bg,
      layoutMode: 'HORIZONTAL',
      spacing: 12,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Back',
      text: '←',
      x: 0,
      y: 6,
      fontSize: 22,
      fontWeight: 400,
      fill: C.text,
    },
    {
      op: 'create_rect',
      parentName: header,
      name: 'Вход / App mark',
      x: 36,
      y: 4,
      width: 32,
      height: 32,
      fill: C.accent,
      radius: 8,
    },
    {
      op: 'create_text',
      parentName: 'Вход / App mark',
      name: 'A',
      text: 'А',
      x: 10,
      y: 6,
      fontSize: 16,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Brand',
      text: 'приложения',
      x: 76,
      y: 8,
      fontSize: 16,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Title',
      text: 'Вход',
      x: PAD,
      y: 128,
      fontSize: 28,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Subtitle',
      text: 'Введите данные аккаунта',
      x: PAD,
      y: 168,
      fontSize: 15,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_input',
      ...onScreen(s),
      name: 'Email',
      label: 'Электронная почта',
      placeholder: 'name@example.com',
      x: PAD,
      y: 210,
      width: FRAME_W - PAD * 2,
      radius: 12,
      fieldFill: C.surface,
      border: C.border,
    },
    {
      op: 'create_input',
      ...onScreen(s),
      name: 'Password',
      label: 'Пароль',
      placeholder: '••••••••',
      x: PAD,
      y: 290,
      width: FRAME_W - PAD * 2,
      radius: 12,
      fieldFill: C.surface,
      border: C.border,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Forgot',
      text: 'Забыли пароль?',
      x: PAD,
      y: 370,
      fontSize: 14,
      fontWeight: 500,
      fill: C.accent,
    },
    {
      op: 'create_button',
      ...onScreen(s),
      name: 'Login',
      label: 'Войти',
      x: PAD,
      y: 410,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.accent,
      stroke: C.white,
      radius: 16,
      fontSize: 16,
      fontWeight: 600,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Signup hint',
      text: 'Нет аккаунта? Создать',
      x: PAD,
      y: 480,
      fontSize: 14,
      fontWeight: 400,
      fill: C.muted,
      width: FRAME_W - PAD * 2,
    },
    homeIndicator(s),
  ];
}

function buildHomeOps() {
  const s = SCREENS.home;
  const header = 'Главная / Header';
  const hero = 'Главная / Hero balance card';
  const metrics = 'Главная / Metrics row';
  const metricW = (FRAME_W - PAD * 2 - 16) / 3;
  const ops = [
    ...statusBar(s, 'Главная'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: header,
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 48,
      fill: C.bg,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Greeting',
      text: 'Доброе утро',
      x: 0,
      y: 0,
      fontSize: 13,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'User name',
      text: 'Алексей',
      x: 0,
      y: 18,
      fontSize: 22,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_rect',
      parentName: header,
      name: 'Главная / Avatar',
      x: FRAME_W - PAD * 2 - 44,
      y: 0,
      width: 44,
      height: 44,
      fill: C.accentLight,
      radius: 12,
    },
    {
      op: 'create_text',
      parentName: 'Главная / Avatar',
      name: 'Initials',
      text: 'АК',
      x: 10,
      y: 12,
      fontSize: 14,
      fontWeight: 600,
      fill: C.accent,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: hero,
      x: PAD,
      y: 128,
      width: FRAME_W - PAD * 2,
      height: 148,
      fill: C.surface,
      stroke: C.border,
      strokeWeight: 1,
      radius: 16,
    },
    {
      op: 'create_text',
      parentName: hero,
      name: 'Label',
      text: 'Общий баланс',
      x: 16,
      y: 16,
      fontSize: 13,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_text',
      parentName: hero,
      name: 'Amount',
      text: '248 560 ₽',
      x: 16,
      y: 36,
      fontSize: 32,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      parentName: hero,
      name: 'Delta',
      text: '+4,2% за месяц',
      x: 16,
      y: 82,
      fontSize: 14,
      fontWeight: 500,
      fill: C.accent,
    },
    {
      op: 'create_button',
      parentName: hero,
      name: 'Top up',
      label: 'Пополнить',
      x: 16,
      y: 108,
      width: 120,
      height: 36,
      fill: C.accent,
      stroke: C.white,
      radius: 12,
      fontSize: 14,
      fontWeight: 600,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: metrics,
      x: PAD,
      y: 292,
      width: FRAME_W - PAD * 2,
      height: 88,
      fill: C.bg,
      layoutMode: 'HORIZONTAL',
      spacing: 8,
    },
  ];

  [
    { label: 'Доход', value: '+42 300 ₽' },
    { label: 'Расход', value: '−18 740 ₽' },
    { label: 'Цели', value: '3 из 5' },
  ].forEach((m, i) => {
    const card = `Главная / Metric ${m.label}`;
    ops.push(
      {
        op: 'create_frame',
        parentName: metrics,
        name: card,
        x: i * (metricW + 8),
        y: 0,
        width: metricW,
        height: 88,
        fill: C.surface,
        stroke: C.border,
        strokeWeight: 1,
        radius: 16,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Value',
        text: m.value,
        x: 12,
        y: 12,
        fontSize: 15,
        fontWeight: 600,
        fill: C.text,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Caption',
        text: m.label,
        x: 12,
        y: 36,
        fontSize: 12,
        fontWeight: 400,
        fill: C.muted,
      },
    );
  });

  ops.push({
    op: 'create_text',
    ...onScreen(s),
    name: 'Section title',
    text: 'Операции',
    x: PAD,
    y: 400,
    fontSize: 17,
    fontWeight: 600,
    fill: C.text,
  });

  [
    { icon: '↗', title: 'Перевод другу', sub: 'Сегодня, 09:14', amt: '−2 500 ₽' },
    { icon: '☕', title: 'Кафе', sub: 'Вчера, 18:40', amt: '−890 ₽' },
    { icon: '💳', title: 'Зарплата', sub: '28 мая', amt: '+85 000 ₽' },
    { icon: '📊', title: 'Инвестиции', sub: '27 мая', amt: '+12 400 ₽' },
  ].forEach((item, i) => {
    const row = `Главная / ${item.title}`;
    ops.push(
      {
        op: 'create_frame',
        ...onScreen(s),
        name: row,
        x: PAD,
        y: 432 + i * 72,
        width: FRAME_W - PAD * 2,
        height: 64,
        fill: C.surface,
        stroke: C.border,
        strokeWeight: 1,
        radius: 16,
      },
      {
        op: 'create_rect',
        parentName: row,
        name: `${row} / Icon`,
        x: 12,
        y: 12,
        width: 40,
        height: 40,
        fill: C.accentLight,
        radius: 12,
      },
      {
        op: 'create_text',
        parentName: `${row} / Icon`,
        name: 'Glyph',
        text: item.icon,
        x: 12,
        y: 10,
        fontSize: 16,
        fontWeight: 400,
        fill: C.accent,
      },
      {
        op: 'create_text',
        parentName: row,
        name: 'Title',
        text: item.title,
        x: 64,
        y: 14,
        fontSize: 15,
        fontWeight: 500,
        fill: C.text,
      },
      {
        op: 'create_text',
        parentName: row,
        name: 'Subtitle',
        text: item.sub,
        x: 64,
        y: 34,
        fontSize: 12,
        fontWeight: 400,
        fill: C.muted,
      },
      {
        op: 'create_text',
        parentName: row,
        name: 'Amount',
        text: item.amt,
        x: FRAME_W - PAD * 2 - 90,
        y: 22,
        fontSize: 14,
        fontWeight: 600,
        fill: item.amt.startsWith('+') ? C.accent : C.text,
      },
    );
  });

  ops.push(...outlineTabBar(s, 'Главная', 0), homeIndicator(s));
  return ops;
}

function buildAnalyticsOps() {
  const s = SCREENS.analytics;
  const pills = 'Аналитика / Period pills';
  const chart = 'Аналитика / Chart card';
  const ops = [
    ...statusBar(s, 'Аналитика'),
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Title',
      text: 'Аналитика',
      x: PAD,
      y: 72,
      fontSize: 28,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Subtitle',
      text: 'Динамика портфеля за период',
      x: PAD,
      y: 112,
      fontSize: 15,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: pills,
      x: PAD,
      y: 148,
      width: FRAME_W - PAD * 2,
      height: 36,
      fill: C.bg,
      layoutMode: 'HORIZONTAL',
      spacing: 8,
    },
  ];

  ['Нед', 'Мес', 'Год'].forEach((label, i) => {
    const active = i === 1;
    const pill = `${pills} / ${label}`;
    ops.push(
      {
        op: 'create_frame',
        parentName: pills,
        name: pill,
        x: i * 72,
        y: 0,
        width: 64,
        height: 32,
        fill: active ? C.accent : C.surface,
        stroke: active ? C.accent : C.border,
        strokeWeight: 1,
        radius: 16,
      },
      {
        op: 'create_text',
        parentName: pill,
        name: 'Label',
        text: label,
        x: 18,
        y: 8,
        fontSize: 13,
        fontWeight: 600,
        fill: active ? C.white : C.muted,
      },
    );
  });

  ops.push(
    {
      op: 'create_frame',
      ...onScreen(s),
      name: chart,
      x: PAD,
      y: 200,
      width: FRAME_W - PAD * 2,
      height: 200,
      fill: C.surface,
      stroke: C.border,
      strokeWeight: 1,
      radius: 16,
    },
    {
      op: 'create_text',
      parentName: chart,
      name: 'Chart title',
      text: 'Доходность',
      x: 16,
      y: 16,
      fontSize: 15,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      parentName: chart,
      name: 'Chart value',
      text: '+12,8%',
      x: 16,
      y: 36,
      fontSize: 24,
      fontWeight: 600,
      fill: C.accent,
    },
    {
      op: 'create_frame',
      parentName: chart,
      name: 'Chart area',
      x: 16,
      y: 72,
      width: FRAME_W - PAD * 2 - 32,
      height: 100,
      fill: C.bg,
      radius: 12,
    },
  );

  [28, 42, 36, 58, 48, 72, 64, 88, 76, 92].forEach((h, i) => {
    ops.push({
      op: 'create_rect',
      parentName: 'Аналитика / Chart area',
      name: `Bar ${i}`,
      x: 8 + i * 28,
      y: 100 - h,
      width: 18,
      height: h,
      fill: i === 9 ? C.accent : { r: 153, g: 246, b: 228, a: 1 },
      radius: 4,
    });
  });

  ops.push({
    op: 'create_text',
    ...onScreen(s),
    name: 'List title',
    text: 'Активы',
    x: PAD,
    y: 420,
    fontSize: 17,
    fontWeight: 600,
    fill: C.text,
  });

  [
    { name: 'Накопительный счёт', pct: '42%', val: '104 400 ₽' },
    { name: 'Облигации', pct: '28%', val: '69 600 ₽' },
    { name: 'Акции', pct: '30%', val: '74 560 ₽' },
  ].forEach((a, i) => {
    const card = `Аналитика / ${a.name}`;
    ops.push(
      {
        op: 'create_frame',
        ...onScreen(s),
        name: card,
        x: PAD,
        y: 452 + i * 76,
        width: FRAME_W - PAD * 2,
        height: 68,
        fill: C.surface,
        stroke: C.border,
        strokeWeight: 1,
        radius: 16,
      },
      {
        op: 'create_rect',
        parentName: card,
        name: `${card} / Icon`,
        x: 16,
        y: 16,
        width: 36,
        height: 36,
        fill: C.accentLight,
        radius: 10,
      },
      {
        op: 'create_text',
        parentName: `${card} / Icon`,
        name: 'Glyph',
        text: '◆',
        x: 12,
        y: 10,
        fontSize: 14,
        fontWeight: 400,
        fill: C.accent,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Name',
        text: a.name,
        x: 64,
        y: 16,
        fontSize: 15,
        fontWeight: 500,
        fill: C.text,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Percent',
        text: a.pct,
        x: 64,
        y: 38,
        fontSize: 12,
        fontWeight: 400,
        fill: C.muted,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Value',
        text: a.val,
        x: FRAME_W - PAD * 2 - 100,
        y: 24,
        fontSize: 14,
        fontWeight: 600,
        fill: C.text,
      },
    );
  });

  ops.push(...outlineTabBar(s, 'Аналитика', 1), homeIndicator(s));
  return ops;
}

function remoteApply(port, operations) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const requestId = `fintech-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Таймаут remote-apply-design-ops (120s)'));
    }, 125000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'remote-apply-design-ops',
          requestId,
          payload: { operations },
        }),
      );
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'remote-apply-design-ops-result' && msg.requestId === requestId) {
          clearTimeout(timer);
          ws.close();
          if (msg.ok) resolve(msg);
          else reject(new Error(msg.error || 'Ошибка Figma plugin'));
        }
      } catch {
        /* ignore */
      }
    });
    ws.on('error', reject);
  });
}

async function findBridgePort() {
  for (let port = 3847; port < 3857; port++) {
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        const t = setTimeout(() => {
          ws.close();
          reject(new Error('timeout'));
        }, 1200);
        ws.on('open', () => {
          clearTimeout(t);
          ws.close();
          resolve(port);
        });
        ws.on('error', reject);
      });
      return port;
    } catch {
      /* next */
    }
  }
  return null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const port = await findBridgePort();
  if (!port) throw new Error('SHKF Bridge не слушает порты 3847–3856');

  const shells = normalizeFigmaPlanOperations([
    shell(SCREENS.onboarding, 0),
    shell(SCREENS.login, 1),
    shell(SCREENS.home, 2),
    shell(SCREENS.analytics, 3),
  ]);

  const screenOps = [
    normalizeFigmaPlanOperations(buildOnboardingOps()),
    normalizeFigmaPlanOperations(buildLoginOps()),
    normalizeFigmaPlanOperations(buildHomeOps()),
    normalizeFigmaPlanOperations(buildAnalyticsOps()),
  ];

  console.log('Creating screen shells...');
  await remoteApply(port, shells);

  const BATCH = 4;
  const results = [];
  for (const [idx, ops] of screenOps.entries()) {
    const parts = chunk(ops, BATCH);
    console.log(`Screen ${idx + 1}: ${ops.length} ops in ${parts.length} batches`);
    for (const [b, batch] of parts.entries()) {
      const msg = await remoteApply(port, batch);
      results.push(msg.data);
      console.log(`  batch ${b + 1}: applied ${msg.data?.applied}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  console.log(
    JSON.stringify(
      {
        page: 'лого',
        frames: [
          { name: SCREENS.onboarding, x: ORIGIN_X, y: ORIGIN_Y },
          { name: SCREENS.login, x: ORIGIN_X + FRAME_W + GAP_X, y: ORIGIN_Y },
          { name: SCREENS.home, x: ORIGIN_X + 2 * (FRAME_W + GAP_X), y: ORIGIN_Y },
          { name: SCREENS.analytics, x: ORIGIN_X + 3 * (FRAME_W + GAP_X), y: ORIGIN_Y },
        ],
        gap: GAP_X,
        totalApplied: results.reduce((s, r) => s + (r?.applied || 0), 0),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
