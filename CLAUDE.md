# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Electron + React 19 + Vite 8 + Tailwind CSS 4. ESM throughout (`"type": "module"`), except `electron/preload.cjs` which must remain CommonJS for Electron's security context. No test suite, no linter — validation is manual.

## Commands

```bash
npm run dev        # Vite + Electron concurrently (preferred for UI work)
npm run dev:vite   # Vite only at localhost:5173 (no Electron APIs available)
npm run build      # Vite build → dist/
npm run dist       # Vite build + electron-builder (creates .dmg / .exe / AppImage)
npm start          # Run Electron against an existing dist/ build
```

There are no test or lint commands. When changing data-pipeline scripts, run them directly: `node scripts/fetchResults.js`, `node scripts/fixDates.js`, `node scripts/fetchRankings.js`.

## Architecture: the data-flow is the load-bearing part

The non-obvious thing about this repo is that **the running app reads data from a GitHub Gist, not from the bundled JSON files**. Understand this before changing anything in `electron/main.js` or the `scripts/` folder.

### Three storage locations for the same JSON

1. **`data/tournaments.json` and `data/rankings.json`** — committed to the repo. Used in `npm run dev:vite` (browser-only) and as the initial seed for new installs. NOT what the production app reads at runtime.
2. **GitHub Gist** (`c75d3f961da94fdeed16cdbd8e2ec08e`) — the live source of truth. The desktop app fetches from `gist.githubusercontent.com/.../raw/{file}` on every launch.
3. **`app.getPath('userData')`** — local cache the renderer reads from. Populated on each launch by `syncUserData()` in `electron/main.js`, with 8-second timeout and silent fallback to the existing cached file if offline.

So: editing `data/tournaments.json` and rebuilding will NOT change what users see. The data-maintenance scripts (`fetchResults.js`, `fetchRankings.js`, `fixDates.js`) write to the repo file AND push to the Gist via `scripts/updateGist.js`, which uses `gh auth token` for credentials. The Gist push is what actually updates users.

### Background scripts run inside the Electron main process

`electron/main.js` imports and invokes `fixTournamentDates()`, `fetchMissingResults()`, and `fetchMissingRankings()` after `did-finish-load`, gated by a `last-run` timestamp file (`DATE_CHECK_INTERVAL_MS = 7 days`). Failures are swallowed. If you add a new background task, mirror this pattern — never block window creation on network I/O.

### Renderer ↔ main bridge

`electron/preload.cjs` is the only IPC surface. It exposes `getTournaments`, `getRankings`, `getSyncTime` (all `sendSync`), and `triggerSync` (async). The renderer never writes; it only reads via `window.electronAPI`. Adding new data access means: edit the preload, add a handler in `main.js`, then consume in React.

### Weekly automation

`scripts/weeklyUpdate.sh` runs `fixDates.js`, `fetchResults.js`, `fetchRankings.js` in sequence and is wired to launchd locally (not CI). The scripts push to the Gist directly — no git commit needed.

## Data shapes

**`tournaments.json`**: `{atp: Tournament[], wta: Tournament[]}`. Each tournament has `id`, `name`, `level` (250 / 500 / 1000 / 1500 / 2000), `start`, `end` (ISO date strings), `location`, `surface`, `logo` (PNG in `public/logos/`), and optional `winner`, `runner_up`, `score` once completed.

**`rankings.json`**: `{atp: { [key]: Player[] }, wta: { [key]: Player[] }}`. Each player: `rank`, `name`, `country`, `points`, optional `movement`. Snapshot keys are **mixed**: legacy `"YYYY-MM"` (monthly, Jan–Jun 2026, treated as the month's last day) and `"YYYY-MM-DD"` (bi-weekly, the exact Monday the rankings reflect, captured going forward). `fetchRankings.js` parses the Wikipedia page's `{{As of|Y|M|D}}` marker and stores a new snapshot only when it's ≥13 days after the latest one. Consumers normalize both key forms via a `keyDate`/`rankingKeyDate` helper (see `Calendar.jsx` and `RankingsDialog.jsx`); Wikipedia exposes only the current week, so older bi-weekly history cannot be backfilled.

## UI conventions

- Single-page React (no router). State lives in `App.jsx`: `tour` ('atp' | 'wta'), `currentDate` (dayjs object). No context, no Redux.
- Most theming is via inline `style` props rather than Tailwind classes, because colors are computed from tour and tournament level dynamically. Don't refactor these to utility classes blindly.
- Tier colors: Grand Slam / 1500 = violet, 1000 = amber, 500 = blue, 250 = grey. Tour accents: ATP = blue gradient, WTA = pink gradient.

## ICS calendar export

`scripts/export_ics.py` (Python 3) generates `tennis_calendar.ics` from `data/tournaments.json` — one all-day event per tournament on its final day, titled `[Tour - Level] Name`. The `.gitattributes` rule `*.ics text eol=crlf` preserves CRLF line endings (required by RFC 5545).

`.github/workflows/update-ics.yml` regenerates and commits the .ics whenever `data/tournaments.json` or the script changes. The file is served via GitHub Pages at `https://abhinavp403.github.io/tennis-calendar/tennis_calendar.ics` for URL subscriptions.

Note: this pipeline reads from the committed `data/tournaments.json`, NOT the Gist. Currently the repo file and Gist can drift — keep this in mind if winners appear in the app but not in the .ics, or vice versa.

## Distribution

`.github/workflows/build.yml` is `workflow_dispatch` only. Builds .dmg (macOS) and .exe (Windows) via electron-builder; the resulting artifacts are unsigned. Linux AppImage is configured in `package.json` but no CI job builds it.

## Gotchas

- **`dev:vite` won't show data** because `window.electronAPI` is undefined in a plain browser. Use `npm run dev` for any data-touching work.
- **Wikipedia scrapers are fragile** — `fixDates.js` has a hand-maintained `WIKI_NAME_MAP` for tournaments whose Wikipedia page name differs from the display name. When adding tournaments, check whether they need a mapping.
- **Vite `base: './'`** is required so `file://` URLs work in the packaged Electron app. Don't change this.
- **Preload must stay `.cjs`** — Electron's `contextBridge` won't load it as ESM in the security context.
