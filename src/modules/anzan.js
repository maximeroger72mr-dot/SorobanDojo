/**
 * Anzan (calcul mental avec un soroban imaginaire), six modes :
 *  - Photo du soroban : un soroban s'affiche un instant, on tape le nombre (visualisation) ;
 *  - Tenir une image : un nombre en chiffres, on le pose sur le soroban imaginaire, puis on compare ;
 *  - Flash avec image : les nombres défilent, et un petit soroban montre le TOTAL qui évolue
 *    (nette, estompée ou légère : on la fait disparaître peu à peu) ;
 *  - Flash : les nombres défilent un par un ;
 *  - Mitori-anzan : la colonne reste affichée, on la calcule de tête, sans défilement ;
 *  - Multiplication de tête : petites multiplications (2 × 1 chiffres, puis 3 × 1).
 *
 * Les colonnes ne contiennent que les gestes déjà appris (comme partout dans l'application),
 * avec les soustractions en option.
 */

import { genererColonne, genererColonneVariee, creerMemoire, sousTotaux } from '../core/generateur.js';
import { genererPhoto } from '../core/curriculum.js';

const memoire = creerMemoire(6);
const memoirePhoto = creerMemoire(6);
import { genererMultiplication } from '../core/multiplication.js';
import { famille } from '../core/motifs.js';
import { motifsAppris } from '../core/parcours.js';
import { progression, enregistrerSession, noterReponse, proposerMeilleurScore } from '../core/progression.js';
import { lireReponse } from '../core/nombres.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { rendreEnonce } from '../ui/enonce.js';
import { GRADES_FLASH, QUESTIONS_GRADE_FLASH, JUSTES_GRADE_FLASH, periodeGrade, libelleGradeFlash, meilleurGradeFlash, prochainGradeFlash } from '../core/flashGrades.js';
import { cadencer, afficherNombreFlash, decompteFlash } from '../ui/cadence.js';
import { h, raccourcis, formaterNombre, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { grade: null, mode: 'image', chiffres: 1, termes: 3, duree: 2, questions: 10, soustractions: false, mulChiffres: 2, image: 1 };
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const DUREES = [3, 2.5, 2, 1.5, 1, 0.7, 0.5, 0.3];
const IMAGES = [[1, 'image nette'], [0.5, 'image estompée'], [0.2, 'image légère']];

/** Colonne d'anzan : gestes appris seulement, soustractions en option. */
function colonne(chiffres, termes, soustractions) {
  const appris = motifsAppris(progression());
  const ops = soustractions ? ['+', '-'] : ['+'];
  const amis = [...appris].filter((c) => !c.endsWith(':direct') && ops.includes(c[0]));
  const cibles = amis.length ? amis : famille('direct').filter((c) => ops.includes(c[0]));
  try {
    // 1 chiffre : la colonne commence par un seul chiffre (pas de dizaine en tête).
    return genererColonneVariee({ chiffres, lignes: termes, autorises: appris, cibles, ops, premierCourt: true }, memoire);
  } catch {
    return genererColonne({ chiffres, lignes: termes, autorises: null, cibles: famille('direct').filter((c) => ops.includes(c[0])), ops, premierCourt: true });
  }
}

export default {
  id: 'anzan',
  titre: 'Flash anzan',
  monter(el, app, params = {}) {
    // Réglages imposés par la séance du jour (adaptés au niveau), puis démarrage direct.
    for (const k of ['chiffres', 'termes', 'questions']) if (params[k]) reglages[k] = params[k];
    if (params.duree) reglages.duree = DUREES.reduce((a, b) => (Math.abs(b - params.duree) < Math.abs(a - params.duree) ? b : a));
    if (params.mode) reglages.mode = params.mode;
    let actif = true;
    let nettoyerMode = null;
    const select = (cle, options, conv = Number) => {
      const s = h('select', { onchange: (e) => { reglages[cle] = conv(e.target.value); afficherReglages(); } }, options.map(([v, t]) => h('option', { value: v }, t)));
      s.value = String(reglages[cle]);
      return s;
    };
    const zoneReglages = h('div', { class: 'reglages' });
    const zone = h('div', {});
    el.append(h('h1', {}, 'Flash anzan'),
      h('p', {}, 'Entraînement LIBRE du calcul de tête : vous choisissez le mode, le nombre de chiffres et la vitesse. Pour apprendre pas à pas (avec mini-tests et révisions), suivez plutôt la piste guidée : ',
        h('button', { class: 'lien', onclick: () => app.aller('lecons', { piste: 'anzan' }) }, 'Apprendre › Anzan et visualisation'), '. À l\'oreille : ',
        h('button', { class: 'lien', onclick: () => app.aller('dictee', { support: 'tete' }) }, 'la dictée anzan, par paliers'), '. Pour se mesurer : les épreuves d\'anzan, dans Se mesurer › Grades.'),
      h('p', { class: 'discret' }, 'Voyez les boules bouger, et faites les gestes avec les doigts dans l\'air. Progression conseillée : photo du soroban et tenir une image, puis flash avec image (nette, estompée, légère), puis flash. Allongez la chaîne de nombres AVANT de réduire le temps d\'affichage ; si l\'image se brouille, revenez à moins de nombres. Le mitori-anzan entraîne sans le stress du défilement.'),
      zoneReglages, zone);

    function afficherReglages() {
      const mode = select('mode', [['photo', 'Photo du soroban'], ['tenir', 'Tenir une image'], ['image', 'Flash avec image'], ['flash', 'Flash'], ['grade', 'Grade de flash (temps total)'], ['mitori', 'Mitori-anzan (colonne fixe)'], ['mul', 'Multiplication de tête']], String);
      const elements = [mode];
      if (reglages.mode === 'grade') {
        reglages.grade ??= prochainGradeFlash(progression()).id;
        const obtenu = meilleurGradeFlash(progression());
        elements.push(select('grade', GRADES_FLASH.map((x) => [x.id, `${progression().records[`flash-grade-${x.id}`]?.reussi ? '✓ ' : ''}${libelleGradeFlash(x)}`]), String),
          h('button', { class: 'btn principal', onclick: () => lancer() }, 'Passer ce grade ', h('kbd', {}, 'Entrée')),
          h('p', { class: 'discret', style: 'flex-basis:100%;margin:0' }, `${QUESTIONS_GRADE_FLASH} questions, ${JUSTES_GRADE_FLASH} justes pour obtenir le grade. ${obtenu ? `Votre meilleur grade : ${obtenu.nom}.` : 'Aucun grade obtenu pour l\'instant.'} Échelle indicative, du 10e kyū au 10e dan : ce n'est pas la grille d'un examen.`));
        remplir(zoneReglages, elements);
        return;
      }
      if (reglages.mode === 'mul') elements.push(select('mulChiffres', [[2, '2 × 1 chiffres'], [3, '3 × 1 chiffres']]));
      else if (reglages.mode === 'photo' || reglages.mode === 'tenir') {
        elements.push(select('chiffres', [[1, '1 tige'], [2, '2 tiges'], [3, '3 tiges']]));
        if (reglages.mode === 'photo') elements.push(select('duree', DUREES.map((d) => [d, `${d.toLocaleString('fr-FR')} s d'affichage`])));
      } else {
        elements.push(select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres'], [4, '4 chiffres']]),
          select('termes', [3, 4, 5, 7, 10, 15].map((n) => [n, `${n} nombres`])));
        if (reglages.mode !== 'mitori') elements.push(select('duree', DUREES.map((d) => [d, `${d.toLocaleString('fr-FR')} s par nombre`])));
        if (reglages.mode === 'image') elements.push(select('image', IMAGES));
        elements.push(h('label', {}, h('input', { type: 'checkbox', checked: reglages.soustractions, onchange: (e) => { reglages.soustractions = e.target.checked; } }), ' avec soustractions'));
      }
      elements.push(select('questions', [[5, '5 questions'], [10, '10 questions']]),
        h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer ', h('kbd', {}, 'Entrée')));
      remplir(zoneReglages, elements);
    }

    function lancer() {
      nettoyerMode?.();
      remplir(zone);
      const r = { ...reglages };
      if (['mitori', 'mul', 'photo', 'tenir'].includes(r.mode)) {
        // Colonne fixe, multiplication ou visualisation : une série classique, de tête.
        const generer = {
          mul: () => ({ ...genererMultiplication(r.mulChiffres, 1), mental: true }),
          mitori: () => ({ ...colonne(r.chiffres, r.termes, r.soustractions), motifs: undefined }),
          photo: () => genererPhoto(r.chiffres, r.duree, memoirePhoto),
          tenir: () => ({ ...genererPhoto(r.chiffres, 1.5, memoirePhoto), type: 'tenir', flash: { duree: 1.5, tenir: 3 } }),
        }[r.mode];
        const serie = creerSerie(zone, {
          generer,
          nombre: r.questions,
          chrono: true,
          surFin: async (b) => {
            serie.detruire();
            await enregistrerSession({ module: 'anzan', mode: r.mode, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
            zone.append(h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
              h('p', {}, `Réussite ${formaterPourcent(b.justes, b.total)}`),
              h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle série')), listeErreurs(b.resultats) ?? '');
          },
        });
        zone.prepend(h('p', { class: 'consigne' }, r.mode === 'photo' ? 'Prenez une « photo » du soroban d\'un coup d\'œil, puis tapez le nombre.'
          : r.mode === 'tenir' ? 'Posez le nombre sur votre soroban imaginaire, gardez l\'image, puis comparez.'
            : 'De tête, sans toucher le soroban : imaginez-le.'));
        nettoyerMode = () => serie.detruire();
        return;
      }
      if (r.mode === 'grade') {
        const x = GRADES_FLASH.find((y) => y.id === r.grade) ?? GRADES_FLASH[0];
        Object.assign(r, { gradeFlash: x, chiffres: x.chiffres, termes: x.nombres, duree: periodeGrade(x), questions: QUESTIONS_GRADE_FLASH, soustractions: false });
      }
      nettoyerMode = flash(r);
    }

    /** Flash (avec ou sans image) : nombres un par un, puis la somme. */
    function flash(r) {
      let etat = 'pret';
      let question = null;
      const serie = { index: 0, justes: 0, debut: performance.now() };
      const ecran = h('div', { class: 'flash-ecran' });
      const zoneImage = h('div', { class: 'flash-image' });
      const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', placeholder: 'Somme', autocomplete: 'off', style: 'display:none' });
      const btn = h('button', { class: 'btn principal', onclick: () => action() });
      const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const pastilles = h('div', { class: 'pastilles' });
      zone.append(h('div', { class: 'ligne' }, pastilles), ecran, r.mode === 'image' ? zoneImage : '', h('div', { class: 'ligne' }, saisie, btn), retour);
      // Image d'aide : le TOTAL qui évolue (ce qu'on doit voir dans sa tête), plus ou moins estompé.
      zoneImage.style.opacity = String(r.image);
      let vue = null;
      let sorobanImage = null;
      if (r.mode === 'image') {
        sorobanImage = new Soroban(Math.max(3, r.chiffres + 1 + String(r.termes).length));
        vue = new SorobanVue(zoneImage, sorobanImage, { interactif: false });
      }
      const majBouton = (t) => { remplir(btn, t, ' ', h('kbd', {}, 'Entrée')); btn.style.display = t ? '' : 'none'; };

      async function defiler() {
        etat = 'flash';
        majBouton('');
        saisie.style.display = 'none';
        remplir(retour);
        question = colonne(r.chiffres, r.termes, r.soustractions);
        await decompteFlash(ecran, 400, () => !actif);
        if (!actif) return;
        sorobanImage?.effacer();
        const totaux = sousTotaux(question.lignes);
        // Cadence calée sur l'horloge : pas de dérive, même à 0,3 s par nombre.
        const { fini } = await cadencer({
          periodeMs: r.duree * 1000,
          nombre: question.lignes.length,
          interrompu: () => !actif,
          surAfficher: (k) => {
            const l = question.lignes[k];
            afficherNombreFlash(ecran, formaterNombre(l.n), l.op === '-');
            sorobanImage?.definirValeur(Math.max(0, totaux[k]));
          },
          surMasquer: () => { ecran.textContent = ''; },
        });
        if (!fini) return;
        ecran.textContent = '?';
        etat = 'reponse';
        saisie.style.display = '';
        saisie.disabled = false;
        saisie.value = '';
        saisie.focus();
        majBouton('Valider');
      }

      async function action() {
        if (etat === 'pret') { defiler(); return; }
        if (etat === 'reponse') {
          const rep = lireReponse(saisie.value);
          if (rep === null) return;
          const juste = rep === question.resultat;
          if (juste) serie.justes += 1;
          serie.index += 1;
          await noterReponse(juste);
          saisie.disabled = true;
          pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
          ecran.textContent = formaterNombre(question.resultat);
          retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
          remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, juste ? '✓' : '✗'), juste ? ' Juste.' : ` Vous avez répondu ${formaterNombre(rep)}.`),
            h('div', { class: 'discret' }, 'Les nombres :'), rendreEnonce(question, { compact: true, sousTotaux: !juste }));
          etat = 'corrige';
          majBouton(serie.index >= r.questions ? 'Voir le bilan' : 'Question suivante');
          return;
        }
        if (etat === 'corrige') {
          if (serie.index < r.questions) { defiler(); return; }
          etat = 'fin';
          await enregistrerSession({ module: 'anzan', mode: r.mode, reglages: r, total: serie.index, justes: serie.justes, dureeMs: performance.now() - serie.debut });
          ecran.textContent = `${serie.justes} / ${serie.index}`;
          retour.className = 'retour';
          if (r.gradeFlash) {
            const reussi = serie.justes >= JUSTES_GRADE_FLASH;
            await proposerMeilleurScore(`flash-grade-${r.gradeFlash.id}`, serie.justes, { reussi });
            const suivant = GRADES_FLASH[GRADES_FLASH.indexOf(r.gradeFlash) + 1];
            remplir(retour, reussi ? `${r.gradeFlash.nom} de flash obtenu. ${suivant ? `Le suivant : ${libelleGradeFlash(suivant)}.` : 'C\'est le plus haut grade.'}` : `Pas encore : il faut ${JUSTES_GRADE_FLASH} justes sur ${QUESTIONS_GRADE_FLASH}. Retentez quand vous voulez.`);
            if (reussi && suivant) reglages.grade = suivant.id;
            afficherReglages();
            majBouton('Recommencer');
            return;
          }
          const conseil = serie.justes === serie.index
            ? (r.mode === 'image' ? (r.image > 0.2 ? 'Parfait : estompez l\'image d\'un cran.' : 'Parfait : passez au flash sans image.') : 'Parfait : ajoutez un nombre (puis, plus tard, réduisez le temps d\'affichage).')
            : serie.justes / serie.index < 0.7 ? 'Retirez un nombre à la chaîne, ou repassez par le flash avec image.' : 'Encore une série au même niveau.';
          remplir(retour, `Réussite ${formaterPourcent(serie.justes, serie.index)}. ${conseil}`);
          majBouton('Nouvelle série');
          return;
        }
        if (etat === 'fin') { serie.index = 0; serie.justes = 0; serie.debut = performance.now(); remplir(pastilles); defiler(); }
      }

      majBouton('Commencer');
      const sansRaccourcis = raccourcis({ Enter: () => { if (etat !== 'flash') action(); } });
      if (params.auto) action();
      return () => { actif = false; sansRaccourcis(); vue?.detruire(); };
    }

    afficherReglages();
    const sansRaccourcisAccueil = raccourcis({ Enter: () => { if (!nettoyerMode) lancer(); return !nettoyerMode ? undefined : false; } });
    if (params.auto) lancer();
    return () => { actif = false; nettoyerMode?.(); sansRaccourcisAccueil(); };
  },
};
