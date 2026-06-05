import WebSocket from 'ws';
import { focusFigmaWindow } from '../server/figma-launcher.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function sendKeys(seq) {
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(seq)})
`;
  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
}

export async function openShkfPlugin() {
  await focusFigmaWindow();
  await new Promise((r) => setTimeout(r, 500));
  await sendKeys('^/');
  await new Promise((r) => setTimeout(r, 700));
  await sendKeys('SHKF Bridge');
  await new Promise((r) => setTimeout(r, 900));
  await sendKeys('{ENTER}');
}

export async function waitPluginConnected(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    for (let port = 3847; port < 3857; port++) {
      try {
        const ok = await new Promise((resolve) => {
          const ws = new WebSocket(`ws://127.0.0.1:${port}`);
          const requestId = `probe-${Date.now()}`;
          const t = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 1500);
          ws.on('open', () => {
            ws.send(
              JSON.stringify({
                type: 'remote-apply-design-ops',
                requestId,
                payload: { operations: [] },
              }),
            );
          });
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.requestId === requestId) {
              clearTimeout(t);
              ws.close();
              resolve(msg.error !== 'Плагин Figma не подключён');
            }
          });
          ws.on('error', () => {
            clearTimeout(t);
            resolve(false);
          });
        });
        if (ok) return port;
      } catch {
        /* next */
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

if (process.argv[1]?.endsWith('open-shkf-plugin.mjs')) {
  await openShkfPlugin();
  const port = await waitPluginConnected(25000);
  console.log(port ? `connected:${port}` : 'not-connected');
  process.exit(port ? 0 : 1);
}
