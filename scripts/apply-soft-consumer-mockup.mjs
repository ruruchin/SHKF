/**
 * Soft consumer iOS mockup → Figma via SHKF plugin bridge.
 * Style: pastel, friendly forms, illustrative hero, chip filters, vertical feed.
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
  feed: 'приложения · Подборка',
};

const SCREEN_X = {
  [SCREENS.onboarding]: ORIGIN_X,
  [SCREENS.login]: ORIGIN_X + (FRAME_W + GAP_X),
  [SCREENS.home]: ORIGIN_X + 2 * (FRAME_W + GAP_X),
  [SCREENS.feed]: ORIGIN_X + 3 * (FRAME_W + GAP_X),
};

function onScreen(screen, extra = {}) {
  return { parentName: screen, parentX: SCREEN_X[screen], ...extra };
}

const C = {
  bg: { r: 255, g: 247, b: 237, a: 1 },
  surface: { r: 255, g: 255, b: 255, a: 1 },
  accent: { r: 249, g: 115, b: 22, a: 1 },
  accentSoft: { r: 255, g: 237, b: 213, a: 1 },
  text: { r: 41, g: 37, b: 36, a: 1 },
  muted: { r: 120, g: 113, b: 108, a: 1 },
  border: { r: 231, g: 229, b: 228, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  pastelPink: { r: 252, g: 231, b: 243, a: 1 },
  pastelPurple: { r: 237, g: 233, b: 254, a: 1 },
  pastelGreen: { r: 220, g: 252, b: 231, a: 1 },
  pastelBlue: { r: 219, g: 234, b: 254, a: 1 },
  pastelYellow: { r: 254, g: 249, b: 195, a: 1 },
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

function softTabBar(screen, prefix, activeIndex = 0) {
  const wrap = `${prefix} / Tab bar`;
  const labels = ['Главная', 'Подборка', 'Избранное', 'Профиль'];
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
        fill: active ? C.accentSoft : C.surface,
        radius: 22,
      },
      {
        op: 'create_text',
        parentName: tab,
        name: 'Label',
        text: label,
        x: 6,
        y: 14,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        fill: active ? C.accent : C.muted,
      },
    );
  });
  return ops;
}

function chipRow(screen, prefix, chips, activeIndex = 0) {
  const wrap = `${prefix} / Chip filters`;
  const ops = [
    {
      op: 'create_frame',
      ...onScreen(screen),
      name: wrap,
      x: PAD,
      y: 0,
      width: FRAME_W - PAD * 2,
      height: 40,
      fill: C.bg,
      layoutMode: 'HORIZONTAL',
      spacing: 8,
    },
  ];
  chips.forEach((label, i) => {
    const chip = `${wrap} / ${label}`;
    const active = i === activeIndex;
    ops.push(
      {
        op: 'create_frame',
        parentName: wrap,
        name: chip,
        x: i * 88,
        y: 0,
        width: 80,
        height: 36,
        fill: active ? C.accent : C.surface,
        stroke: active ? C.accent : C.border,
        strokeWeight: 1,
        radius: 20,
      },
      {
        op: 'create_text',
        parentName: chip,
        name: 'Label',
        text: label,
        x: 14,
        y: 9,
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        fill: active ? C.white : C.muted,
      },
    );
  });
  return ops;
}

function buildOnboardingOps() {
  const s = SCREENS.onboarding;
  const hero =
    'Hero Illustration | imagePrompt: soft pastel mobile app onboarding illustration friendly rounded shapes warm orange peach tones minimal';
  return [
    ...statusBar(s, 'Онбординг'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: hero,
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 240,
      fill: C.accentSoft,
      radius: 24,
    },
    {
      op: 'create_frame',
      parentName: hero,
      name: 'Pastel accent block',
      x: 24,
      y: 32,
      width: 140,
      height: 176,
      fill: C.pastelYellow,
      radius: 20,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Title',
      text: 'Добро пожаловать в приложения',
      x: PAD,
      y: 324,
      fontSize: 24,
      fontWeight: 600,
      fill: C.text,
      width: FRAME_W - PAD * 2,
      lineHeight: 30,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Subtitle',
      text: 'Лёгкий способ находить идеи, сохранять подборки и возвращаться к важному без лишнего шума.',
      x: PAD,
      y: 400,
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
      y: 500,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.accent,
      stroke: C.white,
      radius: 24,
      fontSize: 16,
      fontWeight: 600,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: 'Онбординг / Secondary CTA',
      x: PAD,
      y: 564,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.surface,
      stroke: C.accent,
      strokeWeight: 1,
      radius: 24,
    },
    {
      op: 'create_text',
      parentName: 'Онбординг / Secondary CTA',
      name: 'Label',
      text: 'Уже есть аккаунт',
      x: (FRAME_W - PAD * 2 - 140) / 2,
      y: 16,
      fontSize: 15,
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
      y: 4,
      fontSize: 22,
      fontWeight: 400,
      fill: C.text,
    },
    {
      op: 'create_frame',
      parentName: header,
      name: 'Вход / App mark',
      x: 36,
      y: 0,
      width: 36,
      height: 36,
      fill: C.accentSoft,
      radius: 12,
    },
    {
      op: 'create_text',
      parentName: 'Вход / App mark',
      name: 'A',
      text: 'А',
      x: 11,
      y: 8,
      fontSize: 16,
      fontWeight: 700,
      fill: C.accent,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Brand',
      text: 'приложения',
      x: 80,
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
      fontSize: 24,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Subtitle',
      text: 'Введите данные, чтобы продолжить',
      x: PAD,
      y: 164,
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
      radius: 20,
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
      y: 300,
      width: FRAME_W - PAD * 2,
      radius: 20,
      fieldFill: C.surface,
      border: C.border,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Forgot',
      text: 'Забыли пароль?',
      x: PAD,
      y: 388,
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
      y: 430,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.accent,
      stroke: C.white,
      radius: 24,
      fontSize: 16,
      fontWeight: 600,
    },
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Signup hint',
      text: 'Нет аккаунта? Создать',
      x: PAD,
      y: 500,
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
  const hero = 'Главная / Hero card';
  const feedWrap = 'Главная / Feed';
  const feedItems = [
    { title: 'Утренняя подборка', sub: '5 идей на сегодня', fill: C.pastelPink },
    { title: 'Спокойные цвета', sub: 'Пастель и мягкие формы', fill: C.pastelPurple },
    { title: 'Новые карточки', sub: 'Обновлено 2 часа назад', fill: C.pastelGreen },
  ];

  const ops = [
    ...statusBar(s, 'Главная'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: header,
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 52,
      fill: C.bg,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Greeting',
      text: 'Привет!',
      x: 0,
      y: 0,
      fontSize: 14,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'User name',
      text: 'Ваша лента',
      x: 0,
      y: 20,
      fontSize: 24,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_frame',
      parentName: header,
      name: 'Главная / Avatar',
      x: FRAME_W - PAD * 2 - 44,
      y: 4,
      width: 44,
      height: 44,
      fill: C.accentSoft,
      radius: 22,
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
      y: 132,
      width: FRAME_W - PAD * 2,
      height: 160,
      fill: C.surface,
      stroke: C.border,
      strokeWeight: 1,
      radius: 24,
    },
    {
      op: 'create_frame',
      parentName: hero,
      name: 'Hero thumb | imagePrompt: soft pastel abstract sun and clouds warm friendly illustration',
      x: 16,
      y: 16,
      width: 96,
      height: 96,
      fill: C.pastelYellow,
      radius: 20,
    },
    {
      op: 'create_text',
      parentName: hero,
      name: 'Hero title',
      text: 'Соберите свой день',
      x: 124,
      y: 28,
      fontSize: 18,
      fontWeight: 600,
      fill: C.text,
      width: 180,
      lineHeight: 24,
    },
    {
      op: 'create_text',
      parentName: hero,
      name: 'Hero subtitle',
      text: 'Подборки, заметки и напоминания в одном месте',
      x: 124,
      y: 72,
      fontSize: 14,
      fontWeight: 400,
      fill: C.muted,
      width: 190,
      lineHeight: 20,
    },
    {
      op: 'create_button',
      parentName: hero,
      name: 'Hero CTA',
      label: 'Открыть',
      x: 124,
      y: 112,
      width: 110,
      height: 36,
      fill: C.accent,
      stroke: C.white,
      radius: 20,
      fontSize: 14,
      fontWeight: 600,
    },
    ...chipRow(s, 'Главная', ['Все', 'Новое', 'Избранное', 'Идеи'], 0).map((op) => {
      if (op.name === 'Главная / Chip filters') return { ...op, y: 312 };
      return op;
    }),
    {
      op: 'create_text',
      ...onScreen(s),
      name: 'Feed heading',
      text: 'Рекомендации',
      x: PAD,
      y: 368,
      fontSize: 18,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: feedWrap,
      x: PAD,
      y: 404,
      width: FRAME_W - PAD * 2,
      height: 300,
      fill: C.bg,
      layoutMode: 'VERTICAL',
      spacing: 12,
    },
  ];

  feedItems.forEach((item, i) => {
    const card = `${feedWrap} / Card ${i + 1}`;
    ops.push(
      {
        op: 'create_frame',
        parentName: feedWrap,
        name: card,
        x: 0,
        y: i * 92,
        width: FRAME_W - PAD * 2,
        height: 88,
        fill: C.surface,
        stroke: C.border,
        strokeWeight: 1,
        radius: 20,
      },
      {
        op: 'create_frame',
        parentName: card,
        name: `${card} / Thumb | imagePrompt: soft pastel card thumbnail abstract minimal`,
        x: 12,
        y: 12,
        width: 64,
        height: 64,
        fill: item.fill,
        radius: 16,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Title',
        text: item.title,
        x: 88,
        y: 20,
        fontSize: 15,
        fontWeight: 600,
        fill: C.text,
        width: 200,
      },
      {
        op: 'create_text',
        parentName: card,
        name: 'Subtitle',
        text: item.sub,
        x: 88,
        y: 46,
        fontSize: 14,
        fontWeight: 400,
        fill: C.muted,
        width: 200,
      },
    );
  });

  ops.push(...softTabBar(s, 'Главная', 0), homeIndicator(s));
  return ops;
}

function buildFeedOps() {
  const s = SCREENS.feed;
  const header = 'Подборка / Header';
  const grid = 'Подборка / Content grid';
  const tiles = [
    { label: 'Пастель', fill: C.pastelPink },
    { label: 'Тёплый', fill: C.pastelYellow },
    { label: 'Свежий', fill: C.pastelGreen },
    { label: 'Спокойный', fill: C.pastelBlue },
    { label: 'Мягкий', fill: C.pastelPurple },
    { label: 'Светлый', fill: C.accentSoft },
  ];
  const tileW = (FRAME_W - PAD * 2 - 24) / 3;

  const ops = [
    ...statusBar(s, 'Подборка'),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: header,
      x: PAD,
      y: 64,
      width: FRAME_W - PAD * 2,
      height: 44,
      fill: C.bg,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Back',
      text: '←',
      x: 0,
      y: 4,
      fontSize: 22,
      fontWeight: 400,
      fill: C.text,
    },
    {
      op: 'create_text',
      parentName: header,
      name: 'Title',
      text: 'Выбор стиля',
      x: 44,
      y: 6,
      fontSize: 24,
      fontWeight: 600,
      fill: C.text,
    },
    {
      op: 'create_button',
      parentName: header,
      name: 'Done',
      label: '✓',
      x: FRAME_W - PAD * 2 - 44,
      y: 0,
      width: 44,
      height: 44,
      fill: C.accent,
      stroke: C.white,
      radius: 22,
      fontSize: 18,
      fontWeight: 600,
    },
    {
      op: 'create_frame',
      ...onScreen(s),
      name: 'Preview | imagePrompt: soft consumer app style preview friendly rounded illustration warm orange pastel',
      x: PAD,
      y: 124,
      width: FRAME_W - PAD * 2,
      height: 200,
      fill: C.surface,
      stroke: C.border,
      strokeWeight: 1,
      radius: 24,
    },
    {
      op: 'create_frame',
      parentName: 'Preview | imagePrompt: soft consumer app style preview friendly rounded illustration warm orange pastel',
      name: 'Preview inner',
      x: (FRAME_W - PAD * 2 - 120) / 2,
      y: 40,
      width: 120,
      height: 120,
      fill: C.pastelYellow,
      radius: 24,
    },
    ...chipRow(s, 'Подборка', ['Цвета', 'Иконки', 'Фото'], 0).map((op) => {
      if (op.name === 'Подборка / Chip filters') return { ...op, y: 340 };
      return op;
    }),
    {
      op: 'create_frame',
      ...onScreen(s),
      name: grid,
      x: PAD,
      y: 396,
      width: FRAME_W - PAD * 2,
      height: 280,
      fill: C.bg,
    },
  ];

  tiles.forEach((tile, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tileName = `${grid} / ${tile.label}`;
    ops.push(
      {
        op: 'create_frame',
        parentName: grid,
        name: tileName,
        x: col * (tileW + 12),
        y: row * (tileW + 12),
        width: tileW,
        height: tileW,
        fill: tile.fill,
        stroke: i === 0 ? C.accent : C.border,
        strokeWeight: i === 0 ? 2 : 1,
        radius: 20,
      },
      {
        op: 'create_text',
        parentName: tileName,
        name: 'Label',
        text: tile.label,
        x: 10,
        y: tileW - 28,
        fontSize: 12,
        fontWeight: 600,
        fill: C.text,
      },
    );
  });

  ops.push(...softTabBar(s, 'Подборка', 1), homeIndicator(s));
  return ops;
}

function remoteApply(port, operations) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const requestId = `soft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    shell(SCREENS.feed, 3),
  ]);

  const screenOps = [
    normalizeFigmaPlanOperations(buildOnboardingOps()),
    normalizeFigmaPlanOperations(buildLoginOps()),
    normalizeFigmaPlanOperations(buildHomeOps()),
    normalizeFigmaPlanOperations(buildFeedOps()),
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
      console.log(`  batch ${b + 1}: applied ${msg.data?.applied}, failed ${msg.data?.failed}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  console.log(
    JSON.stringify(
      {
        style: 'Мягкий consumer',
        frames: [
          { name: SCREENS.onboarding, x: ORIGIN_X, y: ORIGIN_Y },
          { name: SCREENS.login, x: ORIGIN_X + FRAME_W + GAP_X, y: ORIGIN_Y },
          { name: SCREENS.home, x: ORIGIN_X + 2 * (FRAME_W + GAP_X), y: ORIGIN_Y },
          { name: SCREENS.feed, x: ORIGIN_X + 3 * (FRAME_W + GAP_X), y: ORIGIN_Y },
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
