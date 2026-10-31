/** Écran d'accueil : les modules et une suggestion de travail. */

import { h } from '../ui/dom.js';
import { progression, statistiques, revisionsDues, motifsEnDifficulte } from '../core/progression.js';
import { nomMotif } from '../core/motifs.js';
import { prochainSousPalier } from './lecons.js';

const DESCRIPTIONS = {
  libre: 'Manipuler le soroban et voir n\'importe quel calcul décomposé geste par geste.',
  lecture: 'Lire un nombre affiché sur le soroban, ou poser un nombre donné.',
  lecons: 'Unités, dizaines, petits amis, grands amis : démonstration, 50 répétitions, mini-test.',
  revisions: 'Révisions espacées des leçons validées (J+1, J+3, J+7, J+14, J+30).',
  planches: 'Colonnes de 5 à 10 nombres, 1 à 3 chiffres, ciblées sur un motif au choix.',
  calcul: 'Séries d\'additions et de soustractions, nombre de chiffres et de termes réglables.',
  'pas-a-pas': 'Chaque mouvement de boule est vérifié et corrigé.',
  multiplication: 'Méthode japonaise standard, avec démonstrations.',
  anzan: 'Calcul mental : des nombres défilent, donnez leur somme.',
  defis: 'Vingt calculs le plus vite possible, record personnel.',
  epreuves: 'Sujets au format des examens japonais.',
  progression: 'Historique, taux de réussite, temps moyen, points à retravailler.',
};

/** Suggestion du jour, par ordre de priorité : révisions dues, points faibles, leçon suivante. */
function suggestion() {
  const dues = revisionsDues().length;
  if (dues) return { texte: `${dues} révision${dues > 1 ? 's' : ''} à faire aujourd'hui pour garder les automatismes.`, id: 'revisions' };
  const faibles = motifsEnDifficulte();
  if (faibles.length) return { texte: `Point faible détecté : ${nomMotif(faibles[0].cle)}. Une révision ciblée le consolidera.`, id: 'revisions' };
  const { parModule } = statistiques();
  if (!parModule.lecture) {
    return { texte: 'Commencez par apprendre à lire et poser les nombres sur le soroban.', id: 'lecture' };
  }
  const sp = prochainSousPalier();
  if (sp) return { texte: `Leçon en cours : ${sp.titre}.`, id: 'lecons', params: { sousPalier: sp.id } };
  return { texte: 'Toutes les leçons sont validées. Entraînez-vous sur les planches.', id: 'planches' };
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
        h('button', { class: 'btn principal', style: 'margin-left:8px', onclick: () => app.aller(s.id, s.params) }, 'Y aller')),
      h('div', { class: 'grille' },
        app.ecrans.filter((e) => e.id !== 'accueil').map((e) => h('div', {
          class: `carte${e.bientot ? ' indisponible' : ''}`,
          onclick: e.bientot ? null : () => app.aller(e.id),
        }, h('h3', {}, e.titre, e.bientot ? h('span', { class: 'discret' }, ' · bientôt') : null),
        h('p', {}, DESCRIPTIONS[e.id] ?? '')))),
    );
  },
};
