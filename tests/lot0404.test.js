import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoupageImages, ecranTropLent, IMAGES_VIDES_MIN } from '../src/ui/cadence.js';
import { genererMitori, nombreLigne, PART_DECIMAUX } from '../src/core/epreuves.js';
import { PALIERS_DICTEE } from '../src/core/dicteeAnzan.js';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { phasesLecon } from '../src/core/phases.js';
import { jeuPropose } from '../src/core/propositions.js';
import { famille } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

test('0.40.4 : flash compté en images, au moins une image vide ; écran trop lent signalé', () => {
  const i60 = 1000 / 60;
  // 20e dan à 60 Hz : 100 ms par nombre = 6 images, dont 1 vide (15 ms voulus : moins d'une image).
  assert.deepEqual(decoupageImages(100, 0.85, i60), { total: 6, visibles: 5, vides: 1 });
  assert.deepEqual(decoupageImages(300, 0.85, i60), { total: 18, visibles: 15, vides: 3 });
  assert.equal(decoupageImages(30, 0.85, i60).vides, IMAGES_VIDES_MIN);
  assert.equal(decoupageImages(500, 1, i60).vides, 0, 'tapis, colonne qui s\'efface : pas d\'écran vide');
  assert.ok(ecranTropLent(100, i60) && ecranTropLent(200, i60));
  assert.ok(!ecranTropLent(300, i60) && !ecranTropLent(100, 1000 / 144));
});

test('0.40.4 : le chiffre 1 dans les lignes à 1 chiffre ; décimaux à 60 %', () => {
  const vus = new Set(Array.from({ length: 400 }, () => nombreLigne(1)));
  assert.ok(vus.has(1) && vus.has(9) && !vus.has(0));
  const f = { lignes: 5, min: 1, max: 1 };
  assert.ok(Array.from({ length: 200 }, () => genererMitori(f)).some((ex) => ex.lignes.some((l) => l.n === 1)));
  assert.equal(PART_DECIMAUX, 0.6);
});

test('0.40.4 : dictée de tête jusqu\'à 3 chiffres × 10 et 4 chiffres × 5 ; p1-a avec le 5 et la pincée', () => {
  assert.ok(PALIERS_DICTEE.some((p) => p.chiffres === 3 && p.nombres === 10));
  assert.ok(PALIERS_DICTEE.some((p) => p.chiffres === 4 && p.nombres === 5));
  const c = sp('p1-a').cibles;
  assert.ok(c.includes('+7:direct') && c.includes('-9:direct') && c.includes('+5:direct'));
  assert.deepEqual([...c].sort(), [...famille('direct')].sort());
});

test('0.40.4 : phases, une leçon d\'introduction à 1 chiffre allonge la colonne sans passer à 2 chiffres', () => {
  for (const id of ['p2-1', 'p3-1', 'p4-2']) {
    const m = phasesLecon(sp(id)).ordre.find((x) => x.id === 'montee');
    assert.equal(m.format.chiffres, 1, id);
    assert.equal(phasesLecon(sp(id)).ordre.find((x) => x.id === 'endurance').format.lignes, 10);
  }
  assert.equal(phasesLecon(sp('p2-3')).ordre.find((x) => x.id === 'montee').format.chiffres, 3, '2 et 3 chiffres');
  assert.equal(phasesLecon(sp('p4-5')).ordre.find((x) => x.id === 'montee').format.chiffres, 3, 'synthèse à 3 chiffres');
});

test('0.40.4 : plus de jeu proposé à partir du 6e kyū', () => {
  const ids = SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= sp('p5-5').ordre).map((s) => s.id);
  const d = { paliers: Object.fromEntries(ids.map((id) => [id, { valide: '2026-10-01', hist: [] }])), records: {}, sessions: [], reglages: {}, motifs: {} };
  assert.ok(jeuPropose(d, '2026-11-24'));
  for (const id of ['10', '9', '8', '7', '6']) d.records[`epreuve-${id}`] = { reussi: true };
  assert.equal(jeuPropose(d, '2026-11-24'), null);
});
