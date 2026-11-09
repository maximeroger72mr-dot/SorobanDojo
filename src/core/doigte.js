/**
 * Contrôle du doigté : l'application vérifie les résultats, pas les doigts. Une question oui/non,
 * adaptée au geste de la leçon, aide l'apprenant à se vérifier lui-même. Posée au premier
 * mini-test d'une leçon, puis de temps en temps en révision. Elle ne bloque jamais rien.
 */

const QUESTIONS = {
  'p1-1': 'Avez-vous monté les terrestres avec le POUCE, d\'un seul mouvement ?',
  'p1-2': 'Avez-vous descendu les terrestres avec l\'INDEX ?',
  'p1-3': 'Pour 6 à 9 : la céleste et les terrestres en UN seul mouvement (la pincée) ?',
  'p1-4': 'Avez-vous posé chaque nombre de gauche à droite (dizaines, puis unités) ?',
  p2: 'Petit ami : la céleste puis les terrestres, enchaînées sans pause et sans réciter la formule ?',
  p3: 'Grand ami : le complément sur la tige, puis la retenue sur la tige de gauche, sans calculer de tête ?',
  p4: 'Grand ami : l\'emprunt sur la tige de gauche, puis le complément, sans calculer de tête ?',
  p5: 'Combinaisons : un seul mouvement de main qui « roule » de droite à gauche, sans calcul de tête ?',
  muldiv: 'L\'index gauche a-t-il marqué la tige de travail, pour ne jamais perdre votre place ?',
};
const GENERALE = 'Avez-vous fait TOUS les calculs sur le soroban, sans rien calculer de tête ?';

/** Rappel du bon geste (après un « non »). */
const RAPPELS = {
  'p1-1': 'Pouce sous les boules, légèrement incliné : il les pousse vers la barre d\'un coup sec.',
  'p1-2': 'Index au-dessus des boules : il les tire vers le bas d\'un coup sec. Pouce pour monter, index pour descendre.',
  'p1-3': 'L\'index abaisse la céleste PENDANT que le pouce monte les terrestres : les deux doigts se referment ensemble, comme une pince.',
  'p1-4': 'On pose le nombre comme on le lit : de gauche à droite. Le total courant est sur le soroban.',
  muldiv: 'La main gauche tient le soroban ; son index se pose sous la tige où l\'on travaille et avance avec le calcul.',
  generale: 'Ralentissez un peu : le geste juste d\'abord, la vitesse viendra. Un calcul fait de tête n\'entraîne pas la main.',
};

/** La question de doigté d'une leçon (null : pas de question pour ce type de leçon). */
export function questionDe(sp) {
  if (!sp || sp.mental || ['theorie', 'lire', 'complement', 'placement', 'table'].includes(sp.type)) return null;
  const muldiv = ['mul', 'div', 'muldec', 'divdec', 'divarrondi'].includes(sp.type);
  const cle = QUESTIONS[sp.id] ? sp.id : muldiv ? 'muldiv' : QUESTIONS[sp.palier?.id] ? sp.palier.id : null;
  return { cle: cle ?? 'generale', texte: cle ? QUESTIONS[cle] : GENERALE, rappel: RAPPELS[cle] ?? null };
}

/**
 * Grille d'observation du doigté (bilan imprimable), à remplir en se filmant ou avec un tiers.
 */
export const GRILLE_DOIGTE = [
  'Le soroban est posé à plat, la main gauche le tient sans cacher les tiges.',
  'Le pouce MONTE les terrestres ; l\'index les DESCEND.',
  'L\'index seul manœuvre la céleste, dans les deux sens.',
  'La pincée (+6 à +9) se fait en un seul mouvement.',
  'Le retrait de 6 à 9 se fait en un seul mouvement de l\'index.',
  'Les petits amis s\'enchaînent sans pause entre les deux temps.',
  'La retenue d\'un grand ami part sans hésitation vers la tige de gauche.',
  'Les nombres se posent de gauche à droite, comme on les lit.',
  'Les doigts restent au ras des boules entre deux gestes.',
  'Le crayon reste dans la main pendant le calcul.',
];
