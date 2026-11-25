/**
 * Grades : une seule page pour les deux échelles, sans les mélanger.
 *  - une frise unique du 20e au 1er kyū : les kyū de l'application (20e → 11e, propres à
 *    l'application) d'une couleur, les kyū officiels (10e → 1er, format japonais) d'une autre ;
 *  - votre niveau actuel, toujours visible ;
 *  - deux boutons distincts : « Passage de kyū (prép.) » et « Épreuve officielle ».
 */

import { progression, aujourdhui } from '../core/progression.js';
import { PREKYU, prekyuObtenu, examenDeLaSemaine, resultatSemaine, libelleGrade } from '../core/examen.js';
import { systemeChoisi, SYSTEMES } from '../core/epreuves.js';
import { grade } from '../core/parcours.js';
import { h } from '../ui/dom.js';

/** Les 20 marches de la frise, du 20e au 1er kyū, avec leur état. */
export function frise(d) {
  const g = grade(d);
  const prep = PREKYU.map((x) => ({ id: `p${x.id}`, court: `${x.id}e`, nom: x.nom, officiel: false, obtenu: prekyuObtenu(d, x) }));
  const sys = systemeChoisi(d);
  // 0.41 : un kyū officiel est obtenu avec ses deux épreuves (Nisshō et Zenkoren) ; une seule : à moitié.
  const ok = (s, x) => s.grades.slice(s.grades.findIndex((y) => y.id === x.id)).some((y) => !!d.records[s.record(y.id)]?.reussi);
  const off = sys.grades.map((x) => {
    const n = ok(SYSTEMES.nissho, x);
    const z = ok(SYSTEMES.zenkoren, x);
    return { id: `o${x.id}`, court: x.id === '1' ? '1er' : `${x.id}e`, nom: `${x.nom} (Nisshō ${n ? '✓' : '—'}, Zenkoren ${z ? '✓' : '—'})`, officiel: true, obtenu: n && z, moitie: n !== z };
  });
  const marches = [...prep, ...off];
  // Le grade « actuel » est le plus haut obtenu, toutes échelles confondues.
  let actuel = -1;
  marches.forEach((m, i) => { if (m.obtenu) actuel = i; });
  if (g.obtenu) actuel = Math.max(actuel, marches.findIndex((m) => m.id === `o${g.obtenu.id}`));
  return marches.map((m, i) => ({ ...m, actuel: i === actuel }));
}

export default {
  id: 'grades',
  titre: 'Grades',
  monter(el, app) {
    const d = progression();
    const marches = frise(d);
    const niveau = libelleGrade(d);
    const exam = examenDeLaSemaine(d);
    const r = resultatSemaine(d, aujourdhui());
    const g = grade(d);
    el.append(h('h1', {}, 'Grades'),
      h('p', { class: 'discret chapeau' }, 'Une seule échelle. Du 20e au 11e kyū : le passage de kyū de l\'application, qui jalonne le parcours (sans valeur officielle). Du 10e au 1er : les épreuves au format japonais ; le kyū est obtenu quand les DEUX sont réussies, Nisshō et Zenkoren.'),
      h('div', { class: 'carte' },
        h('p', { style: 'margin-top:0' }, h('strong', {}, 'Votre grade : '), niveau.valeur),
        h('ol', { class: 'frise-grades', 'aria-label': 'Du 20e au 1er kyū' }, marches.map((m) => h('li', {
          class: `marche ${m.officiel ? 'officiel' : 'prep'}${m.obtenu ? ' obtenu' : ''}${m.moitie ? ' moitie' : ''}${m.actuel ? ' actuel' : ''}`,
          title: `${m.nom}${m.obtenu ? ' : obtenu' : ''}`,
        }, m.court))),
        h('p', { class: 'legende-frise discret' },
          h('span', { class: 'puce prep' }), ' 20e au 11e (application) ', h('span', { class: 'puce officiel' }), ' 10e au 1er (Nisshō + Zenkoren ; à moitié : une seule épreuve réussie)')),
      h('div', { class: 'cartes' },
        h('button', { class: `carte-hub${exam ? ' recommande' : ''}`, onclick: () => app.aller('examen') },
          h('strong', {}, 'Passage de kyū (20e au 11e)'),
          h('span', {}, 'L\'examen de votre niveau, ouvert en permanence : 20 colonnes chronométrées, 70 % pour réussir. Un échec ne coûte rien.'),
          h('span', { class: 'carte-info' }, exam ? (r ? `${exam.nom} : ${r.points} / ${r.total} cette semaine${r.reussi ? ' ✓' : ''}` : `${exam.nom} : quand vous voulez`) : 'Après les trois premières leçons de gestes directs')),
        h('button', { class: `carte-hub${g.pret ? ' recommande' : ''}`, onclick: () => app.aller('epreuves') },
          h('strong', {}, 'Épreuve officielle'),
          h('span', {}, `Les vrais kyū (10e au 1er), au format des examens japonais : additions, multiplications, divisions. Chaque kyū demande ses deux épreuves, Nisshō et Zenkoren ; on commence par ${systemeChoisi(d).nom} (à changer dans les épreuves).`),
          h('span', { class: `carte-info${g.pret ? ' a-faire' : ''}` }, niveau.detail))));
    return null;
  },
};
