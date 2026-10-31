/**
 * Anzan (calcul mental avec un soroban imaginaire), quatre modes :
 *  - Flash : les nombres défilent un par un ;
 *  - Flash avec image : chaque nombre est aussi montré en boules (étape visuelle intermédiaire) ;
 *  - Mitori-anzan : la colonne reste affichée, on la calcule de tête, sans défilement ;
 *  - Multiplication de tête : petites multiplications (2 × 1 chiffres, puis 3 × 1).
 *
 * Les colonnes ne contiennent que les gestes déjà appris (comme partout dans l'application),
 * avec les soustractions en option.
 */

import { genererColonne } from '../core/generateur.js';
import { genererMultiplication } from '../core/multiplication.js';
import { famille } from '../core/motifs.js';
import { motifsAppris } from '../core/parcours.js';
import { progression, enregistrerSession, noterReponse } from '../core/progression.js';
import { lireReponse } from '../core/nombres.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { rendreEnonce } from '../ui/enonce.js';
import { h, raccourcis, formaterNombre, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { mode: 'flash', chiffres: 1, termes: 5, duree: 1, questions: 10, soustractions: false, mulChiffres: 2 };
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const DUREES = [2, 1.5, 1, 0.7, 0.5, 0.3];

/** Colonne d'anzan : gestes appris seulement, soustractions en option. */
function colonne(chiffres, termes, soustractions) {
  const appris = motifsAppris(progression());
  const ops = soustractions ? ['+', '-'] : ['+'];
  const amis = [...appris].filter((c) => !c.endsWith(':direct') && ops.includes(c[0]));
  const cibles = amis.length ? amis : famille('direct').filter((c) => ops.includes(c[0]));
  try {
    return genererColonne({ chiffres, lignes: termes, autorises: appris, cibles, ops });
  } catch {
    return genererColonne({ chiffres, lignes: termes, autorises: null, cibles: famille('direct').filter((c) => ops.includes(c[0])), ops });
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
    el.append(h('h1', {}, 'Anzan'),
      h('p', { class: 'discret' }, 'Calcul mental avec un soroban imaginaire : voyez les boules bouger, et faites les gestes avec les doigts dans l\'air. Progression conseillée : flash avec image, puis flash, puis réduire le temps d\'affichage ; le mitori-anzan entraîne sans le stress du défilement.'),
      zoneReglages, zone);

    function afficherReglages() {
      const mode = select('mode', [['image', 'Flash avec image'], ['flash', 'Flash'], ['mitori', 'Mitori-anzan (colonne fixe)'], ['mul', 'Multiplication de tête']], String);
      const elements = [mode];
      if (reglages.mode === 'mul') elements.push(select('mulChiffres', [[2, '2 × 1 chiffres'], [3, '3 × 1 chiffres']]));
      else {
        elements.push(select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres'], [4, '4 chiffres']]),
          select('termes', [3, 4, 5, 7, 10, 15].map((n) => [n, `${n} nombres`])));
        if (reglages.mode !== 'mitori') elements.push(select('duree', DUREES.map((d) => [d, `${d.toLocaleString('fr-FR')} s par nombre`])));
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
      if (r.mode === 'mitori' || r.mode === 'mul') {
        // Colonne fixe ou multiplication : une série classique, calculée de tête.
        const serie = creerSerie(zone, {
          generer: () => (r.mode === 'mul' ? genererMultiplication(r.mulChiffres, 1) : { ...colonne(r.chiffres, r.termes, r.soustractions), motifs: undefined }),
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
        zone.prepend(h('p', { class: 'consigne' }, 'De tête, sans toucher le soroban : imaginez-le.'));
        nettoyerMode = () => serie.detruire();
        return;
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
      const retour = h('div', { class: 'retour' });
      const pastilles = h('div', { class: 'pastilles' });
      zone.append(h('div', { class: 'ligne' }, pastilles), ecran, r.mode === 'image' ? zoneImage : '', h('div', { class: 'ligne' }, saisie, btn), retour);
      let vue = null;
      let sorobanImage = null;
      if (r.mode === 'image') {
        sorobanImage = new Soroban(r.chiffres + 2);
        vue = new SorobanVue(zoneImage, sorobanImage, { interactif: false });
      }
      const majBouton = (t) => { remplir(btn, t, ' ', h('kbd', {}, 'Entrée')); btn.style.display = t ? '' : 'none'; };

      async function defiler() {
        etat = 'flash';
        majBouton('');
        saisie.style.display = 'none';
        remplir(retour);
        question = colonne(r.chiffres, r.termes, r.soustractions);
        for (const t of ['3', '2', '1']) { ecran.textContent = t; ecran.classList.add('decompte'); await attendre(400); if (!actif) return; }
        ecran.classList.remove('decompte');
        for (const l of question.lignes) {
          ecran.textContent = `${l.op === '-' ? '−' : ''}${formaterNombre(l.n)}`;
          sorobanImage?.definirValeur(l.n);
          await attendre(r.duree * 850);
          ecran.textContent = '';
          sorobanImage?.effacer();
          await attendre(r.duree * 150);
          if (!actif) return;
        }
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
          const conseil = serie.justes === serie.index
            ? (r.mode === 'image' ? 'Parfait : passez au flash sans image.' : 'Parfait : réduisez le temps d\'affichage ou ajoutez des nombres.')
            : serie.justes / serie.index < 0.7 ? 'Allongez un peu le temps d\'affichage, ou repassez par le flash avec image.' : 'Encore une série au même niveau.';
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
