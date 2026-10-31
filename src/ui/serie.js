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
 * Exercice en flash (anzan) : les nombres s'affichent un par un, puis le chrono démarre.
 * Division par 2 chiffres ou plus : bouton « Je suis bloqué » (estimation pas à pas, table du diviseur).
 */

import { diagnostiquer, localiserErreur, motifsDeLigne } from '../core/diagnostic.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { tempsParUnite, tempsCible, unites, SURCOUT_S, MIN_ESSAIS } from '../core/maitrise.js';
import { lireReponse, egal } from '../core/nombres.js';
import { aideDivision } from '../core/multiplication.js';
import { motifsEnDifficulte, noterGestes, noterReponse } from '../core/progression.js';
import { rendreEnonce } from './enonce.js';
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
 * @param {{msParExercice:number}|null} [o.fantome]  rythme du record : « course contre son fantôme »
 * @param {(res, ex, i) => any} [o.surExercice]
 * @param {(bilan) => void} [o.surFin]      { justes, total, dureeMs, resultats: [{ex, reponse, juste, dureeMs}] }
 * @param {(i) => string} [o.compteur]
 */
export function creerSerie(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, filtreDiagnostic: null, evaluation: null, fantome: null, ...o };
  const zoneEnonce = h('div', { class: 'zone-enonce' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Résultat', 'aria-label': 'Résultat' });
  const btnValider = h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
  const btnBloque = h('button', { class: 'btn', style: 'display:none', onclick: () => aideSuivante() }, 'Je suis bloqué ', h('kbd', {}, 'B'));
  const zoneAide = h('div', { class: 'aide-division' });
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const fantome = h('span', { class: 'compteur fantome' });
  const chronoExo = h('div', { class: 'chrono-exercice' });
  const pastilles = h('div', { class: 'pastilles' });
  const retour = h('div', { class: 'retour' });
  const zoneDiag = h('div', {});
  const racine = h('div', { class: 'serie' },
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), fantome, chrono, compteur),
    h('div', { class: 'disposition-enonce' }, zoneEnonce, chronoExo),
    h('div', { class: 'ligne' }, saisie, btnValider, btnBloque),
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
  let zoneLocalisationCourante = null;
  let timer = null;
  const debut = performance.now();
  const resultats = [];

  const majChrono = () => {
    const ecoule = performance.now() - debut;
    if (opts.chrono) chrono.textContent = formaterDuree(ecoule);
    if (opts.fantome && phase !== 'fin') {
      // Où en serait votre record à ce moment ? (on ne se mesure qu'à soi-même)
      const k = Math.min(opts.nombre, Math.floor(ecoule / opts.fantome.msParExercice));
      fantome.textContent = `fantôme : ${k} / ${opts.nombre}`;
      fantome.classList.toggle('devant', k < resultats.length);
    }
    if (phase === 'question' && dureeCalcul === null && !flashEnCours) majChronoExo(performance.now() - debutExercice);
  };
  const minuterie = setInterval(majChrono, 100);

  /**
   * Objectif de temps de l'exercice courant : battre sa médiane récente (petites marches) ;
   * tant qu'il n'y a pas assez d'essais, le seuil du niveau suivant.
   */
  function objectif() {
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
    // Après une erreur, les lignes deviennent cliquables pour désigner où le soroban a divergé.
    surLigne: sousTotauxVisibles && phase === 'corrige' && !attribue ? (l) => designerLigne(l) : null,
  }));
  const majDiag = () => remplir(zoneDiag, encadreDiagnostic(opts.filtreDiagnostic) ?? '');

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre) { terminer(); return; }
    ex = opts.generer();
    sousTotauxVisibles = false;
    phase = 'question';
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
    objectifCourant = objectif();
    dureeCalcul = null;
    aideUtilisee = false;
    aide = null;
    remplir(zoneAide);
    btnBloque.style.display = ex.type === 'div' && ex.b >= 10 && !ex.arrondi ? '' : 'none';
    afficherEnonce();
    retour.className = 'retour';
    remplir(retour, h('span', { class: 'discret' }, 'Calculez sur votre soroban, tapez le résultat, puis Entrée.'));
    saisie.value = '';
    saisie.disabled = false;
    btnValider.disabled = false;
    btnBloque.disabled = false;
    saisie.inputMode = ex.decimales ? 'decimal' : 'numeric';
    debutExercice = performance.now();
    if (ex.flash) jouerFlash(ex);
    else saisie.focus();
  }

  /** Anzan : montre les nombres un par un, puis lance le chronomètre. */
  async function jouerFlash(exo) {
    flashEnCours = true;
    saisie.disabled = true;
    btnValider.disabled = true;
    const ecran = h('div', { class: 'flash-ecran' });
    remplir(zoneEnonce, ecran);
    const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
    for (const t of ['3', '2', '1']) { ecran.textContent = t; ecran.classList.add('decompte'); await attendre(350); }
    ecran.classList.remove('decompte');
    for (const l of exo.lignes) {
      if (ex !== exo || phase === 'fin') return;
      ecran.textContent = `${l.op === '-' ? '−' : ''}${formaterNombre(l.n)}`;
      await attendre(exo.flash.duree * 850);
      ecran.textContent = '';
      await attendre(exo.flash.duree * 150);
    }
    if (ex !== exo || phase === 'fin') return;
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
    if (reponse === null) { saisie.focus(); return; }
    const juste = egal(reponse, ex.resultat, ex.decimales ?? 0);
    // Temps de calcul : jusqu'à la première touche (la frappe n'est pas comptée).
    const dureeMs = dureeCalcul ?? performance.now() - debutExercice;
    phase = 'traitement';
    saisie.disabled = true;
    majChronoExo(dureeMs);
    resultats.push({ ex, reponse, juste, dureeMs, aide: aideUtilisee });
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}`, title: juste ? 'juste' : `faux (${formaterNombre(ex.resultat)})` }, juste ? '✓' : '✗'));

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
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${formaterNombre(ex.resultat)}`, temps);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 900);
      return;
    }
    if (opts.defi) {
      retour.className = 'retour erreur';
      remplir(retour, h('span', { class: 'grand-signe' }, '✗'), ` Faux (résultat ${formaterNombre(ex.resultat)}) : vous le reverrez à la fin.`);
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
      remplir(zoneLocalisation, h('strong', {}, 'Erreur localisée : '),
        `ligne ${localisation.ligne + 1}, ${localisation.raison} (${localisation.motifs.map(nomMotif).join(', ')}). Ce geste est noté à retravailler.`);
    } else if (ex.type === 'addsub') {
      remplir(zoneLocalisation, h('span', { class: 'discret' },
        'Pour un diagnostic juste, refaites la colonne en comparant avec les sous-totaux (S), puis cliquez la ligne où votre soroban a divergé. Sinon, aucun geste n\'est accusé.'));
    }
    retour.className = 'retour erreur';
    remplir(retour, 
      h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Vous avez trouvé ${formaterNombre(reponse)}, le résultat est `, h('strong', {}, formaterNombre(ex.resultat)), '.'),
      causes.length ? h('ul', { class: 'detail' }, causes.map((c) => h('li', {}, c))) : null,
      zoneLocalisation,
      h('div', { class: 'ligne', style: 'margin-top:8px' },
        ex.type === 'addsub' ? h('button', { class: 'btn', onclick: () => basculerSousTotaux() }, 'Sous-totaux ', h('kbd', {}, 'S')) : null,
        h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer ', h('kbd', {}, 'E')),
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
    e: () => (phase === 'corrige' ? ouvrirExplication(ex) : false),
    b: () => (phase === 'question' && btnBloque.style.display !== 'none' && !saisie.value ? aideSuivante() : false),
    E: () => (phase === 'corrige' ? ouvrirExplication(ex) : false),
  });

  majDiag();
  suivant();

  return {
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
      h('div', {}, `Votre réponse : ${formaterNombre(r.reponse)} · résultat : `, h('strong', {}, formaterNombre(r.ex.resultat))),
      h('ul', { class: 'detail' }, diagnostiquer(r.ex, r.reponse).map((c) => h('li', {}, c))),
      h('button', { class: 'btn', onclick: () => ouvrirExplication(r.ex) }, 'Expliquer')))));
}
