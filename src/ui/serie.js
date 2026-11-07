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

import { diagnostiquer, localiserErreur, motifsDeLigne } from '../core/diagnostic.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { tempsParUnite, tempsCible, unites, SURCOUT_S, MIN_ESSAIS } from '../core/maitrise.js';
import { lireReponse, egal } from '../core/nombres.js';
import { aideDivision } from '../core/multiplication.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from './sorobanVue.js';
import { motifsEnDifficulte, noterGestes, noterReponse, reglagesUtilisateur, modifierReglages } from '../core/progression.js';
import { rendreEnonce, formaterValeur as valeur } from './enonce.js';
import { creerCourse } from './course.js';
import { sousTotaux } from '../core/generateur.js';

/** Un exercice qui a une explication pas à pas (pas les exercices de visualisation). */
const explicable = (ex) => !['photo', 'tenir', 'quotidien'].includes(ex.type) && !ex.negatif;
import { ouvrirExplication } from './explication.js';
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
  const choixEspace = h('label', { class: 'mode-espace', title: 'Espace arrête le chrono et montre le résultat ; vous répondez O ou N. Compte pour le volume, pas pour le niveau.' },
    caseEspace, ' Mains sur le soroban (Espace)');
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
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), opts.defi ? null : choixDoigte, opts.defi ? null : choixEspace, fantome, chrono, compteur),
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
  // Exercices de tête (flash, photo, image) : pas de mode Espace, on répond au clavier.
  const modeEspace = () => caseEspace.checked && !opts.defi && !ex?.flash;
  function majModeEspace() {
    choixEspace.style.display = ex?.flash ? 'none' : '';
    choixDoigte.style.display = ex?.type !== 'addsub' || ex?.flash || ex?.decimales || ex?.negatif || opts.doigteMasque?.() ? 'none' : '';
    const sansSaisie = modeEspace() || ex?.type === 'tenir';
    saisie.style.display = sansSaisie ? 'none' : '';
    btnSigne.style.display = !sansSaisie && ex?.negatif ? '' : 'none';
    btnValider.style.display = sansSaisie ? 'none' : '';
    if (phase === 'question') remplir(retour, h('span', { class: 'discret' }, ex?.flash ? '' : modeEspace() ? 'Calculez sur votre soroban, puis Espace pour voir le résultat.' : 'Calculez sur votre soroban, tapez le résultat, puis Entrée.'));
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
    ex = opts.generer();
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
    const ecran = h('div', { class: 'flash-ecran' });
    const zoneImage = h('div', { class: 'flash-image' });
    const opacite = exo.flash.photo ? 1 : Number(exo.flash.image) || 0;
    // Photo : le soroban s'affiche DANS l'écran (à la place du nombre) ; anzan : sous le nombre.
    if (exo.flash.photo) remplir(zoneEnonce, ecran);
    else remplir(zoneEnonce, ecran, opacite > 0 ? zoneImage : null);
    zoneImage.style.opacity = String(opacite);
    const totaux = exo.lignes ? sousTotaux(exo.lignes) : [exo.n];
    const sorobanImage = opacite > 0 ? new Soroban(Math.max(exo.flash.photo ? 2 : 3, String(Math.max(...totaux.map(Math.abs))).length + 1)) : null;
    const vueImage = sorobanImage ? new SorobanVue(zoneImage, sorobanImage, { interactif: false }) : null;
    const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const interrompu = () => ex !== exo || phase === 'fin';
    for (const t of ['3', '2', '1']) { ecran.textContent = t; ecran.classList.add('decompte'); await attendre(350); }
    ecran.classList.remove('decompte');
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
      for (let k = 0; k < exo.lignes.length; k++) {
        const l = exo.lignes[k];
        if (interrompu()) return;
        ecran.textContent = `${l.op === '-' ? '−' : ''}${formaterNombre(l.n)}`;
        // L'image suit le total, sans s'effacer entre deux nombres.
        sorobanImage?.definirValeur(totaux[k]);
        await attendre(exo.flash.duree * 850);
        ecran.textContent = '';
        await attendre(exo.flash.duree * 150);
      }
      vueImage?.detruire();
      remplir(zoneEnonce, ecran);
    }
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
    racine.dataset.enCours = '1'; // une série commencée : on prévient avant de quitter la page
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}`, title: juste ? 'juste' : `faux (${valeur(ex, ex.resultat)})` }, juste ? '✓' : '✗'));

    const t = tempsParUnite(ex, dureeMs);
    // Gestes : une réussite crédite chaque geste de l'exercice ; une erreur n'accuse un geste que
    // si le résultat le prouve (sinon l'élève peut désigner la ligne lui-même).
    const localisation = juste ? null : localiserErreur(ex, reponse);
    if (ex.motifs && !aideUtilisee) await noterGestes(juste ? ex.motifs : [], localisation?.motifs ?? [], t);
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
      remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Faux : le résultat est `, h('strong', {}, valeur(ex, ex.resultat)),
        '. Regardez votre soroban : où a-t-il divergé ? Vous reverrez ce calcul à la fin.'),
        h('div', { class: 'ligne', style: 'margin-top:8px' }, h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
      phase = 'corrige';
      attribue = true;
      return;
    }
    if (opts.defi) {
      retour.className = 'retour erreur';
      remplir(retour, h('span', { class: 'grand-signe' }, '✗'), ` Faux (résultat ${valeur(ex, ex.resultat)}) : vous le reverrez à la fin.`, course ? course.ecart(resultats.length, performance.now() - debut) : null);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 900);
      return;
    }
    phase = 'corrige';
    attribue = !!localisation;
    const causes = diagnostiquer(ex, reponse);
    const zoneLocalisation = h('div', { class: 'localisation' });
    zoneLocalisationCourante = zoneLocalisation;
    if (localisation) {
      remplir(zoneLocalisation, h('strong', {}, 'Erreur probable : '),
        `ligne ${localisation.ligne + 1}, ${localisation.raison} (${localisation.motifs.map(nomMotif).join(', ')}). C'est une déduction à partir de l'écart : si ce n'est pas là que votre soroban a divergé, refaites la colonne avec les sous-totaux. Ce geste est noté à retravailler.`);
    } else if (ex.type === 'addsub' && !ex.ticket) {
      remplir(zoneLocalisation, h('span', { class: 'discret' },
        'Pour un diagnostic juste, refaites la colonne en comparant avec les sous-totaux (S), puis cliquez la ligne où votre soroban a divergé. Sinon, aucun geste n\'est accusé.'));
    }
    retour.className = 'retour erreur';
    remplir(retour, 
      h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Vous avez trouvé ${valeur(ex, reponse)}, le résultat est `, h('strong', {}, valeur(ex, ex.resultat)), '.'),
      ex.type === 'photo' ? h('div', {}, h('div', { class: 'discret' }, 'Le soroban montrait :'), rendreEnonce(ex, { compact: true })) : null,
      causes.length ? h('ul', { class: 'detail' }, causes.map((c) => h('li', {}, c))) : null,
      zoneLocalisation,
      h('div', { class: 'ligne', style: 'margin-top:8px' },
        ex.type === 'addsub' ? h('button', { class: 'btn', onclick: () => basculerSousTotaux() }, 'Sous-totaux ', h('kbd', {}, 'S')) : null,
        explicable(ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer ', h('kbd', {}, 'E')) : null,
        h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
  }

  /** Mode Espace : on arrête le chrono et on montre le résultat ; l'élève compare avec son soroban. */
  function reveler() {
    if (phase !== 'question' || flashEnCours) return;
    dureeCalcul ??= performance.now() - debutExercice;
    majChronoExo(dureeCalcul);
    phase = 'auto';
    retour.className = 'retour';
    remplir(retour, 'Résultat : ', h('strong', { class: 'resultat-drill' }, valeur(ex, ex.resultat)), '. Votre soroban affiche-t-il ce nombre ? ',
      h('button', { class: 'btn ok-btn', onclick: () => autoEvaluer(true) }, 'Oui ', h('kbd', {}, 'O')), ' ',
      h('button', { class: 'btn ko-btn', onclick: () => autoEvaluer(false) }, 'Non ', h('kbd', {}, 'N')));
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
    await noterGestes([], motifs, tempsParUnite(ex, resultats.at(-1).dureeMs));
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
export function listeErreurs(resultats) {
  const erreurs = resultats.filter((r) => !r.juste);
  if (!erreurs.length) return null;
  return h('div', {}, h('h2', {}, 'À revoir'),
    h('div', { class: 'liste-erreurs' }, erreurs.map((r) => h('div', { class: 'carte erreur-item' },
      rendreEnonce(r.ex, { compact: true }),
      r.ex.type === 'tenir' ? h('div', {}, 'Image à retravailler') : h('div', {}, r.reponse === null ? 'Auto-évalué · résultat : ' : `Votre réponse : ${valeur(r.ex, r.reponse)} · résultat : `, h('strong', {}, valeur(r.ex, r.ex.resultat))),
      r.reponse === null ? null : h('ul', { class: 'detail' }, diagnostiquer(r.ex, r.reponse).map((c) => h('li', {}, c))),
      explicable(r.ex) ? h('button', { class: 'btn', onclick: () => ouvrirExplication(r.ex) }, 'Expliquer') : null))));
}
