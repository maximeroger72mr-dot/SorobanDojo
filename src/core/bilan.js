/**
 * Bilan de séance : ce qui a changé entre le début et la fin de la séance.
 * La séance commence par un « instantané » des niveaux, records et succès ; à la fin on compare.
 */

import { evaluer, NIVEAUX } from './maitrise.js';
import { nomMotif } from './motifs.js';
import { SOUS_PALIERS, familleLecon, evaluerLecon } from './curriculum.js';

/** Instantané pris au début de la séance. */
export function instantane(d, succes) {
  return {
    gestes: Object.fromEntries(Object.entries(d.motifs).map(([k, f]) => [k, evaluer(f.hist ?? []).index])),
    lecons: Object.fromEntries(Object.entries(d.paliers).map(([k, e]) => {
      const sp = SOUS_PALIERS.find((s) => s.id === k);
      return [k, { niveau: sp ? evaluerLecon(e.hist ?? [], sp).index : 0, valide: !!e.valide }];
    })),
    records: JSON.parse(JSON.stringify(d.records)),
    succes: [...succes],
  };
}

/**
 * @param {object} avant  instantané du début
 * @param {object} d      données actuelles
 * @param {number} debut  horodatage du début
 * @param {string[]} succes  succès obtenus maintenant
 */
export function bilanSeance(avant, d, debut, succes) {
  const sessions = d.sessions.filter((s) => (s.horodatage ?? 0) >= debut);
  const exercices = sessions.reduce((s, x) => s + (x.total ?? 0), 0);
  const justes = sessions.reduce((s, x) => s + (x.justes ?? 0), 0);
  const dureeMs = sessions.reduce((s, x) => s + (x.dureeMs ?? 0), 0);
  const progres = [];
  for (const [k, f] of Object.entries(d.motifs)) {
    const i = evaluer(f.hist ?? []).index;
    if (i > (avant.gestes[k] ?? 0) && i >= 2) progres.push(`${nomMotif(k)} : ${NIVEAUX[i].nom}`);
  }
  for (const [k, e] of Object.entries(d.paliers)) {
    const sp = SOUS_PALIERS.find((s) => s.id === k);
    if (!sp) continue;
    if (e.valide && !avant.lecons[k]?.valide) progres.push(`Leçon validée : ${sp.titre}`);
    const i = evaluerLecon(e.hist ?? [], sp).index;
    if (i > (avant.lecons[k]?.niveau ?? 0) && i >= 2) progres.push(`${sp.titre} : ${NIVEAUX[i].nom}`);
  }
  const records = Object.keys(d.records).filter((k) => JSON.stringify(d.records[k]) !== JSON.stringify(avant.records[k]));
  const nouveauxSucces = succes.filter((s) => !avant.succes.includes(s));
  return { exercices, justes, dureeMs, progres, records, nouveauxSucces };
}

const jourMs = (x) => new Date(`${x}T12:00`).getTime();
const moinsJours = (date, n) => { const t = new Date(`${date}T12:00`); t.setDate(t.getDate() - n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const medianeDe = (ts) => { const t = [...ts].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : null; };

/**
 * Bilan hebdomadaire, sur les 7 derniers jours (aujourd'hui compris), comparés aux 7 d'avant :
 *  - la pratique (jours, minutes, exercices, réussite) ;
 *  - ce qui est passé en or : gestes au niveau confirmé dont aucune semaine précédente n'avait
 *    la vitesse de l'or, et leçons validées dans la semaine ;
 *  - ce qui stagne (plateaux fournis par l'appelant, voir parcours.plateaux).
 * Fonction pure.
 * @param {Array<{nom: string}>} stagne  plateaux du moment
 */
export function bilanHebdo(d, date, stagne = []) {
  const debut = moinsJours(date, 6);
  const avantDebut = moinsJours(date, 13);
  const somme = (liste) => ({
    jours: new Set(liste.map((s) => s.date)).size,
    minutes: Math.round(liste.reduce((t, s) => t + (s.dureeMs ?? 0), 0) / 60000),
    exercices: liste.reduce((t, s) => t + (s.total ?? 0), 0),
    justes: liste.reduce((t, s) => t + (s.justes ?? 0), 0),
  });
  const semaine = somme(d.sessions.filter((s) => s.date >= debut && s.date <= date));
  const precedente = somme(d.sessions.filter((s) => s.date >= avantDebut && s.date < debut));
  const tOr = NIVEAUX[3].temps.addsub;
  const enOr = [];
  for (const [k, f] of Object.entries(d.motifs ?? {})) {
    if (evaluer(f.hist ?? []).index < 3) continue;
    const sem = Object.entries(f.sem ?? {});
    // Mesuré cette semaine (la semaine du lundi peut avoir commencé jusqu'à 6 jours avant `debut`).
    const recentes = sem.filter(([lundi]) => jourMs(lundi) >= jourMs(debut) - 6 * 86400000);
    const anciennes = sem.filter(([lundi]) => jourMs(lundi) < jourMs(debut) - 6 * 86400000);
    if (recentes.length && !anciennes.some(([, ts]) => ts.length >= 5 && medianeDe(ts) <= tOr)) enOr.push(nomMotif(k));
  }
  const validees = SOUS_PALIERS.filter((sp) => { const v = d.paliers[sp.id]?.valide; return v && v >= debut && v <= date; }).map((sp) => sp.titre);
  return { debut, semaine, precedente, enOr, validees, stagne: stagne.map((p) => p.nom) };
}
