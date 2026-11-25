/**
 * 0.41 : vues « ma semaine » et « mon mois ».
 *  - La semaine : l'équilibre du temps de pratique des 7 derniers jours entre apprendre, consolider,
 *    vitesse et volume, anzan, examens ; et ce qui a manqué.
 *  - Le mois : les 4 prochaines semaines, avec les leçons prévues au rythme des 28 derniers jours
 *    (colonnes et × ÷ en alternance) et l'examen de la semaine (vendredi au dimanche).
 * Fonctions pures.
 */

import { SOUS_PALIERS, pisteDe } from './curriculum.js';

const CATEGORIES = [
  { id: 'apprendre', nom: 'Apprendre', modules: ['lecons'] },
  { id: 'consolider', nom: 'Consolider', modules: ['revisions', 'erreurs', 'verification'] },
  { id: 'vitesse', nom: 'Vitesse et volume', modules: ['planches', 'rythme', 'drills', 'defis', 'marches', 'muldiv', 'jeux', 'quotidien'] },
  { id: 'anzan', nom: 'Anzan', modules: ['anzan', 'dictee'] },
  { id: 'examens', nom: 'Examens', modules: ['examen', 'epreuves'] },
];
const ajouter = (date, n) => new Date(new Date(`${date}T12:00`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Répartition du temps des 7 derniers jours (minutes et parts) et la catégorie qui a manqué. */
export function equilibreSemaine(d, date) {
  const depuis = ajouter(date, -6);
  const min = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  for (const s of d.sessions ?? []) {
    if (s.date < depuis || s.date > date) continue;
    const c = CATEGORIES.find((x) => x.modules.includes(s.module));
    if (c) min[c.id] += (s.dureeMs ?? 0) / 60000;
  }
  const total = Object.values(min).reduce((a, b) => a + b, 0);
  const parts = CATEGORIES.map((c) => ({ ...c, minutes: Math.round(min[c.id]), part: total ? min[c.id] / total : 0 }));
  // Ce qui manque : une catégorie à moins de 5 % (hors examens, hebdomadaires).
  const manque = total >= 30 ? parts.filter((p) => p.id !== 'examens' && p.part < 0.05).map((p) => p.nom) : [];
  return { total: Math.round(total), parts, manque };
}

/**
 * Les 4 prochaines semaines : leçons prévues (au rythme récent, au moins une par semaine) et examen.
 * @param {(sp) => boolean} ouverte  la leçon est-elle ouverte (ou le sera-t-elle dans l'ordre) ?
 */
export function planMois(d, date) {
  const valide = (id) => !!d.paliers?.[id]?.valide;
  const depuis = ajouter(date, -28);
  const recentes = SOUS_PALIERS.filter((sp) => !sp.mental && d.paliers?.[sp.id]?.valide >= depuis).length;
  const rythme = Math.max(1, Math.round(recentes / 4));
  const colonnes = SOUS_PALIERS.filter((sp) => pisteDe(sp) === 'colonnes' && !valide(sp.id) && sp.type !== 'theorie');
  const muldiv = SOUS_PALIERS.filter((sp) => pisteDe(sp) === 'muldiv' && !valide(sp.id));
  // Alternance des deux pistes (la piste × ÷ seulement quand ses portes sont passées, ce qu'on ne peut
  // pas prévoir ici : on la montre à partir de la leçon des tables, une fois les grands amis faits).
  let muldivPossible = valide('p4-5');
  let mulOk = valide('p5-4');
  const file = [];
  let ic = 0;
  let im = 0;
  while (file.length < rythme * 4 && (ic < colonnes.length || (muldivPossible && im < muldiv.length))) {
    if (ic < colonnes.length) { const x = colonnes[ic++]; file.push(x); if (x.id === 'p4-5') muldivPossible = true; if (x.id === 'p5-4') mulOk = true; }
    // (les tables dès les grands amis ; la multiplication sur le soroban après les cascades, voir porteMulDiv)
    if (muldivPossible && im < muldiv.length && file.length < rythme * 4 && (mulOk || muldiv[im].id === 'p6-a')) file.push(muldiv[im++]);
    else if (ic >= colonnes.length && muldivPossible && im < muldiv.length) file.push(muldiv[im++]);
    else if (ic >= colonnes.length) break;
  }
  const lundi = (x) => { const j = new Date(`${x}T12:00`); j.setDate(j.getDate() - ((j.getDay() + 6) % 7)); return j.toISOString().slice(0, 10); };
  const debut = lundi(date);
  return Array.from({ length: 4 }, (_, k) => {
    const l = ajouter(debut, 7 * k);
    return { du: l, au: ajouter(l, 6), examen: ajouter(l, 4), lecons: file.slice(k * rythme, (k + 1) * rythme) };
  });
}
