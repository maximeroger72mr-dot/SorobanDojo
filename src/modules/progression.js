/**
 * Progression : grade, régularité, carte de maîtrise des gestes, succès, puis le détail
 * (leçons, gestes, modules, jours).
 */

import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';
import {
  statistiques, progression, aujourdhui, SEUIL_DIFFICULTE, evaluerMotif, evaluerPalier, reinitialiserGestes,
} from '../core/progression.js';
import { NIVEAUX } from '../core/maitrise.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { TOUS_LES_MOTIFS, nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { minutesParJour, serieJours } from '../core/regularite.js';
import { grade, motifsAppris } from '../core/parcours.js';
import { SUCCES, prochainsSucces } from '../core/succes.js';
import { badgeNiveau } from '../ui/niveau.js';
import { calendrier, courbeVitesse, COULEUR_NIVEAU, ENCRE_NIVEAU, montrerBulle, cacherBulle } from '../ui/graphiques.js';
import { ouvrirDialogue, ouvrirDemo } from '../ui/panneauDemo.js';

const NOMS_MODULES = {
  lecture: 'Lecture des nombres', lecons: 'Leçons guidées', revisions: 'Révisions', planches: 'Planches', drills: 'Drills',
  muldiv: 'Multiplication et division', anzan: 'Flash anzan', defis: 'Défis chrono', epreuves: 'Épreuves officielles',
};
const nf = (x) => (x === null ? '—' : `${x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`);
const LIGNES_CARTE = [
  ['+', 'direct', 'Ajouter, direct'], ['+', 'petit', 'Ajouter, petit ami'], ['+', 'grand', 'Ajouter, grand ami'], ['+', 'mixte', 'Ajouter, combiné'],
  ['-', 'direct', 'Retirer, direct'], ['-', 'petit', 'Retirer, petit ami'], ['-', 'grand', 'Retirer, grand ami'], ['-', 'mixte', 'Retirer, combiné'],
];

/** Fenêtre de détail d'un geste : niveau, courbe de vitesse, démonstration, planche dédiée. */
function detailGeste(app, cle) {
  const f = progression().motifs[cle];
  const ev = evaluerMotif(cle);
  ouvrirDialogue(nomMotif(cle), gesteMotif(cle), (corps) => {
    corps.append(
      h('p', {}, badgeNiveau(ev), ` ${f ? `${f.essais} essais · ${f.erreurs} erreur${f.erreurs > 1 ? 's' : ''} avérée${f.erreurs > 1 ? 's' : ''}` : 'pas encore pratiqué'}${ev.manque.length && ev.prochain ? ` · pour « ${ev.prochain.nom} » : ${ev.manque.join(', ')}` : ''}`),
      courbeVitesse(f?.hist ?? []),
      h('div', { class: 'ligne', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: () => ouvrirDemo({ titre: nomMotif(cle), texte: gesteMotif(cle), demo: exempleMotif(cle) }) }, 'Voir le geste'),
        h('button', { class: 'btn principal', onclick: (e) => { e.target.closest('dialog').close(); app.aller('planches', { cible: cle, auto: true }); } }, 'Planche de ce geste')));
  });
}

/** Carte de maîtrise : les gestes en grille (lignes : opération et règle ; colonnes : chiffre). */
function carteMaitrise(app) {
  const d = progression();
  const appris = motifsAppris(d);
  const tableau = h('table', { class: 'carte-maitrise' },
    h('tr', {}, h('th', {}), [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('th', {}, n))),
    LIGNES_CARTE.map(([op, regle, libelle]) => h('tr', {}, h('th', { class: 'libelle' }, libelle),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
        const cle = `${op}${n}:${regle}`;
        if (!TOUS_LES_MOTIFS.includes(cle)) return h('td', { class: 'vide' });
        const ev = evaluerMotif(cle);
        const pratique = !!d.motifs[cle];
        const id = pratique ? ev.niveau.id : null;
        const cellule = h('td', {
          class: `geste${pratique ? '' : ' non-pratique'}${appris.has(cle) ? '' : ' pas-vu'}`,
          style: pratique ? `background:${COULEUR_NIVEAU[id]};color:${ENCRE_NIVEAU[id]}` : '',
          tabindex: 0,
          onclick: () => detailGeste(app, cle),
          onkeydown: (e) => { if (e.key === 'Enter') detailGeste(app, cle); },
        }, `${op === '+' ? '+' : '−'}${n}`);
        cellule.addEventListener('pointermove', (e) => montrerBulle(e, [h('strong', {}, nomMotif(cle)), h('br'),
          pratique ? `${ev.niveau.nom} · réussite ${Math.round(ev.reussite * 100)} % · ${nf(ev.temps)} par chiffre` : appris.has(cle) ? 'pas encore pratiqué' : 'leçon pas encore validée']));
        cellule.addEventListener('pointerleave', cacherBulle);
        return cellule;
      }))));
  const cascades = h('div', { class: 'ligne', style: 'margin-top:6px' }, 'Cascades :', ['cascade+', 'cascade-'].map((cle) => {
    const ev = evaluerMotif(cle);
    const pratique = !!d.motifs[cle];
    return h('button', { class: 'btn', style: pratique ? `background:${COULEUR_NIVEAU[ev.niveau.id]};color:${ENCRE_NIVEAU[ev.niveau.id]}` : '', onclick: () => detailGeste(app, cle) }, nomMotif(cle));
  }));
  const legende = h('div', { class: 'legende' },
    h('span', { class: 'pastille-legende non-pratique' }), 'pas pratiqué',
    NIVEAUX.map((n) => [h('span', { class: 'pastille-legende', style: `background:${COULEUR_NIVEAU[n.id]}` }), n.nom]));
  const acquis = TOUS_LES_MOTIFS.filter((c) => d.motifs[c] && evaluerMotif(c).index >= 2).length;
  return h('div', {},
    h('p', { class: 'discret' }, `${acquis} geste${acquis > 1 ? 's' : ''} acquis sur ${TOUS_LES_MOTIFS.length}. Cliquez une case pour voir sa courbe de vitesse, le geste animé, ou lancer une planche de ce geste.`),
    tableau, cascades, legende);
}

export default {
  id: 'progression',
  titre: 'Progression',
  monter(el, app) {
    const d = progression();
    const { parModule, parJour } = statistiques();
    const g = grade(d);
    const serie = serieJours([...new Set(d.sessions.map((s) => s.date))], aujourdhui());
    el.append(h('h1', {}, 'Progression'));

    // Grade et régularité
    el.append(h('div', { class: 'tuiles' },
      h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Grade obtenu'),
        h('div', { class: 'tuile-valeur' }, g.obtenu ? `${g.obtenu.nom} (${g.obtenu.japonais})` : 'aucun'),
        h('div', { class: 'discret' }, !g.prochain ? 'Tous les kyū sont obtenus.' : g.pret ? `Prêt à tenter le ${g.prochain.nom}.` : `Pour le ${g.prochain.nom} : ${g.manquantes.slice(0, 3).map((s) => s.titre).join(', ')}${g.manquantes.length > 3 ? ` et ${g.manquantes.length - 3} autres` : ''}.`)),
      h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Série'),
        h('div', { class: 'tuile-valeur' }, `${serie.jours} jour${serie.jours > 1 ? 's' : ''}`),
        h('div', { class: 'discret' }, 'Un jour de repos par semaine ne casse pas la série.'))));
    el.append(h('h2', {}, 'Régularité'), calendrier(minutesParJour(d.sessions), aujourdhui()));

    // Carte de maîtrise
    el.append(h('h2', {}, 'Carte de maîtrise des gestes'), carteMaitrise(app));

    // Succès
    const obtenus = Object.keys(d.succes ?? {});
    const prochains = prochainsSucces(obtenus);
    el.append(h('h2', {}, `Succès (${obtenus.length} / ${SUCCES.length})`),
      h('div', { class: 'grille-succes' },
        SUCCES.filter((s) => obtenus.includes(s.id)).map((s) => h('div', { class: 'succes obtenu', title: s.description },
          h('strong', {}, s.nom), h('div', { class: 'discret' }, `${s.theme} · ${new Date(`${d.succes[s.id]}T12:00`).toLocaleDateString('fr-FR')}`)))),
      h('h3', {}, 'Prochains succès à votre portée'),
      h('div', { class: 'grille-succes' }, prochains.map((s) => h('div', { class: 'succes' }, h('strong', {}, s.nom), h('div', { class: 'discret' }, `${s.theme} · ${s.description}`)))));

    if (Object.keys(parModule).length === 0) {
      el.append(h('p', { class: 'discret' }, 'Vos résultats détaillés apparaîtront ici après vos premières séries.'));
      return;
    }

    // Leçons
    const evolution = (hist = []) => {
      const t = hist.filter((x) => x.ok).map((x) => x.t);
      if (t.length < 20) return '—';
      const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const pct = Math.round((1 - med(t.slice(-10)) / med(t.slice(0, 10))) * 100);
      return pct >= 0 ? `${pct} % plus rapide` : `${-pct} % plus lent`;
    };
    const valides = SOUS_PALIERS.filter((sp) => d.paliers[sp.id]?.valide).length;
    el.append(h('h2', {}, 'Leçons'),
      h('p', {}, `${valides} leçon${valides > 1 ? 's' : ''} validée${valides > 1 ? 's' : ''} sur ${SOUS_PALIERS.length}.`),
      h('table', {}, h('tr', {}, ['Leçon', 'Exercices', 'Réussite récente', 'Temps par unité', 'Évolution', 'Niveau', 'État'].map((x) => h('th', {}, x))),
        SOUS_PALIERS.filter((sp) => d.paliers[sp.id]).map((sp) => {
          const e = d.paliers[sp.id];
          const ev = evaluerPalier(sp.id, sp.type === 'addsub' ? 'addsub' : 'muldiv');
          return h('tr', {}, h('td', {}, sp.titre), h('td', {}, `${e.reps} / ${sp.repetitions}`),
            h('td', {}, ev.essais ? `${Math.round(ev.reussite * 100)} %` : formaterPourcent(e.justes, e.reps)),
            h('td', {}, nf(ev.temps)), h('td', {}, evolution(e.hist)), h('td', {}, badgeNiveau(ev)),
            h('td', {}, e.valide ? `validée (boîte ${e.carte.boite})` : 'en cours'));
        })));

    // Gestes : tableau détaillé (vue tableau de la carte de maîtrise)
    const motifs = Object.entries(d.motifs).map(([cle, f]) => ({ cle, f, ev: evaluerMotif(cle) }))
      .sort((a, b) => a.ev.index - b.ev.index || b.f.dette - a.f.dette || b.f.essais - a.f.essais);
    if (motifs.length) {
      el.append(h('h2', {}, 'Gestes en détail'),
        h('p', { class: 'discret' }, `Seuils : ${NIVEAUX.filter((n) => n.reussite).map((n) => `${n.nom} ≥ ${Math.round(n.reussite * 100)} % et ≤ ${n.temps.addsub.toLocaleString('fr-FR')} s par chiffre`).join(' ; ')}.`),
        h('table', {}, h('tr', {}, ['Geste', 'Essais', 'Erreurs avérées', 'Réussite récente', 'Temps par chiffre', 'Niveau', ''].map((x) => h('th', {}, x))),
          motifs.map(({ cle, f, ev }) => h('tr', { class: 'cliquable', onclick: () => detailGeste(app, cle) }, h('td', {}, nomMotif(cle)), h('td', {}, f.essais), h('td', {}, f.erreurs),
            h('td', {}, ev.essais ? `${Math.round(ev.reussite * 100)} %` : '—'), h('td', {}, nf(ev.temps)), h('td', {}, badgeNiveau(ev)),
            h('td', { class: f.dette > SEUIL_DIFFICULTE ? 'a-retravailler' : 'discret' }, f.dette > SEUIL_DIFFICULTE ? 'à retravailler' : ev.manque.length && ev.prochain ? `→ ${ev.manque.join(', ')}` : '')))),
        h('button', {
          class: 'btn', style: 'margin-top:12px',
          onclick: async () => { if (window.confirm('Remettre à zéro le diagnostic des gestes ? Les leçons, révisions et records sont conservés.')) { await reinitialiserGestes(); app.aller('progression'); } },
        }, 'Remettre à zéro le diagnostic des gestes'));
    }

    // Modules et jours
    const ligne = (nom, t) => h('tr', {}, h('td', {}, nom), h('td', {}, t.sessions), h('td', {}, t.total),
      h('td', {}, formaterPourcent(t.justes, t.total)), h('td', {}, formaterDuree(t.dureeMs / Math.max(1, t.total))));
    const entete = (premier) => h('tr', {}, [premier, 'Séries', 'Exercices', 'Réussite', 'Temps moyen'].map((x) => h('th', {}, x)));
    el.append(h('h2', {}, 'Par activité'),
      h('table', {}, entete('Activité'), Object.entries(parModule).map(([id, t]) => ligne(NOMS_MODULES[id] ?? id, t))),
      h('h2', {}, 'Par jour'),
      h('table', {}, entete('Date'), Object.entries(parJour).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30)
        .map(([date, t]) => ligne(new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), t))));
  },
};
