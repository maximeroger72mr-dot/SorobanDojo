/**
 * Dan d'entraînement Zenkoren (全国珠算教育連盟), d'après les règles fournies par l'utilisateur
 * (0.38.3).
 *
 * 珠算段位 : 6 matières, 3 obligatoires (multiplication, division, mitorizan) et 3 au choix parmi
 * 4 (denpyōzan, anzan, ōyō keisan, kaihō). 30 problèmes à 10 points (300) par matière ; 7 minutes
 * (anzan : 3 ; ōyō keisan : 10). La note la plus BASSE des 6 fixe le dan, sans compensation ; le
 * meilleur score de chaque matière sur la session et les 2 précédentes est conservé.
 * Seuils (sur 300, dans chaque matière) : 準初段 80, 初段 100, 準弐段 110, 弐段 120… 六段 200,
 * 七段 220, 八段 240, 九段 260, 十段 280.
 *
 * 暗算段位 : 3 matières (× , ÷ et mitori de tête, décimaux dès le dan), 40 problèmes à 5 points
 * (200), 3 minutes chacune ; la plus basse fixe le grade. Seuils (sur 200) : 準初段 70, 初段 80,
 * 弐段 90… 八段 150, 九段 170, 十段 190.
 *
 * Taille des nombres, d'après les annales (format fourni par l'utilisateur) :
 *  - 珠算 × : 11 puis 12 chiffres au total (6 × 5, 7 × 4, puis 6 × 6, 7 × 5) ; ÷ : 10 puis 11 ;
 *    entiers, décimaux arrondis au millième et montants arrondis à l'unité ;
 *  - 珠算 mitorizan : 10 lignes de longueurs mêlées, progressives : 3–6, 4–6, 4–7, 4–8, 5–9,
 *    puis 5–10 chiffres, par blocs de 5 problèmes ; soustractions et résultats négatifs ;
 *  - 暗算 × : 2 × 2 (n° 1 à 10), 3 × 2 (11 à 20), 3 × 3 (21 à 30), 4 × 3 (31 à 35), 4 × 4
 *    (36 à 40) ; ÷ : 4, 5, 6, 7 puis 8 chiffres au total, mêmes blocs ;
 *  - 暗算 mitori : 3 chiffres sur 5 lignes (n° 1 à 8), puis des blocs qui intègrent des nombres à
 *    4 chiffres, puis plus de lignes ; soustractions sur les 10 derniers.
 * ESTIMÉ (non précisé) : la part de décimaux et de montants (la moitié en entiers), la place des
 * résultats négatifs (un par dizaine), le détail des blocs du mitori de tête après le n° 8 ; le
 * denpyōzan (liasse de 20 bordereaux de 5 lignes de 3 à 7 chiffres, une ligne sur 10 bordereaux
 * par problème) ; l'anzan au choix du 珠算段位 (10 ×, 10 ÷ de 5 chiffres au total, 10 mitori de
 * 3 chiffres sur 5 lignes).
 * L'ōyō keisan et le kaihō (racines) ne sont pas proposés : le dan se calcule alors sur 5 matières.
 * Fonctions pures (le hasard mis à part).
 */

import { MIXTES, genererMulGrade, genererDivGrade, genererMitori, genererMitoriNegatif } from './epreuves.js';
import { genererMultiplicationDecimaleSimple, genererDivisionDecimaleExacte, facteur } from './multiplication.js';
import { entier } from './aleatoire.js';

const n = (id, nom, japonais, points, jun = false) => ({ id, nom, japonais, points, jun });
export const NIVEAUX_DAN_ZENKOREN = [
  n('jd1', '1er dan préparatoire', '準初段', 80, true), n('d1', '1er dan', '初段', 100),
  n('jd2', '2e dan préparatoire', '準弐段', 110, true), n('d2', '2e dan', '弐段', 120),
  n('jd3', '3e dan préparatoire', '準参段', 130, true), n('d3', '3e dan', '参段', 140),
  n('jd4', '4e dan préparatoire', '準四段', 150, true), n('d4', '4e dan', '四段', 160),
  n('jd5', '5e dan préparatoire', '準五段', 170, true), n('d5', '5e dan', '五段', 180),
  n('jd6', '6e dan préparatoire', '準六段', 190, true), n('d6', '6e dan', '六段', 200),
  n('d7', '7e dan', '七段', 220), n('d8', '8e dan', '八段', 240), n('d9', '9e dan', '九段', 260), n('d10', '10e dan', '十段', 280),
];
export const NIVEAUX_ANZAN_DAN_ZENKOREN = [
  n('ajd1', '1er dan préparatoire d\'anzan', '暗算準初段', 70, true), n('ad1', '1er dan d\'anzan', '暗算初段', 80),
  n('ad2', '2e dan d\'anzan', '暗算弐段', 90), n('ad3', '3e dan d\'anzan', '暗算参段', 100), n('ad4', '4e dan d\'anzan', '暗算四段', 110),
  n('ad5', '5e dan d\'anzan', '暗算五段', 120), n('ad6', '6e dan d\'anzan', '暗算六段', 130), n('ad7', '7e dan d\'anzan', '暗算七段', 140),
  n('ad8', '8e dan d\'anzan', '暗算八段', 150), n('ad9', '9e dan d\'anzan', '暗算九段', 170), n('ad10', '10e dan d\'anzan', '暗算十段', 190),
];

/** Les matières du 珠算段位. `dispo` : proposée par l'application. */
export const MATIERES = {
  mul: { titre: 'Multiplication (乗算)', minutes: 7, obligatoire: true, dispo: true },
  div: { titre: 'Division (除算)', minutes: 7, obligatoire: true, dispo: true },
  mitori: { titre: 'Mitorizan (見取算)', minutes: 7, obligatoire: true, dispo: true },
  denpyo: { titre: 'Denpyōzan (伝票算)', minutes: 7, dispo: true },
  anzan: { titre: 'Anzan (暗算)', minutes: 3, dispo: true },
  oyo: { titre: 'Ōyō keisan (応用計算)', minutes: 10, dispo: false },
  kaiho: { titre: 'Kaihō, racines (開法)', minutes: 7, dispo: false },
};
export const OPTIONS_DISPO = Object.entries(MATIERES).filter(([, m]) => !m.obligatoire && m.dispo).map(([k]) => k);
export const PROBLEMES_MATIERE = 30;
export const POINTS_PROBLEME = 10;
export const MAX_MATIERE = PROBLEMES_MATIERE * POINTS_PROBLEME;

const melange = (i) => MIXTES.includes(i % 10);

/** Une série sans deux problèmes identiques. */
function serie(nb, gen) {
  const vus = new Set();
  return Array.from({ length: nb }, (_, i) => {
    let p;
    for (let e = 0; e < 30; e++) { p = gen(i); if (!vus.has(`${p.a}|${p.b}|${p.resultat}`)) break; }
    vus.add(`${p.a}|${p.b}|${p.resultat}`);
    return p;
  });
}
// × et ÷ : la moitié en entiers, un quart en décimaux au millième, un quart en montants à l'unité.
const arrondi = (i) => (i % 4 === 1 ? 3 : i % 4 === 3 ? 0 : null);
const enDecimal = (gen, f, i) => { const a = arrondi(i); return a === null ? gen({ ...f, decimales: undefined }, null) : forceDecimal(gen, f, a); };
function forceDecimal(gen, f, a) {
  for (let k = 0; k < 20; k++) { const p = gen(f, a); if (p.virgules) return p; }
  return gen(f, a);
}

/** Longueurs du mitorizan, par blocs de 5 problèmes (annales). */
export const LONGUEURS_MITORI_DAN = [[3, 6], [4, 6], [4, 7], [4, 8], [5, 9], [5, 10]];
/** Mitorizan du problème i : 10 lignes de longueurs mêlées, progressives au fil de la feuille. */
function mitoriDan(i) {
  const [min, max] = LONGUEURS_MITORI_DAN[Math.min(LONGUEURS_MITORI_DAN.length - 1, Math.floor(i / 5))];
  const f = { lignes: 10, min, max, soustractions: melange(i), moins: 4 };
  return i % 10 === 8 ? genererMitoriNegatif({ ...f, soustractions: true }) : genererMitori(f);
}

/**
 * Denpyōzan : une liasse de 20 bordereaux de 5 lignes ; le problème i additionne la ligne
 * (i mod 5) + 1 des bordereaux s à s + 9.
 */
export function genererDenpyo() {
  const liasse = Array.from({ length: 20 }, () => Array.from({ length: 5 }, () => facteur(entier(3, 7))));
  const problemes = Array.from({ length: PROBLEMES_MATIERE }, (_, i) => {
    const ligne = i % 5;
    const debut = Math.floor(i / 5) * 2 % 11; // 0, 2, 4… : des paquets de 10 qui se chevauchent
    const nombres = liasse.slice(debut, debut + 10).map((b) => b[ligne]);
    return { type: 'addsub', denpyo: { debut: debut + 1, fin: debut + 10, ligne: ligne + 1 }, lignes: nombres.map((x) => ({ op: '+', n: x })), resultat: nombres.reduce((t, x) => t + x, 0) };
  });
  return { liasse, problemes };
}

/** Anzan (matière au choix) : 10 ×, 10 ÷ (5 chiffres au total), 10 mitori de tête (3 chiffres, 5 lignes). */
function anzanMatiere() {
  const mul = serie(10, () => genererMulGrade({ total: 5, court: 2 }));
  const div = serie(10, () => genererDivGrade({ total: 5, court: 2 }));
  const mit = Array.from({ length: 10 }, (_, i) => genererMitori({ lignes: 5, chiffres: 3, min: 3, max: 3, soustractions: melange(i), moins: 1 }));
  return [...mul, ...div, ...mit].map((p) => ({ ...p, mental: true }));
}

/**
 * Sujet du 珠算段位 Zenkoren : les 3 matières obligatoires, puis les options choisies.
 * @param {string[]} [options]  matières au choix (par défaut : toutes celles proposées)
 */
export function genererSujetDanZenkoren(grade, options = OPTIONS_DISPO) {
  const sec = (cle, problemes, x = {}) => ({ cle, titre: MATIERES[cle].titre, points: POINTS_PROBLEME, minutes: MATIERES[cle].minutes, problemes, ...x });
  const sections = [
    sec('mul', serie(PROBLEMES_MATIERE, (i) => enDecimal(genererMulGrade, { formes: i < 15 ? [[6, 5], [7, 4]] : [[6, 6], [7, 5]] }, i))),
    sec('div', serie(PROBLEMES_MATIERE, (i) => enDecimal(genererDivGrade, { total: i < 15 ? 10 : 11 }, i))),
    sec('mitori', Array.from({ length: PROBLEMES_MATIERE }, (_, i) => mitoriDan(i))),
  ];
  if (options.includes('denpyo')) { const dp = genererDenpyo(); sections.push(sec('denpyo', dp.problemes, { liasse: dp.liasse })); }
  if (options.includes('anzan')) sections.push(sec('anzan', anzanMatiere()));
  return { grade, sections };
}

/** 暗算段位 : formes de × par blocs (n° 1 à 10, 11 à 20, 21 à 30, 31 à 35, 36 à 40). */
export const FORMES_MUL_ANZAN_DAN = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]];
/** 暗算段位 : chiffres au total des ÷ (diviseur + quotient), mêmes blocs. */
export const TOTAUX_DIV_ANZAN_DAN = [4, 5, 6, 7, 8];
export const blocAnzanDan = (i) => (i < 30 ? Math.floor(i / 10) : i < 35 ? 3 : 4);
/** 暗算段位 mitori : 3 chiffres × 5 lignes (1 à 8), puis des nombres à 4 chiffres, puis plus de lignes. */
export function formatMitoriAnzanDan(i) {
  if (i < 8) return { lignes: 5, min: 3, max: 3 };
  if (i < 16) return { lignes: 5, min: 3, max: 4 };
  if (i < 24) return { lignes: 5, min: 4, max: 4 };
  if (i < 32) return { lignes: 6, min: 3, max: 4 };
  return { lignes: 6, min: 4, max: 4 };
}

/** Sujet du 暗算段位 Zenkoren : 40 ×, 40 ÷, 40 mitori de tête, 3 minutes et 200 points chacun. */
export function genererSujetAnzanDanZenkoren(grade) {
  // Décimaux dès le dan : un problème sur quatre à partir du n° 11, exacts (de tête, pas d'arrondi).
  const op = (type) => serie(40, (i) => {
    const b = blocAnzanDan(i);
    const decimal = i >= 10 && i % 4 === 3;
    if (type === 'mul') { const [m, n2] = FORMES_MUL_ANZAN_DAN[b]; return decimal ? genererMultiplicationDecimaleSimple(m, n2) : genererMulGrade({ formes: [[m, n2]] }); }
    const total = TOTAUX_DIV_ANZAN_DAN[b];
    const nd = Math.floor(total / 2); const nq = total - nd;
    return decimal ? genererDivisionDecimaleExacte(nd, nq) : genererDivGrade({ total, court: 2 });
  }).map((p) => ({ ...p, mental: true }));
  // Soustractions concentrées sur les 10 derniers problèmes.
  const mit = Array.from({ length: 40 }, (_, i) => ({ ...genererMitori({ ...formatMitoriAnzanDan(i), soustractions: i >= 30, moins: i >= 35 ? 2 : 1 }), mental: true }));
  return { grade, sections: [
    { cle: 'mul', titre: 'Multiplications de tête (乗暗算)', points: 5, minutes: 3, problemes: op('mul') },
    { cle: 'div', titre: 'Divisions de tête (除暗算)', points: 5, minutes: 3, problemes: op('div') },
    { cle: 'mitori', titre: 'Additions et soustractions de tête (見取暗算)', points: 5, minutes: 3, problemes: mit },
  ] };
}

/** Un niveau, sous forme de « grade » (sujet, allure, marches, examen de la semaine). */
export function gradeDanZenkoren(niveau) {
  return { id: `z${niveau.id}`, nom: `${niveau.nom} Zenkoren`, japonais: niveau.japonais, systeme: 'dan-zenkoren', dan: true, parEpreuve: true, milliers: true,
    minutesEpreuve: 7, minutes: 31, seuil: niveau.points / MAX_MATIERE, pointsEpreuve: niveau.points, niveau: niveau.id,
    mul: { nb: 30, points: 10 }, div: { nb: 30, points: 10 }, mitori: { nb: 30, points: 10 }, generer: (g) => genererSujetDanZenkoren(g) };
}

/** Niveau atteint : le plus haut dont le seuil est tenu dans TOUTES les matières passées. */
export function niveauAtteintZenkoren(points, niveaux = NIVEAUX_DAN_ZENKOREN) {
  const min = Math.min(...points);
  return [...niveaux].reverse().find((x) => min >= x.points) ?? null;
}

/**
 * Meilleur score de chaque matière sur la session et les 2 précédentes (règle Zenkoren), puis le
 * niveau qui en découle.
 * @param {Array<{ date, scores: Record<string, number> }>} sessions  de la plus ancienne à la plus récente
 */
export function niveauCumule(sessions, niveaux = NIVEAUX_DAN_ZENKOREN) {
  const recentes = sessions.slice(-3);
  const meilleurs = {};
  for (const s of recentes) for (const [k, v] of Object.entries(s.scores)) meilleurs[k] = Math.max(meilleurs[k] ?? 0, v);
  const valeurs = Object.values(meilleurs);
  return { meilleurs, niveau: valeurs.length ? niveauAtteintZenkoren(valeurs, niveaux) : null };
}

export const CLE_DAN_ZENKOREN = 'dan-zenkoren';
export const CLE_ANZAN_DAN_ZENKOREN = 'anzan-dan-zenkoren';
/** Meilleur niveau obtenu, ou null. */
export const meilleurNiveau = (d, cle, niveaux) => niveaux.find((x) => x.id === d.records?.[cle]?.niveau) ?? null;
/** Prochain dan plein à viser après le meilleur obtenu. */
export function prochainNiveau(d, cle, niveaux) {
  const m = meilleurNiveau(d, cle, niveaux);
  const i = m ? niveaux.indexOf(m) : -1;
  return niveaux.slice(i + 1).find((x) => !x.jun) ?? null;
}
