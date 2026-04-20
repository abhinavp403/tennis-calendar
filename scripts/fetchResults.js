/**
 * Fetches missing tournament results (winner, runner_up, score) from Wikipedia
 * for any tournament whose end date has passed but lacks results in tournaments.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/tournaments.json');

async function searchWikipedia(query) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    '&format=json&srlimit=5';
  const res = await fetch(url, { headers: { 'User-Agent': 'TennisCalendarApp/1.0' } });
  const data = await res.json();
  return data.query?.search ?? [];
}

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

function cleanPlayerName(raw) {
  // [[Full Name (tennis)|Display]] → Display, or [[Full Name]] → Full Name
  return raw
    .replace(/\s*\(tennis\)\s*/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();
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

function extractSinglesResult(wikitext) {
  // Find the === Singles === section
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

async function fetchResultForTournament(tournament) {
  const year = tournament.start.slice(0, 4);
  // Try several search queries, most specific first
  const queries = [
    `${year} ${tournament.name} tennis`,
    `${year} ${tournament.name}`,
  ];

  for (const query of queries) {
    const results = await searchWikipedia(query);

    // Pick the first result whose title contains the year and is not a sub-page (–)
    const candidate = results.find(r => r.title.includes(year) && !r.title.includes(' – '));
    if (!candidate) continue;

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
  let updated = false;

  for (const tour of ['atp', 'wta']) {
    for (const tournament of data[tour]) {
      if (tournament.winner || tournament.end >= today) continue;

      console.log(`Fetching result for: ${tournament.name} (${tournament.end})`);
      try {
        const result = await fetchResultForTournament(tournament);
        if (result) {
          tournament.winner = result.winner;
          tournament.runner_up = result.runner_up;
          tournament.score = result.score;
          updated = true;
        }
      } catch (err) {
        console.error(`  Error fetching ${tournament.name}:`, err.message);
      }
    }
  }

  if (updated) {
    writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
    console.log('tournaments.json updated with new results.');
  } else {
    console.log('No missing results to update.');
  }

  return updated;
}

// Allow running directly: node scripts/fetchResults.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchMissingResults().catch(console.error);
}
