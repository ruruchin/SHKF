/**
 * Generic external-site tabs (GitHub, Outline и т.п.).
 * Каждая страница описывается атрибутами data-webtab* на <section>.
 * Пользователь логинится вручную, сессия сохраняется в persist-партиции.
 */
(function () {
  const loaded = new Set();

  function getSection(id) {
    return document.querySelector(`[data-webtab="${id}"]`);
  }

  function getWebview(section) {
    return section?.querySelector('webview');
  }

  function setStatus(section, text, ok) {
    const label = section.querySelector('[data-webtab-status]');
    const dot = section.querySelector('[data-webtab-dot]');
    const wrap = section.querySelector('.webtab-status');
    if (label) label.textContent = text;
    if (dot) dot.classList.toggle('on', !!ok);
    wrap?.classList.toggle('is-online', !!ok);
  }

  function homeUrl(section) {
    return section.getAttribute('data-webtab-url') || 'about:blank';
  }

  function currentUrl(wv) {
    try {
      const u = wv.getURL?.();
      if (u) return u;
    } catch {
      /* webview not attached / dom-ready yet */
    }
    return wv.getAttribute('src') || '';
  }

  // Навигация, устойчивая к незавершённому attach/dom-ready webview.
  function navigate(wv, url) {
    try {
      if (typeof wv.loadURL === 'function') {
        wv.loadURL(url);
        return;
      }
    } catch {
      /* не готов — упадём на атрибут src ниже */
    }
    try {
      wv.setAttribute('src', url);
      wv.src = url;
    } catch {
      /* ignore */
    }
  }

  function loadHome(section, { force = false } = {}) {
    const wv = getWebview(section);
    if (!wv) return;
    const current = currentUrl(wv);
    if (!force && current && current !== 'about:blank') return;
    const url = homeUrl(section);
    setStatus(section, 'Загрузка…', false);
    wv.dataset.pendingUrl = url;
    navigate(wv, url);
  }

  function bindWebview(section) {
    const wv = getWebview(section);
    if (!wv || wv.dataset.bound) return;
    wv.dataset.bound = '1';

    wv.addEventListener('dom-ready', () => {
      const pending = wv.dataset.pendingUrl;
      const cur = currentUrl(wv);
      if (pending && (!cur || cur === 'about:blank')) {
        navigate(wv, pending);
      }
    });
    wv.addEventListener('did-start-loading', () => setStatus(section, 'Загрузка…', false));
    wv.addEventListener('did-stop-loading', () => {
      updateNavButtons(section);
      const cur = currentUrl(wv);
      if (cur && cur !== 'about:blank') delete wv.dataset.pendingUrl;
      let title = '';
      try { title = wv.getTitle?.() || ''; } catch { /* not ready */ }
      setStatus(section, title ? title.slice(0, 48) : 'Готово', true);
    });
    wv.addEventListener('page-title-updated', (e) => {
      setStatus(section, (e.title || '').slice(0, 48) || 'Готово', true);
    });
    wv.addEventListener('did-fail-load', (event) => {
      if (event.errorCode === -3) return;
      setStatus(section, `Ошибка: ${event.errorDescription || event.errorCode}`, false);
    });
  }

  function updateNavButtons(section) {
    const wv = getWebview(section);
    if (!wv) return;
    const back = section.querySelector('[data-webtab-back]');
    const fwd = section.querySelector('[data-webtab-forward]');
    let canBack = false;
    let canFwd = false;
    try { canBack = !!wv.canGoBack?.(); } catch { /* not ready */ }
    try { canFwd = !!wv.canGoForward?.(); } catch { /* not ready */ }
    if (back) back.disabled = !canBack;
    if (fwd) fwd.disabled = !canFwd;
  }

  function bindToolbar(section) {
    if (section.dataset.toolbarBound) return;
    section.dataset.toolbarBound = '1';
    const wv = getWebview(section);

    section.querySelector('[data-webtab-back]')?.addEventListener('click', () => wv?.canGoBack?.() && wv.goBack());
    section.querySelector('[data-webtab-forward]')?.addEventListener('click', () => wv?.canGoForward?.() && wv.goForward());
    section.querySelector('[data-webtab-home]')?.addEventListener('click', () => loadHome(section, { force: true }));
    section.querySelector('[data-webtab-refresh]')?.addEventListener('click', () => {
      if (wv?.reload) wv.reload();
      else loadHome(section, { force: true });
      setStatus(section, 'Обновление…', false);
    });
    section.querySelector('[data-webtab-external]')?.addEventListener('click', () => {
      const url = currentUrl(wv) || homeUrl(section);
      window.api.webtabOpenExternal?.(url);
    });
    section.querySelector('[data-webtab-logout]')?.addEventListener('click', async () => {
      const partition = section.getAttribute('data-webtab-partition') || '';
      setStatus(section, 'Выход…', false);
      await window.api.webtabClearSession?.(partition);
      loaded.delete(section.getAttribute('data-webtab'));
      loadHome(section, { force: true });
    });
  }

  window.activateWebtab = function activateWebtab(id) {
    const section = getSection(id);
    if (!section) return;
    bindWebview(section);
    bindToolbar(section);
    if (!loaded.has(id)) {
      loaded.add(id);
      loadHome(section, { force: false });
    }
    updateNavButtons(section);
  };

  function initWebtabs() {
    document.querySelectorAll('[data-webtab]').forEach((section) => {
      bindWebview(section);
      bindToolbar(section);
    });
  }

  window.initWebtabs = initWebtabs;
})();
