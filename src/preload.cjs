const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('quotaOverlay', {
  onState(callback) {
    ipcRenderer.on('overlay:state', (_event, state) => callback(state));
  },
  measured(size) {
    ipcRenderer.send('overlay:measured', size);
  }
});
