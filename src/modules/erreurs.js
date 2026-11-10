/**
 * À revoir : les colonnes qui ont posé problème lors du dernier jour de pratique (ratées, ou
 * anormalement longues), rejouées à l'identique, sans dire pourquoi elles reviennent.
 * Refaire exactement ce qu'on a raté, à un jour d'écart, corrige le geste mieux qu'un exercice
 * neuf. Une colonne réussie revient encore 3 jours puis 7 jours plus tard, puis ne revient plus ;
 * une colonne encore ratée reviendra à la prochaine séance.
 */

import { erreursARejouer, retirerErreurColonne, relancerErreurColonne, enregistrerSession } from '../core/progression.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h, formaterDuree } from '../ui/dom.js';

export default {
  id: 'erreurs',
  titre: 'À revoir',
  monter(el, app) {
    const colonnes = erreursARejouer();
    el.append(h('h1', {}, 'À revoir'));
    if (!colonnes.length) {
      el.append(h('p', {}, 'Rien à revoir aujourd\'hui.'));
      return null;
    }
    el.append(h('p', { class: 'discret' }, `${colonnes.length} colonne${colonnes.length > 1 ? 's' : ''} déjà ratée${colonnes.length > 1 ? 's' : ''}, à refaire. Prenez votre temps : c'est la justesse qui compte ici.`));
    let i = 0;
    let serie = creerSerie(el, {
      generer: () => ({ ...colonnes[i++] }),
      nombre: colonnes.length,
      chrono: true,
      sansMemoireErreurs: true,
      // Réussie : elle revient encore à J+3 puis J+7, puis plus. Encore ratée : elle reviendra à la prochaine séance.
      surExercice: async (res, ex) => { if (res.juste) await retirerErreurColonne(ex); else await relancerErreurColonne(ex); },
      surFin: async (b) => {
        serie.detruire();
        serie = null;
        await enregistrerSession({ module: 'erreurs', mode: 'rejouer', total: b.total, justes: b.justes, dureeMs: b.dureeMs });
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
          h('p', {}, b.justes === b.total ? 'Tout est juste.' : 'Les colonnes encore fausses reviendront à votre prochaine séance.'),
          h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
          h('button', { class: 'btn principal', onclick: () => app.aller('seance') }, 'Retour à la séance')),
          listeErreurs(b.resultats) ?? '');
      },
    });
    return () => serie?.detruire();
  },
};
