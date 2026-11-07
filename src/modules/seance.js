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
  minutesAujourdhui, prendreAvis, reglagesUtilisateur, modifierReglages, motifsEnDifficulte, versionNavigateur,
} from '../core/progression.js';
import { telechargerExport } from '../ui/exporter.js';
import { serieJours } from '../core/regularite.js';
import { grade, drillEchauffement, gestesLents, anzanAdapte, placementDuJour, coursMultiplicationAtteint, prioriteDuJour, planObjectif, consolidationDuJour } from '../core/parcours.js';
import { GRADES } from '../core/epreuves.js';
import { SUCCES } from '../core/succes.js';
import { nomMotif } from '../core/motifs.js';
import { ajouterJours } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { decisionDuJour, jeuDuJour, motDuProf } from '../core/prof.js';
import { examenDeLaSemaine, resultatSemaine, minutesExamen, libelleGrade } from '../core/examen.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';
import { rangee } from '../ui/perles.js';

/** Jours pratiqués parmi les 7 derniers (aujourd'hui compris). */
const septJours = (dates) => { const j = aujourdhui(); return dates.filter((x) => x <= j && x > ajouterJours(j, -7)).length; };

/**
 * Le plan du jour, comme un prof : l'ESSENTIEL (ce qui fait progresser vers l'objectif, dans
 * l'ordre), puis le BONUS (le plaisir, qui entraîne aussi). Chaque point a une durée estimée
 * et se coche quand il a été fait pendant la séance.
 * @param {object|null} seance  séance en cours : sa priorité et sa décision sont FIGÉES au
 *   démarrage (sinon, une fois le plateau cassé, elles changeraient au lieu de se cocher).
 * @returns {{ essentiel: object[], bonus: object[], mot: string[], minutes: number }}
 */
function plan(d, debut, seance = null) {
  const date = aujourdhui();
  const depuis = d.sessions.filter((s) => (s.horodatage ?? 0) >= debut);
  const fait = (f) => depuis.some(f);
  const essentiel = [];
  const bonus = [];
  const sp = prochainSousPalier();

  // 1. Échauffement : le prochain drill à valider (3 min).
  const drill = drillEchauffement(d);
  essentiel.push({ titre: 'Échauffement', detail: drill.titre, minutes: 3,
    fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables')), aller: ['drills', { drill: drill.id }] });
  // 2. Révisions dues : la mémoire avant tout.
  const dues = revisionsDues().length;
  if (dues) {
    essentiel.push({ titre: 'Révisions', detail: `${dues} leçon${dues > 1 ? 's' : ''} à revoir (10 calculs chacune)`, minutes: 3 * dues,
      fait: fait((s) => s.module === 'revisions'), aller: ['revisions'] });
  }
  // 3. Passage de kyū : ouvert en permanence, proposé en bonus (en tête) ; aucune échéance, aucune
  //    pression. Il ne passe dans l'essentiel que le jour où on l'a passé, pour le voir coché.
  const exam = examenDeLaSemaine(d);
  const examFait = resultatSemaine(d, date);
  const examObtenu = exam && exam.id !== 'hebdo' && d.records[`prekyu-${exam.id}`]?.reussi;
  const itemExamen = exam ? { titre: `Passage de kyū · ${exam.nom}`, detail: examFait ? `${examFait.points} / ${examFait.total} cette semaine${examFait.reussi ? ', réussi' : ', pas encore : retentez quand vous voulez'}` : `20 colonnes en ${minutesExamen(exam)} min, quand vous vous sentez prêt`, minutes: minutesExamen(exam),
    fait: !!examFait, aller: ['examen', {}], examen: true } : null;
  const passeAujourdhui = fait((s) => s.module === 'examen');
  const examEssentiel = itemExamen && passeAujourdhui;
  if (examEssentiel) essentiel.push(itemExamen);
  // 4. Priorité du jour : le geste à ancrer, à accélérer, ou le plateau à casser.
  const priorite = seance ? seance.priorite ?? null : prioriteDuJour(d, date, motifsEnDifficulte());
  if (priorite) {
    const [module, p] = priorite.aller;
    const prescrit = (s) => s.module === module && (module === 'rythme' ? s.mode === p.jeu : !!s.reglages?.priorite);
    essentiel.push({ titre: priorite.titre, detail: `${priorite.raison} ${priorite.texte}`, minutes: 8, fait: fait(prescrit), aller: priorite.aller, priorite: true });
  }
  // 5. Avancer ou ancrer : la décision du prof.
  const decision = seance?.decision ?? decisionDuJour(d, date, sp);
  essentiel.push({ titre: decision.titre, detail: decision.detail, minutes: decision.minutes, aller: decision.aller, decision: true,
    fait: fait((s) => (decision.aller[0] === 'lecons' ? s.module === 'lecons' && s.reglages?.sousPalier === decision.aller[1].sousPalier
      : s.module === 'rythme' && s.mode === 'marathon' && (!decision.cibles || (s.reglages?.cibles ?? []).includes(decision.cibles[0])))) });
  // 6. Consolidation (2 à 7 jours après une leçon) : mélanger pour retenir.
  const conso = consolidationDuJour(d, date);
  if (conso) {
    essentiel.push({ titre: 'Consolidation', detail: `${conso.titre}, mélangé aux gestes précédents (10 colonnes)`, minutes: 5,
      fait: fait((s) => s.mode === `consolidation:${conso.id}`), aller: ['planches', { consolidation: conso.id, auto: true }] });
  }
  // 7. Multiplication / division : tables et placement deviennent des réflexes quotidiens.
  if (coursMultiplicationAtteint(d, sp)) {
    essentiel.push({ titre: 'Tables (réflexe)', detail: '20 produits, vos plus lents en priorité', minutes: 3,
      fait: fait((s) => s.module === 'drills' && String(s.mode).startsWith('tables')), aller: ['drills', { tables: 'lents', auto: true }] });
  }
  const placement = placementDuJour(d, date, sp);
  if (placement && placement.id !== sp?.id) {
    essentiel.push({ titre: 'Placement (réflexe)', detail: `${placement.titre} : 10 clics le plus vite possible`, minutes: 2,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === placement.id), aller: ['lecons', { sousPalier: placement.id, onglet: 'entrainement' }] });
  }

  // ---- Bonus
  if (itemExamen && !examEssentiel && !examObtenu) bonus.unshift(itemExamen);
  const lecAnzan = prochainAnzan();
  if (lecAnzan) {
    bonus.push({ titre: 'Anzan', detail: lecAnzan.titre, minutes: 5,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === lecAnzan.id), aller: ['lecons', { sousPalier: lecAnzan.id }] });
  } else if (d.paliers['p1-a']?.valide) {
    const a = anzanAdapte(d);
    bonus.push({ titre: 'Anzan', detail: `${a.questions} calculs de tête, ${a.termes} nombres, ${a.duree.toLocaleString('fr-FR')} s par nombre`, minutes: 5,
      fait: fait((s) => s.module === 'anzan'), aller: ['anzan', { ...a, auto: true }] });
  }
  const jeu = jeuDuJour(d, date);
  bonus.push({ titre: `Jeu du jour · ${jeu.titre}`, detail: jeu.detail, minutes: 5,
    fait: fait((s) => (s.module === 'jeux' && String(s.mode).startsWith(jeu.mode)) || (s.module === 'defis' && s.mode === jeu.mode)), aller: jeu.aller });
  bonus.push({ titre: 'Défi de la semaine', detail: 'la même feuille toute la semaine : gagnez les 3 étoiles', minutes: 5,
    fait: fait((s) => s.module === 'defis' && ['semaine', 'sans-filet'].includes(s.mode)), aller: ['defis', { semaine: true }] });
  if (d.reglages?.objectifGrade?.pourquoi || new Date(`${date}T12:00`).getDay() === 3) {
    bonus.push({ titre: 'Au quotidien', detail: 'ticket de caisse, monnaie, pourcentages', minutes: 5, fait: fait((s) => s.module === 'quotidien'), aller: ['quotidien'] });
  }

  const minutes = essentiel.reduce((t, it) => t + it.minutes, 0);
  const mot = motDuProf(d, date, decision, minutes, reglagesUtilisateur().objectifMinutes, essentiel.length);
  return { essentiel, bonus, mot, minutes, decision };
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
    const dateR = new Date(`${p.dateRealiste}T12:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const duree = p.moisRestants >= 12 ? `${nf(p.moisRestants / 12)} an${p.moisRestants >= 24 ? 's' : ''}` : `${Math.round(p.moisRestants)} mois`;
    const lecons = p.manquantes ? `${p.manquantes} leçon${p.manquantes > 1 ? 's' : ''} à valider (${nf(p.parSemaine)} par semaine ; votre rythme : ${nf(p.rythme)}). ` : 'Toutes les leçons sont validées. ';
    const repere = `Repère : il faut en général encore ${duree} de pratique quotidienne pour le ${p.grade.nom}, car la vitesse et l'endurance exigées à l'examen se construisent en drillant, pas seulement en validant des leçons. `;
    if (p.verdict === 'realiste') texte = `${lecons}${repere}C'est réaliste avec environ ${p.minutesJour} min par jour : tenez le rythme.`;
    else if (p.verdict === 'ambitieux') texte = `${lecons}${repere}C'est ambitieux : il faudrait environ ${p.minutesJour} min par jour, tous les jours. Une date réaliste : ${dateR}.`;
    else texte = `${lecons}${repere}Ce n'est pas réaliste pour cette date : visez plutôt ${dateR}${p.atteignable ? `, et d'ici là, le ${p.atteignable.nom} est un bon objectif intermédiaire` : ''}.`;
  }
  return h('details', { class: 'carte objectif' },
    h('summary', {}, h('strong', {}, `Objectif : ${p.grade.nom} le ${dateFr}`), o.pourquoi ? h('span', { class: 'discret' }, ` · ${o.pourquoi}`) : null),
    h('p', { class: p.realiste || p.reussi ? '' : 'avertissement' }, texte),
    h('p', { class: 'discret' }, 'Ces durées sont des repères prudents pour un adulte qui pratique chaque jour, pas des chiffres officiels : chacun avance à son rythme.'),
    !p.reussi && p.verdict !== 'irrealiste' && p.minutesJour > reglagesUtilisateur().objectifMinutes
      ? h('button', { class: 'btn', onclick: async () => { await modifierReglages({ objectifMinutes: [5, 10, 15, 20, 30, 45, 60].find((m) => m >= p.minutesJour) ?? 60 }); rafraichir(); } }, `Passer l'objectif du jour à ${p.minutesJour} min`)
      : null,
    formulaire());
}

export default {
  id: 'seance',
  titre: 'Séance du jour',
  badge: () => revisionsDues().length,
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
      const premiereFois = !d.sessions.length && !Object.values(d.paliers).some((x) => x.valide);
      if (premiereFois) {
        // Premier lancement : une seule action, pas de compteurs à zéro.
        const sp = prochainSousPalier();
        el.append(h('h1', {}, 'Bienvenue'),
          h('div', { class: 'carte accueil' },
            h('p', {}, 'Ici, on apprend le soroban sur un VRAI soroban : l\'application propose les calculs, vous les faites avec vos doigts, puis vous tapez le résultat. Elle corrige, explique, et décide chaque jour de la suite.'),
            h('p', {}, 'Installez votre soroban devant vous, un crayon à portée de main, et commencez par la première leçon : elle montre comment le tenir et lire un nombre.'),
            h('button', { class: 'btn principal grand-bouton', onclick: async () => { await commencerSeance({}); app.aller('lecons', { sousPalier: sp?.id }); } }, `Commencer : ${sp?.titre ?? 'leçon 0'} →`)));
        return;
      }
      el.append(h('h1', {}, 'Séance du jour'),
        h('div', { class: 'tuiles' },
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Série'),
            h('div', { class: 'tuile-valeur' }, `${serie.jours} jour${serie.jours > 1 ? 's' : ''}`),
            h('div', { class: 'serie-perles' }, rangee(septJours(dates), 7, `${septJours(dates)} jours de pratique sur les 7 derniers`)),
            h('div', { class: 'discret' }, serie.aujourdhuiFait ? 'aujourd\'hui : fait' : serie.jours ? 'pratiquez aujourd\'hui pour la prolonger' : 'commencez aujourd\'hui')),
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Objectif du jour ', choixObjectif),
            h('div', { class: 'tuile-valeur' }, `${Math.floor(minutes)} / ${objectif} min`),
            h('div', { class: 'jauge', role: 'progressbar', 'aria-valuenow': Math.round(minutes), 'aria-valuemax': objectif },
              h('div', { style: `width:${Math.min(100, (100 * minutes) / objectif)}%` }))),
          h('div', { class: 'tuile' }, h('div', { class: 'tuile-titre' }, 'Grade'),
            h('div', { class: 'tuile-valeur' }, libelleGrade(d).valeur),
            h('div', { class: 'discret' }, libelleGrade(d).detail))));
      prendreAvis().then((avis) => avis.forEach((a) => el.querySelector('.tuiles')?.before(h('div', { class: 'carte avis' }, a))));
      // Version navigateur : rappel d'export (les données ne vivent que dans ce navigateur).
      const premiere = d.sessions[0]?.date;
      if (versionNavigateur && premiere && premiere <= ajouterJours(aujourdhui(), -7) && (!d.dernierExport || d.dernierExport <= ajouterJours(aujourdhui(), -14))) {
        el.append(h('div', { class: 'carte avis ligne' },
          h('span', { style: 'flex:1' }, d.dernierExport ? `Dernier export de votre progression : il y a plus de 14 jours.` : 'Vous n\'avez encore jamais exporté votre progression.', ' Elle ne vit que dans ce navigateur : un nettoyage des données de navigation l\'effacerait.'),
          h('button', { class: 'btn', onclick: async () => { await telechargerExport(); afficher(bilan); } }, 'Exporter maintenant')));
      }
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

      // --- le prof et le plan
      const p = plan(d, seance ? seance.debut : Date.now(), seance);
      // Chaque ligne s'ouvre d'un clic ; si la séance n'est pas commencée, le clic la commence
      // (la pastille du menu mène ici : la révision doit être accessible tout de suite).
      const demarrer = () => commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()), decision: p.decision });
      const ligne = (it, i) => h('button', {
        class: `ligne-palier${it.fait ? ' valide' : ''}${it.priorite ? ' priorite' : ''}`,
        onclick: async () => { if (!seanceEnCours()) await demarrer(); app.aller(...it.aller); },
      }, h('span', { class: `icone${it.fait ? ' etat-fait' : ' numero'}` }, it.fait ? '✓' : i !== null ? String(i + 1) : '+'), h('span', { class: 'titre' }, h('strong', {}, it.titre), ` · ${it.detail}`),
      h('span', { class: 'statut' }, it.fait ? 'fait' : `${it.minutes} min`));
      el.append(h('div', { class: 'carte mot-prof' }, h('div', { class: 'mot-prof-titre' }, 'Le mot du prof'), p.mot.map((x) => h('p', {}, x))));
      const entete = seance
        ? h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, `Séance en cours · commencée à ${new Date(seance.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`),
          h('button', { class: 'btn', onclick: async () => { const b = await finirSeance(); afficher(b); } }, 'Finir la séance'))
        : h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, bilan ? 'Une autre séance ?' : 'Votre séance'),
          h('button', { class: 'btn principal', onclick: async () => { await demarrer(); afficher(); } }, 'Commencer la séance'));
      el.append(h('div', { class: 'carte' }, entete,
        h('h3', { class: 'titre-plan' }, `L'essentiel · environ ${p.minutes} min`, h('span', { class: 'discret' }, ' : pour atteindre votre objectif, dans cet ordre')),
        h('div', { class: 'liste-paliers' }, p.essentiel.map((it, i) => ligne(it, i))),
        h('h3', { class: 'titre-plan' }, 'Bonus', h('span', { class: 'discret' }, ' : pour le plaisir, et ça entraîne aussi')),
        h('div', { class: 'liste-paliers' }, p.bonus.map((it) => ligne(it, null))),
        !seance ? h('p', { class: 'discret' }, 'Cliquez un point pour l\'ouvrir (la séance commence alors) ; chacun se coche quand il est fait.') : null));
    }
    afficher();
  },
};
