(function () {
  const VIDEO_RE = /video|jimeng|grok-imagine|seedance/i;
  const ASPECTS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];

  let models = [];
  let modelFamilies = [];
  let gallery = [];
  let referenceUrls = [];
  let selectedItemId = null;
  let previewUrlIndex = 0;
  let generating = false;
  let numOutputs = 1;
  let resolution = '1K';
  let loadingHintTimer = null;

  const LOADING_HINTS = [
    'Обычно 10–60 секунд',
    'Модель обрабатывает промпт…',
    'Собираем композицию…',
    'Рендерим пиксели…',
    'Почти готово…',
  ];

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

  function getSettings() {
    return window.appSettings?.nanobanana || {};
  }

  function hasApiKey() {
    return !!String(getSettings().apiKey || '').trim();
  }

  function resolveModelId(familyId, res) {
    if (!familyId) return familyId;
    const r = String(res || '1K').toUpperCase();
    const family = stripModelResolutionSuffix(String(familyId));
    if (r === '1K') {
      if (!/-2k|-4k/i.test(familyId)) return familyId;
      return models.find((m) => m.name === family)?.name || family;
    }

    const suffix = r === '4K' ? '4k' : '2k';
    const candidates = [
      `${family}-${suffix}`,
      `${family}-fast-${suffix}`,
    ];

    if (models.length) {
      for (const id of candidates) {
        if (models.some((m) => m.name === id)) return id;
      }
      const fuzzy = models.find((m) => m.name.startsWith(family) && m.name.endsWith(`-${suffix}`));
      if (fuzzy) return fuzzy.name;
      return null;
    }
    return candidates[0];
  }

  function familySupportsResolution(familyId, res) {
    const r = String(res || '1K').toUpperCase();
    if (r === '1K') return true;
    return !!resolveModelId(familyId, r);
  }

  function updateResolutionButtons() {
    const familyId = getSelectedFamilyId();
    document.querySelectorAll('.nb-res-btn').forEach((btn) => {
      const res = btn.dataset.res || '1K';
      const ok = familySupportsResolution(familyId, res);
      btn.disabled = !ok;
      btn.classList.toggle('is-disabled', !ok);
      btn.title = ok ? '' : `${res} недоступно для этой модели`;
    });

    if (!familySupportsResolution(familyId, resolution)) {
      const fallback = ['4K', '2K', '1K'].find((res) => familySupportsResolution(familyId, res)) || '1K';
      resolution = fallback;
      document.querySelectorAll('.nb-res-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.res === resolution);
      });
    }
  }

  function stripModelResolutionSuffix(name) {
    return String(name || '').replace(/-(2k|4k|fast(?:-2k|-4k)?)$/i, '');
  }

  function resolutionFromModel(modelId) {
    const id = String(modelId || '');
    if (/-4k$/i.test(id)) return '4K';
    if (/-2k$/i.test(id)) return '2K';
    return '1K';
  }

  function buildModelFamilies(list) {
    const families = new Map();
    for (const m of list) {
      if (!m?.name || VIDEO_RE.test(`${m.name} ${m.displayName || ''}`)) continue;
      const base = m.name.replace(/-(2k|4k|fast(?:-2k|-4k)?)$/i, '');
      if (!families.has(base)) {
        families.set(base, {
          id: base,
          label: (m.displayName || m.name).replace(/\s+(2K|4K|Fast).*$/i, '').trim(),
          creditsCost: m.creditsCost,
          requiresPro: m.requiresPro,
        });
      }
      const fam = families.get(base);
      if (!/-2k|-4k|-fast/i.test(m.name)) {
        fam.label = m.displayName || m.name;
        fam.creditsCost = m.creditsCost;
        fam.requiresPro = m.requiresPro;
      }
    }
    return [...families.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }

  function getSelectedFamilyId() {
    return $('nb-model')?.value || getSettings().defaultModel || 'nanobanan-2';
  }

  function getResolvedModelId() {
    return resolveModelId(getSelectedFamilyId(), resolution);
  }

  function getModelMeta(modelId) {
    return models.find((m) => m.name === modelId) || null;
  }

  function updateModelCostLabel() {
    const modelId = getResolvedModelId();
    const meta = getModelMeta(modelId);
    const el = $('nb-model-cost');
    if (!el) return;
    if (!meta) {
      el.textContent = resolution !== '1K' ? `${resolution} · ${modelId}` : '';
      return;
    }
    const pro = meta.requiresPro ? ' (PRO)' : '';
    const resMismatch = resolution !== '1K' && resolutionFromModel(modelId) !== resolution;
    el.textContent = `${resolution} · ${meta.creditsCost} кред.${pro}${resMismatch ? ` · нет ${resolution}` : ''}`;
    const line = $('nb-cost-line');
    if (line) {
      const extra = referenceUrls.length > 1 ? ` + ${referenceUrls.length - 1} за доп. референсы` : '';
      line.textContent = `Модель: ${modelId} · ~${meta.creditsCost} кред.${extra}`;
    }
  }

  function populateModelSelect() {
    const sel = $('nb-model');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    modelFamilies.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.requiresPro ? `${f.label} (PRO)` : f.label;
      sel.appendChild(opt);
    });
    const def = getSettings().defaultModel || 'nanobanan-2';
    const base = def.replace(/-(2k|4k)$/i, '');
    if ([...sel.options].some((o) => o.value === base)) sel.value = base;
    else if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    updateResolutionButtons();
    updateModelCostLabel();
  }

  function renderRefGrid() {
    const grid = $('nb-ref-grid');
    const countEl = $('nb-ref-count');
    if (!grid) return;

    grid.querySelectorAll('.nb-ref-thumb').forEach((el) => el.remove());
    referenceUrls.forEach((url, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'nb-ref-thumb';
      wrap.innerHTML = `<img src="${escapeHtml(url)}" alt="" /><button type="button" data-ref-rm="${idx}" aria-label="Удалить">×</button>`;
      grid.insertBefore(wrap, $('nb-ref-add'));
    });

    if (countEl) countEl.textContent = `${referenceUrls.length} / 9`;
    $('nb-ref-add')?.classList.toggle('hidden', referenceUrls.length >= 9);
    updateModelCostLabel();
  }

  async function addReferenceFiles() {
    const result = await window.api.nanobananaPickReferenceImages?.();
    if (!result?.ok || result.canceled) return;
    const urls = result.referenceImageUrls || [];
    referenceUrls = [...referenceUrls, ...urls].slice(0, 9);
    renderRefGrid();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function pasteImageFromClipboard() {
    try {
      const items = await navigator.clipboard.read?.();
      if (!items) return false;
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue;
          const blob = await item.getType(type);
          const dataUrl = await readFileAsDataUrl(blob);
          if (referenceUrls.length < 9) {
            referenceUrls.push(dataUrl);
            renderRefGrid();
          }
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }

  function getSelectedItem() {
    return gallery.find((g) => g.id === selectedItemId) || gallery[0] || null;
  }

  function getPreviewUrls(item) {
    if (!item?.imageUrls?.length) return [];
    return item.imageUrls;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      reader.readAsDataURL(blob);
    });
  }

  async function blobUrlToDataUrl(blobUrl) {
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return blobToDataUrl(await response.blob());
  }

  async function httpUrlToDataUrl(url) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.size > 6 * 1024 * 1024) {
      throw new Error('large-blob');
    }
    return blobToDataUrl(blob);
  }

  async function canvasUrlToDataUrl(url) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Не удалось загрузить превью'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен');
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function resolveImageDataUrl(url) {
    if (!url) throw new Error('Нет URL');
    if (String(url).startsWith('data:image/')) return url;

    const previewImg = $('nb-preview-img');
    if (previewImg?.src?.startsWith('blob:')) {
      try {
        return await blobUrlToDataUrl(previewImg.src);
      } catch { /* fall through */ }
    }

    try {
      return await httpUrlToDataUrl(url);
    } catch {
      if (previewImg?.complete && previewImg.naturalWidth > 0) {
        return canvasUrlToDataUrl(previewImg.src);
      }
      return canvasUrlToDataUrl(url);
    }
  }

  async function downloadSelectedImage() {
    const btn = $('nb-download');
    const item = getSelectedItem();
    const urls = getPreviewUrls(item);
    const url = urls[previewUrlIndex];
    if (!url) {
      alert('Нет изображения для сохранения');
      return;
    }

    const filename = `nanobanana-${item?.id || 'image'}.png`;
    const prevLabel = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
    }

    try {
      if (!window.api?.nanobananaDownloadImage) {
        throw new Error('API сохранения недоступен — перезапустите приложение');
      }

      let dataUrl = null;
      try {
        dataUrl = await resolveImageDataUrl(url);
      } catch (readErr) {
        console.warn('[NanoBanana] renderer read failed', readErr);
      }

      const res = await window.api.nanobananaDownloadImage(
        dataUrl
          ? { dataUrl, filename, generationId: item?.generationId || null }
          : { url, filename, generationId: item?.generationId || null },
      );

      if (res?.ok) {
        if (btn) btn.textContent = 'Сохранено';
        setTimeout(() => {
          if (btn) btn.textContent = prevLabel || 'Скачать';
        }, 1400);
        return;
      }
      if (res?.canceled) return;
      alert(res?.message || 'Не удалось скачать изображение');
    } catch (err) {
      console.error('[NanoBanana] download', err);
      alert(err?.message || 'Ошибка при сохранении');
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.textContent === 'Сохраняем…') btn.textContent = prevLabel || 'Скачать';
      }
    }
  }

  async function copySelectedImageLink() {
    const item = getSelectedItem();
    const url = getPreviewUrls(item)[previewUrlIndex];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      alert(url);
    }
  }

  async function deleteSelectedGalleryItem() {
    const item = getSelectedItem();
    if (!item) return;
    if (!window.confirm('Удалить из локальной галереи?')) return;
    const r = await window.api.nanobananaDeleteGalleryItem?.(item.id);
    if (r?.ok) {
      gallery = r.items || [];
      selectedItemId = gallery[0]?.id || null;
      renderGallery();
    }
  }

  function stopLoadingAnimation() {
    if (loadingHintTimer) {
      clearInterval(loadingHintTimer);
      loadingHintTimer = null;
    }
    $('nb-preview')?.classList.remove('is-generating');
    $('nb-generate')?.classList.remove('is-busy');
    const btnLabel = $('nb-generate-label');
    if (btnLabel) btnLabel.textContent = 'Сгенерировать';
  }

  function startLoadingAnimation() {
    stopLoadingAnimation();
    $('nb-preview')?.classList.add('is-generating');
    $('nb-generate')?.classList.add('is-busy');
    const btnLabel = $('nb-generate-label');
    if (btnLabel) btnLabel.textContent = 'Генерация…';

    let hintIdx = 0;
    const hintEl = $('nb-loading-hint');
    if (hintEl) hintEl.textContent = LOADING_HINTS[0];
    loadingHintTimer = setInterval(() => {
      hintIdx = (hintIdx + 1) % LOADING_HINTS.length;
      if (hintEl) hintEl.textContent = LOADING_HINTS[hintIdx];
    }, 2800);
  }

  function showNbError(message) {
    const el = $('nb-error');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    $('nb-warn')?.classList.add('hidden');
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function showNbWarn(message) {
    const el = $('nb-warn');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    $('nb-error')?.classList.add('hidden');
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function clearNbNotices() {
    showNbError('');
    showNbWarn('');
  }

  const FALLBACK_LABELS = {
    primary: 'исходные параметры',
    'without references': 'без референсов',
    'aspect 16:9': '16:9',
    '16:9 without references': '16:9 без референсов',
    'model 1K': '1K',
    '1K without references': '1K без референсов',
    '1K aspect 16:9': '1K, 16:9',
  };

  function fallbackNoticeText(label) {
    const human = FALLBACK_LABELS[label] || label || 'упрощённые параметры';
    return `Изображение создано с ${human} — первый запрос сервис не принял.`;
  }

  function showPreviewState(state) {
    $('nb-preview-empty')?.classList.toggle('hidden', state !== 'empty');
    $('nb-preview-loading')?.classList.toggle('hidden', state !== 'loading');
    $('nb-preview-result')?.classList.toggle('hidden', state !== 'result');
    const busy = state === 'loading';
    $('nb-meta')?.classList.toggle('hidden', busy || state === 'empty');
    $('nb-actions')?.classList.toggle('hidden', busy || state === 'empty');
    if (state !== 'loading') stopLoadingAnimation();
  }

  function renderPreview() {
    const item = getSelectedItem();
    if (!item?.imageUrls?.length) {
      showPreviewState('empty');
      return;
    }

    const urls = getPreviewUrls(item);
    if (previewUrlIndex >= urls.length) previewUrlIndex = 0;
    const url = urls[previewUrlIndex];

    showPreviewState('result');
    clearNbNotices();
    const img = $('nb-preview-img');

    $('nb-meta')?.classList.remove('hidden');
    $('nb-actions')?.classList.remove('hidden');
    const promptText = item.prompt || '';
    const promptEl = $('nb-meta-prompt');
    const promptWrap = $('nb-meta-prompt-wrap');
    if (promptEl) promptEl.textContent = promptText;
    if (promptWrap) {
      const long = promptText.length > 180 || promptText.split('\n').length > 3;
      promptWrap.open = long;
      promptWrap.classList.toggle('nb-meta-prompt-wrap--long', long);
    }
    const meta = getModelMeta(item.model);
    const resLabel = item.resolution || resolutionFromModel(item.model);
    const updateMetaSub = (pxLabel = '') => {
      $('nb-meta-sub').textContent = [
        meta?.displayName || item.model,
        resLabel,
        pxLabel,
        item.aspectRatio,
        new Date(item.createdAt).toLocaleString('ru-RU'),
      ].filter(Boolean).join(' · ');
    };
    updateMetaSub();

    $('nb-prev')?.classList.toggle('hidden', urls.length <= 1);
    $('nb-next')?.classList.toggle('hidden', urls.length <= 1);

    if (img) {
      img.onload = () => {
        if (img.naturalWidth > 0) {
          updateMetaSub(`${img.naturalWidth}×${img.naturalHeight}px`);
        }
      };
      img.src = url;
    }
  }

  function renderGallery() {
    const grid = $('nb-thumb-grid');
    if (!grid) return;
    grid.innerHTML = '';

    gallery.forEach((item) => {
      const url = item.imageUrls?.[0];
      if (!url) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `nb-thumb${item.id === selectedItemId ? ' is-active' : ''}`;
      btn.dataset.id = item.id;
      btn.innerHTML = `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`;
      grid.appendChild(btn);
    });

    if (!selectedItemId && gallery[0]) selectedItemId = gallery[0].id;
    renderPreview();
  }

  async function refreshCredits() {
    const el = $('nb-credits');
    if (!el || !hasApiKey()) {
      if (el) el.textContent = hasApiKey() ? '…' : '—';
      return;
    }
    try {
      const r = await window.api.nanobananaGetCredits?.();
      if (r?.ok) el.textContent = `${r.credits} кр.`;
      else el.textContent = '!';
    } catch {
      el.textContent = '!';
    }
  }

  async function loadModels() {
    if (!hasApiKey()) {
      modelFamilies = [{ id: 'nanobanan-2', label: 'Nano Banan 2', creditsCost: 3, requiresPro: true }];
      populateModelSelect();
      return;
    }
    const r = await window.api.nanobananaGetModels?.();
    if (r?.ok && r.models?.length) {
      models = r.models;
      modelFamilies = buildModelFamilies(models);
      populateModelSelect();
    }
  }

  async function loadGallery() {
    const r = await window.api.nanobananaGetGallery?.();
    if (r?.ok) {
      gallery = r.items || [];
      if (selectedItemId && !gallery.some((g) => g.id === selectedItemId)) {
        selectedItemId = gallery[0]?.id || null;
      }
      renderGallery();
    }
  }

  function applySettingsToUi() {
    const s = getSettings();
    const aspect = $('nb-aspect');
    if (aspect && s.defaultAspectRatio) aspect.value = s.defaultAspectRatio;
    resolution = s.defaultResolution || '1K';
    document.querySelectorAll('.nb-res-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.res === resolution);
    });
    numOutputs = Math.min(4, Math.max(1, s.numOutputs || 1));
    $('nb-out-val').textContent = String(numOutputs);
    $('nb-setup-banner')?.classList.toggle('hidden', hasApiKey());
    updateResolutionButtons();
    updateModelCostLabel();
  }

  async function compressReferenceDataUrl(dataUrl) {
    const raw = String(dataUrl || '').trim();
    if (!raw.startsWith('data:image/')) return raw;
    const base64 = raw.split(',')[1] || '';
    if (base64.length * 0.75 < 350_000) return raw;

    const img = document.createElement('img');
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('ref'));
      img.src = raw;
    });

    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, w, h);
    try {
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return raw;
    }
  }

  async function prepareReferenceUrls(urls) {
    const out = [];
    for (const url of urls) {
      try {
        out.push(await compressReferenceDataUrl(url));
      } catch {
        out.push(url);
      }
    }
    return out;
  }

  async function runGenerate() {
    if (generating) return { ok: false, message: 'Генерация уже выполняется' };
    const prompt = $('nb-prompt')?.value?.trim();
    if (!prompt) {
      showNbError('Введите промпт');
      return { ok: false, message: 'Введите промпт' };
    }
    if (!hasApiKey()) {
      showNbError('Укажите API-ключ NanoBanana в настройках');
      return { ok: false, message: 'Укажите API-ключ NanoBanana в настройках' };
    }

    generating = true;
    const btn = $('nb-generate');
    if (btn) btn.disabled = true;
    showNbError('');
    showNbWarn('');
    showPreviewState('loading');
    startLoadingAnimation();

    try {
      const model = getResolvedModelId();
      if (!model) {
        showNbError(`${resolution} недоступно для выбранной модели`);
        showPreviewState(gallery.length ? 'result' : 'empty');
        generating = false;
        if (btn) btn.disabled = false;
        stopLoadingAnimation();
        return { ok: false, message: `${resolution} недоступно для выбранной модели` };
      }
      const meta = getModelMeta(model);
      const aspectRatio = $('nb-aspect')?.value || getSettings().defaultAspectRatio || 'auto';
      let refs = meta?.supportsImageInput === false ? [] : referenceUrls.slice();
      if (refs.length) refs = await prepareReferenceUrls(refs);
      const payload = {
        prompt,
        model,
        resolution,
        aspectRatio,
        numOutputs,
        mode: getSettings().requestMode || 'sync',
        referenceImageUrls: refs.length ? refs : undefined,
      };

      const result = await window.api.nanobananaGenerate?.(payload);
      if (!result?.ok) {
        showNbError(result?.message || 'Ошибка генерации');
        showPreviewState(gallery.length ? 'result' : 'empty');
        return { ok: false, message: result?.message || 'Ошибка генерации' };
      }

      clearNbNotices();

      const usedModel = result.modelUsed || result.model || model;
      if (resolution !== '1K' && resolutionFromModel(usedModel) !== resolution) {
        showNbWarn(`Запрошено ${resolution}, но сервис использовал модель ${usedModel}. Проверьте референсы и соотношение сторон.`);
      } else if (result.usedFallback) {
        showNbWarn(fallbackNoticeText(result.usedFallback));
      }

      if (result.galleryItem) {
        gallery.unshift(result.galleryItem);
        selectedItemId = result.galleryItem.id;
        previewUrlIndex = 0;
      } else {
        await loadGallery();
      }

      renderGallery();
      refreshCredits();

      if (result.galleryItem?.id) {
        window.syncBannerMockupFromNanobanana?.({
          galleryItemId: result.galleryItem.id,
          navigate: true,
        }).catch(() => { /* optional */ });
      }

      if (result.remainingCredits != null) {
        const el = $('nb-credits');
        if (el) el.textContent = `${result.remainingCredits} кр.`;
      }
      return result;
    } catch (err) {
      showNbError(err.message || 'Ошибка');
      showPreviewState(gallery.length ? 'result' : 'empty');
      return { ok: false, message: err.message || 'Ошибка' };
    } finally {
      generating = false;
      if (btn) btn.disabled = false;
    }
  }

  function bindEvents() {
    $('nb-generate')?.addEventListener('click', runGenerate);

    $('nb-model')?.addEventListener('change', () => {
      updateResolutionButtons();
      updateModelCostLabel();
    });

    $('nb-resolution')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.nb-res-btn');
      if (!btn) return;
      resolution = btn.dataset.res || '1K';
      if (!familySupportsResolution(getSelectedFamilyId(), resolution)) return;
      document.querySelectorAll('.nb-res-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      updateModelCostLabel();
      window.api.updateAppSettings?.({
        nanobanana: { ...getSettings(), defaultResolution: resolution },
      }).then(() => {
        if (window.appSettings?.nanobanana) window.appSettings.nanobanana.defaultResolution = resolution;
      }).catch(() => { /* ignore */ });
    });

    $('nb-aspect')?.addEventListener('change', () => {
      const aspect = $('nb-aspect')?.value || 'auto';
      window.api.updateAppSettings?.({
        nanobanana: { ...getSettings(), defaultAspectRatio: aspect },
      }).then(() => {
        if (window.appSettings?.nanobanana) window.appSettings.nanobanana.defaultAspectRatio = aspect;
      }).catch(() => { /* ignore */ });
    });

    $('nb-out-minus')?.addEventListener('click', () => {
      numOutputs = Math.max(1, numOutputs - 1);
      $('nb-out-val').textContent = String(numOutputs);
    });
    $('nb-out-plus')?.addEventListener('click', () => {
      numOutputs = Math.min(4, numOutputs + 1);
      $('nb-out-val').textContent = String(numOutputs);
    });

    $('nb-ref-add')?.addEventListener('click', addReferenceFiles);

    $('nb-ref-grid')?.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-ref-rm]');
      if (!rm) return;
      const idx = Number(rm.getAttribute('data-ref-rm'));
      referenceUrls.splice(idx, 1);
      renderRefGrid();
    });

    $('nb-thumb-grid')?.addEventListener('click', (e) => {
      const thumb = e.target.closest('.nb-thumb');
      if (!thumb) return;
      selectedItemId = thumb.dataset.id;
      previewUrlIndex = 0;
      renderGallery();
    });

    $('nb-prev')?.addEventListener('click', () => {
      const urls = getPreviewUrls(getSelectedItem());
      if (urls.length <= 1) return;
      previewUrlIndex = (previewUrlIndex - 1 + urls.length) % urls.length;
      renderPreview();
    });
    $('nb-next')?.addEventListener('click', () => {
      const urls = getPreviewUrls(getSelectedItem());
      if (urls.length <= 1) return;
      previewUrlIndex = (previewUrlIndex + 1) % urls.length;
      renderPreview();
    });

    $('nb-actions')?.addEventListener('click', (e) => {
      if (e.target.closest('#nb-download')) {
        e.preventDefault();
        downloadSelectedImage();
        return;
      }
      if (e.target.closest('#nb-to-mockup')) {
        e.preventDefault();
        const item = getSelectedItem();
        window.syncBannerMockupFromNanobanana?.({
          galleryItemId: item?.id || null,
          navigate: true,
        });
        return;
      }
      if (e.target.closest('#nb-copy-link')) {
        e.preventDefault();
        copySelectedImageLink();
        return;
      }
      if (e.target.closest('#nb-use-prompt')) {
        e.preventDefault();
        const item = getSelectedItem();
        if (item?.prompt && $('nb-prompt')) $('nb-prompt').value = item.prompt;
        return;
      }
      if (e.target.closest('#nb-delete')) {
        e.preventDefault();
        deleteSelectedGalleryItem();
      }
    });

    document.querySelectorAll('[data-nb-open-settings]').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelector('.nav-item[data-page="settings"]')?.click();
        setTimeout(() => {
          document.getElementById('settings-nanobanana')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      });
    });

    $('nb-prompt')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runGenerate();
      }
    });

    $('nb-prompt')?.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        e.preventDefault();
        const file = item.getAsFile();
        if (!file || referenceUrls.length >= 9) return;
        try {
          referenceUrls.push(await readFileAsDataUrl(file));
          renderRefGrid();
        } catch { /* ignore */ }
        return;
      }
    });

    document.addEventListener('paste', async (e) => {
      if (!$('page-nanobanana')?.classList.contains('active')) return;
      if (e.target === $('nb-prompt')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        e.preventDefault();
        const file = item.getAsFile();
        if (!file || referenceUrls.length >= 9) return;
        try {
          referenceUrls.push(await readFileAsDataUrl(file));
          renderRefGrid();
        } catch { /* ignore */ }
        break;
      }
    });
  }

  window.getNanobananaStagedRefs = function getNanobananaStagedRefs() {
    return referenceUrls.slice();
  };

  window.getNanobananaGenerateOptions = function getNanobananaGenerateOptions() {
    return {
      model: getResolvedModelId(),
      aspectRatio: $('nb-aspect')?.value || getSettings().defaultAspectRatio || 'auto',
      resolution,
    };
  };

  window.syncNanobananaFromAgent = async function syncNanobananaFromAgent({
    prompt = '',
    galleryItemId = null,
    navigate = true,
    autoGenerate = false,
  } = {}) {
    if (prompt && $('nb-prompt')) {
      $('nb-prompt').value = prompt;
    }
    if (navigate) {
      document.querySelector('.nav-item[data-page="nanobanana"]')?.click();
      await window.activateNanobananaPage?.();
    }
    await loadGallery();
    if (galleryItemId && gallery.some((g) => g.id === galleryItemId)) {
      selectedItemId = galleryItemId;
    } else if (gallery[0]) {
      selectedItemId = gallery[0].id;
    }
    renderGallery();
    renderRefGrid();

    if (autoGenerate) {
      return runGenerate();
    }
    return { ok: true };
  };

  window.activateNanobananaPage = async function activateNanobananaPage() {
    window.detachMetaskBoard?.();
    window.detachMailView?.();
    applySettingsToUi();
    await Promise.all([loadModels(), loadGallery(), refreshCredits()]);
    showPreviewState(gallery.length ? 'result' : 'empty');
  };

  function initNanobanana() {
    if (!$('page-nanobanana')) return;
    applySettingsToUi();
    renderRefGrid();
    bindEvents();
    showPreviewState('empty');
  }

  window.initNanobanana = initNanobanana;

  window.api.onConfig?.(() => {
    applySettingsToUi();
    if ($('page-nanobanana')?.classList.contains('active')) {
      loadModels();
      refreshCredits();
    }
  });
})();
