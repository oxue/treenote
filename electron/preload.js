const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('treenote', {
  getDefaultFile: () => ipcRenderer.invoke('get-default-file'),
  saveDefaultFile: (content) => ipcRenderer.invoke('save-default-file', content),
});
