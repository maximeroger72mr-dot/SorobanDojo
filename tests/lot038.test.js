import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, fluxEquilibre, genererExercice } from '../src/core/curriculum.js';
import { GRADES, genererSujet } from '../src/core/epreuves.js';
import { questionFlash, GRADES_FLASH } from '../src/core/flashGrades.js';
import { genererMarche } from '../src/core/multiplication.js';
import { avecGraine } from '../src/core/hasard.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

test('0.38 lot 1 : anzan, chaque geste de la leçon sort assez souvent', () => {
  avecGraine(38, () => {
    const p3a = sp('p3-a');
    const flux = fluxEquilibre(p3a, 10, () => ({}));
    const n = {};
    for (let i = 0; i < 300; i++) for (const g of flux().gestesAnzan) n[g] = (n[g] ?? 0) + 1;
    for (const c of p3a.cibles) assert.ok((n[c] ?? 0) >= 40, `${c} : ${n[c]}`);
  });
  assert.ok(!sp('pa-5').cibles.some((c) => c.startsWith('cascade')), 'pas de cascade à 1 chiffre');
});

test('0.38 lot 1 : divisions décimales à la longueur du sujet', () => {
  avecGraine(2, () => {
    const g = GRADES.find((x) => x.id === '1');
    const longueurs = new Set();
    for (let k = 0; k < 10; k++) for (const p of genererSujet(g).sections.find((s) => s.cle === 'div').problemes) if (p.virgules) longueurs.add(String(p.entiers[1]).length);
    assert.ok(longueurs.has(5) && longueurs.has(6), [...longueurs].join());
  });
});

test('0.38 lot 1 : flash et chaînes d\'anzan sans nombre répété de suite ; p7-4c sans quotient en 0', () => {
  avecGraine(4, () => {
    for (const g of GRADES_FLASH) for (let i = 0; i < 40; i++) {
      const q = questionFlash(g);
      assert.ok(!q.lignes.some((l, k) => k > 0 && l.n === q.lignes[k - 1].n), JSON.stringify(q.lignes));
    }
    for (let i = 0; i < 200; i++) {
      const ex = genererExercice(sp('p2-a'));
      assert.ok(!ex.lignes.some((l, k) => k > 0 && l.n === ex.lignes[k - 1].n));
      assert.notEqual(genererMarche('div-1x').resultat % 10, 0);
    }
  });
});

test('0.38 lot 2 : absorption limitée aux leçons proches ; révision mélangée de 3 leçons au plus', async () => {
  const { absorbee } = await import('../src/core/progression.js');
  const { MELANGE_MAX, calculsMelange } = await import('../src/core/revision.js');
  const paliers = Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental).map((s) => [s.id, { valide: '2026-01-01', carte: { boite: 4 } }]));
  const d = { paliers };
  // Les révisions générales (54 gestes) n'absorbent plus rien : la dernière leçon des grands amis
  // reste en révision ; les leçons d'une étape restent absorbées par la synthèse de l'étape.
  assert.equal(absorbee(d, 'p4-5'), false);
  assert.equal(absorbee(d, 'p2-1'), true);
  const add = SOUS_PALIERS.filter((s) => s.type === 'addsub' && !s.mental && s.cibles?.length);
  assert.ok(add.filter((s) => absorbee(d, s.id)).length < 27);
  assert.equal(MELANGE_MAX, 3);
  assert.deepEqual([2, 3].map(calculsMelange), [10, 12]);
});

test('0.38 lot 3 : bloc de vitesse (colonnes, ×, ÷) à partir du 7e kyū ; mini-tests longs en séries', async () => {
  const { hakariActif, partieDuJour, retardParties, calculsHakari } = await import('../src/core/hakari.js');
  const { testEnSeries, bilanSeries, verdictMiniTest, seriesValables } = await import('../src/core/minitest.js');
  const valides = (jusqua) => { const fin = sp(jusqua).ordre; return Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= fin).map((s) => [s.id, { valide: '2026-11-01', hist: [] }])); };
  const d = { paliers: valides('p7-4'), reglages: {}, motifs: {}, records: { 'epreuve-9': { reussi: true } }, sessions: [] };
  assert.equal(hakariActif(d), false);
  d.records['epreuve-8'] = { reussi: true };
  assert.equal(hakariActif(d), true);
  // Rien de mesuré : la première partie sans mesure ; le 3e jour pratiqué, la rotation.
  assert.ok(['colonnes', 'mul', 'div'].includes(partieDuJour(d, '2026-11-20').partie));
  const jours = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, module: 'planches', total: 1 }));
  assert.equal(partieDuJour({ ...d, sessions: jours(2) }, '2026-11-20').raison, 'rotation');
  assert.equal(partieDuJour({ ...d, sessions: jours(3) }, '2026-11-20').raison, 'retard');
  // × mesuré très lent : c'est lui, le plus en retard.
  const lent = { ...d, motifs: Object.fromEntries(['+1:petit', '+2:petit', '+3:petit', '+4:petit', '+5:grand'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.5 })) }])),
    sessions: [1, 2].flatMap((i) => [{ date: `2026-11-0${i}`, module: 'muldiv', mode: 'mul', reglages: { format: 'kyu' }, t: 30 }, { date: `2026-11-0${i}`, module: 'muldiv', mode: 'div', reglages: { format: 'kyu' }, t: 0.5 }]) };
  assert.equal(retardParties(lent)[0].partie, 'mul');
  assert.ok(calculsHakari(lent, 'mul', 8, 3) >= 5);
  // Séries : p8-1 (30 min au seuil) en 3 séries de 5 ; pas une leçon courte.
  assert.equal(testEnSeries(sp('p8-1')), true);
  assert.equal(testEnSeries(sp('p3-1')), false);
  const series = [{ justes: 5, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1, 1] }, { justes: 4, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1] }, { justes: 5, total: 5, dureeMs: 1000, tempsJustes: [1, 1, 1, 1, 1] }];
  assert.equal(verdictMiniTest(sp('p8-1'), bilanSeries(series)).reussi, true);
  assert.equal(verdictMiniTest(sp('p8-1'), bilanSeries(series.map((x) => ({ ...x, tempsJustes: x.tempsJustes.map(() => 9) })))).reussi, false);
  assert.equal(seriesValables({ testSeries: { debut: '2026-11-18', series } }, '2026-11-19', '2026-11-18').length, 3);
  assert.equal(seriesValables({ testSeries: { debut: '2026-11-17', series } }, '2026-11-19', '2026-11-18').length, 0);
});

test('0.38 lot 4 : marches d\'allure, 2 réussites sur 2 jours, feuille courte au format, projections', async () => {
  const { marchesGrade, apresFeuilleMarche, feuilleMarche, dateProjetee, scoreProjete, etatMarches, NB_MARCHES } = await import('../src/core/marches.js');
  const { allureGrade } = await import('../src/core/allure.js');
  const { GRADES_KYU } = await import('../src/core/epreuves.js');
  const g1 = GRADES_KYU.at(-1);
  const m = marchesGrade(g1);
  assert.equal(m.length, NB_MARCHES);
  for (let i = 1; i < m.length; i++) assert.ok(m[i].parChiffre < m[i - 1].parChiffre && m[i].parProduit < m[i - 1].parProduit);
  assert.ok(Math.abs(m.at(-1).parChiffre - 0.9 * allureGrade(g1).parChiffre) < 1e-9, 'dernière marche : allure d\'examen avec 10 % de marge');
  avecGraine(3, () => {
    const f = feuilleMarche(g1, m[0]);
    assert.ok(f.minutes >= 3 && f.minutes <= 7, `${f.minutes}`);
    assert.deepEqual(f.sections.map((s) => s.cle), ['mitori', 'mul', 'div']);
    const fr = feuilleMarche(g1, m[0], 90, 'mul');
    assert.equal(fr.sections.length, 1);
    assert.ok(fr.minutes <= 1.6);
  });
  let e = apresFeuilleMarche(undefined, '2026-11-18', true);
  e = apresFeuilleMarche(e, '2026-11-18', true); // même jour : ne compte pas
  assert.equal(e.validees, 0);
  e = apresFeuilleMarche(e, '2026-11-19', false);
  assert.equal(e.validees, 0);
  e = apresFeuilleMarche(e, '2026-11-20', true);
  assert.equal(e.validees, 1);
  assert.deepEqual(e.reussites, []);
  assert.equal(dateProjetee({ ...e, debut: '2026-11-10' }, '2026-11-20').joursParMarche, 10);
  assert.equal(dateProjetee({ validees: 0, debut: '2026-11-10' }, '2026-11-20'), null);
  assert.equal(scoreProjete(g1, { sessions: [], motifs: {}, paliers: {} }), null);
  // Du 10e au 7e kyū : pas de marches (l'allure d'examen est sous l'argent des leçons).
  assert.equal(etatMarches({ sessions: [], motifs: {}, paliers: {}, records: {}, reglages: {} }).utiles, false);
});

test('0.38 lot 5 : anzan guidé jusqu\'à 3 chiffres et 15 nombres ; entretien au format après le 1er kyū', async () => {
  const { MARCHES_ANZAN } = await import('../src/core/parcours.js');
  const { examenCompletHebdo } = await import('../src/core/examen.js');
  const { decisionDuJour } = await import('../src/core/prof.js');
  assert.deepEqual([MARCHES_ANZAN.at(-1).chiffres, MARCHES_ANZAN.at(-1).termes], [3, 15]);
  const tous = Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental).map((s) => [s.id, { valide: '2026-01-01', hist: [] }]));
  const records = Object.fromEntries(GRADES.filter((g) => !g.jun).map((g) => [`epreuve-${g.id}`, { reussi: true }]));
  const d = { paliers: tous, records, reglages: {}, motifs: {}, sessions: [] };
  const c = examenCompletHebdo(d, '2026-11-20');
  assert.equal(c.grade.id, 'd1'); // après le 1er kyū : l'examen de dan, vers le 初段
  assert.equal(c.dan, true);
  assert.equal(c.entretien, true);
  const dec = decisionDuJour(d, '2026-11-20', null);
  assert.equal(dec.aller[0], 'planches');
  assert.equal(dec.aller[1].chiffres, 10);
});

test('0.38 lot 6 : 10e kyū express, feuille de la semaine au format, porte « or » chiffrée', async () => {
  const { PREREQUIS, defiSemaine } = await import('../src/core/parcours.js');
  const { decisionDuJour } = await import('../src/core/prof.js');
  assert.ok(!PREREQUIS[10].some((id) => id.startsWith('p6')), '10e kyū : colonnes seules');
  assert.ok(PREREQUIS[9].includes('p6-1'), '9e kyū : il faut des ×');
  const valides = (jusqua) => { const fin = sp(jusqua).ordre; return Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= fin).map((s) => [s.id, { valide: '2026-11-01', hist: [] }])); };
  const d = { paliers: valides('p7-4'), reglages: {}, motifs: {}, sessions: [], records: { 'epreuve-10': { reussi: true }, 'epreuve-9': { reussi: true }, 'epreuve-8': { reussi: true } } };
  const f = defiSemaine(d, '2026-11-19');
  assert.match(f.description, /7e kyū/);
  assert.deepEqual(f.sections.map((x) => x.problemes.length), defiSemaine(d, '2026-11-20').sections.map((x) => x.problemes.length));
  assert.deepEqual(JSON.stringify(f.sections), JSON.stringify(defiSemaine(d, '2026-11-20').sections), 'même feuille toute la semaine');
  // Porte « or » de fin d'étape : le détail dit où l'on en est.
  const fin = { paliers: valides('p2-7'), reglages: {}, motifs: {}, records: {}, sessions: [] };
  for (const id of Object.keys(fin.paliers)) fin.paliers[id].hist = Array.from({ length: 10 }, () => ({ ok: 1, t: 2.8 }));
  const dec = decisionDuJour(fin, '2026-11-20', sp('p3-0'));
  if (dec.finEtape) assert.match(dec.detail, /leçons? sur \d+ en or/);
});

test('0.38 dan : barème Nisshō, sujet au format, palier tenu dans les trois épreuves', async () => {
  const { NIVEAUX_DAN, gradeDan, niveauAtteint, prochainDan, meilleurDan } = await import('../src/core/dan.js');
  assert.equal(NIVEAUX_DAN.length, 16);
  assert.deepEqual(NIVEAUX_DAN.map((x) => x.points), [90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 240, 260, 290]);
  avecGraine(12, () => {
    const s = genererSujet(gradeDan(NIVEAUX_DAN[1]));
    assert.deepEqual(s.sections.map((x) => [x.cle, x.problemes.length, x.minutes, x.points * x.problemes.length]), [['mul', 60, 10, 300], ['div', 60, 10, 300], ['mitori', 30, 10, 300]]);
    const chiffres = (x) => String(Math.abs(x)).replace('.', '').length;
    for (const p of s.sections[0].problemes) assert.equal(p.virgules ? String(p.entiers[0]).length + String(p.entiers[1]).length : chiffres(p.a) + chiffres(p.b), 11);
    for (const p of s.sections[1].problemes) if (!p.virgules) assert.equal(chiffres(p.b) + chiffres(p.resultat), 10);
    const types = s.sections[0].problemes.map((p) => (!p.virgules ? 'entier' : p.decimales === 0 ? 'montant' : 'decimal'));
    for (const t of ['entier', 'decimal', 'montant']) assert.ok(types.includes(t), t);
    const m = s.sections[2].problemes;
    for (const p of m) { assert.equal(p.lignes.length, 10); assert.equal(p.lignes.reduce((t, l) => t + String(l.n).length, 0), 85); }
    assert.equal(m.filter((p) => p.resultat < 0).length, 3);
  });
  // Pas de compensation : le palier est celui de la plus faible épreuve.
  assert.equal(niveauAtteint([300, 300, 95]).id, 'jd1');
  assert.equal(niveauAtteint([150, 125, 300]).id, 'd2');
  assert.equal(niveauAtteint([290, 295, 290]).id, 'd10');
  assert.equal(niveauAtteint([80, 300, 300]), null);
  assert.equal(prochainDan({ records: {} }).id, 'd1');
  const d = { records: { 'dan-nissho': { points: 3, niveau: 'jd2' } } };
  assert.equal(meilleurDan(d).id, 'jd2');
  assert.equal(prochainDan(d).id, 'd2');
});

test('0.38 : projection Zenkoren épreuve par épreuve ; marches vers le dan après le 1er kyū', async () => {
  const { scoreProjete, etatMarches } = await import('../src/core/marches.js');
  const { GRADES_ZENKOREN } = await import('../src/core/epreuves.js');
  const g = GRADES_ZENKOREN.find((x) => x.id === '4');
  const motifs = Object.fromEntries(['+3:petit', '+4:petit', '-2:petit', '+9:grand', '-7:grand', '+6:mixte'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.3 })) }]));
  // Colonnes très rapides, × ÷ très lents : un total « moyen » ne doit pas masquer l'échec.
  const paliers = Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && (s.type === 'mul' || s.type === 'div')).slice(0, 3).map((s) => [s.id, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 20 })) }]));
  const s = scoreProjete(g, { motifs, paliers, sessions: [] });
  assert.ok(s.epreuves.length >= 3);
  assert.equal(s.reussi, false);
  assert.ok(s.epreuves.find((x) => x.cle === 'mitori').ok);
  assert.ok(['mul', 'div'].includes(s.faible.cle));
  // Après le 1er kyū : les marches visent le 初段.
  const records = Object.fromEntries(GRADES.filter((x) => !x.jun).map((x) => [`epreuve-${x.id}`, { reussi: true }]));
  const e = etatMarches({ records, paliers: {}, motifs: {}, sessions: [], reglages: {} });
  assert.equal(e.dan, true);
  assert.equal(e.grade.japonais, '初段');
  assert.equal(e.active, true);
});

test('0.38.2 : mini-test planifié en entier ; pa-5 sur ses 34 amis ; délai à votre rythme ; défaut 25 min', async () => {
  const { planObjectif } = await import('../src/core/parcours.js');
  const { dureePlanche } = await import('../src/core/propositions.js');
  avecGraine(20, () => {
    // p5-5 : le plan de 20 calculs, découpé en 4 séries, pose les 54 gestes.
    const p55 = sp('p5-5');
    const flux = fluxEquilibre(p55, 20, () => ({}));
    const plan = Array.from({ length: 20 }, () => flux());
    const vus = new Set(plan.flatMap((ex) => ex.motifs));
    assert.deepEqual(p55.cibles.filter((c) => !vus.has(c)), []);
    // pa-5 : 15 chaînes à 1 chiffre couvrent ses amis.
    const pa5 = sp('pa-5');
    assert.equal(pa5.cibles.length, 34);
    const f = fluxEquilibre(pa5, 15, () => ({}));
    const g = new Set(Array.from({ length: 15 }, () => f().gestesAnzan).flat());
    assert.deepEqual(pa5.cibles.filter((c) => !g.has(c)), []);
  });
  // Délai : 4 leçons par semaine et la vitesse déjà là → les leçons décident.
  const date = '2026-11-20';
  const recent = SOUS_PALIERS.filter((s) => !s.mental).slice(0, 16);
  const paliers = Object.fromEntries(recent.map((s) => [s.id, { valide: '2026-11-10', hist: [] }]));
  const motifs = Object.fromEntries(['+3:petit', '+4:petit', '-2:petit', '+9:grand', '-7:grand'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.4 })) }]));
  const lent = Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.type === 'mul').slice(0, 2).map((s) => [s.id, { valide: '2026-10-01', hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.5 })) }]));
  const p = planObjectif({ paliers: { ...paliers, ...lent }, motifs, records: {}, reglages: {}, sessions: [] }, '6', '2027-07-12', date);
  assert.equal(p.base, 'rythme');
  assert.ok(Math.abs(p.rythme - 4) < 0.01, `${p.rythme}`);
  assert.ok(Math.abs(p.moisRestants - p.manquantes / 4 / 4.33) < 0.01);
  assert.equal(dureePlanche({ reglages: {} }), 6); // 25 min par défaut (avant : 15)
});

test('0.38.3 : semaines tenues (5 jours sur 7), feuille de la semaine proposée chaque jour', async () => {
  const { semainesTenues } = await import('../src/core/regularite.js');
  const { feuilleSemaine } = await import('../src/core/propositions.js');
  // Semaines du lundi 2 au dimanche 15 novembre : 5 jours puis 6 jours ; ce vendredi 20 : 3 jours.
  const dates = ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-18', '2026-11-20'];
  const t = semainesTenues(dates, '2026-11-20');
  assert.equal(t.semaines, 2);
  assert.equal(t.cetteSemaine, 3);
  assert.equal(t.encorePossible, true);
  // Une semaine à 4 jours casse la suite.
  assert.equal(semainesTenues(dates.filter((x) => x !== '2026-11-05'), '2026-11-20').semaines, 1);
  const d = { paliers: { 'p1-3': { valide: '2026-11-01' } }, records: {}, reglages: {}, motifs: {}, sessions: [] };
  assert.equal(feuilleSemaine(d, '2026-11-20').titre, 'Feuille de la semaine');
  d.sessions.push({ date: '2026-11-20', module: 'defis', mode: 'semaine', total: 10, justes: 10 });
  assert.equal(feuilleSemaine(d, '2026-11-20'), null);
  // 0.40.17 : déjà tentée cette semaine : pas le lendemain d'un essai, un jour sur deux.
  assert.equal(feuilleSemaine(d, '2026-11-21'), null);
  assert.ok(feuilleSemaine(d, '2026-11-22'));
});

test('0.38.3 : dan Zenkoren (6 matières, plus basse note, meilleur sur 3 sessions) et dan d\'anzan Zenkoren', async () => {
  const z = await import('../src/core/danZenkoren.js');
  assert.deepEqual(z.NIVEAUX_DAN_ZENKOREN.map((x) => x.points), [80, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 240, 260, 280]);
  assert.deepEqual(z.NIVEAUX_ANZAN_DAN_ZENKOREN.map((x) => x.points), [70, 80, 90, 100, 110, 120, 130, 140, 150, 170, 190]);
  avecGraine(33, () => {
    const s = genererSujet(z.gradeDanZenkoren(z.NIVEAUX_DAN_ZENKOREN[1]));
    assert.deepEqual(s.sections.map((x) => [x.cle, x.problemes.length, x.minutes, x.points]), [['mul', 30, 7, 10], ['div', 30, 7, 10], ['mitori', 30, 7, 10], ['denpyo', 30, 7, 10], ['anzan', 30, 3, 10]]);
    const dp = s.sections[3];
    assert.equal(dp.liasse.length, 20);
    for (const p of dp.problemes) {
      const attendu = dp.liasse.slice(p.denpyo.debut - 1, p.denpyo.fin).reduce((t, b) => t + b[p.denpyo.ligne - 1], 0);
      assert.equal(p.resultat, attendu);
    }
    for (const p of s.sections[2].problemes) assert.equal(p.lignes.length, 10);
    assert.ok(s.sections[4].problemes.every((p) => p.mental));
    const a = z.genererSujetAnzanDanZenkoren({ id: 'x' });
    assert.deepEqual(a.sections.map((x) => [x.problemes.length, x.minutes, x.points]), [[40, 3, 5], [40, 3, 5], [40, 3, 5]]);
    assert.ok(a.sections[0].problemes.some((p) => p.virgules || String(p.resultat).includes('.')), 'des décimaux');
  });
  // La plus basse matière fixe le dan ; le meilleur de chaque matière sur 3 sessions est gardé.
  assert.equal(z.niveauAtteintZenkoren([300, 300, 300, 300, 85]).id, 'jd1');
  const sessions = [
    { date: '1', scores: { mul: 90, div: 300 } }, // trop ancienne (4e en partant de la fin)
    { date: '2', scores: { mul: 120, div: 100, mitori: 150 } },
    { date: '3', scores: { mul: 100, div: 125, mitori: 130 } },
    { date: '4', scores: { mul: 110, div: 110, mitori: 125 } },
  ];
  const c = z.niveauCumule(sessions);
  assert.deepEqual(c.meilleurs, { mul: 120, div: 125, mitori: 150 });
  assert.equal(c.niveau.id, 'd2');
  assert.equal(z.niveauCumule([{ scores: { mul: 150, div: 150, mitori: 150 } }], z.NIVEAUX_ANZAN_DAN_ZENKOREN).niveau.id, 'ad8');
});

test('0.38.3 : formats des annales Zenkoren (×, ÷, mitori ; 暗算 par blocs)', async () => {
  const z = await import('../src/core/danZenkoren.js');
  const nb = (x) => String(Math.abs(x)).replace('.', '').replace(/^0+/, '').length;
  avecGraine(44, () => {
    const s = genererSujet(z.gradeDanZenkoren(z.NIVEAUX_DAN_ZENKOREN[1]));
    s.sections[0].problemes.forEach((p, i) => {
      const t = p.virgules ? String(p.entiers[0]).length + String(p.entiers[1]).length : nb(p.a) + nb(p.b);
      assert.equal(t, i < 15 ? 11 : 12, `× n° ${i + 1}`);
    });
    s.sections[2].problemes.forEach((p, i) => {
      const [min, max] = z.LONGUEURS_MITORI_DAN[Math.floor(i / 5)];
      if (p.resultat >= 0) for (const l of p.lignes) assert.ok(String(l.n).length >= min && String(l.n).length <= max, `mitori n° ${i + 1}`);
    });
    const a = z.genererSujetAnzanDanZenkoren({ id: 'x' });
    a.sections[0].problemes.forEach((p, i) => {
      if (p.virgules) return;
      const [m, n] = z.FORMES_MUL_ANZAN_DAN[z.blocAnzanDan(i)];
      assert.deepEqual([nb(p.a), nb(p.b)].sort(), [m, n].sort(), `× de tête n° ${i + 1}`);
    });
    a.sections[1].problemes.forEach((p, i) => { if (!p.virgules) assert.equal(nb(p.b) + nb(p.resultat), z.TOTAUX_DIV_ANZAN_DAN[z.blocAnzanDan(i)], `÷ de tête n° ${i + 1}`); });
    a.sections[2].problemes.forEach((p, i) => {
      assert.equal(p.lignes.some((l) => l.op === '-'), i >= 30, `mitori de tête n° ${i + 1} : soustractions sur les 10 derniers seulement`);
      if (i < 8) assert.ok(p.lignes.length === 5 && p.lignes.every((l) => String(l.n).length === 3));
    });
  });
});
