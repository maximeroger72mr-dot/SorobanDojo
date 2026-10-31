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
