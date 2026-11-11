import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, genererSujet, totalPoints } from '../src/core/epreuves.js';
import { catalogueDrills, controles } from '../src/core/drills.js';

const chiffres = (x) => String(x).replace('.', '').replace(/^0+/, '').length;

test('sujets conformes au tableau retenu', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    assert.equal(totalPoints(g), g.minutes === 20 ? 200 : 300, g.id);
    for (const sec of s.sections) {
      const f = g[sec.cle];
      assert.equal(sec.problemes.length, f.nb);
      sec.problemes.forEach((p, i) => {
        if (sec.cle === 'mitori') {
          assert.equal(p.lignes.length, f.lignes);
          assert.ok(p.lignes.every((l) => String(l.n).length >= f.min && String(l.n).length <= f.max), `${g.id} mitori`);
          // Les `pures` premiers problèmes : additions seules ; les suivants ont des soustractions.
          assert.equal(p.lignes.some((l) => l.op === '-'), i >= f.pures, `${g.id} : problème ${i + 1}`);
          if (p.resultat < 0) assert.ok(f.negatifs?.[1] > 0 && p.negatif && i >= f.nb / 2 && p.resultat > -(10 ** f.max), `${g.id} : négatif inattendu`);
        } else if (f.decimales) {
          // Du 3e au 1er kyū : TOUS les problèmes sont en décimaux ; millième puis unité.
          assert.ok(p.virgules, `${g.id} : problème entier`);
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

test('grille officielle : seuils, formes et résultat négatif', () => {
  const g = (id) => GRADES.find((x) => x.id === id);
  assert.equal(g('10').seuil * totalPoints(g('10')), 60);
  for (const id of ['9', '8', '7']) assert.equal(g(id).seuil * totalPoints(g(id)), 120);
  for (const id of ['6', '5', '4']) assert.equal(g(id).seuil * totalPoints(g(id)), 210);
  for (const id of ['3', '2', '1']) assert.equal(g(id).seuil * totalPoints(g(id)), 240);
  assert.equal(g('10').div, undefined);
  assert.equal(g('9').div, undefined);
  assert.equal(g('10').mitori.pures, 10);
  // 2e et 1er kyū : exactement un résultat négatif, dans la seconde moitié.
  for (const id of ['2', '1']) for (let k = 0; k < 5; k++) assert.equal(genererSujet(g(id)).sections[0].problemes.filter((p) => p.resultat < 0).length, 1);
  assert.deepEqual(GRADES.filter((x) => x.milliers).map((x) => x.id), ['3', '2', '1']);
});

test('1er kyū : un mitorizan à résultat négatif dans la seconde moitié ; longueur des lignes fixe', () => {
  const g1 = GRADES.find((g) => g.id === '1');
  for (let k = 0; k < 10; k++) {
    const m = genererSujet(g1).sections[0].problemes;
    assert.equal(m.filter((p) => p.resultat < 0).length, 1);
    assert.ok(m.every((p) => p.lignes.every((l) => String(l.n).length === 10)));
  }
  for (const [id, n] of [['2', 8], ['3', 6], ['4', 5], ['5', 4], ['6', 3]]) assert.equal(GRADES.find((g) => g.id === id).mitori.max, n);
});

test('× et ÷ d\'examen : aucun opérande entier terminé par 0, aucun doublon', () => {
  for (const id of ['6', '4', '1']) {
    const s = genererSujet(GRADES.find((g) => g.id === id));
    for (const sec of s.sections.filter((x) => x.cle !== 'mitori')) {
      const entiers = sec.problemes.filter((p) => p.arrondi === undefined);
      for (const p of entiers) assert.ok(p.b % 10 !== 0 && (p.type === 'mul' ? p.a : p.resultat) % 10 !== 0, `${id} ${p.a} ${p.b}`);
      assert.equal(new Set(sec.problemes.map((p) => `${p.a}|${p.b}`)).size, sec.problemes.length);
    }
  }
});

test('décimaux dès le 3e kyū seulement', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    const decimaux = s.sections.flatMap((x) => x.problemes).filter((p) => p.arrondi !== undefined).length;
    assert.equal(decimaux > 0, ['3', '2', '1'].includes(g.id), g.id);
  }
});

test('drill 123456789 : résultats classiques', () => {
  const d = catalogueDrills();
  assert.equal(d.find((x) => x.id === '123-9').resultat, 1111111101);
  assert.equal(d.find((x) => x.id === '123-9-ar').resultat, 0);
  assert.equal(d.find((x) => x.id === '987-9').resultat, 8888888889);
  assert.equal(controles(d.find((x) => x.id === '123-3').operations).at(-1), 1107);
});
