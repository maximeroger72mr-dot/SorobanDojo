/**
 * Lièvre et marathon qui grandissent avec l'élève (0.40). Avant, en séance, le lièvre restait à
 * 1 chiffre sur 5 lignes et le marathon à 1 chiffre, du premier jour au dan.
 *
 *  Stade                     Lièvre                                  Marathon
 *  directs, petits amis      1 chiffre, 5 lignes                     1 chiffre, sous-total toutes les 5 lignes
 *  grands amis validés       2 chiffres, 7 lignes                    2 chiffres, sous-total toutes les 5 lignes
 *  10e kyū et plus           2 à 3 chiffres (en alternance), 10 l.   3 chiffres, sous-total toutes les 10 lignes
 *  6e kyū et plus            format du grade moins 1 chiffre, 10 l.  4 à 5 chiffres (en alternance), zéros internes
 *  dan (1er kyū réussi)      5 à 7 chiffres mêlés, 10 lignes         5 à 10 chiffres mêlés, au moins 20 lignes
 *
 * Durée fixe d'environ 3 min 30 : c'est le nombre de lignes (marathon) ou de colonnes (lièvre) qui
 * s'adapte à la vitesse mesurée. Variantes, tournées d'une séance à l'autre : lièvre normal, lièvre
 * qui accélère dans la colonne, lièvre contre son fantôme (sa meilleure cadence) ; marathon normal,
 * marathon à soustractions en cascade (une fois les cascades apprises).
 * Fonctions pures.
 */

import { estValide, formatExamen } from './parcours.js';
import { systemeChoisi } from './epreuves.js';
import { kyuPasse } from './examen.js';
import { vitesseEleve } from './allure.js';
import { TOUS_LES_MOTIFS, analyserMotif } from './motifs.js';

export const SECONDES_RYTHME = 210;
const joursPratiques = (d, date) => new Set((d.sessions ?? []).filter((s) => s.date < date).map((s) => s.date)).size;

/** Le stade de l'élève, pour le lièvre et le marathon. */
export function stadeRythme(d) {
  const sys = systemeChoisi(d);
  const passe = (id) => { const g = sys.grades.find((x) => x.id === id); return !!g && kyuPasse(d, sys, g); };
  if (passe('1')) return 'dan';
  if (passe('6')) return 'kyu6';
  if (passe('10')) return 'kyu10';
  if (estValide(d, 'p4-5')) return 'grands';
  return 'base';
}

/** Gestes de soustraction en cascade (variante du marathon). */
export const CASCADES_MOINS = TOUS_LES_MOTIFS.filter((c) => c.startsWith('cascade') && analyserMotif(c).op === '-');

/**
 * Réglages du lièvre ou du marathon proposés en séance.
 * @param {'lievre'|'marathon'} jeu
 * @returns {object}  paramètres à passer à l'écran Rythme (chiffres, lignes, chiffresMax, tranche,
 *   zeros, variante…), et `cibles` quand la variante les impose
 */
export function formatRythme(d, date, jeu) {
  const stade = stadeRythme(d);
  const n = joursPratiques(d, date);
  const t = vitesseEleve(d).parChiffre ?? 2;
  if (jeu === 'lievre') {
    const fe = formatExamen(d);
    const f = {
      base: { chiffres: 1, lignes: 5 },
      grands: { chiffres: 2, lignes: 7 },
      kyu10: { chiffres: n % 2 ? 3 : 2, lignes: 10 },
      kyu6: { chiffres: Math.max(2, (fe.chiffres ?? 3) - 1), lignes: 10 },
      dan: { chiffres: 5, chiffresMax: 7, lignes: 10 },
    }[stade];
    const variante = ['normal', 'accelere', 'fantome'][n % 3];
    const moy = f.chiffresMax ? (f.chiffres + f.chiffresMax) / 2 : f.chiffres;
    const parColonne = f.lignes * t * moy * 1.2 + 6;
    return { ...f, stade, variante, colonnes: Math.max(2, Math.min(8, Math.round(SECONDES_RYTHME / parColonne))) };
  }
  const f = {
    base: { chiffres: 1, tranche: 5 },
    grands: { chiffres: 2, tranche: 5 },
    kyu10: { chiffres: 3, tranche: 10 },
    kyu6: { chiffres: n % 2 ? 5 : 4, tranche: 10, zeros: true },
    dan: { chiffres: 5, chiffresMax: 10, tranche: 10 },
  }[stade];
  const moy = f.chiffresMax ? (f.chiffres + f.chiffresMax) / 2 : f.chiffres;
  const brut = SECONDES_RYTHME / (t * moy + 1);
  // Bornes : 30 à 40 lignes au début (le geste s'installe), au moins 20 au dan, 60 au plus.
  const [min, max] = stade === 'base' ? [30, 40] : [stade === 'dan' ? 20 : 2 * f.tranche, 60];
  const lignes = Math.max(min, Math.min(max, Math.round(brut / f.tranche) * f.tranche));
  const cascade = n % 2 === 1 && estValide(d, 'p5-4') && CASCADES_MOINS.length > 0;
  return { ...f, lignes, stade, variante: cascade ? 'cascade' : 'normal', ...(cascade ? { cibles: CASCADES_MOINS } : {}) };
}
