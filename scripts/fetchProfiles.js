/**
 * Basic player details for the profile dialog — date of birth, height,
 * playing hand and backhand, and the year they turned pro — stored as
 * profiles.json in the Gist:
 *
 *   { atp: { "J. Sinner": { full, wikidata, dob, heightCm, plays, backhand,
 *                           turnedPro, checkedAt } },
 *     wta: { ... } }
 *
 * Two sources, each used for what it does best:
 *   - The player's English Wikipedia infobox for height, plays/backhand and
 *     turned pro. Far better coverage than Wikidata (130 players: plays 129 vs
 *     47, turned pro 115 vs 62), and its heights cite the ATP/WTA sites —
 *     Sinner is 1.91 m there, 192.5 cm on Wikidata.
 *   - Wikidata (CC0) for date of birth, which it has for every player, and as
 *     a fallback for any field the infobox lacks.
 * Only individual facts are taken (a height, a year) — no Wikipedia text is
 * copied — and photos are deliberately not used.
 *
 * Age is not stored: it's derived from `dob` at display time.
 *
 * Also from the infobox: career-high ranking (with date), career titles
 * (main tour only — ITF / WTA 125 / Challenger excluded), birthplace, and the
 * current coach (open-ended stints, else the undated names listed first).
 *
 * Who gets a profile: every player the app can show — finalists, anyone in any
 * stored rankings snapshot, and the race top 10. A new player is searched for
 * once; after that, every stored profile is re-read weekly by its Wikidata id
 * in batches of 50 (~6 requests for 130 players, no per-player search), since
 * career titles, career high and coach change through the season. Facts that
 * a refresh fails to read are kept from the previous version (see STICKY).
 *
 *   node scripts/fetchProfiles.js                       # look up + push to Gist
 *   SKIP_GIST_PUSH=1 node scripts/fetchProfiles.js      # dry run
 *   REBUILD_PROFILES=1 node scripts/fetchProfiles.js    # re-read every stored profile
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { fetchGistFiles, updateGistContent } from './updateGist.js';
import { fullNameMatches } from './enrichPlayers.js';

const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar)';
const DELAY_MS = 300;
// Six, not seven: the workflow runs on the Monday rankings update, and a
// six-hour schedule means consecutive Mondays can be slightly under 7 days apart.
const RECHECK_AFTER_DAYS = 6;
const BATCH = 50; // both the Wikidata and Wikipedia APIs take up to 50 ids/titles

// Wikidata items, verified against Sinner (right), Nadal (left) and others.
const TENNIS_PLAYER = 'Q10833314';
const HAND = { Q3039938: 'right', Q789447: 'left' };
const CENTIMETRE = 'Q174728';
const METRE = 'Q11573';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error(`HTML response (rate limited?) from ${new URL(url).host}`);
  return JSON.parse(text);
}

const wiki = params =>
  getJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params }));

// ─── Infobox parsing (pure, exported for testing) ───────────────────────────

/** One infobox field's value, with citations and comments removed. */
export function infoboxField(wikitext, key) {
  // [ \t], not \s: \s also matches the newline, so an empty field ("| turnedpro =")
  // would capture the NEXT line instead — Mérida's turnedpro read his plays line.
  const line = wikitext?.match(new RegExp(`^[ \\t]*\\|[ \\t]*${key}[ \\t]*=[ \\t]*(.*)$`, 'im'))?.[1];
  if (!line) return null;
  const clean = line
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return clean || null;
}

const inRange = cm => (cm > 140 && cm < 230 ? Math.round(cm) : null);

/**
 * Height in cm from the forms the infobox uses:
 *   1.76 m · 176 cm · {{convert|1.91|m|abbr=on}} · {{convert|191|cm}}
 *   {{convert|6|ft|4|in|m|2|abbr=on}} · {{height|m=1.91}} · {{height|ft=6|in=4}}
 */
export function parseHeightCm(value) {
  if (!value) return null;
  const v = value.replace(/&nbsp;/g, ' ');

  const conv = v.match(/\{\{\s*convert\s*\|([^}]*)\}\}/i);
  if (conv) {
    const a = conv[1].split('|').map(s => s.trim());
    if (a[1] === 'm') return inRange(Number(a[0]) * 100);
    if (a[1] === 'cm') return inRange(Number(a[0]));
    if (a[1] === 'ft') {
      const inches = a[3] === 'in' ? Number(a[2]) : 0;
      return inRange((Number(a[0]) * 12 + inches) * 2.54);
    }
  }

  const tpl = v.match(/\{\{\s*height\s*\|([^}]*)\}\}/i);
  if (tpl) {
    const p = Object.fromEntries(tpl[1].split('|').map(s => s.split('=').map(x => x.trim())));
    if (p.m) return inRange(Number(p.m) * 100);
    if (p.cm) return inRange(Number(p.cm));
    if (p.ft) return inRange((Number(p.ft) * 12 + Number(p.in || 0)) * 2.54);
  }

  let m = v.match(/(\d\.\d{1,2})\s*m\b/);
  if (m) return inRange(Number(m[1]) * 100);
  m = v.match(/(\d{3})\s*cm\b/);
  if (m) return inRange(Number(m[1]));
  m = v.match(/(\d)\s*ft\s*(\d{1,2})?\s*(?:in)?/);
  if (m) return inRange((Number(m[1]) * 12 + Number(m[2] || 0)) * 2.54);
  return null;
}

/** "Right-handed (two-handed backhand)" → { plays: 'right', backhand: 'two-handed' } */
export function parsePlays(value) {
  if (!value) return {};
  const v = value.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').toLowerCase();
  const out = {};
  // "Right-handed (…)" and plain "Right (…)" both occur — 7 of the first 130
  // players use the short form. Read the hand from before the parenthetical,
  // so the backhand note can't be mistaken for it.
  const lead = v.split('(')[0];
  const hand = lead.match(/\b(left|right)\b/) ?? v.match(/\b(left|right)[- ]?hand/);
  if (hand) out.plays = hand[1];
  // Hyphens vary: "two-handed backhand", "two handed-backhand" (Fritz, Halys).
  const bh = v.match(/\b(one|two|single|double)[- ]?hand(?:ed)?[- ]+backhand/);
  if (bh) out.backhand = /one|single/.test(bh[1]) ? 'one-handed' : 'two-handed';
  return out;
}

/** Wiki markup → plain text: [[A|B]] → B, [[A]] → A, '''bold''' → bold, templates dropped. */
function plain(s) {
  return (s ?? '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/**
 * "No. '''1''' (10 June 2024)" → { rank: 1, date: '2024-06-10' }.
 * Also "No. 4 (June 9, 2025)", "No. 5ª (…)", and the rank wrapped in a link to
 * the list of world No. 1s.
 */
export function parseCareerHigh(value) {
  const v = plain(value);
  const rank = Number(v.match(/No\.\s*(\d+)/i)?.[1]);
  if (!rank) return null;
  const out = { rank };
  const dmy = v.match(/\((\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\)/);
  const mdy = v.match(/\(([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\)/);
  const [d, mon, y] = dmy ? [dmy[1], dmy[2], dmy[3]] : mdy ? [mdy[2], mdy[1], mdy[3]] : [];
  const m = MONTHS.indexOf((mon ?? '').toLowerCase());
  if (m >= 0) out.date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return out;
}

/**
 * Main-tour singles titles. The field mixes tiers — "2 WTA, 5 ITF",
 * "2 WTA 125", "12 ITF" — and only ATP/WTA tour titles count here, so a value
 * listing only ITF / WTA 125 / Challenger titles means 0.
 */
export function parseCareerTitles(value) {
  const v = plain(value).replace(/\([^)]*\)/g, ''); // drop "(3rd in the Open Era)"
  if (!v) return null;
  let tour = null;
  for (const seg of v.split(/[,;]/)) {
    const n = Number(seg.match(/\d+/)?.[0]);
    if (!Number.isFinite(n)) continue;
    if (/ITF|125|challenger/i.test(seg)) { tour ??= 0; continue; }
    tour = (tour ?? 0) + n;
  }
  return tour;
}

/** "[[Sydney|Sydney, New South Wales]], Australia" → "Sydney, New South Wales, Australia" */
export function parseBirthplace(value) {
  const v = plain(value);
  return v || null;
}

/**
 * Current coach(es) from a field that lists past and present together:
 *   "Ivan Cinkuš (Jan 2025–)<br />Goran Ivanišević (Feb 2026–present)"  → both
 *   "Simone Vagnozzi <br/>Darren Cahill (2022–2026)"                   → Vagnozzi
 * Open-ended dates mark a current coach; if none are dated that way, the
 * undated names listed before the first former coach are taken. At most two.
 */
export function parseCoach(raw) {
  if (!raw) return null;
  const text = raw
    .replace(/\{\{\s*(?:plainlist|ubl|unbulleted list|flatlist)\s*\|/gi, '')
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<!--[\s\S]*?-->/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\}\}/g, '');
  // Split on line breaks, bullets and pipes, and on commas outside parentheses.
  const entries = [];
  for (const chunk of text.split(/<br\s*\/?>|\n|\*|\|/i)) {
    let depth = 0, cur = '';
    for (const ch of chunk) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { entries.push(cur); cur = ''; } else cur += ch;
    }
    entries.push(cur);
  }
  const parsed = entries
    .map(e => e.replace(/\s+/g, ' ').trim())
    .filter(e => e && /[A-Za-zÀ-ž]/.test(e))
    .map(e => {
      // Only a parenthetical with a year or "since/present" is a period —
      // "Luciano Enrique (Gino) Darderi" carries a nickname, not a date.
      const paren = e.match(/\(([^)]*)\)/)?.[1] ?? null;
      const period = paren && /\d|since|present/i.test(paren) ? paren.trim() : null;
      const name = e.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      // "(Jan 2025–)", "(Dec 2024—)", "(2026- )", "(Feb 2026–present)", "(since 2025)"
      const open = period != null && (/since/i.test(period) || /[–—-]\s*(present)?\s*$/i.test(period));
      // "(June 2026)": a lone date with no range — the start of a stint.
      const lone = period != null && !open && !/[–—-]/.test(period);
      const year = Number(period?.match(/\d{4}/)?.[0]);
      return { name, dated: period != null, open, lone, year };
    })
    .filter(e => e.name && e.name !== '-');

  // Current = the undated names listed before the first dated one (the
  // long-standing coach: "Simone Vagnozzi, Darren Cahill (2022–2026)") plus any
  // open-ended stint (a recent addition: "Magnus Norman (2026–present)").
  // Both together — 8 of 130 players list exactly that mix.
  const leading = [];
  for (const e of parsed) { if (e.dated) break; leading.push(e); }
  let current = parsed.filter(e => leading.includes(e) || e.open);
  // Otherwise a first entry that's a single recent date: "Nicolás Massú (June 2026)".
  const thisYear = new Date().getUTCFullYear();
  if (current.length === 0 && parsed[0]?.lone && parsed[0].year >= thisYear - 1) current = [parsed[0]];
  // Otherwise undated names anywhere — some lists put the former coach first.
  if (current.length === 0) current = parsed.filter(e => !e.dated);
  // If every entry is a finished stint, there's no current coach to show.
  const names = [...new Set(current.map(e => e.name))].slice(0, 2);
  return names.length ? names.join(' & ') : null;
}

/** The whole coach field, which can span lines ({{plainlist|…}}). */
export function coachField(wikitext) {
  // [ \t] around "=" so an empty coach field can't swallow the next field's value.
  const m = wikitext?.match(/^[ \t]*\|[ \t]*coach[ \t]*=[ \t]*([\s\S]*?)(?=^[ \t]*\|[ \t]*\w+[ \t]*=|^[ \t]*\}\})/im);
  return m?.[1]?.trim() || null;
}

/** First plausible year in the turnedpro field. */
export function parseTurnedPro(value) {
  const year = Number(value?.match(/\b(19[5-9]\d|20\d\d)\b/)?.[1]);
  return year && year <= new Date().getUTCFullYear() ? year : null;
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

/** Wikipedia article title → its Wikidata id, following redirects. */
async function wikidataIdFor(title) {
  const data = await wiki({ action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', titles: title });
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.missing !== undefined ? null : page?.pageprops?.wikibase_item ?? null;
}

/**
 * The Wikidata id for "J. Sinner", for a player we have no id for yet. Tries
 * the full name when we know it ("(tennis)" first — "Tommy Paul" is a
 * disambiguation page), then a surname search, matched the same way
 * enrichPlayers matches, so the two never disagree about who a player is.
 */
async function findWikidataId(abbrev, fullName) {
  if (fullName && fullNameMatches(abbrev, fullName)) {
    for (const title of [`${fullName} (tennis)`, fullName]) {
      const id = await wikidataIdFor(title);
      await delay(DELAY_MS);
      if (id) return id;
    }
  }
  const surname = abbrev.replace(/^[A-Za-z]\.\s*/, '');
  const data = await wiki({ action: 'query', list: 'search', srsearch: `${surname} tennis player`, srlimit: '8' });
  await delay(DELAY_MS);
  for (const result of data.query?.search ?? []) {
    if (!fullNameMatches(abbrev, result.title.replace(/\s*\([^)]*\)$/, ''))) continue;
    const id = await wikidataIdFor(result.title);
    await delay(DELAY_MS);
    if (id) return id;
  }
  return null;
}

const firstValue = (claims, prop) => claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;

/** Wikidata entities (claims + enwiki title) for up to 50 ids per request. */
async function fetchEntities(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += BATCH) {
    const data = await getJson('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
      action: 'wbgetentities', props: 'claims|sitelinks|labels', sitefilter: 'enwiki',
      languages: 'en', format: 'json', ids: ids.slice(i, i + BATCH).join('|'),
    }));
    Object.assign(out, data.entities ?? {});
    await delay(DELAY_MS);
  }
  return out;
}

/** Article wikitext for up to 50 titles per request, keyed by title. */
async function fetchArticles(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += BATCH) {
    const data = await wiki({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      formatversion: '2', redirects: '1', titles: titles.slice(i, i + BATCH).join('|'),
    });
    // Map redirect sources back, so callers can look up by the title they asked for.
    const redirected = Object.fromEntries((data.query?.redirects ?? []).map(r => [r.to, r.from]));
    for (const page of data.query?.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content ?? '';
      out[page.title] = text;
      if (redirected[page.title]) out[redirected[page.title]] = text;
    }
    await delay(DELAY_MS);
  }
  return out;
}

/**
 * Build a profile from a Wikidata entity and its article's infobox.
 * Returns null when Wikidata doesn't list the person as a tennis player — the
 * guard against a same-named stranger, which a name match alone can't give.
 */
export function buildProfile(entity, wikitext) {
  const c = entity?.claims ?? {};
  const occupations = (c.P106 ?? []).map(s => s.mainsnak?.datavalue?.value?.id);
  if (!occupations.includes(TENNIS_PLAYER)) return null;

  const title = entity.sitelinks?.enwiki?.title;
  const profile = {
    full: (title ?? entity.labels?.en?.value ?? '').replace(/\s*\([^)]*\)$/, '') || undefined,
    wikidata: entity.id,
  };

  // Date of birth — Wikidata; keep only if precise to the day (precision 11).
  const dob = firstValue(c, 'P569');
  if (dob?.time && dob.precision >= 11) {
    const iso = dob.time.replace(/^\+/, '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) profile.dob = iso;
  }

  // Height — infobox (cites ATP/WTA), else Wikidata.
  let height = parseHeightCm(infoboxField(wikitext, 'height'));
  if (!height) {
    const h = firstValue(c, 'P2048');
    const unit = h?.unit?.split('/').pop();
    const n = Number(h?.amount);
    height = inRange(unit === CENTIMETRE ? n : unit === METRE ? n * 100 : NaN);
  }
  if (height) profile.heightCm = height;

  // Plays / backhand — infobox, else Wikidata's playing hand (no backhand there).
  const { plays, backhand } = parsePlays(infoboxField(wikitext, 'plays'));
  const hand = plays ?? HAND[firstValue(c, 'P741')?.id];
  if (hand) profile.plays = hand;
  if (backhand) profile.backhand = backhand;

  // Turned pro — infobox, else Wikidata's "work period (start)".
  let pro = parseTurnedPro(infoboxField(wikitext, 'turnedpro'));
  if (!pro) pro = parseTurnedPro(firstValue(c, 'P2031')?.time);
  if (pro) profile.turnedPro = pro;

  // Career figures and background — infobox only.
  const high = parseCareerHigh(infoboxField(wikitext, 'highestsinglesranking'));
  if (high) {
    profile.careerHigh = high.rank;
    if (high.date) profile.careerHighDate = high.date;
  }
  const titles = parseCareerTitles(infoboxField(wikitext, 'singlestitles'));
  if (titles != null) profile.careerTitles = titles;
  const birthplace = parseBirthplace(infoboxField(wikitext, 'birth_place'));
  if (birthplace) profile.birthplace = birthplace;
  const coach = parseCoach(coachField(wikitext));
  if (coach) profile.coach = coach;

  return profile;
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

/** Every player the app can show, per tour, with a full name where we know one. */
function playersToProfile(tournaments, rankings, race) {
  const out = { atp: new Map(), wta: new Map() };
  const add = (tour, name, full) => {
    if (!name) return;
    if (!out[tour].has(name) || (full && !out[tour].get(name))) out[tour].set(name, full ?? null);
  };
  for (const tour of ['atp', 'wta']) {
    for (const t of tournaments?.[tour] ?? []) {
      add(tour, t.winner, t.winner_full);
      add(tour, t.runner_up, t.runner_up_full);
    }
    for (const snapshot of Object.values(rankings?.[tour] ?? {})) {
      for (const p of snapshot ?? []) add(tour, p.name);
    }
    for (const p of race?.[tour]?.players ?? []) add(tour, p.name, p.full);
  }
  return out;
}

// Facts that don't legitimately disappear: if a refresh can't read one (an
// edit in progress, a layout change), keep the value we had rather than blank
// it. Coach is excluded — "no current coach" is a real answer when a
// partnership ends.
const STICKY = ['full', 'dob', 'heightCm', 'plays', 'backhand', 'turnedPro',
  'careerHigh', 'careerHighDate', 'careerTitles', 'birthplace'];

const checkedLongAgo = entry => {
  const age = (Date.now() - new Date(entry.checkedAt)) / 86_400_000;
  return !(age < RECHECK_AFTER_DAYS); // also true when checkedAt is absent
};

export async function fetchProfiles() {
  const rebuild = Boolean(process.env.REBUILD_PROFILES);
  const { 'tournaments.json': tournaments, 'rankings.json': rankings } =
    await fetchGistFiles(['tournaments.json', 'rankings.json']);
  // Optional files: race.json may be absent, and profiles.json doesn't exist
  // until the first run creates it.
  const optional = async name => fetchGistFiles([name]).then(f => f[name]).catch(() => ({}));
  const race = await optional('race.json');
  const profiles = await optional('profiles.json');
  profiles.atp ??= {};
  profiles.wta ??= {};

  // Sort work into: new/unfound players needing a search, and stored profiles
  // that only need re-reading by their Wikidata id.
  const wanted = playersToProfile(tournaments, rankings, race);
  const toSearch = [];
  const toReread = [];
  for (const tour of ['atp', 'wta']) {
    for (const [name, full] of wanted[tour]) {
      const entry = profiles[tour][name];
      if (!entry) toSearch.push({ tour, name, full });
      else if (entry.missing) { if (checkedLongAgo(entry)) toSearch.push({ tour, name, full }); }
      // Career titles, career high and coach change through the season, so
      // every stored profile is re-read weekly — by id, in batches of 50.
      else if (rebuild || checkedLongAgo(entry)) toReread.push({ tour, name, id: entry.wikidata });
    }
  }
  console.log(`${toSearch.length} to look up, ${toReread.length} to re-read (${wanted.atp.size + wanted.wta.size} players tracked).`);
  if (toSearch.length === 0 && toReread.length === 0) return false;

  const now = new Date().toISOString();
  const markMissing = (item, why) => {
    profiles[item.tour][item.name] = { missing: true, checkedAt: now };
    console.log(`  ✗ ${item.name} → ${why}`);
  };

  // New players: find their Wikidata id (per-player search — the slow part).
  const items = [...toReread];
  for (const item of toSearch) {
    try {
      const id = await findWikidataId(item.name, item.full);
      if (id) items.push({ ...item, id });
      else markMissing(item, 'no Wikipedia article found');
    } catch (err) {
      // Unrecorded, so the next pass retries; a network blip isn't a miss.
      console.error(`  ! ${item.name}: ${err.message}`);
    }
  }

  // Everyone with an id: batched entity + article fetch.
  const entities = await fetchEntities([...new Set(items.map(i => i.id))]);
  const titles = [...new Set(Object.values(entities).map(e => e.sitelinks?.enwiki?.title).filter(Boolean))];
  const articles = await fetchArticles(titles);

  let written = 0;
  for (const item of items) {
    const entity = entities[item.id];
    const profile = buildProfile(entity, articles[entity?.sitelinks?.enwiki?.title]);
    if (!profile) {
      // For a re-read, keep what we have rather than erase a known player.
      if (profiles[item.tour][item.name]?.wikidata) {
        profiles[item.tour][item.name].checkedAt = now;
        console.log(`  – ${item.name} → ${item.id} no longer reads as a tennis player; kept existing profile`);
      } else {
        markMissing(item, `${item.id} is not listed as a tennis player`);
      }
      continue;
    }
    const previous = profiles[item.tour][item.name] ?? {};
    const merged = { ...profile, checkedAt: now };
    for (const key of STICKY) if (merged[key] == null && previous[key] != null) merged[key] = previous[key];
    profiles[item.tour][item.name] = merged;
    written++;
    const bits = [
      profile.dob,
      profile.heightCm && `${profile.heightCm}cm`,
      profile.plays && `${profile.plays}${profile.backhand ? `/${profile.backhand}` : ''}`,
      profile.turnedPro && `pro ${profile.turnedPro}`,
      profile.careerHigh && `high #${profile.careerHigh}`,
      profile.careerTitles != null && `${profile.careerTitles} titles`,
    ];
    console.log(`  ✓ ${item.name.padEnd(22)} ${bits.filter(Boolean).join(' · ')}`);
  }

  // Stable key order keeps Gist diffs readable.
  for (const tour of ['atp', 'wta']) {
    profiles[tour] = Object.fromEntries(Object.entries(profiles[tour]).sort(([a], [b]) => a.localeCompare(b)));
  }

  console.log(`\n${written} profiles written.`);
  await updateGistContent({ 'profiles.json': JSON.stringify(profiles, null, 2) + '\n' });
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchProfiles().catch(err => { console.error(err); process.exit(1); });
}
