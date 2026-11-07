import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterJours, nouvelleCarte, reviser, estDue } from '../src/core/revision.js';

test('dates', () => {
  assert.equal(ajouterJours('2026-12-30', 3), '2027-01-02');
  assert.equal(ajouterJours('2026-02-27', 2), '2026-03-01');
});

test('Leitner J-1, J-3, J-7, J-14, J-30, une boîte de moins sur échec', () => {
  let c = nouvelleCarte('2026-11-01');
  assert.deepEqual(c, { boite: 1, echeance: '2026-11-02' });
  const attendus = ['2026-11-05', '2026-11-09', '2026-11-16', '2026-12-02', '2026-12-02'];
  for (const e of attendus) {
    c = reviser(c, true, '2026-11-02');
    assert.equal(c.echeance, e);
  }
  assert.equal(c.boite, 5);
  c = reviser(c, false, '2026-12-01');
  assert.deepEqual(c, { boite: 4, echeance: '2026-12-15' });
  for (let i = 0; i < 5; i++) c = reviser(c, false, '2026-12-01');
  assert.deepEqual(c, { boite: 1, echeance: '2026-12-02' });
  assert.ok(estDue(c, '2026-12-02') && !estDue(c, '2026-12-01'));
});
