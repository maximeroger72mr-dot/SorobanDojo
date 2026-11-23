import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice, amisAppris } from '../src/core/curriculum.js';
import { phasesLecon, PART_AMIS } from '../src/core/phases.js';
import { sensUnique } from '../src/core/generateur.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);

/** Répartition des lignes (après la première) : geste visé, autre ami, direct ; part inverse. */
function repartition(s, format, n = 120) {
  const am = amisAppris(s);
  const sens = sensUnique(s.cibles, s.ops);
  const r = { lignes: 0, vise: 0, ami: 0, inverse: 0, suite: 0, parCol: [] };
  for (let i = 0; i < n; i++) {
    const c = genererExercice(s, {}, format ? { format } : {});
    let a = 0;
    c.lignes.slice(1).forEach((l, k) => {
      const ms = c.motifsLignes[k + 1] ?? [];
      r.lignes++;
      if (ms.some((m) => s.cibles.includes(m))) r.vise++;
      else if (ms.some((m) => am.includes(m))) { r.ami++; a++; }
      if (l.op !== sens) { r.inverse++; if (sens === '+' && k > 0 && c.lignes[k].op === '-') r.suite++; }
    });
    r.parCol.push(a);
  }
  return r;
}

test('0.40.10 : grands amis, les autres amis remplacent les directs (montée, endurance), pas le geste visé', () => {
  assert.deepEqual(PART_AMIS, { montee: [0.2, 0.4], endurance: [0.45, 0.65] });
  for (const id of ['p3-3', 'p4-3']) {
    const plan = phasesLecon(sp(id));
    const [ref, mon, end] = plan.ordre.map((ph) => repartition(sp(id), ph.format));
    assert.equal(ref.ami, 0, `${id} : référence inchangée`);
    assert.ok(mon.ami / mon.lignes >= 0.15, `${id} montée : ${mon.ami / mon.lignes}`);
    assert.ok(end.ami / end.lignes >= 0.3, `${id} endurance : ${end.ami / end.lignes}`);
    assert.ok(end.ami / end.lignes > mon.ami / mon.lignes, `${id} : plus d'amis en endurance qu'en montée`);
    // Le geste visé garde sa place (la leçon ne s'allonge pas).
    assert.ok(end.vise / end.lignes >= 0.22, `${id} endurance, geste visé : ${end.vise / end.lignes}`);
    // Pas de proportion fixe : le nombre d'amis varie d'une colonne à l'autre.
    assert.ok(new Set(end.parCol).size >= 3, `${id} : ${[...new Set(end.parCol)]}`);
    // Sens inverse contenu, jamais deux soustractions de suite en leçon d'addition.
    assert.ok(end.inverse / end.lignes <= 0.4, `${id} inverse : ${end.inverse / end.lignes}`);
    assert.equal(end.suite, 0);
  }
});

test('0.40.10 : petits amis (p2) inchangés : rien en montée, une ligne au plus en endurance', () => {
  const plan = phasesLecon(sp('p2-4'));
  assert.ok(!plan.ordre[1].format.amis && !plan.ordre[2].format.partAmis);
  assert.ok(phasesLecon(sp('p3-1')).ordre[2].format.partAmis);
});
