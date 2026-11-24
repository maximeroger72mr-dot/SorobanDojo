import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { phasesLecon, etatInitial, apresColonne, phaseCourante, referenceMin, enduranceAvant, PASSAGE, SORTIE, FILET } from '../src/core/phases.js';
import { exercicesBloc, gesteExercice } from '../src/core/blocs.js';
import { plateaux, chiffresTravail } from '../src/core/parcours.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const pas = (plan, e, o) => apresColonne(plan, e, { rapide: true, ...o });

test('0.41 : minimum de colonnes de référence à 40 % des répétitions', () => {
  assert.equal(referenceMin(sp('p3-1')), 20);
  assert.equal(referenceMin(sp('p8-1')), 12);
  assert.equal(referenceMin(sp('p9-2')), 6); // 0.40.17 : 14 répétitions (avant 20)
});

test('0.41 : endurance, rampe faite une fois puis référence ; filet à 6 lignes ; rampe sautée après une leçon d\'endurance à l\'argent', () => {
  const plan = phasesLecon(sp('p9-2'));
  assert.ok(plan.rampe);
  let e = etatInitial(plan);
  assert.equal(phaseCourante(plan, e).id, 'six');
  // Rampe jamais réussie : au bout de 12 colonnes, on AVANCE (8 lignes), puis la référence.
  for (let k = 0; k < SORTIE; k++) e = pas(plan, e, { juste: k % 2 === 0 });
  assert.equal(phaseCourante(plan, e).id, 'huit');
  for (let k = 0; k < PASSAGE; k++) e = pas(plan, e, { juste: true });
  assert.equal(phaseCourante(plan, e).id, 'reference');
  // On reste en référence (avant : retour aux 6 lignes après 6 colonnes).
  for (let k = 0; k < 30; k++) e = pas(plan, e, { juste: true });
  assert.equal(phaseCourante(plan, e).id, 'reference');
  // Filet : la colonne la plus courte (6 lignes), pas la référence à 10 lignes.
  e = pas(plan, e, { juste: false }); e = pas(plan, e, { juste: false });
  const f = phaseCourante(plan, e);
  assert.equal(f.id, 'filet'); assert.equal(f.format.lignes, 6);
  for (let k = 0; k < FILET; k++) e = pas(plan, e, { juste: true });
  assert.equal(phaseCourante(plan, e).id, 'reference');
  // Rampe sautée.
  assert.equal(phaseCourante(plan, etatInitial(plan, false, { sansRampe: true })).id, 'reference');
  assert.equal(enduranceAvant(sp('p9-2'), SOUS_PALIERS).id, 'p9-1');
  assert.equal(enduranceAvant(sp('p8-t1'), SOUS_PALIERS), null);
  // Amis : pas de rampe, sansRampe sans effet.
  const amis = phasesLecon(sp('p3-1'));
  assert.equal(phaseCourante(amis, etatInitial(amis, false, { sansRampe: true })).id, 'reference');
  assert.equal(phaseCourante(amis, { ...etatInitial(amis), filet: 2 }).format, null, 'amis : filet au format de la leçon');
});

test('0.41 : jauge pleine, on ne remonte plus ; filet seulement sur une erreur du geste visé', () => {
  const plan = phasesLecon(sp('p3-1'));
  let e = etatInitial(plan);
  for (let k = 0; k < PASSAGE; k++) e = pas(plan, e, { juste: true });
  assert.equal(phaseCourante(plan, e).id, 'montee');
  e = pas(plan, e, { juste: true, jaugePleine: true });
  assert.equal(phaseCourante(plan, e).id, 'reference', 'jauge pleine : retour au format du mini-test');
  for (let k = 0; k < 20; k++) e = pas(plan, e, { juste: true, jaugePleine: true });
  assert.equal(phaseCourante(plan, e).id, 'reference');
  // Deux erreurs hors geste visé : pas de filet ; une juste remet le compte à zéro.
  let f = etatInitial(plan);
  f = pas(plan, f, { juste: false, erreurVisee: false }); f = pas(plan, f, { juste: false, erreurVisee: false });
  assert.equal(phaseCourante(plan, f).id, 'reference');
  f = pas(plan, f, { juste: false }); f = pas(plan, f, { juste: false, erreurVisee: false }); f = pas(plan, f, { juste: false });
  assert.equal(phaseCourante(plan, f).id, 'filet', 'deux erreurs visées, une erreur ailleurs entre les deux ne remet pas à zéro');
});

const h = (t, n = 30) => Array.from({ length: n }, () => ({ ok: 1, t }));
const valide = (ids, extra = {}) => ({ paliers: Object.fromEntries(ids.map((id) => [id, { valide: '2026-01-01' }])), records: {}, motifs: {}, sessions: [], reglages: {}, feuilles: [], ...extra });

test('0.41 : un seul exercice par geste ; surcharge à la place du lièvre ; plateaux des petits amis ignorés au-delà de 4 chiffres de travail', () => {
  const sem = Object.fromEntries(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((k) => [k, Array(12).fill(2)]));
  const ids = ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2'];
  const d = valide(ids, { sessions: [{ date: '2026-11-10', module: 'lecons', total: 10, justes: 10 }], motifs: { '+4:petit': { hist: h(2), sem } } });
  const pl = plateaux(d, '2026-11-21');
  assert.ok(pl.some((x) => x.cle === '+4:petit'), 'plateau détecté');
  const b = exercicesBloc(d, '2026-11-21', { genres: ['vitesse-isole', 'vitesse-melange', 'volume-melange'], cibles: ['+4:petit'], minutes: 12, geste: '+4:petit' });
  const surG = b.filter((x) => gesteExercice(x.id) === '+4:petit');
  assert.equal(surG.length, 1, b.map((x) => x.id).join());
  assert.equal(surG[0].id, 'surcharge:+4:petit');
  // Élève positionné haut (grade visé à 6 chiffres), leçons à 5 chiffres non validées : plus de plateau sur les petits amis.
  const avance = { ...d, records: Object.fromEntries(['10', '9', '8', '7', '6', '5', '4', '3'].map((id) => [`epreuve-${id}`, { reussi: true }])) };
  assert.ok(chiffresTravail(avance) > 4, String(chiffresTravail(avance)));
  assert.ok(!plateaux(avance, '2026-11-21').some((x) => x.cle === '+4:petit'));
});
