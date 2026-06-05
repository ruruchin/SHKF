/**
 * Отдельный Node-процесс (ELECTRON_RUN_AS_NODE=1).
 * Не импортирует electron — иначе падение основного окна SHKF.
 *
 * stdout: NDJSON — { type: 'progress'|'done', payload?, result? }
 */
import { readFileSync } from 'fs';
import { buildCursorFigmaAgentPrompt } from '../shared/figma-design-brief.js';

function emit(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function extractAssistantText(event) {
  if (event?.type !== 'assistant' || !event.message?.content) return '';
  return event.message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('');
}

function toolLabel(event) {
  const name =
    event?.toolCall?.name
    || event?.toolUse?.name
    || event?.name
    || (event?.type === 'tool_call' ? 'tool' : '');
  return name ? String(name) : '';
}

async function main() {
  const jobPath = process.argv[2];
  if (!jobPath) {
    emit({ type: 'done', result: { ok: false, message: 'Нет файла задания для Cursor worker' } });
    process.exit(1);
    return;
  }

  const apiKey = String(process.env.CURSOR_API_KEY || '').trim();
  if (!apiKey) {
    emit({ type: 'done', result: { ok: false, message: 'CURSOR_API_KEY не передан worker-процессу' } });
    process.exit(1);
    return;
  }

  let job;
  try {
    job = JSON.parse(readFileSync(jobPath, 'utf8'));
  } catch (err) {
    emit({
      type: 'done',
      result: { ok: false, message: `Не удалось прочитать задание: ${err?.message || err}` },
    });
    process.exit(1);
    return;
  }

  const { brief, model, cwd, mcpServers, preferDesktopMcp } = job;
  let prompt = buildCursorFigmaAgentPrompt(brief);
  if (preferDesktopMcp) {
    prompt += '\n\n## MCP\nИспользуй **figma-desktop** (http://127.0.0.1:3845/mcp) — он уже запущен в Figma Desktop.';
  } else {
    prompt += '\n\n## MCP\nИспользуй сервер **figma** (use_figma). Если инструменты недоступны — сообщи, что нужен OAuth в Cursor (Settings → MCP → Figma → Connect) или Desktop MCP в Figma.';
  }
  const modelId = String(model || 'composer-2.5').trim() || 'composer-2.5';

  emit({ type: 'progress', payload: { phase: 'agent', text: 'Cursor Agent запущен в фоне…' } });

  let Agent;
  try {
    ({ Agent } = await import('@cursor/sdk'));
  } catch (err) {
    emit({
      type: 'done',
      result: { ok: false, message: `@cursor/sdk: ${err?.message || err}` },
    });
    process.exit(1);
    return;
  }

  let agent;
  try {
    const createOpts = {
      apiKey,
      model: { id: modelId },
      local: {
        cwd: cwd || process.cwd(),
        settingSources: ['all'],
      },
    };
    if (mcpServers && Object.keys(mcpServers).length) {
      createOpts.mcpServers = mcpServers;
    }
    agent = await Agent.create(createOpts);

    const run = await agent.send(prompt);
    let assistantLog = '';
    let lastEmit = 0;

    const maybeProgress = (payload) => {
      const now = Date.now();
      if (now - lastEmit < 350) return;
      lastEmit = now;
      emit({ type: 'progress', payload });
    };

    for await (const event of run.stream()) {
      if (event.type === 'assistant') {
        const chunk = extractAssistantText(event);
        if (chunk) {
          assistantLog = chunk;
          maybeProgress({ phase: 'stream', text: chunk.slice(-200) });
        }
      } else {
        const tool = toolLabel(event);
        if (tool) {
          maybeProgress({ phase: 'tool', text: `MCP: ${tool}` });
        }
      }
    }

    const status = run.status || 'finished';
    const resultText = run.result || assistantLog || '';

    if (status === 'error') {
      emit({
        type: 'done',
        result: {
          ok: false,
          message: resultText || 'Cursor Agent завершился с ошибкой',
          model: modelId,
          status,
        },
      });
      process.exit(0);
      return;
    }

    emit({
      type: 'done',
      result: {
        ok: true,
        mode: 'cursor',
        summary: resultText || 'Макет собран в открытом файле Figma через Cursor MCP.',
        model: modelId,
        status,
      },
    });
    process.exit(0);
  } catch (err) {
    const msg = String(err?.message || err || 'Ошибка Cursor Agent');
    emit({ type: 'done', result: { ok: false, message: msg } });
    process.exit(1);
  } finally {
    try {
      await agent?.dispose?.();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  emit({ type: 'done', result: { ok: false, message: String(err?.message || err) } });
  process.exit(1);
});
