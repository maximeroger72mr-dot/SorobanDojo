/**
 * Sprint d'estimation du quotient (商) : le geste mental le plus coûteux de la division par
 * 2 chiffres. On montre un dividende PARTIEL et un diviseur à 2 chiffres (150 ÷ 18) ; on tape
 * d'une seule touche le VRAI chiffre du quotient, déjà corrigé (8, et non le 7 que donne
 * l'arrondi 18 → 20). Les dividendes ont un reste, comme au milieu d'une vraie division : on ne
 * peut pas se contenter de reconnaître une table.
 */

import { entier } from './aleatoire.js';
import { estimerChiffre } from './multiplication.js';

export const COUPLES_SPRINT = 20;
/** Médailles : secondes par couple (score = temps + 3 s par erreur). */
export const CLASSEMENT_QUOTIENT = [
  { id: 'bronze', nom: 'Bronze', s: 4 },
  { id: 'argent', nom: 'Argent', s: 2.5 },
  { id: 'or', nom: 'Or', s: 1.6 },
  { id: 'platine', nom: 'Platine', s: 1 },
];
export const PENALITE_MS = 3000;

/** Un couple : dividende partiel a, diviseur b (11 à 99), chiffre du quotient q (1 à 9). */
export function genererEstimation(recents = []) {
  for (let k = 0; ; k++) {
    const b = entier(11, 99);
    const q = entier(1, 9);
    // Reste : souvent non nul ; parfois proche du diviseur (le cas piège où l'arrondi déçoit).
    const r = Math.random() < 0.15 ? 0 : entier(Math.random() < 0.3 ? Math.max(0, b - 6) : 0, b - 1);
    const a = q * b + r;
    if (k < 30 && recents.some((x) => x.a === a && x.b === b)) continue;
    return { a, b, q };
  }
}

/** Les 20 couples d'un sprint, tous différents, avec des chiffres de quotient variés. */
export function sprintQuotient() {
  const liste = [];
  while (liste.length < COUPLES_SPRINT) {
    const c = genererEstimation(liste);
    // Pas trois fois de suite le même chiffre : la réponse ne doit pas se deviner.
    if (liste.length >= 2 && liste.at(-1).q === c.q && liste.at(-2).q === c.q) continue;
    liste.push(c);
  }
  return liste;
}

/**
 * Le raisonnement de la leçon « estimer et corriger », pour l'explication après une erreur :
 * « 18 ≈ 20 : 150 ÷ 20 ≈ 7 ; 7 × 18 = 126, il reste 24, encore ≥ 18 → 8 ».
 */
export function raisonnement(a, b) {
  const { estime, arrondi } = estimerChiffre(a, b);
  const parts = [`${b} ≈ ${arrondi} : ${a} ÷ ${arrondi} ≈ ${estime}`];
  let x = Math.max(1, estime);
  if (estime === 0) parts.push('au moins 1');
  while (x * b > a) {
    parts.push(`${x} × ${b} = ${x * b}, plus que ${a} : trop grand → ${x - 1}`);
    x -= 1;
  }
  while (a - x * b >= b) {
    parts.push(`${x} × ${b} = ${x * b}, il reste ${a - x * b}, encore ≥ ${b} : trop petit → ${x + 1}`);
    x += 1;
  }
  if (parts.length === 1 || (parts.length === 2 && estime === 0)) parts.push(`${x} × ${b} = ${x * b}, il reste ${a - x * b} : c'est ${x}`);
  return parts.join(' ; ');
}

/** Médaille d'un score (ms), ou null. */
export function classementQuotient(scoreMs) {
  let r = null;
  for (const c of CLASSEMENT_QUOTIENT) if (scoreMs <= c.s * COUPLES_SPRINT * 1000) r = c;
  return r;
}
