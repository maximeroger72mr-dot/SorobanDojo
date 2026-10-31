/**
 * Multiplication et division selon la méthode japonaise standard actuelle.
 *
 * MULTIPLICATION : 両落とし (ryō-otoshi), « les deux tombent ».
 *   On ne pose ni le multiplicande ni le multiplicateur : on les lit sur la feuille,
 *   et on ne pose sur le soroban que les produits partiels, au fur et à mesure.
 *   - Ordre : chiffre de gauche du multiplicande × chaque chiffre du multiplicateur (de gauche
 *     à droite), puis chiffre suivant du multiplicande, etc.
 *   - Chaque produit de table s'écrit sur DEUX tiges (dizaine, unité) : 2 × 3 = « 06 ».
 *   - Position (定位) : si les deux nombres ont m + n chiffres au total, la dizaine du premier
 *     produit se pose sur la (m+n)-ième tige en comptant la tige des unités comme la 1re.
 *     Chaque produit suivant se décale d'une tige vers la droite (par rapport au chiffre traité).
 *
 * DIVISION : 片落とし (kata-otoshi) avec la méthode du quotient (商除法).
 *   On pose seulement le dividende ; le diviseur se lit sur la feuille.
 *   - Pour chaque chiffre du quotient, on compare le début du dividende (restant) au diviseur :
 *     plus grand ou égal → le chiffre du quotient se pose DEUX tiges à gauche (une tige libre) ;
 *     plus petit → il se pose JUSTE à gauche.
 *   - Puis on soustrait les produits (chiffre du quotient × chaque chiffre du diviseur), chacun sur
 *     deux tiges, en commençant juste à droite du chiffre du quotient et en décalant d'une tige.
 *   - Position (定位) : l'unité du quotient est (chiffres du diviseur + 1) tiges à gauche de
 *     l'unité du dividende.
 *
 * Les « étapes macro » produites ici ({ texte, op, valeur }) sont rejouées par le lecteur de
 * démonstration, qui les décompose lui-même en gestes (petits amis, grands amis…).
 */

import { entier } from './aleatoire.js';
import { nomRang } from './gestes.js';

const chiffresDe = (n) => String(n).split('').map(Number);
const nbChiffres = (n) => String(n).length;

/** Nombre aléatoire de `k` chiffres, sans 0 en tête, et sans 1 seul (trop trivial) si k = 1. */
export function facteur(k) {
  if (k === 1) return entier(2, 9);
  return entier(10 ** (k - 1), 10 ** k - 1);
}

// ------------------------------------------------------------------ génération

/** Multiplication : a (m chiffres) × b (n chiffres). */
export function genererMultiplication(m, n) {
  const a = facteur(m);
  const b = facteur(n);
  return { type: 'mul', a, b, resultat: a * b };
}

/** Division exacte : diviseur de `nd` chiffres, quotient de `nq` chiffres. */
export function genererDivision(nd, nq) {
  const diviseur = facteur(nd);
  const quotient = facteur(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

// ------------------------------------------------------------------ étapes de démonstration

const nomsTiges = (r1, r2) => `${nomRang(r1)} et ${nomRang(r2)}`;
const deuxChiffres = (p) => String(p).padStart(2, '0');

/**
 * Étapes de la multiplication a × b (両落とし).
 * @returns {{ nbTiges, depart: 0, macros: Array<{texte, op, valeur}>, lecture: string }}
 */
export function etapesMultiplication(a, b) {
  const ca = chiffresDe(a);
  const cb = chiffresDe(b);
  const total = ca.length + cb.length;
  const macros = [{
    texte: `${a} × ${b} : ${ca.length} + ${cb.length} = ${total} chiffres au total. Le premier produit se pose avec sa dizaine sur la ${total}e tige en partant des unités (les ${nomRang(total - 1)}).`,
    op: '+', valeur: 0,
  }];
  ca.forEach((x, i) => {
    cb.forEach((y, j) => {
      const p = x * y;
      const rangDizaine = total - 1 - i - j;
      macros.push({
        texte: `${x} × ${y} = ${deuxChiffres(p)} : on ajoute « ${deuxChiffres(p)} » sur les tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}${p < 10 ? ' (la dizaine est vide : seul le ' + p + ' se pose, sur la tige de droite)' : ''}.`,
        op: '+',
        valeur: p * 10 ** (rangDizaine - 1),
      });
    });
  });
  return { nbTiges: total + 2, depart: 0, macros, lecture: `Résultat : ${a * b}, lu à partir de la tige des unités.`, resultat: a * b };
}

/**
 * Étapes de la division a ÷ b (片落とし, 商除法). Division exacte attendue.
 * @returns {{ nbTiges, depart, macros, rangUniteQuotient, lecture }}
 */
export function etapesDivision(a, b) {
  const q = Math.floor(a / b);
  const nd = nbChiffres(b);
  // L'unité du dividende est posée sur la tige des unités : les noms de tiges (unités, dizaines…)
  // se lisent alors par rapport au dividende, et le quotient se pose à sa gauche.
  const decalage = 0;
  const rangUniteQ = decalage + nd + 1;
  const cq = chiffresDe(q);
  const cb = chiffresDe(b);
  let reste = a * 10 ** decalage; // valeur de la partie « dividende » sur le soroban
  const macros = [];
  macros.push({
    texte: `On pose le dividende ${a}. Le diviseur ${b} n'est pas posé (片落とし). L'unité du quotient sera ${nd} + 1 = ${nd + 1} tiges à gauche de l'unité du dividende.`,
    op: '+', valeur: 0,
  });
  cq.forEach((chiffre, i) => {
    const r = rangUniteQ + cq.length - 1 - i; // rang du chiffre de quotient
    // Tête du reste actuel, pour expliquer la règle « deux tiges / juste à gauche ».
    const tete = reste > 0 ? nbChiffres(reste) - 1 : -1;
    if (chiffre === 0) {
      macros.push({ texte: `Le reste est plus petit que ${b} à cet endroit : le chiffre du quotient est 0, la tige reste vide.`, op: '+', valeur: 0 });
      return;
    }
    const regle = r === tete + 2
      ? `le début du reste est plus grand ou égal à ${b} : le chiffre se pose deux tiges à gauche (une tige libre entre les deux)`
      : `le début du reste est plus petit que ${b} : le chiffre se pose juste à gauche`;
    macros.push({ texte: `Chiffre du quotient : ${chiffre}, sur la tige des ${nomRang(r)}. Règle : ${regle}.`, op: '+', valeur: chiffre * 10 ** r });
    cb.forEach((y, j) => {
      const p = chiffre * y;
      const rangDizaine = r - 1 - j;
      macros.push({
        texte: `${chiffre} × ${y} = ${deuxChiffres(p)} : on retire « ${deuxChiffres(p)} » des tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}.`,
        op: '-', valeur: p * 10 ** (rangDizaine - 1),
      });
      reste -= p * 10 ** (rangDizaine - 1);
    });
  });
  return {
    nbTiges: rangUniteQ + cq.length + 1,
    depart: a * 10 ** decalage,
    macros,
    rangUniteQuotient: rangUniteQ,
    lecture: `Quotient : ${q}, lu à gauche du reste (qui vaut 0). Son unité est sur la tige des ${nomRang(rangUniteQ)}, ${nd + 1} tiges à gauche de l'unité du dividende.`,
    resultat: q,
  };
}

/** Valeur finale du soroban après les étapes (pour les tests). */
export function appliquerMacros(depart, macros) {
  return macros.reduce((v, m) => (m.op === '+' ? v + m.valeur : v - m.valeur), depart);
}
