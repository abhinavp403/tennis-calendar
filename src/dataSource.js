// Unified data source for both Electron (desktop) and web (Vercel) builds.
//
// - Electron: window.electronAPI exposes cached JSON via IPC (synchronous).
// - Web: fetch the same JSON directly from the Gist that backs the data pipeline.

const GIST_RAW_BASE = 'https://gist.githubusercontent.com/abhinavp403/c75d3f961da94fdeed16cdbd8e2ec08e/raw';

const EMPTY_TOURNAMENTS = { atp: [], wta: [] };
const EMPTY_RANKINGS = { atp: {}, wta: {} };

export const isWebMode = () =>
  typeof window === 'undefined' || !window.electronAPI;

// Returns whatever data is available immediately, no network call.
// Electron: real data via IPC. Web: empty stubs (real data arrives via loadData()).
export function loadInitialData() {
  if (!isWebMode()) {
    return {
      tournaments: window.electronAPI.getTournaments?.() ?? EMPTY_TOURNAMENTS,
      rankings: window.electronAPI.getRankings?.() ?? EMPTY_RANKINGS,
    };
  }
  return { tournaments: EMPTY_TOURNAMENTS, rankings: EMPTY_RANKINGS };
}

// Async fetch of the latest data.
// Electron: already has it synchronously. Web: fetches the Gist with no-cache.
export async function loadData() {
  if (!isWebMode()) return loadInitialData();

  const [tRes, rRes] = await Promise.all([
    fetch(`${GIST_RAW_BASE}/tournaments.json`, { cache: 'no-cache' }),
    fetch(`${GIST_RAW_BASE}/rankings.json`, { cache: 'no-cache' }),
  ]);
  if (!tRes.ok || !rRes.ok) throw new Error('Failed to load data from Gist');
  const [tournaments, rankings] = await Promise.all([tRes.json(), rRes.json()]);
  return { tournaments, rankings };
}

const SYNC_KEY = 'tennis_calendar_last_synced';

export function getSyncTime() {
  if (!isWebMode()) return window.electronAPI.getSyncTime?.() ?? null;
  try { return sessionStorage.getItem(SYNC_KEY); } catch { return null; }
}

export function setSyncTime(iso) {
  if (isWebMode()) {
    try { sessionStorage.setItem(SYNC_KEY, iso); } catch { /* private mode, etc. */ }
  }
  // Electron tracks its own sync time in the main process — nothing to do here.
}

// Trigger a fresh sync from the source.
// Electron: invokes main-process syncUserData() via IPC.
// Web: no-op; data is fetched on demand by loadData().
export async function triggerSync() {
  if (!isWebMode() && window.electronAPI.triggerSync) {
    await window.electronAPI.triggerSync();
  }
}
