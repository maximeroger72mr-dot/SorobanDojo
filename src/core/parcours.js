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
import { famille, nomMotif } from './motifs.js';
import { catalogueDrills } from './drills.js';
import { evaluer, plateau } from './maitrise.js';
import { genererColonneVariee, creerMemoire } from './generateur.js';
import { genererMultiplication, genererDivision } from './multiplication.js';
import { avecGraine, semaineISO } from './hasard.js';

const DIRECT = famille('direct');
const ADDSUB = SOUS_PALIERS.filter((sp) => sp.type === 'addsub');
// Les étapes d'anzan ne bloquent pas l'accès aux épreuves.
const idsPaliers = (...ids) => PALIERS.filter((p) => ids.includes(p.id)).flatMap((p) => p.sousPaliers.filter((s) => !p.mental && s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id));

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
const prerequis = (g) => PREREQUIS[g.id] ?? SOUS_PALIERS.filter((s) => !s.mental && !s.optionnel && s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id);

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
/** Format des colonnes du défi de la semaine (et de son étoile « sans filet »). */
export function formatSemaine(d) {
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const n = niveauAddsub(d);
  return { appris, amis, chiffres: n < 0.4 ? 1 : n < 0.8 ? 2 : 3 };
}

export function defiSemaine(d, date) {
  const { cle: semaine } = semaineISO(date);
  const { appris, amis, chiffres } = formatSemaine(d);
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
  // Progression lente : on allonge la chaîne avant d'accélérer, et l'image d'aide reste longtemps.
  const k = Math.min(6, SOUS_PALIERS.filter((sp) => sp.type === 'anzan' && estValide(d, sp.id)).length);
  return {
    mode: k < 3 ? 'image' : 'flash',
    chiffres: k >= 6 ? 2 : 1,
    termes: [3, 3, 4, 5, 5, 6, 3][k],
    duree: [3, 2.5, 2.5, 2, 2, 1.5, 3][k],
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

// ------------------------------------------------------------------ plateaux et priorité du jour

/**
 * Plateaux : gestes et leçons dont le temps médian ne baisse plus depuis 2 semaines ou plus
 * (voir maitrise.plateau). Les gestes déjà au niveau expert ne sont pas concernés.
 * @returns {Array<{ type: 'geste'|'lecon', cle: string, nom: string, avant: number, maintenant: number, semaines: number }>}
 */
export function plateaux(d, date) {
  const liste = [];
  for (const [cle, f] of Object.entries(d.motifs)) {
    if (cle.endsWith(':direct') || evaluer(f.hist ?? []).niveau.id === 'expert') continue;
    const p = plateau(f.sem, date);
    if (p) liste.push({ type: 'geste', cle, nom: nomMotif(cle), ...p });
  }
  for (const [id, e] of Object.entries(d.paliers)) {
    const sp = SOUS_PALIERS.find((s) => s.id === id);
    if (!sp || sp.type !== 'addsub' || evaluer(e.hist ?? []).niveau.id === 'expert') continue;
    const p = plateau(e.sem, date);
    if (p) liste.push({ type: 'lecon', cle: id, nom: `la leçon « ${sp.titre} »`, cibles: sp.cibles, ...p });
  }
  return liste.sort((a, b) => b.maintenant / b.avant - a.maintenant / a.avant);
}

const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const jourDe = (date) => Math.floor(new Date(`${date}T12:00`).getTime() / 86400000);

/**
 * Priorité du jour : UNE consigne franche, chiffrée, avec le bon outil.
 *  1. un plateau → un remède, qui change d'un jour à l'autre : surentraînement (moins de chiffres,
 *     plus vite, au rythme du lièvre), marathon sur le geste, ou drill rythmé au métronome ;
 *  2. sinon un geste en difficulté (erreurs avérées) → marathon de 40 lignes pour l'ancrer ;
 *  3. sinon le geste appris le plus lent → marathon de 40 lignes pour l'accélérer.
 * @returns {{ titre, texte, raison, aller: [string, object] } | null}
 */
export function prioriteDuJour(d, date, difficiles = []) {
  const p = plateaux(d, date)[0];
  if (p) {
    const cibles = p.type === 'geste' ? [p.cle] : p.cibles;
    const constat = `${p.nom[0].toUpperCase()}${p.nom.slice(1)} stagne : ${nf(p.maintenant)} s par chiffre, contre ${nf(p.avant)} s il y a ${p.semaines} semaines.`;
    const remedes = [
      { titre: 'Casser le plateau : surentraînement', texte: 'Moins de chiffres, plus vite : 6 colonnes à 1 chiffre au rythme du lièvre, qui accélère. Le geste doit partir sans réfléchir.', aller: ['rythme', { jeu: 'lievre', cibles, chiffres: 1, accelere: true, auto: true }] },
      { titre: 'Casser le plateau : marathon', texte: '40 lignes d\'affilée sur ce geste, sans remettre à zéro. Le volume ancre le mouvement.', aller: ['rythme', { jeu: 'marathon', cibles, lignes: 40, auto: true }] },
      { titre: 'Casser le plateau : drill rythmé', texte: 'Un drill au métronome : un geste par temps, sans accélérer ni ralentir. La régularité débloque souvent la vitesse.', aller: ['drills', { drill: drillEchauffement(d).id, priorite: true }] },
    ];
    const r = remedes[jourDe(date) % remedes.length];
    return { ...r, raison: constat };
  }
  const faible = difficiles.find((m) => !m.cle.endsWith(':direct'));
  if (faible) {
    return {
      titre: 'Ancrer un geste', raison: `${nomMotif(faible.cle)} : ${faible.erreurs} erreur${faible.erreurs > 1 ? 's' : ''} récente${faible.erreurs > 1 ? 's' : ''}.`,
      texte: `Faites 40 lignes de marathon sur ${nomMotif(faible.cle)} aujourd'hui, avec le rappel doigté si besoin.`,
      aller: ['rythme', { jeu: 'marathon', cibles: [faible.cle], lignes: 40, auto: true }],
    };
  }
  const lent = gestesLents(d, 1)[0];
  if (lent && lent.ev.niveau.id !== 'expert') {
    return {
      titre: 'Accélérer un geste', raison: `${nomMotif(lent.cle)} est votre geste le plus lent : ${nf(lent.ev.temps)} s par chiffre.`,
      texte: `Faites 40 lignes de marathon sur ${nomMotif(lent.cle)} aujourd'hui.`,
      aller: ['rythme', { jeu: 'marathon', cibles: [lent.cle], lignes: 40, auto: true }],
    };
  }
  return null;
}

// ------------------------------------------------------------------ objectif choisi

/**
 * Plan à rebours vers un grade choisi pour une date : leçons restantes, rythme nécessaire par
 * semaine, rythme réellement mesuré (leçons validées les 4 dernières semaines), temps conseillé
 * par jour, et verdict (réaliste ou non).
 * @param {string} gradeId  ex. '6'
 * @param {string} dateCible, date  AAAA-MM-JJ
 */
export function planObjectif(d, gradeId, dateCible, date) {
  const g = GRADES.find((x) => x.id === gradeId);
  if (!g) return null;
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const reussi = !!d.records[`epreuve-${g.id}`]?.reussi;
  const manquantes = prerequis(g).filter((id) => !estValide(d, id)).length;
  const jours = Math.round((jour(dateCible) - jour(date)) / 86400000);
  const semaines = Math.max(1 / 7, jours / 7);
  const parSemaine = manquantes / semaines;
  const recentes = SOUS_PALIERS.filter((sp) => !sp.mental && d.paliers[sp.id]?.valide && jour(date) - jour(d.paliers[sp.id].valide) <= 28 * 86400000).length;
  const rythme = recentes / 4;
  // Repère : une leçon ≈ 25 minutes de travail (entraînement + mini-test), 6 jours sur 7.
  const minutesJour = Math.min(60, Math.max(10, Math.round((parSemaine * 25) / 6 / 5) * 5));
  const realiste = jours > 0 && (manquantes === 0 || parSemaine <= Math.max(rythme * 1.2, 3));
  return { grade: g, reussi, manquantes, jours, parSemaine, rythme, minutesJour, realiste };
}

// ------------------------------------------------------------------ consolidation

/**
 * Consolidation : 2 à 7 jours après la validation d'une leçon « stricte » (un seul ami), une
 * planche qui MÉLANGE ce geste avec ceux des leçons précédentes. Répéter en bloc installe le
 * geste ; le mélanger ensuite oblige à le choisir, ce qui le rend durable. Une seule fois par leçon.
 * @returns {object|null}  le sous-palier à consolider
 */
export function consolidationDuJour(d, date) {
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const faites = new Set(d.sessions.filter((s) => s.date !== date && String(s.mode).startsWith('consolidation:')).map((s) => s.mode.slice(14)));
  return ADDSUB.find((sp) => {
    const v = d.paliers[sp.id]?.valide;
    if (!v || sp.cumul || faites.has(sp.id)) return false;
    const ecart = (jour(date) - jour(v)) / 86400000;
    return ecart >= 2 && ecart <= 7;
  }) ?? null;
}
