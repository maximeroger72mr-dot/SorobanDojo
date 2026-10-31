import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diviserArrondi, lireReponse, egal } from '../src/core/nombres.js';

test('arrondis exacts', () => {
  assert.equal(diviserArrondi(2675, 1000, 2), 2.68);
  assert.equal(diviserArrondi(1, 3, 3), 0.333);
  assert.equal(diviserArrondi(2, 3, 4), 0.6667);
});

test('lecture des réponses', () => {
  assert.equal(lireReponse('12 345'), 12345);
  assert.equal(lireReponse('12.345'), 12345);
  assert.equal(lireReponse('3,929', 3), 3.929);
  assert.equal(lireReponse('3.929', 3), 3.929);
  assert.equal(lireReponse('1.234,5', 1), 1234.5);
  assert.equal(lireReponse('abc'), null);
  assert.ok(egal(lireReponse('0,50', 2), 0.5, 2));
});
