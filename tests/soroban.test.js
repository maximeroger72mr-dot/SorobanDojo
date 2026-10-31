import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Soroban, etatDepuisChiffre, chiffreDepuisEtat } from '../src/core/soroban.js';

test('chiffre <-> état', () => {
  for (let c = 0; c <= 9; c++) assert.equal(chiffreDepuisEtat(etatDepuisChiffre(c)), c);
  assert.deepEqual(etatDepuisChiffre(7), { celeste: true, terrestres: 2 });
});

test('poser et lire une valeur', () => {
  const s = new Soroban(7);
  s.definirValeur(906_413);
  assert.equal(s.valeur(), 906_413);
  assert.equal(s.chiffre(6), 3);
  assert.equal(s.chiffre(0), 0);
  assert.throws(() => s.definirValeur(12_345_678));
});

test('points de repère toutes les 3 tiges depuis les unités', () => {
  const s = new Soroban(9);
  const marquees = [...Array(9).keys()].filter((t) => s.estMarquee(t));
  assert.deepEqual(marquees, [2, 5, 8]);
});

test('clics : les boules terrestres se poussent entre elles', () => {
  const s = new Soroban(1);
  s.pousserTerrestre(0, 2); // la 3e boule monte, entraînant les 2 au-dessus
  assert.equal(s.chiffre(0), 3);
  s.pousserTerrestre(0, 1); // la 2e boule (active) redescend avec celle du dessous
  assert.equal(s.chiffre(0), 1);
  s.basculerCeleste(0);
  assert.equal(s.chiffre(0), 6);
});

test('événements de changement', () => {
  const s = new Soroban(3);
  const evts = [];
  s.surChangement((e) => evts.push(e));
  s.definirChiffre(2, 4);
  s.definirChiffre(2, 4); // pas de changement => pas d'événement
  assert.equal(evts.length, 1);
  assert.equal(evts[0].apres.terrestres, 4);
});
