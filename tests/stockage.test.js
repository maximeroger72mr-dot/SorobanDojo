import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictMiniTest } from '../src/core/minitest.js';
import { sousPalier } from '../src/core/curriculum.js';

/** Faux localStorage ; `refus` simule un quota dépassé ou un stockage bloqué. */
function fauxStockage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m, refus: false, bloque: false,
    getItem(k) { if (this.bloque) throw new Error('bloqué'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (this.refus) throw new Error('quota'); m.set(k, v); },
  };
}
let n = 0;
const charger = () => import(`../src/core/progression.js?t=${n++}`);

test('sauvegarde d\'une version plus récente : rien n\'est écrasé', async () => {
  const brut = JSON.stringify({ version: 99, sessions: [{ date: '2026-01-01' }] });
  globalThis.localStorage = fauxStockage({ 'soroban-progression': brut });
  const p = await charger();
  await p.chargerProgression();
  assert.equal(p.stockage().etat, 'lecture-seule');
  await p.enregistrerSession({ module: 'lecons', total: 1, justes: 1 });
  assert.equal(globalThis.localStorage.m.get('soroban-progression'), brut);
});

test('sauvegarde illisible : mise de côté, jamais perdue', async () => {
  globalThis.localStorage = fauxStockage({ 'soroban-progression': '{abîmé' });
  const p = await charger();
  await p.chargerProgression();
  const cote = [...globalThis.localStorage.m.keys()].find((k) => k.includes('illisible'));
  assert.ok(cote);
  assert.equal(globalThis.localStorage.m.get(cote), '{abîmé');
  assert.equal((await p.prendreAvis()).length, 1);
});

test('stockage bloqué, puis échec d\'écriture : signalés', async () => {
  globalThis.localStorage = fauxStockage();
  globalThis.localStorage.bloque = true;
  let p = await charger();
  await p.chargerProgression();
  assert.equal(p.stockage().etat, 'indisponible');
  globalThis.localStorage = fauxStockage();
  p = await charger();
  await p.chargerProgression();
  globalThis.localStorage.refus = true;
  await p.enregistrerSession({ module: 'lecons', total: 1, justes: 1 });
  assert.equal(p.stockage().etat, 'echec');
  globalThis.localStorage.refus = false;
  await p.enregistrerSession({ module: 'lecons', total: 1, justes: 1 });
  assert.equal(p.stockage().etat, 'ok');
});

test('ancienne copie de l\'application : signalée, et la version notée ne redescend pas', async () => {
  globalThis.localStorage = fauxStockage({ 'soroban-progression': JSON.stringify({ version: 2, appli: '9.0.0', sessions: [] }) });
  const p = await charger();
  await p.chargerProgression();
  assert.equal(p.stockage().etat, 'ancienne-copie');
  await p.enregistrerSession({ module: 'lecons', total: 1, justes: 1 });
  assert.equal(JSON.parse(globalThis.localStorage.m.get('soroban-progression')).appli, '9.0.0');
});

test('mini-test : 13 justes sur 15 ET vitesse « acquis débutant »', () => {
  const sp = sousPalier('p2-1');
  const ex = { type: 'addsub', lignes: [{ n: 4 }, { n: 3 }, { n: 2 }, { n: 1 }, { n: 4 }] }; // 5 chiffres
  const res = (ms, k = 15, justes = 15) => ({ justes, total: k, resultats: Array.from({ length: k }, (_, i) => ({ ex, juste: i < justes, dureeMs: ms })) });
  assert.equal(verdictMiniTest(sp, res(6000)).reussi, true);
  assert.equal(verdictMiniTest(sp, res(6000, 15, 12)).reussi, false);
  const lent = verdictMiniTest(sp, res(30000));
  assert.equal(lent.reussi, false);
  assert.match(lent.raison, /trop lent/);
});

test('version de l\'application = package.json', async () => {
  const { readFileSync } = await import('node:fs');
  const { VERSION_APPLI } = await import('../src/core/version.js');
  assert.equal(VERSION_APPLI, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
});

test('erreur déduite : simple soupçon, confirmée au 2e (ou si la ligne est désignée)', async () => {
  globalThis.localStorage = fauxStockage();
  const p = await charger();
  await p.chargerProgression();
  let b = await p.noterGestes([], ['+3:petit'], 2);
  assert.equal(b[0].statut, 'soupcon');
  assert.equal(p.progression().motifs['+3:petit'].erreurs, 0);
  b = await p.noterGestes([], ['+3:petit'], 2);
  assert.equal(b[0].statut, 'confirme');
  assert.equal(p.progression().motifs['+3:petit'].erreurs, 1);
  b = await p.noterGestes([], ['-4:petit'], 2, { confirme: true });
  assert.equal(b[0].statut, 'confirme');
});

test('colonnes ratées : rejouées à la séance suivante, retirées une fois réussies', async () => {
  globalThis.localStorage = fauxStockage();
  const p = await charger();
  await p.chargerProgression();
  const ex = { type: 'addsub', lignes: [{ op: '+', n: 3 }, { op: '+', n: 4 }], resultat: 7, motifs: [] };
  await p.noterErreurColonne(ex);
  await p.noterErreurColonne(ex);
  assert.equal(p.erreursARejouer().length, 0); // aujourd'hui : pas encore « d'hier »
  const demain = new Date(Date.now() + 86400000);
  const j = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;
  assert.equal(p.erreursARejouer(j).length, 1);
  await p.retirerErreurColonne(ex);
  assert.equal(p.erreursARejouer(j).length, 0);
});

