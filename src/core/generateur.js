/**
 * Générateur dynamique d'exercices.
 *
 * Chaque exercice est tiré au hasard, mais respecte strictement les contraintes d'un palier :
 *  - `autorises` : ensemble des motifs permis (tout geste hors de cet ensemble fait rejeter l'exercice) ;
 *  - `cibles`    : motifs travaillés ; chaque opération en contient au moins un ;
 *  - `poids`     : pondération des cibles (le diagnostic augmente le poids des motifs ratés).
 *
 * Principe : on construit l'opération tige par tige (en choisissant, pour chaque tige, un chiffre
 * de départ compatible avec le motif voulu), puis on la fait vérifier par le moteur de gestes,
 * qui détecte aussi les retenues et les emprunts. Si quelque chose sort des contraintes,
 * on recommence : le nombre de combinaisons possibles évite le par-cœur.
 *
 * Format d'un exercice : { depart, termes: [{ op, n }], resultat, motifs: [cles...] }
 */

import { Soroban, etatDepuisChiffre } from './soroban.js';
import { calculerGestes, regleAjout, regleRetrait, ErreurCalcul } from './gestes.js';
import { analyserMotif } from './motifs.js';
import { entier, nombreAChiffres } from './aleatoire.js';

const hasard = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ZERO_A_NEUF = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

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

/** Nombre de tiges suffisant pour une opération de `chiffres` chiffres (avec retenues). */
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

/**
 * Génère une opération « départ ± n » dont n a `chiffres` chiffres et qui contient le motif cible.
 * @param {{chiffres:number, autorises:Set<string>|null, cibles:string[], poids?:object}} c
 */
export function genererOperation({ chiffres, autorises = null, cibles, poids = {} }) {
  // Si une cible se révèle impossible avec ces contraintes, on l'écarte et on en tire une autre.
  let restantes = [...cibles];
  while (restantes.length) {
    const cible = tirerPondere(restantes, poids);
    const ex = essayerCible(cible, chiffres, autorises);
    if (ex) return ex;
    restantes = restantes.filter((c) => c !== cible);
  }
  throw new Error(`Impossible de générer une opération pour ${cibles.join(', ')}`);
}

function essayerCible(cible, chiffres, autorises) {
  const nbTiges = tigesPour(chiffres);
  const { op, d: dCible } = analyserMotif(cible);

  for (let essai = 0; essai < 3000; essai++) {
    const pos = entier(0, chiffres - 1); // tige (dans le nombre n) qui porte le motif cible
    const chiffresN = [];
    const chiffresDepart = [];
    let emprunt = false;
    let ok = true;
    for (let i = 0; i < chiffres; i++) {
      let d;
      let c;
      if (i === pos && dCible !== null) {
        d = dCible;
        const possibles = ZERO_A_NEUF.filter((x) => cleDe(op, x, d) === cible);
        c = hasard(possibles);
      } else {
        d = i === 0 ? entier(1, 9) : entier(0, 9);
        const possibles = d === 0 ? ZERO_A_NEUF : ZERO_A_NEUF.filter((x) => !autorises || autorises.has(cleDe(op, x, d)));
        if (!possibles.length) { ok = false; break; }
        c = hasard(possibles);
      }
      if (op === '-' && c < d) emprunt = true;
      chiffresN.push(d);
      chiffresDepart.push(c);
    }
    if (!ok) continue;
    // Une soustraction qui emprunte a besoin d'une tige non nulle à gauche.
    const tete = op === '-' && (emprunt || dCible === null) ? entier(1, 9) : 0;
    const depart = Number(`${tete}${chiffresDepart.join('')}`);
    const n = Number(chiffresN.join(''));
    const a = analyserOperation(depart, op, n, nbTiges);
    if (!a || !respecte(a.motifs, autorises) || !a.motifs.includes(cible)) continue;
    return { depart, termes: [{ op, n }], resultat: a.resultat, motifs: a.motifs, cible };
  }
  return null;
}

/**
 * Génère le terme suivant d'une chaîne, à partir de la valeur courante du soroban.
 * @param {number} valeur  valeur actuelle
 * @param {{chiffres:number, autorises?:Set|null, cibles?:string[]|null, poids?:object, ops?:string[], nbTiges?:number}} c
 * @returns {{op, n, resultat, motifs}}
 */
export function genererTerme(valeur, { chiffres, autorises = null, cibles = null, poids = {}, ops = ['+', '-'], nbTiges = tigesPour(chiffres) }) {
  const cDe = (i) => Math.floor(valeur / 10 ** (chiffres - 1 - i)) % 10; // chiffre courant de la tige i de n
  for (let essai = 0; essai < 1500; essai++) {
    // Après de nombreux échecs, on renonce à la cible (puis aux contraintes) pour ne jamais bloquer.
    const avecCible = cibles?.length && essai < 800;
    const strict = essai < 1300;
    let op = hasard(ops);
    let cible = null;
    if (avecCible) {
      const candidates = cibles.filter((c) => ops.includes(analyserMotif(c).op));
      if (candidates.length) {
        cible = tirerPondere(candidates, poids);
        op = analyserMotif(cible).op;
      }
    }
    const { d: dCible } = cible ? analyserMotif(cible) : { d: null };
    const positions = dCible === null
      ? [...Array(chiffres).keys()]
      : [...Array(chiffres).keys()].filter((i) => cleDe(op, cDe(i), dCible) === cible);
    // Cible impossible depuis la valeur actuelle : on prépare le terrain. Ce terme-ci sera libre,
    // mais il doit amener le soroban sur une valeur où la cible redevient possible.
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
        .filter((d) => d === 0 || !strict || !autorises || autorises.has(cleDe(op, cDe(i), d)));
      if (!possibles.length) break;
      chiffresN.push(hasard(possibles));
    }
    if (chiffresN.length < chiffres) continue;
    const n = Number(chiffresN.join(''));
    const a = analyserOperation(valeur, op, n, nbTiges);
    if (!a) continue;
    if (strict && !respecte(a.motifs, autorises)) continue;
    if (cible && !a.motifs.includes(cible)) continue;
    if (preparer && !permet(a.resultat, preparer, chiffres)) continue;
    return { op, n, resultat: a.resultat, motifs: a.motifs };
  }
  throw new Error('Impossible de générer un terme');
}

/** La valeur permet-elle d'appliquer le motif cible sur l'une des `chiffres` tiges de droite ? */
function permet(valeur, cible, chiffres) {
  const { op, d } = analyserMotif(cible);
  for (let i = 0; i < chiffres; i++) {
    const c = Math.floor(valeur / 10 ** i) % 10;
    if (cleDe(op, c, d) === cible && (op === '+' || valeur >= d * 10 ** i)) return true;
  }
  return false;
}

/**
 * Exercice complet d'un sous-palier : une opération ciblée, suivie éventuellement d'autres termes.
 * @param {{chiffres, termes, autorises, cibles}} sp  sous-palier (voir curriculum.js)
 */
export function genererExercice(sp, poids = {}) {
  const ex = genererOperation({ chiffres: sp.chiffres, autorises: sp.autorises, cibles: sp.cibles, poids });
  for (let t = 1; t < (sp.termes ?? 1); t++) {
    const terme = genererTerme(ex.resultat, {
      chiffres: sp.chiffres, autorises: sp.autorises, cibles: sp.cibles, poids, ops: sp.ops ?? ['+', '-'],
    });
    ex.termes.push({ op: terme.op, n: terme.n });
    ex.motifs.push(...terme.motifs);
    ex.resultat = terme.resultat;
  }
  return ex;
}

/**
 * Planche d'entraînement (style « mitorizan ») : une colonne de nombres à ajouter ou retirer.
 * La première ligne est posée (ajoutée à zéro), les suivantes portent un signe.
 * @param {{chiffres:1|2|3, lignes:number, cibles:string[]|null, poids?:object}} c
 * @returns {{ lignes: Array<{op, n}>, resultat, motifs }}
 */
export function genererPlanche({ chiffres, lignes, cibles = null, poids = {} }) {
  const premier = Math.max(1, nombreAChiffres(chiffres));
  const liste = [{ op: '+', n: premier }];
  const motifs = [];
  let valeur = premier;
  const nbTiges = tigesPour(chiffres) + 1;
  for (let i = 1; i < lignes; i++) {
    const t = genererTerme(valeur, { chiffres, cibles, poids, nbTiges });
    liste.push({ op: t.op, n: t.n });
    motifs.push(...t.motifs);
    valeur = t.resultat;
  }
  return { lignes: liste, resultat: valeur, motifs };
}
