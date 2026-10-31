/**
 * Niveaux d'acquisition, vitesse et équilibrage des fréquences.
 *
 * Un geste (ou une leçon) est « acquis » quand il est JUSTE et RAPIDE. On regarde les
 * FENETRE derniers essais : taux de réussite et temps médian des essais réussis.
 *
 * Le temps est ramené à une unité de travail, pour comparer des exercices de tailles différentes :
 *  - colonne : secondes par chiffre traité (somme des chiffres de toutes les lignes) ;
 *  - multiplication / division : secondes par produit partiel.
 * Exercices un par un : le chronomètre s'arrête à la PREMIÈRE TOUCHE tapée, la frappe n'est donc
 * pas comptée (SURCOUT_S = 0). Feuilles : on ne peut pas séparer calcul et frappe, on retire
 * forfaitairement SURCOUT_FEUILLE_S par problème.
 *
 * Tous les seuils sont réunis ici : à ajuster selon l'expérience.
 */

export const FENETRE = 30;       // nombre d'essais récents pris en compte
export const MIN_ESSAIS = 8;     // en dessous : « à découvrir »
export const SURCOUT_S = 0;            // exercices un par un : chrono arrêté à la 1re touche
export const SURCOUT_FEUILLE_S = 1.5;  // feuilles : frappe du résultat, retirée forfaitairement

/**
 * Niveaux, du plus bas au plus haut. reussite : taux minimal ; temps : secondes maximales
 * par unité (médiane), pour les colonnes (addsub) et pour multiplication/division (muldiv).
 */
export const NIVEAUX = [
  { id: 'decouverte', nom: 'À découvrir' },
  { id: 'progres', nom: 'En progrès' },
  { id: 'debutant', nom: 'Acquis débutant', reussite: 0.90, temps: { addsub: 3.0, muldiv: 5.0 } },
  { id: 'confirme', nom: 'Acquis confirmé', reussite: 0.95, temps: { addsub: 1.5, muldiv: 3.0 } },
  { id: 'expert', nom: 'Acquis expert', reussite: 0.98, temps: { addsub: 0.8, muldiv: 1.8 } },
];

const nbChiffres = (n) => String(n).replace(/\D/g, '').replace(/^0+(?=\d)/, '').length;

/** Nombre d'unités de travail d'un exercice. */
export function unites(ex) {
  if (ex.type === 'mul') return nbChiffres(ex.a) * nbChiffres(ex.b);
  if (ex.type === 'div') return nbChiffres(ex.b) * nbChiffres(ex.resultat);
  return ex.lignes.reduce((s, l) => s + nbChiffres(l.n), 0);
}

export const familleTemps = (ex) => (ex.type === 'mul' || ex.type === 'div' ? 'muldiv' : 'addsub');

/** Secondes par unité pour un exercice fait en dureeMs (surcout : temps fixe à retirer). */
export function tempsParUnite(ex, dureeMs, surcout = SURCOUT_S) {
  return Math.max(0.1, dureeMs / 1000 - surcout) / unites(ex);
}

/** Temps cible (en secondes, pour cet exercice entier) correspondant à un niveau. */
export function tempsCible(ex, niveau) {
  return SURCOUT_S + niveau.temps[familleTemps(ex)] * unites(ex);
}

const mediane = (xs) => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/**
 * Évalue un historique [{ ok: 0|1, t: secondes par unité }].
 * @returns {{ niveau, index, essais, reussite, temps, prochain, manque: string[] }}
 */
export function evaluer(hist = [], famille = 'addsub') {
  const recents = hist.slice(-FENETRE);
  const essais = recents.length;
  const reussite = essais ? recents.filter((h) => h.ok).length / essais : 0;
  const temps = mediane(recents.filter((h) => h.ok).map((h) => h.t));
  let index = essais < MIN_ESSAIS ? 0 : 1;
  if (essais >= MIN_ESSAIS) {
    for (let i = 2; i < NIVEAUX.length; i++) {
      const n = NIVEAUX[i];
      if (reussite >= n.reussite && temps !== null && temps <= n.temps[famille]) index = i;
    }
  }
  const prochain = NIVEAUX[index + 1] ?? null;
  const manque = [];
  if (prochain?.reussite) {
    if (essais < MIN_ESSAIS) manque.push(`${MIN_ESSAIS - essais} essai${MIN_ESSAIS - essais > 1 ? 's' : ''} de plus`);
    if (reussite < prochain.reussite) manque.push(`réussite ≥ ${Math.round(prochain.reussite * 100)} %`);
    if (temps === null || temps > prochain.temps[famille]) manque.push(`≤ ${prochain.temps[famille].toLocaleString('fr-FR')} s par ${famille === 'addsub' ? 'chiffre' : 'produit'}`);
  }
  return { niveau: NIVEAUX[index], index, essais, reussite, temps, prochain, manque };
}

/** Ajoute un essai à un historique borné. */
export function ajouterEssai(hist, ok, t) {
  hist.push({ ok: ok ? 1 : 0, t: Math.round(t * 100) / 100 });
  if (hist.length > FENETRE * 2) hist.splice(0, hist.length - FENETRE * 2);
}

/**
 * Poids de tirage des cibles :
 *  - équilibrage : un motif moins pratiqué que la moyenne est tiré plus souvent (et inversement) ;
 *  - remédiation : un motif réellement en difficulté (dette > seuil) est tiré deux fois plus.
 * @param {string[]} cibles
 * @param {(cle) => {essais:number, dette:number}|undefined} fiche
 */
export function poidsEquilibre(cibles, fiche, seuilDette = 2) {
  const essais = cibles.map((c) => fiche(c)?.essais ?? 0);
  const moyenne = essais.reduce((a, b) => a + b, 0) / cibles.length;
  const poids = {};
  cibles.forEach((c, i) => {
    const eq = Math.min(5, Math.max(0.2, ((moyenne + 5) / (essais[i] + 5)) ** 2));
    poids[c] = eq * ((fiche(c)?.dette ?? 0) > seuilDette ? 2 : 1);
  });
  return poids;
}
