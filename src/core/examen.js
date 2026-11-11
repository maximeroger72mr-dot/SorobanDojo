/**
 * Passage de kyū : l'examen du niveau où l'on se trouve, accessible EN PERMANENCE, pour
 * travailler sous la pression d'un vrai examen, sur ce que l'on a appris (et rien d'autre).
 * La séance du jour le rappelle une fois par semaine, sans échéance ; un échec est normal et ne coûte rien :
 * on retente quand on veut.
 *
 * Avant le 10e kyū officiel, des grades préparatoires (20e → 11e kyū), un par étape du parcours :
 * on peut ainsi passer un grade, même très modeste, dès les gestes directs. Chaque grade se
 * débloque quand ses leçons (et celles d'avant) sont validées.
 *
 * Format : 20 colonnes au moins, temps fixe (compte à rebours), seuil de 70 % comme aux examens
 * officiels. Chaque tentative compte : la réussite donne le grade, l'échec ne retire rien.
 * Au-delà du 11e kyū, l'examen de la semaine garde ce format avec tous les gestes appris
 * (3 chiffres, 7 lignes) ; les vrais kyū se passent en épreuve officielle (page Grades).
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { genererColonneVariee, creerMemoire } from './generateur.js';
import { famille } from './motifs.js';
import { motifsAppris, estValide, grade, chiffresAppris } from './parcours.js';
import { SOUS_PALIERS, genererExercice } from './curriculum.js';
import { verdictAllure } from './allure.js';
import { cpm } from './maitrise.js';
import { semaineISO } from './hasard.js';

export const COLONNES = 20;
export const SEUIL = 0.7;

/** Grades préparatoires : leçons à valider, et format des colonnes de l'examen. */
export const PREKYU = [
  { id: '20', nom: '20e kyū prép.', lecons: ['p1-1', 'p1-2', 'p1-3'], chiffres: 1, lignes: 4, theme: 'gestes directs, 1 chiffre' },
  { id: '19', nom: '19e kyū prép.', lecons: ['p1-4'], chiffres: 2, lignes: 4, theme: 'gestes directs, 2 chiffres' },
  { id: '18', nom: '18e kyū prép.', lecons: ['p2-1', 'p2-2', 'p2-3'], chiffres: 2, lignes: 5, theme: 'petits amis en addition' },
  { id: '17', nom: '17e kyū prép.', lecons: ['p2-4', 'p2-5', 'p2-6', 'p2-7'], chiffres: 2, lignes: 5, theme: 'tous les petits amis' },
  { id: '16', nom: '16e kyū prép.', lecons: ['p3-1', 'p3-2', 'p3-3'], chiffres: 1, lignes: 5, theme: 'grands amis en addition, 1 chiffre' },
  { id: '15', nom: '15e kyū prép.', lecons: ['p3-4'], chiffres: 2, lignes: 5, theme: 'grands amis en addition, 2 chiffres' },
  { id: '14', nom: '14e kyū prép.', lecons: ['p4-1', 'p4-2', 'p4-3', 'p4-4'], chiffres: 2, lignes: 5, theme: 'grands amis en soustraction' },
  { id: '13', nom: '13e kyū prép.', lecons: ['p4-5'], chiffres: 3, lignes: 5, theme: 'tous les grands amis, 3 chiffres' },
  { id: '12', nom: '12e kyū prép.', lecons: ['p5-1', 'p5-2', 'p5-3'], chiffres: 2, lignes: 6, theme: 'combinaisons' },
  { id: '11', nom: '11e kyū prép.', lecons: ['p5-4', 'p5-5'], chiffres: 3, lignes: 6, theme: 'cascades et révision générale' },
];
const APRES = { id: 'hebdo', nom: 'Examen de la semaine', chiffres: 3, lignes: 7, theme: 'tous les gestes appris' };

/** Dernière leçon validée d'un type (multiplication ou division sur le soroban, nombres entiers). */
const derniereValidee = (d, type) => SOUS_PALIERS.filter((sp) => sp.type === type && !sp.mental && estValide(d, sp.id)).at(-1) ?? null;

/**
 * Format de l'examen de la semaine, ADAPTÉ AU NIVEAU une fois les grades préparatoires passés :
 * des colonnes au nombre de chiffres des leçons validées (3 à 6), et, dès que ces leçons sont
 * validées, des multiplications et des divisions du type de la dernière leçon acquise.
 */
export function formatHebdo(d) {
  const mul = derniereValidee(d, 'mul');
  const div = derniereValidee(d, 'div');
  const chiffres = Math.min(6, Math.max(3, chiffresAppris(d)));
  const operations = (mul ? 5 : 0) + (div ? 5 : 0);
  const parties = ['tous les gestes appris', mul && 'multiplications', div && 'divisions'].filter(Boolean);
  return { ...APRES, chiffres, lignes: chiffres >= 5 ? 10 : 7, colonnes: COLONNES - operations, mul, div, theme: `${chiffres} chiffres, ${parties.join(', ')}` };
}

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
  if (dernier === PREKYU.at(-1) && prekyuObtenu(d, dernier)) return formatHebdo(d);
  return dernier;
}

/** Temps fixe : 2,5 s par chiffre + 3 s de lecture et d'écriture par colonne, arrondi à la minute. */
export function minutesExamen(g) {
  // × et ÷ : 5 s par produit de table (m × n produits), plus la lecture et l'écriture.
  const produits = (sp) => (sp ? 5 * ((sp.m ?? sp.nd ?? 2) * (sp.n ?? sp.nq ?? 1) * 5 + 3) : 0);
  const s = (g.colonnes ?? COLONNES) * (g.chiffres * g.lignes * 2.5 + 3) + produits(g.mul) + produits(g.div);
  return Math.max(3, Math.ceil(s / 60));
}

/** Les 20 colonnes de l'examen : uniquement les gestes appris, résultats tous différents. */
export function sujetExamen(d, g) {
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const memoire = creerMemoire(COLONNES);
  return Array.from({ length: g.colonnes ?? COLONNES }, () => genererColonneVariee({
    chiffres: g.chiffres, lignes: g.lignes, autorises: appris, cibles: amis.length ? amis : famille('direct'),
  }, memoire));
}

/** Sujet complet, par sections : colonnes, puis multiplications et divisions si le niveau y est. */
export function sectionsExamen(d, g) {
  const sections = [{ titre: g.mul || g.div ? 'Colonnes' : undefined, problemes: sujetExamen(d, g) }];
  if (g.mul) sections.push({ titre: 'Multiplications', problemes: Array.from({ length: 5 }, () => genererExercice(g.mul)) });
  if (g.div) sections.push({ titre: 'Divisions', problemes: Array.from({ length: 5 }, () => genererExercice(g.div)) });
  return sections;
}

/** Clé et meilleur résultat des passages de cette semaine (pour le rendez-vous hebdomadaire du prof). */
export const cleSemaine = (date) => `kyu-semaine-${semaineISO(date).cle}`;
export const resultatSemaine = (d, date) => d.records[cleSemaine(date)] ?? null;

/** Jours restants avant la fin de la semaine (dimanche compris). */
export function joursRestants(date) {
  const j = new Date(`${date}T12:00`).getDay(); // 0 = dimanche
  return j === 0 ? 1 : 8 - j;
}

/**
 * Libellé du grade, avec les DEUX échelles : le grade d'entraînement (préparatoire, gagné au kyū
 * de la semaine) et le prochain grade officiel. Utilisé par la séance et par Progression.
 * @returns {{ valeur: string, detail: string }}
 */
export function libelleGrade(d) {
  const g = grade(d);
  const prep = meilleurPrekyu(d);
  const valeur = g.obtenu ? `${g.obtenu.nom} (${g.obtenu.japonais})` : prep ? prep.nom : 'aucun pour l\'instant';
  let officiel;
  if (!g.prochain) officiel = 'Tous les kyū officiels sont obtenus.';
  else if (g.pret) {
    // Les leçons sont validées à 70 % de la cadence ; l'épreuve, elle, demande la cadence entière.
    const v = verdictAllure(g.prochain, d);
    const lent = v.colonnes.ok === false || v.muldiv.ok === false;
    officiel = lent
      ? `Prochain grade officiel : ${g.prochain.nom}. Les leçons sont validées ; il reste à tenir l'allure de l'épreuve (${cpm(v.colonnes.besoin)} CPM en colonnes) avant de la tenter.`
      : `Prochain grade officiel : ${g.prochain.nom}, vous pouvez tenter l'épreuve.`;
  }
  else officiel = `Prochain grade officiel : ${g.prochain.nom}, ${g.manquantes.length} leçon${g.manquantes.length > 1 ? 's' : ''} à valider.`;
  return { valeur, detail: officiel };
}
