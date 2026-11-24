import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apresColonne, etatInitial, phasesLecon, FAUTES_FILET } from '../src/core/phases.js';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { genererPlancheGeste } from '../src/core/planche.js';
import { genererColonneGeste } from '../src/core/colonneGeste.js';
import { avecDelai } from '../src/core/generateur.js';
import { famille } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const appris = new Set([...famille('direct'), ...famille('petit'), ...famille('grand'), ...famille('mixte')]);

test('0.40.16 : filet après 2 erreurs sur le geste visé, ou 3 colonnes fausses de suite quelle qu\'en soit la cause', () => {
  const plan = phasesLecon(sp('p3-3'));
  let e = { ...etatInitial(plan), i: 2 };
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: false });
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: false });
  assert.equal(e.filet, 0, 'deux fautes non localisées : pas encore');
  assert.equal(FAUTES_FILET, 3);
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: false });
  assert.ok(e.filet > 0 && e.causeFilet === 'fautes');
  let f = { ...etatInitial(plan), i: 1 };
  f = apresColonne(plan, f, { juste: false, rapide: false, erreurVisee: true });
  f = apresColonne(plan, f, { juste: false, rapide: false, erreurVisee: true });
  assert.ok(f.filet > 0 && f.causeFilet === 'vise');
  // Une colonne juste remet les compteurs à zéro.
  let g = { ...etatInitial(plan), i: 2 };
  g = apresColonne(plan, g, { juste: false, rapide: false, erreurVisee: false });
  g = apresColonne(plan, g, { juste: false, rapide: false, erreurVisee: false });
  g = apresColonne(plan, g, { juste: true, rapide: true });
  g = apresColonne(plan, g, { juste: false, rapide: false, erreurVisee: false });
  assert.equal(g.filet, 0);
});

test('0.40.16 : planches « seul » à 1 chiffre en 5 lignes possibles pour ±1 petit ami et +7 combiné', () => {
  for (const cible of ['+1:petit', '-1:petit', '+3:petit', '+7:mixte']) {
    const p = avecDelai(4000, () => genererPlancheGeste({ cible, mode: 'seul', chiffres: 1, lignes: 5, colonnes: 10, appris }, 4242));
    assert.ok(p && p.colonnes.length === 10, cible);
  }
});

test('0.40.16 : planches « seul » et « famille » d\'addition : jamais deux soustractions de suite, 30 % de soustractions au plus', () => {
  for (const mode of ['seul', 'famille']) {
    let n = 0, inv = 0;
    for (let i = 0; i < 40; i++) {
      const c = genererColonneGeste({ cible: '+9:grand', mode, chiffres: 1, lignes: 10, appris });
      c.lignes.slice(1).forEach((l, k) => { n++; if (l.op === '-') { inv++; assert.ok(!(k > 0 && c.lignes[k].op === '-'), `${mode} : ${c.lignes.map((x) => x.op + x.n).join(' ')}`); } });
    }
    assert.ok(inv / n <= 0.33, `${mode} : ${inv / n}`);
  }
});

test('0.40.16 : planches à 2 chiffres : peu de nombres ronds ; 10 lignes : nombre de lignes visées variable', () => {
  let n = 0, ronds = 0; const vis = new Set();
  for (let i = 0; i < 40; i++) {
    const c = genererColonneGeste({ cible: '+2:petit', mode: 'seul', chiffres: 2, lignes: 5, appris });
    c.lignes.slice(1).forEach((l) => { n++; if (l.n % 10 === 0) ronds++; });
    const d = genererColonneGeste({ cible: '+9:grand', mode: 'seul', chiffres: 1, lignes: 10, appris });
    vis.add(d.motifsLignes.filter((ms) => ms.includes('+9:grand')).length);
  }
  assert.ok(ronds / n < 0.15, `${ronds}/${n}`);
  assert.ok(vis.size >= 2, [...vis].join());
});

test('0.40.16 : départ libre au-delà des amis à 1 chiffre (p5-1, p2-3) ; format d\'examen inchangé (p5-3)', () => {
  const v1 = (id) => Array.from({ length: 40 }, () => genererExercice(sp(id))).filter((c) => c.motifsLignes[1].some((m) => sp(id).cibles.includes(m))).length;
  assert.ok(v1('p5-1') < 34, 'p5-1');
  assert.ok(v1('p2-3') < 36, 'p2-3');
  const c = genererExercice(sp('p5-3'));
  assert.ok(String(c.lignes[0].n).length <= 3);
});
