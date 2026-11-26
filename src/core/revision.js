/**
 * Révision espacée (système de Leitner).
 *
 * Chaque sous-palier validé devient une « carte » rangée dans une boîte de 1 à 5.
 * Boîte 1 : à revoir à J+1, boîte 2 : J+3, boîte 3 : J+7, boîte 4 : J+14, boîte 5 : J+30.
 * Test flash réussi : la carte monte d'une boîte. Réussi en boîte 5 (après 30 jours) : la leçon
 * est ACQUISE et sort des révisions (avant la 0.36, elle revenait tous les 30 jours sans fin).
 * Test flash raté : la carte redescend d'UNE boîte (une inattention ne remet pas tout à zéro ;
 * des échecs répétés la ramènent quand même en boîte 1).
 *
 * Les dates sont des chaînes 'AAAA-MM-JJ' en heure locale (comparables directement).
 */

// 0.41 : une boîte de plus, à 90 jours (avant : sortie des révisions après 30 jours).
export const INTERVALLES = [1, 3, 7, 14, 30, 90];

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
  if (reussi && carte.boite >= INTERVALLES.length) return { boite: carte.boite, echeance: carte.echeance, acquise: aujourdhui };
  const boite = reussi ? Math.min(carte.boite + 1, INTERVALLES.length) : Math.max(1, carte.boite - 1);
  return { boite, echeance: ajouterJours(aujourdhui, INTERVALLES[boite - 1]) };
}

export const estDue = (carte, aujourdhui) => !!carte && !carte.acquise && carte.echeance <= aujourdhui;

/**
 * Ordre des révisions dues (0.39) : les plus FRAGILES d'abord (« fluidité à reprendre », puis la
 * boîte la plus basse), puis les plus en retard. Après une pause, la séance en prend 3 au plus :
 * pas d'avalanche, les autres suivent les jours d'après.
 * @param {(id: string) => object} etat  état d'une leçon (sa carte)
 */
export const REVISIONS_SEANCE_MAX = 8; // 0.41 : 8 (avant 3 : l'arriéré montait à 10 cartes après une absence)
export const ordreRevisions = (etat) => (a, b) => {
  const ea = etat(a.id ?? a); const eb = etat(b.id ?? b);
  return (eb.fluidite ? 1 : 0) - (ea.fluidite ? 1 : 0) || (ea.carte?.boite ?? 1) - (eb.carte?.boite ?? 1) || String(ea.carte?.echeance).localeCompare(String(eb.carte?.echeance));
};

/**
 * Contrôle tous les 90 jours (0.39), pour des leçons ACQUISES (sorties des révisions) :
 *  - les règles rares : résultats négatifs, décimaux, arrondis ;
 *  - 4 synthèses : la révision générale (p5-5), les colonnes d'endurance (p8-3), une synthèse de ×
 *    (p9-4) et une de ÷ (p9-6).
 * Sauté quand une épreuve du dernier mois contenait ces formats. Au contrôle (test flash), la leçon
 * revient en révision si elle est ratée ou si la vitesse a reculé de plus de 15 %.
 */
export const CONTROLE_JOURS = 90;
export const TYPES_REGLES_RARES = ['negatif', 'addsubdec', 'muldec', 'divdec', 'divarrondi', 'arrondiunite'];
export const SYNTHESES_CONTROLE = ['p5-5', 'p8-3', 'p8-3c', 'p9-4', 'p9-6'];
// 0.41 : TOUTES les leçons sont contrôlées après leur sortie des révisions (aucune n'est close pour
// toujours) : tous les 90 jours pour les règles rares et les synthèses, tous les 180 jours pour les autres.
export const aControler = (sp) => !!sp && !sp.mental && sp.type !== 'theorie';
const joursControle = (sp) => (TYPES_REGLES_RARES.includes(sp.type) || SYNTHESES_CONTROLE.includes(sp.id) ? CONTROLE_JOURS : 2 * CONTROLE_JOURS);

/**
 * La leçon est-elle due pour son contrôle ?
 * @param {(sp: object) => boolean} couverte  une épreuve du dernier mois contenait-elle ce format ?
 */
export function controleDu(sp, carte, date, couverte = () => false) {
  if (!aControler(sp) || !carte?.acquise) return false;
  const depuis = carte.controle ?? carte.acquise;
  return ajouterJours(depuis, joursControle(sp)) <= date && !couverte(sp);
}

/** Carte après un contrôle : réussi, prochain contrôle dans 90 jours ; sinon, retour en révision (boîte 3). */
export function apresControle(carte, reussi, date) {
  return reussi ? { ...carte, controle: date } : { boite: 3, echeance: ajouterJours(date, INTERVALLES[2]) };
}

/** Révision mélangée (0.38) : 3 leçons au plus ; 5 calculs chacune à 2 leçons, 4 à 3 leçons. */
// 0.41 : 8 leçons au plus (avant 3) : 5 calculs chacune à 2, 4 à 3, 3 au-delà (24 au plus).
export const MELANGE_MAX = 8;
export const calculsMelange = (n) => (n <= 2 ? 5 * n : n === 3 ? 12 : Math.min(24, 3 * n));
