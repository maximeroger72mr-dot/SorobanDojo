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

import { phasesLecon, objectifGestes } from '../core/phases.js';
import { genererExercice, pisteDe } from '../core/curriculum.js';
import { plateauOperation, formatExamen, reculs, dureeEchauffement } from '../core/parcours.js';
import { vitesseEleve } from '../core/allure.js';
import { leconsFluidite, forceVitesse } from '../core/fluidite.js';
import {
  progression, aujourdhui, revisionsDues, seanceEnCours, commencerSeance, finirSeance,
  minutesAujourdhui, prendreAvis, reglagesUtilisateur, modifierReglages, motifsEnDifficulte, versionNavigateur, erreursARejouer,
  erreursOperationRepetees, traiterErreurOperation, etatPalier,
} from '../core/progression.js';
import { telechargerExport } from '../ui/exporter.js';
import { serieJours, semainesTenues, JOURS_SEMAINE_TENUE } from '../core/regularite.js';
import { grade, drillEchauffement, gestesLents, verificationVitesse, anzanAdapte, placementDuJour, coursMultiplicationAtteint, prioriteDuJour, planObjectif, consolidationDuJour, ancrageDuJour, estValide, leconBloquee, ECHECS_TEST_MAX } from '../core/parcours.js';
import { ENTRAINEMENTS_ERREUR } from '../core/diagnostic.js';
import { GRADES_KYU as GRADES, minutesZenkoren, optionsChoisies } from '../core/epreuves.js';
import { diagnosticTablesFait, produitsARetravailler } from '../core/tables.js';
import { SUCCES } from '../core/succes.js';
import { nomMotif, diagnosticPincee, gesteMotif } from '../core/motifs.js';
import { gesteTravaillable } from '../core/colonneGeste.js';
import { ajouterJours, MELANGE_MAX, calculsMelange, ordreRevisions } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { decisionDuJour, motDuProf, gestesLecon, derniereLecon, leconsSousArgent } from '../core/prof.js';
import { exercicesBloc, jourVitesse, gesteDuJour, gesteExercice } from '../core/blocs.js';
import { hakariActif, partieDuJour, calculsHakari, NOMS_PARTIES } from '../core/hakari.js';
import { gradeOperation } from '../core/formatKyu.js';
import { chargeGrade } from '../core/allure.js';
import { testEnSeries, CALCULS_SERIE } from '../core/minitest.js';
import { etatMarches, NB_MARCHES, MINUTES_FEUILLE_MARCHE } from '../core/marches.js';
import { sousPalier, SOUS_PALIERS } from '../core/curriculum.js';
import { propositions, minutesPlanche, secondesParChiffre } from '../core/propositions.js';
import { tempsClassement } from '../core/drills.js';
import { prochainGradeFlash, meilleurGradeFlash, libelleGradeFlash, QUESTIONS_GRADE_FLASH, JUSTES_GRADE_FLASH } from '../core/flashGrades.js';
import { semaineISO } from '../core/hasard.js';
import { voixDisponible } from '../ui/voix.js';
import { sorobanNombre } from '../ui/perles.js';
import { examenDeLaSemaine, resultatSemaine, libelleGrade, formatBlanc, minutesBlanc, MINUTES_BLANC_SPRINT, SOCLE, aSocle, prekyuObtenu, examenCompletHebdo, prochainJalon } from '../core/examen.js';
import { bilanHebdo } from '../core/bilan.js';
import { plateaux, chiffresAppris as chiffresApprisDe } from '../core/parcours.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';
import { avecInfobulles } from '../ui/termes.js';
import { equilibreSemaine, planMois } from '../core/semaine.js';

/** Secondes par exercice de leçon, d'après les dernières séries (25 s par défaut). */
function secondesParExercice(d) {
  const t = d.sessions.filter((x) => x.module === 'lecons' && x.mode === 'entrainement' && x.total > 0 && x.dureeMs > 0).slice(-10).map((x) => x.dureeMs / 1000 / x.total).sort((a, b) => a - b);
  return t.length ? Math.min(90, Math.max(6, t[Math.floor(t.length / 2)])) : 25;
}

/** Durée estimée d'une activité de rythme ou de drill, sur la vitesse de l'apprenant. */
function dureeActivite(d, [module, p = {}]) {
  if (module === 'rythme' && p.jeu === 'marathon') return Math.max(3, Math.ceil(((p.lignes ?? 30) * (p.chiffres ?? 1) * secondesParChiffre(d) * 1.3) / 60) + 1);
  if (module === 'rythme') return 4;
  return 3;
}

/** Durée estimée de la leçon du jour : exercices restants + mini-test (+ « Comprendre » au début). */
function dureeDecision(d, decision, parExo) {
  if (decision.type !== 'lecon' || !decision.sp) return dureeActivite(d, decision.aller);
  const sp = decision.sp;
  const e = d.paliers[sp.id] ?? {};
  // 0.40 : leçon à phases : ce qui reste se lit sur la jauge de gestes visés.
  const reste = phasesLecon(sp) ? Math.max(0, Math.round((sp.repetitions ?? 20) * (1 - (e.gestesVises ?? 0) / objectifGestes(sp, () => genererExercice(sp)))))
    : Math.max(0, (sp.repetitions ?? 20) - (e.reps ?? 0));
  // Mini-test long (0.38) : une série de 5 par séance, pas le test entier.
  const test = testEnSeries(sp) ? CALCULS_SERIE : (sp.testNombre ?? 15);
  return Math.max(5, Math.ceil(((reste + test) * parExo) / 60) + (e.reps ? 0 : 3));
}

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
/**
 * Séance enregistrée, relue (0.40) : la leçon retrouvée dans le curriculum par son identifiant.
 * Illisible (sauvegarde d'avant, leçon disparue) : null, et la séance se recalcule.
 */
export function relireSeance(seance) {
  if (!seance) return null;
  try {
    const s = { ...seance };
    if (s.decision) {
      const id = typeof s.decision.sp === 'string' ? s.decision.sp : s.decision.sp?.id;
      const sp = id ? sousPalier(id) : null;
      if (s.decision.sp && !sp) return { ...s, decision: null };
      s.decision = { ...s.decision, ...(sp ? { sp } : {}) };
    }
    if (s.partie?.lecon) {
      const id = typeof s.partie.lecon === 'string' ? s.partie.lecon : s.partie.lecon.id;
      const lecon = id ? sousPalier(id) : null;
      s.partie = lecon ? { ...s.partie, lecon } : null;
    }
    return s;
  } catch {
    return null;
  }
}

export function plan(d, debut, seance0 = null) {
  const seance = relireSeance(seance0);
  const date = aujourdhui();
  const depuis = d.sessions.filter((s) => (s.horodatage ?? 0) >= debut);
  const fait = (f) => depuis.some(f);
  const essentiel = [];
  const sp = prochainSousPalier();
  // Durées calibrées sur la vitesse réelle : secondes par exercice de leçon (médiane récente).
  const parExo = secondesParExercice(d);

  // 1. Échauffement (3 min). Pendant les étapes petits amis et grands amis : Complément éclair,
  //    pour que les paires qui font 5 ou 10 viennent sans réfléchir ; sinon le prochain drill à valider.
  //    Un jour sur deux seulement, et plus du tout une fois le réflexe installé (record de 25
  //    bonnes réponses en 60 s) : sinon le même échauffement revient tous les jours.
  const complementVoulu = sp?.palier?.id === 'p2' ? 5 : sp?.palier?.id === 'p3' || sp?.palier?.id === 'p4' ? 10 : null;
  const complementAcquis = complementVoulu && (d.records[`jeu-complement-${complementVoulu}`]?.points ?? 0) >= 25;
  const jourPair = Math.floor(new Date(`${date}T12:00`).getTime() / 86400000) % 2 === 0;
  const complementFait = complementVoulu && fait((s) => s.module === 'jeux' && s.mode === `complement-${complementVoulu}`);
  const cibleComplement = complementVoulu && (complementFait || (!complementAcquis && jourPair)) ? complementVoulu : null;
  const drill = cibleComplement ? null : drillEchauffement(d);
  if (cibleComplement) {
    essentiel.push({ titre: 'Échauffement', detail: `Complément éclair à ${cibleComplement} (60 s)`, minutes: 2,
      pourquoi: `Les ${cibleComplement === 5 ? 'petits' : 'grands'} amis reposent sur les paires qui font ${cibleComplement} : elles doivent venir sans réfléchir, sinon la main s'arrête.`,
      fait: fait((s) => s.module === 'jeux' && s.mode === `complement-${cibleComplement}`), aller: ['jeux', { jeu: 'complement', cible: cibleComplement }] });
  } else if (drill) {
    essentiel.push({ titre: 'Échauffement', detail: drill.titre, minutes: Math.max(1, Math.min(3, Math.ceil(dureeEchauffement(d, drill) / 60000))), pourquoi: 'Les doigts se réveillent sur une suite connue : on ne commence jamais à froid.',
      fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables') && s.mode !== 'quotient'), aller: ['drills', { drill: drill.id }] });
  }
  const objectif = objectifDuJour();
  // ---- 2. Révision : les colonnes ratées la dernière fois, puis 10 calculs qui MÉLANGENT les
  //         leçons dues (chacune garde sa boîte de révision).
  const aRejouer = erreursARejouer(date).length;
  if (aRejouer || fait((s) => s.module === 'erreurs')) {
    essentiel.push({ titre: 'À revoir', detail: aRejouer ? `${aRejouer} colonne${aRejouer > 1 ? 's' : ''} de la dernière séance, à refaire` : 'fait', minutes: Math.max(1, Math.ceil((Math.min(aRejouer, 6) * parExo) / 60)),
      pourquoi: 'Refaire ce qui a posé problème, un jour plus tard, corrige le geste mieux qu\'un exercice neuf.',
      fait: fait((s) => s.module === 'erreurs'), aller: ['erreurs'] });
  }
  const dues = revisionsDues().map((id) => sousPalier(id)).filter(Boolean);
  const revisionFaite = fait((s) => s.module === 'revisions');
  if (dues.length || revisionFaite) {
    const melangeables = dues.filter(melangeable).sort(ordreRevisions(etatPalier));
    const nm = Math.min(MELANGE_MAX, melangeables.length);
    const noms = melangeables.slice(0, MELANGE_MAX).map((x) => `« ${x.titre} »`);
    const calculs = melangeables.length > 1 ? calculsMelange(nm) : 10;
    essentiel.push({ titre: 'Révision', minutes: Math.max(2, Math.ceil((calculs * parExo) / 60)), fait: revisionFaite,
      detail: !dues.length ? 'faite' : melangeables.length > 1
        ? `${calculs} calculs qui mélangent ${noms.join(', ')}${melangeables.length > MELANGE_MAX ? ' (les plus fragiles, puis les plus en retard ; les autres demain)' : ''}`
        : `${dues.length} leçon${dues.length > 1 ? 's' : ''} à revoir (10 calculs)`,
      pourquoi: 'Revoir une leçon juste avant de l\'oublier la fixe pour longtemps ; mélangées, il faut choisir le bon geste, comme en vrai.',
      aller: melangeables.length > 1 ? ['revisions', { melange: true }] : ['revisions'] });
  }

  // ---- 3. La leçon (ou l'examen blanc, du vendredi au dimanche). Une leçon passée en or ouvre la
  //         suivante ; validée mais encore en argent, on l'AUTOMATISE.
  const exam = examenDeLaSemaine(d);
  const examFait = resultatSemaine(d, date);
  const passeAujourdhui = fait((s) => s.module === 'examen');
  const jourSemaine = new Date(`${date}T12:00`).getDay();
  const fenetreExamen = [5, 6, 0].includes(jourSemaine);
  // 0.38 : séance longue. L'examen blanc (14 à 20 min) n'entre dans la séance qu'avec un objectif
  // d'au moins 20 min, l'examen complet (30 min) avec 30 min. Sinon, il est proposé À PART, à faire
  // à la place de la séance du jour (vendredi au dimanche), sans jamais compter comme manqué.
  // Le socle des premiers grades (10 colonnes sans chrono) reste dans la séance.
  const complet = examenCompletHebdo(d, date);
  const completAujourdhui = !!complet?.fait && complet.fait.date === date;
  const completVoulu = !!complet && (completAujourdhui || (fenetreExamen && !complet.fait));
  // 0.38.2 : l'examen ne prend la place de la leçon qu'au PREMIER jour pratiqué de la fenêtre
  // (vendredi au dimanche). Pas fait ce jour-là : la leçon revient, l'examen reste proposé à part.
  // Avant, la leçon pouvait être suspendue trois jours de suite.
  const debutFenetre = ajouterJours(date, -((jourSemaine + 2) % 7));
  const premierJourExamen = fenetreExamen && !d.sessions.some((s) => s.date >= debutFenetre && s.date < date);
  const completDansSeance = completVoulu && (completAujourdhui || (objectif >= OBJECTIF_EXAMEN_COMPLET && premierJourExamen));
  const examCourt = !!exam && aSocle(exam) && !prekyuObtenu(d, exam);
  const examVoulu = !!exam && !complet && (passeAujourdhui || (fenetreExamen && !examFait));
  // 0.39 : le socle (examen court des premiers grades) aussi ne prend la place de la leçon qu'au
  // premier jour pratiqué du créneau. Avant, tant qu'il n'était pas tenté, il la remplaçait les
  // trois jours. Les autres jours, il reste dans « Pour compléter », à tenter quand on veut.
  const examEssentiel = examVoulu && (passeAujourdhui || ((examCourt || objectif >= OBJECTIF_EXAMEN_BLANC) && premierJourExamen));
  const socleEnBonus = examVoulu && examCourt && !examEssentiel;
  // Fait aujourd'hui avec un objectif plus court : l'examen a REMPLACÉ la séance.
  const remplacee = (completAujourdhui && objectif < OBJECTIF_EXAMEN_COMPLET) || (passeAujourdhui && examEssentiel && !examCourt && objectif < OBJECTIF_EXAMEN_BLANC);
  let seanceLongue = null;
  const vitesse = jourVitesse(d, date);
  const decisionFaite = (dec) => fait((s) => (dec.aller[0] === 'lecons' ? s.module === 'lecons' && s.reglages?.sousPalier === dec.aller[1].sousPalier
    : dec.aller[0] === 'planches' ? s.module === 'planches' && s.reglages?.proposition === dec.aller[1].proposition
    : dec.aller[0] === 'muldiv' ? s.module === 'muldiv' && s.reglages?.proposition === dec.aller[1].proposition
    : dec.aller[0] === 'epreuves' ? s.module === 'epreuves'
    : dec.aller[0] === 'anzan' ? s.module === 'anzan'
    : s.module === 'rythme' && s.mode === 'marathon' && (!dec.cibles || (s.reglages?.cibles ?? []).includes(dec.cibles[0]))));
  const decision = seance?.decision && seance.decision.type === 'lecon' && decisionFaite(seance.decision) ? seance.decision : decisionDuJour(d, date, sp);
  // 0.42.1 : leçon commencée qu'on n'arrive pas à passer (parcours.leconBloquee) : elle ne bloque plus
  // l'autre piste, et revient chaque jour 5 minutes, jusqu'au mini-test réussi.
  const bloquee = SOUS_PALIERS.find((x) => !x.mental && x.id !== decision.sp?.id && leconBloquee(d, x));
  if (bloquee) {
    const e = d.paliers[bloquee.id];
    const apres = essentiel.findIndex((it) => it.titre === 'Révision');
    const at = apres >= 0 ? apres + 1 : essentiel.findIndex((it) => it.titre === 'À revoir') + 1;
    essentiel.splice(Math.max(1, at), 0, { titre: `Rattrapage · ${bloquee.titre}`, minutes: 5, rattrapage: true,
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === bloquee.id),
      detail: `${(e.echecsTest ?? 0) >= ECHECS_TEST_MAX ? `${e.echecsTest} mini-tests ratés` : 'commencée depuis plus d\'une semaine'} : 5 minutes d'entraînement, et le mini-test dès que vous vous sentez prêt`,
      pourquoi: 'Une leçon qui résiste ne doit pas arrêter tout le reste : l\'autre piste reprend, et celle-ci revient un peu chaque jour jusqu\'au mini-test réussi.',
      aller: ['lecons', { sousPalier: bloquee.id, onglet: 'entrainement' }] });
  }
  // 0.40.18 : rattrapage. Une leçon validée restée sous l'argent (moins de 90 % de justes sur son
  // propre historique) revient un jour sur deux, 5 minutes à son format, juste après la révision,
  // jusqu'à l'argent. La leçon du jour (porte d'argent) n'y est pas reprise une seconde fois.
  {
    const r = leconsSousArgent(d).find((x) => x.id !== decision.sp?.id);
    if (r) {
      const hier = ajouterJours(date, -1);
      const surR = (s) => s.module === 'lecons' && s.reglages?.sousPalier === r.id;
      const faitAujourdhui = fait(surR);
      if (faitAujourdhui || !d.sessions.some((s) => s.date === hier && surR(s))) {
        const h0 = (d.paliers[r.id]?.hist ?? []).slice(-30);
        const pct = h0.length ? Math.round((100 * h0.filter((x) => x.ok).length) / h0.length) : 0;
        const apres = essentiel.findIndex((it) => it.titre === 'Révision');
        const at = apres >= 0 ? apres + 1 : essentiel.findIndex((it) => it.titre === 'À revoir') + 1;
        // (sans identifiant : il ne fait pas partie des blocs figés au début de la séance, il reste
        // stable dans la journée et passe dans « Pour compléter » quand l'objectif est plein)
        essentiel.splice(Math.max(1, at), 0, { titre: `Rattrapage · ${r.titre}`, minutes: 5, rattrapage: true, fait: faitAujourdhui,
          detail: `quelques colonnes au format de la leçon, sans viser la vitesse : ${pct} % de justes, il en faut 90 pour l'argent`,
          pourquoi: 'Une leçon validée mais encore fragile ne reste pas derrière : on y revient un peu, un jour sur deux, jusqu\'à l\'argent. C\'est la justesse qui compte ici.',
          aller: ['lecons', { sousPalier: r.id, onglet: 'entrainement' }] });
      }
    }
  }
  const difficiles = motifsEnDifficulte();
  // Budget de chaque bloc, sur l'objectif : la leçon garde une part fixe (5 à 10 min) ; le temps
  // en plus va au volume / vitesse et à l'anzan.
  const partLecon = Math.max(5, Math.min(10, Math.round(objectif * 0.35)));
  // 0.40.4 : 5 minutes au moins (un bloc plus court ne laisse pas le temps de s'installer).
  const minutesAnzan = Math.max(BLOC_MIN, Math.min(8, Math.round(objectif * 0.15)));
  const exclus = [];
  let isolesBloc3 = 0;
  // Trois premiers grades préparatoires, pas encore obtenus : le socle (10 colonnes, sans chrono).
  const examSocle = examCourt;
  // Une fois le 6e kyū passé : le sujet officiel complet du prochain grade, une fois par semaine
  // (vendredi au dimanche), à la place de l'examen blanc.
  if (completVoulu) {
    const g = complet.grade;
    const f = complet.fait;
    const sprints = complet.format === 'sprints';
    const minutesComplet = sprints ? 2 * MINUTES_BLANC_SPRINT + 3 : minutesZenkoren(g, optionsChoisies(d, g));
    const item = { titre: sprints ? `Sprints de la semaine · ${complet.dan ? `vers le ${g.japonais}` : g.nom}` : complet.dan ? `Examen de dan · vers le ${g.japonais}` : `Examen complet · ${g.nom}`, minutes: minutesComplet, aller: ['epreuves', { ...(complet.danZenkoren ? { danZenkoren: true } : complet.dan ? { dan: true } : { grade: g.id }), auto: true, ...(sprints ? { sprints: true } : {}) }], examen: true, fait: completAujourdhui,
      detail: f ? `${f.justes} / ${f.total} justes` : sprints ? `cette semaine, deux sprints de ${MINUTES_BLANC_SPRINT} minutes (les colonnes, puis votre partie la plus lente), puis la reprise des erreurs ; l'examen complet revient la semaine prochaine` : complet.danZenkoren ? `×, ÷, mitorizan et les matières au choix, 7 minutes chacune, au barème Zenkoren (${g.pointsEpreuve} points sur 300 dans chaque matière pour le ${g.japonais})` : complet.dan ? `×, ÷ et mitorizan, 10 minutes chacun, au barème des dan (${g.pointsEpreuve} points sur 300 dans chaque épreuve pour le ${g.japonais})` : `le sujet officiel entier${optionsChoisies(d, g).length ? ', avec vos matières au choix' : ''}, ${minutesComplet} minutes, comme le jour de l'examen`,
      pourquoi: 'Depuis le 6e kyū, l\'examen de la semaine est un vrai sujet, en entier : colonnes, multiplications et divisions, dans le temps officiel. C\'est lui qui dit où vous en êtes, et ses erreurs nourrissent les planches de la semaine suivante.' };
    if (completDansSeance) essentiel.push(item);
    else seanceLongue = item;
  }
  if (examVoulu && !examEssentiel && !socleEnBonus) {
    const format = formatBlanc(date);
    seanceLongue = { titre: exam.id === 'hebdo' ? 'Examen blanc' : `Examen blanc · ${exam.nom}`, minutes: minutesBlanc(format), aller: ['examen', {}], examen: true, fait: false,
      detail: format === 'long' ? 'un sujet de 20 minutes sur tout ce que vous savez, en conditions d\'examen' : `deux sprints de ${MINUTES_BLANC_SPRINT} minutes, chacun avec son verdict`,
      pourquoi: 'L\'examen de la semaine se passe d\'un bloc : il prend la place de la séance du jour.' };
  }
  // 0.40.2-0.40.3 : une semaine sans examen dans la séance principale (examen proposé à part avec un
  // objectif court, ou pas d'examen blanc disponible, entre deux grades préparatoires) n'avait rien
  // de chronométré. Au premier jour pratiqué du créneau (le vendredi si l'on s'entraîne ce jour-là),
  // la feuille de la semaine entre dans la séance (5 min), et y garde sa place (le calibrage la
  // renvoyait dans « Pour compléter » avec un objectif court). Pas si elle est déjà faite cette semaine.
  const semaine = semaineISO(date).cle;
  const feuilleAvant = d.sessions.some((s) => s.module === 'defis' && ['semaine', 'sans-filet'].includes(s.mode) && s.date < date && semaineISO(s.date).cle === semaine);
  const examSemaine = !!examFait || !!complet?.fait || passeAujourdhui || completAujourdhui;
  const feuilleHebdo = premierJourExamen && !examEssentiel && !completDansSeance && !examSemaine && !feuilleAvant && estValide(d, 'p1-3');
  if (feuilleHebdo) {
    essentiel.push({ titre: 'Feuille de la semaine', minutes: 5, aller: ['defis', { semaine: true }], garder: true,
      fait: fait((s) => s.module === 'defis' && ['semaine', 'sans-filet'].includes(s.mode)),
      detail: `le même sujet chronométré toute la semaine : votre mesure de la semaine${seanceLongue ? ' (l\'examen blanc reste proposé à part)' : ''}`,
      pourquoi: 'Une fois par semaine, un sujet chronométré dans la séance : c\'est lui qui montre si la vitesse progresse.' });
  }
  if (completDansSeance) {
    // (déjà dans l'essentiel)
  } else if (examEssentiel && (examSocle || (aSocle(exam) && examFait?.socle && passeAujourdhui))) {
    essentiel.push({ titre: `Examen · ${exam.nom} : le socle`, minutes: SOCLE.minutes, aller: ['examen', { auto: true }], examen: true, fait: !!examFait && passeAujourdhui,
      detail: examFait && passeAujourdhui ? `${examFait.points} / ${examFait.total}${examFait.reussi ? ', grade obtenu' : ', pas encore : retentez quand vous voulez'}`
        : `${SOCLE.colonnes} colonnes sans chrono, ${Math.ceil(SOCLE.colonnes * SOCLE.seuil)} justes pour obtenir le grade`,
      pourquoi: 'Votre premier examen se passe en deux temps : d\'abord le socle, sans chrono, où seule la justesse compte. Le format chronométré vient ensuite, quand vous le voudrez.' });
  } else if (examEssentiel) {
    const format = formatBlanc(date);
    essentiel.push({ titre: exam.id === 'hebdo' ? 'Examen blanc' : `Examen blanc · ${exam.nom}`, minutes: minutesBlanc(format), aller: ['examen', {}], examen: true, fait: !!examFait && passeAujourdhui,
      detail: examFait && passeAujourdhui ? `${examFait.points} / ${examFait.total}${examFait.reussi ? ', réussi' : ', pas encore : retentez la semaine prochaine'}`
        : format === 'long' ? 'cette semaine, un sujet de 20 minutes sur tout ce que vous savez, en conditions d\'examen' : `cette semaine, deux sprints de ${MINUTES_BLANC_SPRINT} minutes, chacun avec son verdict`,
      pourquoi: format === 'long' ? 'Du vendredi au dimanche, l\'examen blanc prend la place de la leçon. Une semaine sur deux, 20 minutes d\'affilée : tenir la concentration longtemps.'
        : `Du vendredi au dimanche, l'examen blanc prend la place de la leçon. Une semaine sur deux, deux sprints de ${MINUTES_BLANC_SPRINT} minutes : aller vite, et réussir chaque partie, sans compensation.` });
  } else if (decision.type === 'lecon') {
    const dureeLecon = dureeDecision(d, decision, parExo);
    const coupee = dureeLecon > partLecon;
    const tempsLecon = depuis.filter((s) => s.module === 'lecons' && s.reglages?.sousPalier === decision.aller[1].sousPalier).reduce((t, s) => t + (s.dureeMs ?? 0), 0);
    essentiel.push({ titre: decision.titre, detail: coupee ? `${decision.detail} (${partLecon} min aujourd'hui, une partie seulement : la suite demain)` : decision.detail, detailCourt: decision.detail, minutes: coupee ? partLecon : dureeLecon, aller: decision.aller, decision: true,
      dureeEntiere: dureeLecon, tempsLecon, commencee: decisionFaite(decision), pourquoi: decision.raison, fait: decisionFaite(decision) && (!coupee || tempsLecon >= partLecon * 60000 || !!d.paliers[decision.sp.id]?.valide) });
  } else if (decision.type === 'automatiser') {
    const cibles = gestesLecon(decision.sp);
    // 0.40.18 : porte d'argent : l'entraînement de la leçon elle-même (c'est sa justesse qui manque).
    const items = cibles.length && !decision.porteArgent
      ? exercicesBloc(d, date, { genres: [vitesse ? 'vitesse-isole' : 'volume-isole'], cibles, difficiles, minutes: partLecon, geste: seance?.gesteBloc, unParGeste: false })
      : [];
    if (!items.length) items.push({ id: 'lecon', titre: decision.porteArgent ? `porte d'argent · ${decision.sp.titre}` : decision.sp?.titre ?? decision.titre, detail: decision.detail, minutes: partLecon, aller: decision.aller, fait: decisionFaite(decision) });
    isolesBloc3 = items.filter((it) => it.genre?.endsWith('-isole')).length;
    items.forEach((it, i) => { exclus.push(it.id); essentiel.push({ ...it, titre: i ? it.titre : `${decision.titre} · ${it.titre}`, decision: i === 0, pourquoi: i ? it.pourquoi : `${decision.raison} ${it.pourquoi ?? ''}`.trim() }); });
  } else {
    // 0.39 : l'entretien prend une part de l'objectif du jour (5 à 20 min).
    const m = decision.type === 'revision' ? Math.max(5, Math.min(20, Math.round(objectif * 0.4))) : partLecon;
    essentiel.push({ titre: decision.titre, detail: decision.detail, minutes: m, aller: decision.aller, decision: true, pourquoi: decision.raison, fait: decisionFaite(decision) });
  }

  // 0.38.4 : l'examen a pris la place de la leçon dans la séance. La leçon du jour n'est pas
  // perdue : elle passe en tête de « Pour compléter » (avant, elle disparaissait des deux listes,
  // alors que le prof l'avait choisie).
  const leconEnBonus = (completDansSeance || examEssentiel) && decision.aller
    ? { titre: decision.type === 'lecon' ? `${decision.titre} · ${decision.detail}` : decision.titre, detail: `${decision.detail ?? ''}${decision.detail ? ' : ' : ''}l'examen a pris sa place dans la séance ; à faire après, si vous avez le temps`,
      minutes: partLecon, aller: decision.aller, pourquoi: decision.raison, fait: decisionFaite(decision) }
    : null;

  // 0.39 : un geste qui recule (15 % plus lent deux semaines de suite, à format égal) : un réveil.
  const recul = reculs(d, date)[0] ?? null;
  const reveilFait = !!recul && fait((s) => s.module === 'rythme' && s.mode === 'marathon' && (s.reglages?.cibles ?? []).includes(recul.cle));
  if (recul) {
    const c = recul.cle;
    essentiel.push({ titre: `Réveil · ${nomMotif(c)}`, detail: `30 lignes de marathon sur ce geste : il a ralenti de ${Math.round((recul.maintenant / recul.avant - 1) * 100)} % en deux semaines (colonnes de ${recul.format.replace('x', ' lignes à ')} chiffres)`, minutes: 4,
      pourquoi: 'Un geste qui ralentit deux semaines de suite se rouille : un bloc court et ciblé le réveille avant qu\'il ne freine vos colonnes.',
      fait: reveilFait, aller: ['rythme', { jeu: 'marathon', cibles: [c], lignes: 30, auto: true }] });
  }

  // Vitesse incohérente (ex. gestes directs plus lents que les petits amis) : on vérifie.
  const verif = verificationVitesse(d);
  if (verif) {
    essentiel.push({ titre: verif.titre, detail: verif.detail, minutes: 4, pourquoi: verif.pourquoi, aller: verif.aller,
      fait: fait((s) => (s.module === 'verification' && s.mode === (verif.aller[1].geste ?? `famille:${verif.aller[1].famille}`))
        || (s.module === 'rythme' && (s.reglages?.cibles ?? []).includes(verif.cle))) });
  }

  // Multiplication / division : tables et placement deviennent des réflexes quotidiens.
  //    En ouvrant l'étape : le diagnostic des 81 produits (les trous dans les tables, repérés AVANT
  //    qu'on les attribue au placement).
  // Les tables commencent AVANT la multiplication : dès l'étape « Grands amis en soustraction »
  // (et pendant « Combinaisons »), une séance sur deux, pour qu'elles soient automatiques en
  // ouvrant la multiplication : toute l'attention ira alors au placement et au geste.
  const multAtteinte = coursMultiplicationAtteint(d, sp);
  // 0.41.1 : les tables se préparent dès les grands amis (p3), pas seulement à partir de la soustraction.
  const avantMult = (!multAtteinte && !!sp && (['p4', 'p5'].includes(sp.palier.id) || (sp.palier.id === 'p3' && estValide(d, 'p3-0')) || pisteDe(sp) === 'muldiv')) || (!!d.paliers['p6-a']?.valide && !d.paliers['p6-0']?.valide);
  const tablesFaites = fait((s) => s.module === 'drills' && String(s.mode).startsWith('tables'));
  const quotientFait = fait((s) => s.module === 'drills' && s.mode === 'quotient');
  const aRetravailler = produitsARetravailler(d.tables ?? {}).length;
  if ((multAtteinte || avantMult) && !diagnosticTablesFait(d.tables ?? {})) {
    essentiel.push({ titre: 'Diagnostic des tables', detail: 'les 81 produits, une fois chacun', minutes: 4,
      pourquoi: avantMult ? 'La multiplication approche : on repère dès maintenant les produits hésitants. Les produits faux ou plus lents que 2,5 s seront travaillés une séance sur deux, pour être automatiques le jour où elle commence.'
        : 'Un produit hésitant bloque toute la multiplication. Les produits faux ou plus lents que 2,5 s seront ensuite travaillés chaque jour, jusqu\'à ce qu\'ils passent.',
      fait: fait((s) => s.module === 'drills' && s.mode === 'tables-81'), aller: ['drills', { tables: '81' }] });
  } else if (multAtteinte && d.paliers['p7-1']?.valide && (quotientFait || (vitesse && !tablesFaites))) {
    // Une séance sur deux, dès la première leçon de division : l'estimation du quotient, pour
    // qu'elle soit un réflexe en arrivant à la division par 2 chiffres. Les tables, l'autre séance.
    essentiel.push({ titre: 'Estimation du quotient (réflexe)', detail: '20 divisions, une touche par réponse', minutes: 3,
      pourquoi: 'Trouver d\'emblée le bon chiffre du quotient, c\'est ce qui fera la vitesse des divisions par 2 chiffres.',
      fait: quotientFait, aller: ['drills', { quotient: true }] });
  } else if (avantMult ? (tablesFaites || !vitesse || aRetravailler > 2) : multAtteinte && (aRetravailler || [2, 6].includes(jourSemaine) || tablesFaites)) {
    // 0.41 : avant la multiplication, chaque jour tant que plus de 2 produits restent faux ou lents :
    // c'est une condition d'ouverture de la multiplication sur le soroban (parcours.porteMulDiv).
    // Avant la multiplication : une séance sur deux. Ensuite : chaque jour tant qu'il reste des
    // produits faux ou lents, puis deux fois par semaine en entretien.
    essentiel.push({ titre: 'Tables (réflexe)', detail: aRetravailler ? `20 produits : vos ${aRetravailler} produits à retravailler` : '20 produits, vos plus lents en priorité', minutes: 3,
      pourquoi: avantMult ? 'Les tables doivent sortir sans hésiter AVANT la multiplication : le jour venu, il ne restera que le placement à apprendre.' : 'En multiplication, chaque hésitation sur un produit se paie à chaque chiffre.',
      fait: tablesFaites, aller: ['drills', { tables: 'lents', auto: true }] });
  }
  // Erreurs de multiplication ou de division qui se RÉPÈTENT (placement, zéro, quotient,
  // arrondi, produit) : l'entraînement qui correspond, comme pour un geste faible.
  const repetee = erreursOperationRepetees(d, date)[0];
  if (repetee && ENTRAINEMENTS_ERREUR[repetee.type]) {
    const e = ENTRAINEMENTS_ERREUR[repetee.type];
    const aller = e.aller(repetee.div);
    const suivi = fait((s) => s.module === aller[0] && (aller[0] !== 'lecons' || s.reglages?.sousPalier === aller[1].sousPalier)
      && (aller[0] !== 'drills' || (aller[1].quotient ? s.mode === 'quotient' : String(s.mode).startsWith('tables')))
      && (aller[0] !== 'jeux' || s.mode === aller[1].jeu));
    if (suivi && d.erreursOperations?.[repetee.type]?.traite !== date) traiterErreurOperation(repetee.type);
    essentiel.push({ titre: 'Erreur qui se répète (× et ÷)', detail: `${e.nom}, ${repetee.nombre} fois ces derniers jours : ${e.remede.toLowerCase()}`, minutes: 3,
      pourquoi: 'La même erreur revient : ce n\'est plus de l\'inattention, c\'est un point à travailler à part, quelques minutes.',
      fait: suivi, aller });
  }
  // Pincée : plus de 30 % d'erreurs sur les 6 à 9 posés ou retirés d'un seul mouvement : 8 colonnes
  // de rattrapage, gestes directs seulement.
  const pincee = diagnosticPincee(d.motifs);
  const pinceeFaite = fait((s) => s.module === 'planches' && s.reglages?.proposition === 'pincee');
  if (pinceeFaite || (pincee.alerte && estValide(d, 'p1-3'))) {
    essentiel.push({ titre: 'Pincée : colonnes de rattrapage', detail: pincee.taux !== null ? `${Math.round(pincee.taux * 100)} % d'erreurs sur vos 6, 7, 8, 9 : 8 colonnes de pincée pure` : '8 colonnes de pincée pure', minutes: 3,
      pourquoi: 'Poser 6 à 9, c\'est UN mouvement : l\'index abaisse la céleste pendant que le pouce monte les terrestres. En deux temps, le geste se trompe et ralentit tout le reste.',
      fait: pinceeFaite, aller: ['planches', { cible: 'pincee', chiffres: Math.min(2, chiffresApprisDe(d)), lignes: 6, colonnes: 8, proposition: 'pincee', auto: true }] });
  }
  // Clinique du doigté (0.38) : un geste qui lâche encore (erreurs avérées) a souvent un mauvais
  // mouvement de doigts derrière lui. Une minute pour revoir LE bon mouvement, puis quelques
  // colonnes lentes avec le rappel doigté. Un jour sur trois au plus pour le même geste.
  const gesteFragile = difficiles.find((m) => !m.cle.endsWith(':direct') && gesteTravaillable(m.cle));
  const cliniqueFaite = fait((s) => s.module === 'planches' && s.reglages?.proposition === 'clinique');
  const cliniqueRecente = d.sessions.some((s) => s.module === 'planches' && s.reglages?.proposition === 'clinique' && s.date < date && s.date > ajouterJours(date, -3));
  if (cliniqueFaite || (gesteFragile && !cliniqueRecente && estValide(d, 'p1-3'))) {
    const c = depuis.find((s) => s.module === 'planches' && s.reglages?.proposition === 'clinique')?.reglages?.cible ?? gesteFragile?.cle;
    if (c) {
      essentiel.push({ titre: `Clinique du doigté · ${nomMotif(c)}`, detail: '1 minute pour revoir le bon mouvement, puis 6 colonnes lentes avec le rappel doigté', minutes: 3,
        pourquoi: `Ce geste lâche encore. Le bon mouvement : ${gesteMotif(c)} Lentement d'abord : la vitesse viendra d'un mouvement juste.`,
        fait: cliniqueFaite, aller: ['planches', { cible: c, mode: 'seul', chiffres: 1, lignes: 5, colonnes: 6, doigte: true, proposition: 'clinique', auto: true }] });
    }
  }
  // Dictée (yomiage) : deux fois par semaine (mardi et jeudi), dès les gestes directs à 2 chiffres.
  // Calculer à l'oreille, sur le soroban, oblige à poser sans relire : un autre canal que l'œil.
  const dicteeFaite = fait((s) => s.module === 'dictee');
  if (dicteeFaite || (estValide(d, 'p1-4') && [2, 4].includes(jourSemaine) && voixDisponible())) {
    essentiel.push({ titre: 'Dictée (yomiage)', detail: '5 colonnes lues à voix haute, à calculer sur le soroban, à votre niveau', minutes: 4,
      pourquoi: 'À l\'oreille, on ne peut pas relire : chaque nombre se pose tout de suite. Deux fois par semaine, la dictée entraîne ce que les feuilles n\'entraînent pas.',
      fait: dicteeFaite, aller: ['dictee', { support: 'niveau' }] });
  }
  const placement = placementDuJour(d, date, sp);
  if (placement && placement.id !== sp?.id) {
    essentiel.push({ titre: 'Placement (réflexe)', detail: `${placement.titre} : 10 clics le plus vite possible`, minutes: 2, pourquoi: 'Poser le premier chiffre sur la bonne tige doit devenir immédiat.',
      fait: fait((s) => s.module === 'lecons' && s.reglages?.sousPalier === placement.id), aller: ['lecons', { sousPalier: placement.id, onglet: 'entrainement' }] });
  }

  // ---- 5. Anzan (calculé avant le bloc 4 : son temps est réservé).
  let itemAnzan = null;
  if (estValide(d, 'p1-4')) {
    const leconAnzan = prochainAnzan();
    const a = anzanAdapte(d, minutesAnzan);
    // Une semaine sur deux, le mercredi : le test de grade de flash (barème japonais), sur le
    // grade qui suit le meilleur obtenu ; il prend la place de l'anzan du jour.
    const gradeFlash = prochainGradeFlash(d);
    const testFlashFait = fait((s) => s.module === 'anzan' && s.mode === 'grade');
    const jourTestFlash = jourSemaine === 3 && semaineISO(date).semaine % 2 === 1 && meilleurGradeFlash(d) !== gradeFlash;
    itemAnzan = testFlashFait || jourTestFlash
      ? { titre: 'Anzan · test de grade de flash', detail: libelleGradeFlash(gradeFlash), minutes: Math.max(2, Math.ceil((QUESTIONS_GRADE_FLASH * (gradeFlash.secondes + 8)) / 60)),
        pourquoi: `Une semaine sur deux, on se mesure : ${QUESTIONS_GRADE_FLASH} calculs en flash, ${JUSTES_GRADE_FLASH} justes pour obtenir le grade. Raté, il ne retire rien : on le repasse dans deux semaines.`,
        fait: testFlashFait, aller: ['anzan', { mode: 'grade', grade: gradeFlash.id, auto: true }] }
      : leconAnzan
      ? { titre: 'Anzan', detail: leconAnzan.titre, minutes: minutesAnzan, pourquoi: 'Quelques minutes de calcul de tête par jour : l\'image du soroban se construit par petites touches régulières.',
        fait: fait((s) => (s.module === 'lecons' && s.reglages?.sousPalier === leconAnzan.id) || (s.module === 'anzan' && s.reglages?.palierAnzan != null)), aller: ['lecons', { sousPalier: leconAnzan.id }] }
      : { titre: 'Anzan', detail: `${a.questions} calculs de tête de ${a.termes} nombres à ${a.chiffres} chiffre${a.chiffres > 1 ? 's' : ''}${a.mode === 'image' ? ', avec l\'image' : ''} · ${a.raison}`, minutes: minutesAnzan,
        pourquoi: 'Seulement les gestes déjà vus au soroban. La vitesse monte à chaque bonne réponse ; un nombre de plus quand c\'est juste ET rapide.',
        fait: fait((s) => s.module === 'anzan'), aller: ['anzan', { ...a, auto: true }] };
  }

  // ---- 4. Volume ou vitesse (une séance sur deux), toujours en rapport avec la séance du jour,
  //         isolé ET mélangé ; il remplit le temps qui reste jusqu'à l'objectif.
  const prevu = essentiel.reduce((t, it) => t + it.minutes, 0) + (itemAnzan?.minutes ?? 0);
  const derniere = derniereLecon(d);
  let ciblesBloc = decision.type === 'automatiser' ? gestesLecon(decision.sp)
    : [...new Set([...gestesLecon(derniere), ...difficiles.map((m) => m.cle)])];
  // Dernière leçon sans geste de colonne (× ÷, décimaux, parcours terminé) : le bloc travaille
  // les gestes les plus lents, à défaut ceux des dernières leçons de colonnes.
  if (!ciblesBloc.length) ciblesBloc = gestesLents(d, 2).map((x) => x.cle);
  if (!ciblesBloc.length) ciblesBloc = (ancrageDuJour(d)?.cibles ?? []).filter((c) => !c.endsWith(':direct'));
  // 0.39 : fluidité à reprendre (test flash juste mais lent, ou porte de l'or passée sans l'or) :
  // ses gestes passent en tête du bloc, en vitesse, jusqu'à l'or (la « dette de vitesse »).
  const fluide = decision.type === 'automatiser' ? null : leconsFluidite(d).find((x) => gestesLecon(x).length) ?? null;
  if (fluide) ciblesBloc = [...new Set([...gestesLecon(fluide), ...ciblesBloc])];
  // 0.40.2 : seule une leçon marquée lente en révision force la vitesse (avant, toute leçon validée
  // sans l'or la forçait : plus aucun jour de volume).
  const enVitesse = vitesse || forceVitesse(d, fluide);
  const genres = decision.type === 'automatiser'
    ? (enVitesse ? ['vitesse-melange', 'volume-melange', 'vitesse-isole', 'volume-isole'] : ['volume-melange', 'vitesse-isole', 'volume-isole', 'vitesse-melange'])
    : (enVitesse ? ['vitesse-isole', 'vitesse-melange', 'volume-melange'] : ['volume-melange', 'volume-isole', 'vitesse-melange']);
  const resteBloc = objectif - prevu;
  // 0.38 : à partir du 7e kyū, UN bloc de vitesse par jour, sur la partie la plus en retard (deux
  // jours sur trois) ou à tour de rôle : colonnes, ×, ÷. Pour × et ÷, une feuille chronométrée au
  // format du kyū, à la longueur du temps qui reste.
  // En entretien, la matière du jour est déjà la décision : pas de bloc de vitesse en double.
  const partie = hakariActif(d) && decision.type !== 'revision' ? (seance?.partie ?? partieDuJour(d, date)) : null;
  // Marches d'allure (0.38) : leçons du grade validées, une feuille de marche un jour de pratique
  // sur deux (pas le jour où elle est déjà réussie) ; le bloc de vitesse prend le temps qui reste.
  const em = etatMarches(d);
  const marcheFaite = fait((s) => s.module === 'marches' && s.mode === 'feuille');
  const joursAvant = new Set(d.sessions.filter((s) => s.date < date).map((s) => s.date)).size;
  let resteVitesse = resteBloc;
  if (em?.active && em.courante && (marcheFaite || (joursAvant % 2 === 0 && !em.reussites.includes(date))) && resteBloc >= 5) {
    const m = Math.min(resteBloc, MINUTES_FEUILLE_MARCHE + 1);
    essentiel.push({ id: 'marche', titre: `Marche d'allure ${em.courante.n} sur ${NB_MARCHES} · ${em.grade.nom}`, minutes: m, bloc: 'vitesse', fait: marcheFaite,
      detail: `une feuille d'environ ${MINUTES_FEUILLE_MARCHE} min au format du ${em.grade.nom}, à ${em.courante.cpm} chiffres/min, 90 % de justes${em.reussites.length ? ' (déjà réussie une fois : la seconde valide la marche)' : ''}`,
      pourquoi: em.anticipees ? 'Marches anticipées : la vitesse monte pendant les leçons, un jour sur deux, sur ce qui est déjà validé. Ainsi, pas de mur de vitesse une fois les leçons finies.'
        : 'Les leçons du grade sont faites : il reste la vitesse. Cinq marches mènent de la cadence des leçons à l\'allure d\'examen ; chacune se franchit deux jours différents.',
      aller: ['marches', { auto: true }] });
    resteVitesse = resteBloc - m;
  }
  const plateauOp = partie && partie.partie !== 'colonnes' ? plateauOperation(d, partie.partie, date) : null;
  const fg = partie?.partie === 'colonnes' ? formatExamen(d) : null;
  if (partie?.partie === 'colonnes' && enVitesse && resteVitesse >= 4 && fg?.grade && fg.lignes >= 5) {
    // 0.39 : colonnes AU FORMAT du grade, au tempo imposé (le lièvre) ; les colonnes courtes de
    // gestes restent pour les jours de volume.
    const v = vitesseEleve(d, fg.grade);
    const cadence = Math.max(0.6, (v.parChiffre ?? 2.5) * fg.chiffres);
    const id = 'lievre-format';
    const colonnes = Math.max(2, Math.min(8, Math.floor((resteVitesse * 60) / (fg.lignes * cadence + 15))));
    essentiel.push({ id, titre: `Vitesse · colonnes au format du ${fg.grade.nom}, au tempo`, minutes: Math.min(resteVitesse, 10), bloc: 'vitesse',
      detail: `${colonnes} colonnes de ${fg.lignes} lignes à ${fg.chiffres} chiffres, départ à votre vitesse${v.colonnesAuFormat ? ' mesurée au format' : ' estimée'}, +3 % après chaque colonne juste`,
      pourquoi: 'La vitesse d\'examen se gagne sur les colonnes de l\'examen : le surligneur impose le rythme, un peu plus vite à chaque réussite, et l\'œil lit la ligne suivante pendant que la main finit.',
      fait: fait((s) => s.module === 'rythme' && s.reglages?.format === 'grade'),
      aller: ['rythme', { jeu: 'lievre', format: { lignes: fg.lignes, chiffres: fg.chiffres, cadence: Math.round(cadence * 100) / 100, nom: fg.grade.nom, colonnes, proposition: id }, auto: true }] });
  } else if (plateauOp && resteVitesse >= 5) {
    // 0.39 : × ou ÷ en plateau : 4 × 90 s à 115 % de la meilleure cadence, la justesse comptée sur
    // le cumul des 4 blocs.
    const type = partie.partie;
    const signe = type === 'mul' ? '×' : '÷';
    const id = `surcharge-${type}`;
    essentiel.push({ id, titre: `Vitesse · ${signe} en plateau : 4 × 90 s à 115 %`, minutes: Math.min(resteVitesse, 9), bloc: 'vitesse',
      detail: `4 blocs de 90 s à ${nf(plateauOp.cible)} s par produit (votre meilleur : ${nf(plateauOp.meilleur)} s), justesse comptée sur les 4 blocs`,
      pourquoi: `Vos ${NOMS_PARTIES[type]} ne progressent plus depuis ${plateauOp.semaines} semaines. Des blocs courts au-dessus de votre meilleure cadence habituent la main à une vitesse nouvelle.`,
      fait: fait((s) => s.module === 'marches' && s.mode === 'surcharge' && s.reglages?.partie === type),
      aller: ['marches', { surcharge: { type, parProduit: plateauOp.cible }, auto: true }] });
  } else if (partie && partie.partie !== 'colonnes' && resteVitesse >= 3) {
    const type = partie.partie;
    const g = gradeOperation(d, type);
    const c = chargeGrade(g, type);
    const m = Math.min(10, resteVitesse);
    const nombre = calculsHakari(d, type, m, c.produits / Math.max(1, c.problemes));
    const id = `hakari-${type}`;
    const signe = type === 'mul' ? '×' : '÷';
    essentiel.push({ id, titre: `Vitesse · ${signe} au format du ${g.nom}`, minutes: m, bloc: 'vitesse',
      detail: `${nombre} ${NOMS_PARTIES[type]} chronométrées, tirées des sujets du ${g.nom}`,
      pourquoi: partie.raison === 'fluidite' ? `« ${partie.lecon.titre} » était juste mais lente à sa dernière révision : fluidité à reprendre, en priorité jusqu'à l'or.`
        : partie.raison === 'rotation' ? `Un jour sur trois, la vitesse tourne entre colonnes, × et ÷ : aujourd'hui, les ${NOMS_PARTIES[type]}.`
        : partie.eleve == null ? `Vos ${NOMS_PARTIES[type]} ne sont pas encore mesurées au format du ${g.nom} : cette feuille donne la mesure.`
        : `C'est la partie la plus loin de l'allure du ${g.nom} : ${nf(partie.eleve)} s par produit, il en faut ${nf(partie.besoin)}. À l'examen, × et ÷ font les deux tiers des points.`,
      fait: fait((s) => s.module === 'muldiv' && s.reglages?.proposition === id), aller: ['muldiv', { type, format: 'kyu', mode: 'feuille', nombre, auto: true, proposition: id }] });
  } else if (ciblesBloc.length && resteVitesse >= 2) {
    for (const it of exercicesBloc(d, date, { genres, cibles: ciblesBloc, difficiles, minutes: resteVitesse, exclure: exclus, isolesDeja: isolesBloc3, geste: seance?.gesteBloc })) {
      essentiel.push({ ...it, titre: it.titre, bloc: vitesse ? 'vitesse' : 'volume' });
    }
  }
  if (itemAnzan) essentiel.push(itemAnzan);

  // ---- Calibrage : l'essentiel tient dans l'objectif (durées estimées sur la vitesse réelle de
  //      l'apprenant). Ce qui dépasse passe dans « Pour compléter ».
  const reportes = [];
  let cumul = 0;
  const garde = [];
  // L'anzan garde sa place : son temps est réservé dès le début.
  // Séance en cours : les exercices des blocs « automatiser » et « volume / vitesse » sont ceux
  // prévus AU DÉBUT, pas un de plus. Sans cela, chaque exercice fait libérait du temps (ou changeait
  // le geste le plus lent) et un nouvel exercice prenait sa place : la séance ne finissait jamais.
  if (seance?.blocIds) {
    for (let i = essentiel.length - 1; i >= 0; i--) if (essentiel[i].id && !seance.blocIds.includes(essentiel[i].id)) essentiel.splice(i, 1);
  }
  const examDansSeance = examEssentiel || essentiel.some((it) => it.examen && !it.fait);
  const reserve = itemAnzan ? itemAnzan.minutes : 0;
  for (const [i, it] of essentiel.entries()) {
    const reste = objectif - cumul - (it === itemAnzan ? 0 : reserve);
    // L'examen blanc garde TOUJOURS sa place (c'est lui, la séance du jour), même s'il dépasse
    // l'objectif ; l'anzan lui cède alors la sienne.
    // 0.40.17 : aussi l'examen complet (30 min, après le 6e kyū) : avec l'anzan, la séance du vendredi
    // montait à 36-37 min pour un objectif de 30.
    const anzanGarde = it === itemAnzan && !(examDansSeance && cumul + it.minutes > objectif);
    if (it.fait || i === 0 || anzanGarde || it.examen || it.garder || it.minutes <= reste) { garde.push(it); cumul += it.minutes; continue; } // un point fait garde son temps : il ne libère pas de place
    if (it.decision && reste >= 3) {
      garde.push({ ...it, minutes: reste, detail: `${it.detailCourt ?? it.detail} (${reste} min aujourd'hui, la suite demain si besoin)` });
      cumul += reste;
      continue;
    }
    reportes.push(it);
  }
  // Les 5 blocs de la séance : chaque point appartient à l'un d'eux (dans cet ordre).
  for (const it of garde) {
    it.blocSeance = it.titre === 'Échauffement' ? 'echauffement' : ['À revoir', 'Révision'].includes(it.titre) || it.rattrapage ? 'revision'
      : it.examen || it.garder || it.decision || (decision.type === 'automatiser' && exclus.includes(it.id)) ? 'lecon' : it === itemAnzan ? 'anzan' : 'volume';
  }
  // 0.40.4 : un bloc de volume / vitesse de moins de 5 minutes (rien n'y est encore fait) passe dans
  // « Pour compléter » : trop court pour s'installer dans le travail ; la leçon reprend le temps.
  // (L'anzan a 5 minutes au moins ; l'échauffement, les révisions dues et la leçon ne sont pas concernés.)
  const volume = garde.filter((it) => it.blocSeance === 'volume');
  if (volume.length && !volume.some((it) => it.fait) && volume.reduce((t, it) => t + it.minutes, 0) < BLOC_MIN) {
    for (const it of volume) reportes.unshift(...garde.splice(garde.indexOf(it), 1));
  }
  // Il reste de la place (rien d'autre à proposer à ce niveau) : la leçon coupée la reprend.
  const libre = objectif - garde.reduce((t, it) => t + it.minutes, 0);
  const lecon = garde.find((it) => it.decision && it.dureeEntiere > it.minutes && !it.fait);
  if (lecon && libre >= 2) {
    const m = Math.min(lecon.dureeEntiere, lecon.minutes + libre);
    const entiere = m >= lecon.dureeEntiere;
    garde[garde.indexOf(lecon)] = { ...lecon, minutes: m, detail: entiere ? lecon.detailCourt : `${lecon.detailCourt} (${m} min aujourd'hui, une partie seulement : la suite demain)`,
      fait: entiere ? lecon.commencee : lecon.tempsLecon >= m * 60000 };
  }
  // 0.38 : séance courte (moins de 20 min) : 3 blocs au plus, la leçon et la révision d'abord, puis
  // le volume ou l'anzan, un jour sur deux. Le reste passe dans « Pour compléter ».
  if (objectif < 20 && !remplacee) {
    const priorite = ['lecon', 'revision', jourPair ? 'volume' : 'anzan', jourPair ? 'anzan' : 'volume', 'echauffement'];
    const blocsGardes = priorite.filter((b) => garde.some((it) => it.blocSeance === b)).slice(0, BLOCS_SEANCE_COURTE);
    for (let i = garde.length - 1; i >= 0; i--) if (!blocsGardes.includes(garde[i].blocSeance) && !garde[i].fait) reportes.unshift(...garde.splice(i, 1));
  }
  // Examen fait aujourd'hui à la place de la séance : il est, à lui seul, la séance du jour.
  if (remplacee) for (let i = garde.length - 1; i >= 0; i--) if (!garde[i].examen && !garde[i].fait) reportes.unshift(...garde.splice(i, 1));
  garde.sort((a, b) => ORDRE_BLOCS.indexOf(a.blocSeance) - ORDRE_BLOCS.indexOf(b.blocSeance));
  const minutes = garde.reduce((t, it) => t + it.minutes, 0);
  const theme = themeDuJour(decision, examEssentiel ? exam : null, garde);
  const mot = motDuProf(d, date, decision, { theme, difficiles, vitesse, examenHorsSeance: socleEnBonus ? 'socle' : !!exam && !examEssentiel, leconEnBonus: !!leconEnBonus && !leconEnBonus.fait });
  // Pour compléter (une fois l'objectif atteint) : ce qui n'a pas tenu, puis une planche, un flash
  // anzan, un jeu (et, si le temps restant est long, d'autres idées).
  const restant = Math.max(0, objectif - minutesAujourdhui() - garde.filter((it) => !it.fait).reduce((t, it) => t + it.minutes, 0));
  const socle = socleEnBonus ? [{ titre: `Examen · ${exam.nom} : le socle`, minutes: SOCLE.minutes, aller: ['examen', { auto: true }], examen: true, fait: false,
    detail: `${SOCLE.colonnes} colonnes sans chrono, ${Math.ceil(SOCLE.colonnes * SOCLE.seuil)} justes pour obtenir le grade : à tenter quand vous voulez, d'ici dimanche`,
    pourquoi: 'Le socle ne prend la place de la leçon qu\'un jour par semaine : les autres jours, il attend ici, sans pression.' }] : [];
  const complements = [...socle, ...(leconEnBonus && !leconEnBonus.fait ? [leconEnBonus] : []), ...reportes.filter((it) => !it.fait), ...propositions(d, date, difficiles, restant, gestesSeance([...garde, ...reportes], ciblesBloc)).filter((x) => !(feuilleHebdo && x.type === 'defi' && x.titre === 'Feuille de la semaine'))
    // 0.40.17 : pas de flash anzan en plus quand la séance a déjà son bloc d'anzan (il revenait chaque jour).
    .filter((x) => !(x.type === 'anzan' && garde.some((it) => it.blocSeance === 'anzan')))];
  // 0.43 : une leçon n'apparaît qu'une fois dans la séance (la leçon bloquée revenait en leçon du jour
  // ET en rattrapage) : on garde l'entrée principale, le rattrapage saute.
  const leconDe = (it) => (it.aller?.[0] === 'lecons' ? it.aller[1]?.sousPalier : null);
  const principales = new Set([...garde, ...complements].filter((it) => !it.rattrapage).map(leconDe).filter(Boolean));
  if (decision.sp) principales.add(decision.sp.id);
  for (const liste of [garde, complements]) {
    for (let i = liste.length - 1; i >= 0; i--) if (liste[i].rattrapage && principales.has(leconDe(liste[i]))) liste.splice(i, 1);
  }
  const vus = new Set(garde.map(leconDe).filter(Boolean));
  for (let i = complements.length - 1; i >= 0; i--) { const id = leconDe(complements[i]); if (id && vus.has(id)) complements.splice(i, 1); }
  return { essentiel: garde, bonus: complements, mot, minutes, decision, theme, gesteBloc: gesteDuJour(d, ciblesBloc, difficiles), blocIds: garde.filter((it) => it.id).map((it) => it.id),
    partie, seanceLongue: remplacee ? null : seanceLongue };
}

/** Le plan, sans jamais laisser un écran vide : une séance enregistrée illisible est recalculée (0.40). */
export function planSur(d, debut, seance) {
  try {
    return plan(d, debut, seance);
  } catch (e) {
    if (!seance) throw e;
    console.error('Séance enregistrée illisible, recalculée :', e);
    return plan(d, debut, null);
  }
}

/** Objectifs du jour proposés (minutes) ; 25 par défaut depuis la 0.38. */
export const OBJECTIFS = [5, 10, 15, 20, 25, 30, 45, 60];
/** 0.41 : ma semaine (équilibre du temps) et mon mois (4 semaines : leçons prévues, examens). */
function carteSemaineMois(d) {
  const date = aujourdhui();
  const e = equilibreSemaine(d, date);
  const mois = planMois(d, date);
  const jour = (x) => new Date(`${x}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return h('details', { class: 'carte semaine-mois' }, h('summary', {}, h('strong', {}, 'Ma semaine et mon mois')),
    h('p', {}, `7 derniers jours : ${e.total} min · `, e.parts.map((x) => `${x.nom} ${Math.round(x.part * 100)} %`).join(' · '), '.'),
    e.manque.length ? h('p', { class: 'discret' }, `Peu de temps cette semaine pour : ${e.manque.join(', ')}.`) : null,
    h('ol', { class: 'plan-mois' }, mois.map((w, k) => h('li', {}, h('strong', {}, k === 0 ? 'Cette semaine' : `Semaine du ${jour(w.du)}`), ' : ',
      w.lecons.length ? w.lecons.map((x) => `« ${x.titre} »`).join(', ') : 'consolidation et vitesse', ` · examen de la semaine dès le ${jour(w.examen)}.`))),
    h('p', { class: 'discret' }, 'Leçons prévues au rythme de vos 28 derniers jours (colonnes et × ÷ en alternance, une fois leurs portes passées) : une estimation, pas un engagement.'));
}

/** 0.41 : « 5 minutes seulement » aujourd'hui (séance de secours) : l'objectif du jour, sinon le réglage. */
export function objectifDuJour() {
  const r = reglagesUtilisateur();
  return r.secours === aujourdhui() ? 5 : r.objectifMinutes;
}
export const OBJECTIF_EXAMEN_BLANC = 20;
export const OBJECTIF_EXAMEN_COMPLET = 30;
export const BLOCS_SEANCE_COURTE = 3;
/** Durée minimale d'un bloc (anzan, volume / vitesse), en minutes (0.40.4). */
export const BLOC_MIN = 5;
const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/**
 * Les 5 blocs de la séance, dans l'ordre, et leur nom. 0.40.4 : l'anzan vient juste après
 * l'échauffement, l'attention encore fraîche (avant, il fermait la séance).
 */
export const ORDRE_BLOCS = ['echauffement', 'anzan', 'revision', 'lecon', 'volume'];
const NOMS_BLOCS = { echauffement: 'Échauffement', revision: 'Révision', lecon: 'Leçon', volume: 'Volume, vitesse, réflexes', anzan: 'Anzan' };

/** Une leçon se révise-t-elle dans une série mélangée ? (pas les placements ni les lectures) */
/**
 * 0.40.1 : les gestes précis déjà travaillés par la séance (ses exercices, et ceux reportés). Les
 * planches « pour compléter » les évitent : un seul exercice par geste et par séance (avant, +4 petit
 * ami recevait un sprint de surcharge, un lièvre et une planche, 9 minutes sur un seul geste).
 */
function gestesSeance(items, ciblesBloc) {
  const s = new Set(ciblesBloc.slice(0, 1));
  for (const it of items) {
    const g = gesteExercice(it.id);
    if (g) s.add(g);
    const p = it.aller?.[1];
    if (typeof p?.cible === 'string') s.add(p.cible);
    if (p?.cibles?.length === 1) s.add(p.cibles[0]);
  }
  return [...s];
}

const melangeable = (sp) => !['placement', 'lire', 'complement', 'theorie', 'photo', 'tenir'].includes(sp.type);

/** Le thème du jour, en une phrase : ce qu'on vient faire aujourd'hui. */
function themeDuJour(decision, exam, garde) {
  // 0.38.2 : la suite se lit dans les exercices RETENUS (avant, le thème recalculait son propre
  // « geste du jour » et pouvait annoncer +8 grand ami quand les blocs portaient sur les petits amis).
  const vol = garde.filter((it) => it.blocSeance === 'volume');
  const suite = vol.length ? `, puis ${vol.slice(0, 2).map((it) => `« ${it.titre} »`).join(' et ')}${vol.length > 2 ? ` (et ${vol.length - 2} autre${vol.length > 3 ? 's' : ''})` : ''}` : '';
  const premierAuto = garde.find((it) => it.blocSeance === 'lecon' && it.id);
  if (exam) return `Aujourd'hui : l'examen blanc, sur tout ce que vous savez${suite}.`;
  if (decision.type === 'lecon') return `Aujourd'hui : ${decision.titre === 'Nouvelle leçon' ? 'une nouvelle leçon' : 'la suite de la leçon'}, « ${decision.detail} »${suite}.`;
  if (decision.type === 'automatiser') return `Aujourd'hui : ${decision.reprise ? 'réveiller' : 'automatiser'} « ${decision.sp.titre} »${decision.reprise ? '' : ` jusqu'à ${decision.cible === 'argent' ? 'l\'argent' : 'l\'or'}`}${premierAuto ? ` (${premierAuto.titre.split(' · ').slice(1).join(' · ') || premierAuto.titre})` : ''}${suite}.`;
  return `Aujourd'hui : ${decision.titre ? `${decision.titre.toLowerCase()}, ${decision.detail}` : 'l\'entretien'}${suite}.`;
}

/** Suggestion pour la prochaine séance. */
function conseilDemain(d) {
  const demain = ajouterJours(aujourdhui(), 1);
  const dues = Object.values(d.paliers).filter((e) => e.carte && !e.carte.acquise && e.carte.echeance <= demain).length;
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
    const mois = (m) => (m >= 12 ? `${nf(m / 12)} an${m >= 24 ? 's' : ''}` : m < 1 ? `${Math.max(1, Math.round(m * 4.33))} semaine${m * 4.33 >= 1.5 ? 's' : ''}` : `${Math.round(m)} mois`);
    // 0.38.4 : jamais « vous tenez l'allure » sur une mesure partielle. Les colonnes estimées sur les
    // gestes (colonnes courtes) sont à confirmer au format du grade ; × et ÷ non mesurés sont dits.
    const fmt = p.format ? `une planche au format du ${p.grade.nom} (${p.format.lignes} lignes de ${p.format.chiffres} chiffres)` : 'une planche au format du grade';
    const reserves = [p.colonnesAConfirmer ? `colonnes estimées sur vos gestes, à confirmer sur ${fmt}` : null, p.muldivNonMesure ? '× et ÷ pas encore mesurés' : null].filter(Boolean);
    // 0.39 : le gain par semaine part du repère de 2 %, puis suit votre gain mesuré ; en plateau
    // (aucun gain sur 3 semaines), pas de date pour la vitesse.
    const pct = (x) => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    const gainTxt = p.gainReel == null ? `en comptant ${pct(p.gainSemaine)} % par semaine (repère : pas encore assez de semaines mesurées)`
      : `en comptant ${pct(p.gainSemaine)} % par semaine (votre gain mesuré sur ${p.semainesMesurees} semaines, mêlé au repère de 2 %)`;
    const source = p.sourceVitesse === 'examen' ? ', mesuré sous examen' : '';
    const vitesseTxt = p.plateauVitesse
      ? `, et la vitesse du ${p.grade.nom} est en plateau : aucun gain mesuré depuis 3 semaines (vous êtes à ${Math.round(100 / p.ecartVitesse)} % de son allure${source}). Pas de date tant qu'elle ne repart pas`
      : p.moisVitesse
        ? `, et la vitesse du ${p.grade.nom} environ ${mois(p.moisVitesse)} (vous êtes à ${Math.round(100 / p.ecartVitesse)} % de son allure${source}${reserves.length ? `, ${reserves.join(' ; ')}` : ''} ; ${gainTxt})`
        : reserves.length ? `, et pour la vitesse : ${reserves.join(' ; ')}` : `, et votre vitesse tient déjà l'allure du ${p.grade.nom}${source}`;
    const repere = p.base === 'rythme'
      ? `À votre rythme : les leçons demandent encore environ ${mois(p.moisLecons)}${vitesseTxt}. Recalculé chaque jour sur vos chiffres. `
      : `Repère : il faut en général encore ${duree} de pratique quotidienne pour le ${p.grade.nom} (pas encore assez de mesures pour partir de vos chiffres). `;
    if (p.plateauVitesse && p.base === 'rythme') texte = `${lecons}${repere}Pour casser le plateau : des sprints au-dessus de votre allure et les marches ; la date reviendra avec les premiers gains.`;
    else if (p.verdict === 'realiste') texte = `${lecons}${repere}C'est réaliste avec environ ${p.minutesJour} min par jour : tenez le rythme.`;
    else if (p.verdict === 'ambitieux') texte = `${lecons}${repere}C'est ambitieux : il faudrait environ ${p.minutesJour} min par jour, tous les jours. Une date réaliste : ${dateR}.`;
    else texte = `${lecons}${repere}Ce n'est pas réaliste pour cette date : visez plutôt ${dateR}${p.atteignable ? `, et d'ici là, le ${p.atteignable.nom} est un bon objectif intermédiaire` : ''}.`;
  }
  return h('details', { class: 'carte objectif' },
    h('summary', {}, h('strong', {}, `Objectif : ${p.grade.nom} le ${dateFr}`), !p.reussi && p.jours > 0 ? h('span', { class: 'compte-rebours' }, ` · J−${p.jours}`) : null, o.pourquoi ? h('span', { class: 'discret' }, ` · ${o.pourquoi}`) : null),
    h('p', { class: p.realiste || p.reussi ? '' : 'avertissement' }, texte),
    h('p', { class: 'discret' }, 'Ces durées sont des repères prudents pour un adulte qui pratique chaque jour, pas des chiffres officiels : chacun avance à son rythme.'),
    !p.reussi && p.verdict !== 'irrealiste' && p.minutesJour > reglagesUtilisateur().objectifMinutes
      ? h('button', { class: 'btn', onclick: async () => { await modifierReglages({ objectifMinutes: OBJECTIFS.find((m) => m >= p.minutesJour) ?? 60 }); rafraichir(); } }, `Passer l'objectif du jour à ${p.minutesJour} min`)
      : null,
    formulaire());
}

/**
 * État de la séance en cours, pour la barre « Suivant » affichée sur les autres écrans :
 * null si aucune séance n'est en cours.
 */
export function etatSeance() {
  const seance = seanceEnCours();
  if (!seance) return null;
  const p = planSur(progression(), seance.debut, seance);
  const restants = p.essentiel.filter((it) => !it.fait);
  return { faits: p.essentiel.length - restants.length, total: p.essentiel.length, prochaine: restants[0] ?? null, ensuite: restants[1] ?? null };
}

/**
 * Bilan de la semaine (replié) : la pratique des 7 derniers jours, ce qui est passé en or, ce
 * qui stagne, et le grade à portée (le prochain seulement : pas d'objectif lointain).
 */
function carteHebdo(d) {
  const date = aujourdhui();
  const b = bilanHebdo(d, date, plateaux(d, date).slice(0, 3));
  if (!b.semaine.jours && !b.precedente.jours) return null;
  const s = b.semaine;
  const ecart = s.minutes - b.precedente.minutes;
  const exam = examenDeLaSemaine(d);
  const r = resultatSemaine(d, date);
  const portee = exam && exam.id !== 'hebdo'
    ? (r?.reussi ? `${exam.nom} réussi cette semaine.` : `${exam.nom} : toutes ses leçons sont validées, l'examen blanc est ouvert${r ? ` (meilleur essai : ${r.points} / ${r.total})` : ''}.`)
    : libelleGrade(d).detail;
  return h('details', { class: 'carte bilan-hebdo' },
    h('summary', {}, h('strong', {}, 'Bilan de la semaine'),
      h('span', { class: 'discret' }, ` · ${s.jours} jour${s.jours > 1 ? 's' : ''} sur 7 · ${s.minutes} min${b.enOr.length ? ` · ${b.enOr.length} geste${b.enOr.length > 1 ? 's' : ''} en or` : ''}`)),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Pratique : '), `${s.jours} jour${s.jours > 1 ? 's' : ''}, ${s.minutes} min, ${s.exercices} exercice${s.exercices > 1 ? 's' : ''}${s.exercices ? `, ${formaterPourcent(s.justes, s.exercices)} de justes` : ''}`,
        b.precedente.jours ? h('span', { class: 'discret' }, ` (${ecart >= 0 ? '+' : '−'}${Math.abs(ecart)} min par rapport aux 7 jours d'avant)`) : null),
      h('li', {}, h('strong', {}, 'Passé en or : '), b.enOr.length ? `${b.enOr.slice(0, 6).join(', ')}${b.enOr.length > 6 ? ` et ${b.enOr.length - 6} autre${b.enOr.length > 7 ? 's' : ''}` : ''}` : h('span', { class: 'discret' }, 'aucun geste cette semaine : l\'or vient avec le volume.')),
      b.validees.length ? h('li', {}, h('strong', {}, `Leçon${b.validees.length > 1 ? 's' : ''} validée${b.validees.length > 1 ? 's' : ''} : `), b.validees.map((t) => `« ${t} »`).join(', ')) : null,
      h('li', {}, h('strong', {}, 'Ce qui stagne : '), b.stagne.length ? `${b.stagne.join(', ')} : le prof y revient dans les prochaines séances.` : h('span', { class: 'discret' }, 'rien, tout avance.')),
      h('li', {}, h('strong', {}, 'À portée : '), portee)));
}

/** Carte « Séance terminée » : chiffres, progrès, records, succès, et la suite pour demain. */
function carteBilan(bilan, d) {
  const succes = bilan.nouveauxSucces.map((id) => SUCCES.find((s) => s.id === id)?.nom).filter(Boolean);
  return h('div', { class: 'carte bilan-seance' },
    h('h2', { style: 'margin-top:0' }, 'Séance du jour terminée'),
    h('p', {}, `${bilan.exercices} exercice${bilan.exercices > 1 ? 's' : ''} · réussite ${formaterPourcent(bilan.justes, bilan.exercices)} · ${bilan.dureeMs >= 90000 ? `${Math.round(bilan.dureeMs / 60000)} min` : formaterDuree(bilan.dureeMs)} de pratique`),
    h('ul', {},
      bilan.progres.length ? bilan.progres.map((p) => h('li', {}, `▲ ${p}`)) : h('li', { class: 'discret' }, 'Pas de changement de niveau cette fois : la régularité finit toujours par payer.'),
      bilan.records.length ? h('li', {}, `${bilan.records.length} record${bilan.records.length > 1 ? 's' : ''} personnel${bilan.records.length > 1 ? 's' : ''} battu${bilan.records.length > 1 ? 's' : ''}`) : null,
      succes.length ? h('li', {}, `Succès : ${succes.join(', ')}`) : null),
    h('p', {}, h('strong', {}, conseilDemain(d))));
}

export default {
  id: 'seance',
  titre: 'Séance du jour',
  monter(el, app, params = {}) {
    function afficher(bilan = null) {
      remplir(el);
      const d = progression();
      const dates = [...new Set(d.sessions.map((s) => s.date))];
      const serie = serieJours(dates, aujourdhui());
      const tenues = semainesTenues(dates, aujourdhui());
      const objectif = objectifDuJour();
      const minutes = minutesAujourdhui();
      const g = grade(d);
      const seance = seanceEnCours();

      // --- tuiles : série, objectif, grade
      const choixObjectif = h('select', { 'aria-label': 'Objectif du jour, en minutes', onchange: async (e) => { await modifierReglages({ objectifMinutes: Number(e.target.value) }); afficher(bilan); } },
        OBJECTIFS.map((m) => h('option', { value: m }, `${m} min`)));
      choixObjectif.value = String(objectif);
      const premiereFois = !d.sessions.length && !Object.values(d.paliers).some((x) => x.valide);
      if (premiereFois || (params.accueil && !bilan)) {
        // Premier lancement (ou « Revoir l'accueil ») : une action, pas de compteurs à zéro.
        const sp = prochainSousPalier();
        // 0.38 : le temps par jour se choisit dès le début ; 25 minutes conseillées.
        const choixDepart = h('select', { onchange: (e) => modifierReglages({ objectifMinutes: Number(e.target.value), objectif25Vu: true }) },
          OBJECTIFS.map((m) => h('option', { value: m }, `${m} min${m === 25 ? ' (conseillé)' : ''}`)));
        choixDepart.value = String(objectif);
        el.append(h('h1', {}, 'Bienvenue'),
          h('div', { class: 'carte accueil' },
            h('p', {}, 'Ici, on apprend le soroban sur un VRAI soroban : l\'application propose les calculs, vous les faites avec vos doigts, puis vous tapez le résultat. Elle corrige, explique, et décide chaque jour de la suite.'),
            h('p', {}, 'Installez votre soroban devant vous, un crayon à portée de main, et commencez par la première leçon : elle montre comment le tenir et lire un nombre.'),
            h('p', {}, 'Temps par jour : ', choixDepart, h('span', { class: 'discret' }, ' · 25 minutes font progresser deux fois plus vite que 15 vers les grades hauts ; 15 minutes suffisent pour les débuts. Modifiable à tout moment.')),
            h('div', { class: 'ligne' },
              premiereFois
                ? h('button', { class: 'btn principal grand-bouton', onclick: async () => { await commencerSeance({}); app.aller('lecons', { sousPalier: sp?.id }); } }, `Commencer : ${sp?.titre ?? 'leçon 0'} →`)
                : h('button', { class: 'btn principal grand-bouton', onclick: () => app.aller('seance') }, 'Aller à la séance du jour →'),
              // Les « revenants » : un test place directement au bon endroit du parcours.
              h('button', { class: 'btn grand-bouton', onclick: () => app.aller('positionnement') }, 'J\'ai déjà pratiqué : tester mon niveau')),
            // 0.41 : version navigateur, nouvelle copie du fichier (« Soroban (15).html ») : la progression
            // peut sembler perdue ; on propose tout de suite de reprendre une sauvegarde.
            premiereFois && versionNavigateur ? h('p', { class: 'carte avis' }, h('strong', {}, 'Vous aviez déjà une progression ? '),
              'Dans la version navigateur, une nouvelle copie du fichier repart de zéro. Reprenez votre dernière sauvegarde : ',
              h('button', { class: 'btn', onclick: () => app.aller('reglages') }, 'Importer ma sauvegarde')) : null));
        return;
      }
      // --- plan du jour (calculé tôt : la fin de séance automatique en dépend)
      const p = planSur(d, seance ? seance.debut : Date.now(), seance);
      // Fin de séance : tout l'essentiel est fait ET l'objectif de temps est atteint. Le bilan
      // s'affiche alors de lui-même ; le plan reste disponible, enroulé, pour refaire un point.
      const essentielFait = p.essentiel.length > 0 && p.essentiel.every((it) => it.fait);
      // Tout l'essentiel fait : la séance se termine dès 70 % de l'objectif de temps (les durées sont
      // des estimations ; on ne retient pas quelqu'un qui a tout fait un peu plus vite que prévu).
      const tempsFait = minutes >= objectif * 0.7;
      if (seance && !bilan && essentielFait && tempsFait) {
        finirSeance().then((b) => afficher(b ?? null));
        return;
      }

      // --- une ligne de statut compacte : série, minutes du jour (objectif réglable), grade
      // 0.41 : où j'en suis, en une phrase : le grade préparé, ce qui reste, la séance du jour.
      const jalon = prochainJalon(d, aujourdhui());
      // 0.42.1 : « l'examen vous attend » seulement quand le plan du jour le propose ; sinon, un lien
      // pour le passer quand on veut (avant : la phrase l'annonçait sans que le plan le propose).
      const examAuPlan = [...p.essentiel, ...p.bonus, p.seanceLongue].some((it) => it?.examen);
      const allerExamen = jalon && !jalon.restantes && !examAuPlan
        ? h('button', { class: 'lien', onclick: () => (jalon.officiel ? app.aller('epreuves', { grade: jalon.id }) : app.aller('examen', {})) }, `Passer le ${jalon.nom} →`) : null;
      const phrase = jalon
        ? `Vous préparez le ${jalon.nom}${jalon.restantes ? ` · encore ${jalon.restantes} leçon${jalon.restantes > 1 ? 's' : ''}` : examAuPlan ? ' · les leçons sont faites : l\'examen vous attend dans le plan du jour' : ' · les leçons sont faites : l\'examen se passe quand vous voulez'}${jalon.jours ? ` (environ ${jalon.jours} jours à ce rythme)` : ''} · aujourd'hui : ${p.minutes} min. `
        : `Aujourd'hui : ${p.minutes} min.`;
      el.append(h('h1', {}, 'Séance du jour'),
        h('p', { class: 'ou-jen-suis' }, phrase, allerExamen),
        h('div', { class: 'statut-jour' },
          // La série de jours, écrite sur un petit soroban.
          // 0.38.3 : la régularité se compte en SEMAINES tenues (5 jours sur 7) ; la série de jours
          // reste en info-bulle. Un jour manqué ne casse plus rien.
          h('span', { class: 'serie-soroban', title: `Une semaine est tenue avec ${JOURS_SEMAINE_TENUE} jours de pratique sur 7. Série de jours : ${serie.jours}.` },
            sorobanNombre(tenues.semaines, `${tenues.semaines} semaine${tenues.semaines > 1 ? 's' : ''} tenue${tenues.semaines > 1 ? 's' : ''}`),
            h('strong', {}, `${tenues.semaines} semaine${tenues.semaines > 1 ? 's' : ''}`), ` tenue${tenues.semaines > 1 ? 's' : ''} · cette semaine ${Math.min(tenues.cetteSemaine, 7)} / ${JOURS_SEMAINE_TENUE} jours${tenues.tenueCetteSemaine ? ' ✓' : ''}`),
          h('span', {}, h('strong', {}, `${Math.floor(minutes)} / `), choixObjectif, ' aujourd\'hui',
            h('span', { class: 'jauge mini', role: 'progressbar', 'aria-label': 'Temps de pratique aujourd\'hui', 'aria-valuetext': `${Math.floor(minutes)} minutes sur ${objectif}`, 'aria-valuemin': 0, 'aria-valuenow': Math.round(minutes), 'aria-valuemax': objectif },
              h('span', { style: `width:${Math.min(100, (100 * minutes) / objectif)}%` }))),
          h('span', { title: libelleGrade(d).detail }, 'Grade : ', h('strong', {}, libelleGrade(d).valeur))));
      // 0.41 : séance de secours : un jour chargé, 5 minutes (échauffement, une révision, quelques
      // colonnes) plutôt que rien ; la journée compte comme pratiquée.
      if (!bilan && minutes < 5) {
        el.append(h('div', { class: 'ligne', style: 'margin:4px 0 8px' }, reglagesUtilisateur().secours === aujourdhui()
          ? h('button', { class: 'lien', onclick: async () => { await modifierReglages({ secours: null }); afficher(bilan); } }, `Séance de 5 minutes aujourd'hui · revenir à ${reglagesUtilisateur().objectifMinutes} minutes`)
          : h('button', { class: 'lien', onclick: async () => { await modifierReglages({ secours: aujourdhui() }); afficher(bilan); } }, 'Pas le temps aujourd\'hui ? 5 minutes seulement')));
      }
      prendreAvis().then((avis) => avis.forEach((a) => el.querySelector('.statut-jour')?.after(h('div', { class: 'carte avis' }, a))));
      // Version navigateur : rappel d'export (les données ne vivent que dans ce navigateur).
      const premiere = d.sessions[0]?.date;
      if (versionNavigateur && premiere && premiere <= ajouterJours(aujourdhui(), -7) && (!d.dernierExport || d.dernierExport <= ajouterJours(aujourdhui(), -7))) {
        el.append(h('div', { class: 'carte avis ligne' },
          h('span', { style: 'flex:1' }, d.dernierExport ? `Dernier export de votre progression : il y a plus de 7 jours.` : 'Vous n\'avez encore jamais exporté votre progression.', ' Elle ne vit que dans ce navigateur : un nettoyage des données de navigation l\'effacerait.'),
          h('button', { class: 'btn', onclick: async () => { await telechargerExport(); afficher(bilan); } }, 'Exporter maintenant')));
      }
      // 0.38 : une fois, aux élèves restés à 15 minutes, la proposition de passer à 25.
      if (objectif === 15 && !reglagesUtilisateur().objectif25Vu && d.sessions.length) {
        el.append(h('div', { class: 'carte avis' },
          h('p', { style: 'margin-top:0' }, h('strong', {}, '15 ou 25 minutes par jour ? '), 'Les leçons tiennent en 15 minutes, mais la vitesse d\'examen se construit au volume : avec 25 minutes, la séance garde chaque jour la leçon, la révision, un bloc de vitesse ET l\'anzan, et les grades hauts arrivent bien plus tôt. À 15 minutes, la séance garde 3 blocs par jour.'),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: async () => { await modifierReglages({ objectifMinutes: 25, objectif25Vu: true }); afficher(bilan); } }, 'Passer à 25 minutes'),
            h('button', { class: 'btn', onclick: async () => { await modifierReglages({ objectif25Vu: true }); afficher(bilan); } }, 'Garder 15 minutes'))));
      }
      // 10e kyū express (0.38) : les colonnes suffisent ; on le propose dès la fin de p5.
      if (g.pret && g.prochain?.id === '10' && !bilan) {
        el.append(h('div', { class: 'carte avis' },
          h('p', { style: 'margin-top:0' }, h('strong', {}, 'Votre premier kyū officiel est à portée : le 10e kyū. '), 'Le mitorizan seul rapporte 100 points sur 200, et il en faut 60 : vos colonnes suffisent. La multiplication du sujet viendra avec les leçons suivantes ; passez-le quand vous voulez, sans attendre.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('epreuves', { grade: '10', auto: true }) }, `Passer le 10e kyū (${g.prochain.minutes} min) →`)));
      }
      el.append(carteObjectif(d, () => afficher(bilan)));

      // --- séance terminée aujourd'hui : bilan, puis « Et maintenant ? » (une planche, un flash
      //     anzan, un jeu), et le plan enroulé pour refaire un point si on veut.
      const terminee = !seance && (bilan ?? (d.seanceTerminee?.date === aujourdhui() ? d.seanceTerminee.bilan : null));
      const ligne = (it, i) => h('button', {
        class: `ligne-palier${it.fait ? ' valide' : ''}${it.priorite ? ' priorite' : ''}`,
        onclick: async () => { if (!seanceEnCours() && !terminee) await demarrer(); app.aller(...it.aller); },
      }, h('span', { class: `icone${it.fait ? ' etat-fait' : ' numero'}` }, it.fait ? '✓' : i !== null ? String(i + 1) : '+'),
      h('span', { class: 'titre' }, h('strong', {}, it.titre), it.but ? h('span', { class: 'but-proposition' }, ` · ${it.but}`) : null, ' · ', ...avecInfobulles(String(it.detail ?? '')), it.pourquoi && !it.fait ? h('span', { class: 'pourquoi-point' }, ...avecInfobulles(it.pourquoi)) : null),
      h('span', { class: 'statut' }, it.fait ? 'fait' : `${it.minutes} min`));
      const demarrer = () => commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()), decision: p.decision, gesteBloc: p.gesteBloc, blocIds: p.blocIds, partie: p.partie });
      // Séance longue (0.38) : l'examen de la semaine, proposé à part quand l'objectif est court.
      const carteLongue = p.seanceLongue ? h('div', { class: 'carte avis' },
        h('p', { style: 'margin-top:0' }, h('strong', {}, `Séance longue du week-end · ${p.seanceLongue.titre}`), ` : ${p.seanceLongue.detail}, environ ${p.seanceLongue.minutes} min.`),
        h('p', { class: 'discret' }, `${objectif < p.seanceLongue.minutes ? `Votre objectif du jour (${objectif} min) est plus court : faites` : 'La leçon garde sa place aujourd\'hui : faites'}-le À LA PLACE de la séance du jour, quand vous avez le temps, d'ici dimanche. Pas fait cette semaine ? Rien n'est perdu, il revient la semaine prochaine.`),
        h('button', { class: 'btn', onclick: async () => { if (!seanceEnCours() && !terminee) await demarrer(); app.aller(...p.seanceLongue.aller); } }, 'Faire l\'examen à la place de la séance →')) : null;
      if (terminee) {
        el.append(carteBilan(terminee, d));
        if (carteLongue) el.append(carteLongue);
        const idees = propositions(d, aujourdhui(), motifsEnDifficulte(), 0);
        const [principale, ...autres] = idees;
        el.append(h('div', { class: 'carte suggestion' },
          h('h2', { style: 'margin-top:0' }, 'Et maintenant ?'),
          principale ? [h('p', {}, h('strong', {}, principale.titre), ' : ', principale.detail),
            h('div', { class: 'ligne' },
              h('button', { class: 'btn principal', onclick: () => app.aller(...principale.aller) }, `${principale.titre} →`),
              autres.map((x) => h('button', { class: 'btn', title: x.detail, onclick: () => app.aller(...x.aller) }, x.titre)))] : null,
          h('p', { class: 'discret' }, 'Ou arrêtez-vous là : la régularité compte plus que la durée. À demain !')),
          // Le plan du jour, enroulé : on peut refaire un point.
          h('details', { class: 'carte plan-enroule' },
            h('summary', {}, h('strong', {}, `Séance du jour ✓`), h('span', { class: 'discret' }, ' : cliquez pour refaire un point')),
            h('div', { class: 'liste-paliers' }, p.essentiel.map((it, i) => ligne(it, i)))),
          carteHebdo(d));
        return;
      }

      // --- le prof et le plan (chaque ligne s'ouvre d'un clic ; le premier clic commence la séance)
      // Une seule grande action : la prochaine étape non faite (la séance démarre au premier clic).
      const faits = p.essentiel.filter((it) => it.fait).length;
      const prochaine = p.essentiel.find((it) => !it.fait) ?? p.bonus.find((it) => !it.fait);
      // Où en est-on par rapport aux deux conditions de fin (tout l'essentiel, et l'objectif de temps) ?
      const resteMin = Math.max(0, Math.ceil(objectif - minutes));
      if (seance && essentielFait && !tempsFait) {
        el.append(h('div', { class: 'carte avis ligne' }, h('span', { style: 'flex:1' }, h('strong', {}, 'L\'essentiel est fait. '), `Vous avez été plus rapide que prévu (${Math.floor(minutes)} min sur ${objectif}). Arrêtez-vous là, ou piochez dans « Pour compléter » si vous voulez continuer.`),
          h('button', { class: 'btn principal', onclick: async () => { const b = await finirSeance(); afficher(b); } }, 'Terminer la séance')));
      } else if (seance && minutes >= objectif && !essentielFait) {
        el.append(h('div', { class: 'carte avis ligne' },
          h('span', { style: 'flex:1' }, h('strong', {}, 'Objectif de temps atteint. '), `Il reste ${p.essentiel.filter((it) => !it.fait).length} point${p.essentiel.filter((it) => !it.fait).length > 1 ? 's' : ''} : continuez si vous le souhaitez, ou arrêtez-vous là (ils passeront à demain).`),
          h('button', { class: 'btn', onclick: async () => { const b = await finirSeance(); afficher(b); } }, 'Terminer la séance')));
      }
      if (carteLongue) el.append(carteLongue);
      if (prochaine) {
        el.append(h('div', { class: 'continuer' },
          seance ? h('div', { class: 'etape-seance' }, `Étape ${Math.min(faits + 1, p.essentiel.length)} sur ${p.essentiel.length}`) : null,
          h('button', { class: 'btn principal grand-bouton', onclick: async () => { if (!seanceEnCours()) await demarrer(); app.aller(...prochaine.aller); } },
            `${seance ? 'Continuer' : 'Commencer'} : ${prochaine.titre} →`),
          h('div', { class: 'discret' }, prochaine.detail)));
      }
      // Téléphone : les deux premiers points, le reste replié (ouvert d'office sur grand écran).
      const [debut, suite] = [p.mot.slice(0, 2), p.mot.slice(2)];
      const large = typeof window === 'undefined' || window.innerWidth > 700;
      el.append(h('div', { class: 'carte mot-prof' }, h('div', { class: 'mot-prof-titre' }, 'Le mot du prof'), debut.map((x) => h('p', {}, x)),
        suite.length ? h('details', { class: 'mot-prof-suite', ...(large ? { open: true } : {}) }, h('summary', {}, `La suite (${suite.length})`), suite.map((x) => h('p', {}, x))) : null));
      const entete = h('div', { class: 'ligne' },
        h('h2', { style: 'margin:0;flex:1' }, seance ? `Séance en cours depuis ${new Date(seance.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${faits} / ${p.essentiel.length}` : 'Votre séance'),
        seance ? h('button', { class: 'lien', onclick: async () => { const b = await finirSeance(); afficher(b); } }, 'Finir maintenant et voir le bilan') : null);
      // Les 5 blocs : une barre de temps (la répartition d'un coup d'œil), puis chaque bloc
      // repliable ; un bloc terminé se referme, le bloc en cours reste ouvert.
      const blocs = ORDRE_BLOCS.map((id) => ({ id, nom: NOMS_BLOCS[id], points: p.essentiel.filter((it) => it.blocSeance === id) })).filter((b) => b.points.length)
        .map((b) => ({ ...b, minutes: b.points.reduce((t, it) => t + it.minutes, 0), fait: b.points.every((it) => it.fait) }));
      const enCours = blocs.find((b) => !b.fait);
      const nomBloc = (b) => (b.id === 'lecon' ? (b.points.some((it) => it.examen) ? 'Examen blanc' : p.decision.type === 'automatiser' ? 'Automatiser' : 'Leçon') : b.nom);
      const barre = h('div', { class: 'barre-blocs', role: 'img', 'aria-label': `Répartition de la séance : ${blocs.map((b) => `${nomBloc(b)} ${b.minutes} min`).join(', ')}` },
        blocs.map((b) => h('span', { class: `segment bloc-${b.id}${b.fait ? ' fait' : ''}${b === enCours ? ' en-cours' : ''}`, style: `flex:${Math.max(1.5, b.minutes)} 1 0`, title: `${nomBloc(b)} : ${b.minutes} min` },
          h('span', { class: 'segment-nom' }, `${b.fait ? '✓ ' : ''}${nomBloc(b)}`), h('span', { class: 'segment-min' }, `${b.minutes} min`))));
      let numero = 0;
      const sections = blocs.map((b) => h('details', { class: `bloc-seance bloc-${b.id}${b.fait ? ' fait' : ''}`, open: b === enCours || (!seance && !b.fait) ? '' : null },
        h('summary', {}, h('span', { class: 'pastille' }), h('strong', {}, nomBloc(b)), h('span', { class: 'discret' }, b.fait ? ' · fait' : ` · ${b.minutes} min · ${b.points.length} point${b.points.length > 1 ? 's' : ''}`)),
        h('div', { class: 'liste-paliers' }, b.points.map((it) => ligne(it, numero++)))));
      el.append(h('div', { class: 'carte' }, entete,
        h('h3', { class: 'titre-plan' }, `L'essentiel · environ ${p.minutes} min`, h('span', { class: 'discret' }, ' : dans cet ordre, chaque bloc prépare le suivant')),
        barre, sections,
        h('h3', { class: 'titre-plan' }, 'Pour compléter', h('span', { class: 'discret' }, resteMin > p.minutes ? ` : il vous reste du temps, piochez ici (une nouvelle planche remplace celle qui est faite)` : ' : si vous avez encore du temps')),
        h('div', { class: 'liste-paliers' }, p.bonus.map((it) => ligne(it, null))),
        h('p', { class: 'discret' }, `La séance se termine d'elle-même quand les ${p.essentiel.length} points de l'essentiel sont faits (${Math.floor(minutes)} min aujourd'hui, objectif ${objectif} min) : la liste est fixée au début de la séance, aucun exercice ne s'y ajoute en route. « Pour compléter » est facultatif.`)),
        carteHebdo(d), carteSemaineMois(d));
    }
    afficher();
  },
};
