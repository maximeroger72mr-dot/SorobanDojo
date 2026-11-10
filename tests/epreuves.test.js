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
          assert.ok(p.lignes.some((l) => l.op === '-'), `${g.id} : soustraction attendue`);
          // Résultat négatif : seulement là où le grade le prévoit, et dans la seconde moitié.
          if (p.resultat < 0) assert.ok(f.negatifs?.[1] > 0 && p.negatif && i >= f.nb / 2 && p.resultat > -(10 ** f.max), `${g.id} : négatif inattendu`);
        } else if (p.arrondi !== undefined) {
          // Première moitié : arrondi au rang du grade (millième) ; seconde moitié : à l'unité.
          assert.ok(f.decimales, `${g.id} : décimaux inattendus`);
          if (i < f.nb / 2) assert.ok(p.decimales <= f.decimales, `${g.id} : arrondi de la première moitié`);
          else assert.equal(p.decimales, 0, `${g.id} : la seconde moitié s'arrondit à l'unité`);
        } else if (sec.cle === 'mul') {
          assert.equal(chiffres(p.a) + chiffres(p.b), f.total);
          assert.equal(p.a * p.b, p.resultat);
        } else {
          assert.equal(chiffres(p.b) + chiffres(p.resultat), f.total);
          assert.equal(p.a, p.b * p.resultat);
        }
      });
    }
  }
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
