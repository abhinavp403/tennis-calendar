# 🎾 Tennis Calendar 2026

A desktop app built with **Electron + React + Vite** that displays the full 2026 ATP and WTA tour schedules on an interactive calendar, including final results, player stats, and rankings.

![Tennis Calendar](https://img.shields.io/badge/Electron-React-blue?logo=electron) ![License](https://img.shields.io/badge/license-ISC-green)

---

## Features

- 📅 **Monthly calendar view** — navigate through the full 2026 season month by month
- 🏆 **Tournament final-day markers** — each tournament appears on its final day with a logo/badge
- 🎾 **Grand Slam highlighting** — Grand Slams appear in distinct violet/purple with finals results (winner, runner-up, score)
- 🔍 **Search** — jump to any tournament, or find a player by first *or* last name and open their profile
- 🗓️ **Jump to any month** — click the month title for a slot-machine month/year picker
- 🎾 **Surface filter** — show only hard, indoor, clay, or grass events
- 🛈 **Hover tooltips** — hover over any tournament to see name, location, surface, and level
- ✅ **Match results on hover** — completed tournaments show the winner, runner-up, and final score
- 📋 **Month summary dialog** — a "Results" button opens a summary of all completed tournaments for that month
- 📈 **Player Stats (YTD)** — a season-long leaderboard ranked by *level-weighted points* (a Grand Slam counts far more than a stack of 250s), showing each player's titles, runner-ups, total finals, and points; click a name for a full profile (win %, best surface, per-surface breakdown)
- 🏳️ **Country flags** — players are shown with their national flag across stats, search, rankings, and profiles
- 🏆 **Champions wall** — every title winner of the season at a glance
- 📊 **Rankings** — a "Rankings" button shows the top 20 ATP/WTA players for the displayed month, with points, ▲▼ movement vs. the previous snapshot, and a "race to #1" chart. Snapshots are captured roughly every two weeks
- 🔵🩷 **ATP / WTA toggle** — switch between the men's and women's tour instantly
- 🎨 **Vibrant dark theme** — colour-coded by tournament level (Grand Slam / 1500 / 1000 / 500 / 250) with glows and gradients

---

## Tournament Levels

| Level | Colour | Examples |
|-------|--------|---------|
| **Grand Slam** | 🟣 Violet | Australian Open, Roland Garros, Wimbledon, US Open |
| **1500** | 🟣 Violet | ATP Finals, WTA Finals |
| **1000** | 🟡 Amber | Indian Wells, Miami, Madrid |
| **500** | 🔵 Blue | Dubai, Rotterdam, Dallas |
| **250** | ⚪ Grey | Adelaide, Hobart, Delray Beach |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Electron](https://www.electronjs.org/) |
| UI framework | [React 19](https://react.dev/) |
| Build tool | [Vite 8](https://vitejs.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Date handling | [Day.js](https://day.js.org/) |
| Dev runner | [concurrently](https://github.com/open-cli-tools/concurrently) + [wait-on](https://github.com/jeffbski/wait-on) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Install & Run

```bash
# Clone the repo
git clone https://github.com/abhinavp403/tennis-calendar.git
cd tennis-calendar

# Install dependencies
npm install

# Start in development mode (Vite dev server + Electron)
npm run dev

# Or run in browser only (no Electron)
npm run dev:vite
```

### Build

```bash
npm run build
```

---

## Web version (no install)

Live at **https://tennis-calendar-ivory.vercel.app** (or wherever you deploy it on Vercel).

The web build serves the same React app and fetches tournament data from the cloud Gist on load. Works on phones, tablets, and any browser — no install needed. Deploy your own copy by importing this repo into Vercel; no configuration required (settings live in `vercel.json`).

---

## Downloading the App

Pre-built installers can be generated via GitHub Actions (triggered manually from the Actions tab).

### macOS (Apple Silicon)

1. Go to the [**Actions** tab](https://github.com/abhinavp403/tennis-calendar/actions) on GitHub
2. Select **"Build Distributables"** and click **Run workflow**
3. Download the **Tennis-Calendar-macOS** artifact (`.dmg`)
4. Open the `.dmg`, drag **Tennis Calendar** to Applications
5. **First launch:** right-click the app → **Open** (to bypass Gatekeeper — the app is unsigned)

### Windows

1. Go to the [**Actions** tab](https://github.com/abhinavp403/tennis-calendar/actions) on GitHub
2. Select **"Build Distributables"** and click **Run workflow**
3. Download the **Tennis-Calendar-Windows** artifact (`.exe`)
4. Run the installer — Windows may show a SmartScreen warning; click **More info → Run anyway**

### Calendar file (.ics) — import into Google / Apple / Outlook

Prefer to view the schedule inside your own calendar app instead of running the desktop app? Subscribe to the live `.ics` feed — results fill in automatically as tournaments complete throughout the season.

```
https://raw.githubusercontent.com/abhinavp403/tennis-calendar/main/tennis_calendar.ics
```

- **Google Calendar**: left sidebar → **Other calendars** (+) → **From URL** → paste the link above
- **Apple Calendar**: File → New Calendar Subscription → paste the link above
- **Outlook**: Add calendar → From internet → paste the link above

The feed is regenerated straight after each data update (twice daily), so when a tournament finishes, the winner, runner-up, and score appear in the event description within hours.

**One-time download (static snapshot):**

- Download [`tennis_calendar.ics`](./tennis_calendar.ics) from this repo
- Google Calendar: Settings → Import & export → **Import** → select the file
- Apple Calendar: double-click the file
- Outlook: File → Open & Export → Import/Export

Each tournament appears as a single all-day event on its final day, titled like `[ATP - 1000] Italian Open`. Surface, location, dates, and final results live in the event description.

---

## Data

Tournament data is stored in a [GitHub Gist](https://gist.github.com/abhinavp403/c75d3f961da94fdeed16cdbd8e2ec08e) and includes fields for every event:

```json
{
  "id": "atp-miami-2026",
  "name": "Miami Open",
  "level": 1000,
  "start": "2026-03-16",
  "end": "2026-03-29",
  "location": "Miami Gardens, USA",
  "surface": "Hard",
  "logo": "atp_miami_open.png",
  "winner": "J. Sinner",
  "runner_up": "J. Lehečka",
  "winner_full": "Jannik Sinner",
  "runner_up_full": "Jiří Lehečka",
  "score": "6–4, 6–4"
}
```

Results (`winner`, `runner_up`, `score`) are sourced from Wikipedia once a tournament finishes. The `_full` names power first-name search, and a companion `players.json` maps each player to their country code for the flags.

Everything is maintained by a GitHub Actions workflow that runs **twice daily** (01:00 and 09:00 UTC) and pushes straight to the Gist — no app rebuild needed. It verifies tournament dates against Wikipedia (so a rain-delayed final gets corrected), fetches new results, and resolves each new finalist's full name and country from their own Wikipedia article.
