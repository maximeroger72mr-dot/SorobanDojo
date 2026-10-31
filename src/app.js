/**
 * Point d'entrée de l'interface : navigation entre les écrans.
 *
 * Chaque écran est un module qui exporte par défaut :
 *   { id, titre, monter(conteneur, app) }   — monter() renvoie une fonction de nettoyage.
 * Pour ajouter un écran : créer le fichier dans modules/ et l'ajouter à ECRANS ci-dessous.
 */

import { h } from './ui/dom.js';
import { chargerProgression } from './core/progression.js';
import accueil from './modules/accueil.js';
import libre from './modules/libre.js';
import lecture from './modules/lecture.js';
import lecons from './modules/lecons.js';
import revisions from './modules/revisions.js';
import planches from './modules/planches.js';
import drills from './modules/drills.js';
import muldiv from './modules/muldiv.js';
import anzan from './modules/anzan.js';
import defis from './modules/defis.js';
import epreuves from './modules/epreuves.js';
import progressionEcran from './modules/progression.js';

/** Écrans, dans l'ordre de la navigation. */
const ECRANS = [
  accueil,
  lecons,
  revisions,
  planches,
  drills,
  muldiv,
  anzan,
  defis,
  epreuves,
  lecture,
  libre,
  progressionEcran,
];

const nav = document.getElementById('navigation');
const zone = document.getElementById('ecran');
let nettoyage = null;

export const app = {
  ecrans: ECRANS,
  /** Affiche l'écran demandé (params : options propres à l'écran, ex. { sousPalier: 'p3-1' }). */
  aller(id, params = {}) {
    const ecran = ECRANS.find((e) => e.id === id && !e.bientot) ?? accueil;
    nettoyage?.();
    zone.replaceChildren();
    zone.scrollTop = 0;
    nettoyage = ecran.monter(zone, app, params) ?? null;
    for (const b of nav.querySelectorAll('button[data-id]')) b.classList.toggle('actif', b.dataset.id === ecran.id);
    app.majBadges();
  },
  /** Met à jour les pastilles de la navigation (ex. nombre de révisions dues). */
  majBadges() {
    for (const e of ECRANS) {
      const pastille = nav.querySelector(`button[data-id="${e.id}"] .pastille`);
      if (!pastille || !e.badge) continue;
      const n = e.badge();
      pastille.textContent = n || '';
      pastille.style.display = n ? '' : 'none';
    }
  },
};

function construireNavigation() {
  nav.append(h('div', { class: 'titre-app' }, 'Soroban'));
  for (const e of ECRANS) {
    nav.append(h('button', { 'data-id': e.id, disabled: !!e.bientot, onclick: () => app.aller(e.id) },
      e.titre, e.bientot ? h('span', { class: 'bientot' }, '· bientôt') : null,
      e.badge ? h('span', { class: 'pastille', style: 'display:none' }) : null));
  }
}

await chargerProgression();
construireNavigation();
app.aller('accueil');
