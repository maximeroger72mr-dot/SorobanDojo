import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, genererSujet, totalPoints } from '../src/core/epreuves.js';
import { catalogueDrills, controles } from '../src/core/drills.js';

test('sujets conformes : nombre de problèmes, chiffres par problème, points', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    assert.equal(totalPoints(g), g.mitori.nb > 0 && g.minutes === 20 ? 200 : 300, g.id);
    for (const sec of s.sections) {
      const f = g[sec.cle];
      assert.equal(sec.problemes.length, f.nb);
      for (const p of sec.problemes) {
        if (sec.cle === 'mitori') {
          assert.equal(p.lignes.length, f.lignes);
          assert.equal(p.lignes.reduce((t, l) => t + String(l.n).length, 0), f.chiffres, `${g.id} mitori`);
          assert.ok(p.resultat >= 0);
        } else if (sec.cle === 'mul') {
          assert.equal(String(p.a).length + String(p.b).length, f.total);
          assert.equal(p.a * p.b, p.resultat);
        } else {
          assert.equal(String(p.b).length + String(p.resultat).length, f.total);
          assert.equal(p.a, p.b * p.resultat);
        }
      }
    }
  }
});

test('drill 123456789 : résultats classiques', () => {
  const d = catalogueDrills();
  assert.equal(d.find((x) => x.id === '123-9').resultat, 1111111101);
  assert.equal(d.find((x) => x.id === '123-9-ar').resultat, 0);
  assert.equal(d.find((x) => x.id === '987-9').resultat, 8888888889);
  assert.equal(d.find((x) => x.id === '12345679-9').resultat, 111111111);
  assert.equal(d.find((x) => x.id === 'suite-100-a').resultat, 5050);
  assert.equal(controles(d.find((x) => x.id === '123-3').operations).at(-1), 1107);
});
