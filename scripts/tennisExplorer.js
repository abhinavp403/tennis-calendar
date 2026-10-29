/**
 * Rankings source: TennisExplorer (https://www.tennisexplorer.com/ranking/...).
 *
 * Replaces Wikipedia as the primary source. Wikipedia's two ranking sections are
 * hand-edited and drift apart — on 14 Oct 2026 ATP sat a week behind WTA, and on
 * 19 Oct a stray blank line dropped the world No. 1 — whereas TennisExplorer
 * publishes both tours on the same schedule, each page carrying the exact Monday
 * it reflects plus a dropdown of earlier dates (so history is reachable, which
 * Wikipedia never allowed).
 *
 * Its robots.txt disallows only /redirect/, /terms-of-use/ and /contact/.
 *
 * What the source does NOT give us, and how that's handled here:
 *   - Names are "Surname Firstname" with accents stripped ("Swiatek Iga"), and
 *     compound surnames are unmarked ("Auger Aliassime Felix"). Both are fixed
 *     by matching against the canonical names already in our data — see
 *     resolveName() — so what's stored stays "I. Świątek", "F. Auger-Aliassime".
 *   - Countries are full English names, with an ISO alpha-2 flag class; we store
 *     IOC codes, so the class is mapped back through flags.js.
 */

import { IOC_TO_ISO2 } from '../src/utils/flags.js';

const TOUR_PATH = { atp: 'atp-men', wta: 'wta-women' };

// Overridable so the Wikipedia fallback can be exercised without waiting for
// the real site to break: TE_BASE=https://invalid.test node scripts/fetchRankings.js
const BASE = process.env.TE_BASE ?? 'https://www.tennisexplorer.com';

// A plain scraper UA is refused by the site's edge; this is a real browser's.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ISO2_TO_IOC = Object.fromEntries(
  Object.entries(IOC_TO_ISO2).map(([ioc, iso2]) => [iso2.toLowerCase(), ioc]),
);

export const deburr = s =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Surname key used to match a scraped name to one we already hold. */
const surnameKey = s => deburr(s).replace(/[^a-z]/g, '');

/**
 * Index of the canonical names already in our data: surname → the stored
 * spellings, with their first initial. Built from players.json (resolved from
 * each player's own Wikipedia article, so properly accented) and every stored
 * snapshot.
 */
export function buildNameIndex(rankingsData = {}, playersJson = {}) {
  const index = new Map();
  const add = name => {
    const m = (name ?? '').match(/^([A-Za-zÀ-ž])\.\s*(.+)$/);
    if (!m) return;
    const key = surnameKey(m[2]);
    if (!index.has(key)) index.set(key, []);
    const entry = { name, initial: deburr(m[1]) };
    if (!index.get(key).some(e => e.name === entry.name)) index.get(key).push(entry);
  };
  for (const tour of ['atp', 'wta']) {
    for (const name of Object.keys(playersJson?.[tour] ?? {})) add(name);
    for (const snapshot of Object.values(rankingsData?.[tour] ?? {})) {
      for (const player of snapshot ?? []) add(player.name);
    }
  }
  return index;
}

/**
 * "Auger Aliassime Felix" → "F. Auger-Aliassime".
 *
 * The display name alone can't say where the surname ends, so try every split
 * and accept the one we already know. Failing that, fall back to the player's
 * URL slug ("auger-aliassime", minus TennisExplorer's 5-hex disambiguator),
 * and finally to treating the first word as the surname.
 */
export function resolveName(display, slug, index) {
  const tokens = display.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return display.trim();

  // Known player: use our spelling, which keeps the accents this source drops.
  for (let k = 1; k < tokens.length; k++) {
    const candidates = index.get(surnameKey(tokens.slice(0, k).join(''))) ?? [];
    const initial = deburr(tokens[k][0]);
    const hit = candidates.find(c => c.initial === initial);
    if (hit) return hit.name;
  }

  // Unknown player: the slug marks the surname, e.g. "auger-aliassime-1a2b3".
  const slugWords = (slug ?? '').split('-').filter(Boolean);
  if (slugWords.length > 1 && /^(?=.*\d)[0-9a-f]{5}$/.test(slugWords.at(-1))) slugWords.pop();
  const surnameWords = Math.min(Math.max(slugWords.length, 1), tokens.length - 1);

  const surname = tokens.slice(0, surnameWords).join(' ');
  const firstName = tokens[surnameWords];
  return `${firstName[0]}. ${surname}`;
}

/**
 * One tour's table. `date` (YYYY-MM-DD) picks a historical Monday; omit it for
 * the current one. Returns { asOf, players } — players already carry our own
 * name spelling and IOC country codes.
 */
export async function fetchRankingTable(tour, { date, topN = 20, nameIndex = new Map(), countryByName = {} } = {}) {
  const url = `${BASE}/ranking/${TOUR_PATH[tour]}/` + (date ? `?date=${date}` : '');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TennisExplorer returned HTTP ${res.status}`);
  const html = await res.text();

  // The selected option of the date dropdown is the Monday this table reflects.
  const asOf = html.match(/<option value="(\d{4}-\d{2}-\d{2})"\s+selected/i)?.[1] ?? null;
  if (!asOf) throw new Error('could not read the ranking date from the page');

  const players = [];
  for (const row of html.match(/<tr class="(?:one|two)"[^>]*onmouse[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const rank = Number(row.match(/<td class="rank first">\s*(\d+)\./)?.[1]);
    const points = Number(row.match(/<td class="long-point">\s*([\d\s,]+?)\s*<\/td>/)?.[1]?.replace(/[\s,]/g, ''));
    const nameCell = row.match(/<td class="t-name"><a href="\/player\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/);
    if (!rank || !Number.isFinite(points) || !nameCell) continue;

    const name = resolveName(decodeHtml(nameCell[2]), nameCell[1], nameIndex);
    const iso2 = row.match(/<span class="fl fl-([a-z]{2})"/i)?.[1]?.toLowerCase();
    // Our own data wins: it uses whichever code spelling the rest of the app
    // already stores for this player.
    const country = countryByName[name] ?? (iso2 ? ISO2_TO_IOC[iso2] ?? '' : '');

    const move = row.match(/<td class="prevrank">\s*<div class="(oup|odown)">(\d+)<\/div>/);
    const movement = move ? `${move[1] === 'oup' ? '△' : '▼'}${move[2]}` : '—';

    players.push({ rank, name, country, points, movement });
    if (players.length >= topN) break;
  }

  return { asOf, players };
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** Every ranking date the page offers, newest first — the history Wikipedia lacks. */
export async function fetchAvailableDates(tour) {
  const res = await fetch(`${BASE}/ranking/${TOUR_PATH[tour]}/`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TennisExplorer returned HTTP ${res.status}`);
  const html = await res.text();
  const dates = [...html.matchAll(/<option value="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);
  return [...new Set(dates)];
}
