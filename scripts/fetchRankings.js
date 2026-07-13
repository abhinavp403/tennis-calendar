/**
 * Fetches current ATP and WTA rankings from Wikipedia's "Current tennis rankings"
 * page and stores a snapshot keyed by the page's "As of" date (the weekly Monday
 * the rankings reflect). Snapshots are captured at most once per ~2 weeks
 * (bi-weekly). Wikipedia only exposes the current week, so history cannot be
 * backfilled — legacy monthly keys ("YYYY-MM") remain and are read alongside the
 * new date keys ("YYYY-MM-DD").
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { updateGist } from './updateGist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/rankings.json');
const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; noreply@github.com) node-fetch';

const WIKI_PAGE = 'Current tennis rankings';
const TOP_N = 20;
// Minimum days between stored snapshots. The tour updates weekly (Mondays), so
// 13 lets an every-other-Monday cadence through while blocking same-week re-runs.
const BIWEEKLY_MIN_DAYS = 13;

async function getWikitext(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(title) +
    '&prop=revisions&rvprop=content&format=json&rvslots=main';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await res.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

function parseSection(wikitext, sectionMarker) {
  // Find the section (e.g., "ATP singles ranking" or "WTA singles ranking")
  const startTag = `<section begin=${sectionMarker} />`;
  const endTag = `<section end=${sectionMarker} />`;
  const startIdx = wikitext.indexOf(startTag);
  const endIdx = wikitext.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) return '';
  return wikitext.slice(startIdx, endIdx);
}

function parseRankingsTable(section, countryLookup = {}) {
  const players = [];
  const rows = section.split('\n');

  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim();

    // Match rank lines: |1, |2, etc. or |[[...|1]]
    const rankMatch = line.match(/^\|\s*(?:\[\[[^\]]*\|)?(\d+)\]?\]?\s*$/);
    if (!rankMatch) continue;

    const rank = parseInt(rankMatch[1], 10);
    if (rank > TOP_N) break;

    // Next line has player info: |{{flagathlete|[[Name]]|COUNTRY}} || points || move
    // or: |{{noflag}}[[Name]]|| points || move
    const nextLine = rows[i + 1]?.trim() ?? '';

    // Extract player name from [[Name]] or [[Name|Display]] or [[Name (tennis)|Display]]
    const nameMatch = nextLine.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (!nameMatch) continue;
    let fullName = (nameMatch[2] || nameMatch[1]).trim();
    // Strip qualifiers like "(tennis)"
    fullName = fullName.replace(/\s*\([^)]*\)/g, '').trim();

    // Extract country code from {{flagathlete|...|CODE}} or {{flagicon|CODE}}
    let country = '';
    const flagMatch = nextLine.match(/\{\{flag(?:athlete|icon)\|[^|]*\|([A-Z]{2,3})\}\}/i);
    if (flagMatch) {
      country = flagMatch[1].toUpperCase();
    }

    // Extract points (number with possible comma)
    const pointsMatch = nextLine.match(/\|\|?\s*([\d,]+)\s*\|\|/);
    if (!pointsMatch) continue;
    const points = parseInt(pointsMatch[1].replace(/,/g, ''), 10);

    // Extract movement: {{steady}}, {{up}} N, {{down}} N
    let movement = null;
    const moveMatch = nextLine.match(/\{\{(steady|up|down)\}\}\s*(\d*)/i);
    if (moveMatch) {
      const dir = moveMatch[1].toLowerCase();
      const val = parseInt(moveMatch[2], 10) || 0;
      if (dir === 'up') movement = `△${val}`;
      else if (dir === 'down') movement = `▼${val}`;
      else movement = '—';
    }

    // Abbreviate name: "Jannik Sinner" → "J. Sinner"
    const abbreviated = abbreviateName(fullName);

    // Fall back to previous month's country for noflag players
    if (!country && countryLookup[abbreviated]) {
      country = countryLookup[abbreviated];
    }

    players.push({
      rank,
      name: abbreviated,
      country,
      points,
      ...(movement && { movement }),
    });

    if (players.length >= TOP_N) break;
  }

  return players;
}

function abbreviateName(fullName) {
  const parts = fullName.split(/\s+/);
  if (parts.length < 2) return fullName;
  // First initial + last name(s)
  return parts[0][0] + '. ' + parts.slice(1).join(' ');
}

// Parse the "As of" date from the page, e.g. {{As of|2026|6|29|df=UK|lc=y}}
// → "2026-06-29". All ranking tables on the page share the same Monday date.
function parseAsOfDate(wikitext) {
  const m = wikitext.match(/\{\{As of\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Normalize any ranking key to a UTC Date. Legacy "YYYY-MM" maps to that
// month's last day; "YYYY-MM-DD" maps to the exact date.
function keyToDate(key) {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// True when asOfDate is the final weekly ranking of its month — i.e. the next
// weekly update (7 days later) lands in a different month. Works whether the
// update fell on a Monday or a Slam-final Sunday.
function isMonthEndUpdate(asOfDate) {
  const d = keyToDate(asOfDate);
  const next = new Date(d.getTime() + 7 * 86_400_000);
  return next.getUTCMonth() !== d.getUTCMonth();
}

// Store a new snapshot if the "As of" date is new AND either it's ≥13 days
// after the latest snapshot (bi-weekly cadence) OR it's the last weekly ranking
// of its month (guarantees a true end-of-month snapshot even inside the gap).
function shouldStore(existingKeys, asOfDate) {
  if (existingKeys.includes(asOfDate)) return false; // already captured this week
  if (existingKeys.length === 0) return true;
  const asOf = keyToDate(asOfDate);
  const latest = existingKeys.map(keyToDate).sort((a, b) => b - a)[0];
  const days = (asOf - latest) / 86_400_000;
  // days > 0 keeps the month-end branch from adding a point older than what we
  // already hold (e.g. legacy "2026-06" normalizes to June 30, so June's last
  // Monday June 29 must not be stored on top of it).
  return days >= BIWEEKLY_MIN_DAYS || (days > 0 && isMonthEndUpdate(asOfDate));
}

export async function fetchMissingRankings(dataPath = DATA_PATH) {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  console.log('Fetching current rankings from Wikipedia...');
  const wikitext = await getWikitext(WIKI_PAGE);
  if (!wikitext) {
    console.error('  ✗ Could not fetch Wikipedia page');
    return false;
  }

  const asOfDate = parseAsOfDate(wikitext);
  if (!asOfDate) {
    console.error('  ✗ Could not determine the "As of" date — skipping to avoid mislabeling');
    return false;
  }

  const atpKeys = Object.keys(data.atp || {});
  const wtaKeys = Object.keys(data.wta || {});
  const storeAtp = shouldStore(atpKeys, asOfDate);
  const storeWta = shouldStore(wtaKeys, asOfDate);

  if (!storeAtp && !storeWta) {
    console.log(`Rankings are up to date (latest is within ${BIWEEKLY_MIN_DAYS} days of ${asOfDate}).`);
    return false;
  }

  // Build country lookup from all stored snapshots (for noflag players)
  const countryLookup = {};
  for (const tour of ['atp', 'wta']) {
    for (const key of Object.keys(data[tour] || {})) {
      for (const player of data[tour][key]) {
        if (player.country) {
          countryLookup[player.name] = player.country;
        }
      }
    }
  }

  // Parse ATP rankings
  const atpSection = parseSection(wikitext, 'ATP singles ranking');
  const atpPlayers = parseRankingsTable(atpSection, countryLookup);

  // Parse WTA rankings
  const wtaSection = parseSection(wikitext, 'WTA singles ranking');
  const wtaPlayers = parseRankingsTable(wtaSection, countryLookup);

  let updated = false;

  if (storeAtp && atpPlayers.length > 0) {
    if (!data.atp) data.atp = {};
    data.atp[asOfDate] = atpPlayers;
    console.log(`  ✓ ATP rankings saved for ${asOfDate} (${atpPlayers.length} players)`);
    updated = true;
  } else if (storeAtp) {
    console.log('  ✗ Could not parse ATP rankings');
  }

  if (storeWta && wtaPlayers.length > 0) {
    if (!data.wta) data.wta = {};
    data.wta[asOfDate] = wtaPlayers;
    console.log(`  ✓ WTA rankings saved for ${asOfDate} (${wtaPlayers.length} players)`);
    updated = true;
  } else if (storeWta) {
    console.log('  ✗ Could not parse WTA rankings');
  }

  if (updated) {
    // Sort keys chronologically
    const sortedAtp = {};
    Object.keys(data.atp).sort().forEach(k => { sortedAtp[k] = data.atp[k]; });
    data.atp = sortedAtp;

    const sortedWta = {};
    Object.keys(data.wta).sort().forEach(k => { sortedWta[k] = data.wta[k]; });
    data.wta = sortedWta;

    writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
    console.log('rankings.json updated.');
    await updateGist({ 'rankings.json': dataPath });
  }

  return updated;
}

// Allow running directly: node scripts/fetchRankings.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchMissingRankings().catch(console.error);
}
