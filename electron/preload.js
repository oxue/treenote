const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('treenote', {
  getDefaultFile: () => ipcRenderer.invoke('get-default-file'),
  saveDefaultFile: (content) => ipcRenderer.invoke('save-default-file', content),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
});
