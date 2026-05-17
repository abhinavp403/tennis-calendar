const { contextBridge } = require('electron');
const { readFileSync, existsSync } = require('fs');
const path = require('path');

function readData(file) {
  const filePath = path.join(process.env.USER_DATA_PATH, file);
  if (!existsSync(filePath)) return file.includes('rankings') ? '{"atp":{},"wta":{}}' : '{"atp":[],"wta":[]}';
  return readFileSync(filePath, 'utf-8');
}

contextBridge.exposeInMainWorld('electronAPI', {
  getTournaments: () => JSON.parse(readData('tournaments.json')),
  getRankings: () => JSON.parse(readData('rankings.json')),
});
