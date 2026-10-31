/** Écran d'accueil : les modules et une suggestion de travail. */

import { h } from '../ui/dom.js';
import { progression, statistiques } from '../core/progression.js';

const DESCRIPTIONS = {
  libre: 'Manipuler le soroban et voir n\'importe quel calcul décomposé geste par geste.',
  lecture: 'Lire un nombre affiché sur le soroban, ou poser un nombre donné.',
  lecons: 'Unités, dizaines, petits amis, grands amis : démonstration puis exercices.',
  calcul: 'Séries d\'additions et de soustractions, nombre de chiffres et de termes réglables.',
  'pas-a-pas': 'Chaque mouvement de boule est vérifié et corrigé.',
  multiplication: 'Méthode japonaise standard, avec démonstrations.',
  anzan: 'Calcul mental : des nombres défilent, donnez leur somme.',
  defis: 'Vingt calculs le plus vite possible, record personnel.',
  epreuves: 'Sujets au format des examens japonais.',
  progression: 'Historique, taux de réussite, temps moyen, points à retravailler.',
};

/** Suggestion simple, qui s'enrichira avec les modules suivants. */
function suggestion() {
  const { parModule } = statistiques();
  const lecture = parModule.lecture;
  if (!lecture) {
    return { texte: 'Commencez par apprendre à lire et poser les nombres sur le soroban.', id: 'lecture' };
  }
  const taux = lecture.justes / lecture.total;
  if (taux < 0.9) {
    return { texte: `Votre taux de réussite en lecture est de ${Math.round(taux * 100)} % : une nouvelle série consolidera les bases.`, id: 'lecture' };
  }
  return { texte: 'La lecture est acquise. Entraînez-vous à poser des nombres plus longs, ou explorez le soroban libre.', id: 'lecture' };
}

export default {
  id: 'accueil',
  titre: 'Accueil',
  monter(el, app) {
    const s = suggestion();
    const premiereFois = progression().sessions.length === 0;
    el.append(
      h('h1', {}, 'Apprendre le soroban'),
      h('p', { class: 'discret' }, premiereFois
        ? 'Bienvenue. Le soroban est le boulier japonais : chaque geste a une raison, et l\'application vous l\'explique à chaque fois.'
        : 'Bon retour.'),
      h('div', { class: 'carte suggestion', style: 'margin-top:16px' },
        h('strong', {}, 'Suggestion : '), s.texte, ' ',
        h('button', { class: 'btn principal', style: 'margin-left:8px', onclick: () => app.aller(s.id) }, 'Y aller')),
      h('div', { class: 'grille' },
        app.ecrans.filter((e) => e.id !== 'accueil').map((e) => h('div', {
          class: `carte${e.bientot ? ' indisponible' : ''}`,
          onclick: e.bientot ? null : () => app.aller(e.id),
        }, h('h3', {}, e.titre, e.bientot ? h('span', { class: 'discret' }, ' · bientôt') : null),
        h('p', {}, DESCRIPTIONS[e.id] ?? '')))),
    );
  },
};
