/**
 * Planche entière : les colonnes sont tirées en regardant la PLANCHE, pas seulement la colonne.
 *
 *  - Hasard reproductible : une planche est décrite par ses réglages et sa graine. La même graine
 *    redonne la même planche (pour la rejouer, comparer deux temps, imprimer avec son corrigé).
 *  - Couverture : chaque geste visé qui est réalisable avec ces réglages apparaît au moins une
 *    fois. Tirées une par une, les colonnes oubliaient souvent les gestes rares (+1 grand ami,
 *    qui demande un 9 sur la tige) ; ici les gestes pas encore vus sont favorisés, puis un
 *    rattrapage remplace les colonnes les moins utiles.
 *  - Charge : chaque colonne porte son coût (charge.js) ; les colonnes sont ordonnées en rampe
 *    (deux légères pour s'échauffer, les plus lourdes vers la fin, une moyenne pour finir).
 *  - Bilan : ce que la planche fait travailler, sa charge, ses replis éventuels.
 */

import { genererColonne, genererColonneVariee, genererOperation, creerMemoire, ErreurGeneration } from './generateur.js';
import { genererColonneGeste, creerMemoirePlanche } from './colonneGeste.js';
import { famille } from './motifs.js';
import { coutColonne } from './charge.js';
import { avecGraine, codeDepuisGraine } from './hasard.js';
import { entier } from './aleatoire.js';
import { genererMitori, genererMitoriNegatif } from './epreuves.js';
import { genererColonneDecimale } from './multiplication.js';

const DIRECTS = famille('direct');
const signature = (col) => col.lignes.map((l) => `${l.op}${l.n}`).join();
const compter = (col, vus, sens = 1) => col.motifs.forEach((m) => { vus[m] = (vus[m] ?? 0) + sens; });

/** Gestes visés qu'on peut réellement former avec ces réglages (une cascade est impossible à 1 chiffre). */
export function ciblesRealisables({ chiffres, autorises = null, cibles, zeros = false }) {
  return cibles.filter((c) => {
    try {
      genererOperation({ chiffres, autorises, cibles: [c], zeros });
      return true;
    } catch (e) {
      if (!(e instanceof ErreurGeneration)) throw e;
      return false;
    }
  });
}

/**
 * Ordre en rampe : les deux colonnes les plus légères d'abord, puis de plus en plus lourd, et
 * une colonne moyenne pour finir. En dessous de 8 colonnes, l'ordre du tirage est gardé.
 */
export function ordonnerEnRampe(colonnes) {
  if (colonnes.length < 8) return colonnes;
  const tri = [...colonnes].sort((a, b) => a.cout - b.cout);
  const debut = tri.slice(0, 2);
  const reste = tri.slice(2);
  const [finale] = reste.splice(Math.floor(reste.length / 2), 1);
  return [...debut, ...reste, finale];
}

/** Bilan d'une planche : gestes visés vus, couverture, charge. */
export function bilanPlanche(colonnes, cibles, realisables = cibles, replis = []) {
  const occurrences = {};
  for (const col of colonnes) for (const m of col.motifs) if (cibles.includes(m)) occurrences[m] = (occurrences[m] ?? 0) + 1;
  const absents = realisables.filter((c) => !occurrences[c]);
  const couts = colonnes.map((c) => c.cout);
  const total = couts.reduce((s, x) => s + x, 0);
  return {
    occurrences,
    absents,
    couverture: realisables.length ? 1 - absents.length / realisables.length : 1,
    coutTotal: Math.round(total * 10) / 10,
    coutParColonne: { min: Math.min(...couts), max: Math.max(...couts), moyenne: Math.round((total / colonnes.length) * 10) / 10 },
    replis,
  };
}

/**
 * Planche mélangée (plusieurs gestes visés, ou tous les gestes appris).
 * @param {{chiffres:number, lignes:number, colonnes:number, autorises?:Set|null, cibles:string[], poids?:object, zeros?:boolean, profil?:'rampe'|'plat'}} spec
 * @param {number} graine
 * @returns {{ graine:number, code:string, colonnes:Array, bilan:object }}
 * @throws {ErreurGeneration} si ces réglages ne permettent pas la planche
 */
export function genererPlanche(spec, graine) {
  return avecGraine(graine, () => {
    const { chiffres, lignes, colonnes: nb, autorises = null, cibles, poids = {}, zeros = false, profil = 'rampe', ops } = spec;
    // ops : ['+'] pour une planche d'additions seules (les gestes visés sont alors ceux d'addition).
    const base = { chiffres, lignes, autorises, cibles, zeros, ...(ops ? { ops } : {}) };
    const realisables = ciblesRealisables(base);
    const vus = {};
    // Un geste pas encore vu sur la planche passe devant ; un geste déjà vu recule.
    const poidsPlanche = (dus = null) => Object.fromEntries(cibles.map((c) => {
      const w = poids[c] ?? 1;
      if (dus) return [c, dus.includes(c) ? 40 * w : 0.2 * w];
      return [c, vus[c] ? w / (1 + vus[c]) : 4 * w];
    }));
    const memoire = creerMemoire(nb);
    const cols = [];
    const sigs = new Set();
    const premiers = new Set();
    for (let k = 0; cols.length < nb && k < nb * 6; k++) {
      const col = genererColonneVariee({ ...base, poids: poidsPlanche() }, memoire);
      const sig = signature(col);
      // Jamais deux colonnes identiques ; premiers nombres tous différents tant que c'est possible.
      if (sigs.has(sig) || (premiers.has(col.lignes[0].n) && k < nb * 3)) continue;
      sigs.add(sig);
      premiers.add(col.lignes[0].n);
      compter(col, vus);
      cols.push(col);
    }
    if (cols.length < nb) throw new ErreurGeneration('pas assez de colonnes différentes');

    // Rattrapage : tant qu'un geste réalisable manque, on remplace la colonne dont le retrait
    // ne fait disparaître aucun autre geste par une colonne qui apporte le geste manquant.
    const manquants = () => realisables.filter((c) => !vus[c]);
    for (let passe = 0; passe < 4 * nb && manquants().length; passe++) {
      const dus = manquants();
      let nouvelle = null;
      for (let e = 0; e < 6; e++) {
        let col;
        try { col = genererColonne({ ...base, poids: poidsPlanche(dus) }); } catch (err) { if (!(err instanceof ErreurGeneration)) throw err; continue; }
        const gain = dus.filter((c) => col.motifs.includes(c)).length;
        if (!gain || sigs.has(signature(col)) || cols.some((x) => x.resultat === col.resultat)) continue;
        if (!nouvelle || gain > nouvelle.gain) nouvelle = { col, gain };
      }
      if (!nouvelle) continue;
      // Perte d'une colonne : nombre de gestes visés qu'elle est seule à porter.
      const perte = (col) => new Set(col.motifs.filter((m) => realisables.includes(m) && vus[m] - col.motifs.filter((x) => x === m).length <= 0)).size;
      let j = 0;
      for (let i = 1; i < cols.length; i++) if (perte(cols[i]) < perte(cols[j])) j = i;
      if (perte(cols[j]) >= nouvelle.gain) continue;
      sigs.delete(signature(cols[j]));
      compter(cols[j], vus, -1);
      cols[j] = nouvelle.col;
      sigs.add(signature(nouvelle.col));
      compter(nouvelle.col, vus);
    }

    for (const col of cols) col.cout = coutColonne(col.lignes);
    const replis = [];
    const impossibles = cibles.filter((c) => !realisables.includes(c));
    if (impossibles.length) replis.push({ type: 'impossibles', cibles: impossibles });
    if (cols.some((c) => c.assoupli)) replis.push({ type: 'assoupli' });
    const ordonnees = profil === 'rampe' ? ordonnerEnRampe(cols) : cols;
    return { graine, code: codeDepuisGraine(graine), colonnes: ordonnees, bilan: bilanPlanche(ordonnees, cibles, realisables, replis) };
  });
}

/**
 * Planche sur UN geste (colonnes construites par rôles : geste, piège, famille, directs).
 * Une colonne qui ne se forme pas est remplacée par une colonne simple sur ce geste (le geste
 * et des gestes directs) : la planche n'est plus abandonnée pour une seule colonne.
 * @param {{cible:string, mode:'seul'|'famille', chiffres:number, lignes:number, colonnes:number, appris:Set<string>}} spec
 * @returns {{ graine, code, colonnes, bilan } | null}  null : ce geste ne permet aucune colonne ainsi
 */
export function genererPlancheGeste(spec, graine) {
  return avecGraine(graine, () => {
    const { cible, mode = 'seul', chiffres, lignes, colonnes: nb, appris } = spec;
    const memoire = creerMemoirePlanche();
    const cols = [];
    let simples = 0;
    for (let k = 0; k < nb; k++) {
      const n = Math.max(4, lignes + entier(-1, 1)); // longueurs mélangées autour du réglage
      let col = null;
      for (let e = 0; e < 20 && !col; e++) {
        try { col = genererColonneGeste({ cible, mode, chiffres, lignes: n, appris }, memoire); } catch (err) { if (!(err instanceof ErreurGeneration)) throw err; }
      }
      for (let e = 0; e < 10 && !col; e++) {
        try {
          const c = genererColonne({ chiffres, lignes: n, autorises: new Set([...DIRECTS, cible]), cibles: [cible] });
          if (!cols.some((x) => signature(x) === signature(c))) { col = { ...c, simple: true }; simples += 1; }
        } catch (err) { if (!(err instanceof ErreurGeneration)) throw err; }
      }
      if (!col) return null;
      col.cout = coutColonne(col.lignes);
      cols.push(col);
    }
    // Une planche faite surtout de colonnes simples n'est plus une planche « par rôles ».
    if (simples > nb / 2) return null;
    const replis = [];
    if (simples) replis.push({ type: 'simples', nombre: simples });
    if (cols.some((c) => c.sansFamille)) replis.push({ type: 'sansFamille' });
    return { graine, code: codeDepuisGraine(graine), colonnes: cols, bilan: bilanPlanche(cols, [cible], [cible], replis) };
  });
}

/** Genres de planche qui ne passent pas par le planificateur de gestes. */
export const GENRES_PLANCHE = {
  melees: 'Longueurs mêlées (comme en compétition)',
  examen: 'Format d\'examen : 6 additions seules, 4 mêlées',
  negatifs: 'Résultats négatifs',
  decimaux: 'Décimaux',
};

/**
 * Planche « spéciale » : même code rejouable, mais des colonnes tirées au format des examens.
 *  - melees : dans une même colonne, des nombres de 3 chiffres (ou moins) jusqu'au réglage :
 *    859, 768 024, 7 845… Savoir où poser chaque nombre est une compétence de lecture à part ;
 *  - examen : lignes de longueur fixe, 6 colonnes d'additions seules sur 10, puis des mêlées ;
 *  - negatifs : le total passe sous zéro (complément) ;
 *  - decimaux : additions et soustractions de décimaux, à aligner sur le point des unités.
 * @param {{genre:string, chiffres:number, lignes:number, colonnes:number}} spec
 * @returns {{ graine, code, colonnes, bilan:null, speciale:true }}
 */
export function genererPlancheSpeciale(spec, graine) {
  return avecGraine(graine, () => {
    const { genre, chiffres, lignes, colonnes: nb } = spec;
    const fixe = { lignes, min: chiffres, max: chiffres, soustractions: lignes >= 3 };
    const une = (k) => {
      if (genre === 'melees') return genererMitori({ lignes, min: Math.min(3, chiffres), max: chiffres, soustractions: lignes >= 3 });
      if (genre === 'negatifs') return genererMitoriNegatif({ lignes: Math.max(2, lignes), min: chiffres, max: chiffres });
      if (genre === 'decimaux') return genererColonneDecimale(lignes, Math.max(2, Math.min(6, chiffres)), 2);
      return genererMitori(k < Math.round(nb * 0.6) ? { ...fixe, soustractions: false } : fixe);
    };
    const cols = [];
    const sigs = new Set();
    for (let e = 0; cols.length < nb && e < nb * 20; e++) {
      const col = une(cols.length);
      const sig = signature(col);
      if (sigs.has(sig)) continue;
      sigs.add(sig);
      cols.push(col);
    }
    if (cols.length < nb) throw new ErreurGeneration('pas assez de colonnes différentes');
    return { graine, code: codeDepuisGraine(graine), colonnes: cols, bilan: null, speciale: true };
  });
}
