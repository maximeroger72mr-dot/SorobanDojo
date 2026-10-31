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
          assert.ok(p.resultat >= 0);
        } else if (p.arrondi !== undefined) {
          assert.ok(i >= f.nb / 2 && f.decimales, `${g.id} : décimaux seulement en seconde moitié`);
          assert.ok(p.decimales <= f.decimales);
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
