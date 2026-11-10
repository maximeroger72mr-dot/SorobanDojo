import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPlanche, genererPlancheGeste, ordonnerEnRampe, ciblesRealisables } from '../src/core/planche.js';
import { colonneValide } from '../src/core/generateur.js';
import { coutColonne } from '../src/core/charge.js';
import { codeDepuisGraine, graineDepuisCode } from '../src/core/hasard.js';
import { TOUS_LES_MOTIFS, famille } from '../src/core/motifs.js';

const AMIS = TOUS_LES_MOTIFS.filter((c) => !c.endsWith(':direct'));
const texte = (p) => JSON.stringify(p.colonnes.map((c) => c.lignes));

test('code de planche : aller-retour, 6 signes sans 0, O, 1 ni I', () => {
  for (const g of [0, 1, 31, 32, 123456, 2 ** 30 - 1]) {
    const code = codeDepuisGraine(g);
    assert.match(code, /^[2-9A-HJ-NP-Z]{6}$/);
    assert.equal(graineDepuisCode(code), g);
    assert.equal(graineDepuisCode(code.toLowerCase()), g);
  }
  assert.equal(graineDepuisCode('ABC'), null);
  assert.equal(graineDepuisCode('ABCDE0'), null);
});

test('même graine, même planche ; graine différente, planche différente', () => {
  const spec = { chiffres: 2, lignes: 5, colonnes: 10, autorises: null, cibles: AMIS };
  for (const g of [1, 99, 2024, 777777]) assert.equal(texte(genererPlanche(spec, g)), texte(genererPlanche(spec, g)));
  assert.notEqual(texte(genererPlanche(spec, 1)), texte(genererPlanche(spec, 2)));
  const geste = { cible: '+4:petit', mode: 'seul', chiffres: 2, lignes: 6, colonnes: 10, appris: new Set(TOUS_LES_MOTIFS) };
  assert.equal(texte(genererPlancheGeste(geste, 5)), texte(genererPlancheGeste(geste, 5)));
});

test('planche mélangée courte : tous les gestes réalisables y sont (2 chiffres, 5 lignes, 10 colonnes)', () => {
  const spec = { chiffres: 2, lignes: 5, colonnes: 10, autorises: null, cibles: AMIS };
  let couverture = 0;
  for (let g = 1; g <= 20; g++) {
    const p = genererPlanche(spec, g * 1009);
    assert.equal(p.colonnes.length, 10);
    assert.ok(p.bilan.couverture >= 0.94, `graine ${g * 1009} : couverture ${p.bilan.couverture}, absents ${p.bilan.absents}`);
    couverture += p.bilan.couverture;
    // Résultats et colonnes tous différents ; charge calculée sur chaque colonne.
    assert.equal(new Set(p.colonnes.map((c) => c.resultat)).size, 10);
    assert.equal(new Set(p.colonnes.map((c) => JSON.stringify(c.lignes))).size, 10);
    for (const c of p.colonnes) assert.equal(c.cout, coutColonne(c.lignes));
  }
  assert.ok(couverture / 20 >= 0.98, `couverture moyenne ${couverture / 20}`);
});

test('planche stricte : jamais un geste hors des gestes permis', () => {
  const cibles = famille('petit');
  const autorises = new Set([...famille('direct'), ...cibles]);
  const p = genererPlanche({ chiffres: 2, lignes: 5, colonnes: 10, autorises, cibles }, 314);
  for (const c of p.colonnes) for (const m of c.motifs) assert.ok(autorises.has(m), m);
  assert.equal(p.bilan.absents.length, 0);
});

test('geste impossible avec ces réglages : écarté et signalé, pas de planche vide', () => {
  // Une retenue en cascade a besoin d'un grand ami pour partir : sans lui, elle est impossible.
  const cibles = ['cascade+', '+3:petit'];
  const autorises = new Set([...famille('direct'), ...cibles]);
  assert.deepEqual(ciblesRealisables({ chiffres: 2, autorises, cibles }), ['+3:petit']);
  const p = genererPlanche({ chiffres: 2, lignes: 5, colonnes: 5, autorises, cibles }, 7);
  assert.deepEqual(p.bilan.replis.find((r) => r.type === 'impossibles').cibles, ['cascade+']);
  assert.equal(p.bilan.couverture, 1);
});

test('rampe : deux colonnes légères d\'abord, la plus lourde avant la dernière', () => {
  const cols = [5, 9, 1, 7, 3, 8, 2, 6, 4, 10].map((cout) => ({ cout }));
  const r = ordonnerEnRampe(cols).map((c) => c.cout);
  assert.deepEqual(r.slice(0, 2), [1, 2]);
  assert.equal(r.at(-2), 10);
  assert.ok(r.at(-1) > 3 && r.at(-1) < 9);
  assert.deepEqual([...r].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(ordonnerEnRampe(cols.slice(0, 5)), cols.slice(0, 5));
});

test('planche « un geste » : jamais abandonnée pour une colonne, sur tous les amis à 1 et 2 chiffres', () => {
  const appris = new Set(TOUS_LES_MOTIFS);
  for (const cible of AMIS.filter((c) => /^[+-]\d:/.test(c))) {
    for (const chiffres of [1, 2]) {
      const p = genererPlancheGeste({ cible, mode: 'seul', chiffres, lignes: 6, colonnes: 10, appris }, 4242);
      assert.ok(p, `${cible} à ${chiffres} chiffre(s) : planche abandonnée`);
      assert.equal(p.colonnes.length, 10);
      for (const c of p.colonnes) assert.ok(c.motifs.includes(cible), `${cible} absent d'une colonne`);
    }
  }
});

test('règles de variété : passage par zéro, unités répétées, nombres à chiffres identiques', () => {
  const col = (...ls) => ({ lignes: ls.map(([op, n]) => ({ op, n })) });
  assert.equal(colonneValide(col(['+', 25], ['+', 13], ['-', 38], ['+', 41], ['+', 17]), [], true), false, 'sous-total nul');
  assert.equal(colonneValide(col(['+', 25], ['+', 13], ['+', 43], ['-', 23], ['+', 17]), [], true), false, 'trois unités identiques');
  assert.equal(colonneValide(col(['+', 125], ['+', 333], ['+', 217], ['+', 111], ['-', 204]), [], true), false, 'deux nombres à chiffres identiques');
  assert.equal(colonneValide(col(['+', 25], ['+', 13], ['+', 46], ['-', 21], ['+', 17]), [], true), true);
  // À 1 chiffre, le passage par zéro reste permis (trop peu de colonnes possibles sinon).
  assert.equal(colonneValide(col(['+', 5], ['-', 5], ['+', 3], ['+', 4], ['-', 2]), [], true), true);
});
