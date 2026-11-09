/**
 * Activités libres « conseillées après » une leçon. On ne bloque jamais (l'adulte garde la
 * main) : la carte est atténuée et, au clic, un avertissement propose d'aller à la leçon.
 * Le mode découverte supprime ces avertissements.
 */

import { SOUS_PALIERS } from './curriculum.js';
import { PREREQUIS } from './parcours.js';

export const PREREQUIS_ACTIVITES = {
  colonnes: { lecons: ['p1-3'], utilise: 'des colonnes qui demandent la boule de 5 et la pincée' },
  defis: { lecons: ['p1-3'], utilise: 'des colonnes chronométrées avec la boule de 5 et la pincée' },
  dictee: { lecons: ['p1-3'], utilise: 'des colonnes dictées qui demandent la boule de 5 et la pincée' },
  anzan: { lecons: ['p1-4'], utilise: 'le calcul de tête sur plusieurs chiffres' },
  quotidien: { lecons: ['p5-5', 'pd-1'], utilise: 'les grands amis et les décimaux' },
  muldiv: { lecons: ['p6-0'], utilise: 'le placement du premier produit et du premier chiffre du quotient' },
};

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

/** Leçons conseillées et pas encore validées pour une activité (vide en mode découverte). */
export function manquantesActivite(d, cle) {
  if (d.reglages?.decouverte) return [];
  return (PREREQUIS_ACTIVITES[cle]?.lecons ?? []).filter((id) => !d.paliers[id]?.valide).map(sp);
}

/** Leçons conseillées et pas encore validées pour une épreuve officielle (10e au 7e kyū). */
export function manquantesEpreuve(d, gradeId) {
  if (d.reglages?.decouverte || !PREREQUIS[gradeId]) return [];
  return PREREQUIS[gradeId].filter((id) => !d.paliers[id]?.valide).map(sp);
}
