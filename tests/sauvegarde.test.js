import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exporter, lireExport, fusionner } from '../src/core/sauvegarde.js';

const base = () => ({ version: 2, sessions: [], records: {}, motifs: {}, paliers: {}, succes: {}, stats: { suite: 0, meilleureSuite: 0 }, reglages: {} });

test('export puis lecture', () => {
  const d = base();
  d.sessions.push({ date: '2026-11-01', module: 'lecons', total: 10, justes: 9, dureeMs: 1000, horodatage: 1 });
  assert.deepEqual(lireExport(exporter(d)), d);
  assert.throws(() => lireExport('pas du json'), /JSON/);
  assert.throws(() => lireExport('{"a":1}'), /Soroban/);
});

test('fusion : le meilleur des deux', () => {
  const a = base();
  const b = base();
  a.sessions.push({ date: '2026-11-01', module: 'lecons', total: 10, justes: 9, dureeMs: 1000, horodatage: 1 });
  b.sessions.push({ date: '2026-11-01', module: 'lecons', total: 10, justes: 9, dureeMs: 1000, horodatage: 1 },
    { date: '2026-11-02', module: 'drills', total: 1, justes: 1, dureeMs: 5000, horodatage: 2 });
  a.records['drill-123-9'] = { dureeMs: 200000 };
  b.records['drill-123-9'] = { dureeMs: 150000 };
  a.records['epreuve-10'] = { points: 180 };
  b.records['epreuve-10'] = { points: 160 };
  a.paliers['p1-1'] = { reps: 5, valide: null, carte: null };
  b.paliers['p1-1'] = { reps: 20, valide: '2026-11-02', carte: { boite: 2, echeance: '2026-11-05' } };
  b.succes.x = '2026-11-02';
  const f = fusionner(a, b);
  assert.equal(f.sessions.length, 2);
  assert.equal(f.records['drill-123-9'].dureeMs, 150000);
  assert.equal(f.records['epreuve-10'].points, 180);
  assert.equal(f.paliers['p1-1'].reps, 20);
  assert.equal(f.paliers['p1-1'].valide, '2026-11-02');
  assert.equal(f.succes.x, '2026-11-02');
});
