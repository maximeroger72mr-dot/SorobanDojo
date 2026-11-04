/**
 * Calcul du quotidien, sur le soroban : des situations d'adulte qui donnent un sens à l'effort.
 *  - ticket de caisse : une colonne de prix à additionner (colonne décimale classique, expliquée
 *    pas à pas comme les autres) ;
 *  - rendu de monnaie : un complément (à 5, 10, 20, 50 ou 100 €), c'est le grand ami en grand ;
 *  - pourcentages : 10 %, 15 %, 25 %… d'un prix, une remise, la TVA ;
 *  - facture : quantités × prix unitaires, puis le total.
 *
 * Tous les montants sont calculés en centimes (entiers), pour des résultats exacts.
 * Exercices de type 'quotidien' : { texte: string[], resultat, decimales, astuce, unites }.
 */

const entier = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const hasard = (l) => l[Math.floor(Math.random() * l.length)];
const euros = (c) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const chiffres = (c) => String(c).length;

/** Prix réaliste en centimes (souvent en ,x9 ou ,x5). */
function prix(min, max) {
  const c = entier(min, max);
  const fin = hasard([9, 9, 9, 5, 0, entier(0, 9)]);
  return Math.max(min, c - (c % 10) + fin);
}

/** Articles de courses, avec une fourchette de prix réaliste (en centimes). */
const ARTICLES = [
  ['Pain', 95, 320], ['Lait 1 L', 89, 159], ['Café', 299, 899], ['Fromage', 249, 899], ['Pâtes', 79, 249],
  ['Pommes 1 kg', 199, 399], ['Poulet', 599, 1299], ['Yaourts x8', 189, 449], ['Riz', 129, 349], ['Huile d\'olive', 499, 1199],
  ['Chocolat', 129, 399], ['Lessive', 599, 1499], ['Jus d\'orange', 159, 389], ['Tomates', 199, 449], ['Beurre', 199, 399],
  ['Œufs x12', 249, 499], ['Eau x6', 199, 449], ['Biscuits', 119, 329],
];

/** Ticket de caisse : 4 à 7 articles à additionner. */
export function ticket() {
  const n = entier(4, 7);
  const articles = [...ARTICLES].sort(() => Math.random() - 0.5).slice(0, n);
  const cents = articles.map(([, min, max]) => prix(min, max));
  const total = cents.reduce((a, b) => a + b, 0);
  return {
    type: 'addsub', decimales: 2, euros: true, ticket: articles.map(([nom]) => nom), consigne: 'Ticket de caisse : quel est le total à payer (en €) ?',
    lignes: cents.map((c) => ({ op: '+', n: c / 100 })), echelles: cents, resultat: total / 100,
  };
}

/** Rendu de monnaie : total payé avec un billet, combien rendre ? */
export function monnaie() {
  const total = prix(120, 9850);
  const billets = [500, 1000, 2000, 5000, 10000].filter((b) => b > total);
  const paye = Math.random() < 0.75 ? billets[0] : billets[Math.min(1, billets.length - 1)];
  const rendu = paye - total;
  const palier = Math.ceil(total / 100) * 100;
  const etapes = palier === total || palier === paye ? `de ${euros(total)} à ${euros(paye)} : ${euros(rendu)} €`
    : `de ${euros(total)} à ${euros(palier)} il manque ${euros(palier - total)}, puis de ${euros(palier)} à ${euros(paye)} il manque ${euros(paye - palier)} : ${euros(rendu)} €`;
  return {
    type: 'quotidien', decimales: 2, euros: true, resultat: rendu / 100, unites: chiffres(total),
    texte: [`Total : ${euros(total)} €`, `Payé avec un billet de ${euros(paye)} €`, 'Combien rendre (en €) ?'],
    astuce: `Comme un commerçant, on complète : ${etapes}. Sur le soroban : posez ${euros(paye)}, retirez ${euros(total)} (des grands amis à chaque tige).`,
  };
}

const fmt = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Méthode de tête pour p % de x euros (et le calcul au soroban). */
function methode(p, x) {
  const dix = x / 10;
  const m = {
    10: `10 % = ${fmt(x)} ÷ 10 = ${fmt(dix)}`,
    5: `10 % = ${fmt(dix)}, et 5 % en est la moitié : ${fmt(dix / 2)}`,
    15: `10 % = ${fmt(dix)}, 5 % = la moitié (${fmt(dix / 2)}), et 15 % = les deux ensemble`,
    20: `10 % = ${fmt(dix)}, doublé`,
    25: `25 % = le quart : la moitié de la moitié de ${fmt(x)}`,
    50: `50 % = la moitié de ${fmt(x)}`,
    30: `10 % = ${fmt(dix)}, triplé`,
    75: `75 % = trois quarts : ${fmt(x)} moins son quart (${fmt(x / 4)})`,
  }[p];
  return `${m}. Au soroban : ${fmt(x)} × ${fmt(p / 100)}.`;
}

/** Pourcentages : p % d'un prix, prix après remise, ou prix TTC. */
export function pourcentage() {
  const sorte = hasard(['part', 'part', 'remise', 'tva']);
  if (sorte === 'tva') {
    const ht = entier(2, 60) * 5;
    const ttc = ht * 1.2;
    return {
      type: 'quotidien', decimales: 2, euros: true, resultat: ttc, unites: chiffres(ht) + 1,
      texte: [`Prix hors taxes : ${ht} €`, 'TVA de 20 %', 'Prix TTC (en €) ?'],
      astuce: `20 % de ${ht} = ${fmt(ht * 0.2)} (10 % doublé), donc ${ht} + ${fmt(ht * 0.2)} = ${fmt(ttc)}. Ou en un calcul : ${ht} × 1,2.`,
    };
  }
  const p = hasard([10, 20, 25, 50, 5, 15, 30, 75]);
  const x = entier(1, 25) * 20;
  const part = (x * p) / 100;
  if (sorte === 'remise') {
    return {
      type: 'quotidien', decimales: 2, euros: true, resultat: x - part, unites: chiffres(x) + 1,
      texte: [`Prix affiché : ${x} €`, `Remise de ${p} %`, 'Prix payé (en €) ?'],
      astuce: `La remise vaut ${p} % de ${x} = ${fmt(part)} (${methode(p, x).split('. Au')[0]}), donc ${x} − ${fmt(part)} = ${fmt(x - part)}. Ou directement : ${x} × ${fmt((100 - p) / 100)}.`,
    };
  }
  return {
    type: 'quotidien', decimales: 2, euros: true, resultat: part, unites: chiffres(x) + 1,
    texte: [`${p} % de ${x} €`, 'Combien (en €) ?'],
    astuce: methode(p, x),
  };
}

/** Facture : 2 à 4 lignes « quantité × prix unitaire », puis le total. */
export function facture() {
  const lignes = Array.from({ length: entier(2, 4) }, () => ({ q: entier(2, 6), c: prix(50, 3000) }));
  const total = lignes.reduce((t, l) => t + l.q * l.c, 0);
  return {
    type: 'quotidien', decimales: 2, euros: true, resultat: total / 100, unites: lignes.length * 3,
    texte: ['Facture :', ...lignes.map((l) => `${l.q} × ${euros(l.c)} €`), 'Total (en €) ?'],
    astuce: `Chaque ligne est une multiplication : ${lignes.map((l) => `${l.q} × ${euros(l.c)} = ${euros(l.q * l.c)}`).join(' ; ')}. Au soroban, posez chaque produit à la suite du précédent : le total se fait tout seul.`,
  };
}

export const SORTES = {
  ticket: { titre: 'Ticket de caisse', generer: ticket },
  monnaie: { titre: 'Rendre la monnaie', generer: monnaie },
  pourcentage: { titre: 'Pourcentages, remises, TVA', generer: pourcentage },
  facture: { titre: 'Vérifier une facture', generer: facture },
  melange: { titre: 'Tout mélangé', generer: () => hasard([ticket, monnaie, pourcentage, facture])() },
};
