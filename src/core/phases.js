/**
 * Progression à l'intérieur des leçons (0.40). Avant, une leçon de grands amis faisait 50 colonnes
 * identiques (1 chiffre, 5 lignes), et rien ne réagissait aux réussites.
 *
 * Une leçon de colonnes tourne en CYCLE sur quelques formats, dont un seul est la RÉFÉRENCE : celui
 * du mini-test (inchangé). Seules les colonnes de référence comptent pour la médaille de la leçon,
 * le coupe-file et les temps des gestes ; les autres comptent pour la justesse et le volume.
 *
 *  Petits et grands amis (p2 à p4) :
 *    Référence  format de la leçon (1 chiffre, 5 lignes)   → Montée après 6 colonnes justes d'affilée
 *                                                           à l'allure argent (au départ) ; après un
 *                                                           retour, après 6 colonnes, justes ou non
 *    Montée     2 chiffres, 7 à 8 lignes                    → Endurance après 6 colonnes justes
 *    Endurance  2 chiffres, 10 lignes                       → Référence après 6 colonnes justes
 *    Montée et endurance : retour en référence au bout de 12 colonnes quoi qu'il arrive.
 *  Leçons « 2 et 3 chiffres » : la référence alterne 2 et 3 chiffres (une colonne sur deux) ;
 *    montée et endurance à 3 chiffres.
 *  Colonnes d'endurance (p8, p9, 10 lignes) : 6 lignes, 8 lignes, puis 10 lignes (la référence).
 *  Filet : 2 colonnes fausses d'affilée → 3 colonnes au format de référence, doigté affiché (aide :
 *    hors médaille), puis retour à la phase en cours.
 *  Pas de cascades à 2 chiffres et plus tant que la leçon des cascades (p5-4) n'est pas validée.
 *  Le volume se compte en GESTES VISÉS réalisés (pas en colonnes) : une longue colonne avance plus.
 *  Mini-test : jauge de gestes pleine ET au moins 20 colonnes de référence.
 * Fonctions pures.
 */

import { avecGraine } from './hasard.js';

export const PASSAGE = 6;
export const SORTIE = 12;
export const REFERENCE_RETOUR = 6;
export const FILET = 3;
export const ERREURS_FILET = 2;
export const REFERENCE_MIN_TEST = 20;

/** Le plan de phases d'une leçon de colonnes, ou null (leçon sans phases : × ÷, anzan, lecture…). */
export function phasesLecon(sp) {
  if (!sp || sp.type !== 'addsub' || sp.mental || !sp.cibles?.length) return null;
  const pal = sp.palier?.id;
  const deuxTrois = sp.chiffres === 2 && /2 et 3 chiffres/.test(sp.titre);
  if (['p2', 'p3', 'p4'].includes(pal) || deuxTrois) {
    const c = deuxTrois ? 3 : Math.max(2, sp.chiffres);
    const depart = sp.departChiffres ? { departChiffres: sp.departChiffres } : {};
    return { genre: deuxTrois ? 'deuxTrois' : 'amis', ordre: [
      { id: 'reference', reference: true, titre: 'Référence', format: null },
      { id: 'montee', titre: 'Montée', passage: 'argent', format: { chiffres: c, lignes: 7, lignesMax: 8, ...depart } },
      { id: 'endurance', titre: 'Endurance', passage: 'justes', format: { chiffres: c, lignes: 10, ...depart } },
    ] };
  }
  if (['p8', 'p9'].includes(pal) && sp.lignes >= 10) {
    const f = (lignes) => ({ chiffres: sp.chiffres, ...(sp.chiffresMax ? { chiffresMax: sp.chiffresMax } : {}), lignes });
    return { genre: 'endurance', ordre: [
      { id: 'six', titre: '6 lignes', passage: 'argent', format: f(6) },
      { id: 'huit', titre: '8 lignes', passage: 'justes', format: f(8) },
      { id: 'reference', reference: true, titre: `${sp.lignes} lignes (référence)`, format: null },
    ] };
  }
  return null;
}

export const indexReference = (plan) => plan.ordre.findIndex((x) => x.reference);

/** État de départ ; `deuxChiffres` : « Je connais déjà : commencer à 2 chiffres » (la montée). */
export function etatInitial(plan, deuxChiffres = false) {
  const i = deuxChiffres ? plan.ordre.findIndex((x) => x.id === 'montee') : 0;
  return { i: Math.max(0, i), n: 0, suite: 0, justes: 0, debut: !deuxChiffres, filet: 0, erreurs: 0 };
}

/** La phase en cours (le filet compte comme la référence, doigté affiché). */
export function phaseCourante(plan, e) {
  if (e.filet > 0) return { ...plan.ordre[indexReference(plan)], id: 'filet', titre: 'Filet', filet: true, reference: false };
  return plan.ordre[e.i];
}

/**
 * Après une colonne de la phase en cours.
 * @param {{ juste: boolean, rapide: boolean }} r  rapide : à l'allure argent ou mieux
 * @returns {object}  nouvel état (pur)
 */
export function apresColonne(plan, e0, { juste, rapide }) {
  const e = { ...e0 };
  if (e.filet > 0) {
    e.filet -= 1;
    if (e.filet === 0) Object.assign(e, { n: 0, suite: 0, justes: 0, erreurs: 0 });
    return e;
  }
  e.erreurs = juste ? 0 : e.erreurs + 1;
  if (e.erreurs >= ERREURS_FILET) return { ...e, filet: FILET, erreurs: 0 };
  const ph = plan.ordre[e.i];
  e.n += 1;
  e.suite = juste && (ph.passage !== 'argent' && !ph.reference ? true : rapide) ? e.suite + 1 : 0;
  if (juste) e.justes += 1;
  const suivante = () => ({ ...e, i: (e.i + 1) % plan.ordre.length, n: 0, suite: 0, justes: 0, debut: false });
  if (ph.reference) {
    // Au départ : 6 colonnes justes d'affilée à l'allure argent ; après un retour : 6 colonnes.
    if (e.debut ? e.suite >= PASSAGE : e.n >= REFERENCE_RETOUR) return suivante();
    return e;
  }
  if (ph.passage === 'argent' ? e.suite >= PASSAGE : e.justes >= PASSAGE) return suivante();
  if (e.n >= SORTIE) return { ...e, i: indexReference(plan), n: 0, suite: 0, justes: 0, debut: false };
  return e;
}

/**
 * Objectif de la jauge en gestes visés : les répétitions de la leçon × le nombre moyen de gestes
 * visés par colonne au format de référence (tiré une fois, à graine fixe).
 */
const objectifs = new Map();
export function objectifGestes(sp, generer) {
  if (!objectifs.has(sp.id)) {
    const n = avecGraine(4040, () => Array.from({ length: 30 }, () => generer()).reduce((t, ex) => t + gestesVises(sp, ex), 0) / 30);
    objectifs.set(sp.id, Math.max(sp.repetitions, Math.round(sp.repetitions * Math.max(1, n))));
  }
  return objectifs.get(sp.id);
}
/** Gestes visés (cibles de la leçon) réalisés dans une colonne. */
export const gestesVises = (sp, ex) => (ex?.motifs ?? []).filter((m) => sp.cibles.includes(m)).length;

/** Gestes autorisés à 2 chiffres et plus : sans cascades tant que p5-4 n'est pas validée. */
export function autorisesPhase(sp, cascadesOk) {
  if (cascadesOk || !sp.autorises) return sp.autorises ?? null;
  return new Set([...sp.autorises].filter((c) => !c.startsWith('cascade')));
}
