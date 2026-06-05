import path from 'path';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { buildCursorFigmaAgentPrompt } from '../shared/figma-design-brief.js';
import { fetchMobbinImagePayload } from './figma-from-mobbin.js';
import {
  buildFigmaMcpServersForAgent,
  checkFigmaMcpReady,
  formatFigmaMcpSetupHint,
} from './cursor-mcp-figma.js';

export { checkFigmaMcpReady } from './cursor-mcp-figma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHILD_SCRIPT = path.join(__dirname, 'cursor-figma-build-child.mjs');
const DEFAULT_TIMEOUT_MS = 25 * 60 * 1000;

function ensureBriefDir(userDataDir) {
  const base = userDataDir || process.cwd();
  const dir = path.join(base, 'cursor-figma-briefs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {object} brief
 * @param {{ userDataDir?: string }} [opts]
 */
export async function persistBriefReferenceImage(brief, { userDataDir } = {}) {
  const screen = brief.screen;
  if (!screen || brief.referenceImagePath) return brief;

  const imageUrl = screen.imageUrl || screen.image_url || null;
  const mobbinUrl = screen.mobbin_url || null;
  if (!imageUrl && !mobbinUrl) return brief;

  const payload = await fetchMobbinImagePayload(imageUrl, { mobbinPageUrl: mobbinUrl });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(ensureBriefDir(userDataDir), `mobbin-${stamp}.png`);
  writeFileSync(filePath, payload.buffer);
  return { ...brief, referenceImagePath: filePath };
}

function spawnCursorBuildChild({ jobPath, apiKey, cwd, timeoutMs, onProgress }) {
  return new Promise((resolve) => {
    let settled = false;
    let stdoutBuf = '';
    let lastProgressAt = 0;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (!child.killed) child.kill();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const child = spawn(
      process.execPath,
      [CHILD_SCRIPT, jobPath],
      {
        cwd: cwd || process.cwd(),
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          CURSOR_API_KEY: apiKey,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    const timer = setTimeout(() => {
      finish({
        ok: false,
        message:
          'Cursor Agent работал слишком долго (25 мин) и был остановлен. Упростите запрос или проверьте Figma + MCP в Cursor.',
      });
    }, timeoutMs || DEFAULT_TIMEOUT_MS);

    child.stdout?.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.type === 'progress' && msg.payload) {
            const now = Date.now();
            if (now - lastProgressAt >= 350) {
              lastProgressAt = now;
              onProgress?.(msg.payload);
            }
          } else if (msg.type === 'done' && msg.result) {
            finish(msg.result);
          }
        } catch {
          // ignore malformed lines
        }
      }
    });

    let stderrTail = '';
    child.stderr?.on('data', (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-800);
    });

    child.on('error', (err) => {
      finish({
        ok: false,
        message: `Не удалось запустить Cursor worker: ${err?.message || err}`,
      });
    });

    child.on('exit', (code, signal) => {
      if (settled) return;
      const hint = stderrTail ? ` ${stderrTail.slice(0, 200)}` : '';
      finish({
        ok: false,
        message:
          code === 0
            ? 'Cursor worker завершился без ответа. Проверьте API key и Figma MCP в Cursor.'
            : `Cursor worker завершился (${signal || `код ${code}`}).${hint}`,
      });
    });
  });
}

/**
 * @param {object} options
 * @param {object} options.brief
 * @param {string} options.apiKey
 * @param {string} [options.model]
 * @param {string} options.cwd
 * @param {string} [options.userDataDir]
 * @param {number} [options.timeoutMs]
 * @param {(payload: { phase: string, text?: string }) => void} [options.onProgress]
 */
export async function runCursorFigmaBuild({
  brief,
  apiKey,
  model,
  cwd,
  userDataDir,
  timeoutMs,
  onProgress,
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    return { ok: false, message: 'Укажите Cursor API key: Настройки → Konstancia → Cursor (Figma MCP)' };
  }

  let enrichedBrief = brief;
  try {
    if (brief.screen && !brief.referenceImagePath) {
      onProgress?.({ phase: 'brief', text: 'Сохраняю превью Mobbin…' });
      enrichedBrief = await persistBriefReferenceImage(brief, { userDataDir });
    }
  } catch (err) {
    return {
      ok: false,
      message: err?.message || 'Не удалось подготовить превью Mobbin для Cursor',
    };
  }

  // Sanity-check prompt size (огромный бриф может положить subprocess)
  const prompt = buildCursorFigmaAgentPrompt(enrichedBrief);
  if (prompt.length > 120_000) {
    return { ok: false, message: 'Слишком большой бриф для Cursor. Сократите описание или референсы.' };
  }

  const modelId = String(model || 'composer-2.5').trim() || 'composer-2.5';
  let jobPath = null;

  const mcpReady = await checkFigmaMcpReady();
  const mcpServers = buildFigmaMcpServersForAgent();

  if (!mcpReady.ok) {
    return {
      ok: false,
      message: `${mcpReady.message}\n\n${formatFigmaMcpSetupHint(false)}`,
    };
  }

  if (!mcpReady.desktopOk) {
    onProgress?.({
      phase: 'warn',
      text: 'Desktop MCP (3845) выключен — нужен Connect Figma в Cursor MCP (OAuth)',
    });
  } else {
    onProgress?.({ phase: 'mcp', text: 'Figma Desktop MCP (3845) доступен' });
  }

  onProgress?.({ phase: 'spawn', text: 'Запускаю Cursor в отдельном процессе (SHKF не блокируется)…' });

  try {
    jobPath = path.join(ensureBriefDir(userDataDir), `job-${Date.now()}.json`);
    writeFileSync(
      jobPath,
      JSON.stringify({
        brief: enrichedBrief,
        model: modelId,
        cwd: cwd || process.cwd(),
        mcpServers,
        preferDesktopMcp: mcpReady.desktopOk,
      }),
      'utf8',
    );

    const result = await spawnCursorBuildChild({
      jobPath,
      apiKey: key,
      cwd,
      timeoutMs,
      onProgress,
    });

    if (!result?.ok) {
      const msg = String(result?.message || '');
      if (/401|403|unauthorized|api.?key/i.test(msg)) {
        return {
          ok: false,
          message: 'Неверный Cursor API key. Создайте ключ на cursor.com/dashboard → Integrations.',
        };
      }
      if (/figma|mcp|not connected|integration/i.test(msg)) {
        return {
          ok: false,
          message:
            'Figma MCP недоступен для worker. Откройте Figma Desktop с файлом и убедитесь, что Figma MCP включён в Cursor (Settings → MCP). Затем повторите.',
        };
      }
    }

    return {
      ...result,
      referenceImagePath: enrichedBrief.referenceImagePath || null,
    };
  } catch (err) {
    return { ok: false, message: String(err?.message || err || 'Ошибка Cursor build') };
  } finally {
    if (jobPath) {
      try {
        unlinkSync(jobPath);
      } catch {
        // ignore
      }
    }
  }
}

export function isCursorFigmaBuildConfigured(agentSettings = {}) {
  const enabled = agentSettings.cursorFigmaBuildEnabled === true;
  const key = String(agentSettings.cursorApiKey || process.env.CURSOR_API_KEY || '').trim();
  return enabled && !!key;
}
