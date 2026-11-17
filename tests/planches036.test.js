import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUS_PALIERS } from '../src/core/curriculum.js';
import { planchesPossibles, formatsPlanche, dureePlanche, CHIFFRES_GESTE_MAX } from '../src/core/propositions.js';
import { formatExamen } from '../src/core/parcours.js';
import { exercicesBloc } from '../src/core/blocs.js';

const hist = (t) => Array.from({ length: 30 }, (_, i) => ({ ok: i % 8 ? 1 : 0, t }));
function profil(jusqua, reussis = [], objectifMinutes = 20) {
  const fin = SOUS_PALIERS.find((s) => s.id === jusqua).ordre;
  const paliers = {};
  for (const s of SOUS_PALIERS) if (!s.mental && s.ordre <= fin) paliers[s.id] = { valide: '2026-11-01', hist: [] };
  return {
    paliers, sessions: [], drills: {}, avis: [], stats: {}, succes: {},
    records: Object.fromEntries(reussis.map((g) => [`epreuve-${g}`, { reussi: true }])),
    motifs: { '+3:petit': { essais: 30, erreurs: 2, hist: hist(2.4) }, '-2:petit': { essais: 30, erreurs: 2, hist: hist(2.9) } },
    reglages: { objectifMinutes }, feuilles: [{ t: 2.2 }, { t: 2.4 }],
  };
}

test('0.36 : planches au format de l\'examen visé, sans dépasser les leçons validées', () => {
  // Début des grands amis : le 10e kyū (5 lignes de 2 chiffres), pas 3, 4 ou 5 chiffres.
  const d = profil('p3-1');
  const f = formatsPlanche(d);
  assert.deepEqual([f.vise.chiffres, f.vise.lignes], [2, 5]);
  assert.equal(f.vise.grade.id, '10');
  // Le grade suivant au format différent : le 8e (8 lignes), plafonné à 2 lignes de plus.
  assert.equal(formatExamen(d, 1).grade.id, '8');
  assert.deepEqual([f.suivant.chiffres, f.suivant.lignes], [2, 7]);
  const p = planchesPossibles(d, [], '2026-11-17');
  const vise = p.filter((x) => x.format === 'vise').length;
  assert.ok(vise / p.length >= 0.7, `${vise} / ${p.length}`);
  assert.ok(p.every((x) => x.chiffres <= 2), p.map((x) => x.chiffres).join());
  // 6e kyū visé : 3 chiffres, 10 lignes.
  const d6 = profil('p7-4', ['10', '9', '8', '7']);
  assert.deepEqual([formatsPlanche(d6).vise.chiffres, formatsPlanche(d6).vise.lignes], [3, 10]);
  // 4e kyū visé : 5 chiffres pour les planches mélangées, 4 au plus pour les planches de geste.
  const d4 = profil('p8-7', ['10', '9', '8', '7', '6', '5']);
  const p4 = planchesPossibles(d4, [], '2026-11-17');
  assert.equal(p4.find((x) => x.id === 'consolider').chiffres, 5);
  assert.ok(p4.filter((x) => x.mode).every((x) => x.chiffres <= CHIFFRES_GESTE_MAX));
});

test('0.36 : toutes les planches durent à peu près autant, selon l\'objectif du jour', () => {
  for (const [jusqua, reussis, objectif] of [['p3-1', [], 20], ['p7-4', ['10', '9', '8', '7'], 20], ['p5-e', [], 32]]) {
    const d = profil(jusqua, reussis, objectif);
    const cible = dureePlanche(d);
    assert.equal(cible, Math.max(4, Math.min(8, Math.round(objectif / 4))));
    for (const x of planchesPossibles(d, [], '2026-11-17')) {
      if (x.colonnes > 3 && x.colonnes < 20) assert.ok(Math.abs(x.minutes - cible) <= 1, `${x.id} : ${x.minutes} min pour ${cible}`);
    }
  }
  // Les blocs de la séance aussi : planches au format visé, 8 minutes au plus.
  const d = profil('p3-1');
  const ex = exercicesBloc(d, '2026-11-17', { genres: ['volume-isole', 'volume-melange', 'vitesse-melange'], cibles: ['+7:grand', '+8:grand'], minutes: 30 });
  for (const x of ex.filter((y) => y.aller[0] === 'planches' && !y.aller[1].ancrage)) {
    assert.ok(x.minutes <= 8, `${x.id} : ${x.minutes}`);
    assert.ok(x.aller[1].chiffres <= 2, `${x.id} : ${x.aller[1].chiffres} chiffres`);
  }
});
