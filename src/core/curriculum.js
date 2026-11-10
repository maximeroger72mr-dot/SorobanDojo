/**
 * Parcours des leçons guidées : paliers et sous-paliers.
 *
 * Les exercices se font sur un VRAI soroban : l'application affiche la colonne (ou l'opération),
 * l'élève tape le résultat, l'application corrige et explique si besoin.
 *
 * Champs d'un sous-palier :
 *  - type        : 'addsub' (colonne), 'mul' ou 'div'
 *  - cibles      : motifs travaillés (chaque ligne en contient au moins un quand c'est possible)
 *  - cumul       : false (défaut) → seuls les gestes directs + les cibles sont permis : on répète
 *                  CE geste et aucun autre ami ; true → tous les motifs déjà vus sont permis (révision)
 *  - chiffres    : chiffres par ligne ; lignes : lignes par colonne (la 1re est posée)
 *  - repetitions : nombre de colonnes justes ou fausses à faire avant le mini-test
 *  - pourquoi    : explication du geste ; demos : exemples animés
 *  - type 'theorie'  : leçon à lire (Leçon 0), validée par « J'ai lu et compris » ;
 *  - type 'table'    : produit de la table à écrire sur DEUX chiffres (2 × 3 = « 06 ») ;
 *  - types décimaux  : 'addsubdec', 'muldec', 'divdec', 'divarrondi', 'arrondiunite', placement op 'muldec' ;
 *  - type 'placement': réflexe de position (sur quelle tige commence la multiplication / division) ;
 *  - zeros : exercices avec zéros internes ; chiffresMax : alterne entre chiffres et chiffresMax ;
 *  - type 'anzan' : calcul mental en flash (nombres montrés un par un : `duree` secondes chacun),
 *                   avec les gestes vus jusqu'à la leçon `apres` ; testMin : réussites exigées au mini-test ;
 *                   lignesDepart : longueur de chaîne au départ (2 par défaut), elle s'allonge ensuite
 *  - type 'photo' : un soroban s'affiche `duree` secondes, on tape le nombre (visualisation) ;
 *  - type 'tenir' : un nombre en chiffres, on le pose sur le soroban imaginaire `tenir` secondes,
 *                   puis on compare avec le vrai (auto-évalué : O / N) ;
 *  - palier `mental` : piste parallèle (anzan), qui ne bloque pas le parcours soroban ; chaque
 *                   leçon s'ouvre quand la leçon soroban `apres` est validée.
 *
 * Pour modifier la progression : éditer PALIERS. Tout le reste (déblocage, génération,
 * révisions, suggestions) s'adapte.
 */

import { D, famille, TOUS_LES_MOTIFS } from './motifs.js';
import { genererColonne, genererColonneVariee, creerMemoire } from './generateur.js';
import {
  genererMultiplication, genererDivision, aideDivision, genererPlacement, genererPlacementDecimal,
  genererColonneDecimale, genererMultiplicationDecimaleSimple, genererDivisionDecimaleExacte, genererDivisionDecimale, genererMultiplicationDecimale,
} from './multiplication.js';

const DIRECT = famille('direct');
const PETIT = famille('petit');
const GRAND = famille('grand');
const MIXTE = famille('mixte');
const plus = (cles) => cles.filter((c) => c.startsWith('+'));
const moins = (cles) => cles.filter((c) => c.startsWith('-'));

/** Mini-test : nombre d'exercices et minimum de réussites. */
export const TEST = { exercices: 15, reussitesMin: 13 };

export const PALIERS = [
  {
    id: 'p0', titre: 'Bien commencer',
    sousPaliers: [
      { id: 'p0-1', titre: 'Leçon 0 : tenue, lecture et vitesse', type: 'theorie', repetitions: 0,
        pourquoi: 'Quelques réglages qui changent tout, à lire une fois puis à garder en tête.',
        sections: [
          ['Le soroban', 'Posé à plat, la barre horizontale devant vous, les boules célestes en haut. Choisissez une tige marquée d\'un point, vers la droite, comme tige des unités : tous les nombres s\'alignent dessus. À l\'écran, l\'application montre moins de tiges que votre soroban (13, 17, 23 ou 27 selon les modèles) et place les unités sur la tige la plus à droite : sur le vôtre, gardez votre tige des unités et alignez-vous dessus.'],
          ['La main gauche', 'Elle tient le bord gauche du soroban pour qu\'il ne glisse pas, sans cacher les tiges. En multiplication et en division, son index sert de repère : il marque la tige où l\'on travaille, pour ne jamais perdre sa place.'],
          ['La main droite et le crayon', 'Seuls le pouce et l\'index bougent les boules : le pouce MONTE les terrestres ; l\'index les DESCEND et manœuvre la céleste dans les deux sens. Le crayon reste dans la main droite, serré entre la paume et l\'annulaire (ou l\'auriculaire), pointe vers l\'extérieur : on écrit le résultat sans le reprendre et sans lâcher le soroban.'],
          ['Gaucher ?', 'Inversez simplement les mains : la main gauche manipule (pouce et index, mêmes rôles), la main droite tient le bord droit et sert de repère. Les règles de calcul ne changent pas : on lit et on pose toujours les nombres de gauche à droite. Beaucoup de gauchers gardent toutefois la main droite pour les boules, comme on l\'enseigne au Japon : essayez les deux une semaine, puis gardez la plus naturelle.'],
          ['Lire une colonne : nombre par nombre', 'Pour 300 + 156 + 228, on pose 300, puis on AJOUTE 156 en entier (1 aux centaines, 5 aux dizaines, 6 aux unités, de gauche à droite), puis 228 de la même façon. On ne fait PAS colonne par colonne comme sur papier : le total est sur le soroban, il suffit d\'ajouter chaque nombre tel qu\'on le lit.'],
          ['Pourquoi de gauche à droite', 'On lit un nombre de gauche à droite : on le pose dans le même ordre, sans rien retenir de tête. Les retenues tombent sur des tiges déjà traitées, elles s\'ajoutent simplement.'],
          ['Remise à zéro', 'Inclinez le soroban vers vous (les terrestres tombent), reposez-le à plat, puis faites glisser l\'index de gauche à droite le long de la barre pour écarter les célestes. Deux secondes.'],
        ],
        pourquoiCaMarche: [
          ['La mémoire de travail est petite', 'De tête, on ne garde qu\'un petit nombre d\'éléments à la fois (environ 4 selon les études de psychologie cognitive, avec de grandes différences entre personnes). Sur papier, retenues et chiffres intermédiaires l\'encombrent vite. Le soroban la décharge : le total est posé sur les boules, la tête n\'a rien à retenir à part le nombre qu\'on lit.'],
          ['Pourquoi 5 et 4 boules', 'L\'œil reconnaît d\'un coup, sans compter, jusqu\'à 3 ou 4 objets (c\'est la « subitisation », bien étudiée en psychologie). Une tige se lit donc en un regard : la céleste (5 ou rien) plus un petit groupe de terrestres. C\'est aussi pour cela qu\'on lit les grands nombres par tranches de 3 chiffres.'],
          ['Du geste au réflexe', 'Au début, chaque ami demande une réflexion (« 4 = 5 − 1 »). Avec la répétition, le cerveau transforme cette règle en geste automatique, qui ne coûte plus d\'attention. D\'où les volumes d\'entraînement, et la vitesse qui vient d\'elle-même : on ne peut pas aller vite tant qu\'on réfléchit.'],
          ['Pourquoi les révisions espacées', 'Revoir une leçon juste avant de l\'oublier (après 1, 3, 7, 14, 30 jours) la fixe bien mieux que de la répéter le même jour. C\'est le rôle des révisions du jour.'],
          ['Pourquoi mélanger ensuite', 'Répéter un geste en bloc l\'installe vite ; le mélanger ensuite avec les autres oblige à le CHOISIR, comme dans un vrai calcul. C\'est ce qui le rend durable : d\'où les séances de consolidation après chaque leçon.'],
          ['Et la tête dans tout ça ?', 'À force de manipuler, l\'image du soroban s\'installe dans la tête : c\'est l\'anzan. Le calcul mental des bons joueurs n\'est pas un don, c\'est ce soroban imaginaire, construit geste après geste.'],
        ],
        // Vérification : on valide la leçon en répondant juste à toutes les questions.
        quiz: [
          { q: 'Quel doigt fait MONTER les boules terrestres ?', choix: ['Le pouce', 'L\'index', 'Le majeur'], bonne: 0, pourquoi: 'Le pouce monte les terrestres ; l\'index les descend et manœuvre la céleste (« La main droite et le crayon »).' },
          { q: 'Et l\'index, que fait-il ?', choix: ['Il descend les terrestres et manœuvre la céleste', 'Il monte les terrestres', 'Il ne sert qu\'à tenir le crayon'], bonne: 0, pourquoi: 'L\'index DESCEND les terrestres et bouge la céleste dans les deux sens.' },
          { q: 'Quelle tige prendre comme tige des unités ?', choix: ['Une tige marquée d\'un point, vers la droite', 'La tige la plus à gauche', 'N\'importe laquelle, elle change à chaque calcul'], bonne: 0, pourquoi: 'Une tige marquée d\'un point, vers la droite, toujours la même : tous les nombres s\'alignent dessus (« Le soroban »).' },
          { q: 'Pour 300 + 156, comment pose-t-on 156 ?', choix: ['En entier, de gauche à droite : 1, puis 5, puis 6', 'Colonne par colonne, en partant des unités, comme sur papier', 'On calcule le total de tête, puis on le pose'], bonne: 0, pourquoi: 'Nombre par nombre, de gauche à droite : le total est sur le soroban, la tête n\'a rien à retenir (« Lire une colonne »).' },
          { q: 'À quoi sert la main gauche ?', choix: ['Elle tient le bord du soroban et sert de repère', 'Elle bouge les boules célestes', 'Elle tient le crayon'], bonne: 0, pourquoi: 'Elle tient le soroban sans cacher les tiges, et son index marque la tige de travail en multiplication et en division.' },
          { q: 'Comment remettre le soroban à zéro ?', choix: ['L\'incliner vers soi, le reposer, puis glisser l\'index le long de la barre', 'Le secouer', 'Repousser chaque boule une à une'], bonne: 0, pourquoi: 'Inclinez-le (les terrestres tombent), reposez-le, puis écartez les célestes d\'un glissé de l\'index : deux secondes.' },
        ],
        demos: [] },
      { id: 'p0-2', titre: 'Lire et poser un nombre', type: 'lire', repetitions: 30, sansRevision: true,
        pourquoi: 'C\'est la base de tout : une erreur de lecture (céleste prise pour une terrestre, mauvaise tige des unités) ressemble à une erreur de geste, et l\'on retravaille alors ce qui n\'est pas en cause.',
        regles: [
          'Chaque tige porte un chiffre. De droite à gauche : unités, dizaines, centaines…',
          'Seules les boules qui touchent la barre du milieu comptent.',
          'La boule du haut (céleste) vaut 5 ; chacune des 4 boules du bas (terrestres) vaut 1.',
          'Une tige sans boule contre la barre vaut 0.',
          'Les nombres s\'alignent sur la tige des unités (marquée d\'un point) : on les pose de gauche à droite.',
        ],
        demos: [] },
    ],
  },
  {
    id: 'p1', titre: 'Gestes directs',
    sousPaliers: [
      { id: 'p1-1', titre: 'Ajouter 1 à 4', cibles: D('+', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 3, ops: ['+'], repetitions: 20, cumul: true,
        pourquoi: 'Ajouter, c\'est faire monter des boules terrestres contre la barre, avec le POUCE, placé sous les boules : un seul mouvement vers le haut. Condition : les boules nécessaires doivent être libres (en bas).',
        demos: [{ depart: 0, op: '+', n: 3 }, { depart: 1, op: '+', n: 3 }] },
      { id: 'p1-2', titre: 'Retirer 1 à 4', cibles: D('-', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'Retirer, c\'est éloigner des boules terrestres de la barre avec l\'INDEX, qui les pousse vers le bas. Pouce pour monter, index pour descendre : les deux doigts ne se gênent jamais.',
        demos: [{ depart: 4, op: '-', n: 3 }, { depart: 3, op: '-', n: 2 }] },
      { id: 'p1-3', titre: 'Le 5 et la pincée (6 à 9)', cibles: [...D('+', [5, 6, 7, 8, 9], 'direct'), ...D('-', [5, 6, 7, 8, 9], 'direct')], chiffres: 1, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'La boule céleste vaut 5 et c\'est toujours l\'INDEX qui la manœuvre. Pour 6 à 9 (5 + 1 … 5 + 4), on fait UN seul geste : l\'index abaisse la céleste pendant que le pouce monte les terrestres, comme une pince. Pour retirer 6 à 9, c\'est l\'index seul, en UN SEUL mouvement : il relève la céleste et descend les terrestres dans la même trajectoire, sans s\'arrêter entre les deux.',
        demos: [{ depart: 2, op: '+', n: 5 }, { depart: 0, op: '+', n: 7 }, { depart: 9, op: '-', n: 6 }] },
      { id: 'p1-4', titre: 'Gestes directs à 2 et 3 chiffres', cibles: DIRECT, chiffres: 2, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'On calcule NOMBRE PAR NOMBRE et de GAUCHE À DROITE : pour 12 + 35, on pose 12, puis on ajoute 35 en entier, d\'abord le 3 sur les dizaines, puis le 5 sur les unités, dans l\'ordre de lecture. Jamais colonne par colonne comme sur papier : le total courant est sur le soroban. Chaque tige se traite indépendamment.',
        demos: [{ depart: 12, op: '+', n: 35 }, { depart: 87, op: '-', n: 32 }] },
    ],
  },
  {
    id: 'p2', titre: 'Petits amis (compléments à 5)',
    sousPaliers: [
      { id: 'p2-0', titre: 'Les paires qui font 5', type: 'complement', cible: 5, repetitions: 20, testNombre: 20, testMin: 19, testSecondes: 60, sansRevision: true,
        pourquoi: 'Les petits amis reposent sur les paires qui font 5 : 1 et 4, 2 et 3. Au moment du geste, le complément doit venir tout seul, sinon la main s\'arrête et l\'on finit par calculer de tête.',
        demos: [] },
      { id: 'p2-1', titre: '+4 et +3', cibles: D('+', [4, 3], 'petit'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 3, ajouter 4 : il ne reste qu\'une terrestre libre. Astuce : 4 = 5 − 1. L\'index abaisse la céleste (+5), puis descend 1 terrestre (−1). 1 et 4 sont « petits amis » (leur somme fait 5), de même 2 et 3.',
        demos: [{ depart: 3, op: '+', n: 4 }, { depart: 2, op: '+', n: 3 }] },
      { id: 'p2-2', titre: '+2 et +1', cibles: D('+', [2, 1], 'petit'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '2 = 5 − 3 et 1 = 5 − 4. Sur 4, ajouter 1 : l\'index abaisse la céleste et descend les 4 terrestres.',
        demos: [{ depart: 4, op: '+', n: 1 }, { depart: 3, op: '+', n: 2 }] },
      { id: 'p2-3', titre: 'Petits amis en addition, 2 et 3 chiffres', cibles: D('+', [1, 2, 3, 4], 'petit'), chiffres: 2, lignes: 5, repetitions: 50,
        pourquoi: 'Le petit ami peut tomber sur n\'importe quelle tige. Toujours de gauche à droite : chaque tige choisit son geste, direct ou petit ami.',
        demos: [{ depart: 34, op: '+', n: 43 }] },
      { id: 'p2-4', titre: '−4 et −3', cibles: D('-', [4, 3], 'petit'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 5, retirer 4 : aucune terrestre n\'est contre la barre. −4 = +1 − 5 : le pouce monte 1 terrestre, puis l\'index relève la céleste. On ajoute d\'abord le petit ami, puis on enlève le 5.',
        demos: [{ depart: 5, op: '-', n: 4 }, { depart: 6, op: '-', n: 3 }] },
      { id: 'p2-5', titre: '−2 et −1', cibles: D('-', [2, 1], 'petit'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '−2 = +3 − 5 et −1 = +4 − 5. Sur 5, retirer 1 : le pouce monte les 4 terrestres, l\'index relève la céleste.',
        demos: [{ depart: 5, op: '-', n: 1 }, { depart: 6, op: '-', n: 2 }] },
      { id: 'p2-6', titre: 'Petits amis en soustraction, 2 et 3 chiffres', cibles: D('-', [1, 2, 3, 4], 'petit'), chiffres: 2, lignes: 5, repetitions: 50,
        pourquoi: 'Même geste sur chaque tige concernée, de gauche à droite.',
        demos: [{ depart: 65, op: '-', n: 32 }] },
      { id: 'p2-7', titre: 'Tous les petits amis, 3 chiffres', cibles: PETIT, chiffres: 3, lignes: 5, repetitions: 50,
        pourquoi: 'Additions et soustractions mélangées : si les boules manquent sur une tige, le petit ami s\'impose. Avec la répétition, le geste devient un réflexe associé au chiffre.',
        demos: [{ depart: 342, op: '+', n: 413 }] },
    ],
  },
  {
    id: 'p3', titre: 'Grands amis en addition (compléments à 10)',
    sousPaliers: [
      { id: 'p3-0', titre: 'Les paires qui font 10', type: 'complement', cible: 10, repetitions: 20, testNombre: 20, testMin: 19, testSecondes: 60, sansRevision: true,
        pourquoi: 'Les grands amis reposent sur les paires qui font 10 : 1 et 9, 2 et 8, 3 et 7, 4 et 6, 5 et 5. Si l\'on hésite (« 10 − 7, ça fait… 3 »), la main s\'arrête : automatisez-les avant le geste.',
        demos: [] },
      { id: 'p3-1', titre: '+9 et +8', cibles: D('+', [9, 8], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 3, ajouter 9 donnerait 12 : impossible sur une tige. 9 = 10 − 1 : on retire 1 sur les unités, puis on ajoute 1 sur les dizaines (la retenue). 9 et 1 sont « grands amis » (leur somme fait 10). Ordre standard : d\'abord le complément, ensuite la retenue.',
        demos: [{ depart: 3, op: '+', n: 9 }, { depart: 4, op: '+', n: 8 }] },
      { id: 'p3-2', titre: '+7 et +6', cibles: D('+', [7, 6], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '7 = 10 − 3 et 6 = 10 − 4. Sur 8, ajouter 7 : l\'index descend 3 terrestres, puis le pouce monte 1 terrestre sur les dizaines.',
        demos: [{ depart: 8, op: '+', n: 7 }, { depart: 4, op: '+', n: 6 }] },
      { id: 'p3-3', titre: '+5 à +1', cibles: D('+', [5, 4, 3, 2, 1], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '5 = 10 − 5, 4 = 10 − 6 … 1 = 10 − 9. Le complément à retirer contient la céleste : l\'index la relève (et descend les terrestres d\'un même geste), puis la retenue.',
        demos: [{ depart: 7, op: '+', n: 5 }, { depart: 8, op: '+', n: 4 }, { depart: 9, op: '+', n: 1 }] },
      { id: 'p3-4', titre: 'Grands amis en addition, 2 et 3 chiffres', cibles: plus(GRAND), chiffres: 2, lignes: 5, repetitions: 50,
        pourquoi: 'La retenue tombe sur la tige de gauche, déjà calculée : c\'est pour cela qu\'on travaille de gauche à droite, la retenue s\'ajoute simplement.',
        demos: [{ depart: 39, op: '+', n: 85 }] },
    ],
  },
  {
    id: 'p4', titre: 'Grands amis en soustraction',
    sousPaliers: [
      { id: 'p4-1', titre: '−9 et −8', cibles: D('-', [9, 8], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 12, retirer 9 : les unités ne valent que 2. −9 = −10 + 1 : on retire d\'abord 1 sur les dizaines (l\'emprunt), puis on ajoute 1 sur les unités. En soustraction, l\'ordre s\'inverse : l\'emprunt d\'abord, le complément ensuite.',
        demos: [{ depart: 12, op: '-', n: 9 }, { depart: 11, op: '-', n: 8 }] },
      { id: 'p4-2', titre: '−7 et −6', cibles: D('-', [7, 6], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '−7 = −10 + 3 et −6 = −10 + 4. Sur 15, retirer 7 : l\'index retire 1 dizaine, puis le pouce monte 3 terrestres sur les unités.',
        demos: [{ depart: 15, op: '-', n: 7 }, { depart: 10, op: '-', n: 6 }] },
      { id: 'p4-3', titre: '−5 à −1', cibles: D('-', [5, 4, 3, 2, 1], 'grand'), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: '−5 = −10 + 5 … −1 = −10 + 9. On emprunte 1 dizaine, puis on ajoute le grand complément (céleste, ou pincée céleste + terrestres).',
        demos: [{ depart: 13, op: '-', n: 5 }, { depart: 10, op: '-', n: 1 }] },
      { id: 'p4-4', titre: 'Grands amis en soustraction, 2 et 3 chiffres', cibles: moins(GRAND), chiffres: 2, lignes: 5, repetitions: 50,
        pourquoi: 'L\'emprunt se prend sur la tige de gauche, déjà calculée. Toujours de gauche à droite.',
        demos: [{ depart: 95, op: '-', n: 17 }] },
      { id: 'p4-5', titre: 'Tous les grands amis, 3 chiffres', cibles: GRAND, chiffres: 3, lignes: 5, repetitions: 50,
        pourquoi: 'Repérez le passage de la dizaine avant de bouger : si la tige ne peut pas absorber le chiffre, c\'est le grand ami. Complément d\'abord en addition, emprunt d\'abord en soustraction.',
        demos: [{ depart: 876, op: '+', n: 285 }, { depart: 952, op: '-', n: 663 }] },
    ],
  },
  {
    id: 'p5', titre: 'Combinaisons et révision générale',
    sousPaliers: [
      { id: 'p5-1', titre: '+6 à +9 combinés (grand ami + petit ami)', cibles: plus(MIXTE), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 5, ajouter 6 : grand ami, il faut retirer 4… mais aucune terrestre n\'est posée. Le −4 se fait par le petit ami (+1 −5). Geste complet : pouce +1, index relève la céleste, puis pouce +1 sur les dizaines.',
        demos: [{ depart: 5, op: '+', n: 6 }, { depart: 6, op: '+', n: 8 }] },
      { id: 'p5-2', titre: '−6 à −9 combinés', cibles: moins(MIXTE), chiffres: 1, lignes: 5, repetitions: 50,
        pourquoi: 'Sur 13, retirer 8 : on emprunte 1 dizaine, puis il faut ajouter 2 sur un 3 : pas assez de terrestres, petit ami +5 −3. Geste : index −1 sur les dizaines, index abaisse la céleste, index descend 3 terrestres.',
        demos: [{ depart: 13, op: '-', n: 8 }, { depart: 12, op: '-', n: 6 }] },
      { id: 'p5-3', titre: 'Combinaisons, 2 et 3 chiffres', cibles: MIXTE, chiffres: 2, lignes: 5, repetitions: 50,
        pourquoi: 'Les combinaisons arrivent sur n\'importe quelle tige. Décomposez calmement : grand ami d\'abord, et son complément par le petit ami.',
        demos: [{ depart: 56, op: '+', n: 67 }] },
      { id: 'p5-4', titre: 'Retenues et emprunts en cascade', cibles: ['cascade+', 'cascade-'], chiffres: 2, lignes: 4, repetitions: 30, cumul: true,
        pourquoi: 'Une retenue qui tombe sur un 9 : ce 9 devient 0 (grand ami, −9) et la retenue continue plus à gauche. Un emprunt sur un 0 le transforme en 9 et continue. C\'est la même règle, répétée.',
        demos: [{ depart: 99, op: '+', n: 1 }, { depart: 100, op: '-', n: 1 }, { depart: 95, op: '+', n: 17 }] },
      // Mini-test de 20 colonnes (17 justes) : 15 ne suffisent pas à poser les 54 gestes.
      { id: 'p5-5', titre: 'Révision générale, 3 chiffres', cibles: TOUS_LES_MOTIFS, chiffres: 3, lignes: 5, repetitions: 50, cumul: true, testNombre: 20, testMin: 17,
        pourquoi: 'Tous les gestes sont permis : chaque tige choisit le sien. C\'est le calcul courant.',
        demos: [{ depart: 478, op: '+', n: 685 }] },
      { id: 'p5-6', titre: 'Passer une épreuve : la stratégie', type: 'theorie', repetitions: 0,
        pourquoi: 'Une épreuve ne se gagne pas seulement avec de bons gestes : il faut aussi savoir par où commencer, quoi laisser, et comment ne pas perdre de points en recopiant. À lire avant votre premier passage de kyū.',
        sections: [
          ['Un seul chronomètre', 'Le temps est donné pour TOUT le sujet (20 minutes du 10e au 7e kyū, 30 minutes ensuite) : les additions et soustractions, les multiplications, les divisions. Vous passez d\'une partie à l\'autre quand vous voulez. Il n\'y a aucun point négatif : une réponse fausse vaut zéro, comme une case vide.'],
          ['Viser le seuil, pas la perfection', 'Il faut 70 % des points (80 % à partir du 3e kyū). Vous pouvez donc laisser des problèmes. Mieux vaut 8 colonnes justes que 10 colonnes bâclées : chaque colonne vaut autant, et une colonne fausse a coûté le même temps qu\'une juste.'],
          ['Par où commencer', 'Commencez par la partie où vous êtes le plus sûr : elle rapporte vite et met la main en route. Gardez pour la fin celle qui vous coûte le plus. Fixez-vous une heure de bascule (par exemple : à mi-temps, je quitte les colonnes), et tenez-la.'],
          ['Sauter sans regret', 'Vous perdez votre place, une ligne vous échappe, le soroban vous paraît faux : n\'essayez pas de « rattraper ». Remettez à zéro et recommencez la colonne une fois ; si cela se reproduit, passez à la suivante. S\'acharner sur un problème en coûte deux.'],
          ['La remise à zéro compte', 'Entre deux problèmes : incliner, reposer, glisser l\'index. Deux secondes, toujours le même geste. Une boule oubliée de la colonne précédente fausse la suivante, et c\'est l\'erreur la plus bête de l\'épreuve.'],
          ['Recopier sans se tromper', 'Lisez le résultat sur le soroban de gauche à droite, par tranches de 3 chiffres, et écrivez-le dans le même mouvement, crayon déjà en main. Vérifiez seulement le nombre de chiffres : un chiffre en trop ou en moins se voit d\'un coup d\'œil.'],
          ['L\'allure', 'L\'écran des épreuves indique, pour chaque grade, la cadence à tenir et la vôtre. Pendant une épreuve d\'entraînement, vous pouvez afficher votre avance ou votre retard. Le jour où vous voulez vous tester pour de bon, cochez « Examen pur » : le sujet, le temps, et rien d\'autre.'],
          ['S\'il reste du temps', 'Refaites d\'abord les problèmes sautés. Ensuite seulement, vérifiez ceux dont vous doutiez en les recalculant entièrement : relire un résultat ne détecte rien.'],
        ],
        quiz: [
          { q: 'Une réponse fausse à l\'examen, c\'est :', choix: ['Zéro point, comme une case vide', 'Des points retirés', 'L\'élimination'], bonne: 0, pourquoi: 'Aucun point négatif : fausse ou vide, la case vaut zéro. On peut donc tenter, mais pas bâcler.' },
          { q: 'Vous perdez votre place au milieu d\'une colonne. Que faire ?', choix: ['Remettre à zéro et la recommencer une fois, sinon passer', 'Essayer de retrouver où vous en étiez', 'Deviner la fin'], bonne: 0, pourquoi: 'On ne « rattrape » pas une colonne : on la refait une fois, ou on passe à la suivante (« Sauter sans regret »).' },
          { q: 'Par quelle partie commencer ?', choix: ['Celle où vous êtes le plus sûr', 'Toujours la plus difficile', 'Peu importe'], bonne: 0, pourquoi: 'La partie la plus sûre rapporte vite et met la main en route ; la plus coûteuse se garde pour la fin.' },
          { q: 'Il vous reste deux minutes et tout est rempli. Que faire ?', choix: ['Recalculer entièrement un problème dont vous doutiez', 'Relire les résultats écrits', 'Poser le crayon'], bonne: 0, pourquoi: 'Relire un résultat ne détecte rien : seule une colonne recalculée confirme ou corrige.' },
        ],
        demos: [] },
    ],
  },
  {
    id: 'p6', titre: 'Multiplication (両落とし)',
    sousPaliers: [
      { id: 'p6-a', titre: '1 × 1 : un produit, deux tiges (« 06 »)', type: 'table', repetitions: 40,
        pourquoi: 'En multiplication japonaise, chaque produit de la table occupe TOUJOURS deux tiges : la dizaine et l\'unité. 7 × 8 = « 56 », mais 2 × 3 = « 06 » : la tige des dizaines reste vide, et c\'est elle qui garde le décalage juste pour la suite. Ici, tapez chaque produit sur deux chiffres (06, 00, 56) : c\'est la convention à ancrer, et en même temps un entraînement de vitesse sur la table.',
        demos: [{ a: 2, b: 3 }, { a: 7, b: 8 }] },
      { id: 'p6-0', titre: 'Où poser le premier produit ?', type: 'placement', op: 'mul', repetitions: 40,
        pourquoi: 'Avant de multiplier, il faut savoir OÙ commencer, sans réfléchir. Règle : comptez les chiffres des deux nombres (37 × 85 : 2 + 2 = 4). La dizaine du premier produit se pose sur la 4e tige en comptant la tige des unités comme la 1re. Cliquez la bonne tige le plus vite possible : ce réflexe doit devenir automatique, c\'est lui qui évite les résultats décalés. L\'index gauche se pose ensuite sur cette tige et la marque pendant tout le calcul.',
        demos: [] },
      { id: 'p6-1', titre: '2 chiffres × 1 chiffre', type: 'mul', m: 2, n: 1, repetitions: 30,
        pourquoi: 'Méthode japonaise actuelle, 両落とし (« les deux tombent ») : on ne pose ni le multiplicande ni le multiplicateur, on les lit sur la feuille. On ne pose que les produits de la table, chacun sur DEUX tiges (dizaine, unité ; 2 × 3 s\'écrit « 06 »). On commence à gauche. Position du premier produit : 2 + 1 = 3 chiffres au total, donc sa dizaine va sur la 3e tige en partant des unités. Chaque produit suivant se décale d\'une tige vers la droite.',
        demos: [{ a: 37, b: 8 }, { a: 23, b: 3 }] },
      { id: 'p6-2', titre: '3 et 4 chiffres × 1 chiffre', type: 'mul', m: 3, n: 1, repetitions: 30,
        pourquoi: 'Même principe : 3 + 1 = 4 chiffres, donc premier produit sur la 4e tige (sa dizaine). Exemple 372 × 8 : 24, puis 56 une tige plus à droite, puis 16.',
        demos: [{ a: 372, b: 8 }] },
      { id: 'p6-3', titre: '2 chiffres × 2 chiffres', type: 'mul', m: 2, n: 2, repetitions: 30,
        pourquoi: 'Pour 37 × 85 : 4 chiffres au total. On prend le 3 et on le multiplie par 8 puis par 5 (24, puis 15 une tige à droite) ; on passe au 7 : 7 × 8 = 56 se pose là où commençait le 15 (une tige à droite du 24), puis 7 × 5 = 35.',
        demos: [{ a: 37, b: 85 }] },
      { id: 'p6-4', titre: '3 chiffres × 2 chiffres', type: 'mul', m: 3, n: 2, repetitions: 30,
        pourquoi: '5 chiffres au total : premier produit sur la 5e tige. Chaque chiffre du multiplicande commence une tige plus à droite que le précédent.',
        demos: [{ a: 246, b: 37 }] },
    ],
  },
  {
    id: 'p7', titre: 'Division (片落とし)',
    sousPaliers: [
      { id: 'p7-0', titre: 'Où poser le premier chiffre du quotient ?', type: 'placement', op: 'div', repetitions: 40,
        pourquoi: 'Le dividende est posé à droite. On compare son début au diviseur : s\'il est plus grand ou égal (156 ÷ 12 : 15 ≥ 12), le premier chiffre du quotient se pose DEUX tiges à gauche du premier chiffre du dividende ; s\'il est plus petit (108 ÷ 12 : 10 < 12), JUSTE à gauche. Cliquez la bonne tige : ce réflexe doit être immédiat. L\'index gauche se pose ensuite sur cette tige.',
        demos: [] },
      { id: 'p7-1', titre: '÷ 1 chiffre, quotient 1 chiffre', type: 'div', nd: 1, nq: 1, repetitions: 30,
        pourquoi: 'Méthode 片落とし : on pose seulement le dividende ; le diviseur se lit sur la feuille. On compare le début du dividende au diviseur : plus grand ou égal → le chiffre du quotient se pose DEUX tiges à gauche (une tige libre) ; plus petit → JUSTE à gauche. Puis on retire le produit (quotient × diviseur, sur deux tiges) juste à droite du quotient.',
        demos: [{ a: 14, b: 2 }, { a: 72, b: 8 }] },
      { id: 'p7-2', titre: '÷ 1 chiffre, quotient 2 et 3 chiffres', type: 'div', nd: 1, nq: 2, repetitions: 30,
        pourquoi: 'On répète pour chaque chiffre du quotient, avec le reste. L\'unité du quotient se trouve 2 tiges à gauche de l\'unité du dividende (1 chiffre au diviseur + 1).',
        demos: [{ a: 156, b: 4 }] },
      { id: 'p7-e', titre: 'Diviser par 2 chiffres : estimer et corriger', type: 'div', nd: 2, nq: 1, repetitions: 30, corrections: true,
        pourquoi: 'Personne ne connaît la table de 18 : on ESTIME. On arrondit le diviseur à sa dizaine (18 → 20, 43 → 40 ; on arrondit au-dessus dès que le 2e chiffre vaut 5 ou plus) et on divise le début du dividende par ce nombre rond : 144 ÷ 20 ≈ 7. Puis on vérifie avec les vrais produits : 7 × 1 = 7 et 7 × 8 = 56, donc 7 × 18 = 126, qui tient dans 144. On retire 126 : il reste 18, qui n\'est pas plus petit que 18 → l\'estimation était trop petite : on ajoute 1 au quotient (8) et on retire encore 18. Si au contraire le produit ne tient pas (arrondi au-dessous : 112 ÷ 14, 14 ≈ 10 donne 11, on plafonne à 9 ; 9 × 14 = 126 > 112), on diminue de 1 de tête AVANT de poser. En cas de blocage pendant un exercice, le bouton « Je suis bloqué » déroule ce raisonnement et affiche la table du diviseur.',
        demos: [{ a: 144, b: 18 }, { a: 112, b: 14 }, { a: 156, b: 12 }] },
      { id: 'p7-3', titre: '÷ 2 chiffres, quotient 1 chiffre', type: 'div', nd: 2, nq: 1, repetitions: 30,
        pourquoi: 'On compare les deux premiers chiffres du dividende au diviseur entier. Le chiffre du quotient s\'estime exactement comme à la leçon précédente : diviseur arrondi à sa dizaine (12 → 10, 18 → 20), puis vérification avec le vrai produit. On retire ensuite quotient × chaque chiffre du diviseur, en décalant d\'une tige. Si le produit ne peut pas être retiré, le chiffre était trop grand : on le diminue de 1 ; s\'il reste au moins le diviseur, il était trop petit : on ajoute 1.',
        demos: [{ a: 108, b: 12 }] },
      { id: 'p7-4', titre: '÷ 2 chiffres, quotient 2 chiffres', type: 'div', nd: 2, nq: 2, repetitions: 30,
        pourquoi: 'L\'unité du quotient est 3 tiges à gauche de l\'unité du dividende (2 chiffres au diviseur + 1).',
        demos: [{ a: 156, b: 12 }] },
    ],
  },
  {
    id: 'p8', titre: 'Vers le 5e et le 4e kyū',
    sousPaliers: [
      { id: 'p8-t1', titre: 'Transition : 3 chiffres, 6 à 7 lignes', cibles: TOUS_LES_MOTIFS, chiffres: 3, lignes: 6, lignesMax: 7, repetitions: 30, cumul: true,
        pourquoi: 'Avant les 10 lignes : des colonnes un peu plus longues, avec des nombres que vous connaissez déjà. Gardez le même rythme d\'un bout à l\'autre de la colonne.',
        demos: [{ depart: 472, op: '+', n: 358 }] },
      { id: 'p8-t2', titre: 'Transition : 4 chiffres, 6 à 7 lignes', cibles: TOUS_LES_MOTIFS, chiffres: 4, lignes: 6, lignesMax: 7, repetitions: 30, cumul: true,
        pourquoi: 'Le 4e chiffre ajoute une tranche : repérez les milliers avec le point de la barre, lisez le nombre d\'un bloc, posez-le de gauche à droite.',
        demos: [{ depart: 4721, op: '+', n: 3586 }] },
      { id: 'p8-1', titre: 'Additions et soustractions à 4 chiffres, 10 lignes', cibles: TOUS_LES_MOTIFS, chiffres: 4, lignes: 10, repetitions: 30, cumul: true,
        pourquoi: 'Le format des examens : 10 lignes, 4 chiffres. La difficulté n\'est plus le geste mais la lecture et le rythme : lisez chaque nombre d\'un bloc, posez-le de gauche à droite, et lisez déjà le suivant.',
        demos: [{ depart: 4721, op: '+', n: 3586 }] },
      { id: 'p8-2', titre: 'Zéros internes', cibles: TOUS_LES_MOTIFS, chiffres: 4, lignes: 8, repetitions: 30, cumul: true, zeros: true,
        pourquoi: 'Un zéro au milieu d\'un nombre (3 058, 7 040) est le piège n° 1 : on saute une tige de trop ou de moins, et tout le reste est décalé. Le zéro ne se pose pas, mais il se COMPTE : dites-le intérieurement (« trois, zéro, cinq, huit ») et faites avancer le doigt d\'une tige.',
        demos: [{ depart: 3058, op: '+', n: 4070 }] },
      { id: 'p8-3', titre: '5 et 6 chiffres, 10 lignes (endurance)', cibles: TOUS_LES_MOTIFS, chiffres: 5, chiffresMax: 6, lignes: 10, repetitions: 20, cumul: true,
        pourquoi: 'Endurance : 10 lignes de 5 ou 6 chiffres sans perdre le rythme. Repérez les tranches de 3 chiffres avec les points de la barre.',
        demos: [{ depart: 52708, op: '+', n: 39415 }] },
      { id: 'p8-4', titre: 'Multiplication avec des zéros (406 × 7)', type: 'mul', m: 3, n: 1, mMax: 4, zeros: true, repetitions: 30,
        pourquoi: 'Avec 両落とし, un zéro dans un facteur donne un produit « 00 » : on ne pose rien, MAIS on avance d\'une tige. Pour 406 × 7 : 4 × 7 = 28, puis 0 × 7 = 00 (rien, on avance), puis 6 × 7 = 42.',
        demos: [{ a: 406, b: 7 }, { a: 37, b: 208 }] },
      { id: 'p8-5', titre: 'Multiplication 3 × 3 et 4 × 3 chiffres', type: 'mul', m: 3, n: 3, mMax: 4, repetitions: 30,
        pourquoi: 'Même méthode, plus de produits : 6 chiffres au total pour 3 × 3, donc premier produit sur la 6e tige. L\'index gauche avance d\'une tige à chaque chiffre du multiplicande ; les produits du même chiffre glissent d\'une tige chacun.',
        demos: [{ a: 246, b: 375 }] },
      { id: 'p8-6', titre: 'Division : quotient avec un zéro (304)', type: 'div', nd: 1, nq: 3, ndMax: 2, zeros: true, repetitions: 30,
        pourquoi: 'Quand le reste est plus petit que le diviseur, le chiffre du quotient est 0 : la tige reste vide MAIS elle compte, le chiffre suivant se pose une tige plus à droite. Ne « tassez » jamais le quotient.',
        demos: [{ a: 2128, b: 7 }, { a: 3672, b: 12 }] },
      { id: 'p8-7', titre: 'Division par 3 chiffres', type: 'div', nd: 3, nq: 2, repetitions: 30, corrections: true,
        pourquoi: 'Même estimation qu\'avec 2 chiffres : on arrondit le diviseur sur son premier chiffre (243 → 200, 268 → 300), on estime, puis on corrige de ±1 si besoin. On compare les 3 premiers chiffres du dividende au diviseur pour savoir où poser le quotient.',
        demos: [{ a: 5832, b: 243 }] },
    ],
  },
  {
    id: 'pd', titre: 'Décimaux et arrondis',
    sousPaliers: [
      { id: 'pd-1', titre: 'Le point des unités : additions et soustractions de décimaux', type: 'addsubdec', repetitions: 30,
        pourquoi: 'Les points de la barre servent de repère : on choisit l\'un d\'eux comme tige des unités, et TOUTES les virgules s\'alignent dessus. Les décimales se posent sur les tiges à sa droite (dixièmes, centièmes…). Pour 12,5 + 3,075 : 12 avant le point, 5 sur la 1re tige après ; puis 3 sur les unités, 0, 7, 5 sur les trois tiges suivantes. Rien d\'autre ne change : mêmes gestes, mêmes amis.',
        demos: [] },
      { id: 'pd-2', titre: 'Placer un produit décimal (compte des chiffres)', type: 'placement', op: 'muldec', repetitions: 30,
        pourquoi: 'La méthode la plus rapide ne place pas la virgule à la fin : elle pose le premier produit directement au bon endroit. On compte les chiffres de chaque facteur AVEC SIGNE : 37,2 compte 2 (chiffres avant la virgule), 0,85 compte 0, 0,04 compte −1 (un zéro juste après la virgule). On additionne : la dizaine du premier produit va sur la tige de ce rang (2 → 2e tige avant la virgule ; 0 → 1re tige après la virgule ; −1 → 2e tige après). C\'est la règle « m + n » des entiers, prolongée.',
        demos: [] },
      { id: 'pd-3', titre: 'Multiplier des décimaux', type: 'muldec', repetitions: 30,
        pourquoi: 'Compte des chiffres, puis 両落とし exactement comme avec des entiers. Le résultat se lit directement par rapport au point des unités. Vérification rapide : le nombre de décimales du résultat est la somme de celles des facteurs.',
        demos: [] },
      { id: 'pd-4', titre: 'Diviser des décimaux', type: 'divdec', repetitions: 30,
        pourquoi: 'Le quotient a q chiffres avant la virgule, avec q = compte(dividende) − compte(diviseur), plus 1 si le début du dividende est plus grand ou égal au diviseur (le même test que pour poser le premier chiffre). Exemple : 1,56 ÷ 0,12 : 1 − 0 + 1 = 2 chiffres → 13. On divise comme d\'habitude, et on lit le quotient avec ce compte.',
        demos: [] },
      { id: 'pd-5', titre: 'Arrondir au millième', type: 'divarrondi', repetitions: 30,
        pourquoi: 'Pour arrondir au millième, on calcule UNE décimale de plus (la 4e), puis on arrondit. Astuce rapide au soroban : on ajoute 5 sur la tige de cette 4e décimale ; si elle valait 5 ou plus, la retenue monte toute seule sur le millième. On lit ensuite jusqu\'au millième, sans rien effacer.',
        demos: [] },
      { id: 'pd-6', titre: 'Arrondir à l\'unité (les montants)', type: 'arrondiunite', repetitions: 30,
        pourquoi: 'Dans la seconde moitié des multiplications et des divisions d\'examen, les nombres sont des montants : le résultat s\'arrondit à l\'UNITÉ. Même geste que pour le millième, un cran plus haut : on calcule UNE décimale (le dixième), on ajoute 5 sur sa tige, et on lit jusqu\'aux unités. En multiplication, les décimales du produit se posent normalement ; seul le premier chiffre après le point des unités décide de l\'arrondi. Lisez bien la consigne en tête de chaque série : l\'erreur la plus fréquente est d\'arrondir au mauvais rang.',
        demos: [] },
    ],
  },
  {
    id: 'p9', titre: 'Vers le 1er kyū',
    sousPaliers: [
      { id: 'p9-1', titre: '7 et 8 chiffres, 10 lignes', cibles: TOUS_LES_MOTIFS, chiffres: 7, chiffresMax: 8, lignes: 10, repetitions: 20, cumul: true,
        pourquoi: 'Le format du 2e kyū : 10 lignes de 8 chiffres. Aucun geste nouveau : ce qui change, c\'est la lecture. Lisez par tranches de 3 chiffres, repérées par les points de la barre (millions, milliers, unités), et posez chaque tranche pendant que l\'œil prend la suivante. Ne revenez jamais en arrière sur une ligne : mieux vaut une colonne refaite qu\'une ligne « rattrapée ».',
        demos: [{ depart: 4072581, op: '+', n: 3964207 }] },
      { id: 'p9-2', titre: '9 et 10 chiffres, 10 lignes', cibles: TOUS_LES_MOTIFS, chiffres: 9, chiffresMax: 10, lignes: 10, repetitions: 20, cumul: true,
        pourquoi: 'Le format du 1er kyū : 10 lignes de 10 chiffres, soit 100 chiffres par colonne. C\'est une épreuve d\'endurance : gardez un rythme égal du premier au dernier chiffre, sans accélérer sur les lignes faciles. La main gauche suit la ligne sur la feuille pour ne pas en sauter une.',
        demos: [{ depart: 407258136, op: '+', n: 396420715 }] },
      { id: 'p9-3', titre: 'Multiplication 4 × 4 et 5 × 4 chiffres', type: 'mul', m: 4, n: 4, mMax: 5, repetitions: 20,
        pourquoi: 'Même méthode, plus de produits : 8 ou 9 chiffres au total, donc 16 ou 20 produits de table. L\'index gauche avance d\'une tige à chaque chiffre du multiplicande ; ne le lâchez jamais, c\'est lui qui garde la place.',
        demos: [{ a: 2468, b: 3751 }] },
      { id: 'p9-4', titre: 'Multiplication 6 × 5 chiffres', type: 'mul', m: 6, n: 5, repetitions: 20,
        pourquoi: 'Le format du 1er kyū : 11 chiffres au total, 30 produits de table à la suite. La difficulté est de ne perdre ni sa place sur la feuille ni sa tige sur le soroban. Dites intérieurement le chiffre du multiplicande en cours.',
        demos: [{ a: 246813, b: 37519 }] },
      { id: 'p9-5', titre: 'Division : diviseur à 4 chiffres', type: 'div', nd: 4, nq: 3, repetitions: 20, corrections: true,
        pourquoi: 'On estime toujours avec le diviseur arrondi sur son premier chiffre (2 431 → 2 000, 2 780 → 3 000), puis on corrige de ±1. Avec 4 chiffres au diviseur, chaque chiffre du quotient demande 4 retraits : vérifiez l\'estimation de tête avant de poser.',
        demos: [{ a: 1110967, b: 2431 }] },
      { id: 'p9-6', titre: 'Division : 5 chiffres par 5 chiffres', type: 'div', nd: 5, nq: 5, repetitions: 20,
        pourquoi: 'Le format du 1er kyū : diviseur et quotient à 5 chiffres, 10 chiffres au total. L\'unité du quotient est 6 tiges à gauche de l\'unité du dividende (5 chiffres au diviseur + 1). Comparez les 5 premiers chiffres du dividende au diviseur pour savoir où poser le premier chiffre.',
        demos: [{ a: 760107726, b: 24318 }] },
      { id: 'p8-n', titre: 'Résultats négatifs : le complément', type: 'negatif', chiffres: 2, lignes: 4, repetitions: 20,
        pourquoi: 'Au 1er kyū, une colonne finit sous zéro ; cela peut arriver au 2e. Quand une soustraction « dépasse » (il faut retirer plus que ce qui est posé), on emprunte un 1 IMAGINAIRE sur la tige à gauche de la colonne (100 pour une colonne à 2 chiffres) et on continue normalement. À la fin, le soroban affiche le COMPLÉMENT du résultat : s\'il affiche 63 après un emprunt de 100, le résultat est −(100 − 63) = −37. Lecture rapide : complément à 9 de chaque chiffre, à 10 pour le dernier (63 → 3 et 7 → −37). Si le calcul repasse au-dessus de zéro, la retenue rend le 1 emprunté. Tapez le résultat avec le signe moins.',
        demos: [] },
    ],
  },
  {
    // Piste parallèle : elle ne bloque pas le parcours soroban, et le suit AVEC RETARD (`apres`) :
    // l'anzan d'un geste ne s'ouvre qu'une fois ce geste bien acquis sur le vrai soroban.
    id: 'pa', titre: 'Anzan et visualisation (piste parallèle)', mental: true,
    sousPaliers: [
      { id: 'pa-0', titre: 'Le cours : voir le soroban dans sa tête', type: 'theorie', apres: 'p1-4', repetitions: 0,
        pourquoi: 'L\'anzan, c\'est calculer avec un soroban imaginaire. Ce n\'est pas du calcul mental « avec des mots » : on VOIT les boules bouger. Cette piste avance à son rythme, en parallèle des leçons sur le vrai soroban, et toujours un peu en retard sur elles : on n\'imagine bien que des gestes déjà automatiques.',
        sections: [
          ['Les étapes', '1. Prendre la « photo » d\'un soroban : le voir une seconde et lire le nombre. 2. Tenir une image : poser un nombre sur le soroban imaginaire et le garder net. 3. Calculer avec une image d\'aide qui s\'estompe peu à peu. 4. Calculer de tête, en allongeant la chaîne de nombres, puis en accélérant.'],
          ['Toujours le même soroban', 'Imaginez VOTRE soroban, avec sa couleur, la taille de ses boules et sa barre. Toujours le même : l\'image se renforce à chaque séance. Ne visualisez que les tiges utiles (une ou deux au début), pas tout le cadre.'],
          ['Garder l\'image du TOTAL', 'Le nombre lu ne sert qu\'à déclencher un geste, puis on l\'oublie. Ce qu\'on garde en tête, c\'est l\'état du soroban : le total. À la fin, on ne calcule rien, on LIT le soroban imaginaire.'],
          ['Les doigts dans l\'air', 'À chaque nombre, faites le geste avec le pouce et l\'index, comme sur le vrai soroban. Au début, c\'est le mouvement des doigts qui « porte » l\'image. Les doigts s\'effacent d\'eux-mêmes beaucoup plus tard.'],
          ['Pas de phrase intérieure', 'Ne vous dites pas « 4 plus 3 égale 7 » : on voit la céleste descendre et deux terrestres s\'en aller. Si une voix intérieure compte, ralentissez jusqu\'à voir les boules.'],
          ['Les yeux', 'En mitori-anzan (colonne affichée), fermer les yeux un instant entre deux nombres aide au début. En flash, regardez le nombre, puis l\'image intérieure.'],
          ['Quand l\'image se brouille', 'On réduit le NOMBRE de nombres, pas la vitesse : mieux vaut 3 nombres nets que 5 flous. Quand on est perdu, on ne devine pas : on le note faux et on recommence. L\'application allonge la chaîne quand vous réussissez, et la raccourcit après une erreur.'],
          ['Peu, mais tous les jours', '5 minutes d\'anzan chaque jour valent mieux que 20 minutes une fois par semaine. L\'image se construit par la répétition, entre les séances.'],
        ],
        pourquoiCaMarche: [
          ['Une image plutôt que des mots', 'Garder « 47 » en mots occupe la mémoire de travail, déjà petite. Une image de soroban se garde mieux : c\'est une forme, pas une suite de sons. C\'est pourquoi on évite la voix intérieure.'],
          ['Les doigts aident la tête', 'D\'après l\'imagerie cérébrale, les zones qui commandent un geste s\'activent en partie quand on l\'imagine. Bouger les doigts dans l\'air relie l\'image au geste appris sur le vrai soroban.'],
          ['Pourquoi aller lentement', 'Si l\'image se brouille, on s\'entraîne à… deviner. Mieux vaut des chaînes courtes et nettes : la longueur vient ensuite, puis la vitesse.'],
        ],
        quiz: [
          { q: 'Pendant un calcul de tête, que garde-t-on en tête ?', choix: ['L\'image du soroban, avec le total', 'La liste des nombres lus', 'La phrase « 4 plus 3 égale 7 »'], bonne: 0, pourquoi: 'Le nombre lu déclenche un geste, puis on l\'oublie : on garde l\'état du soroban, le total (« Garder l\'image du TOTAL »).' },
          { q: 'L\'image se brouille : que faire ?', choix: ['Réduire le nombre de nombres', 'Aller plus vite pour finir avant d\'oublier', 'Deviner le résultat'], bonne: 0, pourquoi: 'On réduit le NOMBRE de nombres, pas la vitesse : 3 nombres nets valent mieux que 5 flous.' },
          { q: 'Et les doigts ?', choix: ['On fait le geste dans l\'air, comme sur le vrai soroban', 'On les garde immobiles', 'On compte sur ses doigts'], bonne: 0, pourquoi: 'Au début, c\'est le mouvement des doigts qui porte l\'image (« Les doigts dans l\'air »).' },
          { q: 'Quel soroban imaginer ?', choix: ['Toujours le même : le vôtre', 'Un nouveau à chaque séance', 'Peu importe'], bonne: 0, pourquoi: 'Toujours le même : l\'image se renforce à chaque séance.' },
        ],
        demos: [] },
      { id: 'pa-1', titre: 'Photo du soroban : 1 tige', type: 'photo', apres: 'p1-4', chiffres: 1, duree: 1.5, repetitions: 20,
        pourquoi: 'Un soroban s\'affiche un court instant : tapez le nombre qu\'il montrait. Ne comptez pas les boules une à une : prenez une « photo » d\'un coup d\'œil, céleste puis terrestres. C\'est la brique de base de la visualisation.',
        demos: [] },
      { id: 'pa-2', titre: 'Photo du soroban : 2 tiges', type: 'photo', apres: 'p1-4', chiffres: 2, duree: 2, repetitions: 20,
        pourquoi: 'Deux tiges : on photographie la tige des dizaines puis celle des unités, de gauche à droite, comme on lit un nombre.',
        demos: [] },
      { id: 'pa-3', titre: 'Tenir une image', type: 'tenir', apres: 'p1-4', chiffres: 2, duree: 1.5, tenir: 3, repetitions: 15, testMin: 12,
        pourquoi: 'Un nombre s\'affiche en chiffres. Fermez les yeux et posez-le sur votre soroban imaginaire, avec les doigts dans l\'air. Gardez l\'image nette quelques secondes. Ensuite le vrai soroban s\'affiche : votre image était-elle la même ? Vous répondez honnêtement, O ou N.',
        demos: [] },
      { id: 'p1-a', titre: 'Anzan : gestes directs', type: 'anzan', apres: 'p1-4', image: true, cibles: D('+', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 5, duree: 3, repetitions: 30, testMin: 12,
        pourquoi: 'Les nombres s\'affichent un par un. À chaque nombre, faites le geste avec les doigts dans l\'air et voyez les boules bouger. Au début, un petit soroban montre le TOTAL qui évolue : suivez-le, puis il s\'estompe à mesure que vous réussissez. La chaîne commence à 2 nombres et s\'allonge quand vous réussissez.',
        demos: [] },
      { id: 'p2-a', titre: 'Anzan : petits amis', type: 'anzan', apres: 'p2-7', image: true, cibles: PETIT, chiffres: 1, lignes: 5, duree: 2.5, repetitions: 30, testMin: 12,
        pourquoi: 'Mêmes gestes qu\'au soroban : le petit ami se « voit » (la céleste descend, des terrestres s\'en vont). Gardez les doigts actifs. Si l\'image se brouille, la chaîne se raccourcit d\'elle-même : ne devinez pas.',
        demos: [] },
      { id: 'p3-a', titre: 'Anzan : grands amis (addition)', type: 'anzan', apres: 'p3-4', image: true, cibles: plus(GRAND), chiffres: 1, lignes: 5, duree: 2.5, repetitions: 30, testMin: 12,
        pourquoi: 'Une deuxième tige apparaît dans l\'image : la retenue monte sur la tige des dizaines. Voyez le complément partir des unités, puis la boule monter à gauche.',
        demos: [] },
      { id: 'p4-a', titre: 'Anzan : grands amis (soustraction)', type: 'anzan', apres: 'p4-5', image: true, cibles: moins(GRAND), chiffres: 1, lignes: 5, duree: 2, repetitions: 30, testMin: 12,
        pourquoi: 'L\'emprunt se voit sur la tige des dizaines avant le complément sur les unités : même ordre qu\'au soroban.',
        demos: [] },
      { id: 'pa-5', titre: 'Anzan : 5 nombres, tous les gestes', type: 'anzan', apres: 'p5-5', image: true, cibles: TOUS_LES_MOTIFS, chiffres: 1, lignes: 6, duree: 1.5, repetitions: 30, testMin: 12, lignesDepart: 3,
        pourquoi: 'Avant de passer à deux chiffres, on consolide à un chiffre : tous les gestes mélangés, des chaînes de 5 ou 6 nombres, un peu plus vite. C\'est ici que l\'image devient vraiment stable.',
        demos: [] },
      { id: 'p5-a', titre: 'Anzan : 2 chiffres', type: 'anzan', apres: 'p5-5', image: true, cibles: TOUS_LES_MOTIFS, chiffres: 2, lignes: 4, duree: 3, repetitions: 30, testMin: 12,
        pourquoi: 'Deux tiges dans la tête, de gauche à droite comme au soroban : les dizaines, puis les unités. On revient à des chaînes courtes et à un affichage lent, avec l\'image d\'aide : la difficulté a changé, on repart doucement.',
        demos: [] },
      { id: 'pa-m1', titre: 'Anzan : multiplier 2 chiffres par 1', type: 'mul', m: 2, n: 1, apres: 'p6-1', repetitions: 30, testMin: 12,
        pourquoi: 'Soroban rangé. La multiplication se fait dans la tête exactement comme sur les boules : on voit le premier produit se poser sur ses deux tiges, puis le second une tige plus à droite, et on LIT le total. Pour 37 × 8 : 24 d\'abord (2 et 4), puis 56 une tige à droite : le 5 s\'ajoute au 4 (grand ami), il reste 6. Faites les gestes dans l\'air. Si l\'image se brouille, ne devinez pas : reprenez depuis le premier produit.',
        demos: [{ a: 37, b: 8 }] },
      { id: 'pa-m2', titre: 'Anzan : multiplier 3 chiffres par 1', type: 'mul', m: 3, n: 1, apres: 'p6-2', repetitions: 30, testMin: 12,
        pourquoi: 'Un produit de plus, donc une tige de plus dans l\'image : quatre tiges à tenir. Gardez les yeux (intérieurs) sur la tige où tombe le produit en cours ; les tiges de gauche, déjà finies, ne bougent plus.',
        demos: [{ a: 372, b: 8 }] },
      { id: 'pa-d1', titre: 'Anzan : diviser par 1 chiffre', type: 'div', nd: 1, nq: 2, apres: 'p7-2', repetitions: 30, testMin: 12,
        pourquoi: 'Le dividende est posé dans la tête ; on y retire les produits, comme sur le soroban, et l\'on voit le quotient apparaître à gauche. Pour 156 ÷ 4 : 3 (on retire 12, il reste 36), puis 9 (on retire 36). Voyez le reste diminuer : c\'est lui qu\'il faut garder net.',
        demos: [{ a: 156, b: 4 }] },
    ],
  },
];

/**
 * Liste à plat des sous-paliers, enrichis :
 *  - autorises : Set des motifs permis (directs + cibles, ou cumul de tout ce qui a été vu)
 *  - palier, ordre
 */
export const SOUS_PALIERS = (() => {
  const liste = [];
  const vus = new Set(DIRECT);
  const vusApres = {}; // gestes vus à la fin de chaque leçon (pour l'anzan, qui suit avec retard)
  for (const palier of PALIERS) {
    for (const sp of palier.sousPaliers) {
      const type = sp.type ?? 'addsub';
      const mental = !!palier.mental;
      if (['theorie', 'placement', 'photo', 'tenir', 'lire', 'complement'].includes(type)) {
        liste.push({ type, ...sp, autorises: null, palier, mental, ordre: liste.length });
        continue;
      }
      let autorises = null;
      if (type === 'addsub') {
        sp.cibles.forEach((c) => vus.add(c));
        autorises = sp.cumul ? new Set(vus) : new Set([...DIRECT, ...sp.cibles]);
      }
      // Anzan : les gestes vus jusqu'à la leçon soroban qu'il suit.
      if (type === 'anzan') autorises = new Set(vusApres[sp.apres] ?? vus);
      liste.push({ type, ops: ['+', '-'], ...sp, autorises, palier, mental, ordre: liste.length });
      vusApres[sp.id] = new Set(vus);
    }
  }
  return liste;
})();

export const sousPalier = (id) => SOUS_PALIERS.find((s) => s.id === id);

/** Famille de seuils de vitesse d'une leçon (voir maitrise.js). */
export function familleLecon(sp) {
  if (sp.type === 'placement' || sp.type === 'table') return sp.type;
  if (sp.type === 'photo' || sp.type === 'tenir' || sp.type === 'lire') return 'photo';
  if (sp.type === 'complement') return 'table';
  if (['addsub', 'anzan', 'addsubdec', 'negatif'].includes(sp.type)) return 'addsub';
  return 'muldiv';
}

// Une mémoire anti-répétition par leçon, pour toute la durée d'utilisation de l'application.
const memoires = new Map();
const memoireDe = (id) => { if (!memoires.has(id)) memoires.set(id, creerMemoire(6)); return memoires.get(id); };

/**
 * Produit de la table (1 × 1), à écrire sur deux chiffres. Les produits récents sont évités,
 * et 0 n'apparaît que rarement (pour « 00 »).
 */
function produitTable(memoire) {
  for (;;) {
    const a = Math.random() < 0.05 ? 0 : 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const cle = `${a}x${b}`;
    if (memoire.signatures.includes(cle)) continue;
    memoire.signatures.push(cle);
    if (memoire.signatures.length > 12) memoire.signatures.shift();
    return { type: 'table', a, b, resultat: a * b, attendu: String(a * b).padStart(2, '0') };
  }
}

/**
 * Colonne dont le résultat est NÉGATIF (calcul par complément). Le résultat reste au-dessus de
 * −10^chiffres : un seul emprunt imaginaire suffit. ex.astuce explique la lecture du complément.
 */
export function genererNegatif(chiffres, lignes) {
  const k = 10 ** chiffres;
  const nombre = () => 10 ** (chiffres - 1) + Math.floor(Math.random() * (k - 10 ** (chiffres - 1)));
  for (;;) {
    const l = [{ op: '+', n: nombre() }];
    for (let i = 1; i < lignes; i++) l.push({ op: Math.random() < 0.7 ? '-' : '+', n: nombre() });
    let v = 0;
    const sous = l.map((x) => (v = x.op === '+' ? v + x.n : v - x.n));
    const r = sous.at(-1);
    if (r >= 0 || r <= -k || sous.slice(0, -1).some((x) => x <= -k || x >= k)) continue;
    const c = k + r;
    return {
      type: 'addsub', negatif: true, lignes: l, resultat: r,
      astuce: `On emprunte un 1 imaginaire de ${k} quand la soustraction dépasse : le soroban affiche ${c}, le complément. Résultat : −(${k} − ${c}) = ${r}.`,
    };
  }
}

/**
 * « Photo du soroban » : un nombre de `chiffres` chiffres (sans répéter les derniers), montré en
 * boules pendant `duree` secondes. Avec 2 chiffres, la tige des dizaines n'est jamais vide.
 */
export function genererPhoto(chiffres, duree, memoire) {
  for (let essai = 0; ; essai++) {
    const min = chiffres === 1 ? 1 : 10 ** (chiffres - 1);
    const n = min + Math.floor(Math.random() * (10 ** chiffres - min));
    if (essai < 50 && memoire?.resultats.includes(n)) continue;
    if (memoire) { memoire.resultats.push(n); if (memoire.resultats.length > memoire.taille) memoire.resultats.shift(); }
    return { type: 'photo', n, chiffres, resultat: n, flash: { duree, photo: true } };
  }
}

const NOMS_TIGES = ['unités', 'dizaines', 'centaines'];
/**
 * « Lire et poser un nombre » : lire un soroban (on tape le nombre), ou poser un nombre sur son
 * soroban puis donner le chiffre d'une tige tirée au hasard (la pose devient vérifiable).
 * rang : exercices déjà faits dans la leçon (20 lectures, puis 10 poses, puis mélangé) ; sans
 * rang (mini-test), moitié-moitié.
 */
export function genererLecture(rang, memoire) {
  const pose = rang === undefined ? Math.random() < 0.5 : rang < 20 ? false : rang < 30 ? true : Math.random() < 1 / 3;
  for (let essai = 0; ; essai++) {
    const chiffres = 1 + Math.floor(Math.random() * 3);
    const min = chiffres === 1 ? 0 : 10 ** (chiffres - 1);
    const n = min + Math.floor(Math.random() * (10 ** chiffres - min));
    if (pose && n < 10) continue; // poser 1 chiffre : la question serait évidente
    if (essai < 50 && memoire?.resultats.includes(n)) continue;
    if (memoire) { memoire.resultats.push(n); if (memoire.resultats.length > memoire.taille) memoire.resultats.shift(); }
    if (!pose) return { type: 'lire', n, resultat: n };
    const t = Math.floor(Math.random() * String(n).length);
    const chiffre = Number(String(n).at(-1 - t));
    return { type: 'poser', n, tige: t, nomTige: NOMS_TIGES[t], resultat: chiffre };
  }
}

/** Paire qui fait 5 ou 10 : « 3 et ? font 5 ». Jamais deux fois de suite le même nombre. */
export function genererComplement(cible, memoire) {
  for (;;) {
    const a = 1 + Math.floor(Math.random() * (cible - 1));
    if (memoire && memoire.resultats.at(-1) === a) continue;
    memoire?.resultats.push(a);
    if (memoire && memoire.resultats.length > memoire.taille) memoire.resultats.shift();
    return { type: 'complement', a, cible, resultat: cible - a };
  }
}

/**
 * Exercice d'un sous-palier (colonne, multiplication ou division).
 * @param {object} [ctx]  anzan seulement : { lignes, image } (voir plus bas)
 */
export function genererExercice(sp, poids = {}, ctx = {}) {
  const alterner = (k) => (/et \d chiffres/.test(sp.titre) && Math.random() < 0.5 ? k + 1 : k);
  const entre = (a, b) => (b && Math.random() < 0.5 ? b : a);
  if (sp.type === 'placement') return sp.op === 'muldec' ? genererPlacementDecimal() : genererPlacement(sp.op, 1 + Math.floor(Math.random() * 3));
  if (sp.type === 'table') return produitTable(memoireDe(sp.id));
  if (sp.type === 'addsubdec') return genererColonneDecimale(5, 4, 2);
  if (sp.type === 'muldec') return genererMultiplicationDecimaleSimple(2, entre(1, 2));
  if (sp.type === 'divdec') return genererDivisionDecimaleExacte(entre(1, 2), 2);
  if (sp.type === 'divarrondi') return genererDivisionDecimale(entre(1, 2), 2, 3);
  // Arrondi à l'unité (montants) : une multiplication sur deux, une division sur deux.
  if (sp.type === 'arrondiunite') return Math.random() < 0.5 ? genererMultiplicationDecimale(3, 2, 0) : genererDivisionDecimale(2, 3, 0);
  if (sp.type === 'mul') return sp.mMax ? genererMultiplication(entre(sp.m, sp.mMax), sp.n, sp.zeros) : genererMultiplication(alterner(sp.m), sp.n);
  if (sp.type === 'div') {
    if (sp.zeros) return genererDivision(entre(sp.nd, sp.ndMax), sp.nq, true);
    if (!sp.corrections) return genererDivision(sp.nd, alterner(sp.nq));
    // Leçon d'estimation : 2 fois sur 3, une division dont l'estimation demande une correction.
    const voulue = Math.random() < 2 / 3;
    for (let i = 0; i < 200; i++) {
      const ex = genererDivision(sp.nd, sp.nq);
      const corrige = aideDivision(ex.a, ex.b).etapes.some((e) => e.essais.length > 1);
      if (corrige === voulue) return ex;
    }
    return genererDivision(sp.nd, sp.nq);
  }
  if (sp.type === 'photo') return genererPhoto(sp.chiffres, ctx.duree ?? sp.duree, memoireDe(sp.id));
  if (sp.type === 'lire') return genererLecture(ctx.rang, memoireDe(sp.id));
  if (sp.type === 'complement') return genererComplement(sp.cible, memoireDe(sp.id));
  if (sp.type === 'negatif') return genererNegatif(sp.chiffres, sp.lignes);
  if (sp.type === 'tenir') {
    const ex = genererPhoto(entre(1, sp.chiffres), sp.duree, memoireDe(sp.id));
    return { ...ex, type: 'tenir', flash: { duree: sp.duree, tenir: sp.tenir } };
  }
  if (sp.type === 'anzan') {
    // Anzan : colonne avec les gestes vus, montrée en flash ; pas de suivi par geste (calcul mental).
    // ctx.lignes : longueur de chaîne du moment (elle s'allonge avec les réussites) ;
    // ctx.image : opacité du petit soroban d'aide qui montre le TOTAL (0 = pas d'image).
    // Sans ctx (mini-test, révision) : chaîne complète, sans image.
    const col = genererColonneVariee({
      chiffres: sp.chiffres, lignes: ctx.lignes ?? sp.lignes, autorises: sp.autorises, cibles: sp.cibles, poids, premierCourt: true,
    }, memoireDe(sp.id));
    return { ...col, motifs: undefined, flash: { duree: sp.duree, image: ctx.image ?? 0 } };
  }
  // Les sous-paliers « 2 et 3 chiffres » alternent les deux longueurs.
  let chiffres = sp.chiffres === 2 && /2 et 3 chiffres/.test(sp.titre) ? (Math.random() < 0.5 ? 2 : 3) : sp.chiffres;
  if (sp.chiffresMax) chiffres = entre(sp.chiffres, sp.chiffresMax);
  return genererColonneVariee({ chiffres, lignes: entre(sp.lignes, sp.lignesMax), autorises: sp.autorises, cibles: sp.cibles, poids, ops: sp.ops, zeros: sp.zeros }, memoireDe(sp.id));
}

/**
 * Suite d'exercices ÉQUILIBRÉE sur un bloc (mini-test, ou tranche d'entraînement) : chaque geste
 * visé de la leçon doit apparaître dans le bloc. Tirés un par un, les exercices oubliaient
 * souvent les gestes rares (+1 grand ami, qui exige un 9 sur la tige) : la « Révision générale »
 * validait ainsi des gestes que son mini-test n'avait pas posés.
 * Ici, un geste pas encore vu dans le bloc passe devant ; dans la seconde moitié du bloc, les
 * gestes encore absents deviennent prioritaires, et l'on garde le meilleur de trois tirages.
 * Les leçons qui ne sont pas des colonnes sont tirées comme avant.
 * @param {object} sp  sous-palier
 * @param {number} taille  longueur du bloc (15 pour un mini-test, 10 pour une tranche)
 * @param {() => object} [poidsDe]  poids adaptatifs du moment
 * @returns {(ctx?: object) => object}  l'exercice suivant
 */
export function fluxEquilibre(sp, taille, poidsDe = () => ({})) {
  if (sp.type !== 'addsub') return (ctx) => genererExercice(sp, poidsDe(), ctx);
  let vus = {};
  let rang = 0;
  return (ctx) => {
    if (rang >= taille) { vus = {}; rang = 0; }
    const base = poidsDe();
    const absents = sp.cibles.filter((c) => !vus[c]);
    const urgent = absents.length > 0 && rang >= taille / 2;
    const poids = Object.fromEntries(sp.cibles.map((c) => {
      const w = base[c] ?? 1;
      if (urgent) return [c, vus[c] ? 0.2 * w : 40 * w];
      return [c, vus[c] ? w / (1 + vus[c]) : 4 * w];
    }));
    let meilleur = null;
    for (let e = 0; e < (urgent ? 3 : 1); e++) {
      const ex = genererExercice(sp, poids, ctx);
      const gain = absents.filter((c) => ex.motifs.includes(c)).length;
      if (!meilleur || gain > meilleur.gain) meilleur = { ex, gain };
      if (gain >= Math.min(absents.length, 2)) break;
    }
    for (const m of meilleur.ex.motifs) vus[m] = (vus[m] ?? 0) + 1;
    rang += 1;
    return meilleur.ex;
  };
}

/**
 * Image d'aide de l'anzan : elle s'estompe à mesure que les réussites s'accumulent dans la leçon
 * (nette, estompée, légère, puis plus d'image du tout).
 * @returns {{ opacite: number, nom: string }}
 */
export function imageAnzan(sp, justes) {
  if (!sp.image) return { opacite: 0, nom: 'sans image' };
  if (justes < 8) return { opacite: 1, nom: 'image nette' };
  if (justes < 16) return { opacite: 0.5, nom: 'image estompée' };
  if (justes < 24) return { opacite: 0.2, nom: 'image légère' };
  return { opacite: 0, nom: 'sans image' };
}

/**
 * Longueur de chaîne de l'anzan : on commence court (2 nombres) ; 3 réussites de suite ajoutent
 * un nombre, une erreur en retire un. La longueur est sauvegardée avec la progression (voir
 * progression.memoriserChaine) : à la reprise, on repart de la dernière longueur moins un
 * nombre (échauffement).
 * @param {number} [sauvee]  dernière longueur sauvegardée pour cette leçon
 */
/**
 * Durée d'affichage de la « photo du soroban », qui s'adapte : on commence vers 1 s ; deux
 * réponses justes de suite la raccourcissent de 15 % (jusqu'à 0,2 s), une erreur la rallonge de
 * 25 % (sans dépasser la durée de départ de la leçon). Sauvegardée avec la progression
 * (progression.memoriserDureePhoto) : à la reprise, on repart un peu plus lentement (+15 %).
 * @param {number} [sauvee]  dernière durée sauvegardée (secondes)
 */
export const DUREE_PHOTO_MIN = 0.2;
const durees = new Map();
export function dureePhoto(sp, sauvee) {
  const max = sp.duree;
  const depart = Math.min(max, 1 + 0.2 * ((sp.chiffres ?? 1) - 1));
  const arrondi = (x) => Math.round(x * 100) / 100;
  if (!durees.has(sp.id)) durees.set(sp.id, { s: sauvee ? arrondi(Math.min(max, sauvee * 1.15)) : depart, serie: 0 });
  const c = durees.get(sp.id);
  return {
    get secondes() { return c.s; },
    noter(juste) {
      if (juste) {
        c.serie += 1;
        if (c.serie >= 2) { c.s = arrondi(Math.max(DUREE_PHOTO_MIN, c.s * 0.85)); c.serie = 0; }
      } else {
        c.serie = 0;
        c.s = arrondi(Math.min(max, c.s * 1.25));
      }
    },
  };
}

const chaines = new Map();
export function chaineAnzan(sp, sauvee) {
  const min = Math.min(sp.lignesDepart ?? 2, sp.lignes);
  const depart = sauvee ? Math.min(sp.lignes, Math.max(min, sauvee - 1)) : min;
  if (!chaines.has(sp.id)) chaines.set(sp.id, { lignes: depart, serie: 0 });
  const c = chaines.get(sp.id);
  return {
    get lignes() { return c.lignes; },
    max: sp.lignes,
    noter(juste) {
      if (juste) {
        c.serie += 1;
        if (c.serie >= 3 && c.lignes < sp.lignes) { c.lignes += 1; c.serie = 0; }
      } else {
        c.serie = 0;
        c.lignes = Math.max(min, c.lignes - 1);
      }
    },
  };
}
