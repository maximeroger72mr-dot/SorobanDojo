import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES_KYU as GRADES, GRADES_ZENKOREN, genererSujet, systemeChoisi, totalPoints } from '../src/core/epreuves.js';
import { allureGrade } from '../src/core/allure.js';
import { grade } from '../src/core/parcours.js';
import { sectionsBlanc, formatBlanc, minutesBlanc, examenDeLaSemaine } from '../src/core/examen.js';

test('Zenkoren : 15 problèmes à 10 points, 7 minutes par épreuve, dans l\'ordre ×, ÷, additions', () => {
  for (const g of GRADES_ZENKOREN) {
    const s = genererSujet(g);
    assert.ok(s.sections.every((x) => x.problemes.length === 15 && x.points === 10 && x.minutes === 7), g.id);
    assert.equal(g.minutes, 7 * s.sections.length);
    assert.equal(totalPoints(g), 150 * s.sections.length);
  }
  const z = (id) => GRADES_ZENKOREN.find((x) => x.id === id);
  assert.deepEqual(genererSujet(z('10')).sections.map((x) => x.cle), ['mitoriA', 'mitori']);
  assert.deepEqual(genererSujet(z('9')).sections.map((x) => x.cle), ['mul', 'mitori']);
  assert.deepEqual(genererSujet(z('6')).sections.map((x) => x.cle), ['mul', 'div', 'mitori']);
  assert.ok(genererSujet(z('10')).sections[0].problemes.every((p) => p.lignes.every((l) => l.op === '+')));
});

test('Zenkoren : jamais plus facile que le même grade Nisshō, sans devenir irréaliste', () => {
  for (const [i, n] of GRADES.entries()) {
    const z = GRADES_ZENKOREN[i];
    // mêmes nombres de chiffres par ligne et par opération
    assert.equal(z.mitori.max, n.mitori.max);
    if (n.mul && z.mul) assert.equal(z.mul.total, n.mul.total); // 10e kyū Zenkoren : deux épreuves d'additions, pas de ×
    const r = allureGrade(z).cpm / allureGrade(n).cpm;
    // 9e et 10e kyū Nisshō : 20 minutes pour 5 lignes de 2 chiffres, très large ; le rapport y est forcément élevé.
    assert.ok(r >= 1.3 && (r <= 1.9 || ['10', '9'].includes(n.id)), `${n.id} : ${r.toFixed(2)}`);
  }
});

test('grade : suit le système choisi, chacun garde ses résultats', () => {
  const d = { records: { 'epreuve-10': { reussi: true }, 'zenkoren-10': { reussi: false } }, paliers: {}, reglages: {} };
  assert.equal(systemeChoisi(d).id, 'nissho');
  assert.equal(grade(d).obtenu.id, '10');
  d.reglages.systemeGrades = 'zenkoren';
  assert.equal(grade(d).obtenu, null);
  d.records['zenkoren-10'].reussi = true;
  assert.equal(grade(d).obtenu.systeme, 'zenkoren');
});

test('examen blanc : un sujet de 20 minutes et deux sprints de 7, en alternance', () => {
  assert.notEqual(formatBlanc('2026-11-14'), formatBlanc('2026-11-21'));
  assert.equal(minutesBlanc('long'), 20);
  assert.equal(minutesBlanc('sprints'), 14);
  const paliers = Object.fromEntries(['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2', 'p2-3'].map((id) => [id, { valide: '2026-01-01' }]));
  const d = { paliers, records: {}, motifs: {}, sessions: [], reglages: {} };
  const g = examenDeLaSemaine(d);
  const sprints = sectionsBlanc(d, g, 'sprints');
  assert.equal(sprints.length, 2);
  assert.ok(sprints.every((x) => x.minutes === 7 && x.problemes.length >= 10));
  assert.ok(sectionsBlanc(d, g, 'long')[0].problemes.length >= 20);
});

import { sousPalier, genererExercice } from '../src/core/curriculum.js';
import { PREREQUIS } from '../src/core/parcours.js';
import { aideDivision } from '../src/core/multiplication.js';

test('0.29 : marches et ordre du parcours par grade', () => {
  // 10 lignes : exigé au 7e kyū (2けた10口), pas avant (5 lignes aux 10e et 9e, 8 au 8e).
  assert.ok(PREREQUIS[7].includes('p5-e') && !PREREQUIS[8].includes('p5-e') && !PREREQUIS[10].includes('p5-e8'));
  const e = genererExercice(sousPalier('p5-e'));
  assert.equal(e.lignes.length, 10);
  // Diviser par 11 à 19 : au moins 2 corrections dans le calcul.
  for (let k = 0; k < 20; k++) {
    const x = genererExercice(sousPalier('p7-4c'));
    assert.ok(x.b >= 11 && x.b <= 19 && aideDivision(x.a, x.b).etapes.some((s) => s.essais.length >= 3));
  }
  // Négatifs : exigés au 2e kyū (pas au 3e), au format d'examen.
  assert.ok(PREREQUIS[2].includes('p8-n') && PREREQUIS[2].includes('p8-n2') && !PREREQUIS[3].includes('p8-n'));
  assert.ok(sousPalier('p8-n').ordre < sousPalier('p9-1').ordre);
  assert.equal(String(Math.abs(genererExercice(sousPalier('p8-n2')).lignes[0].n)).length, 8);
  // p8 : tout le 5e kyū avant ce qui n'est que du 4e.
  const o = (id) => sousPalier(id).ordre;
  assert.ok(Math.max(...['p8-t2', 'p8-1', 'p8-2', 'p8-4', 'p8-6'].map(o)) < Math.min(...['p8-3', 'p8-5', 'p8-7'].map(o)));
});
