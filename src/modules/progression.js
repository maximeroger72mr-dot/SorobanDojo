/** Écran de progression : résumé par module et historique par jour. */

import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';
import { statistiques } from '../core/progression.js';

const NOMS_MODULES = { lecture: 'Lecture et écriture' };

export default {
  id: 'progression',
  titre: 'Progression',
  monter(el) {
    const { parModule, parJour } = statistiques();
    el.append(h('h1', {}, 'Progression'));

    if (Object.keys(parModule).length === 0) {
      el.append(h('p', { class: 'discret' }, 'Aucune série terminée pour l\'instant. Vos résultats apparaîtront ici.'));
      return;
    }

    const ligne = (nom, t) => h('tr', {},
      h('td', {}, nom), h('td', {}, t.sessions), h('td', {}, t.total),
      h('td', {}, formaterPourcent(t.justes, t.total)), h('td', {}, formaterDuree(t.dureeMs / t.total)));
    const entete = (premier) => h('tr', {}, [premier, 'Séries', 'Exercices', 'Réussite', 'Temps moyen'].map((x) => h('th', {}, x)));

    el.append(
      h('h2', {}, 'Par module'),
      h('table', {}, entete('Module'),
        Object.entries(parModule).map(([id, t]) => ligne(NOMS_MODULES[id] ?? id, t))),
      h('h2', {}, 'Par jour'),
      h('table', {}, entete('Date'),
        Object.entries(parJour).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30)
          .map(([date, t]) => ligne(new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), t))),
    );
  },
};
