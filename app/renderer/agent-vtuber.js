(function initAgentVtuber() {
  const EMOTION_LABELS = {
    neutral: 'Нейтральная',
    joy: 'Радость',
    anger: 'Гнев',
    thoughtful: 'Задумчивость',
    epiphany: 'Озарение',
  };

  const floatEl = document.getElementById('agent-vtuber-float');
  const fallback = document.getElementById('agent-vtuber-fallback');
  const emotionBadge = document.getElementById('agent-vtuber-emotion');
  const composerSlot = document.getElementById('agent-vtuber-composer-slot');
  const thoughtEl = document.getElementById('agent-vtuber-thought');
  const thoughtTextEl = document.getElementById('agent-vtuber-thought-text');
  const layoutRoot = document.querySelector('#page-agent .agent-layout');
  const chatRoot = document.querySelector('#page-agent .agent-chat');

  if (!floatEl || !layoutRoot) return;

  let emotionTimer = null;
  let musicDanceActive = false;
  let presenceMode = 'hero';
  let layoutRaf = 0;
  let idleBlinkTimer = null;

  fallback?.classList.add('hidden');

  function cfg() {
    return window.appSettings?.vtubeStudio || {};
  }

  function isEnabled() {
    return cfg().enabled === true;
  }

  function hasLive2dModel() {
    return cfg().enabled === true;
  }

  function canShowAvatar() {
    return isEnabled() && hasLive2dModel();
  }

  function isHeroSlotReady() {
    if (presenceMode !== 'hero') return true;
    const idle = document.getElementById('agent-messages')?.classList.contains('agent-messages--idle');
    if (!idle) return true;
    const anchor = document.getElementById('agent-vtuber-hero-anchor');
    if (anchor && idle) return anchor.getBoundingClientRect().height > 40;
    return Boolean(anchor);
  }

  function canAttemptLoad() {
    return canShowAvatar() && isHeroSlotReady();
  }

  async function refreshLive2d({ force = false, attempt = 0 } = {}) {
    if (!canShowAvatar()) {
      syncChatClasses();
      return false;
    }

    if (!window.AgentLive2d?.isReady?.()) {
      console.warn('[live2d] renderer libraries not loaded');
      syncChatClasses();
      return false;
    }

    if (!isHeroSlotReady()) {
      if (attempt < 30) {
        window.setTimeout(() => refreshLive2d({ force, attempt: attempt + 1 }), 120);
      }
      return false;
    }

    if (!force && window.AgentLive2d.isLoaded?.() && !window.AgentLive2d.needsRemount?.()) {
      syncChatClasses();
      window.AgentLive2d.relayout?.();
      return true;
    }

    const ok = await window.AgentLive2d.load(force || window.AgentLive2d.needsRemount?.());
    syncChatClasses();
    if (ok) return true;

    if (attempt < 4) {
      const err = window.AgentLive2d.getLastError?.();
      if (err) console.warn('[live2d] retry:', err);
      await new Promise((resolve) => window.setTimeout(resolve, 200 * (attempt + 1)));
      return refreshLive2d({ force: true, attempt: attempt + 1 });
    }
    return false;
  }

  function getStage() {
    return document.querySelector('#agent-vtuber-float .agent-vtuber-stage');
  }

  function detectEmotion(ctx) {
    const phase = ctx?.phase || 'response';
    if (phase === 'thinking') return 'thoughtful';
    if (phase === 'error' || ctx?.ok === false) return 'anger';

    const text = `${ctx?.assistantText || ''}\n${ctx?.meta || ''}`.toLowerCase();
    const user = String(ctx?.userText || '').toLowerCase();

    if (
      ctx?.direct === true
      || /taskcard|taskfile|нашёл|нашел|кандидат|озарен|ключевой вывод|главный вывод|инсайт/i.test(text)
    ) {
      return 'epiphany';
    }
    if (/ошибк|не удалось|нет доступа|отказ|невозможн|не могу|провал|не найдено/i.test(text)) {
      return 'anger';
    }
    if (/готово|успеш|отлично|супер|записал|вписал|собрал проект|мокап.*готов/i.test(text)) {
      return 'joy';
    }
    if (/черт|блин|не работ|опять|надоел|почему не/i.test(user)) {
      return 'anger';
    }
    if (/redmine · поиск файлов/i.test(text)) {
      return 'epiphany';
    }
    return 'neutral';
  }

  function paintEmotionBadge(emotion) {
    if (!emotionBadge) return;
    const key = EMOTION_LABELS[emotion] ? emotion : 'neutral';
    emotionBadge.dataset.emotion = key;
    emotionBadge.textContent = EMOTION_LABELS[key] || EMOTION_LABELS.neutral;
    floatEl.dataset.vtsEmotion = key === 'neutral' ? '' : key;
  }

  const EMOTION_MOTION_KEYS = ['joy', 'anger', 'thoughtful', 'epiphany'];
  let emotionMotionTimer = null;

  function triggerClickMotion() {
    floatEl.classList.remove('agent-vtuber-clicked');
    void floatEl.offsetWidth;
    floatEl.classList.add('agent-vtuber-clicked');
    window.setTimeout(() => floatEl.classList.remove('agent-vtuber-clicked'), 420);
  }

  function triggerEmotionMotion(key) {
    EMOTION_MOTION_KEYS.forEach((name) => {
      floatEl.classList.remove(`agent-vtuber-motion-${name}`);
    });
    if (emotionMotionTimer) {
      clearTimeout(emotionMotionTimer);
      emotionMotionTimer = null;
    }
    if (!EMOTION_MOTION_KEYS.includes(key)) return;

    void floatEl.offsetWidth;
    floatEl.classList.add(`agent-vtuber-motion-${key}`);

    if (key !== 'thoughtful') {
      emotionMotionTimer = window.setTimeout(() => {
        floatEl.classList.remove(`agent-vtuber-motion-${key}`);
        emotionMotionTimer = null;
      }, 920);
    }
  }

  function usesDockThinking() {
    return canShowAvatar() && presenceMode === 'composer';
  }

  function setThinkingStep(text) {
    if (!thoughtEl || !thoughtTextEl) return;
    const next = String(text || '').trim();
    if (!next) {
      thoughtEl.classList.add('hidden');
      thoughtTextEl.textContent = '';
      return;
    }
    thoughtTextEl.textContent = next;
    thoughtEl.classList.remove('hidden');
  }

  function clearThinking() {
    setThinkingStep('');
  }

  function syncChatClasses() {
    if (!chatRoot) return;
    const active = canShowAvatar();
    chatRoot.classList.toggle('agent-vtuber-active', active);
    chatRoot.classList.toggle('agent-vtuber-composer', active && presenceMode === 'composer');
    chatRoot.classList.toggle('agent-vtuber-hero', active && presenceMode === 'hero');
    chatRoot.classList.toggle('agent-vtuber-has-live2d', active && window.AgentLive2d?.isLoaded?.());
    if (active && window.AgentLive2d?.isLoaded?.()) {
      window.AgentLive2d?.relayout?.();
    }
  }

  function startIdleLife() {
    stopIdleLife();
    if (!canShowAvatar() || presenceMode === 'hero') return;
    floatEl.classList.add('is-alive');
    const scheduleBlink = () => {
      idleBlinkTimer = window.setTimeout(() => {
        floatEl.classList.add('is-blinking');
        window.setTimeout(() => {
          floatEl.classList.remove('is-blinking');
          scheduleBlink();
        }, 160);
      }, 2200 + Math.random() * 2800);
    };
    scheduleBlink();
  }

  function stopIdleLife() {
    floatEl.classList.remove('is-alive', 'is-blinking');
    if (idleBlinkTimer) {
      clearTimeout(idleBlinkTimer);
      idleBlinkTimer = null;
    }
  }

  function applyFloatVisibility() {
    const show = isEnabled() && cfg().showDock !== false && hasLive2dModel();
    floatEl.classList.toggle('hidden', !show);
    floatEl.setAttribute('aria-hidden', show ? 'false' : 'true');
    fallback?.classList.toggle('hidden', !show || canShowAvatar());
    syncChatClasses();
    if (show) {
      if (presenceMode !== 'hero') startIdleLife();
      scheduleLayout();
      window.AgentLive2d?.scheduleLoad?.('visibility');
    } else {
      stopIdleLife();
      window.AgentLive2d?.destroy?.();
    }
  }

  function scheduleLayout() {
    if (layoutRaf) cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      layoutFloat(presenceMode);
      if (canShowAvatar()) {
        window.AgentLive2d?.relayout?.();
        if (!window.AgentLive2d?.isLoaded?.() && canAttemptLoad()) {
          refreshLive2d({ force: true });
        }
      }
    });
  }

  function hookAgentPageActivation() {
    const page = document.getElementById('page-agent');
    if (!page || page.dataset.live2dHook) return;
    page.dataset.live2dHook = '1';
    const onPageActive = () => {
      if (!canShowAvatar()) return;
      window.requestAnimationFrame(() => {
        scheduleLayout();
        refreshLive2d({ force: !window.AgentLive2d?.isLoaded?.() });
      });
    };
    const observer = new MutationObserver(onPageActive);
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
    onPageActive();
  }

  function hookHeroAnchor() {
    const messagesEl = document.getElementById('agent-messages');
    if (!messagesEl || messagesEl.dataset.live2dHeroHook) return;
    messagesEl.dataset.live2dHeroHook = '1';
    const observer = new MutationObserver((mutations) => {
      const anchorReplaced = mutations.some((mutation) => {
        if (mutation.type !== 'childList') return false;
        return [...mutation.addedNodes].some((node) => {
          if (!(node instanceof Element)) return false;
          return node.id === 'agent-vtuber-hero-anchor'
            || Boolean(node.querySelector?.('#agent-vtuber-hero-anchor'));
        });
      });
      if (!anchorReplaced) return;
      scheduleLayout();
      if (canShowAvatar()) {
        window.AgentLive2d?.scheduleLoad?.('hero-anchor');
        if (window.AgentLive2d?.needsRemount?.()) {
          refreshLive2d({ force: true });
        }
      }
    });
    observer.observe(messagesEl, { childList: true, subtree: true });
  }

  function mountFloat(mode) {
    if (mode === 'hero') {
      composerSlot?.classList.add('hidden');
      composerSlot?.setAttribute('aria-hidden', 'true');
      clearThinking();
      floatEl.style.left = '';
      floatEl.style.top = '';
      floatEl.style.bottom = '';
      const anchor = document.getElementById('agent-vtuber-hero-anchor');
      if (anchor) {
        floatEl.classList.remove('is-pending-hero');
        if (floatEl.parentElement !== anchor) anchor.appendChild(floatEl);
        floatEl.style.width = '100%';
        floatEl.style.height = '100%';
      } else {
        floatEl.classList.add('is-pending-hero');
        floatEl.style.width = '';
        floatEl.style.height = '';
        if (floatEl.parentElement !== layoutRoot) layoutRoot.appendChild(floatEl);
      }
      return true;
    }

    floatEl.classList.remove('is-pending-hero');
    composerSlot?.classList.remove('hidden');
    composerSlot?.setAttribute('aria-hidden', 'false');
    if (composerSlot && floatEl.parentElement !== composerSlot) {
      composerSlot.appendChild(floatEl);
    }
    floatEl.style.left = '';
    floatEl.style.top = '';
    floatEl.style.bottom = '';
    floatEl.style.width = '';
    floatEl.style.height = '';
    return true;
  }

  function layoutFloat(mode = presenceMode) {
    if (!canShowAvatar() || floatEl.classList.contains('hidden')) return;

    presenceMode = mode === 'composer' || mode === 'corner' ? 'composer' : 'hero';
    floatEl.dataset.mode = presenceMode;
    syncChatClasses();
    mountFloat(presenceMode);
  }

  function setPresenceMode(mode, { animate = true } = {}) {
    if (!canShowAvatar()) return;
    const next = mode === 'composer' || mode === 'corner' ? 'composer' : 'hero';
    if (next === presenceMode && floatEl.dataset.mode === next) {
      scheduleLayout();
      return;
    }
    if (animate) floatEl.classList.add('is-moving');
    presenceMode = next;
    if (next === 'hero') stopIdleLife();
    else startIdleLife();
    layoutFloat(presenceMode);
    if (canShowAvatar()) {
      window.AgentLive2d?.scheduleLoad?.(`presence-${next}`);
      if (next === 'composer') {
        window.requestAnimationFrame(() => {
          window.AgentLive2d?.relayout?.();
          if (window.AgentLive2d?.needsRemount?.()) {
            refreshLive2d({ force: true });
          }
        });
      }
    }
    window.setTimeout(() => floatEl.classList.remove('is-moving'), 900);
  }

  function setEmotion(emotion, { autoRevertMs = 0 } = {}) {
    const key = EMOTION_LABELS[emotion] ? emotion : 'neutral';
    paintEmotionBadge(key);
    triggerEmotionMotion(key);
    window.AgentLive2d?.playEmotion?.(key, cfg().emotions || {}, {
      revertMs: autoRevertMs,
    });

    if (emotionTimer) clearTimeout(emotionTimer);
    if (autoRevertMs > 0 && key !== 'neutral' && key !== 'thoughtful') {
      emotionTimer = setTimeout(() => setEmotion('neutral'), autoRevertMs);
    }
  }

  function onThinking() {
    stopMusicDance({ revertEmotion: false });
    setPresenceMode('composer', { animate: false });
    setEmotion('thoughtful');
    clearThinking();
  }

  function startMusicDance(ctx = {}) {
    if (!canShowAvatar()) return;
    musicDanceActive = true;
    if (emotionTimer) {
      clearTimeout(emotionTimer);
      emotionTimer = null;
    }
    setPresenceMode('composer', { animate: false });
    clearThinking();
    paintEmotionBadge('joy');
    floatEl.dataset.vtsEmotion = 'joy';
    floatEl.classList.add('is-dancing');
    EMOTION_MOTION_KEYS.forEach((name) => {
      floatEl.classList.remove(`agent-vtuber-motion-${name}`);
    });
    window.AgentLive2d?.startMusicDance?.(ctx);
  }

  function stopMusicDance({ revertEmotion = true } = {}) {
    if (!musicDanceActive && !floatEl.classList.contains('is-dancing')) return;
    musicDanceActive = false;
    floatEl.classList.remove('is-dancing');
    window.AgentLive2d?.stopMusicDance?.();
    if (revertEmotion) {
      setEmotion('neutral');
    } else {
      paintEmotionBadge('neutral');
      floatEl.dataset.vtsEmotion = '';
    }
  }

  function onAssistantResponse(ctx) {
    setPresenceMode('composer', { animate: false });
    clearThinking();
    if (ctx?.musicPlaying) {
      startMusicDance(ctx);
      return;
    }
    stopMusicDance({ revertEmotion: false });
    const emotion = detectEmotion({ ...ctx, phase: 'response' });
    setEmotion(emotion, { autoRevertMs: emotion === 'thoughtful' ? 0 : 12000 });
  }

  function onError() {
    setPresenceMode('composer', { animate: false });
    setEmotion('anger', { autoRevertMs: 8000 });
  }

  function onChatIdle() {
    stopMusicDance({ revertEmotion: false });
    setPresenceMode('hero', { animate: true });
    setEmotion('neutral');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => refreshLive2d({ force: false }));
    });
  }

  function onChatActive({ animate = false } = {}) {
    setPresenceMode('composer', { animate });
    if (window.AgentLive2d?.needsRemount?.()) {
      refreshLive2d({ force: true });
    }
  }

  window.AgentVtuber = {
    setEmotion,
    setPresenceMode,
    onThinking,
    onAssistantResponse,
    onError,
    onChatIdle,
    onChatActive,
    startMusicDance,
    stopMusicDance,
    isMusicDancing: () => musicDanceActive,
    setThinkingStep,
    clearThinking,
    usesDockThinking,
    relayout: scheduleLayout,
    refreshLive2d,
    detectEmotion,
    refresh: applyFloatVisibility,
    syncChatClasses,
  };

  window.addEventListener('resize', scheduleLayout);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && canShowAvatar()) {
      refreshLive2d({ force: !window.AgentLive2d?.isLoaded?.() });
      scheduleLayout();
    }
  });

  const observer = new ResizeObserver(scheduleLayout);
  observer.observe(layoutRoot);
  const messagesEl = document.getElementById('agent-messages');
  if (messagesEl) observer.observe(messagesEl);
  const dockEl = document.querySelector('#page-agent .agent-dock');
  if (dockEl) observer.observe(dockEl);

  function bootstrapLive2d() {
    applyFloatVisibility();
    paintEmotionBadge('neutral');
    scheduleLayout();
    if (!canShowAvatar()) return;
    window.requestAnimationFrame(() => {
      refreshLive2d({ force: !window.AgentLive2d?.isLoaded?.() || window.AgentLive2d?.needsRemount?.() });
    });
  }

  hookAgentPageActivation();
  hookHeroAnchor();

  window.addEventListener('app-settings-updated', () => {
    bootstrapLive2d();
  });

  window.addEventListener('agent-live2d-click', () => {
    if (!canShowAvatar()) return;
    triggerClickMotion();
  });

  if (window.appSettings?.vtubeStudio?.enabled) {
    bootstrapLive2d();
  } else {
    applyFloatVisibility();
    paintEmotionBadge('neutral');
  }
})();
