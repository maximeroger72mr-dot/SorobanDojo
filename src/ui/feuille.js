/**
 * Feuille d'exercices : tous les problèmes affichés d'un coup, comme une feuille d'examen ou
 * une page de cahier. L'élève calcule chaque problème sur son soroban et inscrit le résultat
 * dans la case. « Corriger » (ou la fin du temps imparti) note la feuille.
 *
 * La feuille peut être IMPRIMÉE pour travailler loin de l'écran : le corrigé est imprimé
 * sur une page séparée.
 */

import { diagnostiquer } from '../core/diagnostic.js';
import { rendreEnonce } from './enonce.js';
import { ouvrirExplication } from './explication.js';
import { h, formaterDuree, formaterNombre } from './dom.js';

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {string} o.titre
 * @param {Array<{titre?:string, points?:number, problemes:Array}>} o.sections
 * @param {number|null} [o.minutes]  limite de temps (compte à rebours), ou null (chronomètre)
 * @param {(bilan) => any} [o.surFin]  { justes, total, points, pointsMax, parSection, dureeMs, resultats }
 */
export function creerFeuille(conteneur, o) {
  const limiteMs = o.minutes ? o.minutes * 60000 : null;
  const chrono = h('span', { class: 'chrono-feuille' });
  const btnCorriger = h('button', { class: 'btn principal', onclick: () => corriger() }, 'Corriger');
  const btnImprimer = h('button', { class: 'btn', onclick: () => window.print() }, 'Imprimer');
  const bilan = h('div', {});
  const cases = []; // { ex, input, carte, section }
  let numero = 0;

  const sectionsEl = o.sections.map((sec, si) => h('section', { class: 'section-feuille' },
    sec.titre ? h('h2', {}, sec.titre, sec.points ? h('span', { class: 'discret' }, ` · ${sec.points} point${sec.points > 1 ? 's' : ''} par problème`) : null) : null,
    h('div', { class: `grille-feuille ${sec.problemes[0]?.type === 'addsub' ? 'colonnes' : 'operations'}` },
      sec.problemes.map((ex) => {
        numero += 1;
        const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': `Réponse ${numero}` });
        const carte = h('div', { class: 'probleme' }, h('div', { class: 'num-probleme' }, numero), rendreEnonce(ex, { compact: true }), input);
        cases.push({ ex, input, carte, section: si });
        return carte;
      }))));

  const corrige = h('div', { class: 'corrige-impression' }, h('h2', {}, `Corrigé · ${o.titre}`),
    h('ol', {}, cases.map((c) => h('li', {}, formaterNombre(c.ex.resultat)))));

  const racine = h('div', { class: 'feuille' },
    h('div', { class: 'barre-feuille' }, h('strong', {}, o.titre), h('span', { style: 'flex:1' }), chrono, btnImprimer, btnCorriger),
    sectionsEl, bilan, corrige);
  conteneur.append(racine);

  // Entrée passe à la case suivante (comme sur une feuille, on enchaîne).
  cases.forEach((c, i) => c.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    (cases[i + 1]?.input ?? btnCorriger).focus();
  }));
  cases[0]?.input.focus();

  const debut = performance.now();
  let fini = false;
  const tic = () => {
    const ecoule = performance.now() - debut;
    if (limiteMs) {
      const reste = Math.max(0, limiteMs - ecoule);
      const min = Math.floor(reste / 60000);
      const sec = Math.floor((reste % 60000) / 1000);
      chrono.textContent = `Temps restant ${min}:${String(sec).padStart(2, '0')}`;
      chrono.classList.toggle('urgent', reste < 60000);
      if (reste === 0) corriger();
    } else {
      chrono.textContent = formaterDuree(ecoule);
    }
  };
  const minuterie = setInterval(tic, 250);
  tic();

  function corriger() {
    if (fini) return;
    fini = true;
    clearInterval(minuterie);
    const dureeMs = Math.min(performance.now() - debut, limiteMs ?? Infinity);
    btnCorriger.disabled = true;
    const resultats = cases.map((c) => {
      const brut = c.input.value.replace(/[\s.]/g, '');
      const reponse = /^\d+$/.test(brut) ? Number(brut) : null;
      const juste = reponse === c.ex.resultat;
      c.input.disabled = true;
      c.carte.classList.add(juste ? 'ok' : 'ko');
      if (!juste) {
        const causes = reponse === null ? [] : diagnostiquer(c.ex, reponse);
        c.carte.append(h('div', { class: 'correction' },
          h('div', {}, 'Résultat : ', h('strong', {}, formaterNombre(c.ex.resultat))),
          causes[0] ? h('div', { class: 'discret' }, causes[0]) : null,
          h('button', { class: 'lien', onclick: () => ouvrirExplication(c.ex) }, 'Expliquer')));
      }
      return { ex: c.ex, reponse, juste, section: c.section };
    });
    const parSection = o.sections.map((sec, si) => {
      const r = resultats.filter((x) => x.section === si);
      const justes = r.filter((x) => x.juste).length;
      return { titre: sec.titre, justes, total: r.length, points: justes * (sec.points ?? 1), pointsMax: r.length * (sec.points ?? 1) };
    });
    const b = {
      justes: resultats.filter((r) => r.juste).length,
      total: resultats.length,
      points: parSection.reduce((s, x) => s + x.points, 0),
      pointsMax: parSection.reduce((s, x) => s + x.pointsMax, 0),
      parSection,
      dureeMs,
      resultats,
    };
    const contenu = o.surFin?.(b);
    if (contenu) bilan.replaceChildren(contenu);
    bilan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return {
    corriger,
    detruire() {
      fini = true;
      clearInterval(minuterie);
      racine.remove();
    },
  };
}
