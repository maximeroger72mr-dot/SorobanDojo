/**
 * Le mode entretien (0.39) : une fois les leçons finies, ce qu'on travaille chaque jour.
 *
 *  - Les matières tournent SÉANCE PAR SÉANCE (jour pratiqué, pas jour de la semaine) : colonnes,
 *    ×, ÷, anzan et flash (et le denpyōzan en Zenkoren, quand le grade l'a). Une séance sur deux
 *    va à la matière la plus en retard sur l'allure visée. La durée suit l'objectif du jour.
 *  - Après le 1er kyū, les colonnes d'entretien prennent le format des dan : colonnes mêlées de 5
 *    à 10 chiffres.
 *  - Maintien pur (plus de grade ni de dan à viser) : chaque semaine, l'examen complet (vendredi
 *    au dimanche), et, les autres jours, à tour de rôle : des sprints sur la matière la plus faible,
 *    le rejeu d'une planche pour battre son record, et le flash anzan.
 * Fonctions pures.
 */

import { grade as gradeDe, formatExamen } from './parcours.js';
import { systemeChoisi } from './epreuves.js';
import { retardParties } from './hakari.js';
import { prochainDan } from './dan.js';
import { prochainNiveau, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN } from './danZenkoren.js';
import { semaineISO } from './hasard.js';

export const NOMS_MATIERES = { colonnes: 'colonnes', mul: 'multiplications', div: 'divisions', anzan: 'anzan et flash', denpyo: 'denpyōzan' };

/** Jours pratiqués avant `date` (le rythme suit les séances, pas le calendrier). */
const joursPratiques = (d, date) => new Set(d.sessions.filter((s) => s.date < date).map((s) => s.date)).size;

/** Les matières de l'entretien, dans l'ordre de la rotation. */
export function matieresEntretien(d) {
  const g = formatExamen(d).grade;
  const zen = systemeChoisi(d).id === 'zenkoren';
  return ['colonnes', ...(g?.mul ? ['mul'] : []), ...(g?.div ? ['div'] : []), 'anzan', ...(zen && g?.options?.denpyo ? ['denpyo'] : [])];
}

/** Plus de grade ni de dan à viser : le maintien pur. */
export function maintienPur(d) {
  const gr = gradeDe(d);
  if (gr.prochain || !gr.obtenu) return false;
  const zen = systemeChoisi(d).id === 'zenkoren';
  return !(zen ? prochainNiveau(d, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN) : prochainDan(d));
}

/**
 * La matière de la séance : une séance sur deux, la plus en retard sur l'allure (quand l'une l'est) ;
 * sinon, la suivante de la rotation.
 * @returns {{ matiere: string, raison: 'retard'|'rotation', ratio?: number }}
 */
export function matiereEntretien(d, date) {
  const n = joursPratiques(d, date);
  const liste = matieresEntretien(d);
  if (n % 2 === 1) {
    const r = retardParties(d).find((x) => liste.includes(x.partie));
    if (r && r.ratio > 1) return { matiere: r.partie, raison: 'retard', ratio: r.ratio };
  }
  return { matiere: liste[Math.floor(n / 2) % liste.length], raison: 'rotation' };
}

/**
 * Maintien pur : l'activité du jour hors du créneau d'examen, à tour de rôle dans la semaine
 * (jours pratiqués de la semaine) : sprints sur la matière la plus faible, rejeu de planche, flash.
 */
export const ACTIVITES_MAINTIEN = ['sprints', 'rejeu', 'flash'];
export function activiteMaintien(d, date) {
  const semaine = semaineISO(date).cle;
  const k = new Set(d.sessions.filter((s) => s.date < date && semaineISO(s.date).cle === semaine).map((s) => s.date)).size;
  const faible = retardParties(d)[0]?.partie ?? 'colonnes';
  return { activite: ACTIVITES_MAINTIEN[k % ACTIVITES_MAINTIEN.length], faible };
}
