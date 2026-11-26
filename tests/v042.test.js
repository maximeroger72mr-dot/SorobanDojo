import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, evaluerLecon, pisteDe } from '../src/core/curriculum.js';
import { testMin, seuilVitesseLecon, modePrecision, verdictMiniTest, SEANCES_PRECISION_MAX } from '../src/core/minitest.js';
import { porteMulDiv, choisirPiste, PREREQUIS, JOURS_PORTE_MULDIV } from '../src/core/parcours.js';
import { PART_CADENCE_LECON } from '../src/core/allure.js';
import { cleProduit } from '../src/core/tables.js';
import { pourcentage } from '../src/core/quotidien.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const hist = (n, ko, t) => Array.from({ length: n }, (_, i) => ({ ok: i < ko ? 0 : 1, t }));
const arrondi = (x) => Math.round(x * 100) / 100;

test('0.42 : vitesse exigée grade par grade (mini-test = argent, or 80 %)', () => {
  assert.equal(PART_CADENCE_LECON, 0.8);
  const attendu = { 'p8-t1': 3, 'p8-1': 2.67, 'p8-2': 2.67, 'p8-3': 2.04, 'p8-3c': 1.56, 'p9-1': 1, 'p9-2': 0.71 };
  for (const [id, s] of Object.entries(attendu)) assert.equal(arrondi(seuilVitesseLecon(sp(id)).seuil), s, id);
  // Avant le 6e kyū : 3 s par chiffre, sans changement.
  assert.equal(seuilVitesseLecon(sp('p3-4')).seuils, null);
  assert.equal(seuilVitesseLecon(sp('p3-4')).seuil, 3);
  // Le mini-test et l'argent : le même seuil.
  assert.equal(verdictMiniTest(sp('p8-3c'), { justes: 0 }).seuil, 1.56);
  assert.equal(evaluerLecon(hist(30, 0, 1.5), sp('p8-3c')).index, 2, 'argent à 1,5 s');
  assert.equal(evaluerLecon(hist(30, 0, 1.7), sp('p8-3c')).index, 1, 'trop lent pour l\'argent du 3e kyū');
  assert.equal(evaluerLecon(hist(30, 0, 1.2), sp('p8-3c')).index, 3, 'or à 80 % du seuil');
  assert.equal(evaluerLecon(hist(30, 0, 2.9), sp('p2-1')).index, 2, 'colonnes courtes : argent à 3 s');
});

test('0.42 : la leçon au format du 3e kyū', () => {
  const l = sp('p8-3c');
  assert.ok(l && l.ordre === sp('p8-3').ordre + 1);
  assert.ok(PREREQUIS[3].includes('p8-3c') && !PREREQUIS[4].includes('p8-3c'));
  assert.equal(pisteDe(l), 'colonnes');
});

test('0.42 : mini-test calculé par chiffre', () => {
  const attendu = { 'p2-1': 13, 'p8-t1': 13, 'p8-1': 12, 'p8-3': 12, 'p9-1': 11, 'p9-2': 10 };
  for (const [id, n] of Object.entries(attendu)) assert.equal(testMin(sp(id)), n, id);
  assert.equal(testMin(sp('p6-1')), 13, 'multiplication : inchangé');
});

test('0.42 : mode précision, seulement très rapide et sous la justesse de l\'argent, 3 séances au plus', () => {
  const l = sp('p3-4');
  const ev = (reussite, temps) => ({ essais: 30, reussite, temps });
  assert.equal(modePrecision(l, {}, ev(0.8, 2.0), '2026-11-26'), null, '2 s par chiffre : allure normale');
  assert.ok(modePrecision(l, {}, ev(0.8, 1.5), '2026-11-26'), '1,5 s (moins de 60 % de 3 s) et 80 %');
  assert.equal(modePrecision(l, {}, ev(0.95, 1.5), '2026-11-26'), null, 'justesse de l\'argent');
  const jours = ['2026-11-20', '2026-11-21', '2026-11-22'];
  assert.equal(SEANCES_PRECISION_MAX, 3);
  assert.equal(modePrecision(l, { precision: jours }, ev(0.8, 1.5), '2026-11-26'), null, 'déjà 3 séances');
  assert.ok(modePrecision(l, { precision: jours }, ev(0.8, 1.5), '2026-11-22'), 'la 3e séance continue');
});

/** Profil : colonnes jusqu'à p5-5 validées, tables et × prêts. */
function profil() {
  const paliers = {};
  for (const s of SOUS_PALIERS.filter((x) => !x.mental && x.ordre <= sp('p5-5').ordre)) paliers[s.id] = { valide: '2026-11-01', hist: hist(30, 0, 1.2) };
  paliers['p6-a'] = { valide: '2026-11-05', hist: hist(30, 0, 1.0) };
  const tables = {};
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) tables[cleProduit(a, b)] = { hist: [{ ok: 1, t: 1.2 }] };
  return { paliers, motifs: {}, tables, records: {}, sessions: [], reglages: {} };
}

test('0.42 : porte × ÷ : l\'argent manquant n\'attend que 7 jours de pratique, la validation reste obligatoire', () => {
  const d = profil();
  assert.ok(porteMulDiv(d, sp('p6-0')).ok);
  d.paliers['p5-4'] = { valide: '2026-11-20', hist: hist(30, 8, 1.5) }; // validée, sous l'argent
  assert.ok(!porteMulDiv(d, sp('p6-0')).ok, 'sous l\'argent, validée hier');
  const jours = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];
  d.sessions = jours.map((date) => ({ date, module: 'planches' }));
  assert.ok(!porteMulDiv(d, sp('p6-0')).ok, '6 jours de pratique');
  d.sessions.push({ date: '2026-11-27', module: 'planches' });
  assert.equal(JOURS_PORTE_MULDIV, 7);
  assert.ok(porteMulDiv(d, sp('p6-0')).ok, '7 jours de pratique : on ouvre, la leçon part en rattrapage');
  delete d.paliers['p5-4'];
  assert.ok(!porteMulDiv(d, sp('p6-0')).ok, 'non validée : toujours fermée');
  d.paliers['p5-4'] = { valide: '2026-11-20', hist: hist(30, 0, 1.2) };
  d.tables[cleProduit(7, 8)] = { hist: [{ ok: 0, t: 3 }] };
  d.tables[cleProduit(6, 7)] = { hist: [{ ok: 0, t: 3 }] };
  d.tables[cleProduit(6, 8)] = { hist: [{ ok: 0, t: 3 }] };
  assert.ok(!porteMulDiv(d, sp('p6-0')).ok, 'les tables restent exigées, sans limite de temps');
});

test('0.42 : la piste suit les manques du prochain grade', () => {
  const d = profil();
  // Prochain grade : 10e kyū (colonnes seules) tant qu'il manque des colonnes.
  const c = sp('p5-e7');
  const m = sp('p6-0');
  delete d.paliers['p5-5'];
  assert.equal(choisirPiste(d, sp('p5-5'), m, 1), sp('p5-5'), 'il ne manque que des colonnes au 10e kyū');
  assert.equal(choisirPiste(d, sp('p5-5'), m, 2), sp('p5-5'));
  d.paliers['p5-5'] = { valide: '2026-11-01', hist: hist(30, 0, 1.2) };
  // 10e réussi des deux côtés : le 9e n'exige que la multiplication 2 × 1.
  d.records = { 'epreuve-10': { reussi: true }, 'zenkoren-10': { reussi: true } };
  assert.equal(choisirPiste(d, c, m, 2), m, 'il ne manque que la multiplication 2 × 1 au 9e kyū');
  assert.equal(choisirPiste(d, c, m, 1), m);
  // La leçon des tables alterne toujours.
  assert.equal(choisirPiste(profil(), c, sp('p6-a'), 1), sp('p6-a'));
  assert.equal(choisirPiste(profil(), c, sp('p6-a'), 2), c);
  // Une leçon commencée se termine.
  d.paliers['p5-e7'] = { reps: 4, hist: [] };
  assert.equal(choisirPiste(d, c, m, 1), c);
});

test('0.42 : astuces des pourcentages : coefficient entier, virgule française', () => {
  const nombre = (x) => Number(x.replace(/\s/g, '').replace(',', '.'));
  for (let i = 0; i < 3000; i++) {
    const e = pourcentage();
    const a = e.astuce;
    assert.ok(!/\d\.\d/.test(a), a);
    // Le dernier « a × k » de l'astuce donne bien le résultat (avant : 0,13 pour 12,5 %, 1,06 pour 5,5 %).
    const m = [...a.matchAll(/([\d\s]+(?:,\d+)?) × (\d+(?:,\d+)?)/g)].at(-1);
    if (m) assert.ok(Math.abs(nombre(m[1]) * nombre(m[2]) - e.resultat) < 0.006, `${a} → ${e.resultat}`);
  }
});
