import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Samedi 21 novembre 2026.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-21T10:00:00').getTime() });
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };

const p = await import('../src/core/progression.js');
await p.chargerProgression();
const { SOUS_PALIERS } = await import('../src/core/curriculum.js');
const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const valides = (jusqua) => { const fin = sp(jusqua).ordre; return Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= fin).map((s) => [s.id, { valide: '2026-11-01', hist: [] }])); };

test('0.40 : séance enregistrée relue après un rechargement, sans écran vide', async () => {
  const { plan, relireSeance, planSur } = await import('../src/modules/seance.js');
  const d = p.progression();
  Object.assign(d.paliers, valides('p2-3'));
  d.reglages.objectifMinutes = 25;
  const lecon = sp('p2-4');
  assert.ok(lecon.autorises instanceof Set || lecon.autorises === null || lecon.autorises === undefined);
  // Avant la 0.40 : la leçon était enregistrée en entier ; relue, sa liste de gestes autorisés (un Set) devenait {}.
  const ancienne = JSON.parse(JSON.stringify({ debut: 0, date: '2026-11-21', decision: { type: 'lecon', titre: 'Leçon', detail: lecon.titre, aller: ['lecons', { sousPalier: lecon.id }], sp: lecon } }));
  const relue = relireSeance(ancienne);
  assert.equal(relue.decision.sp, lecon, 'la leçon est retrouvée dans le curriculum');
  assert.doesNotThrow(() => plan(d, 0, ancienne));
  // Une séance illisible se recalcule.
  assert.doesNotThrow(() => planSur(d, 0, { debut: 0, decision: { type: 'lecon', sp: 'inconnue', aller: ['lecons', {}] }, partie: { lecon: 'x' } }));
  // La nouvelle séance n'enregistre que l'identifiant.
  const s = await p.commencerSeance({ decision: { type: 'lecon', sp: lecon, aller: ['lecons', {}] }, partie: { partie: 'mul', lecon } });
  assert.equal(s.decision.sp, lecon.id);
  assert.equal(s.partie.lecon, lecon.id);
});

test('0.40 : drills, temps impossibles refusés et faux records nettoyés', async () => {
  const { catalogueDrills, tempsPlausible, correctionsDrills, chiffresDrill } = await import('../src/core/drills.js');
  const d = catalogueDrills().find((x) => x.id.startsWith('pendule'));
  assert.equal(tempsPlausible(d, 0.1 * 1000 * chiffresDrill(d)), false, 'moins de 0,15 s par chiffre');
  assert.equal(tempsPlausible(d, 12000, [40000, 50000, 60000]), false, 'plus de 3 fois plus rapide que la médiane');
  assert.equal(tempsPlausible(d, 30000, [40000, 50000, 60000]), true);
  const donnees = {
    sessions: [40000, 33000, 142000, 1200].map((t) => ({ module: 'drills', mode: d.id, justes: 1, dureeMs: t })),
    records: { [`drill-${d.id}`]: { dureeMs: 1200 } },
    drills: { [d.id]: { validations: 2, valide: '2026-11-20' } },
  };
  const c = correctionsDrills(donnees);
  assert.equal(c.records[`drill-${d.id}`].dureeMs, 33000, 'le meilleur temps plausible');
  assert.equal(p.corrigerDrills(donnees) > 0, true);
  assert.equal(donnees.records[`drill-${d.id}`].dureeMs, 33000);
});

test('0.40 : contrôle à 90 jours relié au grade de chaque synthèse ; échauffement de 3 min au plus', async () => {
  const { formatCouvertParEpreuve } = await import('../src/core/progression.js');
  const { drillEchauffement, dureeEchauffement, plateaux } = await import('../src/core/parcours.js');
  const avec6 = formatCouvertParEpreuve({ sessions: [{ date: '2026-11-10', module: 'epreuves', reglages: { systeme: 'nissho', grade: '6' } }] }, '2026-11-21');
  assert.equal(avec6(sp('p5-5')), true);
  assert.equal(avec6(sp('p8-3')), false, 'le 6e kyū n\'a pas 5 et 6 chiffres');
  assert.equal(avec6(sp('p9-4')), false, 'ni les × du 1er kyū');
  const avec1 = formatCouvertParEpreuve({ sessions: [{ date: '2026-11-10', module: 'epreuves', reglages: { systeme: 'nissho', grade: '1' } }] }, '2026-11-21');
  assert.ok(['p5-5', 'p8-3', 'p9-4', 'p9-6'].every((id) => avec1(sp(id))));
  const d = { paliers: valides('p9-6'), drills: {}, records: {}, reglages: {}, sessions: [], motifs: {} };
  assert.ok(dureeEchauffement(d, drillEchauffement(d)) <= 3 * 60000);
  // Très avancé : plus de plateau sur les petits amis.
  const sem = Object.fromEntries(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((k) => [k, Array(12).fill(2)]));
  const av = { ...d, motifs: { '+4:petit': { hist: Array.from({ length: 30 }, () => ({ ok: 1, t: 2 })), sem } } };
  assert.ok(!plateaux(av, '2026-11-21').some((x) => x.cle === '+4:petit'));
});

test('0.40 : entre deux grades préparatoires, un examen hebdomadaire sur les leçons', async () => {
  const { PREKYU, examenDeLaSemaine } = await import('../src/core/examen.js');
  const i = PREKYU.findIndex((g) => g.id === '17');
  const d = { paliers: {}, records: {}, reglages: {}, sessions: [], motifs: {} };
  for (const g of PREKYU.slice(0, i + 1)) for (const id of g.lecons) d.paliers[id] = { valide: '2026-11-10' };
  assert.equal(examenDeLaSemaine(d).id, '17', 'pas encore obtenu : le grade');
  for (const g of PREKYU.slice(0, i + 1)) d.records[`prekyu-${g.id}`] = { reussi: true };
  assert.equal(examenDeLaSemaine(d).id, 'hebdo', 'obtenu, et le 16e pas encore ouvert : l\'examen de la semaine');
});

test('0.40 : lièvre et marathon au stade de l\'élève, 3 à 4 minutes, variantes tournées', async () => {
  const { formatRythme, stadeRythme } = await import('../src/core/rythmeStade.js');
  const base = { paliers: valides('p2-3'), records: {}, reglages: {}, sessions: [], motifs: {} };
  assert.equal(stadeRythme(base), 'base');
  assert.deepEqual([formatRythme(base, '2026-11-21', 'lievre').chiffres, formatRythme(base, '2026-11-21', 'lievre').lignes], [1, 5]);
  const m = formatRythme(base, '2026-11-21', 'marathon');
  assert.ok(m.lignes >= 30 && m.lignes <= 40, `${m.lignes}`);
  const grands = { ...base, paliers: valides('p4-5') };
  assert.equal(formatRythme(grands, '2026-11-21', 'lievre').lignes, 7);
  const tous = Object.fromEntries(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'].map((id) => [`epreuve-${id}`, { reussi: true }]));
  const dan = { ...base, paliers: valides('p9-6'), records: tous };
  assert.equal(stadeRythme(dan), 'dan');
  const md = formatRythme(dan, '2026-11-21', 'marathon');
  assert.ok(md.chiffres === 5 && md.chiffresMax === 10 && md.lignes >= 20 && md.tranche === 10);
  const jours = (n) => Array.from({ length: n }, (_, k) => ({ date: `2026-10-${String(k + 1).padStart(2, '0')}` }));
  assert.deepEqual([0, 1, 2].map((n) => formatRythme({ ...dan, sessions: jours(n) }, '2026-11-21', 'lievre').variante), ['normal', 'accelere', 'fantome']);
  assert.equal(formatRythme({ ...dan, sessions: jours(1) }, '2026-11-21', 'marathon').variante, 'cascade');
});

test('0.40 : phases des leçons, cycle référence → montée → endurance, sorties et filet', async () => {
  const { phasesLecon, etatInitial, apresColonne, phaseCourante, PASSAGE, SORTIE, FILET } = await import('../src/core/phases.js');
  const plan = phasesLecon(sp('p3-1'));
  assert.deepEqual(plan.ordre.map((x) => x.id), ['reference', 'montee', 'endurance']);
  assert.equal(phasesLecon(sp('p6-1')), null, '× : pas de phases');
  let e = etatInitial(plan);
  const col = (juste, rapide = true) => { e = apresColonne(plan, e, { juste, rapide }); return phaseCourante(plan, e).id; };
  // Au départ : 6 justes d'affilée À L'ALLURE ARGENT ; une lente remet le compte à zéro.
  for (let k = 0; k < 5; k++) col(true);
  col(true, false);
  assert.equal(phaseCourante(plan, e).id, 'reference');
  for (let k = 0; k < PASSAGE - 1; k++) col(true);
  assert.equal(col(true), 'montee');
  // Montée : 6 justes d'affilée à l'argent → endurance.
  for (let k = 0; k < PASSAGE; k++) col(true);
  assert.equal(phaseCourante(plan, e).id, 'endurance');
  // Endurance jamais réussie : retour en référence au bout de 12 colonnes (une juste sur deux, pas de filet).
  for (let k = 0; k < SORTIE; k++) col(k % 2 === 0);
  assert.equal(phaseCourante(plan, e).id, 'reference');
  // Après un retour : 6 colonnes en référence, justes ou non, puis la montée reprend.
  for (let k = 0; k < 6; k++) col(k % 2 === 0);
  assert.equal(phaseCourante(plan, e).id, 'montee');
  // Filet : 2 erreurs de suite → 3 colonnes de filet, puis retour à la phase.
  col(false); assert.equal(col(false), 'filet');
  for (let k = 0; k < FILET - 1; k++) col(true);
  assert.equal(col(true), 'montee');
  // « Je connais déjà » : on commence à 2 chiffres.
  assert.equal(phaseCourante(plan, etatInitial(plan, true)).id, 'montee');
  // Endurance p8 : 6, 8 puis 10 lignes (la référence).
  const pe = phasesLecon(sp('p8-1'));
  assert.deepEqual(pe.ordre.map((x) => x.format?.lignes ?? 'ref'), [6, 8, 'ref']);
});

test('0.40 : formats des phases, sans cascades avant p5-4 ; 2 et 3 chiffres en alternance ; jauge en gestes', async () => {
  const { genererExercice } = await import('../src/core/curriculum.js');
  const { phasesLecon, autorisesPhase, objectifGestes } = await import('../src/core/phases.js');
  const lecon = sp('p4-3') ?? sp('p4-1');
  const f = { ...phasesLecon(lecon).ordre[1].format, autorises: autorisesPhase(lecon, false) };
  for (let k = 0; k < 40; k++) {
    const ex = genererExercice(lecon, {}, { format: f });
    assert.ok([7, 8].includes(ex.lignes.length));
    assert.ok(Math.max(...ex.lignes.map((l) => String(l.n).length)) <= 3);
    assert.ok(!ex.motifs.some((m) => m.startsWith('cascade')), ex.motifs.join());
  }
  const deux = SOUS_PALIERS.find((s) => s.chiffres === 2 && /2 et 3 chiffres/.test(s.titre));
  if (deux) {
    const longueurs = Array.from({ length: 6 }, () => Math.max(...genererExercice(deux).lignes.slice(1).map((l) => String(l.n).length)));
    assert.ok(longueurs.every((x, i) => i === 0 || x !== longueurs[i - 1]), `alternance : ${longueurs}`);
  }
  assert.ok(objectifGestes(lecon, () => genererExercice(lecon)) >= lecon.repetitions);
});

test('0.40 : hors référence, le temps d\'une colonne n\'entre pas dans l\'historique du geste', async () => {
  await p.noterGestes(['+7:grand'], [], 1.1, { format: '7x2', horsReference: true });
  await p.noterGestes(['+7:grand'], [], 2.2, { format: '5x1' });
  const f = p.progression().motifs['+7:grand'];
  assert.deepEqual(f.hist.map((x) => x.t), [null, 2.2]);
  assert.ok(f.semF['7x2'] && f.semF['5x1']);
  assert.equal(Object.values(f.sem).flat().length, 1, 'semaines toutes formats : la référence seule');
});
