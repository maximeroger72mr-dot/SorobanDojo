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

test('0.37 : premier nombre à la longueur annoncée après les grands amis, répétitions limitées', () => {
  avecGraine(5, () => {
    const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
    for (const id of ['p5-5', 'p8-1', 'p8-t1']) {
      const s = sp(id);
      for (let i = 0; i < 60; i++) assert.ok(genererExercice(s).lignes.every((l) => String(l.n).length <= (s.chiffresMax ?? s.chiffres)), id);
    }
    // ÷ 1 chiffre, quotient 1 chiffre : jamais le même calcul parmi les 30 derniers.
    const recents = [];
    for (let i = 0; i < 60; i++) { const e = genererExercice(sp('p7-1')); const k = `${e.a}|${e.b}`; if (recents.length >= 30 && i < 40) assert.ok(!recents.slice(-30).includes(k)); recents.push(k); }
  });
});

test('0.37 : piste anzan, divisions des examens couvertes ; gestes d\'anzan mesurés à part', async () => {
  const { GRADES_ANZAN, genererSujetAnzan } = await import('../src/core/epreuvesAnzan.js');
  const { gestesAnzanFaibles } = await import('../src/core/progression.js');
  avecGraine(9, () => {
    const piste = new Set(SOUS_PALIERS.filter((s) => s.mental && (s.type === 'mul' || s.type === 'div')).flatMap((s) => Array.from({ length: 150 }, () => forme(genererExercice(s)))));
    for (const g of GRADES_ANZAN.filter((x) => x.mul)) {
      const sujet = new Set(genererSujetAnzan(g).sections.filter((s) => s.cle !== 'mitori').flatMap((s) => s.problemes.map(forme)));
      assert.deepEqual([...sujet].filter((f) => !piste.has(f)), [], g.nom);
    }
    const ex = genererExercice(SOUS_PALIERS.find((s) => s.id === 'p3-a'));
    assert.equal(ex.motifs, undefined);
    assert.ok(ex.gestesAnzan.length > 0);
  });
  const hist = (ok, ko) => [...Array(ok).fill(1), ...Array(ko).fill(0)];
  const d = { gestesAnzan: { '+7:grand': { hist: hist(10, 6) }, '+3:petit': { hist: hist(18, 2) }, '+9:grand': { hist: hist(19, 1) }, '+1:direct': { hist: hist(5, 5) } } };
  assert.deepEqual(gestesAnzanFaibles(d).map((x) => x.cle), ['+7:grand']);
});
