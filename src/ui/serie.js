/**
 * Série d'exercices, un par un, à calculer sur son propre soroban.
 *
 * L'élève lit l'énoncé, calcule sur son soroban, tape le résultat et valide (Entrée).
 * Le retour reste affiché : ✓ / ✗, le bon résultat, les causes probables d'erreur,
 * et deux aides : les sous-totaux (pour retrouver sur son soroban où l'écart est apparu)
 * et « Expliquer » (démonstration animée). Une bande de pastilles garde la trace de la série.
 *
 * Mode défi : pas d'arrêt sur les erreurs (on les revoit à la fin), chronomètre en continu.
 *
 * Le temps de calcul s'arrête à la PREMIÈRE TOUCHE tapée : la frappe n'est pas chronométrée.
 * Exercice en flash (anzan) : les nombres s'affichent un par un, puis le chrono démarre ; l'image
 * d'aide montre le total. Photo du soroban et « tenir une image » : exercices de visualisation.
 * Division par 2 chiffres ou plus : bouton « Je suis bloqué » (estimation pas à pas, table du diviseur).
 * Mode « mains sur le soroban » : Espace arrête le chrono et montre le résultat ; l'élève répond
 * O (mon soroban affiche ce nombre) ou N. Compte pour le volume, pas pour le niveau.
 */

import { diagnostiquer, localiserErreur, motifsDeLigne, typeErreurOperation } from '../core/diagnostic.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { tempsParUnite, tempsCible, unites, SURCOUT_S, MIN_ESSAIS } from '../core/maitrise.js';
import { lireReponse, egal } from '../core/nombres.js';
import { aideDivision } from '../core/multiplication.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from './sorobanVue.js';
import { motifsEnDifficulte, noterGestes, noterReponse, reglagesUtilisateur, modifierReglages, noterErreurColonne, noterErreurOperation, signalerLenteur, noterVolume, noterRythme, MESSAGE_RYTHME } from '../core/progression.js';
import { scoreRythme } from '../core/regularite.js';
import { notifier } from './toast.js';
import { rendreEnonce, formaterValeur as valeur } from './enonce.js';
import { creerCourse } from './course.js';
import { sousTotaux } from '../core/generateur.js';

/** Anzan × et ÷ : durée d'affichage de l'énoncé quand l'option « énoncé masqué » est cochée. */
const DUREE_ENONCE_MENTAL_MS = 4000;

/** Un exercice qui a une explication pas à pas (pas les exercices de visualisation). */
/** Résultat attendu tel qu'il faut l'écrire (table : sur deux tiges, « 08 »). */
const attenduTexte = (ex) => ex.attendu ?? valeur(ex, ex.resultat);
const explicable = (ex) => !['photo', 'tenir', 'quotidien'].includes(ex.type) && !ex.negatif;
import { ouvrirExplication } from './explication.js';
import { cadencer, afficherNombreFlash, decompteFlash } from './cadence.js';
import { ouvrirDemo } from './panneauDemo.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from './dom.js';

/**
 * Encadré « Diagnostic & Remédiation » pour les motifs en difficulté.
 * @param {Set<string>|null} filtre  ne montrer que ces motifs (null : tous)
 */
export function encadreDiagnostic(filtre = null, max = 2) {
  const liste = motifsEnDifficulte().filter((m) => !filtre || filtre.has(m.cle)).slice(0, max);
  if (!liste.length) return null;
  return h('div', { class: 'diagnostic' },
    h('strong', {}, 'Diagnostic & Remédiation'),
    liste.map((m) => h('div', { class: 'diag-motif' },
      h('div', {}, h('strong', {}, nomMotif(m.cle)), h('span', { class: 'discret' }, ` · ${m.erreurs} erreur${m.erreurs > 1 ? 's' : ''} sur ${m.essais} · apparaît plus souvent jusqu'à consolidation`)),
      h('div', {}, gesteMotif(m.cle)),
      h('button', { class: 'btn', onclick: () => ouvrirDemo({ titre: nomMotif(m.cle), texte: gesteMotif(m.cle), demo: exempleMotif(m.cle) }) }, 'Voir le geste'))));
}

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {() => object} o.generer
 * @param {number} [o.nombre=Infinity]
 * @param {boolean} [o.chrono=false]
 * @param {boolean} [o.defi=false]          enchaîne sans s'arrêter sur les erreurs
 * @param {Set<string>|null} [o.filtreDiagnostic]  motifs montrés dans l'encadré de remédiation
 * @param {() => object} [o.evaluation]     évaluation actuelle (maitrise.evaluer) pour l'objectif de temps
 * @param {{msParExercice:number, nom?:string}|null} [o.fantome]  rythme du record (ou du « maître ») :
 *   course visible (deux barres) et écart affiché à chaque calcul (voir ui/course.js)
 * @param {() => boolean} [o.fin]           vrai : la série s'arrête avant le prochain exercice
 * @param {(res, ex, i) => any} [o.surExercice]
 * @param {(bilan) => void} [o.surFin]      { justes, total, dureeMs, resultats: [{ex, reponse, juste, dureeMs}] }
 * @param {(i) => string} [o.compteur]
 * @param {() => boolean} [o.doigteMasque]  vrai : rappel doigté masqué (geste déjà acquis)
 */
export function creerSerie(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, filtreDiagnostic: null, evaluation: null, fantome: null, ...o };
  const zoneEnonce = h('div', { class: 'zone-enonce' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Résultat', 'aria-label': 'Résultat' });
  const btnValider = h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
  // Résultats négatifs : certains claviers numériques de téléphone n'ont pas de signe moins.
  const btnSigne = h('button', { class: 'btn btn-signe', style: 'display:none', 'aria-label': 'Changer le signe', onclick: () => {
    saisie.value = /^[-−]/.test(saisie.value) ? saisie.value.replace(/^[-−]/, '') : `−${saisie.value}`;
    saisie.dispatchEvent(new Event('input'));
    saisie.focus();
  } }, '±');
  const btnBloque = h('button', { class: 'btn', style: 'display:none', onclick: () => aideSuivante() }, 'Je suis bloqué ', h('kbd', {}, 'B'));
  const zoneAide = h('div', { class: 'aide-division' });
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const fantome = h('span', { class: 'compteur fantome' });
  const course = o.fantome && Number.isFinite(o.nombre ?? Infinity) ? creerCourse({ total: o.nombre, msParUnite: o.fantome.msParExercice, nom: o.fantome.nom ?? 'votre record' }) : null;
  // Chrono discret pendant l'apprentissage ; bien visible dans les défis et les jeux.
  const chronoExo = h('div', { class: `chrono-exercice${opts.defi && !opts.pauseErreur ? ' en-avant' : ''}` });
  const pastilles = h('div', { class: 'pastilles' });
  const caseEspace = h('input', { type: 'checkbox', checked: !!reglagesUtilisateur().modeEspace });
  caseEspace.addEventListener('change', () => { modifierReglages({ modeEspace: caseEspace.checked }); majModeEspace(); saisie.focus(); });
  const choixEspace = h('label', { class: 'mode-espace', title: 'Espace arrête le chrono dès que votre soroban est fini ; vous tapez ensuite le résultat (la frappe ne compte pas dans le temps).' },
    caseEspace, ' Mains sur le soroban (Espace)');
  // Anzan × et ÷ : option « énoncé masqué » (il disparaît après quelques secondes).
  const caseMasque = h('input', { type: 'checkbox', checked: !!reglagesUtilisateur().enonceMasque });
  caseMasque.addEventListener('change', () => { modifierReglages({ enonceMasque: caseMasque.checked }); saisie.focus(); });
  const choixMasque = h('label', { class: 'mode-espace', style: 'display:none', title: 'L\'opération s\'affiche quelques secondes, puis disparaît : vous la gardez sur votre soroban imaginaire. Appliqué à partir du calcul suivant.' },
    caseMasque, ' Masquer l\'énoncé après 4 s');
  let minuterieMasque = null;
  // Rappel doigté : pouce / index / pincée à côté de chaque ligne. Masqué d'office quand le geste
  // de la leçon est acquis (opts.doigteMasque), pour ne pas devenir une béquille.
  const caseDoigte = h('input', { type: 'checkbox', checked: !!reglagesUtilisateur().doigte });
  caseDoigte.addEventListener('change', () => { modifierReglages({ doigte: caseDoigte.checked }); afficherEnonce(); saisie.focus(); });
  const choixDoigte = h('label', { class: 'mode-espace', title: 'Rappelle à côté de chaque ligne quels doigts bougent. Masqué quand le geste est acquis.' }, caseDoigte, ' Rappel doigté');
  const doigteActif = () => caseDoigte.checked && !opts.defi && ex?.type === 'addsub' && !ex.flash && !ex.decimales && !ex.negatif && !opts.doigteMasque?.();
  // Annoncé aux lecteurs d'écran : juste / faux, résultat attendu.
  const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
  const zoneDiag = h('div', {});
  const racine = h('div', { class: 'serie' },
    // Options repliées : pendant le calcul, seuls la colonne, la saisie et un petit chrono restent.
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }),
      opts.defi ? null : h('details', { class: 'options-serie' }, h('summary', {}, 'Options'), h('div', { class: 'options-contenu' }, choixDoigte, choixEspace, choixMasque)),
      fantome, chrono, compteur),
    course?.el ?? null,
    h('div', { class: 'disposition-enonce' }, zoneEnonce, chronoExo),
    h('div', { class: 'ligne' }, btnSigne, saisie, btnValider, btnBloque),
    zoneAide, retour, zoneDiag);
  conteneur.append(racine);
  saisie.addEventListener('input', () => {
    if (phase === 'question' && dureeCalcul === null && saisie.value.trim()) {
      dureeCalcul = performance.now() - debutExercice;
      majChronoExo(dureeCalcul);
    }
  });

  let i = 0;
  let ex = null;
  let debutExercice = 0;
  let phase = 'question'; // 'question' | 'corrige' | 'fin'
  let sousTotauxVisibles = false;
  let attribue = false;
  let dureeCalcul = null;   // temps jusqu'à la première touche
  let aideUtilisee = false;
  let aide = null;          // { etapes, index } pour « Je suis bloqué »
  let flashEnCours = false;
  /**
   * Calculs anormalement longs (au moins 2,5 fois le temps médian de la série, et 5 s de plus) :
   * reproposés tels quels 10 exercices plus tard, sans le signaler. S'il est encore lent, le geste
   * le plus fragile de la colonne sera tiré un peu plus souvent ensuite. Pas en mini-test ni en
   * examen (opts.defi) : ce sont des épreuves.
   */
  const aRevoir = [];
  const blocRythme = [];
  const durees = [];
  let espaceArrete = false; // mode Espace : chrono arrêté par Espace, on tape maintenant la réponse
  // Exercices de tête (flash, photo, image) : pas de mode Espace, on répond au clavier.
  // De tête aussi pour les × et ÷ d'anzan (ex.mental) : le soroban est rangé.
  const deTete = () => !!(ex?.flash || ex?.mental);
  const modeEspace = () => caseEspace.checked && !opts.defi && !deTete();
  function majModeEspace() {
    choixEspace.style.display = deTete() ? 'none' : '';
    choixMasque.style.display = ex?.mental ? '' : 'none';
    choixDoigte.style.display = ex?.type !== 'addsub' || ex?.flash || ex?.decimales || ex?.negatif || opts.doigteMasque?.() ? 'none' : '';
    const sansSaisie = (modeEspace() && !espaceArrete) || ex?.type === 'tenir';
    saisie.style.display = sansSaisie ? 'none' : '';
    btnSigne.style.display = !sansSaisie && ex?.negatif ? '' : 'none';
    btnValider.style.display = sansSaisie ? 'none' : '';
    if (phase === 'question') remplir(retour, h('span', { class: 'discret' }, ex?.flash ? '' : ex?.mental ? 'De tête, soroban rangé : voyez les boules bouger, puis tapez le résultat.' : modeEspace() ? 'Calculez sur votre soroban, appuyez sur Espace dès qu\'il est fini, puis tapez le résultat.' : 'Calculez sur votre soroban, tapez le résultat, puis Entrée.'));
  }
  let zoneLocalisationCourante = null;
  let timer = null;
  const debut = performance.now();
  const resultats = [];

  const majChrono = () => {
    const ecoule = performance.now() - debut;
    if (opts.chrono) chrono.textContent = formaterDuree(ecoule);
    // Où en serait le fantôme à ce moment ? (on ne se mesure qu'à soi-même)
    if (course && phase !== 'fin') course.maj(resultats.length, ecoule);
    if (phase === 'question' && dureeCalcul === null && !flashEnCours && ex?.type !== 'tenir') majChronoExo(performance.now() - debutExercice);
  };
  const minuterie = setInterval(majChrono, 100);

  /**
   * Objectif de temps de l'exercice courant : battre sa médiane récente (petites marches) ;
   * tant qu'il n'y a pas assez d'essais, le seuil du niveau suivant.
   */
  function objectif() {
    if (ex.type === 'tenir') return null;
    const ev = opts.evaluation?.();
    if (!ev) return null;
    if (ev.essais >= MIN_ESSAIS && ev.temps !== null) return { nom: 'votre médiane', s: SURCOUT_S + ev.temps * unites(ex) };
    const niveau = ev.prochain?.temps ? ev.prochain : null;
    return niveau ? { nom: niveau.nom, s: tempsCible(ex, niveau) } : null;
  }
  let objectifCourant = null;
  function majChronoExo(ms) {
    remplir(chronoExo, ...[
      h('div', { class: 'temps' }, formaterDuree(ms)),
      objectifCourant ? h('div', { class: `objectif${ms / 1000 <= objectifCourant.s ? ' tenu' : ''}` }, `objectif ${formaterDuree(objectifCourant.s * 1000)}`, h('br'), `(${objectifCourant.nom})`) : null,
    ].filter(Boolean));
  }

  const afficherEnonce = () => remplir(zoneEnonce, rendreEnonce(ex, {
    sousTotaux: sousTotauxVisibles,
    doigte: doigteActif(),
    // Après une erreur, les lignes deviennent cliquables pour désigner où le soroban a divergé.
    surLigne: sousTotauxVisibles && phase === 'corrige' && !attribue ? (l) => designerLigne(l) : null,
  }));
  const majDiag = () => remplir(zoneDiag, encadreDiagnostic(opts.filtreDiagnostic) ?? '');

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre || opts.fin?.()) { terminer(); return; }
    // Un calcul qui a posé problème revient, sans le dire, une dizaine d'exercices plus tard.
    const rappel = aRevoir.findIndex((x) => x.a <= i);
    if (rappel >= 0) { ex = { ...aRevoir[rappel].ex, revu: true }; aRevoir.splice(rappel, 1); } else ex = opts.generer();
    sousTotauxVisibles = false;
    phase = 'question';
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
    objectifCourant = objectif();
    dureeCalcul = null;
    if (ex.type === 'tenir') remplir(chronoExo);
    aideUtilisee = false;
    aide = null;
    remplir(zoneAide);
    btnBloque.style.display = ex.type === 'div' && ex.b >= 10 && !ex.arrondi ? '' : 'none';
    afficherEnonce();
    retour.className = 'retour';
    majModeEspace();
    saisie.value = '';
    saisie.disabled = false;
    btnValider.disabled = false;
    btnBloque.disabled = false;
    saisie.inputMode = ex.decimales ? 'decimal' : 'numeric';
    debutExercice = performance.now();
    clearTimeout(minuterieMasque);
    if (ex.mental && caseMasque.checked) {
      // Énoncé masqué après quelques secondes : il faut l'avoir posé dans la tête.
      const cible = ex;
      minuterieMasque = setTimeout(() => {
        if (ex !== cible || phase !== 'question') return;
        remplir(zoneEnonce, h('div', { class: 'enonce-masque', title: 'L\'énoncé a été masqué : il est posé sur votre soroban imaginaire.' }, '· · ·'));
      }, DUREE_ENONCE_MENTAL_MS);
    }
    if (ex.flash) jouerFlash(ex);
    else if (!modeEspace()) saisie.focus();
  }

  /**
   * Exercices en flash, puis le chronomètre démarre :
   *  - anzan : les nombres un par un ; l'image d'aide (si opacité > 0) montre le TOTAL qui évolue,
   *    comme le soroban qu'on doit voir dans sa tête (pas le nombre qui arrive) ;
   *  - photo : un soroban s'affiche un instant, on tape le nombre ;
   *  - tenir : un nombre en chiffres, on le pose sur le soroban imaginaire, puis on compare.
   */
  async function jouerFlash(exo) {
    flashEnCours = true;
    saisie.disabled = true;
    btnValider.disabled = true;
    const opacite = exo.flash.photo ? 1 : Number(exo.flash.image) || 0;
    // Le nombre est toujours centré ; sans image d'aide, il est seul au milieu d'un écran vide.
    const ecran = h('div', { class: `flash-ecran centre${opacite === 0 && exo.type !== 'tenir' ? ' pur' : ''}` });
    const zoneImage = h('div', { class: 'flash-image' });
    // Photo : le soroban s'affiche DANS l'écran (à la place du nombre) ; anzan : sous le nombre.
    if (exo.flash.photo) remplir(zoneEnonce, ecran);
    else remplir(zoneEnonce, ecran, opacite > 0 ? zoneImage : null);
    zoneImage.style.opacity = String(opacite);
    const totaux = exo.lignes ? sousTotaux(exo.lignes) : [exo.n];
    const sorobanImage = opacite > 0 ? new Soroban(Math.max(exo.flash.photo ? 2 : 3, String(Math.max(...totaux.map(Math.abs))).length + 1)) : null;
    const vueImage = sorobanImage ? new SorobanVue(zoneImage, sorobanImage, { interactif: false }) : null;
    const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const interrompu = () => ex !== exo || phase === 'fin';
    // Anzan sans image d'aide : plein écran, le nombre au centre exact de la fenêtre.
    if (exo.type !== 'photo' && exo.type !== 'tenir' && opacite === 0) ecran.classList.add('plein');
    await decompteFlash(ecran, 350);
    if (exo.type === 'photo') {
      // L'image seule, sans le nombre : on la « photographie ».
      remplir(ecran, zoneImage);
      sorobanImage.definirValeur(exo.n);
      await attendre(exo.flash.duree * 1000);
      vueImage.detruire();
      remplir(ecran);
      if (interrompu()) return;
    } else if (exo.type === 'tenir') {
      ecran.textContent = formaterNombre(exo.n);
      await attendre(exo.flash.duree * 1000);
      if (interrompu()) return;
      ecran.textContent = '';
      remplir(zoneEnonce, ecran, h('p', { class: 'consigne' }, 'Fermez les yeux : posez ce nombre sur votre soroban imaginaire, doigts dans l\'air, et gardez l\'image nette.'));
      await attendre(exo.flash.tenir * 1000);
      if (interrompu()) return;
      flashEnCours = false;
      remplir(zoneEnonce, h('p', { class: 'consigne' }, 'Ouvrez les yeux. Le vrai soroban :'), rendreEnonce(exo));
      dureeCalcul = 0;
      phase = 'auto';
      retour.className = 'retour';
      remplir(retour, 'Votre image était-elle celle-ci ? ',
        h('button', { class: 'btn ok-btn', onclick: () => autoEvaluer(true) }, 'Oui ', h('kbd', {}, 'O')), ' ',
        h('button', { class: 'btn ko-btn', onclick: () => autoEvaluer(false) }, 'Non ', h('kbd', {}, 'N')));
      return;
    } else {
      // Cadence calée sur l'horloge (ui/cadence.js) : pas de dérive d'un nombre à l'autre.
      await cadencer({
        periodeMs: exo.flash.duree * 1000,
        nombre: exo.lignes.length,
        interrompu,
        surAfficher: (k) => {
          const l = exo.lignes[k];
          afficherNombreFlash(ecran, formaterNombre(l.n), l.op === '-');
          // L'image suit le total, sans s'effacer entre deux nombres.
          sorobanImage?.definirValeur(totaux[k]);
        },
        surMasquer: () => { ecran.textContent = ''; },
      });
      vueImage?.detruire();
      remplir(zoneEnonce, ecran);
    }
    ecran.classList.remove('plein');
    if (interrompu()) return;
    ecran.textContent = '?';
    flashEnCours = false;
    saisie.disabled = false;
    btnValider.disabled = false;
    saisie.focus();
    debutExercice = performance.now();
  }

  /** « Je suis bloqué » : dévoile le raisonnement de la division, un essai à la fois. */
  function aideSuivante() {
    if (phase !== 'question' || ex?.type !== 'div') return;
    aideUtilisee = true;
    if (!aide) {
      aide = { ...aideDivision(ex.a, ex.b), vus: 0 };
      remplir(zoneAide, h('div', { class: 'carte' },
        h('div', {}, h('strong', {}, `Table de ${formaterNombre(ex.b)} : `), aide.table.map((v, i) => `${i + 1} × ${ex.b} = ${formaterNombre(v)}`).join(' · ')),
        h('ol', { class: 'aide-etapes' })));
    }
    const liste = zoneAide.querySelector('.aide-etapes');
    // Chaque clic dévoile un chiffre du quotient de plus (estimation, vérification, correction).
    const e = aide.etapes[aide.vus];
    if (!e) return;
    aide.vus += 1;
    const lignes = [`On regarde ${formaterNombre(e.resteLocal)}. ${ex.b >= 10 ? `${ex.b} est proche de ${e.arrondi} : ${formaterNombre(e.resteLocal)} ÷ ${e.arrondi} ≈ ${e.estime}.` : ''}`];
    for (const x of e.essais) {
      lignes.push(x.ok
        ? `${x.q} × ${ex.b} = ${formaterNombre(x.produit)} : ça tient, et il reste ${formaterNombre(e.resteLocal - x.produit)}, moins que ${ex.b}. Chiffre : ${x.q}.`
        : x.raison === 'trop grand'
          ? `${x.q} × ${ex.b} = ${formaterNombre(x.produit)} : plus que ${formaterNombre(e.resteLocal)}, trop grand → ${x.q - 1}.`
          : `${x.q} × ${ex.b} = ${formaterNombre(x.produit)} : il reste ${formaterNombre(e.resteLocal - x.produit)}, encore ≥ ${ex.b}, trop petit → ${x.q + 1}.`);
    }
    liste.append(h('li', {}, lignes.join(' ')));
    if (aide.vus >= aide.etapes.length) btnBloque.disabled = true;
  }

  async function valider() {
    if (phase === 'corrige') { i += 1; suivant(); return; }
    if (phase !== 'question') return;
    const reponse = lireReponse(saisie.value, ex.decimales ?? 0);
    if (reponse === null) {
      // Saisie non reconnue : on le dit (sinon « Entrée » semble ne rien faire).
      if (saisie.value.trim()) {
        retour.className = 'retour erreur';
        remplir(retour, `« ${saisie.value.trim()} » n'est pas un nombre reconnu : tapez seulement des chiffres${ex.decimales ? ', avec une virgule pour les décimales' : ''}${ex.negatif ? ', et un signe − devant si le résultat est négatif' : ''}.`);
      }
      saisie.focus();
      return;
    }
    // Produit de la table : la convention des deux tiges exige deux chiffres (« 06 »).
    const juste = ex.attendu ? saisie.value.replace(/\s/g, '') === ex.attendu : egal(reponse, ex.resultat, ex.decimales ?? 0);
    // Temps de calcul : jusqu'à la première touche (la frappe n'est pas comptée).
    const dureeMs = dureeCalcul ?? performance.now() - debutExercice;
    phase = 'traitement';
    saisie.disabled = true;
    majChronoExo(dureeMs);
    resultats.push({ ex, reponse, juste, dureeMs, aide: aideUtilisee });
    espaceArrete = false;
    racine.dataset.enCours = '1'; // une série commencée : on prévient avant de quitter la page
    noterVolume(unites(ex));
    if (!juste && !opts.sansMemoireErreurs) await noterErreurColonne(ex); // à rejouer demain
    if (!juste && reponse !== null && !opts.sansMemoireErreurs) {
      const typeErreur = typeErreurOperation(ex, reponse);
      if (typeErreur) await noterErreurOperation(typeErreur, String(ex.type).startsWith('div'));
    }
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}`, title: juste ? 'juste' : `faux (${valeur(ex, ex.resultat)})` }, juste ? '✓' : '✗'));

    const t = tempsParUnite(ex, dureeMs);
    if (!opts.defi && !opts.sansMemoireErreurs && ex.type === 'addsub' && !ex.flash) {
      const med = durees.length >= 5 ? [...durees].sort((a, b) => a - b)[Math.floor(durees.length / 2)] : null;
      if (med && dureeMs >= 2.5 * med && dureeMs - med >= 5000) {
        if (ex.revu) await signalerLenteur(ex); // encore lent la 2e fois : le geste fragile reviendra plus souvent
        else aRevoir.push({ ex: { ...ex }, a: i + 10 });
      }
      durees.push(dureeMs);
    }
    // Régularité, par blocs de 10 colonnes justes : signalée seulement si elle se confirme.
    if (juste && ex.type === 'addsub' && !ex.flash && !aideUtilisee) {
      blocRythme.push(t);
      if (blocRythme.length >= 10) {
        if (await noterRythme(scoreRythme(blocRythme.splice(0)))) notifier('Le rythme', MESSAGE_RYTHME, 15000);
      }
    }
    // Gestes : une réussite crédite chaque geste de l'exercice ; une erreur n'accuse un geste que
    // si le résultat le prouve (sinon l'élève peut désigner la ligne lui-même).
    const localisation = juste ? null : localiserErreur(ex, reponse);
    const bilanGestes = ex.motifs && !aideUtilisee ? await noterGestes(juste ? ex.motifs : [], localisation?.motifs ?? [], t) : [];
    await noterReponse(juste);
    await opts.surExercice?.({ juste, reponse, dureeMs, t, aide: aideUtilisee }, ex, i);
    majDiag();

    const temps = h('span', { class: 'discret' }, ` · ${formaterDuree(dureeMs)}`);
    if (objectifCourant) {
      temps.append(dureeMs / 1000 <= objectifCourant.s
        ? h('span', { class: 'objectif tenu' }, ` · objectif tenu (${objectifCourant.nom})`)
        : ` · objectif ${formaterDuree(objectifCourant.s * 1000)}`);
    }
    if (juste) {
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${valeur(ex, ex.resultat)}`, temps, course ? course.ecart(resultats.length, performance.now() - debut) : null);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 900);
      return;
    }
    if (opts.defi && opts.pauseErreur) {
      // Mini-test, révision : l'erreur reste affichée jusqu'à Entrée, le temps de regarder son
      // soroban (les explications détaillées restent pour la fin, comme à un examen).
      retour.className = 'retour erreur';
      remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Faux : le résultat est `, h('strong', {}, attenduTexte(ex)),
        '. Regardez votre soroban : où a-t-il divergé ? Vous reverrez ce calcul à la fin.'),
        h('div', { class: 'ligne', style: 'margin-top:8px' }, h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
      phase = 'corrige';
      attribue = true;
      return;
    }
    if (opts.defi) {
      retour.className = 'retour erreur';
      remplir(retour, h('span', { class: 'grand-signe' }, '✗'), ` Faux (résultat ${attenduTexte(ex)}) : vous le reverrez à la fin.`, course ? course.ecart(resultats.length, performance.now() - debut) : null);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 900);
      return;
    }
    phase = 'corrige';
    // Une erreur seulement soupçonnée peut encore être confirmée en désignant la ligne.
    attribue = bilanGestes.some((g) => g.statut === 'confirme');
    const causes = diagnostiquer(ex, reponse);
    const zoneLocalisation = h('div', { class: 'localisation' });
    zoneLocalisationCourante = zoneLocalisation;
    if (localisation) {
      remplir(zoneLocalisation, h('strong', {}, 'Erreur probable : '),
        `ligne ${localisation.ligne + 1}, ${localisation.raison} (${localisation.motifs.map(nomMotif).join(', ')}). C'est une déduction à partir de l'écart. `,
        attribue ? 'Deuxième fois en 10 jours : ce geste est noté à retravailler.'
          : 'Simple soupçon pour l\'instant : le geste ne sera noté à retravailler que si cela se reproduit dans les 10 jours, ou si vous confirmez la ligne avec les sous-totaux (S).');
    } else if (ex.type === 'addsub' && !ex.ticket) {
      remplir(zoneLocalisation, h('span', { class: 'discret' },
        'Pour un diagnostic juste, refaites la colonne en comparant avec les sous-totaux (S), puis cliquez la ligne où votre soroban a divergé. Sinon, aucun geste n\'est accusé.'));
    }
    retour.className = 'retour erreur';
    remplir(retour, 
      ex.attendu && reponse === ex.resultat
        // Table : le bon produit, mais pas écrit sur deux chiffres. On ne dit pas « 8, le résultat est 8 ».
        ? h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Le produit est juste, mais il s'écrit sur deux chiffres : `, h('strong', {}, ex.attendu), ` (la tige des dizaines compte, même vide).`)
        : h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Vous avez trouvé ${valeur(ex, reponse)}, le résultat est `, h('strong', {}, attenduTexte(ex)), '.'),
      ex.type === 'photo' ? h('div', {}, h('div', { class: 'discret' }, 'Le soroban montrait :'), rendreEnonce(ex, { compact: true })) : null,
      causes.length ? h('ul', { class: 'detail' }, causes.map((c) => h('li', {}, c))) : null,
      zoneLocalisation,
      h('div', { class: 'ligne', style: 'margin-top:8px' },
        ex.type === 'addsub' ? h('button', { class: 'btn', onclick: () => basculerSousTotaux() }, 'Sous-totaux ', h('kbd', {}, 'S')) : null,
        explicable(ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer ', h('kbd', {}, 'E')) : null,
        h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
  }

  /** Mode Espace : on arrête le chrono et on montre le résultat ; l'élève compare avec son soroban. */
  /**
   * Mode Espace : Espace arrête le chrono dès que le soroban est fini ; on tape ensuite ce qu'il
   * montre, sans voir le résultat (la frappe ne compte pas dans le temps). La réponse est corrigée
   * comme les autres : elle compte pour le niveau et le diagnostic des gestes.
   */
  function reveler() {
    if (phase !== 'question' || flashEnCours || espaceArrete) return;
    dureeCalcul ??= performance.now() - debutExercice;
    majChronoExo(dureeCalcul);
    espaceArrete = true;
    saisie.style.display = '';
    btnValider.style.display = '';
    saisie.value = '';
    retour.className = 'retour';
    remplir(retour, h('strong', {}, 'Chrono arrêté. '), 'Tapez le nombre que montre votre soroban, puis Entrée.');
    saisie.focus();
  }

  async function autoEvaluer(juste) {
    if (phase !== 'auto') return;
    phase = 'traitement';
    const dureeMs = dureeCalcul;
    resultats.push({ ex, reponse: null, juste, dureeMs, aide: aideUtilisee, autoEvalue: true });
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
    await noterReponse(juste);
    // Auto-évalué : volume oui, niveau et diagnostic des gestes non.
    await opts.surExercice?.({ juste, reponse: null, dureeMs, t: tempsParUnite(ex, dureeMs), aide: aideUtilisee, autoEvalue: true }, ex, i);
    if (juste) {
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ex.type === 'tenir' ? ' Image nette.' : ` ${formaterDuree(dureeMs)}`);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 700);
      return;
    }
    phase = 'corrige';
    retour.className = 'retour erreur';
    remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ex.type === 'tenir'
      ? ' Pas grave : la prochaine fois, posez la céleste d\'abord, puis les terrestres, et gardez les doigts actifs.'
      : [' Résultat attendu : ', h('strong', {}, valeur(ex, ex.resultat)), '.']),
      h('div', { class: 'ligne', style: 'margin-top:8px' },
        ex.type === 'addsub' ? h('button', { class: 'btn', onclick: () => basculerSousTotaux() }, 'Sous-totaux ', h('kbd', {}, 'S')) : null,
        explicable(ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer ', h('kbd', {}, 'E')) : null,
        h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
  }

  /** L'élève désigne la ligne où son soroban a divergé : on note les gestes de cette ligne. */
  async function designerLigne(ligne) {
    if (attribue || phase !== 'corrige') return;
    attribue = true;
    const motifs = motifsDeLigne(ex, ligne);
    await noterGestes([], motifs, tempsParUnite(ex, resultats.at(-1).dureeMs), { confirme: true });
    majDiag();
    remplir(zoneLocalisationCourante, h('strong', {}, `Ligne ${ligne + 1} : `),
      motifs.length ? `${motifs.map(nomMotif).join(', ')} noté${motifs.length > 1 ? 's' : ''} à retravailler.` : 'noté.');
    afficherEnonce();
  }

  function basculerSousTotaux() {
    if (ex?.type !== 'addsub') return;
    sousTotauxVisibles = !sousTotauxVisibles;
    afficherEnonce();
  }

  function terminer() {
    // Calculs longs pas encore revus : ils ressortiront à la prochaine séance (« À revoir »).
    for (const x of aRevoir.splice(0)) noterErreurColonne(x.ex);
    phase = 'fin';
    delete racine.dataset.enCours;
    clearInterval(minuterie);
    saisie.disabled = true;
    btnValider.disabled = true;
    const justes = resultats.filter((r) => r.juste).length;
    opts.surFin?.({ justes, total: resultats.length, dureeMs: performance.now() - debut, resultats });
  }

  const sansRaccourcis = raccourcis({
    Enter: () => valider(),
    s: () => (phase === 'corrige' ? basculerSousTotaux() : false),
    S: () => (phase === 'corrige' ? basculerSousTotaux() : false),
    e: () => (phase === 'corrige' && explicable(ex) ? ouvrirExplication(ex) : false),
    b: () => (phase === 'question' && btnBloque.style.display !== 'none' && !saisie.value ? aideSuivante() : false),
    ' ': () => (phase === 'question' && modeEspace() ? reveler() : false),
    o: () => (phase === 'auto' ? autoEvaluer(true) : false),
    O: () => (phase === 'auto' ? autoEvaluer(true) : false),
    n: () => (phase === 'auto' ? autoEvaluer(false) : false),
    N: () => (phase === 'auto' ? autoEvaluer(false) : false),
    E: () => (phase === 'corrige' && explicable(ex) ? ouvrirExplication(ex) : false),
  });

  majDiag();
  suivant();

  return {
    /** Arrête la série tout de suite (bilan via surFin), ex. quand le temps de l'arcade est écoulé. */
    terminer() { if (phase !== 'fin') { clearTimeout(timer); terminer(); } },
    detruire() {
      phase = 'fin';
      clearTimeout(timer);
      clearInterval(minuterie);
      sansRaccourcis();
      racine.remove();
    },
  };
}

/** Liste de révision des erreurs, à afficher dans un bilan (avec bouton Expliquer). */
/**
 * Revue ciblée des erreurs, en fin de série (mini-test, révision, défi, examen…). Pour chaque
 * colonne fausse : la colonne avec ses sous-totaux, la ligne probable surlignée (déduite de
 * l'écart), « Revoir ce geste » (animation) ; on peut aussi cliquer la ligne où son soroban a
 * divergé, ce qui CONFIRME l'erreur sur ce geste. En bas : 5 colonnes tout de suite sur le geste
 * le plus souvent en cause.
 */
export function listeErreurs(resultats) {
  const erreurs = resultats.filter((r) => !r.juste);
  if (!erreurs.length) return null;
  const enCause = {};
  const cartes = erreurs.map((r) => {
    const colonne = r.ex.type === 'addsub' && !r.ex.ticket && !r.ex.flash && r.reponse !== null && r.reponse !== undefined;
    if (!colonne) {
      return h('div', { class: 'carte erreur-item' },
        rendreEnonce(r.ex, { compact: true }),
        r.ex.type === 'tenir' ? h('div', {}, 'Image à retravailler') : h('div', {}, r.reponse == null ? 'Auto-évalué · résultat : ' : `Votre réponse : ${valeur(r.ex, r.reponse)} · résultat : `, h('strong', {}, attenduTexte(r.ex))),
        r.reponse == null ? null : h('ul', { class: 'detail' }, diagnostiquer(r.ex, r.reponse).map((c) => h('li', {}, c))),
        explicable(r.ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(r.ex) }, 'Expliquer') : null);
    }
    const loc = localiserErreur(r.ex, r.reponse);
    for (const m of loc?.motifs ?? []) if (!m.endsWith(':direct')) enCause[m] = (enCause[m] ?? 0) + 1;
    const message = h('div', { class: 'discret' }, loc
      ? `Ligne ${loc.ligne + 1} probable (${loc.raison}). Si votre soroban a divergé ailleurs, cliquez la bonne ligne.`
      : 'Refaites la colonne en suivant les sous-totaux, puis cliquez la ligne où votre soroban a divergé.');
    let designee = false;
    const zoneColonne = h('div', {});
    const dessiner = (ligneVue) => remplir(zoneColonne, rendreEnonce(r.ex, {
      compact: true, sousTotaux: true, surligne: ligneVue,
      surLigne: designee ? null : async (i) => {
        designee = true;
        const motifs = motifsDeLigne(r.ex, i);
        await noterGestes([], motifs, r.dureeMs ? tempsParUnite(r.ex, r.dureeMs) : 1, { confirme: true });
        remplir(message, h('strong', {}, `Ligne ${i + 1} : `), motifs.length ? `${motifs.map(nomMotif).join(', ')} noté${motifs.length > 1 ? 's' : ''} à retravailler.` : 'geste direct, rien à noter.');
        dessiner(i);
      },
    }));
    dessiner(loc?.ligne ?? null);
    return h('div', { class: 'carte erreur-item' },
      h('div', {}, `Votre réponse : ${valeur(r.ex, r.reponse)} · résultat : `, h('strong', {}, attenduTexte(r.ex))),
      zoneColonne, message,
      h('div', { class: 'ligne', style: 'margin-top:6px' },
        (loc?.motifs ?? []).filter((m) => !m.endsWith(':direct')).map((m) => h('button', { class: 'btn', onclick: () => ouvrirDemo({ titre: nomMotif(m), texte: gesteMotif(m), demo: exempleMotif(m) }) }, `Revoir : ${nomMotif(m)}`)),
        explicable(r.ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(r.ex) }, 'Expliquer') : null));
  });
  const principal = Object.entries(enCause).sort((a, b) => b[1] - a[1])[0]?.[0];
  return h('div', { class: 'revue-erreurs' }, h('h2', {}, 'Revue de vos erreurs'),
    h('p', { class: 'discret' }, 'Prenez une minute : refaites chaque colonne sur votre soroban en suivant les sous-totaux, pour voir où il a divergé.'),
    h('div', { class: 'liste-erreurs' }, cartes),
    principal ? h('div', { class: 'carte suggestion ligne' },
      h('span', { style: 'flex:1' }, `Le geste le plus souvent en cause : `, h('strong', {}, nomMotif(principal)), '. Le meilleur moment pour le corriger, c\'est maintenant.'),
      h('button', { class: 'btn principal', onclick: () => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['planches', { cible: principal, auto: true, colonnes: 5, chiffres: 1 }] })) }, `5 colonnes sur ce geste maintenant`)) : null);
}
