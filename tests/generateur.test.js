import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererOperation, genererPlanche, genererTerme } from '../src/core/generateur.js';
import { D, famille } from '../src/core/motifs.js';

test('génération stricte : petit ami +3 avec seulement les gestes directs autorisés', () => {
  const autorises = new Set([...famille('direct'), '+3:petit']);
  for (let i = 0; i < 300; i++) {
    const ex = genererOperation({ chiffres: 1, autorises, cibles: ['+3:petit'] });
    assert.ok(ex.motifs.includes('+3:petit'));
    assert.ok(ex.motifs.every((m) => autorises.has(m)), ex.motifs.join());
    assert.equal(ex.resultat, ex.depart + ex.termes[0].n);
  }
});

test('génération : grands amis en soustraction à 2 chiffres, variété des exercices', () => {
  const autorises = new Set([...famille('direct'), ...famille('petit'), ...famille('grand')]);
  const vus = new Set();
  for (let i = 0; i < 200; i++) {
    const ex = genererOperation({ chiffres: 2, autorises, cibles: D('-', [9, 8], 'grand') });
    assert.ok(ex.resultat >= 0);
    vus.add(`${ex.depart}-${ex.termes[0].n}`);
  }
  assert.ok(vus.size > 100, `seulement ${vus.size} exercices différents`);
});

test('cascades générables', () => {
  for (const c of ['cascade+', 'cascade-']) {
    const ex = genererOperation({ chiffres: 2, autorises: null, cibles: [c] });
    assert.ok(ex.motifs.includes(c));
  }
});

test('terme suivant ciblé et planche cohérente', () => {
  const t = genererTerme(14, { chiffres: 1, cibles: ['-4:petit', '+4:petit'] });
  assert.ok(t.motifs.length > 0);
  for (const chiffres of [1, 2, 3]) {
    const p = genererPlanche({ chiffres, lignes: 10, cibles: D('+', [7], 'grand') });
    assert.equal(p.lignes.length, 10);
    const somme = p.lignes.reduce((v, l) => (l.op === '+' ? v + l.n : v - l.n), 0);
    assert.equal(somme, p.resultat);
    assert.ok(p.lignes.every((l) => String(l.n).length === chiffres));
    assert.ok(p.motifs.filter((m) => m === '+7:grand').length >= 3, `${chiffres} ch. : ${p.motifs}`);
  }
});
