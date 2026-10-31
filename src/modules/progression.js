/** Écran de progression : résumé par module et historique par jour. */

import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';
import { statistiques, progression, SEUIL_DIFFICULTE, evaluerMotif, evaluerPalier, reinitialiserGestes } from '../core/progression.js';
import { NIVEAUX } from '../core/maitrise.js';
import { badgeNiveau } from '../ui/niveau.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { nomMotif } from '../core/motifs.js';

const NOMS_MODULES = {
  lecture: 'Lecture des nombres', lecons: 'Leçons guidées', revisions: 'Révisions', planches: 'Planches', drills: 'Drills',
  muldiv: 'Multiplication et division', anzan: 'Flash anzan', defis: 'Défis chrono', epreuves: 'Épreuves officielles',
};

export default {
  id: 'progression',
  titre: 'Progression',
  monter(el, app) {
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

    // Leçons : avancement et niveau (juste ET rapide)
    const p = progression();
    const nf = (x) => (x === null ? '—' : `${x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`);
    const valides = SOUS_PALIERS.filter((sp) => p.paliers[sp.id]?.valide).length;
    /** Évolution de la vitesse : médiane des 10 premiers essais réussis gardés vs des 10 derniers. */
    const evolution = (hist = []) => {
      const t = hist.filter((x) => x.ok).map((x) => x.t);
      if (t.length < 20) return '—';
      const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const avant = med(t.slice(0, 10));
      const apres = med(t.slice(-10));
      const pct = Math.round((1 - apres / avant) * 100);
      return pct >= 0 ? `${pct} % plus rapide` : `${-pct} % plus lent`;
    };
    el.append(h('h2', {}, 'Leçons'),
      h('p', {}, `${valides} leçon${valides > 1 ? 's' : ''} validée${valides > 1 ? 's' : ''} sur ${SOUS_PALIERS.length}.`),
      h('table', {}, h('tr', {}, ['Leçon', 'Exercices', 'Réussite récente', 'Temps par unité', 'Évolution', 'Niveau', 'État'].map((x) => h('th', {}, x))),
        SOUS_PALIERS.filter((sp) => p.paliers[sp.id]).map((sp) => {
          const e = p.paliers[sp.id];
          const ev = evaluerPalier(sp.id, sp.type === 'addsub' ? 'addsub' : 'muldiv');
          return h('tr', {}, h('td', {}, sp.titre), h('td', {}, `${e.reps} / ${sp.repetitions}`),
            h('td', {}, ev.essais ? `${Math.round(ev.reussite * 100)} %` : formaterPourcent(e.justes, e.reps)),
            h('td', {}, nf(ev.temps)), h('td', {}, evolution(e.hist)), h('td', {}, badgeNiveau(ev)),
            h('td', {}, e.valide ? `validée (boîte ${e.carte.boite})` : 'en cours'));
        })));

    // Gestes : niveau de chacun, du plus fragile au plus solide
    const motifs = Object.entries(p.motifs).map(([cle, f]) => ({ cle, f, ev: evaluerMotif(cle) }))
      .sort((a, b) => a.ev.index - b.ev.index || b.f.dette - a.f.dette || b.f.essais - a.f.essais);
    el.append(h('h2', {}, 'Gestes'),
      h('p', { class: 'discret' }, `Un geste est acquis quand il est juste ET rapide (30 derniers essais). Seuils : ${NIVEAUX.filter((n) => n.reussite).map((n) => `${n.nom} ≥ ${Math.round(n.reussite * 100)} % et ≤ ${n.temps.addsub.toLocaleString('fr-FR')} s par chiffre`).join(' ; ')}. Une erreur n'est attribuée à un geste que si le résultat le prouve, ou si vous désignez la ligne.`));
    if (motifs.length) {
      el.append(h('table', {}, h('tr', {}, ['Geste', 'Essais', 'Erreurs avérées', 'Réussite récente', 'Temps par chiffre', 'Niveau', ''].map((x) => h('th', {}, x))),
        motifs.map(({ cle, f, ev }) => h('tr', {}, h('td', {}, nomMotif(cle)), h('td', {}, f.essais), h('td', {}, f.erreurs),
          h('td', {}, ev.essais ? `${Math.round(ev.reussite * 100)} %` : '—'), h('td', {}, nf(ev.temps)), h('td', {}, badgeNiveau(ev)),
          h('td', { class: f.dette > SEUIL_DIFFICULTE ? 'a-retravailler' : 'discret' }, f.dette > SEUIL_DIFFICULTE ? 'à retravailler' : ev.manque.length && ev.prochain ? `→ ${ev.manque.join(', ')}` : '')))));
    }
    el.append(h('button', {
      class: 'btn', style: 'margin-top:12px',
      onclick: async () => { if (window.confirm('Remettre à zéro le diagnostic des gestes ? Les leçons, révisions et records sont conservés.')) { await reinitialiserGestes(); app.aller('progression'); } },
    }, 'Remettre à zéro le diagnostic des gestes'));

  },
};
