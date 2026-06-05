import { inferMobbinPlatform, mobbinPlatformLabel } from './mobbin-search-query.js';
import { buildMobbinCopyRules, inferProductName, inferUiLanguage } from './figma-copy-context.js';
import { formatMobbinStyleBlock } from './mobbin-style-proposals.js';
import { MOBBIN_PLAN_ORIGIN_X, MOBBIN_PLAN_ORIGIN_Y } from './figma-plan-layout.js';

/**
 * @param {object} params
 * @param {string} params.message
 * @param {object} [params.screen]
 * @param {object[]} [params.refs]
 * @param {object} [params.selection]
 * @param {object} [params.task]
 * @param {boolean} [params.expandApp]
 * @param {string} [params.referenceImagePath]
 * @param {object} [params.selectedStyle]
 */
export function buildFigmaDesignBrief({
  message,
  screen = null,
  refs = [],
  selection = null,
  task = null,
  expandApp = false,
  referenceImagePath = null,
  selectedStyle = null,
}) {
  const platform = screen?.platform || inferMobbinPlatform(message);
  const refsText = (refs || [])
    .map((r, i) => {
      const title = r.title || r.app_name || `ref-${i + 1}`;
      const url = r.url || r.mobbin_url || '';
      const tags = Array.isArray(r.tags) ? r.tags.join(', ') : '';
      return `- ${title}${url ? ` (${url})` : ''}${tags ? ` [${tags}]` : ''}`;
    })
    .filter(Boolean)
    .join('\n');

  let selectionText = 'Нет данных о выделении (создай новые фреймы на текущей странице).';
  if (selection?.nodes?.length) {
    selectionText = selection.nodes
      .map((n) => `- ${n.name || n.type} (${n.type})${n.width ? ` ${n.width}×${n.height}` : ''}`)
      .join('\n');
  } else if (selection?.pageName) {
    selectionText = `Страница: ${selection.pageName}`;
  }

  let taskText = '';
  if (task?.id || task?.subject || task?.title) {
    taskText = [
      task.id ? `ID: ${task.id}` : '',
      task.subject || task.title || '',
      task.description ? String(task.description).slice(0, 2000) : '',
    ].filter(Boolean).join('\n');
  }

  return {
    message: String(message || '').trim(),
    platform,
    platformLabel: mobbinPlatformLabel(platform),
    expandApp: !!expandApp,
    screen: screen
      ? {
          app_name: screen.app_name || screen.title || 'Mobbin reference',
          mobbin_url: screen.mobbin_url || screen.url || null,
          imageUrl: screen.imageUrl || screen.image_url || null,
          platform: screen.platform || null,
          id: screen.id || null,
          tags: screen.tags || [],
        }
      : null,
    refs,
    refsText: refsText || '(доп. референсы не указаны)',
    selection,
    selectionText,
    task,
    taskText: taskText || '(задача Kanban не передана)',
    referenceImagePath,
    selectedStyle,
    styleBlock: selectedStyle ? formatMobbinStyleBlock(selectedStyle) : '',
  };
}

/**
 * @param {ReturnType<typeof buildFigmaDesignBrief>} brief
 */
export function buildCursorFigmaAgentPrompt(brief) {
  const frameHint =
    brief.platform === 'web'
      ? 'Desktop/web artboard ~1440px wide, auto-layout sections.'
      : 'iOS mobile frame 390×844 (or 393×852), safe areas, tab bar if appropriate.';

  const scope = brief.selectedStyle
    ? 'Full app redesign in the chosen style: build 3–4 cohesive screens (home + onboarding or login flow + one inner screen). Same design system on every frame.'
    : brief.expandApp
      ? 'User asked for multi-screen / onboarding — build only what they explicitly requested, max 3–4 screens in a tidy row.'
      : 'Single main screen unless the user message explicitly asks for onboarding, login+register, or multiple steps.';

  const screenBlock = brief.screen
    ? [
        `App: ${brief.screen.app_name}`,
        brief.screen.mobbin_url ? `Mobbin: ${brief.screen.mobbin_url}` : '',
        brief.referenceImagePath
          ? `Reference image (match layout, spacing, typography, colors): ${brief.referenceImagePath}`
          : '',
        brief.screen.tags?.length ? `Tags: ${brief.screen.tags.join(', ')}` : '',
      ].filter(Boolean).join('\n')
    : 'No Mobbin screen — infer layout from user message and refs.';

  const copyRules = buildMobbinCopyRules(brief.message, brief.screen);
  const product = inferProductName(brief.message);
  const lang = inferUiLanguage(brief.message);

  return [
    'Build a production-quality UI mockup in the user\'s **currently connected Figma file** using Figma MCP (`use_figma`).',
    'Before editing: follow figma-use / figma-generate-design skills. Use real auto-layout, TEXT nodes, components — NOT primitive circles as fake illustrations.',
    '',
    '## User goal',
    brief.message,
    '',
    '## Copy & language (mandatory)',
    `UI language: ${lang === 'ru' ? 'Russian' : 'English'}.`,
    product ? `Product name in UI: ${product}.` : 'Use a neutral product name from the user goal, not the Mobbin app brand.',
    ...copyRules.map((r) => `- ${r}`),
    '',
    '## Platform',
    `${brief.platformLabel} (${brief.platform}). ${frameHint}`,
    '',
    '## Mobbin reference',
    screenBlock,
    '',
    '## Additional style refs',
    brief.refsText,
    '',
    brief.styleBlock || '',
    '## Current Figma context',
    brief.selectionText,
    '',
    '## Kanban task (if any)',
    brief.taskText,
    '',
    '## Scope',
    scope,
    '',
    '## Placement',
    `Place NEW frames starting at x=${MOBBIN_PLAN_ORIGIN_X}, y=${MOBBIN_PLAN_ORIGIN_Y}. Do NOT draw on top of existing "Landing"/"Onboarding" frames — inspect page first.`,
    'Screens in a horizontal row, gap 48px, light backgrounds matching reference (no full-screen black unless reference is dark).',
    '',
    '## Rules',
    '- Do NOT ask clarifying questions — implement directly in Figma.',
    '- Mobbin = layout, spacing, colors only — never copy Revolut/foreign brand copy from the reference.',
    '- No overlapping circles/ellipses as hero art; use proper UI patterns (cards, inputs, buttons with labels).',
    '- When done, reply with a short Russian summary: what frames were created and where (coordinates).',
  ].join('\n');
}
