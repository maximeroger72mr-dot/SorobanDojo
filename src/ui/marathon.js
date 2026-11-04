/**
 * Marathon ruban : une seule longue colonne, par tranches de 5 lignes, SANS remettre le soroban
 * à zéro. Après chaque tranche, on tape le sous-total ; s'il est juste, 5 nouvelles lignes
 * continuent à partir de ce nombre, déjà posé sur le soroban.
 *
 * Intérêt : on ne lâche pas le soroban, et les retenues tombent sur des tiges déjà chargées
 * (plus jamais de 1re ligne facile posée sur un soroban vide). Ciblé sur un geste, c'est le
 * drill d'automatisation : 30 à 50 lignes du même mouvement.
 *
 * Une erreur consomme le joker (on remet le soroban sur le bon sous-total et on continue) ;
 * une deuxième erreur arrête le marathon. Le chrono (discret) s'arrête à la première touche de
 * chaque sous-total, comme partout.
 */

import { genererColonneVariee, genererTerme, creerMemoire, ErreurGeneration } from '../core/generateur.js';
import { localiserErreur } from '../core/diagnostic.js';
import { tempsParUnite } from '../core/maitrise.js';
import { noterGestes, noterReponse, poidsAdaptatifs } from '../core/progression.js';
import { lireReponse } from '../core/nombres.js';
import { creerCourse } from './course.js';
import { doigte } from './drill.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from './dom.js';

export const TRANCHE = 5;

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {{ autorises: Set|null, cibles: string[], libelle: string }} o.contraintes
 * @param {number} o.chiffres
 * @param {number} o.objectif         lignes à tenir (Infinity : jusqu'à l'erreur)
 * @param {number|null} o.recordMs    temps du record pour cet objectif (fantôme)
 * @param {boolean} [o.doigte]        rappel doigté à côté des lignes
 * @param {(bilan) => any} o.surFin   { lignes, dureeMs, complet, jokerUtilise, resultats }
 */
export function creerMarathon(conteneur, o) {
  const c = o.contraintes;
  const memoire = creerMemoire(6);
  let valeur = 0;
  let lignesTenues = 0;
  let joker = 1;
  let dureeTotale = 0;
  let debutTranche = 0;
  let dureeTranche = null;
  let tranche = null; // { lignes, motifs, resultat, depart }
  let phase = 'question';
  const resultats = [];
  const vus = {};

  const compteur = h('strong', {});
  const infoJoker = h('span', { class: 'discret' });
  const chrono = h('span', { class: 'chrono-discret' });
  const course = o.recordMs && Number.isFinite(o.objectif) ? creerCourse({ total: o.objectif, msParUnite: o.recordMs / o.objectif, nom: 'votre record' }) : null;
  const zoneLignes = h('div', {});
  const consigne = h('p', { class: 'ruban-consigne' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Sous-total', 'aria-label': 'Sous-total' });
  const retour = h('div', { class: 'retour' });
  const racine = h('div', { class: 'marathon' },
    h('div', { class: 'ruban-entete' }, compteur, infoJoker, h('span', { style: 'flex:1' }), chrono),
    course?.el ?? null, consigne, zoneLignes,
    h('div', { class: 'ligne' }, saisie, h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'))),
    retour);
  conteneur.append(racine);

  saisie.addEventListener('input', () => {
    if (phase === 'question' && dureeTranche === null && saisie.value.trim()) dureeTranche = performance.now() - debutTranche;
  });
  const ecoule = () => dureeTotale + (phase === 'question' ? (dureeTranche ?? performance.now() - debutTranche) : 0);
  const minuterie = setInterval(() => {
    chrono.textContent = formaterDuree(ecoule());
    course?.maj(lignesTenues, ecoule());
  }, 100);

  /** 5 lignes de plus, à partir de la valeur posée (la 1re tranche part de zéro). */
  function genererTranche() {
    if (valeur === 0 && lignesTenues === 0) {
      const col = genererColonneVariee({ chiffres: o.chiffres, lignes: TRANCHE, autorises: c.autorises, cibles: c.cibles, poids: poidsAdaptatifs(c.cibles) }, memoire);
      return { lignes: col.lignes, motifs: col.motifs, resultat: col.resultat, depart: 0 };
    }
    const lignes = [];
    const motifs = [];
    let v = valeur;
    const poids = poidsAdaptatifs(c.cibles);
    while (lignes.length < TRANCHE) {
      const poidsLigne = Object.fromEntries(c.cibles.map((k) => [k, (poids[k] ?? 1) / (1 + (vus[k] ?? 0) % 6) ** 2]));
      let t;
      try {
        t = genererTerme(v, { chiffres: o.chiffres, autorises: c.autorises, cibles: c.cibles, poids: poidsLigne });
      } catch (e) {
        if (!(e instanceof ErreurGeneration)) throw e;
        // Coincé (rare) : une ligne avec les gestes appris pour débloquer la valeur.
        t = genererTerme(v, { chiffres: o.chiffres, autorises: null, cibles: null });
      }
      t.motifs.forEach((m) => { vus[m] = (vus[m] ?? 0) + 1; });
      lignes.push({ op: t.op, n: t.n });
      motifs.push(...t.motifs);
      v = t.resultat;
    }
    return { lignes, motifs, resultat: v, depart: valeur };
  }

  function afficherTranche() {
    const premiere = tranche.depart === 0 && lignesTenues === 0;
    remplir(zoneLignes, h('table', { class: 'colonne' }, tranche.lignes.map((l, i) => h('tr', {},
      h('td', { class: 'signe' }, premiere && i === 0 ? '' : l.op === '+' ? '+' : '−'),
      h('td', { class: 'nombre' }, formaterNombre(l.n)),
      o.doigte ? h('td', { class: 'doigte' }, '') : null))));
    consigne.textContent = premiere
      ? 'Soroban à zéro : posez la 1re ligne, calculez les 5 lignes, tapez le sous-total. Ensuite, on continue sans jamais remettre à zéro.'
      : 'Continuez sur le soroban tel qu\'il est (sans remettre à zéro), puis tapez le nouveau sous-total.';
  }

  function suivante() {
    if (lignesTenues >= o.objectif) { terminer(true); return; }
    tranche = genererTranche();
    phase = 'question';
    dureeTranche = null;
    saisie.value = '';
    saisie.disabled = false;
    remplir(retour);
    compteur.textContent = `${lignesTenues}${Number.isFinite(o.objectif) ? ` / ${o.objectif}` : ''} lignes`;
    infoJoker.textContent = joker ? '· 1 joker' : '· plus de joker';
    afficherTranche();
    if (o.doigte) remplirDoigte();
    debutTranche = performance.now();
    saisie.focus();
  }

  /** Rappel doigté de la tranche (calculé depuis la valeur de départ). */
  function remplirDoigte() {
    let v = tranche.depart;
    const cases = zoneLignes.querySelectorAll('td.doigte');
    tranche.lignes.forEach((l, i) => {
      const premiere = tranche.depart === 0 && lignesTenues === 0 && i === 0;
      if (cases[i]) cases[i].textContent = premiere ? 'poser' : doigte(v, l.op, l.n).join(' / ');
      v = l.op === '+' ? v + l.n : v - l.n;
    });
  }

  async function valider() {
    if (phase === 'corrige') { suivante(); return; }
    if (phase !== 'question') return;
    const rep = lireReponse(saisie.value);
    if (rep === null) return;
    const ms = dureeTranche ?? performance.now() - debutTranche;
    phase = 'traitement';
    saisie.disabled = true;
    dureeTotale += ms;
    const ex = { type: 'addsub', lignes: tranche.depart === 0 && lignesTenues === 0 ? tranche.lignes : [{ op: '+', n: tranche.depart }, ...tranche.lignes], resultat: tranche.resultat };
    const juste = rep === tranche.resultat;
    const t = tempsParUnite({ type: 'addsub', lignes: tranche.lignes }, ms);
    resultats.push({ ex, reponse: rep, juste, dureeMs: ms });
    await noterReponse(juste);
    if (juste) {
      await noterGestes(tranche.motifs, [], t);
      lignesTenues += TRANCHE;
      valeur = tranche.resultat;
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` ${formaterNombre(valeur)} : on continue.`, course ? course.ecart(lignesTenues, dureeTotale) : null);
      phase = 'transition';
      setTimeout(() => { if (phase === 'transition') suivante(); }, 700);
      return;
    }
    const loc = localiserErreur(ex, rep);
    await noterGestes([], loc?.motifs ?? [], t);
    valeur = tranche.resultat;
    retour.className = 'retour erreur';
    if (joker) {
      joker -= 1;
      lignesTenues += TRANCHE;
      phase = 'corrige';
      remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ' Vous avez trouvé ', formaterNombre(rep), ', le sous-total est ', h('strong', {}, formaterNombre(valeur)), '.'),
        loc ? h('div', { class: 'discret' }, `Ligne ${loc.ligne + (ex.lignes.length > TRANCHE ? 0 : 1)} : ${loc.raison}.`) : null,
        h('div', {}, 'Joker utilisé : remettez votre soroban sur ', h('strong', {}, formaterNombre(valeur)), ', puis Entrée pour continuer.'));
      return;
    }
    remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ' Vous avez trouvé ', formaterNombre(rep), ', le sous-total était ', h('strong', {}, formaterNombre(valeur)), '. Fin du marathon.'));
    phase = 'transition';
    setTimeout(() => terminer(false), 1600);
  }

  function terminer(complet) {
    phase = 'fin';
    clearInterval(minuterie);
    saisie.disabled = true;
    o.surFin?.({ lignes: lignesTenues, dureeMs: dureeTotale, complet, jokerUtilise: joker === 0, resultats });
  }

  const sansRaccourcis = raccourcis({ Enter: () => valider() });
  suivante();
  return {
    detruire() {
      phase = 'fin';
      clearInterval(minuterie);
      sansRaccourcis();
      racine.remove();
    },
  };
}

