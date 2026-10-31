import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { genererExercice, analyserOperation } from '../src/core/generateur.js';

test('chaque sous-palier génère des exercices stricts, et ses démos sont valides', () => {
  for (const sp of SOUS_PALIERS) {
    for (let i = 0; i < 150; i++) {
      const ex = genererExercice(sp);
      assert.equal(ex.termes.length, sp.termes, sp.id);
      assert.ok(ex.motifs.every((m) => sp.autorises.has(m)), `${sp.id} : ${ex.motifs}`);
      assert.ok(ex.motifs.some((m) => sp.cibles.includes(m)), sp.id);
    }
    for (const d of sp.demos) {
      const a = analyserOperation(d.depart, d.op, d.n, 6);
      assert.ok(a, `${sp.id} démo ${d.depart}${d.op}${d.n}`);
      assert.ok(a.motifs.every((m) => sp.autorises.has(m)), `${sp.id} démo ${d.depart}${d.op}${d.n} : ${a.motifs}`);
    }
  }
});

test('chaque motif ciblé par un sous-palier est réellement atteignable', async () => {
  const { genererOperation } = await import('../src/core/generateur.js');
  for (const sp of SOUS_PALIERS) {
    for (const cible of sp.cibles) {
      const ex = genererOperation({ chiffres: sp.chiffres, autorises: sp.autorises, cibles: [cible] });
      assert.ok(ex.motifs.includes(cible), `${sp.id} : ${cible}`);
    }
  }
});
