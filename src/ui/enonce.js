/**
 * Affichage des énoncés, tels qu'on les lit pour calculer sur son soroban :
 *  - colonne d'additions/soustractions (la 1re ligne sans signe), avec sous-totaux optionnels ;
 *  - multiplication « a × b = » et division « a ÷ b = ».
 */

import { sousTotaux } from '../core/generateur.js';
import { h, formaterNombre } from './dom.js';

const signe = (op) => (op === '+' ? '' : '−');

/**
 * @param {object} ex  exercice ({type:'addsub', lignes} | {type:'mul'|'div', a, b})
 * @param {{sousTotaux?: boolean, numeros?: boolean, compact?: boolean, surLigne?: (i) => void}} o
 */
export function rendreEnonce(ex, o = {}) {
  if (ex.type === 'mul' || ex.type === 'div') {
    return h('div', { class: `operation${o.compact ? ' compacte' : ''}` },
      `${formaterNombre(ex.a)} ${ex.type === 'mul' ? '×' : '÷'} ${formaterNombre(ex.b)} =`);
  }
  const st = o.sousTotaux ? sousTotaux(ex.lignes) : null;
  return h('table', { class: `colonne${o.compact ? ' compacte' : ''}` },
    ex.lignes.map((l, i) => h('tr', { class: o.surLigne ? 'cliquable' : '', onclick: o.surLigne ? () => o.surLigne(i) : null },
      o.numeros ? h('td', { class: 'num' }, i + 1) : null,
      h('td', { class: 'signe' }, i === 0 ? '' : signe(l.op)),
      h('td', { class: 'nombre' }, formaterNombre(l.n)),
      st ? h('td', { class: 'sous-total' }, `= ${formaterNombre(st[i])}`) : null,
      o.surLigne ? h('td', { class: 'jouer' }, '▶') : null)));
}

/** Texte court d'un exercice (pour les listes et le bilan). */
export function texteEnonce(ex) {
  if (ex.type === 'mul') return `${formaterNombre(ex.a)} × ${formaterNombre(ex.b)}`;
  if (ex.type === 'div') return `${formaterNombre(ex.a)} ÷ ${formaterNombre(ex.b)}`;
  return ex.lignes.map((l, i) => (i === 0 ? formaterNombre(l.n) : `${l.op === '+' ? '+' : '−'} ${formaterNombre(l.n)}`)).join(' ');
}
