import { avecGraine } from '../src/core/hasard.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluer, ajouterEssai, poidsEquilibre, unites, tempsParUnite } from '../src/core/maitrise.js';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';

const hist = (n, ok, t) => Array.from({ length: n }, (_, i) => ({ ok: i < ok ? 1 : 0, t }));

test('niveaux : juste ET rapide', () => {
  assert.equal(evaluer(hist(5, 5, 1)).niveau.id, 'decouverte');
  assert.equal(evaluer(hist(30, 30, 5)).niveau.id, 'progres'); // juste mais lent
  assert.equal(evaluer(hist(30, 20, 0.5)).niveau.id, 'progres'); // rapide mais faux
  assert.equal(evaluer(hist(30, 28, 2.5)).niveau.id, 'debutant');
  assert.equal(evaluer(hist(30, 29, 1.2)).niveau.id, 'confirme');
  assert.equal(evaluer(hist(30, 30, 0.6)).niveau.id, 'expert');
  assert.deepEqual(evaluer(hist(30, 28, 2.5)).manque, ['réussite ≥ 95 %', '≥ 40 CPM']);
});

test('temps par unité', () => {
  const col = { type: 'addsub', lignes: [{ op: '+', n: 12 }, { op: '+', n: 34 }, { op: '-', n: 5 }] };
  assert.equal(unites(col), 5);
  assert.equal(tempsParUnite(col, 5000), 1);
  assert.equal(tempsParUnite(col, 6500, 1.5), 1);
  assert.equal(unites({ type: 'mul', a: 372, b: 8 }), 3);
});

test('historique borné', () => {
  const h = [];
  for (let i = 0; i < 100; i++) ajouterEssai(h, true, 1);
  assert.equal(h.length, 60);
});

/** Simule un élève qui fait 60 exercices : les fréquences des amis doivent s'équilibrer. */
test('équilibrage sur une séance : aucun ami n\'apparaît plus de 1,5 fois plus qu\'un autre', () => {
  for (const id of ['p2-1', 'p2-3', 'p3-1', 'p3-3', 'p3-4', 'p4-1', 'p4-4', 'p5-1', 'p5-2']) {
    const sp = SOUS_PALIERS.find((s) => s.id === id);
    const fiches = {};
    // Tirage à graine fixe : le test mesure le générateur, pas la chance du jour.
    avecGraine(20260312, () => {
      for (let i = 0; i < 60; i++) {
        const ex = genererExercice(sp, poidsEquilibre(sp.cibles, (c) => fiches[c]));
        for (const m of ex.motifs) if (sp.cibles.includes(m)) (fiches[m] ??= { essais: 0, dette: 0 }).essais += 1;
      }
    });
    const n = sp.cibles.map((c) => fiches[c]?.essais ?? 0);
    assert.ok(Math.max(...n) / Math.max(1, Math.min(...n)) <= 1.5, `${id} : ${sp.cibles.map((c, i) => `${c}=${n[i]}`).join(' ')}`);
  }
});
