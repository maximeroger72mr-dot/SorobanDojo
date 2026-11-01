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

import { genererPlacement, facteurAvecZero, genererMultiplication } from '../src/core/multiplication.js';

test('zéros internes et placement', () => {
  for (let i = 0; i < 200; i++) {
    assert.match(String(facteurAvecZero(3)), /^\d0\d$/);
    const m = genererMultiplication(3, 1, true);
    assert.ok(/0/.test(String(m.a) + String(m.b)));
    const d = genererDivision(1, 3, true);
    assert.match(String(d.resultat), /^\d0\d$/);
  }
  // 37 × 85 : 4 chiffres → dizaine du premier produit sur le rang 3 (4e tige)
  for (let i = 0; i < 100; i++) {
    const p = genererPlacement('mul', 3);
    assert.equal(p.rang, String(p.a).length + String(p.b).length - 1);
    const q = genererPlacement('div', 2);
    const e = etapesDivision(q.a, q.b);
    assert.equal(q.rang, e.rangUniteQuotient + String(e.resultat).length - 1);
  }
  assert.match(etapesMultiplication(406, 7).macros[2].texte, /00 : rien à poser/);
});

import { compteChiffres, compteQuotient, etapesMultiplicationDecimale, genererColonneDecimale, genererPlacementDecimal } from '../src/core/multiplication.js';

test('décimaux : compte signé des chiffres et placement direct', () => {
  assert.equal(compteChiffres(37.2), 2);
  assert.equal(compteChiffres(0.85), 0);
  assert.equal(compteChiffres(0.04), -1);
  assert.equal(compteChiffres(0.003), -2);
  // 3,7 × 8,5 = 31,45 ; 0,037 × 8 = 0,296
  const e = etapesMultiplicationDecimale(3.7, 8.5, 37, 85, 1, 1);
  assert.equal(appliquerMacros(0, e.macros) / 10 ** e.decimales, 31.45);
  assert.match(e.macros[0].texte, /total 2/);
  assert.equal(compteChiffres(0.037) + compteChiffres(8), 0);
  // quotient : 156 ÷ 12 → 2 chiffres ; 108 ÷ 12 → 1 ; 0,0156 ÷ 1,2 = 0,013 → −1
  assert.equal(compteQuotient(156, 12), 2);
  assert.equal(compteQuotient(108, 12), 1);
  assert.equal(compteQuotient(0.0156, 1.2), -1);
  assert.equal(compteQuotient(1.56, 0.12), 2);
});

test('décimaux : colonnes et placements cohérents', () => {
  for (let i = 0; i < 100; i++) {
    const c = genererColonneDecimale(5, 4, 2);
    const somme = c.lignes.reduce((v, l, k) => v + (l.op === '+' ? c.echelles[k] : -c.echelles[k]), 0);
    assert.equal(somme / 100, c.resultat);
    const p = genererPlacementDecimal();
    assert.equal(p.rang, compteChiffres(p.a) + compteChiffres(p.b) - 1);
  }
});
