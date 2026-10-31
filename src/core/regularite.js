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
