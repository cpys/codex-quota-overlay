const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('quotaCenter', {
  getState() {
    return ipcRenderer.invoke('dashboard:get-state');
  },
  updateSettings(patch) {
    return ipcRenderer.invoke('dashboard:update-settings', patch);
  },
  clearHistory() {
    return ipcRenderer.invoke('dashboard:clear-history');
  },
  refresh() {
    return ipcRenderer.invoke('dashboard:refresh');
  },
  copyDiagnostics() {
    return ipcRenderer.invoke('dashboard:copy-diagnostics');
  },
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('dashboard:state', listener);
    return () => ipcRenderer.removeListener('dashboard:state', listener);
  }
});
