/**
 * Parcours des leçons guidées : paliers et sous-paliers.
 *
 * Chaque sous-palier définit :
 *  - cibles   : motifs travaillés (chaque exercice en contient au moins un) ;
 *  - chiffres : nombre de chiffres du nombre ajouté/retiré ;
 *  - termes   : nombre d'opérations successives par exercice (1 = « a ± b ») ;
 *  - pourquoi : l'explication du geste, pour un adulte qui découvre ;
 *  - demos    : exemples rejoués en démonstration animée.
 *
 * Les motifs AUTORISÉS d'un sous-palier sont calculés automatiquement : ce sont ses cibles
 * plus toutes celles des sous-paliers précédents (on ne demande jamais un geste pas encore appris).
 *
 * Pour modifier la progression : éditer la liste PALIERS ci-dessous ; tout le reste s'adapte.
 */

import { D, famille, TOUS_LES_MOTIFS } from './motifs.js';

const DIRECT = famille('direct');
const PETIT = famille('petit');
const GRAND = famille('grand');
const MIXTE = famille('mixte');

/** Nombre de répétitions d'entraînement exigées avant le mini-test. */
export const REPETITIONS_REQUISES = 50;
/** Mini-test : nombre d'exercices et minimum de réussites (sans erreur de geste). */
export const TEST = { exercices: 10, reussitesMin: 9 };

export const PALIERS = [
  {
    id: 'p1',
    titre: 'Les unités : gestes directs',
    sousPaliers: [
      {
        id: 'p1-1', titre: 'Ajouter 1 à 4', cibles: D('+', [1, 2, 3, 4], 'direct'), chiffres: 1,
        pourquoi: 'Ajouter, c\'est faire monter des boules terrestres vers la barre, avec le POUCE. Le pouce est placé sous les boules : il les pousse vers le haut d\'un seul mouvement, sans hésiter. Une seule règle : il faut que les boules soient libres (en bas).',
        demos: [{ depart: 0, op: '+', n: 3 }, { depart: 1, op: '+', n: 2 }, { depart: 6, op: '+', n: 3 }],
      },
      {
        id: 'p1-2', titre: 'Retirer 1 à 4', cibles: D('-', [1, 2, 3, 4], 'direct'), chiffres: 1,
        pourquoi: 'Retirer, c\'est éloigner des boules terrestres de la barre, avec l\'INDEX, qui les pousse vers le bas. Pouce pour monter, index pour descendre : cette répartition évite que les deux doigts se gênent et rend le calcul rapide.',
        demos: [{ depart: 4, op: '-', n: 3 }, { depart: 8, op: '-', n: 2 }],
      },
      {
        id: 'p1-3', titre: 'Le 5 : la boule céleste', cibles: [...D('+', [5], 'direct'), ...D('-', [5], 'direct')], chiffres: 1,
        pourquoi: 'La boule céleste vaut 5. C\'est toujours l\'INDEX qui la manœuvre, vers le bas pour ajouter 5, vers le haut pour retirer 5. Ajouter 5 se fait donc en un seul geste, quel que soit le nombre de terrestres déjà posées.',
        demos: [{ depart: 2, op: '+', n: 5 }, { depart: 8, op: '-', n: 5 }],
      },
      {
        id: 'p1-4', titre: '6 à 9 : la pincée', cibles: [...D('+', [6, 7, 8, 9], 'direct'), ...D('-', [6, 7, 8, 9], 'direct')], chiffres: 1,
        pourquoi: '6, c\'est 5 + 1. Pour ajouter 6 à 9, on combine la céleste et des terrestres EN UN SEUL GESTE : l\'index abaisse la céleste pendant que le pouce monte les terrestres, comme une pince qui se referme. Pour retirer 6 à 9, l\'index relève la céleste et descend les terrestres d\'un même mouvement.',
        demos: [{ depart: 0, op: '+', n: 7 }, { depart: 9, op: '-', n: 6 }],
      },
      {
        id: 'p1-5', titre: 'Révision : enchaîner les gestes directs', cibles: DIRECT, chiffres: 1, termes: 3,
        pourquoi: 'On enchaîne trois opérations. Le but est que le bon doigt parte tout seul : pouce pour monter, index pour descendre et pour la céleste. Ne regardez pas vos doigts, regardez le nombre suivant.',
        demos: [{ depart: 1, op: '+', n: 3 }, { depart: 4, op: '+', n: 5 }, { depart: 9, op: '-', n: 7 }],
      },
    ],
  },
  {
    id: 'p2',
    titre: 'Les dizaines : plusieurs tiges',
    sousPaliers: [
      {
        id: 'p2-1', titre: 'Additions directes à 2 chiffres', cibles: D('+', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'direct'), chiffres: 2,
        pourquoi: 'Au soroban, on calcule de GAUCHE À DROITE : d\'abord les dizaines, puis les unités, dans l\'ordre où on lit le nombre. On n\'a ainsi jamais besoin de retenir un chiffre en tête : on pose au fur et à mesure de la lecture.',
        demos: [{ depart: 12, op: '+', n: 35 }, { depart: 51, op: '+', n: 26 }],
      },
      {
        id: 'p2-2', titre: 'Soustractions directes à 2 chiffres', cibles: D('-', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'direct'), chiffres: 2,
        pourquoi: 'Même principe pour retirer : les dizaines d\'abord, puis les unités. Chaque tige se traite indépendamment tant qu\'aucune ne manque de boules.',
        demos: [{ depart: 87, op: '-', n: 32 }, { depart: 69, op: '-', n: 55 }],
      },
    ],
  },
  {
    id: 'p3',
    titre: 'Les petits amis (compléments à 5)',
    sousPaliers: [
      {
        id: 'p3-1', titre: 'Ajouter 4 et 3 avec le petit ami', cibles: D('+', [4, 3], 'petit'), chiffres: 1,
        pourquoi: 'Sur 3, on veut ajouter 4 : il ne reste qu\'une terrestre libre. Astuce : 4 = 5 − 1. On abaisse la céleste (+5) et on retire 1 terrestre (−1). 1 et 4 sont « petits amis » : leur somme fait 5. De même 2 et 3. Les deux mouvements se font avec l\'index.',
        demos: [{ depart: 3, op: '+', n: 4 }, { depart: 2, op: '+', n: 3 }, { depart: 4, op: '+', n: 3 }],
      },
      {
        id: 'p3-2', titre: 'Ajouter 2 et 1 avec le petit ami', cibles: D('+', [2, 1], 'petit'), chiffres: 1,
        pourquoi: '2 = 5 − 3 et 1 = 5 − 4. Sur 4, ajouter 1 : on abaisse la céleste et on descend les 4 terrestres. Le résultat est le même que si on avait la place, mais on n\'utilise que des boules disponibles.',
        demos: [{ depart: 4, op: '+', n: 1 }, { depart: 3, op: '+', n: 2 }],
      },
      {
        id: 'p3-3', titre: 'Retirer 4 et 3 avec le petit ami', cibles: D('-', [4, 3], 'petit'), chiffres: 1,
        pourquoi: 'Sur 5, retirer 4 : aucune terrestre n\'est posée. Astuce inverse : −4 = +1 − 5. Le pouce monte 1 terrestre (+1), puis l\'index relève la céleste (−5). On ajoute d\'abord le petit ami, puis on enlève le 5.',
        demos: [{ depart: 5, op: '-', n: 4 }, { depart: 6, op: '-', n: 3 }],
      },
      {
        id: 'p3-4', titre: 'Retirer 2 et 1 avec le petit ami', cibles: D('-', [2, 1], 'petit'), chiffres: 1,
        pourquoi: '−2 = +3 − 5 et −1 = +4 − 5. Sur 5, retirer 1 : le pouce monte les 4 terrestres, l\'index relève la céleste. On obtient 4.',
        demos: [{ depart: 5, op: '-', n: 1 }, { depart: 6, op: '-', n: 2 }],
      },
      {
        id: 'p3-5', titre: 'Révision : petits amis mélangés', cibles: PETIT, chiffres: 1, termes: 3,
        pourquoi: 'Enchaînez sans réfléchir à la formule : regardez la tige, et si les boules manquent, le petit ami s\'impose. Avec l\'habitude, le geste devient un réflexe associé au chiffre.',
        demos: [{ depart: 3, op: '+', n: 4 }],
      },
      {
        id: 'p3-6', titre: 'Petits amis à 2 chiffres', cibles: PETIT, chiffres: 2,
        pourquoi: 'Le petit ami peut se produire sur n\'importe quelle tige. On travaille toujours de gauche à droite : chaque tige choisit son propre geste.',
        demos: [{ depart: 34, op: '+', n: 43 }, { depart: 65, op: '-', n: 32 }],
      },
    ],
  },
  {
    id: 'p4',
    titre: 'Les grands amis (compléments à 10)',
    sousPaliers: [
      {
        id: 'p4-1', titre: 'Ajouter 9 et 8 avec le grand ami', cibles: D('+', [9, 8], 'grand'), chiffres: 1,
        pourquoi: 'Sur 3, ajouter 9 donnerait 12 : impossible sur une seule tige. Or 9 = 10 − 1. On retire 1 sur les unités, puis on ajoute 1 sur les dizaines (la retenue). 9 et 1 sont « grands amis » : leur somme fait 10. Ordre standard : on retire d\'abord le complément, ensuite on pose la retenue à gauche.',
        demos: [{ depart: 3, op: '+', n: 9 }, { depart: 4, op: '+', n: 8 }],
      },
      {
        id: 'p4-2', titre: 'Ajouter 7 et 6 avec le grand ami', cibles: D('+', [7, 6], 'grand'), chiffres: 1,
        pourquoi: '7 = 10 − 3 et 6 = 10 − 4. Sur 8, ajouter 7 : on retire 3 (l\'index descend 3 terrestres), puis le pouce monte 1 terrestre sur les dizaines.',
        demos: [{ depart: 8, op: '+', n: 7 }, { depart: 4, op: '+', n: 6 }],
      },
      {
        id: 'p4-3', titre: 'Ajouter 5 avec le grand ami', cibles: D('+', [5], 'grand'), chiffres: 1,
        pourquoi: '5 = 10 − 5. Si la céleste est déjà abaissée, on la relève (−5) et on ajoute 1 sur les dizaines.',
        demos: [{ depart: 7, op: '+', n: 5 }],
      },
      {
        id: 'p4-4', titre: 'Ajouter 4 à 1 avec le grand ami', cibles: D('+', [4, 3, 2, 1], 'grand'), chiffres: 1,
        pourquoi: '4 = 10 − 6, 3 = 10 − 7, 2 = 10 − 8, 1 = 10 − 9. Le complément à retirer est grand : on relève la céleste et on descend des terrestres d\'un même geste, puis on pose la retenue.',
        demos: [{ depart: 8, op: '+', n: 4 }, { depart: 9, op: '+', n: 1 }],
      },
      {
        id: 'p4-5', titre: 'Retirer 9 et 8 avec le grand ami', cibles: D('-', [9, 8], 'grand'), chiffres: 1,
        pourquoi: 'Sur 12, retirer 9 : les unités ne valent que 2. Or −9 = −10 + 1. On retire d\'abord 1 sur les dizaines (l\'emprunt), puis on ajoute 1 sur les unités. En soustraction, l\'ordre s\'inverse : on emprunte d\'abord à gauche, ensuite on ajoute le complément.',
        demos: [{ depart: 12, op: '-', n: 9 }, { depart: 11, op: '-', n: 8 }],
      },
      {
        id: 'p4-6', titre: 'Retirer 7 et 6 avec le grand ami', cibles: D('-', [7, 6], 'grand'), chiffres: 1,
        pourquoi: '−7 = −10 + 3 et −6 = −10 + 4. Sur 15, retirer 7 : l\'index retire 1 dizaine, puis le pouce monte 3 terrestres sur les unités.',
        demos: [{ depart: 15, op: '-', n: 7 }, { depart: 10, op: '-', n: 6 }],
      },
      {
        id: 'p4-7', titre: 'Retirer 5 avec le grand ami', cibles: D('-', [5], 'grand'), chiffres: 1,
        pourquoi: '−5 = −10 + 5. Sur 13, retirer 5 : on retire 1 dizaine, puis on abaisse la céleste sur les unités.',
        demos: [{ depart: 13, op: '-', n: 5 }],
      },
      {
        id: 'p4-8', titre: 'Retirer 4 à 1 avec le grand ami', cibles: D('-', [4, 3, 2, 1], 'grand'), chiffres: 1,
        pourquoi: '−4 = −10 + 6 … −1 = −10 + 9. On emprunte 1 dizaine, puis on ajoute le grand complément en une pincée (céleste + terrestres).',
        demos: [{ depart: 11, op: '-', n: 4 }, { depart: 10, op: '-', n: 1 }],
      },
      {
        id: 'p4-9', titre: 'Révision : grands amis mélangés', cibles: GRAND, chiffres: 1, termes: 3,
        pourquoi: 'Repérez le passage de la dizaine avant de bouger : si la tige ne peut pas absorber le chiffre, c\'est le grand ami. Complément d\'abord en addition, emprunt d\'abord en soustraction.',
        demos: [{ depart: 4, op: '+', n: 8 }, { depart: 15, op: '-', n: 7 }],
      },
    ],
  },
  {
    id: 'p5',
    titre: 'Les combinaisons',
    sousPaliers: [
      {
        id: 'p5-1', titre: 'Ajouter 6 à 9 : grand ami et petit ami', cibles: MIXTE.filter((c) => c.startsWith('+')), chiffres: 1,
        pourquoi: 'Sur 5, ajouter 6 : grand ami, il faut retirer 4… mais aucune terrestre n\'est posée. Le retrait de 4 se fait alors par le petit ami : +1 − 5. Geste complet : pouce +1, index relève la céleste, puis pouce +1 sur les dizaines. C\'est le cas le plus long, il faut le décomposer calmement.',
        demos: [{ depart: 5, op: '+', n: 6 }, { depart: 6, op: '+', n: 8 }],
      },
      {
        id: 'p5-2', titre: 'Retirer 6 à 9 : grand ami et petit ami', cibles: MIXTE.filter((c) => c.startsWith('-')), chiffres: 1,
        pourquoi: 'Sur 13, retirer 8 : on emprunte 1 dizaine, puis il faut ajouter 2 sur un 3… pas assez de terrestres : petit ami, +5 − 3. Geste complet : index −1 sur les dizaines, index abaisse la céleste, index descend 3 terrestres.',
        demos: [{ depart: 13, op: '-', n: 8 }, { depart: 12, op: '-', n: 6 }],
      },
      {
        id: 'p5-3', titre: 'Retenues et emprunts en cascade', cibles: ['cascade+', 'cascade-'], chiffres: 2,
        pourquoi: 'Quand la retenue tombe sur un 9, ce 9 ne peut pas recevoir 1 : on applique le grand ami à cette tige aussi (−9, puis +1 plus à gauche). C\'est la même règle, simplement répétée. De même, un emprunt sur un 0 transforme ce 0 en 9 et continue à gauche.',
        demos: [{ depart: 99, op: '+', n: 1 }, { depart: 100, op: '-', n: 1 }, { depart: 95, op: '+', n: 17 }],
      },
      {
        id: 'p5-4', titre: 'Révision générale à 2 chiffres', cibles: TOUS_LES_MOTIFS, chiffres: 2, termes: 2,
        pourquoi: 'Tous les gestes sont maintenant permis. Chaque tige choisit le sien : direct, petit ami, grand ami, ou combinaison.',
        demos: [{ depart: 47, op: '+', n: 68 }],
      },
    ],
  },
  {
    id: 'p6',
    titre: 'Vers le calcul courant',
    sousPaliers: [
      {
        id: 'p6-1', titre: 'Chaînes de 4 nombres à 1 chiffre',
        // Pas de cascade possible avec des nombres d'un seul chiffre.
        cibles: TOUS_LES_MOTIFS.filter((c) => !c.startsWith('cascade')), chiffres: 1, termes: 3,
        pourquoi: 'On enchaîne sans s\'arrêter, comme dans un vrai calcul. Lisez le nombre suivant pendant que les doigts terminent le geste en cours.',
        demos: [{ depart: 7, op: '+', n: 8 }],
      },
      {
        id: 'p6-2', titre: 'Chaînes de 4 nombres à 2 chiffres', cibles: TOUS_LES_MOTIFS, chiffres: 2, termes: 3,
        pourquoi: 'Même travail avec deux tiges : gauche à droite, un geste par tige, sans retour en arrière.',
        demos: [{ depart: 38, op: '+', n: 76 }],
      },
    ],
  },
];

/**
 * Liste à plat des sous-paliers, enrichis :
 *  - autorises : Set des motifs permis (cibles cumulées depuis le début du parcours)
 *  - palier    : référence au palier parent
 *  - ordre     : position dans le parcours (0, 1, 2…)
 */
export const SOUS_PALIERS = (() => {
  const liste = [];
  const cumul = new Set();
  for (const palier of PALIERS) {
    for (const sp of palier.sousPaliers) {
      sp.cibles.forEach((c) => cumul.add(c));
      liste.push({ termes: 1, ...sp, autorises: new Set(cumul), palier, ordre: liste.length });
    }
  }
  return liste;
})();

export const sousPalier = (id) => SOUS_PALIERS.find((s) => s.id === id);
