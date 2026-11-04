/**
 * Nombres décimaux : lecture des réponses tapées, arrondis exacts, comparaison.
 *
 * Tous les calculs d'arrondi se font en ENTIERS (BigInt) pour éviter les erreurs de virgule
 * flottante : 2,675 arrondi au centième doit donner 2,68, pas 2,67.
 */

/** Arrondi demi-supérieur de num / den à `decimales` chiffres, renvoyé en nombre JS. */
export function diviserArrondi(num, den, decimales) {
  const n = BigInt(num) * 10n ** BigInt(decimales);
  const d = BigInt(den);
  let q = n / d;
  if ((n % d) * 2n >= d) q += 1n;
  return Number(q) / 10 ** decimales;
}

/**
 * Lit une réponse tapée : « 12 345 », « 12345 », « 3,929 », « 3.929 ».
 * Espaces = séparateurs de milliers (acceptés mais jamais obligatoires).
 * Pour une réponse entière, le point est aussi accepté comme séparateur de milliers.
 * @returns {number|null}
 */
export function lireReponse(brut, decimales = 0) {
  let t = String(brut).replace(/[\s  ]/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (t.includes('.') && !decimales && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  // Résultat négatif (calcul par complément) : « -37 » ou « −37 ».
  const negatif = /^[-−]/.test(t);
  if (negatif) t = t.slice(1);
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return negatif ? -Number(t) : Number(t);
}

/** Égalité à la précision de l'exercice. */
export function egal(a, b, decimales = 0) {
  if (a === null || b === null) return false;
  return Math.round(a * 10 ** decimales) === Math.round(b * 10 ** decimales);
}

/** Nombre de décimales d'un nombre (pour l'affichage). */
export const nbDecimales = (x) => (String(x).split('.')[1] ?? '').length;
