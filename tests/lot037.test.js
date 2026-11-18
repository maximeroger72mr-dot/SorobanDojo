import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { PREREQUIS } from '../src/core/parcours.js';
import { GRADES, genererSujet } from '../src/core/epreuves.js';
import { avecGraine } from '../src/core/hasard.js';

const nb = (x) => String(Math.abs(x)).length;
const forme = (p) => (p.type === 'mul' ? `${Math.max(nb(p.a), nb(p.b))}×${Math.min(nb(p.a), nb(p.b))}` : `÷${nb(p.b)} q${nb(p.resultat)}`);

test('0.37 : chaque forme de × et ÷ des sujets est vue dans les leçons exigées par le grade', () => {
  avecGraine(37, () => {
    const formesLecon = {};
    for (const sp of SOUS_PALIERS.filter((s) => !s.mental && (s.type === 'mul' || s.type === 'div'))) {
      formesLecon[sp.id] = new Set(Array.from({ length: 200 }, () => forme(genererExercice(sp))));
    }
    for (const g of GRADES) {
      const ids = PREREQUIS[g.jun ? g.id.slice(1) : g.id];
      const vues = new Set(ids.flatMap((id) => [...(formesLecon[id] ?? [])]));
      const sujet = new Set();
      for (let k = 0; k < 20; k++) for (const s of genererSujet(g).sections) for (const p of s.problemes) if (p.type !== 'addsub' && !p.virgules) sujet.add(forme(p));
      const manque = [...sujet].filter((f) => !vues.has(f));
      assert.deepEqual(manque, [], `${g.nom} : formes jamais vues en leçon`);
    }
  });
});

test('0.37 : zéros finaux après les leçons sur les zéros, jamais avant', () => {
  avecGraine(7, () => {
    const part = (id) => { const sp = SOUS_PALIERS.find((s) => s.id === id); let z = 0; for (let i = 0; i < 400; i++) { const e = genererExercice(sp); if ((e.type === 'mul' ? [e.a, e.b] : [e.b, e.resultat]).some((x) => x % 10 === 0)) z += 1; } return z / 400; };
    for (const id of ['p6-3', 'p6-4', 'p7-4']) assert.equal(part(id), 0, id);
    for (const id of ['p8-5a', 'p8-8', 'p9-4', 'p9-6']) { const x = part(id); assert.ok(x > 0.08 && x < 0.25, `${id} : ${x}`); }
    // Les divisions restent exactes, les produits justes.
    for (let i = 0; i < 200; i++) {
      const d = genererExercice(SOUS_PALIERS.find((s) => s.id === 'p8-8'));
      assert.equal(d.a, d.b * d.resultat);
      const m = genererExercice(SOUS_PALIERS.find((s) => s.id === 'p9-4'));
      assert.equal(m.a * m.b, m.resultat);
    }
  });
});

test('0.37 : × et ÷ « au format du kyū » : les proportions du sujet', async () => {
  const { reserveKyu } = await import('../src/core/formatKyu.js');
  avecGraine(11, () => {
    const g = GRADES.find((x) => x.id === '2');
    const part = (liste, f) => liste.filter((p) => !p.virgules && forme(p) === f).length / liste.length;
    const tirer = reserveKyu(g, 'mul');
    const entrainement = Array.from({ length: 600 }, tirer);
    const sujets = Array.from({ length: 30 }, () => genererSujet(g).sections.find((s) => s.cle === 'mul').problemes).flat();
    for (const f of ['6×3', '5×4']) assert.ok(Math.abs(part(entrainement, f) - part(sujets, f)) < 0.07, `${f} : ${part(entrainement, f)} / ${part(sujets, f)}`);
    assert.ok(entrainement.some((p) => p.virgules) && entrainement.some((p) => !p.virgules)); // décimaux et entiers, comme au 2e kyū
  });
});
