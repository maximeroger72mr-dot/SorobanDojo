/**
 * Épreuves au format des examens officiels japonais de soroban (珠算検定).
 *
 * Sources (vérifiées le 31/10/2026, informations publiques) : Nihon Shuzan Renmei (日本珠算連盟)
 * pour les 4e à 10e kyū, Chambre de commerce et d'industrie du Japon (日本商工会議所) avec le
 * Nihon Shuzan Renmei pour les 1er à 3e kyū.
 *
 *  - 見取算 mitorizan : additions et soustractions en colonne (dès le 10e kyū), « 10 lignes
 *    N chiffres » (10口N字) : 10 nombres totalisant N chiffres ;
 *  - 乗算 multiplication : « multiplicande et multiplicateur ensemble N chiffres » (実法合わせてNけた) ;
 *  - 除算 division : « diviseur et quotient ensemble N chiffres » (法商合わせてNけた).
 *
 * Limites connues (affichées dans l'application) :
 *  - aux 1er-3e kyū, l'examen réel comporte des nombres décimaux et des arrondis (端数処理) ;
 *    cette version les pose en nombres entiers ;
 *  - les seuils de réussite des 4e-10e kyū sont indicatifs (70 %), à confirmer auprès de la fédération.
 */

import { entier } from './aleatoire.js';
import { facteur } from './multiplication.js';

/**
 * Formats par grade.
 * mitori : { nb, lignes, chiffres (total), egal: lignes de même longueur ?, soustractions, points }
 * mul    : { nb, total (chiffres a+b), points } ; div : { nb, total (diviseur + quotient), points }
 */
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 5, chiffres: 10, egal: true, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 10 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 5, chiffres: 10, egal: true, soustractions: true, points: 10 },
    mul: { nb: 10, total: 3, points: 10 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 8, chiffres: 16, egal: true, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 3, points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 10, chiffres: 20, egal: true, soustractions: true, points: 10 },
    mul: { nb: 10, total: 4, points: 5 }, div: { nb: 10, total: 4, points: 5 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 10, chiffres: 30, egal: true, soustractions: true, points: 10 },
    mul: { nb: 20, total: 5, points: 5 }, div: { nb: 20, total: 4, points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 10, chiffres: 40, egal: true, soustractions: true, points: 10 },
    mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: false,
    mitori: { nb: 10, lignes: 10, chiffres: 50, egal: false, soustractions: true, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true, entiers: true,
    mitori: { nb: 10, lignes: 10, chiffres: 60, egal: false, soustractions: true, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true, entiers: true,
    mitori: { nb: 10, lignes: 10, chiffres: 80, egal: false, soustractions: true, points: 10 },
    mul: { nb: 20, total: 9, points: 5 }, div: { nb: 20, total: 8, points: 5 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true, entiers: true,
    mitori: { nb: 10, lignes: 10, chiffres: 100, egal: false, soustractions: true, points: 10 },
    mul: { nb: 20, total: 11, points: 5 }, div: { nb: 20, total: 10, points: 5 } },
];

export const totalPoints = (g) => ['mitori', 'mul', 'div'].reduce((s, k) => s + (g[k] ? g[k].nb * g[k].points : 0), 0);

/** Répartit `total` chiffres sur `lignes` lignes, de longueurs variées (±2 autour de la moyenne). */
export function longueurs(lignes, total, egal) {
  const moyenne = total / lignes;
  if (egal) return Array(lignes).fill(Math.round(moyenne));
  const min = Math.max(1, Math.floor(moyenne) - 2);
  const max = Math.ceil(moyenne) + 2;
  for (;;) {
    const l = Array.from({ length: lignes - 1 }, () => entier(min, max));
    const dernier = total - l.reduce((a, b) => a + b, 0);
    if (dernier >= min && dernier <= max) return [...l, dernier];
  }
}

/**
 * Un problème de mitorizan. Avec soustractions : 1 ligne négative sur 5 lignes, 1 à 2 sur 8,
 * 2 à 3 sur 10 ; jamais en 1re ou 2e ligne, jamais de total partiel négatif.
 */
export function genererMitori(f) {
  for (;;) {
    const lg = longueurs(f.lignes, f.chiffres, f.egal);
    const lignes = lg.map((k) => ({ op: '+', n: facteur(k) }));
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
    if (ok) return { type: 'addsub', lignes, resultat: v };
  }
}

/** Découpe « N chiffres ensemble » en (m, n), le premier facteur étant le plus long ou égal. */
function decouper(total) {
  const n = entier(Math.max(1, Math.floor(total / 2) - 1), Math.floor(total / 2));
  return [total - n, n];
}

export function genererMulGrade(f) {
  const [m, n] = decouper(f.total);
  const a = facteur(m);
  const b = facteur(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f) {
  const [x, y] = decouper(f.total);
  const [nd, nq] = Math.random() < 0.5 ? [x, y] : [y, x]; // diviseur et quotient
  const diviseur = facteur(nd);
  const quotient = facteur(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

/** Sujet complet d'un grade : { grade, sections: [{ cle, titre, points, problemes }] }. */
export function genererSujet(grade) {
  const sections = [];
  if (grade.mitori) sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算) : additions en colonne', points: grade.mitori.points, problemes: Array.from({ length: grade.mitori.nb }, () => genererMitori(grade.mitori)) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, problemes: Array.from({ length: grade.mul.nb }, () => genererMulGrade(grade.mul)) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, problemes: Array.from({ length: grade.div.nb }, () => genererDivGrade(grade.div)) });
  return { grade, sections };
}
