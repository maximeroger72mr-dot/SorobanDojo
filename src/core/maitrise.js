/**
 * Niveaux d'acquisition, vitesse et équilibrage des fréquences.
 *
 * Un geste (ou une leçon) est « acquis » quand il est JUSTE et RAPIDE. On regarde les
 * FENETRE derniers essais : taux de réussite et temps médian des essais réussis.
 *
 * Le temps est ramené à une unité de travail, pour comparer des exercices de tailles différentes :
 *  - colonne : secondes par chiffre traité (somme des chiffres de toutes les lignes) ;
 *  - multiplication / division : secondes par produit partiel ;
 *  - photo du soroban : secondes par chiffre lu (après disparition de l'image).
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
 * UNE seule échelle dans toute l'application : bronze, argent, or, platine. Elle est absolue
 * (elle ne change pas avec le grade visé) ; chaque médaille correspond à l'allure d'un kyū
 * (voir allure.js, equivalenceKyu : argent ≈ 6e kyū, or ≈ 4e, platine ≈ 2e, en colonnes).
 * Les identifiants (debutant, confirme, expert) restent ceux des données enregistrées.
 */
export const NIVEAUX = [
  { id: 'decouverte', nom: 'À découvrir' },
  { id: 'progres', nom: 'Bronze' },
  { id: 'debutant', nom: 'Argent', reussite: 0.90, temps: { addsub: 3.0, muldiv: 5.0, placement: 4.0, table: 2.5, photo: 2.0 } },
  { id: 'confirme', nom: 'Or', reussite: 0.95, temps: { addsub: 1.5, muldiv: 3.0, placement: 2.5, table: 1.5, photo: 1.0 } },
  { id: 'expert', nom: 'Platine', reussite: 0.98, temps: { addsub: 0.8, muldiv: 1.8, placement: 1.5, table: 1.0, photo: 0.6 } },
];

/**
 * Échelle « avancée », une fois le 3e kyū réussi : tout monte d'un cran. L'argent prend l'ancien
 * or, l'or l'ancien platine, et le platine devient l'allure du 1er kyū avec 10 % de marge
 * (0,57 s par chiffre et 1,13 s par produit à l'examen, voir allure.js : 0,51 et 1,02 ici ; 0.40.4 :
 * 0,52 et 1,05 avant, sujets avec 60 % de décimaux dans la seconde moitié × ÷).
 * Les autres familles suivent le même cran. Les données enregistrées ne changent pas : seuls les
 * seuils changent, et les niveaux se recalculent.
 */
const BASE = NIVEAUX.map((n) => (n.temps ? { reussite: n.reussite, temps: { ...n.temps } } : null));
export const ECHELLE_AVANCEE = {
  debutant: { reussite: 0.95, temps: { ...BASE[3].temps } },
  confirme: { reussite: 0.98, temps: { ...BASE[4].temps } },
  expert: { reussite: 0.98, temps: { addsub: 0.51, muldiv: 1.02, placement: 1.0, table: 0.7, photo: 0.4 } },
};
let avancee = false;
/** Bascule l'échelle (appelé par progression.js après chaque sauvegarde). */
export function appliquerEchelle(av) {
  if (!!av === avancee) return;
  avancee = !!av;
  NIVEAUX.forEach((n, i) => {
    if (!BASE[i]) return;
    const src = avancee ? ECHELLE_AVANCEE[n.id] : BASE[i];
    n.reussite = src.reussite;
    n.temps = { ...src.temps };
  });
}
export const echelleAvancee = () => avancee;

/** Unité de temps de chaque famille (« ≤ 1,5 s par chiffre »). Une seule liste pour tout l'affichage. */
export const UNITES_TEMPS = { addsub: 'chiffre', muldiv: 'produit', placement: 'placement', table: 'produit', photo: 'chiffre lu' };

const nbChiffres = (n) => String(n).replace(/\D/g, '').replace(/^0+(?=\d)/, '').length;

/** Nombre d'unités de travail d'un exercice. */
export function unites(ex) {
  if (ex.type === 'placement' || ex.type === 'table' || ex.type === 'tenir' || ex.type === 'complement' || ex.type === 'poser') return 1;
  if (ex.type === 'lire') return nbChiffres(ex.n);
  if (ex.type === 'photo') return nbChiffres(ex.n);
  if (ex.type === 'quotidien') return ex.unites ?? 1;
  if (ex.type === 'mul') return nbChiffres(ex.a) * nbChiffres(ex.b);
  if (ex.type === 'div') return nbChiffres(ex.b) * nbChiffres(ex.resultat);
  return ex.lignes.reduce((s, l) => s + nbChiffres(l.n), 0);
}

export const familleTemps = (ex) => (ex.type === 'placement' || ex.type === 'table' ? ex.type
  : ex.type === 'complement' ? 'table'
  : ex.type === 'photo' || ex.type === 'tenir' || ex.type === 'lire' || ex.type === 'poser' ? 'photo'
    : ex.type === 'mul' || ex.type === 'div' ? 'muldiv' : 'addsub');

/** Secondes par unité pour un exercice fait en dureeMs (surcout : temps fixe à retirer). */
export function tempsParUnite(ex, dureeMs, surcout = SURCOUT_S) {
  return Math.max(0.1, dureeMs / 1000 - surcout) / unites(ex);
}

/** Temps cible (en secondes, pour cet exercice entier) correspondant à un niveau. */
export function tempsCible(ex, niveau) {
  return SURCOUT_S + niveau.temps[familleTemps(ex)] * unites(ex);
}

/**
 * Affichage d'un temps (secondes). Une décimale, sauf quand l'arrondi tomberait PILE sur un
 * seuil de niveau sans l'atteindre (1,52 s affiché « 1,5 s » alors qu'il faut ≤ 1,5 s) : deux.
 */
export function formaterTemps(t) {
  if (t == null) return '—';
  const seuils = NIVEAUX.filter((n) => n.temps).flatMap((n) => Object.values(n.temps));
  const un = Math.round(t * 10) / 10;
  const deux = seuils.includes(un) && Math.abs(t - un) >= 0.005;
  return `${t.toLocaleString('fr-FR', { minimumFractionDigits: deux ? 2 : 1, maximumFractionDigits: deux ? 2 : 1 })} s`;
}

/**
 * Cadence en CHIFFRES PAR MINUTE (CPM) : 60 / temps par chiffre. Plus c'est haut, mieux c'est ;
 * c'est l'unité principale des performances. Seuils : débutant 20, confirmé 40, expert 75 CPM.
 * Hors addition/soustraction (produits, placements…) : « par minute » sur l'unité de la famille.
 */
export const cpm = (t) => (t == null ? null : Math.round(60 / t));
export function formaterCadence(t, famille = 'addsub') {
  if (t == null) return '—';
  // Pluriel mot à mot : « chiffres lus/min », « produits/min ».
  const pluriel = (UNITES_TEMPS[famille] ?? 'unité').split(' ').map((m) => `${m}s`).join(' ');
  return famille === 'addsub' ? `${cpm(t)} CPM` : `${cpm(t)} ${pluriel}/min`;
}
/** « 40 CPM (1,5 s par chiffre) » : la cadence en grand, le temps en petit. */
export function formaterVitesse(t, famille = 'addsub') {
  if (t == null) return '—';
  return `${formaterCadence(t, famille)} (${formaterTemps(t)} par ${UNITES_TEMPS[famille] ?? 'unité'})`;
}

export const mediane = (xs) => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/**
 * Évalue un historique [{ ok: 0|1, t: secondes par unité }].
 * @returns {{ niveau, index, essais, reussite, temps, prochain, manque: string[] }}
 */
/**
 * 0.41 : seuils de justesse par CHIFFRE pour les colonnes longues. Une colonne de c chiffres juste avec
 * une erreur par chiffre e : (1 − e)^c. La justesse exigée d'une leçon est la plus basse de son seuil
 * habituel (90, 95, 98 %) et de ce qu'exige ce taux par chiffre : inchangée pour les colonnes courtes
 * (jusqu'à 15 à 25 chiffres), plus juste pour les longues. Avant : 90 % de colonnes de 55 chiffres
 * justes demandaient 0,19 % d'erreur par chiffre, la précision d'un 2e kyū sur une leçon du 4e.
 */
export const ERREUR_PAR_CHIFFRE = { debutant: 0.004, confirme: 0.002, expert: 0.001 };
export const reussiteExigee = (n, chiffres) => (chiffres && ERREUR_PAR_CHIFFRE[n.id] ? Math.min(n.reussite, (1 - ERREUR_PAR_CHIFFRE[n.id]) ** chiffres) : n.reussite);

export function evaluer(hist = [], famille = 'addsub', { chiffres = null } = {}) {
  const recents = hist.slice(-FENETRE);
  const essais = recents.length;
  const reussite = essais ? recents.filter((h) => h.ok).length / essais : 0;
  // Essais sans temps (feuilles mélangées : seule la justesse compte) : hors de la vitesse.
  const temps = mediane(recents.filter((h) => h.ok && h.t != null).map((h) => h.t));
  let index = essais < MIN_ESSAIS ? 0 : 1;
  if (essais >= MIN_ESSAIS) {
    for (let i = 2; i < NIVEAUX.length; i++) {
      const n = NIVEAUX[i];
      if (reussite >= reussiteExigee(n, chiffres) - 1e-9 && temps !== null && n.temps[famille] != null && temps <= n.temps[famille]) index = i;
    }
  }
  const prochain = NIVEAUX[index + 1] ?? null;
  const manque = [];
  if (prochain?.reussite) {
    if (essais < MIN_ESSAIS) manque.push(`${MIN_ESSAIS - essais} essai${MIN_ESSAIS - essais > 1 ? 's' : ''} de plus`);
    if (reussite < reussiteExigee(prochain, chiffres) - 1e-9) manque.push(`réussite ≥ ${Math.round(reussiteExigee(prochain, chiffres) * 100)} %`);
    if (temps === null || temps > prochain.temps[famille]) manque.push(famille === 'addsub' ? `≥ ${cpm(prochain.temps.addsub)} CPM` : `≤ ${prochain.temps[famille].toLocaleString('fr-FR')} s par ${UNITES_TEMPS[famille] ?? 'unité'}`);
  }
  return { niveau: NIVEAUX[index], index, essais, reussite, temps, prochain, manque };
}

/** Ajoute un essai à un historique borné. */
export function ajouterEssai(hist, ok, t) {
  hist.push({ ok: ok ? 1 : 0, t: t == null ? null : Math.round(t * 100) / 100 });
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

// ------------------------------------------------------------------ plateaux

/** Lundi de la semaine d'une date AAAA-MM-JJ (clé des médianes hebdomadaires). */
export function lundi(date) {
  const d = new Date(`${date}T12:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SEMAINES_GARDEES = 12;
const TEMPS_PAR_SEMAINE = 60;

/**
 * Garde les temps des essais RÉUSSIS, semaine par semaine (pour repérer un plateau sur la durée,
 * ce que l'historique des 30 derniers essais ne permet pas).
 */
export function ajouterSemaine(fiche, t, date, format = null, seulementFormat = false) {
  if (t == null) return;
  const ranger = (sem) => {
    const s = (sem[lundi(date)] ??= []);
    s.push(Math.round(t * 100) / 100);
    if (s.length > TEMPS_PAR_SEMAINE) s.shift();
    const cles = Object.keys(sem).sort();
    for (const k of cles.slice(0, Math.max(0, cles.length - SEMAINES_GARDEES))) delete sem[k];
  };
  if (!seulementFormat) ranger((fiche.sem ??= {}));
  // 0.39 : aussi PAR FORMAT (lignes × chiffres de la colonne) : un temps par chiffre sur 10 lignes de
  // 3 chiffres ne se compare pas à celui de 5 lignes d'un chiffre.
  if (format) ranger(((fiche.semF ??= {})[format] ??= {}));
}

/** Les semaines du format le plus pratiqué (à défaut, toutes formats mêlés, avant la 0.39). */
export function semDominante(fiche) {
  const f = Object.entries(fiche?.semF ?? {});
  if (!f.length) return fiche?.sem ?? {};
  const poids = (sem) => Object.values(sem).reduce((t, ts) => t + ts.length, 0);
  return f.sort((a, b) => poids(b[1]) - poids(a[1]))[0][1];
}

/** Plateau d'une fiche, à format identique (0.39) ; à défaut, toutes colonnes mêlées. */
export function plateauFiche(fiche, date) {
  const f = Object.entries(fiche?.semF ?? {});
  if (!f.length) return plateau(fiche?.sem, date);
  for (const [format, sem] of f) { const p = plateau(sem, date); if (p) return { ...p, format }; }
  return null;
}

export const MIN_PAR_SEMAINE = 10;

/**
 * Plateau : le temps médian ne baisse plus depuis au moins 2 semaines.
 * On compare la semaine la plus récente (cette semaine ou la précédente) à celle d'il y a
 * 2 ou 3 semaines : moins de 5 % de gain = plateau. Il faut assez d'essais des deux côtés.
 * @returns {{ avant: number, maintenant: number, semaines: number } | null}
 */
export function plateau(sem = {}, date) {
  const jour = (k) => new Date(`${k}T12:00`).getTime();
  const assez = Object.entries(sem).filter(([, ts]) => ts.length >= MIN_PAR_SEMAINE).sort(([a], [b]) => (a < b ? 1 : -1));
  if (assez.length < 2) return null;
  const [kRecent, tRecent] = assez[0];
  if ((jour(lundi(date)) - jour(kRecent)) / 86400000 > 7) return null; // trop ancien : pas pratiqué récemment
  const ref = assez.find(([k]) => {
    const ecart = (jour(kRecent) - jour(k)) / (7 * 86400000);
    return ecart >= 2 && ecart <= 3;
  });
  if (!ref) return null;
  const maintenant = mediane(tRecent);
  const avant = mediane(ref[1]);
  if (maintenant < avant * 0.95) return null;
  return { avant, maintenant, semaines: Math.round((jour(kRecent) - jour(ref[0])) / (7 * 86400000)) };
}
