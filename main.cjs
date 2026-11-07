// Processus principal Electron : crée la fenêtre et gère la sauvegarde locale de la progression.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Fichier de progression : dans le dossier de données de l'utilisateur
// (Windows : %APPDATA%\Soroban, Mac : ~/Library/Application Support/Soroban).
const fichierProgression = () => path.join(app.getPath('userData'), 'progression.json');

ipcMain.handle('progression:lire', () => {
  const f = fichierProgression();
  if (!fs.existsSync(f)) return null; // première utilisation
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    // Fichier illisible : on le met de côté (jamais écrasé) ; l'interface prévient l'utilisateur.
    const nom = `progression-illisible-${Date.now()}.json`;
    try { fs.renameSync(f, path.join(path.dirname(f), nom)); } catch { /* reste en place : il sera copié dans sauvegardes/ */ }
    return { illisible: nom };
  }
});

/**
 * Copie de sauvegarde automatique : au premier enregistrement de chaque jour, l'ancien fichier
 * est copié dans « sauvegardes/ » ; seules les 5 dernières copies sont gardées.
 */
function copieDuJour(f) {
  if (!fs.existsSync(f)) return;
  const dossier = path.join(path.dirname(f), 'sauvegardes');
  fs.mkdirSync(dossier, { recursive: true });
  const jour = new Date().toISOString().slice(0, 10);
  const copie = path.join(dossier, `progression-${jour}.json`);
  if (fs.existsSync(copie)) return;
  fs.copyFileSync(f, copie);
  const anciennes = fs.readdirSync(dossier).filter((n) => n.startsWith('progression-')).sort();
  for (const n of anciennes.slice(0, -5)) fs.rmSync(path.join(dossier, n));
}

ipcMain.handle('progression:ecrire', (_evt, donnees) => {
  // Écriture atomique : fichier temporaire puis renommage, pour ne jamais corrompre la sauvegarde.
  const f = fichierProgression();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  copieDuJour(f);
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(donnees, null, 2), 'utf8');
  fs.renameSync(`${f}.tmp`, f);
  return true;
});

function creerMenu() {
  const mac = process.platform === 'darwin';
  const modele = [
    ...(mac ? [{ role: 'appMenu', label: 'Soroban' }] : []),
    { label: 'Édition', submenu: [
      { role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' },
      { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' },
    ] },
    { label: 'Affichage', submenu: [
      { role: 'resetZoom', label: 'Taille normale' }, { role: 'zoomIn', label: 'Agrandir' },
      { role: 'zoomOut', label: 'Réduire' }, { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Outils de développement' }]),
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

function creerFenetre() {
  const fen = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'Soroban',
    backgroundColor: '#f6f5f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  fen.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  creerMenu();
  creerFenetre();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) creerFenetre(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
