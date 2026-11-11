/**
 * Épreuves au format des examens de soroban (珠算能力検定), du 10e au 1er kyū.
 * Référentiel : Chambre de commerce et d'industrie du Japon (1er au 3e kyū) et Ligue japonaise
 * du soroban, 日本珠算連盟 (4e au 10e kyū).
 *
 *  - 1er au 6e kyū : 10 mitorizan, 20 multiplications, 20 divisions, 30 minutes pour le tout,
 *    300 points ; réussite à 240 (1er au 3e) ou 210 (4e au 6e).
 *  - Mitorizan : 10 lignes de longueur FIXE (10, 8, 6, 5, 4, 3 chiffres du 1er au 6e kyū) ;
 *    6 problèmes d'addition pure, puis 4 qui mêlent additions et soustractions.
 *    Aux 1er et 2e kyū, un problème de la seconde moitié a un résultat négatif.
 *  - Multiplication : « chiffres des deux facteurs au total » ; division : « chiffres du diviseur
 *    et du quotient au total ».
 *  - 1er au 3e kyū : la première moitié des × et des ÷ s'arrondit au millième (nombres sans
 *    unité), la seconde à l'unité (montants) ; tous les problèmes sont arrondis.
 *  - `formes` : découpage imposé des chiffres ([facteur, facteur] ou [diviseur, quotient]) :
 *    2 × 1 aux 10e et 9e kyū, 3 × 1 et ÷ 1 chiffre au 8e, 2 × 2 au 7e, 3 × 2 ou 2 × 3 et 2 ÷ 2 au 6e.
 *  - 10e au 7e kyū : 20 minutes, 200 points ; réussite à 60 points au 10e kyū, 120 ensuite.
 *    Le 10e kyū n'a que des additions, les 10e et 9e n'ont pas de division.
 *  - `milliers` (1er au 3e kyū) : à l'examen, une réponse sans séparateurs de milliers est
 *    comptée fausse. L'application ne l'exige qu'en « examen pur ».
 *
 * `verifie` : false tant que le format n'a pas été contrôlé sur la fiche officielle (l'écran
 * l'indique : « format indicatif »). Les valeurs du 1er au 5e kyū viennent de sources recoupées,
 * pas des fiches elles-mêmes ; voir SPECS.md, annexe B.
 */

import { entier } from './aleatoire.js';
import { facteur, facteurNet, genererMultiplicationDecimale, genererDivisionDecimale } from './multiplication.js';

/**
 * mitori : { nb, lignes, min, max (chiffres par ligne), soustractions, points, negatifs? [min, max] }
 * mul    : { nb, total, points, decimales? }  div : { nb, total, points, decimales? }
 * decimales : rang d'arrondi de la PREMIÈRE moitié ; la seconde s'arrondit à l'unité.
 */
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.3, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 5, min: 2, max: 2, soustractions: true, pures: 10, points: 10 },
    mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 5, min: 2, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 8, min: 2, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 10, total: 4, formes: [[3, 1]], points: 5 }, div: { nb: 10, total: 3, formes: [[1, 2]], points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 2, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 10, total: 4, formes: [[2, 2]], points: 5 }, div: { nb: 10, total: 4, formes: [[1, 3]], points: 5 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 3, max: 3, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 5, formes: [[3, 2], [2, 3]], points: 5 }, div: { nb: 20, total: 4, formes: [[2, 2]], points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 4, max: 4, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 5, max: 5, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 6, max: 6, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 7, points: 5, decimales: 3 }, div: { nb: 20, total: 6, points: 5, decimales: 3 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 8, max: 8, soustractions: true, pures: 6, points: 10, negatifs: [1, 1] },
    mul: { nb: 20, total: 9, points: 5, decimales: 3 }, div: { nb: 20, total: 8, points: 5, decimales: 3 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 10, max: 10, soustractions: true, pures: 6, points: 10, negatifs: [1, 1] },
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
function decouper(total, court = total >= 4 ? 2 : 1) {
  // Jamais un opérande à 1 chiffre dès 4 chiffres au total (pas de 4 × 1 au 6e kyū), sauf
  // demande contraire (`court: 1`, épreuves d'anzan).
  const n = entier(Math.max(court, Math.floor(total / 2) - 1), Math.floor(total / 2));
  return [total - n, n];
}

/**
 * Rang d'arrondi d'un problème de × ou ÷ : null (entier exact), le rang du grade (millième) dans
 * la première moitié, 0 (unité, montants) dans la seconde. Du 3e au 1er kyū, TOUS les problèmes sont arrondis.
 */
export function arrondiDuProbleme(f, i) {
  if (f.decimales == null) return null;
  return i < f.nb / 2 ? f.decimales : 0;
}

export function genererMulGrade(f, arrondi = null) {
  const [m, n] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : decouper(f.total, f.court);
  if (arrondi !== null) return genererMultiplicationDecimale(m, n, arrondi);
  const a = facteurNet(m);
  const b = facteurNet(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f, arrondi = null) {
  const [x, y] = decouper(f.total, f.court);
  // diviseur et quotient : forme imposée par le grade, sinon l'un ou l'autre sens
  let [nd, nq] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : Math.random() < 0.5 ? [x, y] : [y, x];
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
  // Les `pures` premiers problèmes sont des additions seules, les suivants mêlent + et −.
  const pures = f.pures ?? 0;
  const liste = Array.from({ length: f.nb }, (_, i) => genererMitori(i < pures ? { ...f, soustractions: false } : f));
  const [min, max] = f.negatifs ?? [0, 0];
  const nombre = entier(min, max);
  // Dans la seconde moitié, et jamais parmi les additions pures.
  for (let k = 0; k < nombre; k++) liste[entier(Math.max(Math.ceil(f.nb / 2), pures), f.nb - 1)] = genererMitoriNegatif(f);
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
