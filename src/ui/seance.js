/**
 * Séance d'exercices sur le soroban : composant commun aux leçons (entraînement, mini-test),
 * aux révisions et aux planches.
 *
 * Il affiche l'énoncé, le soroban, les retours, le chronomètre, et l'encadré
 * « Diagnostic & Remédiation ». Il enchaîne les exercices produits par `generer()`
 * et prévient l'écran appelant à chaque exercice terminé et à la fin.
 */

import { Soroban } from '../core/soroban.js';
import { nomMotif, gesteMotif, exempleMotif } from '../core/motifs.js';
import { motifsEnDifficulte, noterMotifs } from '../core/progression.js';
import { SorobanVue } from './sorobanVue.js';
import { ExerciceSoroban } from './exercice.js';
import { ouvrirDemo } from './panneauDemo.js';
import { h, raccourcis, formaterDuree, formaterNombre } from './dom.js';

const signe = (op) => (op === '+' ? '+' : '−');

/** Énoncé en ligne : « 3 + 4 − 2 », le terme en cours est souligné. */
export function enonceEnLigne(ex, terme) {
  return h('div', { class: 'enonce' },
    h('span', { class: 'fait' }, formaterNombre(ex.depart)),
    ex.termes.map((t, i) => h('span', { class: i < terme ? 'fait' : i === terme ? 'courant' : '' },
      ` ${signe(t.op)} ${formaterNombre(t.n)}`)));
}

/** Énoncé en colonne (planche) : la première ligne est posée, les suivantes ont un signe. */
export function enonceEnColonne(ex, terme) {
  return h('table', { class: 'planche' }, ex.termes.map((t, i) => h('tr', {
    class: i < terme ? 'fait' : i === terme ? 'courant' : '',
  }, h('td', { class: 'num' }, i + 1), h('td', { class: 'signe' }, i === 0 ? '' : signe(t.op)), h('td', {}, formaterNombre(t.n)))));
}

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
      h('div', {}, h('strong', {}, nomMotif(m.cle)), h('span', { class: 'discret' }, ` · ${m.erreurs} erreur${m.erreurs > 1 ? 's' : ''} sur ${m.essais} essai${m.essais > 1 ? 's' : ''} · apparaît plus souvent jusqu'à consolidation`)),
      h('div', {}, gesteMotif(m.cle)),
      h('button', { class: 'btn', onclick: () => ouvrirDemo({ titre: nomMotif(m.cle), texte: gesteMotif(m.cle), demo: exempleMotif(m.cle) }) }, 'Voir le geste'))));
}

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {number} o.nbTiges
 * @param {() => object} o.generer          fabrique l'exercice suivant
 * @param {number} [o.nombre=Infinity]      nombre d'exercices de la séance
 * @param {boolean} [o.indices=true]        bouton « Indice »
 * @param {boolean} [o.verifierGestes=true]
 * @param {boolean} [o.chrono=false]
 * @param {boolean} [o.colonne=false]       énoncé en colonne (planche)
 * @param {boolean} [o.pauseSiJuste=false]  attendre Entrée même après une réussite
 * @param {Set<string>|null} [o.motifsSuivis] motifs concernés par l'encadré de diagnostic
 * @param {(res, ex, index) => any} [o.surExercice]  après chaque exercice
 * @param {(bilan) => void} [o.surFin]      fin de séance { justes, total, dureeMs, resultats }
 * @param {(index) => string} [o.compteur]  texte du compteur
 */
export function creerSeance(conteneur, o) {
  const opts = { nombre: Infinity, indices: true, verifierGestes: true, chrono: false, colonne: false, motifsSuivis: null, ...o };
  const zoneEnonce = h('div', { class: 'zone-enonce' });
  const zoneSoroban = h('div', { class: 'zone-soroban' });
  const btnIndice = h('button', { class: 'btn', onclick: () => indice() }, 'Indice ', h('kbd', {}, 'H'));
  const btnValider = h('button', { class: 'btn principal', onclick: () => exo.valider() }, 'J\'ai fini ', h('kbd', {}, 'Entrée'));
  const btnEffacer = h('button', { class: 'btn', onclick: () => soroban.effacer('eleve') }, 'Effacer ', h('kbd', {}, 'Échap'));
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const retour = h('div', { class: 'retour' });
  const zoneDiag = h('div', {});
  if (!opts.indices) btnIndice.style.display = 'none';
  if (opts.verifierGestes) { btnValider.style.display = 'none'; btnEffacer.style.display = 'none'; }

  const disposition = opts.colonne
    ? h('div', { class: 'disposition-colonne' }, zoneEnonce, h('div', { style: 'flex:1;min-width:0' }, zoneSoroban))
    : h('div', {}, zoneEnonce, zoneSoroban);
  const racine = h('div', { class: 'seance' },
    disposition,
    h('div', { class: 'ligne' }, btnIndice, btnEffacer, btnValider, h('span', { style: 'flex:1' }), chrono, compteur),
    retour, zoneDiag);
  conteneur.append(racine);

  const soroban = new Soroban(opts.nbTiges);
  const vue = new SorobanVue(zoneSoroban, soroban, { interactif: false, etiquettes: true });
  let exercice = null;
  let attenteEntree = null; // fonction à appeler sur Entrée après une correction
  let arret = false;
  const debutSeance = performance.now();
  const resultats = [];

  const afficherEnonce = (terme) => {
    zoneEnonce.replaceChildren((opts.colonne ? enonceEnColonne : enonceEnLigne)(exercice, terme));
  };

  const exo = new ExerciceSoroban({
    soroban,
    vue,
    verifierGestes: opts.verifierGestes,
    surTerme: (i) => afficherEnonce(i),
    // Un geste juste efface le message d'erreur ou d'indice précédent.
    surBonGeste: () => { retour.className = 'retour'; retour.replaceChildren(); },
    surErreur: ({ etape }) => {
      retour.className = 'retour erreur';
      retour.replaceChildren(h('strong', {}, 'Ce n\'est pas ce geste. '), h('span', { class: 'detail' }, etape?.texte ?? ''),
        h('div', { class: 'discret' }, 'Le mouvement a été annulé ; les boules à déplacer sont en bleu.'));
    },
  });

  function indice() {
    const etape = exo.indice();
    if (!etape) return;
    retour.className = 'retour';
    retour.replaceChildren(h('strong', {}, 'Indice : '), etape.texte);
  }

  const majChrono = () => { chrono.textContent = formaterDuree(performance.now() - debutSeance); };
  const minuterie = opts.chrono ? setInterval(majChrono, 100) : null;

  async function boucle() {
    for (let i = 0; i < opts.nombre && !arret; i++) {
      compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
      exercice = opts.generer();
      retour.className = 'retour';
      retour.replaceChildren(opts.verifierGestes ? '' : 'Calculez sur le soroban, puis appuyez sur Entrée.');
      const res = await exo.lancer(exercice);
      if (res.interrompu || arret) return;
      resultats.push(res);
      if (opts.verifierGestes) {
        const reussis = res.motifs.filter((m) => !res.motifsRates.includes(m));
        await noterMotifs(reussis, res.motifsRates);
      }
      afficherEnonce(exercice.termes.length);
      await opts.surExercice?.(res, exercice, i);

      const correction = [];
      if (res.juste) {
        retour.className = 'retour ok';
        retour.textContent = `Juste : ${formaterNombre(exercice.resultat)}.`;
      } else {
        retour.className = 'retour erreur';
        if (opts.verifierGestes) {
          correction.push(`Résultat ${formaterNombre(exercice.resultat)}, avec ${res.motifsRates.length > 1 ? 'des erreurs de geste' : 'une erreur de geste'} : `,
            res.motifsRates.map(nomMotif).join(', '), '.');
        } else {
          correction.push(`Le soroban affiche ${formaterNombre(soroban.valeur())}, le résultat est ${formaterNombre(exercice.resultat)}.`);
        }
        retour.replaceChildren(...correction, h('div', { class: 'discret' }, 'Entrée pour continuer.'));
      }
      zoneDiag.replaceChildren(encadreDiagnostic(opts.motifsSuivis) ?? '');

      const derniere = i === opts.nombre - 1;
      if (!res.juste || opts.pauseSiJuste) {
        await new Promise((ok) => { attenteEntree = ok; });
      } else if (!derniere) {
        await new Promise((ok) => setTimeout(ok, 650));
      }
      if (arret) return;
    }
    if (minuterie) clearInterval(minuterie);
    const justes = resultats.filter((r) => r.juste).length;
    opts.surFin?.({ justes, total: resultats.length, dureeMs: performance.now() - debutSeance, resultats });
  }

  const sansRaccourcis = raccourcis({
    Enter: () => {
      if (attenteEntree) { const f = attenteEntree; attenteEntree = null; f(); return; }
      if (!opts.verifierGestes) exo.valider();
    },
    h: () => { if (opts.indices) indice(); },
    H: () => { if (opts.indices) indice(); },
    Escape: () => { if (!opts.verifierGestes) soroban.effacer('eleve'); },
  });

  zoneDiag.replaceChildren(encadreDiagnostic(opts.motifsSuivis) ?? '');
  boucle();

  return {
    detruire() {
      arret = true;
      attenteEntree?.();
      if (minuterie) clearInterval(minuterie);
      sansRaccourcis();
      exo.detruire();
      vue.detruire();
      racine.remove();
    },
  };
}
