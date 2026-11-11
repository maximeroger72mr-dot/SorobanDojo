import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES_ANZAN, genererSujetAnzan, totalPointsAnzan } from '../src/core/epreuvesAnzan.js';
import { PALIERS_DICTEE, palierSuivant, libellePalier } from '../src/core/dicteeAnzan.js';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { exigeVitesse } from '../src/core/minitest.js';

test('épreuves d\'anzan : 500 points, 12 minutes, 80 ou 50 problèmes, tous marqués « format indicatif »', () => {
  for (const g of GRADES_ANZAN) {
    assert.equal(totalPointsAnzan(g), 500, g.nom);
    assert.equal(g.minutes, 12);
    assert.equal(g.verifie, false);
    const s = genererSujetAnzan(g);
    const n = s.sections.reduce((t, x) => t + x.problemes.length, 0);
    assert.equal(n, g.mul ? 80 : 50, g.nom);
    for (const p of s.sections[0].problemes) {
      assert.ok(p.resultat >= 0 && p.lignes.length === g.mitori.lignes);
      assert.ok(p.lignes.every((l) => String(l.n).length === g.mitori.min), g.nom);
    }
    for (const sec of s.sections.slice(1)) for (const p of sec.problemes) {
      const total = String(p.b).length + String(sec.cle === 'mul' ? p.a : p.resultat).length;
      assert.equal(total, g[sec.cle].total, `${g.nom} ${sec.cle}`);
    }
  }
  assert.deepEqual(GRADES_ANZAN.slice(0, 4).map((g) => Math.round(g.seuil * 500)), [250, 300, 350, 400]);
});

test('dictée anzan : paliers croissants, montée à 4 sur 5, descente à 2 sur 5', () => {
  assert.equal(palierSuivant(3, 5), 4);
  assert.equal(palierSuivant(3, 4), 4);
  assert.equal(palierSuivant(3, 3), 3);
  assert.equal(palierSuivant(3, 2), 2);
  assert.equal(palierSuivant(0, 0), 0);
  assert.equal(palierSuivant(PALIERS_DICTEE.length - 1, 5), PALIERS_DICTEE.length - 1);
  for (let i = 1; i < PALIERS_DICTEE.length; i++) assert.ok(PALIERS_DICTEE[i].chiffres >= PALIERS_DICTEE[i - 1].chiffres);
  assert.match(libellePalier(0), /3 nombres à 1 chiffre/);
});

test('piste anzan : leçons de × et ÷ de tête, ouvertes après la leçon sur soroban, sans vitesse exigée', () => {
  for (const [id, apres] of [['pa-m1', 'p6-1'], ['pa-m2', 'p6-2'], ['pa-d1', 'p7-2']]) {
    const sp = SOUS_PALIERS.find((s) => s.id === id);
    assert.ok(sp && sp.mental, id);
    assert.equal(sp.apres, apres);
    assert.equal(exigeVitesse(sp), false);
  }
  assert.equal(exigeVitesse(SOUS_PALIERS.find((s) => s.id === 'p6-1')), true);
});

test('anzan × et ÷ : exercices marqués « de tête » ; marche à 2 chiffres sans retenue avant les 2 chiffres complets', async () => {
  const { genererExercice } = await import('../src/core/curriculum.js');
  for (const id of ['pa-m1', 'pa-m2', 'pa-d1']) assert.equal(genererExercice(SOUS_PALIERS.find((s) => s.id === id)).mental, true, id);
  assert.equal(genererExercice(SOUS_PALIERS.find((s) => s.id === 'p6-1')).mental, undefined);
  const pa6 = SOUS_PALIERS.find((s) => s.id === 'pa-6');
  const p5a = SOUS_PALIERS.find((s) => s.id === 'p5-a');
  assert.ok(pa6.ordre < p5a.ordre && pa6.ordre > SOUS_PALIERS.find((s) => s.id === 'pa-5').ordre);
  assert.ok([...pa6.autorises].every((m) => m.endsWith(':direct')), 'pa-6 : gestes directs seulement');
  for (let i = 0; i < 20; i++) {
    const ex = genererExercice(pa6);
    assert.ok(ex.lignes.every((l) => l.n < 100) && ex.flash);
  }
});

test('cadence : les échéances ne dérivent pas d\'un élément à l\'autre', async () => {
  const { cadencer } = await import('../src/ui/cadence.js');
  const instants = [];
  const t0 = performance.now();
  const r = await cadencer({ periodeMs: 40, nombre: 8, surAfficher: () => instants.push(performance.now() - t0), surMasquer: () => {} });
  assert.equal(r.fini, true);
  assert.equal(instants.length, 8);
  // Le 8e élément tombe à 7 × 40 ms du départ, à 25 ms près (et non 7 retards cumulés).
  assert.ok(Math.abs(instants[7] - 280) < 25, `8e affichage à ${instants[7].toFixed(1)} ms`);
  let arret = 0;
  const s = await cadencer({ periodeMs: 20, nombre: 10, surAfficher: () => { arret += 1; }, surMasquer: () => {}, interrompu: () => arret >= 3 });
  assert.equal(s.fini, false);
});

test('dictée sur soroban, à son niveau : pas plus de chiffres que dans les leçons validées', async () => {
  const { paliersSoroban, PALIERS_DICTEE_SOROBAN, libellePalier: lib } = await import('../src/core/dicteeAnzan.js');
  assert.ok(paliersSoroban(1).every((p) => p.chiffres === 1) && paliersSoroban(1).length === 3);
  assert.equal(paliersSoroban(2).length, 6);
  assert.equal(paliersSoroban(6).length, PALIERS_DICTEE_SOROBAN.length);
  assert.equal(palierSuivant(5, 5, 5, paliersSoroban(2).length), 5, 'on ne dépasse pas le dernier palier ouvert');
  assert.match(lib(3, PALIERS_DICTEE_SOROBAN), /5 nombres à 2 chiffres/);
});

test('voix : les voix naturelles passent devant, le français de France avant les autres', async () => {
  const { meilleureVoix } = await import('../src/ui/voix.js');
  const voix = [
    { name: 'Microsoft Hortense', lang: 'fr-FR', default: true },
    { name: 'Microsoft Sylvie Online (Natural)', lang: 'fr-CA' },
    { name: 'Microsoft Denise Online (Natural)', lang: 'fr-FR' },
    { name: 'Google français', lang: 'fr-FR' },
  ];
  assert.equal(meilleureVoix(voix).name, 'Microsoft Denise Online (Natural)');
  assert.equal(meilleureVoix(voix.slice(0, 1)).name, 'Microsoft Hortense');
  assert.equal(meilleureVoix([]), null);
});
