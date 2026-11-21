import test from 'node:test';
import assert from 'node:assert/strict';
import { examenDeLaSemaine, prekyuObtenu, PREKYU, kyuPasse, cleBlanc, prochainJalon } from '../src/core/examen.js';
import { SYSTEMES } from '../src/core/epreuves.js';
import { SOUS_PALIERS, sousPalier } from '../src/core/curriculum.js';
import { PREREQUIS, verificationVitesse, placementDuJour } from '../src/core/parcours.js';
import { exercicesBloc, MAX_ISOLES, gesteExercice } from '../src/core/blocs.js';
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
  const b = exercicesBloc(d, '2026-11-11', { genres, cibles: ['+4:petit', '+3:petit'], minutes: 25, unParGeste: false });
  assert.equal(b.filter((x) => x.genre.endsWith('-isole')).length, MAX_ISOLES);
  assert.ok(b.filter((x) => x.genre.endsWith('-melange')).length >= 2);
  // Un exercice isolé déjà pris par le bloc « automatiser » compte dans la limite.
  const c = exercicesBloc(d, '2026-11-11', { genres, cibles: ['+4:petit', '+3:petit'], minutes: 25, isolesDeja: 1, exclure: [b[0].id], unParGeste: false });
  assert.equal(c.filter((x) => x.genre.endsWith('-isole')).length, 1);
  // 0.41 : hors bloc « automatiser », un geste déjà travaillé dans la séance n'a plus d'exercice.
  const g = gesteExercice(b[0].id);
  const c2 = exercicesBloc(d, '2026-11-11', { genres, cibles: ['+4:petit', '+3:petit'], minutes: 25, exclure: [b[0].id] });
  assert.ok(g && c2.every((x) => gesteExercice(x.id) !== g), c2.map((x) => x.id).join());
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

test('0.34 : barème du flash anzan, nombres en mots, drill sur mesure', async () => {
  const { GRADES_FLASH, questionFlash, verdictFlash, gradeFlashOuvert, libelleGradeFlash } = await import('../src/core/flashGrades.js');
  const { nombreEnMots } = await import('../src/core/motsNombre.js');
  const { drillPerso, controles } = await import('../src/core/drills.js');
  // Grille officielle : quelques lignes relevées telles quelles.
  const de = (id) => GRADES_FLASH.find((x) => x.id === id);
  assert.deepEqual([de('fk20').nombres, de('fk20').secondes], [3, 5]);
  assert.deepEqual([de('fk13').chiffres, de('fk13').nombres, de('fk13').secondes], [1, 20, 15]);
  assert.deepEqual([de('fk1').chiffres, de('fk1').nombres, de('fk1').secondes], [2, 15, 13]);
  assert.deepEqual([de('fd1').chiffres, de('fd1').nombres, de('fd1').secondes], [2, 15, 10]);
  assert.deepEqual([de('fd10').chiffres, de('fd10').nombres, de('fd10').secondes], [3, 15, 3]);
  assert.equal(de('fd20').secondes, 1.5);
  assert.deepEqual([4, 5, 6, 7, 10].map(verdictFlash), ['non', 'presque', 'presque', 'reussi', 'reussi']);
  // Pas de saut de grade.
  assert.ok(gradeFlashOuvert({ records: {} }, de('fk20')) && !gradeFlashOuvert({ records: {} }, de('fk19')));
  assert.match(libelleGradeFlash(de('fk13')), /sans retenue/);
  // Questions : sans retenue, chaque tige reste entre 0 et 9 ; ensuite, additions seules.
  for (let k = 0; k < 30; k++) {
    for (const id of ['fk13', 'fk12', 'fk11']) {
      const q = questionFlash(de(id));
      const pas = id === 'fk12' ? 10 : id === 'fk11' ? 11 : 1;
      let t = 0;
      assert.equal(q.lignes.length, de(id).nombres);
      for (const l of q.lignes) { assert.equal(l.n % pas, 0); t += l.op === '+' ? l.n : -l.n; assert.ok(t >= 0 && t <= 9 * pas, `${id} ${t}`); }
      assert.equal(q.resultat, t);
    }
    const q = questionFlash(de('fd2'));
    assert.ok(q.lignes.every((l) => l.op === '+' && l.n >= 100 && l.n <= 999) && q.lignes.length === 4);
    assert.equal(q.resultat, q.lignes.reduce((s, l) => s + l.n, 0));
  }
  // Septante, huitante, nonante.
  assert.equal(nombreEnMots(71), 'septante et un');
  assert.equal(nombreEnMots(80), 'huitante');
  assert.equal(nombreEnMots(93), 'nonante-trois');
  assert.equal(nombreEnMots(17), 'dix-sept');
  assert.equal(nombreEnMots(1975), 'mille neuf cent septante-cinq');
  assert.equal(nombreEnMots(200), 'deux cent');
  assert.equal(nombreEnMots(2080090), 'deux millions huitante mille nonante');
  assert.equal(nombreEnMots(0), 'zéro');
  // Drill sur mesure : aller-retour à 0, ou additions continues ; longueur du pas respectée.
  const ar = drillPerso({ chiffres: 4, varie: true, etapes: 9, retour: true });
  assert.equal(ar.operations.length, 18);
  assert.equal(ar.resultat, 0);
  assert.ok(ar.operations.every((o) => String(o.n).length === 4));
  assert.ok(controles(ar.operations).every((v) => v >= 0));
  const meme = drillPerso({ chiffres: 3, varie: false, etapes: 30, retour: false });
  assert.equal(new Set(meme.operations.map((o) => o.n)).size, 1);
  assert.equal(meme.resultat, 30 * meme.operations[0].n);
  assert.ok(drillPerso({ chiffres: 0, varie: true, etapes: 20, retour: false }).operations.every((o) => { const c = String(o.n).length; return c >= 3 && c <= 9; }));
});

test('0.34.1 : pas répété aux chiffres distincts ou saisi ; descente (soustractions seules)', async () => {
  const { drillPerso, nombreDistinct, controles, poidsDrill } = await import('../src/core/drills.js');
  for (let k = 0; k < 200; k++) {
    const c = 1 + (k % 9);
    const s = String(nombreDistinct(c));
    assert.ok(s.length === c && !s.includes('0') && new Set(s).size === c, s);
    const d = drillPerso({ chiffres: c, varie: false, etapes: 5, forme: 'aller' });
    const pas = String(d.operations[0].n);
    assert.ok(!pas.includes('0') && new Set(pas).size === pas.length, pas);
  }
  // Nombre saisi : repris tel quel.
  const d789 = drillPerso({ chiffres: 3, varie: false, etapes: 9, forme: 'retour', nombre: 789 });
  assert.ok(d789.operations.every((o) => o.n === 789) && d789.resultat === 0 && d789.operations.length === 18);
  // Descente : on part du total déjà posé, soustractions seules, jusqu'à 0, sans passer sous 0.
  const desc = drillPerso({ chiffres: 3, varie: false, etapes: 9, forme: 'descente', nombre: 789 });
  assert.equal(desc.depart, 9 * 789);
  assert.ok(desc.operations.length === 9 && desc.operations.every((o) => o.op === '-'));
  assert.equal(desc.resultat, 0);
  const c = controles(desc.operations, desc.depart);
  assert.ok(c.every((v) => v >= 0) && c.at(-1) === 0);
  assert.ok(poidsDrill(desc) > 0);
  const dv = drillPerso({ chiffres: 4, varie: true, etapes: 10, forme: 'descente' });
  assert.equal(controles(dv.operations, dv.depart).at(-1), 0);
  // Ancien réglage (retour: true/false) toujours compris.
  assert.equal(drillPerso({ chiffres: 2, etapes: 5, retour: false }).operations.length, 5);
});

test('0.35 : pincée, paliers 7 et 8 lignes, socle des premiers grades', async () => {
  const { diagnosticPincee, PINCEES } = await import('../src/core/motifs.js');
  const { aSocle, SOCLE } = await import('../src/core/examen.js');
  const { planchesPossibles: possibles } = await import('../src/core/propositions.js');
  const { genererExercice } = await import('../src/core/curriculum.js');
  const essais = (ok, ko) => [...Array.from({ length: ok }, () => ({ ok: 1, t: 2 })), ...Array.from({ length: ko }, () => ({ ok: 0, t: 2 }))];
  assert.equal(PINCEES.length, 8);
  assert.equal(diagnosticPincee({}).alerte, false);
  assert.equal(diagnosticPincee({ '+7:direct': { hist: essais(2, 2) } }).alerte, false); // trop peu d'essais
  assert.equal(diagnosticPincee({ '+7:direct': { hist: essais(8, 2) }, '-8:direct': { hist: essais(5, 0) } }).alerte, false); // 13 %
  const mauvais = { '+7:direct': { hist: essais(6, 4) }, '+9:direct': { hist: essais(4, 3) } };
  assert.equal(diagnosticPincee(mauvais).alerte, true); // 41 %
  const d = valide(['p1-1', 'p1-2', 'p1-3', 'p1-4'], { motifs: mauvais });
  const p = possibles(d, [], '2026-11-11');
  assert.ok(p.some((x) => x.id === 'pincee' && x.cible === 'pincee' && x.colonnes >= 3)); // colonnes : selon la durée visée
  // Paliers d'endurance : 7, 8 puis 10 lignes, dans cet ordre.
  const ordre = ['p5-e7', 'p5-e8', 'p5-e'].map((id) => sousPalier(id).ordre);
  assert.ok(ordre[0] < ordre[1] && ordre[1] < ordre[2]);
  assert.equal(genererExercice(sousPalier('p5-e7')).lignes.length, 7);
  assert.equal(genererExercice(sousPalier('p5-e8')).lignes.length, 8);
  assert.ok(PREREQUIS[8].includes('p5-e7') && !PREREQUIS[10].includes('p5-e7')); // 8 lignes au 8e kyū
  // Socle : les trois premiers grades préparatoires seulement.
  assert.deepEqual(PREKYU.filter(aSocle).map((g) => g.id), ['20', '19', '18']);
  assert.equal(Math.ceil(SOCLE.colonnes * SOCLE.seuil), 8);
  assert.ok(sousPalier('pd-2').exemples.length >= 3 && sousPalier('pd-4').exemples.length >= 3);
});
