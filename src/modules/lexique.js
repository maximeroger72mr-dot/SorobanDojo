/**
 * Lexique : les mots du soroban et de l'application, définis en une ou deux phrases.
 * Pour ajouter un mot : une ligne dans MOTS (ordre alphabétique).
 */

import { h } from '../ui/dom.js';

export const MOTS = [
  ['Ami (petit, grand)', 'Le complément qui permet un geste quand les boules manquent. Petit ami : complément à 5 (4 = 5 − 1). Grand ami : complément à 10 (9 = 10 − 1), avec une retenue sur la tige de gauche.'],
  ['Anzan (暗算)', 'Calcul de tête avec un soroban imaginaire : on voit les boules bouger. Il se construit avec la pratique du vrai soroban, jamais à sa place.'],
  ['Boîte (révisions)', 'Rangement d\'une leçon validée dans les révisions espacées. Boîte 1 : à revoir le lendemain ; boîte 5 : dans 30 jours. Une révision réussie fait monter d\'une boîte, une ratée fait redescendre d\'une boîte.'],
  ['Boule céleste, boules terrestres', 'La céleste (au-dessus de la barre) vaut 5 ; chacune des 4 terrestres (en dessous) vaut 1. Une boule compte quand elle touche la barre.'],
  ['Cascade', 'Une retenue (ou un emprunt) qui se propage sur plusieurs tiges d\'un coup, par exemple 999 + 1.'],
  ['Coupe-file', 'Accès anticipé au mini-test d\'une leçon, quand les 15 premiers exercices sont tous justes et déjà au niveau « acquis confirmé ».'],
  ['Doigté', 'Quel doigt fait quel geste : le pouce monte les terrestres, l\'index les descend et manœuvre la céleste. La « pincée » fait les deux à la fois.'],
  ['Drill', 'Suite classique d\'opérations à enchaîner sur son soroban (ex. 123 456 789 ajouté 9 fois), chronométrée, avec médailles bronze, argent, or et platine.'],
  ['Fantôme', 'Votre propre record, rejoué en même temps que vous : une barre montre où vous en étiez à ce moment-là.'],
  ['Flash anzan', 'Des nombres affichés très brièvement, un par un, à additionner de tête.'],
  ['Kyū (級)', 'Grade de calcul au soroban, du 10e (débutant) au 1er. Les « kyū prép. » (20e au 11e) sont propres à cette application et n\'ont pas de valeur officielle.'],

  ['Lièvre', 'Jeu de rythme : les nombres défilent à une cadence imposée qui accélère quand vous suivez.'],
  ['Marathon (ruban)', 'Une longue colonne sans remise à zéro : on donne le sous-total régulièrement, et on tient le plus longtemps possible.'],
  ['Mitori (見取り)', 'Les additions et soustractions écrites en colonne, qu\'on lit et qu\'on pose sur le soroban : l\'exercice de base des examens.'],
  ['Mode Espace (mains sur le soroban)', 'On appuie sur Espace dès que son soroban est fini : le chrono s\'arrête à cet instant, puis on tape le résultat sans être pressé (la frappe ne compte pas dans le temps).'],
  ['Mode pur', 'Planches où chaque ligne utilise le geste travaillé, sans geste direct pour souffler.'],
  ['Motif (geste)', 'Un geste précis sur une tige, par exemple « +3 petit ami » ou « −8 grand ami ». La carte de maîtrise les suit un par un.'],
  ['Niveau d\'un geste', 'À découvrir, En progrès, Acquis débutant, confirmé, expert : selon la justesse ET la vitesse sur ce geste.'],
  ['Passage de kyū', 'L\'examen chronométré de votre niveau, sur tout ce que vous avez appris, ouvert en permanence. Réussi (70 %), il donne le kyū prép. ; raté, il ne retire rien et se retente quand on veut.'],
  ['Pincée', 'Geste où le pouce et l\'index bougent ensemble, par exemple pour poser 6 à 9 (céleste et terrestres en même temps).'],
  ['Planche', 'Une feuille de colonnes ciblées sur un geste, à faire d\'une traite, imprimable.'],
  ['Remise à zéro', 'Toutes les boules écartées de la barre : le soroban affiche 0.'],
  ['Sous-total', 'Ce que le soroban doit afficher après une ligne de la colonne : il permet de retrouver la ligne où l\'on s\'est trompé.'],
  ['Tige des unités', 'La tige choisie pour les unités (marquée d\'un point) ; les dizaines sont à sa gauche, les décimales à sa droite.'],
  ['Yomiage (読み上げ)', 'Calcul à l\'oreille : les nombres sont lus à voix haute, on les pose au fur et à mesure.'],
  ['九九 (kuku)', 'La table de multiplication japonaise, récitée produit par produit (« ni san ga roku » : 2 × 3 = 6).'],
  ['両落とし, 片落とし', 'Deux façons de poser une multiplication ou une division. 両落とし (« les deux tombent ») : on ne pose aucun des deux nombres, on les lit sur la feuille ; c\'est la méthode enseignée ici.'],
];

export default {
  id: 'lexique',
  titre: 'Lexique',
  monter(el) {
    el.append(h('h1', {}, 'Lexique'),
      h('p', { class: 'discret' }, 'Les mots du soroban et de l\'application, en une ou deux phrases.'),
      h('dl', { class: 'lexique' }, MOTS.map(([mot, def]) => [h('dt', {}, mot), h('dd', {}, def)])));
    return null;
  },
};
