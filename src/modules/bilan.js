/**
 * Bilan imprimable : une page lisible par un tiers (club, professeur), sans jargon de
 * l'application. Grade, régularité, parcours, passages de kyū, gestes forts et faibles, drills.
 * « Imprimer » ouvre la boîte d'impression du système (on peut y choisir « Enregistrer en PDF »).
 */

import { progression, aujourdhui, evaluerMotif } from '../core/progression.js';
import { grade, compteurs, LECONS_PARCOURS } from '../core/parcours.js';
import { meilleurPrekyu, PREKYU } from '../core/examen.js';
import { GRADES } from '../core/epreuves.js';
import { TOUS_LES_MOTIFS, nomMotif } from '../core/motifs.js';
import { catalogueDrills, classement } from '../core/drills.js';
import { ajouterJours } from '../core/revision.js';
import { VERSION_APPLI } from '../core/version.js';
import { formaterCadence } from '../core/maitrise.js';
import { GRILLE_DOIGTE } from '../core/doigte.js';
import { h, formaterDuree } from '../ui/dom.js';

const dateFr = (x) => new Date(`${x}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Les données du bilan (fonction pure sur la progression, testable). */
export function donneesBilan(d, date) {
  const jours = [...new Set(d.sessions.map((s) => s.date))].sort();
  const depuis30 = ajouterJours(date, -29);
  const recents = d.sessions.filter((s) => s.date >= depuis30);
  const minutes30 = Math.round(recents.reduce((t, s) => t + (s.dureeMs ?? 0), 0) / 60000);
  const n = compteurs(d);
  const validees = LECONS_PARCOURS.filter((sp) => d.paliers[sp.id]?.valide);
  const kyu = d.sessions.filter((s) => s.module === 'examen' || s.module === 'epreuves')
    .map((s) => ({ date: s.date, nom: s.module === 'examen' ? PREKYU.find((g) => g.id === s.reglages?.grade)?.nom ?? 'Examen de niveau' : GRADES.find((g) => g.id === s.reglages?.grade)?.nom ?? 'Épreuve officielle', justes: s.justes, total: s.total, reussi: s.total ? s.justes / s.total >= 0.7 : false }));
  const gestes = TOUS_LES_MOTIFS.filter((c) => d.motifs[c]?.essais >= 10).map((c) => ({ cle: c, ev: evaluerMotif(c) }));
  const tries = [...gestes].filter((g) => g.ev.temps !== null).sort((a, b) => a.ev.temps - b.ev.temps);
  const drills = catalogueDrills().filter((x) => d.records[`drill-${x.id}`]).map((x) => ({ titre: x.titre, dureeMs: d.records[`drill-${x.id}`].dureeMs, medaille: classement(x, d.records[`drill-${x.id}`].dureeMs) }));
  return {
    debut: jours[0] ?? null, joursPratique: jours.length, jours30: new Set(recents.map((s) => s.date)).size, minutes30,
    exercices: d.sessions.reduce((t, s) => t + (s.total ?? 0), 0),
    reussite: (() => { const t = d.sessions.reduce((a, s) => a + (s.total ?? 0), 0); return t ? d.sessions.reduce((a, s) => a + (s.justes ?? 0), 0) / t : null; })(),
    lecons: { total: n.leconsTotal, validees: validees.map((sp) => ({ titre: sp.titre, date: d.paliers[sp.id].valide })) },
    grade: grade(d), prekyu: meilleurPrekyu(d), kyu,
    gestesAcquis: n.gestesAcquis, gestesTotal: n.gestesTotal,
    // Les plus sûrs et les plus lents, sans qu'un même geste figure dans les deux listes.
    rapides: tries.slice(0, Math.min(3, Math.floor(tries.length / 2))), lents: tries.slice(Math.max(Math.min(3, Math.floor(tries.length / 2)), tries.length - 3)).reverse(),
    drills,
  };
}

export default {
  id: 'bilan',
  titre: 'Bilan imprimable',
  monter(el, app) {
    const d = progression();
    const b = donneesBilan(d, aujourdhui());
    const ligne = (a, x) => h('tr', {}, h('th', {}, a), h('td', {}, x));
    el.append(
      h('h1', {}, 'Bilan imprimable'),
      h('div', { class: 'ligne ecran-seul' }, h('button', { class: 'btn principal', onclick: () => window.print() }, 'Imprimer ou enregistrer en PDF'),
        h('span', { class: 'discret' }, 'Une page à montrer à un club ou à un professeur.')),
      h('div', { class: 'rapport' },
        h('h2', {}, 'Bilan de pratique du soroban'),
        h('p', {}, `Au ${dateFr(aujourdhui())}${b.debut ? `, pratique commencée le ${dateFr(b.debut)}` : ''}. Méthode : addition et soustraction sur soroban physique (gestes directs, compléments à 5 et à 10), résultats tapés et corrigés par l'application Soroban ${VERSION_APPLI}.`),
        h('h3', {}, 'En bref'),
        h('table', { class: 'tableau-rapport' },
          ligne('Grade', b.grade.obtenu ? `${b.grade.obtenu.nom} (épreuve au format japonais, réussie)` : b.prekyu ? `${b.prekyu.nom} (grade d'étape propre à l'application, sans valeur officielle)` : 'aucun pour l\'instant'),
          ligne('Prochain grade officiel', b.grade.prochain ? b.grade.prochain.nom : 'tous obtenus'),
          ligne('Leçons validées', `${b.lecons.validees.length} sur ${b.lecons.total} (chacune par un test de 15 calculs : 13 justes au moins, à une vitesse minimale)`),
          ligne('Régularité', `${b.joursPratique} jours de pratique au total ; ${b.jours30} jours et ${b.minutes30} minutes sur les 30 derniers jours`),
          ligne('Volume', `${b.exercices.toLocaleString('fr-FR')} exercices${b.reussite !== null ? `, ${Math.round(b.reussite * 100)} % de justes` : ''}`),
          ligne('Gestes acquis', `${b.gestesAcquis} sur ${b.gestesTotal} (au moins 90 % de justes, à 20 chiffres par minute au moins)`)),
        b.kyu.length ? [h('h3', {}, 'Passages d\'examen'),
          h('table', { class: 'tableau-rapport' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Examen'), h('th', {}, 'Résultat')),
            b.kyu.slice(-12).map((k) => h('tr', {}, h('td', {}, dateFr(k.date)), h('td', {}, k.nom), h('td', {}, `${k.justes} / ${k.total}${k.reussi ? ' · réussi' : ''}`))))] : null,
        b.rapides.length ? [h('h3', {}, 'Gestes'),
          h('p', {}, h('strong', {}, 'Les plus sûrs : '), b.rapides.map((g) => `${nomMotif(g.cle)} (${formaterCadence(g.ev.temps)})`).join(', '), '.'),
          h('p', {}, h('strong', {}, 'À travailler : '), b.lents.map((g) => `${nomMotif(g.cle)} (${formaterCadence(g.ev.temps)}, ${Math.round(g.ev.reussite * 100)} % de justes)`).join(', '), '.')] : null,
        b.drills.length ? [h('h3', {}, 'Suites chronométrées (drills)'),
          h('table', { class: 'tableau-rapport' }, b.drills.map((x) => h('tr', {}, h('td', {}, x.titre), h('td', {}, `${formaterDuree(x.dureeMs)}${x.medaille ? ` · ${x.medaille.nom.toLowerCase()}` : ''}`))))] : null,
        b.lecons.validees.length ? [h('h3', {}, 'Parcours : leçons validées'),
          h('ol', { class: 'liste-rapport' }, b.lecons.validees.map((l) => h('li', {}, `${l.titre} · ${dateFr(l.date)}`)))] : null,
        h('p', { class: 'discret' }, 'Limite : l\'application vérifie les résultats, pas le doigté. Un regard extérieur sur la tenue et les gestes reste précieux : voir la grille ci-dessous.'),
        // Grille d'observation du doigté : à remplir en se filmant au téléphone, ou par un tiers.
        h('div', { class: 'saut-page' },
          h('h3', {}, 'Grille d\'observation du doigté'),
          h('p', {}, 'À remplir en vous filmant au téléphone (vue de dessus, 2 minutes de colonnes), ou par un professeur. Cochez ce qui est observé.'),
          h('table', { class: 'tableau-rapport grille-doigte' },
            h('tr', {}, h('th', {}, 'Critère'), h('th', {}, 'Oui'), h('th', {}, 'À travailler')),
            GRILLE_DOIGTE.map((c, i) => h('tr', {}, h('td', {}, `${i + 1}. ${c}`), h('td', { class: 'case' }, '☐'), h('td', { class: 'case' }, '☐')))),
          h('p', {}, 'Observé le : ____________________   par : ____________________'))));
    return null;
  },
};
