/**
 * Épreuves au format des examens de soroban (珠算能力検定), du 10e au 1er kyū, et les grades
 * intermédiaires 準1, 準2, 準3 (créés en 2014).
 * Référentiel : 日本珠算連盟 (shuzan.jp, « 珠算能力検定試験 ») pour le tableau, et les sujets
 * modèles officiels (見本) des 1er, 2e, 3e, 4e, 6e, 7e et 9e kyū pour la forme des problèmes.
 *
 *  - 1er au 6e kyū (et 準) : 10 mitorizan, 20 multiplications, 20 divisions, 30 minutes pour le
 *    tout, 300 points ; réussite à 240 (1er au 3e, 準) ou 210 (4e au 6e). Pas de note minimale
 *    par partie (最低点は設けていません).
 *  - 7e au 10e kyū : 20 minutes, 200 points, réussite à 120 (60 au 10e). Les 9e et 10e kyū sont
 *    le MÊME sujet : seul le seuil change. Pas de division aux 9e et 10e.
 *  - Mitorizan : le règlement fixe le nombre de lignes (口) et le TOTAL de chiffres (字) :
 *    10口100字 au 1er, 80 au 2e, 60 au 3e, 50 au 4e, 40 au 5e, 30 au 6e ; 2けた 10口 au 7e,
 *    8口 au 8e, 5口 aux 9e et 10e ; 準1 90, 準2 70, 準3 5 problèmes à 50 et 5 à 60.
 *    Dans TOUS les sujets modèles, les nombres d'un problème ont la même longueur (100字 = 10
 *    nombres de 10 chiffres) : c'est ce que fait l'application (`chiffres`).
 *  - Sujets modèles : les problèmes 3, 5, 7 et 9 mêlent additions et soustractions, les autres
 *    sont des additions. 4 lignes négatives (souvent deux paires) du 1er au 6e kyū, 3 au 7e, 1
 *    aux 9e et 10e ; jamais en 1re, 2e ni dernière ligne. Au 8e kyū (pas de sujet modèle en
 *    ligne), 2 lignes : valeur interpolée, d'où `verifie: false`.
 *  - Résultat négatif (補数) : un seul, au problème 9, aux 1er et 2e kyū (pas au 3e).
 *  - Multiplication : « chiffres des deux facteurs au total » (実法合わせて) ; division :
 *    « chiffres du diviseur et du quotient au total » (法商合わせて). Les sujets modèles ont des
 *    facteurs terminés par 0 (130 × 97, 300 ÷ 20) : on en garde.
 *  - 1er au 3e kyū : la première moitié des × et des ÷ est en nombres sans unité, arrondis au
 *    millième ; la seconde en montants (円), arrondis à l'unité. Environ la moitié des problèmes
 *    sont des entiers (sujet modèle du 3e kyū : 1 085 × 327, 0,0176 × 47,5…).
 *  - `formes` : découpage imposé des chiffres ([facteur, facteur] ou [diviseur, quotient]) :
 *    2 × 1 aux 10e et 9e kyū, 2 × 2 au 7e, 3 × 2 ou 2 × 3 et 2 ÷ 2 au 6e (sujets modèles).
 *  - `milliers` (1er au 3e kyū) : réponses écrites avec séparateurs de milliers. L'application
 *    ne l'exige qu'en « examen pur ».
 *
 * `verifie` : le format a été contrôlé sur le tableau ET sur un sujet modèle officiel.
 */

import { entier } from './aleatoire.js';
import { facteur, genererMultiplicationDecimale, genererDivisionDecimale } from './multiplication.js';
import { genererDenpyo } from './denpyo.js';

/** Problèmes mêlant additions et soustractions dans les sujets modèles : 3, 5, 7 et 9. */
export const MIXTES = [2, 4, 6, 8];

/**
 * mitori : { nb, lignes, chiffres (longueur des nombres), chiffresParProbleme?, mixtes, moins
 *            (lignes négatives d'un problème mixte), points, negatifs? [min, max], rangNegatif? }
 * mul    : { nb, total, points, decimales? }  div : { nb, total, points, decimales? }
 * decimales : rang d'arrondi de la PREMIÈRE moitié ; la seconde s'arrondit à l'unité.
 */
const mitori = (lignes, chiffres, moins, x = {}) => ({ nb: 10, lignes, chiffres, min: chiffres, max: chiffres, soustractions: true, mixtes: MIXTES, moins, points: 10, ...x });
const NEG = { negatifs: [1, 1], rangNegatif: 8 };
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.3, confirme: false, verifie: true,
    mitori: mitori(5, 2, 1), mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.6, confirme: false, verifie: true,
    mitori: mitori(5, 2, 1), mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: mitori(8, 2, 2),
    mul: { nb: 10, total: 4, formes: [[3, 1]], points: 5 }, div: { nb: 10, total: 3, formes: [[1, 2]], points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.6, confirme: false, verifie: true,
    mitori: mitori(10, 2, 3),
    mul: { nb: 10, total: 4, formes: [[2, 2]], points: 5 }, div: { nb: 10, total: 4, formes: [[1, 3]], points: 5 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: true, verifie: true,
    mitori: mitori(10, 3, 4),
    mul: { nb: 20, total: 5, formes: [[3, 2], [2, 3]], points: 5 }, div: { nb: 20, total: 4, formes: [[2, 2]], points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: true, verifie: true,
    mitori: mitori(10, 4, 4), mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: true, verifie: true,
    mitori: mitori(10, 5, 4), mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: 'j3', nom: '3e kyū préparatoire (準3)', japonais: '準3級', jun: true, minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: mitori(10, 5, 4, { max: 6, chiffresParProbleme: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6] }),
    mul: { nb: 20, total: 7, points: 5, decimales: 3 }, div: { nb: 20, total: 6, points: 5, decimales: 3 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true, verifie: true, milliers: true,
    mitori: mitori(10, 6, 4), mul: { nb: 20, total: 7, points: 5, decimales: 3 }, div: { nb: 20, total: 6, points: 5, decimales: 3 } },
  { id: 'j2', nom: '2e kyū préparatoire (準2)', japonais: '準2級', jun: true, minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: mitori(10, 7, 4, NEG), mul: { nb: 20, total: 8, points: 5, decimales: 3 }, div: { nb: 20, total: 7, points: 5, decimales: 3 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true, verifie: true, milliers: true,
    mitori: mitori(10, 8, 4, NEG), mul: { nb: 20, total: 9, points: 5, decimales: 3 }, div: { nb: 20, total: 8, points: 5, decimales: 3 } },
  { id: 'j1', nom: '1er kyū préparatoire (準1)', japonais: '準1級', jun: true, minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: mitori(10, 9, 4, NEG), mul: { nb: 20, total: 10, points: 5, decimales: 3 }, div: { nb: 20, total: 9, points: 5, decimales: 3 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true, verifie: true, milliers: true,
    mitori: mitori(10, 10, 4, NEG), mul: { nb: 20, total: 11, points: 5, decimales: 3 }, div: { nb: 20, total: 10, points: 5, decimales: 3 } },
];
/** Les grades « 準 » : passables à l'écran Épreuves, hors de la frise des kyū (comme au Japon, facultatifs). */
export const GRADES_KYU = GRADES.filter((g) => !g.jun);

/**
 * Zenkoren (全国珠算教育連盟) : plus exigeant sur le TEMPS. Chaque épreuve a son chrono de
 * 7 minutes, 15 problèmes à 10 points, et il faut 10 justes sur 15 dans CHACUNE (aucune
 * compensation entre épreuves). Ordre : multiplication, division, additions-soustractions.
 * 10e kyū : deux épreuves d'additions-soustractions (A : additions seules, B : mêlées) ; 9e :
 * multiplication et additions-soustractions ; à partir du 8e : les trois.
 *
 * Le nombre de chiffres par problème n'est pas publié : on reprend celui du MÊME grade Nisshō.
 * Un kyū Zenkoren est donc au moins aussi dur que le kyū Nisshō du même rang (mêmes nombres,
 * 15 problèmes au lieu de 10 ou 20, temps par épreuve, réussite exigée partout), jamais moins.
 * Du 3e au 1er kyū, deux matières AU CHOIX s'ajoutent (0.38.4) : le denpyōzan et l'anzan (le
 * calcul appliqué n'est pas proposé). Chacune choisie compte comme les autres : 10 justes sur 15.
 * Leur format n'est pas publié : il est ESTIMÉ (voir OPTIONS_KYU_ZENKOREN).
 */
export const MINUTES_EPREUVE_ZENKOREN = 7;
export const JUSTES_EPREUVE_ZENKOREN = 10;
/**
 * Lignes par problème d'additions-soustractions : 15 problèmes en 7 minutes, avec 10 lignes,
 * demanderaient 2 à 3 fois la cadence Nisshō du même grade (179 CPM au 1er kyū). On garde les
 * mêmes nombres de chiffres par ligne et on raccourcit la colonne pour viser 1,3 à 1,9 fois la
 * cadence Nisshō : plus dur, sans devenir irréaliste (voir tests/zenkoren.test.js).
 */
export const LIGNES_ZENKOREN = { 10: 5, 9: 5, 8: 5, 7: 6, 6: 5, 5: 6, 4: 6, 3: 7, 2: 8, 1: 8 };

/**
 * Matières au choix des kyū Zenkoren, du 3e au 1er (format ESTIMÉ, non publié) :
 *  - denpyōzan (伝票算) : 15 problèmes, liasse de 20 bordereaux de 5 lignes, une ligne sur 10
 *    bordereaux par problème ; nombres de 3 à 5 (3e), 6 (2e), 7 chiffres (1er, comme au dan) ;
 *    7 minutes ;
 *  - anzan (暗算) : 5 ×, 5 ÷ et 5 mitori de tête, au format du kyū d'anzan Nisshō du même rang
 *    (× et ÷ de 4, 4, puis 5 chiffres au total ; mitori de 5, 7, puis 10 lignes de 3 chiffres) ;
 *    3 minutes, comme l'anzan du dan.
 * 15 problèmes à 10 points chacune, 10 justes exigés dans chaque matière choisie.
 */
export const OPTIONS_KYU_ZENKOREN = ['denpyo', 'anzan'];
export const MATIERES_OPTION_KYU = { denpyo: { titre: 'Denpyōzan (伝票算)', minutes: 7 }, anzan: { titre: 'Anzan (暗算)', minutes: 3 } };
const FORMAT_OPTIONS_KYU = {
  3: { denpyoMax: 5, anzanTotal: 4, anzanLignes: 5 },
  2: { denpyoMax: 6, anzanTotal: 4, anzanLignes: 7 },
  1: { denpyoMax: 7, anzanTotal: 5, anzanLignes: 10 },
};
/** Minutes d'un examen Zenkoren avec les options choisies. */
export const minutesZenkoren = (g, options = []) => g.minutes + (g.options ? options.filter((k) => g.options[k]).reduce((t, k) => t + MATIERES_OPTION_KYU[k].minutes, 0) : 0);
function versZenkoren(g) {
  const q = { nb: 15, points: 10 };
  const lignes = LIGNES_ZENKOREN[g.id] ?? g.mitori.lignes;
  // Les 9 premiers problèmes en additions, les 6 suivants mêlés ; le résultat négatif éventuel
  // tombe dans la seconde moitié. Lignes négatives : la même proportion qu'au Nisshō.
  const { mixtes, rangNegatif, ...base } = g.mitori;
  const moins = Math.max(1, Math.min(lignes - 3, Math.round((g.mitori.moins * lignes) / g.mitori.lignes)));
  const mitori = { ...base, ...q, lignes, moins, pures: 9 };
  const z = { id: g.id, nom: g.nom, japonais: g.japonais, systeme: 'zenkoren', parEpreuve: true, confirme: g.confirme, verifie: false, milliers: g.milliers,
    seuil: JUSTES_EPREUVE_ZENKOREN / 15, minutesEpreuve: MINUTES_EPREUVE_ZENKOREN };
  const fo = FORMAT_OPTIONS_KYU[g.id];
  if (fo) z.options = {
    denpyo: { ...q, minutes: MATIERES_OPTION_KYU.denpyo.minutes, min: 3, max: fo.denpyoMax },
    anzan: { ...q, minutes: MATIERES_OPTION_KYU.anzan.minutes, total: fo.anzanTotal, lignes: fo.anzanLignes, chiffres: 3 },
  };
  if (g.id === '10') Object.assign(z, { mitoriA: { ...mitori, soustractions: false, pures: 15 }, mitori: { ...mitori, pures: 0 } });
  else {
    z.mitori = mitori;
    if (g.mul) z.mul = { ...g.mul, ...q };
    if (g.div) z.div = { ...g.div, ...q };
  }
  z.minutes = MINUTES_EPREUVE_ZENKOREN * ['mitoriA', 'mitori', 'mul', 'div'].filter((k) => z[k]).length;
  return z;
}
export const GRADES_ZENKOREN = GRADES_KYU.map(versZenkoren);

/** Les deux systèmes de grades. Nisshō par défaut. */
export const SYSTEMES = {
  nissho: { id: 'nissho', nom: 'Nisshō', long: 'Nisshō (Chambre de commerce) et Nihon Shuzan Renmei', grades: GRADES_KYU, record: (id) => `epreuve-${id}` },
  zenkoren: { id: 'zenkoren', nom: 'Zenkoren', long: 'Zenkoren (全国珠算教育連盟)', grades: GRADES_ZENKOREN, record: (id) => `zenkoren-${id}` },
};
export const systemeChoisi = (d) => SYSTEMES[d?.reglages?.systemeGrades] ?? SYSTEMES.nissho;
/** Matières au choix cochées pour un kyū Zenkoren (gardées d'une fois sur l'autre ; toutes par défaut). */
export const optionsChoisies = (d, g) => (g?.options ? (d?.reglages?.optionsZenkoren ?? OPTIONS_KYU_ZENKOREN).filter((k) => g.options[k]) : []);

export const totalPoints = (g) => ['mitoriA', 'mitori', 'mul', 'div'].reduce((s, k) => s + (g[k] ? g[k].nb * g[k].points : 0), 0);

/**
 * Lignes négatives d'un problème mixte : `f.moins` lignes, jamais en 1re, 2e ni dernière ligne
 * (sujets modèles). Quatre lignes : deux paires de lignes voisines, comme dans les sujets
 * modèles (4-5 et 7-8, 3-4 et 8-9…). Sans `moins` : 1 sur 5 lignes, 1 à 2 sur 8, 2 à 3 sur 10.
 */
function lignesMoins(f) {
  const n = f.lignes;
  const k = f.moins ?? (n <= 5 ? 1 : n <= 8 ? entier(1, 2) : entier(2, 3));
  const haut = n - 2; // dernier indice permis (avant-dernière ligne)
  if (k === 4 && haut - 2 >= 4) {
    for (;;) {
      const a = entier(2, haut - 1);
      const b = entier(2, haut - 1);
      if (Math.abs(a - b) >= 3) return new Set([a, a + 1, b, b + 1]);
    }
  }
  const indices = new Set();
  while (indices.size < Math.min(k, haut - 1)) indices.add(entier(2, haut));
  return indices;
}

/**
 * Longueurs des lignes : toutes à `chiffres` (sujets modèles) ; ou `longueurs` imposées, dans un
 * ordre tiré au hasard (anzan 5口8字 : trois nombres de 2 chiffres, deux de 1) ; sinon min à max.
 */
function longueursLignes(f) {
  if (f.chiffres) return Array.from({ length: f.lignes }, () => f.chiffres);
  if (f.longueurs) {
    const l = [...f.longueurs];
    for (let i = l.length - 1; i > 0; i--) { const j = entier(0, i); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  }
  return Array.from({ length: f.lignes }, () => entier(f.min, f.max));
}

/**
 * Un nombre de mitorizan à k chiffres. À 1 chiffre : de 1 à 9 (0.40.4 ; `facteur` commence à 2,
 * pour éviter × 1 et ÷ 1, et le 1 n'apparaissait jamais dans les lignes à 1 chiffre).
 */
export const nombreLigne = (k) => (k === 1 ? entier(1, 9) : facteur(k));

/** Un problème de mitorizan, sans total partiel négatif ni deux nombres égaux de suite. */
export function genererMitori(f) {
  for (;;) {
    const lignes = longueursLignes(f).map((k) => ({ op: '+', n: nombreLigne(k) }));
    if (f.soustractions) for (const i of lignesMoins(f)) lignes[i].op = '-';
    let v = 0;
    let ok = true;
    for (const l of lignes) {
      v += l.op === '+' ? l.n : -l.n;
      if (v < 0) ok = false;
    }
    // Pas deux fois le même nombre de suite (on le devinerait sans calculer).
    if (lignes.some((l, i) => i > 0 && l.n === lignes[i - 1].n)) ok = false;
    if (ok) return { type: 'addsub', lignes, resultat: v };
  }
}

/**
 * Mitorizan à résultat NÉGATIF (1er kyū, parfois 2e) : on emprunte un 1 imaginaire à gauche de
 * la colonne et on lit le complément. Le résultat reste au-dessus de −10^chiffres, et seul le
 * total final passe sous zéro... ou la colonne y est déjà : un seul emprunt imaginaire suffit.
 */
export function genererMitoriNegatif(f) {
  const k = 10 ** f.max;
  for (;;) {
    const lignes = longueursLignes(f).map((k) => ({ op: '+', n: nombreLigne(k) }));
    // Examen : les lignes négatives d'un problème mixte (4 au 1er kyū) ; sinon une sur deux.
    const indices = f.moins ? lignesMoins(f) : new Set();
    while (!f.moins && indices.size < Math.ceil(f.lignes / 2)) indices.add(entier(1, f.lignes - 1));
    for (const i of indices) lignes[i].op = '-';
    let v = 0;
    const sous = lignes.map((l) => (v += l.op === '+' ? l.n : -l.n));
    if (v >= 0 || sous.some((x) => x <= -k) || lignes.some((l, i) => i > 0 && l.n === lignes[i - 1].n)) continue;
    const c = k + v;
    return {
      type: 'addsub', negatif: true, lignes, resultat: v,
      astuce: `Le total passe sous zéro : on emprunte un 1 imaginaire de ${k.toLocaleString('fr-FR')}. Le soroban affiche ${c.toLocaleString('fr-FR')}, le complément : le résultat est −(${k.toLocaleString('fr-FR')} − ${c.toLocaleString('fr-FR')}) = ${v.toLocaleString('fr-FR')}.`,
    };
  }
}

/** Découpe « N chiffres au total » en (m, n), le premier étant le plus long ou égal. */
function decouper(total, court = total >= 4 ? 2 : 1) {
  // Jamais un opérande à 1 chiffre dès 4 chiffres au total (pas de 4 × 1 au 6e kyū), sauf
  // demande contraire (`court: 1`, épreuves d'anzan).
  const n = entier(Math.max(court, Math.floor(total / 2) - 1), Math.floor(total / 2));
  return [total - n, n];
}

/**
 * Rang d'arrondi d'un problème de × ou ÷ : null (entier exact), le rang du grade (millième) dans
 * la première moitié, 0 (unité, montants) dans la seconde. Du 3e au 1er kyū, TOUS les problèmes sont arrondis.
 */
export function arrondiDuProbleme(f, i) {
  if (f.decimales == null) return null;
  return i < f.nb / 2 ? f.decimales : 0;
}

/**
 * Du 1er au 3e kyū, 60 % des problèmes sont en décimaux (0.40.4 ; la moitié avant) ; les autres
 * sont des entiers au résultat exact. Les facteurs peuvent finir par 0, comme à l'examen.
 */
export const PART_DECIMAUX = 0.6;
const enDecimaux = (arrondi) => arrondi !== null && Math.random() < (arrondi === 0 ? PART_DECIMAUX : 0.5);

export function genererMulGrade(f, arrondi = null) {
  const [m, n] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : decouper(f.total, f.court);
  if (enDecimaux(arrondi)) return genererMultiplicationDecimale(m, n, arrondi);
  const a = facteur(m);
  const b = facteur(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f, arrondi = null) {
  const [x, y] = decouper(f.total, f.court);
  // diviseur et quotient : forme imposée par le grade, sinon l'un ou l'autre sens
  let [nd, nq] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : Math.random() < 0.5 ? [x, y] : [y, x];
  if (f.maxDiviseur && nd > f.maxDiviseur) [nd, nq] = [nq, nd];
  // 0.38 : le diviseur garde la longueur du sujet (avant : plafonné à 4 chiffres, faux aux 2e et 1er kyū).
  if (enDecimaux(arrondi)) return genererDivisionDecimale(nd, nq, arrondi);
  const diviseur = facteur(nd);
  const quotient = facteur(nq);
  return { type: 'div', a: diviseur * quotient, b: diviseur, resultat: quotient };
}

/** Série de × ou de ÷ d'un sujet, sans deux problèmes identiques. */
function serie(f, gen) {
  const vus = new Set();
  const liste = [];
  for (let i = 0; i < f.nb; i++) {
    let p;
    for (let e = 0; e < 30; e++) {
      p = gen(f, arrondiDuProbleme(f, i));
      if (!vus.has(`${p.a}|${p.b}`)) break;
    }
    vus.add(`${p.a}|${p.b}`);
    liste.push(p);
  }
  return liste;
}

/**
 * Les mitorizan d'un sujet. Nisshō : problèmes 3, 5, 7, 9 mêlés (`mixtes`), le résultat négatif
 * au problème 9 (`rangNegatif`). Zenkoren : les `pures` premiers en additions, puis mêlés, et le
 * résultat négatif dans la seconde moitié.
 */
function mitoris(f) {
  const mixte = (i) => (f.mixtes ? f.mixtes.includes(i) : i >= (f.pures ?? 0));
  // Dan (0.38) : longueurs mêlées d'un problème à l'autre (`gabarits` : listes de longueurs).
  const gabarit = () => f.gabarits[entier(0, f.gabarits.length - 1)];
  const avec = (i) => ({ ...f, soustractions: mixte(i), ...(f.chiffresParProbleme ? { chiffres: f.chiffresParProbleme[i], min: f.chiffresParProbleme[i], max: f.chiffresParProbleme[i] } : {}),
    ...(f.gabarits ? { longueurs: gabarit() } : {}) });
  const liste = Array.from({ length: f.nb }, (_, i) => genererMitori(avec(i)));
  // Rangs imposés (dan : un résultat négatif tous les 10 problèmes), sinon le nombre tiré.
  if (f.rangsNegatifs) { for (const i of f.rangsNegatifs) liste[i] = genererMitoriNegatif(avec(i)); return liste; }
  const [min, max] = f.negatifs ?? [0, 0];
  const nombre = entier(min, max);
  for (let k = 0; k < nombre; k++) {
    const i = f.rangNegatif ?? entier(Math.max(Math.ceil(f.nb / 2), f.pures ?? 0), f.nb - 1);
    liste[i] = genererMitoriNegatif(avec(i));
  }
  return liste;
}

/** Anzan au choix d'un kyū Zenkoren : 5 ×, 5 ÷, 5 mitori de tête (voir OPTIONS_KYU_ZENKOREN). */
function anzanOptionKyu(o) {
  const court = o.total >= 5 ? 2 : 1;
  const mul = serie({ nb: 5 }, () => genererMulGrade({ total: o.total, court }));
  const div = serie({ nb: 5 }, () => genererDivGrade({ total: o.total, court }));
  const mit = Array.from({ length: 5 }, (_, i) => genererMitori({ lignes: o.lignes, chiffres: o.chiffres, min: o.chiffres, max: o.chiffres, soustractions: i >= 2, moins: 1 }));
  return [...mul, ...div, ...mit].map((p) => ({ ...p, mental: true }));
}

/**
 * Sujet complet.
 * @param {{ options?: string[] }} [o]  Zenkoren, 3e au 1er kyū : matières au choix passées
 */
export function genererSujet(grade, { options = [] } = {}) {
  // Grade qui porte son propre générateur (dan Zenkoren, voir core/danZenkoren.js).
  if (grade.generer) return grade.generer(grade);
  const sections = [];
  if (grade.systeme === 'dan') {
    // Dan Nisshō : ×, ÷ puis mitorizan, 10 minutes chacun, 300 points chacun.
    const m = grade.minutesEpreuve;
    sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, minutes: m, problemes: serie(grade.mul, genererMulGrade) });
    sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, minutes: m, problemes: serie(grade.div, genererDivGrade) });
    sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算)', points: grade.mitori.points, minutes: m, problemes: mitoris(grade.mitori) });
    return { grade, sections };
  }
  if (grade.systeme === 'zenkoren') {
    // Ordre Zenkoren : multiplication, division, additions-soustractions ; 7 minutes chacune.
    const m = grade.minutesEpreuve;
    if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, minutes: m, problemes: serie(grade.mul, genererMulGrade) });
    if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, minutes: m, problemes: serie(grade.div, genererDivGrade) });
    if (grade.mitoriA) sections.push({ cle: 'mitoriA', titre: 'Additions A (加算)', points: grade.mitoriA.points, minutes: m, problemes: mitoris(grade.mitoriA) });
    if (grade.mitori) sections.push({ cle: 'mitori', titre: grade.mitoriA ? 'Additions et soustractions B (見取算)' : 'Additions et soustractions (見取算)', points: grade.mitori.points, minutes: m, problemes: mitoris(grade.mitori) });
    const opt = grade.options ?? {};
    if (opt.denpyo && options.includes('denpyo')) {
      const dp = genererDenpyo({ nb: opt.denpyo.nb, min: opt.denpyo.min, max: opt.denpyo.max });
      sections.push({ cle: 'denpyo', titre: MATIERES_OPTION_KYU.denpyo.titre, points: opt.denpyo.points, minutes: opt.denpyo.minutes, problemes: dp.problemes, liasse: dp.liasse });
    }
    if (opt.anzan && options.includes('anzan')) sections.push({ cle: 'anzan', titre: MATIERES_OPTION_KYU.anzan.titre, points: opt.anzan.points, minutes: opt.anzan.minutes, problemes: anzanOptionKyu(opt.anzan) });
    return { grade, sections };
  }
  if (grade.mitori) sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算) : additions et soustractions', points: grade.mitori.points, problemes: mitoris(grade.mitori) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, problemes: serie(grade.mul, genererMulGrade) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, problemes: serie(grade.div, genererDivGrade) });
  return { grade, sections };
}
