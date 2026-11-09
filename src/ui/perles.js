/**
 * Motif graphique maison : la boule du soroban (losange biconique, vue de profil) et la tige.
 * Il remplace les icônes, les étoiles, les médailles et la série de jours. Tout est dessiné en
 * currentColor : chaque thème le colore à sa façon (voir themes.css).
 *
 *  - perle(plein)              une boule, pleine ou en creux ;
 *  - rangee(n, total)          n boules pleines sur total (médailles, étoiles, série de jours) ;
 *  - pictogramme(nom)          pictogrammes des 5 entrées du menu, faits de boules et de tiges ;
 *  - badgeClassement(c)        bronze, argent, or, platine = 1 à 4 boules pleines sur 4.
 */

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...enfants) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
};

/** Contour d'une boule de largeur l et hauteur hh, centrée en (cx, cy) : hexagone aplati. */
const boule = (cx, cy, l = 20, hh = 10) => {
  const a = l / 2;
  const b = hh / 2;
  const p = a * 0.42;
  return `${cx - a},${cy} ${cx - p},${cy - b} ${cx + p},${cy - b} ${cx + a},${cy} ${cx + p},${cy + b} ${cx - p},${cy + b}`;
};

/** Une boule seule. */
export function perle(plein = true, titre = '') {
  const svg = el('svg', { class: `perle${plein ? ' pleine' : ''}`, viewBox: '0 0 22 12', 'aria-hidden': titre ? 'false' : 'true', role: titre ? 'img' : 'presentation' },
    el('polygon', { points: boule(11, 6, 20, 10), fill: plein ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '1.6' }));
  if (titre) svg.append(el('title', {}, titre));
  return svg;
}

/** n boules pleines sur total, alignées sur une tige horizontale. */
export function rangee(n, total, titre = '') {
  const pas = 22;
  const svg = el('svg', { class: 'rangee-perles', viewBox: `0 0 ${total * pas + 2} 14`, role: 'img', 'aria-label': titre || `${n} sur ${total}` },
    el('line', { x1: 0, y1: 7, x2: total * pas + 2, y2: 7, stroke: 'currentColor', 'stroke-width': '1', opacity: '0.45' }));
  for (let i = 0; i < total; i++) {
    svg.append(el('polygon', { points: boule(i * pas + 12, 7, 19, 11), fill: i < n ? 'currentColor' : 'var(--fond)', stroke: 'currentColor', 'stroke-width': '1.5' }));
  }
  return svg;
}

/** Pictogrammes du menu : boules et tiges uniquement. */
export function pictogramme(nom) {
  const svg = el('svg', { class: 'picto', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  const tige = (x) => svg.append(el('line', { x1: x, y1: 1, x2: x, y2: 23, stroke: 'currentColor', 'stroke-width': '1.6' }));
  const b = (x, y, plein = true, l = 14) => svg.append(el('polygon', { points: boule(x, y, l, 7), fill: plein ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linejoin': 'round' }));
  const barre = () => svg.append(el('line', { x1: 2, y1: 9, x2: 22, y2: 9, stroke: 'currentColor', 'stroke-width': '2.2' }));
  if (nom === 'aujourdhui') { tige(12); barre(); b(12, 13); } // une boule posée contre la barre : le geste du jour
  else if (nom === 'apprendre') { tige(12); barre(); b(12, 4.5, false); b(12, 17); } // une boule en creux : ce qu'on découvre
  else if (nom === 'entrainer') { tige(12); barre(); b(12, 13); b(12, 19); b(12, 4.5); } // la tige chargée : le volume
  else if (nom === 'mesurer') { tige(6); tige(18); barre(); b(6, 13); b(18, 4.5); b(18, 13); b(18, 19); } // deux tiges comparées
  else if (nom === 'reglages') { // un engrenage
    svg.append(el('circle', { cx: 12, cy: 12, r: 3.6, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }));
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      svg.append(el('line', { x1: 12 + 6 * Math.cos(a), y1: 12 + 6 * Math.sin(a), x2: 12 + 9.5 * Math.cos(a), y2: 12 + 9.5 * Math.sin(a), stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' }));
    }
  }
  else if (nom === 'progression') { [5, 12, 19].forEach((x, i) => { tige(x); for (let k = 0; k <= i; k++) b(x, 20 - k * 6.5, true, 8); }); } // des tiges qui montent
  return svg;
}

const RANG = { bronze: 1, argent: 2, or: 3, platine: 4 };

/** Classement bronze → platine : 1 à 4 boules pleines sur 4, puis le nom. */
export function badgeClassement(id, nom) {
  return h('span', { class: `badge-classement ${id}` }, rangee(RANG[id] ?? 0, 4, nom), h('span', { class: 'nom-classement' }, nom));
}
