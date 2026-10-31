import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serieJours } from '../src/core/regularite.js';
import { semaineISO, avecGraine } from '../src/core/hasard.js';

test('série : jours d\'affilée, repos toléré une fois par semaine', () => {
  assert.equal(serieJours(['2026-11-01', '2026-11-02', '2026-11-03'], '2026-11-03').jours, 3);
  // Aujourd'hui pas encore fait : la série d'hier tient
  assert.deepEqual(serieJours(['2026-11-01', '2026-11-02'], '2026-11-03'), { jours: 2, aujourdhuiFait: false, reposUtilise: false });
  // Un jour de repos au milieu : toléré
  assert.equal(serieJours(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05'], '2026-11-05').jours, 4);
  // Deux jours manqués d'affilée : cassée
  assert.equal(serieJours(['2026-11-01', '2026-11-04', '2026-11-05'], '2026-11-05').jours, 2);
  // Deux repos à moins de 7 jours d'écart : le second casse
  assert.equal(serieJours(['2026-11-01', '2026-11-03', '2026-11-05', '2026-11-06'], '2026-11-06').jours, 3);
  assert.equal(serieJours([], '2026-11-06').jours, 0);
});

test('semaine ISO et hasard reproductible', () => {
  assert.equal(semaineISO('2026-11-02').cle, '2026-S45');
  assert.equal(semaineISO('2027-01-01').cle, '2026-S53');
  const a = avecGraine(42, () => [Math.random(), Math.random()]);
  const b = avecGraine(42, () => [Math.random(), Math.random()]);
  assert.deepEqual(a, b);
});
