/**
 * Progression : grade, régularité, carte de maîtrise des gestes, succès, puis le détail
 * (leçons, gestes, modules, jours).
 */

import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';
import {
  statistiques, progression, aujourdhui, SEUIL_DIFFICULTE, evaluerMotif, evaluerPalier, reinitialiserGestes,
  exporterDonnees, importerDonnees,
} from '../core/progression.js';
import { NIVEAUX } from '../core/maitrise.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { TOUS_LES_MOTIFS, nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { minutesParJour, serieJours } from '../core/regularite.js';
import { grade } from '../core/parcours.js';
import { SUCCES, prochainsSucces } from '../core/succes.js';
import { badgeNiveau } from '../ui/niveau.js';
import { calendrier, courbeVitesse, COULEUR_NIVEAU, ENCRE_NIVEAU } from '../ui/graphiques.js';
import { carteMaitrise } from '../ui/carteMaitrise.js';
import { ouvrirDialogue, ouvrirDemo } from '../ui/panneauDemo.js';

const NOMS_MODULES = {
  lecture: 'Lecture des nombres', lecons: 'Leçons guidées', revisions: 'Révisions', planches: 'Planches', drills: 'Drills',
  muldiv: 'Multiplication et division', anzan: 'Flash anzan', defis: 'Défis chrono', epreuves: 'Épreuves officielles', dictee: 'Dictée (yomiage)',
};
const nf = (x) => (x === null ? '—' : `${x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`);

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

/** Carte de maîtrise (consultation) avec les cascades et le décompte des gestes acquis. */
function carte(app) {
  const d = progression();
  const cascades = h('div', { class: 'ligne', style: 'margin-top:6px' }, 'Cascades :', ['cascade+', 'cascade-'].map((cle) => {
    const ev = evaluerMotif(cle);
    const pratique = !!d.motifs[cle];
    return h('button', { class: 'btn', style: pratique ? `background:${COULEUR_NIVEAU[ev.niveau.id]};color:${ENCRE_NIVEAU[ev.niveau.id]}` : '', onclick: () => detailGeste(app, cle) }, nomMotif(cle));
  }));
  const acquis = TOUS_LES_MOTIFS.filter((c) => d.motifs[c] && evaluerMotif(c).index >= 2).length;
  return h('div', {},
    h('p', { class: 'discret' }, `${acquis} geste${acquis > 1 ? 's' : ''} acquis sur ${TOUS_LES_MOTIFS.length}. Cliquez une case pour voir sa courbe de vitesse, le geste animé, ou lancer une planche de ce geste.`),
    carteMaitrise({ surClic: (cle) => detailGeste(app, cle) }), cascades);
}

/** Sauvegarde : export (fichier, presse-papiers) et import (remplacer ou fusionner). */
function sectionSauvegarde(app) {
  const message = h('p', { class: 'discret' });
  const telecharger = () => {
    const blob = new Blob([exporterDonnees()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `soroban-sauvegarde-${aujourdhui()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    message.textContent = 'Fichier de sauvegarde créé (dossier Téléchargements).';
  };
  const copier = async () => {
    const texte = exporterDonnees();
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      const zone = h('textarea', {}, texte);
      document.body.append(zone);
      zone.select();
      document.execCommand('copy');
      zone.remove();
    }
    message.textContent = 'Sauvegarde copiée dans le presse-papiers.';
  };
  const importer = () => ouvrirDialogue('Importer une sauvegarde', 'Choisissez un fichier .json exporté, ou collez le texte copié.', (corps) => {
    const fichier = h('input', { type: 'file', accept: '.json,application/json' });
    const zone = h('textarea', { class: 'zone-import', placeholder: 'ou collez ici le texte de la sauvegarde' });
    const mode = h('select', {}, h('option', { value: 'fusionner' }, 'Fusionner avec mes données (garder le meilleur des deux)'), h('option', { value: 'remplacer' }, 'Remplacer mes données'));
    const erreur = h('p', { class: 'retour erreur' });
    fichier.addEventListener('change', async () => { zone.value = await fichier.files[0]?.text() ?? ''; });
    corps.append(fichier, zone, h('div', { class: 'ligne' }, mode,
      h('button', { class: 'btn principal', onclick: async (e) => {
        try {
          if (mode.value === 'remplacer' && !window.confirm('Remplacer toutes vos données actuelles par cette sauvegarde ?')) return;
          await importerDonnees(zone.value, mode.value);
          e.target.closest('dialog').close();
          app.aller('progression');
        } catch (err) {
          erreur.textContent = err.message;
        }
      } }, 'Importer')), erreur);
    return null;
  });
  return h('div', {}, h('h2', {}, 'Sauvegarde'),
    h('p', { class: 'discret' }, 'Exportez vos données pour les garder en lieu sûr, ou pour passer de la version navigateur (Soroban.html) à l\'application, et inversement. L\'application de bureau garde aussi une copie automatique par jour (5 dernières).'),
    h('div', { class: 'ligne' },
      h('button', { class: 'btn', onclick: telecharger }, 'Exporter (fichier .json)'),
      h('button', { class: 'btn', onclick: copier }, 'Copier dans le presse-papiers'),
      h('button', { class: 'btn', onclick: importer }, 'Importer une sauvegarde')),
    message);
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
    el.append(h('h2', {}, 'Carte de maîtrise des gestes'), carte(app));

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
      el.append(h('p', { class: 'discret' }, 'Vos résultats détaillés apparaîtront ici après vos premières séries.'), sectionSauvegarde(app));
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
            h('td', {}, !e.valide ? 'en cours' : e.carte ? `validée (boîte ${e.carte.boite})` : sp.type === 'theorie' ? 'lue' : 'validée'));
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
    el.append(sectionSauvegarde(app));
  },
};
