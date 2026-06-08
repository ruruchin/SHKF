(function initAuthLive2d() {
  let app = null;
  let model = null;
  let hostEl = null;
  let canvas = null;
  let destroyed = true;
  let mountGen = 0;
  let resizeObserver = null;
  let mouseHandler = null;
  let emotionTimer = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const TSHIRT_PARAMS = [
    { Id: 'v0052_Param3', Value: 1 },
    { Id: 'V0101_Param3', Value: -1 },
    { Id: 'v0000_Param8', Value: 0 },
    { Id: 'V0100Param44', Value: 0 },
    { Id: 'Param28', Value: 0 },
  ];

  const EMOTIONS = {
    error: ['jitome.exp3.json', 'fx_7_question.exp3.json'],
    success: ['smile.exp3.json', 'fx_1_heart.exp3.json', 'blush.exp3.json'],
    neutral: [],
  };

  const PIXI = window.PIXI;
  const live2d = PIXI?.live2d;
  const Live2DModel = live2d?.Live2DModel;

  try {
    live2d?.startUpCubism4?.({ logFunction: () => {} });
    if (Live2DModel && PIXI?.Ticker) Live2DModel.registerTicker(PIXI.Ticker);
  } catch (err) {
    console.warn('[auth-live2d] Cubism init:', err?.message || err);
  }

  function ready() {
    return Boolean(window.Live2DCubismCore && Live2DModel && window.api?.live2dGetModel);
  }

  async function waitForReady(maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (ready()) return true;
      await wait(100);
    }
    return false;
  }

  async function waitForHostSize(host, maxAttempts = 40) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if ((host.clientWidth || 0) > 40 && (host.clientHeight || 0) > 40) return true;
      await wait(50);
    }
    return (host.clientWidth || 0) > 0 && (host.clientHeight || 0) > 0;
  }

  function clearEmotionTimer() {
    if (emotionTimer) {
      window.clearTimeout(emotionTimer);
      emotionTimer = 0;
    }
  }

  function applyTshirt(core) {
    if (!core) return;
    TSHIRT_PARAMS.forEach((param) => {
      core.setParameterValueById(param.Id, param.Value);
    });
  }

  function playExpressions(files = []) {
    if (!model || !files.length) return;
    files.forEach((file) => {
      try {
        model.expression(file);
      } catch {
        try {
          model.expression(file.replace(/\.exp3\.json$/i, ''));
        } catch {
          /* ignore */
        }
      }
    });
    app?.render?.();
  }

  function reactNeutral({ delayMs = 0 } = {}) {
    clearEmotionTimer();
    const run = () => {
      if (!model || destroyed) return;
      try {
        model.expression();
      } catch {
        /* ignore */
      }
      playIdle();
      app?.render?.();
    };
    if (delayMs > 0) emotionTimer = window.setTimeout(run, delayMs);
    else run();
  }

  function reactError({ revertMs = 2400 } = {}) {
    if (!model || destroyed) return;
    clearEmotionTimer();
    playExpressions(EMOTIONS.error);
    emotionTimer = window.setTimeout(() => reactNeutral(), revertMs);
  }

  function reactSuccess({ revertMs = 0 } = {}) {
    if (!model || destroyed) return;
    clearEmotionTimer();
    playExpressions(EMOTIONS.success);
    if (revertMs > 0) emotionTimer = window.setTimeout(() => reactNeutral(), revertMs);
  }

  function bindCursorTracking() {
    mouseHandler = (event) => {
      if (destroyed || !hostEl) return;
      const rect = hostEl.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.32;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const scaleX = Math.max(rect.width * 0.45, 320);
      const scaleY = Math.max(rect.height * 0.38, 280);
      targetX = Math.max(-1, Math.min(1, dx / scaleX));
      targetY = Math.max(-1, Math.min(1, -dy / scaleY));
    };
    window.addEventListener('mousemove', mouseHandler, { passive: true });
  }

  function bindModelUpdate() {
    if (!model?.internalModel) return;
    const im = model.internalModel;
    const original = im.update.bind(im);
    im.update = function authLive2dUpdate(m, now) {
      original(m, now);
      const core = im.coreModel;
      if (!core) return;
      applyTshirt(core);
      const ease = 0.1;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      core.setParameterValueById('ParamAngleX', currentX * 28);
      core.setParameterValueById('ParamAngleY', currentY * 24);
      core.setParameterValueById('ParamEyeBallX', currentX);
      core.setParameterValueById('ParamEyeBallY', currentY);
      core.setParameterValueById('ParamBodyAngleX', currentX * 8);
      core.setParameterValueById('ParamBodyAngleY', currentY * 8);
    };
  }

  function fitModel() {
    if (!app || !model || !hostEl) return;
    const width = hostEl.clientWidth || 480;
    const height = hostEl.clientHeight || 640;
    try {
      app.renderer.resize(width, height);
    } catch {
      /* ignore */
    }

    const bounds = model.getLocalBounds();
    let bw = bounds.width || 800;
    let bh = bounds.height || 1000;
    if (bw <= 1 || bh <= 1) {
      bw = model.width || model.internalModel?.width || 800;
      bh = model.height || model.internalModel?.height || 1000;
    }

    const scale = (width / bw) * 2.45;
    model.scale.set(scale);
    const scaledH = bh * scale;
    const anchorY = 0.58;
    model.anchor.set(0.5, anchorY);
    model.x = width * 0.5;
    let targetModelY = height * 0.56;
    const headTop = targetModelY - anchorY * scaledH;
    const headMargin = height * 0.08;
    if (headTop < headMargin) targetModelY += headMargin - headTop;
    model.y = targetModelY;
    app.render();
  }

  function playIdle() {
    if (!model) return;
    const motions = model.internalModel?.settings?.motions || model.internalModel?.settings?.Motions || {};
    if (motions.Idle) model.motion('Idle', 0, 3);
    else if (motions.idle) model.motion('idle', 0, 3);
    else {
      const keys = Object.keys(motions);
      if (keys.length) model.motion(keys[0], 0, 3);
    }
  }

  async function destroy() {
    destroyed = true;
    mountGen += 1;
    clearEmotionTimer();
    if (mouseHandler) {
      window.removeEventListener('mousemove', mouseHandler);
      mouseHandler = null;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (app) {
      try {
        app.destroy(true, { children: true });
      } catch {
        /* ignore */
      }
    }
    app = null;
    model = null;
    canvas?.remove();
    canvas = null;
    hostEl?.classList.remove('auth-live2d-host--ready', 'auth-live2d-host--fallback');
    hostEl = null;
  }

  async function mount(attempt = 0) {
    const gate = document.getElementById('auth-gate');
    const host = document.getElementById('auth-live2d-host');
    if (!gate || gate.classList.contains('hidden') || !host) return;
    if (app && hostEl === host && host.classList.contains('auth-live2d-host--ready')) return;

    if (!(await waitForReady())) {
      if (attempt < 2) {
        await wait(250);
        return mount(attempt + 1);
      }
      host.classList.add('auth-live2d-host--fallback');
      return;
    }

    await destroy();
    destroyed = false;
    hostEl = host;
    const gen = ++mountGen;

    try {
      await waitForHostSize(host);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (destroyed || gen !== mountGen) return;

      const meta = await window.api.live2dGetModel();
      if (destroyed || gen !== mountGen) return;
      if (!meta?.ok || !meta.modelUrl) {
        console.warn('[auth-live2d]', meta?.message || 'Модель не найдена');
        host.classList.add('auth-live2d-host--fallback');
        return;
      }

      canvas = document.createElement('canvas');
      canvas.className = 'auth-live2d-canvas';
      host.appendChild(canvas);

      app = new PIXI.Application({
        view: canvas,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: host,
      });
      if (!app?.stage) throw new Error('Pixi Application не инициализировался');
      if (!app.cancelResize) app.cancelResize = () => {};

      if (live2d?.cubism4Ready) await live2d.cubism4Ready;

      const loadPromise = Live2DModel.from(meta.modelUrl, {
        autoInteract: false,
        autoUpdate: false,
      });
      model = await Promise.race([
        loadPromise,
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Таймаут загрузки Live2D')), 60000);
        }),
      ]);
      if (destroyed || gen !== mountGen) return;

      app.stage.addChild(model);
      model.autoUpdate = true;
      bindModelUpdate();
      bindCursorTracking();
      fitModel();
      playIdle();
      app.render();

      resizeObserver = new ResizeObserver(() => fitModel());
      resizeObserver.observe(host);

      host.classList.add('auth-live2d-host--ready');
      host.classList.remove('auth-live2d-host--fallback');
      host.removeAttribute('aria-hidden');
    } catch (err) {
      console.warn('[auth-live2d]', err?.message || err);
      await destroy();
      host.classList.add('auth-live2d-host--fallback');
      if (attempt < 2) {
        await wait(400 * (attempt + 1));
        return mount(attempt + 1);
      }
    }
  }

  function scheduleMount() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => mount());
    });
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  window.AuthLive2d = {
    mount,
    scheduleMount,
    destroy,
    reactError,
    reactSuccess,
    reactNeutral,
    wait,
  };
})();
