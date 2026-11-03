/** Affichage des niveaux d'acquisition (voir core/maitrise.js). */

import { h, formaterPourcent } from './dom.js';

const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Pastille colorée du niveau. */
export function badgeNiveau(ev) {
  return h('span', { class: `niveau niveau-${ev.niveau.id}`, title: ev.niveau.nom }, ev.niveau.nom);
}

/** Résumé : réussite, vitesse et ce qui manque pour le niveau suivant. */
export function texteEvaluation(ev, famille = 'addsub') {
  const unite = { addsub: 'chiffre', muldiv: 'produit', placement: 'placement', photo: 'chiffre lu' }[famille] ?? 'unité';
  const parts = [];
  if (ev.essais) parts.push(`réussite ${formaterPourcent(Math.round(ev.reussite * ev.essais), ev.essais)}`);
  if (ev.temps !== null) parts.push(`${nf(ev.temps)} s par ${unite}`);
  if (ev.prochain && ev.manque.length) parts.push(`pour « ${ev.prochain.nom} » : ${ev.manque.join(', ')}`);
  return parts.join(' · ');
}
