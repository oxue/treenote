const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveHome(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function shortenHome(filePath) {
  const home = os.homedir();
  if (filePath.startsWith(home + '/')) {
    return '~/' + filePath.slice(home.length + 1);
  }
  return filePath;
}

function getConfigPath() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return path.join(__dirname, '../treenote.config.json');
  }
  return path.join(app.getPath('userData'), 'treenote.config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

ipcMain.handle('get-default-file', () => {
  const config = loadConfig();
  if (!config.defaultFile) return null;
  const filePath = resolveHome(config.defaultFile);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('save-default-file', (_event, content) => {
  const config = loadConfig();
  if (!config.defaultFile) return false;
  const filePath = resolveHome(config.defaultFile);
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-settings', () => {
  return loadConfig();
});

ipcMain.handle('save-settings', (_event, settings) => {
  try {
    saveConfig(settings);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown/Text', extensions: ['md', 'txt'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return shortenHome(result.filePaths[0]);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
