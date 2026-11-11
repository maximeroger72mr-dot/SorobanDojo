/**
 * Colonnes pour travailler UN geste (planches, lièvre), en deux façons :
 *  - « −2 petit ami »                : le geste, des gestes directs, et un piège ;
 *  - « −2 parmi les petits amis »    : le geste, deux autres amis de sa famille déjà appris,
 *                                       un piège et des gestes directs.
 *
 * Chaque colonne est construite par RÔLES, placés dans un ordre tiré au hasard :
 *  - G (geste)  : le geste travaillé, 2 fois (3 sur une colonne de 7 lignes ou à 2 chiffres),
 *                 jamais sur deux lignes de suite ;
 *  - P (piège)  : le même chiffre fait par un AUTRE geste (« −2 » en geste direct) : il faut
 *                 regarder la tige avant d'agir, au lieu de lancer l'ami par réflexe ;
 *  - F (famille): un autre ami de la même famille, déjà appris (seulement « parmi ») ;
 *  - D (direct) : un geste direct, jamais deux fois la même valeur dans la colonne.
 *
 * Sur la planche (memoire) : aucune forme de colonne répétée (la suite des lignes, sans le
 * premier nombre), les valeurs directes déjà très vues sont évitées, premiers nombres différents.
 * Les règles de qualité de colonneValide s'appliquent en plus.
 */

import { analyserOperation, colonneValide, ErreurGeneration, horsDelai } from './generateur.js';
import { analyserMotif, famille } from './motifs.js';

const DIRECTS = new Set(famille('direct'));
const NOMS_FAMILLES = { petit: 'petits amis', grand: 'grands amis', mixte: 'combinaisons' };
const hasard = (l) => l[Math.floor(Math.random() * l.length)];
const entier = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const melanger = (l) => { const r = [...l]; for (let i = r.length - 1; i > 0; i--) { const j = entier(0, i); [r[i], r[j]] = [r[j], r[i]]; } return r; };

/** Libellés des deux façons, pour un geste : « −2 petit ami », « −2 parmi les petits amis ». */
export function libellesModes(cle) {
  const { op, d, regle } = analyserMotif(cle);
  const court = `${op === '+' ? '+' : '−'}${d}`;
  const noms = { petit: 'petit ami', grand: 'grand ami', mixte: 'combiné' };
  return { seul: `${court} ${noms[regle] ?? regle}`, famille: `${court} parmi les ${NOMS_FAMILLES[regle] ?? regle}` };
}

/** Un geste peut-il être travaillé ainsi ? (un ami : petit, grand ou combiné) */
export const gesteTravaillable = (cle) => typeof cle === 'string' && /^[+-]\d:(petit|grand|mixte)$/.test(cle);

export function creerMemoirePlanche() {
  return { formes: new Map(), valeurs: {}, premiers: new Set() };
}

/** Lignes candidates (op, n) pour un rôle ; à 2 chiffres et plus, un échantillon. */
function candidats(chiffres, op, d) {
  const max = 10 ** chiffres - 1;
  const min = chiffres === 1 ? 1 : 10 ** (chiffres - 1);
  const ops = op ? [op] : ['+', '-'];
  const res = [];
  if (chiffres === 1) {
    for (const o of ops) for (let n = 1; n <= 9; n++) res.push({ op: o, n });
    return melanger(res);
  }
  for (let k = 0; k < 50; k++) {
    let n = entier(min, max);
    if (d !== undefined && Math.random() < 0.8) {
      // Le chiffre du geste sur une ou plusieurs tiges (−2, −20, −22, −12…).
      const t = String(n).split('');
      for (let i = 0; i < t.length; i++) if (Math.random() < 0.5 || i === t.length - 1 - entier(0, t.length - 1)) t[i] = String(d);
      if (t[0] === '0') t[0] = String(d || 1);
      n = Number(t.join(''));
    }
    res.push({ op: hasard(ops), n });
  }
  return res;
}

/**
 * Une colonne.
 * @param {{ cible: string, mode?: 'seul'|'famille', chiffres?: number, lignes?: number, appris?: Set<string> }} p
 * @param {ReturnType<creerMemoirePlanche>} memoire  la planche en cours
 */
export function genererColonneGeste({ cible, mode = 'seul', chiffres = 1, lignes = 6, appris = new Set() }, memoire = creerMemoirePlanche()) {
  if (horsDelai()) throw new ErreurGeneration('délai dépassé');
  const { op: opG, d: dG, regle } = analyserMotif(cible);
  const nbTiges = chiffres + 4;
  const autresFamille = mode === 'famille' ? [...appris].filter((c) => c !== cible && analyserMotif(c)?.regle === regle) : [];
  // Pièges : le même signe et le même chiffre, fait par un autre geste déjà connu (direct d'abord).
  const pieges = ['direct', 'petit', 'grand', 'mixte'].filter((r) => r !== regle).map((r) => `${opG}${dG}:${r}`).filter((c) => DIRECTS.has(c) || appris.has(c));
  const permisP = new Set(pieges);
  const permisF = new Set(autresFamille);

  const essayer = (avecPiege, avecFamille, repetMax) => {
    const ops = lignes - 1;
    // Le geste 2 fois ; 3 sur une colonne de 7 lignes à 2 chiffres et plus. À 1 chiffre, toujours
    // 2 : le piège porte la même valeur (« −2 »), il faut lui laisser de la place.
    const nG = Math.min(lignes >= 7 && chiffres >= 2 ? 3 : 2, Math.ceil(ops / 2));
    let nP = avecPiege && pieges.length ? 1 : 0;
    // À 1 chiffre, geste et piège ont la même valeur (« −2 ») : jamais plus de la moitié des lignes.
    if (chiffres === 1 && nG + nP > Math.floor(lignes / 2)) nP = 0;
    let nF = avecFamille && autresFamille.length ? Math.min(2, ops - nG - nP - 1) : 0;
    nF = Math.max(0, nF);
    const nD = ops - nG - nP - nF;
    if (nD < 0) return null;
    // Ordre des rôles : le geste jamais deux fois de suite.
    let roles = null;
    for (let k = 0; k < 50 && !roles; k++) {
      const r = melanger([...Array(nG).fill('G'), ...Array(nP).fill('P'), ...Array(nF).fill('F'), ...Array(nD).fill('D')]);
      if (r.every((x, i) => !(x === 'G' && r[i - 1] === 'G'))) roles = r;
    }
    if (!roles) return null;

    const convient = (role, a) => {
      const ms = a.motifs;
      if (!ms.length) return false;
      if (role === 'G') return ms.includes(cible) && ms.every((m) => m === cible || DIRECTS.has(m));
      if (ms.includes(cible)) return false;
      if (role === 'P') return ms.some((m) => permisP.has(m)) && ms.every((m) => permisP.has(m) || DIRECTS.has(m));
      if (role === 'F') return ms.some((m) => permisF.has(m)) && ms.every((m) => permisF.has(m) || DIRECTS.has(m));
      return ms.every((m) => DIRECTS.has(m) && !permisP.has(m));
    };
    const ligneDe = (valeur, role) => {
      const opR = role === 'G' || role === 'P' ? opG : null;
      return candidats(chiffres, opR, role === 'G' || role === 'P' ? dG : undefined)
        .map((c) => ({ ...c, a: analyserOperation(valeur, c.op, c.n, nbTiges) }))
        .filter((c) => c.a && c.a.resultat >= 0 && convient(role, c.a));
    };
    const possible = (valeur, role) => ligneDe(valeur, role).length > 0;

    // Premier nombre posé : le premier rôle doit y être possible ; jamais deux fois le même.
    let depart = null;
    for (let k = 0; k < 60 && depart === null; k++) {
      const v = chiffres === 1 ? (Math.random() < 0.75 ? entier(1, 9) * 10 : 0) + entier(0, 9) : entier(10 ** (chiffres - 1), 10 ** chiffres - 1) + (Math.random() < 0.5 ? entier(1, 9) * 10 ** chiffres : 0);
      if (v < 1 || memoire.premiers.has(v)) continue;
      if (possible(v, roles[0])) depart = v;
    }
    if (depart === null) return null;

    const liste = [{ op: '+', n: depart }];
    const motifsLignes = [[]];
    const valeursCol = {};
    let valeur = depart;
    for (const [i, role] of roles.entries()) {
      const prec = liste.length > 1 ? liste.at(-1) : null;
      const prec2 = liste.length > 2 ? liste.at(-2) : null;
      const cands = ligneDe(valeur, role).filter((c) => {
        const v = `${c.op}${c.n}`;
        if (prec && prec.n === c.n) return false; // ni répétition, ni annulation (+2 −2)
        if (prec2 && liste.length > 3 && `${prec2.op}${prec2.n}` === v && `${liste.at(-3).op}${liste.at(-3).n}` === `${prec.op}${prec.n}`) return false;
        if ((valeursCol[v] ?? 0) + 1 > Math.floor(lignes / 2)) return false;
        if (role === 'D' && valeursCol[v]) return false; // directs : valeurs toutes différentes
        return true;
      });
      if (!cands.length) return null;
      // Poids : les valeurs directes déjà très vues sur la planche passent derrière ; le geste et
      // le piège changent de forme dans la colonne quand c'est possible (−2, −12, −20…).
      const poids = cands.map((c) => (role === 'D' ? 1 / (1 + (memoire.valeurs[`${c.op}${c.n}`] ?? 0)) ** 2 : valeursCol[`${c.op}${c.n}`] ? 0.1 : 1));
      let choisi = null;
      for (let k = 0; k < 8 && !choisi; k++) {
        let x = Math.random() * poids.reduce((s, w) => s + w, 0);
        const c = cands.find((_, j) => (x -= poids[j]) < 0) ?? cands.at(-1);
        // Le rôle suivant doit rester possible.
        if (i + 1 >= roles.length || possible(c.a.resultat, roles[i + 1])) choisi = c;
      }
      if (!choisi) return null;
      liste.push({ op: choisi.op, n: choisi.n });
      motifsLignes.push(choisi.a.motifs);
      valeursCol[`${choisi.op}${choisi.n}`] = (valeursCol[`${choisi.op}${choisi.n}`] ?? 0) + 1;
      valeur = choisi.a.resultat;
    }
    const col = { type: 'addsub', lignes: liste, resultat: valeur, motifs: motifsLignes.flat(), motifsLignes, roles };
    const forme = liste.slice(1).map((l) => `${l.op}${l.n}`).join();
    if ((memoire.formes.get(forme) ?? 0) >= repetMax || !colonneValide(col, [cible], true)) return null;
    return { col, forme };
  };

  // Strict d'abord ; puis sans piège, puis sans famille (le geste ne le permet pas toujours).
  // Une forme de colonne ne revient pas sur la planche ; à 1 chiffre, les formes possibles sont
  // peu nombreuses : au plus deux fois, puis sans limite plutôt qu'une planche incomplète.
  const niveaux = [[true, true, 1, 60], [true, true, 2, 40], [false, true, 2, 30], [false, false, 2, 30], [false, false, Infinity, 30]];
  for (const [avecPiege, avecFamille, repetMax, essais] of niveaux) {
    for (let k = 0; k < essais; k++) {
      const r = essayer(avecPiege, avecFamille, repetMax);
      if (!r) continue;
      memoire.formes.set(r.forme, (memoire.formes.get(r.forme) ?? 0) + 1);
      memoire.premiers.add(r.col.lignes[0].n);
      r.col.lignes.slice(1).forEach((l, j) => { if (r.col.roles[j] === 'D') memoire.valeurs[`${l.op}${l.n}`] = (memoire.valeurs[`${l.op}${l.n}`] ?? 0) + 1; });
      return { ...r.col, sansPiege: !avecPiege && pieges.length > 0, sansFamille: mode === 'famille' && !avecFamille };
    }
  }
  throw new ErreurGeneration(`Impossible de former une colonne pour ${cible}`);
}
