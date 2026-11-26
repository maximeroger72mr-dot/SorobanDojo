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

import { genererSujet, GRADES_KYU } from './epreuves.js';
import { unites, evaluer, mediane, cpm } from './maitrise.js';
import { avecGraine } from './hasard.js';
import { SOUS_PALIERS, familleLecon } from './curriculum.js';
import { mesuresAuFormat, medianeRecente } from './mesures.js';

export const SURCOUT_PROBLEME_S = 3;
export const RATIO_PRODUIT = 2;
export const MARGE = 0.1;

/** Poids d'un problème, en « chiffres de colonne » : ses unités, doublées pour × et ÷. */
export const poidsProbleme = (ex) => unites(ex) * (ex.type === 'addsub' ? 1 : RATIO_PRODUIT);

const charges = new Map();
/** Charge d'un sujet type du grade (moyenne de 5 sujets à graine fixe) : chiffres, produits, problèmes. */
export function chargeGrade(g, filtre = null) {
  const cle = `${g.systeme ?? 'nissho'}-${g.id}-${filtre ?? 'tout'}`;
  if (!charges.has(cle)) {
    let chiffres = 0; let produits = 0; let problemes = 0;
    const N = 5;
    for (let k = 0; k < N; k++) {
      const sujet = avecGraine(1000 + k, () => genererSujet(g));
      for (const sec of sujet.sections) {
        if (filtre && sec.cle !== filtre) continue;
        for (const p of sec.problemes) {
          problemes += 1;
          if (sec.cle.startsWith('mitori')) chiffres += unites(p); else produits += unites(p);
        }
      }
    }
    charges.set(cle, { chiffres: chiffres / N, produits: produits / N, problemes: problemes / N });
  }
  return charges.get(cle);
}

/**
 * Le kyū dont l'allure (en colonnes) correspond à une médaille : le plus haut grade Nisshō dont
 * la cadence à tenir est atteinte par le seuil de la médaille. Ex. argent (3 s par chiffre) →
 * 6e kyū. null : médaille sans seuil de temps (bronze, à découvrir).
 * @param {{ temps?: { addsub: number } }} niveau  une entrée de NIVEAUX
 */
export function equivalenceKyu(niveau) {
  if (!niveau?.temps) return null;
  return GRADES_KYU.filter((g) => niveau.temps.addsub <= allureGrade(g).parChiffre).at(-1) ?? null;
}

/**
 * Cadence à tenir pour un grade.
 * @returns {{ part:number, parChiffre:number, parProduit:number, cpm:number, produitsParMinute:number }}
 *   part : part du sujet à traiter ; parChiffre / parProduit : secondes ; cpm : chiffres par minute
 */
export function allureGrade(g) {
  // Zenkoren : chaque épreuve a ses 7 minutes, sans report ; la cadence à tenir est celle de
  // l'épreuve la plus serrée (colonnes d'un côté, × et ÷ de l'autre).
  if (g.parEpreuve) {
    const part = Math.min(1, g.seuil + MARGE);
    const cles = ['mitoriA', 'mitori', 'mul', 'div'].filter((k) => g[k]);
    let parChiffre = Infinity;
    let parProduit = Infinity;
    for (const k of cles) {
      const c = chargeGrade(g, k);
      const dispo = g.minutesEpreuve * 60 - part * c.problemes * SURCOUT_PROBLEME_S;
      if (k.startsWith('mitori')) parChiffre = Math.min(parChiffre, dispo / (part * c.chiffres));
      else parProduit = Math.min(parProduit, dispo / (part * c.produits));
    }
    if (parProduit === Infinity) parProduit = RATIO_PRODUIT * parChiffre;
    return { part, parChiffre, parProduit, cpm: cpm(parChiffre), produitsParMinute: Math.round(600 / parProduit) / 10 };
  }
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
export function vitesseEleve(d, g = null) {
  const gestes = Object.values(d.motifs ?? {}).map((f) => evaluer(f.hist ?? []).temps).filter((t) => t !== null);
  const lecons = SOUS_PALIERS.filter((sp) => !sp.mental && familleLecon(sp) === 'muldiv')
    .map((sp) => evaluer(d.paliers?.[sp.id]?.hist ?? [], 'muldiv').temps).filter((t) => t !== null);
  const parGeste = gestes.length >= 5 ? mediane(gestes) : null;
  const parProduit = lecons.length >= 1 ? mediane(lecons) : null;
  if (!g) return { parChiffre: parGeste, parProduit };
  // Pour un grade (0.38.4, 0.39) : le temps par chiffre mesuré geste par geste vient de colonnes
  // courtes (1 ou 2 chiffres, 5 lignes) ; il flatte l'allure sur 10 lignes de 3 chiffres. Les
  // vraies feuilles au format du grade (planches, marches, feuille de la semaine) comptent d'abord ;
  // sinon l'estimation par geste reste, marquée « à confirmer ». De même pour × et ÷ : les feuilles
  // au format du kyū d'abord, les leçons en secours.
  const auFormat = vitesseColonnesFormat(d, g);
  const types = ['mul', 'div'].filter((k) => g[k]);
  const prod = medianeRecente((d.mesures ?? []).filter((m) => types.includes(m.partie) && mesuresAuFormat(d, m.partie, null, g[m.partie]?.total).includes(m)));
  return { parChiffre: auFormat ?? parGeste, parProduit: prod ?? parProduit, colonnesAuFormat: auFormat !== null, produitsAuFormat: prod !== null };
}

/** Format des colonnes d'un grade : lignes et chiffres (le plus long), ou null. */
export const formatColonnes = (g) => (g?.mitori ? { lignes: g.mitori.lignes, chiffres: g.mitori.chiffres ?? g.mitori.max } : null);

/** Planches prises en compte pour la vitesse au format : les 5 dernières. */
export const PLANCHES_FORMAT = 5;

/**
 * Temps par chiffre sur les planches AU FORMAT du grade (au moins ses lignes et ses chiffres),
 * sans pyramide, avec 70 % de justes au moins : médiane des 5 dernières, les 3 secondes de
 * lecture et d'écriture de chaque colonne retirées. null s'il n'y en a pas.
 */
export function vitesseColonnesFormat(d, g) {
  const f = formatColonnes(g);
  if (!f) return null;
  // 0.39 : les mesures de toutes les vraies feuilles (planches, marches, feuille de la semaine) ;
  // à défaut (sauvegardes d'avant), les planches de l'historique des séances.
  const ms = medianeRecente(mesuresAuFormat(d, 'colonnes', f));
  if (ms !== null) return ms;
  const t = (d.sessions ?? []).filter((s) => {
    const r = s.reglages ?? {};
    return s.module === 'planches' && s.total > 0 && s.dureeMs > 0 && s.justes / s.total >= 0.7 && (!r.genre || r.genre === 'gestes')
      && (!r.pyramide || r.pyramide === 'non') && r.lignes >= f.lignes && r.chiffres >= f.chiffres;
  }).slice(-PLANCHES_FORMAT).map((s) => Math.max(0.05, (s.dureeMs / s.total / 1000 - SURCOUT_PROBLEME_S) / (s.reglages.lignes * s.reglages.chiffres)));
  return t.length ? mediane(t) : null;
}

/**
 * L'élève tient-il l'allure du grade ?
 * @returns {{ allure, colonnes:{besoin,eleve,ok}, muldiv:{besoin,eleve,ok}, minutes:number|null }}
 *   besoin / eleve : secondes par unité ; minutes : temps qu'il lui faudrait pour traiter la part
 *   exigée à sa vitesse actuelle (null si elle n'est pas mesurée).
 */
export function verdictAllure(g, d) {
  const allure = allureGrade(g);
  const v = vitesseEleve(d, g);
  const c = chargeGrade(g);
  const ok = (eleve, besoin) => (eleve === null ? null : eleve <= besoin);
  const complet = v.parChiffre !== null && (v.parProduit !== null || c.produits === 0);
  const minutes = complet
    ? (allure.part * (c.chiffres * v.parChiffre + c.produits * (v.parProduit ?? 0) + c.problemes * SURCOUT_PROBLEME_S)) / 60
    : null;
  return {
    allure,
    colonnes: { besoin: allure.parChiffre, eleve: v.parChiffre, ok: ok(v.parChiffre, allure.parChiffre), auFormat: v.colonnesAuFormat },
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

/** Part de la cadence d'examen exigée pour valider une leçon (l'épreuve, elle, demande 100 %). */
export const PART_CADENCE_LECON = 0.8; // 0.42 : 80 % (avant 70 % : on abordait le 3e kyū presque deux fois trop lentement)

/**
 * Temps maximal par unité (chiffre ou produit) au mini-test d'une leçon AVANCÉE : 80 % de la
 * cadence de l'examen du premier grade qui exige cette leçon. La cadence complète s'atteint en
 * fin de grade, pas à chaque leçon. null si la leçon n'est exigée par aucun grade.
 * @param {(g:object) => string[]} prerequisDe  leçons exigées par un grade (parcours.PREREQUIS)
 */
export function tempsLecon(sp, grades, prerequisDe) {
  const g = grades.find((x) => (prerequisDe(x) ?? []).includes(sp.id));
  if (!g) return null;
  const a = allureGrade(g);
  return { grade: g, temps: (familleLecon(sp) === 'muldiv' ? a.parProduit : a.parChiffre) / PART_CADENCE_LECON };
}
