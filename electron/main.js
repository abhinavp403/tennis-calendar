import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fetchMissingResults } from '../scripts/fetchResults.js';
import { fixTournamentDates } from '../scripts/fixDates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LAST_RUN_PATH = path.join(app.getPath('userData'), 'lastDateCheck.json');
const DATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function shouldRunDateCheck() {
  try {
    const { lastRun } = JSON.parse(readFileSync(LAST_RUN_PATH, 'utf-8'));
    return Date.now() - new Date(lastRun).getTime() >= DATE_CHECK_INTERVAL_MS;
  } catch {
    return true; // No record yet — run on first launch
  }
}

function recordDateCheckRun() {
  writeFileSync(LAST_RUN_PATH, JSON.stringify({ lastRun: new Date().toISOString() }));
}

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

  // After window is ready, run background data updates.
  // Reload the window if any data changed.
  win.webContents.once('did-finish-load', async () => {
    let updated = false;

    try {
      updated = (await fetchMissingResults()) || updated;
    } catch (err) {
      console.error('fetchMissingResults error:', err);
    }

    if (shouldRunDateCheck()) {
      console.log('Running weekly tournament date check...');
      try {
        const datesUpdated = await fixTournamentDates();
        updated = datesUpdated || updated;
        recordDateCheckRun();
      } catch (err) {
        console.error('fixTournamentDates error:', err);
      }
    }

    if (updated && !win.isDestroyed()) {
      win.webContents.reload();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
