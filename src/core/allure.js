/**
 * Allure d'un grade : la cadence qu'il faut tenir pour réussir son épreuve dans le temps.
 *
 * Les niveaux d'acquisition (débutant, confirmé, expert) mesurent un geste ; ils ne disent pas
 * si l'on va assez vite pour un kyū donné. Ici, pour chaque grade, on part du sujet : le nombre
 * de chiffres à poser en mitorizan, le nombre de produits de table en × et ÷, le temps imparti
 * et la part du sujet à traiter pour passer (le seuil de réussite, plus une marge de 10 points
 * pour les erreurs). On en tire une cadence en colonnes et une cadence en × et ÷.
 *
 * Hypothèses, constantes ci-dessous : 3 secondes par problème pour lire et écrire la réponse ;
 * un produit de table coûte deux fois un chiffre de colonne (le rapport des seuils « confirmé »).
 */

import { genererSujet } from './epreuves.js';
import { unites, evaluer, mediane, cpm } from './maitrise.js';
import { avecGraine } from './hasard.js';
import { SOUS_PALIERS, familleLecon } from './curriculum.js';

export const SURCOUT_PROBLEME_S = 3;
export const RATIO_PRODUIT = 2;
export const MARGE = 0.1;

/** Poids d'un problème, en « chiffres de colonne » : ses unités, doublées pour × et ÷. */
export const poidsProbleme = (ex) => unites(ex) * (ex.type === 'addsub' ? 1 : RATIO_PRODUIT);

const charges = new Map();
/** Charge d'un sujet type du grade (moyenne de 5 sujets à graine fixe) : chiffres, produits, problèmes. */
export function chargeGrade(g) {
  if (!charges.has(g.id)) {
    let chiffres = 0; let produits = 0; let problemes = 0;
    const N = 5;
    for (let k = 0; k < N; k++) {
      const sujet = avecGraine(1000 + k, () => genererSujet(g));
      for (const sec of sujet.sections) for (const p of sec.problemes) {
        problemes += 1;
        if (sec.cle === 'mitori') chiffres += unites(p); else produits += unites(p);
      }
    }
    charges.set(g.id, { chiffres: chiffres / N, produits: produits / N, problemes: problemes / N });
  }
  return charges.get(g.id);
}

/**
 * Cadence à tenir pour un grade.
 * @returns {{ part:number, parChiffre:number, parProduit:number, cpm:number, produitsParMinute:number }}
 *   part : part du sujet à traiter ; parChiffre / parProduit : secondes ; cpm : chiffres par minute
 */
export function allureGrade(g) {
  const c = chargeGrade(g);
  const part = Math.min(1, g.seuil + MARGE);
  const disponible = g.minutes * 60 - part * c.problemes * SURCOUT_PROBLEME_S;
  const parChiffre = disponible / (part * (c.chiffres + RATIO_PRODUIT * c.produits));
  return { part, parChiffre, parProduit: RATIO_PRODUIT * parChiffre, cpm: cpm(parChiffre), produitsParMinute: Math.round(600 / (RATIO_PRODUIT * parChiffre)) / 10 };
}

/**
 * Vitesse mesurée de l'élève : temps médian par chiffre sur ses gestes, et par produit sur ses
 * leçons de multiplication et de division. null tant qu'il n'y a pas assez de mesures.
 */
export function vitesseEleve(d) {
  const gestes = Object.values(d.motifs ?? {}).map((f) => evaluer(f.hist ?? []).temps).filter((t) => t !== null);
  const lecons = SOUS_PALIERS.filter((sp) => !sp.mental && familleLecon(sp) === 'muldiv')
    .map((sp) => evaluer(d.paliers?.[sp.id]?.hist ?? [], 'muldiv').temps).filter((t) => t !== null);
  return { parChiffre: gestes.length >= 5 ? mediane(gestes) : null, parProduit: lecons.length >= 1 ? mediane(lecons) : null };
}

/**
 * L'élève tient-il l'allure du grade ?
 * @returns {{ allure, colonnes:{besoin,eleve,ok}, muldiv:{besoin,eleve,ok}, minutes:number|null }}
 *   besoin / eleve : secondes par unité ; minutes : temps qu'il lui faudrait pour traiter la part
 *   exigée à sa vitesse actuelle (null si elle n'est pas mesurée).
 */
export function verdictAllure(g, d) {
  const allure = allureGrade(g);
  const v = vitesseEleve(d);
  const c = chargeGrade(g);
  const ok = (eleve, besoin) => (eleve === null ? null : eleve <= besoin);
  const complet = v.parChiffre !== null && (v.parProduit !== null || c.produits === 0);
  const minutes = complet
    ? (allure.part * (c.chiffres * v.parChiffre + c.produits * (v.parProduit ?? 0) + c.problemes * SURCOUT_PROBLEME_S)) / 60
    : null;
  return {
    allure,
    colonnes: { besoin: allure.parChiffre, eleve: v.parChiffre, ok: ok(v.parChiffre, allure.parChiffre) },
    muldiv: { besoin: allure.parProduit, eleve: v.parProduit, ok: ok(v.parProduit, allure.parProduit) },
    minutes,
  };
}

/**
 * Avance ou retard pendant une épreuve, en secondes (positif : en avance). On compare le temps
 * écoulé au temps « prévu » pour ce qui est déjà traité, si l'on répartit le temps imparti sur
 * la part du sujet à traiter.
 * @param {number} fait  poids des problèmes déjà répondus (poidsProbleme)
 * @param {number} total  poids de tout le sujet
 */
export function ecartAllure(fait, total, part, limiteMs, ecouleMs) {
  const prevu = Math.min(1, fait / (part * total)) * limiteMs;
  return (prevu - ecouleMs) / 1000;
}
