/**
 * Fetches current ATP and WTA rankings and stores a snapshot keyed by the Monday
 * they reflect. Snapshots are captured at most once per ~2 weeks (bi-weekly);
 * legacy monthly keys ("YYYY-MM") remain and are read alongside date keys.
 *
 * TennisExplorer is the primary source (see tennisExplorer.js): it publishes
 * both tours on the same schedule and states the date each table reflects.
 * Wikipedia's "Current tennis rankings" is the fallback — it is hand-edited, so
 * the two tours drift apart and the markup occasionally breaks — and is used per
 * tour, only when TennisExplorer fails or returns an unusable table.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { updateGistContent, fetchGistFiles } from './updateGist.js';
import { fetchRankingTable, buildNameIndex } from './tennisExplorer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/rankings.json');
const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; noreply@github.com) node-fetch';

const WIKI_PAGE = 'Current tennis rankings';
const TOP_N = 20;
// Minimum days between stored snapshots. The tour updates weekly (Mondays), so
// 13 lets an every-other-Monday cadence through while blocking same-week re-runs.
// Overridable for a one-off capture when a tour's section lags behind the
// other and its table would otherwise be skipped:
//   BIWEEKLY_MIN_DAYS=7 node scripts/fetchRankings.js
const BIWEEKLY_MIN_DAYS = Number(process.env.BIWEEKLY_MIN_DAYS ?? 13);

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

    // The player cell follows the rank cell: |{{flagathlete|[[Name]]|COUNTRY}} || points || move
    // or: |{{noflag}}[[Name]]|| points || move
    //
    // Not always on the very next line — the ATP table carried a blank line
    // between its rank-1 cell and Sinner's row (19 Oct 2026), which silently
    // dropped the world No. 1. Skip blanks, but only a couple, so a malformed
    // row can't pair a rank with some later player's line.
    let nextLine = '';
    for (let j = i + 1; j < rows.length && j <= i + 3; j++) {
      const candidate = rows[j].trim();
      if (candidate) { nextLine = candidate; break; }
    }

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

// Parse the "As of" date, e.g. {{As of|2026|6|29|df=UK|lc=y}} → "2026-06-29".
// Prefer the marker inside the ATP singles section — a global first-match could
// hit an unrelated {{As of}} in the page lede. Reject implausible dates: a
// future-dated key would make every later gap check negative and permanently
// block new snapshots.
function parseAsOfDate(wikitext, sectionMarker) {
  // Read the marker from the given tour's own section. The two tours are edited
  // independently and routinely disagree — on 2026-10-14 the ATP singles table
  // was "as of 5 October" while WTA singles was already at 12 October — so one
  // shared date would gate both tours on the laggard AND file the fresher
  // tour's table under the wrong Monday. Only fall back to a page-wide match
  // when the section itself carries no marker.
  const scope = parseSection(wikitext, sectionMarker) || wikitext;
  const m = scope.match(/\{\{As of\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i)
    || wikitext.match(/\{\{As of\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
  if (!m) return null;
  const [, y, mo, d] = m;
  const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const ageDays = (Date.now() - keyToDate(key)) / 86_400_000;
  if (ageDays < -1 || ageDays > 45) {
    console.error(`  ✗ Implausible "As of" date ${key} (${Math.round(ageDays)} days old) — skipping`);
    return null;
  }
  return key;
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
  // Local cache when present (Electron app), else the live Gist (CLI / launchd).
  const localAvailable = dataPath && existsSync(dataPath);
  const data = localAvailable
    ? JSON.parse(readFileSync(dataPath, 'utf-8'))
    : (await fetchGistFiles(['rankings.json']))['rankings.json'];

  // Country lookup, also used to keep a player's code spelling stable.
  //
  // players.json first: enrichPlayers resolves each player from their own
  // Wikipedia article, so it covers neutral athletes a rankings table shows
  // without a flag — A. Kalinskaya is RUS there but flagless in every ranking
  // snapshot, so she had no country at all. Stored snapshots then fill in
  // anyone players.json doesn't know (it only tracks finalists).
  let playersJson = {};
  try {
    playersJson = (await fetchGistFiles(['players.json']))['players.json'] ?? {};
  } catch (err) {
    // Supplementary only — a failed read must not stop the snapshot.
    console.log(`  – players.json unavailable for name/country lookup (${err.message})`);
  }
  const countryLookup = {};
  for (const tour of ['atp', 'wta']) {
    for (const [name, code] of Object.entries(playersJson?.[tour] ?? {})) {
      if (code) countryLookup[name] = code;
    }
  }
  for (const tour of ['atp', 'wta']) {
    for (const key of Object.keys(data[tour] || {})) {
      for (const player of data[tour][key]) {
        if (player.country) {
          countryLookup[player.name] ??= player.country;
        }
      }
    }
  }

  // Canonical spellings, so a source that strips accents or runs a compound
  // surname together still stores "I. Świątek" / "F. Auger-Aliassime".
  const nameIndex = buildNameIndex(data, playersJson);

  // Require a mostly-complete table before storing: a partial parse (e.g. after
  // a layout change) would persist a junk snapshot AND its key would gate out
  // the corrected re-fetch for ~2 weeks.
  const MIN_PLAYERS = 10;

  // A count alone isn't enough — the 19 Oct 2026 ATP parse returned 19 players
  // and passed, but they started at rank 2 because the No. 1 row was skipped.
  // Ranks must start at 1 and then either advance by position or repeat the
  // previous rank, which is a genuine tie only when the points match too.
  // (A repeat with different points is how a dropped row shows up: the WTA's
  // 14 Sep 2026 snapshot has E. Mertens and J. Paolini both at 19 on 2,165 and
  // 2,123 points, with no 20.)
  const tableProblem = players => {
    if (players.length < MIN_PLAYERS) return `only ${players.length} players, need ${MIN_PLAYERS}`;
    if (players[0].rank !== 1) return `starts at rank ${players[0].rank}, not 1`;
    for (let i = 1; i < players.length; i++) {
      const p = players[i], prev = players[i - 1];
      if (p.rank === i + 1) continue;
      if (p.rank === prev.rank && p.points === prev.points) continue; // tie
      return p.rank === prev.rank
        ? `rank ${p.rank} repeats on different points (${prev.points} vs ${p.points})`
        : `rank sequence breaks at ${p.rank} (position ${i + 1})`;
    }
    return null;
  };

  // Wikipedia is only fetched if a tour needs the fallback, and only once.
  let wikitext = null;
  const wikipediaFallback = async tour => {
    const marker = tour === 'atp' ? 'ATP singles ranking' : 'WTA singles ranking';
    wikitext ??= await getWikitext(WIKI_PAGE);
    if (!wikitext) return null;
    const asOf = parseAsOfDate(wikitext, marker);
    if (!asOf) return null;
    return { asOf, players: parseRankingsTable(parseSection(wikitext, marker), countryLookup) };
  };

  let updated = false;

  for (const tour of ['atp', 'wta']) {
    const label = tour.toUpperCase();
    let snapshot = null;
    let source = 'TennisExplorer';

    try {
      snapshot = await fetchRankingTable(tour, { topN: TOP_N, nameIndex, countryByName: countryLookup });
      const problem = tableProblem(snapshot.players);
      if (problem) {
        console.log(`  – ${label} table from TennisExplorer unusable (${problem}) — trying Wikipedia`);
        snapshot = null;
      }
    } catch (err) {
      console.log(`  – ${label} TennisExplorer fetch failed (${err.message}) — trying Wikipedia`);
    }

    if (!snapshot) {
      source = 'Wikipedia';
      snapshot = await wikipediaFallback(tour);
      if (!snapshot) {
        console.error(`  ✗ ${label}: no usable rankings from either source — skipping`);
        continue;
      }
    }

    const { asOf, players } = snapshot;
    console.log(`  ${label} as of ${asOf} (${source}, ${players.length} players)`);

    if (!shouldStore(Object.keys(data[tour] || {}), asOf)) continue;

    const problem = tableProblem(players);
    if (problem) {
      console.log(`  ✗ ${label} parse incomplete (${problem}) — not storing`);
      continue;
    }

    data[tour] ??= {};
    data[tour][asOf] = players;
    console.log(`  ✓ ${label} rankings saved for ${asOf} (${players.length} players)`);
    updated = true;
  }

  if (!updated) {
    console.log(`Rankings are up to date (each tour's latest is within ${BIWEEKLY_MIN_DAYS} days of its ranking date).`);
  }

  if (updated) {
    // Sort keys chronologically
    const sortedAtp = {};
    Object.keys(data.atp).sort().forEach(k => { sortedAtp[k] = data.atp[k]; });
    data.atp = sortedAtp;

    const sortedWta = {};
    Object.keys(data.wta).sort().forEach(k => { sortedWta[k] = data.wta[k]; });
    data.wta = sortedWta;

    const content = JSON.stringify(data, null, 2) + '\n';
    if (localAvailable) writeFileSync(dataPath, content); // refresh the app's cache
    console.log('rankings.json updated.');
    await updateGistContent({ 'rankings.json': content });
  }

  return updated;
}

// Allow running directly: node scripts/fetchRankings.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchMissingRankings().catch(console.error);
}
