/**
 * use_figma script body for remote Figma MCP (use_figma tool).
 * Revolut Welcome + Login + Register + Profile/Analytics — iOS 390×844.
 */
export const REVOLUT_FIGMA_USE_SCRIPT = `
const FRAME_W = 390;
const FRAME_H = 844;
const GAP_X = 32;
const ORIGIN_X = 120;
const ORIGIN_Y = 120;
const PAD = 24;
const createdNodeIds = [];

const C = {
  bg: { r: 0, g: 0, b: 0 },
  surface: { r: 28/255, g: 28/255, b: 30/255 },
  surface2: { r: 44/255, g: 44/255, b: 46/255 },
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
  muted: { r: 142/255, g: 142/255, b: 147/255 },
  accent: { r: 0, g: 122/255, b: 1 },
  green: { r: 52/255, g: 199/255, b: 89/255 },
};

await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

let maxX = 0;
for (const child of figma.currentPage.children) {
  maxX = Math.max(maxX, child.x + child.width);
}
if (maxX < ORIGIN_X) maxX = 0;

function solid(fill, opacity = 1) {
  return [{ type: 'SOLID', color: fill, opacity, visible: true }];
}

function addText(parent, chars, size, weight, color, opts = {}) {
  const style = weight >= 700 ? 'Bold' : weight >= 500 ? 'Medium' : 'Regular';
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
  if (parent.layoutMode !== 'NONE') {
    t.layoutSizingHorizontal = 'FILL';
  }
  createdNodeIds.push(t.id);
  return t;
}

function pillBtn(parent, label, fill, textColor, fixed = false) {
  const btn = figma.createAutoLayout('HORIZONTAL', {
    name: label,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 14,
    paddingBottom: 14,
    cornerRadius: 999,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  btn.fills = solid(fill);
  parent.appendChild(btn);
  if (fixed) {
    btn.layoutSizingHorizontal = 'FILL';
    btn.resize(FRAME_W - PAD * 2, 52);
  }
  addText(btn, label, 16, 600, textColor);
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
  addText(bar, '9:41', 15, 600, C.white);
  const spacer = figma.createFrame();
  spacer.fills = [];
  bar.appendChild(spacer);
  spacer.layoutSizingHorizontal = 'FILL';
  spacer.resize(1, 1);
  addText(bar, '●●● ▮▮▮ ▮', 12, 400, C.white);
  createdNodeIds.push(bar.id);
}

function homeIndicator(parent) {
  const ind = figma.createFrame();
  ind.name = 'Home indicator';
  ind.resize(134, 5);
  ind.cornerRadius = 3;
  ind.fills = solid(C.white);
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

// —— Welcome (Revolut Mobbin ref) ——
const welcome = screenFrame('Revolut · Welcome', 0);
statusBar(welcome);

const progress = figma.createAutoLayout('HORIZONTAL', { name: 'Progress', itemSpacing: 4, paddingLeft: PAD, paddingRight: PAD, paddingTop: 8, paddingBottom: 8 });
welcome.appendChild(progress);
progress.layoutSizingHorizontal = 'FILL';
const segW = (FRAME_W - PAD * 2 - 16) / 5;
for (let i = 0; i < 5; i++) {
  const seg = figma.createFrame();
  seg.resize(segW, 3);
  seg.cornerRadius = 2;
  seg.fills = solid(i === 2 ? C.white : C.surface2);
  progress.appendChild(seg);
  createdNodeIds.push(seg.id);
}
createdNodeIds.push(progress.id);

const header = figma.createAutoLayout('HORIZONTAL', { name: 'Header', itemSpacing: 10, paddingLeft: PAD, paddingRight: PAD, paddingTop: 8, paddingBottom: 8, counterAxisAlignItems: 'CENTER' });
welcome.appendChild(header);
header.layoutSizingHorizontal = 'FILL';
const logo = figma.createFrame();
logo.resize(24, 24);
logo.cornerRadius = 12;
logo.fills = solid(C.white);
header.appendChild(logo);
addText(logo, 'R', 12, 700, C.black, { name: 'R' });
addText(header, 'Welcome to Revolut', 14, 400, C.white);
createdNodeIds.push(header.id);

const hero = figma.createAutoLayout('VERTICAL', { name: 'Hero', itemSpacing: 8, paddingLeft: PAD, paddingRight: PAD, paddingTop: 12, paddingBottom: 8 });
welcome.appendChild(hero);
hero.layoutSizingHorizontal = 'FILL';
addText(hero, 'INVEST YOUR WAY,\\nFROM $1', 34, 700, C.white, { width: FRAME_W - PAD * 2, lineHeight: 40 });
addText(hero, 'Capital at risk. Fees may apply.', 13, 400, C.muted);
createdNodeIds.push(hero.id);

const coins = figma.createFrame();
coins.name = 'Coin stack';
coins.resize(FRAME_W, 220);
coins.fills = [];
welcome.appendChild(coins);
coins.layoutSizingHorizontal = 'FILL';
const coinData = [
  { x: 115, y: 40, s: 84, fill: C.surface2, label: 'G' },
  { x: 165, y: 0, s: 92, fill: C.green, label: '♫' },
  { x: 220, y: 55, s: 80, fill: C.surface2, label: '' },
  { x: 140, y: 110, s: 72, fill: C.surface2, label: 'IBM' },
  { x: 195, y: 130, s: 68, fill: C.accent, label: '⊞' },
];
for (const c of coinData) {
  const coin = figma.createEllipse();
  coin.resize(c.s, c.s);
  coin.x = c.x;
  coin.y = c.y;
  coin.fills = solid(c.fill);
  coins.appendChild(coin);
  if (c.label) addText(coin, c.label, c.label.length > 2 ? 14 : 24, 700, c.label === '♫' || c.label === '⊞' ? C.white : C.black);
  createdNodeIds.push(coin.id);
}
createdNodeIds.push(coins.id);

const actions = figma.createAutoLayout('VERTICAL', { name: 'Actions', itemSpacing: 12, paddingLeft: PAD, paddingRight: PAD, paddingTop: 8, paddingBottom: 8 });
welcome.appendChild(actions);
actions.layoutSizingHorizontal = 'FILL';
pillBtn(actions, 'Create account', C.white, C.black, true);
pillBtn(actions, 'Log in', C.surface, C.white, true);
createdNodeIds.push(actions.id);

homeIndicator(welcome);

// —— Login ——
const login = screenFrame('Login', 1);
statusBar(login);
const loginBody = figma.createAutoLayout('VERTICAL', { name: 'Content', itemSpacing: 16, paddingLeft: PAD, paddingRight: PAD, paddingTop: 48, paddingBottom: 24 });
login.appendChild(loginBody);
loginBody.layoutSizingHorizontal = 'FILL';
addText(loginBody, 'Log in', 32, 700, C.white);
addText(loginBody, 'Enter your phone number to continue', 15, 400, C.muted, { width: FRAME_W - PAD * 2 });
const phoneField = figma.createFrame();
phoneField.name = 'Phone field';
phoneField.resize(FRAME_W - PAD * 2, 44);
phoneField.cornerRadius = 10;
phoneField.fills = solid(C.surface);
phoneField.strokes = solid({ r: 58/255, g: 58/255, b: 60/255 });
phoneField.strokeWeight = 1;
loginBody.appendChild(phoneField);
phoneField.layoutSizingHorizontal = 'FILL';
addText(phoneField, '+1 000 000 0000', 14, 400, C.muted, { name: 'Placeholder' });
pillBtn(loginBody, 'Continue', C.white, C.black, true);
addText(loginBody, "Don't have an account? Sign up", 14, 400, C.muted, { width: FRAME_W - PAD * 2 });
createdNodeIds.push(loginBody.id);
homeIndicator(login);

// —— Register ——
const reg = screenFrame('Register', 2);
statusBar(reg);
const regBody = figma.createAutoLayout('VERTICAL', { name: 'Content', itemSpacing: 14, paddingLeft: PAD, paddingRight: PAD, paddingTop: 48, paddingBottom: 24 });
reg.appendChild(regBody);
regBody.layoutSizingHorizontal = 'FILL';
addText(regBody, 'Create account', 32, 700, C.white);
for (const [label, ph] of [['Full name', 'Alex Morgan'], ['Email', 'you@email.com'], ['Password', 'Min. 8 characters']]) {
  const wrap = figma.createAutoLayout('VERTICAL', { name: label, itemSpacing: 6 });
  regBody.appendChild(wrap);
  wrap.layoutSizingHorizontal = 'FILL';
  addText(wrap, label, 12, 500, C.muted);
  const field = figma.createFrame();
  field.resize(FRAME_W - PAD * 2, 44);
  field.cornerRadius = 10;
  field.fills = solid(C.surface);
  field.strokes = solid({ r: 58/255, g: 58/255, b: 60/255 });
  field.strokeWeight = 1;
  wrap.appendChild(field);
  field.layoutSizingHorizontal = 'FILL';
  addText(field, ph, 14, 400, C.muted);
  createdNodeIds.push(wrap.id);
}
pillBtn(regBody, 'Sign up', C.white, C.black, true);
addText(regBody, 'By continuing you agree to Terms & Privacy', 12, 400, C.muted, { width: FRAME_W - PAD * 2 });
createdNodeIds.push(regBody.id);
homeIndicator(reg);

// —— Profile + Analytics ——
const portfolio = screenFrame('Profile · Analytics', 3);
statusBar(portfolio);
const portBody = figma.createAutoLayout('VERTICAL', { name: 'Content', itemSpacing: 16, paddingLeft: PAD, paddingRight: PAD, paddingTop: 24, paddingBottom: 8 });
portfolio.appendChild(portBody);
portBody.layoutSizingHorizontal = 'FILL';
addText(portBody, 'Portfolio', 28, 700, C.white);

const balCard = figma.createAutoLayout('VERTICAL', { name: 'Balance card', itemSpacing: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, cornerRadius: 16 });
balCard.fills = solid(C.surface);
portBody.appendChild(balCard);
balCard.layoutSizingHorizontal = 'FILL';
addText(balCard, 'Total balance', 13, 400, C.muted);
addText(balCard, '$24,580.42', 32, 700, C.white);
addText(balCard, '+12.4% this month', 14, 600, C.green);
createdNodeIds.push(balCard.id);

const chartCard = figma.createAutoLayout('VERTICAL', { name: 'Analytics chart', itemSpacing: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, cornerRadius: 16 });
chartCard.fills = solid(C.surface);
portBody.appendChild(chartCard);
chartCard.layoutSizingHorizontal = 'FILL';
addText(chartCard, 'Performance', 17, 600, C.white);
const chartArea = figma.createFrame();
chartArea.resize(FRAME_W - PAD * 2 - 32, 120);
chartArea.cornerRadius = 10;
chartArea.fills = solid(C.bg);
chartCard.appendChild(chartArea);
chartArea.layoutSizingHorizontal = 'FILL';
const bars = [35, 55, 45, 70, 60, 85, 75, 90];
bars.forEach((h, i) => {
  const bar = figma.createRectangle();
  bar.resize(24, h);
  bar.cornerRadius = 4;
  bar.fills = solid(C.accent);
  bar.x = 12 + i * 34;
  bar.y = 120 - h;
  chartArea.appendChild(bar);
  createdNodeIds.push(bar.id);
});
createdNodeIds.push(chartCard.id);

const profileCard = figma.createAutoLayout('VERTICAL', { name: 'Profile section', itemSpacing: 10, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, cornerRadius: 16 });
profileCard.fills = solid(C.surface);
portBody.appendChild(profileCard);
profileCard.layoutSizingHorizontal = 'FILL';
const row = figma.createAutoLayout('HORIZONTAL', { name: 'User row', itemSpacing: 12, counterAxisAlignItems: 'CENTER' });
profileCard.appendChild(row);
row.layoutSizingHorizontal = 'FILL';
const av = figma.createEllipse();
av.resize(48, 48);
av.fills = solid(C.accent);
row.appendChild(av);
const userCol = figma.createAutoLayout('VERTICAL', { name: 'User', itemSpacing: 4 });
row.appendChild(userCol);
userCol.layoutSizingHorizontal = 'FILL';
addText(userCol, 'Alex Morgan', 18, 700, C.white);
addText(userCol, 'alex@revolut.app', 13, 400, C.muted);
addText(profileCard, 'Account · Security · Notifications', 13, 500, C.muted);
createdNodeIds.push(profileCard.id);

const tabbar = figma.createAutoLayout('HORIZONTAL', { name: 'Tab bar', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 28, primaryAxisAlignItems: 'SPACE_BETWEEN' });
tabbar.fills = solid(C.surface);
tabbar.resize(FRAME_W, 84);
portfolio.appendChild(tabbar);
tabbar.layoutSizingHorizontal = 'FILL';
['Home', 'Invest', 'Cards', 'Profile'].forEach((label, i) => {
  addText(tabbar, label, 11, i === 3 ? 700 : 400, i === 3 ? C.white : C.muted);
});
createdNodeIds.push(tabbar.id);
createdNodeIds.push(portBody.id);
homeIndicator(portfolio);

figma.viewport.scrollAndZoomIntoView(
  createdNodeIds.map((id) => figma.getNodeById(id)).filter((n) => n && n.type === 'FRAME' && /^screen|Revolut|Login|Register|Profile/i.test(n.name))
);

return {
  page: figma.currentPage.name,
  createdNodeIds,
  frames: ['Revolut · Welcome', 'Login', 'Register', 'Profile · Analytics'],
};
`;
