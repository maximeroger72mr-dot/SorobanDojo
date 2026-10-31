import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapesMultiplication, etapesDivision, appliquerMacros, genererDivision } from '../src/core/multiplication.js';
import { Soroban } from '../src/core/soroban.js';
import { calculerGestes } from '../src/core/gestes.js';

test('両落とし : 37 × 85, positions des produits partiels', () => {
  const e = etapesMultiplication(37, 85);
  assert.deepEqual(e.macros.slice(1).map((m) => m.valeur), [2400, 150, 560, 35]);
  assert.equal(appliquerMacros(0, e.macros), 3145);
});

test('両落とし : 372 × 8 (exemple classique 24, 56, 16) et produit à un chiffre « 06 »', () => {
  assert.deepEqual(etapesMultiplication(372, 8).macros.slice(1).map((m) => m.valeur), [2400, 560, 16]);
  assert.match(etapesMultiplication(23, 3).macros[1].texte, /06/);
});

test('片落とし : règle des deux tiges / juste à gauche', () => {
  const e1 = etapesDivision(7 * 2 * 1, 2); // 14 ÷ 2 : « 1 » < 2 → juste à gauche
  assert.match(e1.macros[1].texte, /juste à gauche/);
  const e2 = etapesDivision(156, 12); // « 15 » ≥ 12 → deux tiges
  assert.match(e2.macros[1].texte, /deux tiges/);
});

test('division : le soroban finit avec le quotient à sa place, reste 0, pour 300 divisions', () => {
  for (let i = 0; i < 300; i++) {
    const nd = 1 + (i % 3);
    const nq = 1 + (Math.floor(i / 3) % 3);
    const { a, b, resultat } = genererDivision(nd, nq);
    const e = etapesDivision(a, b);
    const fin = appliquerMacros(e.depart, e.macros);
    assert.equal(fin, resultat * 10 ** e.rangUniteQuotient, `${a} ÷ ${b}`);
    // Chaque étape est réalisable par le moteur de gestes (jamais négatif, jamais d'emprunt dans le quotient).
    const s = new Soroban(e.nbTiges);
    s.definirValeur(e.depart);
    let v = e.depart;
    for (const m of e.macros) {
      if (!m.valeur) continue;
      const r = calculerGestes(s.instantane(), s.tigeUnites, m.op, m.valeur);
      for (const g of r.etapes.flatMap((x) => x.mouvements)) s.appliquerMouvement(g);
      v = m.op === '+' ? v + m.valeur : v - m.valeur;
      assert.equal(s.valeur(), v);
    }
    assert.equal(e.rangUniteQuotient, nd + 1, "unité du quotient : (chiffres du diviseur + 1) tiges à gauche");
  }
});

import { aideDivision } from '../src/core/multiplication.js';

test('144 ÷ 18 : estimation 7 (18 ≈ 20), trop petit, correction à 8', () => {
  const aide = aideDivision(144, 18);
  assert.deepEqual(aide.table.slice(0, 3), [18, 36, 54]);
  const e = aide.etapes[0];
  assert.equal(e.arrondi, 20);
  assert.equal(e.estime, 7);
  assert.deepEqual(e.essais.map((x) => [x.q, x.ok]), [[7, false], [8, true]]);
  const d = etapesDivision(144, 18);
  assert.ok(d.macros.some((m) => /trop petit/.test(m.texte)));
  assert.equal(appliquerMacros(d.depart, d.macros), 8 * 10 ** d.rangUniteQuotient);
});

test('112 ÷ 14 : estimation trop grande corrigée de tête', () => {
  const d = etapesDivision(112, 14);
  assert.ok(d.macros.some((m) => /trop grand/.test(m.texte)));
  assert.equal(appliquerMacros(d.depart, d.macros), 8 * 10 ** d.rangUniteQuotient);
});
