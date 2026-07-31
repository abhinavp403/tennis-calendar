/**
 * Enriches tournament results with players' full first names, resolved directly
 * from each player's own Wikipedia article — independent of tournament pages.
 *
 * The data stores abbreviated names ("C. Alcaraz"); we already have the last name
 * and first initial, so we look the player up (search "<lastname> tennis player")
 * and take the article title whose surname + initial match ("Carlos Alcaraz").
 * The result is stored as `winner_full` / `runner_up_full` on each tournament,
 * which powers the app's first-name player search (see src/utils/playerStats.js).
 *
 * Runs as part of the weekly job (after fetchResults). Idempotent: only resolves
 * players who don't already have a full name.
 *
 *   node scripts/enrichPlayerNames.js                     # resolve + push to Gist
 *   SKIP_GIST_PUSH=1 node scripts/enrichPlayerNames.js    # dry run, print only
 */

import { fetchGistFiles, updateGistContent } from './updateGist.js';

const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; noreply@github.com)';
const WIKI_API_DELAY = 400; // ms between Wikipedia calls
const delay = ms => new Promise(r => setTimeout(r, ms));
const deburr = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function wikiSearch(query) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    format: 'json', action: 'query', list: 'search', srsearch: query, srlimit: '8',
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Wikipedia returned HTML (rate limited?)');
  return JSON.parse(text).query?.search ?? [];
}

/**
 * Does `full` ("Daniel Mérida") actually belong to `abbrev` ("D. Mérida")?
 * Requires the first initial and the surname to line up. This is the guard that
 * keeps a wrong-page scrape (e.g. a Challenger event's finalists) from ever
 * being stored against the wrong player.
 */
export function fullNameMatches(abbrev, full) {
  const m = (abbrev ?? '').match(/^([A-Za-z])\.\s*(.+)$/);
  if (!m || !full) return false;
  const words = full.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (deburr(words[0])[0] !== deburr(m[1])) return false;
  const last = deburr(m[2]);
  const rest = deburr(words.slice(1).join(' '));
  const lastTok = deburr(m[2].split(' ').pop());
  // Full surname match, or last-token match (handles middle names, e.g.
  // "T. Etcheverry" vs "Tomás Martín Etcheverry").
  return rest === last || deburr(words[words.length - 1]) === lastTok;
}

/**
 * Resolve an abbreviated "F. Last Name" to a full "First Last Name" via the
 * player's Wikipedia article, or null if no confident match is found.
 */
async function resolveFullName(abbrev) {
  const m = abbrev.match(/^([A-Za-z])\.\s*(.+)$/);
  if (!m) return null;
  const initial = deburr(m[1]);
  const last = m[2];
  const lastKey = deburr(last);
  const lastTok = deburr(last.split(' ').pop());

  const results = await wikiSearch(`${last} tennis player`);
  // Prefer a full-surname match; fall back to last-token (handles middle names,
  // e.g. our "T. Etcheverry" vs Wikipedia "Tomás Martín Etcheverry").
  let fallback = null;
  for (const r of results) {
    const words = r.title.split(' ');
    if (words.length < 2) continue;
    if (deburr(words[0])[0] !== initial) continue;
    const rest = deburr(words.slice(1).join(' '));
    if (rest === lastKey) return r.title;              // strong match
    if (!fallback && deburr(words[words.length - 1]) === lastTok) fallback = r.title;
  }
  return fallback;
}

async function main() {
  const { 'tournaments.json': data } = await fetchGistFiles(['tournaments.json']);
  const today = new Date().toISOString().slice(0, 10);

  // Drop any stored full name that doesn't belong to its abbreviated name, so a
  // bad value gets re-resolved rather than trusted forever.
  let purged = 0;
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (t.winner_full && !fullNameMatches(t.winner, t.winner_full)) {
        console.log(`  ⚠ Dropping bad full name: ${t.name} winner ${t.winner} → "${t.winner_full}"`);
        delete t.winner_full; purged++;
      }
      if (t.runner_up_full && !fullNameMatches(t.runner_up, t.runner_up_full)) {
        console.log(`  ⚠ Dropping bad full name: ${t.name} runner-up ${t.runner_up} → "${t.runner_up_full}"`);
        delete t.runner_up_full; purged++;
      }
    }
  }

  // Which abbreviated names still lack a resolved full name anywhere?
  const known = new Set();   // names already resolved (have a *_full somewhere)
  const needed = new Set();
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (!t.winner || t.end >= today) continue;
      if (t.winner_full) known.add(t.winner);
      if (t.runner_up_full) known.add(t.runner_up);
      needed.add(t.winner);
      if (t.runner_up) needed.add(t.runner_up);
    }
  }
  const toResolve = [...needed].filter(n => !known.has(n)).sort();
  console.log(`${toResolve.length} players to resolve (of ${needed.size} total).`);

  // Seed with the valid full names already in the data, so a name known from one
  // tournament fills every other slot for that player (including purged ones).
  const fullByName = {};
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (t.winner_full) fullByName[t.winner] = t.winner_full;
      if (t.runner_up_full) fullByName[t.runner_up] = t.runner_up_full;
    }
  }
  for (const name of toResolve) {
    try {
      const full = await resolveFullName(name);
      // Never store a name that doesn't belong to this player.
      if (full && full !== name && fullNameMatches(name, full)) {
        fullByName[name] = full;
        console.log(`  ✓ ${name} → ${full}`);
      } else if (full && full !== name) {
        console.log(`  ✗ ${name} → rejected "${full}" (doesn't match initial/surname)`);
      } else {
        console.log(`  ✗ ${name} → (unresolved)`);
      }
    } catch (err) {
      console.error(`  ! ${name}: ${err.message}`);
    }
    await delay(WIKI_API_DELAY);
  }

  // Apply to every tournament the resolved players appear in.
  let applied = 0;
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (!t.winner || t.end >= today) continue;
      if (!t.winner_full && fullByName[t.winner]) { t.winner_full = fullByName[t.winner]; applied++; }
      if (t.runner_up && !t.runner_up_full && fullByName[t.runner_up]) { t.runner_up_full = fullByName[t.runner_up]; applied++; }
    }
  }

  console.log(`\nPurged ${purged} bad full names; resolved ${Object.keys(fullByName).length}, applied to ${applied} tournament slots.`);
  if (applied > 0 || purged > 0) {
    await updateGistContent({ 'tournaments.json': JSON.stringify(data, null, 2) + '\n' });
  } else {
    console.log('Nothing to update.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
