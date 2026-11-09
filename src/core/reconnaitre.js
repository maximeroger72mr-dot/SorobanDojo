/**
 * Étape « Reconnaître » des leçons d'amis : choisir le geste (direct, petit ami, grand ami,
 * combiné) AVANT de l'exécuter, sans soroban ni chrono. Chez l'adulte, l'erreur vient surtout
 * de la décision : on la travaille séparément.
 *
 * 10 questions : environ 6 sur le geste de la leçon, 4 sur des gestes déjà appris. Les choix
 * proposés sont les familles déjà apprises, plus celle de la leçon. Validée à 9 sur 10, une
 * seule fois (au premier passage de la leçon), pas en révision.
 */

import { analyserOperation } from './generateur.js';
import { analyserMotif, famille } from './motifs.js';

export const QUESTIONS_RECONNAITRE = 10;
export const MIN_RECONNAITRE = 9;
export const NOMS_REGLES = { direct: 'Direct', petit: 'Petit ami', grand: 'Grand ami', mixte: 'Combiné' };
const ORDRE = ['direct', 'petit', 'grand', 'mixte'];
const AMIS = new Set([...famille('petit'), ...famille('grand'), ...famille('mixte')]);

/** La leçon a-t-elle une étape « Reconnaître » ? (leçons de petits amis, grands amis, combinaisons) */
export function aReconnaitre(sp) {
  return sp.type === 'addsub' && ['p2', 'p3', 'p4', 'p5'].includes(sp.palier?.id)
    && sp.cibles.some((c) => AMIS.has(c)) && sp.cibles.every((c) => AMIS.has(c) || c.endsWith(':direct'));
}

/**
 * Les choix et les questions.
 * @param {object} sp  sous-palier
 * @param {Set<string>} appris  gestes déjà appris (motifsAppris)
 * @returns {{ choix: string[], questions: Array<{v, op, n, cle, regle}> }}
 */
export function questionsReconnaitre(sp, appris, nombre = QUESTIONS_RECONNAITRE) {
  const connus = new Set([...appris, ...sp.cibles]);
  const regles = new Set(['direct', ...[...connus].map((c) => analyserMotif(c).regle)]);
  const choix = ORDRE.filter((r) => regles.has(r));
  const anciens = [...appris].filter((c) => !sp.cibles.includes(c));
  const questions = [];
  const vus = new Set();
  const tirer = (voulus) => {
    for (let k = 0; k < 2000; k++) {
      const v = Math.floor(Math.random() * 20);
      const op = Math.random() < 0.5 ? '+' : '-';
      const n = 1 + Math.floor(Math.random() * 9);
      const a = analyserOperation(v, op, n, 3);
      if (!a || !a.motifs.length || !voulus.includes(a.motifs[0]) || vus.has(`${v}${op}${n}`)) continue;
      vus.add(`${v}${op}${n}`);
      return { v, op, n, cle: a.motifs[0], regle: analyserMotif(a.motifs[0]).regle };
    }
    return null;
  };
  const nouveaux = Math.round(nombre * 0.6);
  for (let i = 0; i < nombre; i++) {
    const q = (i < nouveaux || !anciens.length ? tirer(sp.cibles) : tirer(anciens)) ?? tirer(sp.cibles);
    if (q) questions.push(q);
  }
  // Mélangées : on ne doit pas pouvoir deviner à l'ordre.
  questions.sort(() => Math.random() - 0.5);
  return { choix, questions };
}
