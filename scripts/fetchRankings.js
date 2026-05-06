/**
 * Fetches current ATP and WTA rankings from Wikipedia's "Current tennis rankings" page
 * and updates rankings.json with a new monthly snapshot when the previous month is complete
 * but missing from the data.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/rankings.json');

const WIKI_PAGE = 'Current tennis rankings';
const TOP_N = 20;

async function getWikitext(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(title) +
    '&prop=revisions&rvprop=content&format=json&rvslots=main';
  const res = await fetch(url, { headers: { 'User-Agent': 'TennisCalendarApp/1.0' } });
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

function getMissingMonths(existingKeys) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // Only generate rankings for 2026 months that have fully completed
  const missing = [];
  for (let m = 0; m < currentMonth; m++) {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
    if (!existingKeys.includes(key)) {
      missing.push(key);
    }
  }
  return missing;
}

export async function fetchMissingRankings(dataPath = DATA_PATH) {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  const atpKeys = Object.keys(data.atp || {});
  const wtaKeys = Object.keys(data.wta || {});

  const missingAtp = getMissingMonths(atpKeys);
  const missingWta = getMissingMonths(wtaKeys);

  if (missingAtp.length === 0 && missingWta.length === 0) {
    console.log('Rankings are up to date.');
    return false;
  }

  // Build country lookup from previous months (for noflag players)
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

  console.log('Fetching current rankings from Wikipedia...');
  const wikitext = await getWikitext(WIKI_PAGE);
  if (!wikitext) {
    console.error('  ✗ Could not fetch Wikipedia page');
    return false;
  }

  // Parse ATP rankings
  const atpSection = parseSection(wikitext, 'ATP singles ranking');
  const atpPlayers = parseRankingsTable(atpSection, countryLookup);

  // Parse WTA rankings
  const wtaSection = parseSection(wikitext, 'WTA singles ranking');
  const wtaPlayers = parseRankingsTable(wtaSection, countryLookup);

  let updated = false;

  if (atpPlayers.length > 0 && missingAtp.length > 0) {
    if (!data.atp) data.atp = {};
    // Only fill the most recent missing month with current data
    // (Wikipedia shows current rankings, not historical)
    const latestMissing = missingAtp[missingAtp.length - 1];
    data.atp[latestMissing] = atpPlayers;
    console.log(`  ✓ ATP rankings saved for ${latestMissing} (${atpPlayers.length} players)`);
    updated = true;
  } else if (missingAtp.length > 0) {
    console.log('  ✗ Could not parse ATP rankings');
  }

  if (wtaPlayers.length > 0 && missingWta.length > 0) {
    if (!data.wta) data.wta = {};
    const latestMissing = missingWta[missingWta.length - 1];
    data.wta[latestMissing] = wtaPlayers;
    console.log(`  ✓ WTA rankings saved for ${latestMissing} (${wtaPlayers.length} players)`);
    updated = true;
  } else if (missingWta.length > 0) {
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
  }

  return updated;
}

// Allow running directly: node scripts/fetchRankings.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchMissingRankings().catch(console.error);
}
