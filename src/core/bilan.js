/**
 * Bilan de séance : ce qui a changé entre le début et la fin de la séance.
 * La séance commence par un « instantané » des niveaux, records et succès ; à la fin on compare.
 */

import { evaluer, NIVEAUX } from './maitrise.js';
import { nomMotif } from './motifs.js';
import { SOUS_PALIERS, familleLecon } from './curriculum.js';

/** Instantané pris au début de la séance. */
export function instantane(d, succes) {
  return {
    gestes: Object.fromEntries(Object.entries(d.motifs).map(([k, f]) => [k, evaluer(f.hist ?? []).index])),
    lecons: Object.fromEntries(Object.entries(d.paliers).map(([k, e]) => {
      const sp = SOUS_PALIERS.find((s) => s.id === k);
      return [k, { niveau: sp ? evaluer(e.hist ?? [], familleLecon(sp)).index : 0, valide: !!e.valide }];
    })),
    records: JSON.parse(JSON.stringify(d.records)),
    succes: [...succes],
  };
}

/**
 * @param {object} avant  instantané du début
 * @param {object} d      données actuelles
 * @param {number} debut  horodatage du début
 * @param {string[]} succes  succès obtenus maintenant
 */
export function bilanSeance(avant, d, debut, succes) {
  const sessions = d.sessions.filter((s) => (s.horodatage ?? 0) >= debut);
  const exercices = sessions.reduce((s, x) => s + (x.total ?? 0), 0);
  const justes = sessions.reduce((s, x) => s + (x.justes ?? 0), 0);
  const dureeMs = sessions.reduce((s, x) => s + (x.dureeMs ?? 0), 0);
  const progres = [];
  for (const [k, f] of Object.entries(d.motifs)) {
    const i = evaluer(f.hist ?? []).index;
    if (i > (avant.gestes[k] ?? 0) && i >= 2) progres.push(`${nomMotif(k)} : ${NIVEAUX[i].nom}`);
  }
  for (const [k, e] of Object.entries(d.paliers)) {
    const sp = SOUS_PALIERS.find((s) => s.id === k);
    if (!sp) continue;
    if (e.valide && !avant.lecons[k]?.valide) progres.push(`Leçon validée : ${sp.titre}`);
    const i = evaluer(e.hist ?? [], familleLecon(sp)).index;
    if (i > (avant.lecons[k]?.niveau ?? 0) && i >= 2) progres.push(`${sp.titre} : ${NIVEAUX[i].nom}`);
  }
  const records = Object.keys(d.records).filter((k) => JSON.stringify(d.records[k]) !== JSON.stringify(avant.records[k]));
  const nouveauxSucces = succes.filter((s) => !avant.succes.includes(s));
  return { exercices, justes, dureeMs, progres, records, nouveauxSucces };
}
