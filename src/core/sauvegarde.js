/**
 * Export / import des données de progression.
 *
 * Format d'export : { application: 'soroban', exporte: ISO, donnees: {...progression...} }.
 * Import : « remplacer » (tout est pris tel quel) ou « fusionner » (le meilleur des deux) :
 *  - séances : union (sans doublons) ;
 *  - records : le meilleur (temps le plus court, ou score le plus haut) ;
 *  - leçons : celle qui a le plus d'exercices ; validation la plus ancienne ; révision la plus avancée ;
 *  - gestes : la fiche la plus fournie ; succès : union (date la plus ancienne) ;
 *  - réglages : ceux de l'appareil actuel.
 */

export const APPLICATION = 'soroban';

export function exporter(donnees) {
  return JSON.stringify({ application: APPLICATION, exporte: new Date().toISOString(), donnees }, null, 2);
}

/** Lit un texte d'export ; lève une erreur lisible si ce n'est pas une sauvegarde valide. */
export function lireExport(texte) {
  let o;
  try {
    o = JSON.parse(texte);
  } catch {
    throw new Error('Ce texte n\'est pas une sauvegarde valide (JSON illisible).');
  }
  const d = o?.application === APPLICATION ? o.donnees : o; // accepte aussi le fichier brut de l'application
  if (!d || typeof d !== 'object' || !Array.isArray(d.sessions) || typeof d.version !== 'number') {
    throw new Error('Ce fichier ne ressemble pas à une sauvegarde de Soroban.');
  }
  return d;
}

const meilleurRecord = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  if (a.points !== undefined || b.points !== undefined) return (b.points ?? -Infinity) > (a.points ?? -Infinity) ? b : a;
  return b.dureeMs < a.dureeMs ? b : a;
};
const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

/** Fusionne deux jeux de données de même version. */
export function fusionner(actuel, importe) {
  const r = structuredClone(actuel);
  const cle = (s) => `${s.horodatage ?? ''}|${s.date}|${s.module}|${s.mode ?? ''}|${s.total}|${s.dureeMs}`;
  const vues = new Set(r.sessions.map(cle));
  for (const s of importe.sessions ?? []) if (!vues.has(cle(s))) r.sessions.push(s);
  r.sessions.sort((a, b) => (a.horodatage ?? 0) - (b.horodatage ?? 0));
  for (const [k, v] of Object.entries(importe.records ?? {})) r.records[k] = meilleurRecord(r.records[k], v);
  for (const [k, v] of Object.entries(importe.motifs ?? {})) {
    if (!r.motifs[k] || (v.essais ?? 0) > (r.motifs[k].essais ?? 0)) r.motifs[k] = v;
  }
  for (const [k, v] of Object.entries(importe.paliers ?? {})) {
    const a = r.paliers[k];
    if (!a) { r.paliers[k] = v; continue; }
    const base = (v.reps ?? 0) > (a.reps ?? 0) ? { ...v } : { ...a };
    base.valide = minDate(a.valide, v.valide);
    const cartes = [a.carte, v.carte].filter(Boolean);
    base.carte = cartes.sort((x, y) => y.boite - x.boite || y.echeance.localeCompare(x.echeance))[0] ?? null;
    r.paliers[k] = base;
  }
  r.succes ??= {};
  for (const [k, v] of Object.entries(importe.succes ?? {})) r.succes[k] = minDate(r.succes[k], v);
  r.stats ??= { suite: 0, meilleureSuite: 0 };
  r.stats.meilleureSuite = Math.max(r.stats.meilleureSuite ?? 0, importe.stats?.meilleureSuite ?? 0);
  return r;
}
