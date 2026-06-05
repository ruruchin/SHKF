/**
 * Apply soft consumer mockup via Figma CDP (plugin sandbox) or SHKF plugin bridge.
 */
import WebSocket from 'ws';
import { SOFT_CONSUMER_FIGMA_USE_SCRIPT } from './build-soft-consumer-screens-use-figma.mjs';
import { normalizeFigmaPlanOperations } from '../server/figma-design-agent.js';
import { openShkfPlugin, waitPluginConnected } from './open-shkf-plugin.mjs';

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
    }, 180000);
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
      const ok = await cdpEval(t.webSocketDebuggerUrl, 'typeof figma !== "undefined"');
      if (ok === true) return t;
    } catch {
      /* next */
    }
  }
  return null;
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

async function applyViaBridge() {
  let port = await waitPluginConnected(3000);
  if (!port) {
    await openShkfPlugin();
    port = await waitPluginConnected(20000);
  }
  if (!port) return null;

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);
  const mod = await import('./apply-soft-consumer-mockup.mjs');
  // Reuse bridge apply from sibling script by spawning it
  const { stdout } = await execFileAsync(process.execPath, ['scripts/apply-soft-consumer-mockup.mjs'], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  return { mode: 'bridge', stdout };
}

async function applyViaCdp() {
  const targets = await cdpList();
  const sandbox = await findFigmaSandbox(targets);
  if (!sandbox) return null;
  const wrapped = `(async () => { ${SOFT_CONSUMER_FIGMA_USE_SCRIPT} })()`;
  const result = await cdpEval(sandbox.webSocketDebuggerUrl, wrapped);
  return { mode: 'cdp', result };
}

async function main() {
  try {
    const cdp = await applyViaCdp();
    if (cdp) {
      console.log(JSON.stringify(cdp.result, null, 2));
      return;
    }
  } catch (err) {
    console.warn('CDP:', err.message);
  }

  try {
    const bridge = await applyViaBridge();
    if (bridge) {
      console.log(bridge.stdout);
      return;
    }
  } catch (err) {
    console.warn('Bridge:', err.message);
  }

  console.error(
    'Не удалось записать в Figma. Откройте плагин SHKF Bridge (Plugins → Development) или подключите remote Figma MCP (use_figma) в Cursor → Settings → MCP → Figma → Connect.',
  );
  process.exit(1);
}

main();
