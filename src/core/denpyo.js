/**
 * Denpyōzan (伝票算) : une liasse de 20 bordereaux de 5 lignes ; le problème i additionne la
 * ligne (i mod 5) + 1 des bordereaux s à s + 9 (des paquets de 10 qui se chevauchent).
 * Partagé par le dan Zenkoren (30 problèmes, 3 à 7 chiffres) et les kyū Zenkoren du 3e au 1er
 * (matière au choix, 15 problèmes, nombres plus courts). Format ESTIMÉ (non publié).
 */

import { facteur } from './multiplication.js';
import { entier } from './aleatoire.js';

/**
 * @param {{ nb?: number, min?: number, max?: number }} [o]  problèmes, chiffres des nombres
 * @returns {{ liasse: number[][], problemes: object[] }}
 */
export function genererDenpyo({ nb = 30, min = 3, max = 7 } = {}) {
  const liasse = Array.from({ length: 20 }, () => Array.from({ length: 5 }, () => facteur(entier(min, max))));
  const problemes = Array.from({ length: nb }, (_, i) => {
    const ligne = i % 5;
    const debut = Math.floor(i / 5) * 2 % 11; // 0, 2, 4… : des paquets de 10 qui se chevauchent
    const nombres = liasse.slice(debut, debut + 10).map((b) => b[ligne]);
    return { type: 'addsub', denpyo: { debut: debut + 1, fin: debut + 10, ligne: ligne + 1 }, lignes: nombres.map((x) => ({ op: '+', n: x })), resultat: nombres.reduce((t, x) => t + x, 0) };
  });
  return { liasse, problemes };
}
