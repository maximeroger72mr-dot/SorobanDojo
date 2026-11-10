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
/** Le nombre contient-il un zéro après son premier chiffre (406, 3 050, 70) ? */
const aUnZero = (n) => String(n).slice(1).includes('0');
const compter = (motifs, cibles) => motifs.filter((m) => cibles?.includes(m)).length;

/**
 * Génère « départ ± n » (n de `chiffres` chiffres) contenant le motif cible.
 * Le départ a au moins `chiffres` chiffres : c'est la première ligne de la colonne.
 */
export function genererOperation({ chiffres, autorises = null, cibles, poids = {}, zeros = false }) {
  // Si une cible se révèle impossible avec ces contraintes, on l'écarte et on en tire une autre.
  let restantes = [...cibles];
  while (restantes.length) {
    const cible = tirerPondere(restantes, poids);
    const ex = essayerCible(cible, chiffres, autorises, cibles, zeros);
    if (ex) return ex;
    restantes = restantes.filter((c) => c !== cible);
  }
  throw new ErreurGeneration(`Impossible de générer une opération pour ${cibles.join(', ')}`);
}

function essayerCible(cible, chiffres, autorises, cibles, zeros = false) {
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
    // Une dizaine au départ, même à 1 chiffre : les gestes restent ceux des unités, mais les
    // colonnes et les résultats varient beaucoup plus (sinon on « reconnaît » les réponses).
    const tete = (op === '-' && (empruntEnTete || dCible === null)) || (chiffres === 1 && Math.random() < 0.75) ? entier(1, 9) : 0;
    const depart = Number(`${tete}${chiffresDepart.join('')}`);
    if (depart < departMin) continue;
    const n = Number(chiffresN.join(''));
    if (zeros && (!aUnZero(n) || !aUnZero(depart))) continue;
    const a = analyserOperation(depart, op, n, nbTiges);
    if (!a || !respecte(a.motifs, autorises) || !a.motifs.includes(cible)) continue;
    valides += 1;
    const ex = { depart, op, n, resultat: a.resultat, motifs: a.motifs, score: compter(a.motifs, cibles) + Math.random() * 0.9 };
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
 * Intérêt d'une ligne pour l'équilibre : une répétition de la cible la moins vue rapporte le plus,
 * celle d'une cible déjà beaucoup vue fait perdre des points ; chaque tige où une cible devient
 * possible à la ligne suivante rapporte un peu. Ainsi les amis rares sont recherchés activement.
 */
function scoreEquilibre(analyse, cibles, poids, chiffres) {
  const pmax = Math.max(...cibles.map((c) => poids[c] ?? 1));
  let score = 0;
  for (const c of cibles) {
    const w = (poids[c] ?? 1) / pmax;
    // w = 1 : la cible la moins vue (bonus plein) ; w petit : cible déjà trop vue (pénalité).
    score += 10 * (2 * w - 1) * compter(analyse.motifs, [c]) + w * ouvertures(analyse.resultat, [c], chiffres);
  }
  return score;
}

/**
 * Variété d'une colonne : une colonne prévisible (« +1 −1 +2 −2… ») se devine sans calculer.
 *  - annuler la ligne précédente (+3 puis −3) : forte pénalité ;
 *  - répéter le nombre de la ligne précédente : pénalité ;
 *  - un nombre déjà vu dans les 3 dernières lignes : petite pénalité ;
 *  - un nombre pas encore vu dans la colonne : bonus ; un peu d'élan pour les chiffres 4 à 9
 *    (lignes libres seulement) ;
 *  - signes qui alternent sans fin (+ − + −) : petite pénalité.
 * À cumuler avec scoreEquilibre : les amis restent fréquents, mais mélangés.
 * @param {Array<{op, n}>} precedents  lignes déjà posées (la 1re comprise)
 */
export function scoreVariete(op, n, precedents, libre = true) {
  if (!precedents.length) return 0;
  const prec = precedents.at(-1);
  let s = 0;
  if (prec.n === n) s -= prec.op !== op ? 14 : 8;
  s -= 3 * precedents.slice(-4, -1).filter((l) => l.n === n).length;
  if (!precedents.some((l) => l.n === n)) s += 4;
  // Les tout petits nombres (1, 2, 3) ne doivent pas tout envahir : un peu d'élan pour les plus grands.
  // Élan vers 4 à 9 seulement sur une ligne libre : sur une ligne qui vise un ami, il fausserait
  // l'équilibre entre les amis (le +4 passerait devant le +1).
  if (libre && n % 10 >= 4) s += 2;
  // Rythme des signes trop régulier (+ − + −) : on le casse de temps en temps.
  const ops = precedents.slice(1).map((l) => l.op);
  if (ops.length >= 2 && ops.at(-1) !== ops.at(-2) && op !== ops.at(-1)) s -= 2.5;
  return s;
}

/**
 * Génère la ligne suivante d'une colonne, à partir de la valeur courante.
 * Les contraintes ne sont JAMAIS relâchées : en cas d'impossibilité, ErreurGeneration.
 * @returns {{op, n, resultat, motifs}}
 */
export function genererTerme(valeur, { chiffres, autorises = null, cibles = null, poids = {}, ops = ['+', '-'], nbTiges = tigesPour(chiffres) + 1, zeros = false, precedents = [], viser = true }) {
  const cDe = (i) => Math.floor(valeur / 10 ** (chiffres - 1 - i)) % 10; // chiffre courant de la tige i de n
  let meilleur = null;
  let valides = 0;
  for (let essai = 0; essai < 2500 && valides < 15; essai++) {
    let op = hasard(ops);
    let cible = null;
    if (viser && cibles?.length && essai < 1800) {
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
    if (zeros && !aUnZero(n)) continue;
    const a = analyserOperation(valeur, op, n, nbTiges);
    if (!a || !respecte(a.motifs, autorises)) continue;
    if (cible && !a.motifs.includes(cible)) continue;
    if (preparer && !permet(a.resultat, preparer, chiffres)) continue;
    valides += 1;
    // Score : d'abord les répétitions de la cible TIRÉE (c'est elle qui équilibre les fréquences),
    // un peu les autres cibles, puis les tiges où la cible tirée sera possible à la ligne suivante.
    // Un peu de hasard départage les candidats proches : sinon le « meilleur » chemin revient sans cesse.
    const score = (cibles ? (viser ? 1 : 0.3) * scoreEquilibre(a, cibles, poids, chiffres) : 0) + scoreVariete(op, n, precedents, !viser || !cibles) + Math.random() * 3;
    if (!meilleur || score > meilleur.score) meilleur = { op, n, resultat: a.resultat, motifs: a.motifs, score };
  }
  if (!meilleur) throw new ErreurGeneration('Impossible de générer une ligne');
  return meilleur;
}

/**
 * Colonne complète : première ligne posée, puis (lignes − 1) lignes ± respectant les contraintes.
 * @param {{chiffres:number, lignes:number, autorises?:Set|null, cibles:string[], poids?:object, ops?:string[], zeros?:boolean}} c
 *   zeros : chaque nombre contient un zéro après son premier chiffre (entraînement aux zéros internes)
 *   premierCourt : (anzan, 1 chiffre) la 1re ligne est un seul chiffre, sans dizaine en tête
 * @returns {{type:'addsub', lignes:Array<{op,n}>, resultat:number, motifs:string[]}}
 */
export function genererColonne(params) {
  // Règles de qualité strictes d'abord ; si ce geste ne le permet pas, règles assouplies
  // (seulement pas de ligne répétée ni de ping-pong), et la colonne le signale (assoupli).
  for (const niveau of ['strict', 'assoupli', 'libre']) {
    for (let tentative = 0; tentative < (niveau === 'strict' ? 40 : 20); tentative++) {
      let col;
      try {
        col = colonneSimple(params);
      } catch (e) {
        if (!(e instanceof ErreurGeneration)) throw e;
        continue;
      }
      if (niveau === 'libre' || colonneValide(col, params.cibles, niveau === 'strict')) return niveau === 'strict' ? col : { ...col, assoupli: true };
    }
  }
  throw new ErreurGeneration('Impossible de générer une colonne');
}

/**
 * Règles de qualité d'une colonne (les lignes après la première, qui est posée) :
 *  1. jamais deux lignes identiques de suite, ni une ligne qui annule la précédente (+2 −2) ;
 *  2. pas d'alternance A, B, A, B ;
 *  3. au moins 3 valeurs différentes dans une colonne de 5 lignes ou plus ;
 *  4. aucune valeur sur plus de la moitié des lignes (3 « −2 » au plus sur 6 lignes) ;
 *  5. un geste choisi seul (une seule cible) jamais deux lignes de suite ;
 *  6. à 2 chiffres et plus : aucun passage par zéro (un sous-total nul se lit sans calculer) ;
 *  7. à 2 chiffres et plus : pas trois lignes de suite avec le même chiffre des unités ;
 *  8. à 3 chiffres et plus : un seul nombre à chiffres tous identiques (333) par colonne.
 * strict = false : seulement les règles 1 et 2.
 */
export function colonneValide(col, cibles = [], strict = true) {
  const L = col.lignes.slice(1).map((l) => `${l.op}${l.n}`);
  const N = col.lignes.slice(1).map((l) => l.n);
  for (let i = 1; i < L.length; i++) if (N[i] === N[i - 1]) return false;
  for (let i = 3; i < L.length; i++) if (L[i] === L[i - 2] && L[i - 1] === L[i - 3]) return false;
  if (!strict) return true;
  const total = col.lignes.length;
  if (total >= 5 && new Set(L).size < 3) return false;
  const compte = {};
  for (const v of L) if ((compte[v] = (compte[v] ?? 0) + 1) > Math.floor(total / 2)) return false;
  if (cibles?.length === 1 && col.motifsLignes) {
    const vise = col.motifsLignes.slice(1).map((ms) => ms.includes(cibles[0]));
    for (let i = 1; i < vise.length; i++) if (vise[i] && vise[i - 1]) return false;
  }
  const large = Math.max(...N.map((n) => String(n).length));
  // À 1 chiffre, les colonnes possibles sont trop peu nombreuses pour interdire le passage par zéro.
  if (large >= 2 && sousTotaux(col.lignes).some((v) => v === 0)) return false;
  if (large >= 2) for (let i = 2; i < N.length; i++) if (N[i] % 10 === N[i - 1] % 10 && N[i] % 10 === N[i - 2] % 10) return false;
  if (large >= 3 && N.filter((n) => n >= 100 && new Set(String(n)).size === 1).length > 1) return false;
  return true;
}

function colonneSimple({ chiffres, lignes, autorises = null, cibles, poids = {}, ops = ['+', '-'], zeros = false, premierCourt = false }) {
  let liste;
  let motifs;
  let valeur;
  let premiere = { motifs: [] };
  let motifsLignes;
  if (premierCourt && chiffres === 1) {
    // Anzan à 1 chiffre : la colonne commence par UN chiffre (pas de dizaine en tête, qui
    // oblige à visualiser deux tiges dès le départ). De préférence un chiffre qui permet une cible.
    const ouverts = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => ouvertures(v, cibles.filter((c) => ops.includes(analyserMotif(c).op)), 1) > 0);
    valeur = hasard(ouverts.length ? ouverts : [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    liste = [{ op: '+', n: valeur }];
    motifs = [];
    motifsLignes = [[]];
  } else {
    premiere = genererOperation({ chiffres, autorises, cibles: cibles.filter((c) => ops.includes(analyserMotif(c).op)), poids, zeros });
    liste = [{ op: '+', n: premiere.depart }, { op: premiere.op, n: premiere.n }];
    motifs = [...premiere.motifs];
    motifsLignes = [[], premiere.motifs];
    valeur = premiere.resultat;
  }
  // Équilibrage : plus une cible est déjà apparue dans la colonne, moins elle est tirée.
  const vus = {};
  const compterVus = (ms) => ms.forEach((m) => { vus[m] = (vus[m] ?? 0) + 1; });
  compterVus(premiere.motifs);
  while (liste.length < lignes) {
    const poidsLigne = Object.fromEntries(cibles.map((c) => [c, (poids[c] ?? 1) / (1 + (vus[c] ?? 0)) ** 2]));
    // Colonne mélangée (au moins 3 gestes visés) : une ligne sur quatre environ est « libre »
    // (toujours dans les gestes permis, mais sans viser un ami) ; elle apporte d'autres chiffres et
    // casse la monotonie. Une planche ciblée sur 1 ou 2 gestes garde, elle, la répétition maximale.
    // Pas de ligne libre quand un ami est en retard sur les autres (poids d'équilibrage) : la
    // priorité reste alors de le faire apparaître.
    const pb = cibles.map((c) => poids[c] ?? 1);
    const equilibre = Math.max(...pb) <= 1.3 * Math.min(...pb);
    const libre = cibles.length >= 3 && liste.length > 2 && equilibre && Math.random() < 0.25;
    let t;
    try {
      // Ligne libre : aucun ami visé, mais l'équilibre entre les amis compte toujours dans le score
      // (sinon les amis « naturellement » fréquents, comme +4, passeraient devant les autres).
      t = genererTerme(valeur, { chiffres, autorises, cibles, viser: !libre, poids: poidsLigne, ops, zeros, precedents: liste });
    } catch (e) {
      if (!(e instanceof ErreurGeneration) || !libre) throw e;
      t = genererTerme(valeur, { chiffres, autorises, cibles, poids: poidsLigne, ops, zeros, precedents: liste });
    }
    // Jamais de redondance qu'on devine sans calculer : le même nombre deux fois de suite
    // (+9 +9), ou un ping-pong (+4 −1 +4 −1). On remplace alors la ligne par une ligne libre
    // (gestes permis, sans viser l'ami) quand c'est possible.
    if (redondante(liste, t)) {
      for (let k = 0; k < 4; k++) {
        try {
          const autre = genererTerme(valeur, { chiffres, autorises, cibles, viser: false, poids: poidsLigne, ops, zeros, precedents: liste });
          if (!redondante(liste, autre)) { t = autre; break; }
        } catch (e) {
          if (!(e instanceof ErreurGeneration)) throw e;
          break;
        }
      }
    }
    compterVus(t.motifs);
    liste.push({ op: t.op, n: t.n });
    motifs.push(...t.motifs);
    motifsLignes.push(t.motifs);
    valeur = t.resultat;
  }
  return { type: 'addsub', lignes: liste.slice(0, Math.max(lignes, 2)), resultat: valeur, motifs, motifsLignes };
}

/** Ligne redondante : même nombre que la précédente, ou ping-pong (+a −b +a −b). */
export function redondante(liste, t) {
  const p1 = liste.at(-1);
  const p2 = liste.at(-2);
  const p3 = liste.at(-3);
  if (liste.length >= 2 && p1.n === t.n) return true;
  return liste.length >= 4 && p2.n === t.n && p2.op === t.op && p3.n === p1.n && p3.op === p1.op;
}

/**
 * Mémoire anti-répétition : derniers résultats et dernières colonnes vus dans une même série.
 * @param {number} taille  nombre d'exercices récents à éviter
 */
export function creerMemoire(taille = 6) {
  return { taille, resultats: [], signatures: [], unites: [] };
}
const signature = (col) => col.lignes.map((l) => `${l.op}${l.n}`).join(',');

/**
 * Colonne VARIÉE : comme genererColonne, mais le résultat (et la colonne) ne doivent pas avoir été
 * vus dans les derniers exercices de la mémoire. Si plusieurs tirages n'y suffisent pas, on ajoute
 * UNE ligne de plus (toujours dans les gestes permis) pour changer le résultat.
 */
export function genererColonneVariee(params, memoire) {
  if (!memoire) return genererColonne(params);
  // Évite aussi un chiffre des unités trop prévisible (même chiffre déjà 2 fois dans les 4 derniers).
  const unite = (r) => Math.abs(r) % 10;
  const uniteUsee = (r) => memoire.unites.slice(-4).filter((u) => u === unite(r)).length >= 2;
  const recent = (col) => memoire.resultats.includes(col.resultat) || memoire.signatures.includes(signature(col)) || uniteUsee(col.resultat);
  let col = null;
  for (let essai = 0; essai < 12; essai++) {
    col = genererColonne(params);
    if (!recent(col)) break;
  }
  if (recent(col)) {
    // Une ligne de plus, choisie pour donner un résultat nouveau.
    for (let essai = 0; essai < 20; essai++) {
      try {
        const t = genererTerme(col.resultat, { ...params, poids: params.poids ?? {}, precedents: col.lignes });
        if (memoire.resultats.includes(t.resultat) || uniteUsee(t.resultat)) continue;
        col = { ...col, lignes: [...col.lignes, { op: t.op, n: t.n }], resultat: t.resultat, motifs: [...col.motifs, ...t.motifs] };
        break;
      } catch (e) {
        if (!(e instanceof ErreurGeneration)) throw e;
      }
    }
  }
  memoire.resultats.push(col.resultat);
  memoire.unites.push(unite(col.resultat));
  if (memoire.unites.length > 8) memoire.unites.shift();
  memoire.signatures.push(signature(col));
  if (memoire.resultats.length > memoire.taille) memoire.resultats.shift();
  if (memoire.signatures.length > memoire.taille * 3) memoire.signatures.shift();
  return col;
}

/** Résultat d'une colonne (somme algébrique des lignes). */
export const resultatColonne = (lignes) => lignes.reduce((v, l) => (l.op === '+' ? v + l.n : v - l.n), 0);

/** Sous-totaux successifs d'une colonne (pour vérifier sur son soroban où l'erreur s'est glissée). */
export function sousTotaux(lignes) {
  let v = 0;
  return lignes.map((l) => (v = l.op === '+' ? v + l.n : v - l.n));
}

/**
 * Motifs de chaque ligne d'une colonne, avec le rang de la tige concernée.
 * @returns {Array<Array<{cle, rang}>>}  un tableau par ligne (la ligne 0, posée depuis 0, comprise)
 */
export function occurrencesColonne(lignes) {
  const nbTiges = Math.max(...lignes.map((l) => String(l.n).length)) + 4 + String(lignes.length).length;
  const s = new Soroban(nbTiges);
  return lignes.map((l) => {
    const r = calculerGestes(s.instantane(), s.tigeUnites, l.op, l.n);
    r.etapes.flatMap((e) => e.mouvements).forEach((m) => s.appliquerMouvement(m));
    return r.motifs.map((m) => ({ cle: m.cle, rang: s.tigeUnites - m.tige }));
  });
}

