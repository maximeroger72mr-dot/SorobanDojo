/**
 * Test de positionnement, pour qui a déjà pratiqué (« revenants »).
 * On demande d'abord « Que savez-vous faire ? » : le test COMMENCE au niveau déclaré (inutile de
 * refaire les gestes directs quand on sait multiplier). 8 exercices par palier, 7 justes pour
 * réussir. Réussi : ce palier et tous ceux d'en dessous sont validés, et l'on peut tenter le
 * suivant. Raté : on redescend d'un palier, jusqu'au premier réussi.
 * Les leçons sont validées « par le test », avec une première révision à J+3 qui confirme ou
 * rouvre la leçon. Les vitesses ne sont pas validées : elles se mesurent ensuite normalement
 * (sinon les CPM seraient faussés).
 */

import { SOUS_PALIERS, sousPalier, genererExercice } from './curriculum.js';

export const COLONNES_PALIER = 8;
export const MIN_PALIER = 7;

const lecons = (...paliers) => SOUS_PALIERS.filter((sp) => paliers.includes(sp.palier.id)).map((sp) => sp.id);

/** Les paliers : exercices tirés d'une leçon représentative, leçons validées si réussi. */
export const PALIERS_TEST = [
  { id: 'directs', titre: 'Gestes directs', modele: 'p1-4', lecons: [...lecons('p0'), ...lecons('p1')] },
  { id: 'petits', titre: 'Petits amis', modele: 'p2-7', lecons: lecons('p2') },
  { id: 'grands', titre: 'Grands amis', modele: 'p4-5', lecons: [...lecons('p3'), ...lecons('p4')] },
  { id: 'combinaisons', titre: 'Combinaisons et cascades', modele: 'p5-5', lecons: lecons('p5') },
  { id: 'multiplication', titre: 'Multiplication', modele: 'p6-4', lecons: lecons('p6') },
  { id: 'division', titre: 'Division', modele: 'p7-4', lecons: lecons('p7') },
];

/** Une colonne du palier (gestes de la leçon modèle et tout ce qui la précède). */
export const colonneTest = (palier) => genererExercice(sousPalier(palier.modele));

/** Leçons à valider après les paliers réussis (dans l'ordre). */
export const leconsReussies = (reussis) => PALIERS_TEST.slice(0, reussis).flatMap((p) => p.lecons);

/**
 * La suite du test après un palier : on monte tant qu'on réussit, on redescend tant qu'on rate.
 * @param {number} k        palier qui vient d'être passé
 * @param {boolean} reussi
 * @param {{ rate: number|null }} etat  plus bas palier raté jusqu'ici (null : aucun)
 * @returns {{ suivant: number|null, valides: number }}  palier à tenter ensuite (null : fini),
 *   et nombre de paliers validés (0 à k + 1)
 */
export function suiteTest(k, reussi, etat = { rate: null }) {
  if (reussi) {
    const haut = k + 1;
    const fini = haut >= PALIERS_TEST.length || etat.rate === haut;
    return { suivant: fini ? null : haut, valides: k + 1 };
  }
  return { suivant: k > 0 ? k - 1 : null, valides: 0 };
}
