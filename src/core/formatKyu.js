/**
 * Entraînement « au format du kyū » : les × et ÷ (et plus tard les colonnes) tirés dans des sujets
 * d'examen du grade visé, pour retrouver ses découpages dans les mêmes proportions.
 * Fonctions pures (le hasard mis à part).
 */

import { formatExamen } from './parcours.js';
import { systemeChoisi, genererSujet } from './epreuves.js';

/**
 * Le grade dont on reprend les × ou les ÷ : le grade visé, ou le premier d'après qui a cette
 * opération (pas de division aux 10e et 9e kyū).
 */
export function gradeOperation(d, type) {
  const sys = systemeChoisi(d);
  const g0 = formatExamen(d).grade;
  return sys.grades.slice(sys.grades.indexOf(g0)).find((g) => g[type]) ?? null;
}

/**
 * Calculs « au format du kyū » : tirés dans des sujets d'examen du grade, donc avec ses
 * proportions exactes (si un 6 × 3 tombe dans 7 % des problèmes du sujet, il tombe dans 7 % des
 * calculs ici), ses zéros finaux, ses décimaux et ses arrondis.
 */
export function reserveKyu(g, type) {
  let pile = [];
  return () => {
    if (!pile.length) pile = genererSujet(g).sections.filter((x) => x.cle === type).flatMap((x) => x.problemes).sort(() => Math.random() - 0.5);
    return pile.pop();
  };
}

