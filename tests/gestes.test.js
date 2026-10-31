import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Soroban, chiffreDepuisEtat } from '../src/core/soroban.js';
import { calculerGestes, tousLesMouvements, ErreurCalcul } from '../src/core/gestes.js';

const etatDe = (n, nbTiges = 5) => {
  const s = new Soroban(nbTiges);
  s.definirValeur(n);
  return s.instantane();
};
const valeurDe = (etats) => etats.reduce((v, e) => v * 10 + chiffreDepuisEtat(e), 0);
const regles = (r) => r.etapes.filter((e) => e.mouvements.length).map((e) => e.regle);
const mvts = (r) => tousLesMouvements(r.etapes).map((m) => `${m.tige}:${m.perle[0]}${m.delta > 0 ? '+' : ''}${m.delta}`);

test('exhaustif : toute addition et soustraction à 3 chiffres donne le bon résultat', () => {
  for (let a = 0; a < 1000; a += 1) {
    for (let b = 0; b < 1000; b += 7) {
      const plus = calculerGestes(etatDe(a), 4, '+', b);
      assert.equal(valeurDe(plus.etatFinal), a + b, `${a}+${b}`);
      // Rejouer les mouvements sur un vrai soroban : chacun doit être physiquement possible.
      const s = new Soroban(5);
      s.definirValeur(a);
      for (const m of tousLesMouvements(plus.etapes)) s.appliquerMouvement(m);
      assert.equal(s.valeur(), a + b);
      if (b <= a) {
        const moins = calculerGestes(etatDe(a), 4, '-', b);
        assert.equal(valeurDe(moins.etatFinal), a - b, `${a}-${b}`);
      }
    }
  }
});

test('direct : 2 + 2, 1 + 7 (pincée)', () => {
  assert.deepEqual(regles(calculerGestes(etatDe(2), 4, '+', 2)), ['direct']);
  assert.deepEqual(mvts(calculerGestes(etatDe(1), 4, '+', 7)), ['4:c+5', '4:t+2']);
});

test('petit ami en addition : 4 + 3 = +5 −2', () => {
  const r = calculerGestes(etatDe(4), 4, '+', 3);
  assert.deepEqual(regles(r), ['petit-ami']);
  assert.deepEqual(mvts(r), ['4:c+5', '4:t-2']);
  // doigts : index pour les deux
  assert.deepEqual(tousLesMouvements(r.etapes).map((m) => m.doigt), ['index', 'index']);
});

test('petit ami en soustraction : 6 − 3 = +2 −5 (pouce puis index)', () => {
  const r = calculerGestes(etatDe(6), 4, '-', 3);
  assert.deepEqual(mvts(r), ['4:t+2', '4:c-5']);
  assert.deepEqual(tousLesMouvements(r.etapes).map((m) => m.doigt), ['pouce', 'index']);
});

test('grand ami en addition : 8 + 7 = −3 puis +1 aux dizaines', () => {
  const r = calculerGestes(etatDe(8), 4, '+', 7);
  assert.deepEqual(mvts(r), ['4:t-3', '3:t+1']);
});

test('grand ami + petit ami : 5 + 6 = (−4 via +1 −5) puis +1', () => {
  const r = calculerGestes(etatDe(5), 4, '+', 6);
  assert.deepEqual(mvts(r), ['4:t+1', '4:c-5', '3:t+1']);
});

test('retenue en cascade : 99 + 1', () => {
  const r = calculerGestes(etatDe(99), 4, '+', 1);
  assert.equal(valeurDe(r.etatFinal), 100);
  // −9 aux unités, puis +1 aux dizaines qui devient −9 et +1 aux centaines
  assert.deepEqual(mvts(r), ['4:c-5', '4:t-4', '3:c-5', '3:t-4', '2:t+1']);
});

test('emprunt : 13 − 8 = −1 aux dizaines puis +2 (petit ami +5 −3)', () => {
  const r = calculerGestes(etatDe(13), 4, '-', 8);
  assert.deepEqual(mvts(r), ['3:t-1', '4:c+5', '4:t-3']);
});

test('emprunt en cascade : 100 − 1', () => {
  const r = calculerGestes(etatDe(100), 4, '-', 1);
  assert.equal(valeurDe(r.etatFinal), 99);
});

test('de gauche à droite : 12 + 34 commence par les dizaines', () => {
  const r = calculerGestes(etatDe(12), 4, '+', 34);
  assert.equal(tousLesMouvements(r.etapes)[0].tige, 3);
});

test('erreurs : négatif et dépassement', () => {
  assert.throws(() => calculerGestes(etatDe(5), 4, '-', 6), ErreurCalcul);
  assert.throws(() => calculerGestes(etatDe(99999), 4, '+', 1), ErreurCalcul);
});

const cles = (r) => r.motifs.map((m) => m.cle);

test('motifs : direct, petit, grand, mixte', () => {
  assert.deepEqual(cles(calculerGestes(etatDe(2), 4, '+', 2)), ['+2:direct']);
  assert.deepEqual(cles(calculerGestes(etatDe(4), 4, '+', 3)), ['+3:petit']);
  assert.deepEqual(cles(calculerGestes(etatDe(8), 4, '+', 7)), ['+7:grand', '+1:direct']);
  assert.deepEqual(cles(calculerGestes(etatDe(5), 4, '+', 6)), ['+6:mixte', '+1:direct']);
  assert.deepEqual(cles(calculerGestes(etatDe(6), 4, '-', 3)), ['-3:petit']);
  assert.deepEqual(cles(calculerGestes(etatDe(13), 4, '-', 8)), ['-8:mixte', '-1:direct']);
  assert.deepEqual(cles(calculerGestes(etatDe(15), 4, '-', 7)), ['-7:grand', '-1:direct']);
});

test('motifs : retenue sur 4 (petit ami) et cascades', () => {
  assert.deepEqual(cles(calculerGestes(etatDe(49), 4, '+', 1)), ['+1:grand', '+1:petit']);
  assert.deepEqual(cles(calculerGestes(etatDe(99), 4, '+', 1)), ['+1:grand', 'cascade+', '+1:direct']);
  assert.deepEqual(cles(calculerGestes(etatDe(100), 4, '-', 1)), ['-1:grand', 'cascade-', '-1:direct']);
});

test('chaque étape porte le motif du chiffre principal', () => {
  const r = calculerGestes(etatDe(5), 4, '+', 6);
  assert.ok(r.etapes.every((e) => e.motif === '+6:mixte'));
});
