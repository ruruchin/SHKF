/**
 * Глобальные in-app уведомления об изменениях задач Kanban (на любой вкладке).
 */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let getConfig = () => ({ settings: {} });
  const shownUpdateKeys = new Set();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isNotifyEnabled() {
    return getConfig()?.settings?.metask?.notifyOnUpdate !== false;
  }

  function filterFreshUpdates(updates) {
    return (updates || []).filter((task) => {
      const key = `${task.id}:${task.updatedOn || ''}`;
      if (shownUpdateKeys.has(key)) return false;
      shownUpdateKeys.add(key);
      return true;
    });
  }

  function showTaskUpdateToast(task) {
    const stack = $('metask-toast-stack');
    if (!stack || !task?.id) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'metask-toast';
    btn.dataset.taskId = String(task.id);
    btn.innerHTML = `
      <span class="metask-toast-accent" aria-hidden="true"></span>
      <span class="metask-toast-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <path d="M8 9h2M14 9h2M8 13h2M14 13h2"/>
        </svg>
      </span>
      <span class="metask-toast-body">
        <span class="metask-toast-title">Канбан · #${task.id}</span>
        <span class="metask-toast-subject">${escapeHtml(task.subject || 'Задача обновлена')}</span>
      </span>
      <span class="metask-toast-dismiss" aria-hidden="true">×</span>
      <span class="metask-toast-progress" aria-hidden="true"></span>
    `;

    const remove = () => {
      btn.classList.remove('is-visible');
      btn.classList.add('is-leaving');
      setTimeout(() => btn.remove(), 320);
    };

    btn.addEventListener('click', (event) => {
      if (event.target.closest('.metask-toast-dismiss')) {
        event.stopPropagation();
        remove();
        return;
      }
      remove();
      window.openMetaskTask?.(task.id, task.url);
    });

    stack.prepend(btn);
    while (stack.children.length > 4) {
      stack.lastElementChild?.remove();
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => btn.classList.add('is-visible'));
    });
    setTimeout(remove, 12000);
  }

  function handleKanbanTaskUpdates(updates) {
    if (!isNotifyEnabled()) return [];
    const fresh = filterFreshUpdates(updates);
    fresh.forEach((task) => showTaskUpdateToast(task));
    return fresh;
  }

  function initKanbanNotify(options = {}) {
    if (typeof options.getConfig === 'function') getConfig = options.getConfig;

    window.api.onMetaskTaskUpdates?.((updates) => {
      handleKanbanTaskUpdates(updates);
    });

    window.api.onMetaskOpenTask?.(({ id, url }) => {
      window.openMetaskTask?.(id, url);
    });

    window.api.metaskConsumePendingUpdates?.()
      .then((pending) => {
        if (pending?.length) handleKanbanTaskUpdates(pending);
      })
      .catch(() => {});
  }

  window.initKanbanNotify = initKanbanNotify;
  window.handleKanbanTaskUpdates = handleKanbanTaskUpdates;
})();
