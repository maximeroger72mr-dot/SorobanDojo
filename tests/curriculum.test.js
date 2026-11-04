import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { analyserOperation } from '../src/core/generateur.js';

/** Motifs de chaque ligne d'une colonne, recalculés indépendamment. */
function motifsLignes(col) {
  const res = [];
  let v = col.lignes[0].n;
  for (const l of col.lignes.slice(1)) {
    const a = analyserOperation(v, l.op, l.n, 12);
    res.push(a.motifs);
    v = a.resultat;
  }
  return res;
}

test('chaque sous-palier génère des exercices stricts ; ses démos sont valides', () => {
  for (const sp of SOUS_PALIERS) {
    if (sp.type === 'theorie') { assert.ok(sp.sections.length >= 4); continue; }
    for (let i = 0; i < 25; i++) {
      const ex = genererExercice(sp);
      if (sp.type === 'placement') { assert.ok(Number.isInteger(ex.rang) && ex.rang < ex.nbTiges, sp.id); continue; }
      if (ex.type === 'table') { assert.equal(ex.attendu, String(ex.a * ex.b).padStart(2, '0')); continue; }
      if (ex.negatif) {
        assert.ok(ex.resultat < 0 && ex.resultat > -(10 ** sp.chiffres), `${sp.id} ${ex.resultat}`);
        assert.equal(ex.lignes.reduce((v, l) => (l.op === '+' ? v + l.n : v - l.n), 0), ex.resultat);
        continue;
      }
      if (ex.type === 'photo' || ex.type === 'tenir') {
        assert.equal(ex.resultat, ex.n);
        assert.ok(String(ex.n).length <= sp.chiffres && ex.n >= 1, `${sp.id} ${ex.n}`);
        continue;
      }
      // Anzan à 1 chiffre : la colonne commence par un seul chiffre.
      if (sp.type === 'anzan' && sp.chiffres === 1) assert.ok(ex.lignes[0].n <= 9, `${sp.id} départ ${ex.lignes[0].n}`);
      if (ex.echelles) {
        const somme = ex.lignes.reduce((v, l, k) => v + (l.op === '+' ? ex.echelles[k] : -ex.echelles[k]), 0);
        assert.equal(somme / 10 ** ex.decimales, ex.resultat, sp.id);
        continue;
      }
      if (ex.virgules) {
        if (ex.type === 'mul') assert.ok(Math.abs(ex.a * ex.b - ex.resultat) <= 0.0005 + 1e-9, `${sp.id} ${ex.a}×${ex.b}`);
        else assert.ok(Math.abs(ex.a / ex.b - ex.resultat) <= 0.0005 + 1e-9, `${sp.id} ${ex.a}÷${ex.b}`);
        continue;
      }
      if (sp.zeros && ex.type === 'mul') assert.ok(/0/.test(`${ex.a}${ex.b}`), sp.id);
      if (sp.zeros && ex.type === 'div') assert.match(String(ex.resultat), /\d0\d/, sp.id);
      if (sp.type === 'mul') { assert.equal(ex.a * ex.b, ex.resultat); continue; }
      if (sp.type === 'div') { assert.equal(ex.b * ex.resultat, ex.a); continue; }
      // Une ligne de plus est permise pour varier le résultat (anti-répétition).
      assert.ok(ex.lignes.length === sp.lignes || ex.lignes.length === sp.lignes + 1, sp.id);
      const lignes = motifsLignes(ex);
      for (const m of lignes) assert.ok(m.every((x) => sp.autorises.has(x)), `${sp.id} : ${m}`);
      if (sp.zeros) assert.ok(ex.lignes.slice(1).every((l) => String(l.n).slice(1).includes('0')), `${sp.id} zéros`);
      assert.ok(lignes.flat().some((m) => sp.cibles.includes(m)), sp.id);
    }
    if (sp.type === 'addsub') {
      for (const d of sp.demos) {
        const a = analyserOperation(d.depart, d.op, d.n, 8);
        assert.ok(a && a.motifs.every((m) => sp.autorises.has(m)), `${sp.id} démo ${d.depart}${d.op}${d.n} : ${a?.motifs}`);
      }
    }
  }
});

test('hors révisions, un sous-palier n\'autorise que les gestes directs et ses cibles', () => {
  const sp = SOUS_PALIERS.find((s) => s.id === 'p2-1');
  assert.deepEqual([...sp.autorises].filter((m) => !m.endsWith(':direct')).sort(), ['+3:petit', '+4:petit']);
});

import { imageAnzan, chaineAnzan, sousPalier, PALIERS } from '../src/core/curriculum.js';
import { diagnostiquerPhoto } from '../src/core/diagnostic.js';

test('anzan : piste parallèle qui suit le soroban, chaîne qui s\'allonge, image qui s\'estompe', () => {
  const mentales = SOUS_PALIERS.filter((s) => s.mental);
  assert.ok(mentales.length >= 10);
  // Chaque leçon d'anzan suit une leçon soroban existante, et n'a pas de geste qu'elle n'a pas vu.
  for (const s of mentales) assert.ok(s.apres && !sousPalier(s.apres).mental, s.id);
  assert.ok(!sousPalier('p2-a').autorises.has('+9:grand'));
  assert.ok(sousPalier('p3-a').autorises.has('+9:grand'));
  // L'image : nette, estompée, légère, puis absente ; jamais pour une leçon sans image.
  const sp = sousPalier('p1-a');
  assert.deepEqual([0, 8, 16, 24].map((j) => imageAnzan(sp, j).opacite), [1, 0.5, 0.2, 0]);
  assert.equal(imageAnzan({ image: false }, 0).opacite, 0);
  // La chaîne : 2 nombres au départ, +1 après 3 réussites, −1 après une erreur, bornée.
  const c = chaineAnzan({ id: 'test-chaine', lignes: 4 });
  assert.equal(c.lignes, 2);
  [1, 1, 1].forEach(() => c.noter(true));
  assert.equal(c.lignes, 3);
  c.noter(false);
  assert.equal(c.lignes, 2);
  c.noter(false);
  assert.equal(c.lignes, 2);
  for (let k = 0; k < 20; k++) c.noter(true);
  assert.equal(c.lignes, 4);
  // genererExercice respecte la chaîne et l'image demandées ; sans contexte : chaîne complète, sans image.
  const ex = genererExercice(sp, {}, { lignes: 2, image: 0.5 });
  assert.ok(ex.lignes.length <= 3 && ex.flash.image === 0.5);
  const test = genererExercice(sp);
  assert.ok(test.lignes.length >= sp.lignes && test.flash.image === 0);
  // Le palier anzan est bien marqué comme piste parallèle.
  assert.ok(PALIERS.find((p) => p.id === 'pa').mental);
});

test('photo du soroban : diagnostic par tige (céleste ou terrestres)', () => {
  assert.deepEqual(diagnostiquerPhoto({ n: 7, resultat: 7 }, 7), []);
  assert.match(diagnostiquerPhoto({ n: 7, resultat: 7 }, 2)[0], /céleste/);
  assert.match(diagnostiquerPhoto({ n: 8, resultat: 8 }, 7)[0], /terrestre/);
  const d = diagnostiquerPhoto({ n: 36, resultat: 36 }, 86);
  assert.equal(d.length, 1);
  assert.match(d[0], /dizaines.*céleste/);
});
