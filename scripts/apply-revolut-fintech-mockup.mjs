/**
 * Revolut-style fintech mockup → Figma via SHKF plugin bridge.
 * Screens: Welcome (Mobbin ref), Login, Register, Profile + Analytics.
 */
import WebSocket from 'ws';
import { normalizeFigmaPlanOperations } from '../server/figma-design-agent.js';

const FRAME_W = 390;
const FRAME_H = 844;
const GAP_X = 32;
const ORIGIN_X = 120;
const ORIGIN_Y = 120;
const PAD = 24;

const C = {
  bg: { r: 0, g: 0, b: 0, a: 1 },
  surface: { r: 28, g: 28, b: 30, a: 1 },
  surface2: { r: 44, g: 44, b: 46, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  muted: { r: 142, g: 142, b: 147, a: 1 },
  accent: { r: 0, g: 122, b: 255, a: 1 },
  green: { r: 52, g: 199, b: 89, a: 1 },
  red: { r: 255, g: 69, b: 58, a: 1 },
  coin1: { r: 205, g: 127, b: 50, a: 1 },
  coin2: { r: 192, g: 192, b: 192, a: 1 },
  coin3: { r: 99, g: 102, b: 106, a: 1 },
  border: { r: 58, g: 58, b: 60, a: 1 },
};

function screenFrame(key, name, pageIndex) {
  const x = ORIGIN_X + pageIndex * (FRAME_W + GAP_X);
  return {
    op: 'create_frame',
    key,
    name,
    width: FRAME_W,
    height: FRAME_H,
    x,
    y: ORIGIN_Y,
    fill: C.bg,
    layoutMode: 'VERTICAL',
    padding: 0,
    spacing: 0,
  };
}

function statusBar(prefix, parentKey) {
  return [
    {
      op: 'create_frame',
      key: `${prefix}status`,
      parentKey,
      name: 'Status bar',
      x: 0,
      y: 0,
      width: FRAME_W,
      height: 54,
      fill: C.bg,
    },
    {
      op: 'create_text',
      key: `${prefix}time`,
      parentKey: `${prefix}status`,
      name: 'Time',
      text: '9:41',
      x: PAD,
      y: 16,
      fontSize: 15,
      fontWeight: 600,
      fill: C.white,
    },
    {
      op: 'create_text',
      key: `${prefix}icons`,
      parentKey: `${prefix}status`,
      name: 'Status icons',
      text: '●●● ▮▮▮ ▮',
      x: FRAME_W - 88,
      y: 16,
      fontSize: 12,
      fontWeight: 400,
      fill: C.white,
    },
  ];
}

function homeIndicator(prefix, parentKey, y = FRAME_H - 28) {
  return {
    op: 'create_rect',
    key: `${prefix}home`,
    parentKey,
    name: 'Home indicator',
    x: (FRAME_W - 134) / 2,
    y,
    width: 134,
    height: 5,
    fill: C.white,
    radius: 3,
  };
}

function pillButton(prefix, parentKey, key, label, x, y, w, h, fill, textFill) {
  return [
    {
      op: 'create_frame',
      key: `${prefix}${key}`,
      parentKey,
      name: label,
      x,
      y,
      width: w,
      height: h,
      fill,
      radius: h / 2,
      layoutMode: 'HORIZONTAL',
      padding: 0,
      spacing: 0,
    },
    {
      op: 'create_text',
      key: `${prefix}${key}T`,
      parentKey: `${prefix}${key}`,
      name: 'Label',
      text: label,
      x: Math.max(12, (w - label.length * 7) / 2),
      y: (h - 18) / 2,
      fontSize: 16,
      fontWeight: 600,
      fill: textFill,
    },
  ];
}

function buildWelcomeOps() {
  const pk = 'screen0';
  const p = 's0_';
  const segW = (FRAME_W - PAD * 2 - 16) / 5;
  const ops = [
    screenFrame(pk, 'Revolut · Welcome', 0),
    ...statusBar(p, pk),
    // Progress segments (3rd active — Mobbin ref)
    ...[0, 1, 2, 3, 4].map((i) => ({
      op: 'create_rect',
      key: `${p}prog${i}`,
      parentKey: pk,
      name: `Progress ${i + 1}`,
      x: PAD + i * (segW + 4),
      y: 58,
      width: segW,
      height: 3,
      fill: i === 2 ? C.white : C.surface2,
      radius: 2,
    })),
    {
      op: 'create_frame',
      key: `${p}header`,
      parentKey: pk,
      name: 'Header',
      x: PAD,
      y: 78,
      width: FRAME_W - PAD * 2,
      height: 32,
      fill: C.bg,
      layoutMode: 'HORIZONTAL',
      spacing: 10,
    },
    {
      op: 'create_rect',
      key: `${p}logo`,
      parentKey: `${p}header`,
      name: 'Logo',
      x: 0,
      y: 4,
      width: 24,
      height: 24,
      fill: C.white,
      radius: 12,
    },
    {
      op: 'create_text',
      key: `${p}logoT`,
      parentKey: `${p}logo`,
      name: 'R',
      text: 'R',
      x: 7,
      y: 3,
      fontSize: 12,
      fontWeight: 700,
      fill: C.black,
    },
    {
      op: 'create_text',
      key: `${p}welcome`,
      parentKey: `${p}header`,
      name: 'Welcome label',
      text: 'Welcome to Revolut',
      x: 34,
      y: 6,
      fontSize: 14,
      fontWeight: 400,
      fill: C.white,
    },
    {
      op: 'create_text',
      key: `${p}headline`,
      parentKey: pk,
      name: 'Headline',
      text: 'INVEST YOUR WAY,\nFROM $1',
      x: PAD,
      y: 124,
      width: FRAME_W - PAD * 2,
      textAutoResize: 'HEIGHT',
      fontSize: 34,
      fontWeight: 700,
      fill: C.white,
      lineHeight: 40,
    },
    {
      op: 'create_text',
      key: `${p}risk`,
      parentKey: pk,
      name: 'Risk caption',
      text: 'Capital at risk. Fees may apply.',
      x: PAD,
      y: 228,
      fontSize: 13,
      fontWeight: 400,
      fill: C.muted,
    },
    // Coin stack visual
    {
      op: 'create_ellipse',
      key: `${p}coin1`,
      parentKey: pk,
      name: 'Coin Google',
      x: FRAME_W / 2 - 78,
      y: 318,
      width: 84,
      height: 84,
      fill: C.coin2,
    },
    {
      op: 'create_text',
      key: `${p}coin1t`,
      parentKey: `${p}coin1`,
      name: 'G',
      text: 'G',
      x: 30,
      y: 26,
      fontSize: 26,
      fontWeight: 700,
      fill: C.black,
    },
    {
      op: 'create_ellipse',
      key: `${p}coin2`,
      parentKey: pk,
      name: 'Coin Spotify',
      x: FRAME_W / 2 - 18,
      y: 278,
      width: 92,
      height: 92,
      fill: C.green,
    },
    {
      op: 'create_text',
      key: `${p}coin2t`,
      parentKey: `${p}coin2`,
      name: 'Spotify',
      text: '♫',
      x: 34,
      y: 30,
      fontSize: 24,
      fontWeight: 400,
      fill: C.white,
    },
    {
      op: 'create_ellipse',
      key: `${p}coin3`,
      parentKey: pk,
      name: 'Coin Apple',
      x: FRAME_W / 2 + 44,
      y: 332,
      width: 80,
      height: 80,
      fill: C.coin2,
    },
    {
      op: 'create_text',
      key: `${p}coin3t`,
      parentKey: `${p}coin3`,
      name: 'Apple',
      text: '',
      x: 30,
      y: 28,
      fontSize: 22,
      fontWeight: 400,
      fill: C.black,
    },
    {
      op: 'create_ellipse',
      key: `${p}coin4`,
      parentKey: pk,
      name: 'Coin IBM',
      x: FRAME_W / 2 - 42,
      y: 388,
      width: 72,
      height: 72,
      fill: C.coin3,
    },
    {
      op: 'create_text',
      key: `${p}coin4t`,
      parentKey: `${p}coin4`,
      name: 'IBM',
      text: 'IBM',
      x: 16,
      y: 24,
      fontSize: 14,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_ellipse',
      key: `${p}coin5`,
      parentKey: pk,
      name: 'Coin Microsoft',
      x: FRAME_W / 2 + 8,
      y: 408,
      width: 68,
      height: 68,
      fill: C.accent,
    },
    {
      op: 'create_text',
      key: `${p}coin5t`,
      parentKey: `${p}coin5`,
      name: 'MS',
      text: '⊞',
      x: 22,
      y: 20,
      fontSize: 22,
      fontWeight: 400,
      fill: C.white,
    },
    ...pillButton(p, pk, 'btnSignup', 'Create account', PAD, FRAME_H - 132, FRAME_W - PAD * 2, 52, C.white, C.black),
    ...pillButton(p, pk, 'btnLogin', 'Log in', PAD, FRAME_H - 72, FRAME_W - PAD * 2, 52, C.surface, C.white),
    homeIndicator(p, pk),
  ];
  // Replace create_ellipse with create_rect (plugin may not support ellipse)
  return ops.map((op) => {
    if (op.op === 'create_ellipse') {
      const { op: _o, ...rest } = op;
      return { op: 'create_rect', ...rest, radius: Math.min(rest.width, rest.height) / 2 };
    }
    return op;
  });
}

function buildLoginOps() {
  const pk = 'screen1';
  const p = 's1_';
  return [
    screenFrame(pk, 'Login', 1),
    ...statusBar(p, pk),
    {
      op: 'create_text',
      key: `${p}title`,
      parentKey: pk,
      name: 'Title',
      text: 'Log in',
      x: PAD,
      y: 100,
      fontSize: 32,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_text',
      key: `${p}sub`,
      parentKey: pk,
      name: 'Subtitle',
      text: 'Enter your phone number to continue',
      x: PAD,
      y: 148,
      width: FRAME_W - PAD * 2,
      textAutoResize: 'HEIGHT',
      fontSize: 15,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_input',
      key: `${p}phone`,
      parentKey: pk,
      name: 'Phone',
      label: 'Phone number',
      placeholder: '+1 000 000 0000',
      x: PAD,
      y: 220,
      width: FRAME_W - PAD * 2,
      fieldFill: C.surface,
      border: C.border,
      labelFill: C.muted,
      placeholderFill: C.muted,
    },
    ...pillButton(p, pk, 'cta', 'Continue', PAD, 320, FRAME_W - PAD * 2, 52, C.white, C.black),
    {
      op: 'create_text',
      key: `${p}link`,
      parentKey: pk,
      name: 'Sign up link',
      text: "Don't have an account? Sign up",
      x: PAD,
      y: 400,
      width: FRAME_W - PAD * 2,
      textAutoResize: 'HEIGHT',
      fontSize: 14,
      fontWeight: 400,
      fill: C.muted,
    },
    homeIndicator(p, pk),
  ];
}

function buildRegisterOps() {
  const pk = 'screen2';
  const p = 's2_';
  return [
    screenFrame(pk, 'Register', 2),
    ...statusBar(p, pk),
    {
      op: 'create_text',
      key: `${p}title`,
      parentKey: pk,
      name: 'Title',
      text: 'Create account',
      x: PAD,
      y: 100,
      fontSize: 32,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_input',
      key: `${p}name`,
      parentKey: pk,
      name: 'Name',
      label: 'Full name',
      placeholder: 'Alex Morgan',
      x: PAD,
      y: 180,
      width: FRAME_W - PAD * 2,
      fieldFill: C.surface,
      border: C.border,
      labelFill: C.muted,
      placeholderFill: C.muted,
    },
    {
      op: 'create_input',
      key: `${p}email`,
      parentKey: pk,
      name: 'Email',
      label: 'Email',
      placeholder: 'you@email.com',
      x: PAD,
      y: 268,
      width: FRAME_W - PAD * 2,
      fieldFill: C.surface,
      border: C.border,
      labelFill: C.muted,
      placeholderFill: C.muted,
    },
    {
      op: 'create_input',
      key: `${p}pass`,
      parentKey: pk,
      name: 'Password',
      label: 'Password',
      placeholder: 'Min. 8 characters',
      x: PAD,
      y: 356,
      width: FRAME_W - PAD * 2,
      fieldFill: C.surface,
      border: C.border,
      labelFill: C.muted,
      placeholderFill: C.muted,
    },
    ...pillButton(p, pk, 'cta', 'Sign up', PAD, 460, FRAME_W - PAD * 2, 52, C.white, C.black),
    {
      op: 'create_text',
      key: `${p}legal`,
      parentKey: pk,
      name: 'Legal',
      text: 'By continuing you agree to Terms & Privacy',
      x: PAD,
      y: 540,
      width: FRAME_W - PAD * 2,
      textAutoResize: 'HEIGHT',
      fontSize: 12,
      fontWeight: 400,
      fill: C.muted,
    },
    homeIndicator(p, pk),
  ];
}

function buildProfileAnalyticsOps() {
  const pk = 'screen3';
  const p = 's3_';
  const ops = [
    screenFrame(pk, 'Profile · Analytics', 3),
    ...statusBar(p, pk),
    {
      op: 'create_text',
      key: `${p}title`,
      parentKey: pk,
      name: 'Screen title',
      text: 'Portfolio',
      x: PAD,
      y: 72,
      fontSize: 28,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_frame',
      key: `${p}balanceCard`,
      parentKey: pk,
      name: 'Balance card',
      x: PAD,
      y: 120,
      width: FRAME_W - PAD * 2,
      height: 120,
      fill: C.surface,
      radius: 16,
      layoutMode: 'VERTICAL',
      padding: 16,
      spacing: 6,
    },
    {
      op: 'create_text',
      key: `${p}balLabel`,
      parentKey: `${p}balanceCard`,
      name: 'Label',
      text: 'Total balance',
      x: 16,
      y: 16,
      fontSize: 13,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_text',
      key: `${p}balVal`,
      parentKey: `${p}balanceCard`,
      name: 'Value',
      text: '$24,580.42',
      x: 16,
      y: 38,
      fontSize: 32,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_text',
      key: `${p}balChg`,
      parentKey: `${p}balanceCard`,
      name: 'Change',
      text: '+12.4% this month',
      x: 16,
      y: 82,
      fontSize: 14,
      fontWeight: 600,
      fill: C.green,
    },
    {
      op: 'create_frame',
      key: `${p}chartCard`,
      parentKey: pk,
      name: 'Analytics chart',
      x: PAD,
      y: 256,
      width: FRAME_W - PAD * 2,
      height: 200,
      fill: C.surface,
      radius: 16,
      layoutMode: 'VERTICAL',
      padding: 16,
      spacing: 8,
    },
    {
      op: 'create_text',
      key: `${p}chartT`,
      parentKey: `${p}chartCard`,
      name: 'Chart title',
      text: 'Performance',
      x: 16,
      y: 16,
      fontSize: 17,
      fontWeight: 600,
      fill: C.white,
    },
    {
      op: 'create_rect',
      key: `${p}chartArea`,
      parentKey: `${p}chartCard`,
      name: 'Chart area',
      x: 16,
      y: 48,
      width: FRAME_W - PAD * 2 - 32,
      height: 120,
      fill: C.bg,
      radius: 10,
    },
    ...[35, 55, 45, 70, 60, 85, 75, 90].map((pct, i) => ({
      op: 'create_rect',
      key: `${p}bar${i}`,
      parentKey: `${p}chartArea`,
      name: `Bar ${i}`,
      x: 12 + i * 38,
      y: 120 - pct,
      width: 24,
      height: pct,
      fill: C.accent,
      radius: 4,
    })),
    {
      op: 'create_frame',
      key: `${p}profileCard`,
      parentKey: pk,
      name: 'Profile section',
      x: PAD,
      y: 472,
      width: FRAME_W - PAD * 2,
      height: 140,
      fill: C.surface,
      radius: 16,
      layoutMode: 'VERTICAL',
      padding: 16,
      spacing: 10,
    },
    {
      op: 'create_rect',
      key: `${p}avatar`,
      parentKey: `${p}profileCard`,
      name: 'Avatar',
      x: 16,
      y: 16,
      width: 48,
      height: 48,
      fill: C.accent,
      radius: 24,
    },
    {
      op: 'create_text',
      key: `${p}name`,
      parentKey: `${p}profileCard`,
      name: 'Name',
      text: 'Alex Morgan',
      x: 76,
      y: 20,
      fontSize: 18,
      fontWeight: 700,
      fill: C.white,
    },
    {
      op: 'create_text',
      key: `${p}email`,
      parentKey: `${p}profileCard`,
      name: 'Email',
      text: 'alex@revolut.app',
      x: 76,
      y: 46,
      fontSize: 13,
      fontWeight: 400,
      fill: C.muted,
    },
    {
      op: 'create_text',
      key: `${p}settings`,
      parentKey: `${p}profileCard`,
      name: 'Settings row',
      text: 'Account · Security · Notifications',
      x: 16,
      y: 96,
      fontSize: 13,
      fontWeight: 500,
      fill: C.muted,
    },
    // Tab bar
    {
      op: 'create_frame',
      key: `${p}tabbar`,
      parentKey: pk,
      name: 'Tab bar',
      x: 0,
      y: FRAME_H - 84,
      width: FRAME_W,
      height: 84,
      fill: C.surface,
      layoutMode: 'HORIZONTAL',
      padding: 12,
      spacing: 0,
    },
    ...['Home', 'Invest', 'Cards', 'Profile'].map((label, i) => ({
      op: 'create_text',
      key: `${p}tab${i}`,
      parentKey: `${p}tabbar`,
      name: label,
      text: label,
      x: 12 + i * 92,
      y: 28,
      fontSize: 11,
      fontWeight: i === 3 ? 700 : 400,
      fill: i === 3 ? C.white : C.muted,
    })),
    homeIndicator(p, pk, FRAME_H - 20),
  ];
  return ops;
}

const allOps = normalizeFigmaPlanOperations([
  ...buildWelcomeOps(),
  ...buildLoginOps(),
  ...buildRegisterOps(),
  ...buildProfileAnalyticsOps(),
]);

function remoteApply(port, operations) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const requestId = `revolut-${Date.now()}`;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Таймаут remote-apply-design-ops (45s)'));
    }, 45000);
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
          if (msg.ok) resolve({ port, msg });
          else reject(new Error(msg.error || 'Ошибка Figma plugin'));
        }
      } catch {
        /* ignore */
      }
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
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

const deadline = Date.now() + 90000;
let result = null;
let lastErr = null;

while (Date.now() < deadline && !result) {
  const port = await findBridgePort();
  if (!port) {
    lastErr = new Error('SHKF Bridge не слушает порты 3847–3856');
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }
  try {
    result = await remoteApply(port, allOps);
    console.log(`Bridge port ${port}, ops: ${allOps.length}`);
    break;
  } catch (err) {
    lastErr = err;
    const msg = String(err?.message || err);
    if (/подключ/i.test(msg) || /plugin/i.test(msg)) {
      console.log('Ожидание SHKF Bridge в Figma…');
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    throw err;
  }
}

if (!result) {
  throw lastErr || new Error(
    'SHKF Bridge не подключён. В Figma: Plugins → Development → SHKF Bridge → Connect (порт 3847).',
  );
}
console.log(JSON.stringify(result?.msg?.data || result, null, 2));
