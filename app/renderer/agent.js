(function () {
  let agentInited = false;
  let agentStatusCache = null;
  const QUICK = {
    analyze: 'Прочитай описание задачи целиком. Только из текста задачи: что просят, объём, риски, 3–5 вопросов заказчику со ссылкой на описание, с чего начать. Не выдумывай референсы (Mobbin, Airtime и т.п.), если их нет в задаче.',
    banner: 'Исходя из текста задачи, предложи 3 разных промпта для генерации баннера (размер, стиль, CTA). Каждый — готовый текст, опирайся на формулировки из описания.',
    bannerNano: 'Сделай баннер в NanoBanana: извлеки тему из описания задачи и сгенерируй изображение.',
    figmaEdit: 'Сформируй и примени план правок прямо в Figma: сначала покажи список изменений, потом по кнопке внеси их в макет.',
    landing: 'По описанию задачи: структура лендинга (блоки) и один детальный промпт для Figma Make — только то, что следует из задачи.',
    make: 'Сформируй детальный промпт для Figma Make по этой задаче и отправь его в Make: экраны, компоненты, состояния — строго из описания.',
    split: 'Разбей работу по задаче на подзадачи для дизайнера с порядком. Оценку часов — только если я просил. Только формулировки из описания задачи.',
    labor: 'Покажи все трудозатраты по этой задаче: кто сколько часов списал, даты и кратко что делал. Если спрашиваю про одного человека — только по нему. Только данные из Redmine, без выдумок.',
    // --- Разработка / продуктивность ---
    devPlan: 'Составь мне план работы на сегодня по задачам из Kanban: расставь приоритеты (что срочно/важно), оцени время на каждую и предложи порядок выполнения, чтобы закрыть максимум за день. Опирайся на реальные задачи и их статусы.',
    devStandup: 'Сформируй текст для дейли-стендапа по моим задачам: «Что сделал вчера», «Что делаю сегодня», «Блокеры». Коротко, по делу, на основе статусов задач из Kanban.',
    devEstimate: 'Оцени эту задачу как разработчик: декомпозиция на технические подзадачи (API, БД, фронт, тесты), оценка в часах по каждой, риски и неясности, 3–5 уточняющих вопросов. Только из описания задачи.',
    devReview: 'Дай чеклист для код-ревью этой задачи: что обязательно проверить (логика, edge-cases, безопасность, производительность, тесты, читаемость), на что обратить внимание ревьюеру именно в этой задаче.',
    devCommit: 'По описанию задачи предложи: 1) название ветки (feature/fix + краткий слаг), 2) сообщение коммита в стиле Conventional Commits, 3) заголовок и описание Pull Request (Что сделано / Как проверить / Связанная задача).',
    devProductivity: 'Проанализируй мои задачи из Kanban и список трудозатрат и дай честный разбор продуктивности: сколько задач в работе/закрыто, где застряло, что съедает время, и 3–5 конкретных советов как ускориться и улучшить показатели. Только реальные данные.',
    siteBuild: 'По описанию задачи: что нужно сделать в Figma, какие экраны — только из текста задачи, без выдуманных референсов.',
    mobbinStyle: 'Подбери из Mobbin 3 направления стиля для приложения, я выберу одно — и собери полный редизайн в Figma в этом стиле.',
    pmStatus: 'Сделай сводку статуса по всем задачам команды из Kanban: что в работе, что готово, что просрочено или висит без движения. Кратко и структурировано для отчёта.',
    pmRisks: 'Найди риски и узкие места по задачам из Kanban: что может сорвать сроки, где перегруз, какие задачи без оценки или зависают. Предложи действия.',
    learnedLessons: 'По выученному опыту и текущей задаче: какие похожие задачи мы закрывали. По каждой #issueId — **Факт из Redmine** (цитата/часы/%), **вывод**, **почему это про текущую задачу** (конкретное совпадение в ТЗ), **→ шаг**. Без абстрактных советов; done_ratio ≠ часы. Только блок опыта.',
    processOptimize: 'По этой задаче и данным Kanban: где теряется время, что уточнить у заказчика, как ускорить цикл. Не предлагай автоматически писать в Redmine.',
    learnedProject: 'Краткий отчёт: что Konstancia выучил по проекту текущей задачи (playbook и уроки). Только локальная память, без фантазий.',
    findRedmineFile: 'Найди файл в Redmine по теме (включая закрытые задачи). Укажи тему после двоеточия, например: Найди файл: листовка фк черноморец',
  };

  const AGENT_AVATAR_SRC = 'assets/agent/agent-avatar.png';

  function getAgentAvatarSrc() {
    return window.AgentLive2d?.getBrandAvatarSrc?.() || AGENT_AVATAR_SRC;
  }

  function agentAvatarHtml(size) {
    const s = size || 32;
    const src = getAgentAvatarSrc();
    const live = Boolean(window.AgentLive2d?.getBrandAvatarSrc?.());
    const srcAttr = live && src ? ` src="${escapeAttr(src)}"` : '';
    return `<span class="agent-brand-avatar" style="width:${s}px;height:${s}px"><img class="agent-avatar-img agent-brand-avatar-img${live ? ' agent-avatar-img--live2d' : ''}"${srcAttr} alt="" width="${s}" height="${s}" data-agent-brand-avatar${live ? ' data-live2d="1"' : ''} /></span>`;
  }

  function getUserProfile() {
    return window.getAuthState?.()?.profile || null;
  }

  function userProfileInitials(profile) {
    const name = String(profile?.full_name || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const fromName = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
      if (fromName) return fromName;
      return name.slice(0, 2).toUpperCase();
    }
    const login = profile?.username || String(profile?.email || '').split('@')[0] || '';
    return (login.slice(0, 2) || 'ВЫ').toUpperCase();
  }

  function userAvatarSrc(profile) {
    const raw = String(profile?.avatar_url || '').trim();
    if (!raw) return '';
    if (profile?.updated_at && !/[?&]v=/.test(raw)) {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}v=${encodeURIComponent(profile.updated_at)}`;
    }
    return raw;
  }

  function resolveUserAvatarUrl() {
    const profile = getUserProfile();
    const fromProfile = userAvatarSrc(profile);
    if (fromProfile) return fromProfile;
    const sidebar = document.getElementById('sidebar-user-avatar');
    if (sidebar?.classList.contains('has-img')) {
      const bg = sidebar.style.backgroundImage || '';
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/i);
      if (match?.[1]) return match[1];
    }
    const pfImg = document.getElementById('pf-avatar-img');
    if (pfImg?.classList.contains('has-img')) {
      const bg = pfImg.style.backgroundImage || '';
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/i);
      if (match?.[1]) return match[1];
    }
    return '';
  }

  function userAvatarInnerHtml() {
    const initials = userProfileInitials(getUserProfile());
    return escapeHtml(initials);
  }

  function mountUserMessageAvatar(wrap) {
    const el = wrap?.querySelector('.agent-msg-avatar');
    if (!el) return;
    const url = resolveUserAvatarUrl();
    const initials = userProfileInitials(getUserProfile());
    el.classList.remove('agent-msg-avatar--user-photo', 'is-fallback');
    el.style.backgroundImage = '';
    if (url) {
      if (el.dataset.avatarUrl === url && el.classList.contains('agent-msg-avatar--user-photo') && !el.classList.contains('is-fallback')) {
        return;
      }
      el.classList.add('agent-msg-avatar--user-photo');
      el.style.backgroundImage = `url("${String(url).replace(/"/g, '%22')}")`;
      el.textContent = '';
      el.dataset.avatarUrl = url;
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => {
        if (el.dataset.avatarUrl !== url) return;
        el.classList.remove('is-fallback');
        el.textContent = '';
      };
      probe.onerror = () => {
        if (el.dataset.avatarUrl !== url) return;
        el.classList.add('is-fallback');
        el.style.backgroundImage = '';
        el.textContent = initials;
      };
      probe.src = url;
      return;
    }
    delete el.dataset.avatarUrl;
    el.textContent = initials;
  }

  function refreshUserMessageAvatars() {
    if (!messagesEl) return;
    messagesEl.querySelectorAll('.agent-msg-user').forEach((wrap) => {
      mountUserMessageAvatar(wrap);
    });
  }

  /** @deprecated use isExplicitTaskWorkMessage — оставлено для syncTaskThreadFromHistory */
  const TASK_WORK_RE = /оцен|разбить|трудозатрат|уч[её]т\s+времени|сколько\s+час|списал|баннер|лендинг|figma\s*make|промпт|mobbin|моббин|\/site|\/figma|сверст|верст\w*\s+сайт|задач|redmine|kanban|уточн|заказчик|риск|стендап|коммит|pull\s*request|код.?ревью|план\s+на\s+день/i;

  const NB_WORD_RE = /(?:nano\s*banana|nanobanana|нанобанан|нанобанана)/i;
  const BANNER_WORD_RE = /(?:баннер|banner)/i;
  const GENERATE_WORD_RE = /сгенерир(?:уй|ируй)|генерир(?:уй|ируй)|сделай|создай|нарисуй|выдай|собери/i;
  const PROMPT_WORD_RE = /\bпромпт\b|prompt/i;
  const FIGMA_EDIT_RE = /(?:в\s*figma|фигм[ае]?|макет\s+figma|mockup|перерис|автолейаут|layout\s+figma|план\s+правок|примени\s+правк|внеси\s+правк|измени\s+(?:макет|figma)|поправь\s+(?:макет|figma)|сформируй\s+правк)/i;
  const TASK_REVIEW_RE = /проанализируй\s+задач|опиши\s+проблем|проблем\w*\s+в\s+правк|правк\w*\s+(?:которые|в\s+сообщен|из\s+сообщен|в\s+коммент|написали)|последн\w+\s+сообщен|разбор\s+правок|комментари\w*\s+заказчик/i;
  const SITE_BUILD_RE = /(?:сверст|верст|собери|сделай|создай|напиши|build|scaffold|generate).{0,40}(?:сайт|website|лендинг|landing|веб.?прилож|web\s*app|приложени[ея]|dashboard|админк|портал|многостранич|multi.?page)|(?:сайт|website|лендинг|landing|веб.?прилож|react\s*app|next\.?js).{0,40}(?:сверст|верст|собери|сделай|создай|напиши)/i;

  function isBannerNanobananaIntent(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (t === QUICK.bannerNano) return true;
    // Важно: НЕ триггеримся на «Промпт: баннер» / «предложи промпты…».
    // Для автогенерации в NanoBanana нужно явное намерение: упоминание NanoBanana
    // или глагол «сгенерируй/сделай» без слова «промпт».
    const hasNb = NB_WORD_RE.test(t);
    const hasBanner = BANNER_WORD_RE.test(t);
    const hasGenerate = GENERATE_WORD_RE.test(t);
    const hasPromptWord = PROMPT_WORD_RE.test(t);

    if (hasNb && hasBanner) return true;
    if (!hasNb) {
      if (hasPromptWord) return false; // «промпт баннер» — это не автогенерация
      if (hasBanner && hasGenerate) return true; // «сделай баннер на тему…»
    }
    return false;
  }

  function isTaskReviewIntent(text) {
    return TASK_REVIEW_RE.test(String(text || '').trim());
  }

  function isMobbinStyleRedesignIntent(text) {
    const t = String(text || '').trim();
    if (/^\/style\b/i.test(t)) return true;
    if (t === QUICK.mobbinStyle) return true;
    return /(?:в\s+каком\s+стил|предлож\w*\s+стил|выбери\s+стил|направлен\w*\s+стил|редизайн|переделай\s+прилож|оформи\s+прилож|дизайн.систем|стиль\s+прилож)/i.test(t)
      || (/\b(mobbin|моббин)\b/i.test(t) && /стил|редизайн|приложен/i.test(t));
  }

  function isFigmaEditIntent(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (isTaskReviewIntent(t)) return false;
    if (/^\/figma\b/i.test(t)) return true;
    if (/^\/site\b/i.test(t) && !wantsReactCodeExport(t)) return true;
    if (t === QUICK.siteBuild || t === QUICK.figmaEdit || t === QUICK.mobbinStyle) return true;
    if (/\bmobbin\b|моббин/i.test(t) && /макет|figma|собери|сделай|отрисуй|стил|редизайн/i.test(t)) return true;
    return FIGMA_EDIT_RE.test(t) && !NB_WORD_RE.test(t);
  }

  function wantsMobbinStyleFirstFlow(text) {
    return isMobbinStyleRedesignIntent(text)
      || /приложени|onboarding|login|register|инвест|fintech|многостранич|\/site\b/i.test(String(text || ''));
  }

  function wantsReactCodeExport(text) {
    const t = String(text || '').trim();
    if (!t || window.appSettings?.agent?.siteBuilderEnabled !== true) return false;
    return /^\/code\b/i.test(t) || /(react|vite|npm|tsx|jsx|исходник|код\s+проекта)/i.test(t);
  }

  function isSiteBuildIntent(text) {
    const t = String(text || '').trim();
    if (!t || !wantsReactCodeExport(t)) return false;
    return SITE_BUILD_RE.test(t) && !NB_WORD_RE.test(t);
  }

  function isFigmaMakeSendIntent(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (t === QUICK.make) return true;
    if (/^(?:что|кто|как|зачем|почему|объясни|расскажи|чем\s+отлича)/i.test(t)) return false;
    if (isFigmaEditIntent(t) || isSiteBuildIntent(t)) return false;
    if (/^\/make\b/i.test(t)) return true;
    if (!/\bfigma\s*make\b|\bфигма\s*мэйк\b|\bmake\s*it\b/i.test(t)) return false;
    if (/(?:отправ|закин|открой|запуст|сформируй|сделай|собери|сгенериру|создай|промпт|макет|в\s+make)/i.test(t)) return true;
    if (/\bfigma\s*make\b/i.test(t) && t.length <= 140) return true;
    return false;
  }

  const HISTORY_KEY_BASE = 'shkf-agent-history-v1';
  const SESSIONS_KEY_BASE = 'shkf-agent-sessions-v2';
  const IMPORTED_SHARES_KEY_BASE = 'shkf-agent-imported-shares-v1';
  const ACTIVE_SESSION_KEY_BASE = 'shkf-agent-active-session-v2';
  const SIDEBAR_COLLAPSED_KEY_BASE = 'shkf-agent-sidebar-collapsed-v1';
  const AGENT_CHAT_OPTS_KEY_BASE = 'shkf-agent-chat-opts-v1';
  let agentStorageUserId = 'guest';
  const MAX_SESSIONS = 50;
  const MAX_MESSAGES_PER_SESSION = 80;
  const MAX_STORED_MESSAGE_CHARS = 24000;
  const BRIEF_SHOWN_KEY_BASE = 'agent-brief-shown-date-v1';
  const BRIEF_LIST_LIMIT = 10;
  let lastBriefData = null;
  const briefExpandedSections = new Set();
  let messagesEl;
  let promptEl;
  let sendBtn;
  let taskSelect;
  let taskPickerTrigger;
  let taskPickerMenu;
  let taskPickerValue;
  let taskPickerOpen = false;
  let taskPickerFocusIdx = -1;
  let modelSelect;
  let statusBanner;
  let sessionListEl;
  let savingAgentModel = false;
  let chatHistory = [];
  let agentSessions = [];
  let activeSessionId = null;
  let sessionSelectMode = false;
  const selectedSessionIds = new Set();
  let shareColleagues = [];
  let shareSelectedColleagueId = null;
  let incomingShares = [];
  let sharePollTimer = null;
  let shareInboxInitialized = false;
  let shareSubmitting = false;
  let kanbanTasks = [];
  let sending = false;
  let messageAnimIndex = 0;
  let taskThreadActive = false;
  let pendingAgentImages = [];
  const MAX_PENDING_AGENT_IMAGES = 4;

  function isImageAttachmentFile(file) {
    if (!file) return false;
    if (file.type?.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|bmp|gif|heic|heif|avif)$/i.test(String(file.name || ''));
  }

  function revokePendingImageUrls(images = pendingAgentImages) {
    for (const img of images) {
      if (img?.previewUrl) {
        try { URL.revokeObjectURL(img.previewUrl); } catch { /* ignore */ }
      }
    }
  }

  function clearPendingAgentImages() {
    revokePendingImageUrls();
    pendingAgentImages = [];
    renderPendingAgentImages();
    updateSendState();
    syncStageState();
  }
  const pendingMockupPosts = new Map();
  const pendingFigmaPlans = new Map();
  const pendingFigmaMakeSessions = new Map();
  const pendingMobbinSessions = new Map();
  const shownCommentNotifyKeys = new Set();
  let metaskCommentWatchdogTimer = null;
  let metaskCommentWatchdogBusy = false;

  function isCasualChatQuery(text) {
    const raw = String(text || '').trim();
    const t = raw.replace(/[?!.,…]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2) return false;
    if (/что\s+такое|кто\s+такой|кто\s+такая|расскажи\s+о|объясни\s+(?:что|как|почему)|история\s+|в\s+интернет|погугли/i.test(t)) return false;
    if (/текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|эту\s+задач|трудозатрат|figma\s+make/i.test(t)) return false;
    if (/^(?:привет|здравствуй|здрав|хай|hello|хелло|йо|yo|хэй|салют|спасибо|благодар|пока|до\s+свидан)/i.test(t) || /^(?:привет|здравствуй|здрав|хай|hello|хелло|йо|yo|хэй|салют|спасибо|благодар|пока|до\s+свидан)/i.test(raw)) return true;
    if (/^(?:как\s+дела|как\s+ты|как\s+сам|как\s+жизнь|что\s+делаешь|чем\s+занят|чо\s+ты|чё\s+ты|че\s+ты|ты\s+тут|ты\s+здесь|норм|нормально|эй|алло|ау)$/i.test(t)) return true;
    if (/как\s+дела|как\s+ты|как\s+сам|как\s+настроение|как\s+у\s+тебя/.test(t) && t.length <= 40) return true;
    if (t.length <= 80 && /(?:^|\s)(?:konstancia|konstantsi|констанци[яи]|kost-?in)(?:\s|$|[?!.,])/i.test(t)) {
      if (/кто\s+такая?\s+констанци|что\s+такое\s+констанци|история\s+констанци/i.test(t)) return false;
      return true;
    }
    if (t.length <= 24 && /^(?:ок|окей|ага|угу|лол|хаха|хм+|эм+|ого|класс|круто|понял|ясно|спс|thanks)[\s!?.]*$/i.test(t)) return true;
    return false;
  }

  function isGeneralKnowledgeQuery(text) {
    const t = String(text || '').trim();
    if (!t || t.length < 3) return false;
    if (isCasualChatQuery(t)) return false;
    if (/текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|эту\s+задач|описани[ея]\s+задачи\s+целиком|разбей\s+работу\s+по\s+задач|трудозатрат|figma\s+make|промпт.*(?:баннер|лендинг)/i.test(t)) return false;
    if (/найди\s+файл|найти\s+файл|проиндексир|переиндексир|\.(psd|pdf|fig)\b|листовк|флаер|flyer/i.test(t)) return false;
    if (/похож.*задач|выучил|playbook|опыт\s+по\s+прошл/i.test(t)) return false;
    if (/\?/.test(t)) return true;
    if (/^(?:что|кто|где|когда|почему|зачем|как|сколько|расскажи|объясни|опиши|посоветуй|что\s+такое|кто\s+такой)/i.test(t)) return true;
    if (/в\s+интернет|погугли|загугли/i.test(t)) return true;
    return false;
  }

  function isGeneralAdvisoryQuery(text) {
    if (isGeneralKnowledgeQuery(text)) return true;
    const t = String(text || '').trim();
    if (!t) return false;
    if (/текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|эту\s+задач|описани[ея]\s+задачи\s+целиком|разбей\s+работу\s+по\s+задач|трудозатрат.*по\s+этой|из\s+текста\s+задачи|под\s+эту\s+задач|задач[аеуи]\s*#\s*\d|#\d{3,}\b|issue\s*#\s*\d/i.test(t)) {
      return false;
    }
    return /(?:^|\s)(?:какой|что|как)\s+бы\b|если\s+бы|мог\s+бы|сделал\s+бы|хотел\s+бы|стоит\s+ли|имеет\s+ли\s+смысл|предложи\s+иде|иде[ия]\s+для|придумай|в\s+целом|вообще|в\s+теории|гипотет|что\s+думаешь|тво[её]\s+мнение|посоветуй|советуешь|рекомендуешь|как\s+можно\s+улучш|как\s+улучшить|как\s+лучше|лучшие\s+практик|плагин|интеграц|автоматиз|оптимизир(?:овать|уй)\s+(?:задач|работу\s+в)|что\s+такое|зачем\s+нужн|почему\s+(?:в\s+)?(?:redmine|редмайн)/i.test(t);
  }

  function isTaskWorkRequest(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (isGeneralAdvisoryQuery(t)) return false;
    if (Object.values(QUICK).includes(t)) return true;
    if (isTaskReviewIntent(t)) return true;
    return TASK_WORK_RE.test(t);
  }

  const KANBAN_WIDE_QUICK = new Set([
    QUICK.devPlan,
    QUICK.devStandup,
    QUICK.devProductivity,
    QUICK.pmStatus,
    QUICK.pmRisks,
    QUICK.findRedmineFile,
  ]);

  function requiresSelectedTask(text) {
    const t = String(text || '').trim();
    if (!t || KANBAN_WIDE_QUICK.has(t)) return false;
    if (isGeneralKnowledgeQuery(t)) return false;
    if (isGeneralAdvisoryQuery(t)) return false;
    if (/найди\s+файл|найти\s+файл|где\s+лежит|проиндексир/i.test(t)) return false;
    if (Object.values(QUICK).includes(t)) return true;
    if (/текущ(ей|ую|ая)\s+задач|по\s+этой\s+задач|выучен.*опыт|похож.*задач|как\s+мы\s+(делали|закрывали)|playbook|урок/i.test(t)) {
      return true;
    }
    return isTaskWorkRequest(t);
  }

  const TASK_OPTIONAL_DECLINE = 'Не-а';
  let pendingTaskOptionalQuery = null;

  function isTaskOptionalDecline(text) {
    return /^не-а$/i.test(String(text || '').trim());
  }

  function parseTaskOptionalPick(text) {
    const m = String(text || '').trim().match(/^да\s*[—-]\s*задача\s*#(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function isOffTopicChat(text) {
    const t = String(text || '').trim().toLowerCase();
    if (isTaskWorkRequest(text)) return false;
    return /^(привет|здрав|хай|hello|hi\b|спасибо|thanks|пока|bye|мне\s+(груст|плох|тоск|одинок|жалко)|я\s+(груст|устал|устала)|просто\s+поговор|не\s+про\s+(работ|задач)|отвлеч|болта|как\s+дела|что\s+делаешь|скучно)/i.test(t)
      || /(^|\s)(груст|тоск|плохое\s+настро)/i.test(t);
  }

  function updateTaskThread(text) {
    if (isTaskWorkRequest(text)) taskThreadActive = true;
    else if (isOffTopicChat(text)) taskThreadActive = false;
  }

  function syncTaskThreadFromHistory() {
    taskThreadActive = false;
    for (const msg of chatHistory) {
      if (msg.role !== 'user') continue;
      if (msg.taskThread === true || isTaskWorkRequest(msg.content)) taskThreadActive = true;
      if (msg.taskThread === false || isOffTopicChat(msg.content)) taskThreadActive = false;
    }
  }

  function isPikReferencePrompt(text) {
    return /референс\s+ui\s+из\s+pik-folder/i.test(String(text || ''));
  }

  function shouldAllowFollowups(text, useTaskContext, task) {
    if (isPikReferencePrompt(text)) return true;
    if (!useTaskContext || !task?.id) return false;
    const t = String(text || '');
    if (/трудозатрат|уч[её]т\s+времени|сколько\s+час\s+списал|отработал/i.test(t)
      && !/уточн|заказчик|оцен|риск|разбить/i.test(t)) {
      return false;
    }
    return /уточн|заказчик|вопрос\w*\s+заказчик|риск|оцен|разбить|с\s+чего\s+начать|промпт|баннер|лендинг|figma\s*make|прочитай\s+описание\s+задач/i.test(t)
      || t === QUICK.analyze
      || t === QUICK.split;
  }

  function isTaskCommentFollowupText(text) {
    const t = String(text || '');
    return /уточн|заказчик|вопрос\w*\s+заказчик|риск|оцен|разбить|с\s+чего\s+начать|промпт|баннер|лендинг|figma\s*make|прочитай\s+описание\s+задач/i.test(t)
      || t === QUICK.analyze
      || t === QUICK.split;
  }

  function formatColleagueSendLabel(profile = {}) {
    const name = String(profile.full_name || '').trim();
    const username = String(profile.username || '').trim();
    if (name && username) return `Отправить · ${name} (@${username})`;
    if (name) return `Отправить · ${name}`;
    if (username) return `Отправить · @${username}`;
    return 'Отправить · коллеге';
  }

  function findTeamMessageCandidate(label, teamMessagePending) {
    if (!teamMessagePending?.candidates?.length) return null;
    return teamMessagePending.candidates.find((profile) => formatColleagueSendLabel(profile) === label) || null;
  }

  function classifyFollowupKind(text, hasTask, teamMessagePending = null) {
    const raw = String(text || '').trim();
    if (!raw || /^отмена$/i.test(raw)) return 'chat';
    if (/^да\s*[—-]\s*включить/i.test(raw)) return 'music';
    if (/^да\s*[—-]\s*открыть/i.test(raw)) return 'resource';
    if (/^Отправить\s+·/i.test(raw) || findTeamMessageCandidate(raw, teamMessagePending)) return 'team';
    if (hasTask && isTaskCommentFollowupText(raw)) return 'task';
    return 'chat';
  }

  function resolveFollowupsForDisplay(followups, task, showFollowups, options = {}) {
    if (!showFollowups || !followups?.length) {
      return { followups: null, taskId: null, chatFollowups: false, teamMessagePending: null };
    }
    const limit = options.teamMessagePending ? 5 : 3;
    const sliced = followups.slice(0, limit);
    if (options.chatFollowups || options.teamMessagePending || !task?.id) {
      return {
        followups: sliced,
        taskId: null,
        chatFollowups: true,
        teamMessagePending: options.teamMessagePending || null,
      };
    }
    const hasTaskComments = sliced.some((q) => classifyFollowupKind(q, true) === 'task');
    if (hasTaskComments) {
      return {
        followups: sliced,
        taskId: task.id,
        chatFollowups: false,
        teamMessagePending: null,
      };
    }
    return {
      followups: sliced,
      taskId: null,
      chatFollowups: true,
      teamMessagePending: options.teamMessagePending || null,
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function isAgentPageActive() {
    return !!$('page-agent')?.classList.contains('active');
  }

  function ensureBackgroundNotifyRoot() {
    let root = document.getElementById('agent-bg-notify-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'agent-bg-notify-root';
    root.className = 'agent-bg-notify-root';
    document.body.appendChild(root);
    return root;
  }

  function removeBackgroundNotifyCard(card) {
    if (!card) return;
    card.classList.add('is-leave');
    setTimeout(() => card.remove(), 180);
  }

  function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Ko';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function pushBackgroundNotifyCard({
    title = 'Konstancia',
    body = '',
    html = '',
    sticky = false,
    avatarHtml = '',
  }) {
    const root = ensureBackgroundNotifyRoot();
    const card = document.createElement('article');
    card.className = 'agent-bg-notify-card';
    const avatar = avatarHtml || `<span class="agent-bg-notify-avatar">${agentAvatarHtml(26)}</span>`;
    card.innerHTML = `
      <button type="button" class="agent-bg-notify-close" data-bg-note-close aria-label="Закрыть">×</button>
      <div class="agent-bg-notify-head">
        ${avatar}
        <div class="agent-bg-notify-head-main">
          <div class="agent-bg-notify-title">${escapeHtml(title)}</div>
          ${html || `<div class="agent-bg-notify-body">${escapeHtml(body)}</div>`}
        </div>
      </div>`;
    if (!html || !/data-bg-open-agent/.test(html)) {
      const foot = document.createElement('div');
      foot.className = 'agent-bg-notify-foot';
      foot.innerHTML = '<button type="button" class="agent-bg-notify-open" data-bg-open-agent>Открыть Konstancia</button>';
      card.appendChild(foot);
    }
    root.prepend(card);
    while (root.children.length > 4) root.lastElementChild?.remove();
    if (!sticky) {
      const ttl = setTimeout(() => removeBackgroundNotifyCard(card), 9000);
      card.dataset.ttl = String(ttl);
    }
    return card;
  }

  function showBackgroundMockupReadyCard(token, task, mockups) {
    const previews = mockups.slice(0, 3)
      .map((m) => `<span class="agent-mockup-chip">${escapeHtml(m.label || `${m.width}x${m.height}`)}</span>`)
      .join('');
    const extra = mockups.length > 3
      ? `<span class="agent-mockup-more">+${mockups.length - 3}</span>`
      : '';
    const html = `
      <div class="agent-mockup-ready" data-bg-mockup-token="${escapeAttr(token)}">
        <div class="agent-bg-notify-body"><strong>Мокапы готовы.</strong> Отправляем в задачу <strong>#${escapeHtml(task.id)}</strong>?</div>
        <div class="agent-mockup-sub">Комментарий: <em>Сделал вариант баннера.</em></div>
        <div class="agent-mockup-chips">${previews}${extra}</div>
        <div class="agent-mockup-actions">
          <button type="button" class="agent-link-btn agent-link-btn--apply" data-bg-mockup-send="${escapeAttr(token)}">Отправить</button>
          <button type="button" class="agent-link-btn agent-link-btn--dismiss" data-bg-mockup-cancel="${escapeAttr(token)}">Не отправлять</button>
        </div>
      </div>`;
    return pushBackgroundNotifyCard({
      title: 'Konstancia · Redmine',
      html,
      sticky: true,
    });
  }

  function showBackgroundTaskCommentCard(event) {
    const issueId = Number(event?.issueId || 0);
    const issueUrl = String(event?.issueUrl || '').trim();
    const userName = String(event?.user?.name || 'Участник').trim() || 'Участник';
    const text = String(event?.text || '').trim() || 'Добавил комментарий';
    window.api.agentNotifyBackground?.({
      title: `Redmine · #${issueId}`,
      subtitle: `${userName}: ${text.slice(0, 180)}`,
      icon: 'redmine',
      action: { type: 'metask-open-task', id: issueId, url: issueUrl },
    }).catch(() => {});
  }

  function markBackgroundMockupDecision(token, text, ok = false) {
    const root = [...document.querySelectorAll('[data-bg-mockup-token]')]
      .find((el) => el.getAttribute('data-bg-mockup-token') === token);
    if (!root) return;
    root.querySelector('.agent-mockup-actions')?.remove();
    const p = document.createElement('p');
    p.className = `agent-link-status${ok ? ' agent-link-status--ok' : ''}`;
    p.textContent = text;
    root.appendChild(p);
  }

  function bindBackgroundNotifyActions() {
    const root = ensureBackgroundNotifyRoot();
    if (root.dataset.bound) return;
    root.dataset.bound = '1';
    root.addEventListener('click', (event) => {
      const close = event.target.closest('[data-bg-note-close]');
      if (close) {
        removeBackgroundNotifyCard(close.closest('.agent-bg-notify-card'));
        return;
      }
      const open = event.target.closest('[data-bg-open-agent]');
      if (open) {
        document.querySelector('.nav-item[data-page="agent"]')?.click();
        return;
      }
      const openTask = event.target.closest('[data-bg-open-metask-task]');
      if (openTask) {
        const issueId = openTask.getAttribute('data-bg-open-metask-task');
        const taskUrl = openTask.getAttribute('data-bg-open-metask-url') || '';
        openTaskInKanban(issueId, taskUrl);
        return;
      }
      const send = event.target.closest('[data-bg-mockup-send]');
      if (send) {
        const token = send.getAttribute('data-bg-mockup-send');
        send.disabled = true;
        send.textContent = 'Отправляю…';
        postMockupsToTask(token).finally(() => {
          if (send.isConnected) send.disabled = false;
        });
        return;
      }
      const cancel = event.target.closest('[data-bg-mockup-cancel]');
      if (cancel) {
        const token = cancel.getAttribute('data-bg-mockup-cancel');
        pendingMockupPosts.delete(token);
        markBackgroundMockupDecision(token, 'Отправку отменили');
      }
    });
  }

  function handleMetaskCommentUpdates(events) {
    if (!Array.isArray(events) || !events.length) return;
    if (isAgentPageActive()) return;
    for (const event of events) {
      const key = String(event?.key || `${event?.issueId}:${event?.journalId || ''}`);
      if (!key || shownCommentNotifyKeys.has(key)) continue;
      shownCommentNotifyKeys.add(key);
      showBackgroundTaskCommentCard(event);
      beepAgentNotification();
    }
  }

  async function runMetaskCommentWatchdogTick() {
    if (metaskCommentWatchdogBusy) return;
    metaskCommentWatchdogBusy = true;
    try {
      await window.api.metaskSync?.();
    } catch {
      /* ignore; main process already handles retries */
    } finally {
      metaskCommentWatchdogBusy = false;
    }
  }

  async function startMetaskCommentWatchdog() {
    if (metaskCommentWatchdogTimer) return;
    try {
      const info = await window.api.metaskGetInfo?.();
      const settings = info?.settings || {};
      const configured = !!(String(settings.baseUrl || '').trim() && String(settings.apiKey || '').trim());
      if (!configured) return;
    } catch {
      return;
    }

    setTimeout(() => {
      runMetaskCommentWatchdogTick();
    }, 2000);
    metaskCommentWatchdogTimer = setInterval(() => {
      runMetaskCommentWatchdogTick();
    }, 20 * 1000);
  }

  function beepAgentNotification() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume?.();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      /* ignore autoplay/sound errors */
    }
  }

  async function notifyIfAgentInBackground({ title = 'Konstancia', body = '' } = {}) {
    if (isAgentPageActive()) return;
    const text = String(body || '').trim();
    if (!text) return;
    beepAgentNotification();
    try {
      await window.api.agentNotifyBackground?.({ title, subtitle: text, icon: 'agent' });
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function isLaborCostQuery(text) {
    return /трудозатрат|уч[её]т\s+времени|сколько\s+час|списал|списали|отработал|затратил/i.test(String(text || ''));
  }

  function laborPluralRu(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function formatLaborRelativeTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return String(isoDate);
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'только что';
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `${minutes} ${laborPluralRu(minutes, 'минуту', 'минуты', 'минут')} назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${laborPluralRu(hours, 'час', 'часа', 'часов')} назад`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ${laborPluralRu(days, 'день', 'дня', 'дней')} назад`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${laborPluralRu(months, 'месяц', 'месяца', 'месяцев')} назад`;
    const years = Math.floor(months / 12);
    return `${years} ${laborPluralRu(years, 'год', 'года', 'лет')} назад`;
  }

  function formatLaborHours(hours) {
    if (hours == null) return '—';
    return String(Math.round(hours * 100) / 100).replace('.', ',');
  }

  function laborInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatLaborDescription(text) {
    return String(text || '')
      .split('\n')
      .map((line) => line.trim().replace(/^[-•]\s*/, ''))
      .filter(Boolean)
      .join(', ')
      .trim();
  }

  function taskAvatarHue(id) {
    return (Number(id) * 17) % 360;
  }

  function buildTaskAssigneeAvatar(person, index, total) {
    const hue = taskAvatarHue(person.id);
    const initials = laborInitials(person.name);
    const title = escapeAttr(person.name);
    const style = `--task-avatar-hue:${hue};z-index:${total - index}`;
    if (person.avatarUrl) {
      return (
        `<span class="agent-task-avatar agent-task-avatar--photo" style="${style}" title="${title}">`
        + `<img class="agent-task-avatar-img" src="${escapeAttr(person.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
        + `<span class="agent-task-avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>`
        + '</span>'
      );
    }
    return `<span class="agent-task-avatar" style="${style}" title="${title}">${escapeHtml(initials)}</span>`;
  }

  function buildTaskAssigneesHtml(assignees, { max = 3 } = {}) {
    if (!assignees?.length) return '';
    const visible = assignees.slice(0, max);
    const extra = assignees.length - max;
    const avatars = visible.map((person, index) => buildTaskAssigneeAvatar(person, index, visible.length)).join('');
    const more = extra > 0
      ? `<span class="agent-task-avatar agent-task-avatar--more" title="Ещё ${extra}">+${extra}</span>`
      : '';
    return `<span class="agent-task-assignees">${avatars}${more}</span>`;
  }

  function resolveKanbanTask(issueId) {
    const id = Number(issueId);
    if (!id) return null;
    return kanbanTasks.find((t) => Number(t.id) === id) || null;
  }

  function buildAgentTaskFileHtml(issueId, attachmentId, filename) {
    const id = Number(issueId);
    const attId = Number(attachmentId);
    const name = escapeHtml(String(filename || 'файл').trim().slice(0, 120));
    if (!id || !attId) return '';
    return (
      `<button type="button" class="agent-task-file" data-task-file-issue="${id}" data-task-file-id="${attId}" title="Открыть вложение">`
      + '<span class="agent-task-file-icon" aria-hidden="true">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      + '</span>'
      + `<span class="agent-task-file-name">${name}</span>`
      + '</button>'
    );
  }

  function buildAgentTaskCardHtml(issueId, noteExtra = '') {
    const id = Number(issueId);
    if (!id) return '';
    const task = resolveKanbanTask(id);
    const url = escapeAttr(task?.url || '');
    const subjectRaw = String(task?.subject || noteExtra || 'Задача Redmine').trim();
    const subject = escapeHtml(subjectRaw.length > 88 ? `${subjectRaw.slice(0, 88)}…` : subjectRaw);
    const note = noteExtra && task?.subject && noteExtra !== task.subject
      ? escapeHtml(String(noteExtra).trim().slice(0, 120))
      : '';
    const assignees = task?.assignees?.length ? buildTaskAssigneesHtml(task.assignees, { max: 4 }) : '';
    const metaParts = [];
    if (task?.project) metaParts.push(`<span class="agent-task-ref-project">${escapeHtml(task.project)}</span>`);
    if (task?.status) metaParts.push(`<span class="agent-task-ref-status">${escapeHtml(task.status)}</span>`);
    const meta = metaParts.length ? `<span class="agent-task-ref-meta">${metaParts.join('')}</span>` : '';
    return (
      `<button type="button" class="agent-task-ref" data-open-metask-task="${id}" data-open-metask-url="${url}" title="Открыть #${id} в Канбан">`
      + (assignees ? `<span class="agent-task-ref-assignees">${assignees}</span>` : '')
      + `<span class="agent-task-ref-body">`
      + `<span class="agent-task-ref-top">`
      + `<span class="agent-task-ref-id">#${id}</span>`
      + meta
      + `</span>`
      + `<span class="agent-task-ref-subject">${subject}</span>`
      + (note ? `<span class="agent-task-ref-note">${note}</span>` : '')
      + `</span>`
      + `<span class="agent-task-ref-go" aria-hidden="true">`
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18l6-6-6-6"/></svg>'
      + '</span>'
      + '</button>'
    );
  }

  function buildTaskRefChipHtml(issueId) {
    const id = Number(issueId);
    if (!id) return '';
    const task = resolveKanbanTask(id);
    const url = escapeAttr(task?.url || '');
    const subjectRaw = String(task?.subject || '').trim();
    const subjectShort = subjectRaw
      ? escapeHtml(subjectRaw.length > 42 ? `${subjectRaw.slice(0, 42)}…` : subjectRaw)
      : '';
    const label = subjectShort ? `#${id} · ${subjectShort}` : `#${id}`;
    return (
      `<button type="button" class="agent-task-chip" data-open-metask-task="${id}" data-open-metask-url="${url}" title="${escapeAttr(task?.subject || `Задача #${id}`)}">${label}</button>`
    );
  }

  function escapeHtmlWithTaskRefs(text) {
    const raw = String(text ?? '');
    const re = /#(\d{4,})\b/g;
    const parts = [];
    let last = 0;
    let match;
    while ((match = re.exec(raw)) !== null) {
      if (match.index > last) parts.push(escapeHtml(raw.slice(last, match.index)));
      const chip = buildTaskRefChipHtml(match[1]);
      parts.push(chip || escapeHtml(match[0]));
      last = re.lastIndex;
    }
    if (last < raw.length) parts.push(escapeHtml(raw.slice(last)));
    return parts.join('');
  }

  function preprocessTaskCards(source) {
    return String(source || '').split('\n').map((line) => {
      const trimmed = line.trim();
      let m = trimmed.match(/^(?:\d+\.\s*)?(?:\*\*)?#(\d{4,})\s*\[[^\]]+\]\s*\*?\*?\s*[:\-]?\s*(.*)$/);
      if (m) {
        const extra = (m[2] || '').trim();
        return `<<<TASKCARD ${m[1]}${extra ? `|${extra}` : ''}>>>`;
      }
      m = trimmed.match(/^(?:\d+\.\s*)?#(\d{4,})\s*(?:[:\-·]\s*(.*))?$/);
      if (!m) return line;
      const extra = (m[2] || '').trim();
      return `<<<TASKCARD ${m[1]}${extra ? `|${extra}` : ''}>>>`;
    }).join('\n');
  }

  function bindTaskAvatarFallbacks(root) {
    root?.querySelectorAll('.agent-task-avatar-img').forEach((img) => {
      if (img.dataset.taskAvBound) return;
      img.dataset.taskAvBound = '1';
      const onFail = () => {
        const wrap = img.closest('.agent-task-avatar');
        if (!wrap) return;
        wrap.classList.add('is-fallback');
        img.remove();
      };
      img.addEventListener('error', onFail, { once: true });
      if (img.complete && img.naturalWidth === 0) onFail();
    });
  }

  function buildLaborAvatarHtml(entry) {
    const initials = laborInitials(entry.user);
    const hue = (Number(entry.userId) || entry.user?.length || 0) * 47 % 360;
    if (entry.avatarUrl) {
      return (
        `<div class="agent-labor-avatar" style="--labor-avatar-hue:${hue}">`
        + `<img class="agent-labor-avatar-img" src="${escapeAttr(entry.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
        + `<span class="agent-labor-avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>`
        + '</div>'
      );
    }
    return `<div class="agent-labor-avatar agent-labor-avatar--initials" style="--labor-avatar-hue:${hue}" aria-hidden="true">${escapeHtml(initials)}</div>`;
  }

  function buildLaborEntryHtml(entry) {
    const when = formatLaborRelativeTime(entry.date || entry.spentOn);
    const verb = entry.kind === 'time_entry' || entry.source === 'time_entry' ? 'Списал(а)' : 'Добавил(а)';
    const hours = formatLaborHours(entry.hours);
    const desc = formatLaborDescription(entry.description || entry.comments);
    const activity = entry.activity ? `<div class="agent-labor-activity">${escapeHtml(entry.activity)}</div>` : '';

    return (
      `<article class="agent-labor-entry">`
      + buildLaborAvatarHtml(entry)
      + `<div class="agent-labor-body">`
      + `<div class="agent-labor-meta">${verb} <strong>${escapeHtml(entry.user)}</strong>${when ? ` ${escapeHtml(when)}` : ''}</div>`
      + `<div class="agent-labor-hours"><strong>Трудозатраты:</strong> ${escapeHtml(hours)} ч</div>`
      + (desc ? `<div class="agent-labor-desc">${escapeHtml(desc)}</div>` : '')
      + activity
      + `</div></article>`
    );
  }

  function buildLaborCardsHtml(entries) {
    if (!entries?.length) return '';
    const cards = entries.map((entry) => buildLaborEntryHtml(entry)).join('');
    return `<div class="agent-labor-list">${cards}</div>`;
  }

  function bindLaborAvatarFallbacks(root) {
    root?.querySelectorAll('.agent-labor-avatar-img').forEach((img) => {
      if (img.dataset.laborBound) return;
      img.dataset.laborBound = '1';
      const onFail = () => {
        img.style.display = 'none';
        img.closest('.agent-labor-avatar')?.classList.add('is-fallback');
      };
      img.addEventListener('error', onFail, { once: true });
      if (img.complete && img.naturalWidth === 0) onFail();
    });
  }

  function formatLaborPreviewNotes(hours, description) {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return '';
    const h = String(Math.round(value * 100) / 100).replace('.', ',');
    const lines = String(description || '')
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    let notes = `Трудозатраты: ${h} ч`;
    if (lines.length) {
      notes += `\n\nОписание участия:\n${lines.map((l) => (l.startsWith('•') ? l : `• ${l}`)).join('\n')}`;
    }
    return notes;
  }

  function taskSelectLabel(taskId) {
    if (!taskId) return '— Без задачи —';
    const task = kanbanTasks.find((t) => String(t.id) === String(taskId));
    if (!task) return '— Без задачи —';
    const subject = String(task.subject || '').trim();
    const short = subject.length > 52 ? `${subject.slice(0, 52)}…` : subject;
    return `#${task.id} · ${short}`;
  }

  function syncTaskPickerDisplay() {
    const val = taskSelect?.value || '';
    const task = kanbanTasks.find((t) => String(t.id) === val);
    const assigneesEl = $('agent-task-picker-assignees');
    if (taskPickerValue) {
      taskPickerValue.textContent = taskSelectLabel(val);
      taskPickerTrigger && (taskPickerTrigger.title = task?.subject || 'Задача из Kanban');
    }
    if (assigneesEl) {
      if (task?.assignees?.length) {
        assigneesEl.innerHTML = buildTaskAssigneesHtml(task.assignees, { max: 4 });
        assigneesEl.classList.remove('hidden');
        bindTaskAvatarFallbacks(assigneesEl);
      } else {
        assigneesEl.innerHTML = '';
        assigneesEl.classList.add('hidden');
      }
    }
    taskPickerMenu?.querySelectorAll('.agent-task-picker-option').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.value === val);
      el.setAttribute('aria-selected', el.dataset.value === val ? 'true' : 'false');
    });
  }

  function setTaskSelectValue(val, { silent = false } = {}) {
    if (!taskSelect) return;
    taskSelect.value = val || '';
    syncTaskPickerDisplay();
    if (!silent) taskSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function positionTaskPickerMenu() {
    if (!taskPickerMenu || !taskPickerTrigger || taskPickerMenu.classList.contains('hidden')) return;
    const rect = taskPickerTrigger.getBoundingClientRect();
    taskPickerMenu.style.position = 'fixed';
    taskPickerMenu.style.top = `${Math.round(rect.bottom + 4)}px`;
    taskPickerMenu.style.left = `${Math.round(rect.left)}px`;
    taskPickerMenu.style.width = `${Math.round(rect.width)}px`;
    taskPickerMenu.style.right = 'auto';
    taskPickerMenu.style.maxHeight = `${Math.max(160, Math.min(380, window.innerHeight - rect.bottom - 16))}px`;
  }

  function resetTaskPickerMenuPosition() {
    if (!taskPickerMenu) return;
    taskPickerMenu.style.position = '';
    taskPickerMenu.style.top = '';
    taskPickerMenu.style.left = '';
    taskPickerMenu.style.width = '';
    taskPickerMenu.style.right = '';
    taskPickerMenu.style.maxHeight = '';
  }

  function closeTaskPicker() {
    if (!taskPickerOpen) return;
    taskPickerOpen = false;
    taskPickerFocusIdx = -1;
    taskPickerMenu?.classList.add('hidden');
    taskPickerTrigger?.classList.remove('is-open');
    taskPickerTrigger?.setAttribute('aria-expanded', 'false');
    taskPickerMenu?.querySelectorAll('.agent-task-picker-option.is-focused').forEach((el) => {
      el.classList.remove('is-focused');
    });
    taskPickerMenu?.querySelectorAll('.agent-task-picker-option.is-hover').forEach((el) => {
      el.classList.remove('is-hover');
    });
    resetTaskPickerMenuPosition();
    window.removeEventListener('scroll', positionTaskPickerMenu, true);
    window.removeEventListener('resize', positionTaskPickerMenu);
    document.body.classList.remove('agent-task-picker-open');
  }

  function setSettingsMenuOpen(open) {
    const menu = $('agent-settings-menu');
    if (!menu) return;
    menu.classList.toggle('hidden', !open);
    document.body.classList.toggle('agent-settings-open', open);
    if (open) {
      positionSettingsMenu();
    }
  }

  function positionSettingsMenu() {
    const btn = $('agent-settings-btn');
    const menu = $('agent-settings-menu');
    if (!btn || !menu || menu.classList.contains('hidden')) return;
    const rect = btn.getBoundingClientRect();
    const width = menu.offsetWidth || 260;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    menu.style.position = 'fixed';
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = 'auto';
  }

  function mountTaskPickerMenu() {
    if (taskPickerMenu && taskPickerMenu.parentElement !== document.body) {
      document.body.appendChild(taskPickerMenu);
    }
  }

  function mountSettingsMenu() {
    const menu = $('agent-settings-menu');
    if (menu && menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
  }

  function getTaskPickerOptions() {
    return [...(taskPickerMenu?.querySelectorAll('.agent-task-picker-option:not(.is-disabled)') || [])];
  }

  function focusTaskPickerOption(idx) {
    const options = getTaskPickerOptions();
    if (!options.length) return;
    const i = Math.max(0, Math.min(options.length - 1, idx));
    taskPickerFocusIdx = i;
    taskPickerMenu?.querySelectorAll('.agent-task-picker-option').forEach((el) => {
      el.classList.toggle('is-focused', el === options[i]);
      el.classList.remove('is-hover');
    });
    options[i]?.scrollIntoView({ block: 'nearest' });
  }

  function openTaskPicker() {
    if (!taskPickerMenu || !taskPickerTrigger) return;
    setSettingsMenuOpen(false);
    mountTaskPickerMenu();
    renderTaskPickerMenu();
    taskPickerOpen = true;
    taskPickerMenu.classList.remove('hidden');
    taskPickerTrigger.classList.add('is-open');
    taskPickerTrigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('agent-task-picker-open');
    positionTaskPickerMenu();
    window.addEventListener('scroll', positionTaskPickerMenu, true);
    window.addEventListener('resize', positionTaskPickerMenu);
    const options = getTaskPickerOptions();
    const val = taskSelect?.value || '';
    const selectedIdx = options.findIndex((el) => el.dataset.value === val);
    taskPickerFocusIdx = selectedIdx >= 0 ? selectedIdx : 0;
    focusTaskPickerOption(taskPickerFocusIdx);
  }

  function renderTaskPickerMenu() {
    if (!taskPickerMenu) return;
    taskPickerMenu.innerHTML = '';

    const addOption = (value, label, { disabled = false, muted = false, assignees = null } = {}) => {
      const li = document.createElement('li');
      li.className = `agent-task-picker-option${muted ? ' agent-task-picker-option--muted' : ''}`;
      li.dataset.value = value;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const labelHtml = `<span class="agent-task-picker-option-label">${escapeHtml(label)}</span>`;
      const assigneeHtml = assignees?.length ? buildTaskAssigneesHtml(assignees, { max: 3 }) : '';
      li.innerHTML = assigneeHtml ? `${assigneeHtml}${labelHtml}` : labelHtml;
      if (disabled) {
        li.classList.add('is-disabled');
        li.setAttribute('aria-disabled', 'true');
        return li;
      }
      li.addEventListener('mouseenter', () => {
        taskPickerMenu?.querySelectorAll('.agent-task-picker-option.is-hover').forEach((el) => {
          el.classList.remove('is-hover');
        });
        li.classList.add('is-hover');
      });
      li.addEventListener('mouseleave', () => {
        li.classList.remove('is-hover');
      });
      const pickOption = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTaskSelectValue(value);
        closeTaskPicker();
      };
      li.addEventListener('mousedown', pickOption);
      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      return li;
    };

    taskPickerMenu.appendChild(addOption('', '— Без задачи —', { muted: true }));

    if (!kanbanTasks.length) {
      taskPickerMenu.appendChild(addOption('', 'Нет задач — откройте Kanban', { disabled: true, muted: true }));
      syncTaskPickerDisplay();
      return;
    }

    kanbanTasks.forEach((task) => {
      const subject = String(task.subject || '').trim();
      const short = subject.length > 64 ? `${subject.slice(0, 64)}…` : subject;
      const li = addOption(String(task.id), `#${task.id} · ${short}`, { assignees: task.assignees });
      if (subject) li.title = subject;
      taskPickerMenu.appendChild(li);
    });

    bindTaskAvatarFallbacks(taskPickerMenu);
    syncTaskPickerDisplay();
  }

  function bindTaskPickerUi() {
    mountTaskPickerMenu();
    taskPickerTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (taskPickerOpen) closeTaskPicker();
      else openTaskPicker();
    });

    taskPickerTrigger?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!taskPickerOpen) openTaskPicker();
        else if (e.key === 'ArrowDown') focusTaskPickerOption(taskPickerFocusIdx + 1);
      } else if (e.key === 'ArrowUp' && taskPickerOpen) {
        e.preventDefault();
        focusTaskPickerOption(taskPickerFocusIdx - 1);
      } else if (e.key === 'Escape') {
        closeTaskPicker();
      }
    });

    taskPickerMenu?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    taskPickerMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    taskPickerMenu?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusTaskPickerOption(taskPickerFocusIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusTaskPickerOption(taskPickerFocusIdx - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = getTaskPickerOptions()[taskPickerFocusIdx];
        if (opt?.dataset.value != null) {
          setTaskSelectValue(opt.dataset.value);
          closeTaskPicker();
        }
      } else if (e.key === 'Escape') {
        closeTaskPicker();
        taskPickerTrigger?.focus();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!taskPickerOpen) return;
      if (e.target.closest('#agent-task-picker-trigger')
        || e.target.closest('#agent-task-picker-menu')
        || e.target.closest('.agent-task-picker-menu')) return;
      if (e.target.closest('#agent-settings-menu') || e.target.closest('#agent-settings-btn')) return;
      closeTaskPicker();
    }, true);
  }

  function selectTaskById(taskId) {
    if (!taskSelect || !taskId) return;
    setTaskSelectValue(String(taskId));
    taskThreadActive = true;
  }

  function renderBriefTaskItem(task, extra, variant = 'default') {
    const subject = escapeHtml((task.subject || 'Без темы').slice(0, 72));
    const meta = escapeHtml(extra || '');
    const variantClass = variant && variant !== 'default' ? ` agent-brief-item--${variant}` : '';
    return (
      `<button type="button" class="agent-brief-item${variantClass}" data-brief-task-id="${task.id}">`
      + `<strong>#${task.id} · ${subject}</strong>`
      + (meta ? `<span>${meta}</span>` : '')
      + '</button>'
    );
  }

  function renderBriefSection(title, sectionId, itemsHtml, totalCount) {
    const expanded = briefExpandedSections.has(sectionId);
    const needsMore = totalCount > BRIEF_LIST_LIMIT;
    const collapsedClass = needsMore && !expanded ? ' agent-brief-list--collapsed' : '';
    const hiddenFrom = needsMore && !expanded ? BRIEF_LIST_LIMIT : totalCount;
    const moreBtn = needsMore
      ? (
        `<button type="button" class="agent-brief-more" data-brief-more="${escapeAttr(sectionId)}">`
        + (expanded
          ? 'Свернуть'
          : `Показать ещё (${totalCount - BRIEF_LIST_LIMIT})`)
        + '</button>'
      )
      : '';

    return (
      `<div class="agent-brief-section" data-brief-section="${escapeAttr(sectionId)}">`
      + `<h4>${escapeHtml(title)}${totalCount ? ` · ${totalCount}` : ''}</h4>`
      + `<div class="agent-brief-list${collapsedClass}" data-brief-limit="${hiddenFrom}">`
      + itemsHtml
      + '</div>'
      + moreBtn
      + '</div>'
    );
  }

  function wrapBriefItemsWithHiddenIndex(itemsHtmlArray) {
    return itemsHtmlArray.map((html, index) => {
      const hidden = index >= BRIEF_LIST_LIMIT ? ' is-brief-hidden' : '';
      return `<div class="agent-brief-item-wrap${hidden}">${html}</div>`;
    }).join('');
  }

  function buildBriefHtml(brief) {
    if (!brief || brief.empty) {
      return '<p class="agent-panel-placeholder">Активных задач в Kanban нет — синхронизация прошла, список пуст.</p>';
    }

    const parts = [];
    parts.push(`<p class="agent-brief-greeting">${escapeHtml(brief.greeting)}</p>`);
    parts.push(`<p class="agent-brief-stats">Активных задач: <strong>${brief.total}</strong></p>`);

    if (brief.updatedTasks?.length) {
      const items = brief.updatedTasks.map((task) => renderBriefTaskItem(task, task.status || '', 'updated'));
      parts.push(renderBriefSection(
        'Обновилось с прошлого раза',
        'updated',
        wrapBriefItemsWithHiddenIndex(items),
        items.length,
      ));
    }

    if (brief.topStart?.length) {
      const items = brief.topStart.map(({ task, reason }) => renderBriefTaskItem(task, reason, 'top'));
      parts.push(renderBriefSection(
        'С чего начать',
        'start',
        wrapBriefItemsWithHiddenIndex(items),
        items.length,
      ));
    }

    if (brief.staleTasks?.length) {
      const items = brief.staleTasks.map((task) => {
        const days = Math.floor((Date.now() - new Date(task.updatedOn).getTime()) / 86_400_000);
        return renderBriefTaskItem(task, `${days} дн. · ${task.status || ''}`, 'stale');
      });
      parts.push(renderBriefSection(
        'Давно без движения',
        'stale',
        wrapBriefItemsWithHiddenIndex(items),
        items.length,
      ));
    }

    if (brief.processInsights?.length) {
      const items = brief.processInsights.map((ins) => (
        `<div class="agent-brief-insight agent-brief-insight--${escapeHtml(ins.severity || 'low')}">`
        + `<strong>${escapeHtml(ins.title || '')}</strong>`
        + (ins.detail ? `<p>${escapeHtml(ins.detail).replace(/\n/g, '<br>')}</p>` : '')
        + (ins.action ? `<p class="agent-brief-insight-action">${escapeHtml(ins.action)}</p>` : '')
        + '</div>'
      ));
      parts.push(renderBriefSection('Инсайты процессов', 'insights', items.join(''), items.length));
    }

    return parts.join('');
  }

  function bindBriefPanelInteractions(body) {
    if (!body) return;
    body.querySelectorAll('[data-brief-task-id]').forEach((el) => {
      el.addEventListener('click', () => {
        selectTaskById(el.getAttribute('data-brief-task-id'));
        showAgentToast(`Задача #${el.getAttribute('data-brief-task-id')} выбрана`, 'ok');
      });
    });
    body.querySelectorAll('[data-brief-more]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sectionId = btn.getAttribute('data-brief-more');
        if (!sectionId) return;
        if (briefExpandedSections.has(sectionId)) {
          briefExpandedSections.delete(sectionId);
        } else {
          briefExpandedSections.add(sectionId);
        }
        if (lastBriefData) {
          body.innerHTML = buildBriefHtml(lastBriefData);
          bindBriefPanelInteractions(body);
        }
      });
    });
  }

  function setBriefPanelVisible(visible) {
    const panel = $('agent-brief-panel');
    panel?.classList.toggle('hidden', !visible);
    $('agent-morning-brief-btn')?.classList.toggle('is-active', !!visible);
  }

  async function loadMorningBrief({ auto = false } = {}) {
    const panel = $('agent-brief-panel');
    const body = $('agent-brief-body');
    const btn = $('agent-morning-brief-btn');
    const dateEl = $('agent-brief-date');
    if (!body) return;

    setBriefPanelVisible(true);
    body.innerHTML = '<p class="agent-panel-placeholder">Загружаю задачи из Kanban…</p>';
    btn?.classList.add('is-loading');
    briefExpandedSections.clear();

    try {
      const result = await window.api.agentGetMorningBrief?.();
      if (!result?.ok) {
        body.innerHTML = `<p class="agent-panel-placeholder">${escapeHtml(result?.message || 'Не удалось загрузить бриф')}</p>`;
        lastBriefData = null;
        return;
      }

      if (Array.isArray(result.tasks)) applyKanbanTasks(result.tasks);

      lastBriefData = result.brief;
      if (dateEl && result.brief?.dateLabel) dateEl.textContent = result.brief.dateLabel;
      body.innerHTML = buildBriefHtml(result.brief);
      bindBriefPanelInteractions(body);

      if (!auto) {
        try {
          localStorage.setItem(scopedAgentStorageKey(BRIEF_SHOWN_KEY_BASE), new Date().toISOString().slice(0, 10));
        } catch { /* ignore */ }
      }
    } catch (err) {
      body.innerHTML = `<p class="agent-panel-placeholder">${escapeHtml(err.message || 'Ошибка')}</p>`;
    } finally {
      btn?.classList.remove('is-loading');
    }
  }

  function maybeShowMorningBriefOnActivate() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(scopedAgentStorageKey(BRIEF_SHOWN_KEY_BASE)) === today) return;
      localStorage.setItem(scopedAgentStorageKey(BRIEF_SHOWN_KEY_BASE), today);
    } catch { /* ignore */ }
    loadMorningBrief({ auto: true });
  }

  function updateLaborPreview() {
    const hoursEl = $('agent-labor-hours');
    const descEl = $('agent-labor-desc');
    const previewEl = $('agent-labor-preview');
    const submitBtn = $('agent-labor-submit');
    if (!previewEl) return;

    const hours = hoursEl?.value;
    const desc = descEl?.value;
    const preview = formatLaborPreviewNotes(hours, desc);
    previewEl.textContent = preview || 'Заполните часы — здесь появится текст для Redmine.';
    if (submitBtn) {
      submitBtn.disabled = !preview || !getSelectedTask()?.id;
    }
  }

  async function submitLaborLog() {
    const task = getSelectedTask();
    if (!task?.id) {
      showAgentToast('Выберите задачу Kanban в шапке чата', 'error');
      return;
    }

    const hours = $('agent-labor-hours')?.value;
    const description = $('agent-labor-desc')?.value || '';
    const preview = formatLaborPreviewNotes(hours, description);
    if (!preview) {
      showAgentToast('Укажите часы больше 0', 'error');
      return;
    }

    const ok = window.confirm(
      `Вписать трудозатраты в задачу #${task.id}?\n\n${preview}\n\nПосле OK комментарий появится в Redmine.`,
    );
    if (!ok) return;

    const submitBtn = $('agent-labor-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await window.api.metaskAddLaborLog?.({
        issueId: task.id,
        hours: Number(hours),
        description,
      });
      if (result?.ok) {
        showAgentToast(`Трудозатраты вписаны в задачу #${task.id}`, 'ok');
        if ($('agent-labor-hours')) $('agent-labor-hours').value = '';
        if ($('agent-labor-desc')) $('agent-labor-desc').value = '';
        updateLaborPreview();
      } else {
        showAgentToast(result?.message || 'Не удалось записать', 'error');
      }
    } catch (err) {
      showAgentToast(err.message || 'Ошибка сети', 'error');
    } finally {
      updateLaborPreview();
    }
  }

  function bindBriefAndLabor() {
    $('agent-morning-brief-btn')?.addEventListener('click', () => loadMorningBrief({ auto: false }));
    $('agent-brief-close')?.addEventListener('click', () => setBriefPanelVisible(false));
    $('agent-brief-refresh')?.addEventListener('click', () => loadMorningBrief({ auto: false }));

    $('agent-labor-hours')?.addEventListener('input', updateLaborPreview);
    $('agent-labor-desc')?.addEventListener('input', updateLaborPreview);
    $('agent-labor-submit')?.addEventListener('click', submitLaborLog);
    taskSelect?.addEventListener('change', () => {
      updateLaborPreview();
      persistCurrentSession();
    });
    modelSelect?.addEventListener('change', () => saveAgentModelFromPage());

    updateLaborPreview();
  }

  function tryParseFollowupsPayload(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return [];
    const attempts = [trimmed];
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) attempts.push(jsonMatch[0]);
    for (const chunk of attempts) {
      try {
        const parsed = JSON.parse(chunk);
        if (Array.isArray(parsed?.questions)) {
          return parsed.questions.filter(Boolean).map(String);
        }
      } catch { /* next */ }
    }
    return [];
  }

  function parseFollowupsFromContent(content) {
    let body = String(content || '').trim();
    let followups = [];
    const match = body.match(/<<<FOLLOWUPS\s*([\s\S]*?)\s*FOLLOWUPS>>>/i);
    if (match) {
      body = body.slice(0, match.index).trim();
      followups = tryParseFollowupsPayload(match[1]).slice(0, 3);
    }
    body = body.replace(/<<<FOLLOWUPS[\s\S]*?FOLLOWUPS>>>/gi, '').trim();
    return { content: body, followups };
  }

  function prepareAssistantReply(rawContent, serverFollowups) {
    const parsed = parseFollowupsFromContent(rawContent);
    const followups = (Array.isArray(serverFollowups) && serverFollowups.length)
      ? serverFollowups.filter(Boolean).slice(0, 3)
      : parsed.followups;
    return { content: parsed.content, followups };
  }

  function isSafeHttpsUrl(url) {
    try {
      const u = new URL(String(url || '').trim());
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function isImageUrl(url) {
    if (!isSafeHttpsUrl(url)) return false;
    try {
      const u = new URL(url);
      if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(u.pathname)) return true;
      return /images\.|imgur\.com|unsplash\.com|picsum\.photos|placehold\.|wikimedia\.org/i.test(u.hostname);
    } catch {
      return false;
    }
  }

  function extractYoutubeId(url) {
    try {
      const u = new URL(String(url || '').trim());
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (u.pathname === '/watch') return u.searchParams.get('v');
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] || null;
      }
    } catch { /* ignore */ }
    return null;
  }

  function openExternalUrl(url) {
    if (!isSafeHttpsUrl(url)) return;
    window.api.notesOpenUrl?.(url) || window.api.metaskOpenExternal?.(url);
  }

  function buildLinkHtml(label, url) {
    if (!isSafeHttpsUrl(url)) return escapeHtml(label);
    const safeUrl = escapeAttr(url);
    const safeLabel = escapeHtml(label || url);
    return `<a href="#" class="agent-md-link" data-agent-href="${safeUrl}">${safeLabel}</a>`;
  }

  function buildImageHtml(alt, url, inline = false) {
    if (!isSafeHttpsUrl(url) || !isImageUrl(url)) {
      return escapeHtml(`![${alt || ''}](${url})`);
    }
    const cls = inline ? 'agent-md-img agent-md-img--inline' : 'agent-md-img';
    const safeUrl = escapeAttr(url);
    const safeAlt = escapeAttr(alt || 'Изображение');
    const link = buildLinkHtml('Открыть изображение', url);
    return (
      `<img class="${cls}" src="${safeUrl}" alt="${safeAlt}" loading="lazy" decoding="async"`
      + ` referrerpolicy="no-referrer" onerror="this.closest('.agent-md-figure')?.classList.add('agent-md-figure--broken');this.remove();" />`
      + `<span class="agent-md-img-fallback">${link}</span>`
    );
  }

  function buildYoutubeEmbed(videoId, watchUrl) {
    const id = escapeAttr(videoId);
    const safeWatch = isSafeHttpsUrl(watchUrl) ? escapeAttr(watchUrl) : `https://www.youtube.com/watch?v=${id}`;
    return (
      `<div class="agent-md-video">`
      + `<iframe class="agent-md-video-frame" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy"`
      + ` referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
      + `<a href="#" class="agent-md-link agent-md-video-link" data-agent-href="${safeWatch}">Открыть на YouTube</a>`
      + `</div>`
    );
  }

  function inlineFormat(text) {
    const raw = String(text ?? '');
    const re = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*(.+?)\*\*|(`[^`]+`)/g;
    const parts = [];
    let last = 0;
    let match;

    while ((match = re.exec(raw)) !== null) {
      if (match.index > last) parts.push(escapeHtmlWithTaskRefs(raw.slice(last, match.index)));
      if (match[1] !== undefined) {
        parts.push(buildImageHtml(match[1], match[2], true));
      } else if (match[3] !== undefined) {
        parts.push(buildLinkHtml(match[3], match[4]));
      } else if (match[5] !== undefined) {
        parts.push(`<strong>${escapeHtml(match[5])}</strong>`);
      } else if (match[0].startsWith('`')) {
        parts.push(`<code class="agent-md-code">${escapeHtml(match[0].slice(1, -1))}</code>`);
      }
      last = re.lastIndex;
    }

    if (last < raw.length) parts.push(escapeHtmlWithTaskRefs(raw.slice(last)));
    return parts.join('');
  }

  function isMetaHeading(text) {
    return /^(рекомендац|итог|вывод|заключение|резюме|анализ задачи|уточняющие вопрос|вопросы заказчик|возможные шаги|риски и зависимост|сложность задачи)/i.test(String(text || '').trim());
  }

  function normalizeOrderedListNumbers(source) {
    let n = 0;
    return String(source || '').split('\n').map((line) => {
      const trimmed = line.trim();
      if (/^#{1,3}\s+/.test(trimmed)) {
        n = 0;
        return line;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        n += 1;
        return line.replace(/^(\s*)\d+\.\s+/, `$1${n}. `);
      }
      if (trimmed && !/^[-*]\s+/.test(trimmed) && !/^>\s?/.test(trimmed)) {
        n = 0;
      }
      return line;
    }).join('\n');
  }

  function formatAssistantHtml(text) {
    let source = preprocessTaskCards(String(text || '').trim());
    source = source.replace(/<<<FOLLOWUPS[\s\S]*?FOLLOWUPS>>>/gi, '').trim();
    source = source.replace(/\n{3,}/g, '\n\n');
    source = normalizeOrderedListNumbers(source);

    const lines = source.split('\n');
    const out = [];
    let i = 0;
    let inUl = false;
    let inOl = false;
    let inNestedUl = false;
    let inCode = false;
    let codeBuf = [];
    let paraBuf = [];

    const closeNestedUl = () => {
      if (inNestedUl) { out.push('</ul>'); inNestedUl = false; }
    };

    const closeLists = () => {
      closeNestedUl();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };

    const nextNonEmptyLine = (fromIndex) => {
      for (let j = fromIndex + 1; j < lines.length; j += 1) {
        const t = lines[j].trim();
        if (t) return t;
      }
      return '';
    };

    const listContinuesAfterBlank = (fromIndex) => {
      const next = nextNonEmptyLine(fromIndex);
      if (!next) return false;
      if (inOl) return /^\d+\.\s+/.test(next) || /^[-*]\s+/.test(next);
      if (inUl) return /^[-*]\s+/.test(next);
      return false;
    };

    const flushParagraph = () => {
      if (!paraBuf.length) return;
      closeLists();
      const joined = paraBuf.join(' ').trim();
      if (joined) out.push(`<p>${inlineFormat(joined)}</p>`);
      paraBuf = [];
    };

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trimEnd();

      if (line.startsWith('```')) {
        flushParagraph();
        if (inCode) {
          out.push(`<pre class="agent-md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          closeLists();
          inCode = true;
        }
        i += 1;
        continue;
      }

      if (inCode) {
        codeBuf.push(raw);
        i += 1;
        continue;
      }

      if (!line.trim()) {
        if (!listContinuesAfterBlank(i)) flushParagraph();
        i += 1;
        continue;
      }

      if (/^<<<FOLLOWUPS/i.test(line.trim()) || /FOLLOWUPS>>>$/i.test(line.trim())) {
        i += 1;
        continue;
      }

      const taskCardMatch = line.trim().match(/^<<<TASKCARD (\d+)(?:\|(.*))?>>>$/);
      if (taskCardMatch) {
        flushParagraph();
        closeLists();
        out.push(`<div class="agent-task-ref-wrap">${buildAgentTaskCardHtml(taskCardMatch[1], taskCardMatch[2] || '')}</div>`);
        i += 1;
        continue;
      }

      const taskFileMatch = line.trim().match(/^<<<TASKFILE (\d+)\|(\d+)\|([^>|]+)(?:\|(.*))?>>>$/);
      if (taskFileMatch) {
        flushParagraph();
        closeLists();
        const fileHtml = buildAgentTaskFileHtml(taskFileMatch[1], taskFileMatch[2], taskFileMatch[3]);
        if (fileHtml) {
          out.push(`<div class="agent-task-file-wrap">${fileHtml}</div>`);
        }
        i += 1;
        continue;
      }

      if (/^#{1,3}\s+/.test(line)) {
        flushParagraph();
        closeLists();
        const txt = line.replace(/^#+\s+/, '');
        if (!isMetaHeading(txt)) {
          const lvl = line.match(/^#+/)[0].length;
          out.push(`<h${lvl}>${inlineFormat(txt)}</h${lvl}>`);
        }
        i += 1;
        continue;
      }

      const trimmed = line.trim();
      const imgLine = trimmed.match(/^!\[([^\]]*)\]\((https:\/\/[^)]+)\)$/);
      if (imgLine) {
        flushParagraph();
        closeLists();
        out.push(`<figure class="agent-md-figure">${buildImageHtml(imgLine[1], imgLine[2], false)}</figure>`);
        i += 1;
        continue;
      }

      if (isSafeHttpsUrl(trimmed) && isImageUrl(trimmed)) {
        flushParagraph();
        closeLists();
        out.push(`<figure class="agent-md-figure">${buildImageHtml('', trimmed, false)}</figure>`);
        i += 1;
        continue;
      }

      const ytId = extractYoutubeId(trimmed);
      if (ytId && /^https?:\/\/\S+$/i.test(trimmed)) {
        flushParagraph();
        closeLists();
        out.push(buildYoutubeEmbed(ytId, trimmed));
        i += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        flushParagraph();
        closeLists();
        out.push(`<blockquote class="agent-md-quote">${inlineFormat(line.replace(/^>\s?/, ''))}</blockquote>`);
        i += 1;
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        if (inOl) {
          if (!inNestedUl) { out.push('<ul class="agent-md-ul agent-md-ul-nested">'); inNestedUl = true; }
          out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
        } else {
          if (inOl) { out.push('</ol>'); inOl = false; }
          if (!inUl) { out.push('<ul class="agent-md-ul">'); inUl = true; }
          out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
        }
        i += 1;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        flushParagraph();
        closeNestedUl();
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol class="agent-md-ol">'); inOl = true; }
        out.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
        continue;
      }

      if (/^-{3,}$/.test(line.trim())) {
        flushParagraph();
        closeLists();
        out.push('<hr class="agent-md-hr">');
        i += 1;
        continue;
      }

      paraBuf.push(line.trim());
      i += 1;
    }

    flushParagraph();
    closeLists();
    if (inCode && codeBuf.length) {
      out.push(`<pre class="agent-md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    }

    return `<div class="agent-md">${out.join('')}</div>`;
  }

  let agentChatSettings = {
    showSources: true,
    compact: false,
    codePanel: true,
    enterSend: true,
  };
  let lastInspectedCode = '';

  function loadAgentChatSettings() {
    try {
      const raw = localStorage.getItem(scopedAgentStorageKey(AGENT_CHAT_OPTS_KEY_BASE));
      if (raw) agentChatSettings = { ...agentChatSettings, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    document.body.classList.toggle('agent-chat-compact', !!agentChatSettings.compact);
    $('agent-opt-sources') && ($('agent-opt-sources').checked = agentChatSettings.showSources !== false);
    $('agent-opt-compact') && ($('agent-opt-compact').checked = !!agentChatSettings.compact);
    $('agent-opt-code-panel') && ($('agent-opt-code-panel').checked = agentChatSettings.codePanel !== false);
    $('agent-opt-enter-send') && ($('agent-opt-enter-send').checked = agentChatSettings.enterSend !== false);
  }

  function saveAgentChatSettings() {
    localStorage.setItem(scopedAgentStorageKey(AGENT_CHAT_OPTS_KEY_BASE), JSON.stringify(agentChatSettings));
  }

  function hostnameFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url || ''); }
  }

  function buildSourceCardHtml(url, label) {
    if (!isSafeHttpsUrl(url)) return '';
    const host = hostnameFromUrl(url);
    const title = label && label !== url && !/^https?:\/\//i.test(label) ? label : host;
    const letter = (title.replace(/[^\p{L}\p{N}]/gu, '')[0] || host[0] || '?').toUpperCase();
    return `<a href="#" class="agent-source-card" data-agent-href="${escapeAttr(url)}">`
      + `<span class="agent-source-favicon" aria-hidden="true">${escapeHtml(letter)}</span>`
      + `<span class="agent-source-text"><span class="agent-source-title">${escapeHtml(title)}</span>`
      + `<span class="agent-source-domain">${escapeHtml(host)}</span></span></a>`;
  }

  function extractHttpsUrls(text) {
    const urls = new Set();
    const re = /https:\/\/[^\s)<>"']+/g;
    let m;
    const src = String(text || '');
    while ((m = re.exec(src)) !== null) {
      urls.add(m[0].replace(/[.,;:!?)]+$/g, ''));
    }
    return [...urls];
  }

  function buildSourcesStrip(text) {
    if (agentChatSettings.showSources === false) return '';
    const urls = extractHttpsUrls(text);
    if (!urls.length) return '';
    const cards = urls.slice(0, 10).map((u) => buildSourceCardHtml(u, u)).join('');
    return `<section class="agent-sources"><p class="agent-sources-label">Источники</p><div class="agent-sources-row">${cards}</div></section>`;
  }

  function wrapCodeBlocks(html) {
    return String(html || '').replace(
      /<pre class="agent-md-pre"><code>([\s\S]*?)<\/code><\/pre>/g,
      (_, inner) => {
        const id = `agent-code-${Math.random().toString(36).slice(2, 10)}`;
        return `<div class="agent-code-block" data-code-block="1">`
          + `<div class="agent-code-toolbar"><span class="agent-code-lang">Code</span>`
          + `<button type="button" class="agent-code-btn" data-code-copy="${escapeAttr(id)}">Copy</button>`
          + `<button type="button" class="agent-code-btn" data-code-inspect="${escapeAttr(id)}">Найти ошибку</button>`
          + `</div><pre class="agent-md-pre" id="${id}"><code>${inner}</code></pre></div>`;
      },
    );
  }

  function enhanceAssistantHtml(text) {
    const body = formatAssistantHtml(text);
    return wrapCodeBlocks(body) + buildSourcesStrip(text);
  }

  async function copyToClipboard(text) {
    const value = String(text ?? '');
    if (!value.trim()) throw new Error('Пустой текст');

    if (window.api?.copyText) {
      const res = await window.api.copyText(value);
      if (res?.ok) return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('copy failed');
  }

  function getMessageCopyText(root) {
    const md = root?.querySelector('.agent-md');
    if (md) return md.innerText.trim();
    const bubble = root?.querySelector('.agent-msg-bubble');
    if (!bubble) return '';
    const clone = bubble.cloneNode(true);
    clone.querySelectorAll('.agent-msg-toolbar, .agent-sources, .agent-feedback, .agent-followups, .agent-mockup-actions').forEach((el) => el.remove());
    return clone.innerText.trim();
  }

  function bindCodeBlocks(root) {
    root?.querySelectorAll('[data-code-copy]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        const pre = document.getElementById(btn.getAttribute('data-code-copy') || '');
        const code = pre?.textContent || '';
        try {
          await copyToClipboard(code);
          showAgentToast('Код скопирован', 'ok');
        } catch {
          showAgentToast('Не удалось скопировать', 'error');
        }
      });
    });
    root?.querySelectorAll('[data-code-inspect]').forEach((btn) => {
      if (btn.dataset.boundInspect) return;
      btn.dataset.boundInspect = '1';
      btn.addEventListener('click', () => {
        const pre = document.getElementById(btn.getAttribute('data-code-inspect') || '');
        const code = pre?.textContent || '';
        openCodeInspector(code);
      });
    });
  }

  function bindAssistantToolbar(root) {
    const toolbar = document.createElement('div');
    toolbar.className = 'agent-msg-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="agent-msg-tool" data-msg-copy title="Копировать ответ" aria-label="Копировать">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>`;
    const body = root?.querySelector('.agent-msg-body');
    if (!body || body.querySelector('.agent-msg-toolbar')) return;
    body.appendChild(toolbar);
    toolbar.querySelector('[data-msg-copy]')?.addEventListener('click', async () => {
      const text = getMessageCopyText(root);
      try {
        await copyToClipboard(text);
        showAgentToast('Ответ скопирован', 'ok');
      } catch {
        showAgentToast('Не удалось скопировать', 'error');
      }
    });
  }

  function openCodeInspector(code) {
    if (agentChatSettings.codePanel === false) return;
    lastInspectedCode = String(code || '');
    const drawer = $('agent-code-drawer');
    const pre = $('agent-code-inspector');
    if (!drawer || !pre) return;
    pre.textContent = lastInspectedCode;
    drawer.classList.remove('hidden');
  }

  function closeCodeInspector() {
    $('agent-code-drawer')?.classList.add('hidden');
  }

  function bindChatSettingsUi() {
    loadAgentChatSettings();
    mountSettingsMenu();
    const menu = $('agent-settings-menu');
    $('agent-settings-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const willOpen = menu?.classList.contains('hidden');
      if (willOpen) closeTaskPicker();
      setSettingsMenuOpen(willOpen);
    });
    menu?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    menu?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    document.addEventListener('mousedown', (e) => {
      if (menu?.classList.contains('hidden')) return;
      if (e.target.closest('#agent-settings-menu') || e.target.closest('#agent-settings-btn')) return;
      setSettingsMenuOpen(false);
    }, true);
    window.addEventListener('resize', positionSettingsMenu);
    window.addEventListener('scroll', positionSettingsMenu, true);
    const sync = () => {
      agentChatSettings.showSources = $('agent-opt-sources')?.checked !== false;
      agentChatSettings.compact = !!$('agent-opt-compact')?.checked;
      agentChatSettings.codePanel = $('agent-opt-code-panel')?.checked !== false;
      agentChatSettings.enterSend = $('agent-opt-enter-send')?.checked !== false;
      document.body.classList.toggle('agent-chat-compact', !!agentChatSettings.compact);
      saveAgentChatSettings();
    };
    ['agent-opt-sources', 'agent-opt-compact', 'agent-opt-code-panel', 'agent-opt-enter-send'].forEach((id) => {
      $(id)?.addEventListener('change', sync);
    });
    $('agent-code-drawer-close')?.addEventListener('click', closeCodeInspector);
    $('agent-code-copy-all')?.addEventListener('click', async () => {
      if (!lastInspectedCode) return;
      try {
        await copyToClipboard(lastInspectedCode);
        showAgentToast('Код скопирован', 'ok');
      } catch {
        showAgentToast('Не удалось скопировать', 'error');
      }
    });
    $('agent-code-ask-fix')?.addEventListener('click', () => {
      if (!lastInspectedCode || !promptEl) return;
      promptEl.value = `Найди ошибки в этом коде и предложи исправление:\n\n\`\`\`\n${lastInspectedCode}\n\`\`\``;
      autoResize();
      updateSendState();
      closeCodeInspector();
      promptEl.focus();
    });
  }

  function buildFollowupsHtml(followups, taskId, animate = true, teamMessagePending = null) {
    if (!followups?.length) return '';
    const tid = Number(taskId) || 0;
    const sendIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    const chatIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    const musicIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    const resourceIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    const teamIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
    const kindIcons = { task: sendIcon, chat: chatIcon, music: musicIcon, resource: resourceIcon, team: teamIcon };
    const kindTitles = {
      task: 'Отправить в комментарий задачи Redmine',
      chat: 'Отправить в чат Konstancia',
      music: 'Включить в Яндекс Музыке',
      resource: 'Открыть на компьютере',
      team: 'Отправить личное сообщение коллеге от вашего имени',
    };
    const items = followups.map((q, idx) => {
      const kind = classifyFollowupKind(q, tid > 0, teamMessagePending);
      let dataAttr = '';
      if (kind === 'task') {
        dataAttr = `data-agent-task-comment="${escapeAttr(q)}" data-agent-task-id="${tid}"`;
      } else if (kind === 'music') {
        dataAttr = `data-agent-music-action="${escapeAttr(q)}"`;
      } else if (kind === 'resource') {
        dataAttr = `data-agent-resource-action="${escapeAttr(q)}"`;
      } else if (kind === 'team') {
        const candidate = findTeamMessageCandidate(q, teamMessagePending);
        if (candidate) {
          dataAttr = `data-agent-team-send-recipient="${escapeAttr(candidate.id)}" data-agent-team-send-body="${escapeAttr(teamMessagePending?.body || '')}"`;
        } else {
          dataAttr = `data-agent-chat-prompt="${escapeAttr(q)}"`;
        }
      } else {
        dataAttr = `data-agent-chat-prompt="${escapeAttr(q)}"`;
      }
      const effectiveKind = kind === 'team' && !dataAttr.includes('data-agent-team-send-recipient') ? 'chat' : kind;
      return (
        `<button type="button" class="agent-followup agent-followup--${effectiveKind}" ${dataAttr} style="--fu-i:${idx}" title="${escapeAttr(kindTitles[effectiveKind])}">`
        + `<span class="agent-followup-icon">${kindIcons[effectiveKind]}</span>`
        + `<span class="agent-followup-text">${escapeHtml(q)}</span>`
        + '</button>'
      );
    }).join('');
    return (
      `<div class="agent-followups${animate ? ' agent-followups--animate' : ''}">`
      + `<div class="agent-followups-list">${items}</div>`
      + '</div>'
    );
  }

  function showAgentToast(message, type = 'ok') {
    window.api.showPillNotify?.({
      title: type === 'ok' ? 'Konstancia' : 'Ошибка',
      subtitle: String(message || '').slice(0, 220),
      icon: type === 'ok' ? 'ok' : 'error',
      durationMs: 4200,
      action: { type: 'focus-agent' },
    }).catch(() => {});
  }

  async function postQuestionToRedmine(btn) {
    const question = btn.getAttribute('data-agent-task-comment');
    if (!question || btn.disabled) return;

    let taskId = Number(btn.getAttribute('data-agent-task-id'));
    if (!taskId) {
      const task = getSelectedTask();
      taskId = task?.id;
    }
    if (!taskId) {
      showAgentToast('Выберите задачу Kanban в шапке чата', 'error');
      return;
    }

    const okConfirm = window.confirm(
      `Отправить этот вопрос заказчику в комментарий к задаче #${taskId}?\n\n${question.slice(0, 400)}${question.length > 400 ? '…' : ''}`,
    );
    if (!okConfirm) return;

    btn.disabled = true;
    btn.classList.add('agent-followup--sending');

    try {
      const result = await window.api.metaskAddComment?.({ issueId: taskId, notes: question });
      if (result?.ok) {
        btn.classList.remove('agent-followup--sending');
        btn.classList.add('agent-followup--sent');
        const icon = btn.querySelector('.agent-followup-icon');
        if (icon) {
          icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
        }
        showAgentToast(`Комментарий добавлен в задачу #${taskId}`, 'ok');
      } else {
        btn.disabled = false;
        btn.classList.remove('agent-followup--sending');
        showAgentToast(result?.message || 'Не удалось отправить комментарий', 'error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove('agent-followup--sending');
      showAgentToast(err.message || 'Ошибка сети', 'error');
    }
  }

  function buildThinkingSteps(task) {
    const engine = isKonstanciaProvider() ? 'Konstancia' : 'GigaChat';
    const steps = [`Запускаю ${engine}…`, 'Обрабатываю контекст переписки…'];
    if (task?.id) {
      steps.push(
        `Читаю задачу #${task.id}…`,
        'Загружаю описание, комментарии и трудозатраты…',
        'Сопоставляю с вашим вопросом…',
      );
    } else {
      steps.push('Анализирую запрос…', 'Подбираю рекомендации для дизайна…');
    }
    steps.push('Формулирую ответ…', 'Финальная проверка…');
    return steps;
  }

  function scrollBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function getSelectedTask() {
    const id = Number(taskSelect?.value);
    if (!id) return null;
    return kanbanTasks.find((t) => t.id === id) || null;
  }

  function createSessionId() {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function deriveSessionTitle(messages) {
    const first = (messages || []).find((m) => m.role === 'user' && String(m.content || '').trim());
    if (!first) return 'Новый чат';
    const text = String(first.content).trim().replace(/\s+/g, ' ');
    return text.length > 52 ? `${text.slice(0, 52)}…` : text;
  }

  function formatSessionTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'только что';
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `${minutes} мин. назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  function resolveAgentStorageUserId(profile) {
    return String(
      profile?.id
      || window.__APP_CONFIG__?.settings?.user?.id
      || 'guest',
    ).trim() || 'guest';
  }

  function scopedAgentStorageKey(baseKey) {
    return `${baseKey}:${agentStorageUserId}`;
  }

  function migrateStorageKey(newKey, legacyKeys) {
    try {
      if (localStorage.getItem(newKey)) return;
      for (const legacyKey of legacyKeys) {
        const value = localStorage.getItem(legacyKey);
        if (value != null) {
          localStorage.setItem(newKey, value);
          return;
        }
      }
    } catch { /* ignore */ }
  }

  function maybeMigrateLegacyGlobalSessions() {
    const sessionsKey = scopedAgentStorageKey(SESSIONS_KEY_BASE);
    if (localStorage.getItem(sessionsKey) || agentStorageUserId === 'guest') return;
    const username = String(window.__APP_CONFIG__?.settings?.user?.username || '').trim().toLowerCase();
    if (username !== 'k.zorenko') return;
    migrateStorageKey(sessionsKey, [
      SESSIONS_KEY_BASE,
      'firuru-agent-sessions-v2',
      'SHKF-agent-sessions-v2',
    ]);
    migrateStorageKey(scopedAgentStorageKey(ACTIVE_SESSION_KEY_BASE), [
      ACTIVE_SESSION_KEY_BASE,
      'firuru-agent-active-session-v2',
      'SHKF-agent-active-session-v2',
    ]);
  }

  function migrateAgentStorageKeys() {
    maybeMigrateLegacyGlobalSessions();
  }

  function sanitizeImagesForStorage(images) {
    if (!Array.isArray(images) || !images.length) return undefined;
    return images.map((img) => ({
      filename: String(img?.filename || 'image.png').slice(0, 180),
      stored: true,
    }));
  }

  function sanitizeMessageForStorage(msg) {
    if (!msg || typeof msg !== 'object') return msg;
    const next = { ...msg };
    if (Array.isArray(next.images) && next.images.length) {
      next.images = sanitizeImagesForStorage(next.images);
    }
    if (typeof next.content === 'string' && next.content.length > MAX_STORED_MESSAGE_CHARS) {
      next.content = next.content.slice(0, MAX_STORED_MESSAGE_CHARS);
    }
    if (typeof next.imageContext === 'string' && next.imageContext.length > 8000) {
      next.imageContext = next.imageContext.slice(0, 8000);
    }
    delete next.pending;
    return next;
  }

  function sanitizeMessagesForStorage(messages) {
    return (Array.isArray(messages) ? messages : [])
      .slice(-MAX_MESSAGES_PER_SESSION)
      .map(sanitizeMessageForStorage);
  }

  function sanitizeSessionsForStorage(sessions, { stripImages = false } = {}) {
    return (Array.isArray(sessions) ? sessions : []).slice(0, MAX_SESSIONS).map((session) => ({
      ...session,
      messages: sanitizeMessagesForStorage(session?.messages).map((msg) => {
        if (!stripImages) return msg;
        const copy = { ...msg };
        delete copy.images;
        delete copy.imageContext;
        delete copy.attachments;
        return copy;
      }),
    }));
  }

  function writeSessionsToStorage(sessions) {
    localStorage.setItem(scopedAgentStorageKey(SESSIONS_KEY_BASE), JSON.stringify(sessions));
    const activeKey = scopedAgentStorageKey(ACTIVE_SESSION_KEY_BASE);
    if (activeSessionId) localStorage.setItem(activeKey, activeSessionId);
    else localStorage.removeItem(activeKey);
  }

  function saveSessionsStore() {
    try {
      writeSessionsToStorage(sanitizeSessionsForStorage(agentSessions));
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        try {
          writeSessionsToStorage(sanitizeSessionsForStorage(agentSessions, { stripImages: true }));
          return;
        } catch {
          /* fall through */
        }
      }
      console.warn('[agent] saveSessionsStore failed', err?.message || err);
    }
  }

  function appendAssistantToHistory({
    content,
    meta = null,
    followups = [],
    taskId = null,
    chatFollowups = false,
    showFollowups = false,
  } = {}) {
    chatHistory.push({
      role: 'assistant',
      content: String(content || '').trim() || '—',
      meta,
      followups: followups || [],
      taskId: taskId || null,
      chatFollowups: !!chatFollowups,
      showFollowups: !!showFollowups,
    });
    saveHistory();
  }

  function loadSessionsStore() {
    migrateAgentStorageKeys();
    agentSessions = [];
    activeSessionId = null;
    try {
      const raw = localStorage.getItem(scopedAgentStorageKey(SESSIONS_KEY_BASE));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        agentSessions = parsed
          .filter((s) => s?.id)
          .map((session) => ({
            ...session,
            messages: sanitizeMessagesForStorage(session.messages),
          }));
      }
      activeSessionId = localStorage.getItem(scopedAgentStorageKey(ACTIVE_SESSION_KEY_BASE)) || null;
    } catch {
      agentSessions = [];
      activeSessionId = null;
    }

    if (!agentSessions.length) {
      const migrated = migrateLegacyHistory();
      if (migrated) {
        agentSessions = [migrated];
        activeSessionId = migrated.id;
      } else {
        const session = {
          id: createSessionId(),
          title: 'Новый чат',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          taskId: null,
          messages: [],
        };
        agentSessions = [session];
        activeSessionId = session.id;
      }
      saveSessionsStore();
    }

    if (activeSessionId && !agentSessions.some((s) => s.id === activeSessionId)) {
      activeSessionId = agentSessions[0]?.id || null;
    }
    if (!activeSessionId && agentSessions[0]) activeSessionId = agentSessions[0].id;
  }

  function migrateLegacyHistory() {
    try {
      const raw = sessionStorage.getItem(scopedAgentStorageKey(HISTORY_KEY_BASE));
      const messages = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(messages) || !messages.length) return null;
      const now = new Date().toISOString();
      return {
        id: createSessionId(),
        title: deriveSessionTitle(messages),
        createdAt: now,
        updatedAt: now,
        taskId: null,
        messages: sanitizeMessagesForStorage(messages),
      };
    } catch {
      return null;
    }
  }

  function getActiveSession() {
    return agentSessions.find((s) => s.id === activeSessionId) || null;
  }

  function persistCurrentSession() {
    if (!activeSessionId) return;
    const idx = agentSessions.findIndex((s) => s.id === activeSessionId);
    if (idx === -1) return;

    const task = getSelectedTask();
    const title = deriveSessionTitle(chatHistory);
    const prev = agentSessions[idx];
    agentSessions[idx] = {
      ...prev,
      messages: sanitizeMessagesForStorage(chatHistory),
      taskId: task?.id || null,
      updatedAt: new Date().toISOString(),
      title: chatHistory.length ? title : (prev.title || 'Новый чат'),
    };

    saveSessionsStore();
    updateSessionListItem(activeSessionId);
  }

  function applySessionToUi(session) {
    clearPendingAgentImages();
    chatHistory = Array.isArray(session?.messages) ? [...session.messages] : [];
    messageAnimIndex = 0;
    syncTaskThreadFromHistory();

    if (taskSelect) {
      const tid = session?.taskId ? String(session.taskId) : '';
      if (tid && kanbanTasks.some((t) => String(t.id) === tid)) setTaskSelectValue(tid, { silent: true });
      else setTaskSelectValue('', { silent: true });
    }

    if (chatHistory.length) renderHistory();
    else showEmptyState();
    updateLaborPreview();
  }

  function switchSession(sessionId) {
    if (!sessionId || sessionId === activeSessionId) return;
    persistCurrentSession();
    activeSessionId = sessionId;
    saveSessionsStore();
    applySessionToUi(getActiveSession());
    syncSessionActiveState();
    promptEl?.focus();
  }

  function ensureActiveSession() {
    if (getActiveSession()) return getActiveSession();
    return createNewSession();
  }

  function createNewSession() {
    persistCurrentSession();
    const session = {
      id: createSessionId(),
      title: 'Новый чат',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskId: null,
      messages: [],
    };
    agentSessions.unshift(session);
    if (agentSessions.length > MAX_SESSIONS) agentSessions.length = MAX_SESSIONS;
    activeSessionId = session.id;
    saveSessionsStore();
    applySessionToUi(session);
    renderSessionList();
    promptEl?.focus();
    return session;
  }

  function deleteSession(sessionId) {
    if (!sessionId) return;
    if (!window.confirm('Удалить этот чат? История сообщений будет потеряна.')) return;
    deleteSessionsByIds([sessionId]);
  }

  function deleteSessionsByIds(sessionIds) {
    const ids = [...new Set((sessionIds || []).filter(Boolean))];
    if (!ids.length) return;

    persistCurrentSession();
    const removedActive = ids.includes(activeSessionId);
    agentSessions = agentSessions.filter((s) => !ids.includes(s.id));
    ids.forEach((id) => selectedSessionIds.delete(id));

    if (!agentSessions.length) {
      activeSessionId = null;
      saveSessionsStore();
      setSessionSelectMode(false);
      applySessionToUi(null);
      renderSessionList();
      return;
    }

    if (removedActive) {
      activeSessionId = agentSessions[0].id;
      saveSessionsStore();
      applySessionToUi(getActiveSession());
    } else {
      saveSessionsStore();
    }
    updateSessionBulkUi();
    renderSessionList();
  }

  function deleteSelectedSessions() {
    const ids = [...selectedSessionIds];
    if (!ids.length) return;
    const count = ids.length;
    const label = count === 1 ? 'этот чат' : `${count} чатов`;
    if (!window.confirm(`Удалить ${label}? История сообщений будет потеряна.`)) return;
    deleteSessionsByIds(ids);
    setSessionSelectMode(false);
  }

  function updateSessionBulkUi() {
    const bulkBar = $('agent-session-bulk');
    const bulkBtn = $('agent-session-bulk-delete');
    const bulkCount = $('agent-session-bulk-count');
    const selectAllBtn = $('agent-session-select-all');
    const selectBtn = $('agent-session-select-mode');
    const count = selectedSessionIds.size;
    const total = agentSessions.length;
    bulkBar?.classList.toggle('hidden', !sessionSelectMode);
    if (bulkBtn) bulkBtn.disabled = count === 0;
    if (bulkCount) {
      bulkCount.textContent = count === 0
        ? 'Отметьте чаты для удаления'
        : count === 1
          ? '1 чат выбран'
          : `${count} чатов выбрано`;
    }
    if (selectAllBtn) {
      const allSelected = total > 0 && count === total;
      selectAllBtn.textContent = allSelected ? 'Снять' : 'Все';
      selectAllBtn.disabled = total === 0;
      selectAllBtn.title = allSelected ? 'Снять выделение' : 'Выбрать все чаты';
    }
    if (selectBtn) {
      selectBtn.classList.toggle('is-active', sessionSelectMode);
      selectBtn.setAttribute('aria-pressed', sessionSelectMode ? 'true' : 'false');
      selectBtn.title = sessionSelectMode ? 'Завершить выбор' : 'Выбрать несколько';
    }
  }

  function setSessionSelectMode(enabled) {
    sessionSelectMode = Boolean(enabled);
    if (!sessionSelectMode) selectedSessionIds.clear();
    updateSessionBulkUi();
    sessionListEl?.querySelectorAll('.agent-session-item').forEach((row) => {
      const session = agentSessions.find((s) => s.id === row.dataset.sessionId);
      fillSessionRow(row, session);
    });
    if (!sessionSelectMode) promptEl?.focus();
  }

  function setSessionSelected(sessionId, selected) {
    if (!sessionId) return;
    if (selected) selectedSessionIds.add(sessionId);
    else selectedSessionIds.delete(sessionId);
    updateSessionBulkUi();
    const row = sessionListEl?.querySelector(`.agent-session-item[data-session-id="${sessionId}"]`);
    if (row) {
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', selected ? 'true' : 'false');
      const check = row.querySelector('.agent-session-check');
      if (check) check.checked = selected;
    }
  }

  function toggleSessionSelection(sessionId) {
    if (!sessionId) return;
    setSessionSelected(sessionId, !selectedSessionIds.has(sessionId));
  }

  function toggleSelectAllSessions() {
    if (!agentSessions.length) return;
    const allSelected = selectedSessionIds.size === agentSessions.length;
    if (allSelected) {
      selectedSessionIds.clear();
    } else {
      agentSessions.forEach((session) => selectedSessionIds.add(session.id));
    }
    updateSessionBulkUi();
    sessionListEl?.querySelectorAll('.agent-session-item').forEach((row) => {
      const session = agentSessions.find((s) => s.id === row.dataset.sessionId);
      if (!session) return;
      const selected = selectedSessionIds.has(session.id);
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', selected ? 'true' : 'false');
      const check = row.querySelector('.agent-session-check');
      if (check) check.checked = selected;
    });
  }

  function syncSessionRowSelectUi(row, session) {
    if (!row) return;
    row.classList.toggle('is-select-mode', sessionSelectMode);
    row.classList.toggle('is-selected', selectedSessionIds.has(session?.id));
    let check = row.querySelector('.agent-session-check');
    if (sessionSelectMode) {
      if (!check) {
        check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'agent-session-check';
        const stopRowToggle = (event) => event.stopPropagation();
        check.addEventListener('click', stopRowToggle);
        check.addEventListener('mousedown', stopRowToggle);
        check.addEventListener('change', () => setSessionSelected(session?.id, check.checked));
        row.prepend(check);
      }
      check.checked = selectedSessionIds.has(session?.id);
      check.setAttribute('aria-label', `Выбрать чат «${session?.title || 'Новый чат'}»`);
    } else if (check) {
      check.remove();
    }
  }

  function sessionRowMeta(session) {
    const count = session.messages?.length || 0;
    return count
      ? `${formatSessionTime(session.updatedAt)} · ${count} сообщ.`
      : formatSessionTime(session.updatedAt);
  }

  function fillSessionRow(row, session) {
    const classes = ['agent-session-item'];
    if (session.id === activeSessionId) classes.push('is-active');
    if (sessionSelectMode) classes.push('is-select-mode');
    if (selectedSessionIds.has(session.id)) classes.push('is-selected');
    row.className = classes.join(' ');
    row.dataset.sessionId = session.id;
    if (sessionSelectMode) {
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', selectedSessionIds.has(session.id) ? 'true' : 'false');
      row.tabIndex = 0;
    } else {
      row.setAttribute('role', 'button');
      row.removeAttribute('aria-selected');
      row.tabIndex = -1;
    }
    let titleEl = row.querySelector('.agent-session-title');
    let metaEl = row.querySelector('.agent-session-meta');
    let delBtn = row.querySelector('.agent-session-delete');
    if (!titleEl || !metaEl || !delBtn) {
      row.innerHTML = `
        <span class="agent-session-title"></span>
        <span class="agent-session-meta"></span>`;
      titleEl = row.querySelector('.agent-session-title');
      metaEl = row.querySelector('.agent-session-meta');
      delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'agent-session-delete';
      delBtn.dataset.deleteSession = session.id;
      delBtn.setAttribute('aria-label', 'Удалить чат');
      delBtn.textContent = '×';
      row.appendChild(delBtn);
    }
    titleEl.textContent = session.title || 'Новый чат';
    metaEl.textContent = sessionRowMeta(session);
    delBtn.dataset.deleteSession = session.id;
    delBtn.classList.toggle('hidden', sessionSelectMode);
    syncSessionRowSelectUi(row, session);
  }

  function createSessionRow(session) {
    const row = document.createElement('div');
    fillSessionRow(row, session);
    return row;
  }

  function updateSessionListItem(sessionId) {
    const session = agentSessions.find((s) => s.id === sessionId);
    const row = sessionListEl?.querySelector(`.agent-session-item[data-session-id="${sessionId}"]`);
    if (session && row) fillSessionRow(row, session);
  }

  function syncSessionActiveState() {
    sessionListEl?.querySelectorAll('.agent-session-item').forEach((row) => {
      row.classList.toggle('is-active', row.dataset.sessionId === activeSessionId);
    });
  }

  function renderSessionList({ full = false } = {}) {
    if (!sessionListEl) return;

    if (!agentSessions.length) {
      sessionListEl.innerHTML = '<p class="agent-session-empty">Нет сохранённых чатов</p>';
      return;
    }

    sessionListEl.querySelector('.agent-session-empty')?.remove();

    if (full) {
      sessionListEl.innerHTML = '';
      agentSessions.forEach((session) => {
        sessionListEl.appendChild(createSessionRow(session));
      });
      return;
    }

    const rowsById = new Map(
      [...sessionListEl.querySelectorAll('.agent-session-item')].map((row) => [row.dataset.sessionId, row]),
    );

    agentSessions.forEach((session, index) => {
      let row = rowsById.get(session.id);
      if (!row) {
        row = createSessionRow(session);
        rowsById.set(session.id, row);
      } else {
        fillSessionRow(row, session);
      }
      const ref = sessionListEl.children[index] || null;
      if (sessionListEl.children[index] !== row) {
        sessionListEl.insertBefore(row, ref);
      }
    });

    [...sessionListEl.querySelectorAll('.agent-session-item')].forEach((row) => {
      if (!agentSessions.some((s) => s.id === row.dataset.sessionId)) row.remove();
    });
  }

  function loadSidebarCollapsed() {
    try {
      return localStorage.getItem(scopedAgentStorageKey(SIDEBAR_COLLAPSED_KEY_BASE)) === '1';
    } catch {
      return false;
    }
  }

  function setSidebarCollapsed(collapsed) {
    const root = document.querySelector('#page-agent .agent-chat');
    root?.classList.toggle('agent-chat--sidebar-collapsed', collapsed);
    try {
      localStorage.setItem(scopedAgentStorageKey(SIDEBAR_COLLAPSED_KEY_BASE), collapsed ? '1' : '0');
    } catch { /* ignore */ }
    $('agent-sidebar-toggle')?.classList.toggle('hidden', !collapsed);
    $('agent-sidebar-hide')?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    window.AgentVtuber?.relayout?.();
  }

  function bindSessionSidebar() {
    $('agent-session-new')?.addEventListener('click', createNewSession);
    $('agent-chat-clear')?.addEventListener('click', createNewSession);
    $('agent-sidebar-hide')?.addEventListener('click', () => setSidebarCollapsed(true));
    $('agent-sidebar-toggle')?.addEventListener('click', () => setSidebarCollapsed(false));
    $('agent-session-select-mode')?.addEventListener('click', () => setSessionSelectMode(!sessionSelectMode));
    $('agent-session-bulk-delete')?.addEventListener('click', deleteSelectedSessions);
    $('agent-session-select-all')?.addEventListener('click', toggleSelectAllSessions);

    setSidebarCollapsed(loadSidebarCollapsed());
    updateSessionBulkUi();

    sessionListEl?.addEventListener('click', (event) => {
      const del = event.target.closest('[data-delete-session]');
      if (del) {
        event.stopPropagation();
        deleteSession(del.getAttribute('data-delete-session'));
        return;
      }
      const item = event.target.closest('.agent-session-item');
      if (!item?.dataset.sessionId) return;
      if (sessionSelectMode) {
        if (event.target.closest('.agent-session-check')) return;
        event.preventDefault();
        toggleSessionSelection(item.dataset.sessionId);
        return;
      }
      switchSession(item.dataset.sessionId);
    });

    sessionListEl?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.agent-session-item');
      if (!item?.dataset.sessionId || event.target.closest('[data-delete-session]')) return;
      event.preventDefault();
      if (sessionSelectMode) {
        toggleSessionSelection(item.dataset.sessionId);
        return;
      }
      switchSession(item.dataset.sessionId);
    });
  }

  function buildSharePayloadForSend(session = {}) {
    const messages = (Array.isArray(session.messages) ? session.messages : [])
      .filter((m) => m?.role === 'user' || m?.role === 'assistant')
      .slice(-80)
      .map((m) => {
        let content = String(m.content || '').slice(0, 12000);
        if (Array.isArray(m.images) && m.images.length && !/\[изображение\]/i.test(content)) {
          content = content ? `${content}\n[изображение]` : '[изображение]';
        }
        return {
          role: m.role,
          content,
          taskThread: !!m.taskThread,
        };
      })
      .filter((m) => m.content.trim());
    return {
      title: String(session.title || 'Чат').slice(0, 120),
      taskId: session.taskId || null,
      messageCount: messages.length,
      messages,
    };
  }

  function warmShareDmRoom(recipientId) {
    const id = String(recipientId || '').trim();
    if (!id) return;
    void window.api.teamChatOpenDm?.({ recipientId: id });
  }

  function formatColleagueLabel(profile = {}) {
    const name = String(profile.full_name || '').trim();
    const username = String(profile.username || '').trim();
    const position = String(profile.position || '').trim();
    if (name && username) return position ? `${name} (@${username}) · ${position}` : `${name} (@${username})`;
    if (name) return position ? `${name} · ${position}` : name;
    if (username) return `@${username}`;
    return String(profile.email || 'Коллега').split('@')[0] || 'Коллега';
  }

  function formatColleagueInitials(profile = {}) {
    const name = String(profile.full_name || profile.username || profile.email || '?').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }

  function readImportedShareIds() {
    try {
      const raw = localStorage.getItem(scopedAgentStorageKey(IMPORTED_SHARES_KEY_BASE));
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function markShareImported(shareId) {
    const id = String(shareId || '').trim();
    if (!id) return;
    const set = readImportedShareIds();
    set.add(id);
    try {
      localStorage.setItem(scopedAgentStorageKey(IMPORTED_SHARES_KEY_BASE), JSON.stringify([...set].slice(-200)));
    } catch {
      /* ignore quota */
    }
  }

  function buildImportedShareTitle(share = {}) {
    const payload = share?.payload && typeof share.payload === 'object' ? share.payload : {};
    const title = String(payload.title || share.title || 'Чат').trim();
    return title.length > 120 ? `${title.slice(0, 119)}…` : title;
  }

  function formatColleagueSubtitle(profile = {}) {
    const position = String(profile.position || '').trim();
    if (position) return position;
    const username = String(profile.username || '').trim();
    if (username) return `@${username}`;
    const role = String(profile.role || '').trim();
    return role || 'Сотрудник SHKF';
  }

  function getShareSelectedColleague() {
    if (!shareSelectedColleagueId) return null;
    return shareColleagues.find((profile) => String(profile.id) === String(shareSelectedColleagueId)) || null;
  }

  function updateShareSelectionUi() {
    const selected = getShareSelectedColleague();
    const selectedWrap = $('agent-share-selected');
    const selectedName = $('agent-share-selected-name');
    const submit = $('agent-share-submit');

    if (selectedWrap && selectedName) {
      if (selected) {
        selectedWrap.classList.remove('hidden');
        selectedName.textContent = formatColleagueLabel(selected);
      } else {
        selectedWrap.classList.add('hidden');
        selectedName.textContent = '';
      }
    }

    if (submit) {
      submit.disabled = !selected;
      submit.textContent = selected
        ? `Отправить ${formatColleagueLabel(selected)}`
        : 'Отправить';
    }
  }

  function closeShareModal() {
    $('agent-share-overlay')?.classList.add('hidden');
    shareSelectedColleagueId = null;
    updateShareSelectionUi();
  }

  function renderShareColleagueList(filter = '') {
    const listEl = $('agent-share-list');
    if (!listEl) return;
    const q = String(filter || '').trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const rows = shareColleagues.filter((profile) => {
      if (!tokens.length) return true;
      const hay = [
        profile.full_name,
        profile.username,
        profile.position,
        profile.email,
        profile.role,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return tokens.every((token) => hay.includes(token));
    });

    if (!rows.length) {
      listEl.innerHTML = '<p class="agent-share-empty">Никого не найдено. Попробуйте другой запрос.</p>';
      updateShareSelectionUi();
      return;
    }

    listEl.innerHTML = rows.map((profile) => {
      const selected = String(shareSelectedColleagueId) === String(profile.id);
      const avatar = profile.avatar_url
        ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" />`
        : escapeHtml(formatColleagueInitials(profile));
      return (
        `<button type="button" class="agent-share-colleague${selected ? ' is-selected' : ''}" data-share-colleague-id="${escapeHtml(profile.id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">`
        + `<span class="agent-share-colleague-check" aria-hidden="true">✓</span>`
        + `<span class="agent-share-colleague-avatar">${avatar}</span>`
        + `<span class="agent-share-colleague-copy">`
        + `<span class="agent-share-colleague-name">${escapeHtml(formatColleagueLabel(profile))}</span>`
        + `<span class="agent-share-colleague-sub">${escapeHtml(formatColleagueSubtitle(profile))}</span>`
        + `</span></button>`
      );
    }).join('');

    updateShareSelectionUi();

    if (shareSelectedColleagueId) {
      const safeId = String(shareSelectedColleagueId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const active = listEl.querySelector(`[data-share-colleague-id="${safeId}"]`);
      active?.scrollIntoView({ block: 'nearest' });
    }
  }

  async function openShareModal() {
    persistCurrentSession();
    const session = getActiveSession();
    if (!session?.messages?.length) {
      showAgentToast('В этом чате пока нет сообщений', 'error');
      return;
    }

    const overlay = $('agent-share-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    const hint = $('agent-share-hint');
    if (hint) {
      hint.textContent = `Экспорт «${session.title || 'Чат'}» (${session.messages.length} сообщ.) — коллега увидит переписку в Konstancia и сможет продолжить.`;
    }

    const search = $('agent-share-search');
    if (search) {
      search.value = '';
      search.focus();
    }

    shareSelectedColleagueId = null;
    updateShareSelectionUi();

    const listEl = $('agent-share-list');
    if (listEl) listEl.innerHTML = '<p class="agent-share-empty">Загрузка коллег…</p>';

    const result = await window.api.agentChatShareColleagues?.();
    if (!result?.ok) {
      if (listEl) {
        listEl.innerHTML = `<p class="agent-share-empty">${escapeHtml(result?.message || 'Не удалось загрузить коллег')}</p>`;
      }
      return;
    }

    shareColleagues = result.colleagues || [];
    renderShareColleagueList();
  }

  async function submitShareChat() {
    if (!shareSelectedColleagueId || shareSubmitting) return;
    const active = getActiveSession();
    const payload = buildSharePayloadForSend({
      title: active?.title || deriveSessionTitle(chatHistory),
      taskId: active?.taskId || null,
      messages: chatHistory,
    });
    if (!payload.messages.length) {
      showAgentToast('В чате нет сообщений для отправки', 'error');
      return;
    }
    void Promise.resolve().then(() => persistCurrentSession());

    const submit = $('agent-share-submit');
    const submitDefaultLabel = submit?.dataset.defaultLabel || submit?.textContent || 'Отправить';
    if (submit && !submit.dataset.defaultLabel) submit.dataset.defaultLabel = submitDefaultLabel;
    shareSubmitting = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Отправляем…';
    }

    try {
      const result = await window.api.agentChatShareSend?.({
        recipientId: shareSelectedColleagueId,
        payload,
      });

      if (!result?.ok) {
        showAgentToast(result?.message || 'Не удалось отправить чат', 'error');
        return;
      }

      const recipient = shareColleagues.find((p) => p.id === shareSelectedColleagueId);
      const label = formatColleagueLabel(recipient);
      closeShareModal();
      showAgentToast(`Чат экспортирован для ${label}`, 'ok');
    } finally {
      shareSubmitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.defaultLabel || submitDefaultLabel;
        updateShareSelectionUi();
      }
    }
  }

  function renderShareInbox() {
    const inbox = $('agent-share-inbox');
    if (!inbox) return;

    if (!incomingShares.length) {
      inbox.classList.add('hidden');
      inbox.innerHTML = '';
      return;
    }

    inbox.classList.remove('hidden');
    inbox.innerHTML = `
      <div class="agent-share-inbox-head">Входящие чаты (${incomingShares.length})</div>
      ${incomingShares.map((share) => {
        const count = share.payload?.messageCount || share.payload?.messages?.length || 0;
        const from = share.owner_name || share.owner_username || 'Коллега';
        return `
          <div class="agent-share-inbox-item" data-share-id="${escapeHtml(share.id)}">
            <div class="agent-share-inbox-title">${escapeHtml(share.title || 'Чат')}</div>
            <div class="agent-share-inbox-meta">От ${escapeHtml(from)} · ${count} сообщ.</div>
            <div class="agent-share-inbox-actions">
              <button type="button" class="agent-share-inbox-btn agent-share-inbox-btn--primary" data-share-accept="${escapeHtml(share.id)}">Открыть</button>
              <button type="button" class="agent-share-inbox-btn agent-share-inbox-btn--ghost" data-share-dismiss="${escapeHtml(share.id)}">Скрыть</button>
            </div>
          </div>`;
      }).join('')}
    `;
  }

  function importSharedSession(share) {
    const payload = share?.payload || {};
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (!messages.length) return null;

    const existing = agentSessions.find((item) => item.sharedFrom?.shareId === share.id);
    if (existing) {
      activeSessionId = existing.id;
      saveSessionsStore();
      applySessionToUi(existing);
      renderSessionList({ full: true });
      return existing;
    }

    const session = {
      id: createSessionId(),
      title: buildImportedShareTitle(share),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskId: payload.taskId || null,
      messages: messages.map((msg) => ({ ...msg })),
      sharedFrom: {
        userId: share.owner_id,
        name: share.owner_name || share.owner_username || '',
        shareId: share.id,
      },
      exported: true,
    };

    agentSessions.unshift(session);
    if (agentSessions.length > MAX_SESSIONS) agentSessions.length = MAX_SESSIONS;
    activeSessionId = session.id;
    saveSessionsStore();
    applySessionToUi(session);
    renderSessionList({ full: true });
    promptEl?.focus();
    return session;
  }

  async function autoImportIncomingShare(share, { notify = false } = {}) {
    if (!share?.id) return null;
    if (readImportedShareIds().has(share.id)) return null;
    if (agentSessions.some((item) => item.sharedFrom?.shareId === share.id)) {
      markShareImported(share.id);
      return null;
    }

    const result = await window.api.agentChatShareAccept?.({ shareId: share.id });
    if (!result?.ok || !result.share) return null;

    const session = importSharedSession(result.share);
    markShareImported(share.id);
    incomingShares = incomingShares.filter((item) => item.id !== share.id);
    renderShareInbox();

    if (notify && session) {
      const from = share.owner_name || share.owner_username || 'коллега';
      showAgentToast(`Экспорт чата от ${from}: «${session.title}»`, 'ok');
      window.api.showPillNotify?.({
        title: session.title || 'Новый чат',
        body: `${from} поделился перепиской Konstancia.`,
        meta: from,
        badge: 'Konstancia',
        tag: 'Команда',
        icon: 'agent',
        action: { type: 'konstancia-open-share', shareId: share.id },
      });
    }
    return session;
  }

  async function openKonstanciaShare(shareId) {
    const id = String(shareId || '').trim();
    if (!id) return false;

    document.querySelector('.nav-item[data-page="agent"]')?.click();

    let session = agentSessions.find((item) => item.sharedFrom?.shareId === id);
    if (session) {
      switchSession(session.id);
      return true;
    }

    const pending = incomingShares.find((item) => item.id === id);
    if (pending) {
      await autoImportIncomingShare(pending, { notify: false });
      session = agentSessions.find((item) => item.sharedFrom?.shareId === id);
      if (session) {
        switchSession(session.id);
        return true;
      }
    }

    await refreshIncomingShares({ notify: false, autoImport: true });
    session = agentSessions.find((item) => item.sharedFrom?.shareId === id);
    if (session) {
      switchSession(session.id);
      return true;
    }

    const fetched = await window.api.agentChatShareGet?.({ shareId: id });
    if (fetched?.ok && fetched.share) {
      if (fetched.share.status === 'pending') {
        await autoImportIncomingShare(fetched.share, { notify: false });
      } else {
        session = importSharedSession(fetched.share);
        if (session) markShareImported(id);
      }
      session = agentSessions.find((item) => item.sharedFrom?.shareId === id);
      if (session) {
        switchSession(session.id);
        return true;
      }
    }
    return false;
  }

  window.openKonstanciaShare = openKonstanciaShare;

  async function acceptIncomingShare(shareId) {
    const share = incomingShares.find((item) => item.id === shareId);
    if (share) {
      const session = await autoImportIncomingShare(share, { notify: false });
      if (session) {
        showAgentToast('Чат добавлен — продолжайте переписку с Konstancia', 'ok');
        return;
      }
    }
    const result = await window.api.agentChatShareAccept?.({ shareId });
    if (!result?.ok) {
      showAgentToast(result?.message || 'Не удалось открыть чат', 'error');
      return;
    }
    importSharedSession(result.share);
    markShareImported(shareId);
    incomingShares = incomingShares.filter((s) => s.id !== shareId);
    renderShareInbox();
    showAgentToast('Чат добавлен — продолжайте переписку с Konstancia', 'ok');
    await refreshIncomingShares();
  }

  async function dismissIncomingShare(shareId) {
    const result = await window.api.agentChatShareDismiss?.({ shareId });
    if (!result?.ok) {
      showAgentToast(result?.message || 'Не удалось скрыть чат', 'error');
      return;
    }
    incomingShares = incomingShares.filter((s) => s.id !== shareId);
    renderShareInbox();
    await refreshIncomingShares();
  }

  async function refreshIncomingShares({ notify = false, autoImport = true } = {}) {
    const result = await window.api.agentChatShareIncoming?.();
    if (!result?.ok) {
      if (!incomingShares.length) renderShareInbox();
      return;
    }

    const next = result.shares || [];
    const prevIds = new Set(incomingShares.map((s) => s.id));
    incomingShares = next;
    renderShareInbox();

    const fresh = next.filter((share) => !prevIds.has(share.id));
    if (autoImport) {
      for (const share of fresh) {
        await autoImportIncomingShare(share, { notify: shareInboxInitialized && notify });
      }
    } else if (shareInboxInitialized && notify) {
      if (fresh[0]) {
        const from = fresh[0].owner_name || fresh[0].owner_username || 'коллега';
        window.api.showPillNotify?.({
          title: fresh[0].title || 'Новый чат',
          body: `${from} поделился перепиской Konstancia.`,
          meta: from,
          badge: 'Konstancia',
          tag: 'Команда',
          icon: 'agent',
          action: { type: 'konstancia-open-share', shareId: fresh[0].id },
        });
      }
    }
    shareInboxInitialized = true;
  }

  function startSharePolling() {
    stopSharePolling();
    refreshIncomingShares({ notify: true, autoImport: true });
    sharePollTimer = window.setInterval(() => {
      refreshIncomingShares({ notify: true, autoImport: true });
    }, 20000);
  }

  function stopSharePolling() {
    if (!sharePollTimer) return;
    clearInterval(sharePollTimer);
    sharePollTimer = null;
  }

  function bindShareUi() {
    $('agent-chat-share-btn')?.addEventListener('click', () => openShareModal());
    $('agent-share-close')?.addEventListener('click', closeShareModal);
    $('agent-share-cancel')?.addEventListener('click', closeShareModal);
    $('agent-share-submit')?.addEventListener('click', () => submitShareChat());
    $('agent-share-overlay')?.addEventListener('click', (event) => {
      if (event.target === $('agent-share-overlay')) closeShareModal();
    });
    $('agent-share-search')?.addEventListener('input', (event) => {
      renderShareColleagueList(event.target.value);
    });
    $('agent-share-list')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-share-colleague-id]');
      if (!btn) return;
      shareSelectedColleagueId = btn.getAttribute('data-share-colleague-id');
      warmShareDmRoom(shareSelectedColleagueId);
      renderShareColleagueList($('agent-share-search')?.value || '');
      updateShareSelectionUi();
    });
    $('agent-share-inbox')?.addEventListener('click', (event) => {
      const accept = event.target.closest('[data-share-accept]');
      if (accept) {
        acceptIncomingShare(accept.getAttribute('data-share-accept'));
        return;
      }
      const dismiss = event.target.closest('[data-share-dismiss]');
      if (dismiss) dismissIncomingShare(dismiss.getAttribute('data-share-dismiss'));
    });
    window.api.onTeamchatSharePingFailed?.((detail) => {
      showAgentToast(detail?.message || 'Не удалось отправить ссылку в «Команда»', 'error');
    });
  }

  function saveHistory() {
    if (window.appSettings?.agent?.keepChatHistory === false) {
      persistCurrentSession();
      return;
    }
    persistCurrentSession();
  }

  function loadHistory() {
    loadSessionsStore();
    applySessionToUi(getActiveSession());
    renderSessionList({ full: true });
  }

  function switchAgentUserContext(profile) {
    const nextUserId = resolveAgentStorageUserId(profile);
    if (nextUserId === agentStorageUserId && agentInited) {
      refreshUserMessageAvatars();
      return;
    }
    if (agentInited) persistCurrentSession();
    agentStorageUserId = nextUserId;
    if (!agentInited) return;
    loadHistory();
    refreshUserMessageAvatars();
    refreshIncomingShares({ notify: false, autoImport: true });
    loadKanbanTasks();
  }

  function renderHistory() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    messageAnimIndex = 0;
    if (!chatHistory.length) {
      showEmptyState();
      taskThreadActive = false;
      return;
    }
    syncTaskThreadFromHistory();
    chatHistory.forEach((msg) => {
      if (msg.role === 'user') {
        addMessage('user', buildUserMessageHtml(userDisplayText(msg.content, msg.images), msg.images), null, {
          pushHistory: false,
          animate: false,
        });
      } else if (msg.role === 'assistant') {
        const prepared = prepareAssistantReply(msg.content, msg.followups);
        const task = msg.taskId ? { id: msg.taskId } : getSelectedTask();
        const display = resolveFollowupsForDisplay(
          prepared.followups,
          task,
          msg.showFollowups === true,
          {
            chatFollowups: msg.chatFollowups === true,
            teamMessagePending: msg.teamMessagePending || null,
          },
        );
        addMessage('assistant', enhanceAssistantHtml(prepared.content), msg.meta || null, {
          pushHistory: false,
          animate: false,
          followups: display.followups,
          taskId: display.taskId,
          teamMessagePending: display.teamMessagePending,
        });
      }
    });
    scrollBottom();
    syncStageState();
  }

  function showEmptyState() {
    if (!messagesEl) return;
    const live2dOn = window.appSettings?.vtubeStudio?.enabled === true;
    messagesEl.innerHTML = `
      <div class="agent-welcome">
        <div class="agent-welcome-icon${live2dOn ? ' agent-welcome-icon--live2d' : ''}" id="agent-vtuber-hero-anchor" aria-hidden="true">
          <img class="agent-avatar-img agent-welcome-icon-fallback" src="${AGENT_AVATAR_SRC}" alt="" width="56" height="56" />
        </div>
        <h2 class="agent-welcome-title">Привет, я Konstancia</h2>
        <p class="agent-welcome-sub">Задачи Kanban, промпты, Figma, оценка и разбор кода. Ответы со ссылками — в карточках источников внизу.</p>
        <div class="agent-welcome-chips">
          <button type="button" class="agent-welcome-chip" data-welcome-action="analyze">Оценить задачу</button>
          <button type="button" class="agent-welcome-chip" data-welcome-action="devPlan">План на день</button>
          <button type="button" class="agent-welcome-chip" data-welcome-action="banner">Промпт баннер</button>
          <button type="button" class="agent-welcome-chip" data-welcome-action="make">Figma Make</button>
        </div>
      </div>`;
    messagesEl.classList.add('agent-messages--idle');
    messagesEl.querySelectorAll('[data-welcome-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-welcome-action');
        const text = QUICK[key] || '';
        if (!text) return;
        if (key === 'make') {
          sendFigmaMake(text);
          return;
        }
        if (promptEl) {
          promptEl.value = text;
          autoResize();
          updateSendState();
        }
        sendMessage(text);
      });
    });
    window.AgentVtuber?.onChatIdle?.();
    window.requestAnimationFrame(() => {
      window.AgentVtuber?.relayout?.();
      window.AgentVtuber?.refreshLive2d?.({ force: true });
    });
  }

  function syncStageState() {
    const hasChat = chatHistory.length > 0 || !!messagesEl?.querySelector('.agent-msg');
    const drafting = Boolean(promptEl?.value?.trim()) || pendingAgentImages.length > 0;

    if (!hasChat && !drafting && !messagesEl?.querySelector('.agent-welcome')) {
      showEmptyState();
      return;
    }

    // Центр и hero-модель — пока нет сообщений; composer только после первого отправленного.
    messagesEl?.classList.toggle('agent-messages--idle', !hasChat);
    if (window.AgentVtuber) {
      if (hasChat) window.AgentVtuber.onChatActive?.();
      else window.AgentVtuber.onChatIdle?.();
    }
  }

  function clearWelcomePanel() {
    messagesEl?.querySelector('.agent-welcome')?.remove();
    messagesEl?.classList.remove('agent-messages--idle');
  }

  function buildFeedbackHtml(learnedChunkIds) {
    if (!Array.isArray(learnedChunkIds) || !learnedChunkIds.length) return '';
    const ids = learnedChunkIds.map((id) => escapeAttr(id)).join(',');
    return `<div class="agent-feedback" data-chunk-ids="${ids}">`
      + '<span class="agent-feedback-label">Полезен опыт?</span>'
      + '<button type="button" class="agent-feedback-btn" data-feedback="up" title="Да">👍</button>'
      + '<button type="button" class="agent-feedback-btn" data-feedback="down" title="Нет">👎</button>'
      + '</div>';
  }

  function bindFeedbackButtons(root) {
    root?.querySelectorAll('[data-feedback]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wrap = btn.closest('.agent-feedback');
        const ids = (wrap?.getAttribute('data-chunk-ids') || '').split(',').filter(Boolean);
        const vote = btn.getAttribute('data-feedback');
        try {
          await window.api.taskKnowledgeFeedback?.({ vote, chunkIds: ids });
          wrap?.querySelectorAll('[data-feedback]').forEach((b) => { b.disabled = true; });
          showAgentToast(vote === 'up' ? 'Учтено — усилю похожие уроки' : 'Учтено — снижу вес', 'ok');
        } catch {
          showAgentToast('Не удалось сохранить отзыв', 'error');
        }
      });
    });
  }

  function addMessage(role, html, meta, opts = {}) {
    const {
      pushHistory = true,
      followups = null,
      taskId = null,
      teamMessagePending = null,
      animate = true,
      learnedChunkIds = null,
    } = opts;
    clearWelcomePanel();
    messagesEl?.classList.remove('agent-messages--idle');

    const wrap = document.createElement('div');
    wrap.className = `agent-msg agent-msg-${role}${followups?.length ? ' agent-msg--has-followups' : ''}`;
    if (animate) {
      wrap.style.setProperty('--agent-msg-i', String(messageAnimIndex++));
      wrap.classList.add('agent-msg--enter');
    } else {
      wrap.classList.add('agent-msg--static');
    }

    const avatar = role === 'assistant' ? agentAvatarHtml() : userAvatarInnerHtml();
    const bubbleClass = role === 'assistant' ? 'agent-msg-bubble agent-md-wrap agent-msg-bubble--flat' : 'agent-msg-bubble agent-msg-bubble--user';

    wrap.innerHTML = `
      <div class="agent-msg-avatar">${avatar}</div>
      <div class="agent-msg-body">
        <div class="${bubbleClass}">${html}</div>
        ${meta ? `<div class="agent-msg-meta">${escapeHtml(meta)}</div>` : ''}
        ${role === 'assistant' ? buildFeedbackHtml(learnedChunkIds) : ''}
        ${role === 'assistant' ? buildFollowupsHtml(followups, taskId, animate, teamMessagePending) : ''}
      </div>`;

    messagesEl.appendChild(wrap);
    if (role === 'user') mountUserMessageAvatar(wrap);
    if (role === 'assistant') {
      bindCodeBlocks(wrap);
      bindAssistantToolbar(wrap);
      bindTaskAvatarFallbacks(wrap);
    }
    bindFeedbackButtons(wrap);
    scrollBottom();
    syncStageState();
    if (role === 'assistant' && opts.emotionCtx) {
      window.AgentVtuber?.onAssistantResponse?.(opts.emotionCtx);
    }
    if (pushHistory) { /* caller pushes to chatHistory */ }
    return wrap;
  }

  function setComposerThinkingStatus(text) {
    const bar = document.getElementById('agent-composer-status');
    const step = document.getElementById('agent-composer-status-step');
    if (!bar || !step) return;
    const next = String(text || '').trim();
    if (!next) {
      bar.classList.add('hidden');
      step.textContent = 'Думаю…';
      return;
    }
    step.textContent = next;
    bar.classList.remove('hidden');
  }

  function clearComposerThinkingStatus() {
    setComposerThinkingStatus('');
  }

  function removeThinking(thinking) {
    if (thinking?._thinkingTimer) clearInterval(thinking._thinkingTimer);
    thinking?.remove();
    clearComposerThinkingStatus();
    window.AgentVtuber?.clearThinking?.();
  }

  function syncThinkingStepUi(wrap, text, { dockOnly = false } = {}) {
    if (dockOnly) {
      setComposerThinkingStatus(text);
      return;
    }
    const stepEl = wrap?.querySelector?.('.agent-thinking-step-text');
    const next = String(text || '').trim();
    if (!next) return;
    if (stepEl) {
      stepEl.classList.add('agent-thinking-step-text--swap');
      window.setTimeout(() => {
        stepEl.textContent = next;
        stepEl.classList.remove('agent-thinking-step-text--swap');
      }, 180);
    }
  }

  function addThinking(task, customSteps) {
    clearWelcomePanel();
    messagesEl?.classList.remove('agent-messages--idle');
    const steps = customSteps?.length ? customSteps : buildThinkingSteps(task);
    const useDockStatus = window.AgentVtuber?.usesDockThinking?.();

    let wrap = { remove() {} };

    if (!useDockStatus) {
      wrap = document.createElement('div');
      wrap.className = 'agent-msg agent-msg-assistant agent-thinking agent-msg--enter';
      wrap.style.setProperty('--agent-msg-i', String(messageAnimIndex++));
      wrap.innerHTML = `
      <div class="agent-msg-avatar">${agentAvatarHtml()}</div>
      <div class="agent-msg-body">
        <div class="agent-msg-bubble agent-thinking-bubble">
          <div class="agent-thinking-head">
            <span class="agent-thinking-pulse" aria-hidden="true"></span>
            <span class="agent-thinking-label">Konstancia думает</span>
          </div>
          <div class="agent-thinking-step">
            <span class="agent-thinking-step-text">${escapeHtml(steps[0])}</span>
          </div>
          <div class="agent-thinking-track" aria-hidden="true">
            <span class="agent-thinking-track-fill"></span>
          </div>
        </div>
      </div>`;
      messagesEl.appendChild(wrap);
      scrollBottom();
      syncStageState();
    }

    window.AgentVtuber?.onThinking?.();
    if (useDockStatus) setComposerThinkingStatus(steps[0]);

    let stepIndex = 0;
    wrap._thinkingTimer = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      syncThinkingStepUi(wrap, steps[stepIndex], { dockOnly: useDockStatus });
    }, 1300);

    return wrap;
  }

  function autoResize() {
    if (!promptEl) return;
    const composer = document.getElementById('agent-composer');
    const lineHeight = 24;
    promptEl.style.height = 'auto';
    const next = Math.max(lineHeight, Math.min(promptEl.scrollHeight, 160));
    promptEl.style.height = `${next}px`;
    composer?.classList.toggle('agent-composer--multiline', next > lineHeight + 2);
  }

  let suggestionsAnimToken = 0;
  const SUG_ANIM_MS = 500;
  const SUG_STAGGER_MS = 30;

  function suggestionsAnimDurationMs(el) {
    const count = el?.querySelectorAll('.agent-sug').length || 0;
    return SUG_ANIM_MS + Math.max(0, count - 1) * SUG_STAGGER_MS + 24;
  }

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      || document.documentElement.dataset.noAnim === 'true';
  }

  function playSuggestionsEntrance() {
    const el = $('agent-suggestions');
    if (!el) return;
    el.classList.remove('is-anim-out');
    el.classList.remove('is-anim');
    void el.offsetHeight;
    el.classList.add('is-anim');
  }

  function playSuggestionsExit() {
    const el = $('agent-suggestions');
    if (!el || el.classList.contains('hidden')) {
      return Promise.resolve();
    }
    if (prefersReducedMotion()) {
      el.classList.remove('is-anim', 'is-anim-out');
      return Promise.resolve();
    }
    el.classList.remove('is-anim');
    void el.offsetHeight;
    el.classList.add('is-anim-out');
    return new Promise((resolve) => {
      window.setTimeout(() => {
        el.classList.remove('is-anim-out');
        resolve();
      }, suggestionsAnimDurationMs(el));
    });
  }

  async function toggleAgentIdeasPanel(forceOpen) {
    const shell = $('agent-composer-shell');
    const btn = $('agent-ideas-toggle');
    const sug = $('agent-suggestions');
    if (!shell || !sug) return false;
    const open = typeof forceOpen === 'boolean'
      ? forceOpen
      : !shell.classList.contains('agent-composer-shell--ideas-open');
    const token = ++suggestionsAnimToken;

    btn?.setAttribute('aria-pressed', open ? 'true' : 'false');
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      shell.classList.add('agent-composer-shell--ideas-open');
      sug.classList.remove('hidden');
      playSuggestionsEntrance();
      return true;
    }

    shell.classList.remove('agent-composer-shell--ideas-open');
    await playSuggestionsExit();
    if (token !== suggestionsAnimToken) return shell.classList.contains('agent-composer-shell--ideas-open');
    sug.classList.add('hidden');
    return false;
  }

  function canAttachAgentImages() {
    if (isKonstanciaProvider()) return true;
    return isVisionModelSelected();
  }

  function isVisionModelSelected() {
    const model = modelSelect?.value || window.appSettings?.agent?.model || '';
    return /^GigaChat-2/i.test(model);
  }

  async function ensureVisionModelForImages() {
    if (isVisionModelSelected()) return true;
    if (!modelSelect) return false;
    const visionModel = [...modelSelect.options].find((opt) => /^GigaChat-2/i.test(opt.value))?.value
      || 'GigaChat-2-Lite';
    modelSelect.value = visionModel;
    await saveAgentModelFromPage();
    return isVisionModelSelected();
  }

  function buildPikReferencePrompt({ appTitle, screenLabel, platform } = {}) {
    const app = appTitle || 'Приложение';
    const screen = screenLabel || 'Экран';
    const plat = platform ? ` · ${platform}` : '';
    return (
      `Референс UI из PIK-FOLDER: ${app} — ${screen}${plat}.\n\n`
      + 'Проанализируй скриншот: композиция, типографика, цвет, паттерны, сильные стороны. '
      + 'Предложи 3–5 конкретных вариантов, что можно с этим сделать (адаптировать в Figma, баннер, лендинг, компонент, A/B и т.д.). '
      + 'В конце добавь блок FOLLOWUPS с тремя короткими follow-up как следующие шаги в чате (не вопросы заказчику).'
    );
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function renderPendingAgentImages() {
    const box = $('agent-composer-attachments');
    const composer = $('agent-composer');
    if (!box) return;
    composer?.classList.toggle('agent-composer--has-attachments', pendingAgentImages.length > 0);
    box.replaceChildren();
    if (!pendingAgentImages.length) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    pendingAgentImages.forEach((img, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'agent-pending-image';
      wrap.dataset.pendingImageIndex = String(index);

      const imageEl = document.createElement('img');
      imageEl.src = img.previewUrl || img.dataUrl;
      imageEl.alt = img.filename || '';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'agent-pending-image-rm';
      removeBtn.dataset.pendingImageRm = String(index);
      removeBtn.setAttribute('aria-label', 'Убрать изображение');
      removeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const idx = Number(removeBtn.dataset.pendingImageRm);
        if (!Number.isFinite(idx)) return;
        const [removed] = pendingAgentImages.splice(idx, 1);
        if (removed?.previewUrl) {
          try { URL.revokeObjectURL(removed.previewUrl); } catch { /* ignore */ }
        }
        renderPendingAgentImages();
        updateSendState();
        syncStageState();
      });

      wrap.append(imageEl, removeBtn);
      box.appendChild(wrap);
    });
  }

  function appendPendingAgentImages(items = []) {
    const next = (Array.isArray(items) ? items : [])
      .filter((img) => img?.dataUrl)
      .map((img) => ({
        dataUrl: img.dataUrl,
        filename: img.filename || 'image.png',
        previewUrl: img.previewUrl || '',
      }));
    if (!next.length) return 0;
    const free = Math.max(0, MAX_PENDING_AGENT_IMAGES - pendingAgentImages.length);
    if (!free) {
      showAgentToast(`Максимум ${MAX_PENDING_AGENT_IMAGES} изображения за раз`, 'error');
      return 0;
    }
    const added = next.slice(0, free);
    pendingAgentImages.push(...added);
    if (next.length > free) {
      showAgentToast(`Добавлено ${added.length} из ${next.length} — лимит ${MAX_PENDING_AGENT_IMAGES}`, 'error');
    }
    if (added.length) clearWelcomePanel();
    renderPendingAgentImages();
    updateSendState();
    syncStageState();
    return added.length;
  }

  async function addAgentImagesFromFiles(files) {
    if (!canAttachAgentImages()) {
      showAgentToast('Изображения поддерживают GigaChat-2, 2-Pro или 2-Max', 'error');
      return;
    }
    const list = [...(files || [])].filter(isImageAttachmentFile);
    if (!list.length) return;

    const free = Math.max(0, MAX_PENDING_AGENT_IMAGES - pendingAgentImages.length);
    if (!free) {
      showAgentToast(`Максимум ${MAX_PENDING_AGENT_IMAGES} изображения за раз`, 'error');
      return;
    }

    const batch = list.slice(0, free);
    const items = [];
    for (const file of batch) {
      if (file.size > 15 * 1024 * 1024) {
        showAgentToast(`«${file.name || 'файл'}» больше 15 МБ — пропущен`, 'error');
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        let previewUrl = '';
        try { previewUrl = URL.createObjectURL(file); } catch { /* fallback to dataUrl */ }
        items.push({
          dataUrl,
          filename: file.name || 'image.png',
          previewUrl: previewUrl || '',
        });
      } catch {
        showAgentToast(`Не удалось прочитать «${file.name || 'файл'}»`, 'error');
      }
    }
    if (items.length) appendPendingAgentImages(items);
    if (list.length > free) {
      showAgentToast(`Добавлено ${Math.min(items.length, free)} из ${list.length} — лимит ${MAX_PENDING_AGENT_IMAGES}`, 'error');
    }
  }

  async function addAgentImageFromFile(file) {
    return addAgentImagesFromFiles([file]);
  }

  async function pickAgentImage() {
    if (!canAttachAgentImages()) {
      showAgentToast('Изображения поддерживают GigaChat-2, 2-Pro или 2-Max', 'error');
      return;
    }
    if (window.api?.agentPickImage) {
      try {
        const result = await window.api.agentPickImage();
        if (result?.canceled) return;
        if (!result?.ok) {
          if (result?.message) showAgentToast(result.message, 'error');
          return;
        }
        const images = Array.isArray(result.images) && result.images.length
          ? result.images
          : (result.image ? [result.image] : []);
        if (images.length) appendPendingAgentImages(images);
        return;
      } catch {
        /* fallback to hidden file input below */
      }
    }
    const input = $('agent-image-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  function onAgentImageInputChange(event) {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    void addAgentImagesFromFiles(files);
  }

  function buildUserMessageHtml(text, images) {
    const parts = [];
    const imgs = images?.length ? images : [];
    if (imgs.length) {
      const imgHtml = imgs.map((img) => {
        if (img?.dataUrl) {
          return `<img class="agent-user-image" src="${escapeHtml(img.dataUrl)}" alt="" loading="lazy" />`;
        }
        const name = escapeHtml(img?.filename || 'изображение');
        return `<div class="agent-user-image agent-user-image--stored" title="${name}">${name}</div>`;
      }).join('');
      if (imgHtml) parts.push(`<div class="agent-user-images">${imgHtml}</div>`);
    }
    const t = String(text || '').trim();
    if (t) parts.push(`<div class="agent-user-text">${escapeHtml(t).replace(/\n/g, '<br>')}</div>`);
    if (!parts.length) return '<span class="agent-user-image-only">Изображение</span>';
    return parts.join('');
  }

  function userDisplayText(content, images) {
    const text = String(content || '').trim();
    if (!text) return images?.length ? 'Изображение' : '';
    if (isPikReferencePrompt(text)) {
      const match = text.match(/PIK-FOLDER:\s*(.+?)(?:\.\s|\n)/i);
      return match ? `Референс UI: ${match[1].trim()}` : 'Референс UI из PIK-FOLDER';
    }
    return text;
  }

  function updateSendState() {
    const canSend = !sending && (!!promptEl?.value.trim() || pendingAgentImages.length > 0);
    if (sendBtn) sendBtn.disabled = !canSend;
  }

  async function refreshAgentStatus() {
    try {
      const status = await window.api.agentGetStatus?.();
      agentStatusCache = status || null;
      const configured = status?.configured;
      if (statusBanner) {
        statusBanner.classList.toggle('hidden', !!configured);
        if (!configured) {
          const hint = isKonstanciaProvider()
            ? 'Konstancia сейчас недоступна. Обратитесь к администратору SHKF.'
            : 'Подключите GigaChat: ';
          statusBanner.innerHTML = isKonstanciaProvider()
            ? hint
            : hint + '<a href="#" data-agent-open-settings>Настройки → Konstancia</a>';
        }
      }
    } catch { /* ignore */ }
  }

  function applyKanbanTasks(tasks) {
    if (!Array.isArray(tasks)) return;
    kanbanTasks = tasks;
    populateTaskSelect();
    updateTaskSelectHint();
  }

  function isKonstanciaProvider() {
    return true;
  }

  function getAgentModelLabel() {
    return 'Konstancia';
  }

  function syncAgentModelSelect() {
    const badge = $('agent-konstancia-badge');
    if (badge) badge.classList.remove('hidden');
    if (modelSelect) modelSelect.classList.add('hidden');
    updateTaskSelectHint();
  }

  async function saveAgentModelFromPage() {
    if (!modelSelect || savingAgentModel) return;
    const model = modelSelect.value || 'Konstancia';
    const prev = window.appSettings?.agent?.model || 'Konstancia';
    if (model === prev) return;

    savingAgentModel = true;
    modelSelect.disabled = true;
    try {
      const agent = {
        ...(window.appSettings?.agent || {}),
        model,
      };
      await window.api.updateAppSettings({ agent });
      if (window.appSettings) window.appSettings.agent = agent;
      const settingsModel = document.getElementById('set-agent-model');
      if (settingsModel) settingsModel.value = model;
      updateTaskSelectHint();
      showAgentToast(`Модель: ${model}`, 'ok');
    } catch (err) {
      modelSelect.value = prev;
      showAgentToast(err.message || 'Не удалось сохранить модель', 'error');
    } finally {
      modelSelect.disabled = false;
      savingAgentModel = false;
    }
  }

  function updateTaskSelectHint() {
    const sub = $('agent-chat-sub');
    if (!sub) return;
    const modelLabel = getAgentModelLabel();
    if (!kanbanTasks.length) {
      sub.textContent = `${modelLabel} · выберите задачу в Kanban или подключите Redmine`;
    } else {
      sub.textContent = `${modelLabel} · ${kanbanTasks.length} задач из Kanban`;
    }
  }

  function populateTaskSelect() {
    if (!taskSelect) return;
    const prev = taskSelect.value;
    taskSelect.innerHTML = '<option value="">— Без задачи —</option>';

    if (!kanbanTasks.length) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Нет задач — откройте Kanban и обновите';
      empty.disabled = true;
      taskSelect.appendChild(empty);
      setTaskSelectValue('', { silent: true });
      renderTaskPickerMenu();
      return;
    }

    kanbanTasks.forEach((task) => {
      const opt = document.createElement('option');
      opt.value = String(task.id);
      opt.textContent = `#${task.id} · ${(task.subject || '').slice(0, 48)}`;
      taskSelect.appendChild(opt);
    });
    if (prev && kanbanTasks.some((t) => String(t.id) === prev)) {
      setTaskSelectValue(prev, { silent: true });
    } else {
      setTaskSelectValue('', { silent: true });
    }
    renderTaskPickerMenu();
  }

  async function loadKanbanTasks() {
    const cached = window.getMetaskCachedTasks?.();
    if (cached?.length) applyKanbanTasks(cached);

    try {
      const result = await window.api.metaskSync?.();
      if (Array.isArray(result?.tasks)) {
        applyKanbanTasks(result.tasks);
      }
    } catch {
      if (!kanbanTasks.length) populateTaskSelect();
    }
    updateTaskSelectHint();
  }

  function buildBannerNanobananaHtml(result) {
    const summary = result.summary
      ? escapeHtml(result.summary).replace(/\n/g, '<br>')
      : '';
    const promptBlock = result.prompt
      ? `<details class="agent-nb-prompt"><summary>Промпт для NanoBanana</summary><pre class="agent-nb-prompt-pre">${escapeHtml(result.prompt)}</pre></details>`
      : '';
    const imgs = (result.imageUrls || [])
      .map((url) => `<a class="agent-nb-thumb-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="agent-nb-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" /></a>`)
      .join('');
    const galleryId = result.galleryItem?.id ? escapeHtml(result.galleryItem.id) : '';
    return `
      <p><strong>Баннер в NanoBanana</strong></p>
      ${summary ? `<p>${summary}</p>` : ''}
      ${promptBlock}
      ${imgs ? `<div class="agent-nb-images">${imgs}</div>` : ''}
      <p class="agent-nb-actions">
        <button type="button" class="agent-nb-open-btn" data-nb-gallery-id="${galleryId}">Открыть в NanoBanana</button>
        ${galleryId ? `<button type="button" class="agent-nb-open-btn agent-nb-mockup-btn" data-nb-gallery-id="${galleryId}">Мокап баннера</button>` : ''}
      </p>`;
  }

  function bindBannerNanobananaActions(wrap) {
    wrap?.querySelector('.agent-nb-open-btn:not(.agent-nb-mockup-btn)')?.addEventListener('click', () => {
      const id = wrap.querySelector('.agent-nb-open-btn:not(.agent-nb-mockup-btn)')?.dataset?.nbGalleryId;
      window.syncNanobananaFromAgent?.({
        prompt: wrap.querySelector('.agent-nb-prompt-pre')?.textContent || '',
        galleryItemId: id || null,
      });
    });
    wrap?.querySelector('.agent-nb-mockup-btn')?.addEventListener('click', () => {
      const id = wrap.querySelector('.agent-nb-mockup-btn')?.dataset?.nbGalleryId;
      window.syncBannerMockupFromNanobanana?.({ galleryItemId: id || null, navigate: true });
    });
  }

  function buildFigmaMakeHtml({ token, summary, prompt, sendResult, enhancements = [], appliedEnhancements = [] }) {
    const status = sendResult?.submitted
      ? 'Figma Make открыта — генерация запущена'
      : (sendResult?.message || 'Figma Make открыта с вашим промптом');
    const summaryHtml = summary
      ? `<p>${escapeHtml(summary).replace(/\n/g, '<br>')}</p>`
      : '';
    const promptBlock = prompt
      ? `<details class="agent-nb-prompt"><summary>Промпт для Figma Make</summary><pre class="agent-nb-prompt-pre">${escapeHtml(prompt)}</pre></details>`
      : '';
    const available = (enhancements || []).filter((item) => !appliedEnhancements.includes(item.id));
    const chips = available.map((item) => (
      `<button type="button" class="agent-make-enhance" data-figma-make-enhance="${escapeAttr(item.id)}" data-figma-make-token="${escapeAttr(token)}" title="${escapeAttr(item.instruction || item.label)}">${escapeHtml(item.label)}</button>`
    )).join('');
    const enhanceBlock = chips
      ? `<div class="agent-make-enhance-wrap"><p class="agent-make-enhance-label">Дополнить промпт и отправить снова:</p><div class="agent-make-enhance-list">${chips}</div></div>`
      : '';
    return `
      <div class="agent-make-ready" data-figma-make-token="${escapeHtml(token)}">
        <p><strong>Figma Make</strong></p>
        ${summaryHtml}
        <p class="agent-make-status">${escapeHtml(status)}</p>
        ${promptBlock}
        ${enhanceBlock}
      </div>`;
  }

  function bindFigmaMakeActions(wrap) {
    wrap?.querySelectorAll('[data-figma-make-enhance]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const token = btn.getAttribute('data-figma-make-token');
        const enhancementId = btn.getAttribute('data-figma-make-enhance');
        if (!token || !enhancementId) return;
        btn.disabled = true;
        btn.classList.add('agent-make-enhance--sending');
        void sendFigmaMakeEnhance(token, enhancementId).finally(() => {
          if (btn.isConnected) {
            btn.disabled = false;
            btn.classList.remove('agent-make-enhance--sending');
          }
        });
      });
    });
  }

  async function sendFigmaMakeEnhance(token, enhancementId) {
    const session = pendingFigmaMakeSessions.get(token);
    if (!session) {
      showAgentToast('Сессия Figma Make устарела — отправьте запрос заново', 'error');
      return;
    }
    if (sending) return;
    sending = true;
    updateSendState();
    const thinking = addThinking(session.task, ['Дополняю промпт…', 'Отправляю в Figma Make…']);
    try {
      const result = await window.api.agentFigmaMakeSend?.({
        message: session.userMessage,
        task: session.task?.id ? session.task : null,
        basePrompt: session.prompt,
        enhancementId,
      });
      removeThinking(thinking);
      if (!result?.ok) {
        addMessage('assistant', `<p>${escapeHtml(result?.message || 'Ошибка').replace(/\n/g, '<br>')}</p>`, 'Figma Make');
        return;
      }
      session.prompt = result.prompt;
      session.appliedEnhancements = [...(session.appliedEnhancements || []), enhancementId];
      pendingFigmaMakeSessions.set(token, session);
      const root = messagesEl?.querySelector(`[data-figma-make-token="${token}"]`);
      if (root) {
        const wrap = root.closest('.agent-msg');
        const body = wrap?.querySelector('.agent-msg-body .agent-md-wrap, .agent-msg-body .agent-msg-bubble--flat');
        if (body) {
          body.innerHTML = buildFigmaMakeHtml({
            token,
            summary: result.summary,
            prompt: result.prompt,
            sendResult: result.sendResult,
            enhancements: result.enhancements,
            appliedEnhancements: session.appliedEnhancements,
          });
          bindFigmaMakeActions(body);
        }
      } else {
        const tokenNext = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pendingFigmaMakeSessions.set(tokenNext, session);
        const msgWrap = addMessage('assistant', buildFigmaMakeHtml({
          token: tokenNext,
          summary: result.summary,
          prompt: result.prompt,
          sendResult: result.sendResult,
          enhancements: result.enhancements,
          appliedEnhancements: session.appliedEnhancements,
        }), 'Figma Make');
        bindFigmaMakeActions(msgWrap);
      }
      chatHistory.push({
        role: 'assistant',
        content: [result.summary || 'Промпт дополнен и отправлен в Figma Make.', '', result.prompt].join('\n'),
        meta: 'Figma Make',
      });
      saveHistory();
      showAgentToast('Обновлённый промпт отправлен в Figma Make', 'ok');
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Сбой').replace(/\n/g, '<br>')}</p>`, 'Figma Make');
    } finally {
      sending = false;
      updateSendState();
    }
  }

  async function sendFigmaMake(textOverride, options = {}) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    if (!text || sending) return;

    updateTaskThread(text);
    sending = true;
    updateSendState();

    addMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
    chatHistory.push({ role: 'user', content: text, taskThread: true });
    saveHistory();

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const task = getSelectedTask();
    const thinking = addThinking(task, [
      'Читаю задачу и запрос…',
      'Составляю промпт для Figma Make…',
      'Открываю Figma Make…',
    ]);

    try {
      const result = await window.api.agentFigmaMakeSend?.({
        message: text,
        task: task?.id ? task : null,
        enhancementId: options.enhancementId || null,
        basePrompt: options.basePrompt || null,
      });

      removeThinking(thinking);

      if (!result?.ok) {
        let errHtml = `<p>${escapeHtml(result?.message || 'Ошибка').replace(/\n/g, '<br>')}</p>`;
        if (result?.prompt) {
          errHtml += `<details class="agent-nb-prompt"><summary>Промпт (не отправлен)</summary><pre class="agent-nb-prompt-pre">${escapeHtml(result.prompt)}</pre></details>`;
        }
        addMessage('assistant', errHtml, 'Figma Make');
        notifyIfAgentInBackground({
          title: 'Konstancia · Figma Make',
          body: result?.message || 'Не удалось отправить промпт',
        });
        return;
      }

      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingFigmaMakeSessions.set(token, {
        prompt: result.prompt,
        userMessage: text,
        task,
        appliedEnhancements: result.enhancementId ? [result.enhancementId] : [],
      });

      const msgWrap = addMessage('assistant', buildFigmaMakeHtml({
        token,
        summary: result.summary,
        prompt: result.prompt,
        sendResult: result.sendResult,
        enhancements: result.enhancements,
        appliedEnhancements: result.enhancementId ? [result.enhancementId] : [],
      }), 'Figma Make');
      bindFigmaMakeActions(msgWrap);

      chatHistory.push({
        role: 'assistant',
        content: [result.summary || 'Промпт отправлен в Figma Make.', '', result.prompt].join('\n'),
        meta: 'Figma Make',
      });
      saveHistory();

      notifyIfAgentInBackground({
        title: 'Konstancia · Figma Make',
        body: result.summary || 'Промпт отправлен в Figma Make',
      });
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Сбой').replace(/\n/g, '<br>')}</p>`, 'Figma Make');
      notifyIfAgentInBackground({
        title: 'Konstancia · Figma Make',
        body: err.message || 'Сбой отправки в Figma Make',
      });
    } finally {
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  function buildMockupConfirmHtml({ token, task, mockups }) {
    const previews = mockups.slice(0, 3).map((m) => `<span class="agent-mockup-chip">${escapeHtml(m.label || `${m.width}x${m.height}`)}</span>`).join('');
    const extra = mockups.length > 3 ? `<span class="agent-mockup-more">+${mockups.length - 3}</span>` : '';
    return `
      <div class="agent-mockup-ready" data-mockup-token="${escapeHtml(token)}">
        <p><strong>Мокапы готовы.</strong> Отправляем в задачу <strong>#${escapeHtml(task.id)}</strong>?</p>
        <p class="agent-mockup-sub">Комментарий: <em>Сделал вариант баннера.</em></p>
        <div class="agent-mockup-chips">${previews}${extra}</div>
        <div class="agent-mockup-actions">
          <button type="button" class="agent-link-btn agent-link-btn--apply" data-mockup-send="${escapeHtml(token)}">Отправить</button>
          <button type="button" class="agent-link-btn agent-link-btn--dismiss" data-mockup-cancel="${escapeHtml(token)}">Не отправлять</button>
        </div>
      </div>`;
  }

  async function prepareMockupsForTaskPosting(task, galleryItemId) {
    if (!task?.id || !galleryItemId) return;
    const thinking = addThinking(task, [
      'Готовлю мокапы из всех размеров…',
      'Проверяю, что задача в Redmine выбрана…',
      'Запрашиваю подтверждение отправки…',
    ]);
    try {
      await window.syncBannerMockupFromNanobanana?.({ galleryItemId, navigate: false });
      const exported = await window.exportBannerMockupsForAgent?.({ galleryItemId });
      removeThinking(thinking);
      if (!exported?.ok || !exported.mockups?.length) {
        addMessage('assistant', '<p>Мокапы не удалось подготовить для отправки в задачу.</p>', 'Redmine');
        notifyIfAgentInBackground({
          title: 'Konstancia · Redmine',
          body: 'Мокапы не удалось подготовить для отправки в задачу.',
        });
        return;
      }
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingMockupPosts.set(token, {
        issueId: Number(task.id),
        taskUrl: task.url || '',
        mockups: exported.mockups,
      });
      const html = buildMockupConfirmHtml({ token, task, mockups: exported.mockups });
      addMessage('assistant', html, 'Redmine', { pushHistory: false });
      if (!isAgentPageActive()) {
        showBackgroundMockupReadyCard(token, task, exported.mockups);
        beepAgentNotification();
        window.api.agentNotifyBackground?.({
          title: 'Konstancia · Redmine',
          body: `Мокапы готовы для задачи #${task.id}. Отправляем?`,
        }).catch(() => {});
      }
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Не удалось собрать мокапы')}</p>`, 'Redmine');
      notifyIfAgentInBackground({
        title: 'Konstancia · Redmine',
        body: err.message || 'Не удалось собрать мокапы',
      });
    }
  }

  function markMockupDecision(token, text, ok = false) {
    const root = [...(messagesEl?.querySelectorAll('[data-mockup-token]') || [])]
      .find((el) => el.getAttribute('data-mockup-token') === token);
    if (!root) return;
    const actions = root.querySelector('.agent-mockup-actions');
    actions?.replaceChildren();
    const p = document.createElement('p');
    p.className = `agent-link-status${ok ? ' agent-link-status--ok' : ''}`;
    p.textContent = text;
    root.appendChild(p);
  }

  function resolveTaskUrl(issueId) {
    const id = Number(issueId);
    if (!id) return '';
    const task = kanbanTasks.find((t) => Number(t.id) === id);
    return task?.url || '';
  }

  function openTaskInKanban(issueId, taskUrlHint = '') {
    const id = Number(issueId);
    if (!id) return;
    const url = String(taskUrlHint || resolveTaskUrl(id) || '').trim();
    if (typeof window.openMetaskTask === 'function') {
      window.openMetaskTask(id, url);
      return;
    }
    document.querySelector('.nav-item[data-page="metask"]')?.click();
    if (!url) {
      showAgentToast(`Открыли Канбан. Выберите задачу #${id} в списке.`, 'ok');
      return;
    }
    setTimeout(() => {
      window.api.metaskOpenIssue?.(url);
    }, 120);
  }

  async function postMockupsToTask(token) {
    const payload = pendingMockupPosts.get(token);
    if (!payload) return;
    const okConfirm = window.confirm(
      `Отправить мокапы в комментарий к задаче #${payload.issueId} в Redmine?\n\nЭто явное действие — Konstancia не пишет в трекер автоматически.`,
    );
    if (!okConfirm) return;
    const res = await window.api.agentPostMockupsToTask({
      issueId: payload.issueId,
      images: payload.mockups.map((m) => ({
        dataUrl: m.dataUrl,
        filename: m.filename,
        contentType: 'image/png',
      })),
    });
    if (res?.ok) {
      markMockupDecision(token, `Отправлено в задачу #${payload.issueId} ✓`, true);
      markBackgroundMockupDecision(token, `Отправлено в задачу #${payload.issueId} ✓`, true);
      const rootChat = [...(messagesEl?.querySelectorAll('[data-mockup-token]') || [])]
        .find((el) => el.getAttribute('data-mockup-token') === token);
      if (rootChat && !rootChat.querySelector('[data-open-metask-task]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'agent-open-task-btn';
        btn.setAttribute('data-open-metask-task', String(payload.issueId));
        btn.setAttribute('data-open-metask-url', payload.taskUrl || '');
        btn.textContent = 'Открыть задачу в Канбан';
        rootChat.appendChild(btn);
      }
      const rootBg = [...document.querySelectorAll('[data-bg-mockup-token]')]
        .find((el) => el.getAttribute('data-bg-mockup-token') === token);
      if (rootBg && !rootBg.querySelector('[data-bg-open-metask-task]')) {
        const foot = document.createElement('div');
        foot.className = 'agent-bg-notify-foot';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'agent-bg-notify-open';
        btn.setAttribute('data-bg-open-metask-task', String(payload.issueId));
        btn.setAttribute('data-bg-open-metask-url', payload.taskUrl || '');
        btn.textContent = 'Открыть задачу в Канбан';
        foot.appendChild(btn);
        rootBg.appendChild(foot);
      }
      showAgentToast('Мокапы отправлены в Redmine', 'ok');
      pendingMockupPosts.delete(token);
      return;
    }
    markMockupDecision(token, res?.message || 'Ошибка отправки');
    markBackgroundMockupDecision(token, res?.message || 'Ошибка отправки');
    showAgentToast(res?.message || 'Не удалось отправить мокапы', 'error');
  }

  function opText(op) {
    const kind = String(op?.op || '');
    if (kind === 'create_frame') return `Создать frame "${String(op.name || op.key || 'Frame')}" ${op.width || '?'}×${op.height || '?'}`;
    if (kind === 'create_text') return `Создать text "${String(op.text || op.label || '').slice(0, 90)}"`;
    if (kind === 'create_rect') return `Создать rectangle "${String(op.name || op.key || 'Rect')}"`;
    if (kind === 'create_button') return `Создать button "${String(op.label || op.text || 'Button').slice(0, 90)}"`;
    if (kind === 'set_text') return `Текст → "${String(op.text || '').slice(0, 90)}"`;
    if (kind === 'rename') return `Переименовать в "${String(op.name || '').slice(0, 90)}"`;
    if (kind === 'set_fill_solid' && op.fill) return `Заливка: rgb(${op.fill.r}, ${op.fill.g}, ${op.fill.b})`;
    if (kind === 'set_stroke_solid' && (op.stroke || op.fill)) {
      const c = op.stroke || op.fill;
      return `Обводка: rgb(${c.r}, ${c.g}, ${c.b})`;
    }
    if (kind === 'resize') return `Размер: ${op.width || '?'}×${op.height || '?'}`;
    if (kind === 'move') return `Позиция: x=${op.x ?? '?'} y=${op.y ?? '?'}`;
    if (kind === 'set_corner_radius') return `Радиус: ${op.radius}`;
    if (kind === 'set_auto_layout') return `Auto Layout: ${op.layoutMode || 'NONE'}`;
    if (kind === 'set_padding') return 'Отступы контейнера';
    if (kind === 'set_spacing') return `Gap: ${op.spacing}`;
    if (kind === 'set_visibility') return op.visible ? 'Показать' : 'Скрыть';
    return kind;
  }

  function buildFigmaPlanHtml({ token, plan, selection, refs, critic, visionFallback, liteMode, cursorFallback }) {
    const assumptions = (plan.assumptions || [])
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join('');
    const allOps = plan.operations || [];
    const opsShown = allOps.slice(0, 12);
    const opsExtra = allOps.length > opsShown.length
      ? `<li class="agent-mockup-sub">…и ещё ${allOps.length - opsShown.length} операций</li>`
      : '';
    const ops = opsShown
      .map((op, idx) => `<li><strong>${idx + 1}.</strong> ${escapeHtml(opText(op))}</li>`)
      .join('') + opsExtra;
    const pagesList = Array.isArray(plan.pages) && plan.pages.length
      ? `<p class="agent-mockup-sub"><strong>Экраны:</strong></p><ul class="agent-md-ul">${plan.pages.map((p) => (
        `<li><code>${escapeHtml(p.route || '/')}</code> — ${escapeHtml(p.name || '')}${p.purpose ? ` <span class="agent-mockup-sub">(${escapeHtml(p.purpose)})</span>` : ''}</li>`
      )).join('')}</ul>`
      : '';
    const refList = Array.isArray(refs) && refs.length
      ? `<ul class="agent-md-ul">${refs.slice(0, 4).map((r) => (
        `<li><a href="#" class="agent-md-link" data-agent-href="${escapeAttr(r.url)}">${escapeHtml(r.title || r.url)}</a></li>`
      )).join('')}</ul>`
      : '';
    const criticLine = critic
      ? `<p class="agent-mockup-sub"><strong>Critic:</strong> ${escapeHtml(String(critic.verdict || 'unknown'))} · score ${escapeHtml(Number(critic.score || 0))}/100${critic.issues?.[0] ? ` · ${escapeHtml(critic.issues[0])}` : ''}</p>`
      : '';
    const cursorFallbackNote = cursorFallback
      ? '<p class="agent-mockup-sub" style="color:#b45309"><strong>Cursor не смог</strong> — ниже план для кнопки «Применить в Figma» (плагин Bridge). Проверьте Figma MCP в настройках Cursor.</p>'
      : '';
    const liteNote = liteMode
      ? '<p class="agent-mockup-sub" style="color:#0369a1"><strong>GigaChat Lite</strong> — макет по тексту (без анализа скрина Mobbin). Для копии 1:1 нужны токены Pro/Max.</p>'
      : '';
    const fallbackNote = visionFallback
      ? '<p class="agent-mockup-sub" style="color:#b45309"><strong>Vision не вернул JSON</strong> — показан запасной структурный макет по теме (не копия скрина). Перезапустите SHKF и повторите для копии 1:1.</p>'
      : '';
    return `
      <div class="agent-mockup-ready" data-figma-plan-token="${escapeHtml(token)}">
        <p><strong>План правок для Figma готов.</strong></p>
        ${cursorFallbackNote}
        ${liteNote}
        ${fallbackNote}
        ${plan.summary ? `<p class="agent-mockup-sub">${escapeHtml(plan.summary)}</p>` : ''}
        <p class="agent-mockup-sub">Файл: <strong>${escapeHtml(selection?.fileName || '—')}</strong>, страница: <strong>${escapeHtml(selection?.pageName || '—')}</strong>, выделено: <strong>${escapeHtml(selection?.selectedCount || 0)}</strong></p>
        ${criticLine}
        ${refList ? `<p class="agent-mockup-sub"><strong>Референсы Mobbin:</strong></p>${refList}` : ''}
        ${pagesList}
        ${assumptions ? `<ul class="agent-md-ul">${assumptions}</ul>` : ''}
        <p class="agent-mockup-sub"><strong>Операции (${allOps.length}):</strong></p>
        <ul class="agent-md-ul">${ops}</ul>
        <div class="agent-mockup-actions">
          <button type="button" class="agent-link-btn agent-link-btn--apply" data-figma-plan-apply="${escapeHtml(token)}">Применить в Figma</button>
          <button type="button" class="agent-link-btn agent-link-btn--dismiss" data-figma-plan-cancel="${escapeHtml(token)}">Отменить</button>
        </div>
      </div>`;
  }

  function markFigmaPlanDecision(token, text, ok = false) {
    const root = [...(messagesEl?.querySelectorAll('[data-figma-plan-token]') || [])]
      .find((el) => el.getAttribute('data-figma-plan-token') === token);
    if (!root) return;
    root.querySelector('.agent-mockup-actions')?.remove();
    const p = document.createElement('p');
    p.className = `agent-link-status${ok ? ' agent-link-status--ok' : ''}`;
    p.textContent = text;
    root.appendChild(p);
  }

  async function applyFigmaPlan(token) {
    const payload = pendingFigmaPlans.get(token);
    if (!payload) return;
    const res = await window.api.agentFigmaApply?.({ operations: payload.plan.operations || [] });
    if (res?.ok) {
      markFigmaPlanDecision(token, `Применено: ${res.applied || 0}, ошибок: ${res.failed || 0}`, true);
      pendingFigmaPlans.delete(token);
      return;
    }
    markFigmaPlanDecision(token, res?.message || 'Не удалось применить правки');
  }

  function buildSiteBuildHtml({ token, plan, refs, mobbinLive, buildMode }) {
    const pages = (plan.pages || [])
      .map((p) => {
        const blocks = String(p.purpose || '').split(',').filter(Boolean).map((b) => `<code class="agent-site-block">${escapeHtml(b.trim())}</code>`).join(' ');
        return `<li><code>${escapeHtml(p.route || '/')}</code> — ${escapeHtml(p.name || '')} ${blocks ? `<span class="agent-site-blocks">${blocks}</span>` : ''}</li>`;
      })
      .join('');
    const files = (plan.files || [])
      .map((f) => `<li><code>${escapeHtml(f.path || '')}</code></li>`)
      .join('');
    const refList = Array.isArray(refs) && refs.length
      ? `<ul class="agent-md-ul">${refs.slice(0, 5).map((r) => (
        `<li><a href="#" class="agent-md-link" data-agent-href="${escapeAttr(r.url)}">${escapeHtml(r.title || r.url)}</a></li>`
      )).join('')}</ul>`
      : '';
    const readme = (plan.files || []).find((f) => /readme\.md$/i.test(f.path || ''));
    const readmePreview = readme?.content
      ? `<pre class="agent-code-block agent-code-block--compact">${escapeHtml(readme.content.slice(0, 1200))}${readme.content.length > 1200 ? '\n…' : ''}</pre>`
      : '';
    const modeLabel = buildMode === 'llm+scaffold'
      ? 'Mobbin blueprint + детерминированный scaffold'
      : 'Детерминированный scaffold (стабильные блоки UI)';
    return `
      <div class="agent-mockup-ready agent-site-build" data-site-build-token="${escapeHtml(token)}">
        <p><strong>Проект готов.</strong> ${plan.summary ? escapeHtml(plan.summary) : ''}</p>
        <p class="agent-mockup-sub">${escapeHtml(modeLabel)} · ${plan.files?.length || 0} файлов</p>
        ${mobbinLive ? '<p class="agent-mockup-sub">Референсы: live Mobbin + design memory</p>' : '<p class="agent-mockup-sub">Референсы: design memory (Mobbin API key — live-поиск)</p>'}
        ${refList ? `<p class="agent-mockup-sub"><strong>Mobbin:</strong></p>${refList}` : ''}
        ${pages ? `<p class="agent-mockup-sub"><strong>Страницы и блоки:</strong></p><ul class="agent-md-ul agent-site-pages">${pages}</ul>` : ''}
        ${files ? `<p class="agent-mockup-sub"><strong>Файлы:</strong></p><ul class="agent-md-ul agent-site-files">${files}</ul>` : ''}
        ${readmePreview ? `<p class="agent-mockup-sub"><strong>README</strong></p>${readmePreview}` : ''}
        <div class="agent-mockup-actions">
          <button type="button" class="agent-link-btn agent-link-btn--apply" data-site-build-export="${escapeHtml(token)}">Сохранить на диск</button>
          <button type="button" class="agent-link-btn" data-site-build-copy="${escapeHtml(token)}">Копировать в буфер</button>
          <button type="button" class="agent-link-btn agent-link-btn--dismiss" data-site-build-open-readme="${escapeHtml(token)}">README целиком</button>
        </div>
      </div>`;
  }

  const pendingSiteBuilds = new Map();

  async function copySiteBuildBundle(token) {
    const payload = pendingSiteBuilds.get(token);
    if (!payload?.plan?.files?.length) return;
    const res = await window.api.agentSiteBuildCopy?.({ plan: payload.plan });
    if (res?.ok) {
      showAgentToast(`Скопировано ${payload.plan.files.length} файлов`, 'ok');
      return;
    }
    showAgentToast(res?.message || 'Не удалось скопировать', 'error');
  }

  async function exportSiteBuild(token) {
    const payload = pendingSiteBuilds.get(token);
    if (!payload?.plan?.files?.length) return;
    const res = await window.api.agentSiteBuildExport?.({ plan: payload.plan });
    if (res?.ok) {
      showAgentToast(`Сохранено ${res.fileCount} файлов`, 'ok');
      if (res.dir) {
        addMessage('assistant', `<p class="agent-mockup-sub">Папка проекта: <code>${escapeHtml(res.dir)}</code></p><p class="agent-mockup-sub">В терминале: <code>cd "${escapeHtml(res.dir)}" &amp;&amp; npm install &amp;&amp; npm run dev</code></p>`, 'Site Builder', { pushHistory: false });
      }
      return;
    }
    showAgentToast(res?.message || 'Не удалось сохранить', 'error');
  }

  function showSiteBuildReadme(token) {
    const payload = pendingSiteBuilds.get(token);
    const readme = payload?.plan?.files?.find((f) => /readme/i.test(f.path || ''));
    if (!readme?.content) {
      showAgentToast('README не найден в ответе', 'error');
      return;
    }
    addMessage('assistant', `<pre class="agent-code-block">${escapeHtml(readme.content)}</pre>`, 'Site Builder · README', { pushHistory: false });
  }

  async function sendSiteBuild(textOverride) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    if (!text || sending) return;

    updateTaskThread(text);
    sending = true;
    updateSendState();

    addMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
    chatHistory.push({ role: 'user', content: text, taskThread: taskThreadActive });
    saveHistory();

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const task = getSelectedTask();
    const useTaskContext = taskThreadActive
      && task
      && window.appSettings?.agent?.useTaskContext !== false;
    const thinking = addThinking(useTaskContext ? task : null, [
      'Ищу референсы в Mobbin…',
      'Сопоставляю паттерны UI…',
      'Планирую страницы и роутинг…',
      'Генерирую файлы проекта…',
    ]);

    try {
      const result = await window.api.agentSiteBuild?.({
        message: text.replace(/^\/site\s*/i, ''),
        history: chatHistory.slice(0, -1),
        task: useTaskContext ? task : null,
      });
      removeThinking(thinking);
      if (!result?.ok || !result?.plan?.files?.length) {
        addMessage('assistant', `<p>${escapeHtml(result?.message || 'Не удалось собрать проект')}</p>`, 'Site Builder');
        return;
      }
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingSiteBuilds.set(token, { plan: result.plan });
      addMessage('assistant', buildSiteBuildHtml({
        token,
        plan: result.plan,
        refs: result.refs,
        mobbinLive: result.mobbinLive,
        buildMode: result.buildMode,
      }), result.model ? `Site Builder · ${result.model}` : 'Site Builder');
      chatHistory.push({
        role: 'assistant',
        content: `Собран проект: ${result.plan.summary || `${result.plan.files.length} файлов`}`,
        meta: 'Site Builder',
      });
      saveHistory();
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка сборки сайта')}</p>`, 'Site Builder');
    } finally {
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  let mobbinLiveCached = null;
  async function isMobbinLiveEnabled() {
    if (mobbinLiveCached != null) return mobbinLiveCached;
    try {
      const st = await window.api.agentMobbinStatus?.();
      mobbinLiveCached = !!st?.configured;
    } catch {
      mobbinLiveCached = false;
    }
    return mobbinLiveCached;
  }

  function buildMobbinPickerHtml(screens, sessionToken, live, searchQuery, localOnly, hint, total, platform) {
    const count = total ?? screens?.length ?? 0;
    const platLabel = platform === 'web' ? 'Web' : 'iOS (mobile)';
    const cards = (screens || []).map((s) => {
      const img = s.image_url
        ? `<img class="mobbin-pick-img" src="${escapeAttr(s.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : '<div class="mobbin-pick-placeholder">Нет превью</div>';
      const plat = s.platform ? String(s.platform).toUpperCase() : '';
      const src = s.source === 'mobbin' ? 'Mobbin live' : (s.source || 'library');
      return `<button type="button" class="mobbin-pick-card" data-mobbin-pick="${escapeAttr(sessionToken)}" data-screen-id="${escapeAttr(s.id)}">
        ${img}
        <span class="mobbin-pick-title">${escapeHtml(s.app_name || 'Screen')}</span>
        <span class="mobbin-pick-meta">${escapeHtml(plat)}${plat ? ' · ' : ''}${escapeHtml(src)}</span>
        <span class="mobbin-pick-open" data-agent-href="${escapeAttr(s.mobbin_url || '#')}">Открыть в Mobbin ↗</span>
      </button>`;
    }).join('');
    return `
      <div class="mobbin-picker" data-mobbin-session="${escapeAttr(sessionToken)}">
        <p><strong>Выберите референс Mobbin</strong> <span class="mobbin-pick-meta">(${count} вариантов)</span></p>
        <p class="agent-mockup-sub">${live ? 'Live Mobbin API — только результаты поиска по вашей теме, без фиксированного seed.' : 'Без Mobbin API key: локальная библиотека + превью со страниц.'}</p>
        ${hint ? `<p class="agent-mockup-sub">${escapeHtml(hint)}</p>` : ''}
        <p class="agent-mockup-sub">Платформа Mobbin: <strong>${escapeHtml(platLabel)}</strong></p>
        ${searchQuery ? `<p class="agent-mockup-sub">Тема подбора: <em>${escapeHtml(searchQuery)}</em></p>` : ''}
        <p class="agent-mockup-sub">Выберите экран → <strong>Cursor верстает в Figma</strong> (если включён в настройках). Иначе GigaChat Lite/Pro + кнопка «Применить». В запросе <code>/vision</code> — только GigaChat.</p>
        <div class="mobbin-picker-actions">
          ${localOnly ? `<button type="button" class="agent-btn-secondary" data-mobbin-skip="${escapeAttr(sessionToken)}">Собрать макет без выбора референса</button>` : ''}
        </div>
        <div class="mobbin-picker-grid">${cards || '<p>Ничего не найдено. Уточните запрос.</p>'}</div>
      </div>`;
  }

  function formatStyleColorSwatches(colors) {
    if (!colors || typeof colors !== 'object') return '';
    const entries = [
      ['Фон', colors.background],
      ['Карточки', colors.surface],
      ['Акцент', colors.accent],
      ['Текст', colors.text],
    ].filter(([, v]) => v);
    if (!entries.length) return '';
    return `<div class="mobbin-style-swatches">${entries.map(([label, hex]) => (
      `<span class="mobbin-style-swatch" title="${escapeAttr(label)}: ${escapeAttr(hex)}">`
      + `<i style="background:${escapeAttr(hex)}"></i></span>`
    )).join('')}</div>`;
  }

  function buildMobbinStylePickerHtml(styles, sessionToken, meta = {}) {
    const cards = (styles || []).map((st) => {
      const screen = (meta.screens || []).find((s) => s.id === st.referenceScreenId);
      const img = screen?.image_url
        ? `<img class="mobbin-style-ref-img" src="${escapeAttr(screen.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : '';
      const patterns = (st.layoutPatterns || []).slice(0, 3).map((p) => `<li>${escapeHtml(p)}</li>`).join('');
      return `<button type="button" class="mobbin-style-card" data-mobbin-style-pick="${escapeAttr(sessionToken)}" data-style-id="${escapeAttr(st.id)}">
        <div class="mobbin-style-card-head">
          ${img}
          <div>
            <strong class="mobbin-style-name">${escapeHtml(st.name)}</strong>
            <p class="mobbin-style-tagline">${escapeHtml(st.tagline || '')}</p>
          </div>
        </div>
        ${formatStyleColorSwatches(st.colors)}
        ${st.typography ? `<p class="mobbin-style-meta">${escapeHtml(st.typography)}</p>` : ''}
        ${patterns ? `<ul class="mobbin-style-patterns">${patterns}</ul>` : ''}
        <p class="mobbin-style-rationale">${escapeHtml((st.rationale || '').slice(0, 180))}</p>
        <span class="mobbin-style-cta">Собрать приложение в этом стиле →</span>
      </button>`;
    }).join('');

    return `
      <div class="mobbin-style-picker" data-mobbin-style-session="${escapeAttr(sessionToken)}">
        <p><strong>Выберите направление стиля</strong> — Konstancia предложил 3 варианта по Mobbin</p>
        <p class="agent-mockup-sub">${meta.hint || 'После выбора соберётся полный редизайн (3–4 экрана) в Figma в единой дизайн-системе.'}</p>
        ${meta.warning ? `<p class="agent-mockup-sub" style="color:#b45309">${escapeHtml(meta.warning)}</p>` : ''}
        <div class="mobbin-style-grid">${cards}</div>
        <div class="mobbin-picker-actions">
          <button type="button" class="agent-btn-secondary" data-mobbin-style-refine="${escapeAttr(sessionToken)}">Показать экраны Mobbin</button>
          <button type="button" class="agent-btn-secondary" data-mobbin-style-skip="${escapeAttr(sessionToken)}">Без стиля Mobbin</button>
        </div>
      </div>`;
  }

  function bindMobbinStylePicker(root, sessionToken, message, task) {
    root?.querySelectorAll('[data-mobbin-style-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const token = btn.getAttribute('data-mobbin-style-pick');
        const styleId = btn.getAttribute('data-style-id');
        if (token && styleId) pickMobbinStyleAndBuild(token, styleId);
      });
    });
    root?.querySelector('[data-mobbin-style-refine]')?.addEventListener('click', () => {
      const session = pendingMobbinSessions.get(sessionToken);
      if (!session) return;
      const wrap = addMessage('assistant', buildMobbinPickerHtml(
        session.screens,
        sessionToken,
        session.live,
        session.searchQuery,
        session.localOnly,
        session.hint,
        session.total,
        session.platform,
      ), 'Mobbin · экраны', { pushHistory: false });
      bindMobbinPicker(wrap, sessionToken, message, task);
    });
    root?.querySelector('[data-mobbin-style-skip]')?.addEventListener('click', async () => {
      pendingMobbinSessions.delete(sessionToken);
      await sendFigmaPlan(message, { task, skipMobbinPicker: true });
    });
  }

  async function pickMobbinStyleAndBuild(sessionToken, styleId) {
    const session = pendingMobbinSessions.get(sessionToken);
    if (!session) return;
    const style = (session.styles || []).find((s) => s.id === styleId);
    if (!style) return;

    const screen = (session.screens || []).find((s) => s.id === style.referenceScreenId)
      || session.screens?.[0];
    pendingMobbinSessions.delete(sessionToken);

    const pickerRoot = document.querySelector(`[data-mobbin-style-session="${sessionToken}"]`);
    pickerRoot?.querySelectorAll('.mobbin-style-card').forEach((c) => { c.disabled = true; });

    addMessage('user', `Стиль: ${style.name}`, { pushHistory: true });
    chatHistory.push({ role: 'user', content: `Выбран стиль Mobbin: ${style.name}` });
    saveHistory();

    await sendFigmaPlan(session.message, {
      selectedScreen: screen,
      selectedStyle: style,
      task: session.task,
      skipMobbinPicker: true,
    });
  }

  async function startMobbinPickerFlow(message, task, { styleFirst = false } = {}) {
    const cleanMessage = message.replace(/^\/(figma|site|style)\s*/i, '').trim();
    const thinking = addThinking(task, styleFirst ? [
      'Ищу экраны в Mobbin…',
      'Анализирую паттерны и палитры…',
      'Готовлю 3 направления стиля…',
    ] : [
      'Ищу экраны в Mobbin…',
      'Подбираю варианты под запрос…',
      'Готовлю галерею…',
    ]);
    try {
      const search = await window.api.agentMobbinSearch?.({ message: cleanMessage });
      if (!search?.ok || !search.screens?.length) {
        removeThinking(thinking);
        addMessage('assistant', `<p>${escapeHtml(search?.message || 'Mobbin не вернул варианты. Добавьте API key или уточните запрос.')}</p>`, 'Mobbin');
        return;
      }

      const sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingMobbinSessions.set(sessionToken, {
        message: cleanMessage,
        task,
        screens: search.screens,
        live: search.live,
        searchQuery: search.searchQuery,
        localOnly: search.localOnly,
        hint: search.hint,
        total: search.total,
        platform: search.platform,
      });

      if (styleFirst) {
        const styleRes = await window.api.agentMobbinProposeStyles?.({
          message: cleanMessage,
          screens: search.screens,
        });
        removeThinking(thinking);
        if (!styleRes?.ok || !styleRes.styles?.length) {
          addMessage('assistant', `<p>${escapeHtml(styleRes?.message || 'Не удалось предложить стили')}</p>`, 'Mobbin');
          return;
        }
        const pending = pendingMobbinSessions.get(sessionToken);
        if (pending) pending.styles = styleRes.styles;
        const wrap = addMessage('assistant', buildMobbinStylePickerHtml(styleRes.styles, sessionToken, {
          screens: search.screens,
          hint: search.hint,
          warning: styleRes.warning,
        }), 'Mobbin · стиль приложения', { pushHistory: false });
        bindMobbinStylePicker(wrap, sessionToken, cleanMessage, task);
        return;
      }

      removeThinking(thinking);
      const wrap = addMessage('assistant', buildMobbinPickerHtml(
        search.screens,
        sessionToken,
        search.live,
        search.searchQuery,
        search.localOnly,
        search.hint,
        search.total,
        search.platform,
      ), 'Mobbin · выбор референса', { pushHistory: false });
      bindMobbinPicker(wrap, sessionToken, cleanMessage, task);
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка поиска Mobbin')}</p>`, 'Mobbin');
    }
  }

  function bindMobbinPicker(root, sessionToken, message, task) {
    root?.querySelectorAll('[data-mobbin-pick]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('[data-agent-href]')) return;
        const token = btn.getAttribute('data-mobbin-pick');
        const screenId = btn.getAttribute('data-screen-id');
        if (token && screenId) pickMobbinAndBuildFigma(token, screenId);
      });
    });
    root?.querySelectorAll('[data-mobbin-skip]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const token = btn.getAttribute('data-mobbin-skip');
        if (!token) return;
        pendingMobbinSessions.delete(token);
        addMessage('user', 'Собрать макет без референса', { pushHistory: true });
        chatHistory.push({ role: 'user', content: 'Собрать макет без референса' });
        saveHistory();
        await sendFigmaPlan(message, { task, skipMobbinPicker: true });
      });
    });
  }

  async function pickMobbinAndBuildFigma(sessionToken, screenId) {
    const session = pendingMobbinSessions.get(sessionToken);
    if (!session) return;
    const screen = (session.screens || []).find((s) => s.id === screenId);
    if (!screen) return;

    pendingMobbinSessions.delete(sessionToken);
    const pickerRoot = document.querySelector(`[data-mobbin-session="${sessionToken}"]`);
    if (pickerRoot) {
      pickerRoot.querySelectorAll('.mobbin-pick-card').forEach((c) => c.disabled = true);
    }

    addMessage('user', `Референс: ${screen.app_name}`, { pushHistory: true });
    chatHistory.push({ role: 'user', content: `Выбран Mobbin: ${screen.app_name}` });
    saveHistory();

    await sendFigmaPlan(session.message, {
      selectedScreen: screen,
      task: session.task,
      skipMobbinPicker: true,
    });
  }

  async function sendFigmaPlan(textOverride, options = {}) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    if (!text || sending) return;

    const selectedScreen = options.selectedScreen || null;
    const isAppMockup = /приложени|onboarding|login|register|инвест|fintech|многостранич|\/site\b/i.test(text);

    if (!selectedScreen && !options.skipMobbinPicker && wantsMobbinStyleFirstFlow(text)) {
      updateTaskThread(text);
      sending = true;
      updateSendState();
      addMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
      chatHistory.push({ role: 'user', content: text, taskThread: taskThreadActive });
      saveHistory();
      if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
        promptEl.value = '';
        autoResize();
      }
      const task = options.task ?? (taskThreadActive && getSelectedTask() ? getSelectedTask() : null);
      try {
        await startMobbinPickerFlow(text, task, { styleFirst: true });
      } finally {
        sending = false;
        updateSendState();
        promptEl?.focus();
      }
      return;
    }

    updateTaskThread(text);
    sending = true;
    updateSendState();

    if (!options.skipMobbinPicker) {
      addMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
      chatHistory.push({ role: 'user', content: text, taskThread: taskThreadActive });
      saveHistory();
    }

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const task = options.task ?? (taskThreadActive && getSelectedTask() ? getSelectedTask() : null);
    const useTaskContext = !!(task && window.appSettings?.agent?.useTaskContext !== false);
    const useCursorFigma = selectedScreen
      && !/\/vision\b/i.test(text)
      && window.appSettings?.agent?.cursorFigmaBuildEnabled === true
      && agentStatusCache?.cursorConfigured === true;
    const selectedStyle = options.selectedStyle || null;
    const thinking = addThinking(useTaskContext ? task : null, useCursorFigma ? [
      'Собираю бриф (Mobbin + стиль)…',
      'Cursor в фоне (5–20 мин, окно можно не трогать)…',
      'Верстаю приложение в Figma через MCP…',
    ] : selectedStyle ? [
      `Стиль «${selectedStyle.name}» → дизайн-система…`,
      'Собираю 3–4 экрана приложения…',
      'Генерирую план для Figma…',
    ] : selectedScreen ? [
      'Mobbin → бриф для Cursor Agent…',
      'Запасной путь: GigaChat + «Применить в Figma»…',
      'Генерирую иллюстрации NanoBanana…',
      'Добавляю экраны приложения…',
      'Готовлю план…',
    ] : isAppMockup ? [
      'Ищу референсы Mobbin…',
      'Планирую экраны приложения…',
      'Собираю фреймы и UI-блоки в Figma…',
      'Готовлю план к применению…',
    ] : [
      'Читаю структуру выделения в Figma…',
      'Сопоставляю запрос с макетом…',
      'Формирую план правок…',
      'Готовлю превью перед применением…',
    ]);

    let progressUnsub = null;
    if (useCursorFigma && window.api.onCursorFigmaBuildProgress) {
      progressUnsub = window.api.onCursorFigmaBuildProgress((p) => {
        if (p?.text) syncThinkingStepUi(thinking, p.text);
      });
    }

    try {
      const result = await window.api.agentFigmaPlan?.({
        message: text.replace(/^\/(figma|site|style)\s*/i, ''),
        history: chatHistory.slice(0, -1),
        task: useTaskContext ? task : null,
        selectedScreen,
        selectedStyle: options.selectedStyle || null,
        expandApp: !!options.selectedStyle
          || (!!selectedScreen && isAppMockup && /многостранич|onboarding|онбординг|3\s*шаг|тр[её]х\s*шаг|login.*register|вход.*регистрац/i.test(text)),
      });
      removeThinking(thinking);
      progressUnsub?.();
      if (result?.needsMobbinPick) {
        await startMobbinPickerFlow(text, task);
        return;
      }
      if (result?.mode === 'cursor') {
        if (!result?.ok) {
          addMessage('assistant', `<p>${escapeHtml(result?.message || 'Cursor не смог собрать макет')}</p>`, 'Cursor · Figma');
          return;
        }
        const summary = escapeHtml(result.summary || 'Макет создан в открытом файле Figma.').replace(/\n/g, '<br>');
        addMessage(
          'assistant',
          `<div class="agent-mockup-ready agent-mockup-ready--cursor"><p>${summary}</p><p class="agent-hint">Собрано через Cursor Agent (Figma MCP) в отдельном процессе. Плагин Bridge не нужен. Если SHKF закрылся — отключите Cursor-режим или упростите запрос.</p></div>`,
          result.model ? `Cursor · ${result.model}` : 'Cursor · Figma',
        );
        chatHistory.push({
          role: 'assistant',
          content: result.summary || 'Макет Figma через Cursor MCP',
          meta: 'Cursor · Figma',
        });
        saveHistory();
        return;
      }
      if (!result?.ok || !result?.plan?.operations?.length) {
        addMessage('assistant', `<p>${escapeHtml(result?.message || 'Не удалось построить план правок')}</p>`, 'Figma');
        return;
      }
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingFigmaPlans.set(token, { plan: result.plan });
      addMessage('assistant', buildFigmaPlanHtml({
        token,
        plan: result.plan,
        selection: result.selection,
        refs: result.refs,
        critic: result.critic,
        visionFallback: result.visionFallback,
        liteMode: result.liteMode,
        cursorFallback: result.cursorFallback,
      }), result.model ? `Konstancia · ${result.model}` : 'Konstancia');
      chatHistory.push({
        role: 'assistant',
        content: `План правок Figma: ${result.plan.summary || `${result.plan.operations.length} операций`}`,
        meta: 'Konstancia',
      });
      saveHistory();
    } catch (err) {
      removeThinking(thinking);
      progressUnsub?.();
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка при планировании правок Figma')}</p>`, 'Figma');
    } finally {
      progressUnsub?.();
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  async function sendBannerToNanobanana(textOverride) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    if (!text || sending) return;

    updateTaskThread(text);
    sending = true;
    updateSendState();

    addMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
    chatHistory.push({ role: 'user', content: text, taskThread: true });
    saveHistory();

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const task = getSelectedTask();
    const thinking = addThinking(task, [
      'Читаю задачу и тему баннера…',
      'Составляю промпт для NanoBanana…',
      'Отправляю в генерацию…',
      'Рендер изображения…',
    ]);

    try {
      const refs = typeof window.getNanobananaStagedRefs === 'function'
        ? window.getNanobananaStagedRefs()
        : [];
      const nbOpts = typeof window.getNanobananaGenerateOptions === 'function'
        ? window.getNanobananaGenerateOptions()
        : {};

      const result = await window.api.agentBannerToNanobanana({
        message: text,
        task: task?.id ? task : null,
        referenceImageUrls: refs,
        buildOnly: true,
        model: nbOpts.model,
        aspectRatio: nbOpts.aspectRatio,
        resolution: nbOpts.resolution,
      });

      if (!result?.ok) {
        removeThinking(thinking);
        let errHtml = `<p>${escapeHtml(result?.message || 'Ошибка').replace(/\n/g, '<br>')}</p>`;
        if (result?.prompt) {
          errHtml += `<details class="agent-nb-prompt"><summary>Промпт (не отправлен)</summary><pre class="agent-nb-prompt-pre">${escapeHtml(result.prompt)}</pre></details>`;
          errHtml += '<p><button type="button" class="agent-nb-open-btn">Вставить промпт в NanoBanana</button></p>';
        }
        const errWrap = addMessage('assistant', errHtml, 'NanoBanana');
        bindBannerNanobananaActions(errWrap);
        errWrap.querySelector('.agent-nb-open-btn')?.addEventListener('click', () => {
          window.syncNanobananaFromAgent?.({ prompt: result.prompt });
        });
      notifyIfAgentInBackground({
        title: 'Konstancia · NanoBanana',
        body: result?.message || 'Не удалось подготовить промпт для NanoBanana',
      });
        return;
      }

      const generation = await window.syncNanobananaFromAgent?.({
        prompt: result.prompt,
        navigate: true,
        autoGenerate: true,
      });

      removeThinking(thinking);

      if (!generation?.ok) {
        let errHtml = `<p>${escapeHtml(generation?.message || 'Не удалось запустить генерацию в NanoBanana').replace(/\n/g, '<br>')}</p>`;
        errHtml += `<details class="agent-nb-prompt"><summary>Промпт (не отправлен)</summary><pre class="agent-nb-prompt-pre">${escapeHtml(result.prompt)}</pre></details>`;
        errHtml += '<p><button type="button" class="agent-nb-open-btn">Вставить промпт в NanoBanana</button></p>';
        const errWrap = addMessage('assistant', errHtml, 'NanoBanana');
        bindBannerNanobananaActions(errWrap);
        errWrap.querySelector('.agent-nb-open-btn')?.addEventListener('click', () => {
          window.syncNanobananaFromAgent?.({ prompt: result.prompt, navigate: true });
        });
        notifyIfAgentInBackground({
          title: 'Konstancia · NanoBanana',
          body: generation?.message || 'Не удалось запустить генерацию',
        });
        return;
      }

      const composedResult = {
        ...result,
        imageUrls: generation.imageUrls || result.imageUrls || [],
        galleryItem: generation.galleryItem || result.galleryItem || null,
      };
      const body = buildBannerNanobananaHtml(composedResult);
      const meta = `NanoBanana · ${result.model || 'генерация'}`;
      const msgWrap = addMessage('assistant', body, meta);
      bindBannerNanobananaActions(msgWrap);
      notifyIfAgentInBackground({
        title: 'Konstancia · NanoBanana',
        body: result.summary || 'Баннер сгенерирован. Проверьте мокапы и отправку в задачу.',
      });

      const assistantText = [
        result.summary || 'Баннер сгенерирован.',
        '',
        'Промпт:',
        result.prompt,
      ].join('\n');
      chatHistory.push({
        role: 'assistant',
        content: assistantText,
        meta,
      });
      saveHistory();

      window.syncNanobananaFromAgent?.({
        prompt: result.prompt,
        galleryItemId: composedResult.galleryItem?.id,
        navigate: false,
      });
      if (task?.id && composedResult.galleryItem?.id) {
        prepareMockupsForTaskPosting(task, composedResult.galleryItem.id);
      }
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Сбой').replace(/\n/g, '<br>')}</p>`, 'NanoBanana');
      notifyIfAgentInBackground({
        title: 'Konstancia · NanoBanana',
        body: err.message || 'Сбой в генерации NanoBanana',
      });
    } finally {
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  async function sendMessage(textOverride, options = {}) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    const images = pendingAgentImages.length
      ? pendingAgentImages.map((img) => ({ dataUrl: img.dataUrl, filename: img.filename }))
      : [];
    if ((!text && !images.length) || sending) return;

    ensureActiveSession();

    if (text && isBannerNanobananaIntent(text)) {
      return sendBannerToNanobanana(textOverride);
    }
    if (text && isFigmaMakeSendIntent(text)) {
      return sendFigmaMake(textOverride);
    }
    if (text && isFigmaEditIntent(text)) {
      return sendFigmaPlan(textOverride);
    }
    if (text && isSiteBuildIntent(text)) {
      return sendSiteBuild(textOverride);
    }
    if (options.skipTaskRequirement) taskThreadActive = false;
    else updateTaskThread(text || 'изображение');

    if (!options.skipTaskRequirement && !isTaskOptionalDecline(text) && !parseTaskOptionalPick(text)) {
      pendingTaskOptionalQuery = null;
    }

    if (isTaskOptionalDecline(text) && pendingTaskOptionalQuery) {
      const deferred = pendingTaskOptionalQuery;
      pendingTaskOptionalQuery = null;
      return sendMessage(deferred, {
        ...options,
        skipTaskRequirement: true,
        displayText: TASK_OPTIONAL_DECLINE,
      });
    }

    const pickedTaskId = parseTaskOptionalPick(text);
    if (pickedTaskId && pendingTaskOptionalQuery) {
      const deferred = pendingTaskOptionalQuery;
      pendingTaskOptionalQuery = null;
      setTaskSelectValue(String(pickedTaskId), { silent: true });
      return sendMessage(deferred, {
        ...options,
        displayText: text,
      });
    }

    const task = getSelectedTask();
    window.AgentVtuber?.stopMusicDance?.();
    sending = true;
    updateSendState();

    const displayText = options.displayText ?? userDisplayText(text, images);
    addMessage('user', buildUserMessageHtml(displayText, images));
    const userEntry = {
      role: 'user',
      content: text,
      taskThread: taskThreadActive,
    };
    if (images.length) userEntry.images = images.map((i) => ({ dataUrl: i.dataUrl, filename: i.filename }));
    chatHistory.push(userEntry);
    saveHistory();
    window.AgentVtuber?.onChatActive?.({ animate: false });

    revokePendingImageUrls();
    pendingAgentImages = [];
    renderPendingAgentImages();
    syncStageState();

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const explicitTaskWork = isTaskWorkRequest(text);
    const useTaskContext = !options.skipTaskRequirement
      && explicitTaskWork
      && task
      && window.appSettings?.agent?.useTaskContext !== false;
    const isPikRef = isPikReferencePrompt(text);
    const allowFollowups = isPikRef || shouldAllowFollowups(text, useTaskContext, task);
    const isFileSearch = text === QUICK.findRedmineFile
      || /найди\s+файл|найди.*redmine|проиндексирован|TASKCARD|TASKFILE|листовк|черномор|флаер|flyer|где\s+лежит|материал.*задач|файл.*задач/i.test(text);
    const thinkingLabel = isFileSearch ? null : (useTaskContext ? task : null);
    const thinking = addThinking(thinkingLabel);

    try {
      const includeLearned = useTaskContext && (
        text === QUICK.learnedLessons
        || text === QUICK.processOptimize
        || text === QUICK.learnedProject
      );
      const includeRedmineKnowledge = isFileSearch;
      const kanbanPayload = kanbanTasks.map((t) => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        project: t.project,
        tracker: t.tracker,
        status: t.status,
        updatedOn: t.updatedOn,
        url: t.url,
        assignees: t.assignees,
        estimatedHours: t.estimatedHours,
        laborJournal: t.laborJournal,
        laborTimeEntries: t.laborTimeEntries,
      }));

      let result = null;
      if (isFileSearch && window.api.agentRedmineFileSearch) {
        try {
          result = await window.api.agentRedmineFileSearch({
            query: text,
            kanbanTasks: kanbanPayload,
          });
          if (result?.ok) {
            result = {
              ok: true,
              content: result.content,
              direct: true,
              indexingStatus: result.indexingStatus || null,
            };
          }
        } catch {
          result = null;
        }
      }
      if (!result?.ok) {
        result = await window.api.agentSendMessage({
          message: text || 'Опиши приложенное изображение.',
          history: chatHistory.slice(0, -1),
          task: useTaskContext ? task : null,
          includeTaskContext: useTaskContext,
          includeLearnedExperience: includeLearned,
          includeRedmineKnowledge,
          forceRedmineFileSearch: isFileSearch,
          kanbanTasks: kanbanPayload,
          allowFollowups,
          skipTaskRequirement: options.skipTaskRequirement === true,
          confirmMusicPlay: options.confirmMusicPlay === true,
          confirmTeamSend: options.confirmTeamSend || null,
          images,
          role: window.RoleNav?.getRole?.() || null,
        });
      }

      removeThinking(thinking);

      if (!result?.ok) {
        window.AgentVtuber?.onError?.();
        const errText = result?.message || 'Ошибка запроса';
        addMessage('assistant', `<p>${escapeHtml(errText).replace(/\n/g, '<br>')}</p>`, 'Ошибка');
        appendAssistantToHistory({ content: errText, meta: 'Ошибка' });
        notifyIfAgentInBackground({
          title: 'Konstancia',
          body: errText,
        });
        return;
      }

      if (result.taskOptionalPrompt) {
        pendingTaskOptionalQuery = text;
      }

      const prepared = prepareAssistantReply(
        result.content,
        result.followups?.length ? result.followups : [],
      );
      const replyFollowups = result.followups?.length
        ? result.followups
        : (allowFollowups && !result.direct ? prepared.followups : []);
      const meta = result.directMeta
        || (result.musicAction ? 'Яндекс Музыка'
          : (result.desktopAction ? 'Компьютер'
            : (result.indexingStatus ? 'Redmine · поиск файлов' : null)))
        || (result.direct === true && isFileSearch ? 'Redmine · поиск файлов' : null)
        || (useTaskContext && task
          ? `Задача #${task.id}`
          : (result.model
            ? `${isKonstanciaProvider() || String(result.model).includes('konstancia') ? 'Konstancia' : 'GigaChat'} · ${result.model}`
            : null));
      const forceChatFollowups = isPikRef
        || !!result.taskOptionalPrompt
        || !!result.musicAction
        || !!result.pendingMusicQuery
        || result.directMeta === 'Яндекс Музыка'
        || result.directMeta === 'Команда'
        || !!result.desktopAction;
      const display = resolveFollowupsForDisplay(
        replyFollowups,
        task,
        allowFollowups || !!result.followups?.length || !!result.taskOptionalPrompt,
        {
          chatFollowups: forceChatFollowups,
          teamMessagePending: result.teamMessagePending || null,
        },
      );

      const laborHtml = Array.isArray(result.laborEntries) && result.laborEntries.length
        ? buildLaborCardsHtml(result.laborEntries)
        : '';
      let assistantBody = enhanceAssistantHtml(prepared.content);
      if (isLaborCostQuery(text)) {
        if (laborHtml) {
          assistantBody = `${laborHtml}${assistantBody}`;
        } else {
          assistantBody = `<p class="agent-labor-empty">В Redmine нет записей трудозатрат по этой задаче.</p>${assistantBody}`;
        }
      }

      const msgWrap = addMessage('assistant', assistantBody, meta, {
        followups: display.followups,
        taskId: display.taskId,
        teamMessagePending: display.teamMessagePending,
        learnedChunkIds: result.learnedChunkIds || null,
        emotionCtx: {
          userText: text,
          assistantText: prepared.content,
          meta: meta || '',
          direct: result.direct === true,
          ok: true,
          musicPlaying: Boolean(result.musicAction),
        },
      });
      bindLaborAvatarFallbacks(msgWrap);
      notifyIfAgentInBackground({
        title: 'Konstancia',
        body: prepared.content.replace(/\s+/g, ' ').slice(0, 220),
      });
      if (result.indexingStatus?.started) {
        const st = result.indexingStatus;
        if (st.pending && st.indexed === 0 && st.total > 0) {
          showAgentToast(`Индексация Redmine: ${st.total} задач в фоне…`, 'ok');
        } else if (st.indexed > 0) {
          showAgentToast(`Проиндексировано ${st.indexed} задач для поиска`, 'ok');
        }
      }
      if (Array.isArray(result.attachmentFileIds) && result.attachmentFileIds.length) {
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
          if (chatHistory[i].role === 'user') {
            chatHistory[i].attachments = result.attachmentFileIds;
            break;
          }
        }
      }
      if (result.imageContext) {
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
          if (chatHistory[i].role === 'user') {
            chatHistory[i].imageContext = result.imageContext;
            break;
          }
        }
      }
      if (result.calendarAction) {
        window.refreshAgentSidePanel?.();
      }
      chatHistory.push({
        role: 'assistant',
        content: prepared.content,
        meta,
        followups: prepared.followups,
        taskId: task?.id || null,
        chatFollowups: display.chatFollowups && !!display.followups?.length,
        teamMessagePending: display.teamMessagePending || null,
        showFollowups: allowFollowups && !!display.followups?.length,
      });
      saveHistory();
    } catch (err) {
      removeThinking(thinking);
      window.AgentVtuber?.onError?.();
      const errText = err.message || 'Сбой сети';
      addMessage('assistant', `<p>${escapeHtml(errText)}</p>`, 'Ошибка');
      appendAssistantToHistory({ content: errText, meta: 'Ошибка' });
      notifyIfAgentInBackground({
        title: 'Konstancia',
        body: errText,
      });
    } finally {
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  function clearChat() {
    createNewSession();
  }

  const SUG_ICONS = {
    analyze: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    banner: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M7 11h10"/>',
    bannerNano: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>',
    figmaEdit: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    siteBuild: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M9 17v4M15 17v4"/>',
    mobbinStyle: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/>',
    landing: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/>',
    make: '<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z"/>',
    split: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    labor: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    devPlan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 14l2 2 4-4"/>',
    devStandup: '<path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="11" cy="7" r="4"/><path d="M21 11h-4"/>',
    devReview: '<path d="M9 12l2 2 4-4"/><path d="M21 12c0 1.66-4 6-9 6s-9-4.34-9-6 4-6 9-6 9 4.34 9 6z"/>',
    devCommit: '<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>',
    devProductivity: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
    pmStatus: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 15h.01M12 15h4"/>',
    pmRisks: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    links: '<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5"/>',
    learnedLessons: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    processOptimize: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
    learnedProject: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    findRedmineFile: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15h6"/>',
    insights: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/>',
  };

  const SUG_LABELS = {
    analyze: ['Оценить', 'Оценить задачу'],
    banner: ['Промпт баннер', 'Промпт: баннер'],
    bannerNano: ['NanoBanana', 'Баннер → NanoBanana'],
    figmaEdit: ['Правки Figma', 'План правок и применение в Figma'],
    landing: ['Промпт лендинг', 'Промпт: лендинг'],
    make: ['Figma Make', 'Figma Make'],
    split: ['На шаги', 'Разбить на шаги'],
    labor: ['Трудозатраты', 'Трудозатраты'],
    devPlan: ['План дня', 'Приоритеты задач на сегодня'],
    devStandup: ['Стендап', 'Текст для дейли-стендапа'],
    devEstimate: ['Оценить', 'Оценка задачи (разработка)'],
    devReview: ['Код-ревью', 'Чеклист код-ревью'],
    devCommit: ['Commit / PR', 'Сообщение коммита и PR'],
    devProductivity: ['Продуктивность', 'Разбор продуктивности'],
    siteBuild: ['Макет Figma', 'Многостраничный макет в Figma (Mobbin)'],
    mobbinStyle: ['Стиль Mobbin', 'Стиль из Mobbin + редизайн'],
    pmStatus: ['Статус', 'Сводка статуса задач'],
    pmRisks: ['Риски', 'Риски и узкие места'],
    links: ['Найти связи', 'Найти связанные задачи в Kanban'],
    learnedLessons: ['Уроки', 'Похожие задачи и уроки'],
    processOptimize: ['Процесс', 'Оптимизация процесса'],
    learnedProject: ['Память', 'Что Konstancia выучил'],
    findRedmineFile: ['Найти файл', 'Где файл в задачах Redmine'],
    insights: ['Инсайты', 'Инсайты процессов Kanban'],
  };

  const SUGGESTION_SETS = {
    designer: ['mobbinStyle', 'analyze', 'learnedLessons', 'findRedmineFile', 'processOptimize', 'banner', 'bannerNano', 'figmaEdit', 'siteBuild', 'landing', 'make', 'links', 'split', 'labor'],
    frontend: ['siteBuild', 'devPlan', 'devStandup', 'links', 'learnedLessons', 'findRedmineFile', 'insights', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'labor'],
    backend: ['devPlan', 'devStandup', 'links', 'learnedLessons', 'findRedmineFile', 'insights', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'labor'],
    pm: ['pmStatus', 'links', 'pmRisks', 'findRedmineFile', 'insights', 'learnedProject', 'devPlan', 'split', 'devProductivity', 'labor'],
    full: ['mobbinStyle', 'analyze', 'learnedLessons', 'findRedmineFile', 'processOptimize', 'banner', 'bannerNano', 'figmaEdit', 'siteBuild', 'links', 'insights', 'devPlan', 'devStandup', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'split', 'labor'],
  };

  function suggestionButtonHtml(key) {
    const [label, title] = SUG_LABELS[key] || [key, key];
    const icon = SUG_ICONS[key] || SUG_ICONS.analyze;
    const cls = `agent-sug agent-sug--${key.toLowerCase()}`;
    return `<button type="button" class="${cls}" data-agent-action="${key}" title="${title}">`
      + `<span class="agent-sug-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>`
      + `<span class="agent-sug-label">${label}</span></button>`;
  }

  function renderRoleSuggestions() {
    const wrap = $('agent-suggestions');
    if (!wrap) return;
    const role = window.RoleNav?.getRole?.() || 'designer';
    const keys = SUGGESTION_SETS[role] || SUGGESTION_SETS.designer;
    wrap.innerHTML = keys.map(suggestionButtonHtml).join('');
    bindQuickActions();

    const sub = $('agent-chat-sub');
    if (sub) {
      const devRole = role === 'frontend' || role === 'backend';
      if (devRole) sub.textContent = 'Konstancia · Mobbin · Figma · Kanban';
      else if (role === 'pm') sub.textContent = 'Konstancia · Kanban · статусы и риски';
      else sub.textContent = 'Konstancia · Mobbin · Figma · Kanban';
    }
  }

  function linkCardHtml(s) {
    const conf = Math.round((s.confidence || 0) * 100);
    return `
      <div class="agent-link-card" data-link-card
        data-a-id="${s.aId}" data-b-id="${s.bId}" data-rel="${escapeHtml(s.relationType || 'relates')}">
        <div class="agent-link-head">
          <span class="agent-link-badge">${escapeHtml(s.relationLabel || 'связана')}</span>
          <span class="agent-link-conf">${conf}%</span>
        </div>
        <div class="agent-link-tasks">
          <a class="agent-link-task" data-agent-href="${escapeHtml(s.aUrl || '')}">#${s.aId} · ${escapeHtml(s.aSubject || '')}</a>
          <span class="agent-link-arrow" aria-hidden="true">↔</span>
          <a class="agent-link-task" data-agent-href="${escapeHtml(s.bUrl || '')}">#${s.bId} · ${escapeHtml(s.bSubject || '')}</a>
        </div>
        ${s.reason ? `<p class="agent-link-reason">${escapeHtml(s.reason)}</p>` : ''}
        <div class="agent-link-actions">
          <button type="button" class="agent-link-btn agent-link-btn--apply" data-link-apply>Связать в Redmine</button>
          <button type="button" class="agent-link-btn agent-link-btn--dismiss" data-link-dismiss>Отклонить</button>
        </div>
      </div>`;
  }

  function renderLinkSuggestions(suggestions, usedEmbeddings) {
    const cards = suggestions.map(linkCardHtml).join('');
    const head = `<p>Нашёл ${suggestions.length} ${suggestions.length === 1 ? 'возможную связь' : 'возможных связи(-ей)'} между задачами. Свяжу только те, что подтвердишь:</p>`;
    const meta = usedEmbeddings ? 'GigaChat embeddings + проверка моделью' : 'TF-IDF + проверка моделью';
    addMessage('assistant', `${head}<div class="agent-link-list">${cards}</div>`, meta, { pushHistory: false });
  }

  async function runProcessInsights() {
    if (!kanbanTasks.length) {
      addMessage('assistant', '<p>Нет задач из Kanban. Подключите Redmine и синхронизируйте Канбан.</p>', null, { pushHistory: false });
      return;
    }
    const thinking = addThinking(null, ['Считаю метрики Kanban…', 'Ищу узкие места…']);
    try {
      const payloadTasks = kanbanTasks.map((t) => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        project: t.project,
        tracker: t.tracker,
        status: t.status,
        updatedOn: t.updatedOn,
        assignees: t.assignees,
        estimatedHours: t.estimatedHours,
        laborJournal: t.laborJournal,
        laborTimeEntries: t.laborTimeEntries,
      }));
      const result = await window.api.agentProcessInsights?.({ tasks: payloadTasks });
      removeThinking(thinking);
      const md = result?.markdown || '<p>Нет инсайтов.</p>';
      addMessage('assistant', enhanceAssistantHtml(md), 'Только чтение · Redmine не меняется', { pushHistory: false });
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка')}</p>`, null, { pushHistory: false });
    }
  }

  async function runFindTaskLinks() {
    if (!kanbanTasks.length) {
      addMessage('assistant', '<p>Нет задач из Kanban. Откройте Канбан или подключите Redmine в настройках.</p>', null, { pushHistory: false });
      return;
    }
    const payloadTasks = kanbanTasks.map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      project: t.project,
      tracker: t.tracker,
      assignees: t.assignees,
      url: t.url,
    }));

    const thinking = addThinking(null, [
      'Читаю задачи Kanban…',
      'Считаю смысловую близость…',
      'Проверяю кандидатов на реальную связь…',
    ]);
    try {
      const result = await window.api.agentFindTaskLinks({ tasks: payloadTasks });
      removeThinking(thinking);
      if (!result?.ok) {
        addMessage('assistant', `<p>${escapeHtml(result?.message || 'Не удалось проанализировать задачи')}</p>`, null, { pushHistory: false });
        return;
      }
      if (!result.suggestions?.length) {
        addMessage('assistant', '<p>Не нашёл уверенных связей между задачами — связывать нечего. Это нормально: я предлагаю только реально родственные задачи, а не всё подряд.</p>', null, { pushHistory: false });
        return;
      }
      renderLinkSuggestions(result.suggestions, result.usedEmbeddings);
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка анализа')}</p>`, null, { pushHistory: false });
    }
  }

  async function applyTaskLink(card) {
    const aId = card.dataset.aId;
    const bId = card.dataset.bId;
    const rel = card.dataset.rel || 'relates';
    const applyBtn = card.querySelector('[data-link-apply]');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Связываю…'; }
    try {
      const res = await window.api.agentLinkTasks({ fromId: aId, toId: bId, relationType: rel });
      if (res?.ok) {
        card.classList.add('is-done');
        card.querySelector('.agent-link-actions')?.replaceChildren();
        const note = document.createElement('p');
        note.className = 'agent-link-status agent-link-status--ok';
        note.textContent = res.alreadyLinked ? 'Уже были связаны ✓' : 'Связано в Redmine ✓';
        card.appendChild(note);
        showAgentToast('Задачи связаны', 'ok');
      } else {
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Связать в Redmine'; }
        showAgentToast(res?.message || 'Не удалось связать', 'error');
      }
    } catch (err) {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Связать в Redmine'; }
      showAgentToast(err.message || 'Ошибка связывания', 'error');
    }
  }

  async function dismissTaskLink(card) {
    const aId = card.dataset.aId;
    const bId = card.dataset.bId;
    try { await window.api.agentDismissTaskLink({ aId, bId }); } catch { /* ignore */ }
    card.classList.add('is-dismissed');
    card.querySelector('.agent-link-actions')?.replaceChildren();
    const note = document.createElement('p');
    note.className = 'agent-link-status';
    note.textContent = 'Отклонено — больше не предложу';
    card.appendChild(note);
  }

  function bindQuickActions() {
    document.querySelectorAll('[data-agent-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.agentAction;
        const prompt = QUICK[key] || btn.dataset.prompt || '';
        if (key === 'links') {
          runFindTaskLinks();
          return;
        }
        if (key === 'insights') {
          runProcessInsights();
          return;
        }
        if (key === 'bannerNano') {
          if (promptEl) {
            promptEl.value = prompt;
            autoResize();
          }
          sendBannerToNanobanana(prompt);
          return;
        }
        if (key === 'make') {
          if (promptEl) {
            promptEl.value = prompt;
            autoResize();
          }
          sendFigmaMake(prompt);
          return;
        }
        if (key === 'figmaEdit') {
          if (promptEl) {
            promptEl.value = prompt;
            autoResize();
          }
          sendFigmaPlan(prompt);
          return;
        }
        if (key === 'siteBuild' || key === 'mobbinStyle') {
          if (promptEl) {
            promptEl.value = prompt;
            autoResize();
          }
          sendFigmaPlan(prompt);
          return;
        }
        if (promptEl) {
          promptEl.value = prompt;
          autoResize();
          updateSendState();
          promptEl.focus();
        }
      });
    });
  }

  function bindComposer() {
    $('agent-attach')?.addEventListener('click', () => { void pickAgentImage(); });
    $('agent-image-input')?.addEventListener('change', onAgentImageInputChange);

    const composerDrop = $('agent-composer-shell') || $('agent-composer');
    composerDrop?.addEventListener('dragover', (event) => {
      if (![...event.dataTransfer?.types || []].includes('Files')) return;
      event.preventDefault();
    });
    composerDrop?.addEventListener('drop', (event) => {
      const files = [...(event.dataTransfer?.files || [])].filter(isImageAttachmentFile);
      if (!files.length) return;
      event.preventDefault();
      void addAgentImagesFromFiles(files);
    });
    $('agent-ideas-toggle')?.addEventListener('click', () => toggleAgentIdeasPanel());
    $('agent-web-hint')?.addEventListener('click', () => {
      if (!promptEl) return;
      const prefix = 'Найди актуальную информацию в интернете: ';
      if (!promptEl.value.trim()) promptEl.value = prefix;
      else if (!/интернет|погугли|найди/i.test(promptEl.value)) promptEl.value = `${prefix}${promptEl.value}`;
      promptEl.focus();
      autoResize();
      updateSendState();
    });

    $('agent-composer')?.addEventListener('click', (event) => {
      if (event.target.closest('.agent-composer-send, .agent-composer-tool, .agent-composer-ideas')) return;
      promptEl?.focus();
    });

    promptEl?.addEventListener('input', () => {
      autoResize();
      updateSendState();
      syncStageState();
    });
    promptEl?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && agentChatSettings.enterSend !== false) {
        event.preventDefault();
        sendMessage();
      }
    });
    promptEl?.addEventListener('paste', async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        const file = item.getAsFile?.();
        if (!file || !isImageAttachmentFile(file)) continue;
        imageFiles.push(file);
      }
      if (!imageFiles.length) return;
      event.preventDefault();
      void addAgentImagesFromFiles(imageFiles);
    });
    sendBtn?.addEventListener('click', () => sendMessage());

    window.addEventListener('beforeunload', () => persistCurrentSession());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistCurrentSession();
    });

    messagesEl?.addEventListener('click', (event) => {
      const link = event.target.closest('[data-agent-href]');
      if (link) {
        event.preventDefault();
        const href = link.getAttribute('data-agent-href');
        if (href) openExternalUrl(href);
        return;
      }
      const applyBtn = event.target.closest('[data-link-apply]');
      if (applyBtn) {
        const card = applyBtn.closest('[data-link-card]');
        if (card) applyTaskLink(card);
        return;
      }
      const dismissBtn = event.target.closest('[data-link-dismiss]');
      if (dismissBtn) {
        const card = dismissBtn.closest('[data-link-card]');
        if (card) dismissTaskLink(card);
        return;
      }
      const sendMockupsBtn = event.target.closest('[data-mockup-send]');
      if (sendMockupsBtn) {
        const token = sendMockupsBtn.getAttribute('data-mockup-send');
        sendMockupsBtn.disabled = true;
        sendMockupsBtn.textContent = 'Отправляю…';
        postMockupsToTask(token).finally(() => {
          if (sendMockupsBtn.isConnected) sendMockupsBtn.disabled = false;
        });
        return;
      }
      const cancelMockupsBtn = event.target.closest('[data-mockup-cancel]');
      if (cancelMockupsBtn) {
        const token = cancelMockupsBtn.getAttribute('data-mockup-cancel');
        pendingMockupPosts.delete(token);
        markMockupDecision(token, 'Отправку отменили');
        return;
      }
      const applyFigmaPlanBtn = event.target.closest('[data-figma-plan-apply]');
      if (applyFigmaPlanBtn) {
        const token = applyFigmaPlanBtn.getAttribute('data-figma-plan-apply');
        applyFigmaPlanBtn.disabled = true;
        applyFigmaPlanBtn.textContent = 'Применяю…';
        applyFigmaPlan(token).finally(() => {
          if (applyFigmaPlanBtn.isConnected) applyFigmaPlanBtn.disabled = false;
        });
        return;
      }
      const cancelFigmaPlanBtn = event.target.closest('[data-figma-plan-cancel]');
      if (cancelFigmaPlanBtn) {
        const token = cancelFigmaPlanBtn.getAttribute('data-figma-plan-cancel');
        pendingFigmaPlans.delete(token);
        markFigmaPlanDecision(token, 'Применение отменено');
        return;
      }
      const exportSiteBtn = event.target.closest('[data-site-build-export]');
      if (exportSiteBtn) {
        exportSiteBuild(exportSiteBtn.getAttribute('data-site-build-export'));
        return;
      }
      const copySiteBtn = event.target.closest('[data-site-build-copy]');
      if (copySiteBtn) {
        copySiteBuildBundle(copySiteBtn.getAttribute('data-site-build-copy'));
        return;
      }
      const readmeSiteBtn = event.target.closest('[data-site-build-open-readme]');
      if (readmeSiteBtn) {
        showSiteBuildReadme(readmeSiteBtn.getAttribute('data-site-build-open-readme'));
        return;
      }
      const openTaskBtn = event.target.closest('[data-open-metask-task]');
      if (openTaskBtn) {
        event.preventDefault();
        const issueId = openTaskBtn.getAttribute('data-open-metask-task');
        const taskUrl = openTaskBtn.getAttribute('data-open-metask-url') || '';
        openTaskInKanban(issueId, taskUrl);
        return;
      }
      const fileBtn = event.target.closest('[data-task-file-issue]');
      if (fileBtn && !fileBtn.disabled) {
        event.preventDefault();
        const issueId = fileBtn.getAttribute('data-task-file-issue');
        const attachmentId = fileBtn.getAttribute('data-task-file-id');
        fileBtn.disabled = true;
        window.api.taskKnowledgeAttachment?.({ issueId, attachmentId })
          .then((res) => {
            if (res?.ok && res.contentUrl) {
              return window.api.metaskOpenAttachment?.({ url: res.contentUrl });
            }
            showAgentToast('Вложение не найдено в локальном каталоге', 'error');
            return null;
          })
          .catch(() => showAgentToast('Не удалось открыть файл', 'error'))
          .finally(() => { fileBtn.disabled = false; });
        return;
      }
      const btn = event.target.closest('[data-agent-task-comment]');
      if (btn && !btn.disabled) {
        postQuestionToRedmine(btn);
        return;
      }
      const musicBtn = event.target.closest('[data-agent-music-action]');
      if (musicBtn && !musicBtn.disabled) {
        const action = musicBtn.getAttribute('data-agent-music-action');
        if (action) sendMessage(action, { confirmMusicPlay: true });
        return;
      }
      const resourceBtn = event.target.closest('[data-agent-resource-action]');
      if (resourceBtn && !resourceBtn.disabled) {
        const action = resourceBtn.getAttribute('data-agent-resource-action');
        if (action) {
          const cmd = action.replace(/^да\s*[—-]\s*открыть\s+/i, 'открой ');
          sendMessage(cmd);
        }
        return;
      }
      const teamBtn = event.target.closest('[data-agent-team-send-recipient]');
      if (teamBtn && !teamBtn.disabled) {
        const recipientId = teamBtn.getAttribute('data-agent-team-send-recipient');
        const body = teamBtn.getAttribute('data-agent-team-send-body');
        const label = teamBtn.querySelector('.agent-followup-text')?.textContent?.trim() || 'Отправить';
        if (recipientId && body) {
          sendMessage(label, {
            skipTaskRequirement: true,
            confirmTeamSend: { recipientId, body },
          });
        }
        return;
      }
      const chatBtn = event.target.closest('[data-agent-chat-prompt]');
      if (chatBtn && !chatBtn.disabled) {
        const nextPrompt = chatBtn.getAttribute('data-agent-chat-prompt');
        if (nextPrompt) sendMessage(nextPrompt);
      }
    });
  }

  function bindStatusBanner() {
    statusBanner?.addEventListener('click', (event) => {
      if (event.target.closest('[data-agent-open-settings]')) {
        event.preventDefault();
        document.querySelector('.nav-item[data-page="settings"]')?.click();
        setTimeout(() => {
          document.getElementById('settings-agent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
      if (event.target.closest('[data-agent-open-gigachat]')) {
        event.preventDefault();
        window.api.agentOpenGigaChatDocs?.();
      }
    });
  }

  window.activateAgentPage = async function activateAgentPage() {
    window.detachMetaskBoard?.();
    renderRoleSuggestions();
    await refreshAgentStatus();
    await loadKanbanTasks();
    renderSessionList({ full: true });
    maybeShowMorningBriefOnActivate();
    refreshIncomingShares({ notify: true });
    window.requestAnimationFrame(() => promptEl?.focus());
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        syncStageState();
        window.AgentLive2d?.scheduleLoad?.('activate');
        if (window.AgentLive2d?.needsRemount?.()) {
          window.AgentVtuber?.refreshLive2d?.({ force: true });
        }
      });
    });
  };

  window.sendPikReferenceToAgent = async function sendPikReferenceToAgent({
    dataUrl,
    filename,
    appTitle,
    screenLabel,
    platform,
  } = {}) {
    if (!dataUrl) {
      showAgentToast('Не удалось загрузить изображение', 'error');
      return { ok: false };
    }

    window.initAgent?.();
    document.querySelector('.nav-item[data-page="agent"]')?.click();
    await window.activateAgentPage?.();

    appendPendingAgentImages([{ dataUrl, filename: filename || 'pik-reference.png' }]);

    const prompt = buildPikReferencePrompt({ appTitle, screenLabel, platform });
    const caption = `Референс UI: ${appTitle || 'Приложение'} — ${screenLabel || 'Экран'}${platform ? ` · ${platform}` : ''}`;
    if (promptEl) {
      promptEl.value = '';
      autoResize();
      updateSendState();
    }

    await sendMessage(prompt, { displayText: caption });
    return { ok: true };
  };

  function initAgent() {
    if (agentInited) return;
    agentInited = true;
    agentStorageUserId = resolveAgentStorageUserId(window.__APP_CONFIG__?.settings?.user);
    messagesEl = $('agent-messages');
    promptEl = $('agent-prompt');
    sendBtn = $('agent-send');
    taskSelect = $('agent-task-select');
    taskPickerTrigger = $('agent-task-picker-trigger');
    taskPickerMenu = $('agent-task-picker-menu');
    taskPickerValue = $('agent-task-picker-value');
    modelSelect = $('agent-model-select');
    statusBanner = $('agent-status-banner');
    sessionListEl = $('agent-session-list');
    bindBackgroundNotifyActions();

    if (!messagesEl || !promptEl) return;

    syncAgentModelSelect();
    loadHistory();

    if (isAgentPageActive()) {
      window.requestAnimationFrame(() => {
        if (window.AgentLive2d?.needsRemount?.()) {
          window.AgentVtuber?.refreshLive2d?.({ force: true });
        } else if (!window.AgentLive2d?.isLoaded?.()) {
          window.AgentLive2d?.scheduleLoad?.('init-agent');
        } else {
          window.AgentVtuber?.syncChatClasses?.();
          window.AgentLive2d?.relayout?.();
        }
      });
    }

    bindSessionSidebar();
    bindShareUi();
    startSharePolling();
    bindComposer();
    bindChatSettingsUi();
    renderRoleSuggestions();
    bindStatusBanner();
    bindBriefAndLabor();
    bindTaskPickerUi();
    refreshAgentStatus();
    autoResize();
    loadKanbanTasks();

    window.api.onMetaskTasksUpdated?.((result) => {
      if (Array.isArray(result?.tasks)) applyKanbanTasks(result.tasks);
    });
    window.api.onMetaskCommentUpdates?.((events) => {
      handleMetaskCommentUpdates(events);
    });
    window.api.metaskConsumePendingCommentUpdates?.()
      .then((events) => {
        if (events?.length) handleMetaskCommentUpdates(events);
      })
      .catch(() => {});
    startMetaskCommentWatchdog();

    window.addEventListener('role-changed', () => renderRoleSuggestions());

    window.api.onAuthChanged?.((payload) => {
      switchAgentUserContext(payload?.profile || null);
    });

    window.addEventListener('user-avatar-updated', () => {
      refreshUserMessageAvatars();
    });

    window.addEventListener('auth-ready', (event) => {
      switchAgentUserContext(event?.detail?.profile || null);
    });

    window.api.onConfig?.(() => {
      syncAgentModelSelect();
      refreshAgentStatus();
      loadKanbanTasks();
    });
  }

  window.initAgent = initAgent;
})();
