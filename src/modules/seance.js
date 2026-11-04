/**
 * Séance du jour (écran d'accueil).
 *
 *  - En haut : série de jours, objectif du jour (minutes), grade obtenu et prochain grade.
 *  - Le plan de la séance, adapté au niveau : échauffement (drill), révisions dues,
 *    vitesse (gestes les plus lents), leçon en cours, défi de la semaine. Chaque élément
 *    se coche quand il a été fait pendant la séance.
 *  - « Finir la séance » affiche le bilan : ce qui a progressé, records, succès, et la
 *    suggestion pour demain. On peut ensuite continuer à s'entraîner librement.
 */

import {
  progression, aujourdhui, revisionsDues, seanceEnCours, commencerSeance, finirSeance,
  minutesAujourdhui, prendreAvis, reglagesUtilisateur, modifierReglages, motifsEnDifficulte,
} from '../core/progression.js';
import { serieJours } from '../core/regularite.js';
import { grade, drillEchauffement, gestesLents, niveauAddsub, anzanAdapte, placementDuJour, coursMultiplicationAtteint, prioriteDuJour, planObjectif, consolidationDuJour } from '../core/parcours.js';
import { GRADES } from '../core/epreuves.js';
import { SUCCES } from '../core/succes.js';
import { nomMotif } from '../core/motifs.js';
import { ajouterJours } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

/** Éléments du plan, avec leur état « fait pendant la séance ». */
/**
 * @param {object|null} seance  séance en cours : sa priorité du jour est FIGÉE au démarrage (sinon,
 *   une fois le plateau cassé, elle changerait ou disparaîtrait au lieu de se cocher).
 */
function plan(d, debut, seance = null) {
  const depuis = d.sessions.filter((s) => (s.horodatage ?? 0) >= debut);
  const fait = (f) => depuis.some(f);
  const items = [];
  // Priorité du jour : une consigne franche (geste à ancrer, geste lent, ou plateau à casser).
  const priorite = seance ? seance.priorite ?? null : prioriteDuJour(d, aujourdhui(), motifsEnDifficulte());
  if (priorite) {
    const [module, p] = priorite.aller;
    // Cochée seulement par l'exercice prescrit (pas par le drill d'échauffement, par exemple).
    const prescrit = (s) => s.module === module && (module === 'rythme' ? s.mode === p.jeu : !!s.reglages?.priorite);
    items.push({
      titre: `Priorité du jour · ${priorite.titre}`, detail: `${priorite.raison} ${priorite.texte}`,
      fait: fait(prescrit), aller: priorite.aller, priorite: true,
    });
  }
  const drill = drillEchauffement(d);
  items.push({
    titre: 'Échauffement', detail: `${drill.titre} (adapté à votre niveau)`,
    fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables')), aller: ['drills', { drill: drill.id }],
  });
  const dues = revisionsDues().length;
  const conso = consolidationDuJour(d, aujourdhui());
  if (conso) {
    items.push({
      titre: 'Consolidation', detail: `${conso.titre}, mélangé aux gestes précédents (10 colonnes)`,
      fait: fait((s) => s.mode === `consolidation:${conso.id}`), aller: ['planches', { consolidation: conso.id, auto: true }],
    });
  }
  if (dues) {
    items.push({
      titre: 'Révisions dues', detail: `${dues} leçon${dues > 1 ? 's' : ''} à réviser (test flash de 10 calculs)`,
      fait: dues === 0 || fait((s) => s.module === 'revisions'), aller: ['revisions'],
    });
  }
  const lents = gestesLents(d);
  if (lents.length && !priorite) {
    items.push({
      titre: 'Vitesse', detail: `vos gestes les plus lents : ${lents.map((l) => nomMotif(l.cle)).join(', ')}`,
      fait: fait((s) => s.module === 'planches' && s.mode === 'lents'), aller: ['planches', { cible: 'lents', auto: true }],
    });
  }
  // Anzan, 5 minutes : la prochaine leçon de la piste anzan si elle est ouverte (elle suit le
  // soroban avec retard), sinon une série de flash adaptée aux leçons d'anzan validées.
  const lecAnzan = prochainAnzan();
  if (lecAnzan) {
    items.push({
      titre: 'Anzan (5 min)', detail: lecAnzan.titre,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === lecAnzan.id), aller: ['lecons', { sousPalier: lecAnzan.id }],
    });
  } else if (d.paliers['p1-a']?.valide) {
    const a = anzanAdapte(d);
    items.push({
      titre: 'Anzan (5 min)', detail: `${a.questions} calculs de tête, ${a.termes} nombres à ${a.chiffres} chiffre${a.chiffres > 1 ? 's' : ''}, ${a.duree.toLocaleString('fr-FR')} s par nombre`,
      fait: fait((s) => s.module === 'anzan'), aller: ['anzan', { ...a, auto: true }],
    });
  }
  const sp = prochainSousPalier();
  // Tables : dès le cours de multiplication, 20 produits ciblés sur les plus lents.
  if (coursMultiplicationAtteint(d, sp)) {
    items.push({
      titre: 'Tables (réflexe)', detail: '20 produits, vos plus lents en priorité',
      fait: fait((s) => s.module === 'drills' && String(s.mode).startsWith('tables')), aller: ['drills', { tables: 'lents', auto: true }],
    });
  }
  // Réflexe de placement : seulement une fois arrivé au cours de multiplication, mais alors tous les jours.
  const placement = placementDuJour(d, aujourdhui(), sp);
  if (placement && placement.id !== sp?.id) {
    items.push({
      titre: 'Placement (réflexe)', detail: `${placement.titre} : 10 clics le plus vite possible`,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === placement.id), aller: ['lecons', { sousPalier: placement.id, onglet: 'entrainement' }],
    });
  }
  if (sp) {
    items.push({
      titre: 'Leçon', detail: sp.titre,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === sp.id), aller: ['lecons', { sousPalier: sp.id }],
    });
  }
  items.push({
    titre: 'Défi de la semaine', detail: 'la même feuille toute la semaine : battez votre temps',
    fait: fait((s) => s.module === 'defis' && s.mode === 'semaine'), aller: ['defis', { semaine: true }], optionnel: true,
  });
  return items;
}

/** Suggestion pour la prochaine séance. */
function conseilDemain(d) {
  const demain = ajouterJours(aujourdhui(), 1);
  const dues = Object.values(d.paliers).filter((e) => e.carte && e.carte.echeance <= demain).length;
  const parts = [];
  if (dues) parts.push(`${dues} révision${dues > 1 ? 's' : ''} prévue${dues > 1 ? 's' : ''}`);
  const faible = motifsEnDifficulte()[0];
  if (faible) parts.push(`retravailler ${nomMotif(faible.cle)}`);
  const lent = gestesLents(d, 1)[0];
  if (lent) parts.push(`accélérer ${nomMotif(lent.cle)}`);
  const sp = prochainSousPalier();
  if (sp) parts.push(`continuer « ${sp.titre} »`);
  return parts.length ? `Demain : ${parts.join(', ')}.` : 'Demain : un défi ou une épreuve pour vous mesurer.';
}

/**
 * Objectif choisi (« 6e kyū en juin ») et, en option, sa raison personnelle (« additionner un
 * ticket de courses de tête »). L'application en déduit un plan à rebours et un rythme réaliste.
 */
function carteObjectif(d, rafraichir) {
  const o = reglagesUtilisateur().objectifGrade;
  const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const formulaire = () => {
    const choixGrade = h('select', {}, GRADES.map((g) => h('option', { value: g.id }, g.nom)));
    const g = grade(d).prochain;
    choixGrade.value = o?.grade ?? g?.id ?? '10';
    const dans3mois = new Date(Date.now() + 90 * 86400000);
    const date = h('input', { type: 'date', value: o?.date ?? aujourdhui(dans3mois) });
    const pourquoi = h('input', { type: 'text', placeholder: 'Mon pourquoi (facultatif) : ex. additionner un ticket de courses de tête', value: o?.pourquoi ?? '', style: 'flex:1;min-width:260px' });
    return h('div', { class: 'reglages', style: 'margin-top:8px' }, choixGrade, date, pourquoi,
      h('button', { class: 'btn principal', onclick: async () => {
        if (!date.value) return;
        await modifierReglages({ objectifGrade: { grade: choixGrade.value, date: date.value, pourquoi: pourquoi.value.trim() } });
        rafraichir();
      } }, 'Fixer cet objectif'));
  };
  if (!o) {
    return h('details', { class: 'carte objectif' }, h('summary', {}, h('strong', {}, 'Fixer un objectif'), h('span', { class: 'discret' }, ' : un grade pour une date, et l\'application calcule le rythme qu\'il faut.')), formulaire());
  }
  const p = planObjectif(d, o.grade, o.date, aujourdhui());
  if (!p) return '';
  const dateFr = new Date(`${o.date}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  let texte;
  if (p.reussi) texte = `Objectif atteint : ${p.grade.nom} réussi. Bravo ! Fixez le suivant.`;
  else if (p.jours <= 0) texte = `La date est passée. Choisissez une nouvelle date : il reste ${p.manquantes} leçon${p.manquantes > 1 ? 's' : ''}.`;
  else if (!p.manquantes) texte = `Toutes les leçons sont validées : passez l'épreuve du ${p.grade.nom} quand vous voulez (${p.jours} jours avant l'échéance).`;
  else {
    texte = `${p.manquantes} leçon${p.manquantes > 1 ? 's' : ''} à valider en ${p.jours} jours : ${nf(p.parSemaine)} par semaine, environ ${p.minutesJour} min par jour. Votre rythme des 4 dernières semaines : ${nf(p.rythme)} par semaine. `
      + (p.realiste ? 'C\'est réaliste : tenez le rythme.' : 'C\'est ambitieux : augmentez le temps quotidien, ou repoussez la date.');
  }
  return h('details', { class: 'carte objectif' },
    h('summary', {}, h('strong', {}, `Objectif : ${p.grade.nom} le ${dateFr}`), o.pourquoi ? h('span', { class: 'discret' }, ` · ${o.pourquoi}`) : null),
    h('p', { class: p.realiste || p.reussi ? '' : 'avertissement' }, texte),
    !p.reussi && p.manquantes && p.minutesJour > reglagesUtilisateur().objectifMinutes
      ? h('button', { class: 'btn', onclick: async () => { await modifierReglages({ objectifMinutes: [5, 10, 15, 20, 30, 45, 60].find((m) => m >= p.minutesJour) ?? 60 }); rafraichir(); } }, `Passer l'objectif du jour à ${p.minutesJour} min`)
      : null,
    formulaire());
}

export default {
  id: 'seance',
  titre: 'Séance du jour',
  monter(el, app) {
    function afficher(bilan = null) {
      remplir(el);
      const d = progression();
      const dates = [...new Set(d.sessions.map((s) => s.date))];
      const serie = serieJours(dates, aujourdhui());
      const objectif = reglagesUtilisateur().objectifMinutes;
      const minutes = minutesAujourdhui();
      const g = grade(d);
      const seance = seanceEnCours();

      // --- tuiles : série, objectif, grade
      const choixObjectif = h('select', { onchange: async (e) => { await modifierReglages({ objectifMinutes: Number(e.target.value) }); afficher(bilan); } },
        [5, 10, 15, 20, 30, 45, 60].map((m) => h('option', { value: m }, `${m} min`)));
      choixObjectif.value = String(objectif);
      el.append(h('h1', {}, 'Séance du jour'),
        h('div', { class: 'tuiles' },
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Série'),
            h('div', { class: 'tuile-valeur' }, `${serie.jours} jour${serie.jours > 1 ? 's' : ''}`),
            h('div', { class: 'discret' }, serie.aujourdhuiFait ? 'aujourd\'hui : fait' : serie.jours ? 'pratiquez aujourd\'hui pour la prolonger' : 'commencez aujourd\'hui')),
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Objectif du jour ', choixObjectif),
            h('div', { class: 'tuile-valeur' }, `${Math.floor(minutes)} / ${objectif} min`),
            h('div', { class: 'jauge', role: 'progressbar', 'aria-valuenow': Math.round(minutes), 'aria-valuemax': objectif },
              h('div', { style: `width:${Math.min(100, (100 * minutes) / objectif)}%` }))),
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Grade'),
            h('div', { class: 'tuile-valeur' }, g.obtenu ? `${g.obtenu.nom} (${g.obtenu.japonais})` : 'aucun pour l\'instant'),
            h('div', { class: 'discret' }, !g.prochain ? 'Tous les kyū sont obtenus.'
              : g.pret ? `Prêt pour le ${g.prochain.nom} : tentez l'épreuve.`
                : `Prochain : ${g.prochain.nom} · ${g.manquantes.length} leçon${g.manquantes.length > 1 ? 's' : ''} à valider`))));
      prendreAvis().then((avis) => avis.forEach((a) => el.querySelector('.tuiles')?.before(h('div', { class: 'carte avis' }, a))));
      el.append(carteObjectif(d, () => afficher(bilan)));

      // --- bilan de la séance qui vient de se terminer
      if (bilan) {
        const succes = bilan.nouveauxSucces.map((id) => SUCCES.find((s) => s.id === id)?.nom).filter(Boolean);
        el.append(h('div', { class: 'carte bilan-seance' },
          h('h2', { style: 'margin-top:0' }, 'Bilan de la séance'),
          h('p', {}, `${bilan.exercices} exercice${bilan.exercices > 1 ? 's' : ''} · réussite ${formaterPourcent(bilan.justes, bilan.exercices)} · ${formaterDuree(bilan.dureeMs)} de pratique`),
          h('ul', {},
            bilan.progres.length ? bilan.progres.map((p) => h('li', {}, `▲ ${p}`)) : h('li', { class: 'discret' }, 'Pas de changement de niveau cette fois : la régularité finit toujours par payer.'),
            bilan.records.length ? h('li', {}, `${bilan.records.length} record${bilan.records.length > 1 ? 's' : ''} personnel${bilan.records.length > 1 ? 's' : ''} battu${bilan.records.length > 1 ? 's' : ''}`) : null,
            succes.length ? h('li', {}, `Succès : ${succes.join(', ')}`) : null),
          h('p', {}, h('strong', {}, conseilDemain(d))),
          h('p', { class: 'discret' }, 'Vous pouvez continuer à vous entraîner librement.')));
      }

      // --- plan
      if (!seance) {
        const apercu = plan(d, Date.now());
        el.append(h('div', { class: 'carte' },
          h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, bilan ? 'Une autre séance ?' : 'Votre séance'),
            h('button', { class: 'btn principal', onclick: async () => { await commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()) }); afficher(); } }, 'Commencer la séance')),
          h('ol', { class: 'plan' }, apercu.map((it) => h('li', { class: it.priorite ? 'priorite' : '' }, h('strong', {}, it.titre), ` · ${it.detail}${it.optionnel ? ' (facultatif)' : ''}`)))),
        niveauAddsub(d) === 0 && !d.sessions.length
          ? h('p', { class: 'discret' }, 'Première fois ? Commencez par « Lecture des nombres », puis les leçons guidées.') : '');
        return;
      }
      const items = plan(d, seance.debut, seance);
      el.append(h('div', { class: 'carte' },
        h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, `Séance en cours · commencée à ${new Date(seance.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`),
          h('button', { class: 'btn', onclick: async () => { const b = await finirSeance(); afficher(b); } }, 'Finir la séance')),
        h('div', { class: 'liste-paliers', style: 'margin-top:10px' }, items.map((it) => h('button', {
          class: `ligne-palier${it.fait ? ' valide' : ''}${it.priorite ? ' priorite' : ''}`, onclick: () => app.aller(...it.aller),
        }, h('span', { class: 'icone' }, it.fait ? '✓' : '○'), h('span', { class: 'titre' }, h('strong', {}, it.titre), ` · ${it.detail}`),
        h('span', { class: 'statut' }, it.fait ? 'fait' : it.optionnel ? 'facultatif' : 'à faire'))))));
    }
    afficher();
  },
};
