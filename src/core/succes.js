/**
 * Succès : des étapes réelles de progression, débloquées en silence et affichées dans la
 * progression. Ils sont rangés par thème et par paliers (1, 2, 3…) : l'application montre,
 * pour chaque thème, le PROCHAIN succès accessible, adapté à votre niveau.
 *
 * Chaque succès : { id, theme, nom, description, test(ctx) } — ctx est calculé par contexte().
 */

import { PALIERS } from './curriculum.js';
import { evaluer } from './maitrise.js';
import { serieJours } from './regularite.js';
import { famille } from './motifs.js';

const palierValide = (ctx, idPalier) => PALIERS.find((p) => p.id === idPalier).sousPaliers.every((s) => ctx.valides.has(s.id));
const record = (ctx, cle) => ctx.records[cle];
const recordSous = (ctx, cle, ms) => record(ctx, cle) && record(ctx, cle).dureeMs <= ms;
const reussiGrade = (ctx, id) => !!record(ctx, `epreuve-${id}`)?.reussi;
const gestesAuMoins = (ctx, index) => Object.values(ctx.niveauxGestes).filter((i) => i >= index).length;
const anzanParfait = (ctx, duree, chiffres = 1) => ctx.sessions.some((s) => s.module === 'anzan' && s.total >= 10 && s.justes === s.total && s.reglages?.duree <= duree && s.reglages?.chiffres >= chiffres);

export const SUCCES = [
  // Régularité
  ...[[3, 'Trois jours'], [7, 'Une semaine'], [30, 'Un mois'], [100, 'Cent jours']].map(([n, nom]) => ({
    id: `serie-${n}`, theme: 'Régularité', nom, description: `${n} jours de pratique d'affilée (un jour de repos par semaine toléré).`, test: (c) => c.meilleureSerie >= n,
  })),
  // Volume
  ...[[100, 'Cent calculs justes'], [1000, 'Mille calculs justes'], [5000, 'Cinq mille calculs justes']].map(([n, nom]) => ({
    id: `justes-${n}`, theme: 'Volume', nom, description: `${n.toLocaleString('fr-FR')} exercices justes au total.`, test: (c) => c.totalJustes >= n,
  })),
  // Concentration
  ...[[10, 'Dix sans faute'], [25, 'Vingt-cinq sans faute'], [50, 'Cinquante sans faute']].map(([n, nom]) => ({
    id: `suite-${n}`, theme: 'Concentration', nom, description: `${n} réponses justes d'affilée.`, test: (c) => c.meilleureSuite >= n,
  })),
  // Parcours
  { id: 'lecon-1', theme: 'Parcours', nom: 'Premier pas', description: 'Valider une première leçon.', test: (c) => c.valides.size >= 1 },
  ...[['p1', 'Gestes directs'], ['p2', 'Petits amis'], ['p3', 'Grands amis (addition)'], ['p4', 'Grands amis (soustraction)'], ['p5', 'Combinaisons'], ['p6', 'Multiplication'], ['p7', 'Division']].map(([p, nom]) => ({
    id: `palier-${p}`, theme: 'Parcours', nom, description: `Valider toutes les leçons « ${nom} ».`, test: (c) => palierValide(c, p),
  })),
  // Maîtrise (juste ET rapide)
  { id: 'geste-confirme', theme: 'Maîtrise', nom: 'Premier geste confirmé', description: 'Un geste au niveau « Acquis confirmé ».', test: (c) => gestesAuMoins(c, 3) >= 1 },
  { id: 'gestes-confirmes-10', theme: 'Maîtrise', nom: 'Dix gestes confirmés', description: 'Dix gestes au niveau « Acquis confirmé » ou plus.', test: (c) => gestesAuMoins(c, 3) >= 10 },
  { id: 'petits-amis-confirmes', theme: 'Maîtrise', nom: 'Petits amis maîtrisés', description: 'Les 8 petits amis au niveau « Acquis confirmé ».', test: (c) => famille('petit').every((k) => (c.niveauxGestes[k] ?? 0) >= 3) },
  { id: 'geste-expert', theme: 'Maîtrise', nom: 'Premier geste expert', description: 'Un geste au niveau « Acquis expert ».', test: (c) => gestesAuMoins(c, 4) >= 1 },
  { id: 'gestes-acquis-40', theme: 'Maîtrise', nom: 'Main sûre', description: '40 gestes au moins « Acquis débutant ».', test: (c) => gestesAuMoins(c, 2) >= 40 },
  // Drills
  { id: 'drill-1', theme: 'Drills', nom: 'Premier drill', description: 'Réussir un drill.', test: (c) => Object.keys(c.records).some((k) => k.startsWith('drill-')) },
  { id: 'drill-123', theme: 'Drills', nom: '1 111 111 101', description: 'Réussir 123 456 789 ajouté 9 fois.', test: (c) => !!record(c, 'drill-123-9') },
  { id: 'drill-123-ar', theme: 'Drills', nom: 'Aller-retour', description: 'Réussir 123 456 789 × 9 puis le retour à 0.', test: (c) => !!record(c, 'drill-123-9-ar') },
  ...[[180000, '3 minutes'], [120000, '2 minutes'], [90000, '1 min 30']].map(([ms, t]) => ({
    id: `drill-123-${ms}`, theme: 'Drills', nom: `123456789 en ${t}`, description: `123 456 789 × 9 en moins de ${t}.`, test: (c) => recordSous(c, 'drill-123-9', ms),
  })),
  // Épreuves
  { id: 'kyu-premier', theme: 'Épreuves', nom: 'Premier kyū', description: 'Réussir une épreuve de kyū.', test: (c) => Object.entries(c.records).some(([k, r]) => /^epreuve-\d+$/.test(k) && r.reussi) },
  ...[['7', '7e kyū'], ['5', '5e kyū'], ['3', '3e kyū'], ['1', '1er kyū']].map(([g, nom]) => ({
    id: `kyu-${g}`, theme: 'Épreuves', nom, description: `Réussir l'épreuve du ${nom}.`, test: (c) => reussiGrade(c, g),
  })),
  // Défi de la semaine
  ...[[1, 'Premier défi de la semaine'], [4, 'Quatre défis de la semaine'], [12, 'Douze défis de la semaine']].map(([n, nom]) => ({
    id: `defi-semaine-${n}`, theme: 'Défi de la semaine', nom, description: n === 1 ? 'Réussir un défi de la semaine.' : `Réussir le défi de la semaine ${n} semaines différentes.`, test: (c) => c.semainesDefi >= n,
  })),
  // Flash anzan
  { id: 'anzan-1s', theme: 'Flash anzan', nom: 'Œil vif', description: '10/10 en flash anzan à 1 seconde par nombre.', test: (c) => anzanParfait(c, 1) },
  { id: 'anzan-05s', theme: 'Flash anzan', nom: 'Éclair', description: '10/10 à 0,5 seconde par nombre.', test: (c) => anzanParfait(c, 0.5) },
  { id: 'anzan-2ch', theme: 'Flash anzan', nom: 'Deux chiffres', description: '10/10 avec des nombres à 2 chiffres, 1 seconde par nombre.', test: (c) => anzanParfait(c, 1, 2) },
];

/** Prépare les indicateurs utilisés par les tests de succès. */
export function contexte(d, aujourdhui) {
  const dates = [...new Set(d.sessions.map((s) => s.date))].sort();
  // Meilleure série jamais atteinte : on la recalcule à chaque fin de jour pratiqué.
  let meilleureSerie = 0;
  for (const j of dates) meilleureSerie = Math.max(meilleureSerie, serieJours(dates.filter((x) => x <= j), j).jours);
  meilleureSerie = Math.max(meilleureSerie, serieJours(dates, aujourdhui).jours);
  const niveauxGestes = Object.fromEntries(Object.entries(d.motifs).map(([k, f]) => [k, evaluer(f.hist ?? []).index]));
  return {
    sessions: d.sessions,
    records: d.records,
    valides: new Set(Object.entries(d.paliers).filter(([, e]) => e.valide).map(([id]) => id)),
    totalJustes: d.sessions.reduce((s, x) => s + (x.justes ?? 0), 0),
    meilleureSuite: d.stats?.meilleureSuite ?? 0,
    meilleureSerie,
    niveauxGestes,
    semainesDefi: new Set(Object.keys(d.records).filter((k) => k.startsWith('defi-semaine-')).map((k) => k.split('-').slice(2, 4).join('-'))).size,
  };
}

/** Succès obtenus d'après les données (ids). */
export function succesObtenus(d, aujourdhui) {
  const c = contexte(d, aujourdhui);
  return SUCCES.filter((s) => s.test(c)).map((s) => s.id);
}

/** Pour chaque thème : le prochain succès non obtenu (adapté au niveau atteint). */
export function prochainsSucces(obtenus) {
  const themes = [...new Set(SUCCES.map((s) => s.theme))];
  return themes.map((t) => SUCCES.find((s) => s.theme === t && !obtenus.includes(s.id))).filter(Boolean);
}
