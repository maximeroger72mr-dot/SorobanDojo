/**
 * « Expliquer » : rejoue un exercice sur le soroban de démonstration.
 *  - colonne : chaque ligne est cliquable et se rejoue à partir du sous-total précédent ;
 *    « Toute la colonne » rejoue tout depuis le début ;
 *  - multiplication / division : les étapes de la méthode japonaise, geste par geste.
 */

import { etapesMultiplication, etapesDivision, etapesMultiplicationDecimale, compteChiffres, compteQuotient } from '../core/multiplication.js';
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
  const signe = (x) => String(x).replace('-', '−');
  if (ex.type === 'mul') {
    const ca = compteChiffres(ex.a);
    const cb = compteChiffres(ex.b);
    return [`Compte des chiffres : ${formaterNombre(ex.a)} → ${signe(ca)}, ${formaterNombre(ex.b)} → ${signe(cb)} ; total ${signe(ca + cb)}. Le premier produit se pose directement à la bonne place par rapport au point des unités (démonstration ci-dessous).`,
      `Vérification : ${pa} décimale${pa > 1 ? 's' : ''} + ${pb} décimale${pb > 1 ? 's' : ''} = ${pa + pb} décimale${pa + pb > 1 ? 's' : ''} au résultat exact.`,
      ex.arrondi ? `Arrondi ${consigneArrondi(ex.decimales)} : ajoutez 5 sur la décimale suivante, puis lisez jusqu'au rang demandé. Résultat : ${formaterNombre(ex.resultat)}.` : `Résultat : ${formaterNombre(ex.resultat)}.`];
  }
  const q = compteQuotient(ex.a, ex.b);
  return [`Compte des chiffres du quotient : compte(${formaterNombre(ex.a)}) − compte(${formaterNombre(ex.b)}) ${q === compteChiffres(ex.a) - compteChiffres(ex.b) + 1 ? '+ 1 (le début du dividende est ≥ au diviseur)' : '(le début du dividende est plus petit que le diviseur)'} = ${signe(q)} : ${q > 0 ? `le quotient a ${q} chiffre${q > 1 ? 's' : ''} avant la virgule` : q === 0 ? 'le quotient commence juste après la virgule (0,…)' : `le quotient commence par ${-q} zéro${-q > 1 ? 's' : ''} après la virgule`}.`,
    'On divise comme d\'habitude (estimation par le diviseur arrondi, correction de ±1), sans se soucier des virgules : le compte dit où lire le résultat.',
    ex.arrondi ? `Arrondi ${consigneArrondi(ex.decimales)} : on calcule une décimale de plus, on ajoute 5 sur cette tige, puis on lit jusqu'au rang demandé. Résultat : ${formaterNombre(ex.resultat)}.` : `Résultat : ${formaterNombre(ex.resultat)}.`];
}

/** Ouvre la fenêtre d'explication d'un exercice. */
export function ouvrirExplication(ex) {
  if (ex.type === 'table') {
    ouvrirDialogue(`${ex.a} × ${ex.b} = ${ex.attendu}`, `Deux tiges : ${ex.attendu[0]} sur la tige des dizaines${ex.attendu[0] === '0' ? ' (elle reste vide, mais elle compte)' : ''}, ${ex.attendu[1]} sur celle des unités.`, (corps) => {
      const p = new PanneauDemo(corps);
      p.jouer(demoMultiplication(ex.a || 1, ex.b), 'manuel');
      return () => p.detruire();
    });
    return;
  }
  if (ex.type === 'addsub' && ex.echelles) {
    // Colonne de décimaux : démonstration sur le soroban, virgule au point des unités.
    ouvrirDialogue(`Explication : ${texteEnonce(ex)} = ${formaterNombre(ex.resultat)}`, 'Toutes les virgules s\'alignent sur le point des unités ; les décimales sont à sa droite.', (corps) => {
      const p = new PanneauDemo(corps);
      const nbTiges = String(Math.max(...ex.echelles, Math.round(ex.resultat * 10 ** ex.decimales))).length + 2;
      p.jouer({
        titre: texteEnonce(ex), depart: 0, decimales: ex.decimales, nbTiges,
        macros: ex.lignes.map((l, i) => ({ texte: `Ligne ${i + 1} : ${i === 0 ? '' : (l.op === '+' ? '+ ' : '− ')}${formaterNombre(l.n)}`, op: l.op, valeur: ex.echelles[i] })),
        lecture: `Résultat : ${formaterNombre(ex.resultat)}.`,
      }, 'manuel');
      return () => p.detruire();
    });
    return;
  }
  if (ex.virgules) {
    ouvrirDialogue(`Explication : ${texteEnonce(ex)} ${ex.arrondi ? '≈' : '='} ${formaterNombre(ex.resultat)}`, null, (corps) => {
      corps.append(h('ol', {}, methodeDecimale(ex).map((t) => h('li', {}, t))));
      if (ex.type !== 'mul') return null;
      const p = new PanneauDemo(corps);
      const e = etapesMultiplicationDecimale(ex.a, ex.b, ex.entiers[0], ex.entiers[1], ex.virgules[0], ex.virgules[1]);
      p.jouer({ titre: texteEnonce(ex), ...e }, 'manuel');
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
