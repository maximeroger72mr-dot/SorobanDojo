import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { phasesLecon } from '../src/core/phases.js';
import { chiffresIdentiques, genererColonne } from '../src/core/generateur.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const format = (id, ph) => phasesLecon(sp(id)).ordre.find((x) => x.id === ph).format;
const vise = (s, c, k) => (c.motifsLignes[k] ?? []).some((m) => s.cibles.includes(m));

test('0.40.11 : endurance à 2 chiffres pour les grands amis, montée à 1 chiffre ; petits amis inchangés', () => {
  for (const id of ['p3-1', 'p3-3', 'p4-2']) {
    assert.equal(format(id, 'endurance').chiffres, 2, id);
    assert.equal(format(id, 'montee').chiffres, 1, id);
  }
  assert.equal(format('p2-4', 'endurance').chiffres, 1);
  assert.equal(format('p3-4', 'endurance').chiffres, 3);
  assert.equal(format('p4-5', 'endurance').chiffres, 3);
});

test('0.40.11 : la 1re ligne ne porte plus toujours le geste visé (montée, endurance) ; référence inchangée', () => {
  for (const id of ['p3-2', 'p4-3']) {
    const s = sp(id);
    for (const ph of ['montee', 'endurance']) {
      const cols = Array.from({ length: 60 }, () => genererExercice(s, {}, { format: format(id, ph) }));
      const l1 = cols.filter((c) => vise(s, c, 1)).length;
      assert.ok(l1 < 55, `${id} ${ph} : 1re ligne visée ${l1}/60`);
      assert.ok(cols.every((c) => c.motifs.some((m) => s.cibles.includes(m))), `${id} ${ph} : geste visé dans chaque colonne`);
      // La 2e ligne n'est plus (presque) jamais vide de geste visé.
      assert.ok(cols.filter((c) => vise(s, c, 2)).length >= 4, `${id} ${ph} : 2e ligne`);
    }
    const ref = Array.from({ length: 30 }, () => genererExercice(s, {}, {}));
    assert.ok(ref.every((c) => vise(s, c, 1)), `${id} référence : 1re ligne toujours le geste visé`);
  }
});

test('0.40.11 : nombres à chiffres identiques (11 … 99) écartés, un au plus par colonne', () => {
  assert.ok(chiffresIdentiques(44) && chiffresIdentiques(333) && !chiffresIdentiques(7) && !chiffresIdentiques(45));
  const s = sp('p3-1');
  let n = 0, rep = 0;
  for (let i = 0; i < 60; i++) {
    const c = genererExercice(s, {}, { format: format('p3-1', 'endurance') });
    const r = c.lignes.filter((l) => chiffresIdentiques(l.n)).length;
    assert.ok(r <= 1);
    n += c.lignes.length; rep += r;
  }
  assert.ok(rep / n < 0.03, `${rep}/${n}`);
  // Planche ciblée à 2 chiffres sur +9 grand ami : avant, des +99 à répétition.
  let r2 = 0;
  for (let i = 0; i < 30; i++) r2 += genererColonne({ chiffres: 2, lignes: 6, cibles: ['+9:grand'] }).lignes.filter((l) => chiffresIdentiques(l.n)).length;
  assert.ok(r2 <= 8, `planche +9 grand : ${r2}`);
});
