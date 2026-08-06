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

### Two storage locations for the same JSON

There is **no `data/` directory** — the bundled `data/tournaments.json` / `data/rankings.json` were removed (commit `cf12e00`, "fetch exclusively from Gist"). The two live locations are:

1. **GitHub Gist** (`c75d3f961da94fdeed16cdbd8e2ec08e`) — the source of truth. The app fetches from `gist.githubusercontent.com/.../raw/{file}` on every launch; `dev:vite` fetches it too (see `src/dataSource.js`).
2. **`app.getPath('userData')`** — local cache the renderer reads from. Populated on each launch by `syncUserData()` in `electron/main.js`, with an 8-second timeout and silent fallback to the existing cached file if offline.

The data-maintenance scripts (`fetchResults.js`, `fetchRankings.js`, `fixDates.js`) **read from and write to the Gist**, via helpers in `scripts/updateGist.js` (`fetchGistFiles` reads authoritative content through the GitHub API; `updateGistContent` pushes). Auth is `gh auth token` (or `GH_TOKEN`/`GITHUB_TOKEN` in CI). Each script takes an optional local `dataPath`: when the file **exists** it reads/writes that (the Electron app passes its userData cache), otherwise it falls back to the Gist (CLI / launchd). The Gist push is what actually updates users; set `SKIP_GIST_PUSH=1` for a dry run.

### Background scripts run inside the Electron main process

`electron/main.js` imports and invokes `fixTournamentDates()`, `fetchMissingResults()`, and `fetchMissingRankings()` after `did-finish-load`, gated by a `last-run` timestamp file (`DATE_CHECK_INTERVAL_MS = 7 days`). Failures are swallowed. If you add a new background task, mirror this pattern — never block window creation on network I/O.

### Renderer ↔ main bridge

`electron/preload.cjs` is the only IPC surface. It exposes `getTournaments`, `getRankings`, `getSyncTime` (all `sendSync`), and `triggerSync` (async). The renderer never writes; it only reads via `window.electronAPI`. Adding new data access means: edit the preload, add a handler in `main.js`, then consume in React.

### Scheduled data updates

**`.github/workflows/daily-data-update.yml` is the live automation** — it runs `fixDates.js`, `fetchResults.js`, `enrichPlayers.js`, `fetchRankings.js` in that order, twice daily (01:00 and 09:00 UTC), authenticating with the `GIST_TOKEN` secret. `fetchResults` only picks up a tournament once its end date has passed **in UTC**, so the 01:00 run is what catches the previous day's finals; 09:00 is the catch-up pass.

Each script reads the current data and pushes its changes to the Gist — no git commit needed. Because they run sequentially and several touch `tournaments.json`, reads go through the GitHub API (read-your-writes) so each step sees the previous one's push.

`scripts/weeklyUpdate.sh` runs the same sequence and is kept for **manual local runs only**. It used to be wired to a launchd agent, which was removed — it had been failing with "Operation not permitted" because macOS TCC blocks launchd-spawned processes from reading `~/Documents`. Don't re-add a local scheduler; use the workflow.

## Data shapes

**`tournaments.json`**: `{atp: Tournament[], wta: Tournament[]}`. Each tournament has `id`, `name`, `level` (250 / 500 / 1000 / 1500 / 2000), `start`, `end` (ISO date strings), `location`, `surface`, `logo` (PNG in `public/logos/`), and optional `winner`, `runner_up`, `score` once completed. Names are abbreviated (`"C. Alcaraz"`); optional `winner_full` / `runner_up_full` carry the un-abbreviated form (`"Carlos Alcaraz"`). `buildPlayerStats` (`src/utils/playerStats.js`) uses them to power first-name player search; a player unresolved there simply stays last-name-searchable.

**`players.json`**: `{atp: { "A. Eala": "PHI" }, wta: {...}}` — abbreviated name → IOC country code, used for the flags in player stats, search, and the profile (`src/utils/flags.js` maps the code to a flag emoji). Rankings flags come from `rankings.json`'s own `country` field instead.

Both the full names and the countries are populated by **`scripts/enrichPlayers.js`**, which resolves each player from *their own Wikipedia article* (search `"<lastname> tennis player"`, match surname + initial) — independent of tournament-page scraping, so it isn't affected by tournament-name/page-title mismatches. The country comes from that article's `| country = {{PHI}}` infobox field, falling back to the season tour page's `{{flagicon|CAN}}` tag for articles using a format we don't parse. It runs daily after `fetchResults.js` and only looks up players missing a name or a country, so new finalists are picked up automatically.

**`rankings.json`**: `{atp: { [key]: Player[] }, wta: { [key]: Player[] }}`. Each player: `rank`, `name`, `country`, `points`, optional `movement`. Snapshot keys are **mixed**: legacy `"YYYY-MM"` (monthly, Jan–Jun 2026, treated as the month's last day) and `"YYYY-MM-DD"` (bi-weekly, the exact Monday the rankings reflect, captured going forward). `fetchRankings.js` parses the Wikipedia page's `{{As of|Y|M|D}}` marker and stores a new snapshot only when it's ≥13 days after the latest one. Consumers normalize both key forms via a `keyDate`/`rankingKeyDate` helper (see `Calendar.jsx` and `RankingsDialog.jsx`); Wikipedia exposes only the current week, so older bi-weekly history cannot be backfilled.

## UI conventions

- Single-page React (no router). State lives in `App.jsx`: `tour` ('atp' | 'wta'), `currentDate` (dayjs object). No context, no Redux.
- Most theming is via inline `style` props rather than Tailwind classes, because colors are computed from tour and tournament level dynamically. Don't refactor these to utility classes blindly.
- Tier colors: Grand Slam / 1500 = violet, 1000 = amber, 500 = blue, 250 = grey. Tour accents: ATP = blue gradient, WTA = pink gradient.

## ICS calendar export

`scripts/export_ics.py` (Python 3) generates `tennis_calendar.ics` **from the Gist** (falling back to a local `data/tournaments.json` only if the fetch fails) — one all-day event per tournament on its final day, titled `[Tour - Level] Name`. The `.gitattributes` rule `*.ics text eol=crlf` preserves CRLF line endings (required by RFC 5545).

`.github/workflows/update-ics.yml` regenerates and commits the .ics, then serves it from the repo over `raw.githubusercontent.com` for URL subscriptions. It runs on a **schedule at 01:30 and 09:30 UTC** — 30 minutes after each `daily-data-update` pass, which takes about a minute. It previously triggered on pushes to `data/tournaments.json`; that file was removed in `cf12e00`, so the workflow silently stopped firing and the feed sat frozen from May to August 2026. A `workflow_run` chain off "Daily Data Update" would express the dependency better but never fired in testing, so the schedule is deliberate — keep the 30-minute offset if you change the data workflow's times.

Every run re-stamps `DTSTAMP` on every event, so the commit step diffs with `DTSTAMP:` lines stripped — otherwise it would commit twice a day with no real change.

## Distribution

`.github/workflows/build.yml` is `workflow_dispatch` only. Builds .dmg (macOS) and .exe (Windows) via electron-builder; the resulting artifacts are unsigned. Linux AppImage is configured in `package.json` but no CI job builds it.

## Gotchas

- **`dev:vite` shows real data** — in web mode `src/dataSource.js` fetches the Gist directly (no `window.electronAPI` needed). `npm run dev` (Electron) is only required when exercising the IPC bridge or the in-app background update tasks.
- **Wikipedia scrapers are fragile** — both `fixDates.js` and `fetchResults.js` have a hand-maintained `WIKI_NAME_MAP` for tournaments whose Wikipedia page name differs from the display name. When a scraper resolves the wrong page, results/full-names silently don't get captured for that tournament (guarded against writing *wrong* data, but it means a gap). When adding tournaments, check whether they need a mapping.
- **Vite `base: './'`** is required so `file://` URLs work in the packaged Electron app. Don't change this.
- **Preload must stay `.cjs`** — Electron's `contextBridge` won't load it as ESM in the security context.
