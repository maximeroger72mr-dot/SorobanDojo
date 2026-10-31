/**
 * Suivi de progression, sauvegardé localement.
 *
 * Dans l'application Electron, les données vont dans un fichier JSON (voir main.cjs).
 * Ouverte dans un simple navigateur (développement), l'appli se rabat sur localStorage.
 *
 * Structure des données (version 1) :
 * {
 *   version: 1,
 *   lecons:   { [idLecon]: { terminee: true, date: 'AAAA-MM-JJ' } },
 *   sessions: [ { date, module, mode, reglages, total, justes, dureeMs, erreurs: [...] } ],
 *   records:  { [cleDefi]: { dureeMs, date } },
 *   motifs:   { [cleMotif]: { essais, erreurs, dette } },     // diagnostic des faiblesses
 *   paliers:  { [idSousPalier]: { reps, justes, valide, carte: { boite, echeance } } },
 *   records:  aussi utilisés par les drills, défis et planches (clé → meilleur temps)
 *   reglages: { decouverte: false }
 * }
 */

import { nouvelleCarte, reviser, estDue } from './revision.js';

/** Au-delà de ce seuil de « dette », un motif est considéré en difficulté. */
export const SEUIL_DIFFICULTE = 2;

const VERSION = 1;
const CLE_LOCALE = 'soroban-progression';

const vide = () => ({
  version: VERSION, lecons: {}, sessions: [], records: {}, motifs: {}, paliers: {}, reglages: { decouverte: false },
});

let donnees = vide();

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function aujourdhui(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const backend = typeof window !== 'undefined' && window.stockage
  ? window.stockage
  : {
    lire: async () => JSON.parse(globalThis.localStorage?.getItem(CLE_LOCALE) ?? 'null'),
    ecrire: async (d) => globalThis.localStorage?.setItem(CLE_LOCALE, JSON.stringify(d)),
  };

/** À appeler une fois au démarrage. */
export async function chargerProgression() {
  const lu = await backend.lire();
  donnees = lu && lu.version === VERSION ? { ...vide(), ...lu, reglages: { ...vide().reglages, ...lu.reglages } } : vide();
  return donnees;
}

async function sauver() {
  await backend.ecrire(donnees);
}

export function progression() {
  return donnees;
}

/**
 * Enregistre une série d'exercices terminée.
 * @param {{module:string, mode?:string, reglages?:object, total:number, justes:number, dureeMs:number, erreurs?:Array}} s
 */
export async function enregistrerSession(s) {
  donnees.sessions.push({ date: aujourdhui(), horodatage: Date.now(), ...s });
  await sauver();
}

export async function marquerLecon(id) {
  donnees.lecons[id] = { terminee: true, date: aujourdhui() };
  await sauver();
}

/** Enregistre un temps si c'est un record ; renvoie true si nouveau record. */
export async function proposerRecord(cle, dureeMs) {
  const actuel = donnees.records[cle];
  if (actuel && actuel.dureeMs <= dureeMs) return false;
  donnees.records[cle] = { dureeMs, date: aujourdhui() };
  await sauver();
  return true;
}

/** Statistiques agrégées, par module et par jour. */
export function statistiques() {
  const parModule = {};
  const parJour = {};
  for (const s of donnees.sessions) {
    for (const [cle, table] of [[s.module, parModule], [s.date, parJour]]) {
      const t = (table[cle] ??= { sessions: 0, total: 0, justes: 0, dureeMs: 0 });
      t.sessions += 1;
      t.total += s.total;
      t.justes += s.justes;
      t.dureeMs += s.dureeMs;
    }
  }
  return { parModule, parJour };
}

// ------------------------------------------------------------------ diagnostic par motif

/**
 * Enregistre le résultat d'un exercice pour chacun de ses motifs.
 * La « dette » d'un motif monte de 1 à chaque erreur et baisse de 0,5 à chaque réussite :
 * un motif raté plus de 2 fois (dette > 2) reste signalé tant qu'il n'a pas été réussi plusieurs fois.
 * @param {string[]} motifsReussis  motifs de l'exercice exécutés sans erreur
 * @param {string[]} motifsRates    motifs sur lesquels l'élève s'est trompé
 */
export async function noterMotifs(motifsReussis, motifsRates) {
  const fiche = (c) => (donnees.motifs[c] ??= { essais: 0, erreurs: 0, dette: 0 });
  for (const c of new Set(motifsReussis)) {
    const f = fiche(c);
    f.essais += 1;
    f.dette = Math.max(0, f.dette - 0.5);
  }
  for (const c of new Set(motifsRates)) {
    const f = fiche(c);
    f.essais += 1;
    f.erreurs += 1;
    f.dette += 1;
  }
  await sauver();
}

/** Motifs actuellement en difficulté, du plus problématique au moins. */
export function motifsEnDifficulte() {
  return Object.entries(donnees.motifs)
    .filter(([, f]) => f.dette > SEUIL_DIFFICULTE)
    .sort(([, a], [, b]) => b.dette - a.dette)
    .map(([cle, f]) => ({ cle, ...f }));
}

/** Poids de tirage : un motif en difficulté apparaît 4 fois plus souvent. */
export function poidsAdaptatifs() {
  const poids = {};
  for (const { cle } of motifsEnDifficulte()) poids[cle] = 4;
  return poids;
}

// ------------------------------------------------------------------ paliers et révisions

export function etatPalier(id) {
  return donnees.paliers[id] ?? { reps: 0, justes: 0, valide: null, carte: null };
}

export async function compterRepetition(id, juste) {
  const e = (donnees.paliers[id] ??= { reps: 0, justes: 0, valide: null, carte: null });
  e.reps += 1;
  if (juste) e.justes += 1;
  await sauver();
}

/** Mini-test réussi : sous-palier validé, carte de révision créée (J+1). */
export async function validerPalier(id) {
  const e = (donnees.paliers[id] ??= { reps: 0, justes: 0, valide: null, carte: null });
  if (!e.valide) {
    e.valide = aujourdhui();
    e.carte = nouvelleCarte(aujourdhui());
  }
  await sauver();
}

/** Résultat d'un test flash de révision. */
export async function enregistrerRevision(id, reussi) {
  const e = donnees.paliers[id];
  if (!e?.carte) return;
  e.carte = reviser(e.carte, reussi, aujourdhui());
  await sauver();
}

/** Identifiants des sous-paliers dont la révision est due aujourd'hui (ou en retard). */
export function revisionsDues() {
  const j = aujourdhui();
  return Object.entries(donnees.paliers).filter(([, e]) => estDue(e.carte, j)).map(([id]) => id);
}

export function reglagesUtilisateur() {
  return donnees.reglages;
}

export async function modifierReglages(r) {
  Object.assign(donnees.reglages, r);
  await sauver();
}

/** Enregistre un score si c'est le meilleur (plus haut = mieux) ; renvoie true si nouveau record. */
export async function proposerMeilleurScore(cle, points, extra = {}) {
  const actuel = donnees.records[cle];
  if (actuel && actuel.points >= points) return false;
  donnees.records[cle] = { points, date: aujourdhui(), ...extra };
  await sauver();
  return true;
}
