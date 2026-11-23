import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice, amisAppris } from '../src/core/curriculum.js';
import { phasesLecon } from '../src/core/phases.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const interdit = (m) => m.endsWith(':mixte') || m.startsWith('cascade');

test('0.40.9 : pas de combinaison de deux amis ni de cascade avant p5, dans aucune phase', () => {
  for (const s of SOUS_PALIERS.filter((x) => ['p1', 'p2', 'p3', 'p4'].includes(x.palier?.id) && x.type === 'addsub' && !x.mental)) {
    assert.ok(![...(s.autorises ?? [])].some(interdit), `${s.id} : autorisés`);
    assert.ok(!(amisAppris(s) ?? []).some(interdit), `${s.id} : amis appris`);
    const plan = phasesLecon(s);
    for (const ph of plan?.ordre ?? [{ format: null }]) {
      for (let i = 0; i < 6; i++) {
        const c = genererExercice(s, {}, ph.format ? { format: ph.format } : {});
        assert.ok(!c.motifs.some(interdit), `${s.id} ${ph.id ?? ''} : ${c.motifs.filter(interdit)}`);
      }
    }
  }
});

test('0.40.9 : un autre ami déjà appris, une ligne au plus, en endurance seulement (petits amis)', () => {
  assert.equal(amisAppris(sp('p2-1')), null, 'première leçon de petits amis : aucun autre');
  const am3 = amisAppris(sp('p3-2'));
  assert.ok(am3.includes('+4:petit') && am3.includes('+9:grand') && !am3.includes('+7:grand'));
  // 0.40.10 : à partir des grands amis, voir lot0410 ; ici, les petits amis (p2).
  const am = amisAppris(sp('p2-5'));
  const plan = phasesLecon(sp('p2-5'));
  const nb = (c) => c.motifsLignes.slice(1).filter((ms) => ms.some((m) => am.includes(m))).length;
  for (const ph of plan.ordre) {
    const cols = Array.from({ length: 40 }, () => genererExercice(sp('p2-5'), {}, ph.format ? { format: ph.format } : {}));
    if (ph.id === 'endurance') {
      assert.ok(cols.every((c) => nb(c) <= 1));
      assert.ok(cols.filter((c) => nb(c) === 1).length >= 30);
    } else assert.ok(cols.every((c) => nb(c) === 0), `${ph.id} : pas d'autre ami`);
  }
});
