/**
 * Épreuves au format des examens de soroban (珠算検定), du 10e au 1er kyū.
 *
 * Formats retenus avec l'utilisateur :
 *  - 6e au 1er kyū : tableau fourni par l'utilisateur — mitorizan 10 lignes de N à M chiffres,
 *    multiplication « chiffres des deux facteurs au total », division « chiffres du diviseur et
 *    du quotient au total », seuil 210/300 (6e-4e) ou 240/300 (3e-1er) ;
 *  - décimaux à partir du 3e kyū : la moitié des multiplications et des divisions, résultat
 *    arrondi au millième (au dix-millième pour les divisions du 1er kyū) ;
 *  - 10e au 7e kyū : inspirés des formats publics japonais (Nihon Shuzan Renmei), seuil indicatif
 *    70 % ; chaque grade est STRICTEMENT plus exigeant que le précédent (un test le vérifie) :
 *    10e : mitori 5 lignes + × (2×1) ; 9e : 6 lignes + × + ÷ (÷1, quotient 1 chiffre) ;
 *    8e : 8 lignes, × à 4 chiffres, ÷ à 3 ; 7e : 10 lignes, ÷ à 4 chiffres ;
 *  - soustractions dans le mitorizan dès le 10e kyū.
 * Les séparateurs de milliers sont acceptés dans les réponses, jamais exigés.
 */

import { entier } from './aleatoire.js';
import { facteur, genererMultiplicationDecimale, genererDivisionDecimale } from './multiplication.js';

/**
 * mitori : { nb, lignes, min, max (chiffres par ligne), soustractions, points }
 * mul    : { nb, total, points, decimales? }  div : { nb, total, points, decimales? }
 */
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 5, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 10 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 6, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 5 }, div: { nb: 10, total: 2, points: 5 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 8, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 3, points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 10, min: 2, max: 2, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 4, points: 5, maxDiviseur: 2 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 3, max: 4, soustractions: true, points: 10 },
    mul: { nb: 20, total: 5, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 4, max: 5, soustractions: true, points: 10 },
    mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 5, max: 6, soustractions: true, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 7, points: 5 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 6, max: 7, soustractions: true, points: 10 },
    mul: { nb: 20, total: 8, points: 5, decimales: 3 }, div: { nb: 20, total: 8, points: 5, decimales: 3 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 7, max: 8, soustractions: true, points: 10 },
    mul: { nb: 20, total: 9, points: 5, decimales: 3 }, div: { nb: 20, total: 9, points: 5, decimales: 3 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true,
    mitori: { nb: 10, lignes: 10, min: 8, max: 10, soustractions: true, points: 10 },
    mul: { nb: 20, total: 11, points: 5, decimales: 3 }, div: { nb: 20, total: 10, points: 5, decimales: 4 } },
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

/** Découpe « N chiffres au total » en (m, n), le premier étant le plus long ou égal. */
function decouper(total) {
  const n = entier(Math.max(1, Math.floor(total / 2) - 1), Math.floor(total / 2));
  return [total - n, n];
}

export function genererMulGrade(f, decimal = false) {
  const [m, n] = decouper(f.total);
  if (decimal) return genererMultiplicationDecimale(m, n, f.decimales);
  const a = facteur(m);
  const b = facteur(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f, decimal = false) {
  const [x, y] = decouper(f.total);
  let [nd, nq] = Math.random() < 0.5 ? [x, y] : [y, x]; // diviseur et quotient
  // Pas de diviseur plus long que ce qui a été appris pour ce grade (ex. 7e kyū : 2 chiffres).
  if (f.maxDiviseur && nd > f.maxDiviseur) [nd, nq] = [nq, nd];
  if (decimal) return genererDivisionDecimale(Math.min(nd, 4), nq, f.decimales);
  const diviseur = facteur(nd);
  const quotient = facteur(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

/** Sujet complet : la seconde moitié des × et ÷ est en décimaux quand le grade en comporte. */
export function genererSujet(grade) {
  const sections = [];
  const moitie = (f, gen) => Array.from({ length: f.nb }, (_, i) => gen(f, !!f.decimales && i >= f.nb / 2));
  if (grade.mitori) sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算) : additions et soustractions', points: grade.mitori.points, problemes: Array.from({ length: grade.mitori.nb }, () => genererMitori(grade.mitori)) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, problemes: moitie(grade.mul, genererMulGrade) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, problemes: moitie(grade.div, genererDivGrade) });
  return { grade, sections };
}
