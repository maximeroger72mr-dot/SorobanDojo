/**
 * Verdict du mini-test d'une leçon : assez de réponses justes ET, pour les leçons faites sur
 * le soroban et chronométrées, une vitesse au moins « acquis débutant » (temps médian des
 * réponses justes). Un mini-test réussi par chance mais trop lent ne valide pas la leçon.
 */

import { TEST, familleLecon, genererExercice, chiffresColonne, definirSeuilsLecon } from './curriculum.js';
import { NIVEAUX, tempsParUnite, UNITES_TEMPS, unites, SURCOUT_S, reussiteExigee } from './maitrise.js';
import { tempsLecon, PART_CADENCE_LECON, allureGrade } from './allure.js';
import { GRADES_KYU as GRADES } from './epreuves.js';
import { PREREQUIS } from './parcours.js';

/**
 * 0.42 : réussites exigées au mini-test, calculées par chiffre comme l'argent : 15 × la justesse
 * exigée pour l'argent sur des colonnes de cette longueur, arrondi en dessous, 10 au moins (13 sur
 * 15 jusqu'à 30 chiffres par colonne, 12 à 40 et 55, 11 à 75, 10 à 95). Avant : 13 partout, deux fois
 * plus sévère que l'argent sur les colonnes longues.
 */
const ARGENT_BASE = { id: 'debutant', reussite: 0.9 }; // l'argent de l'échelle de base, quelle que soit l'échelle
export const testMin = (sp) => {
  if (sp.testMin != null) return sp.testMin;
  const ch = chiffresColonne(sp);
  const n = sp.testNombre ?? TEST.exercices;
  if (!ch || n !== TEST.exercices) return TEST.reussitesMin;
  return Math.min(TEST.reussitesMin, Math.max(10, Math.floor(n * reussiteExigee(ARGENT_BASE, ch) + 1e-9)));
};

/**
 * 0.42 : vitesse exigée d'une leçon (mini-test ET argent), en secondes par chiffre ou par produit :
 * 80 % de la cadence de l'examen du premier grade qui l'exige, quand c'est plus strict que l'argent de
 * l'échelle (3 s par chiffre : avant le 6e kyū, rien ne change). L'or de la leçon : 80 % de ce seuil.
 * @returns {{ seuil: number, parGrade: boolean, cadence: object|null, seuils: Object<number, number>|null }}
 */
const cadences = new Map();
export function seuilVitesseLecon(sp) {
  const famille = familleLecon(sp);
  const base = NIVEAUX[2].temps?.[famille];
  if (!cadences.has(sp.id)) {
    let c = ['addsub', 'muldiv'].includes(famille) && !sp.mental ? tempsLecon(sp, GRADES, (g) => PREREQUIS[g.id]) : null;
    // 0.43 : leçon de découverte (première rencontre d'une technique : négatifs p8-n, décimaux pd-1) :
    // l'allure du grade PRÉCÉDENT ; les leçons de format qui suivent gardent celle de leur grade.
    if (c && sp.decouverte) {
      const i = GRADES.findIndex((g) => g.id === c.grade.id);
      const avant = i > 0 ? GRADES[i - 1] : null;
      if (avant) {
        const a = allureGrade(avant);
        c = { grade: avant, temps: (famille === 'muldiv' ? a.parProduit : a.parChiffre) / PART_CADENCE_LECON, decouverte: true };
      }
    }
    cadences.set(sp.id, c);
  }
  const cadence = cadences.get(sp.id);
  const parGrade = !!cadence && base != null && cadence.temps < base;
  if (!parGrade) return { seuil: base, parGrade, cadence, seuils: null };
  const seuil = Math.round(cadence.temps * 100) / 100;
  const or = Math.min(NIVEAUX[3].temps[famille], Math.round(seuil * 0.8 * 100) / 100);
  const platine = Math.min(NIVEAUX[4].temps[famille], Math.round(or * 0.8 * 100) / 100);
  return { seuil, parGrade, cadence, seuils: { 2: seuil, 3: or, 4: platine } };
}
definirSeuilsLecon((sp) => seuilVitesseLecon(sp).seuils);

/**
 * 0.43 : au plus 2 mini-tests par jour sur une leçon pas encore validée (les ratés pour lenteur
 * s'enchaînaient : 155 en 3 mois sur p9-2 en simulation). Un test en séries compte une fois.
 */
export const MINI_TESTS_PAR_JOUR = 2;
export const testsDuJour = (d, id, date) => (d.sessions ?? []).filter((s) => s.date === date && s.module === 'lecons' && s.mode === 'test' && s.reglages?.sousPalier === id && (s.reglages?.serie ?? 1) === 1).length;

/**
 * 0.43 : après un mini-test raté pour LENTEUR : l'écart au seuil, la tendance des derniers essais
 * (`paliers[id].essaisTest`), et le lièvre réglé sur le format de la leçon, qui part de la vitesse
 * mesurée et accélère de 3 % par colonne juste jusqu'à l'allure visée (leçons de colonnes).
 */
export function apresLenteur(sp, e, verdict) {
  if (!verdict || verdict.vitesseOk || verdict.temps == null || !verdict.seuil) return null;
  const nf = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const derniers = (e?.essaisTest ?? []).filter((x) => x.temps != null).slice(-3).map((x) => x.temps);
  const ecart = `Il vous manque ${nf(verdict.temps - verdict.seuil)} s par ${verdict.unite} (${nf(verdict.temps)} s, il faut ${nf(verdict.seuil)} s).`;
  const tendance = derniers.length >= 2 ? ` Vos derniers mini-tests : ${derniers.map(nf).join(' → ')} s.` : '';
  const lignes = sp.lignesMax ?? sp.lignes;
  const chiffres = sp.chiffresMax ?? sp.chiffres;
  const lievre = sp.type === 'addsub' && lignes && chiffres ? {
    nom: `mini-test de « ${sp.titre} »`, lecon: sp.titre, lignes, chiffres, colonnes: 6,
    cadence: Math.round(verdict.temps * (chiffresColonne(sp) / ((sp.lignes + lignes) / 2)) * 100) / 100,
    vise: Math.round(verdict.seuil * (chiffresColonne(sp) / ((sp.lignes + lignes) / 2)) * 100) / 100,
  } : null;
  return { ecart: ecart + tendance, lievre };
}

/**
 * 0.42 : mode précision, pour l'élève qui va VRAIMENT vite (60 % du seuil de la leçon ou mieux) sans
 * la justesse de l'argent. 3 séances au plus par leçon (`e.precision` : les jours où il a servi).
 * Avant : dès 1,5 s par chiffre sous l'argent, soit 114 jours sur 180 pour un élève régulier en
 * simulation ; le chrono était masqué. Il reste maintenant visible, avec l'objectif chiffré.
 * @returns {{ seuil: number }|null}
 */
export const SEANCES_PRECISION_MAX = 3;
export function modePrecision(sp, e, ev, date) {
  if (sp.type !== 'addsub' || sp.mental || !ev || ev.essais < 8 || ev.temps == null) return null;
  const { seuil } = seuilVitesseLecon(sp);
  if (!seuil || ev.temps > 0.6 * seuil) return null;
  if (ev.reussite >= reussiteExigee(NIVEAUX[2], chiffresColonne(sp)) - 1e-9) return null;
  const jours = e?.precision ?? [];
  if (!jours.includes(date) && jours.length >= SEANCES_PRECISION_MAX) return null;
  return { seuil };
}

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
  const { seuil, parGrade, cadence } = seuilVitesseLecon(sp);
  const unite = UNITES_TEMPS[famille] ?? 'unité';
  const mesures = (bilan.resultats ?? []).filter((r) => r.juste && !r.autoEvalue && r.ex && Number.isFinite(r.dureeMs));
  // `tempsJustes` : temps par unité déjà calculés (mini-test fait en plusieurs séries).
  const tj = bilan.tempsJustes ?? mesures.map((r) => tempsParUnite(r.ex, r.dureeMs));
  const temps = exigeVitesse(sp) && tj.length ? mediane(tj) : null;
  const vitesseOk = temps === null || temps <= seuil;
  const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  let raison = '';
  if (!justesOk) raison = `Il faut ${testMin(sp)} réussites.`;
  else if (!vitesseOk) raison = `Assez de justes, mais trop lent : ${nf(temps)} s par ${unite} en moyenne, il faut au plus ${nf(seuil)} s (${parGrade ? `${Math.round(PART_CADENCE_LECON * 100)} % de la cadence du ${cadence.grade.nom}${cadence.decouverte ? ', le grade d\'avant : leçon de découverte' : ''}` : 'niveau « acquis débutant »'}).`;
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
