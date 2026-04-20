const { contextBridge } = require('electron');
const { readFileSync } = require('fs');
const path = require('path');

function dataPath(file) {
  return process.env.USER_DATA_PATH
    ? path.join(process.env.USER_DATA_PATH, file)
    : path.join(__dirname, '../data', file);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getTournaments: () => JSON.parse(readFileSync(dataPath('tournaments.json'), 'utf-8')),
  getRankings: () => JSON.parse(readFileSync(dataPath('rankings.json'), 'utf-8')),
});
