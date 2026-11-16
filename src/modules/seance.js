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
  minutesAujourdhui, prendreAvis, reglagesUtilisateur, modifierReglages, motifsEnDifficulte, versionNavigateur, erreursARejouer,
  erreursOperationRepetees, traiterErreurOperation,
} from '../core/progression.js';
import { telechargerExport } from '../ui/exporter.js';
import { serieJours } from '../core/regularite.js';
import { grade, drillEchauffement, gestesLents, verificationVitesse, anzanAdapte, placementDuJour, coursMultiplicationAtteint, prioriteDuJour, planObjectif, consolidationDuJour, ancrageDuJour, estValide } from '../core/parcours.js';
import { ENTRAINEMENTS_ERREUR } from '../core/diagnostic.js';
import { GRADES } from '../core/epreuves.js';
import { diagnosticTablesFait, produitsARetravailler } from '../core/tables.js';
import { SUCCES } from '../core/succes.js';
import { nomMotif, diagnosticPincee } from '../core/motifs.js';
import { ajouterJours } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { decisionDuJour, motDuProf, gestesLecon, derniereLecon } from '../core/prof.js';
import { exercicesBloc, jourVitesse, gesteDuJour } from '../core/blocs.js';
import { sousPalier } from '../core/curriculum.js';
import { propositions, minutesPlanche, secondesParChiffre } from '../core/propositions.js';
import { tempsClassement } from '../core/drills.js';
import { prochainGradeFlash, meilleurGradeFlash, libelleGradeFlash, QUESTIONS_GRADE_FLASH, JUSTES_GRADE_FLASH } from '../core/flashGrades.js';
import { semaineISO } from '../core/hasard.js';
import { voixDisponible } from '../ui/voix.js';
import { sorobanNombre } from '../ui/perles.js';
import { examenDeLaSemaine, resultatSemaine, libelleGrade, formatBlanc, minutesBlanc, MINUTES_BLANC_SPRINT, SOCLE, aSocle, prekyuObtenu } from '../core/examen.js';
import { bilanHebdo } from '../core/bilan.js';
import { plateaux, chiffresAppris as chiffresApprisDe } from '../core/parcours.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

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
  const reste = Math.max(0, (sp.repetitions ?? 20) - (e.reps ?? 0));
  return Math.max(5, Math.ceil(((reste + (sp.testNombre ?? 15)) * parExo) / 60) + (e.reps ? 0 : 3));
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
function plan(d, debut, seance = null) {
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
    essentiel.push({ titre: 'Échauffement', detail: drill.titre, minutes: Math.max(1, Math.ceil((tempsClassement(drill, 'bronze') * 1.3) / 60000)), pourquoi: 'Les doigts se réveillent sur une suite connue : on ne commence jamais à froid.',
      fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables') && s.mode !== 'quotient'), aller: ['drills', { drill: drill.id }] });
  }
  const objectif = reglagesUtilisateur().objectifMinutes;
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
    const melangeables = dues.filter(melangeable);
    const noms = melangeables.slice(0, 5).map((x) => `« ${x.titre} »`);
    essentiel.push({ titre: 'Révision', minutes: Math.max(2, Math.ceil((10 * parExo) / 60)), fait: revisionFaite,
      detail: !dues.length ? 'faite' : melangeables.length > 1
        ? `10 calculs qui mélangent ${noms.join(', ')}${melangeables.length > 5 ? ' (les plus en retard ; les autres demain)' : ''}`
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
  // Avec un objectif de moins de 10 minutes, l'examen (14 à 20 min) reste proposé « pour
  // compléter » : la leçon garde sa place.
  const examEssentiel = exam && (passeAujourdhui || (fenetreExamen && !examFait && (objectif >= 10 || (aSocle(exam) && !prekyuObtenu(d, exam)))));
  const vitesse = jourVitesse(d, date);
  const decisionFaite = (dec) => fait((s) => (dec.aller[0] === 'lecons' ? s.module === 'lecons' && s.reglages?.sousPalier === dec.aller[1].sousPalier
    : s.module === 'rythme' && s.mode === 'marathon' && (!dec.cibles || (s.reglages?.cibles ?? []).includes(dec.cibles[0]))));
  const decision = seance?.decision && seance.decision.type === 'lecon' && decisionFaite(seance.decision) ? seance.decision : decisionDuJour(d, date, sp);
  const difficiles = motifsEnDifficulte();
  // Budget de chaque bloc, sur l'objectif : la leçon garde une part fixe (5 à 10 min) ; le temps
  // en plus va au volume / vitesse et à l'anzan.
  const partLecon = Math.max(5, Math.min(10, Math.round(objectif * 0.35)));
  const minutesAnzan = Math.max(2, Math.min(6, Math.round(objectif * 0.1)));
  const exclus = [];
  let isolesBloc3 = 0;
  // Trois premiers grades préparatoires, pas encore obtenus : le socle (10 colonnes, sans chrono).
  const examSocle = !!exam && aSocle(exam) && !prekyuObtenu(d, exam);
  if (examEssentiel && (examSocle || (aSocle(exam) && examFait?.socle && passeAujourdhui))) {
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
    const items = cibles.length
      ? exercicesBloc(d, date, { genres: [vitesse ? 'vitesse-isole' : 'volume-isole'], cibles, difficiles, minutes: partLecon, geste: seance?.gesteBloc })
      : [];
    if (!items.length) items.push({ id: 'lecon', titre: decision.titre, detail: decision.detail, minutes: partLecon, aller: decision.aller, fait: decisionFaite(decision) });
    isolesBloc3 = items.filter((it) => it.genre?.endsWith('-isole')).length;
    items.forEach((it, i) => { exclus.push(it.id); essentiel.push({ ...it, titre: i ? it.titre : `${decision.titre} · ${it.titre}`, decision: i === 0, pourquoi: i ? it.pourquoi : `${decision.raison} ${it.pourquoi ?? ''}`.trim() }); });
  } else {
    essentiel.push({ titre: decision.titre, detail: decision.detail, minutes: partLecon, aller: decision.aller, decision: true, pourquoi: decision.raison, fait: decisionFaite(decision) });
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
  const avantMult = !multAtteinte && !!sp && ['p4', 'p5'].includes(sp.palier.id);
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
  } else if (avantMult ? (tablesFaites || !vitesse) : multAtteinte && (aRetravailler || [2, 6].includes(jourSemaine) || tablesFaites)) {
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
  const genres = decision.type === 'automatiser'
    ? (vitesse ? ['vitesse-melange', 'volume-melange', 'vitesse-isole', 'volume-isole'] : ['volume-melange', 'vitesse-isole', 'volume-isole', 'vitesse-melange'])
    : (vitesse ? ['vitesse-isole', 'vitesse-melange', 'volume-melange'] : ['volume-melange', 'volume-isole', 'vitesse-melange']);
  const resteBloc = objectif - prevu;
  if (ciblesBloc.length && resteBloc >= 2) {
    for (const it of exercicesBloc(d, date, { genres, cibles: ciblesBloc, difficiles, minutes: resteBloc, exclure: exclus, isolesDeja: isolesBloc3, geste: seance?.gesteBloc })) {
      essentiel.push({ ...it, titre: it.titre, bloc: vitesse ? 'vitesse' : 'volume' });
    }
  }
  if (itemAnzan) essentiel.push(itemAnzan);

  // ---- Calibrage : l'essentiel tient dans l'objectif (durées estimées sur la vitesse réelle de
  //      l'apprenant). Ce qui dépasse passe dans « Pour compléter ».
  const reportes = [];
  let cumul = 0;
  const garde = [];
  // L'anzan (en dernier) garde sa place : son temps est réservé dès le début.
  // Séance en cours : les exercices des blocs « automatiser » et « volume / vitesse » sont ceux
  // prévus AU DÉBUT, pas un de plus. Sans cela, chaque exercice fait libérait du temps (ou changeait
  // le geste le plus lent) et un nouvel exercice prenait sa place : la séance ne finissait jamais.
  if (seance?.blocIds) {
    for (let i = essentiel.length - 1; i >= 0; i--) if (essentiel[i].id && !seance.blocIds.includes(essentiel[i].id)) essentiel.splice(i, 1);
  }
  const reserve = itemAnzan ? itemAnzan.minutes : 0;
  for (const [i, it] of essentiel.entries()) {
    const reste = objectif - cumul - (it === itemAnzan ? 0 : reserve);
    // L'examen blanc garde TOUJOURS sa place (c'est lui, la séance du jour), même s'il dépasse
    // l'objectif ; l'anzan lui cède alors la sienne.
    const anzanGarde = it === itemAnzan && !(examEssentiel && cumul >= objectif);
    if (it.fait || i === 0 || anzanGarde || it.examen || it.minutes <= reste) { garde.push(it); cumul += it.minutes; continue; } // un point fait garde son temps : il ne libère pas de place
    if (it.decision && reste >= 3) {
      garde.push({ ...it, minutes: reste, detail: `${it.detailCourt ?? it.detail} (${reste} min aujourd'hui, la suite demain si besoin)` });
      cumul += reste;
      continue;
    }
    reportes.push(it);
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
  // Les 5 blocs de la séance : chaque point appartient à l'un d'eux (dans cet ordre).
  for (const it of garde) {
    it.blocSeance = it.titre === 'Échauffement' ? 'echauffement' : ['À revoir', 'Révision'].includes(it.titre) ? 'revision'
      : it.examen || it.decision || (decision.type === 'automatiser' && exclus.includes(it.id)) ? 'lecon' : it === itemAnzan ? 'anzan' : 'volume';
  }
  garde.sort((a, b) => ORDRE_BLOCS.indexOf(a.blocSeance) - ORDRE_BLOCS.indexOf(b.blocSeance));
  const minutes = garde.reduce((t, it) => t + it.minutes, 0);
  const theme = themeDuJour(decision, examEssentiel ? exam : null, vitesse, gesteDuJour(d, ciblesBloc, difficiles));
  const mot = motDuProf(d, date, decision, { theme, difficiles, vitesse, examenHorsSeance: !!exam && !examEssentiel });
  // Pour compléter (une fois l'objectif atteint) : ce qui n'a pas tenu, puis une planche, un flash
  // anzan, un jeu (et, si le temps restant est long, d'autres idées).
  const restant = Math.max(0, objectif - minutesAujourdhui() - garde.filter((it) => !it.fait).reduce((t, it) => t + it.minutes, 0));
  const complements = [...reportes.filter((it) => !it.fait), ...propositions(d, date, difficiles, restant, ciblesBloc.slice(0, 1))];
  return { essentiel: garde, bonus: complements, mot, minutes, decision, theme, gesteBloc: gesteDuJour(d, ciblesBloc, difficiles), blocIds: garde.filter((it) => it.id).map((it) => it.id) };
}

/** Les 5 blocs de la séance, dans l'ordre, et leur nom. */
export const ORDRE_BLOCS = ['echauffement', 'revision', 'lecon', 'volume', 'anzan'];
const NOMS_BLOCS = { echauffement: 'Échauffement', revision: 'Révision', lecon: 'Leçon', volume: 'Volume, vitesse, réflexes', anzan: 'Anzan' };

/** Une leçon se révise-t-elle dans une série mélangée ? (pas les placements ni les lectures) */
const melangeable = (sp) => !['placement', 'lire', 'complement', 'theorie', 'photo', 'tenir'].includes(sp.type);

/** Le thème du jour, en une phrase : ce qu'on vient faire aujourd'hui. */
function themeDuJour(decision, exam, vitesse, g) {
  const geste = g ? nomMotif(g) : null;
  const bloc = vitesse ? `de la vitesse${geste ? ` sur ${geste}` : ''}, seul puis mélangé` : `du volume${geste ? ` sur ${geste}` : ''}, seul puis mélangé`;
  if (exam) return `Aujourd'hui : l'examen blanc, sur tout ce que vous savez, puis ${bloc}.`;
  if (decision.type === 'lecon') return `Aujourd'hui : ${decision.titre === 'Nouvelle leçon' ? 'une nouvelle leçon' : 'la suite de la leçon'}, « ${decision.detail} », puis ${bloc}.`;
  if (decision.type === 'automatiser') return `Aujourd'hui : ${decision.reprise ? 'réveiller' : 'automatiser'} « ${decision.sp.titre} »${decision.reprise ? '' : ` jusqu'à ${decision.cible === 'argent' ? 'l\'argent' : 'l\'or'}`} : ${bloc}.`;
  return `Aujourd'hui : ${bloc}.`;
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

/**
 * État de la séance en cours, pour la barre « Suivant » affichée sur les autres écrans :
 * null si aucune séance n'est en cours.
 */
export function etatSeance() {
  const seance = seanceEnCours();
  if (!seance) return null;
  const p = plan(progression(), seance.debut, seance);
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
      const objectif = reglagesUtilisateur().objectifMinutes;
      const minutes = minutesAujourdhui();
      const g = grade(d);
      const seance = seanceEnCours();

      // --- tuiles : série, objectif, grade
      const choixObjectif = h('select', { onchange: async (e) => { await modifierReglages({ objectifMinutes: Number(e.target.value) }); afficher(bilan); } },
        [5, 10, 15, 20, 30, 45, 60].map((m) => h('option', { value: m }, `${m} min`)));
      choixObjectif.value = String(objectif);
      const premiereFois = !d.sessions.length && !Object.values(d.paliers).some((x) => x.valide);
      if (premiereFois || (params.accueil && !bilan)) {
        // Premier lancement (ou « Revoir l'accueil ») : une action, pas de compteurs à zéro.
        const sp = prochainSousPalier();
        el.append(h('h1', {}, 'Bienvenue'),
          h('div', { class: 'carte accueil' },
            h('p', {}, 'Ici, on apprend le soroban sur un VRAI soroban : l\'application propose les calculs, vous les faites avec vos doigts, puis vous tapez le résultat. Elle corrige, explique, et décide chaque jour de la suite.'),
            h('p', {}, 'Installez votre soroban devant vous, un crayon à portée de main, et commencez par la première leçon : elle montre comment le tenir et lire un nombre.'),
            h('div', { class: 'ligne' },
              premiereFois
                ? h('button', { class: 'btn principal grand-bouton', onclick: async () => { await commencerSeance({}); app.aller('lecons', { sousPalier: sp?.id }); } }, `Commencer : ${sp?.titre ?? 'leçon 0'} →`)
                : h('button', { class: 'btn principal grand-bouton', onclick: () => app.aller('seance') }, 'Aller à la séance du jour →'),
              // Les « revenants » : un test place directement au bon endroit du parcours.
              h('button', { class: 'btn grand-bouton', onclick: () => app.aller('positionnement') }, 'J\'ai déjà pratiqué : tester mon niveau'))));
        return;
      }
      // --- plan du jour (calculé tôt : la fin de séance automatique en dépend)
      const p = plan(d, seance ? seance.debut : Date.now(), seance);
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
      el.append(h('h1', {}, 'Séance du jour'),
        h('div', { class: 'statut-jour' },
          // La série de jours, écrite sur un petit soroban.
          h('span', { class: 'serie-soroban', title: `${septJours(dates)} jours de pratique sur les 7 derniers` },
            sorobanNombre(serie.jours, `${serie.jours} jour${serie.jours > 1 ? 's' : ''} de série`), h('strong', {}, `${serie.jours} jour${serie.jours > 1 ? 's' : ''}`), ' de série'),
          h('span', {}, h('strong', {}, `${Math.floor(minutes)} / `), choixObjectif, ' aujourd\'hui',
            h('span', { class: 'jauge mini', role: 'progressbar', 'aria-valuenow': Math.round(minutes), 'aria-valuemax': objectif },
              h('span', { style: `width:${Math.min(100, (100 * minutes) / objectif)}%` }))),
          h('span', { title: libelleGrade(d).detail }, 'Grade : ', h('strong', {}, libelleGrade(d).valeur))));
      prendreAvis().then((avis) => avis.forEach((a) => el.querySelector('.statut-jour')?.after(h('div', { class: 'carte avis' }, a))));
      // Version navigateur : rappel d'export (les données ne vivent que dans ce navigateur).
      const premiere = d.sessions[0]?.date;
      if (versionNavigateur && premiere && premiere <= ajouterJours(aujourdhui(), -7) && (!d.dernierExport || d.dernierExport <= ajouterJours(aujourdhui(), -14))) {
        el.append(h('div', { class: 'carte avis ligne' },
          h('span', { style: 'flex:1' }, d.dernierExport ? `Dernier export de votre progression : il y a plus de 14 jours.` : 'Vous n\'avez encore jamais exporté votre progression.', ' Elle ne vit que dans ce navigateur : un nettoyage des données de navigation l\'effacerait.'),
          h('button', { class: 'btn', onclick: async () => { await telechargerExport(); afficher(bilan); } }, 'Exporter maintenant')));
      }
      el.append(carteObjectif(d, () => afficher(bilan)));

      // --- séance terminée aujourd'hui : bilan, puis « Et maintenant ? » (une planche, un flash
      //     anzan, un jeu), et le plan enroulé pour refaire un point si on veut.
      const terminee = !seance && (bilan ?? (d.seanceTerminee?.date === aujourdhui() ? d.seanceTerminee.bilan : null));
      const ligne = (it, i) => h('button', {
        class: `ligne-palier${it.fait ? ' valide' : ''}${it.priorite ? ' priorite' : ''}`,
        onclick: async () => { if (!seanceEnCours() && !terminee) await demarrer(); app.aller(...it.aller); },
      }, h('span', { class: `icone${it.fait ? ' etat-fait' : ' numero'}` }, it.fait ? '✓' : i !== null ? String(i + 1) : '+'),
      h('span', { class: 'titre' }, h('strong', {}, it.titre), it.but ? h('span', { class: 'but-proposition' }, ` · ${it.but}`) : null, ` · ${it.detail}`, it.pourquoi && !it.fait ? h('span', { class: 'pourquoi-point' }, it.pourquoi) : null),
      h('span', { class: 'statut' }, it.fait ? 'fait' : `${it.minutes} min`));
      const demarrer = () => commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()), decision: p.decision, gesteBloc: p.gesteBloc, blocIds: p.blocIds });
      if (terminee) {
        el.append(carteBilan(terminee, d));
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
      if (prochaine) {
        el.append(h('div', { class: 'continuer' },
          seance ? h('div', { class: 'etape-seance' }, `Étape ${Math.min(faits + 1, p.essentiel.length)} sur ${p.essentiel.length}`) : null,
          h('button', { class: 'btn principal grand-bouton', onclick: async () => { if (!seanceEnCours()) await demarrer(); app.aller(...prochaine.aller); } },
            `${seance ? 'Continuer' : 'Commencer'} : ${prochaine.titre} →`),
          h('div', { class: 'discret' }, prochaine.detail)));
      }
      el.append(h('div', { class: 'carte mot-prof' }, h('div', { class: 'mot-prof-titre' }, 'Le mot du prof'), p.mot.map((x) => h('p', {}, x))));
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
        carteHebdo(d));
    }
    afficher();
  },
};
