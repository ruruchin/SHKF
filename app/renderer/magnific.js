const magnificConnectBtn = document.getElementById('magnific-connect-btn');
const magnificDisconnectBtn = document.getElementById('magnific-disconnect-btn');
const magnificStatusText = document.getElementById('magnific-status-text');
const magnificStatusHint = document.getElementById('magnific-status-hint');
const magnificStatusIndicator = document.querySelector('#magnific-status-panel .status-indicator');
const magnificToolsContainer = document.getElementById('magnific-tools-container');
const magnificSessionBanner = document.getElementById('magnific-session-banner');
const magnificToolsList = document.getElementById('magnific-tools-list');
const magnificToolTitle = document.getElementById('magnific-tool-title');
const magnificToolFormContainer = document.getElementById('magnific-tool-form-container');
const magnificToolResult = document.getElementById('magnific-tool-result');
const magnificToolsSearch = document.getElementById('magnific-tools-search');
const magnificToolsFilters = document.getElementById('magnific-tools-filters');
const magnificToolsCount = document.getElementById('magnific-tools-count');

let currentTools = [];
let toolsByName = new Map();
let selectedTool = null;
let toolsLoaded = false;
let activeToolCategory = 'all';

const QUICK_TOOLS = {
  image: 'images_generate',
  video: 'video_generate',
  upscale: 'images_upscale',
  removeBg: 'images_remove_background',
  history: 'creations_search',
};

let magnificReferenceImages = [];
let lastMagnificCreation = null;

function setMagnificResult(html) {
  magnificToolResult.innerHTML = html || buildResultPlaceholder();
}

function setMagnificBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="magnific-loading"></span>${text || 'Выполняется...'}`;
    return;
  }
  button.disabled = false;
  button.textContent = button.dataset.originalText || text || 'Выполнить';
}

function needsMagnificRelogin(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('access denied') || text.includes('сессия') || text.includes('не вошли') || text.includes('войти');
}

function magnificErrorHtml(message) {
  const body = escapeHtml(message || 'Ошибка Magnific');
  const relogin = needsMagnificRelogin(message)
    ? '<p class="magnific-error-actions"><button type="button" class="magnific-secondary magnific-relogin-btn">Выйти и войти снова</button></p>'
    : '';
  return `<div class="magnific-error">${body}${relogin}</div>`;
}

function updateSessionBanner(status = {}) {
  if (!magnificSessionBanner) return;
  const isConnected = Boolean(status.isConnected);
  if (isConnected) {
    magnificSessionBanner.classList.add('hidden');
    magnificSessionBanner.innerHTML = '';
    magnificToolsContainer?.classList.remove('magnific-tools-container--offline');
    return;
  }

  magnificToolsContainer?.classList.add('magnific-tools-container--offline');
  magnificSessionBanner.classList.remove('hidden');
  const detail = status.lastConnectError
    ? `<p class="magnific-session-banner-detail">${escapeHtml(status.lastConnectError)}</p>`
    : '';
  magnificSessionBanner.innerHTML = `
    <strong>Сначала активируйте сессию Magnific</strong>
    <p>Кнопка «Сгенерировать» сработает только после зелёного статуса «MCP активен». Нажмите «Активировать вход» или «Войти заново».</p>
    ${detail}
  `;
}

async function checkMagnificStatus() {
  const res = await window.api.magnificStatus();
  updateMagnificUI(res);

  if (res.isConnected) {
    await loadMagnificTools();
    return;
  }

  if (res.hasSavedLogin) {
    await connectMagnific({ silent: true, restoreOnly: true });
  }
}

function updateMagnificUI(status = {}) {
  const isConnected = Boolean(status.isConnected);
  const hasSavedLogin = Boolean(status.hasSavedLogin);

  magnificStatusIndicator.classList.toggle('connected', isConnected);
  if (magnificToolsContainer) {
    magnificToolsContainer.style.display = 'flex';
  }
  updateSessionBanner(status);

  if (isConnected) {
    magnificStatusText.textContent = 'Вход выполнен — Magnific MCP активен';
    magnificStatusHint.textContent = 'Можно нажимать «Сгенерировать изображение».';
    magnificConnectBtn.hidden = true;
    magnificDisconnectBtn.hidden = false;
    return;
  }

  magnificConnectBtn.hidden = false;
  magnificDisconnectBtn.hidden = !hasSavedLogin;
  magnificConnectBtn.disabled = false;
  magnificConnectBtn.textContent = hasSavedLogin ? 'Активировать вход' : 'Войти в Magnific';

  if (hasSavedLogin) {
    magnificStatusText.textContent = 'Вход сохранён, но MCP не подключён';
    const err = status.lastConnectError ? ` Причина: ${status.lastConnectError}` : '';
    magnificStatusHint.textContent =
      `Нажмите «Активировать вход». Если снова пусто — «Выйти», затем «Войти в Magnific» и дождитесь «Готово!».${err}`;
  } else {
    magnificStatusText.textContent = 'Вы ещё не вошли в Magnific';
    magnificStatusHint.textContent =
      '1) «Войти в Magnific». 2) Войдите на magnific.ai. 3) Дождитесь «Готово!» — только потом закрывайте окно.';
  }
}

async function ensureMagnificSession({ openLoginIfNeeded = true } = {}) {
  let status = await window.api.magnificStatus();
  if (status.isConnected) return true;

  setMagnificResult('<div class="magnific-note">Подключаю Magnific MCP…</div>');
  let res = await window.api.magnificConnect({});
  status = await window.api.magnificStatus();
  updateMagnificUI(status);

  if (res.ok) {
    toolsLoaded = false;
    await loadMagnificTools();
    return true;
  }

  if (openLoginIfNeeded && status.hasSavedLogin) {
    setMagnificResult('<div class="magnific-note">Пробую обновить вход в Magnific…</div>');
    res = await window.api.magnificConnect({ forceLogin: true });
    status = await window.api.magnificStatus();
    updateMagnificUI(status);
    if (res.ok) {
      toolsLoaded = false;
      await loadMagnificTools();
      return true;
    }
  }

  setMagnificResult(magnificErrorHtml(res.message || status.lastConnectError || 'Не удалось подключить Magnific MCP'));
  return false;
}

async function disconnectMagnific() {
  toolsLoaded = false;
  currentTools = [];
  toolsByName = new Map();
  await window.api.magnificDisconnect();
  const res = await window.api.magnificStatus();
  updateMagnificUI(res);
  setMagnificResult('<div class="magnific-note">Выход из Magnific выполнен. Для генерации снова нажмите «Войти в Magnific».</div>');
}

async function connectMagnific({ forceLogin = false, silent = false, restoreOnly = false } = {}) {
  if (!silent) {
    setMagnificBusy(magnificConnectBtn, true, forceLogin ? 'Открываю вход...' : 'Подключаю...');
    setMagnificResult(
      '<div class="magnific-note">Сейчас откроется окно Magnific (если вход ещё не сохранён). Дождитесь «Готово!» перед закрытием окна.</div>',
    );
  }

  try {
    const res = await window.api.magnificConnect({ forceLogin });
    if (!res.ok) throw new Error(res.message || res.lastConnectError || 'Не удалось подключиться');
    toolsLoaded = false;
    updateMagnificUI(res);
    await loadMagnificTools();
    if (!silent) {
      setMagnificResult('<div class="magnific-success">Magnific подключен. Можно нажимать «Сгенерировать изображение».</div>');
    }
  } catch (e) {
    const status = await window.api.magnificStatus();
    updateMagnificUI(status);
    if (!silent || !restoreOnly) {
      setMagnificResult(magnificErrorHtml(e.message || String(e)));
    }
  } finally {
    setMagnificBusy(magnificConnectBtn, false);
  }
}

async function loadMagnificTools() {
  if (toolsLoaded) return;
  magnificToolsList.innerHTML = '<li class="magnific-tool-empty">Загрузка инструментов...</li>';
  const res = await window.api.magnificGetTools();
  if (!res.ok) {
    magnificToolsList.innerHTML = `<li class="magnific-tool-empty">Ошибка: ${escapeHtml(res.message)}</li>`;
    updateMagnificUI(await window.api.magnificStatus());
    return;
  }
  currentTools = Array.isArray(res.tools) ? res.tools : [];
  toolsByName = new Map(currentTools.map((tool) => [tool.name, tool]));
  toolsLoaded = true;
  renderToolsList();
  fillModelSelects();
  await refreshMagnificModels('image');
  await refreshMagnificModels('video');
}

function renderToolsList() {
  const query = String(magnificToolsSearch?.value || '').trim().toLowerCase();
  const allMetas = currentTools.map((tool) => ({ tool, meta: getMagnificToolMeta(tool) }));
  renderToolFilters(allMetas);
  const filtered = allMetas.filter(({ tool, meta }) => {
    const categoryOk = activeToolCategory === 'all' || meta.kind === activeToolCategory;
    const text = `${tool.name} ${meta.category} ${meta.title} ${meta.description} ${tool.description || ''}`.toLowerCase();
    return categoryOk && (!query || text.includes(query));
  });

  magnificToolsList.innerHTML = '';
  if (magnificToolsCount) {
    magnificToolsCount.textContent = `${filtered.length} / ${currentTools.length}`;
  }
  if (!filtered.length) {
    magnificToolsList.innerHTML = '<div class="magnific-tool-empty">Ничего не найдено. Попробуйте другой запрос или фильтр.</div>';
    return;
  }

  filtered.forEach(({ tool, meta }, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `magnific-tool-item magnific-tool-item--${meta.kind}`;
    card.style.setProperty('--i', String(index));
    card.innerHTML = `
      <span class="magnific-tool-icon" aria-hidden="true">${meta.icon}</span>
      <span class="magnific-tool-body">
        <span class="magnific-tool-kicker">${escapeHtml(meta.category)}</span>
        <span class="magnific-tool-name">${escapeHtml(meta.title)}</span>
        <span class="magnific-tool-desc">${escapeHtml(meta.description)}</span>
        <span class="magnific-tool-code">${escapeHtml(tool.name)}</span>
      </span>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.magnific-tool-item').forEach((el) => el.classList.remove('active'));
      card.classList.add('active');
      selectTool(tool);
    });
    magnificToolsList.appendChild(card);
  });
}

function renderToolFilters(toolMetas) {
  if (!magnificToolsFilters) return;
  const counts = new Map();
  for (const { meta } of toolMetas) {
    counts.set(meta.kind, (counts.get(meta.kind) || 0) + 1);
  }
  const filters = [
    ['all', 'Все', currentTools.length],
    ['image', 'Изображения', counts.get('image') || 0],
    ['video', 'Видео', counts.get('video') || 0],
    ['history', 'История', counts.get('history') || 0],
    ['reference', 'Референсы', counts.get('reference') || 0],
    ['account', 'Аккаунт', counts.get('account') || 0],
    ['folder', 'Папки', counts.get('folder') || 0],
    ['space', 'Spaces', counts.get('space') || 0],
    ['audio', 'Аудио', counts.get('audio') || 0],
    ['model3d', '3D', counts.get('model3d') || 0],
    ['tool', 'Другое', counts.get('tool') || 0],
  ].filter(([, , count]) => count > 0);

  magnificToolsFilters.innerHTML = filters.map(([id, label, count]) => `
    <button type="button" class="magnific-filter${activeToolCategory === id ? ' active' : ''}" data-tool-category="${id}">
      ${escapeHtml(label)} <span>${count}</span>
    </button>
  `).join('');

  magnificToolsFilters.querySelectorAll('[data-tool-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeToolCategory = btn.dataset.toolCategory || 'all';
      renderToolsList();
    });
  });
}

function fillModelSelects() {
  const imageSelect = document.getElementById('magnific-image-model');
  const videoSelect = document.getElementById('magnific-video-model');
  fillSelect(imageSelect, [
    ['', 'Авто'],
  ]);
  fillSelect(videoSelect, [
    ['', 'Авто'],
  ]);
}

async function refreshMagnificModels(kind) {
  const toolName = kind === 'video' ? 'video_models_list' : 'images_models_list';
  const select = document.getElementById(kind === 'video' ? 'magnific-video-model' : 'magnific-image-model');
  if (!select || !toolsByName.has(toolName)) return;

  const previous = select.value;
  fillSelect(select, [['', 'Загрузка...']]);
  try {
    const result = await callMagnificTool(toolName, {});
    const models = extractModelsFromResult(result);
    const options = [['', 'Авто'], ...models.map((model) => [model.id, model.label])];
    fillSelect(select, options);
    if (previous && models.some((model) => model.id === previous)) select.value = previous;
  } catch {
    fillSelect(select, [['', 'Авто']]);
  }
}

function fillSelect(select, options) {
  if (!select) return;
  select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
}

function switchMagnificMode(mode) {
  document.querySelectorAll('.magnific-mode').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.magnificMode === mode);
  });
  document.querySelectorAll('[data-magnific-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.magnificPanel !== mode);
  });
  setMagnificResult('');
}

async function callMagnificTool(name, args = {}) {
  if (!toolsLoaded) await loadMagnificTools();
  if (!toolsByName.has(name)) {
    throw new Error(`Magnific не вернул инструмент ${name}. Откройте "Все инструменты", чтобы посмотреть доступные.`);
  }
  const res = await window.api.magnificCallTool({ name, arguments: args });
  if (!res.ok) throw new Error(res.message || 'Ошибка Magnific');
  return res.result;
}

async function runImageGenerate() {
  const btn = document.getElementById('magnific-generate-image');
  const prompt = document.getElementById('magnific-image-prompt')?.value.trim();
  if (!prompt) {
    setMagnificResult('<div class="magnific-error">Напишите промпт для изображения.</div>');
    return;
  }

  const args = compactArgs({
    prompt,
    model: document.getElementById('magnific-image-model')?.value,
    aspect_ratio: document.getElementById('magnific-image-aspect')?.value,
    aspectRatio: document.getElementById('magnific-image-aspect')?.value,
    num_outputs: Number(document.getElementById('magnific-image-count')?.value || 1),
    numOutputs: Number(document.getElementById('magnific-image-count')?.value || 1),
    count: Number(document.getElementById('magnific-image-count')?.value || 1),
    references: magnificReferenceImages.map((img) => img.dataUrl),
    reference_images: magnificReferenceImages.map((img) => img.dataUrl),
    referenceImages: magnificReferenceImages.map((img) => img.dataUrl),
    reference_image_urls: magnificReferenceImages.map((img) => img.dataUrl),
    referenceImageUrls: magnificReferenceImages.map((img) => img.dataUrl),
    images: magnificReferenceImages.map((img) => img.dataUrl),
  });

  await runQuickTool(btn, QUICK_TOOLS.image, args, 'Генерирую изображение...');
}

async function runVideoGenerate() {
  const btn = document.getElementById('magnific-generate-video');
  const prompt = document.getElementById('magnific-video-prompt')?.value.trim();
  if (!prompt) {
    setMagnificResult('<div class="magnific-error">Напишите промпт для видео.</div>');
    return;
  }

  const args = compactArgs({
    prompt,
    model: document.getElementById('magnific-video-model')?.value,
  });

  await runQuickTool(btn, QUICK_TOOLS.video, args, 'Генерирую видео...');
}

async function runUpscale() {
  const btn = document.getElementById('magnific-upscale-image');
  const source = document.getElementById('magnific-upscale-source')?.value.trim();
  if (!source) {
    setMagnificResult('<div class="magnific-error">Укажите Creation ID или URL изображения.</div>');
    return;
  }

  const args = compactArgs({
    creation_id: source,
    creationId: source,
    id: source,
    image_url: /^https?:\/\//i.test(source) ? source : '',
    imageUrl: /^https?:\/\//i.test(source) ? source : '',
    url: /^https?:\/\//i.test(source) ? source : '',
    prompt: document.getElementById('magnific-upscale-prompt')?.value.trim(),
  });

  await runQuickTool(btn, QUICK_TOOLS.upscale, args, 'Запускаю апскейл...');
}

async function runRemoveBackground({ useLast = false } = {}) {
  const btn = useLast ? document.getElementById('magnific-remove-bg-last') : document.getElementById('magnific-remove-bg');
  const sourceInput = document.getElementById('magnific-remove-bg-source');
  const source = useLast
    ? (lastMagnificCreation?.identifier || lastMagnificCreation?.webUrl || '')
    : sourceInput?.value.trim();

  if (!source) {
    setMagnificResult('<div class="magnific-error">Нет изображения для удаления фона. Сначала сгенерируйте картинку или укажите Creation ID / URL.</div>');
    return;
  }

  const isUrl = /^https?:\/\//i.test(source);
  const args = compactArgs({
    creation_id: isUrl ? '' : source,
    creationId: isUrl ? '' : source,
    id: isUrl ? '' : source,
    image_url: isUrl ? source : '',
    imageUrl: isUrl ? source : '',
    url: isUrl ? source : '',
  });

  await runQuickTool(btn, QUICK_TOOLS.removeBg, args, 'Вырезаю фон...');
}

async function runHistorySearch() {
  const btn = document.getElementById('magnific-search-history');
  const query = document.getElementById('magnific-history-query')?.value.trim();
  await runQuickTool(btn, QUICK_TOOLS.history, compactArgs({ query }), 'Ищу...');
}

async function runQuickTool(button, toolName, args, busyText) {
  if (!(await ensureMagnificSession())) {
    return;
  }

  setMagnificBusy(button, true, busyText);
  setMagnificResult('<div class="magnific-note">Запрос отправлен в Magnific. Если создание долгое, в результате будет ID, который можно проверить через историю.</div>');
  try {
    const result = await callMagnificTool(toolName, fitArgsToToolSchema(toolName, args));
    rememberLastCreation(result);
    renderToolResult(result);
  } catch (e) {
    const status = await window.api.magnificStatus();
    updateMagnificUI(status);
    setMagnificResult(magnificErrorHtml(e.message || String(e)));
  } finally {
    setMagnificBusy(button, false);
  }
}

function selectTool(tool) {
  selectedTool = tool;
  const meta = getMagnificToolMeta(tool);
  magnificToolTitle.textContent = `${meta.title} · ${tool.name}`;
  setMagnificResult('');
  renderToolForm(tool);
  magnificToolFormContainer?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderToolForm(tool) {
  magnificToolFormContainer.innerHTML = '';
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) {
    magnificToolFormContainer.innerHTML = '<p class="magnific-note">Этот инструмент не требует параметров.</p>';
  } else {
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const group = document.createElement('label');
      group.className = 'magnific-field';
      const required = schema.required?.includes(key);
      group.innerHTML = `<span>${escapeHtml(key)}${required ? ' *' : ''}</span>`;
      group.appendChild(createInputForProperty(key, prop, required));
      magnificToolFormContainer.appendChild(group);
    });
  }

  const submitBtn = document.createElement('button');
  submitBtn.className = 'magnific-primary';
  submitBtn.textContent = 'Выполнить инструмент';
  submitBtn.addEventListener('click', () => submitToolForm(tool, submitBtn));
  magnificToolFormContainer.appendChild(submitBtn);
}

function createInputForProperty(key, prop, required) {
  let input;
  if (prop.enum) {
    input = document.createElement('select');
    input.name = key;
    if (!required) input.appendChild(new Option('Не выбрано', ''));
    prop.enum.forEach((val) => input.appendChild(new Option(val, val)));
  } else if (prop.type === 'boolean') {
    input = document.createElement('select');
    input.name = key;
    input.appendChild(new Option('Не выбрано', ''));
    input.appendChild(new Option('Да', 'true'));
    input.appendChild(new Option('Нет', 'false'));
  } else if (prop.type === 'number' || prop.type === 'integer') {
    input = document.createElement('input');
    input.type = 'number';
    input.name = key;
  } else if (key.includes('prompt') || prop.description?.toLowerCase().includes('prompt')) {
    input = document.createElement('textarea');
    input.name = key;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.name = key;
  }
  if (prop.default !== undefined) input.value = prop.default;
  if (required) input.required = true;
  if (prop.description) input.placeholder = prop.description;
  return input;
}

async function submitToolForm(tool, submitBtn) {
  const inputs = magnificToolFormContainer.querySelectorAll('input, select, textarea');
  const args = {};
  let valid = true;

  inputs.forEach((input) => {
    if (input.required && !input.value) {
      valid = false;
      input.classList.add('is-invalid');
      return;
    }
    input.classList.remove('is-invalid');
    if (input.value === '') return;
    let val = input.value;
    if (input.type === 'number') val = Number(val);
    if (val === 'true') val = true;
    if (val === 'false') val = false;
    args[input.name] = val;
  });

  if (!valid) return;
  await runQuickTool(submitBtn, tool.name, args, 'Выполняю...');
}

function renderToolResult(result) {
  magnificToolResult.innerHTML = '<div class="magnific-result-head"><h4>Результат</h4><span>Сгенерированные изображения, видео и JSON-ответы появятся здесь</span></div>';
  const content = Array.isArray(result?.content) ? result.content : [];
  if (!content.length) {
    appendJsonResult(result);
    return;
  }

  content.forEach((item) => {
    if (item.type === 'text') {
      appendTextOrJson(item.text);
    } else if (item.type === 'image') {
      const img = document.createElement('img');
      img.className = 'magnific-result-image';
      img.src = `data:${item.mimeType || 'image/png'};base64,${item.data}`;
      appendMediaFrame(img);
    } else {
      appendJsonResult(item);
    }
  });
}

function appendTextOrJson(text) {
  try {
    appendJsonResult(JSON.parse(text));
  } catch {
    const pre = document.createElement('pre');
    pre.className = 'magnific-result-content';
    pre.textContent = text;
    magnificToolResult.appendChild(pre);
  }
}

function appendJsonResult(value) {
  const pre = document.createElement('pre');
  pre.className = 'magnific-result-content';
  pre.textContent = JSON.stringify(value, null, 2);
  magnificToolResult.appendChild(pre);
}

async function pickMagnificReferences() {
  const res = await window.api.magnificPickReferenceImages();
  if (!res.ok) return;
  magnificReferenceImages = Array.isArray(res.images) ? res.images : [];
  renderReferenceImages();
}

function renderReferenceImages() {
  const holder = document.getElementById('magnific-image-refs');
  if (!holder) return;
  if (!magnificReferenceImages.length) {
    holder.className = 'magnific-refs empty';
    holder.textContent = 'Референсы не выбраны';
    return;
  }
  holder.className = 'magnific-refs';
  holder.innerHTML = magnificReferenceImages.map((img, index) => `
    <div class="magnific-ref-chip">
      <img src="${escapeHtml(img.dataUrl)}" alt="" />
      <span>${escapeHtml(img.name || `ref-${index + 1}`)}</span>
      <button type="button" data-ref-index="${index}" aria-label="Удалить референс">×</button>
    </div>
  `).join('');
  holder.querySelectorAll('[data-ref-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      magnificReferenceImages.splice(Number(btn.dataset.refIndex), 1);
      renderReferenceImages();
    });
  });
}

function rememberLastCreation(result) {
  const data = extractJsonPayloads(result);
  for (const payload of data) {
    const creation = findCreationLike(payload);
    if (!creation) continue;
    lastMagnificCreation = {
      identifier: creation.identifier || creation.id || creation.creation_id || creation.creationId || '',
      webUrl: creation.webUrl || creation.web_url || creation.url || '',
    };
    const removeInput = document.getElementById('magnific-remove-bg-source');
    const upscaleInput = document.getElementById('magnific-upscale-source');
    const preferred = lastMagnificCreation.identifier || lastMagnificCreation.webUrl;
    if (preferred && removeInput && !removeInput.value) removeInput.value = preferred;
    if (preferred && upscaleInput && !upscaleInput.value) upscaleInput.value = preferred;
    return;
  }
}

function findCreationLike(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.identifier || value.creation_id || value.creationId || value.webUrl || value.web_url) return value;
  if (Array.isArray(value.creations) && value.creations[0]) return findCreationLike(value.creations[0]);
  if (Array.isArray(value.data) && value.data[0]) return findCreationLike(value.data[0]);
  if (Array.isArray(value.results) && value.results[0]) return findCreationLike(value.results[0]);
  return null;
}

function extractModelsFromResult(result) {
  const payloads = extractJsonPayloads(result);
  const seen = new Set();
  const models = [];

  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value.models)) visit(value.models);
    if (Array.isArray(value.data)) visit(value.data);
    if (Array.isArray(value.items)) visit(value.items);

    const id = value.id || value.identifier || value.name || value.slug || value.model;
    if (!id || seen.has(String(id))) return;
    seen.add(String(id));
    models.push({
      id: String(id),
      label: String(value.displayName || value.display_name || value.title || value.name || id),
    });
  };

  payloads.forEach(visit);
  return models.slice(0, 80);
}

function extractJsonPayloads(result) {
  const payloads = [];
  if (result && typeof result === 'object') payloads.push(result);
  const content = Array.isArray(result?.content) ? result.content : [];
  for (const item of content) {
    if (item?.type !== 'text' || !item.text) continue;
    try {
      payloads.push(JSON.parse(item.text));
    } catch {
      const match = String(item.text).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) continue;
      try {
        payloads.push(JSON.parse(match[0]));
      } catch {
        /* ignore */
      }
    }
  }
  return payloads;
}

function appendMediaFrame(node) {
  const frame = document.createElement('div');
  frame.className = 'magnific-media-frame magnific-media-frame--filled';
  frame.appendChild(node);
  magnificToolResult.appendChild(frame);
}

function buildResultPlaceholder() {
  return `
    <div class="magnific-result-head">
      <h4>Область результата</h4>
      <span>Здесь появится сгенерированная картинка, видео или ответ Magnific</span>
    </div>
    <div class="magnific-media-frame">
      <div class="magnific-media-orb" aria-hidden="true"></div>
      <div class="magnific-media-empty">
        <strong>Пока пусто</strong>
        <span>Заполните форму сверху и нажмите кнопку генерации.</span>
      </div>
    </div>
  `;
}

function getMagnificToolMeta(tool) {
  const name = String(tool?.name || '');
  const rawDescription = String(tool?.description || '').replace(/\s+/g, ' ').trim();
  const fallback = rawDescription || 'Расширенный инструмент Magnific MCP.';
  const map = [
    [/^account_/, 'account', 'Аккаунт', '◎', 'Баланс и тариф', 'Проверить кредиты, план и доступные возможности аккаунта.'],
    [/^project_/, 'account', 'Аккаунт', '◎', 'Отчет по проекту', 'Посмотреть расход и статистику использования Magnific.'],
    [/^images_generate_svg$/, 'image', 'Изображения', '◇', 'Генерация SVG', 'Создать векторную графику по промпту.'],
    [/^images_to_svg$/, 'image', 'Изображения', '◇', 'Растр в SVG', 'Преобразовать обычную картинку в векторный SVG.'],
    [/^images_generate$/, 'image', 'Изображения', '✦', 'Генерация изображения', 'Создать изображение по текстовому промпту и референсам.'],
    [/^images_upscale$/, 'image', 'Изображения', '⬡', 'Апскейл изображения', 'Увеличить и улучшить качество готового изображения.'],
    [/^images_crop$/, 'image', 'Изображения', '◱', 'Умный кроп', 'Обрезать изображение под нужный кадр без ручной возни.'],
    [/^images_resize$/, 'image', 'Изображения', '↔', 'Ресайз', 'Изменить размер изображения.'],
    [/^images_remove_background$/, 'image', 'Изображения', '◌', 'Удаление фона', 'Сделать прозрачную вырезку объекта.'],
    [/^images_models_/, 'image', 'Изображения', '▦', 'Модели изображений', 'Посмотреть доступные модели для генерации картинок.'],
    [/^video_generate$/, 'video', 'Видео', '▶', 'Генерация видео', 'Создать видео по текстовому описанию.'],
    [/^video_models_/, 'video', 'Видео', '▤', 'Модели видео', 'Посмотреть доступные модели для генерации видео.'],
    [/^audio_tts$/, 'audio', 'Аудио', '♫', 'Озвучка текста', 'Сгенерировать речь по тексту.'],
    [/^audio_voices_/, 'audio', 'Аудио', '♬', 'Голоса', 'Посмотреть доступные голоса для озвучки.'],
    [/^models3d_/, 'model3d', '3D', '⬢', '3D-модель', 'Создать 3D-ассет через Magnific.'],
    [/^custom_references_/, 'reference', 'Референсы', '✧', 'Персонаж или стиль', 'Создать или посмотреть обученные Soul-референсы.'],
    [/^creations_search$/, 'history', 'История', '⌕', 'Поиск по истории', 'Найти ваши прошлые генерации Magnific.'],
    [/^creations_get$/, 'history', 'История', '▣', 'Детали генерации', 'Открыть конкретную генерацию по ID.'],
    [/^creations_show$/, 'history', 'История', '▣', 'Показать генерации', 'Отобразить выбранные creations, если клиент поддерживает inline view.'],
    [/^creations_wait$/, 'history', 'История', '◷', 'Дождаться результата', 'Ждать, пока генерация завершится.'],
    [/^creation_status$/, 'history', 'История', '◷', 'Статус генерации', 'Проверить, готова ли текущая генерация.'],
    [/^creations_/, 'history', 'История', '▣', 'Работа с creations', 'Загрузить, переместить или управлять генерациями.'],
    [/^folders_/, 'folder', 'Папки', '▥', 'Папки', 'Создать, переименовать, открыть или удалить папки.'],
    [/^spaces_/, 'space', 'Spaces', '◈', 'Spaces', 'Открыть и изучить пространства Magnific.'],
    [/^tools_show$/, 'tool', 'Сервис', '⚙', 'Пикер инструментов', 'Показать встроенный выбор доступных инструментов.'],
  ];

  const found = map.find(([pattern]) => pattern.test(name));
  if (!found) {
    return {
      kind: 'tool',
      category: 'Инструмент',
      icon: '⚙',
      title: name.replace(/_/g, ' '),
      description: fallback,
    };
  }

  const [, kind, category, icon, title, description] = found;
  return { kind, category, icon, title, description };
}

function compactArgs(args) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => (
      value !== ''
      && value !== null
      && value !== undefined
      && !(Number.isNaN(value))
      && (!Array.isArray(value) || value.length > 0)
    )),
  );
}

function fitArgsToToolSchema(toolName, args) {
  const tool = toolsByName.get(toolName);
  const props = tool?.inputSchema?.properties;
  if (!props) return args;

  const fitted = {};
  for (const key of Object.keys(props)) {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      fitted[key] = args[key];
    }
  }

  const aliases = [
    ['prompt', ['text', 'description']],
    ['text', ['prompt', 'description']],
    ['description', ['prompt', 'text']],
    ['model', ['model_id', 'modelId']],
    ['model_id', ['model', 'modelId']],
    ['modelId', ['model', 'model_id']],
    ['aspect_ratio', ['aspectRatio', 'ratio']],
    ['aspectRatio', ['aspect_ratio', 'ratio']],
    ['num_outputs', ['numOutputs', 'count', 'n']],
    ['numOutputs', ['num_outputs', 'count', 'n']],
    ['references', ['reference_images', 'referenceImages', 'reference_image_urls', 'referenceImageUrls', 'images']],
    ['reference_images', ['references', 'referenceImages', 'reference_image_urls', 'referenceImageUrls', 'images']],
    ['referenceImages', ['references', 'reference_images', 'reference_image_urls', 'referenceImageUrls', 'images']],
    ['reference_image_urls', ['references', 'reference_images', 'referenceImages', 'referenceImageUrls', 'images']],
    ['referenceImageUrls', ['references', 'reference_images', 'referenceImages', 'reference_image_urls', 'images']],
    ['images', ['references', 'reference_images', 'referenceImages', 'reference_image_urls', 'referenceImageUrls']],
    ['creation_id', ['creationId', 'id']],
    ['creationId', ['creation_id', 'id']],
    ['image_url', ['imageUrl', 'url']],
    ['imageUrl', ['image_url', 'url']],
    ['source', ['creation_id', 'creationId', 'id', 'image_url', 'imageUrl', 'url']],
    ['input', ['creation_id', 'creationId', 'id', 'image_url', 'imageUrl', 'url']],
    ['image', ['creation_id', 'creationId', 'id', 'image_url', 'imageUrl', 'url']],
    ['query', ['q', 'search']],
  ];

  for (const [preferred, names] of aliases) {
    if (!Object.prototype.hasOwnProperty.call(props, preferred)) continue;
    if (fitted[preferred] !== undefined) continue;
    for (const name of names) {
      if (args[name] !== undefined) {
        fitted[preferred] = args[name];
        break;
      }
    }
  }

  return Object.keys(fitted).length ? fitted : args;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

magnificConnectBtn?.addEventListener('click', () => connectMagnific());
magnificDisconnectBtn?.addEventListener('click', disconnectMagnific);
magnificToolResult?.addEventListener('click', (event) => {
  if (event.target.closest('.magnific-relogin-btn')) {
    disconnectMagnific().then(() => connectMagnific({ forceLogin: true }));
  }
});
magnificToolsSearch?.addEventListener('input', renderToolsList);
document.querySelectorAll('.magnific-mode').forEach((btn) => {
  btn.addEventListener('click', () => switchMagnificMode(btn.dataset.magnificMode));
});
document.getElementById('magnific-generate-image')?.addEventListener('click', runImageGenerate);
document.getElementById('magnific-generate-video')?.addEventListener('click', runVideoGenerate);
document.getElementById('magnific-upscale-image')?.addEventListener('click', runUpscale);
document.getElementById('magnific-remove-bg')?.addEventListener('click', () => runRemoveBackground());
document.getElementById('magnific-remove-bg-last')?.addEventListener('click', () => runRemoveBackground({ useLast: true }));
document.getElementById('magnific-search-history')?.addEventListener('click', runHistorySearch);
document.getElementById('magnific-pick-image-refs')?.addEventListener('click', pickMagnificReferences);
document.getElementById('magnific-refresh-image-models')?.addEventListener('click', () => refreshMagnificModels('image'));

document.addEventListener('DOMContentLoaded', () => {
  setMagnificResult('');
  checkMagnificStatus();
});

window.activateMagnificPage = () => {
  checkMagnificStatus();
};
