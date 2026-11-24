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

import { analyserOperation, colonneValide, ErreurGeneration, horsDelai, DIZAINES, PART_INVERSE, chiffresIdentiques, cleDe } from './generateur.js';
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
  return { formes: new Map(), valeurs: {}, premiers: new Set(), resultats: new Map() };
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
    // 0.40.12 : pas de 44, 88, 999 (le chiffre du geste copié sur toutes les tiges en faisait souvent).
    if (chiffresIdentiques(n)) continue;
    // 0.40.16 : nombres ronds (+20, −40) : 18 à 33 % des lignes à 2 chiffres (contre 6 à 13 % dans les
    // leçons) ; trois sur quatre écartés, sauf quand le chiffre du geste est lui-même 0.
    if (n % 10 === 0 && d !== 0 && Math.random() < 0.75) continue;
    res.push({ op: hasard(ops), n });
  }
  return res;
}

/**
 * 0.40.16 : analyserOperation est pure et coûteuse (un soroban par appel) ; une colonne en refait des
 * milliers sur les mêmes valeurs (à 1 chiffre, une centaine de valeurs possibles). Mémoire bornée.
 * Avant, une planche de 10 colonnes de +1 ou +3 petit ami à 1 chiffre dépassait la seconde allouée.
 */
const memoOperations = new Map();
function operationMemo(valeur, op, n, nbTiges) {
  // Clé numérique quand c'est possible (0.40.17 : la clé texte coûtait plus que le calcul évité).
  const cle = valeur < 1e7 && n < 1e5 && nbTiges < 32 ? ((valeur * 2 + (op === '+' ? 1 : 0)) * 1e5 + n) * 32 + nbTiges : `${valeur}${op}${n}|${nbTiges}`;
  if (memoOperations.has(cle)) return memoOperations.get(cle);
  if (memoOperations.size > 200000) memoOperations.clear();
  const a = analyserOperation(valeur, op, n, nbTiges);
  memoOperations.set(cle, a);
  return a;
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
  const inverse = opG === '+' ? '-' : '+';
  const permisF = new Set(autresFamille);
  const famillesF = autresFamille.map(analyserMotif);

  /**
   * 0.40.17 : à 2 chiffres et plus, candidats construits TIGE PAR TIGE (avant : 50 nombres au hasard,
   * gardés s'ils convenaient). Un nombre de 3 chiffres dont chaque tige fait un geste direct est rare
   * au hasard : « +1 petit ami seul, 3 chiffres, 10 lignes » ne se formait pas en 10 s, et la planche
   * allongeait ses colonnes faute de mieux (35 % de colonnes allongées). Ici, une tige reçoit le geste
   * du rôle (geste, piège, famille), les autres un chiffre qui y fait un geste direct (ou 0).
   * analyserOperation garde le dernier mot (retenues, emprunts, cascades).
   */
  const chiffreDe = (v, i) => Math.floor(v / 10 ** (chiffres - 1 - i)) % 10;
  // Chiffres de tige où le geste travaillé est possible (−2 petit ami : 5 à 6…).
  const tigesGeste = new Set([...Array(10).keys()].filter((x) => cleDe(opG, x, dG) === cible));
  // Chiffres (1 à 9) qui font un geste direct sur une tige qui vaut c (sans le piège pour une ligne directe).
  const tableDirects = new Map();
  const directsTige = (op, c, sansPiege) => {
    const cle = `${op}${c}${sansPiege ? 'd' : ''}`;
    if (!tableDirects.has(cle)) tableDirects.set(cle, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => { const k = cleDe(op, c, d); return DIRECTS.has(k) && !(sansPiege && permisP.has(k)); }));
    return tableDirects.get(cle);
  };
  function candidatsTiges(valeur, role, suivant) {
    const res = [];
    const vus = new Set();
    const cs = [...Array(chiffres).keys()].map((i) => chiffreDe(valeur, i));
    for (let k = 0; k < 36 && res.length < 20; k++) {
      let op = role === 'D' ? hasard(['+', '-']) : opG;
      // 0.40.17 : nombres ronds. Une tige des unités sans chiffre direct (9 en addition, 0 en soustraction,
      // fréquent avec ±1 grand ami) forçait un 0 : 22 à 32 % de lignes rondes à 2 chiffres. Ligne directe :
      // l'autre sens, trois fois sur quatre ; geste : sur la tige des unités, de préférence.
      const unites = cs[chiffres - 1];
      if (role === 'D' && !directsTige(op, unites, true).length && directsTige(op === '+' ? '-' : '+', unites, true).length && Math.random() < 0.75) op = op === '+' ? '-' : '+';
      let central = null; // [tige, chiffre]
      if (role !== 'D') {
        let vise = (c) => c === cible;
        let dV = dG;
        if (role === 'P') vise = (c) => permisP.has(c);
        if (role === 'F') { const f = hasard(famillesF); op = f.op; dV = f.d; vise = (c) => c === `${f.op}${f.d}:${f.regle}`; }
        const tiges = cs.map((c, i) => i).filter((i) => (i > 0 || dV > 0) && vise(cleDe(op, cs[i], dV)));
        if (!tiges.length) { if (role === 'F') continue; break; }
        const bloquee = tiges.includes(chiffres - 1) && !directsTige(op, unites, false).length && Math.random() < 0.85;
        central = [bloquee ? chiffres - 1 : hasard(tiges), dV];
      }
      // Le geste vient à la ligne suivante : une ligne sur deux amène une tige sur un chiffre où il sera
      // possible (sinon, au hasard, ±9 combiné, qui demande un 5 ou un 4 sur la tige, devenait rare).
      let oriente = -1;
      let dOriente = 0;
      if (suivant === 'G' && k % 2 === 0) {
        const choix = [];
        cs.forEach((c, i) => {
          if (central && i === central[0]) return;
          for (let d = i === 0 ? 1 : 0; d <= 9; d++) {
            const x = op === '+' ? c + d : c - d;
            if (x < 0 || x > 9 || !tigesGeste.has(x)) continue;
            if ((d === 0 && i > 0) || directsTige(op, c, false).includes(d)) choix.push([i, d]);
          }
        });
        if (choix.length) [oriente, dOriente] = hasard(choix);
      }
      const t = [];
      for (let i = 0; i < chiffres; i++) {
        if (central && i === central[0]) { t.push(central[1]); continue; }
        if (i === oriente) { t.push(dOriente); continue; }
        // Le geste sur une seconde tige (−22, −12), parfois.
        if (role === 'G' && Math.random() < 0.3 && cleDe(op, cs[i], dG) === cible) { t.push(dG); continue; }
        // 0 sur une tige : moins souvent (nombres ronds, 305…).
        const sans0 = directsTige(op, cs[i], role === 'D');
        if (!sans0.length && i === 0) break;
        t.push(sans0.length && Math.random() < 0.8 ? hasard(sans0) : i === 0 ? hasard(sans0) : Math.random() < 1 / (sans0.length + 1) ? 0 : hasard(sans0));
      }
      if (t.length < chiffres) continue;
      const n = Number(t.join(''));
      if (n < 10 ** (chiffres - 1) || chiffresIdentiques(n)) continue;
      if (n % 10 === 0 && dG !== 0 && Math.random() < 0.75) continue;
      const cle = `${op}${n}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      res.push({ op, n });
    }
    return res;
  }

  const cacheLignes = chiffres === 1 ? (memoire.lignes ??= new Map()) : new Map();
  const essayer = (avecPiege, avecFamille, repetMax, avecDizaine = true) => {
    const ops = lignes - 1;
    // Le geste 2 fois ; 3 sur une colonne de 7 lignes à 2 chiffres et plus. À 1 chiffre, toujours
    // 2 : le piège porte la même valeur (« −2 »), il faut lui laisser de la place.
    // 0.40.16 : colonnes de 8 lignes et plus : 2 à 4 fois, au hasard (avant : toujours le même nombre).
    const base = Math.min(lignes >= 7 && chiffres >= 2 ? 3 : 2, Math.ceil(ops / 2));
    const nG = lignes >= 8 ? entier(Math.min(2, base), Math.max(base, Math.min(4, Math.ceil(ops / 2) - 1))) : base;
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
      // 0.40.17 : une colonne qui finit par le geste finit presque toujours sur le même chiffre des unités
      // (+1 grand ami : toujours 0) : à partir de 6 lignes, une fin sur une autre ligne est préférée.
      if (r.every((x, i) => !(x === 'G' && r[i - 1] === 'G')) && !(lignes >= 6 && r.at(-1) === 'G' && k < 25 && Math.random() < 0.7)) roles = r;
    }
    if (!roles) return null;
    // 0.40.7 : à 1 chiffre, une ligne directe (au hasard) devient, si possible, une ligne de dizaines.
    const iZ = chiffres === 1 && avecDizaine ? roles.map((r, i) => (r === 'D' ? i : -1)).filter((i) => i > 0) : [];
    const posZ = iZ.length ? iZ[entier(0, iZ.length - 1)] : -1;
    const quotaInverse = Math.floor(PART_INVERSE * (lignes - 1) + Math.random());

    const convient = (role, a) => {
      const ms = a.motifs;
      if (!ms.length) return false;
      if (role === 'G') return ms.includes(cible) && ms.every((m) => m === cible || DIRECTS.has(m));
      if (ms.includes(cible)) return false;
      if (role === 'P') return ms.some((m) => permisP.has(m)) && ms.every((m) => permisP.has(m) || DIRECTS.has(m));
      if (role === 'F') return ms.some((m) => permisF.has(m)) && ms.every((m) => permisF.has(m) || DIRECTS.has(m));
      return ms.every((m) => DIRECTS.has(m) && !permisP.has(m));
    };
    const ligneDe = (valeur, role, suivant = null) => {
      // 0.40.17 : lignes possibles mises en mémoire par valeur et rôle (pour toute la planche à 1 chiffre,
      // où elles ne dépendent que de la valeur ; pour la colonne au-delà, où elles sont tirées au hasard).
      const vers = chiffres > 1 && suivant === 'G' ? 'G' : '';
      const cle = `${role}${valeur}${vers}`;
      let r = cacheLignes.get(cle);
      if (!r) cacheLignes.set(cle, (r = ligneDeCalcul(valeur, role, vers)));
      return r;
    };
    const ligneDeCalcul = (valeur, role, vers) => {
      // 0.40.7 : ligne de dizaines (−10 à −40 sur une planche d'addition, +10 à +40 en soustraction).
      if (role === 'Z') return DIZAINES.map((n) => ({ op: inverse, n, a: operationMemo(valeur, inverse, n, nbTiges) })).filter((c) => c.a && c.a.resultat >= 0 && convient('D', c.a));
      const opR = role === 'G' || role === 'P' ? opG : null;
      return (chiffres === 1 ? candidats(chiffres, opR, role === 'G' || role === 'P' ? dG : undefined) : candidatsTiges(valeur, role, vers))
        .map((c) => ({ ...c, a: operationMemo(valeur, c.op, c.n, nbTiges) }))
        .filter((c) => c.a && c.a.resultat >= 0 && convient(role, c.a));
    };
    const possible = (valeur, role) => ligneDe(valeur, role).length > 0;
    // 0.40.17 : à 1 chiffre, on vérifie que la FIN de la colonne reste faisable (recherche en profondeur,
    // mise en mémoire par valeur et rang) : le chemin entre deux gestes est souvent unique (+1 petit ami
    // en 5 lignes n'a que « +1 −5 +4 +1 » et « +1 +4 −5 +1 ») ; avant, on ne regardait qu'une ligne plus
    // loin : une ligne sur deux menait à une impasse et la colonne s'allongeait. À 2 chiffres et plus,
    // les chemins sont nombreux : une ligne plus loin suffit.
    const memoFaisable = new Map();
    const faisable = (valeur, j) => {
      if (j >= roles.length) return true;
      if (chiffres > 1) return possible(valeur, roles[j]);
      const cle = valeur * 64 + j;
      if (!memoFaisable.has(cle)) {
        memoFaisable.set(cle, false); // (pas de cycle : le rang avance)
        memoFaisable.set(cle, ligneDe(valeur, roles[j]).some((c) => faisable(c.a.resultat, j + 1)));
      }
      return memoFaisable.get(cle);
    };

    // Premier nombre posé : le premier rôle doit y être possible ; jamais deux fois le même.
    let depart = null;
    for (let k = 0; k < 60 && depart === null; k++) {
      // 0.40.8 : planche de soustraction à 2 chiffres et plus : toujours une tige de plus en tête, et
      // haute (5 à 9) ; sinon le total s'épuisait vite et il fallait le remonter par des additions
      // (−9 grand ami à 2 chiffres : 36 à 45 % d'additions).
      const tete = opG === '-' && chiffres >= 2 ? entier(5, 9) * 10 ** chiffres : Math.random() < 0.5 ? entier(1, 9) * 10 ** chiffres : 0;
      const v = chiffres === 1 ? (Math.random() < 0.75 ? entier(1, 9) * 10 : 0) + entier(0, 9) : entier(10 ** (chiffres - 1), 10 ** chiffres - 1) + tete;
      // 0.40.16 : premier nombre jamais deux fois sur la planche, sauf aux derniers niveaux (forme
      // répétable) : à 1 chiffre, +1 petit ami n'a que 10 départs possibles (4, 14 … 94).
      // 0.40.17 : même aux derniers niveaux, un premier nombre neuf d'abord (le total « 5 » revenait 4 fois).
      if (v < 1 || ((repetMax !== Infinity || k < 40) && memoire.premiers.has(v))) continue;
      if (faisable(v, 0)) depart = v;
    }
    if (depart === null) return null;

    const liste = [{ op: '+', n: depart }];
    const motifsLignes = [[]];
    const valeursCol = {};
    let valeur = depart;
    for (const [i, role0] of roles.entries()) {
      const prec = liste.length > 1 ? liste.at(-1) : null;
      const prec2 = liste.length > 2 ? liste.at(-2) : null;
      // 0.40.8 : quota de lignes de sens inverse (PART_INVERSE des lignes) : atteint, plus de ligne de
      // dizaines ni de ligne directe inverse favorisée (petits amis : beaucoup de soustractions
      // venaient déjà d'elles-mêmes, la ligne de dizaines s'y ajoutait, et le geste visé se diluait).
      const inv = liste.slice(1).filter((l) => l.op === inverse).length;
      const quotaAtteint = inv >= quotaInverse;
      const role = i === posZ && !quotaAtteint && prec?.op !== inverse && ligneDe(valeur, 'Z').some((c) => faisable(c.a.resultat, i + 1)) ? 'Z' : role0;
      // 0.40.16 : planche d'addition : jamais deux soustractions de suite ; quota de soustractions
      // atteint : plus de soustraction (avant, un simple poids : 34 à 95 paires sur 120 colonnes de
      // +9 grand ami à 10 lignes, et 34 à 42 % de lignes inverses).
      // Planche de soustraction : les additions restent au simple poids (le total doit pouvoir remonter).
      // 0.40.17 : planche de soustraction à 7 lignes et plus : jamais deux additions de suite non plus (35 à
      // 46 % d'additions avant) ; plus courte, elles restent permises (le total doit pouvoir remonter).
      const interdite = (c) => c.op === inverse && (opG === '+' ? prec?.op === inverse || quotaAtteint : lignes >= 7 && (prec?.op === inverse || inv > quotaInverse));
      const cands = ligneDe(valeur, role, roles[i + 1]).filter((c) => {
        if (interdite(c)) return false;
        const v = `${c.op}${c.n}`;
        if (prec && prec.n === c.n) return false; // ni répétition, ni annulation (+2 −2)
        if (prec2 && liste.length > 3 && `${prec2.op}${prec2.n}` === v && `${liste.at(-3).op}${liste.at(-3).n}` === `${prec.op}${prec.n}`) return false;
        if ((valeursCol[v] ?? 0) + 1 > Math.floor(lignes / 2)) return false;
        // Directs : valeurs toutes différentes. 0.40.17 : à 1 chiffre, une valeur peut revenir une fois
        // (en dernier recours, voir les poids) : il n'y a que 9 valeurs directes par sens, et les
        // colonnes longues de +9 combiné (« +5 −4 » entre deux gestes) n'avaient plus d'issue.
        if (role === 'D' && valeursCol[v] && (chiffres > 1 || valeursCol[v] >= 2)) return false;
        return true;
      });
      if (!cands.length) return null;
      // Poids : les valeurs directes déjà très vues sur la planche passent derrière ; le geste et
      // le piège changent de forme dans la colonne quand c'est possible (−2, −12, −20…).
      // 0.40.7 : les lignes directes changent plus souvent de sens que le geste (soustraction sur une
      // planche d'addition…), mais jamais deux lignes de sens inverse de suite.
      // 0.40.17 : quand il reste autant de lignes inverses à placer que de lignes directes, l'inverse passe
      // nettement devant (planches d'addition à 5 lignes : 5 à 10 % de lignes inverses avant).
      const restantD = roles.slice(i).filter((x) => x === 'D').length;
      const presse = quotaInverse - inv >= restantD;
      const sensD = (c) => (c.op !== inverse ? 1 : prec?.op === inverse || quotaAtteint ? 0.1 : presse ? 12 : 2.5);
      // 0.40.17 : nombres ronds (+20, −40) à 2 chiffres et plus : poids divisé par 6 (22 à 32 % des lignes
      // de ±1 grand ami à 2 chiffres : la tige des unités n'avait souvent aucun chiffre direct possible).
      const rond = (c) => (chiffres > 1 && c.n % 10 === 0 ? 1 / 6 : 1);
      const poids = cands.map((c) => rond(c) * (role === 'D' ? (valeursCol[`${c.op}${c.n}`] ? 0.01 : 1) * sensD(c) / (1 + (memoire.valeurs[`${c.op}${c.n}`] ?? 0)) ** 2 : valeursCol[`${c.op}${c.n}`] ? 0.1 : 1));
      // Tirage pondéré SANS remise : un candidat qui mène à une impasse est retiré, on retire au sort
      // parmi les autres. 0.40.17 : avant, 8 tirages avec remise : une valeur déjà très vue sur la
      // planche (poids minuscule) n'était presque jamais tirée, même quand elle était la seule issue.
      let choisi = null;
      const restants = cands.map((c, j) => [c, poids[j]]);
      for (let k = 0; k < (chiffres === 1 ? 18 : 10) && !choisi && restants.length; k++) {
        let x = Math.random() * restants.reduce((s, [, w]) => s + w, 0);
        let j = restants.findIndex(([, w]) => (x -= w) < 0);
        if (j < 0) j = restants.length - 1;
        const [[c]] = restants.splice(j, 1);
        // Le rôle suivant doit rester possible.
        if (faisable(c.a.resultat, i + 1)) choisi = c;
      }
      if (!choisi) return null;
      liste.push({ op: choisi.op, n: choisi.n });
      motifsLignes.push(choisi.a.motifs);
      valeursCol[`${choisi.op}${choisi.n}`] = (valeursCol[`${choisi.op}${choisi.n}`] ?? 0) + 1;
      valeur = choisi.a.resultat;
    }
    const col = { type: 'addsub', lignes: liste, resultat: valeur, motifs: motifsLignes.flat(), motifsLignes, roles };
    const forme = liste.slice(1).map((l) => `${l.op}${l.n}`).join();
    if ((memoire.formes.get(forme) ?? 0) >= repetMax) return 'forme';
    // 0.40.17 : un même résultat au plus deux fois sur la planche, tant que les formes sont libres
    // (15 à 25 résultats identiques sur 40 à 60 colonnes à 1 chiffre).
    if (repetMax !== Infinity && (memoire.resultats.get(valeur) ?? 0) >= repetMax) return 'forme';
    if (!colonneValide(col, [cible], true)) return null;
    return { col, forme };
  };

  // Strict d'abord ; puis sans piège, puis sans famille (le geste ne le permet pas toujours).
  // Une forme de colonne ne revient pas sur la planche ; à 1 chiffre, les formes possibles sont
  // peu nombreuses : au plus deux fois, puis sans limite plutôt qu'une planche incomplète.
  // 0.40.7 : la ligne de dizaines est un plus : les derniers niveaux s'en passent.
  const niveaux = [[true, true, 1, 60, true], [true, true, 1, 40, false], [false, true, 1, 30, false], [true, true, 2, 40, true], [false, true, 2, 30, true], [false, false, 2, 30, false], [false, false, Infinity, 30, false], [true, true, Infinity, 60, false]];
  // 0.40.17 : une colonne de la planche a dû descendre au niveau k : les suivantes partent de ce niveau
  // (les niveaux plus stricts sont retentés une fois sur trois). Avant, chaque colonne reprenait tous
  // les niveaux impossibles (sans piège, formes épuisées) : 40 à 120 ms par colonne pour rien.
  const depuis = Math.random() < 0.3 ? 0 : (memoire.niveau ?? 0);
  for (const [idx, [avecPiege, avecFamille, repetMax, essais, avecDizaine]] of niveaux.entries()) {
    if (idx < depuis) continue;
    let dejaVues = 0;
    for (let k = 0; k < essais; k++) {
      const r = essayer(avecPiege, avecFamille, repetMax, avecDizaine);
      // 0.40.17 : forme déjà sur la planche 6 fois à ce niveau : les formes possibles sont épuisées,
      // niveau suivant tout de suite (avant : tous les essais du niveau étaient brûlés).
      if (r === 'forme') { if (++dejaVues >= 6) break; continue; }
      if (!r) continue;
      memoire.niveau = idx;
      memoire.formes.set(r.forme, (memoire.formes.get(r.forme) ?? 0) + 1);
      memoire.premiers.add(r.col.lignes[0].n);
      memoire.resultats.set(r.col.resultat, (memoire.resultats.get(r.col.resultat) ?? 0) + 1);
      r.col.lignes.slice(1).forEach((l, j) => { if (r.col.roles[j] === 'D') memoire.valeurs[`${l.op}${l.n}`] = (memoire.valeurs[`${l.op}${l.n}`] ?? 0) + 1; });
      return { ...r.col, sansPiege: !avecPiege && pieges.length > 0, sansFamille: mode === 'famille' && !avecFamille };
    }
  }
  throw new ErreurGeneration(`Impossible de former une colonne pour ${cible}`);
}
