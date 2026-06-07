/**
 * Kanban task update notifications — pills via main process (overlay / in-app).
 */
(function () {
  let getConfig = () => ({ settings: {} });
  const shownUpdateKeys = new Set();

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

  function handleKanbanTaskUpdates(updates) {
    if (!isNotifyEnabled()) return [];
    return filterFreshUpdates(updates);
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
