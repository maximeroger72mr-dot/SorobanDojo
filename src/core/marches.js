/**
 * Marches d'allure (0.38) : de la leçon à la vitesse d'examen.
 *
 * Une fois les leçons d'un grade validées, il restait un « mur » : rien de guidé entre la
 * cadence des mini-tests (70 % de l'allure du grade) et l'allure d'examen. Ici, 5 marches par
 * grade, régulièrement espacées (progression géométrique du temps par chiffre et par produit),
 * de la cadence des leçons jusqu'à l'allure d'examen AVEC 10 % de marge.
 *
 * Chaque marche se valide sur une feuille courte AU FORMAT de l'examen (environ 5 minutes : une
 * part de chaque section du sujet, dans ses proportions), dans le temps de la marche, avec 90 %
 * de justes ; deux fois, deux jours différents (une réussite par chance ne suffit pas).
 * Un jalon toutes les deux à quatre semaines, au lieu d'attendre l'examen.
 *
 * Entre deux feuilles : le fractionné, 4 mini-feuilles de 90 secondes à l'allure de la marche.
 * Fonctions pures (le hasard des sujets mis à part).
 */

import { genererSujet, systemeChoisi } from './epreuves.js';
import { allureGrade, PART_CADENCE_LECON, MARGE, SURCOUT_PROBLEME_S, chargeGrade, vitesseEleve } from './allure.js';
import { ratioExamen } from './mesures.js';
import { unites, cpm } from './maitrise.js';
import { grade as gradeDe } from './parcours.js';
import { gradeDan, prochainDan } from './dan.js';
import { gradeDanZenkoren, prochainNiveau, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN } from './danZenkoren.js';

/** Le sujet, réduit aux matières de calcul (× , ÷, mitorizan) : marches et projections (0.38.3). */
const sujetCalcul = (g) => { const s = genererSujet(g); return { ...s, sections: s.sections.filter((x) => ['mitoriA', 'mitori', 'mul', 'div'].includes(x.cle)) }; };

export const NB_MARCHES = 5;
export const JUSTES_MARCHE = 0.9;
export const FEUILLES_MARCHE = 2;
export const MINUTES_FEUILLE_MARCHE = 5;
export const SECONDES_FRACTIONNE = 90;
export const SERIES_FRACTIONNE = 4;
/** Marches seulement pour les grades dont l'allure finale passe sous 3 s par chiffre (6e kyū et après). */
export const MARCHES_SOUS = 3;

export const cleMarches = (g) => `${g.systeme ?? 'nissho'}-${g.id}`; // dan : « dan-d1 »…

/**
 * Les 5 marches d'un grade : temps par chiffre (colonnes) et par produit (× ÷) à tenir.
 * @returns {Array<{ n:number, parChiffre:number, parProduit:number, cpm:number, produitsParMinute:number }>}
 */
export function marchesGrade(g) {
  const a = allureGrade(g);
  const depart = { c: a.parChiffre / PART_CADENCE_LECON, p: a.parProduit / PART_CADENCE_LECON };
  const fin = { c: a.parChiffre * (1 - MARGE), p: a.parProduit * (1 - MARGE) };
  return Array.from({ length: NB_MARCHES }, (_, i) => {
    const r = (i + 1) / NB_MARCHES;
    const parChiffre = depart.c * (fin.c / depart.c) ** r;
    const parProduit = depart.p * (fin.p / depart.p) ** r;
    return { n: i + 1, parChiffre, parProduit, cpm: cpm(parChiffre), produitsParMinute: Math.round(600 / parProduit) / 10 };
  });
}

/** Temps d'un problème à l'allure d'une marche (secondes), lecture et écriture comprises. */
export const tempsProbleme = (ex, m) => unites(ex) * (ex.type === 'addsub' ? m.parChiffre : m.parProduit) + SURCOUT_PROBLEME_S;

/**
 * Où en est l'élève sur les marches du grade visé ?
 * Actives quand toutes les leçons du prochain grade sont validées (et jusqu'à ce qu'il soit réussi).
 * @returns {{ grade, marches, validees:number, courante:object|null, reussites:string[], active:boolean } | null}
 */
export function etatMarches(d) {
  const gr = gradeDe(d);
  // Après le 1er kyū (0.38) : les marches visent le prochain dan d'entraînement.
  const zen = systemeChoisi(d).id === 'zenkoren';
  const dan = !gr.prochain && gr.obtenu ? (zen ? prochainNiveau(d, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN) : prochainDan(d)) : null;
  const g = gr.prochain ?? (dan ? (zen ? gradeDanZenkoren(dan) : gradeDan(dan)) : null);
  if (!g) return null;
  const marches = marchesGrade(g);
  const e = d.marches?.[cleMarches(g)] ?? { validees: 0, reussites: [] };
  const validees = Math.min(NB_MARCHES, e.validees ?? 0);
  // Du 10e au 7e kyū, l'allure d'examen est plus lente que l'argent exigé aux leçons : pas de marches.
  const utiles = marches.at(-1).parChiffre < MARCHES_SOUS;
  return { grade: g, marches, validees, courante: validees < NB_MARCHES ? marches[validees] : null, reussites: e.reussites ?? [], active: (gr.pret || !!dan) && utiles, utiles, debut: e.debut ?? null, dates: e.dates ?? [], dan: !!dan };
}

/**
 * Feuille courte d'une marche : environ 5 minutes à l'allure de la marche, une part de chaque
 * section du sujet (au moins un problème par section). `secondes` : durée visée (90 s : fractionné).
 * @returns {{ sections: object[], minutes: number }}
 */
export function feuilleMarche(g, m, secondes = MINUTES_FEUILLE_MARCHE * 60, cle = null) {
  const sujet = sujetCalcul(g);
  let sections;
  if (cle) {
    // Fractionné : une seule partie (colonnes, × ou ÷), autant de problèmes que 90 s en permettent.
    const s = sujet.sections.find((x) => x.cle === cle || (cle === 'mitori' && x.cle.startsWith('mitori'))) ?? sujet.sections[0];
    let t = 0;
    const problemes = s.problemes.filter((ex) => { t += tempsProbleme(ex, m); return t <= secondes; });
    sections = [{ ...s, minutes: undefined, problemes: problemes.length ? problemes : s.problemes.slice(0, 1) }];
  } else {
    const total = sujet.sections.reduce((t, s) => t + s.problemes.reduce((u, ex) => u + tempsProbleme(ex, m), 0), 0);
    const part = Math.min(1, secondes / total);
    sections = sujet.sections.map((s) => ({ ...s, minutes: undefined, problemes: s.problemes.slice(0, Math.max(1, Math.round(s.problemes.length * part))) }));
  }
  const limite = sections.reduce((t, s) => t + s.problemes.reduce((u, ex) => u + tempsProbleme(ex, m), 0), 0);
  return { sections, minutes: Math.max(0.5, Math.round((limite / 60) * 10) / 10) };
}

/** Une feuille de marche est réussie avec 90 % de justes dans le temps (non répondu = faux). */
export const feuilleMarcheReussie = (justes, total) => total > 0 && justes / total >= JUSTES_MARCHE;

/**
 * Nouvel état après une feuille : une réussite par jour au plus ; deux réussites (deux jours
 * différents) valident la marche. Pur : renvoie l'état à enregistrer.
 */
export function apresFeuilleMarche(e0, date, reussi) {
  const e = { validees: 0, reussites: [], dates: [], ...e0 };
  e.debut ??= date;
  if (!reussi || e.reussites.includes(date)) return e;
  e.reussites = [...e.reussites, date];
  if (e.reussites.length >= FEUILLES_MARCHE) {
    e.validees = Math.min(NB_MARCHES, e.validees + 1);
    e.dates = [...e.dates, date];
    e.reussites = [];
  }
  return e;
}

/**
 * Score projeté à l'examen du grade, à la vitesse mesurée de l'élève et à sa justesse récente :
 * part du sujet qu'il traite dans le temps × taux de justes. null sans mesure.
 * @returns {{ points:number, pointsMax:number, seuil:number, reussi:boolean, part:number } | null}
 */
export function scoreProjete(g, d, date = null) {
  // 0.39 : vitesse AU FORMAT du grade (vraies feuilles), les gestes isolés en secours (« à confirmer »).
  const v = vitesseEleve(d, g);
  const c = chargeGrade(g);
  if (v.parChiffre == null || (c.produits > 0 && v.parProduit == null)) return null;
  const aConfirmer = !v.colonnesAuFormat || (c.produits > 0 && !v.produitsAuFormat);
  const recentes = d.sessions.filter((s) => ['epreuves', 'examen', 'planches', 'muldiv', 'marches'].includes(s.module) && s.total > 0).slice(-20);
  const taux = recentes.length ? recentes.reduce((t, s) => t + s.justes, 0) / recentes.reduce((t, s) => t + s.total, 0) : 0.9;
  // Un examen de ce grade de moins de 3 semaines : c'est lui qui dit l'allure (sous examen).
  const ex = !g.parEpreuve && date ? ratioExamen(d, `${g.systeme ?? 'nissho'}:${g.id}`, date) : null;
  if (ex) {
    const part = Math.min(1, allureGrade(g).part / ex.ratio);
    const pointsMax = genererSujetPoints(g);
    const points = Math.round(pointsMax * part * taux);
    return { points, pointsMax, seuil: Math.ceil(pointsMax * g.seuil), reussi: points >= pointsMax * g.seuil, part, taux, source: 'examen' };
  }
  if (g.parEpreuve) {
    // Zenkoren et dan (0.38) : chaque épreuve a son temps et son seuil, SANS compensation ; une
    // moyenne globale pouvait annoncer « réussi » avec une division trop lente.
    const sujet = sujetCalcul(g);
    const epreuves = sujet.sections.map((sec) => {
      const ch = chargeGrade(g, sec.cle);
      const temps = sec.cle.startsWith('mitori') ? ch.chiffres * v.parChiffre : ch.produits * v.parProduit;
      const part = Math.min(1, (g.minutesEpreuve * 60) / (temps + ch.problemes * SURCOUT_PROBLEME_S));
      const pointsMax = sec.points * sec.problemes.length;
      const points = Math.round(pointsMax * part * taux);
      const seuil = Math.ceil(pointsMax * g.seuil);
      return { cle: sec.cle, titre: sec.titre, points, pointsMax, seuil, ok: points >= seuil, part };
    });
    const pointsMax = epreuves.reduce((t, x) => t + x.pointsMax, 0);
    const faible = [...epreuves].sort((a, b) => a.points / a.seuil - b.points / b.seuil)[0];
    return { points: epreuves.reduce((t, x) => t + x.points, 0), pointsMax, seuil: epreuves.reduce((t, x) => t + x.seuil, 0), reussi: epreuves.every((x) => x.ok),
      part: Math.min(...epreuves.map((x) => x.part)), taux, epreuves, faible, aConfirmer };
  }
  const temps = c.chiffres * v.parChiffre + c.produits * v.parProduit + c.problemes * SURCOUT_PROBLEME_S;
  const part = Math.min(1, (g.minutes * 60) / temps);
  const pointsMax = genererSujetPoints(g);
  const points = Math.round(pointsMax * part * taux);
  return { points, pointsMax, seuil: Math.ceil(pointsMax * g.seuil), reussi: points >= pointsMax * g.seuil, part, taux, aConfirmer };
}
const genererSujetPoints = (g) => sujetCalcul(g).sections.reduce((t, s) => t + s.points * s.problemes.length, 0);

/**
 * Date projetée de la fin des marches (donc de l'allure d'examen), d'après le rythme des marches
 * déjà validées. null avant la première marche validée : on ne devine pas.
 * @returns {{ date:string, joursParMarche:number } | null}
 */
export function dateProjetee(etat, date) {
  if (!etat?.debut || !etat.validees || etat.validees >= NB_MARCHES) return null;
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const jours = Math.max(1, Math.round((jour(date) - jour(etat.debut)) / 86400000));
  const joursParMarche = jours / etat.validees;
  const fin = new Date(jour(date) + Math.round(joursParMarche * (NB_MARCHES - etat.validees)) * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return { date: `${fin.getFullYear()}-${p(fin.getMonth() + 1)}-${p(fin.getDate())}`, joursParMarche };
}

export { systemeChoisi };
