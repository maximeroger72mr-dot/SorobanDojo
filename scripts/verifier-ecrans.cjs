/**
 * Robot de contrôle : ouvre l'application (Electron) avec une progression avancée, puis visite
 * TOUS les écrans accessibles : les 5 entrées du menu, chaque carte des pages de section, chaque
 * leçon (ses 3 onglets), les écrans internes (marathon, lièvre, examens, défis, jeux, quiz…), la
 * séance en cours et terminée, et la largeur téléphone.
 *
 * Sur chaque écran il vérifie :
 *  - aucun texte parasite : « null », « undefined », « NaN », « [object … » ;
 *  - aucune erreur JavaScript ;
 *  - le fil d'Ariane désigne bien l'activité ouverte (un lien ne mène pas au mauvais endroit) ;
 *  - un titre (h1) est présent.
 *
 * Lancer : xvfb-run -a node scripts/verifier-ecrans.cjs   (code de sortie 1 au moindre problème)
 */
// playwright (poste de développement) ou playwright-core (intégration continue) : seul le pilote
// d'Electron sert, aucun navigateur n'est téléchargé.
const { _electron } = (() => { try { return require('playwright'); } catch { return require('playwright-core'); } })();
const fs = require('fs');
const os = require('os');
const path = require('path');

const racine = path.join(__dirname, '..');
const jour = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const INTERDITS = /null|undefined|\bNaN\b|\[object /;
const problemes = [];
let ecransVus = 0;

function profil({ seanceFinie = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
  const { SOUS_PALIERS } = require('./sous-paliers.json');
  const paliers = {};
  // Tout le parcours jusqu'aux grands amis + multiplication 2×1 et division ÷1 validés ; la suite ouverte.
  for (const id of SOUS_PALIERS) {
    if (/^p(0|1|2|3|4|5)-|^pa-[0-3]$|^p1-a$|^p6-[a01]$|^p7-[01e]$/.test(id)) {
      paliers[id] = { reps: 40, justes: 39, valide: jour(12), carte: { boite: 2, echeance: jour(0) }, hist: Array.from({ length: 30 }, (_, i) => ({ ok: i % 9 ? 1 : 0, t: 1.2 + (i % 5) / 10 })) };
    }
  }
  const hist = (t) => Array.from({ length: 30 }, (_, i) => ({ ok: i % 11 ? 1 : 0, t }));
  const motifs = {};
  for (const [c, t] of [['+1:direct', 0.6], ['+3:petit', 2.4], ['+4:petit', 1.3], ['-2:petit', 1.9], ['+9:grand', 2.8], ['-7:grand', 3.1], ['+6:mixte', 3.5]]) motifs[c] = { essais: 30, erreurs: 2, dette: c === '-7:grand' ? 3 : 0, hist: hist(t), soupcons: [] };
  const sessions = [];
  for (let n = 14; n >= 1; n--) sessions.push({ date: jour(n), horodatage: Date.now() - n * 86400000, module: n % 3 ? 'lecons' : 'rythme', mode: n % 3 ? 'entrainement' : 'marathon', reglages: {}, total: 25, justes: 22, dureeMs: 1200000 });
  sessions.push({ date: jour(5), module: 'examen', mode: 'kyu', reglages: { grade: '18' }, total: 20, justes: 12, dureeMs: 500000 });
  const records = { 'drill-directs': { dureeMs: 30000, date: jour(4) }, 'prekyu-20': { reussi: true, points: 17, date: jour(9) }, 'prekyu-19': { reussi: true, points: 16, date: jour(6) } };
  const erreursColonnes = [{ date: jour(1), sig: 'x', ex: { type: 'addsub', lignes: [{ op: '+', n: 23 }, { op: '+', n: 34 }, { op: '-', n: 12 }], resultat: 45, motifs: ['+4:petit'] } }];
  const d = { version: 2, appli: '0.0.0', sessions, records, motifs, paliers, drills: { directs: { validations: 2, valide: jour(4) } },
    reglages: { objectifMinutes: 20, decouverte: true, objectifGrade: { grade: '8', date: jour(-300), pourquoi: 'les courses' } }, avis: [], stats: { suite: 3, meilleureSuite: 12 }, succes: {}, seance: null, erreursColonnes };
  if (seanceFinie) d.seanceTerminee = { date: jour(0), bilan: { exercices: 42, justes: 39, dureeMs: 1500000, progres: ['+3 petit ami : Acquis débutant'], records: [], nouveauxSucces: [] } };
  fs.writeFileSync(path.join(dir, 'progression.json'), JSON.stringify(d));
  return dir;
}

/** Élève avancé (0.38) : 6e kyū réussi, toutes les leçons du 5e kyū validées, 15 min par jour. */
function profilAvance() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
  const { SOUS_PALIERS, K5 } = require('./sous-paliers.json');
  const paliers = {};
  for (const id of SOUS_PALIERS) if (K5.includes(id)) paliers[id] = { reps: 40, justes: 39, valide: jour(30), carte: { boite: 4, echeance: jour(-10) }, hist: Array.from({ length: 30 }, () => ({ ok: 1, t: 1.5 })) };
  const hist = (t) => Array.from({ length: 30 }, () => ({ ok: 1, t }));
  const motifs = {};
  for (const c of ['+3:petit', '+4:petit', '-2:petit', '+9:grand', '-7:grand', '+6:mixte', '+1:grand', '-4:grand']) motifs[c] = { essais: 60, erreurs: 2, dette: 0, hist: hist(1.4), soupcons: [] };
  const sessions = [];
  for (let n = 20; n >= 1; n--) sessions.push({ date: jour(n), horodatage: Date.now() - n * 86400000, module: 'planches', mode: 'examen', reglages: {}, total: 10, justes: 9, dureeMs: 900000 });
  // 0.41 : un kyū demande ses deux épreuves (Nisshō et Zenkoren).
  const records = Object.fromEntries(['10', '9', '8', '7', '6'].flatMap((g) => [[`epreuve-${g}`, { reussi: true, points: 250, date: jour(25) }], [`zenkoren-${g}`, { reussi: true, points: 250, date: jour(25) }]]));
  const d = { version: 2, appli: '0.0.0', sessions, records, motifs, paliers, drills: {}, reglages: { objectifMinutes: 15, objectif25Vu: true, decouverte: true }, avis: [], stats: {}, succes: {}, seance: null };
  fs.writeFileSync(path.join(dir, 'progression.json'), JSON.stringify(d));
  return dir;
}

async function lancer(dir) {
  const app = await _electron.launch({ args: [racine, '--no-sandbox', `--user-data-dir=${dir}`], executablePath: path.join(racine, 'node_modules/electron/dist/electron') });
  const w = await app.firstWindow();
  await w.setViewportSize({ width: 1280, height: 900 });
  w.on('pageerror', (e) => problemes.push(`Erreur JS : ${e.message}`));
  w.on('dialog', (dlg) => dlg.dismiss().catch(() => {}));
  await w.waitForSelector('#navigation button');
  return [app, w];
}

async function controler(w, ou, attendu = null) {
  await w.waitForTimeout(220);
  ecransVus += 1;
  const r = await w.evaluate(() => ({
    texte: document.querySelector('main').innerText,
    h1: document.querySelector('#ecran h1')?.textContent ?? '',
    fil: document.querySelector('.fil-ariane:not([hidden]) .lien:last-child')?.textContent ?? null,
  }));
  const m = r.texte.match(new RegExp(`.{0,40}(${INTERDITS.source}).{0,40}`));
  if (m) problemes.push(`${ou} : texte parasite « ${m[0].replace(/\s+/g, ' ')} »`);
  if (!r.h1) problemes.push(`${ou} : pas de titre`);
  if (attendu && r.fil !== null && r.fil !== attendu) problemes.push(`${ou} : le fil d'Ariane indique « ${r.fil} » au lieu de « ${attendu} »`);
}

const aller = (w, id) => w.evaluate((x) => document.querySelector(`#navigation button[data-id="${x}"]`).click(), id);
const cliquerTexte = (w, sel, texte) => w.evaluate(([s, t]) => { const b = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t)); if (b) b.click(); return !!b; }, [sel, texte]);

(async () => {
  fs.writeFileSync(path.join(__dirname, 'sous-paliers.json'), JSON.stringify({ SOUS_PALIERS: [] }));
  // Liste des leçons (lue dans le code, pour ne rien oublier).
  const { execSync } = require('child_process');
  const ids = JSON.parse(execSync(`node --input-type=module -e "import('${path.join(racine, 'src/core/curriculum.js').replace(/\\/g, '/')}').then((m) => console.log(JSON.stringify(m.SOUS_PALIERS.map((s) => s.id))))"`).toString());
  const K5 = JSON.parse(execSync(`node --input-type=module -e "import('${path.join(racine, 'src/core/parcours.js').replace(/\\/g, '/')}').then((m) => console.log(JSON.stringify(m.PREREQUIS[5])))"`).toString());
  fs.writeFileSync(path.join(__dirname, 'sous-paliers.json'), JSON.stringify({ SOUS_PALIERS: ids, K5 }));

  let [app, w] = await lancer(profil());
  // 1. Les 5 entrées du menu, et chaque carte des pages de section.
  for (const id of ['seance', 'apprendre', 'entrainer', 'mesurer', 'progression', 'reglages']) {
    await aller(w, id);
    await controler(w, `menu ${id}`);
    const nb = await w.$$eval('#ecran .carte-hub', (x) => x.length);
    for (let i = 0; i < nb; i++) {
      await aller(w, id);
      await w.waitForTimeout(150);
      const titre = await w.$eval(`#ecran .carte-hub >> nth=${i}`, (x) => x.querySelector('strong').textContent);
      await w.click(`#ecran .carte-hub >> nth=${i}`);
      // La carte « Anzan et visualisation » ouvre la piste anzan des leçons ; « Drills et tables », l'écran Drills.
      const attendu = { 'Anzan et visualisation': 'Leçons guidées' }[titre] ?? titre;
      await controler(w, `${id} › ${titre}`, attendu);
    }
  }
  // 2. Chaque leçon, ses trois onglets (mode découverte : tout est ouvert).
  for (const id of ids) {
    await w.evaluate((x) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['lecons', { sousPalier: x }] })), id);
    await w.waitForTimeout(200);
    await controler(w, `leçon ${id}`, 'Leçons guidées');
    const onglets = await w.$$('#ecran .segments button');
    for (let k = 0; k < onglets.length && k < 4; k++) {
      await (await w.$$('#ecran .segments button'))[k]?.click().catch(() => {});
      await controler(w, `leçon ${id}, onglet ${k + 1}`, 'Leçons guidées');
    }
  }
  // 3. Écrans internes.
  const internes = [
    ['rythme', { voir: 'marathon' }, 'Marathon'], ['rythme', { voir: 'lievre' }, 'Lièvre'],
    ['rythme', { jeu: 'marathon', cibles: ['+3:petit'], lignes: 40, auto: true }, 'Marathon'],
    ['rythme', { jeu: 'lievre', cibles: ['+3:petit'], chiffres: 1, auto: true }, 'Lièvre'],
    ['examen', {}, 'Passage de kyū'], ['erreurs', {}, 'À revoir'], ['bilan', {}, 'Bilan imprimable'],
    ['lecons', { piste: 'anzan' }, 'Leçons guidées'], ['planches', { cible: '+3:petit', auto: true, colonnes: 5, chiffres: 1 }, 'Planches'],
    ['drills', { tables: 'lents', auto: true }, 'Tables (九九)'], ['drills', { tables: [7, 8, 9] }, 'Tables (九九)'], ['drills', { quotient: true }, 'Tables (九九)'],
    ['drills', { section: 'tables' }, 'Tables (九九)'], ['drills', { section: 'gestes' }, 'Drills de gestes'], ['drills', { tables: '81' }, 'Tables (九九)'],
    ['grades', {}, 'Grades'], ['epreuves', {}, 'Épreuves officielles'], ['positionnement', {}, 'Tester mon niveau'],
    ['jeux', { jeu: 'complement', cible: 5 }, 'Jeux'], ['jeux', { jeu: 'survie' }, 'Survie anzan'], ['seance', { accueil: true }, null],
    ['verification', { famille: 'direct' }, 'Vérifier ma vitesse'], ['verification', { famille: 'petit' }, 'Vérifier ma vitesse'], ['verification', { geste: '+3:petit' }, 'Vérifier ma vitesse'], ['defis', { semaine: true }, 'Défis chrono'], ['lexique', {}, 'Lexique'],
  ];
  for (const [ecran, params, attendu] of internes) {
    await w.evaluate((x) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: x })), [ecran, params]);
    await controler(w, `${ecran} ${JSON.stringify(params)}`, attendu);
  }
  // Feuille : Entrée sur la dernière case, puis confirmation : la feuille est corrigée.
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['planches', { cible: '+3:petit', auto: true, colonnes: 3, chiffres: 1 }] })));
  await w.waitForTimeout(300);
  const champs = await w.$$('#ecran .probleme input');
  for (const c of champs) { await c.fill('1'); await c.press('Enter'); }
  // Depuis la 0.33, Entrée sur la dernière case demande « Avez-vous terminé ? » ; Entrée encore
  // (le bouton « Oui, corriger » a le focus) corrige et arrête le chrono.
  await w.waitForTimeout(200);
  if (!(await w.$('#ecran .confirmation-fin'))) problemes.push('feuille : Entrée sur la dernière case ne demande pas de confirmation');
  await w.keyboard.press('Enter');
  await w.waitForTimeout(400);
  if (!(await w.$('#ecran .vitesse-feuille, #ecran .carte.bilan'))) problemes.push('feuille : la confirmation (Entrée) ne corrige pas');
  // Planche proposée par la séance : son objectif est affiché.
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['planches', { cible: 'appris', auto: true, colonnes: 5, chiffres: 2, lignes: 5, proposition: 'consolider', objectif: 'Consolider : test' }] })));
  await controler(w, 'planche proposée', 'Planches');
  if (!(await w.$('#ecran .objectif-planche'))) problemes.push("planche proposée : l'objectif n'est pas affiché");
  // Planches « −2 petit ami » et « −2 parmi les petits amis » : pas d'aller-retour, formes variées.
  for (const mode of ['seul', 'famille']) {
    await w.evaluate((m) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['planches', { cible: '-2:petit', mode: m, auto: true, colonnes: 10, chiffres: 1, lignes: 6 }] })), mode);
    await w.waitForTimeout(500);
    await controler(w, `planche −2 petit ami (${mode})`, 'Planches');
    const cols = await w.$$eval('#ecran table.colonne', (ts) => ts.map((t) => [...t.querySelectorAll('tr')].slice(1).map((tr) => `${tr.querySelector('.signe').textContent.trim() === '−' ? '-' : '+'}${tr.querySelector('.nombre').textContent.trim()}`)));
    if (cols.length !== 10) problemes.push(`planche ${mode} : ${cols.length} colonnes au lieu de 10`);
    if (new Set(cols.map((c) => c.join())).size < 9) problemes.push(`planche ${mode} : moins de 9 formes de colonnes différentes sur 10`);
    for (const c of cols) {
      for (let i = 1; i < c.length; i++) if (c[i].slice(1) === c[i - 1].slice(1)) problemes.push(`planche ${mode} : aller-retour ou répétition (${c.join(' ')})`);
      for (let i = 3; i < c.length; i++) if (c[i] === c[i - 2] && c[i - 1] === c[i - 3]) problemes.push(`planche ${mode} : alternance A B A B (${c.join(' ')})`);
    }
    const titre = await w.$eval('#ecran .barre-feuille strong', (x) => x.textContent);
    if (!titre.startsWith(mode === 'seul' ? '−2 petit ami' : '−2 parmi les petits amis')) problemes.push(`planche ${mode} : titre « ${titre} »`);
  }
  // Cascades à 1 chiffre : impossible, donc repli expliqué, jamais de planche vide.
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['planches', { cible: 'cascade+', auto: true, colonnes: 5, chiffres: 1 }] })));
  await w.waitForTimeout(400);
  await controler(w, 'planche cascades à 1 chiffre', 'Planches');
  if ((await w.$$('#ecran table.colonne')).length === 0) problemes.push('planche cascades : planche vide');
  if (!(await w.$('#ecran p.retour'))) problemes.push('planche cascades : pas de message de repli');
  // Progression : les trois vues de régularité et de volume.
  await aller(w, 'progression');
  for (let k = 0; k < 3; k++) {
    await w.click(`#ecran .segments button >> nth=${k}`);
    await controler(w, `progression, vue ${k + 1}`);
  }
  // Jeux : chaque jeu de la page.
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['jeux', {}] })));
  await w.waitForTimeout(200);
  const nbJeux = await w.$$eval('#ecran .carte-hub, #ecran .liste-paliers button', (x) => x.length);
  for (let i = 0; i < nbJeux; i++) {
    await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['jeux', {}] })));
    await w.waitForTimeout(150);
    await w.click(`#ecran .carte-hub >> nth=${i}`).catch(() => w.click(`#ecran .liste-paliers button >> nth=${i}`).catch(() => {}));
    await controler(w, `jeu n° ${i + 1}`, 'Jeux');
  }
  // 4. Séance : démarrée (barre « Suivant » ailleurs), et chaque point du plan.
  await aller(w, 'seance');
  await w.waitForTimeout(200);
  const nbPoints = await w.$$eval('#ecran .liste-paliers .ligne-palier', (x) => x.length);
  for (let i = 0; i < nbPoints; i++) {
    await aller(w, 'seance');
    await w.waitForTimeout(200);
    // Les blocs de la séance sont des <details> : seul le bloc en cours est ouvert. On ouvre
    // celui qui contient l'exercice avant de cliquer (sinon l'élément est invisible).
    const titre = await w.$eval(`#ecran .liste-paliers .ligne-palier >> nth=${i}`, (x) => {
      for (let p = x.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
      return x.querySelector('strong').textContent;
    });
    await w.click(`#ecran .liste-paliers .ligne-palier >> nth=${i}`);
    await controler(w, `séance › ${titre}`);
    const barre = await w.$eval('.barre-seance', (x) => !x.hidden).catch(() => false);
    if (!barre) problemes.push(`séance › ${titre} : la barre de séance (étape suivante) n'apparaît pas`);
  }
  await aller(w, 'seance');
  await controler(w, 'séance en cours');
  // 5. Largeur téléphone.
  await w.setViewportSize({ width: 390, height: 820 });
  for (const id of ['seance', 'apprendre', 'entrainer', 'mesurer', 'progression', 'reglages']) { await aller(w, id); await controler(w, `mobile ${id}`); }
  // Le test de positionnement : un palier se lance.
  await w.setViewportSize({ width: 1280, height: 900 });
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['positionnement', {}] })));
  await w.waitForTimeout(200);
  await w.click('#ecran .btn.principal');
  await controler(w, 'positionnement, palier 1', 'Tester mon niveau');
  if (!(await w.$('#ecran .serie'))) problemes.push('positionnement : la série du palier 1 n\'apparaît pas');
  await app.close();

  // 6. Séance terminée aujourd'hui : bilan, proposition, recommencer à la demande.
  [app, w] = await lancer(profil({ seanceFinie: true }));
  await controler(w, 'séance terminée');
  const texte = await w.$eval('main', (x) => x.innerText);
  if (!/Séance du jour terminée/.test(texte)) problemes.push('séance terminée : le bilan n\'apparaît pas');
  if (!/Et maintenant/.test(texte)) problemes.push('séance terminée : pas de proposition d\'activité');
  if (/Continuer :|Commencer :/.test(texte)) problemes.push('séance terminée : une nouvelle séance est relancée sans qu\'on la demande');
  if (/nouvelle séance/i.test(texte)) problemes.push('séance terminée : le bouton « nouvelle séance » existe encore');
  if (!(await w.$('#ecran details.plan-enroule'))) problemes.push('séance terminée : le plan enroulé n\'apparaît pas');
  if (!(await w.$('#ecran .serie-soroban svg'))) problemes.push('séance : la série n\'est pas écrite sur un soroban');
  // Les propositions se lancent en un clic, chacune vers une activité précise.
  const nbProp = await w.$$eval('#ecran .carte.suggestion button', (x) => x.length);
  if (nbProp < 3) problemes.push(`séance terminée : ${nbProp} proposition(s) seulement`);
  for (let i = 0; i < nbProp; i++) {
    await aller(w, 'seance');
    await w.waitForTimeout(200);
    const t = await w.$eval(`#ecran .carte.suggestion button >> nth=${i}`, (x) => x.textContent);
    await w.click(`#ecran .carte.suggestion button >> nth=${i}`);
    await controler(w, `après séance › ${t}`);
  }
  await aller(w, 'seance');
  await w.waitForTimeout(200);
  await w.click('#ecran details.plan-enroule summary');
  await controler(w, 'séance terminée, plan déroulé');
  await app.close();

  // 7. Premier lancement : leçon 0 et son quiz.
  const vierge = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
  [app, w] = await lancer(vierge);
  await controler(w, 'premier lancement');
  if (!/J'ai déjà pratiqué/.test(await w.$eval('main', (x) => x.innerText))) problemes.push('premier lancement : pas de bouton « J\'ai déjà pratiqué »');
  // Jour 0 : pas d'échauffement à 9 tiges dans la séance.
  await w.click('.grand-bouton');
  await controler(w, 'leçon 0 (quiz)', 'Leçons guidées');
  // Avant toute leçon : une activité avancée avertit (sans bloquer).
  await aller(w, 'entrainer');
  await w.waitForTimeout(150);
  if (!(await w.$('#ecran .carte-hub.attenue'))) problemes.push('jour 0 : aucune carte atténuée « conseillé après »');
  await cliquerTexte(w, '#ecran .carte-hub', 'Planches');
  await w.waitForTimeout(200);
  if (!(await w.$('dialog[open]'))) problemes.push('jour 0 : pas d\'avertissement en ouvrant Planches');
  await cliquerTexte(w, 'dialog[open] button', 'Y aller quand même');
  await controler(w, 'jour 0 : Planches quand même', 'Planches');
  await aller(w, 'seance');
  await w.waitForTimeout(200);
  const plan0 = await w.$eval('main', (x) => x.innerText);
  if (/111 111 111/.test(plan0)) problemes.push('jour 0 : la séance propose un drill à 9 tiges');
  // Mode découverte coché dans Réglages, puis la leçon « Lire et poser un nombre » : la saisie apparaît.
  await aller(w, 'reglages');
  await w.waitForTimeout(150);
  await w.check('#ecran input[type=checkbox]');
  await w.waitForTimeout(150);
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['lecons', { sousPalier: 'p0-2', onglet: 'entrainement' }] })));
  await controler(w, 'leçon lecture', 'Leçons guidées');
  if (!(await w.$('#ecran .saisie-nombre'))) problemes.push('leçon lecture : pas de saisie');
  await app.close();

  // 8. Élève avancé (0.38) : 6e kyū passé, leçons du 5e validées, 15 minutes par jour. Séance (3
  //    blocs au plus, bloc de vitesse), marches d'allure (feuille et fractionné), défi au format.
  [app, w] = await lancer(profilAvance());
  await aller(w, 'seance');
  await controler(w, 'avancé : séance');
  const blocs = await w.$$eval('#ecran details.bloc-seance', (x) => x.length);
  if (blocs > 3) problemes.push(`avancé : ${blocs} blocs dans une séance de 15 minutes (3 au plus)`);
  const lignes = await w.$$eval('#ecran details.bloc-seance .ligne-palier', (x) => x.length);
  for (let i = 0; i < lignes; i++) {
    await aller(w, 'seance');
    await w.waitForTimeout(200);
    await w.evaluate(() => document.querySelectorAll('#ecran details.bloc-seance').forEach((x) => { x.open = true; }));
    const t = await w.$eval(`#ecran details.bloc-seance .ligne-palier >> nth=${i}`, (x) => x.querySelector('strong').textContent);
    await w.click(`#ecran details.bloc-seance .ligne-palier >> nth=${i}`);
    await controler(w, `avancé : séance › ${t}`);
  }
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['marches', {}] })));
  await controler(w, 'avancé : marches d\'allure', 'Marches d\'allure');
  if (!/Marche 1|marche 1/.test(await w.$eval('main', (x) => x.innerText))) problemes.push('avancé : la marche 1 n\'apparaît pas');
  await cliquerTexte(w, '#ecran button', 'Feuille de la marche');
  await controler(w, 'avancé : feuille de marche', 'Marches d\'allure');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['marches', {}] })));
  await w.waitForTimeout(200);
  await cliquerTexte(w, '#ecran button', 'Fractionné');
  await controler(w, 'avancé : fractionné', 'Marches d\'allure');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['muldiv', { type: 'div', format: 'kyu', mode: 'feuille', nombre: 8, auto: true, proposition: 'hakari-div' }] })));
  await controler(w, 'avancé : feuille de ÷ au format du kyū');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['defis', {}] })));
  await controler(w, 'avancé : défis');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['epreuves', { dan: true, auto: true }] })));
  await controler(w, 'avancé : examen de dan', 'Épreuves officielles');
  if ((await w.$$('#ecran input')).length < 150) problemes.push('examen de dan : le sujet ne s\'affiche pas en entier');
  // Dan Zenkoren (0.38.3) : système Zenkoren, examen avec liasse de bordereaux, dan d'anzan.
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['epreuves', {}] })));
  await w.waitForTimeout(200);
  await cliquerTexte(w, '#ecran .segments button', 'Zenkoren');
  await controler(w, 'avancé : épreuves Zenkoren', 'Épreuves officielles');
  if (!/Dan d'entraînement Zenkoren/.test(await w.$eval('main', (x) => x.innerText))) problemes.push('épreuves Zenkoren : pas de carte de dan Zenkoren');
  // 0.38.4 : kyū Zenkoren du 3e au 1er, denpyōzan et anzan au choix (cochés par défaut).
  if (((await w.$eval('main', (x) => x.innerText)).match(/Matières au choix \(cochées/g) ?? []).length !== 3) problemes.push('kyū Zenkoren : les matières au choix manquent du 3e au 1er kyū');
  await w.evaluate(() => { const c = [...document.querySelectorAll('#ecran .carte.grade')].find((x) => x.querySelector('strong')?.textContent.startsWith('3e kyū')); c?.querySelector('button.btn.principal')?.click(); });
  await w.waitForTimeout(200);
  await cliquerTexte(w, 'dialog[open] button', 'Y aller quand même');
  await controler(w, 'avancé : 3e kyū Zenkoren avec matières au choix', 'Épreuves officielles');
  if (!(await w.$('#ecran .liasse .bordereau li'))) problemes.push('3e kyū Zenkoren : la liasse du denpyōzan n\'apparaît pas');
  if (!/5 épreuves/.test(await w.$eval('main', (x) => x.innerText))) problemes.push('3e kyū Zenkoren : l\'examen n\'a pas ses 5 épreuves');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['epreuves', {}] })));
  await w.waitForTimeout(200);
  await cliquerTexte(w, '#ecran button', 'Examen de dan Zenkoren');
  await controler(w, 'avancé : examen de dan Zenkoren', 'Épreuves officielles');
  if (!(await w.$('#ecran .liasse .bordereau li'))) problemes.push('dan Zenkoren : la liasse de bordereaux n\'apparaît pas');
  await w.evaluate(() => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['epreuves', {}] })));
  await w.waitForTimeout(200);
  await cliquerTexte(w, '#ecran button', 'Examen de dan d\'anzan');
  await controler(w, 'avancé : examen de dan d\'anzan Zenkoren', 'Épreuves officielles');
  // 0.39 : les nouveaux écrans de vitesse et d'entretien.
  const visiter = async (dest, quoi, texte) => {
    await w.evaluate((x) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: x })), dest);
    await w.waitForTimeout(300);
    await controler(w, `avancé : ${quoi}`);
    if (texte && !(await w.$eval('main', (x) => x.innerText)).includes(texte)) problemes.push(`${quoi} : « ${texte} » n'apparaît pas`);
  };
  await visiter(['rythme', { jeu: 'lievre', format: { lignes: 10, chiffres: 3, cadence: 6, nom: '6e kyū', colonnes: 2 }, auto: true }], 'lièvre au format du grade', 'Le lièvre au format du 6e kyū');
  await visiter(['marches', { surcharge: { type: 'mul', parProduit: 3 } }], 'sprint de surcharge ×', 'Sprint de surcharge');
  await visiter(['epreuves', { grade: '6', sprints: true, auto: true }], 'sprints de la semaine', 'Sprints de la semaine');
  await visiter(['epreuves', { grade: '6', section: 'mul', auto: true }], 'épreuve d\'une seule matière', 'Multiplication seule');
  await visiter(['planches', { genre: 'dan', chiffres: 10, lignes: 10, auto: true }], 'planche au format des dan', 'Format des dan');
  await visiter(['epreuves', {}], 'épreuves : fiche deux mains', null);
  await app.close();

  fs.rmSync(path.join(__dirname, 'sous-paliers.json'));
  console.log(`${ecransVus} écrans contrôlés.`);
  if (problemes.length) {
    console.log(`${problemes.length} problème(s) :`);
    for (const p of [...new Set(problemes)]) console.log(` - ${p}`);
    process.exit(1);
  }
  console.log('Aucun problème.');
})();
