/**
 * Drills classiques du soroban, à faire sur son propre soroban.
 *
 * Chaque drill est une suite d'opérations connue, avec des points de contrôle (sous-totaux)
 * pour vérifier où l'on en est. Ils entraînent l'enchaînement de TOUS les amis sans réfléchir :
 *  - le même chiffre ajouté en boucle passe par tous les cas de ce chiffre (direct, petit ami,
 *    grand ami, combiné) : c'est le meilleur exercice pour ancrer un chiffre précis ;
 *  - 1 + 2 + 3 + … : la somme des entiers (55, 210, 666, 5050) ;
 *  - 123456789 ajouté 9 fois = 1 111 111 101, précédé de ses variantes courtes
 *    (1, 12, 123, … ajoutés 9 fois) pour monter progressivement en longueur ;
 *  - l'aller-retour : on retire ensuite le même nombre jusqu'à revenir à 0.
 *
 * Format : { id, titre, groupe, description, operations: [{op, n}], resultat }
 */

const repeter = (n, fois, op = '+') => Array.from({ length: fois }, () => ({ op, n }));
const somme = (ops) => ops.reduce((v, o) => (o.op === '+' ? v + o.n : v - o.n), 0);

function drill(id, titre, groupe, description, operations) {
  return { id, titre, groupe, description, operations, resultat: somme(operations) };
}

/** Le même nombre ajouté `fois` fois, puis éventuellement retiré autant de fois (aller-retour). */
export function drillRepetition(n, fois, allerRetour) {
  const ops = [...repeter(n, fois), ...(allerRetour ? repeter(n, fois, '-') : [])];
  return drill(`rep-${n}-${fois}-${allerRetour ? 'ar' : 'a'}`,
    `${n} ajouté ${fois} fois${allerRetour ? ', puis retiré ' + fois + ' fois' : ''}`,
    'Même nombre répété',
    `Ajouter ${n} en boucle fait passer chaque tige par tous les cas : geste direct, petit ami, grand ami et combinaisons. ${allerRetour ? 'Le retour à 0 entraîne les mêmes amis en soustraction.' : ''}`,
    ops);
}

/** 1 + 2 + … + n (et retour éventuel). */
export function drillSuite(n, allerRetour) {
  const aller = Array.from({ length: n }, (_, i) => ({ op: '+', n: i + 1 }));
  const retour = allerRetour ? Array.from({ length: n }, (_, i) => ({ op: '-', n: n - i })) : [];
  return drill(`suite-${n}-${allerRetour ? 'ar' : 'a'}`,
    `1 + 2 + … + ${n} = ${(n * (n + 1)) / 2}${allerRetour ? ', puis retour à 0' : ''}`,
    'Suite des entiers',
    'Chaque nombre suivant change de chiffre : toutes les situations se succèdent. Résultat connu à l\'avance : on sait tout de suite si le calcul est juste.',
    [...aller, ...retour]);
}

/** Liste des drills proposés, du plus court au plus long. */
export function catalogueDrills() {
  const liste = [];
  // 123456789 et ses variantes progressives : 1, 12, 123… ajoutés 9 fois.
  const base = '123456789';
  for (let k = 1; k <= 9; k++) {
    const n = Number(base.slice(0, k));
    const d = drill(`123-${k}`, `${n.toLocaleString('fr-FR')} × 9 fois`, '123456789',
      k < 9
        ? `Variante courte du grand drill : ${k} tige${k > 1 ? 's' : ''}. Ajouter ${n} neuf fois donne ${(n * 9).toLocaleString('fr-FR')}.`
        : 'Le drill classique : ajouter 123 456 789 neuf fois donne 1 111 111 101. Tous les amis interviennent sur toutes les tiges.',
      repeter(n, 9));
    liste.push(d);
  }
  liste.push(drill('123-9-ar', '123 456 789 × 9 fois, puis retour à 0', '123456789',
    'Aller-retour complet : après 1 111 111 101, retirer 123 456 789 neuf fois ramène exactement à 0.',
    [...repeter(123456789, 9), ...repeter(123456789, 9, '-')]));
  liste.push(drill('987-9', '987 654 321 × 9 fois', '123456789',
    'La version descendante : ajouter 987 654 321 neuf fois donne 8 888 888 889.', repeter(987654321, 9)));
  liste.push(drill('12345679-9', '12 345 679 × 9 fois', '123456789',
    'Curiosité (sans le 8) : ajouter 12 345 679 neuf fois donne 111 111 111.', repeter(12345679, 9)));
  for (const n of [10, 20, 36, 100]) liste.push(drillSuite(n, false));
  liste.push(drillSuite(36, true));
  return liste;
}

/** Sous-totaux après chaque opération (points de contrôle). */
export function controles(operations) {
  let v = 0;
  return operations.map((o) => (v = o.op === '+' ? v + o.n : v - o.n));
}
