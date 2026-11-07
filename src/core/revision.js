/**
 * Révision espacée (système de Leitner).
 *
 * Chaque sous-palier validé devient une « carte » rangée dans une boîte de 1 à 5.
 * Boîte 1 : à revoir à J+1, boîte 2 : J+3, boîte 3 : J+7, boîte 4 : J+14, boîte 5 : J+30.
 * Test flash réussi : la carte monte d'une boîte (la boîte 5 reste à 30 jours).
 * Test flash raté : la carte redescend d'UNE boîte (une inattention ne remet pas tout à zéro ;
 * des échecs répétés la ramènent quand même en boîte 1).
 *
 * Les dates sont des chaînes 'AAAA-MM-JJ' en heure locale (comparables directement).
 */

export const INTERVALLES = [1, 3, 7, 14, 30];

/** Ajoute n jours à une date 'AAAA-MM-JJ'. */
export function ajouterJours(date, n) {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(a, m - 1, j + n, 12); // midi : pas de piège d'heure d'été
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Carte créée à la validation d'un sous-palier. */
export function nouvelleCarte(aujourdhui) {
  return { boite: 1, echeance: ajouterJours(aujourdhui, INTERVALLES[0]) };
}

/** Nouvelle carte après un test flash. */
export function reviser(carte, reussi, aujourdhui) {
  const boite = reussi ? Math.min(carte.boite + 1, INTERVALLES.length) : Math.max(1, carte.boite - 1);
  return { boite, echeance: ajouterJours(aujourdhui, INTERVALLES[boite - 1]) };
}

export const estDue = (carte, aujourdhui) => !!carte && carte.echeance <= aujourdhui;
