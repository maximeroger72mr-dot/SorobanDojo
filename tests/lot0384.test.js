import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { avecGraine } from '../src/core/hasard.js';

// Vendredi 20 novembre 2026 : jour d'examen blanc (vendredi au dimanche).
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-20T10:00:00').getTime() });
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };

const p = await import('../src/core/progression.js');
await p.chargerProgression();
const { SOUS_PALIERS } = await import('../src/core/curriculum.js');

const valider = (d, jusqua) => {
  const fin = SOUS_PALIERS.find((s) => s.id === jusqua).ordre;
  for (const s of SOUS_PALIERS.filter((x) => !x.mental && x.ordre <= fin)) d.paliers[s.id] = { valide: '2026-11-01', hist: [] };
};

test('0.38.4 : jour d\'examen blanc, la leçon du jour passe en tête de « Pour compléter »', async () => {
  const { PREKYU } = await import('../src/core/examen.js');
  const { plan } = await import('../src/modules/seance.js');
  const d = p.progression();
  valider(d, 'p4-2');
  for (const g of PREKYU.slice(0, 3)) d.records[`prekyu-${g.id}`] = { reussi: true };
  d.reglages.objectifMinutes = 25;
  const r = plan(d, 0);
  assert.ok(r.essentiel.some((it) => it.examen), 'l\'examen est dans la séance');
  assert.ok(!r.essentiel.some((it) => it.decision), 'la leçon n\'y est pas');
  assert.match(r.bonus[0].titre, /leçon/i);
  assert.deepEqual(r.bonus[0].aller, r.decision.aller);
  assert.ok(r.mot.some((x) => /vous attend en tête de « Pour compléter »/.test(x)));
});

test('0.38.4 : mini-test en séries, une remise à zéro garde le plan (le morceau fait passe en tête)', async () => {
  const id = 'p8-1';
  const plan = Array.from({ length: 15 }, (_, i) => i + 1);
  p.progression().paliers[id] = { testSeries: { debut: '2026-11-10', series: [{ justes: 5, total: 5 }], plan } };
  const serie = { justes: 5, total: 5, dureeMs: 1000, tempsJustes: [] };
  const series = await p.noterSerieTest(id, serie, { morceau: 1, taille: 5 });
  assert.equal(series.length, 1);
  const t = p.progression().paliers[id].testSeries;
  assert.deepEqual(t.plan, [6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15]);
  // La série suivante (rang 1) prend un morceau pas encore fait.
  assert.deepEqual(t.plan.slice(5, 10), [1, 2, 3, 4, 5]);
});

test('0.38.4 : dan d\'anzan Zenkoren, × décimaux exacts à 3 décimales au plus', async () => {
  const { genererSujetAnzanDanZenkoren } = await import('../src/core/danZenkoren.js');
  avecGraine(84, () => {
    for (let k = 0; k < 30; k++) {
      const s = genererSujetAnzanDanZenkoren({});
      for (const pb of s.sections.find((x) => x.cle === 'mul').problemes) {
        if (!pb.virgules) continue;
        assert.ok(pb.decimales <= 3, `${pb.a} × ${pb.b} : ${pb.decimales} décimales`);
        assert.equal(Math.round(pb.a * pb.b * 1000) / 1000, pb.resultat);
      }
    }
  });
});

test('0.38.4 : kyū Zenkoren du 3e au 1er, denpyōzan et anzan au choix, comptés si choisis', async () => {
  const { GRADES_ZENKOREN, genererSujet, minutesZenkoren, optionsChoisies } = await import('../src/core/epreuves.js');
  const z = (id) => GRADES_ZENKOREN.find((g) => g.id === id);
  assert.ok(!z('4').options);
  for (const id of ['3', '2', '1']) assert.deepEqual(Object.keys(z(id).options), ['denpyo', 'anzan']);
  avecGraine(5, () => {
    const s = genererSujet(z('3'), { options: ['denpyo', 'anzan'] });
    assert.deepEqual(s.sections.map((x) => x.cle), ['mul', 'div', 'mitori', 'denpyo', 'anzan']);
    const dp = s.sections[3];
    assert.equal(dp.problemes.length, 15);
    assert.equal(dp.liasse.length, 20);
    assert.ok(dp.liasse.flat().every((n) => String(n).length >= 3 && String(n).length <= 5));
    const an = s.sections[4];
    assert.equal(an.minutes, 3);
    assert.ok(an.problemes.length === 15 && an.problemes.every((x) => x.mental));
    assert.deepEqual(genererSujet(z('3')).sections.map((x) => x.cle), ['mul', 'div', 'mitori'], 'sans option : les 3 obligatoires');
  });
  assert.equal(minutesZenkoren(z('3'), ['denpyo', 'anzan']), 31);
  assert.equal(minutesZenkoren(z('3'), []), 21);
  assert.deepEqual(optionsChoisies({ reglages: {} }, z('2')), ['denpyo', 'anzan']);
  assert.deepEqual(optionsChoisies({ reglages: { optionsZenkoren: ['anzan'] } }, z('2')), ['anzan']);
  assert.deepEqual(optionsChoisies({ reglages: {} }, z('4')), []);
});

test('0.38.4 : vitesse vers un grade, × ÷ non mesurés signalés, colonnes au format du grade', async () => {
  const { planObjectif } = await import('../src/core/parcours.js');
  const { vitesseColonnesFormat, allureGrade } = await import('../src/core/allure.js');
  const { GRADES_KYU } = await import('../src/core/epreuves.js');
  const g6 = GRADES_KYU.find((g) => g.id === '6');
  // Gestes rapides (colonnes courtes), aucune multiplication mesurée.
  const motifs = Object.fromEntries(['+1:direct', '+2:direct', '+3:petit', '+4:petit', '+6:grand'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.3 })) }]));
  const d = { paliers: {}, motifs, records: {}, reglages: { systemeGrades: 'nissho' }, sessions: [] };
  valider(d, 'p4-2');
  const sans = planObjectif(d, '6', '2027-06-01', '2026-11-20');
  assert.equal(sans.muldivNonMesure, true);
  assert.equal(sans.colonnesAConfirmer, true);
  assert.deepEqual(sans.format, { lignes: 10, chiffres: 3 });
  // Une planche au format (10 lignes de 3 chiffres), lente : c'est elle qui compte.
  const parColonne = (10 * 3 * allureGrade(g6).parChiffre * 2 + 3) * 1000;
  d.sessions.push({ date: '2026-11-19', module: 'planches', reglages: { lignes: 10, chiffres: 3, genre: 'gestes' }, total: 10, justes: 10, dureeMs: 10 * parColonne });
  // Une planche courte ne compte pas.
  d.sessions.push({ date: '2026-11-19', module: 'planches', reglages: { lignes: 5, chiffres: 1 }, total: 10, justes: 10, dureeMs: 10000 });
  assert.ok(Math.abs(vitesseColonnesFormat(d, g6) - 2 * allureGrade(g6).parChiffre) < 1e-9);
  const avec = planObjectif(d, '6', '2027-06-01', '2026-11-20');
  assert.equal(avec.colonnesAConfirmer, false);
  assert.ok(avec.ecartVitesse >= 1.99, `${avec.ecartVitesse}`);
});
