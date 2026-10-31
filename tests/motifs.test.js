import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOUS_LES_MOTIFS, exempleMotif, nomMotif, gesteMotif } from '../src/core/motifs.js';
import { Soroban } from '../src/core/soroban.js';
import { calculerGestes } from '../src/core/gestes.js';

test('chaque motif a un exemple qui le produit réellement', () => {
  assert.equal(TOUS_LES_MOTIFS.length, 54);
  for (const cle of TOUS_LES_MOTIFS) {
    const ex = exempleMotif(cle);
    const s = new Soroban(5);
    s.definirValeur(ex.depart);
    const r = calculerGestes(s.instantane(), 4, ex.op, ex.n);
    assert.ok(r.motifs.some((m) => m.cle === cle), `${cle} via ${ex.depart}${ex.op}${ex.n}`);
    assert.ok(nomMotif(cle).length > 3 && gesteMotif(cle).length > 10);
  }
});
