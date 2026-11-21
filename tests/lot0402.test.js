import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Vendredi 20 novembre 2026 (premier jour du créneau d'examen).
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-20T10:00:00').getTime() });
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };

const p = await import('../src/core/progression.js');
await p.chargerProgression();
const { SOUS_PALIERS } = await import('../src/core/curriculum.js');
const { phasesLecon, etatInitial, apresColonne, phaseCourante, enduranceExigee, ENDURANCE_MIN, REFERENCE_RETOUR } = await import('../src/core/phases.js');
const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const h = (t, n = 20) => Array.from({ length: n }, () => ({ ok: 1, t }));

test('0.40.2 : amis, endurance obligatoire ; garde : la référence passe à l\'endurance sans réussir la montée', () => {
  const plan = phasesLecon(sp('p3-1'));
  assert.equal(enduranceExigee(plan), ENDURANCE_MIN);
  assert.equal(enduranceExigee(phasesLecon(sp('p9-2'))), 0, 'endurance à rampe : rien de plus');
  // Élève lent (jamais à l'allure argent) : sans la garde, il resterait en référence.
  let e = etatInitial(plan);
  for (let k = 0; k < 30; k++) e = apresColonne(plan, e, { juste: true, rapide: false });
  assert.equal(phaseCourante(plan, e).id, 'reference');
  for (let k = 0; k < REFERENCE_RETOUR; k++) e = apresColonne(plan, e, { juste: true, rapide: false, versEndurance: true });
  assert.equal(phaseCourante(plan, e).id, 'endurance');
  // En montée : on y passe tout de suite.
  const m = apresColonne(plan, { ...etatInitial(plan, true) }, { juste: true, rapide: true, versEndurance: true });
  assert.equal(phaseCourante(plan, m).id, 'endurance');
});

test('0.40.2 : dette de vitesse, sortie par les gestes en or ; seule une leçon marquée force la vitesse', async () => {
  const { leconsFluidite, forceVitesse } = await import('../src/core/fluidite.js');
  const ids = SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= sp('p3-2').ordre).map((s) => s.id);
  const d = { paliers: Object.fromEntries(ids.map((id) => [id, { valide: '2026-10-01', hist: h(2.5) }])), motifs: {}, records: {}, sessions: [], reglages: {} };
  assert.ok(leconsFluidite(d).some((x) => x.id === 'p2-1'));
  assert.ok(!forceVitesse(d, sp('p2-1')), 'sortie à l\'argent : ne force pas la vitesse');
  for (const c of sp('p2-1').cibles) d.motifs[c] = { hist: h(1) };
  assert.ok(!leconsFluidite(d).some((x) => x.id === 'p2-1'), 'gestes en or : sortie de la dette');
  d.paliers['p2-2'].fluidite = '2026-11-19';
  assert.ok(forceVitesse(d, sp('p2-2')));
});

test('0.40.2 : entre deux grades préparatoires, objectif court : la feuille de la semaine dans la séance', async () => {
  const { PREKYU } = await import('../src/core/examen.js');
  const { plan } = await import('../src/modules/seance.js');
  const d = p.progression();
  const i = PREKYU.findIndex((g) => g.id === '17');
  for (const g of PREKYU.slice(0, i + 1)) { for (const id of g.lecons) d.paliers[id] = { valide: '2026-11-10', hist: [] }; d.records[`prekyu-${g.id}`] = { reussi: true }; }
  d.reglages.objectifMinutes = 15;
  const s = plan(d, 0, null);
  assert.ok(s.essentiel.some((it) => it.titre === 'Feuille de la semaine'), s.essentiel.map((it) => it.titre).join(' | '));
  assert.ok(!s.bonus.some((it) => it.titre === 'Feuille de la semaine'), 'pas en double dans « Pour compléter »');
});

test('0.40.3 : feuille de la semaine dans la séance une fois par semaine, même sans examen blanc disponible, et gardée par le calibrage', async () => {
  const { plan } = await import('../src/modules/seance.js');
  const { examenDeLaSemaine } = await import('../src/core/examen.js');
  const d = p.progression();
  for (const k of Object.keys(d.paliers)) delete d.paliers[k];
  for (const k of Object.keys(d.records)) delete d.records[k];
  for (const id of ['p0-2', 'p1-1', 'p1-2', 'p1-3']) d.paliers[id] = { valide: '2026-11-10', hist: [] };
  d.reglages.objectifMinutes = 10;
  const titres = () => plan(d, 0, null).essentiel.map((it) => it.titre);
  const { PREKYU } = await import('../src/core/examen.js');
  for (const g of PREKYU) d.records[`prekyu-${g.id}`] = { reussi: true };
  assert.equal(examenDeLaSemaine(d).id, 'hebdo', 'grade obtenu, le suivant pas ouvert');
  assert.ok(titres().includes('Feuille de la semaine'), titres().join(' | '));
  // Déjà pratiqué au premier jour du créneau (jeudi exclu) : plus le lendemain.
  d.sessions.push({ date: '2026-11-20', module: 'lecons', total: 10, justes: 10, dureeMs: 60000 });
  mock.timers.setTime(new Date('2026-11-21T10:00:00').getTime());
  assert.ok(!titres().includes('Feuille de la semaine'), 'samedi, après une séance le vendredi');
  // Vendredi suivant : de retour.
  mock.timers.setTime(new Date('2026-11-27T10:00:00').getTime());
  assert.ok(titres().includes('Feuille de la semaine'));
  // Faite plus tôt dans la semaine : pas de doublon.
  d.sessions.push({ date: '2026-11-24', module: 'defis', mode: 'semaine', total: 10, justes: 9, dureeMs: 300000 });
  assert.ok(!titres().includes('Feuille de la semaine'));
});
