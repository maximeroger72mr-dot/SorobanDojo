/**
 * Série d'exercices, un par un, à calculer sur son propre soroban.
 *
 * L'élève lit l'énoncé, calcule sur son soroban, tape le résultat et valide (Entrée).
 * Le retour reste affiché : ✓ / ✗, le bon résultat, les causes probables d'erreur,
 * et deux aides : les sous-totaux (pour retrouver sur son soroban où l'écart est apparu)
 * et « Expliquer » (démonstration animée). Une bande de pastilles garde la trace de la série.
 *
 * Mode défi : pas d'arrêt sur les erreurs (on les revoit à la fin), chronomètre en continu.
 */

import { diagnostiquer, localiserErreur, motifsDeLigne } from '../core/diagnostic.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { tempsParUnite, tempsCible } from '../core/maitrise.js';
import { motifsEnDifficulte, noterGestes } from '../core/progression.js';
import { rendreEnonce } from './enonce.js';
import { ouvrirExplication } from './explication.js';
import { ouvrirDemo } from './panneauDemo.js';
import { h, raccourcis, formaterDuree, formaterNombre } from './dom.js';

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
 * @param {(res, ex, i) => any} [o.surExercice]
 * @param {(bilan) => void} [o.surFin]      { justes, total, dureeMs, resultats: [{ex, reponse, juste, dureeMs}] }
 * @param {(i) => string} [o.compteur]
 */
export function creerSerie(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, filtreDiagnostic: null, evaluation: null, ...o };
  const zoneEnonce = h('div', { class: 'zone-enonce' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Résultat', 'aria-label': 'Résultat' });
  const btnValider = h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const chronoExo = h('div', { class: 'chrono-exercice' });
  const pastilles = h('div', { class: 'pastilles' });
  const retour = h('div', { class: 'retour' });
  const zoneDiag = h('div', {});
  const racine = h('div', { class: 'serie' },
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), chrono, compteur),
    h('div', { class: 'disposition-enonce' }, zoneEnonce, chronoExo),
    h('div', { class: 'ligne' }, saisie, btnValider),
    retour, zoneDiag);
  conteneur.append(racine);

  let i = 0;
  let ex = null;
  let debutExercice = 0;
  let phase = 'question'; // 'question' | 'corrige' | 'fin'
  let sousTotauxVisibles = false;
  let attribue = false;
  let zoneLocalisationCourante = null;
  let timer = null;
  const debut = performance.now();
  const resultats = [];

  const majChrono = () => {
    if (opts.chrono) chrono.textContent = formaterDuree(performance.now() - debut);
    if (phase === 'question') majChronoExo(performance.now() - debutExercice);
  };
  const minuterie = setInterval(majChrono, 100);

  /** Objectif de temps pour l'exercice courant : le niveau suivant de l'élève (ou null). */
  function objectif() {
    const ev = opts.evaluation?.();
    const niveau = ev?.prochain?.temps ? ev.prochain : ev?.niveau?.temps ? ev.niveau : null;
    return niveau ? { nom: niveau.nom, s: tempsCible(ex, niveau) } : null;
  }
  let objectifCourant = null;
  function majChronoExo(ms) {
    chronoExo.replaceChildren(
      h('div', { class: 'temps' }, formaterDuree(ms)),
      objectifCourant ? h('div', { class: `objectif${ms / 1000 <= objectifCourant.s ? ' tenu' : ''}` }, `objectif « ${objectifCourant.nom} » : ${formaterDuree(objectifCourant.s * 1000)}`) : null);
  }
  const afficherEnonce = () => zoneEnonce.replaceChildren(rendreEnonce(ex, {
    sousTotaux: sousTotauxVisibles,
    // Après une erreur, les lignes deviennent cliquables pour désigner où le soroban a divergé.
    surLigne: sousTotauxVisibles && phase === 'corrige' && !attribue ? (l) => designerLigne(l) : null,
  }));
  const majDiag = () => zoneDiag.replaceChildren(encadreDiagnostic(opts.filtreDiagnostic) ?? '');

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre) { terminer(); return; }
    ex = opts.generer();
    sousTotauxVisibles = false;
    phase = 'question';
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
    objectifCourant = objectif();
    afficherEnonce();
    retour.className = 'retour';
    retour.replaceChildren(h('span', { class: 'discret' }, 'Calculez sur votre soroban, tapez le résultat, puis Entrée.'));
    saisie.value = '';
    saisie.disabled = false;
    btnValider.disabled = false;
    saisie.focus();
    debutExercice = performance.now();
  }

  async function valider() {
    if (phase === 'corrige') { i += 1; suivant(); return; }
    if (phase !== 'question') return;
    const brut = saisie.value.replace(/[\s.]/g, '');
    if (!/^\d+$/.test(brut)) { saisie.focus(); return; }
    const reponse = Number(brut);
    const juste = reponse === ex.resultat;
    const dureeMs = performance.now() - debutExercice;
    phase = 'traitement';
    saisie.disabled = true;
    majChronoExo(dureeMs);
    resultats.push({ ex, reponse, juste, dureeMs });
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}`, title: juste ? 'juste' : `faux (${formaterNombre(ex.resultat)})` }, juste ? '✓' : '✗'));

    const t = tempsParUnite(ex, dureeMs);
    // Gestes : une réussite crédite chaque geste de l'exercice ; une erreur n'accuse un geste que
    // si le résultat le prouve (sinon l'élève peut désigner la ligne lui-même).
    const localisation = juste ? null : localiserErreur(ex, reponse);
    if (ex.motifs) await noterGestes(juste ? ex.motifs : [], localisation?.motifs ?? [], t);
    await opts.surExercice?.({ juste, reponse, dureeMs, t }, ex, i);
    majDiag();

    const temps = h('span', { class: 'discret' }, ` · ${formaterDuree(dureeMs)}`);
    if (objectifCourant) {
      temps.append(dureeMs / 1000 <= objectifCourant.s
        ? h('span', { class: 'objectif tenu' }, ` · objectif « ${objectifCourant.nom} » tenu`)
        : ` · objectif ${formaterDuree(objectifCourant.s * 1000)}`);
    }
    if (juste) {
      retour.className = 'retour ok';
      retour.replaceChildren(h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${formaterNombre(ex.resultat)}`, temps);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 900);
      return;
    }
    if (opts.defi) {
      retour.className = 'retour erreur';
      retour.replaceChildren(h('span', { class: 'grand-signe' }, '✗'), ` Faux (résultat ${formaterNombre(ex.resultat)}) : vous le reverrez à la fin.`);
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
      zoneLocalisation.replaceChildren(h('strong', {}, 'Erreur localisée : '),
        `ligne ${localisation.ligne + 1}, ${localisation.raison} (${localisation.motifs.map(nomMotif).join(', ')}). Ce geste est noté à retravailler.`);
    } else if (ex.type === 'addsub') {
      zoneLocalisation.replaceChildren(h('span', { class: 'discret' },
        'Pour un diagnostic juste, refaites la colonne en comparant avec les sous-totaux (S), puis cliquez la ligne où votre soroban a divergé. Sinon, aucun geste n\'est accusé.'));
    }
    retour.className = 'retour erreur';
    retour.replaceChildren(
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
    zoneLocalisationCourante?.replaceChildren(h('strong', {}, `Ligne ${ligne + 1} : `),
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
