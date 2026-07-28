/**
 * Reads and updates the Tennis Calendar GitHub Gist — the live source of truth
 * the desktop app syncs from. Uses `gh auth token` (or GH_TOKEN/GITHUB_TOKEN in
 * CI) to authenticate; no stored credentials needed.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

export const GIST_ID = 'c75d3f961da94fdeed16cdbd8e2ec08e';
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

function getGhToken() {
  // In CI/GitHub Actions, token is passed via environment variable
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  // On local machine, use gh CLI
  try {
    return execSync('gh auth token', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return null;
  }
}

function authHeaders(token) {
  const headers = { 'User-Agent': 'TennisCalendarApp/1.0', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Reads and parses JSON files from the Gist. Uses the GitHub API (authoritative,
 * read-your-writes) rather than the raw CDN, so sequential pipeline steps see
 * each other's pushes. Falls back to the file's raw_url when the API truncates
 * large files.
 * @param {string[]} filenames  Gist filenames to read
 * @returns {Promise<Record<string, any>>}  Map of filename → parsed JSON
 */
export async function fetchGistFiles(filenames) {
  const headers = authHeaders(getGhToken());
  const res = await fetch(GIST_API, { headers });
  if (!res.ok) throw new Error(`Failed to read Gist: ${res.status} ${await res.text()}`);
  const gist = await res.json();

  const out = {};
  for (const name of filenames) {
    const file = gist.files?.[name];
    if (!file) throw new Error(`Gist file not found: ${name}`);
    let content = file.content;
    if (file.truncated && file.raw_url) {
      content = await (await fetch(file.raw_url, { headers, cache: 'no-cache' })).text();
    }
    out[name] = JSON.parse(content);
  }
  return out;
}

// Shared push core. `fileContents` is a map of gist filename → content string.
async function pushGist(fileContents) {
  // Safety valve for local testing: SKIP_GIST_PUSH=1 node scripts/fetchRankings.js
  // runs the full pipeline without touching the live Gist.
  if (process.env.SKIP_GIST_PUSH) {
    console.log('Gist update skipped (SKIP_GIST_PUSH is set).');
    return false;
  }
  const token = getGhToken();
  if (!token) {
    console.log('Gist update skipped (gh CLI not available or not authenticated).');
    return false;
  }

  const payload = { files: {} };
  for (const [filename, content] of Object.entries(fileContents)) {
    payload.files[filename] = { content };
  }

  try {
    const res = await fetch(GIST_API, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('Gist updated:', Object.keys(fileContents).join(', '));
      return true;
    }
    console.error('Gist update failed:', res.status, await res.text());
    return false;
  } catch (err) {
    console.error('Gist update error:', err.message);
    return false;
  }
}

/**
 * Update the Gist from in-memory content.
 * @param {Record<string, string>} fileContents  Map of gist filename → content string
 */
export async function updateGistContent(fileContents) {
  return pushGist(fileContents);
}

/**
 * Update the Gist from local files.
 * @param {Record<string, string>} files  Map of gist filename → local file path
 */
export async function updateGist(files) {
  const contents = {};
  for (const [filename, filePath] of Object.entries(files)) {
    contents[filename] = readFileSync(filePath, 'utf-8');
  }
  return pushGist(contents);
}
