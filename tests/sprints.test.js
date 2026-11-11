import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tirerReste, resteJuste, tirerComplement, complementJuste, tirerArrondi, arrondiJuste, tirerGrandNombre, dureeEclairSuivante, dureeEclairDepart, dureeEclairMin } from '../src/core/sprints.js';
import { etapesRattrapage, appliquerMacros, etapesMultiplication, multiplicationDeborde } from '../src/core/multiplication.js';

test('division avec reste : a = b × q + r, reste plus petit que le diviseur ; réponses tolérées', () => {
  for (let i = 0; i < 300; i++) {
    const q = tirerReste();
    assert.equal(q.a, q.b * q.q + q.r);
    assert.ok(q.r >= 0 && q.r < q.b && q.q >= 1 && q.q <= 9 && q.b >= 2 && q.b <= 9);
  }
  const q = { attendu: '74' };
  for (const t of ['74', '7 4', '7r4', '7 reste 4']) assert.ok(resteJuste(q, t), t);
  assert.ok(!resteJuste(q, '47'));
});

test('complément négatif : 99 947 283 sur 8 tiges se lit −52 717', () => {
  for (let i = 0; i < 200; i++) {
    const q = tirerComplement(8);
    assert.equal(q.affiche + q.v, 10 ** 8);
    assert.ok(q.v >= 1 && q.v < 10 ** 8 && q.resultat === -q.v);
  }
  const q = { v: 52717 };
  assert.ok(complementJuste(q, -52717) && complementJuste(q, 52717));
  assert.ok(!complementJuste(q, 52718) && !complementJuste(q, null));
});

test('arrondi : au millième ou à l\'unité, demi au-dessus, retenue comprise', () => {
  const versNombre = (t) => Number(t.replace(/[\s  ]/g, '').replace(',', '.'));
  let retenues = 0;
  for (let i = 0; i < 400; i++) {
    const q = tirerArrondi();
    const x = versNombre(q.texte);
    const k = 10 ** q.rang;
    assert.ok(Math.abs(q.resultat - Math.floor(x * k + 0.5 + 1e-9) / k) < 1e-9, `${q.texte} ${q.consigne} → ${q.resultat}`);
    assert.ok(arrondiJuste(q, q.resultat) && !arrondiJuste(q, q.resultat + 1 / k));
    if (Math.floor(q.resultat * k) % 10 === 0) retenues += 1;
  }
  assert.ok(retenues > 30, `retenues : ${retenues}`);
});

test('lecture éclair : nombres de la bonne longueur ; la durée baisse après deux réussites, remonte après une erreur', () => {
  for (const c of [3, 5, 8, 10]) for (let i = 0; i < 50; i++) assert.equal(String(tirerGrandNombre(c)).length, c);
  const d = dureeEclairDepart(8);
  assert.equal(dureeEclairSuivante(d, 8, true, 1), d);
  assert.ok(dureeEclairSuivante(d, 8, true, 2) < d);
  assert.ok(dureeEclairSuivante(d, 8, false, 0) > d);
  assert.equal(dureeEclairSuivante(dureeEclairMin(8), 8, true, 2), dureeEclairMin(8));
});

test('rattraper un quotient trop grand : rien n\'est effacé, le soroban finit juste', () => {
  // 168 ÷ 24 : 8 posé, 8 × 2 retiré, 8 × 4 impossible → 7, on rend le 2
  const e = etapesRattrapage(168, 24);
  assert.equal(e.rendus, 1);
  assert.equal(appliquerMacros(e.depart, e.macros), 7000);
  assert.ok(e.macros.some((m) => /IMPOSSIBLE/.test(m.texte)) && e.macros.some((m) => /On rend/.test(m.texte)));
  // Diviseur à 3 chiffres, erreur vue au troisième produit : deux chiffres rendus
  const f = etapesRattrapage(1950, 249);
  assert.equal(f.rendus, 2);
  assert.equal(appliquerMacros(f.depart, f.macros), 70000 + 1950 - 7 * 249);
  // À aucun moment le soroban ne passe sous zéro
  for (const x of [e, f]) { let v = x.depart; for (const m of x.macros) { v += m.op === '+' ? m.valeur : -m.valeur; assert.ok(v >= 0); } }
  // Chiffre trop grand visible dès le premier produit : rien à rattraper
  assert.equal(etapesRattrapage(100, 61), null);
});

test('multiplication : le débordement à gauche est signalé là où il se produit', () => {
  // 37 × 85 : 24, 15, puis 56 qui fait passer les centaines de 5 à 11 → retenue sur les milliers
  const m = etapesMultiplication(37, 85).macros;
  assert.deepEqual(m.map((x) => !!x.deborde), [false, false, false, true, false]);
  assert.match(m[3].texte, /DÉBORDE.*index gauche/i);
  assert.equal(multiplicationDeborde(12, 3), false);
  assert.equal(appliquerMacros(0, m), 3145);
});
