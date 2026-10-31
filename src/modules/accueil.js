/** Écran d'accueil : les modules et une suggestion de travail. */

import { h } from '../ui/dom.js';
import { progression, statistiques, revisionsDues, motifsEnDifficulte, prendreAvis } from '../core/progression.js';
import { nomMotif } from '../core/motifs.js';
import { prochainSousPalier } from './lecons.js';

const DESCRIPTIONS = {
  lecons: 'Le parcours : gestes directs, petits amis, grands amis, combinaisons, multiplication, division.',
  revisions: 'Révisions espacées des leçons validées (J+1, J+3, J+7, J+14, J+30).',
  planches: 'Feuilles de colonnes imprimables, ciblées sur un ami précis pour en répéter le geste.',
  drills: '123456789 et ses variantes, même nombre répété, suite des entiers. Chronométrés.',
  muldiv: 'Multiplication (両落とし) et division (片落とし) : démonstrations et séries.',
  anzan: 'Calcul mental : des nombres défilent, donnez leur somme.',
  defis: 'Le plus vite possible, avec record personnel.',
  epreuves: 'Sujets au format des examens japonais, du 10e au 1er kyū.',
  lecture: 'Lire un soroban, poser un nombre sur le vôtre.',
  libre: 'Le soroban virtuel pour voir n\'importe quel calcul geste par geste.',
  progression: 'Historique, réussite, temps, points faibles.',
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
    prendreAvis().then((avis) => avis.forEach((a) => el.prepend(h('div', { class: 'carte avis' }, a))));
    const premiereFois = progression().sessions.length === 0;
    el.append(
      h('h1', {}, 'Apprendre le soroban'),
      h('p', { class: 'discret' }, premiereFois
        ? 'Bienvenue. Gardez votre soroban devant vous : l\'application vous donne les calculs, corrige vos résultats et vous montre les gestes quand il le faut.'
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
