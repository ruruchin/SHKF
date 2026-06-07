const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pillNotify', {
  onPush: (cb) => {
    const fn = (_e, payload) => cb(payload);
    ipcRenderer.on('pill-notify-push', fn);
    return () => ipcRenderer.removeListener('pill-notify-push', fn);
  },
  click: (action) => ipcRenderer.send('pill-notify-click', action),
  resize: (height) => ipcRenderer.send('pill-notify-resize', height),
  hide: () => ipcRenderer.send('pill-notify-hide'),
});
