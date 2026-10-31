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
import progressionEcran from './modules/progression.js';

/** Écrans disponibles, et ceux annoncés pour les prochaines étapes (désactivés). */
const ECRANS = [
  accueil,
  libre,
  lecture,
  { id: 'lecons', titre: 'Leçons guidées', bientot: true },
  { id: 'calcul', titre: 'Addition et soustraction', bientot: true },
  { id: 'pas-a-pas', titre: 'Pas à pas', bientot: true },
  { id: 'multiplication', titre: 'Multiplication et division', bientot: true },
  { id: 'anzan', titre: 'Flash anzan', bientot: true },
  { id: 'defis', titre: 'Défis chrono', bientot: true },
  { id: 'epreuves', titre: 'Épreuves officielles', bientot: true },
  progressionEcran,
];

const nav = document.getElementById('navigation');
const zone = document.getElementById('ecran');
let nettoyage = null;

export const app = {
  ecrans: ECRANS,
  /** Affiche l'écran demandé. */
  aller(id) {
    const ecran = ECRANS.find((e) => e.id === id && !e.bientot) ?? accueil;
    nettoyage?.();
    zone.replaceChildren();
    zone.scrollTop = 0;
    nettoyage = ecran.monter(zone, app) ?? null;
    for (const b of nav.querySelectorAll('button[data-id]')) b.classList.toggle('actif', b.dataset.id === ecran.id);
  },
};

function construireNavigation() {
  nav.append(h('div', { class: 'titre-app' }, 'Soroban'));
  for (const e of ECRANS) {
    nav.append(h('button', { 'data-id': e.id, disabled: !!e.bientot, onclick: () => app.aller(e.id) },
      e.titre, e.bientot ? h('span', { class: 'bientot' }, '· bientôt') : null));
  }
}

await chargerProgression();
construireNavigation();
app.aller('accueil');
