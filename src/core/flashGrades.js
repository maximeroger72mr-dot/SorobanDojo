/**
 * Grades de flash anzan, exprimés en TEMPS TOTAL (« 3 chiffres, 15 nombres en 5 secondes »),
 * comme dans les logiciels japonais, et non en temps par nombre.
 *
 * Échelle INDICATIVE : 20 grades, du 10e kyū au 10e dan. Les deux extrémités viennent du logiciel
 * de l'association japonaise de flash anzan (de « 1 chiffre, 2 nombres, 3 s » à « 3 chiffres,
 * 15 nombres, 1,2 s ») ; les grades intermédiaires sont reconstitués pour que chaque marche soit
 * un peu plus haute que la précédente (un test le vérifie). Ce n'est pas la grille d'un examen.
 *
 * Un grade est obtenu avec 2 réponses justes sur 3.
 */

const g = (id, nom, chiffres, nombres, secondes) => ({ id, nom, chiffres, nombres, secondes });

export const GRADES_FLASH = [
  g('k10', '10e kyū', 1, 3, 5), g('k9', '9e kyū', 1, 5, 7), g('k8', '8e kyū', 1, 7, 8), g('k7', '7e kyū', 1, 10, 10),
  g('k6', '6e kyū', 2, 3, 5), g('k5', '5e kyū', 2, 4, 6), g('k4', '4e kyū', 2, 5, 7), g('k3', '3e kyū', 2, 7, 8),
  g('k2', '2e kyū', 2, 10, 10), g('k1', '1er kyū', 2, 15, 12),
  g('d1', '1er dan', 3, 3, 4), g('d2', '2e dan', 3, 4, 5), g('d3', '3e dan', 3, 5, 6), g('d4', '4e dan', 3, 7, 7),
  g('d5', '5e dan', 3, 10, 8), g('d6', '6e dan', 3, 12, 8), g('d7', '7e dan', 3, 15, 9), g('d8', '8e dan', 3, 15, 7),
  g('d9', '9e dan', 3, 15, 5), g('d10', '10e dan', 3, 15, 3),
];

export const QUESTIONS_GRADE_FLASH = 3;
export const JUSTES_GRADE_FLASH = 2;

/** Secondes par nombre d'un grade. */
export const periodeGrade = (x) => x.secondes / x.nombres;
/** Chiffres à absorber par seconde : la mesure de la difficulté d'un grade. */
export const debitGrade = (x) => (x.chiffres * x.nombres) / x.secondes;

export const libelleGradeFlash = (x) => `${x.nom} : ${x.chiffres} chiffre${x.chiffres > 1 ? 's' : ''}, ${x.nombres} nombres en ${x.secondes.toLocaleString('fr-FR')} s`;

/** Plus haut grade de flash obtenu (records `flash-grade-<id>`), ou null. */
export const meilleurGradeFlash = (d) => [...GRADES_FLASH].reverse().find((x) => d.records?.[`flash-grade-${x.id}`]?.reussi) ?? null;

/** Grade à tenter : celui qui suit le meilleur obtenu (le premier, si aucun). */
export function prochainGradeFlash(d) {
  const m = meilleurGradeFlash(d);
  return m ? GRADES_FLASH[GRADES_FLASH.indexOf(m) + 1] ?? m : GRADES_FLASH[0];
}
