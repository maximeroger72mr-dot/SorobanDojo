import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserOperation } from '../src/core/generateur.js';
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

test('« −2 petit ami » / « parmi les petits amis » : rôles, pièges, variété de la planche', async () => {
  const { genererColonneGeste, creerMemoirePlanche, libellesModes } = await import('../src/core/colonneGeste.js');
  const { colonneValide } = await import('../src/core/generateur.js');
  const appris = new Set([...famille('direct'), ...famille('petit'), ...famille('grand'), ...famille('mixte')]);
  assert.deepEqual(libellesModes('-2:petit'), { seul: '−2 petit ami', famille: '−2 parmi les petits amis' });
  for (const [cible, mode, ch] of [['-2:petit', 'seul', 1], ['-2:petit', 'famille', 1], ['-2:petit', 'seul', 2], ['+9:grand', 'seul', 1], ['+7:mixte', 'famille', 2]]) {
    const m = creerMemoirePlanche();
    const formes = new Set();
    let pieges = 0;
    for (let k = 0; k < 10; k++) {
      const col = genererColonneGeste({ cible, mode, chiffres: ch, lignes: 6, appris }, m);
      const ms = col.motifsLignes.slice(1);
      // Le geste 2 fois (ou 3), jamais deux lignes de suite ; règles de qualité respectées.
      const g = ms.filter((x) => x.includes(cible)).length;
      assert.ok(g >= 2 && g <= 3, `${cible} : geste ${g} fois`);
      for (let i = 1; i < ms.length; i++) assert.ok(!(ms[i].includes(cible) && ms[i - 1].includes(cible)), `${cible} : deux fois de suite`);
      assert.ok(colonneValide(col, [cible], true), `${cible} : ${col.lignes.map((l) => l.op + l.n).join(' ')}`);
      // Lignes « directes » : que des gestes directs. Famille : d'autres amis de la famille.
      col.roles.forEach((r, i) => { if (r === 'D') assert.ok(ms[i].every((x) => x.endsWith(':direct')), `${cible} : ${ms[i]}`); });
      if (mode === 'famille') assert.ok(col.roles.includes('F'), `${cible} : pas d'autre ami de la famille`);
      pieges += col.roles.filter((r) => r === 'P').length;
      formes.add(col.lignes.slice(1).map((l) => l.op + l.n).join());
    }
    assert.ok(pieges >= 3, `${cible} ${mode} ${ch} : ${pieges} pièges sur 10 colonnes`);
    assert.ok(formes.size >= 9, `${cible} ${mode} ${ch} : ${formes.size} formes différentes sur 10`);
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

import { evaluer } from '../src/core/maitrise.js';
import { formaterValeur } from '../src/ui/enonce.js';

test('corrections 0.10.1 : unités, montants, succès de palier', async () => {
  const ev = evaluer(Array.from({ length: 10 }, () => ({ ok: 1, t: 5 })), 'photo');
  assert.ok(ev.manque.every((m) => !m.includes('undefined')), ev.manque.join());
  const { SUCCES } = await import('../src/core/succes.js');
  for (const p of ['pd', 'p8', 'pa']) assert.ok(SUCCES.some((s) => s.id === `palier-${p}`), p);
  const { ticket, monnaie } = await import('../src/core/quotidien.js');
  const t = ticket();
  assert.equal(t.ticket.length, t.lignes.length);
  assert.ok(monnaie().euros && t.euros);
  assert.match(formaterValeur({ euros: true }, 76.6), /^76,60\s€$/);
});
