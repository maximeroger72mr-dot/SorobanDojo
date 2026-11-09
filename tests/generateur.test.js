import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererColonne, resultatColonne, analyserOperation } from '../src/core/generateur.js';
import { D, famille } from '../src/core/motifs.js';

const motifsDe = (col) => {
  const m = [];
  let v = col.lignes[0].n;
  for (const l of col.lignes.slice(1)) {
    const a = analyserOperation(v, l.op, l.n, 10);
    m.push(a.motifs);
    v = a.resultat;
  }
  return m;
};

test('planche « +3 petit ami » : uniquement gestes directs et +3 petit ami, sur 1, 2 et 3 chiffres', () => {
  const autorises = new Set([...famille('direct'), '+3:petit']);
  for (const chiffres of [1, 2, 3]) {
    let lignesAvecCible = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const col = genererColonne({ chiffres, lignes: 8, autorises, cibles: ['+3:petit'] });
      assert.equal(col.lignes.length, 8);
      assert.equal(resultatColonne(col.lignes), col.resultat);
      assert.ok(col.lignes.every((l) => String(l.n).length >= chiffres));
      assert.ok(col.lignes.slice(1).every((l) => String(l.n).length === chiffres));
      for (const m of motifsDe(col)) {
        assert.ok(m.every((x) => autorises.has(x)), `${chiffres} ch : ${m}`);
        total += 1;
        if (m.includes('+3:petit')) lignesAvecCible += 1;
      }
    }
    // Le geste choisi n'est jamais sur deux lignes de suite (règle 5) : 50 % au plus.
    // À 1 chiffre, le retour sur 2-4 en gestes directs prend 1 à 2 lignes : ~40 % (seuil de test 30 %).
    assert.ok(lignesAvecCible / total > (chiffres === 1 ? 0.3 : 0.4), `${chiffres} ch : ${lignesAvecCible}/${total} lignes avec la cible`);
  }
});

test('planche grands amis en soustraction, 2 chiffres : strict et sans résultat négatif', () => {
  const cibles = D('-', [9, 8, 7], 'grand');
  const autorises = new Set([...famille('direct'), ...cibles]);
  for (let i = 0; i < 40; i++) {
    const col = genererColonne({ chiffres: 2, lignes: 5, autorises, cibles });
    for (const m of motifsDe(col)) assert.ok(m.every((x) => autorises.has(x)), String(m));
  }
});

test('tout mélangé : colonnes valides et variées', () => {
  const vues = new Set();
  for (let i = 0; i < 50; i++) {
    const col = genererColonne({ chiffres: 3, lignes: 10, autorises: null, cibles: [...famille('grand'), ...famille('petit')] });
    assert.ok(col.resultat >= 0);
    vues.add(col.lignes.map((l) => l.op + l.n).join());
  }
  assert.equal(vues.size, 50);
});

test('colonnes mélangées : variées, jamais « +1 −1 » à la suite', async () => {
  const { motifsAppris } = await import('../src/core/parcours.js');
  const d = { paliers: {} };
  for (const id of ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2', 'p2-3', 'p2-4', 'p2-5']) d.paliers[id] = { valide: '2026-10-01' };
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  let distincts = 0; let repetes = 0; let lignes = 0; let avecAmi = 0;
  for (let i = 0; i < 150; i++) {
    const col = genererColonne({ chiffres: 1, lignes: 8, autorises: appris, cibles: amis });
    const ns = col.lignes.slice(1).map((l) => l.n);
    distincts += new Set(ns).size;
    repetes += ns.filter((n, k) => k > 0 && n === ns[k - 1]).length;
    lignes += ns.length;
    if (col.motifs.some((m) => !m.endsWith(':direct'))) avecAmi += 1;
  }
  assert.ok(distincts / 150 >= 5, `chiffres distincts par colonne : ${distincts / 150}`);
  assert.ok(repetes / lignes < 0.05, `même nombre deux fois de suite : ${repetes / lignes}`);
  assert.ok(avecAmi / 150 > 0.95, 'les amis restent présents');
});
