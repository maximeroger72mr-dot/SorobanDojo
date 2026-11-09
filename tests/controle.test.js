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
    // « Ajouter 1 à 4 » (3 lignes, additions seules, total ≤ 4) n'a parfois pas d'autre choix
  // (mesuré : jusqu'à 7 % sur 120 colonnes, selon le tirage).
    assert.ok(tauxRedondance(cols) <= (sp.id === 'p1-1' ? 0.09 : 0.01), `${sp.id} : ${(tauxRedondance(cols) * 100).toFixed(1)} % de lignes redondantes`);
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
  const { variante } = await import('../src/core/prof.js');
  const liste = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(variante('2026-11-07', 'x', liste), variante('2026-11-07', 'x', liste));
  const semaine = new Set(['01', '02', '03', '04', '05', '06', '07'].map((j) => variante(`2026-11-${j}`, 'x', liste)));
  assert.ok(semaine.size >= 3, 'sur une semaine, au moins 3 formulations différentes');
  // Après la séance : une planche, un flash anzan, un jeu ; la planche faite est remplacée.
  const { propositions } = await import('../src/core/propositions.js');
  const d = { sessions: [], records: {}, motifs: { '+3:petit': { hist: Array.from({ length: 20 }, () => ({ ok: 1, t: 2.5 })) } }, paliers: {}, reglages: {}, feuilles: [] };
  for (const id of ['p1-1', 'p1-2', 'p1-3', 'p1-4', 'p2-0', 'p2-1']) d.paliers[id] = { valide: '2026-11-01' };
  const p = propositions(d, '2026-11-07', [], 0);
  assert.deepEqual(p.map((x) => x.type).slice(0, 2), ['planche', 'anzan']);
  assert.ok(['jeu', 'defi'].includes(p[2].type));
  assert.ok(p.every((x) => x.titre && x.detail && Array.isArray(x.aller) && x.minutes > 0));
  assert.match(p[0].id, /^automatiser:\+3:petit/);
  // Planche faite → une autre prend sa place ; anzan fait → plus proposé.
  d.sessions.push({ date: '2026-11-07', module: 'planches', reglages: { proposition: p[0].id }, total: 10, justes: 10, dureeMs: 300000 });
  d.sessions.push({ date: '2026-11-07', module: 'anzan', total: 5, justes: 5, dureeMs: 60000 });
  const p2 = propositions(d, '2026-11-07', [], 0);
  assert.notEqual(p2[0].id, p[0].id);
  assert.ok(!p2.some((x) => x.type === 'anzan'));
  // Objectif de temps long : plus de propositions.
  assert.ok(propositions(d, '2026-11-07', [], 40).length > p2.length);
  // Le jeu se lance directement dans la bonne variante.
  const j = p.find((x) => x.type === 'jeu');
  if (j && /Complément/.test(j.titre)) assert.equal(j.aller[1].cible, 5);
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

test('0.21 : nouvelles leçons (lecture, paires de 5 et de 10) à leur place', () => {
  const ordre = SOUS_PALIERS.filter((s) => !s.mental).map((s) => s.id);
  assert.ok(ordre.indexOf('p0-2') === ordre.indexOf('p0-1') + 1 && ordre.indexOf('p0-2') < ordre.indexOf('p1-1'));
  assert.ok(ordre.indexOf('p2-0') === ordre.indexOf('p2-1') - 1);
  assert.ok(ordre.indexOf('p3-0') === ordre.indexOf('p3-1') - 1);
  // 20 lectures, puis 10 poses, puis mélangé.
  const lire = sousPalier('p0-2');
  assert.ok([0, 5, 19].every((r) => genererExercice(lire, {}, { rang: r }).type === 'lire'));
  assert.ok([20, 29].every((r) => genererExercice(lire, {}, { rang: r }).type === 'poser'));
  // Paires : jamais deux fois de suite le même nombre.
  const paires = sousPalier('p3-0');
  let avant = null;
  for (let i = 0; i < 200; i++) { const ex = genererExercice(paires); assert.notEqual(ex.a, avant); avant = ex.a; assert.equal(ex.a + ex.resultat, 10); }
});

test('0.21 : étape Reconnaître (choix appris + nouveau, 10 questions justes)', async () => {
  const { aReconnaitre, questionsReconnaitre } = await import('../src/core/reconnaitre.js');
  const { analyserOperation } = await import('../src/core/generateur.js');
  assert.ok(!aReconnaitre(sousPalier('p1-3')) && !aReconnaitre(sousPalier('p2-0')) && !aReconnaitre(sousPalier('p5-5')));
  assert.ok(aReconnaitre(sousPalier('p2-1')) && aReconnaitre(sousPalier('p3-1')) && aReconnaitre(sousPalier('p5-3')));
  const appris = new Set(famille('direct'));
  const { choix, questions } = questionsReconnaitre(sousPalier('p2-1'), appris);
  assert.deepEqual(choix, ['direct', 'petit']);
  assert.equal(questions.length, 10);
  for (const q of questions) assert.equal(analyserOperation(q.v, q.op, q.n, 3).motifs[0], q.cle);
  assert.ok(questions.filter((q) => q.regle === 'petit').length >= 5);
});

test('0.21 : prérequis des activités, drills d\'entrée et échauffement', async () => {
  const { manquantesActivite, manquantesEpreuve } = await import('../src/core/prerequis.js');
  const { prerequisDrill } = await import('../src/core/parcours.js');
  const { catalogueDrills } = await import('../src/core/drills.js');
  const d = { paliers: {}, reglages: {}, motifs: {}, drills: {} };
  assert.deepEqual(manquantesActivite(d, 'colonnes').map((s) => s.id), ['p1-3']);
  assert.deepEqual(manquantesActivite(d, 'quotidien').map((s) => s.id), ['p5-5', 'pd-1']);
  assert.ok(manquantesEpreuve(d, '10').length > 20);
  assert.deepEqual(manquantesActivite({ ...d, reglages: { decouverte: true } }, 'colonnes'), []);
  const drills = catalogueDrills();
  assert.deepEqual(drills.slice(0, 4).map((x) => x.id), ['tige-4', 'tige-9', 'pendule-11', 'directs']);
  assert.deepEqual(prerequisDrill(d, drills[3]).lecons.sort(), ['p1-1', 'p1-2', 'p1-3', 'p1-4']);
  assert.deepEqual(prerequisDrill(d, drills[0]).lecons.sort(), ['p1-1', 'p1-2']);
});

test('0.21 : tables, produits à retravailler jusqu\'à 2,5 s', async () => {
  const { produitsARetravailler, diagnosticTablesFait, produitLent } = await import('../src/core/tables.js');
  const stats = {};
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) stats[`${a}x${b}`] = { hist: [{ ok: 1, t: 1.2 }] };
  assert.ok(diagnosticTablesFait(stats));
  assert.deepEqual(produitsARetravailler(stats), []);
  stats['7x8'].hist = [{ ok: 1, t: 3.4 }];
  stats['6x9'].hist = [{ ok: 0, t: 2 }];
  stats['4x7'].hist = [{ ok: 1, t: 2.7 }];
  assert.deepEqual(produitsARetravailler(stats).sort(), ['4x7', '6x9', '7x8']);
  // Le tirage ne propose plus que ces produits.
  for (let i = 0; i < 50; i++) { const ex = produitLent(stats, null); assert.ok(['4x7', '6x9', '7x8'].includes(`${Math.min(ex.a, ex.b)}x${Math.max(ex.a, ex.b)}`)); }
  stats['7x8'].hist.push({ ok: 1, t: 1.8 }, { ok: 1, t: 1.9 });
  assert.ok(!produitsARetravailler(stats).includes('7x8'));
});

test('0.21 : positionnement, doigté et grades', async () => {
  const { PALIERS_TEST, leconsReussies, colonneTest } = await import('../src/core/positionnement.js');
  const { questionDe } = await import('../src/core/doigte.js');
  assert.equal(PALIERS_TEST.length, 4);
  assert.ok(leconsReussies(1).includes('p1-4') && leconsReussies(1).includes('p0-2') && !leconsReussies(1).includes('p2-1'));
  assert.ok(leconsReussies(3).includes('p4-5') && leconsReussies(3).includes('p3-0'));
  for (const p of PALIERS_TEST) assert.ok(colonneTest(p).lignes.length >= 4);
  assert.match(questionDe(sousPalier('p1-1')).texte, /POUCE/);
  assert.match(questionDe(sousPalier('p2-3')).texte, /Petit ami/);
  assert.match(questionDe(sousPalier('p6-1')).texte, /index gauche/);
  assert.equal(questionDe(sousPalier('p2-0')), null);
  const { frise } = await import('../src/modules/grades.js');
  const f = frise({ records: { 'prekyu-20': { reussi: true }, 'prekyu-19': { reussi: true } }, paliers: {} });
  assert.equal(f.length, 20);
  assert.equal(f.filter((m) => m.officiel).length, 10);
  assert.equal(f.find((m) => m.actuel).nom, '19e kyū prép.');
});
