import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciblesPures, genererColonne, analyserOperation } from '../src/core/generateur.js';
import { famille } from '../src/core/motifs.js';
import { plateau, ajouterSemaine, lundi } from '../src/core/maitrise.js';
import { lireReponse } from '../src/core/nombres.js';
import { SORTES } from '../src/core/quotidien.js';
import { planObjectif, consolidationDuJour, prioriteDuJour } from '../src/core/parcours.js';
import { genererNegatif } from '../src/core/curriculum.js';

/** Motifs de chaque ligne (hors 1re, posée). */
function motifsLignes(col) {
  let v = col.lignes[0].n;
  return col.lignes.slice(1).map((l) => { const a = analyserOperation(v, l.op, l.n, 12); v = a.resultat; return a.motifs; });
}

test('mode pur : aucun geste direct, miroir ajouté si besoin', () => {
  const p = ciblesPures(['+4:petit'], 1);
  assert.deepEqual(p.ajoutes, ['-4:petit']);
  for (let i = 0; i < 20; i++) {
    const col = genererColonne({ chiffres: 1, lignes: 8, autorises: p.autorises, cibles: p.cibles });
    for (const m of motifsLignes(col).flat()) assert.ok(['+4:petit', '-4:petit'].includes(m), m);
  }
  // Grands amis : seule la retenue (±1 direct) est tolérée en plus.
  const g = ciblesPures(famille('grand'), 2);
  for (let i = 0; i < 10; i++) {
    const col = genererColonne({ chiffres: 2, lignes: 6, autorises: g.autorises, cibles: g.cibles });
    for (const m of motifsLignes(col).flat()) assert.ok(m.endsWith(':grand') || m === '+1:direct' || m === '-1:direct', m);
  }
});

test('plateau : détecté quand le temps ne baisse plus depuis 2 semaines', () => {
  const f = {};
  const remplir = (date, t) => { for (let i = 0; i < 12; i++) ajouterSemaine(f, t, date); };
  remplir('2026-10-05', 2.0);
  remplir('2026-10-19', 1.98);
  assert.ok(plateau(f.sem, '2026-10-21'));
  const g = {};
  for (let i = 0; i < 12; i++) ajouterSemaine(g, 2.0, '2026-10-05');
  for (let i = 0; i < 12; i++) ajouterSemaine(g, 1.6, '2026-10-19');
  assert.equal(plateau(g.sem, '2026-10-21'), null, 'progrès de 20 % : pas de plateau');
  assert.equal(plateau(f.sem, '2026-12-01'), null, 'pas pratiqué récemment');
  assert.equal(lundi('2026-11-04'), '2026-11-02');
});

test('priorité du jour : plateau d\'abord, sinon geste faible, sinon geste lent', () => {
  const d = { motifs: {}, paliers: { 'p2-1': { valide: '2026-10-01' } }, sessions: [], records: {} };
  assert.equal(prioriteDuJour(d, '2026-10-21'), null);
  const f = (d.motifs['+4:petit'] = { essais: 30, erreurs: 0, dette: 0, hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 2 })) });
  for (let i = 0; i < 12; i++) ajouterSemaine(f, 2, '2026-10-05');
  for (let i = 0; i < 12; i++) ajouterSemaine(f, 2, '2026-10-19');
  const p = prioriteDuJour(d, '2026-10-21');
  assert.match(p.raison, /stagne/);
  assert.ok(['rythme', 'drills'].includes(p.aller[0]));
  delete f.sem;
  const lent = prioriteDuJour(d, '2026-10-21');
  assert.equal(lent.aller[1].jeu, 'marathon');
  const faible = prioriteDuJour(d, '2026-10-21', [{ cle: '+3:petit', erreurs: 4 }]);
  assert.deepEqual(faible.aller[1].cibles, ['+3:petit']);
});

test('réponses négatives et au quotidien (calculs exacts en centimes)', () => {
  assert.equal(lireReponse('-37'), -37);
  assert.equal(lireReponse('−37'), -37);
  assert.equal(lireReponse('12,5', 2), 12.5);
  for (let i = 0; i < 50; i++) {
    const n = genererNegatif(2, 4);
    assert.ok(n.resultat < 0 && n.resultat > -100);
    for (const s of Object.values(SORTES)) {
      const ex = s.generer();
      assert.ok(Number.isFinite(ex.resultat) && ex.resultat > 0);
      assert.ok(Math.abs(ex.resultat * 100 - Math.round(ex.resultat * 100)) < 1e-6, `${ex.resultat}`);
      if (ex.echelles) assert.equal(ex.echelles.reduce((a, b) => a + b, 0), Math.round(ex.resultat * 100));
    }
  }
});

test('objectif daté et consolidation', () => {
  const d = { motifs: {}, paliers: { 'p1-1': { valide: '2026-10-20' }, 'p2-1': { valide: '2026-10-30' } }, sessions: [], records: {} };
  const p = planObjectif(d, '10', '2027-02-01', '2026-11-04');
  assert.ok(p.manquantes > 10 && p.jours === 89 && p.parSemaine > 0);
  assert.equal(p.rythme, 0.5);
  assert.equal(consolidationDuJour(d, '2026-11-04').id, 'p2-1');
  d.sessions.push({ date: '2026-11-01', mode: 'consolidation:p2-1' });
  assert.equal(consolidationDuJour(d, '2026-11-04'), null);
});
