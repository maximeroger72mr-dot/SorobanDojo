import { test } from 'node:test';
import assert from 'node:assert/strict';

test('bilan imprimable : les chiffres clés', async () => {
  globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
  globalThis.localStorage.setItem('soroban-progression', JSON.stringify({ version: 2,
    sessions: [
      { date: '2026-11-01', module: 'lecons', total: 20, justes: 18, dureeMs: 600000 },
      { date: '2026-11-03', module: 'examen', reglages: { grade: '20' }, total: 20, justes: 15, dureeMs: 300000 },
    ],
    paliers: { 'p1-1': { valide: '2026-11-02' } }, records: {}, motifs: {} }));
  const { chargerProgression, progression } = await import('../src/core/progression.js?bilan');
  await chargerProgression();
  const { donneesBilan } = await import('../src/modules/bilan.js');
  const b = donneesBilan(progression(), '2026-11-07');
  assert.equal(b.debut, '2026-11-01');
  assert.equal(b.joursPratique, 2);
  assert.equal(b.minutes30, 15);
  assert.equal(b.exercices, 40);
  assert.equal(b.lecons.validees.length, 1);
  assert.deepEqual(b.kyu.map((k) => [k.nom, k.reussi]), [['20e kyū prép.', true]]);
});
