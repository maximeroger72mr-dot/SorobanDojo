/**
 * « Pour aller plus vite » : conseils de vitesse, affichés dans chaque leçon (onglet Comprendre)
 * et rappelés un par un pendant l'entraînement.
 *
 * GENERAUX : valables partout (Leçon 0). PAR_PALIER / PAR_LECON : ajoutés selon la leçon.
 * Pour en ajouter : compléter les listes ci-dessous, tout le reste s'adapte.
 */

export const GENERAUX = [
  'Lisez le nombre suivant pendant que vos doigts finissent le précédent : l\'œil a toujours un nombre d\'avance sur la main.',
  'Ne regardez pas vos doigts, regardez la feuille : les doigts trouvent seuls les tiges, comme sur un clavier.',
  'Gestes courts : une boule n\'a besoin que de toucher la barre ou de s\'en décoller, pas de traverser toute la tige.',
  'Gardez le pouce et l\'index au ras des boules entre deux gestes : pas d\'aller-retour de la main.',
  'Le crayon reste dans la main (entre la paume et l\'annulaire) : on ne le pose jamais pour calculer.',
  'Un nombre se lit d\'un bloc, de gauche à droite, par tranches de trois (« trois cent cinquante-deux »), puis se pose tige après tige dans le même ordre.',
  'Régularité avant vitesse : un rythme égal (métronome des drills) va plus vite qu\'une suite d\'accélérations et de pauses.',
  'Remise à zéro rapide : soroban incliné vers soi, puis l\'index glisse de gauche à droite le long de la barre pour écarter les boules célestes.',
];

const PAR_PALIER = {
  p1: [
    'Pincée (+6 à +9) : l\'index abaisse la céleste PENDANT que le pouce monte les terrestres. Un seul mouvement, les deux doigts se referment ensemble.',
    'Retrait de 6 à 9 : l\'index fait tout en UN SEUL mouvement : il relève la céleste et descend les terrestres dans la même trajectoire. Pas deux gestes séparés.',
  ],
  p2: [
    'Petit ami : les deux temps s\'enchaînent sans pause : céleste puis terrestres, dans la foulée, comme un seul geste.',
    'Ne récitez pas la formule (« 4 = 5 − 1 ») : regardez la tige, le geste doit partir seul. La formule ne sert qu\'au début.',
  ],
  p3: [
    'Grand ami en addition : le complément d\'abord, puis la retenue, sans relâcher la main : le pouce glisse simplement d\'une tige vers la gauche.',
    'Quand le complément vaut 6 à 9 (pour +4 à +1 : +4 = −6 + 10), le −6 se fait en UN SEUL mouvement de l\'index (céleste relevée et terrestres descendues ensemble), puis la retenue.',
  ],
  p4: [
    'Grand ami en soustraction : l\'emprunt d\'abord (index sur la tige de gauche), puis le complément, d\'un enchaînement continu.',
    'Quand le complément vaut 6 à 9 (pour −4 à −1 : −4 = −10 + 6), le +6 se fait en PINCÉE : l\'index abaisse la céleste pendant que le pouce monte les terrestres, un seul mouvement.',
  ],
  p5: [
    'Combinaisons : trois temps (complément par petit ami, puis retenue) mais un seul mouvement de main qui « roule » de droite à gauche. Entraînez-le lentement, puis accélérez.',
    'Cascade (99 + 1) : la main balaie les 9 de droite à gauche d\'un mouvement continu.',
  ],
  p6: [
    'Lisez les deux facteurs une seule fois, puis ne regardez plus la feuille : récitez intérieurement les produits (« 24, 15… »).',
    'L\'index gauche marque la tige où commence le produit en cours : la main droite pose, la gauche guide. On ne cherche jamais sa place.',
    'Chaque produit sur DEUX tiges, même « 06 » ou « 00 » : avancer d\'une tige est un réflexe, jamais un calcul.',
  ],
  p7: [
    'Estimez avec le diviseur arrondi (18 → 20) : c\'est plus rapide que de chercher la table exacte, et la correction de ±1 est rare.',
    'L\'index gauche suit le chiffre du quotient en cours ; les produits se retirent juste à sa droite.',
    'Un chiffre de quotient trop petit se corrige sans tout effacer : +1 au quotient, on retire encore le diviseur.',
  ],
  p8: [
    'Grands nombres : découpez par tranches de 3 chiffres (les points de la barre) ; l\'œil repère la tranche, la main pose.',
    'Endurance : sur 10 lignes, gardez le même rythme de la 1re à la 10e. Si vous ralentissez à la fin, faites des séries plus courtes mais plus nombreuses.',
    'Zéros : un 0 dans un nombre, c\'est une tige à SAUTER, pas à oublier. Dites-le intérieurement (« trois, zéro, sept »).',
  ],
};

/** Anzan et visualisation : affichés dans les leçons de la piste anzan, à la place des généraux. */
export const ANZAN = [
  'Toujours le même soroban mental : le vôtre, avec ses couleurs et sa barre. L\'image se renforce à chaque séance.',
  'Ne visualisez que les tiges utiles (une ou deux), pas tout le cadre.',
  'Gardez l\'image du TOTAL : le nombre lu déclenche un geste, puis on l\'oublie.',
  'Les doigts bougent dans l\'air à chaque nombre : c\'est ce qui porte l\'image au début.',
  'Pas de phrase intérieure (« 4 plus 3 égale 7 ») : on voit les boules bouger, on ne compte pas.',
  'Image floue ? Moins de nombres, pas moins de vitesse : la chaîne se raccourcit d\'elle-même après une erreur.',
  'Perdu en route : ne devinez pas. Une réponse au hasard n\'entraîne rien ; on recommence.',
  'À la fin, on ne calcule pas : on LIT le soroban imaginaire, de gauche à droite.',
  '5 minutes par jour suffisent : l\'image se construit par la répétition, entre les séances.',
];

const PAR_LECON = {
  'pa-1': ['Céleste d\'abord (5 ou rien), puis le groupe de terrestres d\'un coup d\'œil : 3 boules se reconnaissent sans compter, comme les points d\'un dé.'],
  'pa-2': ['Les dizaines puis les unités, de gauche à droite, comme on lit le nombre.'],
  'pa-3': ['Posez la céleste d\'abord, puis les terrestres, avec les doigts dans l\'air : le geste fixe l\'image.'],
  'p3-a': ['Voyez la boule de retenue monter sur la tige de gauche : c\'est elle qu\'on oublie le plus souvent de tête.'],
  'p5-a': ['Deux tiges : le geste des dizaines, puis celui des unités, sans les mélanger. Si c\'est trop, revenez à 1 chiffre quelques jours.'],
  'p1-1': ['Pouce sous les boules, légèrement incliné : il les pousse vers la barre d\'un coup sec.'],
  'p1-2': ['Index au-dessus des boules : il les tire vers le bas d\'un coup sec.'],
};

/** Conseils de vitesse d'un sous-palier (spécifiques d'abord, puis ceux de son palier). */
export function conseilsVitesse(sp) {
  return [...(PAR_LECON[sp.id] ?? []), ...(sp.mental ? ANZAN : PAR_PALIER[sp.palier?.id] ?? [])];
}
