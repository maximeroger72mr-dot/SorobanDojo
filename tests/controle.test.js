/**
 * Contrôles de cohérence de l'application : menus, examens, variété des calculs.
 * (Le parcours automatique de TOUS les écrans est dans scripts/verifier-ecrans.cjs.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { GRADES, genererSujet } from '../src/core/epreuves.js';
import { PREREQUIS, compteurs } from '../src/core/parcours.js';
import { SOUS_PALIERS, genererExercice, sousPalier } from '../src/core/curriculum.js';
import { genererColonneVariee, creerMemoire, redondante } from '../src/core/generateur.js';
import { famille } from '../src/core/motifs.js';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };
const { CARTES } = await import('../src/modules/hubs.js');

test('menus : aucun doublon, chaque carte mène à un écran qui existe', () => {
  const ids = new Set(readdirSync(new URL('../src/modules/', import.meta.url)).map((f) => readFileSync(new URL(`../src/modules/${f}`, import.meta.url), 'utf8').match(/^\s+id: '([a-z]+)'/m)?.[1]).filter(Boolean));
  const vues = new Set();
  const titres = new Set();
  for (const [section, cartes] of Object.entries(CARTES)) {
    for (const c of cartes) {
      assert.ok(ids.has(c.ecran), `${section} → « ${c.titre} » mène à l'écran inconnu ${c.ecran}`);
      const cle = `${c.ecran} ${JSON.stringify(c.params?.() ?? {})}`;
      assert.ok(!vues.has(cle) || c.ecran === 'lecons', `doublon de destination : ${cle}`);
      vues.add(cle);
      assert.ok(!titres.has(c.titre), `titre de carte en double : ${c.titre}`);
      titres.add(c.titre);
    }
    // Une section titrée doit contenir plusieurs cartes (sinon titre et carte se répètent).
    const groupes = {};
    for (const c of cartes) if (c.groupe) groupes[c.groupe] = (groupes[c.groupe] ?? 0) + 1;
    for (const [g, n] of Object.entries(groupes)) assert.ok(n >= 2, `section « ${g} » avec une seule carte`);
  }
});

test('kyū officiels : chaque grade est STRICTEMENT plus exigeant que le précédent', () => {
  const taille = (g) => [g.mitori.lignes, g.mitori.max, g.mitori.min, g.mul?.total ?? 0, g.div?.total ?? 0, g.minutes === 20 ? 0 : 1, g.mul?.decimales ? 1 : 0];
  for (let i = 1; i < GRADES.length; i++) {
    const a = taille(GRADES[i - 1]);
    const b = taille(GRADES[i]);
    assert.ok(b.every((x, k) => x >= a[k]), `${GRADES[i].nom} moins exigeant que ${GRADES[i - 1].nom} sur un critère`);
    assert.ok(b.some((x, k) => x > a[k]) || GRADES[i].seuil > GRADES[i - 1].seuil, `${GRADES[i].nom} identique au ${GRADES[i - 1].nom}`);
  }
});

test('kyū officiels : les leçons exigées couvrent ce que l\'épreuve demande', () => {
  for (const g of GRADES.filter((x) => PREREQUIS[x.id])) {
    const ids = PREREQUIS[g.id];
    for (const id of ids) assert.ok(sousPalier(id), `${g.nom} : leçon inconnue ${id}`);
    if (g.div) assert.ok(ids.some((id) => sousPalier(id).type === 'div'), `${g.nom} demande des divisions sans leçon de division`);
    if (g.div?.total >= 3) assert.ok(ids.some((id) => sousPalier(id).type === 'div' && sousPalier(id).nd >= 2), `${g.nom} : diviseur à 2 chiffres non appris`);
    if (g.mul?.total >= 4) assert.ok(ids.includes('p6-3'), `${g.nom} : 2 × 2 chiffres non appris`);
    // Le sujet se génère et respecte le format.
    const sujet = genererSujet(g);
    assert.equal(sujet.sections.length, 1 + !!g.mul + !!g.div);
  }
});

test('compteurs : un seul calcul pour tous les écrans', () => {
  const d = { paliers: { 'p0-1': { valide: '2026-01-01' }, 'p1-1': { valide: '2026-01-02' } }, motifs: {} };
  const n = compteurs(d);
  assert.equal(n.leconsValidees, 1); // la leçon 0 (à lire) n'est pas une leçon du parcours chiffré
  assert.equal(n.leconsTotal, SOUS_PALIERS.filter((sp) => !sp.mental && sp.type !== 'theorie').length);
});

/** Lignes redondantes (même nombre de suite, ping-pong) dans une liste de colonnes. */
function tauxRedondance(colonnes) {
  let lignes = 0;
  let mauvaises = 0;
  for (const c of colonnes) {
    for (let i = 2; i < c.lignes.length; i++) {
      lignes += 1;
      if (redondante(c.lignes.slice(0, i), c.lignes[i])) mauvaises += 1;
    }
  }
  return mauvaises / Math.max(1, lignes);
}

test('variété : aucune leçon de colonnes ne produit de lignes redondantes (+2 −2 +2 −2, +9 +9)', () => {
  for (const sp of SOUS_PALIERS.filter((s) => (s.type ?? 'addsub') === 'addsub' && !s.mental)) {
    const cols = Array.from({ length: 120 }, () => genererExercice(sp, {}));
    // « Ajouter 1 à 4 » (3 lignes, additions seules, total ≤ 4) n'a parfois pas d'autre choix.
    assert.ok(tauxRedondance(cols) <= (sp.id === 'p1-1' ? 0.05 : 0.01), `${sp.id} : ${(tauxRedondance(cols) * 100).toFixed(1)} % de lignes redondantes`);
  }
});

test('variété : planches sur un seul geste, sans « +9 +9 +9 » ni ping-pong', () => {
  for (const id of ['+1:petit', '+4:petit', '-3:petit', '+9:grand', '-6:grand', '+7:mixte']) {
    const autorises = new Set([...famille('direct'), id]);
    for (const chiffres of [1, 2]) {
      const m = creerMemoire(10);
      const cols = Array.from({ length: 80 }, () => genererColonneVariee({ chiffres, lignes: 5, autorises, cibles: [id] }, m));
      assert.ok(tauxRedondance(cols) <= 0.01, `${id} à ${chiffres} chiffre(s) : ${(tauxRedondance(cols) * 100).toFixed(1)} %`);
      assert.ok(cols.filter((c) => c.motifs.includes(id)).length / cols.length > 0.9, `${id} : le geste visé doit rester présent`);
    }
  }
});

test('variété : mitorizan des épreuves sans nombre répété deux fois de suite', () => {
  for (const g of GRADES) {
    const s = genererSujet(g);
    for (const p of s.sections[0].problemes) assert.ok(p.lignes.every((l, i) => i === 0 || l.n !== p.lignes[i - 1].n));
  }
});

test('prof : phrases variées d\'un jour à l\'autre, stables dans la journée', async () => {
  const { variante, propositionsApresSeance } = await import('../src/core/prof.js');
  const liste = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(variante('2026-11-07', 'x', liste), variante('2026-11-07', 'x', liste));
  const semaine = new Set(['01', '02', '03', '04', '05', '06', '07'].map((j) => variante(`2026-11-${j}`, 'x', liste)));
  assert.ok(semaine.size >= 3, 'sur une semaine, au moins 3 formulations différentes');
  // Après la séance : 1 proposition principale et 2 autres, toutes avec une destination.
  const d = { sessions: [], records: {}, motifs: {}, paliers: { 'p1-1': { valide: '2026-11-01' }, 'p1-2': { valide: '2026-11-01' }, 'p1-3': { valide: '2026-11-01' } }, reglages: {} };
  const p = propositionsApresSeance(d, '2026-11-07');
  assert.ok(p.length >= 2 && p.every((x) => x.titre && x.detail && Array.isArray(x.aller)));
  assert.match(p[0].titre, /kyū/, 'kyū ouvert et pas tenté : proposé en premier');
});

test('vitesses incohérentes : test de groupe, puis verdict sur 15 colonnes au moins', async () => {
  const { verificationVitesse } = await import('../src/core/parcours.js');
  const hist = (t) => Array.from({ length: 20 }, () => ({ ok: 1, t }));
  const d = { paliers: {}, motifs: {}, records: {} };
  for (const id of ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-1', 'p2-2']) d.paliers[id] = { valide: '2026-11-01' };
  for (const c of ['+1:direct', '+2:direct', '-3:direct']) d.motifs[c] = { essais: 20, erreurs: 0, dette: 0, hist: hist(1.9) };
  for (const c of ['+4:petit', '+3:petit', '+2:petit']) d.motifs[c] = { essais: 20, erreurs: 0, dette: 0, hist: hist(1.5) };
  // Directs plus lents que les petits amis, aucune mesure isolée : test du groupe.
  let v = verificationVitesse(d);
  assert.equal(v.cle, 'famille:direct');
  assert.deepEqual(v.aller, ['verification', { famille: 'direct' }]);
  // 14 colonnes isolées : pas encore fiable, on reste sur le test.
  d.vitesseFamilles = { direct: Array(14).fill(0.9) };
  assert.equal(verificationVitesse(d).cle, 'famille:direct');
  // 15 colonnes, rapides : la famille va bien, rien à proposer.
  d.vitesseFamilles.direct.push(0.9);
  assert.equal(verificationVitesse(d), null);
  // … sauf un geste qui, mesuré seul, reste nettement plus lent que les autres.
  d.motifs['-3:direct'].isole = Array(15).fill(1.4);
  assert.equal(verificationVitesse(d).cle, '-3:direct');
  // Famille lente même seule : on la travaille.
  d.motifs['-3:direct'].isole = [];
  d.vitesseFamilles.direct = Array(15).fill(1.7);
  assert.match(verificationVitesse(d).titre, /Accélérer mes gestes directs/);
});

test('mesures isolées : colonne de gestes directs seuls, ou d\'amis d\'une seule famille', async () => {
  globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
  const p = await import('../src/core/progression.js?isole');
  await p.chargerProgression();
  await p.noterGestes(['+1:direct', '+2:direct'], [], 0.8);
  await p.noterGestes(['+1:direct', '+3:petit'], [], 1.2);
  await p.noterGestes(['+1:direct', '+3:petit', '+9:grand'], [], 2.0); // deux familles : pas isolé
  await p.noterGestes(['+3:petit'], [], null); // feuille mélangée : pas de temps
  const d = p.progression();
  assert.deepEqual(d.vitesseFamilles, { direct: [0.8], petit: [1.2] });
  assert.deepEqual(d.motifs['+1:direct'].isole, [0.8]);
  assert.deepEqual(d.motifs['+3:petit'].isole, [1.2]);
  assert.equal(d.motifs['+3:petit'].hist.at(-1).t, null);
});

test('tables mélangées : chaque produit une seule fois', async () => {
  const { serieTables } = await import('../src/core/tables.js');
  const s = serieTables([7, 8]);
  assert.equal(s.length, 17); // 7 × 8 et 8 × 7 ne comptent qu'une fois
  assert.ok(s.every((x) => x.a === 7 || x.b === 7 || x.a === 8 || x.b === 8));
});

test('affichage des temps : valeur exacte juste au-dessus d\'un seuil', async () => {
  const { formaterTemps } = await import('../src/core/maitrise.js');
  assert.equal(formaterTemps(1.52), '1,52 s');
  assert.equal(formaterTemps(1.5), '1,5 s');
  assert.equal(formaterTemps(2.34), '2,3 s');
});

test('estimation du quotient : le vrai chiffre, des restes, un raisonnement qui aboutit', async () => {
  const { sprintQuotient, raisonnement, classementQuotient } = await import('../src/core/quotient.js');
  let avecReste = 0;
  for (let k = 0; k < 50; k++) {
    const s = sprintQuotient();
    assert.equal(s.length, 20);
    for (let i = 0; i < s.length; i++) {
      const { a, b, q } = s[i];
      assert.ok(b >= 10 && b <= 99 && q >= 1 && q <= 9);
      assert.equal(Math.floor(a / b), q, `${a} ÷ ${b}`);
      if (a % b) avecReste += 1;
      if (i >= 2) assert.ok(!(s[i - 1].q === q && s[i - 2].q === q), 'trois fois le même chiffre de suite');
      assert.match(raisonnement(a, b), new RegExp(`(→ ${q}|c'est ${q})$`));
    }
  }
  assert.ok(avecReste / 1000 > 0.7, 'surtout des dividendes avec reste');
  assert.equal(raisonnement(150, 18), '18 ≈ 20 : 150 ÷ 20 ≈ 7 ; 7 × 18 = 126, il reste 24, encore ≥ 18 : trop petit → 8');
  assert.equal(classementQuotient(19000).id, 'platine');
  assert.equal(classementQuotient(90000), null);
});

test('régularité : signalée seulement quand elle se répète, et pas tous les jours', async () => {
  const { scoreRythme } = await import('../src/core/regularite.js');
  const regulier = scoreRythme([1, 1.1, 0.9, 1, 1.05, 0.95, 1, 1, 1.1, 0.9]);
  const hachure = scoreRythme([1, 1, 2.5, 1, 1, 2.4, 1, 1, 1, 1]);
  assert.ok(regulier.score >= 85 && !regulier.irregulier);
  assert.ok(hachure.irregulier && hachure.hesitations === 2);
  globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
  const p = await import('../src/core/progression.js?rythme');
  await p.chargerProgression();
  assert.equal(await p.noterRythme(hachure), false, 'une fois : rien (un appel, une distraction)');
  assert.equal(await p.noterRythme(regulier), false);
  assert.equal(await p.noterRythme(hachure), true, 'deuxième fois : on prévient');
  assert.equal(await p.noterRythme(hachure), false, 'pas deux fois en 3 jours');
});

test('volume : chiffres comptés par jour', async () => {
  globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
  const p = await import('../src/core/progression.js?volume');
  await p.chargerProgression();
  p.noterVolume(12);
  p.noterVolume(8);
  assert.equal(p.progression().volume[p.aujourdhui()], 20);
});

test('CPM : seuils 20 / 40 / 75 et affichage', async () => {
  const { cpm, formaterCadence, formaterVitesse, NIVEAUX } = await import('../src/core/maitrise.js');
  assert.deepEqual(NIVEAUX.filter((n) => n.temps).map((n) => cpm(n.temps.addsub)), [20, 40, 75]);
  assert.equal(formaterCadence(1.5), '40 CPM');
  assert.equal(formaterVitesse(1.5), '40 CPM (1,5 s par chiffre)');
});
