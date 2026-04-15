const { contextBridge } = require('electron');
const { readFileSync } = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  getTournaments: () => JSON.parse(readFileSync(path.join(__dirname, '../data/tournaments.json'), 'utf-8')),
  getRankings: () => JSON.parse(readFileSync(path.join(__dirname, '../data/rankings.json'), 'utf-8')),
});
