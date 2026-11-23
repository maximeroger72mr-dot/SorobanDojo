import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererTerme, ligneDizainesDeblocage } from '../src/core/generateur.js';
import { famille } from '../src/core/motifs.js';

const cibles = ['+1:petit', '+2:petit', '+3:petit', '+4:petit', '-1:petit', '-2:petit', '-3:petit', '-4:petit', '+9:grand', '+8:grand', '+7:grand', '+6:grand'];
const autorises = new Set([...famille('direct'), ...cibles]);

test('0.40.13 : marathon, tige des dizaines pleine : une ligne de dizaines la débloque', () => {
  assert.equal(ligneDizainesDeblocage(57, [], { chiffres: 1, cibles, autorises }), null, 'tige pas bloquée');
  for (let i = 0; i < 40; i++) {
    const t = ligneDizainesDeblocage(93, [], { chiffres: 1, cibles, autorises });
    assert.ok(t && t.n % 10 === 0 && t.n >= 10 && t.n <= 90);
    assert.notEqual(Math.floor(t.resultat / 10) % 10, 9);
    assert.ok(t.motifs.every((m) => autorises.has(m)) && !t.motifs.some((m) => m.startsWith('cascade')));
  }
  assert.equal(ligneDizainesDeblocage(93, [{ op: '+', n: 90, deblocage: true }], { chiffres: 1, cibles, autorises }), null, 'jamais deux de suite');
  // Sans grands amis : rien à débloquer.
  assert.equal(ligneDizainesDeblocage(93, [], { chiffres: 1, cibles: cibles.slice(0, 8), autorises }), null);
});

test('0.40.13 : marathon de 40 lignes : des grands amis jusqu\'au bout', () => {
  let sans = 0;
  for (let r = 0; r < 12; r++) {
    let v = 0; const prec = [{ op: '+', n: 0 }]; let grands = 0;
    for (let k = 0; k < 40; k++) {
      const t = ligneDizainesDeblocage(v, prec, { chiffres: 1, cibles, autorises }) ?? genererTerme(v, { chiffres: 1, nbTiges: String(v).length + 2, autorises, cibles, precedents: prec });
      prec.push({ op: t.op, n: t.n, deblocage: t.deblocage }); v = t.resultat;
      assert.ok(!t.motifs.some((m) => m.startsWith('cascade')));
      if (k >= 20 && !t.deblocage && t.motifs.some((m) => m.endsWith(':grand'))) grands++;
    }
    if (!grands) sans++;
  }
  assert.ok(sans <= 1, `${sans} marathons sans grand ami sur les 20 dernières lignes`);
});
