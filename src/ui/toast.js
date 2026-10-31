/** Notification discrète en bas à droite, qui disparaît seule (ex. succès débloqué). */

import { h } from './dom.js';

let pile = null;

export function notifier(titre, texte, dureeMs = 5000) {
  if (!pile) {
    pile = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(pile);
  }
  const t = h('div', { class: 'toast' }, h('strong', {}, titre), texte ? h('div', {}, texte) : null);
  pile.append(t);
  setTimeout(() => { t.classList.add('sortie'); setTimeout(() => t.remove(), 400); }, dureeMs);
}
