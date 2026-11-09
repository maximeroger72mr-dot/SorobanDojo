/**
 * Leçons guidées.
 *
 * Carte du parcours (paliers > sous-paliers), puis pour chaque sous-palier trois onglets :
 *  1. Comprendre   : le pourquoi du geste et des démonstrations animées pas à pas ;
 *  2. S'entraîner  : exercices générés à l'infini, À FAIRE SUR SON SOROBAN ; l'élève tape le
 *                    résultat. Une par une (correction immédiate) ou en feuille (imprimable).
 *                    Compteur d'ancrage avant le mini-test ;
 *  3. Mini-test    : 10 exercices, 9 réussites exigées pour valider.
 * Un sous-palier validé entre dans les révisions espacées (voir revisions.js).
 */

import { PALIERS, SOUS_PALIERS, sousPalier, TEST, genererExercice, familleLecon, imageAnzan, chaineAnzan, dureePhoto } from '../core/curriculum.js';
import { ouvrirExplication } from '../ui/explication.js';
import { notifier } from '../ui/toast.js';
import { nomMotif } from '../core/motifs.js';
import {
  etatPalier, compterRepetition, validerPalier, poidsAdaptatifs, enregistrerSession,
  reglagesUtilisateur, modifierReglages, evaluerPalier, noterGestes, verifierCoupeFile, memoriserChaine, memoriserDureePhoto,
  noterReconnu, progression, noterReponse, statsTables,
} from '../core/progression.js';
import { diagnosticTablesFait, produitsARetravailler } from '../core/tables.js';
import { aReconnaitre, questionsReconnaitre, NOMS_REGLES, QUESTIONS_RECONNAITRE, MIN_RECONNAITRE } from '../core/reconnaitre.js';
import { motifsAppris } from '../core/parcours.js';
import { gesteMotif } from '../core/motifs.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { creerQuestions } from '../ui/questions.js';
import { avecTermes } from '../ui/termes.js';
import { questionDoigte } from '../ui/doigte.js';
import { tempsParUnite, SURCOUT_FEUILLE_S } from '../core/maitrise.js';
import { localiserErreur } from '../core/diagnostic.js';
import { verdictMiniTest, testMin, exigeVitesse } from '../core/minitest.js';
import { badgeNiveau, texteEvaluation } from '../ui/niveau.js';
import { PanneauDemo } from '../ui/panneauDemo.js';
import { demoMultiplication, demoDivision } from '../ui/explication.js';
import { creerSerie, encadreDiagnostic, listeErreurs } from '../ui/serie.js';
import { rendreEnonce } from '../ui/enonce.js';
import { creerFeuille } from '../ui/feuille.js';
import { creerPlacement } from '../ui/placement.js';
import { conseilsVitesse, GENERAUX, ANZAN } from '../core/conseils.js';
import { h, formaterDuree, formaterPourcent, remplir, raccourcis } from '../ui/dom.js';

/** Leçon précédente sur la même piste (soroban ou anzan). */
export const precedente = (sp) => SOUS_PALIERS.slice(0, sp.ordre).reverse().find((x) => x.mental === sp.mental) ?? null;
/** Leçon suivante sur la même piste. */
export const suivante = (sp) => SOUS_PALIERS.slice(sp.ordre + 1).find((x) => x.mental === sp.mental) ?? null;

/**
 * Un sous-palier est accessible si le précédent de sa piste est validé (ou en mode découverte).
 * Piste anzan : il faut AUSSI que la leçon soroban qu'elle suit (`apres`) soit validée.
 */
export function estDebloque(sp) {
  if (reglagesUtilisateur().decouverte) return true;
  if (sp.mental && sp.apres && !etatPalier(sp.apres).valide) return false;
  const p = precedente(sp);
  return !p || !!etatPalier(p.id).valide;
}

/** Premier sous-palier du parcours soroban non validé et accessible (pour les suggestions). */
export function prochainSousPalier() {
  return SOUS_PALIERS.find((sp) => !sp.mental && !etatPalier(sp.id).valide && estDebloque(sp)) ?? null;
}

/** Prochaine leçon de la piste anzan, si elle est ouverte. */
export function prochainAnzan() {
  return SOUS_PALIERS.find((sp) => sp.mental && !etatPalier(sp.id).valide && estDebloque(sp)) ?? null;
}

const dateFr = (d) => new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Démonstration d'un exemple de sous-palier, quel que soit son type. */
function demoDe(sp, d) {
  if (sp.type === 'mul' || sp.type === 'table') return demoMultiplication(d.a, d.b);
  if (sp.type === 'div') return demoDivision(d.a, d.b);
  return d;
}
const famille = familleLecon;
/** Composant d'exercices adapté au type de leçon. */
const creerExercices = (sp, zone, o) => (sp.type === 'placement' ? creerPlacement : sp.type === 'lire' || sp.type === 'complement' ? creerQuestions : creerSerie)(zone, o);
/** Nombre de calculs du mini-test d'une leçon. */
const nombreTest = (sp) => sp.testNombre ?? TEST.exercices;

/** Encadré « Pour aller plus vite ». */
function encadreVitesse(sp) {
  const conseils = conseilsVitesse(sp);
  if (!conseils.length) return null;
  return h('div', { class: 'carte vitesse' }, h('strong', {}, sp.mental ? 'Pour bien visualiser' : 'Pour aller plus vite'), h('ul', {}, conseils.map((c) => h('li', {}, c))));
}
const poidsDe = (sp) => poidsAdaptatifs(sp.type === 'addsub' || sp.type === 'anzan' ? sp.cibles : []);

const libelleDemo = (sp, d) => (sp.type === 'mul' || sp.type === 'table' ? `${d.a} × ${d.b}` : sp.type === 'div' ? `${d.a} ÷ ${d.b}` : `${d.depart} ${d.op === '+' ? '+' : '−'} ${d.n}`);

export default {
  id: 'lecons',
  titre: 'Leçons guidées',
  monter(el, app, params = {}) {
    let nettoyerVue = null;
    let piste = null;
    const changer = (f) => { nettoyerVue?.(); remplir(el); el.closest('main').scrollTop = 0; nettoyerVue = f() ?? null; };

    // ---------------------------------------------------------------- carte du parcours
    function carte() {
      // Piste anzan seule (carte « Anzan et visualisation » d'Apprendre), ou tout le parcours.
      if (piste === 'anzan') {
        const prochain = SOUS_PALIERS.find((sp) => sp.mental && !etatPalier(sp.id).valide);
        el.append(h('h1', {}, 'Anzan et visualisation'),
          h('p', {}, prochain && !estDebloque(prochain) && prochain.apres
            ? `Prochaine leçon d'anzan : « ${prochain.titre} », qui s'ouvrira quand « ${sousPalier(prochain.apres).titre} » sera validée sur le vrai soroban. En attendant, revoyez les leçons faites ou entraînez-vous librement en flash anzan.`
            : 'La piste du calcul de tête, à son rythme, en parallèle du soroban.'),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn', onclick: () => app.aller('anzan') }, 'Flash anzan libre'),
            h('button', { class: 'lien', onclick: () => { piste = null; changer(carte); } }, 'Voir tout le parcours →')));
      } else el.append(
        h('h1', {}, 'Leçons guidées'),
        h('p', { class: 'discret' }, `Les calculs se font sur votre soroban ; l'application corrige et explique. Chaque étape : comprendre, s'entraîner (le compteur indique le volume d'ancrage), puis un mini-test de ${TEST.exercices} calculs (${TEST.reussitesMin} réussites exigées, à une vitesse au moins « acquis débutant »).`),
        h('p', { class: 'discret' }, 'Niveaux : En progrès → Acquis débutant → Acquis confirmé → Acquis expert. Un geste est acquis quand il est juste ET rapide ; le niveau se calcule sur vos 30 derniers exercices.'),
      );
      const diag = encadreDiagnostic(null, 3);
      if (diag) el.append(diag);
      for (const palier of PALIERS.filter((p) => piste !== 'anzan' || p.mental)) {
        el.append(h('h2', {}, palier.titre));
        if (palier.mental) el.append(h('p', { class: 'discret' }, 'Calcul de tête, à son rythme, en parallèle du soroban : chaque leçon s\'ouvre quand le geste est validé sur le vrai soroban, et ne bloque jamais le parcours. 5 minutes par jour suffisent.'));
        el.append(h('div', { class: 'liste-paliers' }, palier.sousPaliers.map((brut) => {
          const sp = sousPalier(brut.id);
          const e = etatPalier(sp.id);
          const ouvert = estDebloque(sp);
          let statut;
          let icone;
          if (e.valide && sp.type === 'theorie') { icone = '✓'; statut = sp.quiz ? 'Compris' : 'Lu'; }
          else if (e.valide) { icone = '✓'; statut = e.carte ? `Validé · révision le ${dateFr(e.carte.echeance)} (boîte ${e.carte.boite})` : 'Validé'; }
          else if (sp.type === 'theorie' && ouvert) { icone = '○'; statut = 'À lire'; }
          else if (!ouvert) { icone = '·'; statut = sp.mental && sp.apres && !etatPalier(sp.apres).valide ? `après « ${sousPalier(sp.apres).titre} »` : 'Verrouillé'; }
          else if (e.reps >= sp.repetitions || e.coupeFile) { icone = '●'; statut = e.coupeFile && e.reps < sp.repetitions ? 'Coupe-file : mini-test disponible' : 'Mini-test disponible'; }
          else { icone = '○'; statut = `${e.reps} / ${sp.repetitions}`; }
          return h('button', {
            class: `ligne-palier${e.valide ? ' valide' : ''}`, disabled: !ouvert,
            onclick: () => changer(() => vueSousPalier(sp)),
          }, h('span', { class: `icone etat-${e.valide ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, icone), h('span', { class: 'titre' }, sp.titre),
          e.reps ? badgeNiveau(evaluerPalier(sp.id, famille(sp))) : null,
          h('span', { class: 'statut' }, statut));
        })));
      }
      el.append(h('p', { class: 'discret', style: 'margin-top:24px' }, reglagesUtilisateur().decouverte ? 'Mode découverte activé : toutes les leçons sont ouvertes. ' : 'Déjà pratiqué ? ',
        h('button', { class: 'lien', onclick: () => app.aller('positionnement') }, 'Tester mon niveau'), ' · ',
        h('button', { class: 'lien', onclick: () => app.aller('reglages') }, 'Mode découverte (Réglages)')));
    }

    // ---------------------------------------------------------------- sous-palier
    /** Leçon à lire (Leçon 0) : sections, conseils généraux de vitesse, puis le quiz de vérification. */
    function vueTheorie(sp) {
      const suivant = suivante(sp);
      el.append(...[
        h('button', { class: 'lien', onclick: () => changer(carte) }, '← Toutes les leçons'),
        h('h1', {}, sp.titre),
        h('p', { class: 'discret' }, sp.pourquoi),
        ...sp.sections.map(([titre, texte]) => h('div', { class: 'carte theorie' }, h('h3', { style: 'margin-top:0' }, titre), h('p', {}, ...avecTermes(texte)))),
        sp.pourquoiCaMarche ? h('details', { class: 'carte' }, h('summary', {}, 'Pourquoi ça marche (facultatif)'),
          sp.pourquoiCaMarche.map(([titre, texte]) => h('div', {}, h('h4', { style: 'margin:12px 0 4px' }, titre), h('p', { style: 'margin:0' }, texte)))) : null,
        sp.mental
          ? h('div', { class: 'carte vitesse' }, h('strong', {}, 'Pour bien visualiser, en résumé'), h('ul', {}, ANZAN.map((c) => h('li', {}, c))))
          : h('div', { class: 'carte vitesse' }, h('strong', {}, 'Pour aller plus vite, partout'), h('ul', {}, GENERAUX.map((c) => h('li', {}, c)))),
        sp.quiz && !etatPalier(sp.id).valide ? quiz(sp, () => valider()) : null,
        sp.quiz && !etatPalier(sp.id).valide ? null : h('div', { class: 'ligne', style: 'margin-top:14px' },
          h('button', { class: 'btn principal', onclick: () => valider() }, etatPalier(sp.id).valide ? 'Continuer →' : 'J\'ai lu et compris →'))].filter(Boolean));
      async function valider() {
        await validerPalier(sp.id, false);
        changer(() => (suivant && estDebloque(suivant) ? vueSousPalier(suivant) : carte()));
      }
      return null;
    }

    /**
     * Vérification de lecture : quelques questions à choix. Les réponses sont mélangées ; une
     * mauvaise réponse montre le passage à relire, et on peut corriger. Tout juste : leçon validée.
     */
    function quiz(sp, surReussite) {
      const melange = (xs) => xs.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
      const questions = sp.quiz.map((q, i) => ({ ...q, i, ordre: melange(q.choix.map((c, k) => k)) }));
      const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const blocs = questions.map((q) => {
        const explication = h('div', { class: 'quiz-explication' });
        const bloc = h('fieldset', { class: 'quiz-question' }, h('legend', {}, `${q.i + 1}. ${q.q}`),
          q.ordre.map((k) => h('label', { class: 'quiz-choix' }, h('input', { type: 'radio', name: `quiz-${sp.id}-${q.i}`, value: k }), ` ${q.choix[k]}`)),
          explication);
        return { q, bloc, explication };
      });
      const verifier = () => {
        let justes = 0;
        for (const { q, bloc, explication } of blocs) {
          const choisi = bloc.querySelector('input:checked');
          const ok = choisi && Number(choisi.value) === q.bonne;
          if (ok) justes += 1;
          bloc.classList.toggle('ok', !!ok);
          bloc.classList.toggle('ko', !!choisi && !ok);
          remplir(explication, choisi && !ok ? h('span', {}, 'Pas tout à fait. ', q.pourquoi) : ok ? h('span', { class: 'discret' }, q.pourquoi) : null);
        }
        if (justes === blocs.length) {
          retour.className = 'retour ok';
          remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ' Tout est juste : leçon validée. ', h('button', { class: 'btn principal', onclick: () => surReussite() }, 'Continuer →'));
        } else {
          retour.className = 'retour';
          remplir(retour, `${justes} / ${blocs.length} : relisez le passage indiqué, corrigez, puis vérifiez à nouveau. Aucune limite d'essais.`);
        }
      };
      return h('div', { class: 'carte quiz' }, h('h2', { style: 'margin-top:0' }, 'Avez-vous bien tout compris ?'),
        h('p', { class: 'discret' }, `${blocs.length} questions sur ce que vous venez de lire.`),
        blocs.map((b) => b.bloc),
        h('div', { class: 'ligne', style: 'margin-top:10px' }, h('button', { class: 'btn principal', onclick: verifier }, 'Vérifier mes réponses')),
        retour);
    }

    function vueSousPalier(sp, ongletInitial) {
      if (sp.type === 'theorie') return vueTheorie(sp);
      const e = etatPalier(sp.id);
      let nettoyerOnglet = null;
      const zone = h('div', {});
      // Leçons d'amis : une étape « Reconnaître » (choisir le geste) avant l'entraînement.
      const avecReconnaitre = aReconnaitre(sp);
      const ongletsDef = avecReconnaitre
        ? [['comprendre', '1. Comprendre'], ['reconnaitre', '2. Reconnaître'], ['entrainement', '3. S\'entraîner'], ['test', '4. Mini-test']]
        : [['comprendre', '1. Comprendre'], ['entrainement', '2. S\'entraîner'], ['test', '3. Mini-test']];
      // Faite une seule fois, au premier passage : inutile pour une leçon déjà validée.
      const resteReconnaitre = () => avecReconnaitre && !etatPalier(sp.id).reconnu && !etatPalier(sp.id).valide;
      const versEntrainement = () => afficher(resteReconnaitre() ? 'reconnaitre' : 'entrainement');
      const boutons = ongletsDef.map(([id, texte]) => h('button', { onclick: () => afficher(id) }, texte));
      const suivant = suivante(sp);

      el.append(
        h('button', { class: 'lien', onclick: () => changer(carte) }, '← Toutes les leçons'),
        h('div', { class: 'discret' }, sp.palier.titre),
        h('h1', {}, sp.titre),
        h('div', { class: 'segments', style: 'margin:8px 0 16px' }, boutons),
        zone);

      function afficher(id) {
        nettoyerOnglet?.();
        nettoyerOnglet = null;
        remplir(zone);
        boutons.forEach((b, i) => b.classList.toggle('actif', ongletsDef[i][0] === id));
        nettoyerOnglet = { comprendre, reconnaitre, entrainement, test: miniTest }[id]();
      }

      // 1. Comprendre ------------------------------------------------
      function comprendre() {
        zone.append(h('div', { class: 'carte pourquoi' }, h('strong', {}, 'Pourquoi ce geste ? '), ...avecTermes(sp.pourquoi)));
        if (sp.type === 'addsub') {
          zone.append(h('p', { class: 'discret' }, sp.cumul && sp.cibles.length > 12 ? 'Tous les gestes vus jusqu\'ici.' : `Gestes travaillés : ${sp.cibles.map(nomMotif).join(' · ')}. ${sp.cumul ? '' : 'Les exercices ne contiennent que ces gestes et des gestes directs.'}`));
        }
        if (sp.type === 'lire') {
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Comment lire un soroban'), h('ul', {}, sp.regles.map((r) => h('li', {}, r)))),
            h('div', { class: 'carte' }, h('strong', {}, 'Ce que vous allez faire : '),
              h('ul', {},
                h('li', {}, '20 lectures : un soroban s\'affiche, tapez le nombre.'),
                h('li', {}, '10 poses : un nombre s\'affiche, posez-le sur VOTRE soroban et appuyez sur Entrée. Le nombre disparaît : donnez le chiffre de la tige demandée, en lisant votre soroban.'),
                h('li', {}, `Mini-test : ${nombreTest(sp)} lectures et poses mélangées, ${testMin(sp)} justes au moins.`))),
            h('p', { class: 'discret' }, 'Pour aller plus loin (jusqu\'à 9 chiffres), l\'outil « Lecture des nombres » reste ouvert dans Apprendre.'),
            h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (sp.type === 'complement') {
          const paires = sp.cible === 5 ? ['1 et 4', '2 et 3'] : ['1 et 9', '2 et 8', '3 et 7', '4 et 6', '5 et 5'];
          zone.append(h('div', { class: 'carte' }, h('strong', {}, `Les paires qui font ${sp.cible} : `), paires.join(' · ')),
            h('div', { class: 'carte' }, h('strong', {}, 'Ce que vous allez faire : '),
              h('ul', {},
                h('li', {}, `Un nombre s'affiche : tapez ce qui lui manque pour faire ${sp.cible}, puis Entrée.`),
                h('li', {}, `${sp.repetitions} questions d'entraînement, puis le mini-test : ${sp.testNombre} réponses en ${sp.testSecondes} secondes, une erreur au plus.`),
                h('li', {}, 'Ne comptez pas sur vos doigts : la réponse doit venir d\'un coup, comme une table.'))),
            h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (sp.id === 'p6-a') {
          // Ouverture de la multiplication : repérer les trous dans les tables avant tout.
          const fait = diagnosticTablesFait(statsTables());
          const n = produitsARetravailler(statsTables()).length;
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Diagnostic des tables. '),
            fait ? `Fait : ${n ? `${n} produit${n > 1 ? 's' : ''} à retravailler (faux ou plus lents que 2,5 s), proposés chaque jour jusqu'à ce qu'ils passent.` : 'tous vos produits sont sûrs et rapides.'}`
              : 'Avant de multiplier sur le soroban, les 81 produits une fois chacun : ceux qui sont faux ou plus lents que 2,5 s seront travaillés chaque jour. Un produit hésitant bloque toute la chaîne.',
            h('div', { class: 'ligne', style: 'margin-top:8px' }, h('button', { class: fait ? 'btn' : 'btn principal', onclick: () => app.aller('drills', { tables: '81' }) }, fait ? 'Refaire les 81 produits' : 'Faire le diagnostic (81 produits)'))));
        }
        const vitesse = encadreVitesse(sp);
        if (vitesse) zone.append(vitesse);
        if (sp.type === 'placement') {
          zone.append(h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (sp.type === 'anzan') {
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Comment faire : '),
            h('ul', {},
              h('li', {}, `Les nombres s'affichent un par un (${sp.duree.toLocaleString('fr-FR')} s chacun), à ${sp.chiffres} chiffre${sp.chiffres > 1 ? 's' : ''}. Le signe − annonce une soustraction.`),
              h('li', {}, `La chaîne commence à ${Math.min(sp.lignesDepart ?? 2, sp.lignes)} nombres : 3 réussites de suite en ajoutent un (jusqu'à ${sp.lignes}), une erreur en retire un. Le mini-test se fait à ${sp.lignes} nombres.`),
              sp.image ? h('li', {}, 'Un petit soroban montre le TOTAL qui évolue : suivez-le des yeux, puis dans la tête. Il s\'estompe à mesure que vous réussissez (nette, estompée, légère, puis plus d\'image). Le mini-test se fait sans image.') : null,
              h('li', {}, 'Posez la main comme sur le soroban et faites les gestes dans l\'air : le pouce monte, l\'index descend.'),
              h('li', {}, 'Gardez l\'image du total, pas le nombre lu : à la fin, on LIT le soroban imaginaire.'),
              h('li', {}, 'Ensuite, entraînez-vous dans « Flash anzan » en réduisant le temps d\'affichage.'))),
          h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (sp.type === 'negatif') {
          const ex = genererExercice(sp);
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Exemple : '), rendreEnonce(ex, { compact: true, sousTotaux: true }), h('p', {}, ex.astuce)),
            h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (sp.type === 'photo' || sp.type === 'tenir') {
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Comment faire : '),
            h('ul', {}, sp.type === 'photo'
              ? [h('li', {}, `Un soroban s'affiche ${sp.duree.toLocaleString('fr-FR')} s, puis disparaît : tapez le nombre qu'il montrait.`),
                h('li', {}, 'Lisez chaque tige d\'un coup d\'œil : la céleste (5 ou rien), puis le groupe de terrestres, sans les compter une à une.'),
                h('li', {}, 'Le chrono part quand l\'image disparaît : c\'est votre mémoire de l\'image qui est mesurée.')]
              : [h('li', {}, `Le nombre s'affiche ${sp.duree.toLocaleString('fr-FR')} s. Fermez les yeux et posez-le sur votre soroban imaginaire, doigts dans l'air.`),
                h('li', {}, `Gardez l'image nette ${sp.tenir} s, puis le vrai soroban s'affiche : répondez O si votre image était la même, N sinon. Soyez honnête : c'est vous que vous entraînez.`)])),
          h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
          return null;
        }
        if (!sp.demos.length) {
          // Pas d'exemple prédéfini (décimaux) : un exemple tiré au hasard, expliqué pas à pas.
          zone.append(h('div', { class: 'ligne' },
            h('button', { class: 'btn', onclick: () => ouvrirExplication(genererExercice(sp)) }, 'Voir un exemple expliqué'),
            h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →')));
          return null;
        }
        zone.append(h('h2', {}, 'Démonstrations'),
          h('p', { class: 'discret' }, 'Regardez le geste, puis refaites-le sur votre soroban avant de passer à la suite.'));
        const choix = h('div', { class: 'ligne' });
        zone.append(choix);
        const panneau = new PanneauDemo(zone);
        sp.demos.forEach((d, i) => choix.append(h('button', { class: 'btn', onclick: () => panneau.jouer(demoDe(sp, d), 'manuel') }, `Exemple ${i + 1} : ${libelleDemo(sp, d)}`)));
        choix.append(h('span', { style: 'flex:1' }), h('button', { class: 'btn principal', onclick: () => versEntrainement() }, 'Passer à l\'entraînement →'));
        panneau.jouer(demoDe(sp, sp.demos[0]), 'manuel');
        return () => panneau.detruire();
      }

      // Reconnaître ------------------------------------------------
      /**
       * 10 questions : une tige, une opération, quel geste ? Sans soroban ni chrono ; explication
       * immédiate. Validée à 9 sur 10 ; ensuite l'entraînement (et le mini-test) s'ouvrent.
       */
      function reconnaitre() {
        const { choix, questions } = questionsReconnaitre(sp, motifsAppris(progression()));
        let k = 0;
        let justes = 0;
        let attente = false;
        const s = new Soroban(3);
        const zoneTige = h('div', { class: 'flash-image', style: 'max-width:180px' });
        const vue = new SorobanVue(zoneTige, s, { interactif: false });
        const operation = h('div', { class: 'operation', style: 'font-size:2.4rem' });
        const compteur = h('span', { class: 'compteur' });
        const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
        const boutons = choix.map((r, i) => h('button', { class: 'btn', onclick: () => repondre(r) }, NOMS_REGLES[r], ' ', h('kbd', {}, String(i + 1))));
        const jeu = h('div', {}, h('div', { class: 'ligne' }, h('span', { style: 'flex:1' }), compteur),
          h('div', { class: 'bon-geste' }, zoneTige, operation), h('div', { class: 'ligne' }, boutons), retour);
        zone.append(h('div', { class: 'carte pourquoi' }, h('strong', {}, 'Avant le geste, la décision. '),
          `Le soroban montre la valeur de départ ; quel geste faut-il pour l'opération sur la tige des unités ? Pas de chrono, pas besoin de votre soroban. ${MIN_RECONNAITRE} bonnes réponses sur ${QUESTIONS_RECONNAITRE} ouvrent l'entraînement.`),
          etatPalier(sp.id).reconnu ? h('p', { class: 'discret' }, 'Étape déjà réussie : vous pouvez la refaire pour vous entraîner.') : null,
          jeu);
        const montrer = () => {
          const q = questions[k];
          s.definirValeur(q.v);
          operation.textContent = `${q.op === '+' ? '+' : '−'} ${q.n}`;
          compteur.textContent = `${k + 1} / ${questions.length}`;
          remplir(retour);
          retour.className = 'retour';
        };
        const suite = () => { attente = false; k += 1; if (k < questions.length) montrer(); else fin(); };
        async function repondre(r) {
          if (attente || k >= questions.length) return;
          const q = questions[k];
          const juste = r === q.regle;
          if (juste) justes += 1;
          await noterReponse(juste);
          attente = true;
          if (juste) {
            retour.className = 'retour ok';
            remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` ${NOMS_REGLES[q.regle]}.`);
            setTimeout(suite, 500);
            return;
          }
          retour.className = 'retour erreur';
          remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` ${q.v} ${q.op === '+' ? '+' : '−'} ${q.n} : ${nomMotif(q.cle)}.`),
            h('div', { class: 'detail' }, gesteMotif(q.cle)),
            h('button', { class: 'btn', onclick: () => suite() }, 'Continuer ', h('kbd', {}, 'Entrée')));
        }
        async function fin() {
          const reussi = justes >= MIN_RECONNAITRE;
          if (reussi) await noterReconnu(sp.id);
          await enregistrerSession({ module: 'lecons', mode: 'reconnaitre', reglages: { sousPalier: sp.id }, total: questions.length, justes, dureeMs: 0 });
          remplir(jeu, h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${justes} / ${questions.length}`),
            h('p', { class: reussi ? 'retour ok' : '' }, reussi ? 'Vous reconnaissez le geste : place à l\'exécution, sur votre soroban.' : `Il en faut ${MIN_RECONNAITRE}. Relisez les explications, puis recommencez : 10 nouvelles questions.`),
            h('div', { class: 'ligne' },
              reussi ? h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Passer à l\'entraînement →')
                : h('button', { class: 'btn principal', onclick: () => afficher('reconnaitre') }, 'Recommencer'),
              h('button', { class: 'btn', onclick: () => afficher('comprendre') }, 'Revoir « Comprendre »'))));
        }
        const sans = raccourcis({
          ...Object.fromEntries(choix.map((r, i) => [String(i + 1), () => repondre(r)])),
          Enter: () => { if (attente && retour.classList.contains('erreur')) suite(); },
        });
        montrer();
        return () => { sans(); vue.detruire(); };
      }

      // 2. Entraînement ----------------------------------------------
      function entrainement() {
        const bandeau = h('div', { class: 'bandeau' });
        let mode = 'une';
        let courant = null;
        const zoneTravail = h('div', {});
        const choixMode = h('div', { class: 'segments' },
          [['une', 'Une par une'], ['feuille', 'Feuille de 10 (imprimable)']].map(([v, t]) => h('button', {
            class: v === mode ? 'actif' : '',
            onclick: (ev) => { mode = v; [...choixMode.children].forEach((b) => b.classList.toggle('actif', b === ev.currentTarget)); lancer(); },
          }, t)));
        const conseil = h('p', { class: 'conseil-vitesse' });
        const tous = sp.mental ? conseilsVitesse(sp) : [...conseilsVitesse(sp), ...GENERAUX];
        const majConseil = () => { conseil.textContent = `${sp.mental ? 'Pour bien visualiser' : 'Pour aller plus vite'} : ${tous[Math.floor(Math.random() * tous.length)]}`; };
        majConseil();
        zone.append(bandeau, ['anzan', 'photo', 'tenir', 'placement', 'table', 'lire', 'complement'].includes(sp.type) ? '' : h('div', { class: 'ligne', style: 'margin-bottom:12px' }, choixMode), zoneTravail, ['lire', 'complement'].includes(sp.type) ? '' : conseil);

        const chaine = chaineAnzan(sp, etatPalier(sp.id).chaine);
        // Anzan : chaîne du moment, et image d'aide selon les réussites dans la leçon.
        // Photo du soroban : durée d'affichage qui raccourcit avec les réussites.
        const photo = sp.type === 'photo' ? dureePhoto(sp, etatPalier(sp.id).dureePhoto) : null;
        const ctxAnzan = () => (sp.type === 'anzan' ? { lignes: chaine.lignes, image: imageAnzan(sp, etatPalier(sp.id).justes).opacite }
          : photo ? { duree: photo.secondes } : sp.type === 'lire' ? { rang: etatPalier(sp.id).reps } : {});
        const majBandeau = () => {
          const et = etatPalier(sp.id);
          remplir(bandeau, ...[
            h('div', { class: 'jauge' }, h('div', { style: `width:${Math.min(100, (100 * et.reps) / sp.repetitions)}%` })),
            h('span', {}, `Entraînement : ${Math.min(et.reps, sp.repetitions)} / ${sp.repetitions}`),
            badgeNiveau(evaluerPalier(sp.id, famille(sp))),
            h('span', { class: 'discret' }, texteEvaluation(evaluerPalier(sp.id, famille(sp)), famille(sp))),
            sp.type === 'anzan' ? h('span', { class: 'discret' }, `· chaîne de ${chaine.lignes} nombres · ${imageAnzan(sp, et.justes).nom}`) : null,
            photo ? h('span', { class: 'discret' }, `· image visible ${photo.secondes.toLocaleString('fr-FR')} s (elle raccourcit quand vous enchaînez les bonnes réponses)`) : null,
            (et.reps >= sp.repetitions || et.coupeFile) && !et.valide ? h('button', { class: 'btn principal', onclick: () => afficher('test') }, et.coupeFile && et.reps < sp.repetitions ? 'Coupe-file : passer le mini-test →' : 'Passer le mini-test →') : null,
          ].filter(Boolean));
        };
        majBandeau();
        let lot = { total: 0, justes: 0, dureeMs: 0 };
        const enregistrerLot = () => {
          if (!lot.total) return;
          enregistrerSession({ module: 'lecons', mode: 'entrainement', reglages: { sousPalier: sp.id }, ...lot });
          lot = { total: 0, justes: 0, dureeMs: 0 };
        };
        const compter = async (juste, dureeMs, t) => {
          await compterRepetition(sp.id, juste, t);
          // Pas de coupe-file pour une leçon auto-évaluée (« Tenir une image ») : aucun temps mesuré.
          if (!['tenir', 'lire', 'complement'].includes(sp.type) && await verifierCoupeFile(sp.id, sp.repetitions, famille(sp))) {
            notifier('Coupe-file : mini-test débloqué', '15 premiers exercices justes et rapides : vous pouvez passer le mini-test dès maintenant.');
          }
          lot.total += 1;
          if (juste) lot.justes += 1;
          lot.dureeMs += dureeMs;
          if (lot.total >= 10) enregistrerLot();
          majBandeau();
        };

        function lancer() {
          courant?.detruire();
          remplir(zoneTravail);
          if (mode === 'une') {
            let n = 0;
            courant = creerExercices(sp, zoneTravail, {
              generer: () => genererExercice(sp, poidsDe(sp), ctxAnzan()),
              filtreDiagnostic: sp.autorises,
              evaluation: () => evaluerPalier(sp.id, famille(sp)),
              doigteMasque: () => evaluerPalier(sp.id, famille(sp)).index >= 2,
              // Aide « Je suis bloqué » ou réponse auto-évaluée (mode Espace) : compte pour le
              // volume d'entraînement, pas pour le niveau.
              surExercice: (res) => {
                n += 1;
                if (sp.type === 'anzan') { chaine.noter(res.juste); memoriserChaine(sp.id, chaine.lignes); }
                if (photo) { photo.noter(res.juste); memoriserDureePhoto(sp.id, photo.secondes); }
                if (n % 5 === 0) majConseil();
                return compter(res.juste && !res.aide, res.dureeMs, res.aide || res.autoEvalue ? undefined : res.t);
              },
            });
          } else {
            const problemes = Array.from({ length: 10 }, () => genererExercice(sp, poidsDe(sp)));
            courant = creerFeuille(zoneTravail, {
              titre: `${sp.titre} · feuille d'entraînement`,
              historique: { cle: `lecon-${sp.id}`, libelle: sp.titre },
              sections: [{ problemes }],
              surFin: (b) => {
                (async () => {
                  // Sur une feuille, le temps se répartit entre les problèmes.
                  const dureeMoyenne = b.dureeMs / b.total;
                  for (const r of b.resultats) {
                    const t = tempsParUnite(r.ex, dureeMoyenne, SURCOUT_FEUILLE_S);
                    await compter(r.juste, dureeMoyenne, t);
                    const loc = r.juste || r.reponse === null ? null : localiserErreur(r.ex, r.reponse);
                    // Vitesse des gestes : seulement si la leçon ne vise qu'un geste (moyenne de feuille).
                    if (r.ex.motifs) await noterGestes(r.juste ? r.ex.motifs : [], loc?.motifs ?? [], sp.cibles?.length === 1 ? t : null);
                  }
                  majBandeau();
                })();
                return h('div', { class: 'carte bilan' },
                  h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
                  h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
                  h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle feuille'));
              },
            });
          }
        }
        lancer();
        return () => { courant?.detruire(); enregistrerLot(); };
      }

      // 3. Mini-test --------------------------------------------------
      function miniTest() {
        const et = etatPalier(sp.id);
        if (et.reps < sp.repetitions && !et.coupeFile) {
          zone.append(h('div', { class: 'carte' },
            h('p', {}, `Le mini-test s'ouvre après ${sp.repetitions} exercices d'entraînement. Il en reste ${sp.repetitions - et.reps}.`),
            h('p', { class: 'discret' }, 'C\'est la répétition du geste sur le soroban qui le rend automatique, pas la compréhension seule. Coupe-file : si vos 15 premiers exercices sont tous justes et rapides (seuil « Acquis confirmé »), le mini-test s\'ouvre tout de suite.'),
            h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Continuer l\'entraînement')));
          return null;
        }
        if (resteReconnaitre()) {
          zone.append(h('div', { class: 'carte' },
            h('p', {}, `Le mini-test s'ouvre une fois l'étape « Reconnaître » réussie (${MIN_RECONNAITRE} sur ${QUESTIONS_RECONNAITRE}) : 10 questions rapides, sans soroban.`),
            h('button', { class: 'btn principal', onclick: () => afficher('reconnaitre') }, 'Faire « Reconnaître »')));
          return null;
        }
        let serie = null;
        const intro = h('div', { class: 'carte' },
          h('p', {}, sp.testSecondes ? `${sp.testNombre} questions à la suite, en ${sp.testSecondes} secondes au plus, ${sp.testNombre - testMin(sp)} erreur au plus.` : `${nombreTest(sp)} calculs à la suite. Il en faut ${testMin(sp)} justes${exigeVitesse(sp) ? `, à ${verdictMiniTest(sp, { justes: 0 }).seuil.toLocaleString('fr-FR')} s par ${verdictMiniTest(sp, { justes: 0 }).unite} au plus (temps médian des réponses justes)` : ''}. Une erreur reste affichée jusqu'à Entrée ; les explications sont revues à la fin.`),
          et.valide ? h('p', { class: 'discret' }, `Déjà validé le ${dateFr(et.valide)}. Vous pouvez le repasser pour vous entraîner.`) : null,
          h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer le mini-test'));
        zone.append(intro);

        function lancer() {
          intro.remove();
          serie = creerExercices(sp, zone, {
            generer: () => genererExercice(sp, poidsDe(sp)),
            nombre: nombreTest(sp),
            chrono: true,
            defi: true,
            pauseErreur: true,
            filtreDiagnostic: sp.autorises,
            evaluation: () => evaluerPalier(sp.id, famille(sp)),
            surFin: async (bilan) => {
              serie.detruire();
              serie = null;
              const doigteAPoser = !etatPalier(sp.id).doigte;
              const verdict = verdictMiniTest(sp, bilan);
              const reussi = verdict.reussi;
              await enregistrerSession({ module: 'lecons', mode: 'test', reglages: { sousPalier: sp.id }, total: bilan.total, justes: bilan.justes, dureeMs: bilan.dureeMs });
              if (reussi) await validerPalier(sp.id, !sp.sansRevision);
              const c = etatPalier(sp.id).carte;
              zone.append(h('div', { class: 'carte bilan' },
                h('div', { class: 'grand' }, `${bilan.justes} / ${bilan.total}`),
                h('p', {}, `Temps : ${formaterDuree(bilan.dureeMs)}`),
                reussi
                  ? h('p', { class: 'retour ok' }, c ? `Leçon validée. Première révision le ${dateFr(c.echeance)}.` : 'Leçon validée.')
                  : h('p', {}, `${verdict.raison} Reprenez un peu d'entraînement, puis retentez.`),
                h('div', { class: 'ligne' },
                  reussi && suivant && estDebloque(suivant) ? h('button', { class: 'btn principal', onclick: () => changer(() => vueSousPalier(suivant)) }, `Leçon suivante : ${suivant.titre} →`) : null,
                  h('button', { class: 'btn', onclick: () => afficher(reussi ? 'test' : 'entrainement') }, reussi ? 'Repasser le test' : 'Retour à l\'entraînement'),
                  h('button', { class: 'btn', onclick: () => changer(carte) }, 'Toutes les leçons'))),
              // Premier mini-test de la leçon : une question de doigté (l'application ne voit pas les doigts).
              doigteAPoser ? (questionDoigte(app, sp) ?? '') : '',
              listeErreurs(bilan.resultats) ?? '');
              app.majBadges();
            },
          });
        }
        return () => serie?.detruire();
      }

      afficher(ongletInitial ?? params.onglet ?? (e.reps === 0 ? 'comprendre' : 'entrainement'));
      return () => nettoyerOnglet?.();
    }

    const depart = params.sousPalier ? sousPalier(params.sousPalier) : null;
    // Venu par la piste anzan : le retour « Toutes les leçons » ramène à cette piste.
    piste = params.piste ?? (depart?.mental ? 'anzan' : null);
    changer(() => (depart && estDebloque(depart) ? vueSousPalier(depart) : carte()));
    return () => nettoyerVue?.();
  },
};
