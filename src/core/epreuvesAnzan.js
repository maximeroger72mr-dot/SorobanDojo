/**
 * Épreuves d'anzan (暗算検定, 日本珠算連盟) : tout se calcule de tête, soroban rangé.
 *
 * Source : le règlement officiel (shuzan.jp, « 暗算検定試験 ») et le sujet modèle du 1er kyū.
 *  - 12 minutes pour TOUT le sujet (一括施行), dans l'ordre que l'on veut ; 500 points.
 *  - 1er au 6e kyū (et 準1 à 準3) : 20 みとり暗算, 30 かけ暗算, 30 わり暗算 ; réussite à 400.
 *    みとり暗算 : 3けた10口 au 1er, 3けた7口 au 2e, 3けた5口 au 3e, 2けた5口 au 4e,
 *    5口8字 (1 à 2 chiffres) au 5e, 5口6字 au 6e. × et ÷ : 5 chiffres au total au 1er,
 *    4 aux 2e et 3e, 3 du 4e au 6e. Les 準 mêlent les deux grades voisins, moitié-moitié.
 *  - 7e au 10e kyū : UN SEUL sujet de 50 みとり暗算 (1 à 15 : 3口3字 ; 16 à 30 : 4口4字 ;
 *    31 à 50 : 5口5字), le grade dépend des points : 400 (7e), 350 (8e), 300 (9e), 250 (10e).
 *  - Sujet modèle du 1er kyū : problèmes 3, 5, 7, 9 avec 4 lignes négatives ; × en 3 × 2 ou
 *    2 × 3 ; diviseur de 2 ou 3 chiffres ; des facteurs terminés par 0.
 * Non publié, donc choisi ici : la répartition des points (10 par みとり暗算, 5 par × ou ÷, ce
 * qui fait bien 500), les soustractions sur 5 et 7 lignes (1 et 2 lignes négatives), et des
 * additions seules du 7e au 10e kyū (pas de sujet modèle en ligne).
 */

import { genererMitori, genererMulGrade, genererDivGrade, MIXTES } from './epreuves.js';

/** Problèmes mêlés : 3, 5, 7, 9 de chaque série de 10 (sujet modèle du 1er kyū). */
const MIXTES_20 = [...MIXTES, ...MIXTES.map((i) => i + 10)];
const moinsPour = (lignes) => (lignes >= 10 ? 4 : lignes >= 7 ? 2 : 1);

/** Une série de みとり暗算 : nb problèmes de `lignes` nombres à `chiffres` chiffres (ou `longueurs`). */
const serieMitori = (nb, lignes, x) => ({ nb, lignes, ...(x.longueurs ? { longueurs: x.longueurs, min: 1, max: 2 } : { chiffres: x.chiffres, min: x.chiffres, max: x.chiffres }) });
const M = (lignes, chiffres) => serieMitori(10, lignes, { chiffres });

/** 1er au 6e kyū : deux séries de 10 みとり暗算, et des × et ÷ en une ou deux séries de 15. */
function complet(mitori, totaux) {
  const deux = (t) => (Array.isArray(t) ? t : [t, t]);
  const [m1, m2] = deux(totaux);
  return {
    mitori: { series: mitori, soustractions: true, mixtes: MIXTES_20, points: 10 },
    mul: { nb: 30, series: [{ nb: 15, total: m1 }, { nb: 15, total: m2 }], points: 5 },
    div: { nb: 30, series: [{ nb: 15, total: m1 }, { nb: 15, total: m2 }], points: 5 },
  };
}

/** Le sujet commun du 7e au 10e kyū : 15 × 3口, 15 × 4口, 20 × 5口, nombres à 1 chiffre. */
const COMMUN = { mitori: { series: [serieMitori(15, 3, { chiffres: 1 }), serieMitori(15, 4, { chiffres: 1 }), serieMitori(20, 5, { chiffres: 1 })], soustractions: false, points: 10 } };

const g = (id, nom, japonais, seuil, contenu, x = {}) => ({ id, nom, japonais, minutes: 12, seuil: seuil / 500, verifie: true, ...contenu, ...x });
export const GRADES_ANZAN = [
  g('a10', '10e kyū d\'anzan', '暗算10級', 250, COMMUN, { commun: true, verifie: false }),
  g('a9', '9e kyū d\'anzan', '暗算9級', 300, COMMUN, { commun: true, verifie: false }),
  g('a8', '8e kyū d\'anzan', '暗算8級', 350, COMMUN, { commun: true, verifie: false }),
  g('a7', '7e kyū d\'anzan', '暗算7級', 400, COMMUN, { commun: true, verifie: false }),
  g('a6', '6e kyū d\'anzan', '暗算6級', 400, complet([serieMitori(10, 5, { longueurs: [2, 1, 1, 1, 1] }), serieMitori(10, 5, { longueurs: [2, 1, 1, 1, 1] })], 3)),
  g('a5', '5e kyū d\'anzan', '暗算5級', 400, complet([serieMitori(10, 5, { longueurs: [2, 2, 2, 1, 1] }), serieMitori(10, 5, { longueurs: [2, 2, 2, 1, 1] })], 3)),
  g('a4', '4e kyū d\'anzan', '暗算4級', 400, complet([M(5, 2), M(5, 2)], 3)),
  g('aj3', '3e kyū préparatoire d\'anzan (準3)', '暗算準3級', 400, complet([M(5, 2), M(5, 3)], [3, 4]), { jun: true }),
  g('a3', '3e kyū d\'anzan', '暗算3級', 400, complet([M(5, 3), M(5, 3)], 4)),
  g('aj2', '2e kyū préparatoire d\'anzan (準2)', '暗算準2級', 400, complet([M(5, 3), M(7, 3)], 4), { jun: true }),
  g('a2', '2e kyū d\'anzan', '暗算2級', 400, complet([M(7, 3), M(7, 3)], 4)),
  g('aj1', '1er kyū préparatoire d\'anzan (準1)', '暗算準1級', 400, complet([M(7, 3), M(10, 3)], [4, 5]), { jun: true }),
  g('a1', '1er kyū d\'anzan', '暗算1級', 400, complet([M(10, 3), M(10, 3)], 5)),
];

/** Série sans deux problèmes identiques (30 essais par problème, puis on accepte). */
function serie(nb, gen, cle) {
  const vus = new Set();
  return Array.from({ length: nb }, (_, i) => {
    let p;
    for (let e = 0; e < 30; e++) { p = gen(i); if (!vus.has(cle(p))) break; }
    vus.add(cle(p));
    return p;
  });
}

/** La spécification du i-ème problème d'une partie découpée en séries. */
function specDe(partie, i) {
  let k = i;
  for (const s of partie.series) { if (k < s.nb) return s; k -= s.nb; }
  return partie.series.at(-1);
}

/** × et ÷ de tête : 3 chiffres = 2 × 1 ; 4 = 2 × 2 ou 3 × 1 ; 5 = 3 × 2 ou 2 × 3 (sujet modèle). */
const courtPour = (total) => (total >= 5 ? 2 : 1);

/** Sujet d'anzan : les problèmes sont marqués `mental` (aucune explication au soroban). */
export function genererSujetAnzan(grade) {
  const sections = [];
  const m = grade.mitori;
  const mitori = (i) => { const s = specDe(m, i); const mixte = m.soustractions && (m.mixtes ?? []).includes(i); return genererMitori({ ...s, soustractions: mixte, moins: moinsPour(s.lignes) }); };
  sections.push({ cle: 'mitori', titre: 'Additions et soustractions de tête (見取暗算)', points: m.points,
    problemes: serie(m.series.reduce((t, s) => t + s.nb, 0), mitori, (p) => p.lignes.map((l) => `${l.op}${l.n}`).join()) });
  const op = (f, gen) => (i) => { const s = specDe(f, i); return gen({ total: s.total, court: courtPour(s.total) }); };
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplications de tête (乗暗算)', points: grade.mul.points, problemes: serie(grade.mul.nb, op(grade.mul, genererMulGrade), (p) => `${p.a}|${p.b}`) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Divisions de tête (除暗算)', points: grade.div.points, problemes: serie(grade.div.nb, op(grade.div, genererDivGrade), (p) => `${p.a}|${p.b}`) });
  return { grade, sections };
}

const nbMitori = (g) => g.mitori.series.reduce((t, s) => t + s.nb, 0);
export const totalPointsAnzan = (g) => nbMitori(g) * g.mitori.points + (g.mul ? g.mul.nb * g.mul.points : 0) + (g.div ? g.div.nb * g.div.points : 0);
