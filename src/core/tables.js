/**
 * Tables de multiplication (九九) : drills de vitesse.
 *
 *  - « 81 produits » : tous les produits de 1 × 1 à 9 × 9, dans le désordre, une seule fois chacun ;
 *  - « mes plus lents » : tirage pondéré par la lenteur et les erreurs de chaque produit ;
 *  - « table de N » : N × 1 à N × 9 dans le désordre (N peut être un diviseur à 2 chiffres, 12 à 19,
 *    utile pour la division).
 * Les produits sont notés dans la progression (temps et erreurs), pour cibler les plus lents.
 */

import { entier } from './aleatoire.js';

const melanger = (t) => {
  const r = [...t];
  for (let i = r.length - 1; i > 0; i--) {
    const j = entier(0, i);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export const cleProduit = (a, b) => `${Math.min(a, b)}x${Math.max(a, b)}`;
const exercice = (a, b) => ({ type: 'mul', a, b, resultat: a * b, table: true });

/** Les 81 produits dans le désordre. */
export function serie81() {
  const t = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) t.push(exercice(a, b));
  return melanger(t);
}

/**
 * Plusieurs tables mélangées (ex. 7, 8 et 9) : chaque produit une fois, dans le désordre.
 * Mélanger oblige à retrouver le produit sans savoir d'avance dans quelle table on est.
 */
export function serieTables(liste) {
  const vus = new Set();
  const t = [];
  for (const n of liste) {
    for (let i = 1; i <= 9; i++) {
      const cle = cleProduit(n, i);
      if (n < 10 && vus.has(cle)) continue; // 7 × 8 et 8 × 7 : une seule fois
      vus.add(cle);
      t.push(Math.random() < 0.5 ? exercice(n, i) : exercice(i, n));
    }
  }
  return melanger(t);
}

/** Table d'un nombre (N × 1 à N × 9) dans le désordre. */
export function serieTable(n) {
  return melanger(Array.from({ length: 9 }, (_, i) => (Math.random() < 0.5 ? exercice(n, i + 1) : exercice(i + 1, n))));
}

/** Seuil du diagnostic : un produit plus lent que 2,5 s (ou raté récemment) est à retravailler. */
export const SEUIL_PRODUIT_S = 2.5;
const etatProduit = (stats, a, b) => {
  const recents = (stats[cleProduit(a, b)]?.hist ?? []).slice(-6);
  const temps = recents.filter((x) => x.ok).map((x) => x.t).sort((x, y) => x - y);
  return { vu: recents.length > 0, mediane: temps.length ? temps[Math.floor(temps.length / 2)] : null, erreurs: recents.slice(-3).filter((x) => !x.ok).length };
};

/**
 * Produits à retravailler (diagnostic des 81) : faux récemment ou plus lents que 2,5 s. Ils
 * restent dans « Mes produits les plus lents » jusqu'à repasser sous 2,5 s, sans erreur.
 */
export function produitsARetravailler(stats) {
  const r = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const e = etatProduit(stats, a, b);
      if (e.vu && (e.erreurs > 0 || e.mediane === null || e.mediane > SEUIL_PRODUIT_S)) r.push(cleProduit(a, b));
    }
  }
  return r;
}

/** Le diagnostic des 81 produits est-il fait (tous les produits vus au moins une fois) ? */
export function diagnosticTablesFait(stats) {
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) if (!etatProduit(stats, a, b).vu) return false;
  return true;
}

/**
 * Produits les plus lents ou les plus ratés : poids = temps médian récent (2 s par défaut) ×
 * (1 + erreurs récentes). Évite de reposer le même produit deux fois de suite.
 */
export function produitLent(stats, precedent) {
  const candidats = [];
  // Après le diagnostic : seulement les produits à retravailler, tant qu'il y en a au moins 3.
  const cibles = new Set(produitsARetravailler(stats));
  const filtrer = cibles.size >= 3;
  for (let a = filtrer ? 1 : 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      if (filtrer && !cibles.has(cleProduit(a, b))) continue;
      const h = stats[cleProduit(a, b)]?.hist ?? [];
      const recents = h.slice(-6);
      const temps = recents.filter((x) => x.ok).map((x) => x.t).sort((x, y) => x - y);
      const mediane = temps.length ? temps[Math.floor(temps.length / 2)] : 2;
      const erreurs = recents.filter((x) => !x.ok).length;
      candidats.push({ a, b, poids: mediane * (1 + erreurs) ** 2 });
    }
  }
  for (;;) {
    const total = candidats.reduce((s, c) => s + c.poids, 0);
    let x = Math.random() * total;
    const c = candidats.find((k) => (x -= k.poids) < 0) ?? candidats.at(-1);
    if (cleProduit(c.a, c.b) === precedent && candidats.length > 1) continue;
    return Math.random() < 0.5 ? exercice(c.a, c.b) : exercice(c.b, c.a);
  }
}
