import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { phasesLecon } from '../src/core/phases.js';
import { sensUnique, PART_INVERSE, genererColonne } from '../src/core/generateur.js';
import { genererColonneGeste, creerMemoirePlanche } from '../src/core/colonneGeste.js';
import { famille } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const lignesOp = (cols) => cols.flatMap((c) => c.lignes.slice(1));

test('0.40.7 : sens unique des gestes visés ; réglage de la part inverse', () => {
  assert.equal(sensUnique(sp('p3-1').cibles), '+');
  assert.equal(sensUnique(sp('p4-1').cibles), '-');
  assert.equal(sensUnique(sp('p5-3').cibles), null, 'leçon mixte : rien ne change');
  assert.equal(sensUnique(sp('p1-1').cibles, ['+']), null, 'additions seules (p1-1)');
  assert.equal(PART_INVERSE, 0.25);
  const sans = Array.from({ length: 60 }, () => genererColonne({ chiffres: 2, lignes: 6, autorises: sp('p3-4').autorises, cibles: sp('p3-4').cibles, partInverse: 0 }));
  const avec = Array.from({ length: 60 }, () => genererColonne({ chiffres: 2, lignes: 6, autorises: sp('p3-4').autorises, cibles: sp('p3-4').cibles }));
  const part = (cols) => lignesOp(cols).filter((l) => l.op === '-').length / lignesOp(cols).length;
  assert.ok(part(avec) > part(sans) + 0.08, `${part(sans)} → ${part(avec)}`);
});

test('0.40.7 : leçon d\'addition, soustractions jamais de suite ; total plafonné ; jamais sous zéro en soustraction', () => {
  for (const id of ['p3-1', 'p3-4']) {
    const cols = Array.from({ length: 80 }, () => genererExercice(sp(id)));
    const L = cols.map((c) => c.lignes.slice(1));
    assert.ok(L.every((ls) => ls.every((l, k) => !(k && l.op === '-' && ls[k - 1].op === '-'))), `${id} : deux soustractions de suite`);
    assert.ok(lignesOp(cols).filter((l) => l.op === '-').length / lignesOp(cols).length >= 0.12, `${id} : trop peu de soustractions`);
    assert.ok(cols.every((c) => c.resultat < 10 ** (Math.max(...c.lignes.slice(1).map((l) => String(l.n).length)) + 1)), `${id} : plafond`);
  }
  for (const c of Array.from({ length: 80 }, () => genererExercice(sp('p4-1')))) {
    let v = 0;
    for (const l of c.lignes) { v += l.op === '+' ? l.n : -l.n; assert.ok(v >= 0); }
  }
});

test('0.40.7 : lignes de dizaines hors format de référence, une par colonne au plus', () => {
  const plan = phasesLecon(sp('p3-1'));
  const montee = plan.ordre.find((x) => x.id === 'montee').format;
  const ref = Array.from({ length: 60 }, () => genererExercice(sp('p3-1')));
  assert.ok(ref.every((c) => c.lignes.slice(1).every((l) => l.n < 10)), 'référence : 1 chiffre');
  const m = Array.from({ length: 60 }, () => genererExercice(sp('p3-1'), {}, { format: montee }));
  const diz = m.map((c) => c.lignes.slice(1).filter((l) => l.n >= 10));
  assert.ok(diz.every((d) => d.length <= 1 && d.every((l) => l.op === '-' && l.n % 10 === 0 && l.n <= 40)));
  assert.ok(diz.filter((d) => d.length).length > 30, 'souvent une ligne de dizaines en montée');
  // Planche ciblée à 1 chiffre : au plus une ligne de dizaines, de sens inverse.
  const appris = new Set([...famille('direct'), ...famille('petit'), ...famille('grand')]);
  const mem = creerMemoirePlanche();
  for (let k = 0; k < 20; k++) {
    const c = genererColonneGeste({ cible: '+9:grand', mode: 'seul', chiffres: 1, lignes: 6, appris }, mem);
    const d = c.lignes.slice(1).filter((l) => l.n >= 10);
    assert.ok(d.length <= 1 && d.every((l) => l.op === '-'));
  }
});
