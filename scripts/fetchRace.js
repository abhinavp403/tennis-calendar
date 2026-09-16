/**
 * Fetches the current season race standings (ATP Race to Turin / Race to the
 * WTA Finals) from the "Points breakdown" singles table on Wikipedia's
 * "<year> ATP Finals" / "<year> WTA Finals" pages, and stores the top 10 as
 * race.json in the Gist:
 *
 *   { atp: { asOf: "2026-09-14", players: [{ rank, name, country, points,
 *            tournaments, titles, qualified }] }, wta: { ... } }
 *
 * Unlike rankings.json this keeps only the latest snapshot — the race resets
 * every January, so history isn't useful. Runs daily after fetchRankings.
 *
 *   node scripts/fetchRace.js                    # fetch + push to Gist
 *   SKIP_GIST_PUSH=1 node scripts/fetchRace.js   # dry run, print only
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { fetchGistFiles, updateGistContent } from './updateGist.js';

const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; noreply@github.com)';
const TOP_N = 10;

async function getWikitext(title) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', titles: title, prop: 'revisions', rvprop: 'content',
    rvslots: 'main', format: 'json', redirects: '1',
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Wikipedia returned HTML (rate limited?)');
  const page = Object.values(JSON.parse(text).query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

function abbreviateName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length < 2 ? fullName : `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

/**
 * The singles race table is the first wikitable whose header has a "Total"
 * points column and a "Titles" column (the doubles table comes later).
 * Returns { asOf, players } or null.
 */
export function parseRace(wikitext) {
  const tables = wikitext.split(/\n\{\|/).slice(1);
  const tableIdx = tables.findIndex(t => /Total/.test(t.split('\n|-\n|')[0]) && /Titles/.test(t));
  if (tableIdx === -1) return null;
  const table = tables[tableIdx].split(/\n\|\}/)[0];

  // "''Updated {{as of|2026|9|14|lc=yes}}.''" sits just above the table.
  const before = wikitext.slice(0, wikitext.indexOf(tables[tableIdx]));
  const asOfs = [...before.matchAll(/\{\{as of\|(\d{4})\|(\d{1,2})\|(\d{1,2})/gi)];
  const last = asOfs.at(-1);
  const asOf = last
    ? `${last[1]}-${last[2].padStart(2, '0')}-${last[3].padStart(2, '0')}`
    : null;

  const players = [];
  for (const row of table.split(/\n\|-[^\n]*\n/).slice(1)) {
    const lines = row.split('\n').map(l => l.trim()).filter(Boolean);
    // Rank cell: "|2", "| 3", "| bgcolor=gold | 1<sup>†</sup>"
    const rankLine = lines[0]?.replace(/^\|\s*(?:[^|]*\|\s*)?/, '');
    const rankMatch = rankLine?.match(/^(\d+)/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // Player cell: "{{flagicon|GER}} [[Alexander Zverev]]" or
    // "{{flagicon|}} [[2026 Aryna Sabalenka tennis season|Aryna Sabalenka]]"
    const playerLine = lines[1] ?? '';
    const link = playerLine.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (!link) continue;
    const full = (link[2] || link[1]).replace(/\s*\([^)]*\)/g, '').trim();
    const country = playerLine.match(/\{\{flagicon\|([A-Z]{3})/)?.[1] ?? '';

    // Trailing header-style cells: "! 8,650" / "! 15" / "! 2" = total, tourn, titles
    const trailing = lines.filter(l => l.startsWith('!')).map(l => parseInt(l.replace(/[^\d]/g, ''), 10));
    if (trailing.length < 3 || trailing.some(Number.isNaN)) continue;
    const [points, tournaments, titles] = trailing.slice(-3);

    players.push({
      rank,
      name: abbreviateName(full),
      full,
      country,
      points,
      tournaments,
      titles,
      qualified: /†/.test(lines[0]),
    });
    if (players.length >= TOP_N) break;
  }
  return { asOf, players };
}

export async function fetchRace(year = new Date().getUTCFullYear()) {
  const files = await fetchGistFiles(['players.json', 'rankings.json']);
  // race.json won't exist until the first successful run creates it.
  const existing = await fetchGistFiles(['race.json']).then(f => f['race.json']).catch(() => ({}));
  const playersJson = files['players.json'] ?? {};
  const rankings = files['rankings.json'] ?? {};

  const out = {};
  for (const [tour, page] of [['atp', `${year} ATP Finals`], ['wta', `${year} WTA Finals`]]) {
    console.log(`Fetching ${page}...`);
    const race = parseRace(await getWikitext(page));
    // Require a full top 10: a partial parse (Wikipedia format change) must
    // not replace good data.
    if (!race || race.players.length < TOP_N) {
      console.error(`  ✗ ${tour.toUpperCase()} race parse failed (${race?.players.length ?? 0} players) — keeping previous`);
      if (existing[tour]) out[tour] = existing[tour];
      continue;
    }

    // Country fallback for blank flags (e.g. neutral athletes): players.json,
    // then any rankings snapshot.
    const rankCountry = {};
    for (const snap of Object.values(rankings[tour] ?? {})) {
      for (const p of snap) if (p.country) rankCountry[p.name] = p.country;
    }
    for (const p of race.players) {
      if (!p.country) p.country = playersJson[tour]?.[p.name] ?? rankCountry[p.name] ?? '';
    }

    out[tour] = race;
    console.log(`  ✓ ${tour.toUpperCase()} race as of ${race.asOf}:`);
    for (const p of race.players) {
      console.log(`    ${String(p.rank).padStart(2)}${p.qualified ? '†' : ' '} ${p.name.padEnd(22)} ${p.country.padEnd(4)} ${p.points}`);
    }
  }

  const content = JSON.stringify(out, null, 2) + '\n';
  if (content === JSON.stringify(existing, null, 2) + '\n') {
    console.log('race.json is up to date.');
    return false;
  }
  await updateGistContent({ 'race.json': content });
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchRace().catch(err => { console.error(err); process.exit(1); });
}
