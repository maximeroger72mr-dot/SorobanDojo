import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { avecGraine } from '../src/core/hasard.js';

// Samedi 21 novembre 2026 : 2e jour du créneau d'examen (vendredi au dimanche).
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-21T10:00:00').getTime() });
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };

const p = await import('../src/core/progression.js');
await p.chargerProgression();
const { SOUS_PALIERS, genererExercice } = await import('../src/core/curriculum.js');
const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const valides = (jusqua) => { const fin = sp(jusqua).ordre; return Object.fromEntries(SOUS_PALIERS.filter((s) => !s.mental && s.ordre <= fin).map((s) => [s.id, { valide: '2026-11-01', hist: [] }])); };

test('0.39 lot 1 : p4-4, premier nombre à 3 chiffres, assez grand pour toutes les soustractions', () => {
  avecGraine(39, () => {
    for (let i = 0; i < 200; i++) {
      const ex = genererExercice(sp('p4-4'));
      assert.equal(String(ex.lignes[0].n).length, 3, JSON.stringify(ex.lignes));
      let v = 0;
      for (const l of ex.lignes) { v += l.op === '+' ? l.n : -l.n; assert.ok(v > 0); }
    }
  });
});

test('0.39 lot 1 : × et ÷ absorbés (micro-marches, petits formats) ; ordre des révisions par fragilité', async () => {
  const { ordreRevisions, REVISIONS_SEANCE_MAX } = await import('../src/core/revision.js');
  const solide = { valide: '2026-10-01', carte: { boite: 3, echeance: '2026-12-01' } };
  const d = { paliers: { 'p6-1': { ...solide }, 'p6-1a': { ...solide }, 'p6-3': { ...solide }, 'p8-4': { ...solide }, 'p8-5': { ...solide } } };
  assert.equal(p.absorbee(d, 'p6-1a'), true, 'micro-marche : sa leçon complète est validée');
  assert.equal(p.absorbee(d, 'p6-1'), true, '2 × 1 : 2 × 2 est solide');
  assert.equal(p.absorbee(d, 'p6-3'), true, '2 × 2 : 7 chiffres au total est solide');
  assert.equal(p.absorbee(d, 'p8-4'), false, 'les zéros gardent leur révision');
  assert.equal(p.absorbee(d, 'p8-5'), false, 'rien de plus grand de solide');
  assert.equal(p.absorbee({ paliers: { 'p6-1': solide, 'p6-3': { valide: '2026-10-01', carte: { boite: 1 } } } }, 'p6-1'), false, 'plus grand pas encore solide');
  const etats = { a: { carte: { boite: 2, echeance: '2026-11-01' } }, b: { carte: { boite: 1, echeance: '2026-11-10' } }, c: { fluidite: true, carte: { boite: 4, echeance: '2026-11-15' } }, e: { carte: { boite: 1, echeance: '2026-11-02' } } };
  assert.deepEqual(['a', 'b', 'c', 'e'].sort(ordreRevisions((id) => etats[id])), ['c', 'e', 'b', 'a']);
  assert.equal(REVISIONS_SEANCE_MAX, 3);
});

test('0.39 lot 1 : mesures sur de vraies feuilles (format, 70 %, entraînement / examen)', async () => {
  const { mesuresFeuille, ajouterMesures, ratioExamen, mesuresAuFormat, couvre } = await import('../src/core/mesures.js');
  const col = (n) => ({ type: 'addsub', lignes: Array.from({ length: 10 }, (_, i) => ({ op: '+', n: 100 + i })), resultat: n });
  const res = (ok, ex) => ({ ex, juste: ok, reponse: 1 });
  const b = { dureeMs: 10 * (30 * 2 + 3) * 1000, resultats: Array.from({ length: 10 }, () => res(true, col(1))) };
  const [m] = mesuresFeuille(b, { source: 'entrainement', date: '2026-11-21' });
  assert.equal(m.partie, 'colonnes');
  assert.equal(m.format, '10x3');
  assert.ok(Math.abs(m.t - 2) < 1e-9);
  assert.equal(couvre('10x3', { lignes: 10, chiffres: 3 }), true);
  assert.equal(couvre('5x3', { lignes: 10, chiffres: 3 }), false);
  // Moins de 70 % de justes : pas une mesure.
  assert.deepEqual(mesuresFeuille({ ...b, resultats: b.resultats.map((r, i) => ({ ...r, juste: i < 6 })) }, { source: 'entrainement', date: '2026-11-21' }), []);
  // De l'anzan dans la feuille : sa durée mêle autre chose.
  assert.deepEqual(mesuresFeuille({ ...b, resultats: [...b.resultats, res(true, { type: 'mul', a: 12, b: 3, resultat: 36, mental: true })] }, { source: 'examen', date: '2026-11-21' }), []);
  // Feuille mêlée sous examen, avec un grade : un ratio à l'allure du grade.
  const mul = { type: 'mul', a: 123, b: 45, resultat: 5535 };
  const g = { systeme: 'nissho', id: '6' };
  const [mx] = mesuresFeuille({ dureeMs: 2 * (10 * 3 * 2 + 3 + 6 * 4 + 3) * 1000, resultats: [res(true, col(1)), res(true, mul)] }, { source: 'examen', date: '2026-11-20', grade: g, allure: { parChiffre: 2, parProduit: 4 } });
  assert.equal(mx.partie, 'mixte');
  assert.ok(Math.abs(mx.ratio - 2) < 1e-9);
  const d = { mesures: ajouterMesures([], [m, mx]) };
  assert.equal(ratioExamen(d, 'nissho:6', '2026-11-21').ratio, 2);
  assert.equal(ratioExamen(d, 'nissho:6', '2026-12-31'), null, 'plus de 3 semaines : plus valable');
  assert.equal(mesuresAuFormat(d, 'colonnes', { lignes: 10, chiffres: 3 }).length, 1);
});

test('0.39 lot 1 : vitesse au format du grade partout (allure, hakari, score projeté)', async () => {
  const { vitesseEleve } = await import('../src/core/allure.js');
  const { retardParties } = await import('../src/core/hakari.js');
  const { scoreProjete } = await import('../src/core/marches.js');
  const { GRADES_KYU } = await import('../src/core/epreuves.js');
  const g6 = GRADES_KYU.find((g) => g.id === '6');
  const motifs = Object.fromEntries(['+1:direct', '+2:direct', '+3:petit', '+4:petit', '+6:grand'].map((c) => [c, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 0.3 })) }]));
  const d = { paliers: valides('p7-4'), motifs, records: { 'epreuve-8': { reussi: true }, 'epreuve-7': { reussi: true } }, reglages: {}, sessions: [], mesures: [] };
  const sans = vitesseEleve(d, g6);
  assert.equal(sans.colonnesAuFormat, false);
  assert.equal(retardParties(d).find((x) => x.partie === 'colonnes').aConfirmer, true);
  d.mesures.push({ date: '2026-11-20', source: 'entrainement', partie: 'colonnes', format: '10x3', t: 2.5, n: 300, reussite: 1 });
  d.mesures.push({ date: '2026-11-20', source: 'entrainement', partie: 'mul', format: 'mul:5', t: 5, n: 60, reussite: 1, kyu: true });
  const avec = vitesseEleve(d, g6);
  assert.equal(avec.parChiffre, 2.5);
  assert.equal(avec.parProduit, 5);
  assert.equal(avec.colonnesAuFormat, true);
  assert.equal(avec.produitsAuFormat, true);
  const col = retardParties(d).find((x) => x.partie === 'colonnes');
  assert.equal(col.eleve, 2.5);
  assert.equal(col.aConfirmer, false);
  const s = scoreProjete(g6, d);
  assert.ok(s && !s.aConfirmer);
});

test('0.39 lot 1 : gain par semaine lissé et borné ; « en plateau » au-delà de 3 semaines sans gain', async () => {
  const { gainHebdo, semainesRatios } = await import('../src/core/mesures.js');
  const { planObjectif } = await import('../src/core/parcours.js');
  assert.equal(gainHebdo([]).gain, 0.02);
  const semaine = (k) => { const x = new Date('2026-11-16T12:00'); x.setDate(x.getDate() - 7 * k); return x.toISOString().slice(0, 10); };
  const progres = Array.from({ length: 8 }, (_, k) => ({ date: semaine(7 - k), ratio: 1.5 * 0.97 ** k }));
  const g = gainHebdo(semainesRatios(progres, '2026-11-21'));
  assert.ok(Math.abs(g.reel - 0.03) < 0.002, `${g.reel}`);
  assert.ok(Math.abs(g.gain - 0.03) < 0.002, 'plein poids à 8 semaines');
  assert.equal(g.plateau, false);
  const rapide = gainHebdo(semainesRatios(Array.from({ length: 4 }, (_, k) => ({ date: semaine(3 - k), ratio: 2 * 0.8 ** k })), '2026-11-21'));
  assert.ok(rapide.gain <= 0.02 * 0.5 + 0.04 * 0.5 + 1e-9, 'borné à 4 %, et mêlé au repère à 4 semaines');
  const plat = gainHebdo(semainesRatios(Array.from({ length: 6 }, (_, k) => ({ date: semaine(5 - k), ratio: k < 2 ? 1.6 - 0.1 * k : 1.5 })), '2026-11-21'));
  assert.equal(plat.plateau, true);
  // Objectif : vitesse en plateau → pas de date pour la vitesse.
  const d = { paliers: valides('p4-2'), motifs: {}, records: {}, reglages: {}, sessions: [],
    mesures: Array.from({ length: 6 }, (_, k) => ({ date: semaine(5 - k), source: 'entrainement', partie: 'colonnes', format: '10x3', t: 6, n: 300, reussite: 1 })) };
  const po = planObjectif(d, '6', '2027-09-01', '2026-11-21');
  assert.equal(po.plateauVitesse, true);
  // Un examen de ce grade il y a 4 jours : la vitesse sous examen prime.
  d.mesures.push({ date: '2026-11-17', source: 'examen', partie: 'mixte', format: 'grade', grade: 'nissho:6', ratio: 1.3, n: 400, reussite: 0.9 });
  const pe = planObjectif(d, '6', '2027-09-01', '2026-11-21');
  assert.equal(pe.sourceVitesse, 'examen');
  assert.equal(pe.ecartVitesse, 1.3);
});

test('0.39 lot 1 : temps hebdomadaires gardés par format ; plateau à format identique', async () => {
  const { ajouterSemaine, plateauFiche, semDominante } = await import('../src/core/maitrise.js');
  const f = {};
  const jours = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'];
  for (const j of jours) for (let i = 0; i < 12; i++) { ajouterSemaine(f, 1, j, '10x3'); ajouterSemaine(f, 0.5 + (j === '2026-11-16' ? 0 : 0.3), j, '5x1'); }
  assert.deepEqual(Object.keys(f.semF), ['10x3', '5x1']);
  assert.equal(plateauFiche(f, '2026-11-21').format, '10x3', 'le 10x3 stagne, le 5x1 progresse');
  assert.equal(Object.keys(semDominante(f)).length, 4);
});

test('0.39 lot 1 : le socle ne remplace la leçon qu\'au premier jour du créneau, sinon « Pour compléter »', async () => {
  const { plan } = await import('../src/modules/seance.js');
  const { PREKYU } = await import('../src/core/examen.js');
  const d = p.progression();
  Object.assign(d.paliers, valides('p1-3'));
  d.reglages.objectifMinutes = 25;
  d.sessions.push({ date: '2026-11-20', horodatage: 0, module: 'lecons', total: 10, justes: 10, dureeMs: 60000 });
  const r = plan(d, Date.now());
  assert.ok(PREKYU.length);
  assert.ok(!r.essentiel.some((it) => it.examen), 'samedi : pas d\'examen dans l\'essentiel');
  assert.ok(r.essentiel.some((it) => it.decision), 'la leçon garde sa place');
  assert.match(r.bonus[0].titre, /socle/);
});

test('0.39 lot 2 : marches 1 et 2 dès 70 % des leçons, sur les seules parties validées', async () => {
  const { etatMarches, feuilleMarche, MARCHES_ANTICIPEES } = await import('../src/core/marches.js');
  const { PREREQUIS } = await import('../src/core/parcours.js');
  // 7e kyū réussi : on vise le 6e. Toutes ses leçons sauf les divisions.
  const req = PREREQUIS[6];
  const paliers = Object.fromEntries(req.filter((id) => sp(id).type !== 'div').map((id) => [id, { valide: '2026-11-01', hist: [] }]));
  const d = { paliers, records: { 'epreuve-7': { reussi: true } }, reglages: {}, sessions: [], motifs: {} };
  const part = Object.keys(paliers).length / req.length;
  const e = etatMarches(d);
  if (part >= 0.7) {
    assert.equal(e.anticipees, true);
    assert.deepEqual(e.parties, ['mitori', 'mul']);
    avecGraine(4, () => assert.ok(!feuilleMarche(e.grade, e.courante, undefined, null, e.parties).sections.some((s) => s.cle === 'div'), 'pas de division non apprise'));
    d.marches = { [`nissho-6`]: { validees: MARCHES_ANTICIPEES, reussites: [] } };
    const e2 = etatMarches(d);
    assert.equal(e2.courante, null, 'les marches 3 à 5 attendent la fin des leçons');
    assert.equal(e2.attente, true);
  } else assert.equal(e.anticipees, false);
  // Moins de 70 % : pas de marches.
  const peu = { ...d, paliers: Object.fromEntries(req.slice(0, Math.floor(req.length * 0.5)).map((id) => [id, { valide: '2026-11-01', hist: [] }])) };
  assert.equal(etatMarches(peu).active, false);
});

test('0.39 lot 2 : test flash, 9 justes ET 85 % de la vitesse habituelle, plafonné à la médaille', async () => {
  const { verdictFlash, leconsFluidite } = await import('../src/core/fluidite.js');
  const lecon = sp('p3-1');
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }], resultat: 7 };
  const hist = Array.from({ length: 20 }, () => ({ ok: 1, t: 1.0 }));
  const b = (t) => ({ justes: 10, total: 10, resultats: Array.from({ length: 10 }, () => ({ ex, juste: true, dureeMs: t * 2 * 1000 })) });
  const etat = { hist };
  assert.equal(verdictFlash(lecon, etat, { justes: 8, total: 10, resultats: [] }).reussi, false);
  const lent = verdictFlash(lecon, etat, b(3));
  assert.equal(lent.lent, true);
  assert.equal(verdictFlash(lecon, etat, b(1.1)).reussi, true);
  // Médaille bronze (pas de seuil de temps) : seule la justesse compte.
  assert.equal(verdictFlash(lecon, { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 9 })) }, b(30)).sansVitesse, true);
  // Juste mais lent : carte gardée, leçon marquée.
  p.progression().paliers['p3-1'] = { valide: '2026-11-01', hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 2 })), carte: { boite: 2, echeance: '2026-11-21' } }; // argent : pas encore l'or
  await p.enregistrerRevision('p3-1', false, { lent: true });
  const e = p.progression().paliers['p3-1'];
  assert.equal(e.carte.boite, 2);
  assert.equal(e.fluidite, '2026-11-21');
  assert.equal(leconsFluidite(p.progression())[0].id, 'p3-1');
  await p.enregistrerRevision('p3-1', true);
  assert.equal(p.progression().paliers['p3-1'].fluidite, undefined);
});

test('0.39 lot 2 : plateaux au-delà du platine sans marge ; × ÷ en plateau ; recul de 15 % à format égal', async () => {
  const { plateaux, plateauOperation, reculs, allureVisee } = await import('../src/core/parcours.js');
  const semaines = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'];
  // Geste platine (0,7 s par chiffre), qui stagne : plateau tant que l'allure visée n'a pas 10 % de marge.
  const hist = Array.from({ length: 30 }, () => ({ ok: 1, t: 0.7 }));
  const sem = Object.fromEntries(semaines.map((k) => [k, Array(12).fill(0.7)]));
  const d = { motifs: { '+6:grand': { hist, sem } }, paliers: valides('p9-6'), records: Object.fromEntries(['10', '9', '8', '7', '6', '5', '4', '3', '2'].map((id) => [`epreuve-${id}`, { reussi: true }])), reglages: {}, sessions: [] };
  const vise = allureVisee(d);
  assert.ok(vise.parChiffre * 0.9 < 0.7, `1er kyū : ${vise.parChiffre}`);
  assert.ok(plateaux(d, '2026-11-21').some((x) => x.cle === '+6:grand'), 'platine mais pas 10 % de marge sur le 1er kyū');
  // × en plateau : 2 feuilles par semaine, aucun gain.
  d.mesures = semaines.flatMap((k) => [0, 1].map(() => ({ date: k, source: 'entrainement', partie: 'mul', format: 'mul:9', t: 3, n: 80, reussite: 0.95, kyu: true })));
  const po = plateauOperation(d, 'mul', '2026-11-21');
  assert.ok(po && Math.abs(po.cible - 3 / 1.15) < 1e-9);
  // Recul : deux semaines consécutives 20 % plus lentes, au même format.
  const semF = { '10x3': { '2026-10-19': Array(12).fill(1), '2026-10-26': Array(12).fill(1.05), '2026-11-09': Array(12).fill(1.2), '2026-11-16': Array(12).fill(1.25) } };
  assert.equal(reculs({ motifs: { '+7:grand': { semF } } }, '2026-11-21')[0]?.cle, '+7:grand');
  // Pas consécutives : pas de recul.
  const trou = { '10x3': { ...semF['10x3'], '2026-11-09': undefined } };
  delete trou['10x3']['2026-11-09'];
  assert.equal(reculs({ motifs: { '+7:grand': { semF: trou } } }, '2026-11-21').length, 0);
});

test('0.39 lot 2 : feuille de la semaine d\'environ 7 minutes à l\'allure ; lièvre au format, +3 %', async () => {
  const { defiSemaine, MINUTES_FEUILLE_SEMAINE } = await import('../src/core/parcours.js');
  const { allureGrade } = await import('../src/core/allure.js');
  const { unites } = await import('../src/core/maitrise.js');
  const d = { paliers: valides('p8-8'), records: { 'epreuve-8': { reussi: true }, 'epreuve-7': { reussi: true } }, reglages: {}, sessions: [], motifs: {} };
  const f = defiSemaine(d, '2026-11-21');
  const a = allureGrade(f.grade);
  const t = f.sections.flatMap((s) => s.problemes).reduce((s, ex) => s + unites(ex) * (ex.type === 'addsub' ? a.parChiffre : a.parProduit) + 3, 0);
  assert.ok(t / 60 >= MINUTES_FEUILLE_SEMAINE - 2 && t / 60 <= MINUTES_FEUILLE_SEMAINE + 2, `${t / 60} min`);
  assert.ok(f.sections.some((s) => s.problemes[0].type === 'addsub') && f.sections.some((s) => s.problemes[0].type === 'mul'));
});

test('0.39 lot 3 : entretien, matières tournées séance par séance, une sur deux la plus en retard', async () => {
  const { matiereEntretien, matieresEntretien, maintienPur, activiteMaintien } = await import('../src/core/entretien.js');
  const { entretienDuJour } = await import('../src/core/prof.js');
  const jours = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, module: 'planches', total: 1 }));
  const tous = Object.fromEntries(['10', '9', '8', '7', '6', '5', '4', '3', '2'].map((id) => [`epreuve-${id}`, { reussi: true }]));
  const d = { paliers: valides('p9-6'), motifs: {}, records: tous, reglages: {}, sessions: [], mesures: [] };
  assert.deepEqual(matieresEntretien(d), ['colonnes', 'mul', 'div', 'anzan']);
  const vus = [0, 2, 4, 6].map((n) => matiereEntretien({ ...d, sessions: jours(n) }, '2026-11-21').matiere);
  assert.deepEqual(vus, ['colonnes', 'mul', 'div', 'anzan']);
  // Séance impaire : la plus en retard (× jamais mesuré = la plus loin).
  assert.equal(matiereEntretien({ ...d, sessions: jours(1) }, '2026-11-21').raison, 'retard');
  // Après le 1er kyū : colonnes au format des dan.
  const apres = { ...d, records: { ...tous, 'epreuve-1': { reussi: true } } };
  const e = entretienDuJour({ ...apres, sessions: jours(0) }, '2026-11-21');
  assert.equal(e.aller[1].genre, 'dan');
  assert.equal(maintienPur(apres), false, 'le dan reste à viser');
  // Maintien pur : sprints, rejeu, flash à tour de rôle dans la semaine.
  assert.deepEqual([0, 1, 2].map((k) => activiteMaintien({ sessions: Array.from({ length: k }, (_, i) => ({ date: `2026-11-${16 + i}` })), motifs: {}, paliers: {}, records: {}, reglages: {} }, '2026-11-21').activite), ['sprints', 'rejeu', 'flash']);
});

test('0.39 lot 3 : examen de la semaine en alternance (complet / 2 sprints) ; planche au format des dan', async () => {
  const { examenCompletHebdo } = await import('../src/core/examen.js');
  const { genererPlancheSpeciale } = await import('../src/core/planche.js');
  const d = { paliers: valides('p8-8'), motifs: {}, records: { 'epreuve-6': { reussi: true }, 'epreuve-7': { reussi: true } }, reglages: {}, sessions: [] };
  const a = examenCompletHebdo(d, '2026-11-20');
  const b = examenCompletHebdo(d, '2026-11-27');
  assert.deepEqual([a.format, b.format].sort(), ['long', 'sprints']);
  const sprints = a.format === 'sprints' ? a : b;
  const date = sprints === a ? '2026-11-20' : '2026-11-27';
  d.sessions.push({ date, module: 'epreuves', mode: `${sprints.mode}-sprints`, total: 30, justes: 25 });
  assert.ok(examenCompletHebdo(d, date).fait, 'les sprints faits valent l\'examen de la semaine');
  const p = genererPlancheSpeciale({ genre: 'dan', chiffres: 10, lignes: 10, colonnes: 10 }, 12345);
  for (const c of p.colonnes) {
    assert.equal(c.lignes.length, 10);
    assert.ok(c.lignes.every((l) => String(l.n).length >= 5 && String(l.n).length <= 10));
  }
});

test('0.39 lot 3 : contrôle tous les 90 jours (règles rares, 4 synthèses), sauté après une épreuve qui les contenait', async () => {
  const { controleDu, apresControle, aControler } = await import('../src/core/revision.js');
  const { formatCouvertParEpreuve } = await import('../src/core/progression.js');
  assert.ok(aControler(sp('pd-5')) && aControler(sp('p5-5')) && aControler(sp('p9-6')));
  assert.equal(aControler(sp('p3-1')), false);
  const carte = { boite: 5, echeance: '2026-07-01', acquise: '2026-08-01' };
  assert.equal(controleDu(sp('pd-5'), carte, '2026-11-21'), true, 'plus de 90 jours');
  assert.equal(controleDu(sp('pd-5'), carte, '2026-10-21'), false);
  assert.equal(controleDu(sp('p3-1'), carte, '2026-11-21'), false, 'leçon ordinaire : pas de contrôle');
  const avecEpreuve = formatCouvertParEpreuve({ sessions: [{ date: '2026-11-10', module: 'epreuves', reglages: { systeme: 'nissho', grade: '3' } }] }, '2026-11-21');
  assert.equal(controleDu(sp('pd-5'), carte, '2026-11-21', avecEpreuve), false, 'le 3e kyū contenait des arrondis');
  assert.equal(controleDu(sp('pn-1') ?? { id: 'x', type: 'negatif' }, carte, '2026-11-21', avecEpreuve), true, 'pas de négatif au 3e kyū');
  assert.equal(apresControle(carte, true, '2026-11-21').controle, '2026-11-21');
  assert.deepEqual(apresControle(carte, false, '2026-11-21'), { boite: 3, echeance: '2026-11-28' });
});
