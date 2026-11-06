import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examenDeLaSemaine, sujetExamen, minutesExamen, PREKYU, joursRestants, COLONNES } from '../src/core/examen.js';
import { decisionDuJour, jeuDuJour, motDuProf, joursAbsence } from '../src/core/prof.js';
import { sousPalier } from '../src/core/curriculum.js';
import { analyserOperation } from '../src/core/generateur.js';
import { motifsAppris } from '../src/core/parcours.js';

const vide = () => ({ motifs: {}, paliers: {}, sessions: [], records: {}, reglages: {} });
const valider = (d, ids, date = '2026-10-20') => ids.forEach((id) => { d.paliers[id] = { valide: date, reps: 30, hist: [] }; });

test('kyū de la semaine : le plus haut grade accessible, uniquement les gestes appris', () => {
  const d = vide();
  assert.equal(examenDeLaSemaine(d), null);
  valider(d, ['p1-1', 'p1-2', 'p1-3']);
  assert.equal(examenDeLaSemaine(d).id, '20');
  valider(d, ['p1-4', 'p2-1', 'p2-2', 'p2-3']);
  const g = examenDeLaSemaine(d);
  assert.equal(g.id, '18');
  const sujet = sujetExamen(d, g);
  assert.equal(sujet.length, COLONNES);
  const appris = motifsAppris(d);
  for (const col of sujet) {
    let v = col.lignes[0].n;
    for (const l of col.lignes.slice(1)) { const a = analyserOperation(v, l.op, l.n, 8); assert.ok(a.motifs.every((m) => appris.has(m)), a.motifs.join()); v = a.resultat; }
  }
  assert.ok(minutesExamen(g) >= 3 && minutesExamen(PREKYU[0]) <= minutesExamen(PREKYU.at(-1)));
  assert.equal(joursRestants('2026-11-08'), 1); // dimanche
  assert.equal(joursRestants('2026-11-02'), 7); // lundi
});

test('le prof : on termine une leçon commencée, on ancre ce qui n\'est pas acquis, on avance sinon', () => {
  const d = vide();
  valider(d, ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1']);
  d.sessions.push({ date: '2026-11-03', total: 10, justes: 9 });
  const prochain = sousPalier('p2-2');
  // Dernière leçon acquise (juste et rapide) : on avance.
  d.paliers['p2-1'].hist = Array.from({ length: 20 }, () => ({ ok: 1, t: 1 }));
  assert.equal(decisionDuJour(d, '2026-11-04', prochain).type, 'lecon');
  // Pas acquise (trop lente) : ancrage sur ses gestes.
  d.paliers['p2-1'].hist = Array.from({ length: 20 }, () => ({ ok: 1, t: 5 }));
  const a = decisionDuJour(d, '2026-11-04', prochain);
  assert.equal(a.type, 'ancrage');
  assert.deepEqual(a.aller[1].cibles, sousPalier('p2-1').cibles);
  // Leçon déjà commencée : on la termine, même si la précédente n'est pas acquise.
  d.paliers['p2-2'] = { reps: 5, hist: [] };
  assert.equal(decisionDuJour(d, '2026-11-04', prochain).type, 'lecon');
  delete d.paliers['p2-2'];
  // Absence de 5 jours : reprise en douceur.
  d.paliers['p2-1'].hist = Array.from({ length: 20 }, () => ({ ok: 1, t: 1 }));
  assert.equal(joursAbsence(d, '2026-11-08'), 5);
  assert.equal(decisionDuJour(d, '2026-11-08', prochain).titre, 'Reprise en douceur');
  // Jeu du jour et mot du prof.
  assert.ok(jeuDuJour(d, '2026-11-04').titre);
  const mot = motDuProf(d, '2026-11-04', decisionDuJour(d, '2026-11-04', prochain), 40, 15);
  assert.ok(mot.some((p) => p.includes('90 %')) && mot.some((p) => p.includes('40 min')), mot.join(' | '));
});

import { planObjectif } from '../src/core/parcours.js';

test('objectif daté : honnête sur le temps de pratique, pas seulement les leçons', () => {
  const d = vide();
  valider(d, ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2', 'p2-3', 'p2-4', 'p2-5'], '2026-10-25');
  // 1er kyū en 8 mois : pas réaliste ; date réaliste dans près de 3 ans ; un kyū intermédiaire proposé.
  const p = planObjectif(d, '1', '2027-07-12', '2026-11-06');
  assert.equal(p.verdict, 'irrealiste');
  assert.ok(p.dateRealiste > '2029-06-01', p.dateRealiste);
  assert.ok(['8', '7'].includes(p.atteignable.id), p.atteignable?.id);
  // 10e kyū en 4 mois : réaliste.
  assert.equal(planObjectif(d, '10', '2027-03-10', '2026-11-06').verdict, 'realiste');
});

import { libelleGrade } from '../src/core/examen.js';

test('grade : les deux échelles, et le nombre de points conseillés suit l\'essentiel', () => {
  const d = vide();
  assert.match(libelleGrade(d).valeur, /aucun/);
  d.records['prekyu-20'] = { reussi: true }; d.records['prekyu-18'] = { reussi: true };
  const l = libelleGrade(d);
  assert.equal(l.valeur, '18e kyū (entraînement)');
  assert.match(l.detail, /Prochain grade officiel : 10e kyū/);
  const dec = { raison: 'On avance.' };
  const deux = motDuProf(d, '2026-11-04', dec, 30, 15, 2);
  assert.ok(deux.some((p) => p.includes('les deux premiers points')) && !deux.some((p) => p.includes('trois')));
  assert.ok(!motDuProf(d, '2026-11-04', dec, 30, 15, 1).some((p) => p.includes('premier')));
});
