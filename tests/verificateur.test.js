import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Soroban } from '../src/core/soroban.js';
import { calculerGestes } from '../src/core/gestes.js';
import { Verificateur } from '../src/core/verificateur.js';

/** Prépare un soroban à `depart` et un vérificateur pour l'opération ; relie les deux. */
function preparer(depart, op, n) {
  const s = new Soroban(5);
  s.definirValeur(depart);
  const v = new Verificateur(calculerGestes(s.instantane(), 4, op, n).etapes);
  const reponses = [];
  s.surChangement((e) => { if (e.source === 'eleve') reponses.push(v.soumettre(e)); });
  return { s, v, reponses };
}

test('8 + 7 : complément puis retenue, boules une par une', () => {
  const { s, reponses } = preparer(8, '+', 7);
  s.pousserTerrestre(4, 2); // descend la 3e terrestre seulement : −1
  s.pousserTerrestre(4, 0); // descend les 2 restantes : −2
  s.pousserTerrestre(3, 0); // +1 aux dizaines
  assert.deepEqual(reponses.map((r) => r.statut), ['ok', 'ok', 'termine']);
  assert.equal(s.valeur(), 15);
});

test('ordre libre dans la pincée du petit ami, imposé entre étapes', () => {
  const a = preparer(4, '+', 3); // +5 −2
  a.s.pousserTerrestre(4, 2); // −2 d'abord
  a.s.basculerCeleste(4);
  assert.deepEqual(a.reponses.map((r) => r.statut), ['ok', 'termine']);

  const b = preparer(8, '+', 7); // retenue avant le complément : refusé
  b.s.pousserTerrestre(3, 0);
  assert.equal(b.reponses[0].statut, 'erreur');
  assert.equal(b.reponses[0].attendu.tige, 4);
  assert.equal(b.reponses[0].attendu.delta, -3);
});

test('geste direct au lieu du petit ami : erreur', () => {
  const { s, reponses } = preparer(3, '+', 2); // 3 + 2 : il faut +5 −3
  s.pousserTerrestre(4, 3); // monte la 4e terrestre (+1) : ce n'est pas le geste
  assert.equal(reponses[0].statut, 'erreur');
  assert.equal(reponses[0].etape.motif, '+2:petit');
});
