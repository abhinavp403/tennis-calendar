#!/bin/bash
# Weekly tennis calendar updater
# Runs every Sunday via launchd — updates tournament dates, results, and rankings.
# Data is pushed directly to the GitHub Gist (no git commits needed).

REPO="/Users/abhinavp403/Documents/Tennis/tennis_calendar"
NODE="/usr/local/bin/node"
LOG="$HOME/Library/Logs/tennis-calendar-update.log"

echo "=== Tennis Calendar Weekly Update: $(date) ===" >> "$LOG"

cd "$REPO"

# Fix dates
$NODE scripts/fixDates.js >> "$LOG" 2>&1

# Fetch missing results (also pushes to Gist if updated)
$NODE scripts/fetchResults.js >> "$LOG" 2>&1

# Fetch missing rankings (also pushes to Gist if updated)
$NODE scripts/fetchRankings.js >> "$LOG" 2>&1

echo "=== Done ===" >> "$LOG"
