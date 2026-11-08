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
const { _electron } = require('playwright');
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
    if (/^p(0|1|2|3|4|5)-|^pa-[0-3]$|^p1-a$|^p6-[a01]$|^p7-[01]$/.test(id)) {
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
  fs.writeFileSync(path.join(__dirname, 'sous-paliers.json'), JSON.stringify({ SOUS_PALIERS: ids }));

  let [app, w] = await lancer(profil());
  // 1. Les 5 entrées du menu, et chaque carte des pages de section.
  for (const id of ['seance', 'apprendre', 'entrainer', 'mesurer', 'progression']) {
    await aller(w, id);
    await controler(w, `menu ${id}`);
    const nb = await w.$$eval('#ecran .carte-hub', (x) => x.length);
    for (let i = 0; i < nb; i++) {
      await aller(w, id);
      await w.waitForTimeout(150);
      const titre = await w.$eval(`#ecran .carte-hub >> nth=${i}`, (x) => x.querySelector('strong').textContent);
      await w.click(`#ecran .carte-hub >> nth=${i}`);
      // La carte « Anzan et visualisation » ouvre la piste anzan des leçons ; « Drills et tables », l'écran Drills.
      const attendu = { 'Anzan et visualisation': 'Leçons guidées', 'Drills et tables': 'Drills' }[titre] ?? titre;
      await controler(w, `${id} › ${titre}`, attendu);
    }
  }
  // 2. Chaque leçon, ses trois onglets (mode découverte : tout est ouvert).
  for (const id of ids) {
    await w.evaluate((x) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: ['lecons', { sousPalier: x }] })), id);
    await w.waitForTimeout(200);
    await controler(w, `leçon ${id}`, 'Leçons guidées');
    const onglets = await w.$$('#ecran .segments button');
    for (let k = 0; k < onglets.length && k < 3; k++) {
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
    ['drills', { tables: 'lents', auto: true }, 'Drills'], ['drills', { tables: [7, 8, 9] }, 'Drills'],
    ['verification', { famille: 'direct' }, 'Vérifier ma vitesse'], ['verification', { famille: 'petit' }, 'Vérifier ma vitesse'], ['verification', { geste: '+3:petit' }, 'Vérifier ma vitesse'], ['defis', { semaine: true }, 'Défis chrono'], ['lexique', {}, 'Lexique'],
  ];
  for (const [ecran, params, attendu] of internes) {
    await w.evaluate((x) => document.dispatchEvent(new CustomEvent('soroban:aller', { detail: x })), [ecran, params]);
    await controler(w, `${ecran} ${JSON.stringify(params)}`, attendu);
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
    const titre = await w.$eval(`#ecran .liste-paliers .ligne-palier >> nth=${i}`, (x) => x.querySelector('strong').textContent);
    await w.click(`#ecran .liste-paliers .ligne-palier >> nth=${i}`);
    await controler(w, `séance › ${titre}`);
    const barre = await w.$eval('.barre-seance', (x) => !x.hidden).catch(() => false);
    if (!barre) problemes.push(`séance › ${titre} : la barre de séance (étape suivante) n'apparaît pas`);
  }
  await aller(w, 'seance');
  await controler(w, 'séance en cours');
  // 5. Largeur téléphone.
  await w.setViewportSize({ width: 390, height: 820 });
  for (const id of ['seance', 'apprendre', 'entrainer', 'mesurer', 'progression']) { await aller(w, id); await controler(w, `mobile ${id}`); }
  await app.close();

  // 6. Séance terminée aujourd'hui : bilan, proposition, recommencer à la demande.
  [app, w] = await lancer(profil({ seanceFinie: true }));
  await controler(w, 'séance terminée');
  const texte = await w.$eval('main', (x) => x.innerText);
  if (!/Séance du jour terminée/.test(texte)) problemes.push('séance terminée : le bilan n\'apparaît pas');
  if (!/Et maintenant/.test(texte)) problemes.push('séance terminée : pas de proposition d\'activité');
  if (/Continuer :|Commencer :/.test(texte)) problemes.push('séance terminée : une nouvelle séance est relancée sans qu\'on la demande');
  await cliquerTexte(w, 'button', 'Faire une nouvelle séance');
  await controler(w, 'nouvelle séance demandée');
  if (!/Commencer :/.test(await w.$eval('main', (x) => x.innerText))) problemes.push('nouvelle séance : le plan n\'apparaît pas');
  await app.close();

  // 7. Premier lancement : leçon 0 et son quiz.
  const vierge = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-'));
  [app, w] = await lancer(vierge);
  await controler(w, 'premier lancement');
  await w.click('.grand-bouton');
  await controler(w, 'leçon 0 (quiz)', 'Leçons guidées');
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
