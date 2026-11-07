/**
 * Rejouer ses erreurs d'hier : les colonnes ratées lors du dernier jour de pratique, à l'identique.
 * Refaire exactement ce qu'on a raté, à un jour d'écart, corrige le geste mieux qu'un exercice
 * neuf. Une colonne réussie ne revient plus ; une colonne encore ratée reviendra.
 */

import { erreursARejouer, retirerErreurColonne, noterErreurColonne, enregistrerSession } from '../core/progression.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h, formaterDuree } from '../ui/dom.js';

export default {
  id: 'erreurs',
  titre: 'Mes erreurs d\'hier',
  monter(el, app) {
    const colonnes = erreursARejouer();
    el.append(h('h1', {}, 'Mes erreurs d\'hier'));
    if (!colonnes.length) {
      el.append(h('p', {}, 'Aucune colonne ratée à rejouer : bravo.'));
      return null;
    }
    el.append(h('p', { class: 'discret' }, `${colonnes.length} colonne${colonnes.length > 1 ? 's' : ''} ratée${colonnes.length > 1 ? 's' : ''} lors de votre dernière séance, exactement les mêmes. Prenez votre temps : c'est la justesse qui compte ici.`));
    let i = 0;
    let serie = creerSerie(el, {
      generer: () => ({ ...colonnes[i++] }),
      nombre: colonnes.length,
      chrono: true,
      sansMemoireErreurs: true,
      // Réussie : elle ne revient plus. Encore ratée : redatée d'aujourd'hui, elle reviendra à la prochaine séance.
      surExercice: async (res, ex) => { await retirerErreurColonne(ex); if (!res.juste) await noterErreurColonne(ex); },
      surFin: async (b) => {
        serie.detruire();
        serie = null;
        await enregistrerSession({ module: 'erreurs', mode: 'rejouer', total: b.total, justes: b.justes, dureeMs: b.dureeMs });
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
          h('p', {}, b.justes === b.total ? 'Toutes corrigées : ces gestes sont rentrés.' : 'Les colonnes encore fausses reviendront à votre prochaine séance.'),
          h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
          h('button', { class: 'btn principal', onclick: () => app.aller('seance') }, 'Retour à la séance')),
          listeErreurs(b.resultats) ?? '');
      },
    });
    return () => serie?.detruire();
  },
};
