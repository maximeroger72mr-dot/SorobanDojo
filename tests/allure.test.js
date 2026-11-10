import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES } from '../src/core/epreuves.js';
import { allureGrade, chargeGrade, verdictAllure, ecartAllure, vitesseEleve } from '../src/core/allure.js';

test('allure : chaque grade demande une cadence au moins égale à celle du grade précédent de même durée', () => {
  for (let i = 1; i < GRADES.length; i++) {
    if (GRADES[i].minutes !== GRADES[i - 1].minutes || GRADES[i].seuil !== GRADES[i - 1].seuil) continue;
    assert.ok(allureGrade(GRADES[i]).parChiffre <= allureGrade(GRADES[i - 1]).parChiffre + 1e-9, `${GRADES[i].nom}`);
  }
  const a1 = allureGrade(GRADES.find((g) => g.id === '1'));
  assert.ok(a1.parChiffre > 0.3 && a1.parChiffre < 1, `1er kyū : ${a1.parChiffre} s par chiffre`);
  assert.equal(a1.parProduit, 2 * a1.parChiffre);
});

test('allure : la cadence calculée traite exactement la part exigée dans le temps', () => {
  for (const g of GRADES) {
    const a = allureGrade(g);
    const c = chargeGrade(g);
    const secondes = a.part * (c.chiffres * a.parChiffre + c.produits * a.parProduit + c.problemes * 3);
    assert.ok(Math.abs(secondes - g.minutes * 60) < 1e-6, g.nom);
  }
});

test('verdict : sans mesure, rien n\'est affirmé ; avec des mesures, le temps estimé suit la vitesse', () => {
  const g = GRADES.find((x) => x.id === '6');
  const vide = { motifs: {}, paliers: {} };
  assert.deepEqual(vitesseEleve(vide), { parChiffre: null, parProduit: null });
  assert.equal(verdictAllure(g, vide).minutes, null);
  assert.equal(verdictAllure(g, vide).colonnes.ok, null);
  const hist = (t) => Array.from({ length: 12 }, () => ({ ok: 1, t }));
  const d = (t, p) => ({ motifs: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, { hist: hist(t) }])), paliers: { 'p6-1': { hist: hist(p) } } });
  const lent = verdictAllure(g, d(6, 12));
  const vite = verdictAllure(g, d(0.8, 1.6));
  assert.equal(lent.colonnes.ok, false);
  assert.equal(vite.colonnes.ok, true);
  assert.ok(lent.minutes > g.minutes && vite.minutes < g.minutes);
});

test('écart d\'allure pendant l\'épreuve : avance et retard', () => {
  const limite = 30 * 60000;
  // À mi-temps, la moitié de la part exigée est faite : dans le rythme.
  assert.equal(ecartAllure(45, 100, 0.9, limite, limite / 2), 0);
  assert.ok(ecartAllure(60, 100, 0.9, limite, limite / 2) > 0);
  assert.ok(ecartAllure(20, 100, 0.9, limite, limite / 2) < 0);
  // Tout le nécessaire est fait : l'avance ne dépasse pas le temps restant.
  assert.equal(ecartAllure(100, 100, 0.9, limite, limite / 2), limite / 2000);
});
