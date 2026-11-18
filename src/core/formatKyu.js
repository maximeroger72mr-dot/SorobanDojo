/**
 * Entraînement « au format du kyū » : les × et ÷ (et plus tard les colonnes) tirés dans des sujets
 * d'examen du grade visé, pour retrouver ses découpages dans les mêmes proportions.
 * Fonctions pures (le hasard mis à part).
 */

import { formatExamen } from './parcours.js';
import { systemeChoisi, genererSujet } from './epreuves.js';
import { semaineISO } from './hasard.js';

/**
 * Le grade dont on reprend les × ou les ÷ : le grade visé, ou le premier d'après qui a cette
 * opération (pas de division aux 10e et 9e kyū).
 */
export function gradeOperation(d, type) {
  const sys = systemeChoisi(d);
  const g0 = formatExamen(d).grade;
  return sys.grades.slice(sys.grades.indexOf(g0)).find((g) => g[type]) ?? null;
}

/**
 * Calculs « au format du kyū » : tirés dans des sujets d'examen du grade, donc avec ses
 * proportions exactes (si un 6 × 3 tombe dans 7 % des problèmes du sujet, il tombe dans 7 % des
 * calculs ici), ses zéros finaux, ses décimaux et ses arrondis.
 */
export function reserveKyu(g, type) {
  let pile = [];
  return () => {
    if (!pile.length) pile = genererSujet(g).sections.filter((x) => x.cle === type).flatMap((x) => x.problemes).sort(() => Math.random() - 0.5);
    return pile.pop();
  };
}


/**
 * Volume AU FORMAT du kyū visé, par semaine : colonnes de planche au format exact de son
 * mitorizan (mêmes chiffres, mêmes lignes) et × ÷ « au format du kyū », plus les épreuves et
 * examens blancs de ce grade. Aucune comparaison avec un volume « normal » : aucune source
 * sérieuse ne publie le volume des élèves japonais (voir AUDIT-PARCOURS-0.36.md).
 * @returns {{ grade: object, semaines: Array<{ semaine: string, colonnes: number, operations: number }> }}
 */
export function volumeAuFormat(d, date, nbSemaines = 6) {
  const f = formatExamen(d);
  const g = f.grade;
  const parSemaine = {};
  for (const s of d.sessions ?? []) {
    const r = s.reglages ?? {};
    let colonnes = 0;
    let operations = 0;
    if (s.module === 'planches' && r.chiffres === f.chiffres && r.lignes === f.lignes && (!r.pyramide || r.pyramide === 'non')) colonnes = s.total ?? 0;
    else if (s.module === 'muldiv' && r.format === 'kyu') operations = s.total ?? 0;
    else if (s.module === 'epreuves' && r.grade === g.id) colonnes = s.total ?? 0;
    if (!colonnes && !operations) continue;
    const k = semaineISO(s.date).cle;
    const x = (parSemaine[k] ??= { colonnes: 0, operations: 0 });
    x.colonnes += colonnes;
    x.operations += operations;
  }
  // Les nbSemaines dernières semaines, vides comprises, de la plus ancienne à la plus récente.
  const semaines = [];
  for (let i = nbSemaines - 1; i >= 0; i--) {
    const j = new Date(`${date}T12:00`);
    j.setDate(j.getDate() - 7 * i);
    const k = semaineISO(j.toISOString().slice(0, 10)).cle;
    semaines.push({ semaine: k, ...(parSemaine[k] ?? { colonnes: 0, operations: 0 }) });
  }
  return { grade: g, chiffres: f.chiffres, lignes: f.lignes, semaines };
}
