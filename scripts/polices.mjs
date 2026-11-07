/**
 * Génère src/polices.css : les polices des thèmes, EMBARQUÉES en base64 (woff2, sous-ensemble
 * latin, fournies par les paquets @fontsource, licence SIL Open Font License). Aucune requête
 * réseau à l'exécution : l'application et Soroban.html restent entièrement hors ligne.
 *
 * Pour alléger : chaque police est réduite aux seuls caractères utiles (ASCII, Latin-1, les
 * caractères présents dans le code de l'application : accents, ū, −, →, ·, guillemets…).
 *
 * Lancer : npm run polices   (à refaire si on change de police ou si de nouveaux caractères
 * spéciaux apparaissent dans les textes)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import subsetFont from 'subset-font';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// Famille CSS (nom maison) ← paquet @fontsource, graisses.
const POLICES = [
  ['Suisse', 'archivo', [400, 700, 900]],      // titres et texte
  ['Examen Mono', 'ibm-plex-mono', [500, 700]], // nombres à calculer
  ['Chrono Cond', 'barlow-condensed', [800]],   // performance (chrono, records, scores)
];

/** Caractères utiles : ASCII imprimable, Latin-1, et tout caractère présent dans src/. */
function caracteres() {
  const vus = new Set();
  for (let c = 0x20; c < 0x7f; c++) vus.add(String.fromCodePoint(c));
  for (let c = 0xa0; c <= 0xff; c++) vus.add(String.fromCodePoint(c));
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const f = join(dossier, nom);
      if (statSync(f).isDirectory()) parcourir(f);
      else if (/\.(js|html)$/.test(nom)) for (const c of readFileSync(f, 'utf8')) if (c.codePointAt(0) >= 0xa0 && c.codePointAt(0) < 0x3000) vus.add(c);
    }
  };
  parcourir(join(racine, 'src'));
  for (const c of 'Œœ‘’“”«»–—…•·−×÷±≤≥←→↑↓€ūŌō') vus.add(c);
  return [...vus].join('');
}
const TEXTE = caracteres();

let css = '/* Fichier généré par scripts/polices.mjs. Ne pas modifier à la main. Polices sous licence SIL OFL 1.1. */\n';
let total = 0;
for (const [famille, paquet, graisses] of POLICES) {
  for (const g of graisses) {
    const complet = readFileSync(join(racine, 'node_modules/@fontsource', paquet, 'files', `${paquet}-latin-${g}-normal.woff2`));
    const octets = await subsetFont(complet, TEXTE, { targetFormat: 'woff2' });
    total += octets.length;
    css += `@font-face{font-family:"${famille}";font-style:normal;font-weight:${g};font-display:swap;src:url(data:font/woff2;base64,${octets.toString('base64')}) format("woff2");}\n`;
  }
}
writeFileSync(join(racine, 'src/polices.css'), css);
console.log(`src/polices.css : ${POLICES.length} familles, ${Math.round(total / 1024)} Ko de woff2 (${Math.round(css.length / 1024)} Ko en base64).`);
