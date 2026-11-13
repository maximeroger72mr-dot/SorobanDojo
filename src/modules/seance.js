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
import { nomMotif } from '../core/motifs.js';
import { ajouterJours } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { decisionDuJour, motDuProf, gestesLecon, derniereLecon } from '../core/prof.js';
import { exercicesBloc, jourVitesse, gesteDuJour } from '../core/blocs.js';
import { sousPalier } from '../core/curriculum.js';
import { propositions, minutesPlanche, secondesParChiffre } from '../core/propositions.js';
import { tempsClassement } from '../core/drills.js';
import { sorobanNombre } from '../ui/perles.js';
import { examenDeLaSemaine, resultatSemaine, minutesExamen, libelleGrade } from '../core/examen.js';
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
      fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables')), aller: ['drills', { drill: drill.id }] });
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
  const examEssentiel = exam && (passeAujourdhui || (fenetreExamen && !examFait));
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
  if (examEssentiel) {
    essentiel.push({ titre: exam.id === 'hebdo' ? 'Examen blanc' : `Examen blanc · ${exam.nom}`, minutes: minutesExamen(exam), aller: ['examen', {}], examen: true, fait: !!examFait && passeAujourdhui,
      detail: examFait && passeAujourdhui ? `${examFait.points} / ${examFait.total}${examFait.reussi ? ', réussi' : ', pas encore : retentez la semaine prochaine'}` : `20 problèmes en ${minutesExamen(exam)} min, sur tout ce que vous savez, en conditions d'examen`,
      pourquoi: 'Du vendredi au dimanche, l\'examen blanc prend la place de la leçon : on se mesure, chronométré, sans aide.' });
  } else if (decision.type === 'lecon') {
    const dureeLecon = dureeDecision(d, decision, parExo);
    const coupee = dureeLecon > partLecon;
    const tempsLecon = depuis.filter((s) => s.module === 'lecons' && s.reglages?.sousPalier === decision.aller[1].sousPalier).reduce((t, s) => t + (s.dureeMs ?? 0), 0);
    essentiel.push({ titre: decision.titre, detail: coupee ? `${decision.detail} (${partLecon} min aujourd'hui, une partie seulement : la suite demain)` : decision.detail, detailCourt: decision.detail, minutes: coupee ? partLecon : dureeLecon, aller: decision.aller, decision: true,
      pourquoi: decision.raison, fait: decisionFaite(decision) && (!coupee || tempsLecon >= partLecon * 60000 || !!d.paliers[decision.sp.id]?.valide) });
  } else if (decision.type === 'automatiser') {
    const cibles = gestesLecon(decision.sp);
    const items = cibles.length
      ? exercicesBloc(d, date, { genres: [vitesse ? 'vitesse-isole' : 'volume-isole'], cibles, difficiles, minutes: partLecon })
      : [];
    if (!items.length) items.push({ id: 'lecon', titre: decision.titre, detail: decision.detail, minutes: partLecon, aller: decision.aller, fait: decisionFaite(decision) });
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
  if (coursMultiplicationAtteint(d, sp) && !diagnosticTablesFait(d.tables ?? {})) {
    essentiel.push({ titre: 'Diagnostic des tables', detail: 'les 81 produits, une fois chacun', minutes: 4,
      pourquoi: 'Un produit hésitant bloque toute la multiplication. Les produits faux ou plus lents que 2,5 s seront ensuite travaillés chaque jour, jusqu\'à ce qu\'ils passent.',
      fait: fait((s) => s.module === 'drills' && s.mode === 'tables-81'), aller: ['drills', { tables: '81' }] });
  } else if (coursMultiplicationAtteint(d, sp) && d.paliers['p7-e']?.valide && jourSemaine % 2 === 1) {
    // Un jour sur deux, une fois la division par 2 chiffres abordée : l'estimation du quotient.
    essentiel.push({ titre: 'Estimation du quotient (réflexe)', detail: '20 divisions, une touche par réponse', minutes: 3,
      pourquoi: 'Trouver d\'emblée le bon chiffre du quotient, c\'est ce qui fait la vitesse des divisions par 2 chiffres.',
      fait: fait((s) => s.module === 'drills' && s.mode === 'quotient'), aller: ['drills', { quotient: true }] });
  } else if (coursMultiplicationAtteint(d, sp)) {
    const aRetravailler = produitsARetravailler(d.tables ?? {}).length;
    essentiel.push({ titre: 'Tables (réflexe)', detail: aRetravailler ? `20 produits : vos ${aRetravailler} produits à retravailler` : '20 produits, vos plus lents en priorité', minutes: 3, pourquoi: 'En multiplication, chaque hésitation sur un produit se paie à chaque chiffre.',
      fait: fait((s) => s.module === 'drills' && String(s.mode).startsWith('tables')), aller: ['drills', { tables: 'lents', auto: true }] });
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
    itemAnzan = leconAnzan
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
  const ciblesBloc = decision.type === 'automatiser' ? gestesLecon(decision.sp)
    : [...new Set([...gestesLecon(derniere), ...difficiles.map((m) => m.cle)])];
  const genres = decision.type === 'automatiser'
    ? (vitesse ? ['vitesse-melange', 'volume-melange', 'vitesse-isole', 'volume-isole'] : ['volume-melange', 'vitesse-isole', 'volume-isole', 'vitesse-melange'])
    : (vitesse ? ['vitesse-isole', 'vitesse-melange', 'volume-melange'] : ['volume-melange', 'volume-isole', 'vitesse-melange']);
  const resteBloc = objectif - prevu;
  if (estValide(d, 'p1-3') && ciblesBloc.length && resteBloc >= 2) {
    for (const it of exercicesBloc(d, date, { genres, cibles: ciblesBloc, difficiles, minutes: resteBloc, exclure: exclus })) {
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
  const reserve = itemAnzan && !itemAnzan.fait ? itemAnzan.minutes : 0;
  for (const [i, it] of essentiel.entries()) {
    const reste = objectif - cumul - (it === itemAnzan ? 0 : reserve);
    if (it.fait || i === 0 || it === itemAnzan || it.minutes <= reste) { garde.push(it); cumul += it.fait ? 0 : it.minutes; continue; }
    if (it.decision && reste >= 3) {
      garde.push({ ...it, minutes: reste, detail: `${it.detailCourt ?? it.detail} (${reste} min aujourd'hui, la suite demain si besoin)` });
      cumul += reste;
      continue;
    }
    reportes.push(it);
  }
  const minutes = garde.reduce((t, it) => t + it.minutes, 0);
  const theme = themeDuJour(decision, examEssentiel ? exam : null, vitesse, gesteDuJour(d, ciblesBloc, difficiles));
  const mot = motDuProf(d, date, decision, { theme, difficiles, vitesse });
  // Pour compléter (une fois l'objectif atteint) : ce qui n'a pas tenu, puis une planche, un flash
  // anzan, un jeu (et, si le temps restant est long, d'autres idées).
  const restant = Math.max(0, objectif - minutesAujourdhui() - garde.filter((it) => !it.fait).reduce((t, it) => t + it.minutes, 0));
  const complements = [...reportes.filter((it) => !it.fait), ...propositions(d, date, difficiles, restant, ciblesBloc.slice(0, 1))];
  return { essentiel: garde, bonus: complements, mot, minutes, decision, theme };
}

/** Une leçon se révise-t-elle dans une série mélangée ? (pas les placements ni les lectures) */
const melangeable = (sp) => !['placement', 'lire', 'complement', 'theorie', 'photo', 'tenir'].includes(sp.type);

/** Le thème du jour, en une phrase : ce qu'on vient faire aujourd'hui. */
function themeDuJour(decision, exam, vitesse, g) {
  const geste = g ? nomMotif(g) : null;
  const bloc = vitesse ? `de la vitesse${geste ? ` sur ${geste}` : ''}, seul puis mélangé` : `du volume${geste ? ` sur ${geste}` : ''}, seul puis mélangé`;
  if (exam) return `Aujourd'hui : l'examen blanc, sur tout ce que vous savez, puis ${bloc}.`;
  if (decision.type === 'lecon') return `Aujourd'hui : ${decision.titre === 'Nouvelle leçon' ? 'une nouvelle leçon' : 'la suite de la leçon'}, « ${decision.detail} », puis ${bloc}.`;
  if (decision.type === 'automatiser') return `Aujourd'hui : automatiser « ${decision.sp.titre} » jusqu'à l'or : ${bloc}.`;
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
      const tempsFait = minutes >= objectif;
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
      const demarrer = () => commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()), decision: p.decision });
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
            h('div', { class: 'liste-paliers' }, p.essentiel.map((it, i) => ligne(it, i)))));
        return;
      }

      // --- le prof et le plan (chaque ligne s'ouvre d'un clic ; le premier clic commence la séance)
      // Une seule grande action : la prochaine étape non faite (la séance démarre au premier clic).
      const faits = p.essentiel.filter((it) => it.fait).length;
      const prochaine = p.essentiel.find((it) => !it.fait) ?? p.bonus.find((it) => !it.fait);
      // Où en est-on par rapport aux deux conditions de fin (tout l'essentiel, et l'objectif de temps) ?
      const resteMin = Math.max(0, Math.ceil(objectif - minutes));
      if (seance && essentielFait && !tempsFait) {
        el.append(h('div', { class: 'carte avis' }, h('strong', {}, 'L\'essentiel est fait. '), `Encore ${resteMin} min pour atteindre votre objectif du jour : choisissez dans « Pour compléter ».`));
      } else if (seance && tempsFait && !essentielFait) {
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
      el.append(h('div', { class: 'carte' }, entete,
        h('h3', { class: 'titre-plan' }, `L'essentiel · environ ${p.minutes} min`, h('span', { class: 'discret' }, ' : dans cet ordre, chaque point prépare le suivant')),
        h('div', { class: 'liste-paliers' }, p.essentiel.map((it, i) => ligne(it, i))),
        h('h3', { class: 'titre-plan' }, 'Pour compléter', h('span', { class: 'discret' }, resteMin > p.minutes ? ` : il vous reste du temps, piochez ici (une nouvelle planche remplace celle qui est faite)` : ' : si vous avez encore du temps')),
        h('div', { class: 'liste-paliers' }, p.bonus.map((it) => ligne(it, null))),
        h('p', { class: 'discret' }, `La séance se termine quand les ${p.essentiel.length} points de l'essentiel sont faits ET que votre objectif de ${objectif} min est atteint (${Math.floor(minutes)} min aujourd'hui). Le bilan s'affiche alors tout seul.`)));
    }
    afficher();
  },
};
