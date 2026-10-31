/** Écran de progression : résumé par module et historique par jour. */

import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';
import { statistiques, progression, SEUIL_DIFFICULTE } from '../core/progression.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { nomMotif } from '../core/motifs.js';

const NOMS_MODULES = {
  lecture: 'Lecture des nombres', lecons: 'Leçons guidées', revisions: 'Révisions', planches: 'Planches', drills: 'Drills',
  muldiv: 'Multiplication et division', anzan: 'Flash anzan', defis: 'Défis chrono', epreuves: 'Épreuves officielles',
};

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

    // Leçons : avancement
    const p = progression();
    const valides = SOUS_PALIERS.filter((sp) => p.paliers[sp.id]?.valide).length;
    el.append(h('h2', {}, 'Leçons'),
      h('p', {}, `${valides} leçon${valides > 1 ? 's' : ''} validée${valides > 1 ? 's' : ''} sur ${SOUS_PALIERS.length}.`),
      h('table', {}, h('tr', {}, ['Leçon', 'Répétitions', 'Réussite', 'État'].map((x) => h('th', {}, x))),
        SOUS_PALIERS.filter((sp) => p.paliers[sp.id]).map((sp) => {
          const e = p.paliers[sp.id];
          return h('tr', {}, h('td', {}, sp.titre), h('td', {}, `${e.reps} / ${sp.repetitions}`),
            h('td', {}, formaterPourcent(e.justes, e.reps)), h('td', {}, e.valide ? `validée (boîte ${e.carte.boite})` : 'en cours'));
        })));

    // Motifs : diagnostic détaillé, du plus fragile au plus solide
    const motifs = Object.entries(p.motifs).sort(([, a], [, b]) => b.dette - a.dette || b.erreurs - a.erreurs);
    if (motifs.length) {
      el.append(h('h2', {}, 'Gestes (motifs opératoires)'),
        h('table', {}, h('tr', {}, ['Motif', 'Essais', 'Erreurs', 'Réussite', 'Diagnostic'].map((x) => h('th', {}, x))),
          motifs.map(([cle, f]) => h('tr', {}, h('td', {}, nomMotif(cle)), h('td', {}, f.essais), h('td', {}, f.erreurs),
            h('td', {}, formaterPourcent(f.essais - f.erreurs, f.essais)),
            h('td', { class: f.dette > SEUIL_DIFFICULTE ? 'a-retravailler' : '' }, f.dette > SEUIL_DIFFICULTE ? 'à retravailler' : f.erreurs ? 'en progrès' : 'acquis')))));
    }
  },
};
