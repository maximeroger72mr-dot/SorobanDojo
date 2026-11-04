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
 *   reglages: { decouverte: false, objectifMinutes: 15 },
 *   avis:     [ messages à montrer une fois ],
 *   stats:    { suite, meilleureSuite }                       // réponses justes d'affilée
 *   succes:   { [idSucces]: 'AAAA-MM-JJ' },
 *   seance:   { debut, date, instantane } | null               // séance du jour en cours
 * }
 * hist : essais récents ; t = secondes par unité de travail (voir maitrise.js).
 * sem  : (motifs et paliers) temps des essais réussis par semaine { 'lundi AAAA-MM-JJ': [t…] },
 *        pour repérer les plateaux.
 */

import { nouvelleCarte, reviser, estDue } from './revision.js';
import { evaluer, ajouterEssai, ajouterSemaine, poidsEquilibre, NIVEAUX } from './maitrise.js';
import { succesObtenus, SUCCES } from './succes.js';
import { instantane, bilanSeance } from './bilan.js';
import { exporter, lireExport, fusionner } from './sauvegarde.js';

const VERSION = 2;
const CLE_LOCALE = 'soroban-progression';
/** Au-delà de ce seuil de « dette », un motif est considéré en difficulté. */
export const SEUIL_DIFFICULTE = 2;

const vide = () => ({
  version: VERSION, sessions: [], records: {}, motifs: {}, paliers: {}, reglages: { decouverte: false, objectifMinutes: 15, modeEspace: false }, avis: [],
  stats: { suite: 0, meilleureSuite: 0 }, succes: {}, seance: null,
});

// Écouteurs des succès débloqués (l'interface affiche une notification discrète).
const ecouteursSucces = new Set();
export function surSucces(fn) {
  ecouteursSucces.add(fn);
  return () => ecouteursSucces.delete(fn);
}

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
  // Succès déjà mérités avant leur apparition : datés aujourd'hui, sans notification.
  for (const id of succesObtenus(donnees, aujourdhui())) donnees.succes[id] ??= aujourdhui();
  return donnees;
}

async function sauver() {
  // Nouveaux succès ? On les date, puis on prévient l'interface.
  const nouveaux = succesObtenus(donnees, aujourdhui()).filter((id) => !donnees.succes[id]);
  for (const id of nouveaux) donnees.succes[id] = aujourdhui();
  await backend.ecrire(donnees);
  for (const id of nouveaux) ecouteursSucces.forEach((fn) => fn(SUCCES.find((x) => x.id === id)));
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
    ajouterSemaine(f, t, aujourdhui());
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
  if (t !== undefined && juste) ajouterSemaine(e, t, aujourdhui());
  await sauver();
}

/** Longueur de chaîne d'anzan atteinte dans une leçon (reprise à la prochaine séance). */
export async function memoriserChaine(id, lignes) {
  const e = palier(id);
  if (e.chaine === lignes) return;
  e.chaine = lignes;
  await sauver();
}

/**
 * Coupe-file de maîtrise : les 15 premiers exercices d'une leçon tous justes et rapides
 * (temps médian ≤ seuil « Acquis confirmé ») ouvrent le mini-test sans attendre le volume prévu.
 * @returns {boolean} true si le coupe-file vient d'être accordé
 */
export async function verifierCoupeFile(id, repetitions, famille) {
  const e = donnees.paliers[id];
  if (!e || e.coupeFile || e.valide || e.reps >= repetitions || (e.hist?.length ?? 0) < 15) return false;
  const quinze = e.hist.slice(0, 15);
  const t = quinze.map((x) => x.t).sort((a, b) => a - b)[7];
  const seuil = NIVEAUX.find((n) => n.id === 'confirme').temps[famille];
  if (!quinze.every((x) => x.ok) || t > seuil) return false;
  e.coupeFile = aujourdhui();
  await sauver();
  return true;
}

/** Mini-test réussi : sous-palier validé, carte de révision créée (J+1) sauf leçon de lecture. */
export async function validerPalier(id, avecRevision = true) {
  const e = palier(id);
  if (!e.valide) {
    e.valide = aujourdhui();
    e.carte = avecRevision ? nouvelleCarte(aujourdhui()) : null;
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

// ------------------------------------------------------------------ tables de multiplication

/** Note un produit de la table (temps en secondes). */
export async function noterProduit(cle, juste, t) {
  donnees.tables ??= {};
  const f = (donnees.tables[cle] ??= { essais: 0, erreurs: 0, hist: [] });
  f.essais += 1;
  if (!juste) f.erreurs += 1;
  ajouterEssai(f.hist, juste, t);
  await sauver();
}

export const statsTables = () => donnees.tables ?? {};

// ------------------------------------------------------------------ réponses d'affilée

/** Compte les réponses justes d'affilée (toutes activités confondues). */
export async function noterReponse(juste) {
  donnees.stats ??= { suite: 0, meilleureSuite: 0 };
  donnees.stats.suite = juste ? donnees.stats.suite + 1 : 0;
  donnees.stats.meilleureSuite = Math.max(donnees.stats.meilleureSuite, donnees.stats.suite);
  await sauver();
}

// ------------------------------------------------------------------ séance du jour

/** Séance en cours aujourd'hui (ou null). Une séance d'un autre jour est considérée finie. */
export function seanceEnCours() {
  const s = donnees.seance;
  return s && s.date === aujourdhui() ? s : null;
}

/** @param {object} [extra]  ce qui doit rester fixe toute la séance (ex. { priorite }) */
export async function commencerSeance(extra = {}) {
  donnees.seance = { debut: Date.now(), date: aujourdhui(), instantane: instantane(donnees, Object.keys(donnees.succes)), ...extra };
  await sauver();
  return donnees.seance;
}

/** Termine la séance et renvoie son bilan ; l'élève peut ensuite continuer librement. */
export async function finirSeance() {
  const s = donnees.seance;
  if (!s) return null;
  const bilan = bilanSeance(s.instantane, donnees, s.debut, Object.keys(donnees.succes));
  donnees.seance = null;
  await sauver();
  return bilan;
}

/** Minutes pratiquées aujourd'hui (toutes activités). */
export function minutesAujourdhui() {
  const j = aujourdhui();
  return donnees.sessions.filter((s) => s.date === j).reduce((t, s) => t + (s.dureeMs ?? 0), 0) / 60000;
}

/** Activités déjà faites aujourd'hui (modules et modes). */
export function faitAujourdhui(module, mode) {
  const j = aujourdhui();
  return donnees.sessions.some((s) => s.date === j && s.module === module && (mode === undefined || s.mode === mode));
}

// ------------------------------------------------------------------ export / import

export const exporterDonnees = () => exporter(donnees);

/**
 * Importe une sauvegarde (texte JSON).
 * @param {'remplacer'|'fusionner'} mode
 */
export async function importerDonnees(texte, mode) {
  let d = lireExport(texte);
  if (d.version < VERSION) d = migrer(d);
  if (d.version > VERSION) throw new Error('Cette sauvegarde vient d\'une version plus récente de l\'application : mettez-la à jour d\'abord.');
  const complet = { ...vide(), ...d, reglages: { ...vide().reglages, ...d.reglages } };
  donnees = mode === 'fusionner' ? fusionner(donnees, complet) : complet;
  donnees.reglages = mode === 'fusionner' ? donnees.reglages : complet.reglages;
  await sauver();
}
