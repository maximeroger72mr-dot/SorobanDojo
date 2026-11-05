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
import { chargerProgression, surSucces } from './core/progression.js';
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
import { apprendre, entrainer, mesurer, SECTION_DE } from './modules/hubs.js';

/**
 * Menu à 5 entrées. Apprendre, S'entraîner et Se mesurer ouvrent une page de cartes (hubs.js) ;
 * les autres écrans existent toujours (on y va par les cartes, la séance, ou un lien).
 */
const MENU = [
  { ecran: seance, nom: 'Aujourd\'hui', icone: '☀' },
  { ecran: apprendre, nom: 'Apprendre', icone: '◎' },
  { ecran: entrainer, nom: 'S\'entraîner', icone: '⟳' },
  { ecran: mesurer, nom: 'Se mesurer', icone: '⏱' },
  { ecran: progressionEcran, nom: 'Progression', icone: '▤' },
];
const ECRANS = [seance, apprendre, entrainer, mesurer, progressionEcran, revisions, lecons, lecture, libre, planches, drills, rythme, jeux,
  quotidien, muldiv, anzan, dictee, defis, examen, epreuves];
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
    for (const b of nav.querySelectorAll('button[data-id]')) b.classList.toggle('actif', b.dataset.id === entreeDe(ecran.id));
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
    nav.append(h('button', { 'data-id': m.ecran.id, class: 'entree-menu', onclick: () => app.aller(m.ecran.id) },
      h('span', { class: 'icone-menu', 'aria-hidden': 'true' }, m.icone), m.nom, h('span', { class: 'pastille', style: 'display:none' })));
  }
}

await chargerProgression();
surSucces((s) => notifier(`Succès : ${s.nom}`, s.description));
construireNavigation();
app.aller('seance');
