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
 *  - type 'anzan' : calcul mental en flash (nombres montrés un par un : `duree` secondes chacun),
 *                   avec les gestes vus jusque-là ; testMin : réussites exigées au mini-test
 *
 * Pour modifier la progression : éditer PALIERS. Tout le reste (déblocage, génération,
 * révisions, suggestions) s'adapte.
 */

import { D, famille, TOUS_LES_MOTIFS } from './motifs.js';
import { genererColonne } from './generateur.js';
import { genererMultiplication, genererDivision, aideDivision } from './multiplication.js';

const DIRECT = famille('direct');
const PETIT = famille('petit');
const GRAND = famille('grand');
const MIXTE = famille('mixte');
const plus = (cles) => cles.filter((c) => c.startsWith('+'));
const moins = (cles) => cles.filter((c) => c.startsWith('-'));

/** Mini-test : nombre d'exercices et minimum de réussites. */
export const TEST = { exercices: 10, reussitesMin: 9 };

export const PALIERS = [
  {
    id: 'p1', titre: 'Gestes directs',
    sousPaliers: [
      { id: 'p1-1', titre: 'Ajouter 1 à 4', cibles: D('+', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 3, ops: ['+'], repetitions: 20, cumul: true,
        pourquoi: 'Ajouter, c\'est faire monter des boules terrestres contre la barre, avec le POUCE, placé sous les boules : un seul mouvement vers le haut. Condition : les boules nécessaires doivent être libres (en bas).',
        demos: [{ depart: 0, op: '+', n: 3 }, { depart: 6, op: '+', n: 3 }] },
      { id: 'p1-2', titre: 'Retirer 1 à 4', cibles: D('-', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'Retirer, c\'est éloigner des boules terrestres de la barre avec l\'INDEX, qui les pousse vers le bas. Pouce pour monter, index pour descendre : les deux doigts ne se gênent jamais.',
        demos: [{ depart: 4, op: '-', n: 3 }, { depart: 8, op: '-', n: 2 }] },
      { id: 'p1-3', titre: 'Le 5 et la pincée (6 à 9)', cibles: [...D('+', [5, 6, 7, 8, 9], 'direct'), ...D('-', [5, 6, 7, 8, 9], 'direct')], chiffres: 1, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'La boule céleste vaut 5 et c\'est toujours l\'INDEX qui la manœuvre. Pour 6 à 9 (5 + 1 … 5 + 4), on fait UN seul geste : l\'index abaisse la céleste pendant que le pouce monte les terrestres, comme une pince. Pour retirer 6 à 9, l\'index relève la céleste et descend les terrestres d\'un même mouvement.',
        demos: [{ depart: 2, op: '+', n: 5 }, { depart: 0, op: '+', n: 7 }, { depart: 9, op: '-', n: 6 }] },
      { id: 'p1-4', titre: 'Gestes directs à 2 et 3 chiffres', cibles: DIRECT, chiffres: 2, lignes: 4, repetitions: 20, cumul: true,
        pourquoi: 'On calcule de GAUCHE À DROITE : d\'abord le chiffre le plus fort, dans l\'ordre de lecture du nombre. On pose au fur et à mesure qu\'on lit, sans rien retenir de tête. Chaque tige se traite indépendamment.',
        demos: [{ depart: 12, op: '+', n: 35 }, { depart: 87, op: '-', n: 32 }] },
      { id: 'p1-a', titre: 'Anzan : gestes directs', type: 'anzan', cibles: D('+', [1, 2, 3, 4], 'direct'), chiffres: 1, lignes: 3, duree: 2, repetitions: 20, testMin: 8,
        pourquoi: 'L\'anzan, c\'est calculer avec un soroban imaginaire. Les nombres s\'affichent un par un : à chaque nombre, voyez les boules bouger dans votre tête, et faites le geste avec les doigts dans l\'air (pouce, index), comme sur le vrai soroban. On commence tôt et très simple : la vitesse viendra.',
        demos: [] },
    ],
  },
  {
    id: 'p2', titre: 'Petits amis (compléments à 5)',
    sousPaliers: [
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
      { id: 'p2-a', titre: 'Anzan : petits amis', type: 'anzan', cibles: PETIT, chiffres: 1, lignes: 4, duree: 1.5, repetitions: 20, testMin: 8,
        pourquoi: 'Mêmes gestes qu\'au soroban : le petit ami se « voit » (céleste qui descend, terrestres qui remontent). Gardez les doigts actifs ; si l\'image se brouille, ralentissez plutôt que de deviner.',
        demos: [] },
    ],
  },
  {
    id: 'p3', titre: 'Grands amis en addition (compléments à 10)',
    sousPaliers: [
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
      { id: 'p3-a', titre: 'Anzan : grands amis (addition)', type: 'anzan', cibles: plus(GRAND), chiffres: 1, lignes: 4, duree: 1.5, repetitions: 20, testMin: 8,
        pourquoi: 'Imaginez la retenue qui monte sur la tige de gauche. Le soroban imaginaire a deux tiges : unités et dizaines.',
        demos: [] },
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
      { id: 'p4-a', titre: 'Anzan : grands amis (soustraction)', type: 'anzan', cibles: moins(GRAND), chiffres: 1, lignes: 5, duree: 1.2, repetitions: 20, testMin: 8,
        pourquoi: 'L\'emprunt se voit sur la tige des dizaines avant d\'ajouter le complément sur les unités : même ordre qu\'au soroban.',
        demos: [] },
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
      { id: 'p5-5', titre: 'Révision générale, 3 chiffres', cibles: TOUS_LES_MOTIFS, chiffres: 3, lignes: 5, repetitions: 50, cumul: true,
        pourquoi: 'Tous les gestes sont permis : chaque tige choisit le sien. C\'est le calcul courant.',
        demos: [{ depart: 478, op: '+', n: 685 }] },
      { id: 'p5-a', titre: 'Anzan : 2 chiffres', type: 'anzan', cibles: TOUS_LES_MOTIFS, chiffres: 2, lignes: 3, duree: 2, repetitions: 20, testMin: 8,
        pourquoi: 'Deux tiges dans la tête, de gauche à droite comme au soroban. Peu de nombres d\'abord, on allonge ensuite dans le Flash anzan.',
        demos: [] },
    ],
  },
  {
    id: 'p6', titre: 'Multiplication (両落とし)',
    sousPaliers: [
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
        pourquoi: 'On compare les deux premiers chiffres du dividende au diviseur entier. Le chiffre du quotient s\'estime avec le premier chiffre du diviseur ; puis on retire quotient × chaque chiffre du diviseur, en décalant d\'une tige. Si le produit ne peut pas être retiré, le chiffre était trop grand : on le diminue de 1.',
        demos: [{ a: 108, b: 12 }] },
      { id: 'p7-4', titre: '÷ 2 chiffres, quotient 2 chiffres', type: 'div', nd: 2, nq: 2, repetitions: 30,
        pourquoi: 'L\'unité du quotient est 3 tiges à gauche de l\'unité du dividende (2 chiffres au diviseur + 1).',
        demos: [{ a: 156, b: 12 }] },
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
  for (const palier of PALIERS) {
    for (const sp of palier.sousPaliers) {
      const type = sp.type ?? 'addsub';
      let autorises = null;
      if (type === 'addsub') {
        sp.cibles.forEach((c) => vus.add(c));
        autorises = sp.cumul ? new Set(vus) : new Set([...DIRECT, ...sp.cibles]);
      }
      if (type === 'anzan') autorises = new Set(vus);
      liste.push({ type, ops: ['+', '-'], ...sp, autorises, palier, ordre: liste.length });
    }
  }
  return liste;
})();

export const sousPalier = (id) => SOUS_PALIERS.find((s) => s.id === id);

/** Exercice d'un sous-palier (colonne, multiplication ou division). */
export function genererExercice(sp, poids = {}) {
  const alterner = (k) => (/et \d chiffres/.test(sp.titre) && Math.random() < 0.5 ? k + 1 : k);
  if (sp.type === 'mul') return genererMultiplication(alterner(sp.m), sp.n);
  if (sp.type === 'div') {
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
  if (sp.type === 'anzan') {
    // Anzan : colonne avec les gestes vus, montrée en flash ; pas de suivi par geste (calcul mental).
    const col = genererColonne({ chiffres: sp.chiffres, lignes: sp.lignes, autorises: sp.autorises, cibles: sp.cibles, poids });
    return { ...col, motifs: undefined, flash: { duree: sp.duree } };
  }
  // Les sous-paliers « 2 et 3 chiffres » alternent les deux longueurs.
  const chiffres = sp.chiffres === 2 && /2 et 3 chiffres/.test(sp.titre) ? (Math.random() < 0.5 ? 2 : 3) : sp.chiffres;
  return genererColonne({ chiffres, lignes: sp.lignes, autorises: sp.autorises, cibles: sp.cibles, poids, ops: sp.ops });
}
