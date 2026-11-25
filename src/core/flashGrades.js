/**
 * Test de flash anzan au barème de la Nihon Flash Anzan Kentei Kyōkai (一般社団法人
 * 日本フラッシュ暗算検定協会) : 40 grades, du 20e kyū au 20e dan, exprimés en TEMPS TOTAL
 * (« 3 chiffres, 15 nombres en 3 secondes »).
 *
 * Source : grille « 問題レベル一覧 » de kentei.soroban-soft.com/about_test.cgi, identique à celle
 * de flash-anzan.jp/school (relevées en novembre 2026). Règles reprises de la même page :
 *  - 10 questions ; 70 points (7 justes) : réussi ; 50 à 60 points (5 ou 6 justes) : presque
 *    réussi (準合格), on repasse le même grade ; en dessous : pas encore ;
 *  - pas de saut de grade (飛び級はできません) : on les passe dans l'ordre.
 *
 * Du 20e au 11e kyū, la grille indique « sans retenue » (繰り上がりなし) : avec 8 à 20 nombres,
 * cela n'est possible qu'en mêlant additions et soustractions ; ici, chaque tige reste entre 0
 * et 9 tout au long du calcul. 12e kyū : dizaines entières (10 + 20) ; 11e kyū : chiffres doublés
 * (11 + 22). Les 20e à 18e kyū se passent, au Japon, sur des images de boules : ici, en chiffres.
 * À partir du 10e kyū : additions seules, nombres quelconques.
 */

import { entier } from './aleatoire.js';

// 0.41 : « flash 17e kyū » : à ne pas confondre avec le 17e kyū du parcours (une seule échelle de kyū).
const g = (id, nom, chiffres, nombres, secondes, forme = null) => ({ id, nom: `flash ${nom}`, chiffres, nombres, secondes, forme });

export const GRADES_FLASH = [
  g('fk20', '20e kyū', 1, 3, 5, 'sans'), g('fk19', '19e kyū', 1, 3, 5, 'sans'), g('fk18', '18e kyū', 1, 5, 7, 'sans'),
  g('fk17', '17e kyū', 1, 8, 10, 'sans'), g('fk16', '16e kyū', 1, 10, 12, 'sans'), g('fk15', '15e kyū', 1, 12, 15, 'sans'),
  g('fk14', '14e kyū', 1, 15, 15, 'sans'), g('fk13', '13e kyū', 1, 20, 15, 'sans'),
  g('fk12', '12e kyū', 2, 10, 10, 'dizaines'), g('fk11', '11e kyū', 2, 15, 15, 'doubles'),
  g('fk10', '10e kyū', 2, 2, 4), g('fk9', '9e kyū', 2, 3, 6), g('fk8', '8e kyū', 2, 4, 7), g('fk7', '7e kyū', 2, 5, 8),
  g('fk6', '6e kyū', 2, 6, 9), g('fk5', '5e kyū', 2, 7, 10), g('fk4', '4e kyū', 2, 8, 11), g('fk3', '3e kyū', 2, 10, 12),
  g('fk2', '2e kyū', 2, 12, 12), g('fk1', '1er kyū', 2, 15, 13),
  g('fd1', '1er dan', 2, 15, 10), g('fd2', '2e dan', 3, 4, 4), g('fd3', '3e dan', 3, 6, 5), g('fd4', '4e dan', 3, 8, 6),
  g('fd5', '5e dan', 3, 10, 7), g('fd6', '6e dan', 3, 12, 8), g('fd7', '7e dan', 3, 15, 8), g('fd8', '8e dan', 3, 15, 6),
  g('fd9', '9e dan', 3, 15, 4.5), g('fd10', '10e dan', 3, 15, 3),
  g('fd11', '11e dan', 3, 15, 2.8), g('fd12', '12e dan', 3, 15, 2.6), g('fd13', '13e dan', 3, 15, 2.4), g('fd14', '14e dan', 3, 15, 2.2),
  g('fd15', '15e dan', 3, 15, 2.0), g('fd16', '16e dan', 3, 15, 1.9), g('fd17', '17e dan', 3, 15, 1.8), g('fd18', '18e dan', 3, 15, 1.7),
  g('fd19', '19e dan', 3, 15, 1.6), g('fd20', '20e dan', 3, 15, 1.5),
];

export const QUESTIONS_GRADE_FLASH = 10;
export const JUSTES_GRADE_FLASH = 7;
export const JUSTES_PRESQUE_FLASH = 5;

/** Verdict d'un test : 'reussi' (7 et plus), 'presque' (5 ou 6, 準合格), 'non'. */
export const verdictFlash = (justes) => (justes >= JUSTES_GRADE_FLASH ? 'reussi' : justes >= JUSTES_PRESQUE_FLASH ? 'presque' : 'non');

/** Secondes par nombre d'un grade. */
export const periodeGrade = (x) => x.secondes / x.nombres;
/** Chiffres à absorber par seconde : la mesure de la difficulté d'un grade. */
export const debitGrade = (x) => (x.chiffres * x.nombres) / x.secondes;

const FORMES = { sans: ', sans retenue (+ et −)', dizaines: ', dizaines entières sans retenue (+ et −)', doubles: ', chiffres doublés sans retenue (+ et −)' };
export const libelleGradeFlash = (x) => `${x.nom} : ${x.chiffres} chiffre${x.chiffres > 1 ? 's' : ''}, ${x.nombres} nombres en ${x.secondes.toLocaleString('fr-FR')} s${FORMES[x.forme] ?? ''}`;

export const cleGradeFlash = (x) => `flash-kentei-${x.id}`;
/** Plus haut grade de flash obtenu, ou null. */
export const meilleurGradeFlash = (d) => [...GRADES_FLASH].reverse().find((x) => d.records?.[cleGradeFlash(x)]?.reussi) ?? null;

/** Grade à tenter : celui qui suit le meilleur obtenu (le premier, si aucun). Pas de saut de grade. */
export function prochainGradeFlash(d) {
  const m = meilleurGradeFlash(d);
  return m ? GRADES_FLASH[GRADES_FLASH.indexOf(m) + 1] ?? m : GRADES_FLASH[0];
}

/** Un grade peut-il être tenté ? (obtenu, ou le suivant du meilleur obtenu) */
export const gradeFlashOuvert = (d, x) => GRADES_FLASH.indexOf(x) <= GRADES_FLASH.indexOf(prochainGradeFlash(d));

/**
 * Une question du grade : { lignes: [{ op, n }], resultat }.
 * Grades « sans retenue » : + et − mêlés, le total reste entre 0 et 9 (ou 0 à 9 dizaines, ou un
 * nombre à chiffres doublés de 0 à 99), jamais deux fois de suite le même nombre en sens inverse.
 */
export function questionFlash(x) {
  if (!x.forme) {
    const min = 10 ** (x.chiffres - 1);
    // Jamais deux fois le même nombre de suite : à l'écran, rien ne change, on croit à un raté.
    const lignes = [];
    for (let i = 0; i < x.nombres; i++) {
      let n;
      do n = entier(min, 10 * min - 1); while (min < 10 ** 9 && n === lignes.at(-1)?.n);
      lignes.push({ op: '+', n });
    }
    return { type: 'addsub', lignes, resultat: lignes.reduce((t, l) => t + l.n, 0) };
  }
  const pas = x.forme === 'dizaines' ? 10 : x.forme === 'doubles' ? 11 : 1;
  const lignes = [];
  let total = 0; // en « unités » de 0 à 9
  let dernier = null;
  for (let i = 0; i < x.nombres; i++) {
    const choix = [];
    for (let k = 1; k <= 9; k++) {
      if (dernier && dernier.k === k) continue; // ni l'inverse, ni le même nombre deux fois de suite
      if (total + k <= 9) choix.push({ op: '+', k });
      if (i > 0 && total - k >= 0) choix.push({ op: '-', k });
    }
    const c = choix.length ? choix[entier(0, choix.length - 1)] : (total >= 5 ? { op: '-', k: entier(1, total) } : { op: '+', k: entier(1, 9 - total) });
    total += c.op === '+' ? c.k : -c.k;
    dernier = c;
    lignes.push({ op: c.op, n: c.k * pas });
  }
  return { type: 'addsub', lignes, resultat: total * pas };
}
