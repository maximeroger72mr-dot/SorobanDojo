import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, GRADES_KYU, genererSujet, totalPoints } from '../src/core/epreuves.js';
import { catalogueDrills, controles } from '../src/core/drills.js';

const chiffres = (x) => String(x).replace('.', '').replace(/^0+/, '').length;

test('sujets conformes au tableau officiel et aux sujets modèles', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    assert.equal(totalPoints(g), g.minutes === 20 ? 200 : 300, g.id);
    for (const sec of s.sections) {
      const f = g[sec.cle];
      assert.equal(sec.problemes.length, f.nb);
      sec.problemes.forEach((p, i) => {
        if (sec.cle === 'mitori') {
          assert.equal(p.lignes.length, f.lignes);
          // Tous les nombres d'un problème ont la même longueur.
          const k = f.chiffresParProbleme?.[i] ?? f.chiffres;
          assert.ok(p.lignes.every((l) => String(l.n).length === k), `${g.id} mitori ${i + 1}`);
          // Problèmes 3, 5, 7, 9 : additions et soustractions, avec `moins` lignes négatives,
          // jamais en 1re, 2e ni dernière ligne ; les autres : additions seules.
          const moins = p.lignes.map((l, j) => (l.op === '-' ? j : -1)).filter((j) => j >= 0);
          if ([2, 4, 6, 8].includes(i)) {
            assert.equal(moins.length, f.moins, `${g.id} : problème ${i + 1}`);
            assert.ok(moins.every((j) => j >= 2 && j <= f.lignes - 2), `${g.id} : ${moins}`);
          } else assert.equal(moins.length, 0, `${g.id} : problème ${i + 1}`);
          if (p.resultat < 0) assert.ok(f.negatifs?.[1] > 0 && p.negatif && i === 8, `${g.id} : négatif inattendu`);
        } else if (p.virgules) {
          if (i < f.nb / 2) assert.ok(p.decimales <= f.decimales, `${g.id} : arrondi de la première moitié`);
          else assert.equal(p.decimales, 0, `${g.id} : la seconde moitié s'arrondit à l'unité`);
        } else if (sec.cle === 'mul') {
          assert.equal(chiffres(p.a) + chiffres(p.b), f.total);
          assert.equal(p.a * p.b, p.resultat);
          if (f.formes) assert.ok(f.formes.some(([x, y]) => chiffres(p.a) === x && chiffres(p.b) === y), `${g.id} : ${p.a} × ${p.b}`);
          else assert.ok(chiffres(p.a) >= 2 && chiffres(p.b) >= 2, `${g.id} : ${p.a} × ${p.b}`);
        } else {
          assert.equal(chiffres(p.b) + chiffres(p.resultat), f.total);
          assert.equal(p.a, p.b * p.resultat);
          if (f.formes) assert.ok(f.formes.some(([x, y]) => chiffres(p.b) === x && chiffres(p.resultat) === y), `${g.id} : ${p.a} ÷ ${p.b}`);
          else assert.ok(chiffres(p.b) >= 2 && chiffres(p.resultat) >= 2, `${g.id} : ${p.a} ÷ ${p.b}`);
        }
      });
    }
  }
});

test('tableau officiel (shuzan.jp) : 口, 字, seuils, chiffres des × et ÷', () => {
  const g = (id) => GRADES.find((x) => x.id === id);
  // [lignes, total de chiffres, × (実法), ÷ (法商), points pour réussir]
  const officiel = { 10: [5, 10, 3, null, 60], 9: [5, 10, 3, null, 120], 8: [8, 16, 4, 3, 120], 7: [10, 20, 4, 4, 120],
    6: [10, 30, 5, 4, 210], 5: [10, 40, 6, 5, 210], 4: [10, 50, 7, 6, 210], 3: [10, 60, 7, 6, 240], 2: [10, 80, 9, 8, 240], 1: [10, 100, 11, 10, 240],
    j3: [10, null, 7, 6, 240], j2: [10, 70, 8, 7, 240], j1: [10, 90, 10, 9, 240] };
  for (const [id, [lignes, ji, mul, div, reussite]] of Object.entries(officiel)) {
    const x = g(id);
    assert.equal(x.mitori.lignes, lignes, id);
    if (ji) assert.equal(x.mitori.lignes * x.mitori.chiffres, ji, id);
    assert.equal(x.mul.total, mul, id);
    assert.equal(x.div?.total ?? null, div, id);
    assert.equal(Math.round(x.seuil * totalPoints(x)), reussite, id);
  }
  // 準3 : 5 problèmes à 50 字, 5 à 60.
  assert.deepEqual(g('j3').mitori.chiffresParProbleme.map((k) => k * 10).sort(), [50, 50, 50, 50, 50, 60, 60, 60, 60, 60]);
  assert.equal(g('10').minutes, 20);
  assert.equal(g('1').minutes, 30);
  // Les 9e et 10e kyū : le même sujet, seul le seuil change.
  assert.deepEqual(g('10').mitori, g('9').mitori);
  assert.deepEqual(g('10').mul, g('9').mul);
  // Un résultat négatif, au problème 9, au 1er et au 2e kyū seulement (pas au 3e).
  for (const id of ['2', '1']) for (let k = 0; k < 5; k++) {
    const pb = genererSujet(g(id)).sections[0].problemes;
    assert.equal(pb.filter((p) => p.resultat < 0).length, 1);
    assert.ok(pb[8].resultat < 0);
  }
  for (let k = 0; k < 5; k++) assert.equal(genererSujet(g('3')).sections[0].problemes.filter((p) => p.resultat < 0).length, 0);
  assert.deepEqual(GRADES.filter((x) => x.milliers && !x.jun).map((x) => x.id), ['3', '2', '1']);
  // La frise des kyū ne contient pas les grades 準.
  assert.deepEqual(GRADES_KYU.map((x) => x.id), ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']);
});

test('× et ÷ d\'examen : des facteurs terminés par 0 comme dans les sujets modèles, aucun doublon', () => {
  let zeros = 0;
  let total = 0;
  for (let k = 0; k < 10; k++) for (const id of ['6', '4']) {
    const s = genererSujet(GRADES.find((g) => g.id === id));
    for (const sec of s.sections.filter((x) => x.cle !== 'mitori')) {
      for (const p of sec.problemes) { total += 1; if (p.b % 10 === 0 || (p.type === 'mul' ? p.a : p.resultat) % 10 === 0) zeros += 1; }
      assert.equal(new Set(sec.problemes.map((p) => `${p.a}|${p.b}`)).size, sec.problemes.length);
    }
  }
  assert.ok(zeros / total > 0.08 && zeros / total < 0.35, `${zeros} / ${total}`);
});

test('décimaux dès le 3e kyū seulement, environ un problème sur deux', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    const pb = s.sections.flatMap((x) => x.problemes).filter((p) => p.type !== 'addsub');
    const decimaux = pb.filter((p) => p.virgules).length;
    assert.equal(decimaux > 0, !!g.mul.decimales, g.id);
    if (g.mul.decimales) assert.ok(decimaux > 6 && decimaux < 34, `${g.id} : ${decimaux} / ${pb.length}`);
  }
});

test('drill 123456789 : résultats classiques', () => {
  const d = catalogueDrills();
  assert.equal(d.find((x) => x.id === '123-9').resultat, 1111111101);
  assert.equal(d.find((x) => x.id === '123-9-ar').resultat, 0);
  assert.equal(d.find((x) => x.id === '987-9').resultat, 8888888889);
  assert.equal(controles(d.find((x) => x.id === '123-3').operations).at(-1), 1107);
});
