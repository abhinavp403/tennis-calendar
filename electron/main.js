import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';
import { fetchMissingResults } from '../scripts/fetchResults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const distIndex = path.join(__dirname, '../dist/index.html');
  const isDev = !app.isPackaged && !existsSync(distIndex);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#0f0f13',
    title: 'Tennis Calendar',
    titleBarStyle: 'default',
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // After window is ready, fetch any missing results in the background.
  // If new results are found, reload the window to display them.
  win.webContents.once('did-finish-load', () => {
    fetchMissingResults()
      .then(updated => {
        if (updated && !win.isDestroyed()) {
          win.webContents.reload();
        }
      })
      .catch(err => console.error('fetchMissingResults error:', err));
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
