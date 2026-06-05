import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const FIGMA_REMOTE_URL = 'https://mcp.figma.com/mcp';
const FIGMA_DESKTOP_URL = 'http://127.0.0.1:3845/mcp';

function normalizeHttpMcpConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  const url = String(cfg.url || '').trim();
  if (!url) return null;
  const out = { type: 'http', url };
  if (cfg.headers && typeof cfg.headers === 'object') {
    out.headers = cfg.headers;
  }
  return out;
}

/**
 * Читает ~/.cursor/mcp.json и .cursor/mcp.json проекта.
 */
export function loadCursorMcpServersFromDisk() {
  const candidates = [
    path.join(homedir(), '.cursor', 'mcp.json'),
    path.join(process.cwd(), '.cursor', 'mcp.json'),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8'));
      const map = raw.mcpServers || raw.servers || {};
      if (map && typeof map === 'object') return { map, filePath };
    } catch {
      // try next
    }
  }
  return { map: {}, filePath: null };
}

/**
 * MCP-серверы Figma для Cursor SDK (inline на Agent.create).
 * @returns {Record<string, import('@cursor/sdk').McpServerConfig>}
 */
export function buildFigmaMcpServersForAgent() {
  const { map } = loadCursorMcpServersFromDisk();
  const servers = {};

  for (const [name, cfg] of Object.entries(map)) {
    const url = String(cfg?.url || '');
    const isFigma =
      /figma/i.test(name)
      || /figma\.com\/mcp/i.test(url)
      || /127\.0\.0\.1:3845/i.test(url);
    if (!isFigma) continue;
    const normalized = normalizeHttpMcpConfig(cfg);
    if (normalized) servers[name] = normalized;
  }

  if (!Object.values(servers).some((s) => /figma\.com/i.test(s.url))) {
    servers.figma = { type: 'http', url: FIGMA_REMOTE_URL };
  }
  if (!Object.values(servers).some((s) => /3845/.test(s.url))) {
    servers['figma-desktop'] = { type: 'http', url: FIGMA_DESKTOP_URL };
  }

  return servers;
}

/**
 * Desktop Figma MCP (Dev Mode → Enable desktop MCP server).
 */
export async function probeFigmaDesktopMcp(timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(FIGMA_DESKTOP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'SHKF-mcp-probe', version: '1.0.0' },
        },
      }),
      signal: ctrl.signal,
    });
    return res.ok || res.status === 200 || res.status === 406;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{ ok: boolean, desktopOk: boolean, serverNames: string[], message: string, mcpFile?: string|null }>}
 */
export async function checkFigmaMcpReady() {
  const { filePath } = loadCursorMcpServersFromDisk();
  const servers = buildFigmaMcpServersForAgent();
  const serverNames = Object.keys(servers);
  const desktopOk = await probeFigmaDesktopMcp();

  if (desktopOk) {
    return {
      ok: true,
      desktopOk: true,
      serverNames,
      mcpFile: filePath,
      message:
        'Figma Desktop MCP отвечает (127.0.0.1:3845). Можно собирать макет из Konstancia.',
    };
  }

  const hasRemote = serverNames.some((n) => /figma/i.test(n));
  if (hasRemote) {
    return {
      ok: true,
      desktopOk: false,
      serverNames,
      mcpFile: filePath,
      message:
        'Desktop MCP не запущен (3845). Будет использован remote https://mcp.figma.com/mcp — нужен OAuth: Cursor → Settings → MCP → Figma → Connect. Либо включите Desktop MCP в Figma (Dev Mode → Enable desktop MCP server).',
    };
  }

  return {
    ok: false,
    desktopOk: false,
    serverNames,
    mcpFile: filePath,
    message:
      'Figma MCP не настроен. Добавьте в Cursor Settings → MCP или в ~/.cursor/mcp.json сервер figma, выполните Connect (OAuth), либо включите Desktop MCP в Figma.',
  };
}

export function formatFigmaMcpSetupHint(desktopOk) {
  if (desktopOk) {
    return 'Figma Desktop MCP активен.';
  }
  return [
    'Чтобы Konstancia/Cursor могли писать в Figma:',
    '',
    '**Вариант A (рекомендуется для Konstancia):**',
    '1. Figma Desktop → откройте файл → Dev Mode (Shift+D)',
    '2. Inspect → MCP server → **Enable desktop MCP server**',
    '3. Повторите запрос в Konstancia',
    '',
    '**Вариант B (remote):**',
    '1. Cursor → Settings → MCP → **Figma** → **Connect** (OAuth)',
    '2. Или в чате Cursor: `/add-plugin figma`',
    '3. Перезапустите Cursor, затем Konstancia',
  ].join('\n');
}
