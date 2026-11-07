/**
 * Affichage des énoncés, tels qu'on les lit pour calculer sur son soroban :
 *  - colonne d'additions/soustractions (la 1re ligne sans signe), avec sous-totaux optionnels ;
 *  - multiplication « a × b = » et division « a ÷ b = ».
 */

import { sousTotaux } from '../core/generateur.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from './sorobanVue.js';
import { doigte } from './drill.js';
import { h, formaterNombre } from './dom.js';

const signe = (op) => (op === '+' ? '' : '−');

/** Valeur d'un résultat ou d'une réponse : montants toujours en euros, avec 2 décimales (76,60 €). */
export function formaterValeur(ex, v) {
  if (v === null || v === undefined) return '';
  return ex?.euros ? `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : formaterNombre(v);
}

/** « au millième », « au dix-millième »… */
export function consigneArrondi(decimales) {
  return ['à l\'unité', 'au dixième', 'au centième', 'au millième', 'au dix-millième'][decimales] ?? `à ${decimales} décimales`;
}

/**
 * @param {object} ex  exercice ({type:'addsub', lignes} | {type:'mul'|'div', a, b})
 * @param {{sousTotaux?: boolean, numeros?: boolean, compact?: boolean, surLigne?: (i) => void, surligne?: number, doigte?: boolean}} o
 *   surligne : index de la ligne à mettre en évidence (ligne probable d'une erreur)
 *   doigte : rappel des doigts à côté de chaque ligne (pouce / index / pincée), colonnes entières seulement
 */
export function rendreEnonce(ex, o = {}) {
  // Consigne de situation (ex. « Ticket de caisse : … ») au-dessus de l'énoncé.
  if (ex.consigne && !o.sansConsigne) {
    return h('div', {}, h('div', { class: 'consigne-situation' }, ex.consigne), rendreEnonce(ex, { ...o, sansConsigne: true }));
  }
  if (ex.ticket) {
    // Ticket de caisse : articles et prix alignés, comme un vrai ticket (sous-totaux en option).
    const st = o.sousTotaux ? sousTotaux(ex.lignes) : null;
    return h('div', { class: `quotidien${o.compact ? ' compacte' : ''}` }, h('div', { class: 'ticket' },
      ex.lignes.map((l, i) => h('div', {}, h('span', {}, ex.ticket[i]), h('span', {}, formaterValeur(ex, l.n), st ? h('span', { class: 'sous-total' }, `  = ${formaterValeur(ex, st[i])}`) : null))),
      h('div', { class: 'ticket-total' }, h('span', {}, 'TOTAL'), h('span', {}, '?'))));
  }
  if (ex.type === 'quotidien') {
    return h('div', { class: `quotidien${o.compact ? ' compacte' : ''}` }, ex.texte.map((t) => h('div', {}, t)));
  }
  if (ex.type === 'photo' || ex.type === 'tenir') {
    // Visualisation : le soroban qui était montré (après coup, pour comparer).
    const el = h('div', { class: `photo-soroban${o.compact ? ' compacte' : ''}` });
    const s = new Soroban(Math.max(2, String(ex.n).length + 1));
    s.definirValeur(ex.n);
    new SorobanVue(el, s, { interactif: false });
    return el;
  }
  if (ex.type === 'table') {
    return h('div', { class: `operation${o.compact ? ' compacte' : ''}` }, `${ex.a} × ${ex.b} =`,
      h('div', { class: 'consigne-arrondi' }, 'sur deux chiffres (ex. 06)'));
  }
  if (ex.type === 'mul' || ex.type === 'div') {
    return h('div', { class: `operation${o.compact ? ' compacte' : ''}` },
      `${formaterNombre(ex.a)} ${ex.type === 'mul' ? '×' : '÷'} ${formaterNombre(ex.b)} =`,
      ex.arrondi ? h('div', { class: 'consigne-arrondi' }, `arrondir ${consigneArrondi(ex.decimales)}`) : null);
  }
  const st = o.sousTotaux ? sousTotaux(ex.lignes) : null;
  const avant = o.doigte && !ex.decimales ? [0, ...sousTotaux(ex.lignes)] : null;
  const rappel = (l, i) => {
    if (!avant || avant[i] < 0) return null;
    return h('td', { class: 'doigte' }, i === 0 ? 'poser' : doigte(avant[i], l.op, l.n).join(' / '));
  };
  return h('table', { class: `colonne${o.compact ? ' compacte' : ''}` },
    ex.lignes.map((l, i) => h('tr', { class: `${o.surLigne ? 'cliquable' : ''}${o.surligne === i ? ' ligne-probable' : ''}`, onclick: o.surLigne ? () => o.surLigne(i) : null },
      o.numeros ? h('td', { class: 'num' }, i + 1) : null,
      h('td', { class: 'signe' }, i === 0 ? '' : signe(l.op)),
      h('td', { class: 'nombre' }, formaterNombre(l.n)),
      st ? h('td', { class: 'sous-total' }, `= ${formaterNombre(st[i])}`) : null,
      rappel(l, i),
      o.surLigne ? h('td', { class: 'jouer' }, '▶') : null)));
}

/** Texte court d'un exercice (pour les listes et le bilan). */
export function texteEnonce(ex) {
  if (ex.type === 'photo') return `photo du soroban (${formaterNombre(ex.n)})`;
  if (ex.type === 'quotidien') return ex.texte.join(' · ');
  if (ex.type === 'tenir') return `tenir l'image de ${formaterNombre(ex.n)}`;
  if (ex.type === 'mul' || ex.type === 'table') return `${formaterNombre(ex.a)} × ${formaterNombre(ex.b)}`;
  if (ex.type === 'div') return `${formaterNombre(ex.a)} ÷ ${formaterNombre(ex.b)}`;
  return ex.lignes.map((l, i) => (i === 0 ? formaterNombre(l.n) : `${l.op === '+' ? '+' : '−'} ${formaterNombre(l.n)}`)).join(' ');
}
