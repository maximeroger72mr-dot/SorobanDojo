/**
 * Dictée anzan : les nombres sont lus à voix haute, soroban rangé ; on calcule de tête sur le
 * soroban imaginaire, puis on tape le résultat. Elle avance par PALIERS : d'abord peu de nombres,
 * lentement, puis plus de nombres, puis plus vite, puis deux chiffres.
 *
 * Une série fait 5 dictées. 4 justes ou plus : palier suivant. 2 justes ou moins : palier
 * précédent. Le palier atteint est gardé d'une séance à l'autre.
 */

export const DICTEES_PAR_SERIE = 5;

/** chiffres, nombres dictés, débit de la voix, pause entre deux nombres (s), soustractions. */
export const PALIERS_DICTEE = [
  { chiffres: 1, nombres: 3, debit: 0.85, pause: 1.2, soustractions: false },
  { chiffres: 1, nombres: 3, debit: 0.85, pause: 1.2, soustractions: true },
  { chiffres: 1, nombres: 5, debit: 0.85, pause: 0.8, soustractions: true },
  { chiffres: 1, nombres: 5, debit: 1, pause: 0.6, soustractions: true },
  { chiffres: 1, nombres: 7, debit: 1, pause: 0.6, soustractions: true },
  { chiffres: 1, nombres: 10, debit: 1.2, pause: 0.3, soustractions: true },
  { chiffres: 2, nombres: 3, debit: 0.85, pause: 1.2, soustractions: false },
  { chiffres: 2, nombres: 3, debit: 0.85, pause: 0.8, soustractions: true },
  { chiffres: 2, nombres: 5, debit: 0.85, pause: 0.8, soustractions: true },
  { chiffres: 2, nombres: 5, debit: 1, pause: 0.6, soustractions: true },
  { chiffres: 2, nombres: 7, debit: 1, pause: 0.6, soustractions: true },
  { chiffres: 3, nombres: 3, debit: 0.85, pause: 1.2, soustractions: true },
];

/** Palier après une série : +1 à 4 justes sur 5, −1 à 2 justes ou moins, sinon inchangé. */
export function palierSuivant(palier, justes, total = DICTEES_PAR_SERIE) {
  const taux = total ? justes / total : 0;
  if (taux >= 0.8) return Math.min(PALIERS_DICTEE.length - 1, palier + 1);
  if (taux <= 0.4) return Math.max(0, palier - 1);
  return palier;
}

/** Description courte d'un palier, pour l'écran. */
export function libellePalier(i) {
  const p = PALIERS_DICTEE[i];
  const debit = p.debit < 1 ? 'voix posée' : p.debit === 1 ? 'voix normale' : 'voix rapide';
  return `${p.nombres} nombres à ${p.chiffres} chiffre${p.chiffres > 1 ? 's' : ''}, ${debit}, ${p.soustractions ? 'avec soustractions' : 'additions seules'}`;
}
