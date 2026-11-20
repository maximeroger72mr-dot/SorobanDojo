/**
 * Mesures de vitesse sur de VRAIES feuilles (0.39) : planches, feuilles des marches d'allure, × et
 * ÷ au format du kyū, feuille de la semaine (« entraînement ») ; examens blancs et épreuves
 * (« sous examen »). Deux mesures séparées : l'examen ajoute la pression du chrono et du sujet
 * entier, l'entraînement est plus fréquent.
 *
 * Chaque mesure garde son FORMAT (lignes × chiffres pour les colonnes ; type et chiffres au total
 * pour × et ÷), pour ne comparer que des feuilles comparables. Une feuille réussie à moins de 70 %
 * (sur les réponses données) n'est pas une mesure : son temps ne dit rien de la vitesse.
 *
 * Mesure : { date, source, partie, format, t, ratio?, grade?, n, reussite }
 *  - partie : 'colonnes' | 'mul' | 'div' | 'mixte' (feuille qui mêle plusieurs parties) ;
 *  - t : secondes par chiffre (colonnes) ou par produit de table (× ÷), 3 s de lecture et
 *    d'écriture retirées par problème ;
 *  - ratio (mixte, avec un grade) : temps pris / temps qu'il faudrait à l'allure du grade
 *    (> 1 : trop lent) ; grade : 'systeme:id'.
 * Fonctions pures.
 */

import { unites, mediane } from './maitrise.js';
import { lundi } from './maitrise.js';

export const SEUIL_MESURE = 0.7;
export const MESURES_GARDEES = 400;
export const SURCOUT_S = 3;
/** Une mesure sous examen sert à la projection tant qu'elle a moins de 3 semaines. */
export const JOURS_EXAMEN_VALABLE = 21;
export const MESURES_MEDIANE = 5;

const nb = (n) => String(n).replace(/\D/g, '').replace(/^0+(?=\d)/, '').length;

/** Partie d'un problème, ou null s'il ne mesure pas une vitesse au soroban (anzan, denpyō…). */
export function partieProbleme(ex) {
  if (!ex || ex.mental || ex.denpyo || ex.flash) return null;
  if (ex.type === 'addsub') return 'colonnes';
  if (ex.type === 'mul' || ex.type === 'div') return ex.type;
  return null;
}

/** Format d'un problème : '10x3' (lignes × chiffres du plus long nombre), 'mul:5', 'div:4'. */
export function formatProbleme(ex) {
  const p = partieProbleme(ex);
  if (p === 'colonnes') return `${ex.lignes.length}x${Math.max(...ex.lignes.map((l) => nb(l.n)))}`;
  if (p === 'mul') return `mul:${nb(ex.a) + nb(ex.b)}`;
  if (p === 'div') return `div:${nb(ex.b) + nb(ex.resultat)}`;
  return null;
}

/** Format de colonnes lu : { lignes, chiffres } (null si ce n'est pas un format de colonnes). */
export function lireFormat(f) {
  const m = /^(\d+)x(\d+)$/.exec(f ?? '');
  return m ? { lignes: Number(m[1]), chiffres: Number(m[2]) } : null;
}

/** Le format d'une feuille : celui de la majorité de ses problèmes, ou le plus grand (le plus exigeant). */
function formatFeuille(probs, partie) {
  const formats = probs.map(formatProbleme);
  if (partie === 'colonnes') {
    const lignes = Math.max(...probs.map((ex) => ex.lignes.length));
    const chiffres = Math.max(...formats.map((f) => lireFormat(f).chiffres));
    return `${lignes}x${chiffres}`;
  }
  const compte = {};
  for (const f of formats) compte[f] = (compte[f] ?? 0) + 1;
  return Object.entries(compte).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Mesures d'une feuille corrigée.
 * @param {{ resultats: Array<{ ex, juste, reponse }>, dureeMs: number }} b  bilan de ui/feuille
 * @param {{ source: 'entrainement'|'examen', date: string, grade?: object, allure?: { parChiffre, parProduit } }} o
 *   grade et allure : pour une feuille qui mêle colonnes, × et ÷ (une seule durée pour tout)
 * @returns {object[]}  0 ou 1 mesure
 */
export function mesuresFeuille(b, { source, date, grade = null, allure = null }) {
  const repondus = (b.resultats ?? []).filter((r) => r.reponse !== null && r.reponse !== undefined);
  if (!repondus.length || !(b.dureeMs > 0)) return [];
  // Une feuille qui contient de l'anzan ou du denpyō : sa durée mêle autre chose, pas de mesure.
  if (repondus.some((r) => partieProbleme(r.ex) === null)) return [];
  const reussite = repondus.filter((r) => r.juste).length / repondus.length;
  if (reussite < SEUIL_MESURE) return [];
  const probs = repondus.map((r) => r.ex);
  const parties = [...new Set(probs.map(partieProbleme))];
  const secondes = b.dureeMs / 1000;
  const n = probs.reduce((s, ex) => s + unites(ex), 0);
  const base = { date, source, n, reussite: Math.round(reussite * 100) / 100, ...(grade ? { grade: `${grade.systeme ?? 'nissho'}:${grade.id}` } : {}) };
  if (parties.length === 1) {
    const t = Math.max(0.05, (secondes - SURCOUT_S * probs.length) / n);
    return [{ ...base, partie: parties[0], format: formatFeuille(probs, parties[0]), t: Math.round(t * 1000) / 1000 }];
  }
  if (!grade || !allure) return [];
  const prevu = probs.reduce((s, ex) => s + unites(ex) * (partieProbleme(ex) === 'colonnes' ? allure.parChiffre : allure.parProduit) + SURCOUT_S, 0);
  return [{ ...base, partie: 'mixte', format: 'grade', ratio: Math.round((secondes / prevu) * 1000) / 1000 }];
}

/** Ajoute des mesures à la liste (bornée). */
export function ajouterMesures(liste, mesures) {
  liste.push(...mesures);
  if (liste.length > MESURES_GARDEES) liste.splice(0, liste.length - MESURES_GARDEES);
  return liste;
}

/** Le format de colonnes f couvre-t-il celui du grade (au moins ses lignes et ses chiffres) ? */
export const couvre = (f, fg) => { const x = lireFormat(f); return !!x && !!fg && x.lignes >= fg.lignes && x.chiffres >= fg.chiffres; };

/**
 * Mesures d'entraînement d'une partie au format du grade.
 *  - colonnes : au moins les lignes et les chiffres du grade ;
 *  - × ÷ : feuilles au format du kyū (marches, hakari) ou d'au moins les chiffres du grade.
 */
export function mesuresAuFormat(d, partie, fg, totalGrade = null, source = 'entrainement') {
  return (d.mesures ?? []).filter((m) => m.source === source && m.partie === partie
    && (partie === 'colonnes' ? couvre(m.format, fg) : (m.kyu || totalGrade == null || Number(String(m.format).split(':')[1]) >= totalGrade - 1)));
}

/** Médiane des 5 dernières mesures (t), ou null. */
export const medianeRecente = (ms) => (ms.length ? mediane(ms.slice(-MESURES_MEDIANE).map((m) => m.t)) : null);

/**
 * Allure sous examen pour un grade : médiane des ratios des 3 derniers examens de ce grade de moins
 * de 3 semaines (examens blancs et épreuves), ou null.
 */
export function ratioExamen(d, cleGrade, date) {
  const limite = new Date(`${date}T12:00`).getTime() - JOURS_EXAMEN_VALABLE * 86400000;
  const ms = (d.mesures ?? []).filter((m) => m.source === 'examen' && m.partie === 'mixte' && m.grade === cleGrade
    && new Date(`${m.date}T12:00`).getTime() >= limite);
  return ms.length ? { ratio: mediane(ms.slice(-3).map((m) => m.ratio)), nombre: ms.length, date: ms.at(-1).date } : null;
}

/**
 * Série hebdomadaire de ratios (médiane par semaine, de la plus ancienne à la plus récente) à
 * partir de mesures déjà ramenées à l'allure du grade. Sert au gain réel par semaine.
 * @param {Array<{ date: string, ratio: number }>} points
 */
export function semainesRatios(points, date, semaines = 8) {
  const jour = (k) => new Date(`${k}T12:00`).getTime();
  const fin = jour(lundi(date));
  const par = {};
  for (const p of points) {
    const k = lundi(p.date);
    const i = Math.round((fin - jour(k)) / (7 * 86400000));
    if (i < 0 || i >= semaines) continue;
    (par[k] ??= []).push(p.ratio);
  }
  return Object.entries(par).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, rs]) => ({ semaine: k, ratio: mediane(rs), index: Math.round((jour(k) - fin) / (7 * 86400000)) }));
}

/** Repère de gain de vitesse par semaine, et bornes du gain réel. */
export const GAIN_REPERE = 0.02;
export const GAIN_MIN = 0.005;
export const GAIN_MAX = 0.04;
export const SEMAINES_PLEIN_POIDS = 8;
export const SEMAINES_PLATEAU = 3;

/**
 * Gain de vitesse par semaine (0.39), à partir de la série hebdomadaire :
 *  - gain réel : pente de log(ratio) sur les semaines mesurées (6 à 8 semaines), borné à 0,5–4 % ;
 *  - mêlé au repère de 2 % : le réel pèse d'autant plus que les semaines de mesures s'accumulent
 *    (plein poids à 8 semaines) ;
 *  - plateau : au moins 4 semaines mesurées et aucun gain sur les 3 dernières semaines.
 * @returns {{ gain: number, reel: number|null, semaines: number, plateau: boolean }}
 */
export function gainHebdo(serie) {
  const k = serie.length;
  const pente = (pts) => {
    if (pts.length < 2) return null;
    const mx = pts.reduce((s, p) => s + p.index, 0) / pts.length;
    const my = pts.reduce((s, p) => s + Math.log(p.ratio), 0) / pts.length;
    const num = pts.reduce((s, p) => s + (p.index - mx) * (Math.log(p.ratio) - my), 0);
    const den = pts.reduce((s, p) => s + (p.index - mx) ** 2, 0);
    return den ? num / den : null;
  };
  const etendue = k ? serie.at(-1).index - serie[0].index : 0;
  const p = k >= 3 && etendue >= 2 ? pente(serie) : null;
  const reel = p === null ? null : 1 - Math.exp(p);
  const w = reel === null ? 0 : Math.min(1, k / SEMAINES_PLEIN_POIDS);
  const borne = reel === null ? GAIN_REPERE : Math.max(GAIN_MIN, Math.min(GAIN_MAX, reel));
  const recentes = serie.filter((x) => x.index >= serie.at(-1)?.index - SEMAINES_PLATEAU);
  const pr = recentes.length >= 3 ? pente(recentes) : null;
  const plateau = k >= 4 && pr !== null && 1 - Math.exp(pr) <= 0;
  return { gain: (1 - w) * GAIN_REPERE + w * borne, reel, semaines: k, plateau };
}
