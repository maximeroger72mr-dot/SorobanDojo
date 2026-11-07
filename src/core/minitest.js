/**
 * Verdict du mini-test d'une leçon : assez de réponses justes ET, pour les leçons faites sur
 * le soroban et chronométrées, une vitesse au moins « acquis débutant » (temps médian des
 * réponses justes). Un mini-test réussi par chance mais trop lent ne valide pas la leçon.
 */

import { TEST, familleLecon } from './curriculum.js';
import { NIVEAUX, tempsParUnite, UNITES_TEMPS } from './maitrise.js';

export const testMin = (sp) => sp.testMin ?? TEST.reussitesMin;

/** Leçons dont la vitesse compte au mini-test (pas l'anzan, ni la photo / image auto-évaluée). */
const VITESSE_EXIGEE = ['addsub', 'addsubdec', 'negatif', 'placement', 'table', 'mul', 'div', 'muldiv'];
export const exigeVitesse = (sp) => VITESSE_EXIGEE.includes(sp.type) || (!['anzan', 'photo', 'tenir', 'theorie'].includes(sp.type) && familleLecon(sp) === 'muldiv');

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
  const famille = familleLecon(sp);
  const seuil = NIVEAUX[2].temps[famille];
  const unite = UNITES_TEMPS[famille] ?? 'unité';
  const mesures = (bilan.resultats ?? []).filter((r) => r.juste && !r.autoEvalue && r.ex && Number.isFinite(r.dureeMs));
  const temps = exigeVitesse(sp) && mesures.length ? mediane(mesures.map((r) => tempsParUnite(r.ex, r.dureeMs))) : null;
  const vitesseOk = temps === null || temps <= seuil;
  const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  let raison = '';
  if (!justesOk) raison = `Il faut ${testMin(sp)} réussites.`;
  else if (!vitesseOk) raison = `Assez de justes, mais trop lent : ${nf(temps)} s par ${unite} en moyenne, il faut au plus ${nf(seuil)} s (niveau « acquis débutant »).`;
  return { reussi: justesOk && vitesseOk, justesOk, vitesseOk, temps, seuil, unite, raison };
}
