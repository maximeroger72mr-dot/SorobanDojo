import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { phasesLecon } from '../src/core/phases.js';
import { chiffresIdentiques, genererColonneVariee, creerMemoire } from '../src/core/generateur.js';
import { genererColonneGeste } from '../src/core/colonneGeste.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const format = (id, ph) => phasesLecon(sp(id)).ordre.find((x) => x.id === ph).format;
const lignesVisees = (s, c) => c.motifsLignes.filter((ms) => ms.some((m) => s.cibles.includes(m))).length;

test('0.40.12 : p4-4 en endurance ne part plus toujours de 999', () => {
  const departs = new Set(Array.from({ length: 30 }, () => genererExercice(sp('p4-4'), {}, { format: format('p4-4', 'endurance') }).lignes[0].n));
  assert.ok(departs.size >= 10, `${departs.size} départs différents`);
  assert.ok(![...departs].some(chiffresIdentiques));
});

test('0.40.12 : anzan p4-a à 2 nombres : un grand ami en soustraction, sans mode dégradé', () => {
  const s = sp('p4-a');
  const cols = Array.from({ length: 30 }, () => genererExercice(s, {}, { lignes: 2 }));
  assert.ok(cols.every((c) => c.gestesAnzan.some((m) => s.cibles.includes(m))));
  assert.ok(cols.filter((c) => c.assoupli).length <= 3);
});

test('0.40.12 : au moins 2 lignes visées en montée et en endurance (3 à 2 chiffres)', () => {
  for (const [id, ph, min] of [['p2-2', 'montee', 2], ['p2-2', 'endurance', 2], ['p3-3', 'montee', 2], ['p3-3', 'endurance', 3], ['p4-2', 'endurance', 3]]) {
    const s = sp(id);
    const cols = Array.from({ length: 30 }, () => genererExercice(s, {}, { format: format(id, ph) }));
    assert.ok(cols.filter((c) => lignesVisees(s, c) >= min).length >= 28, `${id} ${ph}`);
  }
});

test('0.40.12 : places réservées aux autres amis : le geste visé ne prend plus presque toutes les lignes', () => {
  const s = sp('p3-1');
  let n = 0, v = 0;
  for (let i = 0; i < 40; i++) { const c = genererExercice(s, {}, { format: format('p3-1', 'endurance') }); n += c.lignes.length - 1; v += lignesVisees(s, c); }
  assert.ok(v / n < 0.6, `p3-1 endurance : ${v / n}`);
});

test('0.40.12 : départ à 2 chiffres en leçon d\'addition à 2 chiffres (endurance)', () => {
  const cols = Array.from({ length: 30 }, () => genererExercice(sp('p3-2'), {}, { format: format('p3-2', 'endurance') }));
  assert.ok(cols.every((c) => c.lignes[0].n >= 10 && c.lignes[0].n <= 99));
});

test('0.40.12 : ligne ajoutée pour un résultat neuf : liste des gestes alignée', () => {
  const mem = creerMemoire(3);
  for (let i = 0; i < 60; i++) {
    const c = genererColonneVariee({ chiffres: 1, lignes: 3, cibles: ['+4:petit'] }, mem);
    assert.equal(c.motifsLignes.length, c.lignes.length);
  }
});

test('0.40.12 : planches « seul » à 2 chiffres : pas de 44, 88', () => {
  let n = 0, r = 0;
  for (let i = 0; i < 30; i++) { const c = genererColonneGeste({ cible: '+4:petit', mode: 'seul', chiffres: 2, lignes: 6 }); n += c.lignes.length; r += c.lignes.filter((l) => chiffresIdentiques(l.n)).length; }
  assert.ok(r / n < 0.03, `${r}/${n}`);
});
