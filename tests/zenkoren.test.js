import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, GRADES_ZENKOREN, genererSujet, systemeChoisi, totalPoints } from '../src/core/epreuves.js';
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
    assert.ok(r >= 1.3 && (r <= 1.7 || n.id === '10'), `${n.id} : ${r.toFixed(2)}`);
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
