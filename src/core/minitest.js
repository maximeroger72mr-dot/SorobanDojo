/**
 * Verdict du mini-test d'une leçon : assez de réponses justes ET, pour les leçons faites sur
 * le soroban et chronométrées, une vitesse au moins « acquis débutant » (temps médian des
 * réponses justes). Un mini-test réussi par chance mais trop lent ne valide pas la leçon.
 */

import { TEST, familleLecon, genererExercice } from './curriculum.js';
import { NIVEAUX, tempsParUnite, UNITES_TEMPS, unites, SURCOUT_S } from './maitrise.js';
import { tempsLecon, PART_CADENCE_LECON } from './allure.js';
import { GRADES_KYU as GRADES } from './epreuves.js';
import { PREREQUIS } from './parcours.js';

export const testMin = (sp) => sp.testMin ?? TEST.reussitesMin;

/** Leçons dont la vitesse compte au mini-test (pas l'anzan, ni la photo / image auto-évaluée). */
const VITESSE_EXIGEE = ['addsub', 'addsubdec', 'negatif', 'placement', 'table', 'mul', 'div', 'muldiv'];
// Piste anzan (de tête) : jamais de vitesse exigée, quel que soit le type de calcul.
export const exigeVitesse = (sp) => !sp.mental && (VITESSE_EXIGEE.includes(sp.type) || (!['anzan', 'photo', 'tenir', 'theorie'].includes(sp.type) && familleLecon(sp) === 'muldiv'));

const mediane = (xs) => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/**
 * @param {object} sp  sous-palier
 * @param {{ justes:number, total:number, resultats?:Array<{ex, juste, dureeMs, autoEvalue?}> }} bilan
 * @returns {{ reussi, justesOk, vitesseOk, temps, seuil, unite, raison }}
 */
export function verdictMiniTest(sp, bilan) {
  const justesOk = bilan.justes >= testMin(sp);
  // Leçons en temps limité (paires qui font 5 ou 10 : 20 réponses en 60 s).
  if (sp.testSecondes && justesOk && bilan.dureeMs > sp.testSecondes * 1000) {
    const s = Math.round(bilan.dureeMs / 1000);
    return { reussi: false, justesOk, vitesseOk: false, temps: null, seuil: null, unite: null, raison: `Assez de justes, mais en ${s} s : il faut les ${sp.testNombre} réponses en ${sp.testSecondes} s.` };
  }
  const famille = familleLecon(sp);
  // Leçons avancées : la vitesse exigée suit l'examen visé (70 % de sa cadence), dès qu'elle est
  // plus stricte que le niveau « acquis débutant ».
  const base = NIVEAUX[2].temps[famille];
  const cadence = ['addsub', 'muldiv'].includes(famille) ? tempsLecon(sp, GRADES, (g) => PREREQUIS[g.id]) : null;
  const parGrade = !!cadence && cadence.temps < base;
  const seuil = parGrade ? Math.round(cadence.temps * 100) / 100 : base;
  const unite = UNITES_TEMPS[famille] ?? 'unité';
  const mesures = (bilan.resultats ?? []).filter((r) => r.juste && !r.autoEvalue && r.ex && Number.isFinite(r.dureeMs));
  // `tempsJustes` : temps par unité déjà calculés (mini-test fait en plusieurs séries).
  const tj = bilan.tempsJustes ?? mesures.map((r) => tempsParUnite(r.ex, r.dureeMs));
  const temps = exigeVitesse(sp) && tj.length ? mediane(tj) : null;
  const vitesseOk = temps === null || temps <= seuil;
  const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  let raison = '';
  if (!justesOk) raison = `Il faut ${testMin(sp)} réussites.`;
  else if (!vitesseOk) raison = `Assez de justes, mais trop lent : ${nf(temps)} s par ${unite} en moyenne, il faut au plus ${nf(seuil)} s (${parGrade ? `${Math.round(PART_CADENCE_LECON * 100)} % de la cadence du ${cadence.grade.nom}` : 'niveau « acquis débutant »'}).`;
  return { reussi: justesOk && vitesseOk, justesOk, vitesseOk, temps, seuil, unite, raison };
}

// ------------------------------------------------------------------ mini-tests longs en séries

/**
 * 0.38 : un mini-test qui durerait plus de 12 minutes AU SEUIL de vitesse exigé (p8 et après :
 * 20 à 30 minutes) se passe en séries de 5 calculs (3 pour 15). Même exigence au total (13 sur 15,
 * temps médian des justes sous le seuil) ; les séries faites restent valables jusqu'au lendemain.
 */
export const MINUTES_TEST_MAX = 12;
export const CALCULS_SERIE = 5;
const durees = new Map();
export function dureeTestEstimee(sp, nombre = sp.testNombre ?? TEST.exercices) {
  if (!exigeVitesse(sp) || sp.testSecondes) return 0;
  if (!durees.has(sp.id)) {
    let u = 0;
    for (let i = 0; i < 24; i++) u += unites(genererExercice(sp));
    durees.set(sp.id, u / 24);
  }
  const seuil = verdictMiniTest(sp, { justes: 0 }).seuil;
  return (nombre * (durees.get(sp.id) * seuil + SURCOUT_S)) / 60;
}
export const testEnSeries = (sp, nombre = sp.testNombre ?? TEST.exercices) => nombre % CALCULS_SERIE === 0 && nombre > CALCULS_SERIE && dureeTestEstimee(sp, nombre) > MINUTES_TEST_MAX;

/** Séries encore valables (commencées hier ou aujourd'hui), sinon []. */
export function seriesValables(etat, date, hier) {
  const t = etat?.testSeries;
  return t && t.debut >= hier && t.debut <= date ? t.series : [];
}

/** Bilan cumulé des séries (pour verdictMiniTest). */
export const bilanSeries = (series) => ({
  justes: series.reduce((n, s) => n + s.justes, 0), total: series.reduce((n, s) => n + s.total, 0),
  dureeMs: series.reduce((n, s) => n + s.dureeMs, 0), tempsJustes: series.flatMap((s) => s.tempsJustes ?? []),
});
