/**
 * Épreuves au format des examens de soroban (珠算能力検定), du 10e au 1er kyū.
 * Référentiel : Chambre de commerce et d'industrie du Japon (1er au 3e kyū) et Ligue japonaise
 * du soroban, 日本珠算連盟 (4e au 10e kyū).
 *
 *  - 1er au 6e kyū : 10 mitorizan, 20 multiplications, 20 divisions, 30 minutes pour le tout,
 *    300 points ; réussite à 240 (1er au 3e) ou 210 (4e au 6e).
 *  - Mitorizan : 10 lignes de longueur FIXE (10, 8, 6, 5, 4, 3 chiffres du 1er au 6e kyū).
 *    Au 1er kyū, un problème de la seconde moitié a un résultat négatif ; au 2e, c'est possible.
 *  - Multiplication : « chiffres des deux facteurs au total » ; division : « chiffres du diviseur
 *    et du quotient au total ».
 *  - 1er au 3e kyū : la première moitié des × et des ÷ s'arrondit au millième (nombres sans
 *    unité), la seconde à l'unité (montants). La consigne est rappelée sur chaque problème arrondi.
 *  - 10e au 7e kyū : formats inspirés des fiches publiques, 20 minutes, seuil indicatif de 70 % ;
 *    chaque grade est strictement plus exigeant que le précédent (un test le vérifie).
 *
 * `verifie` : false tant que le format n'a pas été contrôlé sur la fiche officielle (l'écran
 * l'indique : « format indicatif »). Les valeurs du 1er au 5e kyū viennent de sources recoupées,
 * pas des fiches elles-mêmes ; voir SPECS.md, annexe B.
 * Les séparateurs de milliers sont acceptés dans les réponses, jamais exigés.
 */

import { entier } from './aleatoire.js';
import { facteur, facteurNet, genererMultiplicationDecimale, genererDivisionDecimale } from './multiplication.js';

/**
 * mitori : { nb, lignes, min, max (chiffres par ligne), soustractions, points, negatifs? [min, max] }
 * mul    : { nb, total, points, decimales? }  div : { nb, total, points, decimales? }
 * decimales : rang d'arrondi de la PREMIÈRE moitié ; la seconde s'arrondit à l'unité.
 */
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.7, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 5, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 10 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.7, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 6, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 5 }, div: { nb: 10, total: 2, points: 5 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.7, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 8, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 3, points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.7, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 4, points: 5, maxDiviseur: 2 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 3, max: 3, soustractions: true, points: 10 },
    mul: { nb: 20, total: 5, points: 5 }, div: { nb: 20, total: 4, points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 4, max: 4, soustractions: true, points: 10 },
    mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 5, max: 5, soustractions: true, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 6, max: 6, soustractions: true, points: 10 },
    mul: { nb: 20, total: 7, points: 5, decimales: 3 }, div: { nb: 20, total: 6, points: 5, decimales: 3 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 8, max: 8, soustractions: true, points: 10, negatifs: [0, 1] },
    mul: { nb: 20, total: 9, points: 5, decimales: 3 }, div: { nb: 20, total: 8, points: 5, decimales: 3 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 10, max: 10, soustractions: true, points: 10, negatifs: [1, 1] },
    mul: { nb: 20, total: 11, points: 5, decimales: 3 }, div: { nb: 20, total: 10, points: 5, decimales: 3 } },
];

export const totalPoints = (g) => ['mitori', 'mul', 'div'].reduce((s, k) => s + (g[k] ? g[k].nb * g[k].points : 0), 0);

/**
 * Un problème de mitorizan. Avec soustractions : 1 ligne négative sur 5 lignes, 1 à 2 sur 8,
 * 2 à 3 sur 10 ; jamais en 1re ou 2e ligne, jamais de total partiel négatif.
 */
export function genererMitori(f) {
  for (;;) {
    const lignes = Array.from({ length: f.lignes }, () => ({ op: '+', n: facteur(entier(f.min, f.max)) }));
    if (f.soustractions) {
      const nbMoins = f.lignes <= 5 ? 1 : f.lignes <= 8 ? entier(1, 2) : entier(2, 3);
      const indices = new Set();
      while (indices.size < nbMoins) indices.add(entier(2, f.lignes - 1));
      for (const i of indices) lignes[i].op = '-';
    }
    let v = 0;
    let ok = true;
    for (const l of lignes) {
      v += l.op === '+' ? l.n : -l.n;
      if (v < 0) ok = false;
    }
    // Pas deux fois le même nombre de suite (on le devinerait sans calculer).
    if (lignes.some((l, i) => i > 0 && l.n === lignes[i - 1].n)) ok = false;
    if (ok) return { type: 'addsub', lignes, resultat: v };
  }
}

/**
 * Mitorizan à résultat NÉGATIF (1er kyū, parfois 2e) : on emprunte un 1 imaginaire à gauche de
 * la colonne et on lit le complément. Le résultat reste au-dessus de −10^chiffres, et seul le
 * total final passe sous zéro... ou la colonne y est déjà : un seul emprunt imaginaire suffit.
 */
export function genererMitoriNegatif(f) {
  const k = 10 ** f.max;
  for (;;) {
    const lignes = Array.from({ length: f.lignes }, () => ({ op: '+', n: facteur(entier(f.min, f.max)) }));
    const indices = new Set();
    while (indices.size < Math.ceil(f.lignes / 2)) indices.add(entier(1, f.lignes - 1));
    for (const i of indices) lignes[i].op = '-';
    let v = 0;
    const sous = lignes.map((l) => (v += l.op === '+' ? l.n : -l.n));
    if (v >= 0 || sous.some((x) => x <= -k) || lignes.some((l, i) => i > 0 && l.n === lignes[i - 1].n)) continue;
    const c = k + v;
    return {
      type: 'addsub', negatif: true, lignes, resultat: v,
      astuce: `Le total passe sous zéro : on emprunte un 1 imaginaire de ${k.toLocaleString('fr-FR')}. Le soroban affiche ${c.toLocaleString('fr-FR')}, le complément : le résultat est −(${k.toLocaleString('fr-FR')} − ${c.toLocaleString('fr-FR')}) = ${v.toLocaleString('fr-FR')}.`,
    };
  }
}

/** Découpe « N chiffres au total » en (m, n), le premier étant le plus long ou égal. */
function decouper(total) {
  const n = entier(Math.max(1, Math.floor(total / 2) - 1), Math.floor(total / 2));
  return [total - n, n];
}

/**
 * Rang d'arrondi d'un problème de × ou ÷ : null (entier exact), le rang du grade (millième) dans
 * la première moitié, 0 (unité, montants) dans la seconde. Un problème sur deux est en décimaux.
 */
export function arrondiDuProbleme(f, i) {
  if (f.decimales == null || i % 2 === 0) return null;
  return i < f.nb / 2 ? f.decimales : 0;
}

export function genererMulGrade(f, arrondi = null) {
  const [m, n] = decouper(f.total);
  if (arrondi !== null) return genererMultiplicationDecimale(m, n, arrondi);
  const a = facteurNet(m);
  const b = facteurNet(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f, arrondi = null) {
  const [x, y] = decouper(f.total);
  let [nd, nq] = Math.random() < 0.5 ? [x, y] : [y, x]; // diviseur et quotient
  // Pas de diviseur plus long que ce qui a été appris pour ce grade (ex. 7e kyū : 2 chiffres).
  if (f.maxDiviseur && nd > f.maxDiviseur) [nd, nq] = [nq, nd];
  if (arrondi !== null) return genererDivisionDecimale(Math.min(nd, 4), nq, arrondi);
  const diviseur = facteurNet(nd);
  const quotient = facteurNet(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

/** Série de × ou de ÷ d'un sujet, sans deux problèmes identiques. */
function serie(f, gen) {
  const vus = new Set();
  const liste = [];
  for (let i = 0; i < f.nb; i++) {
    let p;
    for (let e = 0; e < 30; e++) {
      p = gen(f, arrondiDuProbleme(f, i));
      if (!vus.has(`${p.a}|${p.b}`)) break;
    }
    vus.add(`${p.a}|${p.b}`);
    liste.push(p);
  }
  return liste;
}

/** Les mitorizan d'un sujet : au 1er kyū, un résultat négatif dans la seconde moitié. */
function mitoris(f) {
  const liste = Array.from({ length: f.nb }, () => genererMitori(f));
  const [min, max] = f.negatifs ?? [0, 0];
  const nombre = entier(min, max);
  for (let k = 0; k < nombre; k++) liste[entier(Math.ceil(f.nb / 2), f.nb - 1)] = genererMitoriNegatif(f);
  return liste;
}

/** Sujet complet. */
export function genererSujet(grade) {
  const sections = [];
  if (grade.mitori) sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算) : additions et soustractions', points: grade.mitori.points, problemes: mitoris(grade.mitori) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, problemes: serie(grade.mul, genererMulGrade) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, problemes: serie(grade.div, genererDivGrade) });
  return { grade, sections };
}
