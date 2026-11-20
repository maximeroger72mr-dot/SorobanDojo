/**
 * Bloc de vitesse du jour (0.38), à partir du 7e kyū (8e kyū passé) : UN seul bloc de vitesse
 * par séance, sur l'une des trois parties de l'examen — colonnes, × ou ÷.
 *  - Deux jours sur trois : la partie la plus loin de l'allure du grade visé (rapport entre le
 *    temps de l'élève et le temps à tenir ; une partie jamais mesurée passe en premier).
 *  - Le troisième : la rotation (colonnes, ×, ÷), pour qu'aucune partie ne soit oubliée.
 * Pour × et ÷ : une feuille chronométrée « au format du kyū » (hakari, 計り), tirée dans des
 * sujets d'examen du grade, dont la longueur suit le temps du bloc.
 * Avant, aucun × ni ÷ n'entrait dans les blocs quotidiens, alors qu'ils font 200 points sur 300
 * dès le 6e kyū.
 * Fonctions pures.
 */

import { systemeChoisi } from './epreuves.js';
import { kyuPasse } from './examen.js';
import { formatExamen } from './parcours.js';
import { allureGrade, vitesseEleve } from './allure.js';
import { gradeOperation } from './formatKyu.js';
import { evaluer, mediane } from './maitrise.js';
import { mesuresAuFormat, medianeRecente } from './mesures.js';
import { SOUS_PALIERS, familleLecon } from './curriculum.js';

export const PARTIES = ['colonnes', 'mul', 'div'];
export const NOMS_PARTIES = { colonnes: 'colonnes', mul: 'multiplications', div: 'divisions' };

/** Le bloc de vitesse par partie commence une fois le 8e kyū passé (on prépare le 7e). */
export function hakariActif(d) {
  const sys = systemeChoisi(d);
  const g8 = sys.grades.find((g) => g.id === '8');
  return !!g8 && kyuPasse(d, sys, g8);
}

/**
 * Temps de l'élève par produit, pour × ou pour ÷ : la médiane des 5 dernières feuilles « au format
 * du kyū » (mesure enregistrée avec la séance), à défaut ses leçons de ce type.
 */
export function tempsOperation(d, type) {
  // 0.39 : les mesures au format du kyū (hakari, marches) d'abord.
  const g = formatExamen(d).grade;
  const m = medianeRecente(mesuresAuFormat(d, type, null, g?.[type]?.total));
  if (m !== null) return m;
  const feuilles = d.sessions.filter((s) => s.module === 'muldiv' && s.mode === type && s.reglages?.format === 'kyu' && Number.isFinite(s.t)).slice(-5).map((s) => s.t);
  if (feuilles.length >= 2) return mediane(feuilles);
  const lecons = SOUS_PALIERS.filter((sp) => !sp.mental && sp.type === type && familleLecon(sp) === 'muldiv')
    .map((sp) => evaluer(d.paliers?.[sp.id]?.hist ?? [], 'muldiv').temps).filter((t) => t !== null);
  return lecons.length ? mediane(lecons) : null;
}

/**
 * Retard de chaque partie sur l'allure du grade visé : temps de l'élève / temps à tenir (> 1 :
 * trop lent). Une partie sans mesure vaut Infinity (à mesurer d'abord). Le ÷ n'existe qu'à
 * partir du grade qui en a.
 * @returns {Array<{ partie, ratio, eleve, besoin }>}  du plus en retard au moins
 */
export function retardParties(d) {
  const g = formatExamen(d).grade;
  const a = allureGrade(g);
  // 0.39 : la vitesse en colonnes AU FORMAT du grade visé (les gestes isolés en secours, à confirmer).
  const v = vitesseEleve(d, g);
  const res = [{ partie: 'colonnes', eleve: v.parChiffre, besoin: a.parChiffre, aConfirmer: v.parChiffre != null && !v.colonnesAuFormat }];
  for (const type of ['mul', 'div']) if (gradeOperation(d, type)) res.push({ partie: type, eleve: tempsOperation(d, type), besoin: a.parProduit });
  return res.map((x) => ({ ...x, ratio: x.eleve == null ? Infinity : x.eleve / x.besoin })).sort((x, y) => y.ratio - x.ratio);
}

/**
 * La partie du jour. `n` : nombre de jours pratiqués avant aujourd'hui (le rythme suit les jours
 * de pratique, pas le calendrier).
 */
export function partieDuJour(d, date) {
  const n = new Set(d.sessions.filter((s) => s.date < date).map((s) => s.date)).size;
  const dispo = retardParties(d);
  if (n % 3 === 2) {
    const tour = PARTIES.filter((p) => dispo.some((x) => x.partie === p));
    return { partie: tour[Math.floor(n / 3) % tour.length], raison: 'rotation' };
  }
  return { partie: dispo[0].partie, raison: 'retard', ...dispo[0] };
}

/** Nombre de calculs d'une feuille de × ou de ÷ qui tient en `minutes`, à la vitesse de l'élève. */
export function calculsHakari(d, type, minutes, unitesParCalcul = 4) {
  const t = tempsOperation(d, type) ?? 4;
  return Math.max(5, Math.min(30, Math.round((minutes * 60) / (unitesParCalcul * t + 4))));
}
