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
 *    0.40.4 : leçons d'introduction à 1 chiffre (p2-1, p3-1…) : la montée et l'endurance ALLONGENT
 *    la colonne (7 à 8 lignes, puis 10) sans passer à 2 chiffres ; les leçons à 2 chiffres et plus
 *    (« 2 et 3 chiffres », synthèses) gardent leur nombre de chiffres.
 *    Montée et endurance : retour en référence au bout de 12 colonnes quoi qu'il arrive.
 *  Leçons « 2 et 3 chiffres » : la référence alterne 2 et 3 chiffres (une colonne sur deux) ;
 *    montée et endurance à 3 chiffres.
 *  Colonnes d'endurance (p8, p9, 10 lignes) : une RAMPE, faite une seule fois : 6 lignes, 8 lignes,
 *    puis 10 lignes (la référence), où l'on reste (0.41 ; avant, le cycle renvoyait aux 6 lignes et
 *    une leçon p9 passait de 20 à près de 80 colonnes). Rampe sautée quand la leçon d'endurance
 *    précédente est validée à l'argent ou mieux.
 *  Filet : 2 colonnes fausses d'affilée SUR UN GESTE VISÉ (0.41) → 3 colonnes au format le plus
 *    simple de la leçon (la référence pour les amis ; 6 lignes pour l'endurance, 0.41), doigté
 *    affiché (aide : hors médaille), puis retour à la phase en cours.
 *  Pas de cascades à 2 chiffres et plus tant que la leçon des cascades (p5-4) n'est pas validée.
 *  Le volume se compte en GESTES VISÉS réalisés (pas en colonnes) : une longue colonne avance plus.
 *  Petits et grands amis, 2 et 3 chiffres (0.40.2) : la jauge n'est pleine qu'après 6 colonnes faites
 *    en ENDURANCE (justes ou fausses). Garde : gestes suffisants sans endurance faite, la référence
 *    passe directement à l'endurance au bout de 6 colonnes (sans réussir la montée), sinon un élève
 *    qui ne réussit jamais la montée ne finirait jamais la leçon.
 *  Jauge : les gestes visés des colonnes fausses comptent aussi (0.40.2), comme les anciennes
 *    répétitions.
 *  Jauge pleine : on ne remonte plus, la fin de la leçon se fait au format du mini-test (0.41 ; avant,
 *    l'élève parfait faisait la leçon la plus longue, à remonter sans cesse).
 *  Mini-test : jauge de gestes pleine ET au moins 40 % des répétitions en colonnes de référence
 *    (20 pour p2 à p4, 12 pour p8, 8 pour p9).
 * Fonctions pures.
 */

import { avecGraine } from './hasard.js';

export const PASSAGE = 6;
export const SORTIE = 12;
export const REFERENCE_RETOUR = 6;
export const FILET = 3;
export const ERREURS_FILET = 2;
export const PART_REFERENCE = 0.4;
/** Colonnes à faire en endurance (2 chiffres, 10 lignes) pour les leçons d'amis (0.40.2). */
export const ENDURANCE_MIN = 6;
/** Colonnes d'endurance exigées par une leçon à phases (0 pour les leçons d'endurance à rampe). */
export const enduranceExigee = (plan) => (plan && !plan.rampe && plan.ordre.some((x) => x.id === 'endurance') ? ENDURANCE_MIN : 0);
/** Colonnes de référence à faire avant le mini-test : 40 % des répétitions de la leçon (0.41). */
export const referenceMin = (sp) => Math.max(1, Math.round(PART_REFERENCE * (sp.repetitions ?? 0)));

/** Part des lignes d'autres amis (à partir des grands amis), tirée pour chaque colonne (0.40.10). */
export const PART_AMIS = { montee: [0.2, 0.4], endurance: [0.45, 0.65] };

/** Le plan de phases d'une leçon de colonnes, ou null (leçon sans phases : × ÷, anzan, lecture…). */
export function phasesLecon(sp) {
  if (!sp || sp.type !== 'addsub' || sp.mental || !sp.cibles?.length) return null;
  const pal = sp.palier?.id;
  const deuxTrois = sp.chiffres === 2 && /2 et 3 chiffres/.test(sp.titre);
  if (['p2', 'p3', 'p4'].includes(pal) || deuxTrois) {
    const c = deuxTrois ? 3 : sp.chiffres;
    const depart = sp.departChiffres ? { departChiffres: sp.departChiffres } : {};
    // 0.40.10 : à partir des grands amis (p3), les lignes sans geste visé piochent largement dans
    // les autres amis appris, part tirée pour chaque colonne : 20 à 40 % en montée, 45 à 65 % en
    // endurance. Petits amis (p2) : une ligne au plus en endurance (0.40.9), trop peu d'amis appris.
    const grands = pal !== 'p2';
    const amisMontee = grands ? { amis: true, partAmis: PART_AMIS.montee } : {};
    const amisEndurance = grands ? { amis: true, partAmis: PART_AMIS.endurance } : { amis: true };
    return { genre: deuxTrois ? 'deuxTrois' : 'amis', ordre: [
      { id: 'reference', reference: true, titre: 'Référence', format: null },
      { id: 'montee', titre: 'Montée', passage: 'argent', format: { chiffres: c, lignes: 7, lignesMax: 8, ...depart, ...amisMontee } },
      // 0.40.9 : en endurance, une ligne au plus avec un autre ami déjà appris (`amis`).
      // 0.40.11 : endurance à 2 chiffres pour les leçons de grands amis à 1 chiffre (les lignes sans
      // aucun ami deviennent rares ; le geste visé tombe sur l'une ou l'autre tige).
      { id: 'endurance', titre: 'Endurance', passage: 'justes', format: { chiffres: grands && c === 1 ? 2 : c, lignes: 10, ...depart, ...amisEndurance } },
    ] };
  }
  if (['p8', 'p9'].includes(pal) && sp.lignes >= 10) {
    const f = (lignes) => ({ chiffres: sp.chiffres, ...(sp.chiffresMax ? { chiffresMax: sp.chiffresMax } : {}), lignes });
    return { genre: 'endurance', rampe: true, ordre: [
      { id: 'six', titre: '6 lignes', passage: 'argent', format: f(6) },
      { id: 'huit', titre: '8 lignes', passage: 'justes', format: f(8) },
      { id: 'reference', reference: true, titre: `${sp.lignes} lignes (référence)`, format: null },
    ] };
  }
  return null;
}

export const indexReference = (plan) => plan.ordre.findIndex((x) => x.reference);

/** La leçon d'endurance (à rampe) qui précède `sp` dans la liste des leçons, ou null. */
export function enduranceAvant(sp, liste) {
  const i = liste.findIndex((x) => x.id === sp.id);
  for (let j = i - 1; j >= 0; j--) if (phasesLecon(liste[j])?.rampe) return liste[j];
  return null;
}

/**
 * État de départ ; `deuxChiffres` : « Je connais déjà » (on commence par la montée) ;
 * `sansRampe` : endurance, la leçon d'endurance précédente est validée à l'argent (on part en référence).
 */
export function etatInitial(plan, deuxChiffres = false, { sansRampe = false } = {}) {
  const i = deuxChiffres ? plan.ordre.findIndex((x) => x.id === 'montee') : sansRampe && plan.rampe ? indexReference(plan) : 0;
  return { i: Math.max(0, i), n: 0, suite: 0, justes: 0, debut: !deuxChiffres, filet: 0, erreurs: 0 };
}

/** Format du filet : le plus simple de la leçon (la référence ; la première marche de la rampe). */
const phaseFilet = (plan) => plan.ordre[plan.rampe ? 0 : indexReference(plan)];

/** La phase en cours (le filet : format le plus simple, doigté affiché). */
export function phaseCourante(plan, e) {
  if (e.filet > 0) return { ...phaseFilet(plan), id: 'filet', titre: 'Filet', filet: true, reference: false };
  return plan.ordre[e.i];
}

/**
 * Après une colonne de la phase en cours.
 * @param {{ juste: boolean, rapide: boolean, erreurVisee?: boolean, jaugePleine?: boolean, versEndurance?: boolean }} r
 *   rapide : à l'allure argent ou mieux ; erreurVisee : l'erreur porte (ou peut porter) sur un geste
 *   visé ; jaugePleine : la jauge est pleine, endurance comprise (on ne remonte plus) ;
 *   versEndurance : gestes suffisants mais endurance pas faite (on y va sans passer par la montée)
 * @returns {object}  nouvel état (pur)
 */
export function apresColonne(plan, e0, { juste, rapide, erreurVisee = true, jaugePleine = false, versEndurance = false }) {
  const e = { ...e0 };
  if (e.filet > 0) {
    e.filet -= 1;
    if (e.filet === 0) Object.assign(e, { n: 0, suite: 0, justes: 0, erreurs: 0 });
    return e;
  }
  // Seules les erreurs sur un geste visé mènent au filet ; une erreur ailleurs ne compte pas.
  if (juste) e.erreurs = 0;
  else if (erreurVisee) e.erreurs += 1;
  if (e.erreurs >= ERREURS_FILET) return { ...e, filet: FILET, erreurs: 0 };
  const ph = plan.ordre[e.i];
  e.n += 1;
  e.suite = juste && (ph.passage !== 'argent' && !ph.reference ? true : rapide) ? e.suite + 1 : 0;
  if (juste) e.justes += 1;
  const suivante = () => ({ ...e, i: (e.i + 1) % plan.ordre.length, n: 0, suite: 0, justes: 0, debut: false });
  const versReference = () => ({ ...e, i: indexReference(plan), n: 0, suite: 0, justes: 0, debut: false });
  const iEnd = plan.ordre.findIndex((x) => x.id === 'endurance');
  const versEnd = () => ({ ...e, i: iEnd, n: 0, suite: 0, justes: 0, debut: false });
  if (versEndurance && !plan.rampe && iEnd >= 0) {
    if (ph.id === 'montee') return versEnd();
    if (ph.reference && e.n >= REFERENCE_RETOUR) return versEnd();
    if (ph.reference) return e;
  }
  // Endurance : la rampe ne se refait pas ; jauge pleine : on finit au format du mini-test.
  if (ph.reference && (plan.rampe || jaugePleine)) return e;
  if (!ph.reference && jaugePleine) return versReference();
  if (ph.reference) {
    // Au départ : 6 colonnes justes d'affilée à l'allure argent ; après un retour : 6 colonnes.
    if (e.debut ? e.suite >= PASSAGE : e.n >= REFERENCE_RETOUR) return suivante();
    return e;
  }
  if (ph.passage === 'argent' ? e.suite >= PASSAGE : e.justes >= PASSAGE) return suivante();
  if (e.n >= SORTIE) return plan.rampe ? suivante() : versReference();
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
