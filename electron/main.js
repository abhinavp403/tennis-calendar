import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fetchMissingResults } from '../scripts/fetchResults.js';
import { fixTournamentDates } from '../scripts/fixDates.js';
import { fetchMissingRankings } from '../scripts/fetchRankings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let lastRunPath = null;  // set after app is ready
let initialized = false; // gate for the activate handler

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/abhinavp403/tennis-calendar/main/data';

async function syncUserData() {
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });

  // Seed userData from bundled files on first launch
  for (const file of ['tournaments.json', 'rankings.json']) {
    const userPath = path.join(userDataDir, file);
    if (!existsSync(userPath)) {
      writeFileSync(userPath, readFileSync(path.join(__dirname, '../data', file)));
    }
  }

  // Pull latest committed data from GitHub (silent fail if offline)
  try {
    for (const file of ['tournaments.json', 'rankings.json']) {
      const res = await fetch(`${GITHUB_RAW_BASE}/${file}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        JSON.parse(text); // validate before writing
        writeFileSync(path.join(userDataDir, file), text);
      }
    }
    console.log('Synced latest data from GitHub.');
  } catch {
    console.log('GitHub sync skipped (offline or timeout) — using local data.');
  }

  // Expose path so preload can read from userData instead of the app bundle
  process.env.USER_DATA_PATH = userDataDir;
}

function shouldRunDateCheck() {
  if (!lastRunPath) return false;
  try {
    const { lastRun } = JSON.parse(readFileSync(lastRunPath, 'utf-8'));
    return Date.now() - new Date(lastRun).getTime() >= DATE_CHECK_INTERVAL_MS;
  } catch {
    return true; // No record yet — run on first launch
  }
}

function recordDateCheckRun() {
  if (lastRunPath) writeFileSync(lastRunPath, JSON.stringify({ lastRun: new Date().toISOString() }));
}

function createWindow() {
  const distIndex = path.join(__dirname, '../dist/index.html');
  const isDev = process.env.ELECTRON_DEV === 'true' || (!app.isPackaged && !existsSync(distIndex));

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, '../public/logos/app-logo.icns'),
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

  win.webContents.once('did-finish-load', async () => {
    const tournamentsPath = path.join(app.getPath('userData'), 'tournaments.json');
    let updated = false;

    try {
      updated = (await fetchMissingResults(tournamentsPath)) || updated;
    } catch (err) {
      console.error('fetchMissingResults error:', err);
    }

    try {
      const rankingsPath = path.join(app.getPath('userData'), 'rankings.json');
      const rankingsUpdated = await fetchMissingRankings(rankingsPath);
      updated = rankingsUpdated || updated;
    } catch (err) {
      console.error('fetchMissingRankings error:', err);
    }

    if (shouldRunDateCheck()) {
      console.log('Running weekly tournament date check...');
      try {
        const datesUpdated = await fixTournamentDates(tournamentsPath);
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

app.whenReady().then(async () => {
  lastRunPath = path.join(app.getPath('userData'), 'lastDateCheck.json');
  await syncUserData();
  initialized = true;
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // Guard against firing before syncUserData() completes
  if (BrowserWindow.getAllWindows().length === 0 && initialized) createWindow();
});
