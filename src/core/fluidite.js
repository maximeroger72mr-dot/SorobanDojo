/**
 * Fluidité (0.39) : la vitesse compte aussi en révision, et une leçon lente reprend de la vitesse.
 *
 * Test flash de révision (10 calculs) : réussi avec 9 justes ET une vitesse au moins égale à 85 %
 * de la médiane des 10 derniers essais réussis de la leçon (sa vitesse habituelle, pas son record).
 * L'exigence ne dépasse jamais le seuil de la médaille que la leçon a déjà : une leçon en argent
 * n'a jamais à tenir l'or. Sans 10 essais chronométrés, ou sans médaille chronométrée (bronze),
 * seule la justesse compte. Juste mais trop lent : la carte reste dans sa boîte (ni montée, ni
 * recul) et la leçon est marquée « fluidité à reprendre ».
 * En révision mélangée (4 à 5 calculs par leçon), seule la justesse compte (trop peu de calculs).
 *
 * Fluidité à reprendre : les leçons marquées au test flash, puis celles d'une étape terminée qui
 * sont sorties de la porte de l'or sans l'or (au bout des 10 jours, ou en argent avec le volume).
 * Elles passent en priorité dans les blocs de vitesse, jusqu'à l'or (c'est la « dette de vitesse »).
 * Fonctions pures.
 */

import { evaluer, mediane, tempsParUnite } from './maitrise.js';
import { SOUS_PALIERS, PALIERS, familleLecon, evaluerLecon } from './curriculum.js';

export const JUSTES_FLASH = 9;
export const PART_VITESSE_REVISION = 0.85;
export const ESSAIS_REFERENCE = 10;

/**
 * Verdict d'un test flash.
 * @param {object} etat  état de la leçon (son historique `hist`)
 * @param {{ justes:number, resultats: Array<{ ex, juste, dureeMs }> }} b
 * @returns {{ reussi:boolean, lent:boolean, t?:number, limite?:number, sansVitesse?:boolean }}
 */
export function verdictFlash(sp, etat, b, { plafondMedaille = true } = {}) {
  if (b.justes < JUSTES_FLASH) return { reussi: false, lent: false };
  const famille = familleLecon(sp);
  const recents = (etat?.hist ?? []).filter((x) => x.ok && x.t != null).slice(-ESSAIS_REFERENCE);
  const seuilMedaille = evaluer(etat?.hist ?? [], famille).niveau.temps?.[famille];
  if (recents.length < ESSAIS_REFERENCE || seuilMedaille == null) return { reussi: true, lent: false, sansVitesse: true };
  // Contrôle à 90 jours : le recul se mesure à la vitesse habituelle seule (pas de plafond de médaille).
  const limite = plafondMedaille ? Math.max(mediane(recents.map((x) => x.t)) / PART_VITESSE_REVISION, seuilMedaille) : mediane(recents.map((x) => x.t)) / PART_VITESSE_REVISION;
  const t = mediane(b.resultats.filter((r) => r.juste && r.ex && Number.isFinite(r.dureeMs) && !r.autoEvalue).map((r) => tempsParUnite(r.ex, r.dureeMs)));
  if (t == null) return { reussi: true, lent: false, sansVitesse: true };
  return t <= limite ? { reussi: true, lent: false, t, limite } : { reussi: false, lent: true, t, limite };
}

/** Gestes d'une leçon de colonnes (sans les directs, sauf s'il n'y a qu'eux). */
const gestesColonnes = (sp) => {
  if ((sp.type ?? 'addsub') !== 'addsub') return [];
  const amis = (sp.cibles ?? []).filter((c) => !c.endsWith(':direct'));
  return amis.length ? amis : (sp.cibles ?? []);
};
/** Tous les gestes de la leçon sont-ils en or ? (leçons de colonnes seulement) */
export function gestesEnOr(d, sp) {
  const g = gestesColonnes(sp);
  return g.length > 0 && g.every((c) => evaluer(d.motifs?.[c]?.hist ?? [], 'addsub').index >= 3);
}
/** La leçon force-t-elle la séance en vitesse ? Seulement marquée lente en révision (0.40.2). */
export const forceVitesse = (d, sp) => !!sp && !!d.paliers?.[sp.id]?.fluidite;

const LECON_SOROBAN = (sp) => !sp.mental && !['theorie', 'placement', 'lire', 'complement', 'photo', 'tenir'].includes(sp.type);

/**
 * Leçons à la fluidité à reprendre, la plus prioritaire d'abord : marquées au test flash (la plus
 * récente d'abord), puis sorties d'une étape terminée sans l'or (la plus récente d'abord).
 * Une leçon passée en or n'y est plus ; ni (0.40.2) une leçon de colonnes dont TOUS les gestes sont
 * en or : ce sont eux que les blocs de vitesse entraînent (la médaille de la leçon, elle, n'avance
 * qu'en leçon ; avant, une leçon sortie à l'argent restait dans la liste pour toujours).
 * Seules les leçons MARQUÉES (révision lente) forcent la séance en vitesse : voir `forceVitesse`.
 */
export function leconsFluidite(d) {
  const enOr = (sp) => evaluerLecon(d.paliers[sp.id]?.hist ?? [], sp).index >= 3 || gestesEnOr(d, sp);
  const marquees = SOUS_PALIERS.filter((sp) => d.paliers[sp.id]?.fluidite && LECON_SOROBAN(sp) && !enOr(sp))
    .sort((a, b) => String(d.paliers[b.id].fluidite).localeCompare(String(d.paliers[a.id].fluidite)));
  // Étape terminée : une leçon d'une étape SUIVANTE est déjà validée.
  const ordreEtape = (sp) => PALIERS.findIndex((p) => p.id === sp.palier?.id);
  const etapeMax = Math.max(-1, ...SOUS_PALIERS.filter((sp) => !sp.mental && d.paliers[sp.id]?.valide).map(ordreEtape));
  const sorties = SOUS_PALIERS.filter((sp) => LECON_SOROBAN(sp) && d.paliers[sp.id]?.valide && ordreEtape(sp) < etapeMax && !marquees.includes(sp)
    && evaluerLecon(d.paliers[sp.id]?.hist ?? [], sp).essais >= 8 && !enOr(sp)).sort((a, b) => b.ordre - a.ordre);
  return [...marquees, ...sorties];
}
