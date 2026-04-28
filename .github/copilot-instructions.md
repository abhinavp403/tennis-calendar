# Copilot Instructions — Tennis Calendar

## Overview
This is an **Electron + React + Vite** desktop application displaying the 2026 ATP/WTA tennis tour schedules with tournament details, results, and rankings. The app fetches live data from GitHub on launch and supports offline fallback using bundled JSON files.

## Build & Test Commands

### Development
- **Start dev server with Electron**: `npm run dev` (runs Vite + Electron concurrently, auto-reloads on code changes)
- **Vite only** (browser dev): `npm run dev:vite` (serves at http://localhost:5173)
- **Run built app**: `npm start` (launches Electron from dist/)

### Production
- **Build for web**: `npm run build` (outputs to `dist/`)
- **Build installers**: `npm run dist` (builds Vite, then creates macOS .dmg, Windows .exe, Linux AppImage)

### No existing linters or tests
The project has no test suite or linter configured. Validation is manual (visual inspection) or through Electron preview.

## Architecture

### Entry Points
- **`electron/main.js`**: Electron main process
  - Syncs tournament/ranking data from GitHub on app launch (8-second timeout, silent fail if offline)
  - Seeds userData directory with bundled data on first launch
  - Runs weekly tournament date/result validation in background (`fetchMissingResults`, `fixTournamentDates`)
  - Exposes IPC APIs via preload script
- **`src/index.jsx`**: React root
- **`index.html`**: Single-page HTML shell

### Data Flow
1. **App startup** → `syncUserData()` in main.js fetches latest `tournaments.json` and `rankings.json` from GitHub
2. **App loads** → React queries data via `window.electronAPI.getTournaments()` (preload bridge)
3. **Data stored**: User data directory (macOS: `~/Library/Application Support/Tennis Calendar/`, Windows: `%APPDATA%/Tennis Calendar/`)
4. **Scripts update data**:
   - `scripts/fetchResults.js`: Fetches tournament results from Wikipedia
   - `scripts/fixDates.js`: Validates/corrects tournament dates (runs weekly in background)

### UI Component Hierarchy
```
App.jsx (state: tour, currentDate)
  ├── Header (ATP/WTA toggle, month navigation)
  ├── Calendar.jsx (month grid layout)
  │   ├── DayCell.jsx (individual day)
  │   │   └── TournamentLogo.jsx (badge + hover tooltip)
  │   ├── MonthSummaryDialog.jsx (results modal)
  │   ├── PlayerStatsDialog.jsx (player tally modal — wins & runner-up counts)
  │   └── RankingsDialog.jsx (player rankings modal)
  └── Footer (tournament level legend)
```

### Styling Convention
- **Framework**: Tailwind CSS 4 with `@tailwindcss/vite` plugin
- **Theme**: Dark mode with gradient backgrounds and glowing borders
- **Color scheme**:
  - Grand Slam: Violet (`#a78bfa`)
  - Level 1000: Amber (`#f59e0b`)
  - Level 500: Blue (`#3b82f6`)
  - Level 250: Grey (`#8b8fa8`)
  - ATP accent: Blue gradient (`#0055bb` to `#0077ff`)
  - WTA accent: Pink gradient (`#9c1a6a` to `#d93d99`)
- **Inline styles**: UI interactions (hover effects, dynamic theming) use inline `style` props for real-time control

### Data Structures
**`tournaments.json`**: Array of tournament objects
```json
{
  "atp": [...],
  "wta": [...]
}
```
Each tournament has:
- `id`: Unique identifier (e.g., `atp-miami-2026`)
- `name`, `level` (250/500/1000/9999 for Grand Slam), `start`/`end` (ISO dates)
- `location`, `surface`, `logo` (PNG filename in `public/logos/`)
- `winner`, `runner_up`, `score` (populated for completed tournaments)

**`rankings.json`**: Monthly snapshots of top 32 ATP/WTA players
```json
{
  "atp": {
    "2026-01": [...],
    "2026-02": [...]
  },
  "wta": {...}
}
```
Each player entry: `rank`, `name`, `points`, `movement` (△/▼ vs. previous month)

## Key Conventions

### Electron ↔ React Bridge
- Use `window.electronAPI.getTournaments()` and `window.electronAPI.getRankings()` to access data
- Preload script (`electron/preload.cjs`) securely exposes APIs with context isolation enabled
- Data is read-only during app runtime (background scripts update files, Electron reloads on changes)

### State Management
- React: Local component state via `useState` (no Redux/Context)
- Global app state in `App.jsx`: `tour` (atp/wta) and `currentDate` (day.js object)
- Date logic uses **day.js** (lightweight date library)

### IPC Handlers
None currently exposed from React → Electron. All communication is one-way (Electron reads files, React queries via preload).

### File Organization
- **`src/components/`**: Stateless or semi-stateful UI components
- **`scripts/`**: Node.js utilities for data maintenance (run outside app)
- **`data/`**: Bundled JSON (source of truth for offline mode)
- **`public/logos/`**: Tournament badge images (PNG)

### Async Data Fetching
- GitHub sync in `main.js` uses `fetch()` with 8-second timeout
- Background scripts run inside app lifecycle (after `did-finish-load` event)
- Always validate JSON before writing to avoid corrupted state

### Testing Electron Features
1. For UI changes: `npm run dev` and manually test in Electron
2. For data changes: Modify `data/tournaments.json` or `data/rankings.json`, restart app
3. For backend scripts: Run directly (`node scripts/fetchResults.js`) with a test `tournaments.json`

## Player Stats Dialog

**Component**: `src/components/PlayerStatsDialog.jsx`

**Purpose**: Displays a year-to-date (YTD) cumulative tally of player tournament wins and runner-up finishes from the start of the season through the end of the current month.

**How it works**:
1. **Aggregation**: Loops through all `cumulativeTournaments` (Jan 1 through end of current month) and builds a map of player name → {wins, runnerUp}
2. **Sorting**: Sorts players by total appearances (wins + runner-up descending), then by wins (descending)
3. **Display**: Table with columns: Player | Wins 🏆 | Runner-Up 🥈 | Total
4. **Integration**: Button "📈 Player Stats" appears alongside Results & Rankings buttons when month has completed tournaments

**Props**:
- `monthLabel`: Display text (e.g., "January 2026")
- `completedTournaments`: Array of cumulative tournament objects with `winner` and `runner_up` fields (from season start through end of month)
- `tour`: 'atp' or 'wta' (determines accent color)
- `onClose`: Callback to close dialog

**Features**:
- **Year-to-Date tracking**: Shows cumulative totals from January 1 through the end of the current month
- Escape key closes dialog
- Click outside dialog closes it
- Empty state: "No players with tournament results this month" if no tournaments completed
- Styled to match MonthSummaryDialog and RankingsDialog (dark theme, accent colors)
- Responsive grid layout (4 columns: 1fr 60px 80px 60px)

**Example output** (April 2026 — cumulative from Jan 1 to Apr 30):
```
PLAYER      | WINS | RUNNER-UP | TOTAL
J. Sinner   | 5    | 3         | 8      (accumulated across Jan, Feb, Mar, Apr)
D. Medvedev | 3    | 4         | 7      (accumulated across Jan, Feb, Mar, Apr)
T. Fritz    | 2    | 2         | 4      (accumulated across Jan, Feb, Mar, Apr)
```

**Behavior**:
- Clicking Player Stats in January shows only January tournaments
- Clicking Player Stats in February shows January + February tournaments
- Clicking Player Stats in April shows January + February + March + April tournaments
- Numbers always increase (or stay same) as you navigate forward through months

## Background Scripts

### `scripts/fetchResults.js` — Wikipedia Result Scraper
**Purpose**: Fetches tournament results (winner, runner-up, final score) from Wikipedia for any completed tournament that lacks results in `tournaments.json`.

**How it works**:
1. Scans all tournaments where `end date < today` and `winner` field is empty
2. Searches Wikipedia for `"YYYY Tournament Name tennis"` → `"YYYY Tournament Name"`
3. Parses the Singles section, extracts the `def.` (defeated) line with wikilinks to player names
4. Cleans player names (strips tennis qualifiers, display overrides)
5. Extracts and cleans final score (removes references, templates, wikilinks)
6. Writes results back to `tournaments.json` and saves formatted JSON

**Key functions**:
- `searchWikipedia()`: Queries Wikipedia API with User-Agent header
- `getWikitext()`: Fetches raw wikitext of a page
- `extractSinglesResult()`: Parses `=== Singles ===` section for the `def.` line
- `cleanPlayerName()`, `cleanScore()`: Regex-based text processing
- `fetchMissingResults()`: Main export; call with optional data path

**Run manually**: `node scripts/fetchResults.js` (uses `data/tournaments.json`)

**Called automatically**: In `electron/main.js` after window loads (`did-finish-load` event) — user won't see delays because it runs in background.

**Error handling**: Logs failures per tournament; silently continues if a tournament result can't be found. No result = no update.

---

### `scripts/fixDates.js` — Tournament Date Validator
**Purpose**: Validates tournament end dates against Wikipedia and corrects mismatches. Only checks near-term tournaments (today ± 14 days lookahead) to avoid checking far-future events without Wikipedia pages or very old events already manually verified.

**How it works**:
1. Scans tournaments ending within **14 days** from today
2. Searches Wikipedia for each tournament's page
3. Parses the `|date=` field from the infobox (handles many formats: `"13–19 April"`, `"April 13–19"`, `"23 Feb – 1 March"`, etc.)
4. Validates plausibility: end date must be 0–21 days after start date (max realistic tournament length)
5. Cross-checks title word overlap to avoid false matches
6. If dates differ, logs correction and updates `tournaments.json`

**Key functions**:
- `parseDateField()`: Regex-based date parser supporting cross-month ranges
- `isValidMatch()`: Ensures date is plausible and title keywords overlap
- `getWikiSearchName()`: Maps local tournament names to Wikipedia titles (e.g., `"Stuttgart Open"` → `"Porsche Tennis Grand Prix"`)
- `checkTournamentDate()`: Looks up one tournament, returns `{correctEnd, source}`
- `fixTournamentDates()`: Main export; call with optional data path

**Special handling**:
- **WIKI_NAME_MAP**: Hardcoded mappings for tournaments with different names on Wikipedia (Stuttgart, Miami, Paris, etc.)
- **Rate limiting**: 600ms delay between Wikipedia API calls to avoid hitting rate limits
- **Lookahead logic**: Only checks tournaments ending within ±14 days. Past tournaments assumed correct (manually verified once). Future tournaments skipped (no Wikipedia pages yet).

**Run manually**: `node scripts/fixDates.js`

**Called automatically**:
1. In `electron/main.js` after window loads if last check was >7 days ago
2. Via launchd on macOS: `scripts/weeklyUpdate.sh` runs every Sunday 9am (see `~/Library/LaunchAgents/com.tennis.calendar.weeklyupdate.plist`)

**Error handling**: If Wikipedia can't be reached, silently continues. If a tournament date can't be extracted, logs and moves on. Invalid dates (out of range) are rejected with a warning, then skipped.

---

### `scripts/weeklyUpdate.sh` — Automated Commit Script
**Purpose**: Runs on macOS via launchd every Sunday at 9am. Calls `fixDates.js`, commits changes to git if any updates were made.

**Flow**:
1. Runs `node scripts/fixDates.js`
2. Checks `git diff --quiet data/tournaments.json`
3. If changed, stages, commits (with `Co-authored-by: Copilot` trailer), and pushes
4. Logs all output to `~/Library/Logs/tennis-calendar-update.log`

**Note**: This is local to the developer's machine, not part of CI/CD. Setup requires configuring a launchd plist manually.

---

### `scripts/download_logos.py` — Asset Helper
**Purpose**: Downloads tournament logo PNG files from online sources to `public/logos/`. Useful when adding new tournaments that need new logo assets.

**Note**: Run this manually when updating data; not called automatically.

---

## GitHub Actions & Deployment

### Build Workflow (`.github/workflows/build.yml`)
**Trigger**: On every push to `main` branch, or manually via **Actions** tab

**Jobs**:
1. **build-mac** (macOS latest)
   - Sets up Node 20
   - Runs `npm ci` (clean install)
   - Runs `npm run dist` (Vite build + electron-builder)
   - Uploads `.dmg` file as artifact (Tennis-Calendar-macOS)

2. **build-windows** (Windows latest)
   - Same steps but uploads `.exe` file (Tennis-Calendar-Windows)

**Linux**: Not currently built; can be added by duplicating the Windows job and changing runner/artifact path.

**Artifacts**: Auto-expires after 90 days (GitHub default)

---

### Distribution & Download
**Pre-built installers** are available after each push (Actions tab → latest run → Artifacts):
- **macOS**: `.dmg` installer (unsigned; users must right-click → Open on first launch)
- **Windows**: `.exe` installer (may trigger SmartScreen warning; users click More info → Run anyway)

**electron-builder** configuration lives in `package.json` under `"build"`:
- `appId`: `com.tennis.calendar`
- `productName`: `Tennis Calendar`
- Includes `dist/`, `electron/`, `scripts/`, `data/`, `public/` in packaged app
- Platform-specific targets (dmg for macOS, nsis for Windows, AppImage for Linux)

---

### Data Sync & Updates
**On app launch**:
1. `syncUserData()` in `main.js` fetches latest `tournaments.json` and `rankings.json` from GitHub (raw content URL)
2. If GitHub is unreachable (offline, timeout >8 seconds), silently falls back to bundled data
3. Data stored in user's app data folder (not in the bundled dist/)
4. On next launch, if GitHub was reached, new data is used automatically

**Result**: Users always have fresh data (unless offline), and app works offline with last-synced data.

---

## Common Debugging Patterns for Electron

### 1. **DevTools & Inspecting React UI**
```bash
npm run dev
```
Then in the Electron window: **Ctrl+Shift+I** (Windows/Linux) or **Cmd+Option+I** (macOS) → DevTools opens

**In DevTools**:
- **Console** tab: Check for errors, logs from React (`console.log()` appears here)
- **Elements** tab: Inspect React DOM tree and computed styles
- **Network** tab: Monitor API calls (none currently, but useful for future)

---

### 2. **Debugging Preload Script & IPC**
**Issue**: `window.electronAPI` is undefined
- Check `electron/preload.cjs` exists and has `contextBridge.exposeInMainWorld()`
- Verify `main.js` is passing correct preload path: `preload: path.join(__dirname, 'preload.cjs')`
- Check `contextIsolation: true` is set in `webPreferences`

**Test in DevTools Console**:
```javascript
console.log(window.electronAPI); // should show {getTournaments, getRankings}
window.electronAPI.getTournaments(); // should return data object
```

---

### 3. **Data Path Issues**
**Problem**: App shows stale data or errors loading JSON

**Check sequence**:
1. Is the app running in dev mode (`npm run dev`) or from build (`npm start`)?
   - Dev: Preload reads from `data/` folder
   - Production: Preload reads from `app.getPath('userData')` (set by `main.js` on startup)

2. Verify `USER_DATA_PATH` is set:
   ```javascript
   // In main.js, after syncUserData():
   console.log('USER_DATA_PATH:', process.env.USER_DATA_PATH);
   ```

3. Check file permissions: userData folder must be readable/writable
   ```bash
   # macOS
   ls -la ~/Library/Application\ Support/Tennis\ Calendar/
   ```

4. Manually inspect the JSON files:
   ```bash
   cat ~/Library/Application\ Support/Tennis\ Calendar/tournaments.json | jq '.'
   ```

---

### 4. **Background Script Errors**
**Problem**: `fetchMissingResults()` or `fixTournamentDates()` fails silently

**Debug**:
1. Run the script manually to see output:
   ```bash
   node scripts/fetchResults.js  # or fixDates.js
   ```

2. Check `main.js` error handlers:
   ```javascript
   // Line 95-98: fetchMissingResults error → console.error()
   // Line 103-108: fixTournamentDates error → console.error()
   ```

3. Open DevTools Console after app starts; errors should appear there

4. Check `~/.config/Tennis Calendar/logs/` (Windows) or app logs if Electron builds them

---

### 5. **GitHub Sync Failures**
**Problem**: App stuck on old data even though GitHub has updates

**Check**:
1. Is network online? Try `curl` from terminal:
   ```bash
   curl -I https://raw.githubusercontent.com/abhinavp403/tennis-calendar/main/data/tournaments.json
   ```

2. Is GitHub repo accessible? Check if public.

3. Sync is silent-fail by design. To force a fresh sync:
   - Delete `~/Library/Application Support/Tennis Calendar/tournaments.json`
   - Restart app (will re-fetch from GitHub, or fall back to bundled if offline)

4. Check sync code in `main.js` lines 17-46 (`syncUserData()` function)

---

### 6. **Electron Window Won't Open**
**Problem**: App crashes on startup

**Check**:
1. Does `dist/index.html` exist?
   ```bash
   ls dist/index.html  # if empty, run: npm run build
   ```

2. Are there preload/IPC errors? Check console output when running `npm run dev`

3. Is Node version ≥18? Check with `node --version`

4. Does Electron spawn correctly?
   ```bash
   npm start  # runs Electron main.js directly
   ```

---

### 7. **Styling Issues in Electron**
**Problem**: Tailwind CSS not applied, or gradients look wrong

**Check**:
1. Is Tailwind PostCSS processor running? Should happen in dev via Vite plugin
   ```bash
   npm run dev  # should process Tailwind; if not, check vite.config.js
   ```

2. Are all custom theme colors in `src/index.css` (THEME block)?

3. Build CSS with `npm run build` and check `dist/index.css` for actual compiled styles

4. In DevTools, inspect element and check computed styles (Tailwind classes vs. inline styles)

**Note**: Most component styling uses inline `style` props (not Tailwind classes) for dynamic ATP/WTA colors. This is intentional.

---

### 8. **Wikipedia Scraping Timeout or Rate Limits**
**Problem**: `fetchResults.js` or `fixDates.js` times out or returns HTML error

**Fixes**:
1. Increase timeout in `main.js` line 32: `AbortSignal.timeout(8000)` → larger value (milliseconds)

2. Check User-Agent header is sent:
   ```javascript
   // Should be in fetchResults.js line 18, fixDates.js line 56
   headers: { 'User-Agent': 'TennisCalendarApp/1.0' }
   ```

3. Add delays between requests (already done in `fixDates.js` line 142: `const REQUEST_DELAY = 600`). Increase if rate-limited:
   ```javascript
   const REQUEST_DELAY = 1000; // 1 second instead of 600ms
   ```

4. Wikipedia IP-based blocking? Try from a different network or wait.

---

## Development Notes

### Common Workflows
- **Add a new UI component**: Create in `src/components/`, import into parent, use Tailwind + inline styles
- **Update tournament data**: Edit `data/tournaments.json` → restart app (or GitHub sync on next launch)
- **Change colors/theme**: Update gradient strings in `App.jsx` or component inline styles
- **Debug Electron preload**: Check `electron/preload.cjs` for API exposure and `main.js` for data path logic
- **Run data update scripts**: `node scripts/fetchResults.js` or `node scripts/fixDates.js` (see Background Scripts section)

### Module System
- App uses ES6 imports (`"type": "module"` in package.json)
- Preload uses CommonJS (`.cjs` file required for Electron security context)

### Build Output
- `npm run build` outputs to `dist/` (index.html + bundled JS/CSS)
- `npm run dist` uses electron-builder to package into platform-specific installers
- Vite base is set to `./` for relative paths (important for file:// URLs in Electron)
