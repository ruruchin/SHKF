(function () {
  let agentInited = false;
  const QUICK = {
    analyze: 'Прочитай описание задачи целиком и дай честную оценку для дизайнера: что именно просят, реальный объём, риски, 3–5 уточняющих вопросов заказчику (со ссылкой на текст задачи), с чего начать в Figma.',
    banner: 'Исходя из текста задачи, предложи 3 разных промпта для генерации баннера (размер, стиль, CTA). Каждый — готовый текст, опирайся на формулировки из описания.',
    bannerNano: 'Сделай баннер в NanoBanana: извлеки тему из описания задачи и сгенерируй изображение.',
    figmaEdit: 'Сформируй и примени план правок прямо в Figma: сначала покажи список изменений, потом по кнопке внеси их в макет.',
    landing: 'По описанию задачи: структура лендинга (блоки) и один детальный промпт для Figma Make — только то, что следует из задачи.',
    make: 'Сформулируй детальный промпт для Figma Make под эту задачу: экраны, компоненты, состояния — строго из описания, без generic UI.',
    split: 'Разбей работу по задаче на подзадачи для дизайнера с порядком и оценкой времени. Каждый пункт привяжи к тексту описания.',
    labor: 'Покажи все трудозатраты по этой задаче: кто сколько часов списал, даты и кратко что делал. Если спрашиваю про одного человека — только по нему. Только данные из Redmine, без выдумок.',
    // --- Разработка / продуктивность ---
    devPlan: 'Составь мне план работы на сегодня по задачам из Kanban: расставь приоритеты (что срочно/важно), оцени время на каждую и предложи порядок выполнения, чтобы закрыть максимум за день. Опирайся на реальные задачи и их статусы.',
    devStandup: 'Сформируй текст для дейли-стендапа по моим задачам: «Что сделал вчера», «Что делаю сегодня», «Блокеры». Коротко, по делу, на основе статусов задач из Kanban.',
    devEstimate: 'Оцени эту задачу как разработчик: декомпозиция на технические подзадачи (API, БД, фронт, тесты), оценка в часах по каждой, риски и неясности, 3–5 уточняющих вопросов. Только из описания задачи.',
    devReview: 'Дай чеклист для код-ревью этой задачи: что обязательно проверить (логика, edge-cases, безопасность, производительность, тесты, читаемость), на что обратить внимание ревьюеру именно в этой задаче.',
    devCommit: 'По описанию задачи предложи: 1) название ветки (feature/fix + краткий слаг), 2) сообщение коммита в стиле Conventional Commits, 3) заголовок и описание Pull Request (Что сделано / Как проверить / Связанная задача).',
    devProductivity: 'Проанализируй мои задачи из Kanban и список трудозатрат и дай честный разбор продуктивности: сколько задач в работе/закрыто, где застряло, что съедает время, и 3–5 конкретных советов как ускориться и улучшить показатели. Только реальные данные.',
    pmStatus: 'Сделай сводку статуса по всем задачам команды из Kanban: что в работе, что готово, что просрочено или висит без движения. Кратко и структурировано для отчёта.',
    pmRisks: 'Найди риски и узкие места по задачам из Kanban: что может сорвать сроки, где перегруз, какие задачи без оценки или зависают. Предложи действия.',
  };

  const AGENT_AVATAR_SRC = 'assets/agent/agent-avatar.png';

  function agentAvatarHtml(size) {
    const s = size || 32;
    return `<img class="agent-avatar-img" src="${AGENT_AVATAR_SRC}" alt="" width="${s}" height="${s}" />`;
  }

  const TASK_WORK_RE = /задач|ticket|redmine|kanban|оцен|баннер|лендин|figma\s*make|\bmake\b|промпт|макет|ui\b|ux\b|экран|блок|компонент|дизайн|верст|сложност|объ[её]м|риск|уточн|заказчик|клиент|описан|плашк|cta|wireframe|прототип|разбить|шаг|figma|трудозатрат|уч[её]т\s+времени|сколько\s+час|списал|отработал|ревью|review|коммит|commit|pull\s*request|\bpr\b|ветк|стендап|standup|дейли|продуктивн|производительн|план\s+(?:на\s+)?(?:день|сегодня)|приоритет|спринт|sprint|рефактор|деплой|deploy|\bапи\b|\bapi\b|бэкенд|backend|фронт|frontend|тест|баг|\bbug\b|показател/i;

  const NB_WORD_RE = /(?:nano\s*banana|nanobanana|нанобанан|нанобанана)/i;
  const BANNER_WORD_RE = /(?:баннер|banner)/i;
  const GENERATE_WORD_RE = /сгенерир(?:уй|ируй)|генерир(?:уй|ируй)|сделай|создай|нарисуй|выдай|собери/i;
  const PROMPT_WORD_RE = /\bпромпт\b|prompt/i;
  const FIGMA_EDIT_RE = /(в\s*figma|фигм|макет|mockup|поправ|исправ|правк|перерис|измени|layout|автолейаут)/i;

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

  function isFigmaEditIntent(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (/^\/figma\b/i.test(t)) return true;
    return FIGMA_EDIT_RE.test(t) && !NB_WORD_RE.test(t);
  }

  const HISTORY_KEY = 'firuru-agent-history-v1';
  const SESSIONS_KEY = 'firuru-agent-sessions-v2';
  const ACTIVE_SESSION_KEY = 'firuru-agent-active-session-v2';
  const MAX_SESSIONS = 50;
  const MAX_MESSAGES_PER_SESSION = 80;
  const BRIEF_SHOWN_KEY = 'agent-brief-shown-date-v1';
  const BRIEF_LIST_LIMIT = 10;
  let lastBriefData = null;
  const briefExpandedSections = new Set();
  let messagesEl;
  let promptEl;
  let sendBtn;
  let taskSelect;
  let modelSelect;
  let statusBanner;
  let sessionListEl;
  let savingAgentModel = false;
  let chatHistory = [];
  let agentSessions = [];
  let activeSessionId = null;
  let kanbanTasks = [];
  let sending = false;
  let messageAnimIndex = 0;
  let taskThreadActive = false;
  let pendingAgentImage = null;
  const pendingMockupPosts = new Map();
  const pendingFigmaPlans = new Map();
  const shownCommentNotifyKeys = new Set();
  let metaskCommentWatchdogTimer = null;
  let metaskCommentWatchdogBusy = false;

  function isTaskWorkRequest(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (Object.values(QUICK).includes(t)) return true;
    return TASK_WORK_RE.test(t);
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

  function shouldAllowFollowups(text, useTaskContext, task) {
    if (!useTaskContext || !task?.id) return false;
    const t = String(text || '');
    const laborOnly = /трудозатрат|уч[её]т\s+времени|сколько\s+час|списал|отработал/i.test(t)
      && !/оцен|уточн|заказчик|риск|баннер|промпт|лендин|figma\s*make|разбить/i.test(t);
    return !laborOnly;
  }

  function resolveFollowupsForDisplay(followups, task, showFollowups) {
    if (!showFollowups || !task?.id || !followups?.length) {
      return { followups: null, taskId: null };
    }
    return { followups: followups.slice(0, 3), taskId: task.id };
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
    if (!parts.length) return 'ИИ';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function pushBackgroundNotifyCard({
    title = 'ИИ Агент',
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
      foot.innerHTML = '<button type="button" class="agent-bg-notify-open" data-bg-open-agent>Открыть ИИ Агент</button>';
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
      title: 'ИИ Агент · Redmine',
      html,
      sticky: true,
    });
  }

  function showBackgroundTaskCommentCard(event) {
    const issueId = Number(event?.issueId || 0);
    const issueUrl = String(event?.issueUrl || '').trim();
    const userName = String(event?.user?.name || 'Участник').trim() || 'Участник';
    const text = String(event?.text || '').trim() || 'Добавил комментарий';
    const avatarHtml = event?.user?.avatarUrl
      ? `<span class="agent-bg-notify-avatar agent-bg-notify-avatar--user"><img class="agent-avatar-img" src="${escapeAttr(event.user.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></span>`
      : `<span class="agent-bg-notify-avatar agent-bg-notify-avatar--initials">${escapeHtml(getInitials(userName))}</span>`;
    const image = Array.isArray(event?.images) && event.images[0]
      ? `<img class="agent-bg-comment-image" src="${escapeAttr(event.images[0])}" alt="" loading="lazy" />`
      : '';
    const html = `
      <div class="agent-bg-comment">
        <div class="agent-bg-notify-body"><strong>${escapeHtml(userName)}</strong> написал(а) в задаче <strong>#${escapeHtml(issueId)}</strong></div>
        <div class="agent-bg-comment-text">${escapeHtml(text)}</div>
        ${image}
        <div class="agent-bg-notify-foot">
          <button type="button" class="agent-bg-notify-open" data-bg-open-metask-task="${escapeAttr(issueId)}" data-bg-open-metask-url="${escapeAttr(issueUrl)}">Открыть задачу в Канбан</button>
        </div>
      </div>`;
    pushBackgroundNotifyCard({
      title: 'Комментарий Redmine',
      html,
      avatarHtml,
      sticky: false,
    });
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
      window.api.agentNotifyBackground?.({
        title: `Redmine · #${event?.issueId || ''}`,
        body: `${event?.user?.name || 'Участник'}: ${String(event?.text || '').slice(0, 180)}`,
      }).catch(() => {});
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

  async function notifyIfAgentInBackground({ title = 'ИИ Агент', body = '' } = {}) {
    if (isAgentPageActive()) return;
    const text = String(body || '').trim();
    if (!text) return;
    pushBackgroundNotifyCard({
      title,
      body: text.length > 220 ? `${text.slice(0, 220)}…` : text,
    });
    beepAgentNotification();
    try {
      await window.api.agentNotifyBackground?.({ title, body: text });
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

  function selectTaskById(taskId) {
    if (!taskSelect || !taskId) return;
    taskSelect.value = String(taskId);
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
          localStorage.setItem(BRIEF_SHOWN_KEY, new Date().toISOString().slice(0, 10));
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
      if (localStorage.getItem(BRIEF_SHOWN_KEY) === today) return;
      localStorage.setItem(BRIEF_SHOWN_KEY, today);
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
      if (match.index > last) parts.push(escapeHtml(raw.slice(last, match.index)));
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

    if (last < raw.length) parts.push(escapeHtml(raw.slice(last)));
    return parts.join('');
  }

  function isMetaHeading(text) {
    return /^(рекомендац|итог|вывод|заключение|резюме|анализ задачи|уточняющие вопрос|вопросы заказчик|возможные шаги|риски и зависимост|сложность задачи)/i.test(String(text || '').trim());
  }

  function formatAssistantHtml(text) {
    let source = String(text || '').trim();
    source = source.replace(/<<<FOLLOWUPS[\s\S]*?FOLLOWUPS>>>/gi, '').trim();
    source = source.replace(/\n{3,}/g, '\n\n');

    const lines = source.split('\n');
    const out = [];
    let i = 0;
    let inUl = false;
    let inOl = false;
    let inCode = false;
    let codeBuf = [];
    let paraBuf = [];

    const closeLists = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
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
        flushParagraph();
        i += 1;
        continue;
      }

      if (/^<<<FOLLOWUPS/i.test(line.trim()) || /FOLLOWUPS>>>$/i.test(line.trim())) {
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
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul class="agent-md-ul">'); inUl = true; }
        out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        flushParagraph();
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

  function buildFollowupsHtml(followups, taskId, animate = true) {
    if (!followups?.length) return '';
    const tid = Number(taskId) || 0;
    const sendIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    const items = followups.slice(0, 3).map((q, idx) => (
      `<button type="button" class="agent-followup" data-agent-task-comment="${escapeAttr(q)}"${tid ? ` data-agent-task-id="${tid}"` : ''} style="--fu-i:${idx}" title="${escapeAttr(q)}">`
      + `<span class="agent-followup-icon">${sendIcon}</span>`
      + `<span class="agent-followup-text">${escapeHtml(q)}</span>`
      + '</button>'
    )).join('');
    return (
      `<div class="agent-followups${animate ? ' agent-followups--animate' : ''}">`
      + `<div class="agent-followups-list">${items}</div>`
      + '</div>'
    );
  }

  function showAgentToast(message, type = 'ok') {
    const stack = document.getElementById('metask-toast-stack');
    if (!stack) return;
    const btn = document.createElement('div');
    btn.className = `metask-toast agent-action-toast agent-action-toast--${type}`;
    btn.innerHTML = `
      <span class="metask-toast-accent" aria-hidden="true"></span>
      <span class="metask-toast-body">
        <span class="metask-toast-title">${type === 'ok' ? 'Redmine' : 'Ошибка'}</span>
        <span class="metask-toast-subject">${escapeHtml(message)}</span>
      </span>`;
    stack.prepend(btn);
    requestAnimationFrame(() => requestAnimationFrame(() => btn.classList.add('is-visible')));
    setTimeout(() => {
      btn.classList.remove('is-visible');
      btn.classList.add('is-leaving');
      setTimeout(() => btn.remove(), 320);
    }, 4200);
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
    const steps = ['Подключаюсь к GigaChat…', 'Обрабатываю контекст переписки…'];
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

  function saveSessionsStore() {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(agentSessions.slice(0, MAX_SESSIONS)));
      if (activeSessionId) localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      else localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch { /* ignore */ }
  }

  function loadSessionsStore() {
    agentSessions = [];
    activeSessionId = null;
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) agentSessions = parsed.filter((s) => s?.id);
      activeSessionId = localStorage.getItem(ACTIVE_SESSION_KEY) || null;
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
      const raw = sessionStorage.getItem(HISTORY_KEY);
      const messages = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(messages) || !messages.length) return null;
      const now = new Date().toISOString();
      return {
        id: createSessionId(),
        title: deriveSessionTitle(messages),
        createdAt: now,
        updatedAt: now,
        taskId: null,
        messages,
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
      messages: chatHistory.slice(-MAX_MESSAGES_PER_SESSION),
      taskId: task?.id || null,
      updatedAt: new Date().toISOString(),
      title: chatHistory.length ? title : (prev.title || 'Новый чат'),
    };

    agentSessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    saveSessionsStore();
    renderSessionList();
  }

  function applySessionToUi(session) {
    pendingAgentImage = null;
    renderPendingAgentImage();
    chatHistory = Array.isArray(session?.messages) ? [...session.messages] : [];
    messageAnimIndex = 0;
    syncTaskThreadFromHistory();

    if (taskSelect) {
      const tid = session?.taskId ? String(session.taskId) : '';
      if (tid && kanbanTasks.some((t) => String(t.id) === tid)) taskSelect.value = tid;
      else taskSelect.value = '';
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
    renderSessionList();
    promptEl?.focus();
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
  }

  function deleteSession(sessionId) {
    if (!sessionId) return;
    if (!window.confirm('Удалить этот чат? История сообщений будет потеряна.')) return;

    persistCurrentSession();
    agentSessions = agentSessions.filter((s) => s.id !== sessionId);

    if (!agentSessions.length) {
      createNewSession();
      return;
    }

    if (activeSessionId === sessionId) {
      activeSessionId = agentSessions[0].id;
      saveSessionsStore();
      applySessionToUi(getActiveSession());
    } else {
      saveSessionsStore();
    }
    renderSessionList();
  }

  function renderSessionList() {
    if (!sessionListEl) return;
    sessionListEl.innerHTML = '';

    if (!agentSessions.length) {
      sessionListEl.innerHTML = '<p class="agent-session-empty">Нет сохранённых чатов</p>';
      return;
    }

    agentSessions.forEach((session) => {
      const row = document.createElement('div');
      row.className = `agent-session-item${session.id === activeSessionId ? ' is-active' : ''}`;
      row.dataset.sessionId = session.id;
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      const count = session.messages?.length || 0;
      const meta = count
        ? `${formatSessionTime(session.updatedAt)} · ${count} сообщ.`
        : formatSessionTime(session.updatedAt);
      row.innerHTML = `
        <span class="agent-session-title">${escapeHtml(session.title || 'Новый чат')}</span>
        <span class="agent-session-meta">${escapeHtml(meta)}</span>`;
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'agent-session-delete';
      delBtn.dataset.deleteSession = session.id;
      delBtn.setAttribute('aria-label', 'Удалить чат');
      delBtn.textContent = '×';
      row.appendChild(delBtn);
      sessionListEl.appendChild(row);
    });
  }

  function bindSessionSidebar() {
    $('agent-session-new')?.addEventListener('click', createNewSession);
    $('agent-chat-clear')?.addEventListener('click', createNewSession);

    sessionListEl?.addEventListener('click', (event) => {
      const del = event.target.closest('[data-delete-session]');
      if (del) {
        event.stopPropagation();
        deleteSession(del.getAttribute('data-delete-session'));
        return;
      }
      const item = event.target.closest('.agent-session-item');
      if (!item?.dataset.sessionId) return;
      switchSession(item.dataset.sessionId);
    });

    sessionListEl?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.agent-session-item');
      if (!item?.dataset.sessionId || event.target.closest('[data-delete-session]')) return;
      event.preventDefault();
      switchSession(item.dataset.sessionId);
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
    renderSessionList();
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
        addMessage('user', buildUserMessageHtml(msg.content, msg.images), null, {
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
        );
        addMessage('assistant', formatAssistantHtml(prepared.content), msg.meta || null, {
          pushHistory: false,
          animate: false,
          followups: display.followups,
          taskId: display.taskId,
        });
      }
    });
    scrollBottom();
    syncStageState();
  }

  function showEmptyState() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    messagesEl.classList.add('agent-messages--idle');
  }

  function syncStageState() {
    const hasChat = chatHistory.length > 0 || !!messagesEl?.querySelector('.agent-msg');
    messagesEl?.classList.toggle('agent-messages--idle', !hasChat);
  }

  function addMessage(role, html, meta, opts = {}) {
    const { pushHistory = true, followups = null, taskId = null, animate = true } = opts;
    messagesEl?.classList.remove('agent-messages--idle');

    const wrap = document.createElement('div');
    wrap.className = `agent-msg agent-msg-${role}${followups?.length ? ' agent-msg--has-followups' : ''}`;
    if (animate) {
      wrap.style.setProperty('--agent-msg-i', String(messageAnimIndex++));
      wrap.classList.add('agent-msg--enter');
    } else {
      wrap.classList.add('agent-msg--static');
    }

    const avatar = role === 'assistant' ? agentAvatarHtml() : 'Вы';
    const bubbleClass = role === 'assistant' ? 'agent-msg-bubble agent-md-wrap' : 'agent-msg-bubble';

    wrap.innerHTML = `
      <div class="agent-msg-avatar">${avatar}</div>
      <div class="agent-msg-body">
        <div class="${bubbleClass}">${html}</div>
        ${meta ? `<div class="agent-msg-meta">${escapeHtml(meta)}</div>` : ''}
        ${role === 'assistant' ? buildFollowupsHtml(followups, taskId, animate) : ''}
      </div>`;

    messagesEl.appendChild(wrap);
    scrollBottom();
    syncStageState();
    if (pushHistory) { /* caller pushes to chatHistory */ }
    return wrap;
  }

  function addThinking(task, customSteps) {
    messagesEl?.classList.remove('agent-messages--idle');
    const steps = customSteps?.length ? customSteps : buildThinkingSteps(task);

    const wrap = document.createElement('div');
    wrap.className = 'agent-msg agent-msg-assistant agent-thinking agent-msg--enter';
    wrap.style.setProperty('--agent-msg-i', String(messageAnimIndex++));
    wrap.innerHTML = `
      <div class="agent-msg-avatar">${agentAvatarHtml()}</div>
      <div class="agent-msg-body">
        <div class="agent-msg-bubble agent-thinking-bubble">
          <div class="agent-thinking-head">
            <span class="agent-thinking-pulse" aria-hidden="true"></span>
            <span class="agent-thinking-label">Думаю</span>
          </div>
          <div class="agent-thinking-step">
            <span class="agent-thinking-step-text">${escapeHtml(steps[0])}</span>
          </div>
          <div class="agent-thinking-track" aria-hidden="true">
            <span class="agent-thinking-track-fill"></span>
          </div>
          <ul class="agent-thinking-log" aria-live="polite"></ul>
        </div>
      </div>`;

    messagesEl.appendChild(wrap);
    scrollBottom();
    syncStageState();

    const stepEl = wrap.querySelector('.agent-thinking-step-text');
    const logEl = wrap.querySelector('.agent-thinking-log');
    let stepIndex = 0;

    const pushLog = (text) => {
      if (!logEl) return;
      const item = document.createElement('li');
      item.className = 'agent-thinking-log-item';
      item.textContent = text;
      logEl.appendChild(item);
      while (logEl.children.length > 4) {
        logEl.removeChild(logEl.firstChild);
      }
    };

    wrap._thinkingTimer = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      const nextText = steps[stepIndex];
      if (stepEl) {
        stepEl.classList.add('agent-thinking-step-text--swap');
        setTimeout(() => {
          stepEl.textContent = nextText;
          stepEl.classList.remove('agent-thinking-step-text--swap');
        }, 180);
      }
      pushLog(nextText);
    }, 1300);

    return wrap;
  }

  function removeThinking(thinking) {
    if (thinking?._thinkingTimer) clearInterval(thinking._thinkingTimer);
    thinking?.remove();
  }

  function autoResize() {
    if (!promptEl) return;
    const composer = document.getElementById('agent-composer');
    const lineHeight = 22;
    promptEl.style.height = 'auto';
    const next = Math.max(lineHeight, Math.min(promptEl.scrollHeight, 140));
    promptEl.style.height = `${next}px`;
    composer?.classList.toggle('agent-composer--multiline', next > lineHeight + 2);
  }

  function isVisionModelSelected() {
    const model = modelSelect?.value || window.appSettings?.agent?.model || '';
    return /^GigaChat-2/i.test(model);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function renderPendingAgentImage() {
    const box = $('agent-composer-attachments');
    if (!box) return;
    if (!pendingAgentImage?.dataUrl) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="agent-pending-image">
        <img src="${escapeHtml(pendingAgentImage.dataUrl)}" alt="" />
        <button type="button" class="agent-pending-image-rm" aria-label="Убрать изображение">×</button>
      </div>`;
    box.querySelector('.agent-pending-image-rm')?.addEventListener('click', () => {
      pendingAgentImage = null;
      renderPendingAgentImage();
      updateSendState();
    });
  }

  async function addAgentImageFromFile(file) {
    if (!file?.type?.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) {
      showAgentToast('Изображение больше 15 МБ', 'error');
      return;
    }
    if (!isVisionModelSelected()) {
      showAgentToast('Изображения: выберите GigaChat-2 или GigaChat-2-Pro', 'error');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      pendingAgentImage = { dataUrl, filename: file.name || 'image.png' };
      renderPendingAgentImage();
      updateSendState();
    } catch {
      showAgentToast('Не удалось прочитать изображение', 'error');
    }
  }

  async function pickAgentImage() {
    if (!isVisionModelSelected()) {
      showAgentToast('Изображения: выберите GigaChat-2 или GigaChat-2-Pro', 'error');
      return;
    }
    const r = await window.api.agentPickImage?.();
    if (r?.canceled) return;
    if (!r?.ok) {
      if (r?.message) showAgentToast(r.message, 'error');
      return;
    }
    if (r.image?.dataUrl) {
      pendingAgentImage = r.image;
      renderPendingAgentImage();
      updateSendState();
    }
  }

  function buildUserMessageHtml(text, images) {
    const parts = [];
    const imgs = images?.length ? images : [];
    for (const img of imgs) {
      if (img?.dataUrl) {
        parts.push(`<img class="agent-user-image" src="${escapeHtml(img.dataUrl)}" alt="" loading="lazy" />`);
      }
    }
    const t = String(text || '').trim();
    if (t) parts.push(escapeHtml(t).replace(/\n/g, '<br>'));
    if (!parts.length) return '<span class="agent-user-image-only">Изображение</span>';
    return parts.join('');
  }

  function updateSendState() {
    const canSend = !sending && (!!promptEl?.value.trim() || !!pendingAgentImage);
    if (sendBtn) sendBtn.disabled = !canSend;
  }

  async function refreshAgentStatus() {
    try {
      const status = await window.api.agentGetStatus?.();
      const configured = status?.configured;
      if (statusBanner) {
        statusBanner.classList.toggle('hidden', !!configured);
        if (!configured) {
          statusBanner.innerHTML = 'Подключите GigaChat: '
            + '<a href="#" data-agent-open-settings>Настройки → ИИ Агент</a>';
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

  function getAgentModelLabel() {
    const model = window.appSettings?.agent?.model
      || modelSelect?.value
      || 'GigaChat';
    return model;
  }

  function syncAgentModelSelect() {
    if (!modelSelect) return;
    const model = window.appSettings?.agent?.model || 'GigaChat';
    if ([...modelSelect.options].some((opt) => opt.value === model)) {
      modelSelect.value = model;
    }
    updateTaskSelectHint();
  }

  async function saveAgentModelFromPage() {
    if (!modelSelect || savingAgentModel) return;
    const model = modelSelect.value || 'GigaChat';
    const prev = window.appSettings?.agent?.model || 'GigaChat';
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
      taskSelect.value = '';
      return;
    }

    kanbanTasks.forEach((task) => {
      const opt = document.createElement('option');
      opt.value = String(task.id);
      opt.textContent = `#${task.id} · ${(task.subject || '').slice(0, 48)}`;
      taskSelect.appendChild(opt);
    });
    if (prev && kanbanTasks.some((t) => String(t.id) === prev)) {
      taskSelect.value = prev;
    }
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
          title: 'ИИ Агент · Redmine',
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
          title: 'ИИ Агент · Redmine',
          body: `Мокапы готовы для задачи #${task.id}. Отправляем?`,
        }).catch(() => {});
      }
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Не удалось собрать мокапы')}</p>`, 'Redmine');
      notifyIfAgentInBackground({
        title: 'ИИ Агент · Redmine',
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

  function buildFigmaPlanHtml({ token, plan, selection, refs }) {
    const assumptions = (plan.assumptions || [])
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join('');
    const ops = (plan.operations || [])
      .map((op, idx) => `<li><strong>${idx + 1}.</strong> ${escapeHtml(opText(op))}</li>`)
      .join('');
    const refList = Array.isArray(refs) && refs.length
      ? `<ul class="agent-md-ul">${refs.slice(0, 4).map((r) => (
        `<li><a href="#" class="agent-md-link" data-agent-href="${escapeAttr(r.url)}">${escapeHtml(r.title || r.url)}</a></li>`
      )).join('')}</ul>`
      : '';
    return `
      <div class="agent-mockup-ready" data-figma-plan-token="${escapeHtml(token)}">
        <p><strong>План правок для Figma готов.</strong></p>
        ${plan.summary ? `<p class="agent-mockup-sub">${escapeHtml(plan.summary)}</p>` : ''}
        <p class="agent-mockup-sub">Файл: <strong>${escapeHtml(selection?.fileName || '—')}</strong>, страница: <strong>${escapeHtml(selection?.pageName || '—')}</strong>, выделено: <strong>${escapeHtml(selection?.selectedCount || 0)}</strong></p>
        ${refList ? `<p class="agent-mockup-sub"><strong>Референсы:</strong></p>${refList}` : ''}
        ${assumptions ? `<ul class="agent-md-ul">${assumptions}</ul>` : ''}
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

  async function sendFigmaPlan(textOverride) {
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
      'Читаю структуру выделения в Figma…',
      'Сопоставляю запрос с макетом…',
      'Формирую план правок…',
      'Готовлю превью перед применением…',
    ]);

    try {
      const result = await window.api.agentFigmaPlan?.({
        message: text.replace(/^\/figma\s*/i, ''),
        history: chatHistory.slice(0, -1),
        task: useTaskContext ? task : null,
      });
      removeThinking(thinking);
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
      }), result.model ? `Figma Agent · ${result.model}` : 'Figma Agent');
      chatHistory.push({
        role: 'assistant',
        content: `План правок Figma: ${result.plan.summary || `${result.plan.operations.length} операций`}`,
        meta: 'Figma Agent',
      });
      saveHistory();
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Ошибка при планировании правок Figma')}</p>`, 'Figma');
    } finally {
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
        title: 'ИИ Агент · NanoBanana',
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
          title: 'ИИ Агент · NanoBanana',
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
        title: 'ИИ Агент · NanoBanana',
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
        title: 'ИИ Агент · NanoBanana',
        body: err.message || 'Сбой в генерации NanoBanana',
      });
    } finally {
      sending = false;
      updateSendState();
      promptEl?.focus();
    }
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? promptEl?.value ?? '').trim();
    const images = pendingAgentImage?.dataUrl ? [{ ...pendingAgentImage }] : [];
    if ((!text && !images.length) || sending) return;

    if (text && isBannerNanobananaIntent(text)) {
      return sendBannerToNanobanana(textOverride);
    }
    if (text && isFigmaEditIntent(text)) {
      return sendFigmaPlan(textOverride);
    }

    updateTaskThread(text || 'изображение');

    sending = true;
    updateSendState();

    addMessage('user', buildUserMessageHtml(text, images));
    const userEntry = {
      role: 'user',
      content: text,
      taskThread: taskThreadActive,
    };
    if (images.length) userEntry.images = images.map((i) => ({ dataUrl: i.dataUrl, filename: i.filename }));
    chatHistory.push(userEntry);
    saveHistory();

    pendingAgentImage = null;
    renderPendingAgentImage();

    if (window.appSettings?.agent?.clearInputAfterSend !== false && promptEl && textOverride == null) {
      promptEl.value = '';
      autoResize();
    }

    const task = getSelectedTask();
    const useTaskContext = taskThreadActive
      && task
      && window.appSettings?.agent?.useTaskContext !== false;
    const allowFollowups = shouldAllowFollowups(text, useTaskContext, task);
    const thinking = addThinking(useTaskContext ? task : null);

    try {
      const result = await window.api.agentSendMessage({
        message: text || 'Опиши приложенное изображение.',
        history: chatHistory.slice(0, -1),
        task: useTaskContext ? task : null,
        allowFollowups,
        images,
        role: window.RoleNav?.getRole?.() || null,
      });

      removeThinking(thinking);

      if (!result?.ok) {
        addMessage('assistant', `<p>${escapeHtml(result?.message || 'Ошибка запроса').replace(/\n/g, '<br>')}</p>`);
        notifyIfAgentInBackground({
          title: 'ИИ Агент',
          body: result?.message || 'Ошибка запроса к ИИ-агенту',
        });
        return;
      }

      const prepared = prepareAssistantReply(result.content, allowFollowups ? result.followups : []);
      const meta = useTaskContext && task
        ? `Задача #${task.id}`
        : (result.model ? `GigaChat · ${result.model}` : null);
      const display = resolveFollowupsForDisplay(prepared.followups, task, allowFollowups);

      const laborHtml = Array.isArray(result.laborEntries) && result.laborEntries.length
        ? buildLaborCardsHtml(result.laborEntries)
        : '';
      let assistantBody = formatAssistantHtml(prepared.content);
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
      });
      bindLaborAvatarFallbacks(msgWrap);
      notifyIfAgentInBackground({
        title: 'ИИ Агент',
        body: prepared.content.replace(/\s+/g, ' ').slice(0, 220),
      });
      if (Array.isArray(result.attachmentFileIds) && result.attachmentFileIds.length) {
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
          if (chatHistory[i].role === 'user') {
            chatHistory[i].attachments = result.attachmentFileIds;
            break;
          }
        }
      }
      chatHistory.push({
        role: 'assistant',
        content: prepared.content,
        meta,
        followups: prepared.followups,
        taskId: task?.id || null,
        showFollowups: allowFollowups && !!display.followups?.length,
      });
      saveHistory();
    } catch (err) {
      removeThinking(thinking);
      addMessage('assistant', `<p>${escapeHtml(err.message || 'Сбой сети')}</p>`);
      notifyIfAgentInBackground({
        title: 'ИИ Агент',
        body: err.message || 'Сбой сети при ответе агента',
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
    pmStatus: ['Статус', 'Сводка статуса задач'],
    pmRisks: ['Риски', 'Риски и узкие места'],
    links: ['Найти связи', 'Найти связанные задачи в Kanban'],
  };

  const SUGGESTION_SETS = {
    designer: ['analyze', 'banner', 'bannerNano', 'figmaEdit', 'landing', 'make', 'links', 'split', 'labor'],
    frontend: ['devPlan', 'devStandup', 'links', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'labor'],
    backend: ['devPlan', 'devStandup', 'links', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'labor'],
    pm: ['pmStatus', 'links', 'pmRisks', 'devPlan', 'split', 'devProductivity', 'labor'],
    full: ['analyze', 'banner', 'bannerNano', 'figmaEdit', 'links', 'devPlan', 'devStandup', 'devEstimate', 'devReview', 'devCommit', 'devProductivity', 'split', 'labor'],
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
      if (devRole) sub.textContent = 'GigaChat · Kanban · продуктивность разработки';
      else if (role === 'pm') sub.textContent = 'GigaChat · Kanban · статусы и риски';
      else sub.textContent = 'GigaChat · Kanban · промпты для дизайна';
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
        if (key === 'bannerNano') {
          if (promptEl) {
            promptEl.value = prompt;
            autoResize();
          }
          sendBannerToNanobanana(prompt);
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
    $('agent-attach')?.addEventListener('click', () => pickAgentImage());

    promptEl?.addEventListener('input', () => {
      autoResize();
      updateSendState();
    });
    promptEl?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    promptEl?.addEventListener('paste', async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        event.preventDefault();
        const file = item.getAsFile();
        if (file) await addAgentImageFromFile(file);
        return;
      }
    });
    sendBtn?.addEventListener('click', () => sendMessage());

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
      const openTaskBtn = event.target.closest('[data-open-metask-task]');
      if (openTaskBtn) {
        const issueId = openTaskBtn.getAttribute('data-open-metask-task');
        const taskUrl = openTaskBtn.getAttribute('data-open-metask-url') || '';
        openTaskInKanban(issueId, taskUrl);
        return;
      }
      const btn = event.target.closest('[data-agent-task-comment]');
      if (!btn || btn.disabled) return;
      postQuestionToRedmine(btn);
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

  function playSuggestionsEntrance() {
    const el = $('agent-suggestions');
    if (!el) return;
    el.classList.remove('is-anim');
    void el.offsetHeight;
    el.classList.add('is-anim');
  }

  window.activateAgentPage = async function activateAgentPage() {
    window.detachMetaskBoard?.();
    renderRoleSuggestions();
    await refreshAgentStatus();
    await loadKanbanTasks();
    renderSessionList();
    playSuggestionsEntrance();
    maybeShowMorningBriefOnActivate();
  };

  function initAgent() {
    if (agentInited) return;
    agentInited = true;
    messagesEl = $('agent-messages');
    promptEl = $('agent-prompt');
    sendBtn = $('agent-send');
    taskSelect = $('agent-task-select');
    modelSelect = $('agent-model-select');
    statusBanner = $('agent-status-banner');
    sessionListEl = $('agent-session-list');
    bindBackgroundNotifyActions();

    if (!messagesEl || !promptEl) return;

    syncAgentModelSelect();
    loadHistory();

    bindSessionSidebar();
    bindComposer();
    renderRoleSuggestions();
    bindStatusBanner();
    bindBriefAndLabor();
    refreshAgentStatus();
    autoResize();
    loadKanbanTasks();
    playSuggestionsEntrance();

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

    window.api.onConfig?.(() => {
      syncAgentModelSelect();
      refreshAgentStatus();
      loadKanbanTasks();
    });
  }

  window.initAgent = initAgent;
})();
