/**
 * Kyū de la semaine : un petit examen chaque semaine, pour travailler SOUS PRESSION, sur ce que
 * l'on a appris (et rien d'autre).
 *
 * Avant le 10e kyū officiel, des grades préparatoires (20e → 11e kyū), un par étape du parcours :
 * on peut ainsi passer un grade, même très modeste, dès les gestes directs. Chaque grade se
 * débloque quand ses leçons (et celles d'avant) sont validées.
 *
 * Format : 20 colonnes au moins, temps fixe (compte à rebours), seuil de 70 % comme aux examens
 * officiels. Une seule tentative compte par semaine : c'est un examen, pas un entraînement.
 * Au-delà du 11e kyū, l'examen de la semaine garde ce format avec tous les gestes appris
 * (3 chiffres, 7 lignes) ; les vrais kyū se passent dans « Épreuves officielles ».
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { genererColonneVariee, creerMemoire } from './generateur.js';
import { famille } from './motifs.js';
import { motifsAppris, estValide } from './parcours.js';
import { semaineISO } from './hasard.js';

export const COLONNES = 20;
export const SEUIL = 0.7;

/** Grades préparatoires : leçons à valider, et format des colonnes de l'examen. */
export const PREKYU = [
  { id: '20', nom: '20e kyū', lecons: ['p1-1', 'p1-2', 'p1-3'], chiffres: 1, lignes: 4, theme: 'gestes directs, 1 chiffre' },
  { id: '19', nom: '19e kyū', lecons: ['p1-4'], chiffres: 2, lignes: 4, theme: 'gestes directs, 2 chiffres' },
  { id: '18', nom: '18e kyū', lecons: ['p2-1', 'p2-2', 'p2-3'], chiffres: 2, lignes: 5, theme: 'petits amis en addition' },
  { id: '17', nom: '17e kyū', lecons: ['p2-4', 'p2-5', 'p2-6', 'p2-7'], chiffres: 2, lignes: 5, theme: 'tous les petits amis' },
  { id: '16', nom: '16e kyū', lecons: ['p3-1', 'p3-2', 'p3-3'], chiffres: 1, lignes: 5, theme: 'grands amis en addition, 1 chiffre' },
  { id: '15', nom: '15e kyū', lecons: ['p3-4'], chiffres: 2, lignes: 5, theme: 'grands amis en addition, 2 chiffres' },
  { id: '14', nom: '14e kyū', lecons: ['p4-1', 'p4-2', 'p4-3', 'p4-4'], chiffres: 2, lignes: 5, theme: 'grands amis en soustraction' },
  { id: '13', nom: '13e kyū', lecons: ['p4-5'], chiffres: 3, lignes: 5, theme: 'tous les grands amis, 3 chiffres' },
  { id: '12', nom: '12e kyū', lecons: ['p5-1', 'p5-2', 'p5-3'], chiffres: 2, lignes: 6, theme: 'combinaisons' },
  { id: '11', nom: '11e kyū', lecons: ['p5-4', 'p5-5'], chiffres: 3, lignes: 6, theme: 'cascades et révision générale' },
];
const APRES = { id: 'hebdo', nom: 'Examen de la semaine', chiffres: 3, lignes: 7, theme: 'tous les gestes appris' };

/** Grade préparatoire accessible : ses leçons et celles des grades d'avant sont validées. */
export function prekyuAccessible(d, g) {
  const i = PREKYU.indexOf(g);
  return PREKYU.slice(0, i + 1).every((x) => x.lecons.every((id) => estValide(d, id)));
}
export const prekyuObtenu = (d, g) => !!d.records[`prekyu-${g.id}`]?.reussi;
/** Meilleur grade préparatoire obtenu (ou null). */
export const meilleurPrekyu = (d) => [...PREKYU].reverse().find((g) => prekyuObtenu(d, g)) ?? null;

/**
 * Examen de la semaine : le plus haut grade accessible (on est examiné sur tout ce qu'on sait).
 * Pas encore de grade accessible (gestes directs pas finis) : null.
 */
export function examenDeLaSemaine(d) {
  const accessibles = PREKYU.filter((g) => prekyuAccessible(d, g));
  if (!accessibles.length) return null;
  const dernier = accessibles.at(-1);
  // Tout le préparatoire est validé et obtenu : examen hebdomadaire au format avancé.
  if (dernier === PREKYU.at(-1) && prekyuObtenu(d, dernier)) return APRES;
  return dernier;
}

/** Temps fixe : 2,5 s par chiffre + 3 s de lecture et d'écriture par colonne, arrondi à la minute. */
export function minutesExamen(g) {
  const s = COLONNES * (g.chiffres * g.lignes * 2.5 + 3);
  return Math.max(3, Math.ceil(s / 60));
}

/** Les 20 colonnes de l'examen : uniquement les gestes appris, résultats tous différents. */
export function sujetExamen(d, g) {
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const memoire = creerMemoire(COLONNES);
  return Array.from({ length: COLONNES }, () => genererColonneVariee({
    chiffres: g.chiffres, lignes: g.lignes, autorises: appris, cibles: amis.length ? amis : famille('direct'),
  }, memoire));
}

/** Clé et résultat de l'examen de cette semaine (une seule tentative compte). */
export const cleSemaine = (date) => `kyu-semaine-${semaineISO(date).cle}`;
export const resultatSemaine = (d, date) => d.records[cleSemaine(date)] ?? null;

/** Jours restants avant la fin de la semaine (dimanche compris). */
export function joursRestants(date) {
  const j = new Date(`${date}T12:00`).getDay(); // 0 = dimanche
  return j === 0 ? 1 : 8 - j;
}
