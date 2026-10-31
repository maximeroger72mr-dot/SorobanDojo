import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { analyserOperation } from '../src/core/generateur.js';

/** Motifs de chaque ligne d'une colonne, recalculés indépendamment. */
function motifsLignes(col) {
  const res = [];
  let v = col.lignes[0].n;
  for (const l of col.lignes.slice(1)) {
    const a = analyserOperation(v, l.op, l.n, 12);
    res.push(a.motifs);
    v = a.resultat;
  }
  return res;
}

test('chaque sous-palier génère des exercices stricts ; ses démos sont valides', () => {
  for (const sp of SOUS_PALIERS) {
    for (let i = 0; i < 25; i++) {
      const ex = genererExercice(sp);
      if (sp.type === 'mul') { assert.equal(ex.a * ex.b, ex.resultat); continue; }
      if (sp.type === 'div') { assert.equal(ex.b * ex.resultat, ex.a); continue; }
      assert.equal(ex.lignes.length, sp.lignes, sp.id);
      const lignes = motifsLignes(ex);
      for (const m of lignes) assert.ok(m.every((x) => sp.autorises.has(x)), `${sp.id} : ${m}`);
      assert.ok(lignes.flat().some((m) => sp.cibles.includes(m)), sp.id);
    }
    if (sp.type === 'addsub') {
      for (const d of sp.demos) {
        const a = analyserOperation(d.depart, d.op, d.n, 8);
        assert.ok(a && a.motifs.every((m) => sp.autorises.has(m)), `${sp.id} démo ${d.depart}${d.op}${d.n} : ${a?.motifs}`);
      }
    }
  }
});

test('hors révisions, un sous-palier n\'autorise que les gestes directs et ses cibles', () => {
  const sp = SOUS_PALIERS.find((s) => s.id === 'p2-1');
  assert.deepEqual([...sp.autorises].filter((m) => !m.endsWith(':direct')).sort(), ['+3:petit', '+4:petit']);
});
