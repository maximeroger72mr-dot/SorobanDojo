/**
 * Où en est l'élève dans le parcours, et ce qui en découle :
 *  - gestes appris (pour ne jamais proposer un ami jamais vu) ;
 *  - grade obtenu (épreuves réussies) et prochain grade conseillé (leçons prérequises) ;
 *  - drill d'échauffement, défi de la semaine et gestes à accélérer, ADAPTÉS AU NIVEAU.
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { SOUS_PALIERS, PALIERS } from './curriculum.js';
import { GRADES } from './epreuves.js';
import { famille } from './motifs.js';
import { catalogueDrills } from './drills.js';
import { evaluer } from './maitrise.js';
import { genererColonneVariee, creerMemoire } from './generateur.js';
import { genererMultiplication, genererDivision } from './multiplication.js';
import { avecGraine, semaineISO } from './hasard.js';

const DIRECT = famille('direct');
const ADDSUB = SOUS_PALIERS.filter((sp) => sp.type === 'addsub');
// Les étapes d'anzan ne bloquent pas l'accès aux épreuves.
const idsPaliers = (...ids) => PALIERS.filter((p) => ids.includes(p.id)).flatMap((p) => p.sousPaliers.filter((s) => s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id));

export const estValide = (d, id) => !!d.paliers[id]?.valide;
export const leconsValidees = (d) => SOUS_PALIERS.filter((sp) => estValide(d, sp.id));

/** Gestes des leçons validées, plus les gestes directs. */
export function motifsAppris(d) {
  const s = new Set(DIRECT);
  for (const sp of ADDSUB) if (estValide(d, sp.id)) sp.cibles.forEach((c) => s.add(c));
  return s;
}

/**
 * Leçons à valider avant de tenter chaque grade (repères : additions/soustractions avec tous
 * les amis dès le 10e kyū ; multiplication 2×1 au 10e kyū ; division à partir du 8e kyū).
 */
export const PREREQUIS = {
  10: [...idsPaliers('p1', 'p2', 'p3', 'p4', 'p5'), 'p6-1'],
  9: [...idsPaliers('p1', 'p2', 'p3', 'p4', 'p5'), 'p6-1'],
  8: [...idsPaliers('p1', 'p2', 'p3', 'p4', 'p5'), 'p6-1', 'p6-2', 'p7-1'],
  7: [...idsPaliers('p1', 'p2', 'p3', 'p4', 'p5'), 'p6-1', 'p6-2', 'p6-3', 'p7-1', 'p7-2'],
};
const prerequis = (g) => PREREQUIS[g.id] ?? SOUS_PALIERS.filter((s) => s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id);

/**
 * Grade : le meilleur kyū réussi en épreuve, et le suivant à préparer.
 * @returns {{ obtenu: object|null, prochain: object|null, manquantes: object[], pret: boolean }}
 */
export function grade(d) {
  let obtenu = null;
  for (const g of GRADES) if (d.records[`epreuve-${g.id}`]?.reussi) obtenu = g; // GRADES va du 10e au 1er
  const prochain = obtenu ? GRADES[GRADES.indexOf(obtenu) + 1] ?? null : GRADES[0];
  const manquantes = prochain ? prerequis(prochain).filter((id) => !estValide(d, id)).map((id) => SOUS_PALIERS.find((s) => s.id === id)) : [];
  return { obtenu, prochain, manquantes, pret: !!prochain && manquantes.length === 0 };
}

/** Niveau global de 0 à 1 : part des leçons d'addition/soustraction validées. */
export const niveauAddsub = (d) => ADDSUB.filter((sp) => estValide(d, sp.id)).length / ADDSUB.length;

/** Drill d'échauffement adapté : 1 × 9 au début, jusqu'à 123456789 × 9 aller-retour. */
export function drillEchauffement(d) {
  const drills = catalogueDrills();
  const g = grade(d).obtenu;
  if (g && Number(g.id) <= 6) return drills.find((x) => x.id === '123-9-ar');
  const k = Math.min(9, 1 + Math.floor(niveauAddsub(d) * 8));
  return drills.find((x) => x.id === `123-${k}`);
}

/** Gestes appris (au moins 8 essais réussis) les plus lents : à accélérer. */
export function gestesLents(d, nombre = 3) {
  const appris = motifsAppris(d);
  return Object.entries(d.motifs)
    .filter(([cle]) => appris.has(cle) && !cle.endsWith(':direct'))
    .map(([cle, f]) => ({ cle, ev: evaluer(f.hist ?? []) }))
    .filter(({ ev }) => ev.temps !== null && ev.essais >= 8)
    .sort((a, b) => b.ev.temps - a.ev.temps)
    .slice(0, nombre);
}

/**
 * Défi de la semaine : la même feuille toute la semaine (graine = semaine + niveau),
 * adaptée au niveau : colonnes sur les gestes appris (1 à 3 chiffres selon l'avancement),
 * plus multiplications et divisions si ces leçons sont validées.
 */
export function defiSemaine(d, date) {
  const { cle: semaine } = semaineISO(date);
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const n = niveauAddsub(d);
  const chiffres = n < 0.4 ? 1 : n < 0.8 ? 2 : 3;
  const mul = estValide(d, 'p6-1');
  const div = estValide(d, 'p7-1');
  const palier = `${chiffres}${mul ? 'm' : ''}${div ? 'd' : ''}${amis.length}`;
  const graine = [...`${semaine}-${palier}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sections = avecGraine(graine, () => {
    const memoire = creerMemoire(10);
    const s = [{ titre: 'Colonnes', problemes: Array.from({ length: mul || div ? 6 : 10 }, () => genererColonneVariee({ chiffres, lignes: 5, autorises: appris, cibles: amis.length ? amis : DIRECT }, memoire)) }];
    if (mul) s.push({ titre: 'Multiplications', problemes: Array.from({ length: 2 }, () => genererMultiplication(2, estValide(d, 'p6-3') ? 2 : 1)) });
    if (div) s.push({ titre: 'Divisions', problemes: Array.from({ length: 2 }, () => genererDivision(1, 2)) });
    return s;
  });
  return { cle: `defi-semaine-${semaine}-${palier}`, semaine, sections, description: `${chiffres} chiffre${chiffres > 1 ? 's' : ''}, gestes appris${mul ? ', multiplications' : ''}${div ? ', divisions' : ''}` };
}

/**
 * Anzan du jour, adapté au niveau : plus on a validé d'étapes d'anzan dans le parcours,
 * plus il y a de nombres, plus ils défilent vite, puis on passe à 2 chiffres.
 */
export function anzanAdapte(d) {
  const k = SOUS_PALIERS.filter((sp) => sp.type === 'anzan' && estValide(d, sp.id)).length;
  return {
    mode: k < 2 ? 'image' : 'flash',
    chiffres: k >= 5 ? 2 : 1,
    termes: [3, 4, 5, 5, 7, 5][k],
    duree: [2, 1.5, 1.5, 1, 1, 1.5][k],
    questions: 5,
  };
}

/** L'élève est-il arrivé au cours de multiplication (ou au-delà) ? */
export function coursMultiplicationAtteint(d, prochain) {
  const debut = SOUS_PALIERS.find((s) => s.id === 'p6-a').ordre;
  return (prochain ? prochain.ordre >= debut : true) || !!d.paliers['p6-a'] || !!d.paliers['p6-0'];
}

/**
 * Réflexe de placement (multiplication / division) : proposé seulement une fois arrivé au cours de
 * multiplication, puis maintenu pendant ce cours, celui de division, et 14 jours après la validation
 * du dernier placement, pour l'ancrer profondément.
 * @returns {{ id: string, titre: string } | null}  la leçon de placement à travailler
 */
export function placementDuJour(d, aujourdhuiDate, prochain) {
  if (!coursMultiplicationAtteint(d, prochain)) return null;
  const div = SOUS_PALIERS.find((s) => s.id === 'p7-0');
  const mul = SOUS_PALIERS.find((s) => s.id === 'p6-0');
  // Division dès qu'on a atteint ce cours, sinon multiplication.
  const lecon = prochain && prochain.ordre >= div.ordre ? div : mul;
  const valideLe = d.paliers['p7-0']?.valide;
  if (valideLe && prochain && prochain.palier.id === 'p8') {
    const [a, m, j] = valideLe.split('-').map(Number);
    const ecart = (new Date(`${aujourdhuiDate}T12:00`) - new Date(a, m - 1, j, 12)) / 86400000;
    if (ecart > 14) return null;
  }
  return lecon;
}
