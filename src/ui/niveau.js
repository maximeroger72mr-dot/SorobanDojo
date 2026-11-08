/** Affichage des niveaux d'acquisition (voir core/maitrise.js). */

import { h, formaterPourcent } from './dom.js';
import { formaterVitesse } from '../core/maitrise.js';

/** Pastille colorée du niveau. */
export function badgeNiveau(ev) {
  return h('span', { class: `niveau niveau-${ev.niveau.id}`, title: ev.niveau.nom }, ev.niveau.nom);
}

/** Résumé : réussite, vitesse et ce qui manque pour le niveau suivant. */
export function texteEvaluation(ev, famille = 'addsub') {
  const parts = [];
  if (ev.essais) parts.push(`réussite ${formaterPourcent(Math.round(ev.reussite * ev.essais), ev.essais)}`);
  if (ev.temps !== null) parts.push(formaterVitesse(ev.temps, famille));
  if (ev.prochain && ev.manque.length) parts.push(`pour « ${ev.prochain.nom} » : ${ev.manque.join(', ')}`);
  return parts.join(' · ');
}
