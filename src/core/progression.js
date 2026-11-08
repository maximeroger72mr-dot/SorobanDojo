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
 *   drills:   { [idDrill]: { validations, valide } }       // parcours des drills (2 passages sous bronze)
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

import { nouvelleCarte, reviser, estDue, ajouterJours } from './revision.js';
import { evaluer, ajouterEssai, ajouterSemaine, poidsEquilibre, NIVEAUX } from './maitrise.js';
import { succesObtenus, SUCCES } from './succes.js';
import { instantane, bilanSeance } from './bilan.js';
import { exporter, lireExport, fusionner } from './sauvegarde.js';
import { VERSION_APPLI, comparerVersions } from './version.js';

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

/** Version navigateur (Soroban.html) : pas de copie automatique, tout est dans le navigateur. */
export const versionNavigateur = !(typeof window !== 'undefined' && window.stockage);

const backend = !versionNavigateur
  ? window.stockage
  : {
    lire: async () => {
      const brut = globalThis.localStorage?.getItem(CLE_LOCALE) ?? null; // peut lever : stockage bloqué
      if (brut === null) return null;
      try {
        return JSON.parse(brut);
      } catch {
        // Sauvegarde illisible : on la met de côté (jamais écrasée), puis on repart de zéro.
        const nom = `${CLE_LOCALE}-illisible-${Date.now()}`;
        try { globalThis.localStorage.setItem(nom, brut); } catch { /* quota : tant pis, l'original reste lisible à la main */ }
        return { illisible: nom };
      }
    },
    ecrire: async (d) => { globalThis.localStorage?.setItem(CLE_LOCALE, JSON.stringify(d)); return true; },
  };

/**
 * État du stockage, affiché par l'interface quand il y a un problème :
 *   ok | lecture-seule (sauvegarde d'une version plus récente : on n'écrit RIEN)
 *   | indisponible (le navigateur bloque le stockage) | echec (le dernier enregistrement a échoué)
 */
let etatStockage = { etat: 'ok' };
const ecouteursStockage = new Set();
export const stockage = () => etatStockage;
export function surStockage(fn) {
  ecouteursStockage.add(fn);
  return () => ecouteursStockage.delete(fn);
}
function changerEtat(e) {
  const avant = etatStockage.etat;
  etatStockage = e;
  if (avant !== e.etat || e.etat !== 'ok') ecouteursStockage.forEach((fn) => fn(e));
}

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

/** Complète des données lues avec les champs par défaut. */
const completer = (lu) => ({ ...vide(), ...lu, reglages: { ...vide().reglages, ...lu.reglages } });

/**
 * À appeler une fois au démarrage. Ne lève jamais : en cas de problème, l'état du stockage
 * (stockage()) le dit, et rien n'est écrasé.
 */
export async function chargerProgression() {
  let lu;
  try {
    lu = await backend.lire();
  } catch {
    donnees = vide();
    changerEtat({ etat: 'indisponible' });
    return donnees;
  }
  if (lu?.illisible) {
    donnees = vide();
    donnees.avis.push(`Votre sauvegarde était illisible (fichier abîmé). Elle a été mise de côté sans être effacée (${lu.illisible}) ; l'application repart de zéro. Si vous avez un export récent, importez-le dans Progression → Sauvegarde.`);
    lu = null;
  } else if (lu && lu.version > VERSION) {
    // Sauvegarde faite par une version plus récente : surtout ne rien écraser.
    donnees = vide();
    changerEtat({ etat: 'lecture-seule', brut: lu });
    return donnees;
  } else if (lu && lu.version < VERSION) {
    donnees = completer(migrer(lu));
  } else if (lu) {
    donnees = completer(lu);
  } else {
    donnees = vide();
  }
  // Ancienne copie de l'application ouverte sur des données déjà utilisées par une plus récente.
  if (comparerVersions(donnees.appli, VERSION_APPLI) > 0) {
    changerEtat({ etat: 'ancienne-copie', appli: donnees.appli });
  }
  // Succès déjà mérités avant leur apparition : datés aujourd'hui, sans notification.
  for (const id of succesObtenus(donnees, aujourdhui())) donnees.succes[id] ??= aujourdhui();
  if (lu && lu.version < VERSION) await sauver();
  return donnees;
}

// Écouteurs « les données ont changé » (ex. la barre de séance se met à jour après un exercice).
const ecouteursChangement = new Set();
export function surChangement(fn) {
  ecouteursChangement.add(fn);
  return () => ecouteursChangement.delete(fn);
}

async function sauver() {
  if (etatStockage.etat === 'lecture-seule') return;
  // Nouveaux succès ? On les date, puis on prévient l'interface.
  const nouveaux = succesObtenus(donnees, aujourdhui()).filter((id) => !donnees.succes[id]);
  for (const id of nouveaux) donnees.succes[id] = aujourdhui();
  // Version la plus récente qui a écrit ces données (jamais redescendue).
  if (comparerVersions(donnees.appli, VERSION_APPLI) < 0) donnees.appli = VERSION_APPLI;
  try {
    const ok = await backend.ecrire(donnees);
    if (ok === false) throw new Error('écriture refusée');
    if (etatStockage.etat === 'echec' || etatStockage.etat === 'indisponible') changerEtat({ etat: 'ok' });
  } catch (e) {
    changerEtat({ etat: 'echec', message: e?.message ?? String(e) });
  }
  for (const id of nouveaux) ecouteursSucces.forEach((fn) => fn(SUCCES.find((x) => x.id === id)));
  ecouteursChangement.forEach((fn) => fn());
}

/**
 * Un autre onglet a enregistré (version navigateur) : on reprend ses données, pour ne pas
 * les écraser au prochain enregistrement.
 */
export function rechargerDepuis(texte) {
  try {
    const lu = JSON.parse(texte);
    if (lu && lu.version === VERSION) donnees = completer(lu);
    return true;
  } catch {
    return false;
  }
}
export const CLE_STOCKAGE = CLE_LOCALE;

/** Efface TOUTE la progression (après double confirmation dans l'interface). */
export async function toutEffacer() {
  donnees = vide();
  await sauver();
}

/** Note la date du dernier export (rappel d'export dans la version navigateur). */
export async function noterExport() {
  donnees.dernierExport = aujourdhui();
  await sauver();
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
/** Fenêtre (jours) dans laquelle deux erreurs probables sur un même geste le confirment. */
export const FENETRE_SOUPCON = 10;

/**
 * Note les gestes d'un exercice.
 *  - reussis : chaque geste est crédité d'un essai juste ;
 *  - rates   : gestes accusés. Par défaut c'est une DÉDUCTION (l'écart du résultat) : elle n'est
 *    d'abord qu'un « soupçon » daté, sans effet sur le niveau ; un 2e soupçon sur le même geste
 *    dans les 10 jours la confirme. Avec { confirme: true } (l'élève a désigné la ligne fautive
 *    avec les sous-totaux), l'erreur compte tout de suite.
 * @returns {Array<{cle, statut: 'soupcon'|'confirme'}>}
 */
export async function noterGestes(reussis, rates, t, { confirme = false } = {}) {
  // Vitesse « isolée » : mesurée dans une colonne où le geste n'a pour voisins que des gestes de
  // sa famille (colonne de gestes directs seuls, ou colonne dont tous les amis sont de la même
  // famille). Sert à vérifier une vitesse incohérente (voir parcours.verificationVitesse).
  const familleDe = (c) => (c.startsWith('cascade') ? 'cascade' : c.split(':')[1]);
  const amis = new Set(reussis.map(familleDe).filter((f) => f !== 'direct'));
  const familleColonne = amis.size === 0 ? 'direct' : amis.size === 1 ? [...amis][0] : null;
  if (t != null && reussis.length && familleColonne) {
    const v = ((donnees.vitesseFamilles ??= {})[familleColonne] ??= []);
    v.push(Math.round(t * 100) / 100);
    if (v.length > 40) v.shift();
  }
  for (const c of reussis) {
    const f = fiche(c);
    f.essais += 1;
    f.dette = Math.max(0, f.dette - 0.5);
    ajouterEssai(f.hist, true, t);
    ajouterSemaine(f, t, aujourdhui());
    if (t != null && familleColonne === familleDe(c)) {
      (f.isole ??= []).push(Math.round(t * 100) / 100);
      if (f.isole.length > 40) f.isole.shift();
    }
  }
  const bilan = [];
  const limite = ajouterJours(aujourdhui(), -FENETRE_SOUPCON);
  for (const c of new Set(rates)) {
    const f = fiche(c);
    f.soupcons = (f.soupcons ?? []).filter((x) => x > limite);
    if (!confirme && !f.soupcons.length) {
      f.soupcons.push(aujourdhui());
      bilan.push({ cle: c, statut: 'soupcon' });
      continue;
    }
    f.soupcons = [];
    f.essais += 1;
    f.erreurs += 1;
    f.dette += 1;
    ajouterEssai(f.hist, false, t);
    bilan.push({ cle: c, statut: 'confirme' });
  }
  await sauver();
  return bilan;
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
/** Durée d'affichage de la photo du soroban (secondes) atteinte dans une leçon « photo ». */
export async function memoriserDureePhoto(id, s) {
  const e = palier(id);
  if (e.dureePhoto === s) return;
  e.dureePhoto = s;
  await sauver();
}

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

// ------------------------------------------------------------------ drills (parcours et validation)

/** État d'un drill : nombre de passages validés (justes et sous le temps bronze). */
export const etatDrill = (id) => donnees.drills?.[id] ?? { validations: 0 };

/** Un passage juste et sous le temps bronze compte pour la validation du drill. */
export async function noterDrill(id) {
  donnees.drills ??= {};
  const e = (donnees.drills[id] ??= { validations: 0 });
  e.validations += 1;
  if (e.validations === 2) e.valide = aujourdhui();
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

/**
 * Calcul encore anormalement lent quand il revient : le geste le plus fragile de la colonne
 * (le plus lent, ou le moins sûr) est tiré un peu plus souvent ensuite (sa « dette » augmente de
 * 0,5 ; elle redescend à chaque réussite). Rien n'est affiché : c'est un réglage discret.
 */
export async function signalerLenteur(ex) {
  const amis = [...new Set(ex.motifs ?? [])].filter((c) => !c.endsWith(':direct') && donnees.motifs[c]);
  if (!amis.length) return;
  const ev = (c) => evaluer(donnees.motifs[c].hist ?? [], 'addsub');
  const fragile = amis.sort((a, b) => (ev(b).temps ?? 0) * (2 - ev(b).reussite) - (ev(a).temps ?? 0) * (2 - ev(a).reussite))[0];
  donnees.motifs[fragile].dette += 0.5;
  await sauver();
}

// ------------------------------------------------------------------ historique des feuilles

/**
 * Garde le résultat d'une feuille (temps par chiffre, réussite) dans son TYPE (même nombre de
 * chiffres, même cible) : seules des feuilles du même type se comparent. 200 feuilles au plus.
 * @returns {{ moyenne: number|null, nombre: number }}  la moyenne des 10 feuilles précédentes du type
 */
export async function noterFeuille({ cle, libelle, t, justes, total }) {
  const liste = (donnees.feuilles ??= []);
  const avant = liste.filter((f) => f.cle === cle).slice(-10);
  liste.push({ date: aujourdhui(), cle, libelle, t: Math.round(t * 100) / 100, justes, total });
  if (liste.length > 200) liste.splice(0, liste.length - 200);
  await sauver();
  return { moyenne: avant.length ? avant.reduce((s, f) => s + f.t, 0) / avant.length : null, nombre: avant.length };
}

// ------------------------------------------------------------------ erreurs à rejouer

/** Signature d'une colonne (pour ne pas la garder deux fois). */
const signature = (ex) => JSON.stringify(ex.lignes.map((l) => [l.op, l.n]));

/**
 * Garde une colonne ratée, pour la rejouer telle quelle le lendemain (seulement les colonnes
 * d'addition / soustraction écrites). On garde au plus 30 colonnes, des 14 derniers jours.
 */
export async function noterErreurColonne(ex) {
  if (ex.type !== 'addsub' || ex.flash || ex.ticket || !ex.lignes) return;
  const liste = (donnees.erreursColonnes ??= []);
  const sig = signature(ex);
  if (liste.some((e) => e.sig === sig)) return;
  liste.push({ date: aujourdhui(), sig, ex: { type: 'addsub', lignes: ex.lignes, resultat: ex.resultat, motifs: ex.motifs, decimales: ex.decimales, negatif: ex.negatif } });
  const limite = ajouterJours(aujourdhui(), -14);
  donnees.erreursColonnes = liste.filter((e) => e.date > limite).slice(-30);
  await sauver();
}

/** Colonnes ratées lors du dernier jour de pratique AVANT aujourd'hui (au plus 5). */
export function erreursARejouer(date = aujourdhui()) {
  const liste = (donnees.erreursColonnes ?? []).filter((e) => e.date < date);
  const dernier = liste.map((e) => e.date).sort().at(-1);
  return dernier ? liste.filter((e) => e.date === dernier).slice(0, 5).map((e) => e.ex) : [];
}

/** Une colonne rejouée juste ne revient plus. */
export async function retirerErreurColonne(ex) {
  const sig = signature(ex);
  const avant = donnees.erreursColonnes?.length ?? 0;
  donnees.erreursColonnes = (donnees.erreursColonnes ?? []).filter((e) => e.sig !== sig);
  if (donnees.erreursColonnes.length !== avant) await sauver();
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
  // Gardée pour la journée : « Aujourd'hui » montre alors la séance terminée, son bilan et une
  // proposition, sans relancer de séance d'elle-même.
  donnees.seanceTerminee = { date: aujourdhui(), bilan };
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
