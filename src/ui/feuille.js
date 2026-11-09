/**
 * Feuille d'exercices : tous les problèmes affichés d'un coup, comme une feuille d'examen ou
 * une page de cahier. L'élève calcule chaque problème sur son soroban et inscrit le résultat
 * dans la case. « Corriger » (ou la fin du temps imparti) note la feuille.
 *
 * La feuille peut être IMPRIMÉE pour travailler loin de l'écran : le corrigé est imprimé
 * sur une page séparée.
 */

import { diagnostiquer } from '../core/diagnostic.js';
import { noterErreurColonne, noterFeuille, noterVolume } from '../core/progression.js';
import { NIVEAUX, unites, familleTemps, formaterTemps, formaterCadence, SURCOUT_FEUILLE_S } from '../core/maitrise.js';
import { lireReponse, egal } from '../core/nombres.js';
import { rendreEnonce } from './enonce.js';
import { ouvrirExplication } from './explication.js';
import { h, formaterDuree, formaterNombre, remplir } from './dom.js';

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {string} o.titre
 * @param {Array<{titre?:string, points?:number, problemes:Array}>} o.sections
 * @param {number|null} [o.minutes]  limite de temps (compte à rebours), ou null (chronomètre)
 * @param {(bilan) => any} [o.surFin]  { justes, total, points, pointsMax, parSection, dureeMs, resultats }
 * @param {boolean} [o.doigte]  rappel doigté à côté de chaque ligne des colonnes
 * @param {{cle: string, libelle: string}} [o.historique]  type de feuille, pour suivre ses résultats
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
        const input = h('input', { type: 'text', inputmode: ex.decimales ? 'decimal' : 'numeric', autocomplete: 'off', 'aria-label': `Réponse ${numero}` });
        const carte = h('div', { class: 'probleme' }, h('div', { class: 'num-probleme' }, numero), rendreEnonce(ex, { compact: true, doigte: !!o.doigte }), input);
        cases.push({ ex, input, carte, section: si });
        return carte;
      }))));

  const corrige = h('div', { class: 'corrige-impression' }, h('h2', {}, `Corrigé · ${o.titre}`),
    h('ol', {}, cases.map((c) => h('li', {}, formaterNombre(c.ex.resultat)))));

  const racine = h('div', { class: 'feuille' },
    h('div', { class: 'barre-feuille' }, h('strong', {}, o.titre), h('span', { style: 'flex:1' }), chrono, btnImprimer, btnCorriger),
    sectionsEl, bilan, corrige);
  conteneur.append(racine);
  racine.dataset.enCours = '1'; // feuille en cours : on prévient avant de quitter la page

  // Entrée passe à la case suivante (comme sur une feuille, on enchaîne) ; sur la DERNIÈRE case,
  // Entrée corrige la feuille et arrête le chrono tout de suite.
  cases.forEach((c, i) => c.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (cases[i + 1]) cases[i + 1].input.focus();
    else corriger();
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
    delete racine.dataset.enCours;
    clearInterval(minuterie);
    const dureeMs = Math.min(performance.now() - debut, limiteMs ?? Infinity);
    btnCorriger.disabled = true;
    const resultats = cases.map((c) => {
      const reponse = lireReponse(c.input.value, c.ex.decimales ?? 0);
      const juste = egal(reponse, c.ex.resultat, c.ex.decimales ?? 0);
      c.input.disabled = true;
      c.carte.classList.add(juste ? 'ok' : 'ko');
      if (!juste) {
        const causes = reponse === null ? [] : diagnostiquer(c.ex, reponse);
        c.carte.append(h('div', { class: 'correction' },
          h('div', {}, 'Résultat : ', h('strong', {}, formaterNombre(c.ex.resultat))),
          causes[0] ? h('div', { class: 'discret' }, causes[0]) : null,
          h('button', { class: 'lien', onclick: () => ouvrirExplication(c.ex) }, 'Expliquer')));
      }
      if (!juste && reponse !== null) noterErreurColonne(c.ex); // à rejouer demain
      if (reponse !== null) noterVolume(unites(c.ex));
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
    if (contenu) remplir(bilan, contenu);
    // Vitesse de la feuille : la référence de toute l'application (secondes par chiffre, temps de
    // lecture et d'écriture de chaque réponse déduit), colorée selon le niveau atteint.
    if (!limiteMs) bilan.prepend(vitesseFeuille(b));
    bilan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function vitesseFeuille(b) {
    const familles = new Set(cases.map((c) => familleTemps(c.ex)));
    const famille = familles.size === 1 ? [...familles][0] : 'addsub';
    const total = cases.reduce((s, c) => s + unites(c.ex), 0);
    const t = Math.max(0.1, (b.dureeMs / 1000 - cases.length * SURCOUT_FEUILLE_S) / Math.max(1, total));
    const taux = b.total ? b.justes / b.total : 0;
    const niveau = [...NIVEAUX].reverse().find((n) => n.temps && t <= n.temps[famille] && taux >= n.reussite) ?? NIVEAUX[1];
    const metal = { progres: 'bronze', debutant: 'argent', confirme: 'or', expert: 'platine' }[niveau.id];
    const ligne = h('div', { class: `vitesse-feuille vf-${niveau.id}` },
      h('strong', {}, formaterCadence(t, famille)), h('span', { class: 'discret' }, ` (${formaterTemps(t)} par ${famille === 'muldiv' ? 'produit' : 'chiffre'})`),
      ` · ${niveau.id === 'progres' ? 'en progrès' : niveau.nom}${metal ? ` (${metal})` : ''}`);
    if (o.historique) {
      noterFeuille({ ...o.historique, t, justes: b.justes, total: b.total }).then(({ moyenne, nombre }) => {
        if (moyenne === null) { ligne.append(h('span', { class: 'discret' }, ' · première feuille de ce type')); return; }
        const ecart = (t - moyenne) / moyenne;
        ligne.append(h('span', {}, ` · votre moyenne sur ce type : ${formaterCadence(moyenne, famille)} (${nombre} feuille${nombre > 1 ? 's' : ''})${Math.abs(ecart) < 0.03 ? ', comme d\'habitude' : ecart < 0 ? `, ${Math.round(-ecart * 100)} % plus rapide` : `, ${Math.round(ecart * 100)} % plus lent`}`));
      });
    }
    return ligne;
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
