import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, evaluerLecon, chiffresColonne, pisteDe } from '../src/core/curriculum.js';
import { evaluer, reussiteExigee, NIVEAUX } from '../src/core/maitrise.js';
import { porteMulDiv } from '../src/core/parcours.js';
import { cleProduit } from '../src/core/tables.js';
import { pourcentage } from '../src/core/quotidien.js';
import { compacterSessions } from '../src/core/progression.js';
import { planMois, equilibreSemaine } from '../src/core/semaine.js';
import { colonnesPourNiveau } from '../src/core/prof.js';
import { famille } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const hist = (n, ko, t) => Array.from({ length: n }, (_, i) => ({ ok: i < ko ? 0 : 1, t }));

test('0.41 : seuils de justesse par chiffre, inchangés pour les colonnes courtes', () => {
  assert.equal(chiffresColonne(sp('p8-3')), 55);
  assert.equal(reussiteExigee(NIVEAUX[2], 5), 0.9, 'colonne courte : 90 %');
  assert.ok(reussiteExigee(NIVEAUX[2], 55) < 0.81, 'colonne de 55 chiffres : environ 80 %');
  const h = hist(30, 5, 2.5); // 83 % de justes
  assert.equal(evaluerLecon(h, sp('p8-3')).index, 2, 'argent sur une colonne longue');
  assert.equal(evaluerLecon(h, sp('p2-1')).index, 1, 'bronze sur une colonne courte');
  assert.equal(evaluer(h).index, 1, 'sans nombre de chiffres : seuil habituel');
  assert.ok(colonnesPourNiveau({ paliers: { 'p2-1': { hist: h } } }, sp('p2-1')) > 0);
});

test('0.41 : piste × ÷ : les tables d\'abord, puis la multiplication quand les gestes et les tables sont prêts', () => {
  assert.equal(pisteDe(sp('p6-1a')), 'muldiv');
  assert.equal(pisteDe(sp('p5-6')), 'muldiv');
  assert.equal(pisteDe(sp('p5-e')), 'colonnes');
  const paliers = {};
  for (const s of SOUS_PALIERS.filter((x) => !x.mental && x.ordre <= sp('p4-5').ordre)) paliers[s.id] = { valide: '2026-11-01', hist: hist(30, 0, 1.2) };
  const d = { paliers, motifs: {}, tables: {}, records: {}, sessions: [] };
  assert.ok(porteMulDiv(d, sp('p6-a')).ok, 'les tables s\'ouvrent dès les grands amis en soustraction');
  const p = porteMulDiv(d, sp('p6-1a'));
  assert.ok(!p.ok && p.raisons.some((r) => /addition/.test(r)) && p.raisons.some((r) => /diagnostic/.test(r)));
  for (const id of ['p5-1', 'p5-2', 'p5-3', 'p5-4', 'p6-a']) paliers[id] = { valide: '2026-11-10', hist: hist(30, 0, 1.2) };
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) d.tables[cleProduit(a, b)] = { hist: [{ ok: 1, t: 1.2 }] };
  d.tables[cleProduit(7, 8)] = { hist: [{ ok: 0, t: 3 }] };
  d.tables[cleProduit(6, 7)] = { hist: [{ ok: 0, t: 3 }] };
  d.tables[cleProduit(6, 8)] = { hist: [{ ok: 0, t: 3 }] };
  assert.ok(!porteMulDiv(d, sp('p6-1a')).ok, '3 produits encore faux');
  d.tables[cleProduit(6, 8)] = { hist: [{ ok: 1, t: 1.5 }] };
  assert.ok(porteMulDiv(d, sp('p6-1a')).ok, porteMulDiv(d, sp('p6-1a')).raisons.join(' | '));
  assert.ok(famille('grand').length > 0);
});

test('0.41 : pourcentages variés, résultats au centime', () => {
  const vus = new Set();
  for (let i = 0; i < 2000; i++) {
    const e = pourcentage();
    vus.add(e.texte.join('|'));
    assert.ok(Math.abs(e.resultat * 100 - Math.round(e.resultat * 100)) < 1e-6, e.texte.join(' '));
  }
  assert.ok(vus.size > 1000, `${vus.size} énoncés`);
});

test('0.41 : séances anciennes fusionnées (une fois), drills gardés entiers', () => {
  const s = [];
  for (let k = 0; k < 5; k++) s.push({ date: '2026-01-10', module: 'planches', mode: 'x', total: 10, justes: 9, dureeMs: 60000, horodatage: k });
  s.push({ date: '2026-01-10', module: 'drills', mode: '123-1', total: 1, justes: 1, dureeMs: 3000 });
  s.push({ date: '2026-11-20', module: 'planches', mode: 'x', total: 10, justes: 9, dureeMs: 60000 });
  const d = { sessions: s };
  assert.equal(compacterSessions(d, '2026-11-25'), 4);
  assert.equal(d.sessions.length, 3);
  const f = d.sessions.find((x) => x.agrege);
  assert.deepEqual([f.total, f.justes, f.dureeMs, f.agrege], [50, 45, 300000, 5]);
  assert.equal(compacterSessions(d, '2026-11-25'), 0, 'idempotent');
});

test('0.41 : ma semaine et mon mois', () => {
  const d = { paliers: {}, sessions: [{ date: '2026-11-24', module: 'lecons', dureeMs: 30 * 60000 }, { date: '2026-11-23', module: 'planches', dureeMs: 10 * 60000 }] };
  const e = equilibreSemaine(d, '2026-11-25');
  assert.equal(e.total, 40);
  assert.ok(e.manque.includes('Anzan'));
  const m = planMois(d, '2026-11-25');
  assert.equal(m.length, 4);
  assert.ok(m.every((w) => w.lecons.length >= 1));
});
