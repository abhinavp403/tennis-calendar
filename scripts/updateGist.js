/**
 * Updates the Tennis Calendar GitHub Gist with the latest data files.
 * Uses `gh auth token` to authenticate — no stored credentials needed.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const GIST_ID = 'c75d3f961da94fdeed16cdbd8e2ec08e';

function getGhToken() {
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
