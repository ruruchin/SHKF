(function initAgentLive2d() {
  const PIXI = window.PIXI;
  const live2d = PIXI?.live2d;
  const Live2DModel = live2d?.Live2DModel;

  try {
    live2d?.startUpCubism4?.({ logFunction: () => {} });
    if (Live2DModel && PIXI?.Ticker) Live2DModel.registerTicker(PIXI.Ticker);
  } catch (err) {
    console.warn('[live2d] Cubism init:', err?.message || err);
  }

  let app = null;
  let model = null;
  let stageEl = null;
  let loading = false;
  let loadingSince = 0;
  let loadGen = 0;
  let loadedUrl = '';
  let idleMotionRef = '';
  let costumeRef = '';
  let costumeParams = null;
  let costumeUpdateFn = null;
  let emotionTimer = null;
  let expressionParams = [];
  let expressionParamIds = [];
  let pulseParams = {};
  let pulseAnimRaf = null;
  let pulseHold = false;

  const EMOTION_PROFILES = {
    neutral: { expressions: [], pulse: null, motion: 'neutral' },
    joy: {
      expressions: ['smile.exp3.json', 'fx_1_heart.exp3.json', 'blush.exp3.json'],
      pulse: {
        duration: 720,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleY: 0, ParamBodyAngleY: 0 } },
          { t: 0.22, params: { ParamAngleX: 7, ParamAngleY: -5, ParamBodyAngleY: 4 } },
          { t: 0.48, params: { ParamAngleX: -4, ParamAngleY: -2, ParamBodyAngleY: 1 } },
          { t: 1, params: { ParamAngleX: 0, ParamAngleY: 0, ParamBodyAngleY: 0 } },
        ],
      },
      motion: 'joy',
    },
    anger: {
      expressions: ['angry.exp3.json', 'fx_13_angry.exp3.json'],
      pulse: {
        duration: 540,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleY: 0 } },
          { t: 0.14, params: { ParamAngleX: -15, ParamAngleY: 6 } },
          { t: 0.32, params: { ParamAngleX: 13, ParamAngleY: 5 } },
          { t: 0.52, params: { ParamAngleX: -9, ParamAngleY: 4 } },
          { t: 0.72, params: { ParamAngleX: 7, ParamAngleY: 2 } },
          { t: 1, params: { ParamAngleX: 0, ParamAngleY: 0 } },
        ],
      },
      motion: 'anger',
    },
    thoughtful: {
      expressions: ['jitome.exp3.json', 'fx_7_question.exp3.json'],
      pulse: {
        duration: 880,
        hold: true,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleY: 0, ParamBodyAngleX: 0 } },
          { t: 0.4, params: { ParamAngleX: 9, ParamAngleY: -11, ParamBodyAngleX: 5 } },
          { t: 1, params: { ParamAngleX: 7, ParamAngleY: -9, ParamBodyAngleX: 4 } },
        ],
      },
      motion: 'thoughtful',
    },
    epiphany: {
      expressions: ['surprised.exp3.json', 'fx_11_star.exp3.json', 'fx_8_exclamation.exp3.json'],
      pulse: {
        duration: 500,
        keyframes: [
          { t: 0, params: { ParamAngleY: 0, ParamBodyAngleX: 0, ParamAngleZ: 0 } },
          { t: 0.28, params: { ParamAngleY: -14, ParamBodyAngleX: 6, ParamAngleZ: -4 } },
          { t: 0.55, params: { ParamAngleY: -7, ParamBodyAngleX: 3, ParamAngleZ: -1 } },
          { t: 1, params: { ParamAngleY: 0, ParamBodyAngleX: 0, ParamAngleZ: 0 } },
        ],
      },
      motion: 'epiphany',
    },
  };
  let lastError = '';
  let clickReactionBusy = false;
  let lastClickAt = 0;
  let clickReactionIndex = 0;
  let blinkEyeOpen = 1;
  let blinkBusy = false;
  let blinkAnimRaf = 0;
  let idleBlinkTimer = 0;
  let idleAnticTimer = 0;
  let idleAnticBusy = false;
  let lastAnticId = '';
  let stageMotionTimer = 0;

  const STAGE_MOTION_CLASSES = [
    'goof-bounce',
    'goof-wink',
    'goof-shake',
    'goof-peek',
    'goof-pop',
    'goof-sway',
  ];

  const IDLE_ANTICS = [
    {
      id: 'cheeky-wink',
      expressions: ['wink_L.exp3.json', 'smile.exp3.json', 'blush.exp3.json'],
      pulse: {
        duration: 680,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleY: 0, ParamBodyAngleY: 0 } },
          { t: 0.3, params: { ParamAngleX: 10, ParamAngleY: -6, ParamBodyAngleY: 5 } },
          { t: 0.62, params: { ParamAngleX: -4, ParamAngleY: -2, ParamBodyAngleY: 1 } },
          { t: 1, params: { ParamAngleX: 0, ParamAngleY: 0, ParamBodyAngleY: 0 } },
        ],
      },
      stageMotion: 'goof-wink',
      motionMs: 760,
      holdMs: 1900,
    },
    {
      id: 'heart-flutter',
      expressions: ['smile.exp3.json', 'fx_1_heart.exp3.json', 'blush.exp3.json'],
      pulse: {
        duration: 860,
        keyframes: [
          { t: 0, params: { ParamAngleY: 0, ParamBodyAngleY: 0 } },
          { t: 0.24, params: { ParamAngleY: -8, ParamBodyAngleY: 4 } },
          { t: 0.52, params: { ParamAngleY: -3, ParamBodyAngleY: 1 } },
          { t: 1, params: { ParamAngleY: 0, ParamBodyAngleY: 0 } },
        ],
      },
      stageMotion: 'goof-bounce',
      motionMs: 900,
      holdMs: 2200,
    },
    {
      id: 'musical-note',
      expressions: ['smile.exp3.json', 'fx_3_note.exp3.json', 'blush.exp3.json'],
      pulse: {
        duration: 920,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamBodyAngleX: 0 } },
          { t: 0.25, params: { ParamAngleX: -8, ParamBodyAngleX: -4 } },
          { t: 0.55, params: { ParamAngleX: 9, ParamBodyAngleX: 4 } },
          { t: 1, params: { ParamAngleX: 0, ParamBodyAngleX: 0 } },
        ],
      },
      stageMotion: 'goof-sway',
      motionMs: 980,
      holdMs: 2100,
    },
    {
      id: 'star-pop',
      expressions: ['surprised.exp3.json', 'fx_11_star.exp3.json', 'smile.exp3.json'],
      pulse: {
        duration: 620,
        keyframes: [
          { t: 0, params: { ParamAngleY: 0, ParamAngleZ: 0 } },
          { t: 0.28, params: { ParamAngleY: -12, ParamAngleZ: -3 } },
          { t: 1, params: { ParamAngleY: 0, ParamAngleZ: 0 } },
        ],
      },
      stageMotion: 'goof-pop',
      motionMs: 680,
      holdMs: 1800,
    },
    {
      id: 'silly-peek',
      expressions: ['jitome.exp3.json', 'fx_7_question.exp3.json', 'smile.exp3.json'],
      pulse: {
        duration: 980,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleY: 0 } },
          { t: 0.35, params: { ParamAngleX: 14, ParamAngleY: -8 } },
          { t: 0.7, params: { ParamAngleX: -10, ParamAngleY: -4 } },
          { t: 1, params: { ParamAngleX: 0, ParamAngleY: 0 } },
        ],
      },
      stageMotion: 'goof-peek',
      motionMs: 1020,
      holdMs: 2300,
    },
    {
      id: 'hyper-shake',
      expressions: ['wink_R.exp3.json', 'fx_8_exclamation.exp3.json', 'smile.exp3.json'],
      pulse: {
        duration: 560,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamAngleZ: 0 } },
          { t: 0.16, params: { ParamAngleX: -11, ParamAngleZ: -4 } },
          { t: 0.32, params: { ParamAngleX: 12, ParamAngleZ: 4 } },
          { t: 0.48, params: { ParamAngleX: -8, ParamAngleZ: -2 } },
          { t: 0.64, params: { ParamAngleX: 7, ParamAngleZ: 2 } },
          { t: 1, params: { ParamAngleX: 0, ParamAngleZ: 0 } },
        ],
      },
      stageMotion: 'goof-shake',
      motionMs: 620,
      holdMs: 1700,
    },
    {
      id: 'double-tease',
      expressions: ['wink_R.exp3.json', 'wink_L.exp3.json', 'smile.exp3.json', 'blush.exp3.json'],
      pulse: {
        duration: 760,
        keyframes: [
          { t: 0, params: { ParamAngleX: 0, ParamBodyAngleY: 0 } },
          { t: 0.2, params: { ParamAngleX: -7, ParamBodyAngleY: 3 } },
          { t: 0.45, params: { ParamAngleX: 8, ParamBodyAngleY: 4 } },
          { t: 1, params: { ParamAngleX: 0, ParamBodyAngleY: 0 } },
        ],
      },
      stageMotion: 'goof-wink',
      motionMs: 820,
      holdMs: 2000,
    },
  ];

  const CLICK_REACTIONS = [
    {
      expressions: ['wink_L.exp3.json', 'smile.exp3.json', 'blush.exp3.json'],
    },
    {
      expressions: ['smile.exp3.json', 'fx_1_heart.exp3.json', 'blush.exp3.json'],
    },
    {
      expressions: ['wink_R.exp3.json', 'smile.exp3.json', 'fx_1_heart.exp3.json'],
    },
    {
      expressions: ['smile.exp3.json', 'fx_3_note.exp3.json', 'blush.exp3.json'],
    },
  ];

  const FACE_NEUTRAL_DEFAULTS = {
    Param3: 1,
    Param80: 0,
    Param81: 0,
    Param82: 0,
    ParamMouthOpenY: 0,
    ParamMouthForm: 0,
    ParamEyeLOpen: 1,
    ParamEyeROpen: 1,
    ParamBrowLY: 0,
    ParamBrowRY: 0,
  };

  function setError(message) {
    lastError = String(message || '').trim();
    if (lastError) console.warn('[live2d]', lastError);
  }

  function ready() {
    return Boolean(
      window.Live2DCubismCore
      && PIXI
      && Live2DModel
      && window.api?.live2dGetModel,
    );
  }

  function getAvatarHost() {
    return document.getElementById('agent-live2d-host');
  }

  function getVisibleStage() {
    const idle = document.getElementById('agent-messages')?.classList.contains('agent-messages--idle');
    if (idle) {
      const heroStage = document.querySelector(
        '#agent-vtuber-hero-anchor #agent-vtuber-float:not(.hidden):not(.is-pending-hero) .agent-vtuber-stage',
      );
      if (heroStage) return heroStage;
      return document.getElementById('agent-vtuber-hero-anchor') || null;
    }
    const composerStage = document.querySelector(
      '#agent-vtuber-composer-slot:not(.hidden) .agent-vtuber-stage',
    );
    if (composerStage) return composerStage;
    return null;
  }

  function getLoadStage() {
    return getVisibleStage() || getAvatarHost();
  }

  function getStage() {
    return getVisibleStage();
  }

  function needsRemount() {
    const stage = getLoadStage();
    if (!stage) return false;
    if (!model || !app || !stageEl) return true;
    if (stageEl !== stage) return true;
    if (!stageEl.isConnected) return true;
    return !stageEl.querySelector('.agent-live2d-canvas');
  }

  function shouldAutoLoad() {
    const cfg = window.appSettings?.vtubeStudio;
    return cfg?.enabled === true && Boolean(String(cfg?.live2dModelPath || '').trim());
  }

  let loadFlight = null;
  let scheduleTimer = 0;

  function isLoadStale(gen) {
    return gen !== loadGen;
  }

  function pruneInactiveStages() {
    document.querySelectorAll('.agent-live2d-canvas').forEach((canvas) => {
      const host = canvas.parentElement;
      if (!host || host === stageEl) return;
      canvas.remove();
      host.classList.remove('agent-live2d-ready');
    });
  }

  function scheduleLoad(reason = '') {
    if (!shouldAutoLoad() || !ready()) return;
    const stage = getLoadStage();
    if (!stage) return;
    if (model && loadedUrl && stageEl === stage && stageEl.isConnected) return;
    if (loadFlight) return;
    if (scheduleTimer) window.clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(() => {
      scheduleTimer = 0;
      const currentStage = getLoadStage();
      if (!currentStage) return;
      if (model && loadedUrl && stageEl === currentStage && stageEl.isConnected) return;
      load(needsRemount());
    }, 300);
  }

  function paintStageError(message = '') {
    const stage = getStage();
    if (!stage) return;
    let badge = stage.querySelector('.agent-live2d-error');
    if (!message) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'agent-live2d-error';
      stage.appendChild(badge);
    }
    badge.textContent = message;
  }

  function cleanupStage(stage) {
    if (!stage) return;
    unbindStageClick(stage);
    stage.querySelectorAll('.agent-live2d-canvas').forEach((node) => node.remove());
    stage.classList.remove('agent-live2d-ready');
  }

  function isThinkingActive() {
    const thoughtEl = document.getElementById('agent-vtuber-thought');
    return Boolean(thoughtEl && !thoughtEl.classList.contains('hidden'));
  }

  function restoreAfterClickReaction() {
    clickReactionBusy = false;
    if (isThinkingActive()) {
      playEmotion('thoughtful');
      return;
    }
    playEmotion('neutral');
  }

  function onStagePointerDown(event) {
    if (!model || clickReactionBusy) return;
    if (event.button !== 0) return;

    const canvas = stageEl?.querySelector('.agent-live2d-canvas');
    if (!canvas || !stageEl?.classList.contains('agent-live2d-ready')) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < rect.width * 0.06 || x > rect.width * 0.94) return;
    if (y < rect.height * 0.04 || y > rect.height * 0.98) return;

    event.preventDefault();
    event.stopPropagation();
    playClickReaction();
  }

  function bindStageClick(stage) {
    if (!stage) return;
    unbindStageClick(stage);
    stage.__live2dClickHandler = onStagePointerDown;
    stage.addEventListener('pointerdown', onStagePointerDown);
  }

  function unbindStageClick(stage) {
    if (!stage?.__live2dClickHandler) return;
    stage.removeEventListener('pointerdown', stage.__live2dClickHandler);
    stage.__live2dClickHandler = null;
  }

  async function playClickReaction() {
    if (!model || clickReactionBusy) return;

    const now = Date.now();
    if (now - lastClickAt < 650) return;
    lastClickAt = now;
    clickReactionBusy = true;

    if (emotionTimer) {
      clearTimeout(emotionTimer);
      emotionTimer = null;
    }

    const reaction = CLICK_REACTIONS[clickReactionIndex % CLICK_REACTIONS.length];
    clickReactionIndex += 1;

    try {
      await applyEmotionExpressions(reaction.expressions);
      playIdle();
      app?.render?.();
      window.dispatchEvent(new CustomEvent('agent-live2d-click'));
      emotionTimer = window.setTimeout(restoreAfterClickReaction, 2200);
    } catch (err) {
      console.warn('[live2d] click reaction:', err?.message || err);
      restoreAfterClickReaction();
    }
  }

  function detachModel() {
    if (!model) return;
    unbindCostumePersist();
    try {
      if (model.parent) model.parent.removeChild(model);
      model.destroy({ children: true });
    } catch { /* */ }
    model = null;
  }

  async function resetRenderer() {
    cancelEmotionPulse();
    clickReactionBusy = false;
    stopIdleBlink();
    stopIdleAntics();
    if (blinkAnimRaf) {
      cancelAnimationFrame(blinkAnimRaf);
      blinkAnimRaf = 0;
    }
    blinkBusy = false;
    blinkEyeOpen = 1;
    idleAnticBusy = false;
    if (stageMotionTimer) {
      window.clearTimeout(stageMotionTimer);
      stageMotionTimer = 0;
    }
    const float = document.getElementById('agent-vtuber-float');
    if (float) {
      STAGE_MOTION_CLASSES.forEach((name) => {
        float.classList.remove(`agent-vtuber-motion-${name}`);
      });
    }
    if (emotionTimer) {
      clearTimeout(emotionTimer);
      emotionTimer = null;
    }
    detachModel();
    if (app) {
      try {
        app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
      } catch { /* */ }
      app = null;
    }
    cleanupStage(stageEl);
    loadedUrl = '';
    idleMotionRef = '';
    costumeRef = '';
  }

  async function destroy() {
    loadGen += 1;
    paintStageError('');
    const cached = brandAvatarSrc;
    await resetRenderer();
    if (cached) applyBrandAvatars(cached);
  }

  function resizeRenderer() {
    if (!app?.renderer || !stageEl) return;
    const w = Math.max(1, stageEl.clientWidth);
    const h = Math.max(1, stageEl.clientHeight);
    app.renderer.resize(w, h);
  }

  async function ensureApp(stage) {
    if (app && stageEl === stage) {
      resizeRenderer();
      return app;
    }

    await resetRenderer();
    stageEl = stage;
    cleanupStage(stage);

    const canvas = document.createElement('canvas');
    canvas.className = 'agent-live2d-canvas';
    stage.appendChild(canvas);

    app = new PIXI.Application({
      view: canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      resizeTo: stage,
    });

    if (!app?.stage) {
      app = null;
      throw new Error('Pixi Application не инициализировался');
    }

    resizeRenderer();
    if (!stage.__live2dResizeObs) {
      stage.__live2dResizeObs = new ResizeObserver(() => {
        if (model && stageEl === stage) fitModel();
      });
      stage.__live2dResizeObs.observe(stage);
    }
    return app;
  }

  async function waitForStageSize(stage, maxFrames = 60) {
    for (let i = 0; i < maxFrames; i += 1) {
      if (stage.clientWidth >= 48 && stage.clientHeight >= 48) return true;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return stage.clientWidth > 0 && stage.clientHeight > 0;
  }

  function isHeroStage() {
    return Boolean(stageEl?.closest('#agent-vtuber-hero-anchor'))
      || stageEl?.id === 'agent-vtuber-hero-anchor'
      || stageEl?.id === 'agent-live2d-host'
      || stageEl?.classList?.contains('agent-live2d-host');
  }

  function isComposerStage() {
    if (isHeroStage()) return false;
    return Boolean(stageEl?.closest('#agent-vtuber-composer-slot'));
  }

  function fitBust(scaleMul, { yFactor = 1.02, anchorY = 0.52, minHeadTop = 0.02 } = {}) {
    const w = Math.max(1, stageEl.clientWidth);
    const h = Math.max(1, stageEl.clientHeight);
    const bounds = model.getLocalBounds();
    let bw = Math.max(1, bounds.width);
    let bh = Math.max(1, bounds.height);
    if (bw <= 1 || bh <= 1) {
      bw = Math.max(1, model.width || model.internalModel?.width || 800);
      bh = Math.max(1, model.height || model.internalModel?.height || 1000);
    }
    const scale = (w / bw) * scaleMul;
    model.scale.set(scale);
    const scaledH = bh * scale;
    model.anchor.set(0.5, anchorY);
    model.x = w * 0.5;
    model.y = h * yFactor;
    const headTop = model.y - anchorY * scaledH;
    const headMargin = h * minHeadTop;
    if (headTop < headMargin) {
      model.y += headMargin - headTop;
    }
  }

  let brandAvatarSrc = '';
  const AGENT_AVATAR_FALLBACK = 'assets/agent/agent-avatar.png';
  const BRAND_AVATAR_CACHE_KEY = 'konstancia-brand-avatar-v1';
  const BRAND_AVATAR_RETRY_MS = [0, 120, 320, 640, 1200, 2200];

  function loadBrandAvatarCache() {
    try {
      const raw = localStorage.getItem(BRAND_AVATAR_CACHE_KEY) || '';
      return raw.startsWith('data:image/') ? raw : '';
    } catch {
      return '';
    }
  }

  function persistBrandAvatarCache(src) {
    if (!src?.startsWith('data:image/')) return;
    try {
      localStorage.setItem(BRAND_AVATAR_CACHE_KEY, src);
    } catch { /* quota */ }
  }

  function captureBrandAvatar(size = 128) {
    const srcCanvas = app?.view || stageEl?.querySelector('.agent-live2d-canvas');
    if (!model || !srcCanvas?.width || !srcCanvas?.height) return '';

    const sw = srcCanvas.width;
    const sh = srcCanvas.height;
    const cropW = sw * 0.72;
    const cropH = cropW * 1.05;
    const sx = (sw - cropW) / 2;
    const sy = Math.max(0, sh * 0.04);

    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(srcCanvas, sx, sy, cropW, cropH, 0, 0, size, size);
    try {
      return out.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  function applyBrandAvatars(src, { forceClear = false } = {}) {
    const effective = src || (!forceClear && brandAvatarSrc) || '';
    document.querySelectorAll('[data-agent-brand-avatar]').forEach((img) => {
      const slot = img.closest('.agent-brand-avatar, .agent-chat-avatar, .nav-item-avatar');
      if (effective) {
        img.src = effective;
        if (effective.startsWith('data:image/')) {
          img.dataset.live2d = '1';
          slot?.classList.add('agent-brand-avatar--live2d');
        } else {
          img.removeAttribute('data-live2d');
          slot?.classList.remove('agent-brand-avatar--live2d');
        }
      } else if (forceClear) {
        img.removeAttribute('data-live2d');
        img.removeAttribute('src');
        slot?.classList.remove('agent-brand-avatar--live2d');
      }
    });
    document.querySelector('.agent-chat-avatar')?.classList.toggle(
      'agent-chat-avatar--live2d',
      Boolean(effective && effective.startsWith('data:image/')),
    );
  }

  function syncBrandAvatars() {
    if (!model || !stageEl?.classList.contains('agent-live2d-ready')) {
      if (brandAvatarSrc) applyBrandAvatars(brandAvatarSrc);
      return brandAvatarSrc;
    }
    app?.render?.();
    const next = captureBrandAvatar(144);
    if (!next) {
      if (brandAvatarSrc) applyBrandAvatars(brandAvatarSrc);
      return brandAvatarSrc;
    }
    brandAvatarSrc = next;
    persistBrandAvatarCache(next);
    applyBrandAvatars(next);
    window.dispatchEvent(new CustomEvent('agent-brand-avatar-updated', { detail: { src: next } }));
    return next;
  }

  function scheduleBrandAvatarSync() {
    BRAND_AVATAR_RETRY_MS.forEach((delay) => {
      window.setTimeout(() => {
        syncBrandAvatars();
      }, delay);
    });
  }

  function clearBrandAvatars() {
    brandAvatarSrc = '';
    try {
      localStorage.removeItem(BRAND_AVATAR_CACHE_KEY);
    } catch { /* */ }
    applyBrandAvatars('', { forceClear: true });
  }

  brandAvatarSrc = loadBrandAvatarCache();
  if (brandAvatarSrc) {
    const bootBrandAvatar = () => applyBrandAvatars(brandAvatarSrc);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootBrandAvatar);
    } else {
      bootBrandAvatar();
    }
  }

  function getBrandAvatarSrc() {
    return brandAvatarSrc;
  }

  function fitModel() {
    if (!model || !stageEl) return;
    resizeRenderer();
    const w = Math.max(1, stageEl.clientWidth);
    const h = Math.max(1, stageEl.clientHeight);
    const bounds = model.getLocalBounds();
    let bw = Math.max(1, bounds.width);
    let bh = Math.max(1, bounds.height);
    if (bw <= 1 || bh <= 1) {
      bw = Math.max(1, model.width || model.internalModel?.width || 800);
      bh = Math.max(1, model.height || model.internalModel?.height || 1000);
    }

    if (isHeroStage()) {
      fitBust(2.65);
      scheduleBrandAvatarSync();
      return;
    }

    if (isComposerStage()) {
      fitBust(3.55, { yFactor: 1.24, anchorY: 0.96, minHeadTop: 0 });
      scheduleBrandAvatarSync();
      return;
    }

    const scale = Math.min(w / bw, h / bh) * 0.98;
    model.scale.set(scale);
    model.anchor.set(0.5, 1);
    model.x = w / 2;
    model.y = h - 4;
    scheduleBrandAvatarSync();
  }

  function motionEntries() {
    const settings = model?.internalModel?.settings;
    return settings?.motions || settings?.Motions || {};
  }

  function playMotionByRef(fileRef, { loop = false } = {}) {
    if (!model || !fileRef) return false;
    const target = String(fileRef).replace(/\\/g, '/').toLowerCase();
    const base = target.split('/').pop();

    for (const [group, entries] of Object.entries(motionEntries())) {
      const list = Array.isArray(entries) ? entries : [];
      const idx = list.findIndex((item) => {
        const file = String(item?.File || item?.file || item?.name || '').replace(/\\/g, '/').toLowerCase();
        return file === target || file.endsWith(`/${base}`) || file === base;
      });
      if (idx >= 0) {
        model.motion(group, idx, loop ? 3 : 2);
        return true;
      }
    }

    if (motionEntries()[fileRef]) {
      model.motion(fileRef, 0, loop ? 3 : 2);
      return true;
    }

    return false;
  }

  function playIdle() {
    if (idleMotionRef && playMotionByRef(idleMotionRef, { loop: true })) return;
    if (motionEntries().Idle) {
      model.motion('Idle', 0, 3);
    }
  }

  function modelAssetBaseUrl() {
    if (!loadedUrl) return '';
    return loadedUrl.replace(/[^/]+$/, '');
  }

  const COSTUME_PARAM_IDS = [
    'v0000_Param8',
    'v0052_Param3',
    'V0100Param44',
    'V0101_Param3',
    'Param28',
  ];

  function applyCostumeState() {
    if (!model || !costumeParams?.length) return;
    const core = model.internalModel?.coreModel;
    if (!core) return;
    for (const id of COSTUME_PARAM_IDS) {
      core.setParameterValueById(id, 0);
    }
    for (const param of costumeParams) {
      core.setParameterValueById(param.Id, Number(param.Value) || 0);
    }
  }

  function bindCostumePersist() {
    if (!model?.internalModel || costumeUpdateFn) return;
    const im = model.internalModel;
    const original = im.update.bind(im);
    costumeUpdateFn = original;
    im.update = function costumeAwareUpdate(m, now) {
      original(m, now);
      applyCostumeState();
      applyExpressionState();
      applyPulseState();
      applyBlinkState();
    };
  }

  function applyBlinkState() {
    const core = model?.internalModel?.coreModel;
    if (!core || blinkEyeOpen >= 0.999) return;
    core.setParameterValueById('ParamEyeLOpen', blinkEyeOpen);
    core.setParameterValueById('ParamEyeROpen', blinkEyeOpen);
  }

  function canIdleLife() {
    return Boolean(model?.internalModel?.coreModel)
      && !loading
      && !clickReactionBusy
      && !idleAnticBusy
      && !isThinkingActive()
      && !pulseHold;
  }

  function canIdleBlink() {
    return canIdleLife()
      && !blinkBusy
      && !pulseAnimRaf
      && !expressionParams.length;
  }

  function canIdleAntic() {
    return canIdleLife()
      && !blinkBusy
      && !pulseAnimRaf
      && !expressionParams.length;
  }

  function triggerStageMotion(key, ms = 900) {
    const float = document.getElementById('agent-vtuber-float');
    if (!float || !key) return;
    STAGE_MOTION_CLASSES.forEach((name) => {
      float.classList.remove(`agent-vtuber-motion-${name}`);
    });
    void float.offsetWidth;
    float.classList.add(`agent-vtuber-motion-${key}`);
    if (stageMotionTimer) window.clearTimeout(stageMotionTimer);
    stageMotionTimer = window.setTimeout(() => {
      float.classList.remove(`agent-vtuber-motion-${key}`);
      stageMotionTimer = 0;
    }, ms);
    window.dispatchEvent(new CustomEvent('agent-live2d-antic', { detail: { motion: key, ms } }));
  }

  function pulseBrandAvatarGoof() {
    document.querySelectorAll('.agent-brand-avatar').forEach((slot) => {
      slot.classList.remove('is-goofing');
      void slot.offsetWidth;
      slot.classList.add('is-goofing');
      window.setTimeout(() => slot.classList.remove('is-goofing'), 520);
    });
  }

  function pickRandomAntic() {
    if (IDLE_ANTICS.length <= 1) return IDLE_ANTICS[0];
    let pick = IDLE_ANTICS[0];
    for (let i = 0; i < 4; i += 1) {
      pick = IDLE_ANTICS[Math.floor(Math.random() * IDLE_ANTICS.length)];
      if (pick.id !== lastAnticId) break;
    }
    lastAnticId = pick.id;
    return pick;
  }

  function restoreAfterAntic() {
    idleAnticBusy = false;
    cancelEmotionPulse();
    clearExpression();
    playIdle();
    app?.render?.();
    if (isThinkingActive()) {
      playEmotion('thoughtful');
    }
  }

  async function playIdleAntic() {
    if (!canIdleAntic() || idleAnticBusy) return;
    idleAnticBusy = true;
    stopIdleBlink();

    const antic = pickRandomAntic();
    try {
      if (antic.stageMotion) triggerStageMotion(antic.stageMotion, antic.motionMs || 900);
      if (antic.expressions?.length) await applyEmotionExpressions(antic.expressions);
      if (antic.pulse) startEmotionPulse(antic.pulse);
      pulseBrandAvatarGoof();
      app?.render?.();
      await new Promise((resolve) => {
        window.setTimeout(resolve, antic.holdMs || 2000);
      });
    } catch (err) {
      console.warn('[live2d] idle antic:', err?.message || err);
    } finally {
      restoreAfterAntic();
      scheduleIdleBlink();
      scheduleIdleAntics();
    }
  }

  function scheduleIdleAntics() {
    stopIdleAntics();
    if (!shouldAutoLoad() || !model) return;
    const delay = 12000 + Math.random() * 20000;
    idleAnticTimer = window.setTimeout(async () => {
      idleAnticTimer = 0;
      if (canIdleAntic() && Math.random() < 0.72) {
        await playIdleAntic();
        return;
      }
      if (model) scheduleIdleAntics();
    }, delay);
  }

  function stopIdleAntics() {
    if (idleAnticTimer) {
      window.clearTimeout(idleAnticTimer);
      idleAnticTimer = 0;
    }
  }

  function pulseBrandAvatarBlink() {
    document.querySelectorAll('.agent-brand-avatar').forEach((slot) => {
      slot.classList.remove('is-blinking');
      void slot.offsetWidth;
      slot.classList.add('is-blinking');
      window.setTimeout(() => slot.classList.remove('is-blinking'), 180);
    });
  }

  function playBlink() {
    if (!model?.internalModel?.coreModel || blinkBusy) return Promise.resolve();
    blinkBusy = true;
    pulseBrandAvatarBlink();

    const closeMs = 70;
    const openMs = 90;
    const started = performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - started;
        if (elapsed <= closeMs) {
          blinkEyeOpen = 1 - (elapsed / closeMs);
        } else if (elapsed <= closeMs + openMs) {
          blinkEyeOpen = (elapsed - closeMs) / openMs;
        } else {
          blinkEyeOpen = 1;
          blinkBusy = false;
          blinkAnimRaf = 0;
          applyBlinkState();
          app?.render?.();
          resolve();
          return;
        }
        applyBlinkState();
        app?.render?.();
        blinkAnimRaf = requestAnimationFrame(tick);
      };
      blinkAnimRaf = requestAnimationFrame(tick);
    });
  }

  function scheduleIdleBlink() {
    stopIdleBlink();
    if (!shouldAutoLoad() || !model) return;
    const delay = 2400 + Math.random() * 3400;
    idleBlinkTimer = window.setTimeout(async () => {
      idleBlinkTimer = 0;
      if (canIdleBlink()) {
        await playBlink();
      }
      if (model) scheduleIdleBlink();
    }, delay);
  }

  function stopIdleBlink() {
    if (idleBlinkTimer) {
      window.clearTimeout(idleBlinkTimer);
      idleBlinkTimer = 0;
    }
  }

  function unbindCostumePersist() {
    if (model?.internalModel && costumeUpdateFn) {
      model.internalModel.update = costumeUpdateFn;
    }
    costumeUpdateFn = null;
    costumeParams = null;
  }

  async function applyCostume(ref = costumeRef, { resetOthers = true } = {}) {
    const file = String(ref || '').trim();
    if (!model || !file || !loadedUrl) return false;
    const rel = file.replace(/^animation[/\\]/, '');
    const url = `${modelAssetBaseUrl()}animation/${rel}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!model.internalModel?.coreModel) return false;
      costumeParams = Array.isArray(data.Parameters) ? data.Parameters : [];
      applyCostumeState();
      bindCostumePersist();
      costumeRef = file;
      app?.render?.();
      scheduleBrandAvatarSync();
      return true;
    } catch (err) {
      console.warn('[live2d] costume:', err?.message || err);
      return false;
    }
  }

  function clearExpression() {
    const core = model?.internalModel?.coreModel;
    if (!core) {
      expressionParams = [];
      expressionParamIds = [];
      return;
    }
    for (const id of expressionParamIds) {
      core.setParameterValueById(id, 0);
    }
    expressionParams = [];
    expressionParamIds = [];
    restoreNeutralFaceParams();
  }

  function restoreNeutralFaceParams() {
    const core = model?.internalModel?.coreModel;
    if (!core) return;
    for (const [id, value] of Object.entries(FACE_NEUTRAL_DEFAULTS)) {
      core.setParameterValueById(id, value);
    }
  }

  function applyExpressionState() {
    const core = model?.internalModel?.coreModel;
    if (!core || !expressionParams.length) return;
    for (const param of expressionParams) {
      const value = Number(param.Value);
      core.setParameterValueById(param.Id, Number.isFinite(value) ? value : 0);
    }
    const mouthHidden = expressionParams.some(
      (param) => param.Id === 'Param3' && Number(param.Value) < 0,
    );
    if (!mouthHidden) {
      core.setParameterValueById('Param3', 1);
    }
  }

  function applyPulseState() {
    const core = model?.internalModel?.coreModel;
    if (!core || !Object.keys(pulseParams).length) return;
    for (const [id, value] of Object.entries(pulseParams)) {
      core.setParameterValueById(id, value);
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpParams(from = {}, to = {}, t) {
    const ids = new Set([...Object.keys(from), ...Object.keys(to)]);
    const out = {};
    for (const id of ids) {
      out[id] = lerp(Number(from[id]) || 0, Number(to[id]) || 0, t);
    }
    return out;
  }

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function samplePulseKeyframes(keyframes, progress) {
    if (!keyframes?.length) return {};
    if (progress <= keyframes[0].t) return { ...keyframes[0].params };
    const last = keyframes[keyframes.length - 1];
    if (progress >= last.t) return { ...last.params };
    for (let i = 0; i < keyframes.length - 1; i += 1) {
      const a = keyframes[i];
      const b = keyframes[i + 1];
      if (progress >= a.t && progress <= b.t) {
        const span = b.t - a.t || 1;
        const localT = easeOutCubic((progress - a.t) / span);
        return lerpParams(a.params, b.params, localT);
      }
    }
    return { ...last.params };
  }

  function cancelEmotionPulse() {
    if (pulseAnimRaf) {
      cancelAnimationFrame(pulseAnimRaf);
      pulseAnimRaf = null;
    }
    pulseParams = {};
    pulseHold = false;
  }

  function startEmotionPulse(pulseConfig) {
    cancelEmotionPulse();
    if (!pulseConfig || !model) return;

    const { duration, keyframes, hold } = pulseConfig;
    pulseHold = Boolean(hold);
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      pulseParams = samplePulseKeyframes(keyframes, progress);
      app?.render?.();
      if (progress < 1) {
        pulseAnimRaf = requestAnimationFrame(tick);
        return;
      }
      pulseAnimRaf = null;
      if (!pulseHold) pulseParams = {};
    };

    pulseAnimRaf = requestAnimationFrame(tick);
  }

  async function applyEmotionExpressions(refs = []) {
    const files = refs.map((ref) => String(ref || '').trim()).filter(Boolean);
    if (!model || !loadedUrl) return false;
    clearExpression();
    if (!files.length) {
      app?.render?.();
      return true;
    }

    const merged = new Map();
    for (const ref of files) {
      const rel = ref.replace(/^animation[/\\]/, '');
      const url = `${modelAssetBaseUrl()}animation/${rel}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        for (const param of data.Parameters || []) {
          merged.set(param.Id, param);
        }
      } catch (err) {
        console.warn('[live2d] expression layer:', ref, err?.message || err);
      }
    }

    if (!merged.size) return false;
    expressionParams = [...merged.values()];
    expressionParamIds = [...merged.keys()];
    applyExpressionState();
    app?.render?.();
    return true;
  }

  async function applyExpression(ref = '') {
    const file = String(ref || '').trim();
    if (!model || !file || !loadedUrl) return false;
    const rel = file.replace(/^animation[/\\]/, '');
    const url = `${modelAssetBaseUrl()}animation/${rel}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!model.internalModel?.coreModel) return false;
      clearExpression();
      expressionParams = Array.isArray(data.Parameters) ? data.Parameters : [];
      expressionParamIds = expressionParams.map((param) => param.Id);
      applyExpressionState();
      app?.render?.();
      return true;
    } catch (err) {
      console.warn('[live2d] expression:', err?.message || err);
      return false;
    }
  }

  function resolveEmotionRef(key, emotionsMap = {}) {
    return String(emotionsMap?.[key] || '').trim();
  }

  function getEmotionProfile(key) {
    return EMOTION_PROFILES[key] || EMOTION_PROFILES.neutral;
  }

  function isExpressionRef(ref) {
    return /\.exp3\.json$/i.test(String(ref || ''));
  }

  function preferredCostumeRef(info) {
    return String(
      info?.costume
      || window.appSettings?.vtubeStudio?.live2dCostume
      || '',
    ).trim();
  }

  function playEmotion(emotion, emotionsMap = {}, { revertMs = 0 } = {}) {
    if (!model) return;

    const key = String(emotion || 'neutral').trim().toLowerCase();
    const customRef = resolveEmotionRef(key, emotionsMap);
    const profile = getEmotionProfile(key);

    if (emotionTimer) clearTimeout(emotionTimer);

    const run = async () => {
      if (key === 'neutral') {
        cancelEmotionPulse();
        clearExpression();
        playIdle();
        app?.render?.();
        return;
      }

      if (customRef && isExpressionRef(customRef)) {
        await applyExpression(customRef);
      } else if (customRef) {
        cancelEmotionPulse();
        clearExpression();
        const played = playMotionByRef(customRef)
          || playMotionByRef(customRef.replace(/\.motion3\.json$/i, ''));
        if (!played && motionEntries()[customRef]) {
          model.motion(customRef, 0, 2);
        }
        app?.render?.();
        return;
      } else if (profile.expressions.length) {
        await applyEmotionExpressions(profile.expressions);
      } else {
        clearExpression();
      }

      startEmotionPulse(profile.pulse);
      playIdle();
      app?.render?.();
    };

    run().catch((err) => {
      console.warn('[live2d] playEmotion:', err?.message || err);
    });

    if (revertMs > 0) {
      emotionTimer = window.setTimeout(() => {
        playEmotion('neutral', emotionsMap);
      }, revertMs);
    }
  }

  async function load(force = false) {
    if (!ready()) {
      setError('Библиотеки Live2D не загрузились — перезапустите приложение');
      paintStageError(lastError);
      return false;
    }
    if (!force && model && loadedUrl) {
      const stage = getLoadStage();
      if (stage && stageEl === stage && stageEl.isConnected) {
        fitModel();
        bindStageClick(stage);
        scheduleIdleBlink();
        scheduleIdleAntics();
        return true;
      }
    }
    if (loadFlight) return loadFlight;

    loadFlight = (async () => {
      if (loading) {
        if (Date.now() - loadingSince > 50000) {
          loading = false;
        } else {
          while (loading) {
            await new Promise((resolve) => window.setTimeout(resolve, 50));
          }
          return Boolean(model);
        }
      }

      loading = true;
      loadingSince = Date.now();
      const gen = loadGen;
      setError('');
      paintStageError('');
      try {
        const info = await window.api.live2dGetModel();
        if (isLoadStale(gen)) return false;
        if (!info?.ok || !info.modelUrl) {
          setError(info?.message || 'Модель не настроена');
          await destroy();
          return false;
        }

        const stage = getLoadStage();
        if (!stage) {
          setError('Нет слота для Live2D');
          return false;
        }

        if (!await waitForStageSize(stage)) {
          setError('Слот модели без размера');
          return false;
        }

        if (!force && model && loadedUrl === info.modelUrl && stageEl === stage && stageEl.isConnected) {
          fitModel();
          bindStageClick(stage);
          return true;
        }

        await ensureApp(stage);
        if (isLoadStale(gen)) return false;

        if (model) detachModel();

        loadedUrl = info.modelUrl;
        idleMotionRef = String(info.idleMotion || '').trim();

        if (live2d?.cubism4Ready) await live2d.cubism4Ready;

        console.info('[live2d] loading…', info.modelUrl);
        const loadPromise = Live2DModel.from(info.modelUrl, {
          autoInteract: false,
          autoUpdate: false,
        });
        const timeoutMs = 120000;
        model = await Promise.race([
          loadPromise,
          new Promise((_, reject) => {
            window.setTimeout(
              () => reject(new Error(`Таймаут загрузки модели (${timeoutMs / 1000}с)`)),
              timeoutMs,
            );
          }),
        ]);
        if (isLoadStale(gen)) {
          try { model.destroy({ children: true }); } catch { /* */ }
          model = null;
          return false;
        }

        app.stage.addChild(model);
        fitModel();
        playIdle();
        const costume = preferredCostumeRef(info) || 'costume_v0000.exp3.json';
        await applyCostume(costume);
        restoreNeutralFaceParams();
        model.autoUpdate = true;
        app.render();

        stage.classList.add('agent-live2d-ready');
        bindStageClick(stage);
        setError('');
        paintStageError('');
        pruneInactiveStages();
        console.info('[live2d] модель на экране');
        window.dispatchEvent(new CustomEvent('agent-live2d-loaded'));
        fitModel();
        app.render();
        scheduleBrandAvatarSync();
        scheduleIdleBlink();
        scheduleIdleAntics();
        return true;
      } catch (err) {
        setError(err?.message || String(err) || 'Ошибка загрузки Live2D');
        paintStageError(lastError);
        await resetRenderer();
        getStage()?.classList.remove('agent-live2d-ready');
        return false;
      } finally {
        loading = false;
      }
    })();

    try {
      return await loadFlight;
    } finally {
      loadFlight = null;
    }
  }

  window.AgentLive2d = {
    isReady: ready,
    load,
    scheduleLoad,
    destroy,
    relayout: fitModel,
    playEmotion,
    playClickReaction,
    playIdle,
    applyCostume,
    needsRemount,
    isLoaded: () => Boolean(model && stageEl?.isConnected),
    getLastError: () => lastError,
    getBrandAvatarSrc,
    syncBrandAvatars,
  };

  window.addEventListener('app-settings-updated', () => {
    const nextCostume = window.appSettings?.vtubeStudio?.live2dCostume;
    if (nextCostume && nextCostume !== costumeRef) {
      applyCostume(nextCostume, { resetOthers: true });
    }
    scheduleLoad('settings');
  });
  window.addEventListener('agent-live2d-loaded', () => {
    window.AgentVtuber?.syncChatClasses?.();
  });
  const messagesRoot = document.getElementById('agent-messages');
  if (messagesRoot) {
    new MutationObserver((mutations) => {
      const anchorReplaced = mutations.some((mutation) => {
        if (mutation.type !== 'childList') return false;
        return [...mutation.addedNodes].some((node) => {
          if (!(node instanceof Element)) return false;
          return node.id === 'agent-vtuber-hero-anchor'
            || Boolean(node.querySelector?.('#agent-vtuber-hero-anchor'));
        });
      });
      if (anchorReplaced) scheduleLoad('messages');
    }).observe(messagesRoot, {
      childList: true,
      subtree: true,
    });
  }
  window.addEventListener('load', () => {
    scheduleLoad('window-load');
  });
  scheduleLoad('init');

  console.info('[live2d] renderer ready', {
    cubism: Boolean(window.Live2DCubismCore),
    pixi: Boolean(PIXI),
    live2d: Boolean(Live2DModel),
  });
})();
