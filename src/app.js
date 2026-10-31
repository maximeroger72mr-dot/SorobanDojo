/**
 * Point d'entrée de l'interface : navigation entre les écrans.
 *
 * Chaque écran est un module qui exporte par défaut :
 *   { id, titre, monter(conteneur, app, params) }   — monter() renvoie une fonction de nettoyage.
 *   Option : badge() → nombre affiché en pastille dans le menu.
 * Pour ajouter un écran : créer le fichier dans modules/ et l'ajouter à une section de MENU.
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
import muldiv from './modules/muldiv.js';
import anzan from './modules/anzan.js';
import dictee from './modules/dictee.js';
import defis from './modules/defis.js';
import epreuves from './modules/epreuves.js';
import progressionEcran from './modules/progression.js';

/** Menu en sections (option A). */
const MENU = [
  { titre: 'Aujourd\'hui', ecrans: [seance, revisions] },
  { titre: 'Apprendre', ecrans: [lecons, lecture, libre] },
  { titre: 'S\'entraîner', ecrans: [planches, drills, muldiv, anzan, dictee] },
  { titre: 'Se mesurer', ecrans: [defis, epreuves] },
  { titre: null, ecrans: [progressionEcran] },
];
const ECRANS = MENU.flatMap((s) => s.ecrans);

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
    zone.scrollTop = 0;
    nettoyage = ecran.monter(zone, app, params) ?? null;
    for (const b of nav.querySelectorAll('button[data-id]')) b.classList.toggle('actif', b.dataset.id === ecran.id);
    app.majBadges();
  },
  /** Met à jour les pastilles du menu (ex. nombre de révisions dues). */
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
  for (const section of MENU) {
    nav.append(section.titre ? h('div', { class: 'section-menu' }, section.titre) : h('hr', { class: 'separateur-menu' }));
    for (const e of section.ecrans) {
      nav.append(h('button', { 'data-id': e.id, onclick: () => app.aller(e.id) },
        e.titre, e.badge ? h('span', { class: 'pastille', style: 'display:none' }) : null));
    }
  }
}

await chargerProgression();
surSucces((s) => notifier(`Succès : ${s.nom}`, s.description));
construireNavigation();
app.aller('seance');
