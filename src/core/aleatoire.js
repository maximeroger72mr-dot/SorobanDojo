/** Générateurs aléatoires partagés par les exercices. */

/** Entier aléatoire entre min et max inclus. */
export function entier(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Nombre d'exactement `chiffres` chiffres (le premier n'est jamais 0).
 * Pour 1 chiffre, renvoie 0..9 (le zéro fait partie de ce qu'il faut savoir lire).
 */
export function nombreAChiffres(chiffres) {
  if (chiffres <= 1) return entier(0, 9);
  return entier(10 ** (chiffres - 1), 10 ** chiffres - 1);
}

/** Comme nombreAChiffres, mais différent de `precedent` (évite deux questions identiques d'affilée). */
export function nombreDifferent(chiffres, precedent) {
  let n;
  do n = nombreAChiffres(chiffres); while (n === precedent);
  return n;
}
