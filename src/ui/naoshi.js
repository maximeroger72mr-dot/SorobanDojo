/**
 * Naoshi (直し, « la correction ») : après une épreuve, reprendre ses erreurs, sans chrono. En
 * juku, on ne passe pas à la feuille suivante sans avoir refait ses fautes : c'est là qu'on
 * comprend ce qui a lâché (0.38).
 */

import { creerFeuille } from './feuille.js';
import { enregistrerSession } from '../core/progression.js';
import { h, remplir } from './dom.js';

/**
 * Bouton « Reprendre mes erreurs » : ouvre, dans `zone`, une feuille avec les problèmes faux
 * (ou non répondus) de l'épreuve, sans limite de temps. null s'il n'y a rien à reprendre.
 * @param {HTMLElement} zone
 * @param {Array<{ ex, juste }>} resultats  résultats de la feuille corrigée
 * @param {{ source?: string, retour?: () => void }} [o]
 */
export function boutonNaoshi(zone, resultats, o = {}) {
  const fautes = (resultats ?? []).filter((r) => !r.juste && r.ex).map((r) => r.ex);
  if (!fautes.length) return null;
  let feuille = null;
  return h('button', {
    class: 'btn principal',
    title: 'Refaire, sans chrono, les problèmes faux ou laissés vides',
    onclick: () => {
      remplir(zone, h('p', { class: 'consigne' }, `Naoshi (直し) : reprenez vos ${fautes.length} erreur${fautes.length > 1 ? 's' : ''}, sans chrono. Prenez le temps de trouver ce qui a lâché : la tige, le geste, le placement.`));
      feuille = creerFeuille(zone, {
        titre: `Reprendre mes erreurs (${fautes.length})`,
        sections: [{ problemes: fautes }],
        surFin: (b) => {
          enregistrerSession({ module: 'naoshi', mode: o.source ?? 'epreuve', total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, b.justes === b.total ? 'Toutes vos erreurs sont reprises.' : 'Celles qui restent fausses sont à rejouer demain, dans « À revoir ».'),
            o.retour ? h('button', { class: 'btn', onclick: () => { feuille?.detruire(); o.retour(); } }, 'Retour') : null);
        },
      });
    },
  }, `Reprendre mes erreurs (${fautes.length}) →`);
}
