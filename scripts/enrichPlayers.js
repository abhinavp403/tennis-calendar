/**
 * Enriches players with data derived from their own Wikipedia article, keyed off
 * the abbreviated names already stored in results ("C. Alcaraz"):
 *
 *   - full first name  → tournaments.json  winner_full / runner_up_full
 *                        (powers first-name search)
 *   - country code     → players.json      { atp: { "A. Eala": "PHI" }, ... }
 *                        (powers the flags in stats / rankings / profile)
 *
 * Resolution is per player, not per tournament, so it is unaffected by
 * tournament-name/page-title mismatches. Runs after fetchResults in the daily
 * workflow. Idempotent: only looks up players missing a name or a country.
 *
 *   node scripts/enrichPlayers.js                     # resolve + push to Gist
 *   SKIP_GIST_PUSH=1 node scripts/enrichPlayers.js    # dry run, print only
 */

import { fetchGistFiles, updateGistContent } from './updateGist.js';

const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; noreply@github.com)';
const WIKI_API_DELAY = 400; // ms between Wikipedia calls
const delay = ms => new Promise(r => setTimeout(r, ms));
const deburr = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function wikiApi(params) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Wikipedia returned HTML (rate limited?)');
  return JSON.parse(text);
}

async function wikiSearch(query) {
  const data = await wikiApi({ action: 'query', list: 'search', srsearch: query, srlimit: '8' });
  return data.query?.search ?? [];
}

async function wikiText(title) {
  const data = await wikiApi({
    action: 'query', titles: title, prop: 'revisions',
    rvprop: 'content', rvslots: 'main', redirects: '1',
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.missing !== undefined ? null : (page?.revisions?.[0]?.slots?.main?.['*'] ?? null);
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

/** Resolve "F. Last Name" to that player's Wikipedia article title, or null. */
async function resolveArticle(abbrev) {
  const m = abbrev.match(/^([A-Za-z])\.\s*(.+)$/);
  if (!m) return null;
  const initial = deburr(m[1]);
  const last = m[2];
  const lastKey = deburr(last);
  const lastTok = deburr(last.split(' ').pop());

  let fallback = null;
  for (const r of await wikiSearch(`${last} tennis player`)) {
    const words = r.title.split(' ');
    if (words.length < 2) continue;
    if (deburr(words[0])[0] !== initial) continue;
    if (deburr(words.slice(1).join(' ')) === lastKey) return r.title;  // strong match
    if (!fallback && deburr(words[words.length - 1]) === lastTok) fallback = r.title;
  }
  return fallback;
}

/** IOC code from a player article's infobox `| country = {{PHI}}`, else null. */
function countryFromArticle(wikitext) {
  // Take the rest of the field (stops at the next `|` or newline), then pull the
  // IOC code out of it — the value is usually a bare `{{PHI}}` template.
  const m = wikitext?.match(/\|\s*country\s*=\s*([^\n|]*)/i);
  const code = m?.[1]?.match(/\{\{\s*([A-Z]{3})\s*\}\}/);
  return code ? code[1] : null;
}

/**
 * Fallback source: the season tour page tags each player with
 * `{{flagicon|CAN}} [[Denis Shapovalov]]`, which covers articles whose infobox
 * uses a format we don't parse (e.g. `{{flagu|Canada}}`).
 */
async function loadTourFlags() {
  const out = { atp: {}, wta: {} };
  for (const [tour, page] of [['atp', '2026 ATP Tour'], ['wta', '2026 WTA Tour']]) {
    const w = await wikiText(page);
    if (!w) continue;
    const re = /\{\{flagicon\|([A-Z]{3})\}\}\s*\[\[([^\]]+?)\]\]/g;
    let m;
    while ((m = re.exec(w)) !== null) {
      const article = (m[2].includes('|') ? m[2].split('|')[0] : m[2]).trim();
      if (!out[tour][article]) out[tour][article] = m[1];
    }
    await delay(WIKI_API_DELAY);
  }
  return out;
}

async function main() {
  const files = await fetchGistFiles(['tournaments.json', 'players.json']);
  const data = files['tournaments.json'];
  const players = files['players.json'] ?? {};
  players.atp ??= {};
  players.wta ??= {};

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

  // Every player who has appeared in a final, per tour, and which already have
  // a full name resolved somewhere.
  const byTour = { atp: new Set(), wta: new Set() };
  const haveName = new Set();
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (!t.winner) continue;
      byTour[tour].add(t.winner);
      if (t.runner_up) byTour[tour].add(t.runner_up);
      if (t.winner_full) haveName.add(t.winner);
      if (t.runner_up_full) haveName.add(t.runner_up);
    }
  }

  // One Wikipedia lookup per player serves both name and country.
  const todo = [];
  for (const tour of ['atp', 'wta']) {
    for (const name of byTour[tour]) {
      const needName = !haveName.has(name);
      const needCountry = !players[tour][name];
      if (needName || needCountry) todo.push({ name, tour, needName, needCountry });
    }
  }
  todo.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`${todo.length} players to look up (${byTour.atp.size + byTour.wta.size} total).`);

  // Seed with full names already in the data, so a name known from one
  // tournament fills every other slot for that player (including purged ones).
  const fullByName = {};
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (t.winner_full) fullByName[t.winner] = t.winner_full;
      if (t.runner_up_full) fullByName[t.runner_up] = t.runner_up_full;
    }
  }

  let tourFlags = null;   // loaded lazily, only if an article lookup falls short
  let countriesAdded = 0;

  for (const { name, tour, needName, needCountry } of todo) {
    try {
      const article = await resolveArticle(name);
      await delay(WIKI_API_DELAY);
      if (!article) { console.log(`  ✗ ${name} → (no article found)`); continue; }

      if (needName) {
        // Never store a name that doesn't belong to this player.
        if (article !== name && fullNameMatches(name, article)) {
          fullByName[name] = article;
          console.log(`  ✓ ${name} → ${article}`);
        } else {
          console.log(`  ✗ ${name} → rejected "${article}" (doesn't match initial/surname)`);
        }
      }

      if (needCountry) {
        let code = countryFromArticle(await wikiText(article));
        await delay(WIKI_API_DELAY);
        if (!code) {
          tourFlags ??= await loadTourFlags();
          code = tourFlags[tour][article] ?? null;
        }
        if (code) {
          players[tour][name] = code;
          countriesAdded++;
          console.log(`  🏳 ${name} → ${code}`);
        } else {
          console.log(`  ✗ ${name} → (no country found)`);
        }
      }
    } catch (err) {
      console.error(`  ! ${name}: ${err.message}`);
    }
  }

  // Apply resolved names to every tournament the player appears in.
  let applied = 0;
  for (const tour of ['atp', 'wta']) {
    for (const t of data[tour]) {
      if (!t.winner) continue;
      if (!t.winner_full && fullByName[t.winner]) { t.winner_full = fullByName[t.winner]; applied++; }
      if (t.runner_up && !t.runner_up_full && fullByName[t.runner_up]) { t.runner_up_full = fullByName[t.runner_up]; applied++; }
    }
  }

  // Keep players.json stable (sorted) so diffs stay readable.
  for (const tour of ['atp', 'wta']) {
    players[tour] = Object.fromEntries(Object.entries(players[tour]).sort(([a], [b]) => a.localeCompare(b)));
  }

  console.log(`\nPurged ${purged} bad full names; names applied to ${applied} slots; ${countriesAdded} countries added.`);
  const push = {};
  if (applied > 0 || purged > 0) push['tournaments.json'] = JSON.stringify(data, null, 2) + '\n';
  if (countriesAdded > 0) push['players.json'] = JSON.stringify(players, null, 2) + '\n';
  if (Object.keys(push).length > 0) await updateGistContent(push);
  else console.log('Nothing to update.');
}

main().catch(err => { console.error(err); process.exit(1); });
