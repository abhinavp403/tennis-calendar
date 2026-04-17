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

# Commit and push if anything changed
if ! git diff --quiet data/tournaments.json; then
  git add data/tournaments.json
  git commit -m "chore: auto-correct tournament end dates (weekly update $(date +%Y-%m-%d))

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" >> "$LOG" 2>&1
  git push >> "$LOG" 2>&1
  echo "Changes committed and pushed." >> "$LOG"
else
  echo "No date changes — nothing to commit." >> "$LOG"
fi

echo "=== Done ===" >> "$LOG"
