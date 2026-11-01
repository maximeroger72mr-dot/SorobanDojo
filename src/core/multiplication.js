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
  let a = facteur(m);
  let b = facteur(n);
  if (zeros) {
    if (m >= 2 && (n < 2 || Math.random() < 0.6)) a = facteurAvecZero(m);
    else b = facteurAvecZero(n);
  }
  return { type: 'mul', a, b, resultat: a * b };
}

/** Division exacte : diviseur de `nd` chiffres, quotient de `nq` chiffres. zeros : quotient avec un zéro. */
export function genererDivision(nd, nq, zeros = false) {
  const diviseur = facteur(nd);
  const quotient = zeros && nq >= 2 ? facteurAvecZero(nq) : facteur(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
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
  ca.forEach((x, i) => {
    cb.forEach((y, j) => {
      const p = x * y;
      const rangDizaine = total - 1 - i - j;
      macros.push({
        texte: p === 0
          ? `${x} × ${y} = 00 : rien à poser sur les tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}, MAIS on avance quand même d'une tige. Oublier ce décalage est l'erreur n° 1 avec les zéros.`
          : `${x} × ${y} = ${deuxChiffres(p)} : on ajoute « ${deuxChiffres(p)} » sur les tiges des ${nomsTiges(rangDizaine, rangDizaine - 1)}${p < 10 ? ' (la dizaine est vide : seul le ' + p + ' se pose, sur la tige de droite)' : ''}.`,
        op: '+',
        valeur: p * 10 ** (rangDizaine - 1),
      });
    });
  });
  return { nbTiges: total + 2, depart: 0, macros, lecture: `Résultat : ${a * b}, lu à partir de la tige des unités.`, resultat: a * b };
}

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
    if (resultat === 0 || Number.isInteger(resultat * 10)) continue; // éviter les quotients trop « ronds »
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
