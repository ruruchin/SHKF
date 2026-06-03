import {
  SITE_BUILD_SYSTEM_PROMPT,
  buildSiteBuilderUserMessage,
  extractSiteBuildPlan,
  isSiteBuildIntent,
} from '../shared/site-builder-prompts.js';
import {
  BLUEPRINT_SYSTEM_PROMPT,
  extractBlueprint,
  inferBlueprintFromMessage,
  normalizeBlueprint,
} from '../shared/site-builder-blueprint.js';
import { buildProjectFromBlueprint } from '../shared/site-builder-scaffold.js';
import { buildTaskContextBlock } from '../shared/agent-prompts.js';
import { MobbinService, inferMobbinPlatform } from './mobbin-service.js';

export { isSiteBuildIntent };

export class SiteBuilderService {
  constructor(deps = {}) {
    this.mobbinService = deps.mobbinService || new MobbinService();
    this.designMemoryService = deps.designMemoryService || null;
    this.agentService = deps.agentService || null;
  }

  configure(agentSettings = {}) {
    this.mobbinService.configure(agentSettings);
    this.retrievalMode = agentSettings.designMemoryMode || 'hybrid';
    this.useMobbinLive = agentSettings.mobbinEnabled !== false;
    this.useLlmBlueprint = agentSettings.siteBuilderLlmBlueprint !== false;
  }

  async gatherReferences(message, options = {}) {
    const platform = options.platform || inferMobbinPlatform(message);
    const refs = [];
    let mobbinContext = '';
    let live = false;

    if (this.useMobbinLive && this.mobbinService.isConfigured()) {
      const liveResult = await this.mobbinService.gatherReferences(message, {
        platform,
        screenLimit: options.screenLimit ?? 8,
        flowLimit: options.flowLimit ?? 4,
      });
      if (liveResult.refs?.length) {
        refs.push(...liveResult.refs);
        mobbinContext = this.mobbinService.buildContextBlock(liveResult.refs, { platform });
        live = true;
      }
    }

    if (this.designMemoryService) {
      const local = await this.designMemoryService.retrieve(message, {
        limit: 8,
        mode: this.retrievalMode,
      });
      const merged = new Map();
      for (const item of [...refs, ...local]) {
        const key = item.url || item.id;
        if (key && !merged.has(key)) merged.set(key, item);
      }
      const allRefs = [...merged.values()].slice(0, 12);
      if (!mobbinContext && allRefs.length) {
        mobbinContext = this.designMemoryService.buildContextBlockFromRefs(allRefs, live ? 'mobbin+memory' : 'memory');
      } else if (allRefs.length > refs.length) {
        mobbinContext = [
          mobbinContext,
          '',
          this.designMemoryService.buildContextBlockFromRefs(
            allRefs.filter((r) => !refs.find((x) => x.url === r.url)),
            'memory',
          ),
        ].filter(Boolean).join('\n');
      }
      return { refs: allRefs, context: mobbinContext, platform, live };
    }

    return { refs, context: mobbinContext, platform, live };
  }

  async resolveBlueprint(message, refsBundle, task = null) {
    const fallback = inferBlueprintFromMessage(message, refsBundle.refs);

    if (!this.useLlmBlueprint || !this.agentService?.isConfigured()) {
      return { blueprint: fallback, source: 'deterministic' };
    }

    const userMessage = buildSiteBuilderUserMessage({
      message,
      refsContext: refsBundle.context,
      taskContext: task?.id ? buildTaskContextBlock(task) : '',
    });

    try {
      const chatResult = await this.agentService.chat({
        message: userMessage,
        history: [],
        task,
        systemPrompt: BLUEPRINT_SYSTEM_PROMPT,
        allowFollowups: false,
      });
      if (chatResult?.ok) {
        const parsed = extractBlueprint(chatResult.content);
        if (parsed?.pages?.length >= 2) {
          return { blueprint: normalizeBlueprint({ ...parsed, tokens: { ...fallback.tokens, ...parsed.tokens } }), source: 'llm+scaffold' };
        }
      }
    } catch {
      /* fallback */
    }

    return { blueprint: fallback, source: 'deterministic' };
  }

  async build({ message, task = null, history = [] } = {}) {
    if (!this.agentService?.isConfigured()) {
      return { ok: false, message: 'Подключите GigaChat: Настройки → ИИ Агент' };
    }

    const refsBundle = await this.gatherReferences(message);
    const { blueprint, source } = await this.resolveBlueprint(message, refsBundle, task);
    const plan = buildProjectFromBlueprint(blueprint);

    if (!plan?.files?.length) {
      return { ok: false, message: 'Не удалось собрать файлы проекта', refs: refsBundle.refs };
    }

    return {
      ok: true,
      plan,
      blueprint,
      buildMode: source,
      refs: refsBundle.refs,
      platform: refsBundle.platform,
      mobbinLive: refsBundle.live,
      model: source === 'llm+scaffold' ? 'site-scaffold-v2' : 'site-scaffold-v2-deterministic',
    };
  }

  /** Legacy: full LLM file dump (fallback only). */
  async buildLegacyLlm({ message, task = null, history = [] } = {}) {
    const refsBundle = await this.gatherReferences(message);
    const userMessage = buildSiteBuilderUserMessage({
      message,
      refsContext: refsBundle.context,
      taskContext: task?.id ? buildTaskContextBlock(task) : '',
    });
    const chatResult = await this.agentService.chat({
      message: userMessage,
      history,
      task,
      systemPrompt: SITE_BUILD_SYSTEM_PROMPT,
      allowFollowups: false,
    });
    if (!chatResult?.ok) {
      return { ok: false, message: chatResult?.message || 'Ошибка генерации сайта' };
    }
    let plan = extractSiteBuildPlan(chatResult.content);
    if (!plan?.files?.length) {
      return { ok: false, message: 'Модель не вернула файлы', refs: refsBundle.refs };
    }
    return { ok: true, plan, refs: refsBundle.refs, buildMode: 'llm-legacy', model: chatResult.model };
  }
}
