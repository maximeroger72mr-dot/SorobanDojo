/**
 * Point d'entrée de l'interface : navigation entre les écrans.
 *
 * Chaque écran est un module qui exporte par défaut :
 *   { id, titre, monter(conteneur, app, params) }   — monter() renvoie une fonction de nettoyage.
 *   Option : badge() → nombre affiché en pastille dans le menu.
 * Pour ajouter un écran : créer le fichier dans modules/, l'ajouter à ECRANS, et une carte
 * dans modules/hubs.js pour qu'on puisse l'ouvrir.
 */

import { h, remplir } from './ui/dom.js';
import { chargerProgression, surSucces, stockage, surStockage, versionNavigateur, rechargerDepuis, CLE_STOCKAGE, aujourdhui } from './core/progression.js';
import { VERSION_APPLI } from './core/version.js';
import { telechargerExport, telechargerTexte } from './ui/exporter.js';
import { pictogramme } from './ui/perles.js';
import { appliquerTheme, selecteursTheme } from './ui/theme.js';
import { notifier } from './ui/toast.js';
import seance from './modules/seance.js';
import revisions from './modules/revisions.js';
import lecons from './modules/lecons.js';
import lecture from './modules/lecture.js';
import libre from './modules/libre.js';
import planches from './modules/planches.js';
import drills from './modules/drills.js';
import rythme from './modules/rythme.js';
import quotidien from './modules/quotidien.js';
import muldiv from './modules/muldiv.js';
import anzan from './modules/anzan.js';
import dictee from './modules/dictee.js';
import defis from './modules/defis.js';
import epreuves from './modules/epreuves.js';
import progressionEcran from './modules/progression.js';
import jeux from './modules/jeux.js';
import examen from './modules/examen.js';
import lexique from './modules/lexique.js';
import { apprendre, entrainer, mesurer, SECTION_DE } from './modules/hubs.js';

/**
 * Menu à 5 entrées. Apprendre, S'entraîner et Se mesurer ouvrent une page de cartes (hubs.js) ;
 * les autres écrans existent toujours (on y va par les cartes, la séance, ou un lien).
 */
const MENU = [
  { ecran: seance, nom: 'Aujourd\'hui', court: 'Jour', picto: 'aujourdhui' },
  { ecran: apprendre, nom: 'Apprendre', court: 'Apprendre', picto: 'apprendre' },
  { ecran: entrainer, nom: 'S\'entraîner', court: 'Entraîner', picto: 'entrainer' },
  { ecran: mesurer, nom: 'Se mesurer', court: 'Mesurer', picto: 'mesurer' },
  { ecran: progressionEcran, nom: 'Progression', court: 'Progrès', picto: 'progression' },
];
const ECRANS = [seance, apprendre, entrainer, mesurer, progressionEcran, revisions, lecons, lecture, libre, planches, drills, rythme, jeux,
  quotidien, muldiv, anzan, dictee, defis, examen, epreuves, lexique];
/** Entrée du menu à surligner pour un écran. */
const entreeDe = (id) => (MENU.some((m) => m.ecran.id === id) ? id : SECTION_DE[id] ?? 'seance');

const nav = document.getElementById('navigation');
const zone = document.getElementById('ecran');
let nettoyage = null;

export const app = {
  ecrans: ECRANS,
  /** Affiche l'écran demandé (params : options propres à l'écran, ex. { sousPalier: 'p3-1' }). */
  aller(id, params = {}) {
    const ecran = ECRANS.find((e) => e.id === id) ?? seance;
    nettoyage?.();
    remplir(zone);
    zone.parentElement.scrollTop = 0; // la zone défilante est <main>, autour du contenu centré
    nettoyage = ecran.monter(zone, app, params) ?? null;
    replierReglages(zone);
    for (const b of nav.querySelectorAll('button[data-id]')) b.classList.toggle('actif', b.dataset.id === entreeDe(ecran.id));
    // Section courante (codes couleur du thème « signalétique »).
    document.body.dataset.section = entreeDe(ecran.id);
    app.majBadges();
  },
  /** Met à jour les pastilles du menu (ex. révisions dues, sur « Aujourd'hui »). */
  majBadges() {
    for (const m of MENU) {
      const pastille = nav.querySelector(`button[data-id="${m.ecran.id}"] .pastille`);
      if (!pastille) continue;
      const n = m.ecran.badge?.() ?? 0;
      pastille.textContent = n || '';
      pastille.style.display = n ? '' : 'none';
    }
  },
};

function construireNavigation() {
  nav.append(h('div', { class: 'titre-app' }, 'Soroban'));
  for (const m of MENU) {
    if (m.ecran === progressionEcran) nav.append(h('hr', { class: 'separateur-menu' }));
    nav.append(h('button', { 'data-id': m.ecran.id, class: 'entree-menu', 'aria-label': m.nom, onclick: () => app.aller(m.ecran.id) },
      h('span', { class: 'icone-menu' }, pictogramme(m.picto)), h('span', { class: 'nom-menu' }, h('span', { class: 'nom-long' }, m.nom), h('span', { class: 'nom-court', 'aria-hidden': 'true' }, m.court)), h('span', { class: 'pastille', style: 'display:none' })));
  }
  // Choix du mode (clair / sombre) et numéro de version, en bas du menu.
  nav.append(h('div', { class: 'choix-theme' }, ...selecteursTheme()),
    h('div', { class: 'version-appli' }, `Version ${VERSION_APPLI}${versionNavigateur ? ' · navigateur' : ''}`));
}

/**
 * Bandeau d'alerte du stockage, en haut de la zone principale : il reste affiché tant que le
 * problème dure (un enregistrement raté ne doit jamais passer inaperçu).
 */
const bandeau = h('div', { class: 'bandeau-stockage', role: 'alert', hidden: true });
zone.before(bandeau);
function majBandeau(e) {
  const exporter = h('button', { class: 'btn', onclick: () => telechargerExport() }, 'Exporter maintenant');
  const fermer = h('button', { class: 'btn', onclick: () => { bandeau.hidden = true; } }, 'Compris');
  const textes = {
    indisponible: ['Ce navigateur bloque l\'enregistrement : votre progression ne sera PAS conservée. Autorisez les données de site (cookies) pour cette page, ou utilisez l\'application Windows.', null],
    echec: [`Attention : le dernier enregistrement a échoué${e.message ? ` (${e.message})` : ''}. Vos derniers résultats ne sont peut-être pas sauvegardés : exportez-les.`, exporter],
    'lecture-seule': ['Mode sans enregistrement : votre progression vient d\'une version plus récente de Soroban, cette copie n\'écrit rien. Ouvrez la version la plus récente.', null],
    'ancienne-copie': [`Vous ouvrez une ancienne copie de Soroban (version ${VERSION_APPLI}) alors que votre progression a déjà servi avec la version ${e.appli}. Rien n'est perdu, mais ouvrez de préférence la version la plus récente.`, fermer],
  };
  const t = textes[e.etat];
  bandeau.hidden = !t;
  if (t) remplir(bandeau, h('span', {}, t[0]), t[1]);
}
surStockage(majBandeau);

/**
 * Sauvegarde faite par une version PLUS RÉCENTE de l'application : on n'écrit rien, et on le dit.
 * L'utilisateur peut exporter ces données ou continuer sans enregistrer.
 */
function ecranLectureSeule(brut) {
  remplir(zone,
    h('h1', {}, 'Ouvrez la version la plus récente'),
    h('div', { class: 'carte avis' },
      h('p', {}, h('strong', {}, 'Votre progression a été enregistrée par une version plus récente de Soroban.')),
      h('p', {}, `Cette copie (version ${VERSION_APPLI}) ne sait pas la lire. Pour ne rien abîmer, elle n'enregistrera rien. Ouvrez la version la plus récente (la page des téléchargements garde toujours la dernière), et supprimez les anciennes copies.`),
      h('div', { class: 'ligne' },
        h('button', { class: 'btn principal', onclick: () => telechargerTexte(JSON.stringify(brut, null, 2), `soroban-sauvegarde-${aujourdhui()}.json`) }, 'Exporter cette progression (fichier)'),
        h('button', { class: 'btn', onclick: () => { construireNavigation(); app.aller('seance'); } }, 'Continuer sans enregistrer'))));
}

/** Version navigateur : un autre onglet a enregistré → on reprend ses données (sinon on les écraserait). */
function surveillerOnglets() {
  window.addEventListener('storage', (e) => {
    if (e.key !== CLE_STOCKAGE || e.newValue === null) return;
    if (!rechargerDepuis(e.newValue)) return;
    notifier('Soroban est ouvert dans un autre onglet', 'Ses résultats ont été repris ici. Pour éviter les mélanges, gardez un seul onglet ouvert.', 9000);
  });
}

/** Version navigateur : prévenir avant de fermer ou d'actualiser la page pendant un exercice. */
function prevenirAvantDeQuitter() {
  window.addEventListener('beforeunload', (e) => {
    if (!zone.querySelector('[data-en-cours]')) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/**
 * Une seule action principale visible : pendant un exercice (série, feuille, drill, marathon,
 * lièvre…), les réglages de l'écran sont repliés derrière un bouton « Réglages ».
 */
function replierReglages(zoneEcran) {
  for (const r of zoneEcran.querySelectorAll(':scope > .reglages')) {
    if (r.previousElementSibling?.classList.contains('bouton-reglages')) continue;
    r.before(h('button', { class: 'bouton-reglages', 'aria-expanded': 'false', onclick: (e) => {
      const ouvert = r.classList.toggle('ouvert');
      e.currentTarget.setAttribute('aria-expanded', String(ouvert));
    } }, 'Réglages'));
  }
}

await chargerProgression();
appliquerTheme();
surSucces((s) => notifier(`Succès : ${s.nom}`, s.description));
majBandeau(stockage());
if (versionNavigateur) { surveillerOnglets(); prevenirAvantDeQuitter(); }
if (stockage().etat === 'lecture-seule') ecranLectureSeule(stockage().brut);
else {
  construireNavigation();
  app.aller('seance');
}
