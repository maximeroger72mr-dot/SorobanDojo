/**
 * Avertissement « conseillé après… » : on ne bloque pas, on prévient. Deux choix : aller à la
 * leçon conseillée, ou y aller quand même.
 */

import { h } from './dom.js';
import { ouvrirDialogue } from './panneauDemo.js';

/**
 * @param {object} app
 * @param {object[]} manquantes  leçons conseillées, pas encore validées
 * @param {string} utilise  ce que l'activité demande (« les grands amis et les décimaux »)
 * @param {Function} continuer  appelée sur « Y aller quand même »
 */
export function avertirPrerequis(app, manquantes, utilise, continuer) {
  const premiere = manquantes[0];
  ouvrirDialogue('Un peu tôt ?', null, (corps) => {
    corps.append(
      h('p', {}, `Cette activité utilise ${utilise}, que vous n'avez pas encore appris. Vous risquez d'inventer un geste que vous devrez ensuite désapprendre.`),
      h('p', { class: 'discret' }, manquantes.length > 1
        ? `Conseillé après ${manquantes.length} leçons, à commencer par « ${premiere.titre} ».`
        : `Conseillé après la leçon « ${premiere.titre} ».`),
      h('div', { class: 'ligne' },
        h('button', { class: 'btn principal', onclick: (e) => { e.target.closest('dialog').close(); app.aller('lecons', { sousPalier: premiere.id }); } }, 'Aller à la leçon'),
        h('button', { class: 'btn', onclick: (e) => { e.target.closest('dialog').close(); continuer(); } }, 'Y aller quand même')));
  });
}
