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
  // 0.41 : termes japonais de la séance.
  [/mi-naoshi|見直し/i, 'Mi-naoshi'], [/Nisshō|Zenkoren/, 'Nisshō'], [/\bdan\b/, 'Dan'], [/yomiage/i, 'Yomiage'], [/kuku|九九/i, '九九'], [/shōzan/i, 'Shōzan'],
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

/**
 * 0.41 : la même chose en INFOBULLE (survol), pour les textes placés dans un bouton (lignes de la
 * séance : un bouton dans un bouton n'est pas permis). Chaque terme trouvé devient un <abbr>.
 */
export function avecInfobulles(texte) {
  return avecTermes(texte).map((x) => (typeof x === 'string' ? x : h('abbr', { class: 'terme', title: definition(TERMES.find(([re]) => re.test(x.textContent))?.[1] ?? '')?.[1] ?? '' }, x.textContent)));
}
