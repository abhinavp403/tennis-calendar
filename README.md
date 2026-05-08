# 🎾 Tennis Calendar 2026

A desktop app built with **Electron + React + Vite** that displays the full 2026 ATP and WTA tour schedules on an interactive calendar, including final results, player stats, and rankings.

![Tennis Calendar](https://img.shields.io/badge/Electron-React-blue?logo=electron) ![License](https://img.shields.io/badge/license-ISC-green)

---

## Features

- 📅 **Monthly calendar view** — navigate through the full 2026 season month by month
- 🏆 **Tournament final-day markers** — each tournament appears on its final day with a logo/badge
- 🎾 **Grand Slam highlighting** — Grand Slams appear in distinct violet/purple with finals results (winner, runner-up, score)
- 🔍 **Hover tooltips** — hover over any tournament to see name, location, surface, and level
- ✅ **Match results on hover** — completed tournaments show the winner, runner-up, and final score
- 📋 **Month summary dialog** — a "Results" button opens a summary of all completed tournaments for that month
- 📈 **Player Stats (YTD)** — a cumulative year-to-date tally of every player's wins and runner-up finishes from January through the current month, sorted by wins
- 📊 **Monthly rankings** — a "Rankings" button shows the top 20 ATP/WTA players at end of each completed month, with points and ▲▼ movement indicators vs. the previous month
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

---

## Data

Tournament data lives in `data/tournaments.json` and includes fields for every event:

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
  "score": "6–4, 6–4"
}
```

Results (`winner`, `runner_up`, `score`) are populated for all completed tournaments sourced from Wikipedia.
