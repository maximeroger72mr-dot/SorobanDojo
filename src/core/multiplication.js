/**
 * Multiplication et division selon la méthode japonaise standard actuelle.
 *
 * MULTIPLICATION : 両落とし (ryō-otoshi), « les deux tombent ».
 *   On ne pose ni le multiplicande ni le multiplicateur : on les lit sur la feuille,
 *   et on ne pose sur le soroban que les produits partiels, au fur et à mesure.
 *   - Ordre : chiffre de gauche du multiplicande × chaque chiffre du multiplicateur (de gauche
 *     à droite), puis chiffre suivant du multiplicande, etc.
 *   - Chaque produit de table s'écrit sur DEUX tiges (dizaine, unité) : 2 × 3 = « 06 ».
 *   - Position (定位) : si les deux nombres ont m + n chiffres au total, la dizaine du premier
 *     produit se pose sur la (m+n)-ième tige en comptant la tige des unités comme la 1re.
 *     Chaque produit suivant se décale d'une tige vers la droite (par rapport au chiffre traité).
 *
 * DIVISION : 片落とし (kata-otoshi) avec la méthode du quotient (商除法).
 *   On pose seulement le dividende ; le diviseur se lit sur la feuille.
 *   - Pour chaque chiffre du quotient, on compare le début du dividende (restant) au diviseur :
 *     plus grand ou égal → le chiffre du quotient se pose DEUX tiges à gauche (une tige libre) ;
 *     plus petit → il se pose JUSTE à gauche.
 *   - Puis on soustrait les produits (chiffre du quotient × chaque chiffre du diviseur), chacun sur
 *     deux tiges, en commençant juste à droite du chiffre du quotient et en décalant d'une tige.
 *   - Position (定位) : l'unité du quotient est (chiffres du diviseur + 1) tiges à gauche de
 *     l'unité du dividende.
 *
 * Les « étapes macro » produites ici ({ texte, op, valeur }) sont rejouées par le lecteur de
 * démonstration, qui les décompose lui-même en gestes (petits amis, grands amis…).
 */

import { entier } from './aleatoire.js';
import { nomRang } from './gestes.js';

const chiffresDe = (n) => String(n).split('').map(Number);
const nbChiffres = (n) => String(n).length;

/** Nombre aléatoire de `k` chiffres, sans 0 en tête, et sans 1 seul (trop trivial) si k = 1. */
export function facteur(k) {
  if (k === 1) return entier(2, 9);
  return entier(10 ** (k - 1), 10 ** k - 1);
}

/**
 * Facteur « net » : comme facteur, mais jamais terminé par 0. Un 0 final rend le calcul plus
 * court (un produit « 00 » de moins à poser) et fait rencontrer la règle des zéros avant sa
 * leçon : on le réserve aux leçons sur les zéros.
 */
export function facteurNet(k) {
  for (;;) {
    const n = facteur(k);
    if (k === 1 || n % 10 !== 0) return n;
  }
}

// ------------------------------------------------------------------ génération

/**
 * Nombre de `k` chiffres (k ≥ 2) contenant au moins un zéro après le premier chiffre
 * (zéro interne de préférence : 406, 3 07 5…), le piège classique des examens.
 */
export function facteurAvecZero(k) {
  for (;;) {
    const n = facteur(k);
    const s = String(n);
    // k ≥ 3 : zéro au MILIEU et dernier chiffre non nul (406, pas 400) ; k = 2 : 40, 70…
    if (k >= 3 && s.endsWith('0')) continue;
    const interne = k >= 3 ? s.slice(1, -1).includes('0') : s.slice(1).includes('0');
    if (interne) return n;
    if (k >= 3) {
      const pos = entier(1, k - 2);
      return Number(s.slice(0, pos) + '0' + s.slice(pos + 1));
    }
  }
}

/** Multiplication : a (m chiffres) × b (n chiffres). zeros : un facteur au moins contient un zéro. */
export function genererMultiplication(m, n, zeros = false) {
  let a = facteurNet(m);
  let b = facteurNet(n);
  if (zeros) {
    if (m >= 2 && (n < 2 || Math.random() < 0.6)) a = facteurAvecZero(m);
    else b = facteurAvecZero(n);
  }
  return { type: 'mul', a, b, resultat: a * b };
}

/** Division exacte : diviseur de `nd` chiffres, quotient de `nq` chiffres. zeros : quotient avec un zéro. */
export function genererDivision(nd, nq, zeros = false) {
  const diviseur = facteurNet(nd);
  const quotient = zeros && nq >= 2 ? facteurAvecZero(nq) : facteurNet(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

/**
 * Division AVEC RESTE : diviseur de `nd` chiffres, quotient de `nq` chiffres, reste de 1 à
 * diviseur − 1. La réponse a deux parties : le quotient (`resultat`) et le reste (`reste`).
 */
export function genererDivisionReste(nd, nq) {
  const diviseur = Math.max(2, facteurNet(nd));
  const quotient = facteurNet(nq);
  const reste = entier(1, diviseur - 1);
  return { type: 'div', a: diviseur * quotient + reste, b: diviseur, resultat: quotient, reste };
}

// ------------------------------------------------------------------ marches (micro-étapes)

/**
 * Marches de la multiplication « 2 chiffres × 1 chiffre » (a = 10x + y, fois c) : deux produits
 * de table, x × c puis y × c posé une tige plus à droite. Chaque marche isole UNE difficulté.
 *  - mul-direct  : deux produits à 2 chiffres, qui s'ajoutent sans retenue ;
 *  - mul-retenue : deux produits à 2 chiffres, dont l'addition fait une retenue ;
 *  - mul-court   : un produit à un seul chiffre (« 06 » : sa tige des dizaines reste vide) ;
 *  - mul-zero    : un produit qui finit par 0 (5 × 4 = 20) : une tige à laisser vide.
 */
export const MARCHES_MUL = {
  'mul-direct': (x, y, c) => x * c >= 10 && y * c >= 10 && (y * c) % 10 !== 0 && (x * c) % 10 !== 0 && ((x * c) % 10) + Math.floor((y * c) / 10) <= 9,
  'mul-retenue': (x, y, c) => x * c >= 10 && y * c >= 10 && (y * c) % 10 !== 0 && ((x * c) % 10) + Math.floor((y * c) / 10) >= 10,
  'mul-court': (x, y, c) => (x * c < 10 || y * c < 10) && (y * c) % 10 !== 0 && (x * c) % 10 !== 0,
  'mul-zero': (x, y, c) => (x * c) % 10 === 0 || (y * c) % 10 === 0,
};

/**
 * Marches de la division « ÷ 1 chiffre, quotient à 2 chiffres » (a = b × q, q = 10u + v) : on
 * retire u × b, puis v × b une tige plus à droite.
 *  - div-court   : les deux produits à retirer n'ont qu'un chiffre (84 ÷ 4) ;
 *  - div-direct  : deux produits à 2 chiffres, retirés sans emprunt (252 ÷ 7) ;
 *  - div-emprunt : le premier produit se retire avec un emprunt (216 ÷ 8 : 21 − 16) ;
 *  - div-zero    : le dividende finit par 0 (150 ÷ 6) : le dernier produit finit par 0.
 */
export const MARCHES_DIV = {
  'div-court': (b, u, v) => u * b < 10 && v * b < 10,
  'div-direct': (b, u, v) => u * b >= 10 && v * b >= 10 && (v * b) % 10 !== 0 && Math.floor((b * (10 * u + v)) / 10) % 10 >= (u * b) % 10,
  'div-emprunt': (b, u, v) => u * b >= 10 && (v * b) % 10 !== 0 && Math.floor((b * (10 * u + v)) / 10) % 10 < (u * b) % 10,
  'div-zero': (b, u, v) => (v * b) % 10 === 0,
};

/** Retenues d'une multiplication : y en a-t-il, et l'une d'elles déborde-t-elle à gauche du produit ? */
export function retenuesMultiplication(a, b) {
  const somme = (x) => String(x).split('').reduce((t, c) => t + Number(c), 0);
  let valeur = 0;
  let retenue = false;
  let deborde = false;
  for (const m of etapesMultiplication(a, b).macros) {
    // Une addition sans retenue conserve la somme des chiffres.
    if (somme(valeur) + somme(m.valeur) !== somme(valeur + m.valeur)) retenue = true;
    if (m.deborde) deborde = true;
    valeur += m.valeur;
  }
  return { retenue, deborde };
}

/**
 * Marches tirées au hasard (trop de cas pour les énumérer) : on tire un calcul du bon format
 * jusqu'à ce qu'il réponde à la marche.
 *  - mul22-direct  : 2 × 2 chiffres, quatre produits qui s'ajoutent sans aucune retenue ;
 *  - mul22-retenue : des retenues, mais aucune ne sort des deux tiges du produit ;
 *  - mul22-deborde : une retenue déborde à gauche des deux tiges du produit ;
 *  - div21-direct  : ÷ 2 chiffres, quotient 1 chiffre, l'estimation tombe juste du premier coup ;
 *  - div22-direct  : ÷ 2 chiffres, quotient 2 chiffres, les deux estimations tombent juste ;
 *  - div22-corrige : ÷ 2 chiffres, quotient 2 chiffres, une estimation au moins est à corriger.
 */
const estimationsJustes = (ex) => aideDivision(ex.a, ex.b).etapes.every((e) => e.essais.length === 1);
export const MARCHES_TIRAGE = {
  'mul22-direct': { tirer: () => genererMultiplication(2, 2), ok: (ex) => !retenuesMultiplication(ex.a, ex.b).retenue },
  'mul22-retenue': { tirer: () => genererMultiplication(2, 2), ok: (ex) => { const r = retenuesMultiplication(ex.a, ex.b); return r.retenue && !r.deborde; } },
  'mul22-deborde': { tirer: () => genererMultiplication(2, 2), ok: (ex) => retenuesMultiplication(ex.a, ex.b).deborde },
  'div21-direct': { tirer: () => genererDivision(2, 1), ok: estimationsJustes },
  'div22-direct': { tirer: () => genererDivision(2, 2), ok: estimationsJustes },
  'div22-corrige': { tirer: () => genererDivision(2, 2), ok: (ex) => !estimationsJustes(ex) },
};

/** Un exercice d'une marche (tous les cas possibles, tirés au hasard ; jamais deux fois de suite le même). */
const dernierMarche = {};
export function genererMarche(marche) {
  const tirage = MARCHES_TIRAGE[marche];
  if (tirage) {
    let ex = tirage.tirer();
    // 2 000 essais au plus : au-delà (jamais vu), on rend le dernier calcul plutôt que de boucler.
    for (let e = 0; e < 2000 && (!tirage.ok(ex) || `${ex.a}|${ex.b}` === dernierMarche[marche]); e++) ex = tirage.tirer();
    dernierMarche[marche] = `${ex.a}|${ex.b}`;
    return ex;
  }
  const mul = MARCHES_MUL[marche];
  const div = MARCHES_DIV[marche];
  if (!mul && !div) return null;
  const cas = [];
  for (let p = 1; p <= 9; p++) for (let q = 1; q <= 9; q++) for (let r = 2; r <= 9; r++) {
    if (mul ? mul(p, q, r) : div(r, p, q)) cas.push([p, q, r]);
  }
  let c;
  do { c = cas[entier(0, cas.length - 1)]; } while (cas.length > 1 && c.join() === dernierMarche[marche]);
  dernierMarche[marche] = c.join();
  if (mul) { const a = 10 * c[0] + c[1]; return { type: 'mul', a, b: c[2], resultat: a * c[2] }; }
  const q = 10 * c[0] + c[1];
  return { type: 'div', a: c[2] * q, b: c[2], resultat: q };
}

// ------------------------------------------------------------------ placement (réflexe de position)

/**
 * Exercice de placement : sur quelle tige commence le calcul ?
 *  - multiplication : la tige de la DIZAINE du premier produit = (m + n)-ième tige depuis les unités ;
 *  - division : la tige du premier chiffre du quotient (règle « deux tiges / juste à gauche »).
 * Le rang est compté depuis la tige des unités (unités = rang 0).
 */
export function genererPlacement(op, niveau = 1) {
  if (op === 'mul') {
    const m = entier(1, Math.min(4, 1 + niveau));
    const n = entier(1, Math.min(3, niveau));
    const a = facteur(Math.max(m, 1));
    const b = facteur(n);
    const total = String(a).length + String(b).length;
    return {
      type: 'placement', op, a, b, rang: total - 1, nbTiges: Math.max(7, total + 2),
      explication: `${String(a).length} + ${String(b).length} = ${total} chiffres au total : la dizaine du premier produit (${chiffresDe(a)[0]} × ${chiffresDe(b)[0]} = ${deuxChiffres(chiffresDe(a)[0] * chiffresDe(b)[0])}) va sur la ${total}e tige en comptant les unités comme la 1re.`,
    };
  }
  const nd = entier(1, Math.min(3, niveau));
  const nq = entier(1, Math.min(3, niveau + 1));
  const { a, b } = genererDivision(nd, nq);
  const e = etapesDivision(a, b);
  const nqReel = String(e.resultat).length;
  const rang = e.rangUniteQuotient + nqReel - 1;
  const ta = String(a).length;
  const debut = Number(String(a).slice(0, String(b).length));
  const deux = debut >= b;
  return {
    type: 'placement', op, a, b, rang, nbTiges: Math.max(7, rang + 2),
    explication: `On compare le début du dividende (${debut}) au diviseur ${b} : ${deux ? `${debut} ≥ ${b}, le premier chiffre du quotient se pose DEUX tiges à gauche du premier chiffre du dividende` : `${debut} < ${b}, il se pose JUSTE à gauche du premier chiffre du dividende`} (le dividende occupe les ${ta} tiges de droite).`,
  };
}

// ------------------------------------------------------------------ étapes de démonstration

const nomsTiges = (r1, r2) => `${nomRang(r1)} et ${nomRang(r2)}`;
const deuxChiffres = (p) => String(p).padStart(2, '0');

/**
 * Étapes de la multiplication a × b (両落とし).
 * @returns {{ nbTiges, depart: 0, macros: Array<{texte, op, valeur}>, lecture: string }}
 */
export function etapesMultiplication(a, b) {
  const ca = chiffresDe(a);
  const cb = chiffresDe(b);
  const total = ca.length + cb.length;
  const macros = [{
    texte: `${a} × ${b} : ${ca.length} + ${cb.length} = ${total} chiffres au total. Le premier produit se pose avec sa dizaine sur la ${total}e tige en partant des unités (les ${nomRang(total - 1)}).`,
    op: '+', valeur: 0,
  }];
  let valeur = 0;
  ca.forEach((x, i) => {
    cb.forEach((y, j) => {
      const p = x * y;
      const rangDizaine = total - 1 - i - j;
      // Débordement : le produit s'ajoute sur ses deux tiges, et la retenue monte sur une
      // troisième tige, à gauche. C'est là qu'on perd sa place si l'index gauche suit la retenue.
      const ajout = p * 10 ** (rangDizaine - 1);
      const gauche = 10 ** (rangDizaine + 1);
      const deborde = Math.floor((valeur + ajout) / gauche) !== Math.floor(valeur / gauche);
      valeur += ajout;
      macros.push({
        deborde,
        texte: p === 0
          ? `${x} × ${y} = 00 : rien à poser sur les tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}, MAIS on avance quand même d'une tige. Oublier ce décalage est l'erreur n° 1 avec les zéros.`
          : `${x} × ${y} = ${deuxChiffres(p)} : on ajoute « ${deuxChiffres(p)} » sur les tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}${p < 10 ? ' (la dizaine est vide : seul le ' + p + ' se pose, sur la tige de droite)' : ''}.${deborde ? ` Attention : la retenue DÉBORDE sur la tige des ${nomRang(rangDizaine + 1)}, à gauche des deux tiges du produit. C'est normal. L'index gauche ne la suit pas : il reste sur sa tige, et le produit suivant se pose une tige plus à droite, comme prévu.` : ''}`,
        op: '+',
        valeur: p * 10 ** (rangDizaine - 1),
      });
    });
  });
  return { nbTiges: total + 2, depart: 0, macros, lecture: `Résultat : ${a * b}, lu à partir de la tige des unités.`, resultat: a * b };
}

/** Une multiplication où un produit fait déborder une retenue à gauche de ses deux tiges. */
export const multiplicationDeborde = (a, b) => etapesMultiplication(a, b).macros.some((m) => m.deborde);

/**
 * Estimation d'un chiffre du quotient, telle qu'on la fait de tête (méthode standard) :
 * on arrondit le diviseur à sa première tranche (18 → 20, 43 → 40) et on divise le début
 * du reste par ce nombre rond. Avec un diviseur arrondi AU-DESSUS, l'estimation est trop
 * petite ou juste ; arrondi AU-DESSOUS, elle peut être trop grande.
 * @returns {{ estime, arrondi }}  arrondi : le diviseur arrondi utilisé
 */
export function estimerChiffre(resteLocal, b) {
  const cb = chiffresDe(b);
  if (cb.length === 1) return { estime: Math.min(9, Math.floor(resteLocal / b)), arrondi: b };
  const tete = cb[0] + (cb[1] >= 5 ? 1 : 0);
  const arrondi = tete * 10 ** (cb.length - 1);
  return { estime: Math.min(9, Math.floor(resteLocal / arrondi)), arrondi };
}

/**
 * Aide « Je suis bloqué » : pour chaque chiffre du quotient, le raisonnement complet
 * (diviseur arrondi, estimation, vérification par le produit, correction éventuelle).
 * @returns {{ table: number[], etapes: Array<{ reste, arrondi, estime, essais: Array<{q, produit, ok}>, chiffre }> }}
 */
export function aideDivision(a, b) {
  const q = Math.floor(a / b);
  const cq = chiffresDe(q);
  let reste = a;
  const etapes = [];
  cq.forEach((chiffre, i) => {
    const puissance = 10 ** (cq.length - 1 - i);
    const resteLocal = Math.floor(reste / puissance);
    const { estime, arrondi } = estimerChiffre(resteLocal, b);
    const essais = [];
    let x = estime;
    // Vérification de tête : le produit doit tenir dans le reste, et le reste suivant doit être < b.
    for (let garde = 0; garde < 10; garde++) {
      const produit = x * b;
      if (produit > resteLocal) { essais.push({ q: x, produit, ok: false, raison: 'trop grand' }); x -= 1; continue; }
      if (resteLocal - produit >= b) { essais.push({ q: x, produit, ok: false, raison: 'trop petit' }); x += 1; continue; }
      essais.push({ q: x, produit, ok: true });
      break;
    }
    etapes.push({ resteLocal, arrondi, estime, essais, chiffre });
    reste -= chiffre * b * puissance;
  });
  return { table: Array.from({ length: 9 }, (_, i) => (i + 1) * b), etapes };
}

/**
 * Étapes de la division a ÷ b (片落とし, 商除法), division exacte, AVEC estimation du quotient :
 *  - estimation par le diviseur arrondi ;
 *  - estimation trop grande : corrigée de tête AVANT de bouger les boules (le produit ne tient pas) ;
 *  - estimation trop petite : constatée sur le soroban (le reste dépasse le diviseur) : on ajoute 1
 *    au quotient et on retire encore une fois le diviseur.
 * L'unité du dividende est posée sur la tige des unités : les noms de tiges se lisent par rapport à lui.
 * @returns {{ nbTiges, depart, macros, rangUniteQuotient, lecture, resultat }}
 */
export function etapesDivision(a, b) {
  const q = Math.floor(a / b);
  const nd = nbChiffres(b);
  const rangUniteQ = nd + 1;
  const cq = chiffresDe(q);
  const cb = chiffresDe(b);
  let reste = a;
  const macros = [{
    texte: `On pose le dividende ${a}. Le diviseur ${b} n'est pas posé (片落とし). L'unité du quotient sera ${nd} + 1 = ${nd + 1} tiges à gauche de l'unité du dividende.`,
    op: '+', valeur: 0,
  }];
  /** Retire chiffre × diviseur, produit par produit, sur deux tiges chacun. */
  const retirerProduits = (chiffre, r) => cb.forEach((y, j) => {
    const p = chiffre * y;
    const rangDizaine = r - 1 - j;
    macros.push({
      texte: `${chiffre} × ${y} = ${deuxChiffres(p)} : on retire « ${deuxChiffres(p)} » des tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}.`,
      op: '-', valeur: p * 10 ** (rangDizaine - 1),
    });
    reste -= p * 10 ** (rangDizaine - 1);
  });

  cq.forEach((chiffre, i) => {
    const r = rangUniteQ + cq.length - 1 - i;
    const puissance = 10 ** (r - nd - 1);
    const resteLocal = Math.floor(reste / puissance);
    if (chiffre === 0) {
      macros.push({ texte: `À cet endroit le reste (${resteLocal}) est plus petit que ${b} : le chiffre du quotient est 0. La tige reste VIDE, mais elle compte : le chiffre suivant se pose une tige plus à droite. Ne pas « tasser » le quotient.`, op: '+', valeur: 0 });
      return;
    }
    const tete = reste > 0 ? nbChiffres(reste) - 1 : -1;
    const regle = r === tete + 2
      ? `le début du reste est plus grand ou égal à ${b} : le chiffre se pose deux tiges à gauche (une tige libre)`
      : `le début du reste est plus petit que ${b} : le chiffre se pose juste à gauche`;
    let { estime, arrondi } = estimerChiffre(resteLocal, b);
    let texteEstim = nd === 1
      ? `Combien de fois ${b} dans ${resteLocal} ? ${estime}.`
      : `Estimation : ${b} est proche de ${arrondi} ; ${resteLocal} ÷ ${arrondi} ≈ ${estime}.`;
    // Trop grand : on le voit de tête (le produit ne tient pas), on corrige avant de poser.
    while (estime * b > resteLocal) {
      texteEstim += ` Vérification : ${estime} × ${b} = ${estime * b}, plus que ${resteLocal} : trop grand, on prend ${estime - 1}.`;
      estime -= 1;
    }
    macros.push({ texte: `${texteEstim} On pose ${estime} sur la tige des ${nomRang(r)} (règle : ${regle}).`, op: '+', valeur: estime * 10 ** r });
    retirerProduits(estime, r);
    // Trop petit : le reste dépasse encore le diviseur → +1 au quotient, on retire encore le diviseur.
    for (let k = estime; k < chiffre; k++) {
      macros.push({
        texte: `Le reste (${Math.floor(reste / puissance)}) est encore plus grand ou égal à ${b} : le chiffre était trop petit. On ajoute 1 au quotient (${k} → ${k + 1}) et on retire encore ${b}.`,
        op: '+', valeur: 10 ** r,
      });
      retirerProduits(1, r);
    }
  });
  return {
    nbTiges: rangUniteQ + cq.length + 1,
    depart: a,
    macros,
    rangUniteQuotient: rangUniteQ,
    lecture: `Quotient : ${q}, lu à gauche du reste (qui vaut 0). Son unité est sur la tige des ${nomRang(rangUniteQ)}, ${nd + 1} tiges à gauche de l'unité du dividende.`,
    resultat: q,
  };
}

/**
 * Rattraper un chiffre du quotient TROP GRAND de 1, sans tout effacer.
 *
 * On a posé le chiffre estimé et commencé à retirer ses produits ; au produit suivant, il n'y a
 * plus assez sur le soroban. Au lieu de recommencer : on retire 1 au chiffre du quotient, on
 * REND les chiffres du diviseur déjà retirés une fois de trop (un par produit déjà fait, chacun
 * sur la tige de droite de son produit), puis on continue avec le chiffre corrigé.
 *
 * @param {number} a  dividende (partiel : la division n'a pas à tomber juste)
 * @param {number} b  diviseur à 2 chiffres ou plus ; le quotient entier de a par b tient sur 1 chiffre
 * @returns {{ nbTiges, depart, macros, lecture, resultat, rendus:number } | null}  null si le chiffre
 *   trop grand se voit dès le premier produit (rien à rattraper)
 */
export function etapesRattrapage(a, b) {
  const juste = Math.floor(a / b);
  const pose = juste + 1;
  const cb = chiffresDe(b);
  const nd = cb.length;
  if (nd < 2 || juste < 1 || pose > 9) return null;
  const r = nd + 1; // tige du chiffre du quotient
  const macros = [{
    texte: `On pose ${a}. On estime trop vite : ${pose}, posé sur la tige des ${nomRang(r)} sans vérifier de tête. En réalité ${pose} × ${b} = ${pose * b}, plus que ${a} : le chiffre est trop grand de 1.`,
    op: '+', valeur: pose * 10 ** r,
  }];
  let reste = a;
  let bloque = -1;
  for (let j = 0; j < nd; j++) {
    const valeur = pose * cb[j] * 10 ** (r - 2 - j);
    if (valeur > reste) { bloque = j; break; }
    macros.push({ texte: `${pose} × ${cb[j]} = ${deuxChiffres(pose * cb[j])} : on retire « ${deuxChiffres(pose * cb[j])} » des tiges des ${nomsTiges(r - 1 - j, r - 2 - j)}.`, op: '-', valeur });
    reste -= valeur;
  }
  if (bloque <= 0) return null;
  const p = pose * cb[bloque];
  macros.push({
    texte: `${pose} × ${cb[bloque]} = ${deuxChiffres(p)} : IMPOSSIBLE, il ne reste pas assez sur les tiges des ${nomsTiges(r - 1 - bloque, r - 2 - bloque)}. Le ${pose} était trop grand. On ne recommence pas : on retire 1 au quotient (${pose} → ${juste}).`,
    op: '-', valeur: 10 ** r,
  });
  for (let j = 0; j < bloque; j++) {
    macros.push({
      texte: `On rend ce qui a été retiré une fois de trop : le ${cb[j]} du diviseur, ajouté sur la tige des ${nomRang(r - 2 - j)} (la tige de droite du produit « × ${cb[j]} »).${bloque > 1 && j === 0 ? ` Il y a ${bloque} produits déjà faits : on rend ${bloque} chiffres du diviseur.` : ''}`,
      op: '+', valeur: cb[j] * 10 ** (r - 2 - j),
    });
    reste += cb[j] * 10 ** (r - 2 - j);
  }
  for (let j = bloque; j < nd; j++) {
    const valeur = juste * cb[j] * 10 ** (r - 2 - j);
    macros.push({ texte: `On continue avec ${juste} : ${juste} × ${cb[j]} = ${deuxChiffres(juste * cb[j])}, retiré des tiges des ${nomsTiges(r - 1 - j, r - 2 - j)}.`, op: '-', valeur });
    reste -= valeur;
  }
  return {
    nbTiges: r + 2, depart: a, macros, rendus: bloque, resultat: juste,
    lecture: `Quotient : ${juste}${reste ? `, et il reste ${reste} pour la suite de la division` : ''}. Rien n'a été effacé : un chiffre retiré au quotient, ${bloque > 1 ? `${bloque} chiffres du diviseur rendus` : 'le premier chiffre du diviseur rendu'}.`,
  };
}

/** Valeur finale du soroban après les étapes (pour les tests). */
export function appliquerMacros(depart, macros) {
  return macros.reduce((v, m) => (m.op === '+' ? v + m.valeur : v - m.valeur), depart);
}

// ------------------------------------------------------------------ nombres décimaux (3e kyū et plus)

import { diviserArrondi } from './nombres.js';

/**
 * Multiplication de décimaux : m et n chiffres significatifs, virgule placée au hasard
 * (au moins un facteur décimal). Résultat arrondi à `decimales` si nécessaire.
 */
export function genererMultiplicationDecimale(m, n, decimales = 3) {
  for (;;) {
    const A = facteur(m);
    const B = facteur(n);
    const pa = entier(0, Math.min(m, 3));
    const pb = entier(0, Math.min(n, 3));
    if (pa + pb === 0) continue;
    // Pas de zéro final derrière une virgule (187,70 s'afficherait 187,7 : décimales trompeuses).
    if ((pa && A % 10 === 0) || (pb && B % 10 === 0)) continue;
    const k = pa + pb;
    // decimales = 0 : résultat arrondi à l'unité (les montants des examens), s'il n'est pas entier.
    if (decimales === 0 && (A * B) % 10 ** k === 0) continue;
    const arrondi = k > decimales;
    const resultat = arrondi ? diviserArrondi(A * B, 10 ** k, decimales) : (A * B) / 10 ** k;
    return { type: 'mul', a: A / 10 ** pa, b: B / 10 ** pb, resultat, decimales: arrondi ? decimales : k, arrondi, entiers: [A, B], virgules: [pa, pb] };
  }
}

/** Division de décimaux : diviseur de nd chiffres, quotient arrondi à `decimales`. */
export function genererDivisionDecimale(nd, nq, decimales = 3) {
  for (;;) {
    const B = facteur(nd);
    const A = facteur(nq + nd - 1 + entier(0, 1));
    const pa = entier(0, 2);
    const pb = entier(0, Math.min(nd - 1, 2));
    if ((pa && A % 10 === 0) || (pb && B % 10 === 0)) continue;
    const resultat = diviserArrondi(A * 10 ** pb, B * 10 ** pa, decimales);
    // Éviter les quotients trop « ronds » ; à l'unité (decimales = 0), la division ne doit pas tomber juste.
    if (decimales === 0 ? (resultat < 10 || (A * 10 ** pb) % (B * 10 ** pa) === 0) : (resultat === 0 || Number.isInteger(resultat * 10))) continue;
    return { type: 'div', a: A / 10 ** pa, b: B / 10 ** pb, resultat, decimales, arrondi: true, entiers: [A, B], virgules: [pa, pb] };
  }
}

// ------------------------------------------------------------------ décimaux : la méthode par le compte des chiffres

/**
 * Compte signé des chiffres d'un nombre (méthode japonaise de position, 定位法) :
 *  - nombre ≥ 1 : nombre de chiffres avant la virgule (37,2 → 2) ;
 *  - 0,x : 0 (0,85 → 0) ;
 *  - 0,0x : −1, 0,00x : −2… (moins le nombre de zéros juste après la virgule).
 */
export function compteChiffres(x) {
  if (x >= 1) return String(Math.floor(x)).length;
  const dec = String(x).split('.')[1] ?? '';
  return -(dec.match(/^0*/)[0].length) || 0; // « || 0 » : évite −0
}

/** Nom de la tige qui porte le rang r, dit simplement (« 2e tige avant la virgule », « 1re après »). */
export function tigeDepuisRang(r) {
  if (r >= 0) return `la ${r + 1}${r === 0 ? 're' : 'e'} tige à gauche de la virgule (${nomRang(r)})`;
  return `la ${-r}${r === -1 ? 're' : 'e'} tige après la virgule (${nomRang(r)})`;
}

/**
 * Multiplication de décimaux, méthode la plus directe : compte des chiffres. On additionne les
 * comptes des deux facteurs (p) : la DIZAINE du premier produit se pose au rang p − 1, c'est-à-dire
 * directement à la bonne place par rapport à la virgule, sans la replacer à la fin.
 * Les valeurs des étapes sont en unités de 10^-decimales (pour la démonstration).
 */
export function etapesMultiplicationDecimale(a, b, A, B, pa, pb) {
  const base = etapesMultiplication(A, B);
  const ca = compteChiffres(a);
  const cb = compteChiffres(b);
  const p = ca + cb;
  const decimales = pa + pb;
  const macros = [{
    texte: `Compte des chiffres : ${String(a).replace('.', ',')} compte ${String(ca).replace('-', '−')}, ${String(b).replace('.', ',')} compte ${String(cb).replace('-', '−')} ; total ${String(p).replace('-', '−')}. La dizaine du premier produit se pose sur ${tigeDepuisRang(p - 1)}. Ensuite, exactement comme avec des entiers : on avance d'une tige par produit.`,
    op: '+', valeur: 0,
  }, ...base.macros.slice(1).map((m) => ({ ...m, texte: m.texte.replace(/sur les tiges des .*?([.(])/, '$1') }))];
  const resultat = (A * B) / 10 ** decimales;
  return {
    nbTiges: Math.max(p, 1) + decimales + 2,
    depart: 0,
    decimales,
    macros,
    lecture: `Résultat : ${String(resultat).replace('.', ',')}, lu directement par rapport au point des unités.`,
    resultat,
  };
}

/**
 * Division de décimaux : nombre de chiffres du quotient avant la virgule (compte signé) :
 * q = compte(dividende) − compte(diviseur), + 1 si le début du dividende est ≥ au diviseur.
 */
export function compteQuotient(a, b) {
  const sa = String(a).replace('.', '').replace(/^0+/, '');
  const sb = String(b).replace('.', '').replace(/^0+/, '');
  const debut = Number(sa.slice(0, sb.length).padEnd(sb.length, '0'));
  return compteChiffres(a) - compteChiffres(b) + (debut >= Number(sb) ? 1 : 0);
}

/** Additions et soustractions de décimaux : nombres avec 0 à `decimales` décimales, variées. */
export function genererColonneDecimale(lignes = 5, chiffresMax = 4, decimales = 2) {
  for (;;) {
    const D = decimales;
    const liste = [];
    let total = 0; // en unités de 10^-D
    for (let i = 0; i < lignes; i++) {
      const d = entier(0, D);
      const k = entier(2, chiffresMax);
      const brut = facteur(k);
      const echelle = brut * 10 ** (D - d);
      const op = i > 0 && Math.random() < 0.3 && total > echelle ? '-' : '+';
      total += op === '+' ? echelle : -echelle;
      liste.push({ op, n: brut / 10 ** d, echelle });
    }
    if (total < 0) continue;
    return { type: 'addsub', lignes: liste.map(({ op, n }) => ({ op, n })), echelles: liste.map((l) => l.echelle), resultat: total / 10 ** D, decimales: D };
  }
}

/** Multiplication de décimaux exacte (pas d'arrondi), petits facteurs, avec des 0,0x de temps en temps. */
export function genererMultiplicationDecimaleSimple(m, n) {
  for (;;) {
    const A = facteur(m);
    const B = facteur(n);
    if (A % 10 === 0 || B % 10 === 0) continue;
    const pa = entier(0, m + 1);
    const pb = entier(0, n);
    if (pa + pb === 0) continue;
    const a = A / 10 ** pa;
    const b = B / 10 ** pb;
    return { type: 'mul', a, b, resultat: (A * B) / 10 ** (pa + pb), decimales: pa + pb, entiers: [A, B], virgules: [pa, pb] };
  }
}

/** Division de décimaux exacte (quotient fini) : diviseur nd chiffres, quotient nq chiffres. */
export function genererDivisionDecimaleExacte(nd, nq) {
  for (;;) {
    const B = facteur(nd);
    const Q = facteur(nq);
    if (B % 10 === 0 || Q % 10 === 0) continue;
    const pb = entier(0, Math.min(2, nd));
    const pq = entier(0, Math.min(3, nq + 1));
    if (pb + pq === 0) continue;
    // dividende = quotient × diviseur, avec pb + pq décimales
    const a = (Q * B) / 10 ** (pb + pq);
    return { type: 'div', a, b: B / 10 ** pb, resultat: Q / 10 ** pq, decimales: pq, entiers: [Q * B, B], virgules: [pb + pq, pb] };
  }
}

/** Placement d'un produit décimal : rang de la dizaine du premier produit = compte(a) + compte(b) − 1. */
export function genererPlacementDecimal() {
  const ex = genererMultiplicationDecimaleSimple(entier(1, 3), entier(1, 2));
  const ca = compteChiffres(ex.a);
  const cb = compteChiffres(ex.b);
  const rang = ca + cb - 1;
  const D = 4;
  return {
    type: 'placement', op: 'mul', a: ex.a, b: ex.b, rang, nbTiges: Math.max(4, rang + 3) + D, decimalesAffichees: D,
    explication: `Compte des chiffres : ${String(ex.a).replace('.', ',')} → ${String(ca).replace('-', '−')}, ${String(ex.b).replace('.', ',')} → ${String(cb).replace('-', '−')} ; total ${String(ca + cb).replace('-', '−')}. La dizaine du premier produit va sur ${tigeDepuisRang(rang)}.`,
  };
}
