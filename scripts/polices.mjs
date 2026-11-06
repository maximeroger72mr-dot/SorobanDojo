/**
 * Génère src/polices.css : les polices des thèmes, EMBARQUÉES en base64 (woff2, sous-ensemble
 * latin, fournies par les paquets @fontsource, licence SIL Open Font License). Aucune requête
 * réseau à l'exécution : l'application et Soroban.html restent entièrement hors ligne.
 *
 * Lancer : npm run polices   (à refaire seulement si on change de police)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// Famille CSS (nom maison) ← paquet @fontsource, graisses.
const POLICES = [
  ['Suisse', 'archivo', [400, 700, 900]],      // titres et texte
  ['Examen Mono', 'ibm-plex-mono', [500, 700]], // nombres à calculer
  ['Chrono Cond', 'barlow-condensed', [800]],   // performance (chrono, records, scores)
];

let css = '/* Fichier généré par scripts/polices.mjs. Ne pas modifier à la main. Polices sous licence SIL OFL 1.1. */\n';
let total = 0;
for (const [famille, paquet, graisses] of POLICES) {
  for (const g of graisses) {
    const octets = readFileSync(join(racine, 'node_modules/@fontsource', paquet, 'files', `${paquet}-latin-${g}-normal.woff2`));
    total += octets.length;
    css += `@font-face{font-family:"${famille}";font-style:normal;font-weight:${g};font-display:swap;src:url(data:font/woff2;base64,${octets.toString('base64')}) format("woff2");}\n`;
  }
}
writeFileSync(join(racine, 'src/polices.css'), css);
console.log(`src/polices.css : ${POLICES.length} familles, ${Math.round(total / 1024)} Ko de woff2 (${Math.round(css.length / 1024)} Ko en base64).`);
