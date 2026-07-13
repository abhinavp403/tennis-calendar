/**
 * Updates the Tennis Calendar GitHub Gist with the latest data files.
 * Uses `gh auth token` to authenticate — no stored credentials needed.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const GIST_ID = 'c75d3f961da94fdeed16cdbd8e2ec08e';

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

/**
 * @param {Record<string, string>} files  Map of gist filename → local file path
 */
export async function updateGist(files) {
  // Safety valve for local testing: SKIP_GIST_PUSH=1 node scripts/fetchRankings.js
  // runs the full pipeline against a local file without touching the live Gist.
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
  for (const [filename, filePath] of Object.entries(files)) {
    payload.files[filename] = { content: readFileSync(filePath, 'utf-8') };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TennisCalendarApp/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log('Gist updated:', Object.keys(files).join(', '));
      return true;
    } else {
      console.error('Gist update failed:', res.status, await res.text());
      return false;
    }
  } catch (err) {
    console.error('Gist update error:', err.message);
    return false;
  }
}
