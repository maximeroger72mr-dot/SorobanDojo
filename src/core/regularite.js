/**
 * Régularité : minutes pratiquées par jour et série de jours d'affilée.
 *
 * Règle de la série : chaque jour pratiqué compte. Un jour sans pratique ne casse pas la série
 * s'il est le seul « jour de repos » des 7 derniers jours ; deux jours de repos rapprochés
 * (ou deux jours manqués d'affilée) la cassent. Aujourd'hui, tant qu'on n'a pas pratiqué,
 * la série reste en suspens (elle n'est pas perdue).
 */

import { ajouterJours } from './revision.js';

/** Minutes pratiquées par date, d'après les séances enregistrées. */
export function minutesParJour(sessions) {
  const m = {};
  for (const s of sessions) m[s.date] = (m[s.date] ?? 0) + (s.dureeMs ?? 0) / 60000;
  return m;
}

/**
 * @param {Set<string>|string[]} datesPratiquees  dates 'AAAA-MM-JJ'
 * @param {string} aujourdhui
 * @returns {{ jours: number, aujourdhuiFait: boolean, reposUtilise: boolean }}
 */
export function serieJours(datesPratiquees, aujourdhui) {
  const fait = new Set(datesPratiquees);
  const aujourdhuiFait = fait.has(aujourdhui);
  let jour = aujourdhuiFait ? aujourdhui : ajouterJours(aujourdhui, -1);
  let jours = 0;
  let dernierRepos = null; // date du dernier jour de repos accepté
  let reposUtilise = false;
  for (let garde = 0; garde < 4000; garde++) {
    if (fait.has(jour)) {
      jours += 1;
    } else {
      const precedentManque = !fait.has(ajouterJours(jour, -1));
      const reposRecent = dernierRepos && ajouterJours(jour, 6) >= dernierRepos;
      // Un repos n'est accepté que si la veille a été pratiquée et qu'aucun repos n'a eu lieu dans les 7 jours.
      if (jours === 0 || precedentManque || reposRecent) break;
      dernierRepos = jour;
      if (ajouterJours(aujourdhui, -7) < jour) reposUtilise = true;
    }
    jour = ajouterJours(jour, -1);
  }
  return { jours, aujourdhuiFait, reposUtilise };
}

/**
 * Régularité du rythme sur un bloc de colonnes (ou de tranches de marathon) : l'écart entre les
 * temps par chiffre, sans rien demander de plus à l'élève (on ne chronomètre pas chaque ligne,
 * ce qui casserait le geste).
 *  - score 0 à 100 : 100 − 150 × coefficient de variation (100 = parfaitement régulier) ;
 *  - hésitations : colonnes au moins 2 fois plus lentes que la médiane du bloc ;
 *  - irrégulier : score < 65 ou au moins 2 hésitations.
 * @param {number[]} temps  secondes par chiffre de chaque colonne du bloc
 */
export function scoreRythme(temps) {
  const n = temps.length;
  if (n < 5) return null;
  const moyenne = temps.reduce((s, x) => s + x, 0) / n;
  const ecart = Math.sqrt(temps.reduce((s, x) => s + (x - moyenne) ** 2, 0) / n);
  const tri = [...temps].sort((a, b) => a - b);
  const med = tri[Math.floor(n / 2)];
  const score = Math.max(0, Math.min(100, Math.round(100 - 150 * (ecart / moyenne))));
  const hesitations = temps.filter((x) => x >= 2 * med).length;
  return { score, hesitations, irregulier: score < 65 || hesitations >= 2 };
}
