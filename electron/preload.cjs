const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTournaments: () => JSON.parse(ipcRenderer.sendSync('get-data', 'tournaments.json')),
  getRankings: () => JSON.parse(ipcRenderer.sendSync('get-data', 'rankings.json')),
  getPlayers: () => JSON.parse(ipcRenderer.sendSync('get-data', 'players.json')),
  getRace: () => JSON.parse(ipcRenderer.sendSync('get-data', 'race.json')),
  getSyncTime: () => ipcRenderer.sendSync('get-sync-time'),
  triggerSync: () => ipcRenderer.invoke('sync-data'),
});
