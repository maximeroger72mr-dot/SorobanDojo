/**
 * Mots du lexique cliquables dans les textes des leçons : la première occurrence de chaque
 * mot clé devient un lien qui ouvre sa définition (sans quitter la leçon).
 */

import { MOTS } from '../modules/lexique.js';
import { ouvrirDialogue } from './panneauDemo.js';
import { h } from './dom.js';

/** Expression → début de l'entrée du lexique. */
const TERMES = [
  [/petits? amis?/i, 'Ami'], [/grands? amis?/i, 'Ami'], [/céleste/i, 'Boule céleste'], [/terrestres?/i, 'Boule céleste'],
  [/pincée/i, 'Pincée'], [/anzan/i, 'Anzan'], [/kyū/i, 'Kyū'], [/mitori/i, 'Mitori'], [/coupe-file/i, 'Coupe-file'],
  [/cascades?/i, 'Cascade'], [/\bCPM\b/, 'CPM'],
];
const definition = (debut) => MOTS.find(([m]) => m.startsWith(debut));

/** Le texte, avec la première occurrence de chaque mot clé rendue cliquable. */
export function avecTermes(texte) {
  const morceaux = [];
  const vus = new Set();
  let reste = texte;
  for (;;) {
    let premier = null;
    for (const [re, cle] of TERMES) {
      if (vus.has(cle)) continue;
      const m = re.exec(reste);
      if (m && (!premier || m.index < premier.m.index)) premier = { m, cle };
    }
    if (!premier) break;
    const { m, cle } = premier;
    const def = definition(cle);
    morceaux.push(reste.slice(0, m.index));
    morceaux.push(def ? h('button', { class: 'lien terme', title: 'Définition', onclick: () => ouvrirDialogue(def[0], def[1], () => null) }, m[0]) : m[0]);
    vus.add(cle);
    reste = reste.slice(m.index + m[0].length);
  }
  morceaux.push(reste);
  return morceaux;
}
