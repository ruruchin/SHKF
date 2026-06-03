import {
  SITE_BUILD_SYSTEM_PROMPT,
  buildSiteBuilderUserMessage,
  extractSiteBuildPlan,
  isSiteBuildIntent,
} from '../shared/site-builder-prompts.js';
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
  }

  async gatherReferences(message, options = {}) {
    const platform = options.platform || inferMobbinPlatform(message);
    const refs = [];
    let mobbinContext = '';
    let live = false;

    if (this.useMobbinLive && this.mobbinService.isConfigured()) {
      const liveResult = await this.mobbinService.gatherReferences(message, {
        platform,
        screenLimit: options.screenLimit ?? 6,
        flowLimit: options.flowLimit ?? 3,
      });
      if (liveResult.refs?.length) {
        refs.push(...liveResult.refs);
        mobbinContext = this.mobbinService.buildContextBlock(liveResult.refs, { platform });
        live = true;
      }
    }

    if (this.designMemoryService) {
      const local = await this.designMemoryService.retrieve(message, {
        limit: 6,
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

  async build({ message, task = null, history = [], systemPromptExtra = '' } = {}) {
    if (!this.agentService?.isConfigured()) {
      return { ok: false, message: 'Подключите GigaChat: Настройки → ИИ Агент' };
    }

    const refsBundle = await this.gatherReferences(message);
    const taskBlock = task?.id ? buildTaskContextBlock(task) : '';
    const userMessage = buildSiteBuilderUserMessage({
      message,
      refsContext: refsBundle.context,
      taskContext: taskBlock,
    });

    const systemPrompt = systemPromptExtra
      ? `${SITE_BUILD_SYSTEM_PROMPT}\n\n---\n${systemPromptExtra}`
      : SITE_BUILD_SYSTEM_PROMPT;

    const chatResult = await this.agentService.chat({
      message: userMessage,
      history,
      task,
      systemPrompt,
      allowFollowups: false,
    });

    if (!chatResult?.ok) {
      return { ok: false, message: chatResult?.message || 'Ошибка генерации сайта' };
    }

    let plan = extractSiteBuildPlan(chatResult.content);
    if (!plan?.files?.length && chatResult.content) {
      const repair = await this.agentService.chat({
        message: [
          'Преобразуй ответ в строгий JSON для SITE_BUILD_JSON.',
          'Верни только блок <<<SITE_BUILD_JSON ... SITE_BUILD_JSON>>> с полем files (массив path+content).',
          '',
          'Исходный ответ:',
          chatResult.content,
        ].join('\n'),
        history: [],
        task,
        systemPrompt: SITE_BUILD_SYSTEM_PROMPT,
        allowFollowups: false,
      });
      if (repair?.ok) plan = extractSiteBuildPlan(repair.content);
    }

    if (!plan?.files?.length) {
      return {
        ok: false,
        message: 'Модель не вернула файлы проекта. Уточните запрос (тип продукта, страницы, стиль).',
        refs: refsBundle.refs,
        raw: chatResult.content?.slice(0, 2000),
      };
    }

    return {
      ok: true,
      plan,
      refs: refsBundle.refs,
      platform: refsBundle.platform,
      mobbinLive: refsBundle.live,
      model: chatResult.model || null,
    };
  }
}
