import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnostiquerColonne, diagnostiquerMultiplication, diagnostiquerDivision } from '../src/core/diagnostic.js';

const col = { lignes: [{ op: '+', n: 53 }, { op: '+', n: 23 }, { op: '-', n: 14 }], resultat: 62 };

test('colonne : ligne oubliée, signe inversé, retenue, céleste', () => {
  assert.match(diagnostiquerColonne(col, 39).join(), /oubli de la ligne 2/);
  assert.match(diagnostiquerColonne(col, 90).join(), /mauvais signe/);
  assert.match(diagnostiquerColonne(col, 72).join(), /retenue ou un emprunt/);
  assert.match(diagnostiquerColonne(col, 67).join(), /céleste/);
  assert.match(diagnostiquerColonne(col, 26).join(), /inversés/);
});

test('multiplication : produit oublié, décalage', () => {
  // 37 × 85 = 3145 ; produits 2400, 150, 560, 35
  assert.match(diagnostiquerMultiplication({ a: 37, b: 85, resultat: 3145 }, 3145 - 560).join(), /7 × 8 semble oublié/);
  assert.match(diagnostiquerMultiplication({ a: 37, b: 85, resultat: 3145 }, 31450).join(), /décalé/);
});

test('division : chiffre du quotient trop grand', () => {
  assert.match(diagnostiquerDivision({ a: 156, b: 12, resultat: 13 }, 14).join(), /trop grand de 1/);
});

import { localiserErreur, motifsDeLigne } from '../src/core/diagnostic.js';

test('localisation : seulement quand le résultat le prouve', () => {
  // 3 + 4 (petit ami +4 sur les unités) + 2 (direct) = 9
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }, { op: '+', n: 2 }], resultat: 9 };
  // Céleste oubliée : 3 + 4 fait sans le +5 → résultat 4 : écart −5 sur les unités → ligne 2, +4 petit ami
  assert.deepEqual(localiserErreur(ex, 4), { ligne: 1, motifs: ['+4:petit'], raison: 'boule céleste' });
  // Écart de 2 : rien ne le prouve → aucune accusation
  assert.equal(localiserErreur(ex, 11), null);
  // Deux petits amis possibles sur les unités → ambigu → null
  const ex2 = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }, { op: '-', n: 5 }, { op: '+', n: 4 }], resultat: 6 };
  assert.equal(localiserErreur(ex2, 1), null);
  assert.deepEqual(motifsDeLigne(ex2, 3), ['+4:petit']);
});

test('localisation : retenue oubliée du grand ami', () => {
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 8 }, { op: '+', n: 7 }, { op: '+', n: 1 }], resultat: 16 };
  assert.deepEqual(localiserErreur(ex, 6), { ligne: 1, motifs: ['+7:grand'], raison: 'retenue ou emprunt' });
});

import { erreurIdentifiee } from '../src/core/diagnostic.js';

test('erreur identifiée : une seule ligne peut l\'expliquer, sinon rien', () => {
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 478 }, { op: '+', n: 236 }, { op: '-', n: 152 }, { op: '+', n: 317 }], resultat: 879 };
  // Ligne 3 oubliée : 879 + 152
  assert.deepEqual([erreurIdentifiee(ex, 1031).ligne, erreurIdentifiee(ex, 1031).type], [2, 'oubliee']);
  // Ligne 2 faite deux fois
  assert.equal(erreurIdentifiee(ex, 879 + 236).type, 'doublee');
  // Ligne 3 avec le mauvais signe : +152 au lieu de −152
  assert.deepEqual([erreurIdentifiee(ex, 879 + 304).ligne, erreurIdentifiee(ex, 879 + 304).type], [2, 'signe']);
  // Juste, sans réponse, ou colonne à résultat négatif : rien
  assert.equal(erreurIdentifiee(ex, 879), null);
  assert.equal(erreurIdentifiee(ex, null), null);
  assert.equal(erreurIdentifiee({ ...ex, negatif: true }, 1031), null);
  // Écart quelconque (ici +37) : aucune ligne ne l'explique
  assert.equal(erreurIdentifiee(ex, 879 + 37), null);
});

test('erreur identifiée : ambiguë dès que deux lignes sont possibles', () => {
  // Écart de +20 : un 3 lu 5 à la ligne 2, ou un 1 lu 3 à la ligne 4… plusieurs lignes possibles
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 478 }, { op: '+', n: 236 }, { op: '-', n: 152 }, { op: '+', n: 317 }], resultat: 879 };
  assert.equal(erreurIdentifiee(ex, 899), null);
  // Deux lignes identiques en valeur : l'oubli de l'une ou de l'autre ne se distingue pas
  const ex2 = { type: 'addsub', lignes: [{ op: '+', n: 50 }, { op: '+', n: 23 }, { op: '-', n: 11 }, { op: '+', n: 23 }], resultat: 85 };
  assert.equal(erreurIdentifiee(ex2, 62), null);
});

test('erreur identifiée : ligne décalée d\'une tige', () => {
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 4718 }, { op: '+', n: 2364 }, { op: '+', n: 37 }], resultat: 7119 };
  // 37 posé une tige trop à gauche (370) : +333
  const r = erreurIdentifiee(ex, 7119 + 333);
  assert.deepEqual([r.ligne, r.type], [2, 'decalee']);
});

import { amisInverses } from '../src/core/diagnostic.js';

test('ami fait à l\'envers : +4 sur 3 fait « +5 +1 » au lieu de « +5 −1 »', () => {
  // 3 + 4 = 7 ; à l'envers : 3 + 5 + 1 = 9, soit 2 de trop
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }], resultat: 7 };
  assert.deepEqual(amisInverses(ex, 9).map((a) => [a.ligne, a.cle, a.complement]), [[1, '+4:petit', 1]]);
  assert.match(diagnostiquerColonne(ex, 9)[0], /petit ami \(\+5 −1\).*\+5 \+1.*ajouté au lieu d'être retiré/);
  assert.deepEqual(localiserErreur(ex, 9), { ligne: 1, motifs: ['+4:petit'], raison: 'petit ami fait à l\'envers' });
  // Autre écart : rien
  assert.deepEqual(amisInverses(ex, 10), []);
});

test('ami fait à l\'envers : grand ami en addition et petit ami en soustraction', () => {
  // 7 + 8 = 15 (−2 +10) ; à l'envers +2 +10 = 19 : 4 de trop
  const g = { type: 'addsub', lignes: [{ op: '+', n: 7 }, { op: '+', n: 8 }], resultat: 15 };
  assert.deepEqual(amisInverses(g, 19).map((a) => [a.cle, a.complement, a.famille]), [['+8:grand', 2, 'grand']]);
  // 6 − 3 = 3 (+2 −5) ; à l'envers −2 −5 : 4 de moins → −1, impossible sur le soroban, mais 16 − 3 = 13 → 9
  const p = { type: 'addsub', lignes: [{ op: '+', n: 16 }, { op: '-', n: 3 }], resultat: 13 };
  assert.deepEqual(amisInverses(p, 9).map((a) => a.cle), ['-3:petit']);
  assert.match(diagnostiquerColonne(p, 9)[0], /retiré au lieu d'être ajouté/);
});

test('ami fait à l\'envers : deux lignes possibles, aucun geste accusé', () => {
  // +4 petit ami deux fois sur la même tige : l'écart de 2 ne dit pas lequel
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }, { op: '-', n: 4 }, { op: '+', n: 4 }], resultat: 7 };
  assert.equal(amisInverses(ex, 9).length, 2);
  assert.equal(localiserErreur(ex, 9), null);
});
