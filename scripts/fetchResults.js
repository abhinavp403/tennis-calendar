/**
 * Fetches missing tournament results (winner, runner_up, score) from Wikipedia
 * for any tournament whose end date has passed but lacks results in tournaments.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { updateGist } from './updateGist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/tournaments.json');
const UA = 'TennisCalendar/1.0 (https://github.com/abhinavp403/tennis-calendar; abhinavp403@gmail.com) node-fetch';

async function searchWikipedia(query) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    '&format=json&srlimit=5';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await res.json();
  return data.query?.search ?? [];
}

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

function cleanPlayerName(raw) {
  // [[Full Name (tennis)|Display]] → Display, or [[Full Name]] → Full Name
  let name = raw
    .replace(/\s*\(tennis\)\s*/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();
  // Abbreviate to "F. LastName" format for consistency with existing data
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    name = parts[0][0] + '. ' + parts.slice(1).join(' ');
  }
  return name;
}

function cleanScore(raw) {
  return raw
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')   // remove refs
    .replace(/<ref[^>]*/g, '')
    .replace(/<sup>\(([^)]+)\)<\/sup>/g, '($1)')  // <sup>(x)</sup> → (x), no double parens
    .replace(/<sup>(.*?)<\/sup>/g, '($1)')         // <sup>x</sup> → (x)
    .replace(/\{\{[Nn]owrap\|(.*?)\}\}/g, '$1') // {{Nowrap|...}}
    .replace(/\{\{[^}]+\}\}/g, '')            // remaining templates
    .replace(/\[\[[^\]]*\]\]/g, '')           // wiki links
    .replace(/[[\]]/g, '')
    .replace(/^[,\s]+/, '')                   // strip leading comma/spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFromInfobox(wikitext) {
  // Parse | champ = / | champs = / | champion = and | runner = / | runner-up = from infobox
  const champMatch = wikitext.match(/\|\s*(?:champs?|champion)\s*=\s*(?:\{\{[^}]+\}\}\s*)*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/i);
  const runnerMatch = wikitext.match(/\|\s*(?:runner|runner-up)\s*=\s*(?:\{\{[^}]+\}\}\s*)*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/i);
  const scoreMatch = wikitext.match(/\|\s*score\s*=\s*([^\n|]+)/i);

  if (!champMatch || !runnerMatch || !scoreMatch) return null;

  const winner = cleanPlayerName(champMatch[2] || champMatch[1]);
  const runnerUp = cleanPlayerName(runnerMatch[2] || runnerMatch[1]);
  const score = cleanScore(scoreMatch[1]);

  if (!winner || !runnerUp || !score) return null;
  return { winner, runner_up: runnerUp, score };
}

function extractSinglesResult(wikitext) {
  // First try infobox (used on dedicated singles pages)
  const infoboxResult = extractFromInfobox(wikitext);
  if (infoboxResult) return infoboxResult;

  // Fall back: find the === Singles === section and parse the "def." line
  const singlesRe = /===\s*Singles\s*===/i;
  const doublesRe = /===\s*Doubles\s*===/i;
  const singlesIdx = wikitext.search(singlesRe);
  if (singlesIdx === -1) return null;

  // Slice to just the singles section (stop at Doubles section)
  const afterSingles = wikitext.slice(singlesIdx);
  const doublesIdx = afterSingles.search(doublesRe);
  const section = doublesIdx !== -1 ? afterSingles.slice(0, doublesIdx) : afterSingles.slice(0, 600);

  // Find the line with "def."
  const defLine = section.split('\n').find(l => /def\./.test(l) && l.includes('[['));
  if (!defLine) return null;

  // Extract all [[...]] wikilinks in order
  const linkRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links = [];
  let m;
  while ((m = linkRe.exec(defLine)) !== null) {
    links.push(cleanPlayerName(m[2] || m[1]));
  }
  if (links.length < 2) return null;

  const winner = links[0];
  const runnerUp = links[1];

  // Score: everything after the last "]]" on the line
  const lastLinkEnd = defLine.lastIndexOf(']]');
  const rawScore = defLine.slice(lastLinkEnd + 2);
  const score = cleanScore(rawScore);

  if (!winner || !runnerUp || !score) return null;
  return { winner, runner_up: runnerUp, score };
}

const WIKI_API_DELAY = 500; // ms between Wikipedia API calls to avoid rate limiting
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchResultForTournament(tournament, tour) {
  const year = tournament.start.slice(0, 4);
  const singlesLabel = tour === 'wta' ? "Women's singles" : "Men's singles";

  // Try direct page title fetches first — more reliable than search, no false matches
  const directTitles = [
    `${year} ${tournament.name} \u2013 ${singlesLabel}`,
    `${year} ${tournament.name} \u2013 Singles`,
    `${year} ${tournament.name}`,
  ];

  for (const title of directTitles) {
    await delay(WIKI_API_DELAY);
    const wikitext = await getWikitext(title);
    if (!wikitext) continue;
    const result = extractSinglesResult(wikitext);
    if (result) {
      console.log(`  ✓ ${tournament.name}: ${result.winner} def. ${result.runner_up} ${result.score}`);
      return result;
    }
  }

  // Fall back to search, but validate candidate title contains tournament name keywords
  // to prevent false matches (e.g. Italian Open page returned for Geneva Open query)
  const nameKeywords = tournament.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const titleMatches = r => nameKeywords.some(k => r.title.toLowerCase().includes(k));

  const searchQueries = [
    `${year} ${tournament.name} ${singlesLabel}`,
    `${year} ${tournament.name} tennis`,
  ];

  for (const query of searchQueries) {
    await delay(WIKI_API_DELAY);
    const results = await searchWikipedia(query);

    const candidate =
      results.find(r => r.title.includes(year) && / – /i.test(r.title) && /singles/i.test(r.title) && titleMatches(r)) ||
      results.find(r => r.title.includes(year) && !r.title.includes(' – ') && titleMatches(r));

    if (!candidate) continue;

    await delay(WIKI_API_DELAY);
    const wikitext = await getWikitext(candidate.title);
    if (!wikitext) continue;

    const result = extractSinglesResult(wikitext);
    if (result) {
      console.log(`  ✓ ${tournament.name}: ${result.winner} def. ${result.runner_up} ${result.score}`);
      return result;
    }
  }

  console.log(`  ✗ ${tournament.name}: could not find result`);
  return null;
}

export async function fetchMissingResults(dataPath = DATA_PATH) {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let updated = false;

  for (const tour of ['atp', 'wta']) {
    for (const tournament of data[tour]) {
      if (tournament.end >= today) continue;

      // Skip tournaments completed more than 30 days ago that already have a result
      const recentlyCompleted = tournament.end >= thirtyDaysAgo;
      if (tournament.winner && !recentlyCompleted) continue;

      const action = tournament.winner ? 'Re-verifying' : 'Fetching';
      console.log(`${action} result for: ${tournament.name} (${tournament.end})`);
      try {
        const result = await fetchResultForTournament(tournament, tour);
        if (result) {
          const changed =
            tournament.winner !== result.winner ||
            tournament.runner_up !== result.runner_up ||
            tournament.score !== result.score;
          if (changed) {
            if (tournament.winner) {
              console.log(`  ↻ Corrected: was ${tournament.winner} def. ${tournament.runner_up} ${tournament.score}`);
            }
            tournament.winner = result.winner;
            tournament.runner_up = result.runner_up;
            tournament.score = result.score;
            updated = true;
          }
        }
      } catch (err) {
        console.error(`  Error fetching ${tournament.name}:`, err.message);
      }
    }
  }

  if (updated) {
    writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
    console.log('tournaments.json updated with new results.');
    await updateGist({ 'tournaments.json': dataPath });
  } else {
    console.log('No missing results to update.');
  }

  return updated;
}

// Allow running directly: node scripts/fetchResults.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchMissingResults().catch(console.error);
}
