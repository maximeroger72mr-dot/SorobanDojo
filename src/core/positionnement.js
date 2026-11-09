/**
 * Test de positionnement, pour qui a déjà pratiqué (« revenants ») : 4 paliers de 8 colonnes.
 * On avance tant qu'au moins 7 colonnes sur 8 sont justes, et on s'arrête au premier palier raté.
 * Les leçons des paliers réussis sont validées « par le test », avec une première révision à J+3
 * qui confirme ou rouvre la leçon. Les vitesses ne sont pas validées : elles se mesurent ensuite
 * normalement (sinon les CPM seraient faussés).
 */

import { SOUS_PALIERS, sousPalier, genererExercice } from './curriculum.js';

export const COLONNES_PALIER = 8;
export const MIN_PALIER = 7;

const lecons = (...paliers) => SOUS_PALIERS.filter((sp) => paliers.includes(sp.palier.id)).map((sp) => sp.id);

/** Les 4 paliers : colonnes tirées d'une leçon représentative, leçons validées si réussi. */
export const PALIERS_TEST = [
  { id: 'directs', titre: 'Gestes directs', modele: 'p1-4', lecons: [...lecons('p0'), ...lecons('p1')] },
  { id: 'petits', titre: 'Petits amis', modele: 'p2-7', lecons: lecons('p2') },
  { id: 'grands', titre: 'Grands amis', modele: 'p4-5', lecons: [...lecons('p3'), ...lecons('p4')] },
  { id: 'combinaisons', titre: 'Combinaisons et cascades', modele: 'p5-5', lecons: lecons('p5') },
];

/** Une colonne du palier (gestes de la leçon modèle et tout ce qui la précède). */
export const colonneTest = (palier) => genererExercice(sousPalier(palier.modele));

/** Leçons à valider après les paliers réussis (dans l'ordre). */
export const leconsReussies = (reussis) => PALIERS_TEST.slice(0, reussis).flatMap((p) => p.lecons);
