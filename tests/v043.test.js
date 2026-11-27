import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { seuilVitesseLecon, testsDuJour, apresLenteur, MINI_TESTS_PAR_JOUR } from '../src/core/minitest.js';
import { genererPlanche } from '../src/core/planche.js';
import { analyserOperation, tigesPour, avecDelai } from '../src/core/generateur.js';
import { TOUS_LES_MOTIFS } from '../src/core/motifs.js';
import '../src/core/parcours.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

test('0.43 : leçons de découverte à l\'allure du grade précédent', () => {
  assert.equal(seuilVitesseLecon(sp('p8-n')).seuil, 1.56, 'négatifs : allure du 3e kyū (avant 1,00)');
  assert.equal(seuilVitesseLecon(sp('pd-1')).seuil, 2.04, 'décimaux : allure du 4e kyū (avant 1,56)');
  assert.equal(seuilVitesseLecon(sp('p8-n2')).seuil, 1, 'la leçon de format garde l\'allure de son grade');
  assert.equal(seuilVitesseLecon(sp('pd-3')).seuil, 4.07, '0.43.1 : multiplier des décimaux, allure du 4e kyū');
  assert.equal(seuilVitesseLecon(sp('pd-4')).seuil, 4.07, '0.43.1 : diviser des décimaux');
  assert.equal(seuilVitesseLecon(sp('pd-5')).seuil, 3.12, 'les arrondis gardent l\'allure du 3e kyū');
});

test('0.43 : 2 mini-tests par jour, l\'écart après un échec pour lenteur, le lièvre à l\'allure visée', () => {
  assert.equal(MINI_TESTS_PAR_JOUR, 2);
  const s = (serie) => ({ date: '2026-11-27', module: 'lecons', mode: 'test', reglages: { sousPalier: 'p9-2', ...(serie ? { serie } : {}) } });
  const d = { sessions: [s(), s(1), s(2), s(3), { ...s(), date: '2026-11-26' }] };
  assert.equal(testsDuJour(d, 'p9-2', '2026-11-27'), 2, 'un test en séries compte une fois');
  const e = { essaisTest: [{ temps: 0.92 }, { temps: 0.88 }] };
  const r = apresLenteur(sp('p9-2'), e, { vitesseOk: false, temps: 0.86, seuil: 0.71, unite: 'chiffre' });
  assert.match(r.ecart, /Il vous manque 0,15 s par chiffre/);
  assert.match(r.ecart, /0,92 → 0,88/);
  assert.ok(r.lievre && r.lievre.vise < r.lievre.cadence && r.lievre.lignes === 10);
  assert.equal(apresLenteur(sp('p9-2'), e, { vitesseOk: true, temps: 0.6, seuil: 0.71 }), null);
});

/** Lignes d'une planche qui contiennent la cascade visée. */
function cascades(p, cible, chiffres) {
  let n = 0;
  for (const col of p.colonnes) {
    let v = col.lignes[0].n;
    for (const l of col.lignes.slice(1)) {
      if (analyserOperation(v, l.op, l.n, tigesPour(chiffres) + 3)?.motifs.includes(cible)) n += 1;
      v = l.op === '+' ? v + l.n : v - l.n;
    }
  }
  return n;
}

test('0.43 : cascades construites : additions seules de 8 chiffres sur 10 lignes en moins de 3 s', () => {
  const t0 = Date.now();
  const p = avecDelai(3000, () => genererPlanche({ chiffres: 8, lignes: 10, colonnes: 10, autorises: new Set(TOUS_LES_MOTIFS), cibles: ['cascade+'], poids: {}, zeros: false, ops: ['+'], longueurFixe: true }, 4242));
  assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms (avant : 5,6 s)`);
  assert.ok(p.colonnes.every((c) => c.lignes.length === 10));
  assert.ok(cascades(p, 'cascade+', 8) >= 60, `${cascades(p, 'cascade+', 8)} cascades sur 90 lignes`);
});

test('0.43 : emprunts en cascade, 5 chiffres : vite et justes', () => {
  const t0 = Date.now();
  const p = avecDelai(4000, () => genererPlanche({ chiffres: 5, lignes: 10, colonnes: 10, autorises: new Set(TOUS_LES_MOTIFS), cibles: ['cascade-'], poids: {}, zeros: false, ops: ['+', '-'], longueurFixe: true }, 777));
  assert.ok(Date.now() - t0 < 4000, `${Date.now() - t0} ms (avant : 23 s)`);
  assert.ok(cascades(p, 'cascade-', 5) >= 25);
});

test('0.43 : la leçon des cascades garde des cascades dans chaque colonne, dans les deux sens', () => {
  let plus = 0; let moins = 0; let cols = 0;
  for (let k = 0; k < 100; k++) {
    const m = genererExercice(sp('p5-4'), {}).motifs;
    if (m.some((x) => x.startsWith('cascade'))) cols += 1;
    plus += m.filter((x) => x === 'cascade+').length;
    moins += m.filter((x) => x === 'cascade-').length;
  }
  assert.ok(cols >= 95, `${cols} colonnes sur 100`);
  assert.ok(moins >= 0.3 * plus && plus >= 0.3 * moins, `${plus} / ${moins}`);
});
