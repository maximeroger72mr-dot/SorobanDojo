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
} from '../core/progression.js';
import { telechargerExport } from '../ui/exporter.js';
import { serieJours } from '../core/regularite.js';
import { grade, drillEchauffement, gestesLents, verificationVitesse, anzanAdapte, placementDuJour, coursMultiplicationAtteint, prioriteDuJour, planObjectif, consolidationDuJour } from '../core/parcours.js';
import { GRADES } from '../core/epreuves.js';
import { diagnosticTablesFait, produitsARetravailler } from '../core/tables.js';
import { SUCCES } from '../core/succes.js';
import { nomMotif } from '../core/motifs.js';
import { ajouterJours } from '../core/revision.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { decisionDuJour, jeuDuJour, motDuProf, propositionsApresSeance } from '../core/prof.js';
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

  // 1. Échauffement (3 min). Pendant les étapes petits amis et grands amis : Complément éclair,
  //    pour que les paires qui font 5 ou 10 viennent sans réfléchir ; sinon le prochain drill à valider.
  const cibleComplement = sp?.palier?.id === 'p2' ? 5 : sp?.palier?.id === 'p3' || sp?.palier?.id === 'p4' ? 10 : null;
  const drill = cibleComplement ? null : drillEchauffement(d);
  if (cibleComplement) {
    essentiel.push({ titre: 'Échauffement', detail: `Complément éclair à ${cibleComplement} (60 s)`, minutes: 2,
      pourquoi: `Les ${cibleComplement === 5 ? 'petits' : 'grands'} amis reposent sur les paires qui font ${cibleComplement} : elles doivent venir sans réfléchir, sinon la main s'arrête.`,
      fait: fait((s) => s.module === 'jeux' && s.mode === `complement-${cibleComplement}`), aller: ['jeux', { jeu: 'complement', cible: cibleComplement }] });
  } else if (drill) {
    essentiel.push({ titre: 'Échauffement', detail: drill.titre, minutes: 3, pourquoi: 'Les doigts se réveillent sur une suite connue : on ne commence jamais à froid.',
      fait: fait((s) => s.module === 'drills' && !String(s.mode).startsWith('tables')), aller: ['drills', { drill: drill.id }] });
  }
  // 1 bis. Les colonnes ratées lors de la dernière séance, rejouées à l'identique.
  const aRejouer = erreursARejouer(date).length;
  if (aRejouer || fait((s) => s.module === 'erreurs')) {
    essentiel.push({ titre: 'À revoir', detail: aRejouer ? `${aRejouer} colonne${aRejouer > 1 ? 's' : ''} de la dernière séance, à refaire` : 'fait', minutes: 2,
      pourquoi: 'Refaire ce qui a posé problème, un jour plus tard, corrige le geste mieux qu\'un exercice neuf.',
      fait: fait((s) => s.module === 'erreurs'), aller: ['erreurs'] });
  }
  // 2. Révisions dues : la mémoire avant tout.
  const dues = revisionsDues().length;
  if (dues) {
    essentiel.push({ titre: 'Révisions', detail: `${dues} leçon${dues > 1 ? 's' : ''} à revoir (10 calculs chacune)`, minutes: 3 * dues,
      pourquoi: 'Revoir une leçon juste avant de l\'oublier la fixe pour longtemps.',
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
  //    Elle suit les progrès : recalculée à chaque affichage (le geste le plus lent change), sauf
  //    si celle fixée en début de séance a déjà été faite (elle reste alors, cochée).
  const prescritPar = (pr) => {
    const [module, p] = pr.aller;
    return (s) => s.module === module && (module === 'rythme'
      ? s.mode === p.jeu && (!p.cibles || (s.reglages?.cibles ?? []).includes(p.cibles[0]))
      : !!s.reglages?.priorite);
  };
  const fixee = seance?.priorite ?? null;
  const priorite = fixee && fait(prescritPar(fixee)) ? fixee : prioriteDuJour(d, date, motifsEnDifficulte());
  if (priorite) {
    const prescrit = prescritPar(priorite);
    essentiel.push({ titre: priorite.titre, detail: `${priorite.raison} ${priorite.texte}`, minutes: 8, fait: fait(prescrit), aller: priorite.aller, priorite: true,
      pourquoi: 'Votre point faible du moment, recalculé d\'après vos derniers résultats : c\'est là que le temps rapporte le plus.' });
  }
  // 4 bis. Vitesse incohérente (ex. gestes directs plus lents que les petits amis) : on vérifie.
  const verif = verificationVitesse(d);
  // (sauf si la priorité du jour travaille déjà ce même geste)
  if (verif && priorite?.aller?.[1]?.cibles?.[0] !== verif.cle) {
    essentiel.push({ titre: verif.titre, detail: verif.detail, minutes: 6, pourquoi: verif.pourquoi, aller: verif.aller,
      fait: fait((s) => (s.module === 'verification' && s.mode === (verif.aller[1].geste ?? `famille:${verif.aller[1].famille}`))
        || (s.module === 'rythme' && (s.reglages?.cibles ?? []).includes(verif.cle))) });
  }
  // 5. Avancer ou ancrer : la décision du prof. Elle s'adapte aux résultats du jour (leçon validée,
  //    mini-test raté…) ; seule une décision déjà mise en œuvre reste affichée, cochée.
  const decisionFaite = (dec) => fait((s) => (dec.aller[0] === 'lecons' ? s.module === 'lecons' && s.reglages?.sousPalier === dec.aller[1].sousPalier
    : s.module === 'rythme' && s.mode === 'marathon' && (!dec.cibles || (s.reglages?.cibles ?? []).includes(dec.cibles[0]))));
  const decision = seance?.decision && decisionFaite(seance.decision) ? seance.decision : decisionDuJour(d, date, sp);
  essentiel.push({ titre: decision.titre, detail: decision.detail, minutes: decision.minutes, aller: decision.aller, decision: true,
    pourquoi: decision.raison, fait: decisionFaite(decision) });
  // 6. Consolidation (2 à 7 jours après une leçon) : mélanger pour retenir.
  const conso = consolidationDuJour(d, date);
  if (conso) {
    essentiel.push({ titre: 'Consolidation', detail: `${conso.titre}, mélangé aux gestes précédents (10 colonnes)`, minutes: 5,
      pourquoi: 'Mélangé aux autres, le nouveau geste doit être CHOISI, comme dans un vrai calcul : c\'est ce qui le rend durable.',
      fait: fait((s) => s.mode === `consolidation:${conso.id}`), aller: ['planches', { consolidation: conso.id, auto: true }] });
  }
  // 7. Multiplication / division : tables et placement deviennent des réflexes quotidiens.
  //    En ouvrant l'étape : le diagnostic des 81 produits (les trous dans les tables, repérés AVANT
  //    qu'on les attribue au placement).
  if (coursMultiplicationAtteint(d, sp) && !diagnosticTablesFait(d.tables ?? {})) {
    essentiel.push({ titre: 'Diagnostic des tables', detail: 'les 81 produits, une fois chacun', minutes: 4,
      pourquoi: 'Un produit hésitant bloque toute la multiplication. Les produits faux ou plus lents que 2,5 s seront ensuite travaillés chaque jour, jusqu\'à ce qu\'ils passent.',
      fait: fait((s) => s.module === 'drills' && s.mode === 'tables-81'), aller: ['drills', { tables: '81' }] });
  } else if (coursMultiplicationAtteint(d, sp) && d.paliers['p7-e']?.valide && new Date(`${date}T12:00`).getDay() % 2 === 1) {
    // Un jour sur deux, une fois la division par 2 chiffres abordée : l'estimation du quotient.
    essentiel.push({ titre: 'Estimation du quotient (réflexe)', detail: '20 divisions, une touche par réponse', minutes: 3,
      pourquoi: 'Trouver d\'emblée le bon chiffre du quotient, c\'est ce qui fait la vitesse des divisions par 2 chiffres.',
      fait: fait((s) => s.module === 'drills' && s.mode === 'quotient'), aller: ['drills', { quotient: true }] });
  } else if (coursMultiplicationAtteint(d, sp)) {
    const aRetravailler = produitsARetravailler(d.tables ?? {}).length;
    essentiel.push({ titre: 'Tables (réflexe)', detail: aRetravailler ? `20 produits : vos ${aRetravailler} produits à retravailler` : '20 produits, vos plus lents en priorité', minutes: 3, pourquoi: 'En multiplication, chaque hésitation sur un produit se paie à chaque chiffre.',
      fait: fait((s) => s.module === 'drills' && String(s.mode).startsWith('tables')), aller: ['drills', { tables: 'lents', auto: true }] });
  }
  const placement = placementDuJour(d, date, sp);
  if (placement && placement.id !== sp?.id) {
    essentiel.push({ titre: 'Placement (réflexe)', detail: `${placement.titre} : 10 clics le plus vite possible`, minutes: 2, pourquoi: 'Poser le premier chiffre sur la bonne tige doit devenir immédiat.',
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
      // Fin de séance automatique : tout l'essentiel est fait → le bilan s'affiche de lui-même.
      if (seance && !bilan && p.essentiel.length && p.essentiel.every((it) => it.fait)) {
        finirSeance().then((b) => { nouvelleDemandee = false; afficher(b ?? null); });
        return;
      }

      // --- une ligne de statut compacte : série, minutes du jour (objectif réglable), grade
      el.append(h('h1', {}, 'Séance du jour'),
        h('div', { class: 'statut-jour' },
          h('span', {}, h('strong', {}, `${serie.jours} jour${serie.jours > 1 ? 's' : ''}`), ' de série ',
            h('span', { class: 'serie-perles' }, rangee(septJours(dates), 7, `${septJours(dates)} jours de pratique sur les 7 derniers`))),
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

      // --- séance terminée aujourd'hui : bilan, proposition d'activité, et une nouvelle séance
      //     seulement si on la demande (jamais relancée d'elle-même).
      const terminee = !seance && (bilan ?? (d.seanceTerminee?.date === aujourdhui() ? d.seanceTerminee.bilan : null));
      if (terminee && !nouvelleDemandee) {
        el.append(carteBilan(terminee, d));
        const idees = propositionsApresSeance(d, aujourdhui());
        const [principale, ...autres] = idees;
        el.append(h('div', { class: 'carte suggestion' },
          h('h2', { style: 'margin-top:0' }, 'Et maintenant ?'),
          h('p', {}, h('strong', {}, principale.titre), ' : ', principale.detail),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => app.aller(...principale.aller) }, `${principale.titre} →`),
            autres.map((x) => h('button', { class: 'btn', title: x.detail, onclick: () => app.aller(...x.aller) }, x.titre))),
          h('p', { class: 'discret' }, 'Ou arrêtez-vous là : la régularité compte plus que la durée. À demain !')),
          h('div', { class: 'ligne', style: 'margin-top:12px' },
            h('button', { class: 'btn', onclick: async () => { nouvelleDemandee = true; afficher(); } }, 'Faire une nouvelle séance')));
        return;
      }

      // --- le prof et le plan
      // Chaque ligne s'ouvre d'un clic ; si la séance n'est pas commencée, le clic la commence.
      const demarrer = () => commencerSeance({ priorite: prioriteDuJour(d, aujourdhui(), motifsEnDifficulte()), decision: p.decision });
      const ligne = (it, i) => h('button', {
        class: `ligne-palier${it.fait ? ' valide' : ''}${it.priorite ? ' priorite' : ''}`,
        onclick: async () => { if (!seanceEnCours()) await demarrer(); app.aller(...it.aller); },
      }, h('span', { class: `icone${it.fait ? ' etat-fait' : ' numero'}` }, it.fait ? '✓' : i !== null ? String(i + 1) : '+'),
      h('span', { class: 'titre' }, h('strong', {}, it.titre), ` · ${it.detail}`, it.pourquoi && !it.fait ? h('span', { class: 'pourquoi-point' }, it.pourquoi) : null),
      h('span', { class: 'statut' }, it.fait ? 'fait' : `${it.minutes} min`));
      // Une seule grande action : la prochaine étape non faite (la séance démarre au premier clic).
      const faits = p.essentiel.filter((it) => it.fait).length;
      const prochaine = p.essentiel.find((it) => !it.fait) ?? p.bonus.find((it) => !it.fait);
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
        seance ? h('button', { class: 'lien', onclick: async () => { const b = await finirSeance(); nouvelleDemandee = false; afficher(b); } }, 'Finir maintenant et voir le bilan') : null);
      el.append(h('div', { class: 'carte' }, entete,
        h('h3', { class: 'titre-plan' }, `L'essentiel · environ ${p.minutes} min`, h('span', { class: 'discret' }, ' : dans cet ordre, chaque point prépare le suivant')),
        h('div', { class: 'liste-paliers' }, p.essentiel.map((it, i) => ligne(it, i))),
        h('h3', { class: 'titre-plan' }, 'Bonus', h('span', { class: 'discret' }, ' : pour le plaisir, et ça entraîne aussi')),
        h('div', { class: 'liste-paliers' }, p.bonus.map((it) => ligne(it, null))),
        h('p', { class: 'discret' }, 'Chaque point se coche quand il est fait ; quand tout l\'essentiel est coché, le bilan de la séance s\'affiche tout seul.')));
    }
    let nouvelleDemandee = false;
    afficher();
  },
};
