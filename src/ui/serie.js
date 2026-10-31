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

import { diagnostiquer } from '../core/diagnostic.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { motifsEnDifficulte, noterMotifs } from '../core/progression.js';
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

/** Motifs à créditer ou débiter pour un exercice (seulement les amis travaillés). */
function motifsConcernes(ex, cibles) {
  if (!ex.motifs) return [];
  return [...new Set(ex.motifs.filter((m) => (cibles ? cibles.includes(m) : !m.endsWith(':direct'))))];
}

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {() => object} o.generer
 * @param {number} [o.nombre=Infinity]
 * @param {boolean} [o.chrono=false]
 * @param {boolean} [o.defi=false]          enchaîne sans s'arrêter sur les erreurs
 * @param {string[]|null} [o.cibles]        motifs suivis par le diagnostic (null : tous les amis)
 * @param {Set<string>|null} [o.filtreDiagnostic]
 * @param {(res, ex, i) => any} [o.surExercice]
 * @param {(bilan) => void} [o.surFin]      { justes, total, dureeMs, resultats: [{ex, reponse, juste, dureeMs}] }
 * @param {(i) => string} [o.compteur]
 */
export function creerSerie(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, cibles: null, filtreDiagnostic: null, ...o };
  const zoneEnonce = h('div', { class: 'zone-enonce' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Résultat', 'aria-label': 'Résultat' });
  const btnValider = h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const pastilles = h('div', { class: 'pastilles' });
  const retour = h('div', { class: 'retour' });
  const zoneDiag = h('div', {});
  const racine = h('div', { class: 'serie' },
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), chrono, compteur),
    zoneEnonce,
    h('div', { class: 'ligne' }, saisie, btnValider),
    retour, zoneDiag);
  conteneur.append(racine);

  let i = 0;
  let ex = null;
  let debutExercice = 0;
  let phase = 'question'; // 'question' | 'corrige' | 'fin'
  let sousTotauxVisibles = false;
  let timer = null;
  const debut = performance.now();
  const resultats = [];

  const majChrono = () => { chrono.textContent = formaterDuree(performance.now() - debut); };
  const minuterie = opts.chrono ? setInterval(majChrono, 100) : null;
  const afficherEnonce = () => zoneEnonce.replaceChildren(rendreEnonce(ex, { sousTotaux: sousTotauxVisibles }));
  const majDiag = () => zoneDiag.replaceChildren(encadreDiagnostic(opts.filtreDiagnostic) ?? '');

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre) { terminer(); return; }
    ex = opts.generer();
    sousTotauxVisibles = false;
    phase = 'question';
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
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
    resultats.push({ ex, reponse, juste, dureeMs });
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}`, title: juste ? 'juste' : `faux (${formaterNombre(ex.resultat)})` }, juste ? '✓' : '✗'));

    const concernes = motifsConcernes(ex, opts.cibles);
    if (concernes.length) await noterMotifs(juste ? concernes : [], juste ? [] : concernes);
    await opts.surExercice?.({ juste, reponse, dureeMs }, ex, i);
    majDiag();

    if (juste) {
      retour.className = 'retour ok';
      retour.replaceChildren(h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${formaterNombre(ex.resultat)}`,
        h('span', { class: 'discret' }, ` · ${formaterDuree(dureeMs)}`));
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
    const causes = diagnostiquer(ex, reponse);
    retour.className = 'retour erreur';
    retour.replaceChildren(
      h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Vous avez trouvé ${formaterNombre(reponse)}, le résultat est `, h('strong', {}, formaterNombre(ex.resultat)), '.'),
      causes.length ? h('ul', { class: 'detail' }, causes.map((c) => h('li', {}, c))) : null,
      h('div', { class: 'ligne', style: 'margin-top:8px' },
        ex.type === 'addsub' ? h('button', { class: 'btn', onclick: () => basculerSousTotaux() }, 'Sous-totaux ', h('kbd', {}, 'S')) : null,
        h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer ', h('kbd', {}, 'E')),
        h('button', { class: 'btn principal', onclick: () => valider() }, 'Suivant ', h('kbd', {}, 'Entrée'))));
  }

  function basculerSousTotaux() {
    if (ex?.type !== 'addsub') return;
    sousTotauxVisibles = !sousTotauxVisibles;
    afficherEnonce();
  }

  function terminer() {
    phase = 'fin';
    if (minuterie) clearInterval(minuterie);
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
      if (minuterie) clearInterval(minuterie);
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
