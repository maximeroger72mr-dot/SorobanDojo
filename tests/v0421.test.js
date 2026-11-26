import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { choisirPiste, leconBloquee, gradeAPreparer, ECHECS_TEST_MAX, JOURS_LECON_MAX, PREREQUIS } from '../src/core/parcours.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const hist = (n, t) => Array.from({ length: n }, () => ({ ok: 1, t }));

/** Tout est validé jusqu'au 2e kyū ; p9-2 (colonnes) et la division p9-6 restent pour le 1er. */
function avance() {
  const paliers = {};
  for (const id of PREREQUIS[2]) paliers[id] = { valide: '2026-06-01', hist: hist(30, 0.8) };
  return { paliers, motifs: {}, tables: {}, records: {}, sessions: [], reglages: {} };
}

test('0.42.1 : le grade à préparer est le premier dont les leçons ne sont pas toutes validées', () => {
  const d = avance();
  assert.equal(gradeAPreparer(d).id, '1', 'aucun examen passé : on prépare quand même le 1er kyū');
  assert.equal(gradeAPreparer({ paliers: {}, records: {}, sessions: [] }).id, '10');
});

test('0.42.1 : une leçon qu\'on n\'arrive pas à passer ne bloque plus l\'autre piste', () => {
  const d = avance();
  const c = sp('p9-2');
  const m = sp('p9-4');
  d.paliers['p9-2'] = { reps: 14, hist: hist(30, 0.8), echecsTest: 2 };
  d.sessions = [{ date: '2026-11-20', module: 'lecons', reglages: { sousPalier: 'p9-2' } }];
  assert.ok(!leconBloquee(d, c));
  assert.equal(choisirPiste(d, c, m, 1), c, 'commencée : elle passe d\'abord');
  assert.equal(choisirPiste(d, c, m, 2), c);
  // 3 mini-tests ratés : elle n'a plus la priorité, on alterne (les deux pistes manquent au 1er kyū).
  d.paliers['p9-2'].echecsTest = ECHECS_TEST_MAX;
  assert.ok(leconBloquee(d, c));
  assert.deepEqual([choisirPiste(d, c, m, 1), choisirPiste(d, c, m, 2)].map((x) => x.id).sort(), ['p9-2', 'p9-4']);
  // Ou 7 jours de pratique depuis le début de la leçon.
  d.paliers['p9-2'].echecsTest = 0;
  for (let j = 21; j < 20 + JOURS_LECON_MAX; j++) d.sessions.push({ date: `2026-11-${j}`, module: 'planches' });
  assert.ok(leconBloquee(d, c), '7 jours');
  // Validée : plus de blocage.
  d.paliers['p9-2'].valide = '2026-11-28';
  assert.ok(!leconBloquee(d, c));
});
