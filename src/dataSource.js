// Unified data source for both Electron (desktop) and web (Vercel) builds.
//
// - Electron: window.electronAPI exposes cached JSON via IPC (synchronous).
// - Web: fetch the same JSON directly from the Gist that backs the data pipeline.

const GIST_RAW_BASE = 'https://gist.githubusercontent.com/abhinavp403/c75d3f961da94fdeed16cdbd8e2ec08e/raw';

const EMPTY_TOURNAMENTS = { atp: [], wta: [] };
const EMPTY_RANKINGS = { atp: {}, wta: {} };
const EMPTY_PLAYERS = { atp: {}, wta: {} };

export const isWebMode = () =>
  typeof window === 'undefined' || !window.electronAPI;

// Returns whatever data is available immediately, no network call.
// Electron: real data via IPC. Web: empty stubs (real data arrives via loadData()).
export function loadInitialData() {
  if (!isWebMode()) {
    return {
      tournaments: window.electronAPI.getTournaments?.() ?? EMPTY_TOURNAMENTS,
      rankings: window.electronAPI.getRankings?.() ?? EMPTY_RANKINGS,
      players: window.electronAPI.getPlayers?.() ?? EMPTY_PLAYERS,
      race: window.electronAPI.getRace?.() ?? {},
    };
  }
  return { tournaments: EMPTY_TOURNAMENTS, rankings: EMPTY_RANKINGS, players: EMPTY_PLAYERS, race: {} };
}

// Async fetch of the latest data.
// Electron: already has it synchronously. Web: fetches the Gist with no-cache.
export async function loadData() {
  if (!isWebMode()) return loadInitialData();

  const [tRes, rRes, pRes, raceRes] = await Promise.all([
    fetch(`${GIST_RAW_BASE}/tournaments.json`, { cache: 'no-cache' }),
    fetch(`${GIST_RAW_BASE}/rankings.json`, { cache: 'no-cache' }),
    fetch(`${GIST_RAW_BASE}/players.json`, { cache: 'no-cache' }),
    fetch(`${GIST_RAW_BASE}/race.json`, { cache: 'no-cache' }),
  ]);
  if (!tRes.ok || !rRes.ok) throw new Error('Failed to load data from Gist');
  const [tournaments, rankings] = await Promise.all([tRes.json(), rRes.json()]);
  // players.json / race.json are supplementary — tolerate them being missing.
  const players = pRes.ok ? await pRes.json() : EMPTY_PLAYERS;
  const race = raceRes.ok ? await raceRes.json() : {};
  return { tournaments, rankings, players, race };
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
