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

test('planches : additions seules, longueurs mêlées, négatifs, décimaux, 10 chiffres', () => {
  const plus = famille('grand').filter((c) => c.startsWith('+'));
  const p = genererPlanche({ chiffres: 2, lignes: 5, colonnes: 10, cibles: plus, ops: ['+'] }, 7);
  assert.ok(p.colonnes.every((c) => c.lignes.every((l) => l.op === '+')));
  const m = genererPlancheSpeciale({ genre: 'melees', chiffres: 9, lignes: 10, colonnes: 10 }, 3);
  const longueurs = new Set(m.colonnes.flatMap((c) => c.lignes.map((l) => String(l.n).length)));
  assert.ok(longueurs.size >= 4 && Math.min(...longueurs) === 3 && Math.max(...longueurs) === 9);
  assert.ok(genererPlancheSpeciale({ genre: 'negatifs', chiffres: 3, lignes: 5, colonnes: 10 }, 3).colonnes.every((c) => c.resultat < 0));
  assert.ok(genererPlancheSpeciale({ genre: 'decimaux', chiffres: 4, lignes: 5, colonnes: 10 }, 3).colonnes.every((c) => c.decimales === 2));
  const e = genererPlancheSpeciale({ genre: 'examen', chiffres: 10, lignes: 10, colonnes: 10 }, 3);
  assert.equal(e.colonnes.filter((c) => c.lignes.every((l) => l.op === '+')).length, 6);
  assert.deepEqual(genererPlancheSpeciale({ genre: 'melees', chiffres: 6, lignes: 5, colonnes: 5 }, 9).colonnes, genererPlancheSpeciale({ genre: 'melees', chiffres: 6, lignes: 5, colonnes: 5 }, 9).colonnes);
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
