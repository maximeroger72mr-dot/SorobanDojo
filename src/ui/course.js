/**
 * Course contre le fantôme, rendue visible :
 *  - deux barres l'une sous l'autre : la vôtre (avance à chaque calcul fini) et celle du fantôme,
 *    qui avance de façon continue au rythme de sa référence ;
 *  - l'écart exact à chaque passage (« −1,4 s » d'avance en vert, « +0,8 s » de retard en rouge).
 *
 * Le fantôme est votre record, ou, tant qu'il n'y en a pas, « le maître » : un rythme de
 * référence calculé à partir des seuils de niveau (voir fantomeMaitre).
 */

import { h } from './dom.js';
import { NIVEAUX, tempsCible } from '../core/maitrise.js';

/**
 * @param {{ total: number, msParUnite: number, nom: string }} o
 *   total : nombre d'étapes (calculs, lignes) ; msParUnite : temps du fantôme par étape
 */
export function creerCourse(o) {
  const vous = h('div', { class: 'course-remplissage vous' });
  const lui = h('div', { class: 'course-remplissage fantome' });
  const el = h('div', { class: 'course' },
    h('div', { class: 'course-ligne' }, h('span', { class: 'course-nom' }, 'Vous'), h('div', { class: 'course-piste' }, vous)),
    h('div', { class: 'course-ligne' }, h('span', { class: 'course-nom' }, o.nom), h('div', { class: 'course-piste' }, lui)));
  const fraction = (x) => `${Math.min(100, (100 * x) / o.total)}%`;
  return {
    el,
    /** Rafraîchit les barres (à appeler souvent : le fantôme avance en continu). */
    maj(fait, ecouleMs) {
      vous.style.width = fraction(fait);
      lui.style.width = fraction(ecouleMs / o.msParUnite);
    },
    /** Écart au passage : négatif = d'avance. */
    ecartMs: (fait, ecouleMs) => ecouleMs - fait * o.msParUnite,
    /** Élément « −1,4 s » (vert) ou « +0,8 s » (rouge). */
    ecart(fait, ecouleMs) {
      const e = ecouleMs - fait * o.msParUnite;
      const t = `${e < 0 ? '−' : '+'}${(Math.abs(e) / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
      return h('span', { class: `ecart ${e < 0 ? 'avance' : 'retard'}` }, ` ${t} ${e < 0 ? 'd\'avance' : 'de retard'}`);
    },
  };
}

/**
 * Le maître : un fantôme de référence quand on n'a pas encore de record. Temps moyen par
 * exercice au seuil d'un niveau (débutant, confirmé ou expert), sur un échantillon d'exercices.
 * @param {() => object} generer  générateur d'exercices du défi
 * @param {'debutant'|'confirme'|'expert'} niveau
 */
export function fantomeMaitre(generer, niveau = 'confirme') {
  const n = NIVEAUX.find((x) => x.id === niveau);
  const echantillon = Array.from({ length: 12 }, generer);
  const ms = echantillon.reduce((s, ex) => s + tempsCible(ex, n) * 1000, 0) / echantillon.length;
  return { msParExercice: ms, nom: `le maître (${n.nom.toLowerCase().replace('acquis ', '')})` };
}

/**
 * Médaille d'une série, avec les couleurs des niveaux : platine (rythme expert), or (confirmé),
 * argent (débutant), bronze (au moins 90 % de justes, plus lentement).
 */
export function medaille(dureeMoyenneMs, exemples, justes, total) {
  if (!total || justes / total < 0.9) return null;
  const seuil = (id) => exemples.reduce((s, ex) => s + tempsCible(ex, NIVEAUX.find((x) => x.id === id)) * 1000, 0) / exemples.length;
  if (dureeMoyenneMs <= seuil('expert')) return { nom: 'platine', texte: 'Platine : rythme expert.' };
  if (dureeMoyenneMs <= seuil('confirme')) return { nom: 'or', texte: 'Or : rythme confirmé.' };
  if (dureeMoyenneMs <= seuil('debutant')) return { nom: 'argent', texte: 'Argent : rythme débutant.' };
  return { nom: 'bronze', texte: 'Bronze : juste, la vitesse viendra.' };
}
