/**
 * Suivi de progression, sauvegardé localement.
 *
 * Dans l'application Electron, les données vont dans un fichier JSON (voir main.cjs).
 * Ouverte dans un navigateur (Soroban.html), l'appli se rabat sur localStorage.
 *
 * Structure des données (version 2) :
 * {
 *   version: 2,
 *   sessions: [ { date, module, mode, reglages, total, justes, dureeMs } ],
 *   records:  { [cle]: { dureeMs | points, date } }        // drills, défis, planches, épreuves
 *   motifs:   { [cleMotif]: { essais, erreurs, dette, hist: [{ ok, t }] } }   // par geste
 *   paliers:  { [idSousPalier]: { reps, justes, valide, carte: { boite, echeance }, hist: [{ ok, t }] } },
 *   reglages: { decouverte: false },
 *   avis:     [ messages à montrer une fois ]
 * }
 * hist : essais récents ; t = secondes par unité de travail (voir maitrise.js).
 */

import { nouvelleCarte, reviser, estDue } from './revision.js';
import { evaluer, ajouterEssai, poidsEquilibre } from './maitrise.js';

const VERSION = 2;
const CLE_LOCALE = 'soroban-progression';
/** Au-delà de ce seuil de « dette », un motif est considéré en difficulté. */
export const SEUIL_DIFFICULTE = 2;

const vide = () => ({
  version: VERSION, sessions: [], records: {}, motifs: {}, paliers: {}, reglages: { decouverte: false }, avis: [],
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

/** Met à jour d'anciennes données vers la version actuelle. */
function migrer(lu) {
  if (lu.version === 1) {
    // La v1 attribuait une erreur à tous les amis d'une colonne fausse : diagnostic faussé.
    lu.motifs = {};
    lu.version = 2;
    lu.avis = [...(lu.avis ?? []), 'Le diagnostic des gestes a été remis à zéro : l\'ancienne version attribuait une erreur à tous les amis d\'une colonne fausse, même ceux qui n\'étaient pas en cause. Vos leçons, révisions et records sont conservés.'];
  }
  return lu;
}

/** À appeler une fois au démarrage. */
export async function chargerProgression() {
  let lu = await backend.lire();
  if (lu && lu.version < VERSION) {
    lu = migrer(lu);
    donnees = { ...vide(), ...lu };
    await sauver();
  }
  donnees = lu && lu.version === VERSION ? { ...vide(), ...lu, reglages: { ...vide().reglages, ...lu.reglages } } : vide();
  return donnees;
}

async function sauver() {
  await backend.ecrire(donnees);
}

export function progression() {
  return donnees;
}

/** Messages à montrer une seule fois (puis effacés). */
export async function prendreAvis() {
  const a = donnees.avis ?? [];
  if (a.length) { donnees.avis = []; await sauver(); }
  return a;
}

// ------------------------------------------------------------------ séances et records

export async function enregistrerSession(s) {
  donnees.sessions.push({ date: aujourdhui(), horodatage: Date.now(), ...s });
  await sauver();
}

/** Enregistre un temps si c'est un record (plus court = mieux) ; renvoie true si nouveau record. */
export async function proposerRecord(cle, dureeMs) {
  const actuel = donnees.records[cle];
  if (actuel && actuel.dureeMs <= dureeMs) return false;
  donnees.records[cle] = { dureeMs, date: aujourdhui() };
  await sauver();
  return true;
}

/** Enregistre un score si c'est le meilleur (plus haut = mieux) ; renvoie true si nouveau record. */
export async function proposerMeilleurScore(cle, points, extra = {}) {
  const actuel = donnees.records[cle];
  if (actuel && actuel.points >= points) return false;
  donnees.records[cle] = { points, date: aujourdhui(), ...extra };
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

// ------------------------------------------------------------------ gestes (motifs)

const fiche = (c) => (donnees.motifs[c] ??= { essais: 0, erreurs: 0, dette: 0, hist: [] });

/**
 * Enregistre les gestes d'un exercice.
 * @param {string[]} reussis  occurrences réussies (un même motif peut apparaître plusieurs fois)
 * @param {string[]} rates    motifs RÉELLEMENT mis en cause (localisés), une fois chacun
 * @param {number} t          secondes par unité de l'exercice (vitesse)
 */
export async function noterGestes(reussis, rates, t) {
  for (const c of reussis) {
    const f = fiche(c);
    f.essais += 1;
    f.dette = Math.max(0, f.dette - 0.5);
    ajouterEssai(f.hist, true, t);
  }
  for (const c of new Set(rates)) {
    const f = fiche(c);
    f.essais += 1;
    f.erreurs += 1;
    f.dette += 1;
    ajouterEssai(f.hist, false, t);
  }
  await sauver();
}

/** Motifs actuellement en difficulté (erreurs avérées récentes), du plus problématique au moins. */
export function motifsEnDifficulte() {
  return Object.entries(donnees.motifs)
    .filter(([, f]) => f.dette > SEUIL_DIFFICULTE)
    .sort(([, a], [, b]) => b.dette - a.dette)
    .map(([cle, f]) => ({ cle, ...f }));
}

export const evaluerMotif = (cle) => evaluer(donnees.motifs[cle]?.hist ?? [], 'addsub');

/** Poids de tirage : équilibrage des fréquences + remédiation des motifs en difficulté. */
export function poidsAdaptatifs(cibles = []) {
  return poidsEquilibre(cibles, (c) => donnees.motifs[c], SEUIL_DIFFICULTE);
}

// ------------------------------------------------------------------ paliers et révisions

const palier = (id) => (donnees.paliers[id] ??= { reps: 0, justes: 0, valide: null, carte: null, hist: [] });

export function etatPalier(id) {
  return donnees.paliers[id] ?? { reps: 0, justes: 0, valide: null, carte: null, hist: [] };
}

export const evaluerPalier = (id, famille) => evaluer(etatPalier(id).hist ?? [], famille);

export async function compterRepetition(id, juste, t) {
  const e = palier(id);
  e.reps += 1;
  if (juste) e.justes += 1;
  e.hist ??= [];
  if (t !== undefined) ajouterEssai(e.hist, juste, t);
  await sauver();
}

/** Mini-test réussi : sous-palier validé, carte de révision créée (J+1). */
export async function validerPalier(id) {
  const e = palier(id);
  if (!e.valide) {
    e.valide = aujourdhui();
    e.carte = nouvelleCarte(aujourdhui());
  }
  await sauver();
}

export async function enregistrerRevision(id, reussi) {
  const e = donnees.paliers[id];
  if (!e?.carte) return;
  e.carte = reviser(e.carte, reussi, aujourdhui());
  await sauver();
}

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

/** Remet à zéro le diagnostic des gestes (sans toucher aux leçons ni aux records). */
export async function reinitialiserGestes() {
  donnees.motifs = {};
  await sauver();
}
