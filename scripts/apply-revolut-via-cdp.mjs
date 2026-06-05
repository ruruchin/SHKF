/**
 * Apply Revolut mockup via Figma CDP (plugin sandbox) when 9222 exposes figma global.
 */
import WebSocket from 'ws';
import { REVOLUT_FIGMA_USE_SCRIPT } from './build-revolut-screens-use-figma.mjs';

const CDP_PORT = Number(process.env.FIGMA_CDP_PORT || 9222);

async function cdpList() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
    signal: AbortSignal.timeout(4000),
  });
  return res.json();
}

function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('CDP timeout'));
    }, 120000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) reject(new Error(msg.error.message));
      else if (msg.result?.exceptionDetails) {
        const ex = msg.result.exceptionDetails;
        reject(new Error(ex.exception?.description || ex.text || 'CDP eval error'));
      } else resolve(msg.result?.result?.value);
    });
    ws.on('error', reject);
  });
}

async function findFigmaSandbox(targets) {
  for (const t of targets) {
    if (!t.webSocketDebuggerUrl) continue;
    try {
      const ok = await cdpEval(
        t.webSocketDebuggerUrl,
        'typeof figma !== "undefined"',
      );
      if (ok === true) return t;
    } catch {
      /* next */
    }
  }
  return null;
}

const targets = await cdpList();
const sandbox = await findFigmaSandbox(targets);
if (!sandbox) {
  console.error('Figma plugin sandbox не найден в CDP. Включите remote debugging для Figma Desktop.');
  process.exit(1);
}

const wrapped = `(async () => { ${REVOLUT_FIGMA_USE_SCRIPT} })()`;
const result = await cdpEval(sandbox.webSocketDebuggerUrl, wrapped);
console.log(JSON.stringify(result, null, 2));
