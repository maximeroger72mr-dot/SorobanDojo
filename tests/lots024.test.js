import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeErreurOperation, ENTRAINEMENTS_ERREUR } from '../src/core/diagnostic.js';
import { milliersCorrects } from '../src/core/nombres.js';
import { GRADES_FLASH, debitGrade, prochainGradeFlash, meilleurGradeFlash } from '../src/core/flashGrades.js';
import { genererPlanche, genererPlancheSpeciale } from '../src/core/planche.js';
import { decisionDuJour, JOURS_ANCRAGE_MAX } from '../src/core/prof.js';
import { erreursOperationRepetees, SEUIL_ERREUR_OPERATION } from '../src/core/progression.js';
import { formatHebdo, sectionsExamen, minutesExamen } from '../src/core/examen.js';
import { SOUS_PALIERS, sousPalier } from '../src/core/curriculum.js';
import { verdictMiniTest } from '../src/core/minitest.js';
import { famille } from '../src/core/motifs.js';

test('type d\'erreur en multiplication et division', () => {
  const mul = { type: 'mul', a: 37, b: 8, resultat: 296 };
  assert.equal(typeErreurOperation(mul, 2960), 'placement');
  assert.equal(typeErreurOperation(mul, 240), 'produit'); // 7 × 8 oublié
  assert.equal(typeErreurOperation(mul, 297), null);
  assert.equal(typeErreurOperation({ type: 'div', a: 2128, b: 7, resultat: 304 }, 34), 'zero');
  assert.equal(typeErreurOperation({ type: 'div', a: 2128, b: 7, resultat: 304 }, 3004), 'zero');
  const div = { type: 'div', a: 1512, b: 24, resultat: 63 };
  assert.equal(typeErreurOperation(div, 73), 'quotient-grand');
  assert.equal(typeErreurOperation(div, 62), 'quotient-petit');
  assert.equal(typeErreurOperation(div, 630), 'placement');
  assert.equal(typeErreurOperation(div, 63), null);
  const arr = { type: 'div', a: 22, b: 7, resultat: 3.143, decimales: 3, arrondi: true };
  assert.equal(typeErreurOperation(arr, 3.142), 'arrondi');
  assert.equal(typeErreurOperation(arr, 31.43), 'placement');
  assert.equal(typeErreurOperation({ type: 'addsub', lignes: [], resultat: 5 }, 6), null);
  for (const t of ['placement', 'zero', 'quotient-grand', 'quotient-petit', 'arrondi', 'produit']) assert.ok(ENTRAINEMENTS_ERREUR[t].aller(true)[0]);
});

test('erreurs répétées : seuil, fenêtre, remise à zéro après l\'entraînement', () => {
  const d = { erreursOperations: { zero: { total: 5, dates: ['2026-01-01', '2026-03-01', '2026-03-02', '2026-03-03'] }, arrondi: { total: 2, dates: ['2026-03-02', '2026-03-03'] } } };
  assert.deepEqual(erreursOperationRepetees(d, '2026-03-04').map((x) => x.type), ['zero']);
  assert.equal(erreursOperationRepetees(d, '2026-03-04')[0].nombre, SEUIL_ERREUR_OPERATION);
  d.erreursOperations.zero.traite = '2026-03-03';
  assert.equal(erreursOperationRepetees(d, '2026-03-05').length, 0);
});

test('séparateurs de milliers', () => {
  for (const x of ['1 234', '12 345,678', '1.234.567', '123', '-1 234', '0,5']) assert.equal(milliersCorrects(x), true, x);
  for (const x of ['1234', '12345,6', '1 2345', '12 34']) assert.equal(milliersCorrects(x), false, x);
});

test('grades de flash : 20 marches, chacune au moins aussi haute que la précédente', () => {
  assert.equal(GRADES_FLASH.length, 20);
  GRADES_FLASH.forEach((g, i) => {
    if (!i) return;
    const p = GRADES_FLASH[i - 1];
    assert.ok(g.chiffres >= p.chiffres, g.id);
    if (g.chiffres === p.chiffres) assert.ok(debitGrade(g) > debitGrade(p), g.id);
  });
  assert.equal(prochainGradeFlash({ records: {} }).id, 'k10');
  const d = { records: { 'flash-grade-k10': { reussi: true }, 'flash-grade-k9': { reussi: true } } };
  assert.equal(meilleurGradeFlash(d).id, 'k9');
  assert.equal(prochainGradeFlash(d).id, 'k8');
});

test('planches : additions seules, format d\'examen, négatifs, décimaux, 10 chiffres', () => {
  const plus = famille('grand').filter((c) => c.startsWith('+'));
  const p = genererPlanche({ chiffres: 2, lignes: 5, colonnes: 10, cibles: plus, ops: ['+'] }, 7);
  assert.ok(p.colonnes.every((c) => c.lignes.every((l) => l.op === '+')));
  assert.ok(genererPlancheSpeciale({ genre: 'negatifs', chiffres: 3, lignes: 5, colonnes: 10 }, 3).colonnes.every((c) => c.resultat < 0));
  assert.ok(genererPlancheSpeciale({ genre: 'decimaux', chiffres: 4, lignes: 5, colonnes: 10 }, 3).colonnes.every((c) => c.decimales === 2));
  const e = genererPlancheSpeciale({ genre: 'examen', chiffres: 10, lignes: 10, colonnes: 10 }, 3);
  assert.equal(e.colonnes.filter((c) => c.lignes.every((l) => l.op === '+')).length, 6);
  assert.deepEqual(genererPlancheSpeciale({ genre: 'examen', chiffres: 6, lignes: 5, colonnes: 5 }, 9).colonnes, genererPlancheSpeciale({ genre: 'examen', chiffres: 6, lignes: 5, colonnes: 5 }, 9).colonnes);
});

/** Historique de `n` essais justes à `t` secondes par chiffre. */
const hist = (t, n = 20) => Array.from({ length: n }, () => ({ ok: 1, t }));

test('prof : l\'avant-dernière leçon doit être confirmée, 7 jours d\'ancrage au plus', () => {
  const prochain = sousPalier('p2-3');
  const base = (tAvant, sessions) => ({
    sessions,
    paliers: { 'p2-1': { valide: '2026-03-01', hist: hist(tAvant) }, 'p2-2': { valide: '2026-03-02', hist: hist(2.5) } },
  });
  const jours = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-03-${String(3 + i).padStart(2, '0')}`, total: 10, justes: 10 }));
  // Avant-dernière confirmée (1,2 s par chiffre) : on avance.
  assert.equal(decisionDuJour(base(1.2, jours(1)), '2026-03-04', prochain).type, 'lecon');
  // Débutant seulement (2,5 s) : on ancre…
  const d = decisionDuJour(base(2.5, jours(2)), '2026-03-05', prochain);
  assert.equal(d.type, 'ancrage');
  assert.equal(d.sp.id, 'p2-1');
  // … mais pas au-delà de 7 jours de pratique : la leçon s'ouvre.
  assert.equal(decisionDuJour(base(2.5, jours(JOURS_ANCRAGE_MAX)), '2026-03-10', prochain).type, 'lecon');
  // La dernière leçon sous le niveau débutant bloque toujours, même après 7 jours.
  const lent = base(1.2, jours(JOURS_ANCRAGE_MAX));
  lent.paliers['p2-2'].hist = hist(4);
  assert.equal(decisionDuJour(lent, '2026-03-10', prochain).type, 'ancrage');
});

test('examen de la semaine adapté au niveau', () => {
  const valide = (ids) => ({ paliers: Object.fromEntries(ids.map((id) => [id, { valide: '2026-01-01' }])), records: {}, motifs: {}, sessions: [] });
  const addsub = SOUS_PALIERS.filter((sp) => ['p1', 'p2', 'p3', 'p4', 'p5'].includes(sp.palier.id)).map((sp) => sp.id);
  const f1 = formatHebdo(valide(addsub));
  assert.equal(f1.colonnes, 20);
  assert.equal(f1.mul, null);
  const d = valide([...addsub, 'p6-1', 'p6-2', 'p7-1']);
  const f2 = formatHebdo(d);
  assert.equal(f2.colonnes, 10);
  assert.equal(f2.mul.id, 'p6-2');
  assert.equal(f2.div.id, 'p7-1');
  const s = sectionsExamen(d, f2);
  assert.deepEqual(s.map((x) => x.problemes.length), [10, 5, 5]);
  assert.ok(minutesExamen(f2) >= 3);
});

test('mini-test : la vitesse des leçons avancées suit 70 % de la cadence du grade', () => {
  const sp = sousPalier('p9-2'); // exigée par le 1er kyū
  const ex = { type: 'addsub', lignes: Array.from({ length: 10 }, () => ({ op: '+', n: 1234567890 })), resultat: 0 };
  const bilan = (s) => ({ justes: 20, total: 20, resultats: Array.from({ length: 20 }, () => ({ ex, juste: true, dureeMs: s * 100 * 1000 })) });
  assert.equal(verdictMiniTest(sp, bilan(2.5)).vitesseOk, false); // débutant (3 s) ne suffit plus
  assert.equal(verdictMiniTest(sp, bilan(0.5)).vitesseOk, true);
  assert.ok(verdictMiniTest(sp, bilan(2.5)).raison.includes('1er kyū'));
  // Une leçon de début de parcours garde le seuil « acquis débutant ».
  assert.equal(verdictMiniTest(sousPalier('p2-1'), { justes: 20, total: 20, resultats: [] }).seuil, 3);
});

test('tables : criblage (36 produits) et acharnement (retour 3 questions plus tard, 3 réussites rapides de suite)', async () => {
  const { serieCriblage, piresProduits, creerAcharnement, cleProduit } = await import('../src/core/tables.js');
  const s = serieCriblage();
  assert.equal(s.length, 36);
  assert.equal(new Set(s.map((e) => cleProduit(e.a, e.b))).size, 36);
  assert.ok(s.every((e) => e.a >= 2 && e.b >= 2));
  const stats = { '7x8': { hist: [{ ok: 0, t: 3 }, { ok: 1, t: 4 }] }, '6x7': { hist: [{ ok: 1, t: 3.5 }] }, '2x2': { hist: [{ ok: 1, t: 0.6 }] } };
  const pires = piresProduits(stats);
  assert.equal(pires.length, 4);
  assert.deepEqual(pires[0], [7, 8]);
  assert.deepEqual(pires[1], [6, 7]);
  // Tout juste et rapide : 4 produits × 3 réussites = 12 questions.
  const a = creerAcharnement(pires);
  let n = 0;
  while (a.suivant()) { a.repondre(true, 1); n += 1; }
  assert.equal(n, 12);
  assert.equal(a.etat().fini, true);
  // Un produit raté revient exactement 3 questions plus tard.
  const b = creerAcharnement([[7, 8], [6, 7], [6, 8], [7, 9], [8, 9], [6, 9]]);
  const premier = b.suivant();
  b.repondre(false, 1);
  const suite = [b.suivant(), (b.repondre(true, 1), b.suivant()), (b.repondre(true, 1), b.suivant())];
  assert.equal(cleProduit(suite[2].a, suite[2].b), cleProduit(premier.a, premier.b));
  assert.notEqual(cleProduit(suite[0].a, suite[0].b), cleProduit(premier.a, premier.b));
  // Juste mais entre 1,5 s et 2 s : la suite repart de zéro, sans retour anticipé.
  const c = creerAcharnement([[7, 8]]);
  c.suivant(); c.repondre(true, 1); c.suivant(); c.repondre(true, 1.8);
  assert.equal(c.etat().suites['7x8'], 0);
  // Plafond : l'exercice s'arrête même si l'on n'y arrive pas.
  const d = creerAcharnement([[7, 8]]);
  let k = 0;
  while (d.suivant()) { d.repondre(false, 3); k += 1; }
  assert.equal(k, 80);
  assert.equal(d.etat().abandon, true);
});

test('diagnostic : franchissement (99 → 100) accusé en premier quand l\'écart est de 10, 100, 1 000', async () => {
  const { franchissements, franchissementEnCause, diagnostiquerColonne } = await import('../src/core/diagnostic.js');
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 57 }, { op: '+', n: 38 }, { op: '+', n: 9 }, { op: '-', n: 12 }], resultat: 92 };
  assert.deepEqual(franchissements(ex.lignes).map((f) => [f.ligne, f.avant, f.apres, f.monte]), [[2, 95, 104, true], [3, 104, 92, false]]);
  assert.equal(franchissementEnCause(ex, 82).ligne, 2);
  assert.ok(diagnostiquerColonne(ex, 82)[0].includes('95 → 104'));
  assert.equal(franchissementEnCause(ex, 93), null); // écart de 1 : pas un franchissement
  assert.equal(franchissementEnCause(ex, 62), null); // écart de 30
  // Pas de franchissement dans la colonne : rien n'est accusé.
  const sans = { type: 'addsub', lignes: [{ op: '+', n: 21 }, { op: '+', n: 34 }, { op: '+', n: 12 }], resultat: 67 };
  assert.equal(franchissementEnCause(sans, 77), null);
  // Une ligne oubliée explique l'écart : elle reste citée d'abord.
  const oubli = { type: 'addsub', lignes: [{ op: '+', n: 95 }, { op: '+', n: 10 }, { op: '+', n: 3 }], resultat: 108 };
  assert.ok(diagnostiquerColonne(oubli, 98)[0].includes('oubli'));
});

test('sprint de surcharge : proposé seulement sur le plateau d\'un geste, à 115 % du meilleur rythme', async () => {
  const { prioriteDuJour, SURCHARGE } = await import('../src/core/parcours.js');
  const { lundi } = await import('../src/core/maitrise.js');
  const date = '2026-03-25';
  const jourPlus = (j) => { const x = new Date(`${date}T12:00`); x.setDate(x.getDate() + j); return x.toISOString().slice(0, 10); };
  const sem = Object.fromEntries([0, -7, -14, -21].map((j) => [lundi(jourPlus(j)), Array(12).fill(2)]));
  const hist = Array.from({ length: 20 }, () => ({ ok: 1, t: 2 }));
  // Sans plateau (pas d'historique par semaine) : jamais de surcharge.
  const sans = { motifs: { '+4:petit': { hist } }, paliers: {}, sessions: [], records: {} };
  for (let j = 0; j < 4; j++) assert.ok(!prioriteDuJour(sans, jourPlus(j))?.aller?.[1]?.surcharge);
  // Plateau sur le geste : la surcharge est l'un des 4 remèdes, qui tournent d'un jour à l'autre.
  const avec = { ...sans, motifs: { '+4:petit': { hist, sem } } };
  const surcharges = [0, 1, 2, 3].map((j) => prioriteDuJour(avec, jourPlus(j))?.aller?.[1]).filter((p) => p?.surcharge);
  assert.equal(surcharges.length, 1);
  assert.equal(surcharges[0].jeu, 'lievre');
  assert.deepEqual(surcharges[0].cibles, ['+4:petit']);
  assert.ok(Math.abs(surcharges[0].surcharge - 2 / SURCHARGE) < 0.02);
});

test('franchissement raté plus une autre erreur : hypothèse à deux causes, seulement si elle est unique', async () => {
  const { franchissementCompose, diagnostiquerColonne } = await import('../src/core/diagnostic.js');
  // 57 + 38 = 95, + 9 = 104 (franchissement), + 23 = 127. Réponse 104 : retenue manquée (−100)
  // serait 27 ; ici on teste « franchissement manqué (−100) et ligne 4 oubliée (−23) » = 4.
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 57 }, { op: '+', n: 38 }, { op: '+', n: 9 }, { op: '+', n: 23 }], resultat: 127 };
  const c = franchissementCompose(ex, 4);
  assert.equal(c.franchissement.ligne, 2);
  assert.ok(c.autre.includes('ligne 4'));
  const causes = diagnostiquerColonne(ex, 4);
  assert.ok(causes[0].startsWith('Hypothèse, deux erreurs'));
  // Écart sans rapport : aucune hypothèse.
  assert.equal(franchissementCompose(ex, 163), null);
  // Écart exact de 100 : c'est le diagnostic simple qui parle, pas l'hypothèse.
  assert.ok(!diagnostiquerColonne(ex, 27)[0].startsWith('Hypothèse'));
  // Sans franchissement dans la colonne : rien.
  assert.equal(franchissementCompose({ type: 'addsub', lignes: [{ op: '+', n: 21 }, { op: '+', n: 34 }, { op: '+', n: 12 }], resultat: 67 }, 45), null);
});

test('marches de multiplication et de division : une difficulté à la fois, héritage pour les élèves avancés', async () => {
  const { genererMarche } = await import('../src/core/multiplication.js');
  const { genererExercice } = await import('../src/core/curriculum.js');
  const { heriterMarches } = await import('../src/core/progression.js');
  const { PREREQUIS } = await import('../src/core/parcours.js');
  for (let k = 0; k < 60; k++) {
    let e = genererMarche('mul-direct');
    let [x, y, c] = [Math.floor(e.a / 10), e.a % 10, e.b];
    assert.ok(x * c >= 10 && y * c >= 10 && ((x * c) % 10) + Math.floor((y * c) / 10) <= 9, `${e.a} × ${e.b}`);
    e = genererMarche('mul-retenue');
    [x, y, c] = [Math.floor(e.a / 10), e.a % 10, e.b];
    assert.ok(((x * c) % 10) + Math.floor((y * c) / 10) >= 10, `${e.a} × ${e.b}`);
    e = genererMarche('mul-court');
    assert.ok(Math.floor(e.a / 10) * e.b < 10 || (e.a % 10) * e.b < 10);
    e = genererMarche('mul-zero');
    assert.ok((Math.floor(e.a / 10) * e.b) % 10 === 0 || ((e.a % 10) * e.b) % 10 === 0);
    e = genererMarche('div-court');
    assert.ok(e.a === e.b * e.resultat && e.resultat >= 11 && e.resultat <= 99 && Math.floor(e.resultat / 10) * e.b < 10 && (e.resultat % 10) * e.b < 10);
    e = genererMarche('div-emprunt');
    assert.ok(e.a === e.b * e.resultat && Math.floor(e.a / 10) % 10 < (Math.floor(e.resultat / 10) * e.b) % 10, `${e.a} ÷ ${e.b}`);
    e = genererMarche('div-zero');
    assert.ok(e.a % 10 === 0 && e.a === e.b * e.resultat);
  }
  // Les leçons existent, précèdent leur leçon d'arrivée, et sont exigées par les grades.
  const ordre = (id) => sousPalier(id).ordre;
  for (const id of ['p6-1a', 'p6-1b', 'p6-1c', 'p6-1d']) { assert.ok(ordre(id) < ordre('p6-1') && ordre(id) > ordre('p6-0')); assert.ok(PREREQUIS[10].includes(id)); assert.equal(genererExercice(sousPalier(id)).type, 'mul'); }
  for (const id of ['p7-2a', 'p7-2b', 'p7-2c', 'p7-2d']) { assert.ok(ordre(id) < ordre('p7-2') && ordre(id) > ordre('p7-1')); assert.ok(PREREQUIS[8].includes(id)); assert.equal(genererExercice(sousPalier(id)).type, 'div'); }
  // Élève qui a déjà validé « 2 chiffres × 1 chiffre » : ses marches sont acquises, pas la division.
  const d = heriterMarches({ paliers: { 'p6-1': { valide: '2026-02-01' } } });
  assert.equal(d.paliers['p6-1a'].valide, '2026-02-01');
  assert.equal(d.paliers['p6-1d'].herite, true);
  assert.equal(d.paliers['p7-2a'], undefined);
});

test('pyramide et part de soustractions des planches ; profils de vitesse', async () => {
  const { paliersPyramide } = await import('../src/core/planche.js');
  const { periodesProfil } = await import('../src/ui/cadence.js');
  assert.deepEqual(paliersPyramide('chiffres', { chiffres: 5, lignes: 8, colonnes: 10 }).map((p) => [p.chiffres, p.colonnes]), [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2]]);
  assert.deepEqual(paliersPyramide('chiffres', { chiffres: 10, lignes: 8, colonnes: 10 }).map((p) => p.chiffres), [1, 3, 6, 8, 10]);
  assert.deepEqual(paliersPyramide('chiffres', { chiffres: 5, lignes: 8, colonnes: 5 }).map((p) => [p.chiffres, p.colonnes]), [[1, 2], [5, 3]]);
  assert.deepEqual(paliersPyramide('lignes', { chiffres: 2, lignes: 10, colonnes: 10 }).map((p) => p.lignes), [3, 5, 7, 8, 10]);
  for (const c of [5, 10, 20, 30]) assert.equal(paliersPyramide('chiffres', { chiffres: 4, lignes: 5, colonnes: c }).reduce((t, p) => t + p.colonnes, 0), c);
  assert.equal(paliersPyramide('non', { chiffres: 5, lignes: 8, colonnes: 10 }), null);
  assert.equal(paliersPyramide('chiffres', { chiffres: 1, lignes: 8, colonnes: 10 }), null);
  for (const [part, pures] of [[0, 10], [0.4, 6], [1, 0]]) {
    const p = genererPlancheSpeciale({ genre: 'examen', chiffres: 3, lignes: 5, colonnes: 10, partMoins: part }, 5);
    assert.equal(p.colonnes.filter((c) => c.lignes.every((l) => l.op === '+')).length, pures);
  }
  // Profils : même durée totale, répartie autrement.
  for (const profil of ['constant', 'accelere', 'brusque', 'cloche']) {
    const t = periodesProfil(profil, 10, 1000);
    assert.ok(Math.abs(t.reduce((s, x) => s + x, 0) - 10000) < 1e-6, profil);
  }
  const acc = periodesProfil('accelere', 10, 1000);
  assert.ok(acc[0] > acc[9] && acc.every((x, i) => i === 0 || x <= acc[i - 1]));
  const cl = periodesProfil('cloche', 11, 1000);
  assert.ok(cl[5] < cl[0] && cl[5] < cl[10]);
});
