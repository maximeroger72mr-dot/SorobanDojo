// Pont sécurisé entre l'interface et le processus principal : seule la sauvegarde est exposée.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockage', {
  lire: () => ipcRenderer.invoke('progression:lire'),
  ecrire: (donnees) => ipcRenderer.invoke('progression:ecrire', donnees),
});
