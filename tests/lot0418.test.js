import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctionsDrills, catalogueDrills } from '../src/core/drills.js';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { decisionDuJour, leconsSousArgent } from '../src/core/prof.js';
import { famille } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const hist = (n, ko, t) => Array.from({ length: n }, (_, i) => ({ ok: i < ko ? 0 : 1, t }));

test('0.40.18 : drills, le compte de validations est recalculé (plus de retrait à chaque chargement)', () => {
  const sessions = [
    { module: 'drills', mode: '123-1', date: '2026-11-07', justes: 1, dureeMs: 4560 },
    { module: 'drills', mode: '123-1', date: '2026-11-07', justes: 1, dureeMs: 1340 }, // impossible
    ...['2026-11-22', '2026-11-22', '2026-11-23', '2026-11-24'].map((date, i) => ({ module: 'drills', mode: '123-1', date, justes: 1, dureeMs: 3200 + 100 * i })),
  ];
  const d = { sessions, records: {}, drills: { '123-1': { validations: 0 } } };
  const c = correctionsDrills(d);
  assert.equal(c.validations['123-1'], 5, 'les 5 passages plausibles sous le bronze');
  d.drills['123-1'].validations = c.validations['123-1'];
  assert.deepEqual(correctionsDrills(d).validations, {}, 'second chargement : rien ne change');
  assert.ok(catalogueDrills().some((x) => x.id === '123-1'));
});

test('0.40.18 : porte d\'argent avant une nouvelle étape, même quand les gestes sont en or ailleurs', () => {
  const p2 = SOUS_PALIERS.filter((s) => s.palier.id === 'p2' && !s.mental && s.type !== 'theorie');
  const paliers = {};
  for (const s of [...SOUS_PALIERS.filter((x) => ['p0', 'p1'].includes(x.palier.id)), ...p2]) paliers[s.id] = { valide: '2026-11-01', hist: hist(30, 0, 1.2) };
  paliers['p2-6'] = { valide: '2026-11-09', hist: hist(30, 7, 1.4) }; // 77 % de justes
  paliers['p2-7'] = { valide: '2026-11-15', hist: hist(30, 5, 1.4) }; // 83 %
  const motifs = Object.fromEntries(famille('petit').map((c) => [c, { hist: hist(30, 0, 1.1) }]));
  const d = { paliers, motifs, sessions: [], records: {}, reglages: {}, drills: {} };
  assert.deepEqual(leconsSousArgent(d).map((s) => s.id), ['p2-6', 'p2-7']);
  const prochain = SOUS_PALIERS.filter((s) => s.palier.id === 'p3' && !s.mental)[0];
  const dec = decisionDuJour(d, '2026-11-16', prochain);
  assert.equal(dec.type, 'automatiser');
  assert.ok(dec.porteArgent, JSON.stringify(dec));
  assert.equal(dec.sp.id, 'p2-6');
  // Toutes en argent : on avance.
  paliers['p2-6'].hist = hist(30, 1, 1.4);
  paliers['p2-7'].hist = hist(30, 2, 1.4);
  assert.deepEqual(leconsSousArgent(d), []);
  assert.equal(decisionDuJour(d, '2026-11-16', prochain).type, 'lecon');
  // À l'intérieur d'une étape (leçon suivante de la même étape) : pas de porte, le rattrapage suffit.
  paliers['p2-6'].hist = hist(30, 7, 1.4);
  paliers['p3-1'] = { valide: '2026-11-17', hist: hist(30, 0, 1.5) };
  assert.ok(!decisionDuJour(d, '2026-11-18', sp('p3-2')).porteArgent);
  assert.ok(sp('p2-6'));
});
