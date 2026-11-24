import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apresColonne, etatInitial, phasesLecon } from '../src/core/phases.js';
import { SOUS_PALIERS, genererExercice } from '../src/core/curriculum.js';
import { genererPlancheGeste, genererPlanche } from '../src/core/planche.js';
import { avecDelai, chiffresIdentiques } from '../src/core/generateur.js';
import { famille, TOUS_LES_MOTIFS } from '../src/core/motifs.js';

const sp = (id) => SOUS_PALIERS.find((s) => s.id === id);
const appris = new Set(TOUS_LES_MOTIFS);

test('0.40.17 : planches « un geste » à plusieurs chiffres construites tige par tige : rapides, sans colonne allongée', () => {
  // Avant : « +1 petit ami seul, 3 chiffres, 10 lignes » ne se formait pas en 10 s.
  for (const [cible, mode, chiffres, lignes] of [['+1:petit', 'seul', 3, 10], ['+9:mixte', 'famille', 2, 10], ['-6:grand', 'seul', 3, 7], ['+4:grand', 'famille', 4, 10]]) {
    const t0 = performance.now();
    const p = avecDelai(4000, () => genererPlancheGeste({ cible, mode, chiffres, lignes, colonnes: 10, appris }, 4242));
    assert.ok(p, `${cible} ${mode} ${chiffres} ch.`);
    assert.ok(performance.now() - t0 < 4000);
    // Longueurs mêlées autour du réglage (±1 ligne) ; allongée au-delà : une colonne au plus.
    assert.ok(p.colonnes.filter((c) => c.lignes.length > lignes + 1).length <= 1, `${cible} : ${p.colonnes.map((c) => c.lignes.length)}`);
    for (const c of p.colonnes) {
      assert.ok(!c.simple);
      assert.ok(c.motifs.includes(cible));
      assert.ok(!c.lignes.slice(1).some((l) => chiffresIdentiques(l.n) && l.n >= 11 && String(l.n).length === chiffres && chiffres >= 3), 'pas de 333');
    }
  }
});

test('0.40.17 : planches « un geste » à 1 chiffre : la fin de la colonne reste faisable (plus d\'impasse ni d\'allongement)', () => {
  for (const [cible, mode, lignes] of [['+1:petit', 'seul', 5], ['-1:petit', 'seul', 5], ['+9:mixte', 'seul', 5], ['-9:mixte', 'seul', 5], ['+9:mixte', 'famille', 10]]) {
    const p = avecDelai(4000, () => genererPlancheGeste({ cible, mode, chiffres: 1, lignes, colonnes: 10, appris }, 77));
    assert.ok(p, `${cible} ${mode}`);
    assert.ok(p.colonnes.filter((c) => c.lignes.length > lignes + 1).length <= 1, `${cible} : ${p.colonnes.map((c) => c.lignes.length)}`);
    // Résultats variés (±9 combiné en 5 lignes : un seul chemin, le total finit toujours par le même chiffre).
    assert.ok(new Set(p.colonnes.map((c) => c.resultat)).size >= 5, `${cible} : ${p.colonnes.map((c) => c.resultat)}`);
  }
});

test('0.40.17 : planche de soustraction à 10 lignes : jamais deux additions de suite', () => {
  const p = genererPlancheGeste({ cible: '-4:petit', mode: 'seul', chiffres: 2, lignes: 10, colonnes: 10, appris }, 9);
  for (const c of p.colonnes) {
    const ops = c.lignes.slice(1).map((l) => l.op);
    assert.ok(!ops.some((o, i) => o === '+' && ops[i - 1] === '+'), ops.join(''));
  }
});

test('0.40.17 : planche « cascades » avec tous les gestes appris : elle se forme (2 chiffres et plus)', () => {
  const cibles = famille('cascade');
  for (const chiffres of [2, 3]) {
    const p = avecDelai(4000, () => genererPlanche({ chiffres, lignes: 5, colonnes: 10, autorises: appris, cibles }, 5));
    assert.equal(p.colonnes.length, 10);
    assert.ok(p.colonnes.filter((c) => c.motifs.some((m) => m.startsWith('cascade'))).length >= 8);
  }
});

test('0.40.17 : filet : une faute hors geste visé coupe la série « deux erreurs de suite sur le geste visé »', () => {
  const plan = phasesLecon(sp('p3-3'));
  let e = { ...etatInitial(plan), i: 1 };
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: true });
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: false });
  e = apresColonne(plan, e, { juste: false, rapide: false, erreurVisee: true });
  assert.notEqual(e.causeFilet, 'vise');
  assert.equal(e.causeFilet, 'fautes', 'trois colonnes fausses de suite');
});

test('0.40.17 : leçons : peu de nombres ronds, geste visé moins souvent en ligne 1, cascades mieux équilibrées', () => {
  const ronds = (id) => {
    let n = 0; let r = 0;
    for (let k = 0; k < 120; k++) for (const l of genererExercice(sp(id), {}).lignes.slice(1)) { n += 1; if (l.n % 10 === 0) r += 1; }
    return r / n;
  };
  for (const id of ['p2-3', 'p2-6', 'p4-4']) assert.ok(ronds(id) < 0.11, `${id} : ${Math.round(ronds(id) * 100)} %`);
  const l1 = (id) => {
    let k1 = 0;
    for (let k = 0; k < 150; k++) { const ex = genererExercice(sp(id), {}); if (ex.motifsLignes[1].some((m) => sp(id).cibles.includes(m))) k1 += 1; }
    return k1 / 150;
  };
  for (const id of ['p3-1', 'p4-1']) assert.ok(l1(id) < 0.7, `${id} : ligne 1 visée ${Math.round(l1(id) * 100)} %`);
  let plus = 0; let moins = 0;
  for (let k = 0; k < 150; k++) for (const m of genererExercice(sp('p5-4'), {}).motifs) { if (m === 'cascade+') plus += 1; if (m === 'cascade-') moins += 1; }
  assert.ok(moins >= 0.3 * plus, `cascades : ${plus} en addition, ${moins} en soustraction`);
});

test('0.40.17 : colonnes d\'endurance créées vite (plus de recherche d\'un autre ami impossible)', () => {
  const plan = phasesLecon(sp('p4-1'));
  const f = plan.ordre.find((x) => x.id === 'endurance').format;
  genererExercice(sp('p4-1'), {}, { format: f });
  const t0 = performance.now();
  for (let k = 0; k < 30; k++) genererExercice(sp('p4-1'), {}, { format: f });
  assert.ok((performance.now() - t0) / 30 < 150, `${((performance.now() - t0) / 30).toFixed(0)} ms par colonne`);
});

test('0.40.17 : p9-2 raccourcie (14 répétitions)', () => {
  assert.equal(sp('p9-2').repetitions, 14);
});
