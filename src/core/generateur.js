/**
 * Générateur dynamique d'exercices d'addition et de soustraction en colonne.
 *
 * Chaque exercice est tiré au hasard, mais respecte STRICTEMENT des contraintes :
 *  - `autorises` : motifs permis (Set). Tout autre geste fait rejeter le tirage. null = tout permis.
 *    Pour travailler un ami précis : autorises = gestes directs + cet ami, et rien d'autre.
 *  - `cibles`    : motifs travaillés. Chaque ligne en contient au moins un quand c'est possible ;
 *    sinon la ligne (en gestes directs) ramène le soroban sur une valeur où la cible redevient possible.
 *    Parmi plusieurs tirages valides, on garde celui qui répète le plus la cible.
 *  - `poids`     : pondération des cibles (le diagnostic augmente le poids des motifs ratés).
 *
 * Principe : on construit l'opération tige par tige (chiffre de départ compatible avec le motif voulu),
 * puis le moteur de gestes la vérifie entièrement (retenues et emprunts compris).
 *
 * Format d'un exercice : { type: 'addsub', lignes: [{ op, n }], resultat, motifs: [cles...] }
 * La première ligne est le nombre posé (op '+').
 */

import { Soroban, etatDepuisChiffre } from './soroban.js';
import { calculerGestes, regleAjout, regleRetrait, ErreurCalcul } from './gestes.js';
import { analyserMotif } from './motifs.js';
import { entier } from './aleatoire.js';

const hasard = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ZERO_A_NEUF = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export class ErreurGeneration extends Error {}

/** Clé du motif obtenu en appliquant `op d` sur une tige qui vaut c. */
export function cleDe(op, c, d) {
  const regle = (op === '+' ? regleAjout : regleRetrait)(etatDepuisChiffre(c), d);
  return `${op}${d}:${regle}`;
}

/** Tirage pondéré d'une clé. Poids absent = 1. */
export function tirerPondere(cles, poids = {}) {
  const total = cles.reduce((s, c) => s + (poids[c] ?? 1), 0);
  let x = Math.random() * total;
  for (const c of cles) {
    x -= poids[c] ?? 1;
    if (x < 0) return c;
  }
  return cles.at(-1);
}

/** Nombre de tiges suffisant pour des nombres de `chiffres` chiffres (avec retenues). */
export const tigesPour = (chiffres) => chiffres + 3;

/**
 * Fait calculer l'opération par le moteur. Renvoie { resultat, motifs } ou null si impossible
 * (résultat négatif, dépassement).
 */
export function analyserOperation(depart, op, n, nbTiges) {
  const s = new Soroban(nbTiges);
  s.definirValeur(depart);
  try {
    const r = calculerGestes(s.instantane(), nbTiges - 1, op, n);
    return { resultat: op === '+' ? depart + n : depart - n, motifs: r.motifs.map((m) => m.cle) };
  } catch (e) {
    if (e instanceof ErreurCalcul) return null;
    throw e;
  }
}

const respecte = (motifs, autorises) => !autorises || motifs.every((m) => autorises.has(m));
const compter = (motifs, cibles) => motifs.filter((m) => cibles?.includes(m)).length;

/**
 * Génère « départ ± n » (n de `chiffres` chiffres) contenant le motif cible.
 * Le départ a au moins `chiffres` chiffres : c'est la première ligne de la colonne.
 */
export function genererOperation({ chiffres, autorises = null, cibles, poids = {} }) {
  // Si une cible se révèle impossible avec ces contraintes, on l'écarte et on en tire une autre.
  let restantes = [...cibles];
  while (restantes.length) {
    const cible = tirerPondere(restantes, poids);
    const ex = essayerCible(cible, chiffres, autorises, cibles);
    if (ex) return ex;
    restantes = restantes.filter((c) => c !== cible);
  }
  throw new ErreurGeneration(`Impossible de générer une opération pour ${cibles.join(', ')}`);
}

function essayerCible(cible, chiffres, autorises, cibles) {
  const nbTiges = tigesPour(chiffres) + 1;
  const { op, d: dCible } = analyserMotif(cible);
  const departMin = 10 ** (chiffres - 1);
  let meilleur = null;
  let valides = 0;

  for (let essai = 0; essai < 3000 && valides < 12; essai++) {
    const pos = entier(0, chiffres - 1); // tige (dans n) qui porte le motif cible
    const chiffresN = [];
    const chiffresDepart = [];
    let empruntEnTete = false;
    let ok = true;
    for (let i = 0; i < chiffres; i++) {
      let d;
      let c;
      if (i === pos && dCible !== null) {
        d = dCible;
        c = hasard(ZERO_A_NEUF.filter((x) => cleDe(op, x, d) === cible));
      } else {
        d = i === 0 ? entier(1, 9) : entier(0, 9);
        const possibles = d === 0 ? ZERO_A_NEUF : ZERO_A_NEUF.filter((x) => !autorises || autorises.has(cleDe(op, x, d)));
        if (!possibles.length) { ok = false; break; }
        c = hasard(possibles);
      }
      if (op === '-' && i === 0 && c < d) empruntEnTete = true;
      chiffresN.push(d);
      chiffresDepart.push(c);
    }
    if (!ok) continue;
    // Seul un emprunt sur la tige la plus à gauche exige un chiffre de plus au départ.
    const tete = op === '-' && (empruntEnTete || (dCible === null && Math.random() < 0.5)) ? entier(1, 9) : 0;
    const depart = Number(`${tete}${chiffresDepart.join('')}`);
    if (depart < departMin) continue;
    const n = Number(chiffresN.join(''));
    const a = analyserOperation(depart, op, n, nbTiges);
    if (!a || !respecte(a.motifs, autorises) || !a.motifs.includes(cible)) continue;
    valides += 1;
    const ex = { depart, op, n, resultat: a.resultat, motifs: a.motifs, score: compter(a.motifs, cibles) };
    if (!meilleur || ex.score > meilleur.score) meilleur = ex;
  }
  return meilleur;
}

/** Nombre de tiges (parmi les `chiffres` de droite) où l'un des motifs cibles est applicable. */
function ouvertures(valeur, cibles, chiffres) {
  let n = 0;
  for (let i = 0; i < chiffres; i++) {
    const c = Math.floor(valeur / 10 ** i) % 10;
    if (cibles.some((cible) => {
      const { op, d } = analyserMotif(cible);
      return d === null || (cleDe(op, c, d) === cible && (op === '+' || valeur >= d * 10 ** i));
    })) n += 1;
  }
  return n;
}
const permet = (valeur, cible, chiffres) => ouvertures(valeur, [cible], chiffres) > 0;

/**
 * Génère la ligne suivante d'une colonne, à partir de la valeur courante.
 * Les contraintes ne sont JAMAIS relâchées : en cas d'impossibilité, ErreurGeneration.
 * @returns {{op, n, resultat, motifs}}
 */
export function genererTerme(valeur, { chiffres, autorises = null, cibles = null, poids = {}, ops = ['+', '-'], nbTiges = tigesPour(chiffres) + 1 }) {
  const cDe = (i) => Math.floor(valeur / 10 ** (chiffres - 1 - i)) % 10; // chiffre courant de la tige i de n
  let meilleur = null;
  let valides = 0;
  for (let essai = 0; essai < 2500 && valides < 15; essai++) {
    let op = hasard(ops);
    let cible = null;
    if (cibles?.length && essai < 1800) {
      const candidates = cibles.filter((c) => ops.includes(analyserMotif(c).op));
      if (candidates.length) {
        cible = tirerPondere(candidates, poids);
        op = analyserMotif(cible).op;
      }
    }
    const dCible = cible ? analyserMotif(cible).d : null;
    const positions = [...Array(chiffres).keys()].filter((i) => dCible === null || cleDe(op, cDe(i), dCible) === cible);
    // Cible impossible depuis cette valeur : ligne de préparation (sans la cible), qui doit
    // amener le soroban sur une valeur où la cible redevient possible.
    let preparer = null;
    if (cible && dCible !== null && !positions.length) {
      preparer = cible;
      cible = null;
      op = hasard(ops);
    }
    const pos = hasard(positions);
    const chiffresN = [];
    for (let i = 0; i < chiffres; i++) {
      if (cible && dCible !== null && i === pos) { chiffresN.push(dCible); continue; }
      const possibles = (i === 0 ? ZERO_A_NEUF.slice(1) : ZERO_A_NEUF)
        .filter((d) => d === 0 || !autorises || autorises.has(cleDe(op, cDe(i), d)));
      if (!possibles.length) break;
      chiffresN.push(hasard(possibles));
    }
    if (chiffresN.length < chiffres) continue;
    const n = Number(chiffresN.join(''));
    const a = analyserOperation(valeur, op, n, nbTiges);
    if (!a || !respecte(a.motifs, autorises)) continue;
    if (cible && !a.motifs.includes(cible)) continue;
    if (preparer && !permet(a.resultat, preparer, chiffres)) continue;
    valides += 1;
    // Score : d'abord le nombre de répétitions de la cible dans la ligne, puis le nombre de tiges
    // où la cible sera possible à la ligne suivante (pour enchaîner les répétitions).
    const score = compter(a.motifs, cibles) * 10 + (cibles ? ouvertures(a.resultat, cibles, chiffres) : 0);
    if (!meilleur || score > meilleur.score) meilleur = { op, n, resultat: a.resultat, motifs: a.motifs, score };
  }
  if (!meilleur) throw new ErreurGeneration('Impossible de générer une ligne');
  return meilleur;
}

/**
 * Colonne complète : première ligne posée, puis (lignes − 1) lignes ± respectant les contraintes.
 * @param {{chiffres:number, lignes:number, autorises?:Set|null, cibles:string[], poids?:object, ops?:string[]}} c
 * @returns {{type:'addsub', lignes:Array<{op,n}>, resultat:number, motifs:string[]}}
 */
export function genererColonne({ chiffres, lignes, autorises = null, cibles, poids = {}, ops = ['+', '-'] }) {
  for (let tentative = 0; tentative < 40; tentative++) {
    try {
      const premiere = genererOperation({ chiffres, autorises, cibles: cibles.filter((c) => ops.includes(analyserMotif(c).op)), poids });
      const liste = [{ op: '+', n: premiere.depart }, { op: premiere.op, n: premiere.n }];
      const motifs = [...premiere.motifs];
      let valeur = premiere.resultat;
      while (liste.length < lignes) {
        const t = genererTerme(valeur, { chiffres, autorises, cibles, poids, ops });
        liste.push({ op: t.op, n: t.n });
        motifs.push(...t.motifs);
        valeur = t.resultat;
      }
      return { type: 'addsub', lignes: liste.slice(0, Math.max(lignes, 2)), resultat: valeur, motifs };
    } catch (e) {
      if (!(e instanceof ErreurGeneration)) throw e;
    }
  }
  throw new ErreurGeneration('Impossible de générer une colonne');
}

/** Résultat d'une colonne (somme algébrique des lignes). */
export const resultatColonne = (lignes) => lignes.reduce((v, l) => (l.op === '+' ? v + l.n : v - l.n), 0);

/** Sous-totaux successifs d'une colonne (pour vérifier sur son soroban où l'erreur s'est glissée). */
export function sousTotaux(lignes) {
  let v = 0;
  return lignes.map((l) => (v = l.op === '+' ? v + l.n : v - l.n));
}
