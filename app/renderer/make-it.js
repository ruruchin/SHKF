function initMakeIt() {
  const PROMPTS = window.MAKE_STARTER_PROMPTS || {};
  const promptEl = document.getElementById('make-prompt');
  const sendBtn = document.getElementById('make-send');
  const micBtn = document.getElementById('make-mic');
  const micStatus = document.getElementById('make-mic-status');
  const composer = document.getElementById('make-composer');
  const messagesEl = document.getElementById('make-messages');
  const chatSub = document.getElementById('make-chat-sub');
  const clearBtn = document.getElementById('make-chat-clear');

  if (!promptEl || !sendBtn || !messagesEl) return;

  let listening = false;
  let sending = false;

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function autoResize() {
    promptEl.style.height = 'auto';
    promptEl.style.height = Math.min(promptEl.scrollHeight, 220) + 'px';
  }

  function bindPromptButton(btn) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.promptKey;
      promptEl.value = (key && PROMPTS[key]) || btn.dataset.prompt || '';
      autoResize();
      updateSendState();
      promptEl.focus();
    });
  }

  function applyStarterPrompts(root) {
    root.querySelectorAll('[data-prompt-key]').forEach((el) => {
      const key = el.dataset.promptKey;
      if (key && PROMPTS[key]) el.dataset.prompt = PROMPTS[key];
    });
  }

  function updateSendState() {
    sendBtn.disabled = sending || !promptEl.value.trim();
  }

  function addMessage(role, html, meta) {
    const wrap = document.createElement('div');
    wrap.className = `make-msg make-msg-${role}`;
    const avatar = role === 'assistant' ? '✦' : 'Вы';
    wrap.innerHTML = `
      <div class="make-msg-avatar">${avatar}</div>
      <div class="make-msg-body">
        <div class="make-msg-bubble">${html}</div>
        ${meta ? `<div class="make-msg-meta">${meta}</div>` : ''}
      </div>`;
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function addThinking() {
    const el = document.createElement('div');
    el.className = 'make-msg make-msg-assistant make-msg-thinking-wrap';
    el.id = 'make-thinking';
    el.innerHTML = `
      <div class="make-msg-avatar">✦</div>
      <div class="make-msg-body">
        <div class="make-msg-thinking">
          <div class="make-think-dots"><span></span><span></span><span></span></div>
          <span>Открываю Figma Make…</span>
        </div>
      </div>`;
    messagesEl.appendChild(el);
    scrollBottom();
    return el;
  }

  function removeThinking() {
    document.getElementById('make-thinking')?.remove();
  }

  function createEmptyState() {
    const el = document.createElement('div');
    el.className = 'make-empty';
    el.id = 'make-empty-state';
    el.innerHTML = `
      <div class="make-empty-hero">
        <div class="make-empty-icon-wrap" aria-hidden="true">
          <span class="make-empty-icon-ring"></span>
          <div class="make-empty-icon"></div>
        </div>
        <p class="make-empty-kicker"><span>SHKF</span><span class="make-empty-kicker-dot">×</span><span>Figma Make</span></p>
        <h2 class="make-empty-title">Что создаём сегодня?</h2>
        <p class="make-empty-lead">Опишите экран текстом или голосом — приложение соберёт промпт и откроет Figma Make с уже заполненным полем.</p>
        <div class="make-empty-pills">
          <span class="make-empty-pill">Текст</span>
          <span class="make-empty-pill">Голос</span>
          <span class="make-empty-pill make-empty-pill-accent">Figma Make</span>
        </div>
      </div>
      <div class="make-starter-grid">
        <button type="button" class="make-starter-card make-starter-card--onboard" data-prompt-key="onboard">
          <span class="make-starter-preview make-starter-preview--onboard" aria-hidden="true">
            <span class="make-sp-phone">
              <span class="make-sp-notch"></span>
              <span class="make-sp-illus"></span>
              <span class="make-sp-bar"></span>
              <span class="make-sp-bar make-sp-bar--short"></span>
              <span class="make-sp-dots"><span></span><span></span><span></span></span>
              <span class="make-sp-btn"></span>
            </span>
          </span>
          <span class="make-starter-foot">
            <span class="make-starter-copy">
              <span class="make-starter-label">Onboarding</span>
              <span class="make-starter-desc">4 экрана · mobile</span>
            </span>
            <span class="make-starter-go" aria-hidden="true">→</span>
          </span>
        </button>
        <button type="button" class="make-starter-card make-starter-card--dash" data-prompt-key="dash">
          <span class="make-starter-preview make-starter-preview--dash" aria-hidden="true">
            <span class="make-sp-side">
              <span class="make-sp-side-logo"></span>
              <span class="make-sp-side-line"></span>
              <span class="make-sp-side-line make-sp-side-line--active"></span>
              <span class="make-sp-side-line"></span>
            </span>
            <span class="make-sp-main">
              <span class="make-sp-topbar"></span>
              <span class="make-sp-kpi-row">
                <span class="make-sp-kpi"><span class="make-sp-kpi-val"></span></span>
                <span class="make-sp-kpi"><span class="make-sp-kpi-val"></span></span>
                <span class="make-sp-kpi make-sp-kpi--accent"></span>
              </span>
              <span class="make-sp-chart"></span>
            </span>
          </span>
          <span class="make-starter-foot">
            <span class="make-starter-copy">
              <span class="make-starter-label">Dashboard</span>
              <span class="make-starter-desc">KPI · графики · sidebar</span>
            </span>
            <span class="make-starter-go" aria-hidden="true">→</span>
          </span>
        </button>
        <button type="button" class="make-starter-card make-starter-card--land" data-prompt-key="land">
          <span class="make-starter-preview make-starter-preview--land" aria-hidden="true">
            <span class="make-sp-nav"><span class="make-sp-nav-logo"></span><span class="make-sp-nav-cta"></span></span>
            <span class="make-sp-hero"><span class="make-sp-hero-title"></span><span class="make-sp-hero-cta"></span></span>
            <span class="make-sp-features"><span></span><span></span><span></span></span>
            <span class="make-sp-pricing"><span></span><span class="make-sp-pricing-mid"></span><span></span></span>
          </span>
          <span class="make-starter-foot">
            <span class="make-starter-copy">
              <span class="make-starter-label">Landing</span>
              <span class="make-starter-desc">Hero · pricing · FAQ</span>
            </span>
            <span class="make-starter-go" aria-hidden="true">→</span>
          </span>
        </button>
        <button type="button" class="make-starter-card make-starter-card--modal" data-prompt-key="modal">
          <span class="make-starter-preview make-starter-preview--modal" aria-hidden="true">
            <span class="make-sp-overlay"></span>
            <span class="make-sp-modal">
              <span class="make-sp-modal-icon"></span>
              <span class="make-sp-modal-line"></span>
              <span class="make-sp-modal-line make-sp-modal-line--short"></span>
              <span class="make-sp-modal-btns"><span></span><span></span></span>
            </span>
          </span>
          <span class="make-starter-foot">
            <span class="make-starter-copy">
              <span class="make-starter-label">Modal</span>
              <span class="make-starter-desc">Confirm · overlay</span>
            </span>
            <span class="make-starter-go" aria-hidden="true">→</span>
          </span>
        </button>
      </div>`;
    applyStarterPrompts(el);
    el.querySelectorAll('.make-starter-card').forEach(bindPromptButton);
    return el;
  }

  function setEmptyStateVisible(visible) {
    document.getElementById('make-suggestions')?.classList.toggle('is-hidden', visible);
    document.getElementById('page-makeit')?.classList.toggle('make-has-empty', visible);
  }

  function showWelcome() {
    messagesEl.innerHTML = '';
    messagesEl.appendChild(createEmptyState());
    setEmptyStateVisible(true);
    if (chatSub) chatSub.textContent = 'Выберите шаблон или опишите свой UI';
  }

  function removeEmptyState() {
    document.getElementById('make-empty-state')?.remove();
    setEmptyStateVisible(false);
  }

  showWelcome();

  document.querySelectorAll('.make-sug').forEach((btn) => {
    bindPromptButton(btn);
  });
  applyStarterPrompts(document);

  promptEl.addEventListener('input', () => {
    autoResize();
    updateSendState();
  });

  clearBtn?.addEventListener('click', showWelcome);

  let speechLang = window.appSettings?.make?.speechLanguage || 'ru-RU';
  let speechSupported = false;
  let installedSpeechLangs = [];

  function speechLangReady(lang = speechLang) {
    return installedSpeechLangs.length === 0 || installedSpeechLangs.includes(lang);
  }

  function speechMissingMessage(lang = speechLang) {
    const installed = installedSpeechLangs.length ? installedSpeechLangs.join(', ') : 'нет';
    return (
      `На компьютере не установлено распознавание для «${lang}». `
      + `Доступно: ${installed}. `
      + 'Установите русский: Параметры Windows → Время и язык → Речь → '
      + 'Управление голосовыми функциями → Добавить языки → Русский → '
      + 'скачайте «Распознавание речи». '
      + 'Или выберите English (en-US) в настройках SHKF.'
    );
  }

  function syncMicAvailability() {
    if (!micBtn) return;
    if (!speechSupported) {
      micBtn.disabled = true;
      micBtn.title = 'Голосовой ввод доступен только в Windows';
      return;
    }
    if (!speechLangReady()) {
      micBtn.disabled = false;
      micBtn.title = `Язык «${speechLang}» не установлен в Windows`;
      return;
    }
    micBtn.disabled = false;
    micBtn.title = 'Голосовой ввод';
  }

  function setMicListening(active) {
    listening = active;
    micBtn?.classList.toggle('is-listening', active);
    composer?.classList.toggle('is-recording', active);
    if (!active && micStatus) micStatus.textContent = '';
    if (chatSub) {
      chatSub.textContent = active ? 'Голосовой ввод…' : 'AI-прототипы из текста';
    }
  }

  function appendTranscript(text) {
    const chunk = String(text || '').trim();
    if (!chunk) return;
    const cur = promptEl.value.trim();
    promptEl.value = cur ? `${cur} ${chunk}` : chunk;
    autoResize();
    updateSendState();
  }

  async function initSpeech() {
    try {
      speechSupported = await window.api.speechSupported?.();
      if (speechSupported) {
        installedSpeechLangs = await window.api.speechListLanguages?.() || [];
      }
    } catch {
      speechSupported = false;
      installedSpeechLangs = [];
    }
    syncMicAvailability();
  }

  window.api.onSpeechInterim?.(({ text }) => {
    if (micStatus) micStatus.textContent = text || 'Слушаю…';
  });

  micBtn?.addEventListener('click', async () => {
    if (!speechSupported) return;
    if (listening) {
      await window.api.speechStop?.();
      setMicListening(false);
      return;
    }

    setMicListening(true);
    if (micStatus) micStatus.textContent = 'Слушаю…';
    if (!speechLangReady()) {
      addMessage('assistant', `<span class="make-msg-err">${escapeHtml(speechMissingMessage())}</span>`);
      setMicListening(false);
      return;
    }
    try {
      const result = await window.api.speechStart?.(speechLang);
      if (result?.cancelled) {
        setMicListening(false);
        return;
      }
      if (result?.text) appendTranscript(result.text);
      if (!result?.ok && result?.message) {
        addMessage('assistant', `<span class="make-msg-err">${escapeHtml(result.message)}</span>`);
      }
    } catch (err) {
      addMessage('assistant', `<span class="make-msg-err">${escapeHtml(err.message || 'Ошибка микрофона')}</span>`);
    } finally {
      setMicListening(false);
    }
  });

  initSpeech();

  async function sendPrompt() {
    const prompt = promptEl.value.trim();
    if (!prompt || sending) return;

    if (listening) {
      await window.api.speechStop?.();
      setMicListening(false);
    }

    const keepHistory = window.appSettings?.make?.keepChatHistory !== false;
    const clearInput = window.appSettings?.make?.clearInputAfterSend !== false;

    if (!keepHistory) {
      messagesEl.innerHTML = '';
    }

    removeEmptyState();
    addMessage('user', escapeHtml(prompt).replace(/\n/g, '<br>'));

    sending = true;
    sendBtn.classList.add('is-loading');
    sendBtn.disabled = true;
    composer?.classList.add('is-sending');
    if (clearInput) {
      promptEl.value = '';
      autoResize();
    }
    if (chatSub) chatSub.textContent = 'Отправка…';

    addThinking();

    try {
      const result = await window.api.sendMakePrompt(prompt);
      removeThinking();

      if (result.success) {
        const cls = result.submitted ? 'make-msg-ok' : '';
        addMessage(
          'assistant',
          `<span class="${cls}">${escapeHtml(result.message || 'Готово')}</span>
           <ul class="make-msg-steps">
             <li>Промпт сжат и передан в Figma Make</li>
             <li>Figma Desktop открывается с предзаполненным полем</li>
             <li>${result.submitted ? 'Submit нажат автоматически' : 'Нажмите Submit в Figma, если нужно'}</li>
           </ul>`,
          result.submitted ? 'Генерация запущена' : 'Ожидание Submit'
        );
        const log = document.getElementById('log-text');
        if (log) log.textContent = result.message;
      } else {
        addMessage('assistant', `<span class="make-msg-err">${escapeHtml(result.message || 'Ошибка')}</span>`);
      }
    } catch (err) {
      removeThinking();
      addMessage('assistant', `<span class="make-msg-err">${escapeHtml(err.message || 'Ошибка')}</span>`);
    } finally {
      sending = false;
      sendBtn.classList.remove('is-loading');
      composer?.classList.remove('is-sending');
      if (chatSub) chatSub.textContent = 'AI-прототипы из текста';
      updateSendState();
    }
  }

  window.api.onConfig((c) => {
    speechLang = c.settings?.make?.speechLanguage || 'ru-RU';
    syncMicAvailability();
  });

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  sendBtn.addEventListener('click', sendPrompt);

  promptEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });
}

window.initMakeIt = initMakeIt;
