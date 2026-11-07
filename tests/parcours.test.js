import { catalogueDrills, famillesDrill, chiffresDrill, classement, tempsClassement, tigesFausses } from '../src/core/drills.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, drillEchauffement, defiSemaine, motifsAppris } from '../src/core/parcours.js';
import { SOUS_PALIERS } from '../src/core/curriculum.js';

const vide = () => ({ paliers: {}, records: {}, motifs: {}, sessions: [] });

test('grade : prochain conseillé et leçons manquantes', () => {
  const d = vide();
  const g = grade(d);
  assert.equal(g.obtenu, null);
  assert.equal(g.prochain.id, '10');
  assert.ok(g.manquantes.length > 20 && !g.pret);
  for (const sp of SOUS_PALIERS) d.paliers[sp.id] = { valide: '2026-11-01' };
  d.records['epreuve-10'] = { reussi: true };
  d.records['epreuve-9'] = { reussi: true };
  assert.equal(grade(d).obtenu.id, '9');
  assert.equal(grade(d).prochain.id, '8');
  assert.ok(grade(d).pret);
});

test('échauffement : le prochain drill à valider, jamais un geste pas encore appris', () => {
  const d = vide();
  assert.equal(drillEchauffement(d).id, 'directs');
  // Petits amis appris, deux premiers drills validés : on passe au suivant, pas à 12 × 9.
  for (const id of ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2', 'p2-3', 'p2-4', 'p2-5', 'p2-6', 'p2-7']) d.paliers[id] = { valide: '2026-11-01' };
  d.drills = { directs: { validations: 2 }, '123-1': { validations: 2 } };
  assert.equal(drillEchauffement(d).id, 'r-4');
  const liste = catalogueDrills();
  const avant = liste.filter((x) => x.groupe === 'Avant les grands amis');
  for (const x of avant) d.drills[x.id] = { validations: 2 };
  // Tout le groupe validé, mais pas de grands amis : on reste sur le dernier drill accessible.
  assert.equal(drillEchauffement(d).id, 'tour-petits');
  for (const x of avant) assert.deepEqual(famillesDrill(x).filter((f) => f !== 'petit'), [], x.id);
  // Tout appris et tout validé : le plus long drill, pour améliorer son classement.
  for (const sp of SOUS_PALIERS) d.paliers[sp.id] = { valide: '2026-11-01' };
  for (const x of liste) d.drills[x.id] = { validations: 2 };
  assert.equal(drillEchauffement(d).id, liste.at(-1).id);
});

test('classement des drills : bronze, argent, or, platine', () => {
  const d = catalogueDrills().find((x) => x.id === 'r-4');
  assert.equal(chiffresDrill(d), 36);
  assert.equal(classement(d, 50000), null);
  assert.equal(classement(d, 46000).id, 'bronze');
  assert.equal(classement(d, 15000).id, 'or');
  assert.equal(classement(d, 9000).id, 'platine');
  // Pondéré par les gestes : les gestes directs vont plus vite que les grands amis.
  const directs = catalogueDrills().find((x) => x.id === 'directs');
  const neuf = catalogueDrills().find((x) => x.id === '123-9');
  assert.ok(tempsClassement(directs, 'platine') <= 15000);
  assert.ok(tempsClassement(neuf, 'or') <= 60000 && tempsClassement(neuf, 'platine') <= 40000);
});

test('drill : les tiges fausses sont repérées', () => {
  assert.deepEqual(tigesFausses(1111111101, 1111111101), []);
  assert.deepEqual(tigesFausses(1111111111, 1111111101), ['dizaines']);
  assert.deepEqual(tigesFausses(5050, 5150), ['centaines']);
});

test('défi de la semaine : identique toute la semaine, strict sur les gestes appris', () => {
  const d = vide();
  d.paliers['p2-1'] = { valide: '2026-11-01' };
  const a = defiSemaine(d, '2026-11-02');
  const b = defiSemaine(d, '2026-11-06');
  assert.deepEqual(a.sections, b.sections);
  assert.notDeepEqual(defiSemaine(d, '2026-11-10').sections, a.sections);
  assert.ok(motifsAppris(d).has('+4:petit'));
  for (const p of a.sections[0].problemes) assert.ok(p.motifs.every((m) => motifsAppris(d).has(m)), String(p.motifs));
});

import { placementDuJour } from '../src/core/parcours.js';
import { sousPalier } from '../src/core/curriculum.js';

test('placement proposé seulement à partir du cours de multiplication', () => {
  const d = vide();
  assert.equal(placementDuJour(d, '2026-11-10', sousPalier('p3-1')), null);
  assert.equal(placementDuJour(d, '2026-11-10', sousPalier('p6-1')).id, 'p6-0');
  assert.equal(placementDuJour(d, '2026-11-10', sousPalier('p7-2')).id, 'p7-0');
  d.paliers['p7-0'] = { valide: '2026-11-01' };
  assert.equal(placementDuJour(d, '2026-11-10', sousPalier('p8-1')).id, 'p7-0');
  assert.equal(placementDuJour(d, '2026-11-30', sousPalier('p8-1')), null);
});
