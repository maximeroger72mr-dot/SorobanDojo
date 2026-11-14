/**
 * Épreuves au format des examens de soroban (珠算能力検定), du 10e au 1er kyū.
 * Référentiel : Chambre de commerce et d'industrie du Japon (1er au 3e kyū) et Ligue japonaise
 * du soroban, 日本珠算連盟 (4e au 10e kyū).
 *
 *  - 1er au 6e kyū : 10 mitorizan, 20 multiplications, 20 divisions, 30 minutes pour le tout,
 *    300 points ; réussite à 240 (1er au 3e) ou 210 (4e au 6e).
 *  - Mitorizan : 10 lignes dont le TOTAL de chiffres est fixé par le règlement (字数) :
 *    35 au 6e kyū (5 nombres de 3 chiffres, 5 de 4), 45 au 5e (4 et 5), 55 au 4e (5 et 6),
 *    60 au 3e (5 à 7 chiffres), 75 au 2e (6 à 9, surtout 7 et 8), 100 au 1er (10 lignes de 10
 *    chiffres). `longueurs` donne les longueurs des 10 lignes ; leur ordre est tiré au hasard ;
 *    6 problèmes d'addition pure, puis 4 qui mêlent additions et soustractions.
 *    Dès le 3e kyū, un problème de la seconde moitié a un résultat négatif.
 *  - 10e au 8e kyū : 10 lignes (1 à 2 chiffres aux 10e et 9e, 2 au 8e) ; le 10e kyū a la même
 *    épreuve que le 9e, seul le seuil change (60 / 200).
 *  - Multiplication : « chiffres des deux facteurs au total » ; division : « chiffres du diviseur
 *    et du quotient au total ».
 *  - 1er au 3e kyū : la première moitié des × et des ÷ s'arrondit au millième (nombres sans
 *    unité), la seconde à l'unité (montants) ; tous les problèmes sont arrondis.
 *  - `formes` : découpage imposé des chiffres ([facteur, facteur] ou [diviseur, quotient]) :
 *    2 × 1 aux 10e et 9e kyū, 3 × 1 et ÷ 1 chiffre au 8e, 2 × 2 au 7e, 3 × 2 ou 2 × 3 et 2 ÷ 2 au 6e.
 *  - 10e au 7e kyū : 20 minutes, 200 points ; réussite à 60 points au 10e kyū, 120 ensuite.
 *    Les 10e et 9e n'ont pas de division.
 *  - `milliers` (1er au 3e kyū) : à l'examen, une réponse sans séparateurs de milliers est
 *    comptée fausse. L'application ne l'exige qu'en « examen pur ».
 *
 * `verifie` : false tant que le format n'a pas été contrôlé sur la fiche officielle (l'écran
 * l'indique : « format indicatif »). Les valeurs du 1er au 5e kyū viennent de sources recoupées,
 * pas des fiches elles-mêmes ; voir SPECS.md, annexe B.
 */

import { entier } from './aleatoire.js';
import { facteur, facteurNet, genererMultiplicationDecimale, genererDivisionDecimale } from './multiplication.js';

/**
 * mitori : { nb, lignes, min, max (chiffres par ligne), longueurs? (longueur de chaque ligne), soustractions, points, negatifs? [min, max] }
 * mul    : { nb, total, points, decimales? }  div : { nb, total, points, decimales? }
 * decimales : rang d'arrondi de la PREMIÈRE moitié ; la seconde s'arrondit à l'unité.
 */
export const GRADES = [
  { id: '10', nom: '10e kyū', japonais: '10級', minutes: 20, seuil: 0.3, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 1, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '9', nom: '9e kyū', japonais: '9級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 1, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 3, formes: [[2, 1]], points: 5 } },
  { id: '8', nom: '8e kyū', japonais: '8級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 2, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 10, total: 4, formes: [[3, 1]], points: 5 }, div: { nb: 10, total: 3, formes: [[1, 2]], points: 5 } },
  { id: '7', nom: '7e kyū', japonais: '7級', minutes: 20, seuil: 0.6, confirme: false, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 2, max: 2, soustractions: true, pures: 6, points: 10 },
    mul: { nb: 10, total: 4, formes: [[2, 2]], points: 5 }, div: { nb: 10, total: 4, formes: [[1, 3]], points: 5 } },
  { id: '6', nom: '6e kyū', japonais: '6級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 3, max: 4, longueurs: [3, 3, 3, 3, 3, 4, 4, 4, 4, 4], soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 5, formes: [[3, 2], [2, 3]], points: 5 }, div: { nb: 20, total: 4, formes: [[2, 2]], points: 5 } },
  { id: '5', nom: '5e kyū', japonais: '5級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 4, max: 5, longueurs: [4, 4, 4, 4, 4, 5, 5, 5, 5, 5], soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 6, points: 5 }, div: { nb: 20, total: 5, points: 5 } },
  { id: '4', nom: '4e kyū', japonais: '4級', minutes: 30, seuil: 0.7, confirme: true, verifie: false,
    mitori: { nb: 10, lignes: 10, min: 5, max: 6, longueurs: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6], soustractions: true, pures: 6, points: 10 },
    mul: { nb: 20, total: 7, points: 5 }, div: { nb: 20, total: 6, points: 5 } },
  { id: '3', nom: '3e kyū', japonais: '3級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 5, max: 7, longueurs: [5, 5, 5, 6, 6, 6, 6, 7, 7, 7], soustractions: true, pures: 6, points: 10, negatifs: [1, 1] },
    mul: { nb: 20, total: 7, points: 5, decimales: 3 }, div: { nb: 20, total: 6, points: 5, decimales: 3 } },
  { id: '2', nom: '2e kyū', japonais: '2級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 6, max: 9, longueurs: [6, 7, 7, 7, 7, 8, 8, 8, 8, 9], soustractions: true, pures: 6, points: 10, negatifs: [1, 1] },
    mul: { nb: 20, total: 9, points: 5, decimales: 3 }, div: { nb: 20, total: 8, points: 5, decimales: 3 } },
  { id: '1', nom: '1er kyū', japonais: '1級', minutes: 30, seuil: 0.8, confirme: true, verifie: false, milliers: true,
    mitori: { nb: 10, lignes: 10, min: 7, max: 10, longueurs: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], soustractions: true, pures: 6, points: 10, negatifs: [1, 1] },
    mul: { nb: 20, total: 11, points: 5, decimales: 3 }, div: { nb: 20, total: 10, points: 5, decimales: 3 } },
];

/**
 * Zenkoren (全国珠算教育連盟) : plus exigeant sur le TEMPS. Chaque épreuve a son chrono de
 * 7 minutes, 15 problèmes à 10 points, et il faut 10 justes sur 15 dans CHACUNE (aucune
 * compensation entre épreuves). Ordre : multiplication, division, additions-soustractions.
 * 10e kyū : deux épreuves d'additions-soustractions (A : additions seules, B : mêlées) ; 9e :
 * multiplication et additions-soustractions ; à partir du 8e : les trois.
 *
 * Le nombre de chiffres par problème n'est pas connu : on reprend celui du MÊME grade Nisshō.
 * Un kyū Zenkoren est donc au moins aussi dur que le kyū Nisshō du même rang (mêmes nombres,
 * 15 problèmes au lieu de 10 ou 20, temps par épreuve, réussite exigée partout), jamais moins.
 * Les options du 1er au 3e kyū (calcul mental, denpyōzan, calcul appliqué) ne sont pas encore là.
 */
export const MINUTES_EPREUVE_ZENKOREN = 7;
export const JUSTES_EPREUVE_ZENKOREN = 10;
/**
 * Lignes par problème d'additions-soustractions : 15 problèmes en 7 minutes, avec 10 lignes,
 * demanderaient 2 à 3 fois la cadence Nisshō du même grade (179 CPM au 1er kyū). On garde les
 * mêmes nombres de chiffres par ligne et on raccourcit la colonne pour viser environ 1,4 fois la
 * cadence Nisshō : plus dur, sans devenir irréaliste (voir tests/zenkoren.test.js).
 */
export const LIGNES_ZENKOREN = { 10: 5, 9: 5, 8: 5, 7: 6, 6: 5, 5: 5, 4: 6, 3: 7, 2: 8, 1: 8 };
/** k longueurs prises régulièrement dans la liste triée (on garde le mélange court / long). */
const extraire = (l, k) => { const t = [...l].sort((a, b) => a - b); return Array.from({ length: k }, (_, i) => t[Math.floor(((i + 0.5) * t.length) / k)]); };
function versZenkoren(g) {
  const q = { nb: 15, points: 10 };
  const lignes = LIGNES_ZENKOREN[g.id] ?? g.mitori.lignes;
  const mitori = { ...g.mitori, ...q, lignes, pures: Math.round(15 * (g.mitori.pures / g.mitori.nb)) };
  if (g.mitori.longueurs) mitori.longueurs = extraire(g.mitori.longueurs, lignes);
  const z = { id: g.id, nom: g.nom, japonais: g.japonais, systeme: 'zenkoren', parEpreuve: true, confirme: g.confirme, verifie: false, milliers: g.milliers,
    seuil: JUSTES_EPREUVE_ZENKOREN / 15, minutesEpreuve: MINUTES_EPREUVE_ZENKOREN };
  if (g.id === '10') Object.assign(z, { mitoriA: { ...mitori, soustractions: false, pures: 15 }, mitori: { ...mitori, pures: 0 } });
  else {
    z.mitori = mitori;
    if (g.mul) z.mul = { ...g.mul, ...q };
    if (g.div) z.div = { ...g.div, ...q };
  }
  z.minutes = MINUTES_EPREUVE_ZENKOREN * ['mitoriA', 'mitori', 'mul', 'div'].filter((k) => z[k]).length;
  return z;
}
export const GRADES_ZENKOREN = GRADES.map(versZenkoren);

/** Les deux systèmes de grades. Nisshō par défaut. */
export const SYSTEMES = {
  nissho: { id: 'nissho', nom: 'Nisshō', long: 'Nisshō (Chambre de commerce) et Nihon Shuzan Renmei', grades: GRADES, record: (id) => `epreuve-${id}` },
  zenkoren: { id: 'zenkoren', nom: 'Zenkoren', long: 'Zenkoren (全国珠算教育連盟)', grades: GRADES_ZENKOREN, record: (id) => `zenkoren-${id}` },
};
export const systemeChoisi = (d) => SYSTEMES[d?.reglages?.systemeGrades] ?? SYSTEMES.nissho;

export const totalPoints = (g) => ['mitoriA', 'mitori', 'mul', 'div'].reduce((s, k) => s + (g[k] ? g[k].nb * g[k].points : 0), 0);

/**
 * Un problème de mitorizan. Avec soustractions : 1 ligne négative sur 5 lignes, 1 à 2 sur 8,
 * 2 à 3 sur 10 ; jamais en 1re ou 2e ligne, jamais de total partiel négatif.
 */
/** Longueurs des lignes d'un problème : celles du grade, dans un ordre tiré au hasard ; sinon min à max. */
function longueursLignes(f) {
  if (!f.longueurs) return Array.from({ length: f.lignes }, () => entier(f.min, f.max));
  const l = [...f.longueurs];
  for (let i = l.length - 1; i > 0; i--) { const j = entier(0, i); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

export function genererMitori(f) {
  for (;;) {
    const lignes = longueursLignes(f).map((k) => ({ op: '+', n: facteur(k) }));
    if (f.soustractions) {
      const nbMoins = f.lignes <= 5 ? 1 : f.lignes <= 8 ? entier(1, 2) : entier(2, 3);
      const indices = new Set();
      while (indices.size < nbMoins) indices.add(entier(2, f.lignes - 1));
      for (const i of indices) lignes[i].op = '-';
    }
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
    const lignes = longueursLignes(f).map((k) => ({ op: '+', n: facteur(k) }));
    const indices = new Set();
    while (indices.size < Math.ceil(f.lignes / 2)) indices.add(entier(1, f.lignes - 1));
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

export function genererMulGrade(f, arrondi = null) {
  const [m, n] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : decouper(f.total, f.court);
  if (arrondi !== null) return genererMultiplicationDecimale(m, n, arrondi);
  const a = facteurNet(m);
  const b = facteurNet(n);
  return { type: 'mul', a, b, resultat: a * b };
}

export function genererDivGrade(f, arrondi = null) {
  const [x, y] = decouper(f.total, f.court);
  // diviseur et quotient : forme imposée par le grade, sinon l'un ou l'autre sens
  let [nd, nq] = f.formes ? f.formes[entier(0, f.formes.length - 1)] : Math.random() < 0.5 ? [x, y] : [y, x];
  if (f.maxDiviseur && nd > f.maxDiviseur) [nd, nq] = [nq, nd];
  if (arrondi !== null) return genererDivisionDecimale(Math.min(nd, 4), nq, arrondi);
  const diviseur = facteurNet(nd);
  const quotient = facteurNet(nq);
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

/** Les mitorizan d'un sujet : au 1er kyū, un résultat négatif dans la seconde moitié. */
function mitoris(f) {
  // Les `pures` premiers problèmes sont des additions seules, les suivants mêlent + et −.
  const pures = f.pures ?? 0;
  const liste = Array.from({ length: f.nb }, (_, i) => genererMitori(i < pures ? { ...f, soustractions: false } : f));
  const [min, max] = f.negatifs ?? [0, 0];
  const nombre = entier(min, max);
  // Dans la seconde moitié, et jamais parmi les additions pures.
  for (let k = 0; k < nombre; k++) liste[entier(Math.max(Math.ceil(f.nb / 2), pures), f.nb - 1)] = genererMitoriNegatif(f);
  return liste;
}

/** Sujet complet. */
export function genererSujet(grade) {
  const sections = [];
  if (grade.systeme === 'zenkoren') {
    // Ordre Zenkoren : multiplication, division, additions-soustractions ; 7 minutes chacune.
    const m = grade.minutesEpreuve;
    if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, minutes: m, problemes: serie(grade.mul, genererMulGrade) });
    if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, minutes: m, problemes: serie(grade.div, genererDivGrade) });
    if (grade.mitoriA) sections.push({ cle: 'mitoriA', titre: 'Additions A (加算)', points: grade.mitoriA.points, minutes: m, problemes: mitoris(grade.mitoriA) });
    if (grade.mitori) sections.push({ cle: 'mitori', titre: grade.mitoriA ? 'Additions et soustractions B (見取算)' : 'Additions et soustractions (見取算)', points: grade.mitori.points, minutes: m, problemes: mitoris(grade.mitori) });
    return { grade, sections };
  }
  if (grade.mitori) sections.push({ cle: 'mitori', titre: 'Mitorizan (見取算) : additions et soustractions', points: grade.mitori.points, problemes: mitoris(grade.mitori) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplication (乗算)', points: grade.mul.points, problemes: serie(grade.mul, genererMulGrade) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Division (除算)', points: grade.div.points, problemes: serie(grade.div, genererDivGrade) });
  return { grade, sections };
}
