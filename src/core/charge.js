/**
 * Charge d'une colonne : combien elle « pèse » à calculer, d'après les gestes qu'elle demande.
 * Un geste direct pèse moins qu'un grand ami, lui-même moins qu'une combinaison ou une cascade.
 * Sert à comparer deux planches du même format, à ordonner les colonnes et à afficher la charge.
 */

import { occurrencesColonne } from './generateur.js';
import { analyserMotif } from './motifs.js';

/** Poids relatif d'un geste selon sa famille. */
export const POIDS_GESTE = { direct: 0.6, petit: 1, grand: 1.1, mixte: 1.4, cascade: 1.4 };

/** Charge d'une colonne (somme des poids de tous ses gestes, première ligne posée comprise). */
export function coutColonne(lignes) {
  const c = occurrencesColonne(lignes).flat().reduce((s, o) => s + (POIDS_GESTE[analyserMotif(o.cle).regle] ?? 1), 0);
  return Math.round(c * 10) / 10;
}
