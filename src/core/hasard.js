/**
 * Hasard reproductible : exécute un générateur avec une graine fixe, pour que le même
 * « défi de la semaine » soit tiré à chaque essai de la semaine.
 */

/** Générateur pseudo-aléatoire mulberry32 (rapide, suffisant pour des exercices). */
function mulberry32(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exécute fn() avec Math.random remplacé par un générateur à graine fixe. */
export function avecGraine(graine, fn) {
  const original = Math.random;
  Math.random = mulberry32(graine);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** Semaine ISO d'une date 'AAAA-MM-JJ' : { annee, semaine, cle: 'AAAA-Sxx' }. */
export function semaineISO(date) {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d - debutAnnee) / 86400000 + 1) / 7);
  return { annee: d.getUTCFullYear(), semaine, cle: `${d.getUTCFullYear()}-S${String(semaine).padStart(2, '0')}` };
}
