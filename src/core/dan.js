/**
 * Dan d'entraînement, au barème Nisshō (日本珠算連盟, 珠算段位認定試験), d'après le tableau fourni
 * par l'utilisateur (0.38) :
 *  - multiplication (乗算) : 60 problèmes, 10 minutes, 5 points, 11 chiffres au total (実法合わせて
 *    11桁 : 6 × 5, 7 × 4) ; entiers, décimaux arrondis au millième, montants arrondis à l'unité ;
 *  - division (除算) : 60 problèmes, 10 minutes, 5 points, 10 chiffres au total (法商合わせて10桁),
 *    même répartition ;
 *  - mitorizan (見取算) : 30 problèmes, 10 minutes, 10 points, 10 lignes de 5 à 10 chiffres
 *    (environ 85 chiffres par colonne), additions pures et mêlées, résultats négatifs (補数).
 * Chaque épreuve a son seuil, sans compensation : le dan obtenu est le plus haut dont le seuil est
 * atteint dans LES TROIS épreuves (de 90 points sur 300 au 準初段 à 290 au 十段).
 *
 * « D'entraînement » : l'application n'est pas un centre d'examen ; le format et le barème suivent
 * le règlement, la répartition fine des longueurs dans le mitorizan est estimée.
 * Fonctions pures.
 */

import { MIXTES } from './epreuves.js';

const n = (id, nom, japonais, points, jun = false) => ({ id, nom, japonais, points, jun });
export const NIVEAUX_DAN = [
  n('jd1', '1er dan préparatoire', '準初段', 90, true), n('d1', '1er dan', '初段', 100),
  n('jd2', '2e dan préparatoire', '準二段', 110, true), n('d2', '2e dan', '二段', 120),
  n('jd3', '3e dan préparatoire', '準三段', 130, true), n('d3', '3e dan', '三段', 140),
  n('jd4', '4e dan préparatoire', '準四段', 150, true), n('d4', '4e dan', '四段', 160),
  n('jd5', '5e dan préparatoire', '準五段', 170, true), n('d5', '5e dan', '五段', 180),
  n('jd6', '6e dan préparatoire', '準六段', 190, true), n('d6', '6e dan', '六段', 200),
  n('d7', '7e dan', '七段', 220), n('d8', '8e dan', '八段', 240), n('d9', '9e dan', '九段', 260), n('d10', '10e dan', '十段', 290),
];
export const POINTS_EPREUVE_DAN = 300;
export const MINUTES_EPREUVE_DAN = 10;

/** Longueurs des 10 lignes d'un mitorizan de dan : de 5 à 10 chiffres, 85 au total. */
export const GABARITS_DAN = [
  [10, 10, 9, 9, 9, 8, 8, 8, 7, 7], [10, 10, 10, 9, 9, 8, 8, 7, 7, 7], [10, 10, 10, 10, 9, 8, 7, 7, 7, 7],
  [10, 10, 9, 9, 8, 8, 8, 8, 8, 7], [10, 10, 10, 9, 9, 8, 8, 8, 7, 6], [10, 10, 10, 10, 9, 9, 8, 8, 6, 5],
];

export const SUJET_DAN = {
  mul: { nb: 60, total: 11, points: 5, decimales: 3 },
  div: { nb: 60, total: 10, points: 5, decimales: 3 },
  // Mêlés comme aux kyū (problèmes 3, 5, 7, 9 de chaque dizaine) ; un résultat négatif au 9e de
  // chaque dizaine.
  mitori: { nb: 30, lignes: 10, min: 5, max: 10, gabarits: GABARITS_DAN, soustractions: true, mixtes: [0, 10, 20].flatMap((k) => MIXTES.map((i) => i + k)), moins: 4, points: 10, rangsNegatifs: [8, 18, 28] },
};

/** Un niveau de dan, sous la forme d'un « grade » (sujet, allure, marches). */
export function gradeDan(niveau) {
  return { id: niveau.id, nom: niveau.nom, japonais: niveau.japonais, systeme: 'dan', dan: true, parEpreuve: true, milliers: true,
    minutesEpreuve: MINUTES_EPREUVE_DAN, minutes: 3 * MINUTES_EPREUVE_DAN, seuil: niveau.points / POINTS_EPREUVE_DAN, pointsEpreuve: niveau.points, ...SUJET_DAN };
}

/**
 * Niveau atteint d'après les points de chaque épreuve : le plus haut dont le seuil est atteint
 * partout. null sous le 準初段.
 * @param {number[]} points  points de chaque épreuve (sur 300)
 */
export function niveauAtteint(points) {
  const min = Math.min(...points);
  return [...NIVEAUX_DAN].reverse().find((x) => min >= x.points) ?? null;
}

export const CLE_DAN = 'dan-nissho';
/** Meilleur niveau de dan obtenu (examen de dan d'entraînement), ou null. */
export const meilleurDan = (d) => NIVEAUX_DAN.find((x) => x.id === d.records?.[CLE_DAN]?.niveau) ?? null;

/** Prochain dan « plein » à viser (初段, 二段…) : celui qui suit le meilleur obtenu. */
export function prochainDan(d) {
  const m = meilleurDan(d);
  const i = m ? NIVEAUX_DAN.indexOf(m) : -1;
  return NIVEAUX_DAN.slice(i + 1).find((x) => !x.jun) ?? null;
}
