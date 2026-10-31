/**
 * « Expliquer » : rejoue un exercice sur le soroban de démonstration.
 *  - colonne : chaque ligne est cliquable et se rejoue à partir du sous-total précédent ;
 *    « Toute la colonne » rejoue tout depuis le début ;
 *  - multiplication / division : les étapes de la méthode japonaise, geste par geste.
 */

import { etapesMultiplication, etapesDivision } from '../core/multiplication.js';
import { sousTotaux } from '../core/generateur.js';
import { PanneauDemo, ouvrirDialogue } from './panneauDemo.js';
import { rendreEnonce, texteEnonce, consigneArrondi } from './enonce.js';
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

/** Texte de méthode pour un calcul avec décimaux (la démonstration se fait sur les entiers). */
function methodeDecimale(ex) {
  const [A, B] = ex.entiers;
  const [pa, pb] = ex.virgules;
  if (ex.type === 'mul') {
    return [`On calcule ${formaterNombre(A)} × ${formaterNombre(B)} comme des entiers (démonstration ci-dessous) = ${formaterNombre(A * B)}.`,
      `Virgule : ${pa} décimale${pa > 1 ? 's' : ''} + ${pb} décimale${pb > 1 ? 's' : ''} = ${pa + pb} décimales.`,
      ex.arrondi ? `Puis on arrondit ${consigneArrondi(ex.decimales)} : on regarde la décimale suivante (5 ou plus : au-dessus). Résultat : ${formaterNombre(ex.resultat)}.` : `Résultat : ${formaterNombre(ex.resultat)}.`];
  }
  return [pb ? `On rend le diviseur entier : on décale la virgule de ${pb} rang${pb > 1 ? 's' : ''} vers la droite dans le diviseur ET dans le dividende.` : 'Le diviseur est déjà entier.',
    'On divise comme d\'habitude (estimation par le diviseur arrondi, correction de ±1), en continuant après la virgule, une décimale de plus que demandé.',
    `On arrondit ${consigneArrondi(ex.decimales)} : 5 ou plus à la décimale suivante, on arrondit au-dessus. Résultat : ${formaterNombre(ex.resultat)}.`];
}

/** Ouvre la fenêtre d'explication d'un exercice. */
export function ouvrirExplication(ex) {
  if (ex.virgules) {
    ouvrirDialogue(`Explication : ${texteEnonce(ex)} ≈ ${formaterNombre(ex.resultat)}`, null, (corps) => {
      corps.append(h('ol', {}, methodeDecimale(ex).map((t) => h('li', {}, t))));
      if (ex.type !== 'mul') return null;
      const p = new PanneauDemo(corps);
      p.jouer(demoMultiplication(ex.entiers[0], ex.entiers[1]), 'manuel');
      return () => p.detruire();
    });
    return;
  }
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
