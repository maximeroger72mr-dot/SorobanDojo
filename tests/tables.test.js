import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serie81, serieTable, produitLent, cleProduit } from '../src/core/tables.js';

test('tables : 81 produits distincts, table d\'un diviseur, tirage des plus lents', () => {
  const s = serie81();
  assert.equal(new Set(s.map((e) => `${e.a}x${e.b}`)).size, 81);
  assert.ok(serieTable(18).every((e) => e.a === 18 || e.b === 18));
  // 7 × 8 très lent : il doit sortir bien plus souvent que les autres
  const stats = { [cleProduit(7, 8)]: { hist: Array(6).fill({ ok: 0, t: 5 }) } };
  let n = 0;
  let precedent = null;
  for (let i = 0; i < 300; i++) { const e = produitLent(stats, precedent); precedent = cleProduit(e.a, e.b); if (precedent === '7x8') n += 1; }
  assert.ok(n > 60, `7 × 8 tiré ${n} fois sur 300`);
});
