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
    if (sp.type === 'theorie') { assert.ok(sp.sections.length >= 4); continue; }
    for (let i = 0; i < 25; i++) {
      const ex = genererExercice(sp);
      if (sp.type === 'placement') { assert.ok(Number.isInteger(ex.rang) && ex.rang < ex.nbTiges, sp.id); continue; }
      if (ex.type === 'table') { assert.equal(ex.attendu, String(ex.a * ex.b).padStart(2, '0')); continue; }
      if (ex.echelles) {
        const somme = ex.lignes.reduce((v, l, k) => v + (l.op === '+' ? ex.echelles[k] : -ex.echelles[k]), 0);
        assert.equal(somme / 10 ** ex.decimales, ex.resultat, sp.id);
        continue;
      }
      if (ex.virgules) {
        if (ex.type === 'mul') assert.ok(Math.abs(ex.a * ex.b - ex.resultat) <= 0.0005 + 1e-9, `${sp.id} ${ex.a}×${ex.b}`);
        else assert.ok(Math.abs(ex.a / ex.b - ex.resultat) <= 0.0005 + 1e-9, `${sp.id} ${ex.a}÷${ex.b}`);
        continue;
      }
      if (sp.zeros && ex.type === 'mul') assert.ok(/0/.test(`${ex.a}${ex.b}`), sp.id);
      if (sp.zeros && ex.type === 'div') assert.match(String(ex.resultat), /\d0\d/, sp.id);
      if (sp.type === 'mul') { assert.equal(ex.a * ex.b, ex.resultat); continue; }
      if (sp.type === 'div') { assert.equal(ex.b * ex.resultat, ex.a); continue; }
      // Une ligne de plus est permise pour varier le résultat (anti-répétition).
      assert.ok(ex.lignes.length === sp.lignes || ex.lignes.length === sp.lignes + 1, sp.id);
      const lignes = motifsLignes(ex);
      for (const m of lignes) assert.ok(m.every((x) => sp.autorises.has(x)), `${sp.id} : ${m}`);
      if (sp.zeros) assert.ok(ex.lignes.slice(1).every((l) => String(l.n).slice(1).includes('0')), `${sp.id} zéros`);
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
