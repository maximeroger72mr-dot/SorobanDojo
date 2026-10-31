/**
 * « Expliquer » : rejoue un exercice sur le soroban de démonstration.
 *  - colonne : chaque ligne est cliquable et se rejoue à partir du sous-total précédent ;
 *    « Toute la colonne » rejoue tout depuis le début ;
 *  - multiplication / division : les étapes de la méthode japonaise, geste par geste.
 */

import { etapesMultiplication, etapesDivision } from '../core/multiplication.js';
import { sousTotaux } from '../core/generateur.js';
import { PanneauDemo, ouvrirDialogue } from './panneauDemo.js';
import { rendreEnonce, texteEnonce } from './enonce.js';
import { h, formaterNombre } from './dom.js';

const signe = (op) => (op === '+' ? '+' : '−');

/** Démonstration complète d'une colonne (une annonce par ligne). */
export function demoColonne(ex) {
  return {
    titre: texteEnonce(ex),
    depart: 0,
    macros: ex.lignes.map((l, i) => ({
      texte: i === 0 ? `Ligne 1 : on pose ${formaterNombre(l.n)}.` : `Ligne ${i + 1} : ${signe(l.op)} ${formaterNombre(l.n)}`,
      op: l.op, valeur: l.n,
    })),
    lecture: `Résultat : ${formaterNombre(ex.resultat)}.`,
  };
}

export function demoMultiplication(a, b) {
  const e = etapesMultiplication(a, b);
  return { titre: `${formaterNombre(a)} × ${formaterNombre(b)}`, ...e };
}

export function demoDivision(a, b) {
  const e = etapesDivision(a, b);
  const rangs = String(e.resultat).split('').map((_, i, t) => e.rangUniteQuotient + t.length - 1 - i);
  return { titre: `${formaterNombre(a)} ÷ ${formaterNombre(b)}`, ...e, rangsResultat: rangs };
}

/** Ouvre la fenêtre d'explication d'un exercice. */
export function ouvrirExplication(ex) {
  ouvrirDialogue(`Explication : ${texteEnonce(ex)} = ${formaterNombre(ex.resultat)}`, null, (corps) => {
    const panneau = { courant: null };
    if (ex.type === 'mul' || ex.type === 'div') {
      corps.append(h('p', { class: 'discret' }, 'Avancez étape par étape avec Espace. Le soroban ne sert qu\'à montrer : refaites ensuite le geste sur le vôtre.'));
      panneau.courant = new PanneauDemo(corps);
      panneau.courant.jouer(ex.type === 'mul' ? demoMultiplication(ex.a, ex.b) : demoDivision(ex.a, ex.b), 'manuel');
    } else {
      const st = sousTotaux(ex.lignes);
      const zone = h('div', {});
      corps.append(h('div', { class: 'disposition-colonne' },
        h('div', {},
          h('p', { class: 'discret', style: 'margin-top:0' }, 'Cliquez une ligne pour revoir seulement ce geste. Comparez les sous-totaux avec votre soroban pour trouver où l\'écart apparaît.'),
          rendreEnonce(ex, { sousTotaux: true, surLigne: (i) => panneau.courant.jouer(i === 0
            ? { depart: 0, op: '+', n: ex.lignes[0].n }
            : { depart: st[i - 1], op: ex.lignes[i].op, n: ex.lignes[i].n }, 'manuel') }),
          h('button', { class: 'btn', style: 'margin-top:8px', onclick: () => panneau.courant.jouer(demoColonne(ex), 'manuel') }, 'Toute la colonne')),
        zone));
      panneau.courant = new PanneauDemo(zone);
      panneau.courant.jouer(demoColonne(ex), 'manuel');
    }
    return () => panneau.courant?.detruire();
  });
}
