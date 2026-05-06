#!/bin/bash
# Weekly tennis calendar date updater
# Runs every Sunday via launchd — checks Wikipedia for correct tournament end dates
# and commits any changes to git.

set -e

REPO="/Users/abhinavp403/Documents/Tennis/tennis_calendar"
NODE="/usr/local/bin/node"
LOG="$HOME/Library/Logs/tennis-calendar-update.log"

echo "=== Tennis Calendar Weekly Update: $(date) ===" >> "$LOG"

cd "$REPO"

# Fix dates
$NODE scripts/fixDates.js >> "$LOG" 2>&1

# Fetch missing results
$NODE scripts/fetchResults.js >> "$LOG" 2>&1

# Fetch missing rankings
$NODE scripts/fetchRankings.js >> "$LOG" 2>&1

# Commit and push if anything changed
if ! git diff --quiet data/; then
  git add data/tournaments.json data/rankings.json
  git commit -m "chore: auto-update tournament data (weekly update $(date +%Y-%m-%d))

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" >> "$LOG" 2>&1
  git push >> "$LOG" 2>&1
  echo "Changes committed and pushed." >> "$LOG"
else
  echo "No changes — nothing to commit." >> "$LOG"
fi

echo "=== Done ===" >> "$LOG"
