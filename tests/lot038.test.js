import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, fluxEquilibre, genererExercice } from '../src/core/curriculum.js';
import { GRADES, genererSujet } from '../src/core/epreuves.js';
import { questionFlash, GRADES_FLASH } from '../src/core/flashGrades.js';
import { genererMarche } from '../src/core/multiplication.js';
import { avecGraine } from '../src/core/hasard.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

test('0.38 lot 1 : anzan, chaque geste de la leçon sort assez souvent', () => {
  avecGraine(38, () => {
    const p3a = sp('p3-a');
    const flux = fluxEquilibre(p3a, 10, () => ({}));
    const n = {};
    for (let i = 0; i < 300; i++) for (const g of flux().gestesAnzan) n[g] = (n[g] ?? 0) + 1;
    for (const c of p3a.cibles) assert.ok((n[c] ?? 0) >= 40, `${c} : ${n[c]}`);
  });
  assert.ok(!sp('pa-5').cibles.some((c) => c.startsWith('cascade')), 'pas de cascade à 1 chiffre');
});

test('0.38 lot 1 : divisions décimales à la longueur du sujet', () => {
  avecGraine(2, () => {
    const g = GRADES.find((x) => x.id === '1');
    const longueurs = new Set();
    for (let k = 0; k < 10; k++) for (const p of genererSujet(g).sections.find((s) => s.cle === 'div').problemes) if (p.virgules) longueurs.add(String(p.entiers[1]).length);
    assert.ok(longueurs.has(5) && longueurs.has(6), [...longueurs].join());
  });
});

test('0.38 lot 1 : flash et chaînes d\'anzan sans nombre répété de suite ; p7-4c sans quotient en 0', () => {
  avecGraine(4, () => {
    for (const g of GRADES_FLASH) for (let i = 0; i < 40; i++) {
      const q = questionFlash(g);
      assert.ok(!q.lignes.some((l, k) => k > 0 && l.n === q.lignes[k - 1].n), JSON.stringify(q.lignes));
    }
    for (let i = 0; i < 200; i++) {
      const ex = genererExercice(sp('p2-a'));
      assert.ok(!ex.lignes.some((l, k) => k > 0 && l.n === ex.lignes[k - 1].n));
      assert.notEqual(genererMarche('div-1x').resultat % 10, 0);
    }
  });
});

test('0.38 lot 2 : absorption limitée aux leçons proches ; révision mélangée de 3 leçons au plus', async () => {
  const { absorbee } = await import('../src/core/progression.js');
  const { MELANGE_MAX, calculsMelange } = await import('../src/core/revision.js');
  const paliers = Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental).map((s) => [s.id, { valide: '2026-01-01', carte: { boite: 4 } }]));
  const d = { paliers };
  // Les révisions générales (54 gestes) n'absorbent plus rien : la dernière leçon des grands amis
  // reste en révision ; les leçons d'une étape restent absorbées par la synthèse de l'étape.
  assert.equal(absorbee(d, 'p4-5'), false);
  assert.equal(absorbee(d, 'p2-1'), true);
  const add = SOUS_PALIERS.filter((s) => s.type === 'addsub' && !s.mental && s.cibles?.length);
  assert.ok(add.filter((s) => absorbee(d, s.id)).length < 27);
  assert.equal(MELANGE_MAX, 3);
  assert.deepEqual([2, 3].map(calculsMelange), [10, 12]);
});

test('0.38 lot 3 : bloc de vitesse (colonnes, ×, ÷) à partir du 7e kyū ; mini-tests longs en séries', async () => {
  const { hakariActif, partieDuJour, retardParties, calculsHakari } = await import('../src/core/hakari.js');
  const { testEnSeries, bilanSeries, verdictMiniTest, seriesValables } = await import('../src/core/minitest.js');
  const valides = (jusqua) => { const fin = sp(jusqua).ordre; return Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= fin).map((s) => [s.id, { valide: '2026-11-01', hist: [] }])); };
  const d = { paliers: valides('p7-4'), reglages: {}, motifs: {}, records: { 'epreuve-9': { reussi: true } }, sessions: [] };
  assert.equal(hakariActif(d), false);
  d.records['epreuve-8'] = { reussi: true };
  assert.equal(hakariActif(d), true);
  // Rien de mesuré : la première partie sans mesure ; le 3e jour pratiqué, la rotation.
  assert.ok(['colonnes', 'mul', 'div'].includes(partieDuJour(d, '2026-11-20').partie));
  const jours = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, module: 'planches', total: 1 }));
  assert.equal(partieDuJour({ ...d, sessions: jours(2) }, '2026-11-20').raison, 'rotation');
  assert.equal(partieDuJour({ ...d, sessions: jours(3) }, '2026-11-20').raison, 'retard');
  // × mesuré très lent : c'est lui, le plus en retard.
  const lent = { ...d, motifs: Object.fromEntries(['+1:petit', '+2:petit', '+3:petit', '+4:petit', '+5:grand'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.5 })) }])),
    sessions: [1, 2].flatMap((i) => [{ date: `2026-11-0${i}`, module: 'muldiv', mode: 'mul', reglages: { format: 'kyu' }, t: 30 }, { date: `2026-11-0${i}`, module: 'muldiv', mode: 'div', reglages: { format: 'kyu' }, t: 0.5 }]) };
  assert.equal(retardParties(lent)[0].partie, 'mul');
  assert.ok(calculsHakari(lent, 'mul', 8, 3) >= 5);
  // Séries : p8-1 (30 min au seuil) en 3 séries de 5 ; pas une leçon courte.
  assert.equal(testEnSeries(sp('p8-1')), true);
  assert.equal(testEnSeries(sp('p3-1')), false);
  const series = [{ justes: 5, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1, 1] }, { justes: 4, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1] }, { justes: 5, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1, 1] }];
  assert.equal(verdictMiniTest(sp('p8-1'), bilanSeries(series)).reussi, true);
  assert.equal(verdictMiniTest(sp('p8-1'), bilanSeries(series.map((x) => ({ ...x, tempsJustes: x.tempsJustes.map(() => 9) })))).reussi, false);
  assert.equal(seriesValables({ testSeries: { debut: '2026-11-18', series } }, '2026-11-19', '2026-11-18').length, 3);
  assert.equal(seriesValables({ testSeries: { debut: '2026-11-17', series } }, '2026-11-19', '2026-11-18').length, 0);
});
