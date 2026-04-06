# 🎾 Tennis Calendar 2026

A desktop app built with **Electron + React + Vite** that displays the full 2026 ATP and WTA tour schedules on an interactive calendar, including final results for completed tournaments.

![Tennis Calendar](https://img.shields.io/badge/Electron-React-blue?logo=electron) ![License](https://img.shields.io/badge/license-ISC-green)

---

## Features

- 📅 **Monthly calendar view** — navigate through the full 2026 season month by month
- 🏆 **Tournament final-day markers** — each tournament appears on its final day with a logo/badge
- 🔍 **Hover tooltips** — hover over any tournament to see name, location, surface, and level
- ✅ **Match results on hover** — completed tournaments show the winner, runner-up, and final score
- 📋 **Month summary dialog** — a "Results" button below the calendar opens a summary of all completed tournaments for that month
- 🔵🩷 **ATP / WTA toggle** — switch between the men's and women's tour instantly
- 🎨 **Vibrant dark theme** — colour-coded by tournament level (1000 / 500 / 250) with glows and gradients

---

## Tournament Levels

| Level | Colour | Examples |
|-------|--------|---------|
| **1000** | 🟡 Amber | Indian Wells, Miami, Roland Garros |
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
```

### Build

```bash
npm run build
```

---

## Project Structure

```
tennis_calendar/
├── data/
│   └── tournaments.json        # Full ATP & WTA schedule with results
├── electron/
│   └── main.js                 # Electron main process
├── public/
│   └── logos/                  # Tournament logo images
├── src/
│   ├── App.jsx                 # Root layout, header, navigation
│   └── components/
│       ├── Calendar.jsx        # Monthly grid + summary button
│       ├── DayCell.jsx         # Individual day tile
│       ├── TournamentLogo.jsx  # Logo/badge + hover tooltip
│       └── MonthSummaryDialog.jsx  # Results modal
├── index.html
├── vite.config.js
└── package.json
```

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
