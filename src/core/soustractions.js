/**
 * Table des grands amis en soustraction : les 36 soustractions « à retenue » de base (11 − 2 à
 * 18 − 9), celles où l'on retire 10 puis rend le complément. En multiplication puis en division,
 * elles reviennent à chaque produit : elles doivent sortir d'une touche, sans réfléchir.
 * Fonctions pures.
 */

/** Mélange de Fisher-Yates (copie). */
function melanger(liste) {
  const t = [...liste];
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}

/** Les 36 faits : a de 11 à 18, b tel que a − b tienne sur un chiffre (2 à 9) et franchisse la dizaine. */
export const FAITS_SOUSTRACTION = (() => {
  const liste = [];
  for (let a = 11; a <= 18; a++) for (let b = a - 9; b <= 9; b++) liste.push({ a, b, q: a - b });
  return liste;
})();

/** Médailles : secondes par soustraction (score = temps + 3 s par erreur). */
export const CLASSEMENT_SOUSTRACTION = [
  { id: 'bronze', nom: 'Bronze', s: 3 },
  { id: 'argent', nom: 'Argent', s: 2 },
  { id: 'or', nom: 'Or', s: 1.3 },
  { id: 'platine', nom: 'Platine', s: 0.9 },
];

/** Les 36 soustractions, mélangées, sans deux fois de suite le même nombre de départ. */
export function sprintSoustraction() {
  for (let k = 0; k < 50; k++) {
    const liste = melanger([...FAITS_SOUSTRACTION]);
    if (liste.every((x, i) => !i || x.a !== liste[i - 1].a)) return liste;
  }
  return melanger([...FAITS_SOUSTRACTION]);
}

/** Le geste, en mots : « 13 − 7 : retirer 10, rendre 3 (le grand ami de 7) → 6 ». */
export const gesteSoustraction = (a, b) => `retirer 10, rendre ${10 - b} (le grand ami de ${b}) : ${a} − 10 + ${10 - b} = ${a - b}`;

/** Médaille d'un score (ms), ou null. */
export function classementSoustraction(scoreMs) {
  let r = null;
  for (const c of CLASSEMENT_SOUSTRACTION) if (scoreMs <= c.s * FAITS_SOUSTRACTION.length * 1000) r = c;
  return r;
}

/** Le réflexe est-il installé ? (record au niveau or) */
export const soustractionsAcquises = (d) => {
  const r = d.records?.['sprint-soustraction'];
  return !!r && r.dureeMs <= CLASSEMENT_SOUSTRACTION[2].s * FAITS_SOUSTRACTION.length * 1000;
};

/**
 * Jours où la séance propose la table (jamais tous les jours) : dès les grands amis en
 * soustraction validés. Avant la multiplication, lundi et mercredi ; pendant × et ÷, un jour de
 * plus (le jeudi) ; une fois l'or atteint, le mercredi seulement, en entretien.
 * @param {number} jourSemaine  0 = dimanche
 */
export function soustractionsDuJour(d, jourSemaine, multiplicationAtteinte) {
  if (!d.paliers?.['p4-4']?.valide) return false;
  if (soustractionsAcquises(d)) return jourSemaine === 3;
  return (multiplicationAtteinte ? [1, 3, 4] : [1, 3]).includes(jourSemaine);
}
