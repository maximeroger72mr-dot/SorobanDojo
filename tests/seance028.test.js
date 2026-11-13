import test from 'node:test';
import assert from 'node:assert/strict';
import { exercicesBloc, jourVitesse, gesteDuJour } from '../src/core/blocs.js';
import { anzanAdapte, MARCHES_ANZAN } from '../src/core/parcours.js';
import { planchesPossibles } from '../src/core/propositions.js';
import { cpm } from '../src/core/maitrise.js';

const h = (t, n = 30) => Array.from({ length: n }, () => ({ ok: 1, t }));
function profil() {
  const paliers = {};
  for (const id of ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2']) paliers[id] = { valide: '2026-11-01', hist: h(1.2) };
  return {
    sessions: [{ date: '2026-11-10', module: 'lecons', total: 10, justes: 10 }],
    paliers, records: {}, reglages: {}, feuilles: [],
    motifs: { '+4:petit': { hist: h(1.2) }, '+3:petit': { hist: h(2.6) }, '+1:direct': { hist: h(1) } },
  };
}

test('bloc volume/vitesse : isolé ET mélangé, remplit le temps, varie d\'un jour à l\'autre', () => {
  const d = profil();
  assert.equal(gesteDuJour(d, ['+4:petit', '+3:petit']), '+3:petit'); // le plus lent des gestes mesurés
  const b = exercicesBloc(d, '2026-11-11', { genres: ['volume-isole', 'volume-melange'], cibles: ['+4:petit', '+3:petit'], minutes: 12 });
  assert.ok(b.some((x) => x.genre === 'volume-isole') && b.some((x) => x.genre === 'volume-melange'), b.map((x) => x.genre).join());
  const total = b.reduce((t, x) => t + x.minutes, 0);
  assert.ok(total >= 10 && total <= 13, String(total)); // rempli à une minute près, sans dépasser
  assert.equal(new Set(b.map((x) => x.id)).size, b.length);
  // La variante faite hier passe derrière : le lendemain, on ne refait pas la même.
  const premier = b[0];
  d.sessions.push({ date: '2026-11-11', module: premier.aller[0], mode: premier.aller[1].jeu ?? (premier.aller[1].ancrage ? 'ancrage' : premier.aller[1].cible), reglages: { ...premier.aller[1] }, total: 10, justes: 10 });
  const demain = exercicesBloc(d, '2026-11-12', { genres: ['volume-isole'], cibles: ['+4:petit', '+3:petit'], minutes: 8 });
  assert.notEqual(demain[0].id, premier.id);
  // Volume et vitesse alternent au fil des jours PRATIQUÉS (un jour manqué ne décale rien).
  assert.notEqual(jourVitesse(d, '2026-11-12'), jourVitesse({ ...d, sessions: d.sessions.slice(0, 1) }, '2026-11-20'));
});

test('anzan adapté : monte quand c\'est juste ET rapide, redescend quand ça se dégrade', () => {
  const d = profil();
  const a0 = anzanAdapte(d);
  assert.equal(a0.palierAnzan, 0);
  const serie = (i, justes, duree, date) => d.sessions.push({ date, module: 'anzan', mode: 'flash', reglages: { palierAnzan: i, duree, termes: MARCHES_ANZAN[i].termes }, total: 5, justes });
  serie(0, 5, 2, '2026-11-01'); serie(0, 5, 2, '2026-11-02');
  assert.equal(anzanAdapte(d).palierAnzan, 0); // juste mais trop lent : on reste
  serie(0, 5, 1.4, '2026-11-03');
  assert.equal(anzanAdapte(d).palierAnzan, 1); // juste et rapide : une marche de plus
  serie(1, 2, 1.4, '2026-11-04'); serie(1, 3, 1.4, '2026-11-05');
  assert.equal(anzanAdapte(d).palierAnzan, 0); // deux séries ratées : on redescend
  // 1 chiffre seulement tant que « 2 chiffres, sans retenue » n'est pas validée.
  for (let k = 0; k < 40; k++) serie(anzanAdapte(d).palierAnzan, 5, 1, `2026-12-${String(1 + (k % 28)).padStart(2, '0')}`);
  assert.equal(anzanAdapte(d).chiffres, 1);
});

test('planches proposées : cible toujours au-dessus de la vitesse actuelle, ciblé et mélangé alternés', () => {
  const d = profil();
  d.motifs['+3:petit'] = { hist: h(1.5 * 0.99) }; // 40 CPM : déjà au niveau confirmé
  const p = planchesPossibles(d, [], '2026-11-11');
  const auto = p.find((x) => x.id === 'automatiser:+3:petit');
  const vise = Number(auto.objectif.match(/viser (\d+) CPM/)?.[1] ?? Infinity);
  assert.ok(vise > cpm(1.5 * 0.99), auto.objectif);
  const melange = (x) => ['consolider', 'endurance', 'cran', 'vitesse'].includes(x.id);
  assert.notEqual(melange(p[0]), melange(p[1]));
  assert.notEqual(melange(p[0]), melange(planchesPossibles(d, [], '2026-11-12')[0]));
});
