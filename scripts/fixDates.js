/**
 * Checks tournament end dates against Wikipedia and corrects any mismatches.
 *
 * Only checks tournaments that are either currently in progress or ending within
 * the next LOOKAHEAD_DAYS days — Wikipedia pages don't exist yet for far-future
 * tournaments, and past tournaments were already verified manually.
 *
 * Run manually:   node scripts/fixDates.js
 * Run automatically: via ~/Library/LaunchAgents/com.tennis.calendar.weeklyupdate.plist (every Sunday 9am)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/tournaments.json');

// Only check tournaments ending within this many days from today
const LOOKAHEAD_DAYS = 14;

// Delay between Wikipedia API calls to avoid rate limiting (ms)
const REQUEST_DELAY = 600;

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};
const MONTH_PATTERN = Object.keys(MONTHS).join('|');

/**
 * Some tournaments use a different name on Wikipedia than in our data.
 * Keys are substrings of tournament.name (lowercase), values are the Wikipedia title prefix.
 */
const WIKI_NAME_MAP = {
  'bavarian international': 'BMW Open',
  'stuttgart open': 'Porsche Tennis Grand Prix',       // WTA Stuttgart
  'porsche tennis': 'Porsche Tennis Grand Prix',
  'internazionali bnl': "Internazionali BNL d'Italia",
  'italian open': "Internazionali BNL d'Italia",
  'canadian open': 'Canadian Open',
  'cincinnat': 'Western & Southern Open',
  'madrid open': 'Mutua Madrid Open',
  'paris masters': 'Rolex Paris Masters',
  'libéma open': 'Libéma Open',
  'queen\'s club': "Queen's Club Championships",
  'shanghai masters': 'Shanghai Masters',
  'china open': 'China Open',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wikiApiGet(params) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': 'TennisCalendarApp/1.0' } });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Wikipedia returned HTML (possibly rate limited)');
  return JSON.parse(text);
}

async function searchWikipedia(query) {
  const data = await wikiApiGet({ action: 'query', list: 'search', srsearch: query, srlimit: '5' });
  return data.query?.search ?? [];
}

async function getWikitext(title) {
  const data = await wikiApiGet({ action: 'query', titles: title, prop: 'revisions', rvprop: 'content', rvslots: 'main' });
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

/**
 * Parses Wikipedia infobox date strings into an ISO end date (YYYY-MM-DD).
 * Handles formats like:
 *   "13–19 April"           → 2026-04-19
 *   "April 13–19, 2026"     → 2026-04-19
 *   "13 April – 19 April"   → 2026-04-19
 *   "23 February – 1 March" → 2026-03-01 (cross-month)
 */
function parseDateField(dateStr, year) {
  dateStr = dateStr.replace(/\{\{.*?\}\}/g, '').replace(/\[\[|\]\]/g, '').trim();

  let endDay, endMonth;

  // "13–19 April" or "13-19 April"
  let m = dateStr.match(new RegExp(`\\d+\\s*[–\\-]\\s*(\\d+)\\s+(${MONTH_PATTERN})`, 'i'));
  if (m) { endDay = m[1]; endMonth = MONTHS[m[2].toLowerCase()]; }

  // "April 13–19" or "April 13-19"
  if (!endDay) {
    m = dateStr.match(new RegExp(`(${MONTH_PATTERN})\\s+\\d+\\s*[–\\-]\\s*(\\d+)`, 'i'));
    if (m) { endDay = m[2]; endMonth = MONTHS[m[1].toLowerCase()]; }
  }

  // "13 April – 19 April" or "23 February – 1 March" (cross-month)
  if (!endDay) {
    m = dateStr.match(new RegExp(`\\d+\\s+(?:${MONTH_PATTERN})\\s*[–\\-]\\s*(\\d+)\\s+(${MONTH_PATTERN})`, 'i'));
    if (m) { endDay = m[1]; endMonth = MONTHS[m[2].toLowerCase()]; }
  }

  if (!endDay || !endMonth) return null;
  return `${year}-${endMonth}-${endDay.padStart(2, '0')}`;
}

/**
 * Sanity checks:
 * 1. End date must be 0–21 days after the tournament start (max realistic tournament length).
 * 2. The Wikipedia article title must share at least one significant word with the tournament name.
 */
function isValidMatch(correctEnd, tournament, wikiTitle) {
  const end = new Date(correctEnd);
  const start = new Date(tournament.start);
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays < 0 || diffDays > 21) return false;

  // Title word overlap check — ignore short/common words
  const stopWords = new Set(['the', 'open', 'of', 'de', 'la', 'le', 'and', 'international', 'tennis', 'championships', 'masters', 'grand', 'prix']);
  const titleWords = wikiTitle.toLowerCase().replace(/\d{4}/g, '').split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
  const nameWords  = tournament.name.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
  return titleWords.some(w => nameWords.some(n => n.includes(w) || w.includes(n)));
}

function getWikiSearchName(tournament) {
  const lower = tournament.name.toLowerCase();
  for (const [key, mapped] of Object.entries(WIKI_NAME_MAP)) {
    if (lower.includes(key)) return mapped;
  }
  return tournament.name;
}

async function checkTournamentDate(tournament) {
  const year = tournament.start.slice(0, 4);
  const searchName = getWikiSearchName(tournament);
  const usedMapping = searchName !== tournament.name;
  const queries = [
    `${year} ${searchName} tennis`,
    `${year} ${searchName}`,
  ];

  for (const query of queries) {
    await sleep(REQUEST_DELAY);
    const results = await searchWikipedia(query);
    const candidate = results.find(r => r.title.includes(year) && !r.title.includes(' – '));
    if (!candidate) continue;

    await sleep(REQUEST_DELAY);
    const wikitext = await getWikitext(candidate.title);
    if (!wikitext) continue;

    const dateMatch = wikitext.match(/\|\s*date\s*=\s*([^\n|]+)/i);
    if (!dateMatch) continue;

    const correctEnd = parseDateField(dateMatch[1].trim(), year);
    if (!correctEnd) continue;

    // Skip title-overlap check for manually mapped tournaments — the mapping is authoritative
    if (!usedMapping && !isValidMatch(correctEnd, tournament, candidate.title)) {
      console.log(`  ⚠ Rejected "${candidate.title}" (date ${correctEnd} implausible or title mismatch)`);
      continue;
    }

    // Still enforce date plausibility even for mapped tournaments
    const end = new Date(correctEnd);
    const start = new Date(tournament.start);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > 21) {
      console.log(`  ⚠ Rejected "${candidate.title}" (date ${correctEnd} out of range for start ${tournament.start})`);
      continue;
    }

    return { correctEnd, source: candidate.title };
  }
  return null;
}

export async function fixTournamentDates() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + LOOKAHEAD_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  console.log(`Checking tournaments active between ${todayStr} and ${cutoffStr}...\n`);

  let updated = false;

  for (const tour of ['atp', 'wta']) {
    for (const tournament of data[tour]) {
      // Skip past tournaments and those ending too far in the future
      if (tournament.end < todayStr || tournament.end > cutoffStr) continue;

      console.log(`Checking: ${tour.toUpperCase()} ${tournament.name} (current end: ${tournament.end})`);
      try {
        const result = await checkTournamentDate(tournament);
        if (!result) {
          console.log(`  ✗ Could not find date on Wikipedia`);
          continue;
        }
        if (result.correctEnd !== tournament.end) {
          console.log(`  ✓ Corrected: ${tournament.end} → ${result.correctEnd} (from "${result.source}")`);
          tournament.end = result.correctEnd;
          updated = true;
        } else {
          console.log(`  ✓ Date correct: ${tournament.end}`);
        }
      } catch (err) {
        console.error(`  Error checking ${tournament.name}:`, err.message);
      }
    }
  }

  if (updated) {
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log('\ntournaments.json updated with corrected dates.');
  } else {
    console.log('\nAll dates verified — no changes needed.');
  }

  return updated;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fixTournamentDates().catch(console.error);
}
