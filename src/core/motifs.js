/**
 * Catalogue des motifs opératoires : nom lisible, geste exact (pour la remédiation),
 * exemple canonique (pour la démonstration) et familles.
 *
 * Une clé de motif s'écrit  '<op><chiffre>:<règle>'  (ex. '+4:petit', '-8:mixte'),
 * ou 'cascade+' / 'cascade-' pour les retenues et emprunts qui se propagent.
 */

import { etatDepuisChiffre } from './soroban.js';
import { regleAjout, regleRetrait } from './gestes.js';

const CHIFFRES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Liste de toutes les clés de motifs qui peuvent réellement se produire. */
export const TOUS_LES_MOTIFS = (() => {
  const liste = [];
  for (const op of ['+', '-']) {
    for (const regle of ['direct', 'petit', 'grand', 'mixte']) {
      for (const d of CHIFFRES) {
        if (regle === 'petit' && d > 4) continue;
        if (regle === 'mixte' && d < 6) continue;
        liste.push(`${op}${d}:${regle}`);
      }
    }
  }
  liste.push('cascade+', 'cascade-');
  return liste;
})();

/** Décompose une clé : { op, d, regle }  (d = null pour les cascades). */
export function analyserMotif(cle) {
  if (cle.startsWith('cascade')) return { op: cle.at(-1), d: null, regle: 'cascade' };
  const [, op, d, regle] = cle.match(/^([+-])(\d):(\w+)$/);
  return { op, d: Number(d), regle };
}

/** Clés de motifs pour une opération, des chiffres et une règle : D('+', [1,2], 'petit'). */
export const D = (op, chiffres, regle) => chiffres.map((d) => `${op}${d}:${regle}`);

/** Toutes les clés d'une famille ('direct', 'petit', 'grand', 'mixte', 'cascade'). */
export const famille = (regle) => TOUS_LES_MOTIFS.filter((c) => analyserMotif(c).regle === regle);

const signe = (op) => (op === '+' ? '+' : '−');
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const terr = (n) => plur(n, 'terrestre');

/** Nom court et lisible d'un motif. */
export function nomMotif(cle) {
  const { op, d, regle } = analyserMotif(cle);
  const s = signe(op);
  switch (regle) {
    case 'direct': return `${s}${d} direct`;
    case 'petit': return op === '+' ? `+${d} petit ami (+5 −${5 - d})` : `−${d} petit ami (+${5 - d} −5)`;
    case 'grand': return op === '+' ? `+${d} grand ami (−${10 - d} +10)` : `−${d} grand ami (−10 +${10 - d})`;
    case 'mixte': return `${s}${d} combiné (grand ami + petit ami)`;
    default: return op === '+' ? 'Retenue en cascade (ex. 99 + 1)' : 'Emprunt en cascade (ex. 100 − 1)';
  }
}

/** Description d'un geste direct qui retire k d'une tige (sous-geste d'un grand ami). */
function retraitDirect(k) {
  if (k < 5) return `l'index descend ${terr(k)}`;
  if (k === 5) return 'l\'index relève la céleste';
  return `l'index relève la céleste et descend ${terr(k - 5)} en UN SEUL mouvement`;
}
function ajoutDirect(k) {
  if (k < 5) return `le pouce monte ${terr(k)}`;
  if (k === 5) return 'l\'index abaisse la céleste';
  return `pincée : l'index abaisse la céleste PENDANT que le pouce monte ${terr(k - 5)} (un seul mouvement)`;
}

/** Geste moteur exact, décrit pas à pas (encadré de remédiation). */
export function gesteMotif(cle) {
  const { op, d, regle } = analyserMotif(cle);
  const k = d ? 10 - d : 0;
  switch (regle) {
    case 'direct':
      return op === '+'
        ? `Les boules sont libres : ${ajoutDirect(d)}. Un seul geste.`
        : `Les boules sont contre la barre : ${retraitDirect(d)}. Un seul geste.`;
    case 'petit':
      return op === '+'
        ? `Pas assez de terrestres libres. +${d} = +5 −${5 - d} : 1) l'index abaisse la céleste (+5) ; 2) l'index descend ${terr(5 - d)} (−${5 - d}).`
        : `Pas assez de terrestres contre la barre. −${d} = +${5 - d} −5 : 1) le pouce monte ${terr(5 - d)} (+${5 - d}) ; 2) l'index relève la céleste (−5).`;
    case 'grand':
      return op === '+'
        ? `La tige dépasserait 9. +${d} = −${k} +10 : 1) sur la tige, ${retraitDirect(k)} (−${k}) ; 2) sur la tige de gauche, le pouce monte 1 terrestre (+10).`
        : `La tige n'a pas assez. −${d} = −10 +${k} : 1) sur la tige de gauche, l'index retire 1 (−10) ; 2) sur la tige, ${ajoutDirect(k)} (+${k}).`;
    case 'mixte':
      return op === '+'
        ? `+${d} = −${k} +10, et le −${k} se fait par le petit ami (+${5 - k} −5) : 1) le pouce monte ${terr(5 - k)} ; 2) l'index relève la céleste ; 3) sur la tige de gauche, le pouce monte 1 terrestre.`
        : `−${d} = −10 +${k}, et le +${k} se fait par le petit ami (+5 −${5 - k}) : 1) sur la tige de gauche, l'index retire 1 ; 2) l'index abaisse la céleste ; 3) l'index descend ${terr(5 - k)}.`;
    default:
      return op === '+'
        ? 'La retenue tombe sur un 9 : ce 9 devient 0 (on retire 9 : l\'index relève la céleste et descend 4 terrestres) et la retenue continue sur la tige suivante à gauche.'
        : 'L\'emprunt tombe sur un 0 : ce 0 devient 9 (on ajoute 9 : l\'index abaisse la céleste, le pouce monte 4 terrestres) et l\'emprunt continue sur la tige suivante à gauche.';
  }
}

/**
 * Exemple canonique d'un motif : { depart, op, n } le plus simple possible.
 * Sert aux démonstrations « Voir le geste ».
 */
export function exempleMotif(cle) {
  const { op, d, regle } = analyserMotif(cle);
  if (regle === 'cascade') return op === '+' ? { depart: 99, op, n: 1 } : { depart: 100, op, n: 1 };
  const regleDe = op === '+' ? regleAjout : regleRetrait;
  for (let c = 0; c <= 9; c++) {
    if (regleDe(etatDepuisChiffre(c), d) === regle) {
      // Pour un emprunt, il faut une dizaine à gauche.
      const depart = op === '-' && c < d ? 10 + c : c;
      return { depart, op, n: d };
    }
  }
  throw new Error(`Motif impossible : ${cle}`);
}
