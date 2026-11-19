/**
 * Passage de kyū : l'examen du niveau où l'on se trouve, accessible EN PERMANENCE, pour
 * travailler sous la pression d'un vrai examen, sur ce que l'on a appris (et rien d'autre).
 * La séance du jour le rappelle une fois par semaine, sans échéance ; un échec est normal et ne coûte rien :
 * on retente quand on veut.
 *
 * Avant le 10e kyū officiel, des grades préparatoires (20e → 11e kyū), un par étape du parcours :
 * on peut ainsi passer un grade, même très modeste, dès les gestes directs. Chaque grade se
 * débloque quand ses leçons (et celles d'avant) sont validées.
 *
 * Format : 20 colonnes au moins, temps fixe (compte à rebours), seuil de 70 % comme aux examens
 * officiels. Chaque tentative compte : la réussite donne le grade, l'échec ne retire rien.
 * Au-delà du 11e kyū, l'examen de la semaine garde ce format avec tous les gestes appris
 * (au format du kyū visé) ; les vrais kyū se passent en épreuve officielle (page Grades).
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { genererColonneVariee, creerMemoire } from './generateur.js';
import { famille } from './motifs.js';
import { motifsAppris, estValide, grade, chiffresAppris, lignesAcquises, formatExamen, gradeAccessible, PREREQUIS } from './parcours.js';
import { systemeChoisi, SYSTEMES } from './epreuves.js';
import { SOUS_PALIERS, genererExercice } from './curriculum.js';
import { verdictAllure } from './allure.js';
import { cpm } from './maitrise.js';
import { semaineISO } from './hasard.js';
import { gradeDan, prochainDan } from './dan.js';

export const COLONNES = 20;
export const SEUIL = 0.7;

/** Grades préparatoires : leçons à valider, et format des colonnes de l'examen. */
export const PREKYU = [
  { id: '20', nom: '20e kyū prép.', lecons: ['p1-1', 'p1-2', 'p1-3'], chiffres: 1, lignes: 4, theme: 'gestes directs, 1 chiffre' },
  { id: '19', nom: '19e kyū prép.', lecons: ['p1-4'], chiffres: 2, lignes: 4, theme: 'gestes directs, 2 chiffres' },
  { id: '18', nom: '18e kyū prép.', lecons: ['p2-1', 'p2-2', 'p2-3'], chiffres: 2, lignes: 5, theme: 'petits amis en addition' },
  { id: '17', nom: '17e kyū prép.', lecons: ['p2-4', 'p2-5', 'p2-6', 'p2-7'], chiffres: 2, lignes: 5, theme: 'tous les petits amis' },
  { id: '16', nom: '16e kyū prép.', lecons: ['p3-1', 'p3-2', 'p3-3'], chiffres: 1, lignes: 5, theme: 'grands amis en addition, 1 chiffre' },
  { id: '15', nom: '15e kyū prép.', lecons: ['p3-4'], chiffres: 2, lignes: 5, theme: 'grands amis en addition, 2 chiffres' },
  { id: '14', nom: '14e kyū prép.', lecons: ['p4-1', 'p4-2', 'p4-3', 'p4-4'], chiffres: 2, lignes: 5, theme: 'grands amis en soustraction' },
  { id: '13', nom: '13e kyū prép.', lecons: ['p4-5'], chiffres: 2, lignes: 5, theme: 'tous les grands amis' },
  { id: '12', nom: '12e kyū prép.', lecons: ['p5-1', 'p5-2', 'p5-3'], chiffres: 2, lignes: 5, theme: 'combinaisons' },
  { id: '11', nom: '11e kyū prép.', lecons: ['p5-4', 'p5-5'], chiffres: 2, lignes: 5, theme: 'cascades et révision générale, au format du 10e kyū' },
];
// Jamais plus dur que le 10e kyū officiel (5 lignes de 2 chiffres) : les grades préparatoires y
// mènent, ils ne le dépassent pas (avant la 0.36, les 13e à 11e avaient 3 chiffres et 6 lignes).
const APRES = { id: 'hebdo', nom: 'Examen de la semaine', chiffres: 3, lignes: 7, theme: 'tous les gestes appris' };

/** Dernière leçon validée d'un type (multiplication ou division sur le soroban, nombres entiers). */
const derniereValidee = (d, type) => SOUS_PALIERS.filter((sp) => sp.type === type && !sp.mental && estValide(d, sp.id)).at(-1) ?? null;

/**
 * Format de l'examen de la semaine, ADAPTÉ AU NIVEAU une fois les grades préparatoires passés :
 * les colonnes du kyū visé (chiffres et lignes de son mitorizan), dans la limite des leçons
 * validées, et, dès que ces leçons sont validées, des multiplications et des divisions du type
 * de la dernière leçon acquise.
 */
export function formatHebdo(d) {
  const mul = derniereValidee(d, 'mul');
  const div = derniereValidee(d, 'div');
  const f = formatExamen(d);
  const chiffres = Math.max(1, Math.min(f.chiffres, chiffresAppris(d)));
  const lignes = Math.min(f.lignes, lignesAcquises(d));
  const operations = (mul ? 5 : 0) + (div ? 5 : 0);
  const parties = ['tous les gestes appris', mul && 'multiplications', div && 'divisions'].filter(Boolean);
  return { ...APRES, chiffres, lignes, colonnes: COLONNES - operations, mul, div, theme: `format du ${f.grade.nom} (${chiffres} chiffres, ${lignes} lignes), ${parties.join(', ')}` };
}

/**
 * Les trois premiers grades préparatoires se passent EN DEUX TEMPS, pour casser le mur du premier
 * examen chronométré :
 *  - phase 1, le SOCLE : 10 colonnes, sans chrono, 8 justes (80 %) : elle donne le grade ;
 *  - phase 2, facultative : le format complet, chronométré, à 70 %.
 * Au-delà, c'est justement le chrono que l'on vient travailler : format complet seulement.
 */
export const SOCLE = { colonnes: 10, seuil: 0.8, minutes: 5, grades: ['20', '19', '18'] };
export const aSocle = (g) => !!g && SOCLE.grades.includes(g.id);
/** Phase 2 (format complet, chronométré) réussie ? */
export const completObtenu = (d, g) => !!d.records[`prekyu-${g.id}-complet`]?.reussi;

/** Grade préparatoire accessible : ses leçons et celles des grades d'avant sont validées. */
export function prekyuAccessible(d, g) {
  const i = PREKYU.indexOf(g);
  return PREKYU.slice(0, i + 1).every((x) => x.lecons.every((id) => estValide(d, id)));
}
/** Un kyū officiel réussi (en épreuve, ou en examen blanc), tous systèmes confondus. */
const unKyuReussi = (d) => Object.entries(d.records ?? {}).some(([k, r]) => /^(epreuve|zenkoren)-\d+$|^blanc-/.test(k) && r?.reussi);
/**
 * Grade préparatoire obtenu : réussi lui-même, ou PAR ÉQUIVALENCE (un grade plus élevé réussi,
 * préparatoire ou officiel, vaut tous ceux d'en dessous).
 */
export const prekyuObtenu = (d, g) => PREKYU.slice(PREKYU.indexOf(g)).some((x) => !!d.records[`prekyu-${x.id}`]?.reussi) || unKyuReussi(d);
/** Meilleur grade préparatoire obtenu (ou null). */
export const meilleurPrekyu = (d) => [...PREKYU].reverse().find((g) => prekyuObtenu(d, g)) ?? null;

/** Clé du record d'un examen blanc de kyū officiel. */
export const cleBlanc = (sys, id) => `blanc-${sys.id}-${id}`;
/**
 * Kyū officiel « passé » : réussi en épreuve officielle ou en examen blanc, lui-même ou un grade
 * plus élevé (équivalence vers le bas).
 */
export function kyuPasse(d, sys, g) {
  return sys.grades.slice(sys.grades.indexOf(g)).some((x) => !!d.records[sys.record(x.id)]?.reussi || !!d.records[cleBlanc(sys, x.id)]?.reussi);
}
/** Le 6e kyū (ou plus haut) est-il passé, dans le système choisi ? */
export function sixiemeKyuPasse(d) {
  const sys = systemeChoisi(d);
  const g6 = sys.grades.find((g) => g.id === '6');
  return !!g6 && kyuPasse(d, sys, g6);
}

/**
 * Examen complet de la semaine, une fois le 6e kyū passé : le sujet officiel ENTIER du prochain
 * grade (mitorizan, × et ÷, 30 minutes ; ou les épreuves Zenkoren), à la place de l'examen
 * blanc. null avant, ou si tout est réussi.
 * @returns {{ grade: object, fait: object|null } | null}  fait : la session de la semaine, s'il y en a une
 */
export function examenCompletHebdo(d, date) {
  if (!sixiemeKyuPasse(d)) return null;
  const sys = systemeChoisi(d);
  // Après le 1er kyū (0.38) : l'examen de dan d'entraînement (30 min) prend le relais chaque
  // semaine, en visant le prochain dan ; au-delà du 10e dan, le 1er kyū en entretien.
  const gr = grade(d);
  const dan = !gr.prochain && gr.obtenu ? prochainDan(d) : null;
  const g = gr.prochain ?? (dan ? gradeDan(dan) : gr.obtenu ? sys.grades.at(-1) : null);
  if (!g) return null;
  const semaine = semaineISO(date).cle;
  const mode = g.dan ? 'dan' : `${g.systeme === 'zenkoren' ? 'z' : ''}${g.id}`;
  const fait = [...d.sessions].reverse().find((s) => s.module === 'epreuves' && s.mode === mode && semaineISO(s.date).cle === semaine) ?? null;
  return { grade: g, systeme: sys.id, fait, entretien: !gr.prochain, dan: !!g.dan };
}

/** Plus haut kyū officiel réussi en examen blanc (ou null). */
export const meilleurBlanc = (d) => { const sys = systemeChoisi(d); return [...sys.grades].reverse().find((g) => !!d.records[cleBlanc(sys, g.id)]?.reussi) ?? null; };

/**
 * Examen blanc de la semaine : le grade LE PLUS ÉLEVÉ dont toutes les leçons sont validées et
 * qui n'est pas encore réussi (préparatoire, puis kyū officiel du système choisi). On ne repasse
 * pas les grades d'en dessous : en réussir un les donne tous, par équivalence. Tout est réussi :
 * examen d'entretien au format avancé. Gestes directs pas finis : null.
 */
export function examenDeLaSemaine(d) {
  const accessibles = PREKYU.filter((g) => prekyuAccessible(d, g));
  if (!accessibles.length) return null;
  const sys = systemeChoisi(d);
  const haut = sys.grades.filter((g) => gradeAccessible(d, g)).at(-1);
  if (haut) {
    if (kyuPasse(d, sys, haut)) return formatHebdo(d);
    return { ...formatHebdo(d), id: `k${haut.id}`, nom: `${haut.nom} (blanc)`, officiel: haut.id, systeme: sys.id };
  }
  const dernier = accessibles.at(-1);
  // Tout le préparatoire est validé et obtenu : examen hebdomadaire au format avancé.
  if (dernier === PREKYU.at(-1) && prekyuObtenu(d, dernier)) return formatHebdo(d);
  return dernier;
}

/**
 * Un kyū réussi vaut un test de niveau : toutes les leçons que ce grade exige (et les leçons
 * de prise en main) sont acquises. Renvoie celles qui ne sont pas encore validées, pour le plus
 * haut grade réussi (épreuve officielle ou examen blanc, tous systèmes ; grades préparatoires).
 */
export function leconsParEquivalence(d) {
  const ids = new Set();
  for (const sys of Object.values(SYSTEMES)) {
    const haut = [...sys.grades].reverse().find((g) => d.records?.[sys.record(g.id)]?.reussi || d.records?.[cleBlanc(sys, g.id)]?.reussi);
    for (const id of (haut ? PREREQUIS[haut.id] ?? [] : [])) ids.add(id);
  }
  const prep = PREKYU.findLastIndex((g) => d.records?.[`prekyu-${g.id}`]?.reussi);
  for (const g of PREKYU.slice(0, prep + 1)) for (const id of g.lecons) ids.add(id);
  if (ids.size) for (const sp of SOUS_PALIERS) if (sp.palier.id === 'p0') ids.add(sp.id);
  return SOUS_PALIERS.filter((sp) => ids.has(sp.id) && !estValide(d, sp.id)).map((sp) => sp.id);
}

/**
 * Le PROCHAIN grade seulement (jamais un objectif lointain) : le premier, du 20e kyū prép. au
 * 1er kyū, qui n'est pas encore réussi ; avec les leçons qui lui manquent, l'étape du parcours où
 * il se gagne, et une estimation en jours au rythme des 28 derniers jours (null si trop peu de
 * leçons validées récemment pour estimer, ou si c'est à plus de 60 jours).
 * @returns {{ nom, court, palier, restantes: number, jours: number|null, dernier: {court, palier}|null }|null}
 */
export function prochainJalon(d, date) {
  const sys = systemeChoisi(d);
  const court = (id) => (id === '1' ? '1er' : `${id}e`);
  const chaine = [
    ...PREKYU.map((g, i) => ({ nom: g.nom, court: court(g.id), lecons: PREKYU.slice(0, i + 1).flatMap((x) => x.lecons), obtenu: prekyuObtenu(d, g) })),
    ...sys.grades.map((g) => ({ nom: g.nom, court: court(g.id), lecons: PREREQUIS[g.id] ?? [], obtenu: kyuPasse(d, sys, g) })),
  ];
  const palierDe = (x) => x.lecons.map((id) => SOUS_PALIERS.find((sp) => sp.id === id)).filter(Boolean).sort((a, b) => a.ordre - b.ordre).at(-1)?.palier.id ?? null;
  const manque = (x) => x.lecons.filter((id) => !estValide(d, id)).length;
  // Comme l'examen blanc : le plus haut grade déjà à portée (leçons validées, pas encore réussi) ;
  // sinon le premier grade qui reste à préparer.
  let i = chaine.findLastIndex((x) => !x.obtenu && !manque(x));
  if (i < 0) i = chaine.findIndex((x) => !x.obtenu);
  if (i < 0) return null;
  const x = chaine[i];
  const restantes = manque(x);
  const il28 = new Date(`${date}T12:00`); il28.setDate(il28.getDate() - 28);
  const depuis = `${il28.getFullYear()}-${String(il28.getMonth() + 1).padStart(2, '0')}-${String(il28.getDate()).padStart(2, '0')}`;
  const recentes = SOUS_PALIERS.filter((sp) => !sp.mental && (d.paliers[sp.id]?.valide ?? '') > depuis).length;
  const estime = restantes && recentes >= 2 ? Math.ceil(restantes / (recentes / 28)) : null;
  const dernier = chaine.findLast((y) => y.obtenu) ?? null;
  return { nom: x.nom, court: x.court, palier: palierDe(x), restantes, jours: estime !== null && estime <= 60 ? estime : null, dernier: dernier ? { court: dernier.court, palier: palierDe(dernier) } : null };
}

/** Temps fixe : 2,5 s par chiffre + 3 s de lecture et d'écriture par colonne, arrondi à la minute. */
export function minutesExamen(g) {
  // × et ÷ : 5 s par produit de table (m × n produits), plus la lecture et l'écriture.
  const produits = (sp) => (sp ? 5 * ((sp.m ?? sp.nd ?? 2) * (sp.n ?? sp.nq ?? 1) * 5 + 3) : 0);
  const s = (g.colonnes ?? COLONNES) * (g.chiffres * g.lignes * 2.5 + 3) + produits(g.mul) + produits(g.div);
  return Math.max(3, Math.ceil(s / 60));
}

/** Les 20 colonnes de l'examen : uniquement les gestes appris, résultats tous différents. */
export function sujetExamen(d, g) {
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const memoire = creerMemoire(COLONNES);
  return Array.from({ length: g.colonnes ?? COLONNES }, () => genererColonneVariee({
    chiffres: g.chiffres, lignes: g.lignes, autorises: appris, cibles: amis.length ? amis : famille('direct'),
  }, memoire));
}

/** Sujet complet, par sections : colonnes, puis multiplications et divisions si le niveau y est. */
export function sectionsExamen(d, g) {
  const sections = [{ titre: g.mul || g.div ? 'Colonnes' : undefined, problemes: sujetExamen(d, g) }];
  if (g.mul) sections.push({ titre: 'Multiplications', problemes: Array.from({ length: 5 }, () => genererExercice(g.mul)) });
  if (g.div) sections.push({ titre: 'Divisions', problemes: Array.from({ length: 5 }, () => genererExercice(g.div)) });
  return sections;
}

/**
 * Examen blanc, en ALTERNANCE d'une semaine à l'autre : un sujet long de 20 minutes
 * (concentration longue, un seul chrono pour tout), puis, la semaine suivante, deux sprints de
 * 7 minutes, chacun avec son chrono et son verdict (rythme rapide, sans compensation : il faut
 * 70 % dans chacun). Le contenu est celui de l'examen du niveau (mêmes colonnes, mêmes × et ÷).
 */
export const MINUTES_BLANC_LONG = 20;
export const MINUTES_BLANC_SPRINT = 7;
export const formatBlanc = (date) => (semaineISO(date).semaine % 2 === 0 ? 'long' : 'sprints');
export const minutesBlanc = (format) => (format === 'long' ? MINUTES_BLANC_LONG : 2 * MINUTES_BLANC_SPRINT);
/** Secondes « d'examen » d'une colonne et d'une opération (mêmes bases que minutesExamen). */
const secColonne = (g) => g.chiffres * g.lignes * 2.5 + 3;
const secOperation = (sp) => 5 * ((sp.m ?? sp.nd ?? 2) * (sp.n ?? sp.nq ?? 1)) + 3;
export function sectionsBlanc(d, g, format) {
  const colonnes = (n) => sujetExamen(d, { ...g, colonnes: n });
  const operations = (n, minutes) => {
    const s = [];
    if (g.mul) s.push({ titre: 'Multiplications', problemes: Array.from({ length: g.div ? Math.ceil(n / 2) : n }, () => genererExercice(g.mul)) });
    if (g.div) s.push({ titre: 'Divisions', problemes: Array.from({ length: g.mul ? Math.floor(n / 2) : n }, () => genererExercice(g.div)) });
    return minutes ? s.map((x) => ({ ...x, minutes })) : s;
  };
  const ops = !!(g.mul || g.div);
  const secOp = ops ? (g.mul && g.div ? (secOperation(g.mul) + secOperation(g.div)) / 2 : secOperation(g.mul ?? g.div)) : 0;
  if (format === 'long') {
    // 20 minutes : un tiers d'opérations quand le niveau en a, le reste en colonnes.
    const tOps = ops ? MINUTES_BLANC_LONG * 60 / 3 : 0;
    const n = Math.max(COLONNES, Math.round((MINUTES_BLANC_LONG * 60 - tOps) / secColonne(g)));
    return [{ titre: ops ? 'Colonnes' : undefined, problemes: colonnes(n) }, ...(ops ? operations(Math.max(6, Math.round(tOps / secOp))) : [])];
  }
  // Deux sprints de 7 minutes : colonnes, puis × et ÷ (ou un second sprint de colonnes).
  const m = MINUTES_BLANC_SPRINT;
  const nCol = Math.max(10, Math.round((m * 60) / secColonne(g)));
  const premier = { titre: 'Sprint 1 · colonnes', minutes: m, problemes: colonnes(nCol) };
  if (!ops) return [premier, { titre: 'Sprint 2 · colonnes', minutes: m, problemes: colonnes(nCol) }];
  const n = Math.max(6, Math.round((m * 60) / secOp));
  const sous = operations(n);
  return [premier, { titre: `Sprint 2 · ${sous.map((x) => x.titre.toLowerCase()).join(' et ')}`, minutes: m, problemes: sous.flatMap((x) => x.problemes) }];
}

/** Clé et meilleur résultat des passages de cette semaine (pour le rendez-vous hebdomadaire du prof). */
export const cleSemaine = (date) => `kyu-semaine-${semaineISO(date).cle}`;
export const resultatSemaine = (d, date) => d.records[cleSemaine(date)] ?? null;

/** Jours restants avant la fin de la semaine (dimanche compris). */
export function joursRestants(date) {
  const j = new Date(`${date}T12:00`).getDay(); // 0 = dimanche
  return j === 0 ? 1 : 8 - j;
}

/**
 * Libellé du grade, avec les DEUX échelles : le grade d'entraînement (préparatoire, gagné au kyū
 * de la semaine) et le prochain grade officiel. Utilisé par la séance et par Progression.
 * @returns {{ valeur: string, detail: string }}
 */
export function libelleGrade(d) {
  const g = grade(d);
  const prep = meilleurPrekyu(d);
  const sys = g.obtenu?.systeme === 'zenkoren' ? ' · Zenkoren' : '';
  const blanc = meilleurBlanc(d);
  const valeur = g.obtenu ? `${g.obtenu.nom} (${g.obtenu.japonais})${sys}` : blanc ? `${blanc.nom} en examen blanc` : prep ? prep.nom : 'aucun pour l\'instant';
  let officiel;
  if (!g.prochain) officiel = 'Tous les kyū officiels sont obtenus.';
  else if (g.pret) {
    // Les leçons sont validées à 70 % de la cadence ; l'épreuve, elle, demande la cadence entière.
    const v = verdictAllure(g.prochain, d);
    const lent = v.colonnes.ok === false || v.muldiv.ok === false;
    officiel = lent
      ? `Prochain grade officiel : ${g.prochain.nom}. Les leçons sont validées ; il reste à tenir l'allure de l'épreuve (${cpm(v.colonnes.besoin)} CPM en colonnes) avant de la tenter.`
      : `Prochain grade officiel : ${g.prochain.nom}, vous pouvez tenter l'épreuve.`;
  }
  else officiel = `Prochain grade officiel : ${g.prochain.nom}, ${g.manquantes.length} leçon${g.manquantes.length > 1 ? 's' : ''} à valider.`;
  return { valeur, detail: officiel };
}
