import test from 'node:test';
import assert from 'node:assert/strict';
import { examenDeLaSemaine, prekyuObtenu, PREKYU, kyuPasse, cleBlanc, prochainJalon } from '../src/core/examen.js';
import { SYSTEMES } from '../src/core/epreuves.js';
import { SOUS_PALIERS, sousPalier } from '../src/core/curriculum.js';
import { PREREQUIS, verificationVitesse, placementDuJour } from '../src/core/parcours.js';
import { exercicesBloc, MAX_ISOLES } from '../src/core/blocs.js';
import { planchesPossibles, plafonner, minutesPlanche, MINUTES_PLANCHE_MAX } from '../src/core/propositions.js';
import { bilanHebdo } from '../src/core/bilan.js';
import { frise } from '../src/modules/grades.js';

const h = (t, n = 30) => Array.from({ length: n }, () => ({ ok: 1, t }));
const valide = (ids, extra = {}) => ({ paliers: Object.fromEntries(ids.map((id) => [id, { valide: '2026-01-01' }])), records: {}, motifs: {}, sessions: [], reglages: {}, feuilles: [], ...extra });
const TOUT = SOUS_PALIERS.filter((sp) => !sp.mental).map((sp) => sp.id);

test('examen blanc : le grade le plus élevé dont les leçons sont validées, non encore réussi', () => {
  // Tout le parcours validé, aucun grade passé : on ne redescend pas au 11e kyū préparatoire.
  const d = valide(TOUT);
  const g = examenDeLaSemaine(d);
  assert.equal(g.officiel, '1');
  assert.match(g.nom, /1er kyū.*blanc/);
  // Leçons du 6e kyū validées (pas celles du 5e) : examen blanc du 6e kyū.
  const d6 = valide(PREREQUIS[6]);
  assert.equal(examenDeLaSemaine(d6).officiel, '6');
  // Réussi (en blanc) : tous les grades d'en dessous suivent par équivalence, on passe à l'entretien.
  d6.records[cleBlanc(SYSTEMES.nissho, '6')] = { reussi: true, points: 20 };
  assert.equal(examenDeLaSemaine(d6).id, 'hebdo');
  assert.ok(PREKYU.every((x) => prekyuObtenu(d6, x)));
  const g8 = SYSTEMES.nissho.grades.find((x) => x.id === '8');
  assert.ok(kyuPasse(d6, SYSTEMES.nissho, g8));
  assert.ok(!kyuPasse(d6, SYSTEMES.nissho, SYSTEMES.nissho.grades.find((x) => x.id === '5')));
  // Un kyū officiel réussi en épreuve vaut aussi les grades officiels inférieurs sur la frise.
  const d7 = valide(PREREQUIS[7], { records: { 'epreuve-7': { reussi: true, points: 200 } } });
  const marches = frise(d7);
  assert.ok(marches.filter((m) => ['o10', 'o9', 'o8', 'o7', 'p20', 'p11'].includes(m.id)).every((m) => m.obtenu));
  assert.ok(!marches.find((m) => m.id === 'o6').obtenu);
  // Un grade préparatoire réussi vaut ceux d'en dessous, pas ceux d'au-dessus.
  const dp = valide(['p1-1', 'p1-2', 'p1-3', 'p1-4'], { records: { 'prekyu-19': { reussi: true } } });
  assert.ok(prekyuObtenu(dp, PREKYU[0]) && prekyuObtenu(dp, PREKYU[1]) && !prekyuObtenu(dp, PREKYU[2]));
});

test('prochain grade : le suivant seulement, avec les leçons qui manquent', () => {
  const d = valide(['p1-1', 'p1-2', 'p1-3'], { records: { 'prekyu-20': { reussi: true } } });
  const j = prochainJalon(d, '2026-01-10');
  assert.equal(j.nom, '19e kyū prép.');
  assert.equal(j.restantes, 1);
  assert.equal(j.palier, 'p1');
  assert.equal(j.dernier.court, '20e');
  assert.equal(prochainJalon(valide(TOUT, { records: { 'epreuve-1': { reussi: true } } }), '2026-01-10'), null);
});

test('vérification de vitesse : pas d\'alerte à vitesse égale (marge de 10 %)', () => {
  const ids = ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2', 'p2-3', 'p2-4'];
  const motifs = (tDirect, tPetit) => Object.fromEntries([...['+1', '+2', '-1', '-2'].map((g) => [`${g}:direct`, { hist: h(tDirect) }]), ...['+4', '+3', '-4'].map((g) => [`${g}:petit`, { hist: h(tPetit) }])]);
  assert.equal(verificationVitesse(valide(ids, { motifs: motifs(1.2, 1.2) })), null);
  assert.equal(verificationVitesse(valide(ids, { motifs: motifs(1.25, 1.2) })), null);
  assert.ok(verificationVitesse(valide(ids, { motifs: motifs(1.6, 1.2) })));
});

test('planches proposées : jamais plus de 10 minutes, même à 6 chiffres', () => {
  const d = valide(TOUT, { motifs: { '+4:petit': { hist: h(2.6) } } });
  const p = planchesPossibles(d, [], '2026-11-11');
  assert.ok(p.length >= 3);
  for (const x of p) assert.ok(x.minutes <= MINUTES_PLANCHE_MAX && x.colonnes >= 4 && x.lignes >= 4, `${x.id} ${x.minutes} min`);
  const q = plafonner(d, { colonnes: 10, lignes: 10, chiffres: 6 });
  assert.ok(minutesPlanche(d, q) <= MINUTES_PLANCHE_MAX);
});

test('bloc : deux exercices au plus sur le geste seul, le suivant est mélangé ; débutant servi aussi', () => {
  const ids = ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2'];
  const d = valide(ids, { sessions: [{ date: '2026-11-10', module: 'lecons', total: 10, justes: 10 }], motifs: { '+4:petit': { hist: h(1.2) }, '+3:petit': { hist: h(2.6) } } });
  const genres = ['volume-isole', 'vitesse-isole', 'volume-melange', 'vitesse-melange'];
  const b = exercicesBloc(d, '2026-11-11', { genres, cibles: ['+4:petit', '+3:petit'], minutes: 25 });
  assert.equal(b.filter((x) => x.genre.endsWith('-isole')).length, MAX_ISOLES);
  assert.ok(b.filter((x) => x.genre.endsWith('-melange')).length >= 2);
  // Un exercice isolé déjà pris par le bloc « automatiser » compte dans la limite.
  const c = exercicesBloc(d, '2026-11-11', { genres, cibles: ['+4:petit', '+3:petit'], minutes: 25, isolesDeja: 1, exclure: [b[0].id] });
  assert.equal(c.filter((x) => x.genre.endsWith('-isole')).length, 1);
  // Débutant (gestes directs, planches pas encore ouvertes) : le bloc n'est pas vide, isolé ET mélangé.
  const deb = valide(['p1-1', 'p1-2'], { sessions: [{ date: '2026-11-10', module: 'lecons', total: 10, justes: 10 }] });
  const e = exercicesBloc(deb, '2026-11-11', { genres, cibles: sousPalier('p1-2').cibles, minutes: 10 });
  assert.ok(e.length >= 2 && e.some((x) => x.genre.endsWith('-melange')), e.map((x) => x.id).join());
  assert.ok(e.every((x) => x.aller[0] === 'rythme'));
});

test('placement réflexe : s\'éteint une fois le parcours terminé', () => {
  const d = valide(TOUT);
  assert.equal(placementDuJour(d, '2026-11-10', null), null);
  assert.equal(placementDuJour(valide(['p6-a', 'p6-0']), '2026-11-10', sousPalier('p6-1')).id, 'p6-0');
});

test('bilan hebdomadaire : pratique, gestes passés en or, leçons validées', () => {
  const d = valide(['p1-1'], {
    sessions: [
      { date: '2026-11-09', total: 20, justes: 18, dureeMs: 600000 }, { date: '2026-11-11', total: 10, justes: 10, dureeMs: 300000 },
      { date: '2026-11-01', total: 10, justes: 5, dureeMs: 1200000 },
    ],
    motifs: {
      '+4:petit': { hist: h(1.2), sem: { '2026-11-09': [1.2, 1.2, 1.2, 1.2, 1.2] } }, // en or, mesuré cette semaine seulement
      '+3:petit': { hist: h(1.2), sem: { '2026-10-05': [1.1, 1.1, 1.1, 1.1, 1.1], '2026-11-09': [1.2] } }, // déjà en or avant
      '+2:petit': { hist: h(2.5), sem: { '2026-11-09': [2.5] } }, // en argent
    },
  });
  d.paliers['p1-2'] = { valide: '2026-11-10' };
  const b = bilanHebdo(d, '2026-11-12', [{ nom: '+1 (petit ami)' }]);
  assert.deepEqual([b.semaine.jours, b.semaine.minutes, b.semaine.exercices, b.semaine.justes], [2, 15, 30, 28]);
  assert.equal(b.precedente.minutes, 20);
  assert.equal(b.enOr.length, 1);
  assert.equal(b.validees.length, 1);
  assert.deepEqual(b.stagne, ['+1 (petit ami)']);
});

test('0.33 : un kyū réussi valide ses leçons ; le test de niveau part du niveau déclaré', async () => {
  const { leconsParEquivalence } = await import('../src/core/examen.js');
  const { suiteTest, PALIERS_TEST, colonneTest } = await import('../src/core/positionnement.js');
  // 7e kyū réussi en épreuve, aucune leçon validée : toutes les leçons du 7e kyū (et la prise en main).
  const ids = leconsParEquivalence(valide([], { records: { 'epreuve-7': { reussi: true } } }));
  assert.ok(PREREQUIS[7].every((id) => ids.includes(id)) && ids.includes('p0-1') && !ids.includes('p6-4'));
  assert.deepEqual(leconsParEquivalence(valide(ids, { records: { 'epreuve-7': { reussi: true } } })), []);
  assert.deepEqual(leconsParEquivalence(valide([])), []);
  // Le test : réussi, on monte ; raté, on redescend ; on ne remonte pas vers un palier déjà raté.
  assert.deepEqual(suiteTest(2, true), { suivant: 3, valides: 3 });
  assert.deepEqual(suiteTest(2, false), { suivant: 1, valides: 0 });
  assert.deepEqual(suiteTest(1, true, { rate: 2 }), { suivant: null, valides: 2 });
  assert.deepEqual(suiteTest(0, false), { suivant: null, valides: 0 });
  assert.deepEqual(suiteTest(PALIERS_TEST.length - 1, true), { suivant: null, valides: PALIERS_TEST.length });
  for (const p of PALIERS_TEST) assert.ok(colonneTest(p).resultat !== undefined);
});

test('0.33 : défi de la semaine jusqu\'à 6 chiffres, 3 × 2 et division par 2 chiffres ; placement éteint en Expert', async () => {
  const { defiSemaine } = await import('../src/core/parcours.js');
  const d = valide(TOUT);
  const defi = defiSemaine(d, '2026-11-16');
  assert.match(defi.description, /^[56] chiffres.*3 × 2.*par 2 chiffres/);
  const mul = defi.sections.find((x) => x.titre === 'Multiplications').problemes[0];
  assert.ok(String(mul.a).length === 3 && String(mul.b).length === 2, `${mul.a} × ${mul.b}`);
  assert.match(defiSemaine(valide(['p1-1', 'p1-2', 'p1-3']), '2026-11-16').description, /^1 chiffre/);
  const p = valide(['p6-a', 'p6-0']);
  p.paliers['p6-0'].hist = h(0.5, 30);
  assert.equal(placementDuJour(p, '2026-11-10', sousPalier('p6-1')), null);
});
