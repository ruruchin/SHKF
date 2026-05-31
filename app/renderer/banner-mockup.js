(function () {
  let presets = [];
  let gallery = [];
  let selectedPresetId = null;
  let selectedGalleryId = null;
  let texts = { title: '', subtitle: '', cta: '' };
  let layerHints = { title: 'text-title', subtitle: 'text-subtitle', cta: 'text-cta' };
  let applying = false;
  let pulling = false;
  const resolvedImageUrlCache = new Map();

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSelectedPreset() {
    return presets.find((p) => p.id === selectedPresetId) || presets[0] || null;
  }

  function getSelectedGalleryItem() {
    return gallery.find((g) => g.id === selectedGalleryId) || gallery[0] || null;
  }

  function getImageUrl() {
    const item = getSelectedGalleryItem();
    return item?.imageUrls?.[0] || '';
  }

  async function resolveImageUrl(rawUrl, galleryItem = null) {
    const src = String(rawUrl || '').trim();
    if (!src) return '';
    if (src.startsWith('data:image/')) return src;
    const key = `${galleryItem?.id || ''}|${galleryItem?.generationId || ''}|${src}`;
    if (resolvedImageUrlCache.has(key)) return resolvedImageUrlCache.get(key);
    let resolved = src;
    try {
      const prepared = await window.api.nanobananaResolveImageDataUrl?.({
        url: src,
        generationId: galleryItem?.generationId || null,
      });
      if (prepared?.ok && prepared.dataUrl) resolved = prepared.dataUrl;
    } catch {
      /* fallback to source URL */
    }
    resolvedImageUrlCache.set(key, resolved);
    return resolved;
  }

  async function getResolvedSelectedImageUrl() {
    const item = getSelectedGalleryItem();
    const raw = item?.imageUrls?.[0] || '';
    return resolveImageUrl(raw, item);
  }

  function setStatus(message, kind) {
    const el = $('bm-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    el.classList.toggle('bm-alert--error', kind === 'error');
    el.classList.toggle('bm-alert--info', kind === 'info');
  }

  function setLinkAlert(preset) {
    const el = $('bm-link-alert');
    if (!el) return;
    if (!preset || preset.linked) {
      el.classList.add('hidden');
      return;
    }
    el.className = 'bm-alert bm-alert--warn';
    el.innerHTML = `Размер <strong>${escapeHtml(preset.label)}</strong> ещё не в библиотеке. Выделите frame в Figma «SHKF banners» и сохраните через FIRURU Bridge.`;
    el.classList.remove('hidden');
  }

  function applyTextsFromSlots(preset, { force = false } = {}) {
    const slots = preset?.bannerSlots;
    if (!slots) return;
    if (force || !texts.title) texts.title = slots.title?.defaultText || texts.title || '';
    if (force || !texts.subtitle) texts.subtitle = slots.subtitle?.defaultText || texts.subtitle || '';
    if (force || !texts.cta) texts.cta = slots.cta?.defaultText || texts.cta || '';
    if (slots.title?.layerName) layerHints.title = slots.title.layerName;
    if (slots.subtitle?.layerName) layerHints.subtitle = slots.subtitle.layerName;
    if (slots.cta?.layerName) layerHints.cta = slots.cta.layerName;
  }

  function updateLayerLabels() {
    const map = [
      ['bm-label-title', layerHints.title],
      ['bm-label-subtitle', layerHints.subtitle],
      ['bm-label-cta', layerHints.cta],
    ];
    map.forEach(([id, layer]) => {
      const el = $(id);
      if (!el) return;
      const label = id.includes('title') ? 'Заголовок' : id.includes('subtitle') ? 'Подзаголовок' : 'Кнопка (CTA)';
      el.innerHTML = `${label} <em class="bm-layer-hint">${escapeHtml(layer)}</em>`;
    });
  }

  function renderSizePicker() {
    const root = $('bm-sizes');
    if (!root) return;
    root.innerHTML = presets.map((p) => {
      const active = p.id === selectedPresetId ? ' is-active' : '';
      const missing = p.linked ? '' : ' is-missing';
      const badge = p.linked
        ? `<span class="bm-size-badge">${escapeHtml(p.templateName || 'OK')}</span>`
        : '<span class="bm-size-badge bm-size-badge--warn">нет в SHKF</span>';
      return `
        <button type="button" class="bm-size-btn${active}${missing}" data-preset-id="${escapeHtml(p.id)}">
          <span>
            <span class="bm-size-label">${escapeHtml(p.label)}</span>
            <span class="bm-size-meta">${p.width}×${p.height}</span>
          </span>
          ${badge}
        </button>`;
    }).join('');
  }

  function renderGalleryPicker() {
    const root = $('bm-gallery-grid');
    if (!root) return;
    if (!gallery.length) {
      root.innerHTML = '<p class="bm-sub">Нет изображений — сгенерируйте в NanoBanana</p>';
      return;
    }
    root.innerHTML = gallery.slice(0, 12).map((item) => {
      const url = item.imageUrls?.[0];
      if (!url) return '';
      const active = item.id === selectedGalleryId ? ' is-active' : '';
      return `<button type="button" class="bm-gallery-thumb${active}" data-gallery-id="${escapeHtml(item.id)}"><img src="${escapeHtml(url)}" alt="" loading="lazy" /></button>`;
    }).join('');
  }

  function syncTextInputs() {
    if ($('bm-text-title')) $('bm-text-title').value = texts.title || '';
    if ($('bm-text-subtitle')) $('bm-text-subtitle').value = texts.subtitle || '';
    if ($('bm-text-cta')) $('bm-text-cta').value = texts.cta || '';
    updateLayerLabels();
  }

  function slotStyle(slot) {
    if (!slot) return '';
    const x = Math.max(0, Number(slot.x) || 0);
    const y = Math.max(0, Number(slot.y) || 0);
    const w = Math.max(0, Math.min(1 - x, Number(slot.w) || 0));
    const h = Math.max(0, Math.min(1 - y, Number(slot.h) || 0));
    const pct = (v) => `${Math.max(0, Math.min(100, v * 100))}%`;
    return [
      `left:${pct(x)}`,
      `top:${pct(y)}`,
      `width:${pct(w)}`,
      `height:${pct(h)}`,
    ].join(';');
  }

  const IMAGE_TEXT_GAP = 0.02;

  function defaultImageSlot(preset) {
    const w = preset?.width || 1200;
    const h = preset?.height || 400;
    if (w / h > 1.8) return { x: 0.52, y: 0, w: 0.48, h: 1 };
    if (h / w > 1.15) return { x: 0, y: 0.38, w: 1, h: 0.62 };
    return { x: 0.5, y: 0, w: 0.5, h: 1 };
  }

  /** Если img на весь frame — зона картинки не заходит на текстовые слои. */
  function deriveImageSlotFromText(preset) {
    const slots = preset?.bannerSlots;
    if (!slots) return null;

    const w = preset?.width || 1200;
    const h = preset?.height || 400;
    const wide = w / h > 1.8;
    const tall = h / w > 1.15;

    if (tall) {
      let maxBottom = 0;
      for (const key of ['title', 'subtitle', 'cta']) {
        const s = slots[key];
        if (!s) continue;
        const bottom = (Number(s.y) || 0) + (Number(s.h) || 0);
        if (bottom > maxBottom) maxBottom = bottom;
      }
      if (maxBottom < 0.05) return null;
      const imgY = Math.min(0.88, maxBottom + IMAGE_TEXT_GAP);
      return { x: 0, y: imgY, w: 1, h: 1 - imgY };
    }

    let maxRight = 0;
    for (const key of ['title', 'subtitle', 'cta']) {
      const s = slots[key];
      if (!s) continue;
      const right = (Number(s.x) || 0) + (Number(s.w) || 0);
      if (right > maxRight) maxRight = right;
    }
    if (maxRight < 0.05) return null;
    const imgX = Math.min(0.88, maxRight + IMAGE_TEXT_GAP);
    return { x: imgX, y: 0, w: 1 - imgX, h: 1 };
  }

  function isFullBleedImageSlot(raw) {
    return raw && (Number(raw.w) || 0) >= 0.9 && (Number(raw.h) || 0) >= 0.9;
  }

  function getEffectiveBannerSlots(preset) {
    const slots = preset?.bannerSlots;
    if (slots?.title || slots?.subtitle || slots?.cta) return slots;
    const w = preset?.templateWidth || preset?.width;
    const h = preset?.templateHeight || preset?.height;
    const donor = presets.find((p) => p.id !== preset.id
      && (p.templateWidth || p.width) === w
      && (p.templateHeight || p.height) === h
      && (p.bannerSlots?.title || p.bannerSlots?.subtitle || p.bannerSlots?.cta));
    return donor?.bannerSlots || slots || null;
  }

  const CENTERED_IMAGE_LAYOUT = 'center';

  function isCenteredImageBanner(preset) {
    if (preset?.imageLayout === CENTERED_IMAGE_LAYOUT) return true;
    const w = preset?.templateWidth || preset?.width;
    const h = preset?.templateHeight || preset?.height;
    return (w === 388 && h === 203)
      || (w === 1200 && h === 560)
      || (w === 360 && h === 488)
      || (w === 420 && h === 488);
  }

  function resolveCenteredOverlay(preset, { overlayUrl, isNoImg, imageUrl }) {
    if (!overlayUrl || !imageUrl || !isCenteredImageBanner(preset)) {
      const clip = overlayClipStyle(preset, imageUrl);
      // Некоторые "withoutImg" превью экспортируются непрозрачными и полностью
      // перекрывают фото. Если безопасной клип-области нет — не рисуем оверлей.
      if (isNoImg && !clip) return { url: '', clip: '' };
      return { url: overlayUrl, clip };
    }
    if (isNoImg) {
      const textClip = textUiOverlayClip(preset, 1) || '';
      // Для centered размеров без текстовых слоёв noImg-оверлей часто "глухой".
      // В этом случае оставляем только фото, иначе оно скрывается.
      if (!textClip) return { url: '', clip: '' };
      return { url: overlayUrl, clip: textClip };
    }
    const textClip = textUiOverlayClip(preset, 1);
    if (textClip) {
      return { url: overlayUrl, clip: textClip };
    }
    // Для centered без текстового клипа "noImg" оверлей часто непрозрачный:
    // не накрываем картинку, оставляем только фото.
    return { url: '', clip: '' };
  }

  function buildStageHtml(preset, { overlayUrl, isNoImg, imageUrl }) {
    if (!overlayUrl && !imageUrl) {
      return '<div class="bm-preview-empty">Выберите изображение и экспортируйте баннер из Figma</div>';
    }

    const centered = isCenteredImageBanner(preset);
    const { url: effectiveOverlay, clip: overlayClip } = resolveCenteredOverlay(
      preset,
      { overlayUrl, isNoImg, imageUrl },
    );

    if (!effectiveOverlay && !imageUrl) {
      return '<div class="bm-preview-empty">Нет шаблона — сохраните frame в SHKF</div>';
    }
    if (!effectiveOverlay && !overlayUrl && !(imageUrl && centered)) {
      return '<div class="bm-preview-empty">Нет шаблона — сохраните frame в SHKF</div>';
    }

    let html = '<div class="bm-preview-base"></div>';

    if (imageUrl) {
      if (centered) {
        html += `<div class="bm-preview-photo-wrap bm-preview-photo-wrap--bg"><img class="bm-preview-photo bm-preview-photo--center" src="${escapeHtml(imageUrl)}" alt="" /></div>`;
      } else {
        const imgSlot = getImageDisplaySlot(preset);
        if (imgSlot) {
          html += `<div class="bm-preview-photo-wrap" style="${slotStyle(imgSlot)}"><img class="bm-preview-photo" src="${escapeHtml(imageUrl)}" alt="" /></div>`;
        }
      }
    }

    if (effectiveOverlay) {
      html += `<img class="bm-preview-overlay" src="${escapeHtml(effectiveOverlay)}" alt=""${overlayClip ? ` style="${overlayClip}"` : ''} />`;
    }

    return html;
  }
  function getImageDisplaySlot(preset) {
    if (isCenteredImageBanner(preset)) {
      return { x: 0, y: 0, w: 1, h: 1 };
    }
    const raw = preset?.bannerSlots?.image;
    if (raw && !isFullBleedImageSlot(raw)) {
      return raw;
    }
    const slots = getEffectiveBannerSlots(preset);
    const fromText = slots
      ? deriveImageSlotFromText({ ...preset, bannerSlots: slots })
      : null;
    return fromText || defaultImageSlot(preset);
  }

  /** Оверлей только на текст/кнопки — декор из PNG не попадает между текстом и фото. */
  function textUiOverlayClip(preset, photoStartX) {
    const slots = getEffectiveBannerSlots(preset);
    if (!slots) return '';

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    let has = false;

    for (const key of ['title', 'subtitle', 'cta']) {
      const s = slots[key];
      if (!s) continue;
      has = true;
      minX = Math.min(minX, Number(s.x) || 0);
      minY = Math.min(minY, Number(s.y) || 0);
      maxX = Math.max(maxX, (Number(s.x) || 0) + (Number(s.w) || 0));
      maxY = Math.max(maxY, (Number(s.y) || 0) + (Number(s.h) || 0));
    }
    if (!has) return '';

    const w = preset?.templateWidth || preset?.width || 1200;
    const h = preset?.templateHeight || preset?.height || 400;
    const wide = w / h > 1.4;
    const photoEdge = Math.max(0.01, Number(photoStartX) || 0.52);

    const padX = 0.045;
    const padY = 0.03;
    const btnPadY = wide ? 0.05 : 0.035;

    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padY);
    maxX = Math.min(photoEdge - 0.004, maxX + padX);
    maxY = Math.min(1, maxY + padY + btnPadY);

    if (maxX <= minX || maxY <= minY) return '';

    const top = (minY * 100).toFixed(4);
    const right = ((1 - maxX) * 100).toFixed(4);
    const bottom = ((1 - maxY) * 100).toFixed(4);
    const left = (minX * 100).toFixed(4);
    return `clip-path:inset(${top}% ${right}% ${bottom}% ${left}%)`;
  }

  function overlayClipStyle(preset, imageUrl) {
    if (!imageUrl) return '';
    if (isCenteredImageBanner(preset)) {
      const slots = getEffectiveBannerSlots(preset);
      if (slots) return textUiOverlayClip(preset, 1) || '';
      return '';
    }
    const raw = preset?.bannerSlots?.image;
    const imgSlot = getImageDisplaySlot(preset);
    if (isFullBleedImageSlot(raw) && getEffectiveBannerSlots(preset)) {
      const tight = textUiOverlayClip(preset, imgSlot.x);
      if (tight) return tight;
    }
    return templateClipStyle(imgSlot);
  }

  /** Обрезка оверлея: скрываем только зону img (справа / снизу). */
  function templateClipStyle(imageSlot) {
    if (!imageSlot) return '';
    const ix = Math.max(0, Number(imageSlot.x) || 0);
    const iy = Math.max(0, Number(imageSlot.y) || 0);
    const iw = Number(imageSlot.w) || 0;
    const ih = Number(imageSlot.h) || 0;

    if (ix > 0.01 && iw > 0.01) {
      const rightCut = Math.max(0, Math.min(100, (1 - ix) * 100));
      if (rightCut > 0.1 && rightCut < 99.9) {
        return `clip-path:inset(0 ${rightCut.toFixed(4)}% 0 0)`;
      }
    }
    if (iy > 0.01 && ih > 0.01 && ix < 0.15) {
      const bottomCut = Math.max(0, Math.min(100, (1 - iy) * 100));
      if (bottomCut > 0.1 && bottomCut < 99.9) {
        return `clip-path:inset(0 0 ${bottomCut.toFixed(4)}% 0)`;
      }
    }
    return '';
  }

  async function loadOverlayUrl(templateId) {
    if (!templateId) return { url: '', isNoImg: false };
    try {
      const noImg = (await window.api.getUserTemplateThumb?.(templateId, { withoutImg: true, strict: true })) || '';
      if (noImg) return { url: noImg, isNoImg: true };
      const full = (await window.api.getUserTemplateThumb?.(templateId)) || '';
      return { url: full, isNoImg: false };
    } catch {
      return { url: '', isNoImg: false };
    }
  }

  function parseInsetClip(styleText) {
    const m = String(styleText || '').match(/clip-path:\s*inset\(([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\)/i);
    if (!m) return null;
    return {
      top: Number(m[1]) / 100,
      right: Number(m[2]) / 100,
      bottom: Number(m[3]) / 100,
      left: Number(m[4]) / 100,
    };
  }

  function drawImageCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  async function loadImageSafe(url) {
    if (!url) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function composePresetMockupDataUrl(preset, imageUrl) {
    const width = Math.round(preset?.templateWidth || preset?.width || 1200);
    const height = Math.round(preset?.templateHeight || preset?.height || 400);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Базовый фон всегда белый.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    let overlayUrl = '';
    let isNoImg = false;
    if (preset?.templateId) {
      const loaded = await loadOverlayUrl(preset.templateId);
      overlayUrl = loaded.url;
      isNoImg = loaded.isNoImg;
    }
    const centered = isCenteredImageBanner(preset);
    const { url: effectiveOverlay, clip: overlayClip } = resolveCenteredOverlay(
      preset,
      { overlayUrl, isNoImg, imageUrl },
    );

    if (imageUrl) {
      const image = await loadImageSafe(imageUrl);
      if (image) {
        if (centered) {
          drawImageCover(ctx, image, 0, 0, width, height);
        } else {
          const slot = getImageDisplaySlot(preset);
          const x = (Number(slot?.x) || 0) * width;
          const y = (Number(slot?.y) || 0) * height;
          const w = Math.max(1, (Number(slot?.w) || 1) * width);
          const h = Math.max(1, (Number(slot?.h) || 1) * height);
          drawImageCover(ctx, image, x, y, w, h);
        }
      }
    }

    if (effectiveOverlay) {
      const overlay = await loadImageSafe(effectiveOverlay);
      if (overlay) {
        const clipInset = parseInsetClip(overlayClip);
        if (clipInset) {
          const clipX = clipInset.left * width;
          const clipY = clipInset.top * height;
          const clipW = width * (1 - clipInset.left - clipInset.right);
          const clipH = height * (1 - clipInset.top - clipInset.bottom);
          if (clipW > 1 && clipH > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipX, clipY, clipW, clipH);
            ctx.clip();
            ctx.drawImage(overlay, 0, 0, width, height);
            ctx.restore();
          }
        } else {
          ctx.drawImage(overlay, 0, 0, width, height);
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  async function buildMockupsForAgent({ galleryItemId = null } = {}) {
    if (!gallery.length || !presets.length) return [];
    let item = getSelectedGalleryItem();
    if (galleryItemId) {
      item = gallery.find((g) => g.id === galleryItemId) || item;
    }
    const imageUrlRaw = item?.imageUrls?.[0] || '';
    if (!imageUrlRaw) return [];
    const imageUrl = await resolveImageUrl(imageUrlRaw, item);

    const linkedPresets = presets.filter((p) => p.linked);
    const targets = linkedPresets.length ? linkedPresets : presets;
    const mockups = [];
    for (const preset of targets) {
      const dataUrl = await composePresetMockupDataUrl(preset, imageUrl);
      if (!dataUrl) continue;
      const w = Math.round(preset?.templateWidth || preset?.width || 0);
      const h = Math.round(preset?.templateHeight || preset?.height || 0);
      mockups.push({
        presetId: preset.id,
        label: preset.label || `${w}x${h}`,
        width: w,
        height: h,
        filename: `banner-${w}x${h}.png`,
        dataUrl,
      });
    }
    return mockups;
  }

  function updatePreviewCaption(preset) {
    const cap = $('bm-preview-caption');
    if (!cap) return;
    if (!preset) {
      cap.textContent = '—';
      return;
    }
    if (preset.templateName) {
      cap.textContent = `Выбран: ${preset.templateName}`;
      return;
    }
    cap.textContent = 'Экспортируйте frame в SHKF через FIRURU Bridge';
  }

  async function renderPreviewCard(preset, { imageUrl, isActive }) {
    const previewW = Math.round(preset?.templateWidth || preset?.width || 320);
    const previewH = Math.round(preset?.templateHeight || preset?.height || 120);

    let overlayUrl = '';
    let isNoImg = false;
    if (preset?.templateId) {
      const loaded = await loadOverlayUrl(preset.templateId);
      overlayUrl = loaded.url;
      isNoImg = loaded.isNoImg;
    }

    const stageHtml = buildStageHtml(preset, { overlayUrl, isNoImg, imageUrl });
    const activeClass = isActive ? ' is-active' : '';
    const linkedClass = preset?.linked ? '' : ' is-missing';
    const label = escapeHtml(preset?.label || 'Размер');
    const meta = `${previewW}×${previewH}`;

    return `
      <article class="bm-preview-card${activeClass}${linkedClass}" data-preset-id="${escapeHtml(preset.id)}">
        <div class="bm-preview-card-label">${label} <span class="bm-preview-card-meta">${meta}px</span></div>
        <div class="bm-preview-stage" style="width:${previewW}px;height:${previewH}px">${stageHtml}</div>
      </article>`;
  }

  async function renderPreview() {
    const grid = $('bm-preview-grid');
    const dimEl = $('bm-preview-dim');
    const selected = getSelectedPreset();
    if (!grid) return;

    const imageUrl = await getResolvedSelectedImageUrl();

    if (dimEl) {
      const linked = presets.filter((p) => p.linked).length;
      dimEl.textContent = linked
        ? `${linked} из ${presets.length} размеров в SHKF`
        : 'Экспортируйте баннеры через FIRURU Bridge';
    }

    updatePreviewCaption(selected);

    if (!presets.length) {
      grid.innerHTML = '<div class="bm-preview-empty">Нет пресетов размеров</div>';
      return;
    }

    const cards = await Promise.all(
      presets.map((p) => renderPreviewCard(p, {
        imageUrl,
        isActive: p.id === selectedPresetId,
      })),
    );
    grid.innerHTML = cards.join('');

    const applyBtn = $('bm-apply-figma');
    if (applyBtn) applyBtn.disabled = !selected?.templateId || !imageUrl || applying;
  }

  async function renderAll() {
    const preset = getSelectedPreset();
    renderSizePicker();
    renderGalleryPicker();
    syncTextInputs();
    setLinkAlert(preset);
    await renderPreview();
  }

  async function loadData() {
    const [presetsRes, galleryRes] = await Promise.all([
      window.api.bannerMockupGetPresets?.(),
      window.api.nanobananaGetGallery?.(),
    ]);
    if (presetsRes?.ok) presets = presetsRes.presets || [];
    if (galleryRes?.ok) gallery = galleryRes.items || [];

    if (!selectedPresetId && presets[0]) selectedPresetId = presets[0].id;
    if (!selectedGalleryId && gallery[0]) selectedGalleryId = gallery[0].id;

    applyTextsFromSlots(getSelectedPreset());
    renderAll();
  }

  async function pullTextsFromFigma() {
    const preset = getSelectedPreset();
    if (!preset?.templateId) {
      setStatus('Сначала экспортируйте этот размер баннера в SHKF', 'error');
      return;
    }
    if (pulling) return;

    pulling = true;
    setStatus('Читаем текст из Figma…', 'info');

    try {
      const res = await window.api.bannerMockupReadFigmaTexts?.(preset.templateId);
      if (!res?.ok) {
        setStatus(res?.message || 'Не удалось прочитать текст', 'error');
        return;
      }
      texts.title = res.texts?.title || '';
      texts.subtitle = res.texts?.subtitle || '';
      texts.cta = res.texts?.cta || '';
      if (res.layers?.title) layerHints.title = res.layers.title;
      if (res.layers?.subtitle) layerHints.subtitle = res.layers.subtitle;
      if (res.layers?.cta) layerHints.cta = res.layers.cta;
      if (res.bannerSlots) {
        const idx = presets.findIndex((p) => p.id === preset.id);
        if (idx >= 0) presets[idx].bannerSlots = res.bannerSlots;
      }
      setStatus('Текст загружен из слоёв Figma', 'info');
      renderAll();
    } catch (err) {
      setStatus(err.message || 'Ошибка', 'error');
    } finally {
      pulling = false;
    }
  }

  async function applyToFigma() {
    const preset = getSelectedPreset();
    const imageUrl = await getResolvedSelectedImageUrl();
    if (!preset?.templateId) {
      setStatus('Сначала экспортируйте этот размер баннера в SHKF через FIRURU Bridge', 'error');
      return;
    }
    if (!imageUrl) {
      setStatus('Выберите изображение из галереи NanoBanana', 'error');
      return;
    }

    applying = true;
    $('bm-apply-figma').disabled = true;
    setStatus('Вставляем в Figma: картинка в img, текст в слои…', 'info');

    try {
      const res = await window.api.bannerMockupApply?.({
        templateId: preset.templateId,
        imageUrl,
        texts,
      });
      if (!res?.ok) {
        setStatus(res?.message || 'Не удалось вставить баннер', 'error');
        return;
      }
      setStatus(`«${res.name || preset.templateName}» в Figma — редактируйте текст там же`, 'info');
    } catch (err) {
      setStatus(err.message || 'Ошибка', 'error');
    } finally {
      applying = false;
      await renderPreview();
    }
  }

  function bindEvents() {
    $('bm-sizes')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset-id]');
      if (!btn) return;
      selectedPresetId = btn.dataset.presetId;
      texts = { title: '', subtitle: '', cta: '' };
      applyTextsFromSlots(getSelectedPreset(), { force: true });
      renderAll();
    });

    $('bm-preview-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-preset-id]');
      if (!card) return;
      selectedPresetId = card.dataset.presetId;
      texts = { title: '', subtitle: '', cta: '' };
      applyTextsFromSlots(getSelectedPreset(), { force: true });
      renderAll();
    });

    $('bm-gallery-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gallery-id]');
      if (!btn) return;
      selectedGalleryId = btn.dataset.galleryId;
      renderAll();
    });

    ['title', 'subtitle', 'cta'].forEach((key) => {
      const el = $(`bm-text-${key}`);
      el?.addEventListener('input', () => {
        texts[key] = el.value;
      });
    });

    $('bm-apply-figma')?.addEventListener('click', applyToFigma);
    $('bm-pull-figma-text')?.addEventListener('click', pullTextsFromFigma);
    $('bm-pull-figma-text-side')?.addEventListener('click', pullTextsFromFigma);
    $('bm-open-nanobanana')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-page="nanobanana"]')?.click();
    });
    $('bm-open-templates')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-page="templates"]')?.click();
    });

    window.api.onLibraryUpdated?.(() => {
      if ($('page-bannermockup')?.classList.contains('active')) loadData();
    });
  }

  window.syncBannerMockupFromNanobanana = async function syncBannerMockupFromNanobanana({
    galleryItemId = null,
    title = '',
    subtitle = '',
    cta = '',
    navigate = true,
  } = {}) {
    if (navigate) {
      document.querySelector('.nav-item[data-page="bannermockup"]')?.click();
      await window.activateBannerMockupPage?.();
    } else {
      await loadData();
    }

    if (galleryItemId && gallery.some((g) => g.id === galleryItemId)) {
      selectedGalleryId = galleryItemId;
    } else if (gallery[0]) {
      selectedGalleryId = gallery[0].id;
    }

    if (title) texts.title = title;
    if (subtitle) texts.subtitle = subtitle;
    if (cta) texts.cta = cta;

    renderAll();
    return { ok: true };
  };

  window.exportBannerMockupsForAgent = async function exportBannerMockupsForAgent({
    galleryItemId = null,
  } = {}) {
    try {
      await loadData();
      const mockups = await buildMockupsForAgent({ galleryItemId });
      return { ok: true, mockups };
    } catch (err) {
      return { ok: false, message: err.message || 'Не удалось подготовить мокапы', mockups: [] };
    }
  };

  window.activateBannerMockupPage = async function activateBannerMockupPage() {
    window.detachMetaskBoard?.();
    window.detachMailView?.();
    await loadData();
    const preset = getSelectedPreset();
    if (preset?.templateId) {
      pullTextsFromFigma().catch(() => { /* optional */ });
    }
  };

  function initBannerMockup() {
    if (!$('page-bannermockup')) return;
    bindEvents();
  }

  window.initBannerMockup = initBannerMockup;
})();
