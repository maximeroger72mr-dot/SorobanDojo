/**
 * Banc de qualité des planches : mesure ce que les générateurs produisent vraiment, sur des
 * graines fixes (les chiffres se retrouvent d'un lancement à l'autre).
 *
 *   npm run banc              affiche les mesures
 *   npm run banc -- --json    les mêmes, en JSON
 *   npm run banc -- --seuils  code de sortie 1 si un seuil de qualité n'est pas tenu
 *
 * Mesures : couverture des gestes visés, gestes absents, charge (moyenne et dispersion),
 * replis des planches « un geste », durée de génération, opérandes d'examen trop faciles.
 */

import { genererPlanche, genererPlancheGeste } from '../src/core/planche.js';
import { TOUS_LES_MOTIFS } from '../src/core/motifs.js';
import { GRADES, genererSujet } from '../src/core/epreuves.js';
import { avecGraine } from '../src/core/hasard.js';

const AMIS = TOUS_LES_MOTIFS.filter((c) => !c.endsWith(':direct'));
const GESTES = AMIS.filter((c) => /^[+-]\d:/.test(c));
const pct = (x) => Math.round(x * 1000) / 10;
const moyenne = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dispersion = (xs) => { const m = moyenne(xs); return Math.sqrt(moyenne(xs.map((x) => (x - m) ** 2))) / m; };

function melangees(chiffres, lignes, n = 100) {
  const couv = [];
  const couts = [];
  const absents = {};
  const debut = performance.now();
  for (let g = 0; g < n; g++) {
    const p = genererPlanche({ chiffres, lignes, colonnes: 10, autorises: null, cibles: AMIS }, g * 104729 + 1);
    couv.push(p.bilan.couverture);
    couts.push(p.bilan.coutTotal);
    for (const a of p.bilan.absents) absents[a] = (absents[a] ?? 0) + 1;
  }
  return {
    format: `${chiffres} chiffre${chiffres > 1 ? 's' : ''} × ${lignes} lignes × 10 colonnes`,
    couvertureMoyenne: pct(moyenne(couv)), couvertureMin: pct(Math.min(...couv)),
    charge: Math.round(moyenne(couts)), dispersionCharge: pct(dispersion(couts)),
    msParPlanche: Math.round((performance.now() - debut) / n),
    absents: Object.entries(absents).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, k]) => `${c} (${pct(k / n)} %)`),
  };
}

function unGeste(n = 3) {
  const appris = new Set(TOUS_LES_MOTIFS);
  let total = 0; let abandonnees = 0; let avecSimples = 0;
  const debut = performance.now();
  for (const cible of GESTES) for (const chiffres of [1, 2]) for (let g = 1; g <= n; g++) {
    total += 1;
    const p = genererPlancheGeste({ cible, mode: 'seul', chiffres, lignes: 6, colonnes: 10, appris }, g * 7919);
    if (!p) abandonnees += 1;
    else if (p.bilan.replis.some((r) => r.type === 'simples')) avecSimples += 1;
  }
  return { planches: total, abandonnees: pct(abandonnees / total), avecColonnesSimples: pct(avecSimples / total), msParPlanche: Math.round((performance.now() - debut) / total) };
}

function examens(n = 100) {
  return ['6', '3', '1'].map((id) => {
    const grade = GRADES.find((g) => g.id === id);
    let problemes = 0; let faciles = 0; let doublons = 0;
    for (let g = 0; g < n; g++) {
      const sujet = avecGraine(g * 613 + 5, () => genererSujet(grade));
      for (const sec of sujet.sections.filter((s) => s.cle !== 'mitori')) {
        const vus = new Set();
        for (const p of sec.problemes) {
          problemes += 1;
          const a = String(p.type === 'mul' ? p.a : p.b).replace(/\D/g, '');
          const b = String(p.type === 'mul' ? p.b : p.resultat).replace(/\D/g, '');
          if (a.endsWith('0') || b.endsWith('0')) faciles += 1;
          if (vus.has(`${a}x${b}`)) doublons += 1;
          vus.add(`${a}x${b}`);
        }
      }
    }
    return { grade: grade.nom, operandeFinissantParZero: pct(faciles / problemes), doublonsParSujet: Math.round((doublons / n) * 100) / 100 };
  });
}

const mesures = {
  melangees: [[1, 5], [2, 5], [2, 8], [3, 10], [5, 10]].map(([c, l]) => melangees(c, l)),
  unGeste: unGeste(),
  examens: examens(),
};

// Seuils de qualité (SPECS.md, 4.1) : ce que les planches doivent tenir.
const ecarts = [];
for (const m of mesures.melangees) {
  if (m.format.startsWith('1 ')) continue; // à 1 chiffre, quelques gestes rares n'ont pas toujours leur place
  if (m.couvertureMoyenne < 95) ecarts.push(`${m.format} : couverture moyenne ${m.couvertureMoyenne} % (< 95 %)`);
  if (m.couvertureMin < 89) ecarts.push(`${m.format} : couverture minimale ${m.couvertureMin} % (< 89 %)`);
  if (m.dispersionCharge > 5) ecarts.push(`${m.format} : dispersion de la charge ${m.dispersionCharge} % (> 5 %)`);
  if (m.msParPlanche > 250) ecarts.push(`${m.format} : ${m.msParPlanche} ms par planche (> 250 ms)`);
}
if (mesures.unGeste.abandonnees > 0) ecarts.push(`planches « un geste » abandonnées : ${mesures.unGeste.abandonnees} %`);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ mesures, ecarts }, null, 2));
} else {
  console.log('Planches mélangées (tous les gestes, 100 planches par format)');
  for (const m of mesures.melangees) console.log(`  ${m.format} : couverture ${m.couvertureMoyenne} % (min ${m.couvertureMin} %), charge ${m.charge} ± ${m.dispersionCharge} %, ${m.msParPlanche} ms${m.absents.length ? `, absents : ${m.absents.join(', ')}` : ''}`);
  const u = mesures.unGeste;
  console.log(`Planches « un geste » (${u.planches} planches, 1 et 2 chiffres) : abandonnées ${u.abandonnees} %, avec colonnes simples ${u.avecColonnesSimples} %, ${u.msParPlanche} ms`);
  console.log('Épreuves officielles, × et ÷');
  for (const e of mesures.examens) console.log(`  ${e.grade} : opérande finissant par 0 dans ${e.operandeFinissantParZero} % des problèmes, ${e.doublonsParSujet} doublon par sujet`);
  console.log(ecarts.length ? `\nSeuils non tenus :\n  ${ecarts.join('\n  ')}` : '\nTous les seuils sont tenus.');
}
if (process.argv.includes('--seuils') && ecarts.length) process.exit(1);
