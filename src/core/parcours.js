/**
 * Où en est l'élève dans le parcours, et ce qui en découle :
 *  - gestes appris (pour ne jamais proposer un ami jamais vu) ;
 *  - grade obtenu (épreuves réussies) et prochain grade conseillé (leçons prérequises) ;
 *  - drill d'échauffement, défi de la semaine et gestes à accélérer, ADAPTÉS AU NIVEAU.
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { SOUS_PALIERS, PALIERS, familleLecon, pisteDe, evaluerLecon } from './curriculum.js';
import { diagnosticTablesFait, produitsARetravailler } from './tables.js';
import { systemeChoisi, genererSujet, SYSTEMES } from './epreuves.js';
import { famille, nomMotif, TOUS_LES_MOTIFS } from './motifs.js';
import { catalogueDrills, famillesDrill, VALIDATIONS_DRILL, tigesDrill, clesDrill, tempsClassement as tempsClassementDrill } from './drills.js';
import { evaluer, plateau, plateauFiche, mediane, MIN_ESSAIS, NIVEAUX, formaterVitesse, formaterCadence, lundi as lundiDe, unites as unitesEx } from './maitrise.js';
import { gradeDan, prochainDan } from './dan.js';
import { gradeDanZenkoren, prochainNiveau, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN } from './danZenkoren.js';
import { genererColonneVariee, creerMemoire } from './generateur.js';
import { genererMultiplication, genererDivision } from './multiplication.js';
import { avecGraine, semaineISO } from './hasard.js';
import { allureGrade, vitesseEleve, formatColonnes } from './allure.js';
import { ratioExamen, gainHebdo, semainesRatios, mesuresAuFormat, GAIN_REPERE } from './mesures.js';
import './minitest.js'; // 0.42 : inscrit les seuils de vitesse des leçons (curriculum.evaluerLecon)

const DIRECT = famille('direct');
const ADDSUB = SOUS_PALIERS.filter((sp) => sp.type === 'addsub');
// Les étapes d'anzan ne bloquent pas l'accès aux épreuves.
const idsPaliers = (...ids) => PALIERS.filter((p) => ids.includes(p.id)).flatMap((p) => p.sousPaliers.filter((s) => !p.mental && s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id));

export const estValide = (d, id) => !!d.paliers[id]?.valide;

/**
 * LES compteurs du parcours, partagés par tous les écrans (Progression, Bilan, carte de
 * maîtrise) : ils ne peuvent plus diverger.
 *  - leçons : le parcours sur le vrai soroban (hors piste anzan et hors leçons à lire) ;
 *  - gestes acquis : niveau « Acquis débutant » ou mieux (justesse ET vitesse).
 */
export const LECONS_PARCOURS = SOUS_PALIERS.filter((sp) => !sp.mental && sp.type !== 'theorie');
export function compteurs(d) {
  return {
    leconsValidees: LECONS_PARCOURS.filter((sp) => estValide(d, sp.id)).length,
    leconsTotal: LECONS_PARCOURS.length,
    gestesAcquis: TOUS_LES_MOTIFS.filter((c) => d.motifs[c] && evaluer(d.motifs[c].hist ?? []).index >= 2).length,
    gestesTotal: TOUS_LES_MOTIFS.length,
  };
}
export const leconsValidees = (d) => SOUS_PALIERS.filter((sp) => estValide(d, sp.id));

/** Gestes des leçons validées, plus les gestes directs. */
export function motifsAppris(d) {
  const s = new Set(DIRECT);
  for (const sp of ADDSUB) if (estValide(d, sp.id)) sp.cibles.forEach((c) => s.add(c));
  return s;
}

/**
 * Leçons à valider avant de tenter chaque grade : exactement ce que l'épreuve demande
 * (10e et 9e : 5 lignes de 2 chiffres avec tous les amis, multiplication 2×1 ; 8e : 8 lignes,
 * × 3×1, ÷ 1 chiffre ; 7e : 10 lignes, × 2×2 ; 6e : × 3×2, ÷ 2 chiffres).
 */
const ENDURANCE = { 8: ['p5-e7', 'p5-e8'], 7: ['p5-e'] };
const ADDSUB_TOUT = idsPaliers('p1', 'p2', 'p3', 'p4', 'p5').filter((id) => !Object.values(ENDURANCE).flat().includes(id));
// 10e kyū « express » (0.38) : le mitorizan seul rapporte 100 points sur 200, il en faut 60 ; les
// colonnes (p1 à p5) suffisent donc. La multiplication 2 × 1 du sujet reste à faire, sans être
// exigée : 34 leçons avant le premier grade, c'était long.
const MUL_2X1 = ['p6-a', 'p6-0', 'p6-1a', 'p6-1b', 'p6-1c', 'p6-1d', 'p6-1'];
const K10 = [...ADDSUB_TOUT];
const K9 = [...K10, ...MUL_2X1]; // même sujet que le 10e kyū, seuil plus haut (120 points : il faut des ×)
const K8 = [...K9, ...ENDURANCE[8], 'p6-2', 'p7-0', 'p7-1', 'p7-2a', 'p7-2b', 'p7-2c', 'p7-2d', 'p7-2']; // 8 lignes, 3 × 1, ÷ 1 chiffre
const K7 = [...K8, ...ENDURANCE[7], 'p6-3a', 'p6-3b', 'p6-3c', 'p6-3']; // 10 lignes, 2 × 2
// 6e au 1er kyū : chaque grade n'exige que ce que SON épreuve demande (avant, tout le parcours
// était exigé dès le 6e kyū, décimaux et division par 3 chiffres compris).
const K6 = [...K7, 'p6-4', 'p7-ea', 'p7-e', 'p7-3', 'p7-4a', 'p7-4b', 'p7-4c', 'p7-4', 'p8-t1']; // 3 × 2, ÷ 2 chiffres
// × et ÷ : chaque grade exige les leçons de TOUS les découpages de son sujet (5e : 3 × 3 et 4 × 2,
// ÷ 5 chiffres au total ; 4e : 4 × 3 et 5 × 2, ÷ 6 chiffres au total).
const K5 = [...K6, 'p8-t2', 'p8-1', 'p8-2', 'p8-4', 'p8-6', 'p8-5a', 'p8-7'];
const K4 = [...K5, 'p8-3', 'p8-5', 'p8-8', 'p8-pl'];
// Résultats négatifs : seulement aux 1er et 2e kyū (sujets modèles) ; décimaux et arrondis dès le 3e.
const NEGATIFS = ['p8-n', 'p8-n2'];
const K3 = [...K4, 'p8-3c', ...idsPaliers('pd').filter((id) => !NEGATIFS.includes(id))]; // 0.42 : p8-3c, colonnes au format du 3e kyū
const K2 = [...K3, ...NEGATIFS, 'p9-1', 'p9-3', 'p9-5'];
const K1 = [...K2, 'p9-2', 'p9-4', 'p9-6', 'p9-pl'];
export const PREREQUIS = { 10: K10, 9: K9, 8: K8, 7: K7, 6: K6, 5: K5, 4: K4, 3: K3, 2: K2, 1: K1 };
export const prerequis = (g) => PREREQUIS[g.id] ?? SOUS_PALIERS.filter((s) => !s.mental && !s.optionnel && s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id);

/**
 * Grade : le meilleur kyū réussi en épreuve, et le suivant à préparer.
 * @returns {{ obtenu: object|null, prochain: object|null, manquantes: object[], pret: boolean }}
 */
/** Toutes les leçons qu'un grade officiel demande sont-elles validées ? */
export const gradeAccessible = (d, g) => prerequis(g).every((id) => estValide(d, id));

export function grade(d) {
  // 0.41 : un kyū (10e au 1er) n'est obtenu qu'avec ses DEUX épreuves réussies, Nisshō ET Zenkoren
  // (une épreuve plus haute réussie vaut celles d'en dessous, système par système). Le prochain kyū
  // se prépare dans le système choisi d'abord ; celui-ci réussi, dans l'autre.
  const sys = systemeChoisi(d);
  const autre = sys.id === 'nissho' ? SYSTEMES.zenkoren : SYSTEMES.nissho;
  const ids = sys.grades.map((g) => g.id);
  const reussi = (s, id) => s.grades.slice(s.grades.findIndex((x) => x.id === id)).some((x) => !!d.records[s.record(x.id)]?.reussi);
  let i = -1;
  while (i + 1 < ids.length && reussi(sys, ids[i + 1]) && reussi(autre, ids[i + 1])) i += 1;
  const obtenu = i >= 0 ? sys.grades[i] : null;
  const idProchain = ids[i + 1] ?? null;
  const sysProchain = idProchain && reussi(sys, idProchain) ? autre : sys;
  const prochain = idProchain ? sysProchain.grades.find((x) => x.id === idProchain) : null;
  const epreuves = idProchain ? { [sys.id]: reussi(sys, idProchain), [autre.id]: reussi(autre, idProchain) } : null;
  const manquantes = prochain ? prerequis(prochain).filter((id) => !estValide(d, id)).map((id) => SOUS_PALIERS.find((s) => s.id === id)) : [];
  return { obtenu, prochain, manquantes, pret: !!prochain && manquantes.length === 0, epreuves };
}

/**
 * Ancrage : les leçons de colonnes validées le plus récemment (3 au plus), dont les gestes sont
 * mélangés dans une même planche. Répéter le geste du jour l'installe ; le retrouver les jours
 * suivants, mêlé aux précédents, le fixe.
 * @returns {{ lecons: object[], cibles: string[], chiffres: number } | null}
 */
export function ancrageDuJour(d) {
  const lecons = ADDSUB.filter((sp) => estValide(d, sp.id) && !sp.cumul)
    .sort((a, b) => (d.paliers[a.id].valide < d.paliers[b.id].valide ? -1 : d.paliers[a.id].valide > d.paliers[b.id].valide ? 1 : a.ordre - b.ordre))
    .slice(-3);
  if (!lecons.length) return null;
  const cibles = [...new Set(lecons.flatMap((sp) => sp.cibles))];
  return { lecons, cibles, chiffres: Math.min(3, Math.max(1, ...lecons.map((sp) => sp.chiffres ?? 1))) };
}

/** Nombre de chiffres le plus grand vu dans les leçons d'addition validées (au moins 1). */
export const chiffresAppris = (d) => Math.max(1, ...ADDSUB.filter((sp) => estValide(d, sp.id)).map((sp) => sp.chiffres));

/** Colonnes les plus longues des leçons d'addition validées (5 lignes au moins). */
export const lignesAcquises = (d) => Math.max(5, ...ADDSUB.filter((sp) => estValide(d, sp.id)).map((sp) => sp.lignesMax ?? sp.lignes ?? 5));

/**
 * Format des colonnes d'examen d'un grade : longueur des nombres et nombre de lignes du
 * mitorizan. `decalage` : 0 pour le grade visé (le prochain à passer), 1 pour le grade dont le
 * format vient ensuite (le premier qui diffère : après le 10e kyū, le 8e, puisque le 9e a le
 * même sujet).
 * @returns {{ grade: object, chiffres: number, lignes: number }}
 */
export function formatExamen(d, decalage = 0) {
  const sys = systemeChoisi(d);
  const g0 = grade(d).prochain ?? sys.grades.at(-1);
  const f = (g) => ({ grade: g, chiffres: g.mitori.chiffres ?? g.mitori.max, lignes: g.mitori.lignes });
  let x = f(g0);
  for (let i = sys.grades.indexOf(g0) + 1; decalage > 0 && i < sys.grades.length; i++) {
    const y = f(sys.grades[i]);
    if (y.chiffres !== x.chiffres || y.lignes !== x.lignes) { x = y; decalage -= 1; }
  }
  return x;
}

/** Niveau global de 0 à 1 : part des leçons d'addition/soustraction validées. */
export const niveauAddsub = (d) => ADDSUB.filter((sp) => estValide(d, sp.id)).length / ADDSUB.length;

/** Familles d'amis apprises (leçons validées) : 'petit', 'grand', 'mixte', 'cascade'. */
export function famillesApprises(d) {
  const f = new Set();
  for (const c of motifsAppris(d)) f.add(c.startsWith('cascade') ? 'cascade' : c.split(':')[1]);
  return f;
}

/** Ce qu'un drill demande et que l'élève n'a pas encore appris (ex. ['grand', 'cascade']). */
export const manqueDrill = (d, drill) => famillesDrill(drill).filter((f) => !famillesApprises(d).has(f));
export const drillValide = (d, id) => (d.drills?.[id]?.validations ?? 0) >= VALIDATIONS_DRILL;

/**
 * Leçon qui enseigne un geste direct : +1 à +4 → « Ajouter 1 à 4 », −1 à −4 → « Retirer 1 à 4 »,
 * ±5 à ±9 → « Le 5 et la pincée ». Plusieurs tiges demandent « Gestes directs à 2 et 3 chiffres ».
 */
const leconDirecte = (cle) => (Number(cle.slice(1).split(':')[0]) >= 5 ? 'p1-3' : cle.startsWith('+') ? 'p1-1' : 'p1-2');
/**
 * Ce qu'un drill demande et qui n'est pas encore appris : familles d'amis (['grand', …]) et
 * leçons de gestes directs (['p1-3', 'p1-4']) ; vide si le drill est faisable.
 */
export function prerequisDrill(d, drill) {
  const lecons = new Set(clesDrill(drill).filter((c) => c.endsWith(':direct')).map(leconDirecte));
  if (tigesDrill(drill) > 1) lecons.add('p1-4');
  return { familles: manqueDrill(d, drill), lecons: [...lecons].filter((id) => !estValide(d, id)) };
}
const faisable = (d, drill) => { const p = prerequisDrill(d, drill); return !p.familles.length && !p.lecons.length; };

/**
 * Un drill est ouvert si ses gestes sont appris (gestes directs compris, et nombre de tiges) ET
 * si le drill précédent du parcours est validé (les drills « premiers pas » n'entrent pas dans
 * cette chaîne). Un drill déjà validé reste ouvert. Le mode découverte ouvre tout.
 */
export function drillOuvert(d, drill) {
  if (d.reglages?.decouverte || drillValide(d, drill.id)) return true;
  if (!faisable(d, drill)) return false;
  if (drill.entree) return true;
  const chaine = catalogueDrills().filter((x) => !x.entree);
  const i = chaine.findIndex((x) => x.id === drill.id);
  return i <= 0 || drillValide(d, chaine[i - 1].id);
}

/**
 * Drill d'échauffement : le prochain drill à valider parmi ceux qui sont faisables avec les
 * gestes appris et le nombre de tiges vu ; une fois tout validé, le plus long drill validé.
 * null si aucun drill n'est encore faisable (avant « Le 5 et la pincée » et « Retirer 1 à 4 »).
 */
export function drillEchauffement(d) {
  const d0 = { ...d, reglages: { ...d.reglages, decouverte: false } };
  // Les « premiers pas » ne servent plus d'échauffement une fois un drill du parcours validé.
  const avance = catalogueDrills().some((x) => !x.entree && drillValide(d, x.id));
  const tous = catalogueDrills().filter((x) => faisable(d0, x) && drillOuvert(d0, x) && !(avance && x.entree && !drillValide(d, x.id)));
  // 0.40 : un échauffement de 3 minutes au plus (votre record, à défaut le temps bronze avec marge) ;
  // avant, un drill long pouvait prendre 6 minutes, 20 % d'une séance de 30.
  const ouverts = tous.filter((x) => dureeEchauffement(d, x) <= ECHAUFFEMENT_MAX_MS);
  const aValider = ouverts.find((x) => !drillValide(d, x.id));
  if (aValider) return aValider;
  // 0.40.18 : plus rien à valider qui tienne en 3 minutes : roulement entre les 4 derniers drills validés,
  // un par jour de drill (avant : toujours le dernier, tous les jours).
  if (ouverts.length) {
    const recents = ouverts.slice(-4);
    const jours = new Set((d.sessions ?? []).filter((s) => s.module === 'drills').map((s) => s.date)).size;
    return recents[recents.length - 1 - (jours % recents.length)]; // le plus avancé d'abord
  }
  return [...tous].sort((a, b) => dureeEchauffement(d, a) - dureeEchauffement(d, b))[0] ?? null;
}
export const ECHAUFFEMENT_MAX_MS = 3 * 60000;
/** Durée attendue d'un drill d'échauffement : le record de l'élève, sinon le temps bronze + 30 %. */
export const dureeEchauffement = (d, x) => d.records?.[`drill-${x.id}`]?.dureeMs ?? tempsClassementDrill(x, 'bronze') * 1.3;

/** Gestes appris (au moins 8 essais réussis) les plus lents : à accélérer. */
export function gestesLents(d, nombre = 3) {
  const appris = motifsAppris(d);
  return Object.entries(d.motifs)
    .filter(([cle]) => appris.has(cle) && !cle.endsWith(':direct'))
    .map(([cle, f]) => ({ cle, ev: evaluer(f.hist ?? []) }))
    .filter(({ ev }) => ev.temps !== null && ev.essais >= 8)
    .sort((a, b) => b.ev.temps - a.ev.temps)
    .slice(0, nombre);
}

/**
 * Défi de la semaine : la même feuille toute la semaine (graine = semaine + niveau),
 * adaptée au niveau : colonnes sur les gestes appris (1 à 3 chiffres selon l'avancement),
 * plus multiplications et divisions si ces leçons sont validées.
 */
/** Format des colonnes du défi de la semaine (et de son étoile « sans filet »). */
export function formatSemaine(d) {
  const appris = motifsAppris(d);
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const n = niveauAddsub(d);
  // Une fois les additions-soustractions terminées, la taille suit les leçons validées (jusqu'à 6 chiffres).
  return { appris, amis, chiffres: n < 0.4 ? 1 : n < 0.8 ? 2 : n < 1 ? 3 : Math.min(6, Math.max(3, chiffresAppris(d))) };
}

export function defiSemaine(d, date) {
  const { cle: semaine } = semaineISO(date);
  const { appris, amis, chiffres } = formatSemaine(d);
  const mul = estValide(d, 'p6-1');
  const div = estValide(d, 'p7-1');
  // × et ÷ suivent les chapitres validés : jusqu'à 3 × 2 et la division par 2 chiffres.
  const fMul = estValide(d, 'p6-4') ? [3, 2] : estValide(d, 'p6-3') ? [2, 2] : [2, 1];
  const fDiv = estValide(d, 'p7-4') ? [2, 2] : estValide(d, 'p7-2') ? [1, 3] : [1, 2];
  // 0.38 : à partir du 7e kyū (8e kyū réussi), la feuille de la semaine suit le FORMAT de l'examen
  // visé : un cinquième de son sujet, le même toute la semaine, à battre (avant : 3 × 2 et ÷ 2
  // chiffres au plus, quel que soit le niveau).
  const gr = grade(d);
  const sys = systemeChoisi(d);
  const g8 = sys.grades.find((x) => x.id === '8');
  if (gr.obtenu && g8 && sys.grades.indexOf(gr.obtenu) >= sys.grades.indexOf(g8)) {
    const gv = gr.prochain ?? sys.grades.at(-1);
    const graineK = [...`${semaine}-kyu-${sys.id}-${gv.id}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    // 0.39 : taille fixée en TEMPS (environ 7 minutes à l'allure de l'examen : 5 colonnes environ et
    // une part de × et ÷), au lieu d'un cinquième du sujet.
    const a = allureGrade(gv);
    const tps = (ex) => unitesEx(ex) * (ex.type === 'addsub' ? a.parChiffre : a.parProduit) + 3;
    const sectionsK = avecGraine(graineK, () => {
      const secs = genererSujet(gv).sections.filter((x) => ['mitoriA', 'mitori', 'mul', 'div'].includes(x.cle));
      const total = secs.reduce((t, x) => t + x.problemes.reduce((u, ex) => u + tps(ex), 0), 0);
      const part = Math.min(1, (MINUTES_FEUILLE_SEMAINE * 60) / total);
      return secs.map((x) => ({ titre: x.titre, problemes: x.problemes.slice(0, Math.max(1, Math.round(x.problemes.length * part))) }));
    });
    return { cle: `defi-semaine-${semaine}-kyu-${sys.id}-${gv.id}`, semaine, sections: sectionsK, grade: gv, description: `au format du ${gv.nom} : environ ${MINUTES_FEUILLE_SEMAINE} minutes à l'allure de l'examen` };
  }
  const palier = `${chiffres}${mul ? `m${fMul.join('')}` : ''}${div ? `d${fDiv.join('')}` : ''}${amis.length}`;
  const graine = [...`${semaine}-${palier}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sections = avecGraine(graine, () => {
    const memoire = creerMemoire(10);
    const s = [{ titre: 'Colonnes', problemes: Array.from({ length: mul || div ? 6 : 10 }, () => genererColonneVariee({ chiffres, lignes: 5, autorises: appris, cibles: amis.length ? amis : DIRECT }, memoire)) }];
    if (mul) s.push({ titre: 'Multiplications', problemes: Array.from({ length: 2 }, () => genererMultiplication(...fMul)) });
    if (div) s.push({ titre: 'Divisions', problemes: Array.from({ length: 2 }, () => genererDivision(...fDiv)) });
    return s;
  });
  return { cle: `defi-semaine-${semaine}-${palier}`, semaine, sections, description: `${chiffres} chiffre${chiffres > 1 ? 's' : ''}, gestes appris${mul ? `, multiplications ${fMul[0]} × ${fMul[1]}` : ''}${div ? `, divisions par ${fDiv[0]} chiffre${fDiv[0] > 1 ? 's' : ''}` : ''}` };
}

/**
 * Les marches de l'anzan du jour : on allonge la chaîne avant de passer à 2 chiffres, et l'image
 * d'aide reste au début. La vitesse, elle, monte à CHAQUE bonne réponse dans le flash (vitesse
 * automatique, gardée d'une série à l'autre).
 */
export const MARCHES_ANZAN = [
  { mode: 'image', chiffres: 1, termes: 3 }, { mode: 'image', chiffres: 1, termes: 4 },
  { mode: 'flash', chiffres: 1, termes: 4 }, { mode: 'flash', chiffres: 1, termes: 5 },
  { mode: 'flash', chiffres: 1, termes: 6 }, { mode: 'flash', chiffres: 1, termes: 7 },
  { mode: 'flash', chiffres: 2, termes: 3 }, { mode: 'flash', chiffres: 2, termes: 4 },
  { mode: 'flash', chiffres: 2, termes: 5 }, { mode: 'flash', chiffres: 2, termes: 6 },
  { mode: 'flash', chiffres: 3, termes: 3 }, { mode: 'flash', chiffres: 3, termes: 4 },
  // 0.38 : jusqu'au format des grades de flash (3 chiffres, 15 nombres).
  { mode: 'flash', chiffres: 3, termes: 5 }, { mode: 'flash', chiffres: 3, termes: 6 }, { mode: 'flash', chiffres: 3, termes: 8 },
  { mode: 'flash', chiffres: 3, termes: 10 }, { mode: 'flash', chiffres: 3, termes: 12 }, { mode: 'flash', chiffres: 3, termes: 15 },
];
/** Vitesse « bonne » pour monter d'une marche : au plus tant de secondes par nombre. */
export const DUREE_MONTEE = 1.5;

/**
 * Anzan du jour, adapté au niveau, uniquement sur les gestes déjà vus au soroban :
 *  - la marche de départ suit les leçons d'anzan validées ;
 *  - on monte d'une marche après 2 séries de suite à 90 % ou plus ET une vitesse atteinte d'au
 *    plus DUREE_MONTEE s par nombre (tant que les réponses ne se dégradent pas, on accélère) ;
 *  - on redescend après 2 séries de suite sous 70 %.
 * 2 chiffres : après « Anzan : 2 chiffres, sans retenue » ; 3 chiffres : après « Anzan : 3 chiffres ».
 * @param {number} [minutes]  durée voulue (le nombre de calculs en dépend)
 */
export function anzanAdapte(d, minutes = 2) {
  const k = Math.min(6, SOUS_PALIERS.filter((sp) => sp.type === 'anzan' && estValide(d, sp.id)).length);
  const depart = [0, 1, 2, 3, 3, 4, 6][k];
  const max = estValide(d, 'pa-8') ? MARCHES_ANZAN.length - 1 : estValide(d, 'pa-6') || estValide(d, 'p5-a') ? 9 : 5;
  let i = Math.min(depart, max);
  let suite = [];
  let raison = null;
  const series = d.sessions.filter((s) => s.module === 'anzan' && s.reglages?.palierAnzan != null && (s.total ?? 0) >= 3);
  for (const s of series) {
    if (s.reglages.palierAnzan !== i) continue;
    suite.push(s);
    const deux = suite.slice(-2);
    if (deux.length === 2 && deux.every((x) => x.justes / x.total >= 0.9) && (s.reglages.duree ?? 9) <= DUREE_MONTEE && i < max) { i += 1; suite = []; raison = 'une marche de plus : juste et rapide'; }
    else if (deux.length === 2 && deux.every((x) => x.justes / x.total < 0.7) && i > 0) { i -= 1; suite = []; raison = 'une marche plus bas, le temps de retrouver des réponses sûres'; }
  }
  if (i < depart && !raison) i = Math.min(depart, max);
  const m = MARCHES_ANZAN[i];
  const vitesses = d.reglages?.flashDurees ?? {};
  const duree = vitesses[`${m.mode}-${m.chiffres}-${m.termes}`] ?? (m.mode === 'image' ? 3 : 2.5);
  if (!raison) {
    const derniere = suite.at(-1);
    raison = i >= max ? 'la plus haute marche ouverte pour l\'instant'
      : !derniere ? 'votre marche du moment'
        : duree > DUREE_MONTEE ? `encore un peu de vitesse (${String(Math.round(duree * 10) / 10).replace('.', ',')} s, il faut ${String(DUREE_MONTEE).replace('.', ',')} s) avant un nombre de plus`
          : 'deux séries justes de suite et on ajoute un nombre';
  }
  const questions = Math.max(5, Math.min(20, Math.round((minutes * 60) / (m.termes * duree + 10))));
  return { ...m, duree, questions, palierAnzan: i, raison };
}

/** L'élève est-il arrivé au cours de multiplication (ou au-delà) ? */
/**
 * 0.41 : porte de la piste × ÷.
 *  - La leçon des tables (p6-a) s'ouvre dès la leçon des paires qui font 10 (p3-0, début des grands
 *    amis) : les tables se travaillent pendant les grands amis, AVANT la multiplication sur le soroban.
 *  - La multiplication sur le soroban (p6-0 et suite) attend : tous les gestes d'ADDITION qu'elle
 *    emploie (grands amis, combinaisons, cascades) validés et au moins en argent, la leçon des tables
 *    validée, le diagnostic des 81 produits fait, et 2 produits au plus encore faux ou lents.
 *  - La division (p7-0 et suite) attend en plus les gestes de SOUSTRACTION (grands amis, combinaisons,
 *    cascades) en argent.
 * @returns {{ ok: boolean, raisons: string[] }}
 */
export const GESTES_MUL = ['p3-1', 'p3-2', 'p3-3', 'p3-4', 'p5-1', 'p5-4'];
export const GESTES_DIV = ['p4-1', 'p4-2', 'p4-3', 'p4-4', 'p4-5', 'p5-2', 'p5-4'];
const niveauLeconCourt = (d, sp) => {
  const ev = evaluerLecon(d.paliers[sp.id]?.hist ?? [], sp);
  const g = (sp.cibles ?? []).filter((c) => !c.endsWith(':direct'));
  const ge = g.length ? Math.min(...g.map((c) => evaluer(d.motifs?.[c]?.hist ?? [], 'addsub').index)) : 0;
  return Math.max(ev.essais >= 8 ? ev.index : 2, ge);
};
/** 0.42 : jours de pratique au plus derrière la porte × ÷ quand seul l'argent d'une leçon de gestes manque. */
export const JOURS_PORTE_MULDIV = 7;
const joursPratiqueDepuis = (d, date) => (date ? new Set((d.sessions ?? []).map((s) => s.date).filter((x) => x > date)).size : 0);

/**
 * 0.42 : quelle piste du soroban aujourd'hui, entre la prochaine leçon de colonnes `c` et celle de
 * × ÷ `m` (ouvertes) ? Une leçon commencée se termine d'abord. Sinon on regarde les leçons qui
 * manquent au prochain grade : s'il ne manque que des × ÷, on fait × ÷ ; que des colonnes, les
 * colonnes ; on n'alterne (un jour sur deux) que quand les deux pistes ont des manques. La leçon des
 * tables, une préparation, alterne toujours. Avant : un jour sur deux en toutes circonstances, et les
 * colonnes partaient devant pendant que la division traînait (un grade exige les trois matières).
 */
export function choisirPiste(d, c, m, jourNum) {
  if (!c || !m) return c ?? m;
  const enCours = [c, m].find((x) => (d.paliers?.[x.id]?.reps ?? 0) > 0);
  if (enCours) return enCours;
  const alterne = jourNum % 2 ? m : c;
  if (m.id === 'p6-a') return alterne;
  const manquantes = grade(d).manquantes.filter(Boolean);
  const manqueC = manquantes.some((x) => pisteDe(x) === 'colonnes');
  const manqueM = manquantes.some((x) => pisteDe(x) === 'muldiv');
  if (manqueM && !manqueC) return m;
  if (manqueC && !manqueM) return c;
  return alterne;
}

export function porteMulDiv(d, sp) {
  if (!sp || pisteDe(sp) !== 'muldiv') return { ok: true, raisons: [], conditions: [] };
  // 0.41.1 : chaque condition en clair, cochée ou non (liste affichée une fois, au-dessus de la
  // première leçon fermée), et un résumé court pour la ligne de la leçon.
  const conditions = [];
  const cond = (ok, texte, court) => conditions.push({ ok, texte, court });
  if (sp.id === 'p6-a') {
    cond(estValide(d, 'p3-0'), 'la leçon « Les paires qui font 10 » validée', 'les paires qui font 10');
  } else {
    const lecons = (ids, quoi) => {
      for (const x of ids.map((id) => SOUS_PALIERS.find((y) => y.id === id)).filter(Boolean)) {
        // 0.42 : la leçon doit être validée (vue, mini-test réussi) ; l'argent, lui, n'est attendu
        // que 7 jours de pratique au plus après sa validation, comme les autres portes : ensuite elle
        // passe en rattrapage (voir prof.leconsSousArgent) et la piste × ÷ s'ouvre quand même.
        const valide = estValide(d, x.id);
        const ok = valide && (niveauLeconCourt(d, x) >= 2 || joursPratiqueDepuis(d, d.paliers[x.id].valide) >= JOURS_PORTE_MULDIV);
        cond(ok, valide ? `« ${x.titre} » en argent (ou ${JOURS_PORTE_MULDIV} jours de pratique après sa validation)` : `« ${x.titre} » validée`, quoi);
      }
    };
    lecons(GESTES_MUL, 'gestes d\'addition');
    cond(estValide(d, 'p6-a'), 'la leçon des tables « 1 × 1 » validée', 'leçon des tables');
    const diag = diagnosticTablesFait(d.tables ?? {});
    cond(diag, 'le diagnostic des 81 produits fait (Drills, Tables)', 'diagnostic des tables');
    if (diag) {
      const n = produitsARetravailler(d.tables ?? {}).length;
      cond(n <= 2, `les tables : 2 produits faux ou lents au plus (encore ${n})`, `${n} produits des tables à revoir`);
    }
    if (sp.type === 'div' || (sp.ordre >= (SOUS_PALIERS.find((x) => x.id === 'p7-0')?.ordre ?? Infinity) && sp.id !== 'p5-6')) lecons(GESTES_DIV, 'gestes de soustraction');
  }
  const manque = conditions.filter((c) => !c.ok);
  // Résumé : les gestes regroupés (« 3 gestes d'addition en argent »).
  const court = [];
  for (const c of manque) {
    const k = manque.filter((x) => x.court === c.court).length;
    const t = /^gestes/.test(c.court) ? `${k} leçon${k > 1 ? 's' : ''} de ${c.court}` : c.court;
    if (!court.includes(t)) court.push(t);
  }
  return { ok: !manque.length, raisons: manque.map((c) => c.texte), court, conditions };
}

export function coursMultiplicationAtteint(d, prochain) {
  // 0.41.1 : la leçon des tables s'ouvre dès les grands amis ; le « cours de multiplication » commence
  // au placement du premier produit (p6-0).
  const debut = SOUS_PALIERS.find((s) => s.id === 'p6-0').ordre;
  return (prochain ? prochain.ordre >= debut : true) || !!d.paliers['p6-0'];
}

/**
 * Réflexe de placement (multiplication / division) : proposé seulement une fois arrivé au cours de
 * multiplication, puis maintenu pendant ce cours, celui de division, et 14 jours après la validation
 * du dernier placement, pour l'ancrer profondément.
 * @returns {{ id: string, titre: string } | null}  la leçon de placement à travailler
 */
export function placementDuJour(d, aujourdhuiDate, prochain) {
  if (!coursMultiplicationAtteint(d, prochain)) return null;
  const div = SOUS_PALIERS.find((s) => s.id === 'p7-0');
  const mul = SOUS_PALIERS.find((s) => s.id === 'p6-0');
  // Division dès qu'on a atteint ce cours, sinon multiplication.
  const lecon = prochain && prochain.ordre >= div.ordre ? div : mul;
  // Maîtrisé en Expert : le réflexe est installé, on n'y revient plus (une erreur de placement
  // qui se répète le ramène par « Erreur qui se répète »).
  if (evaluer(d.paliers[lecon.id]?.hist ?? [], familleLecon(lecon)).index >= 4) return null;
  // Le réflexe s'éteint : parcours terminé, ou placement de la division validé depuis plus de
  // 14 jours une fois l'étape de la division dépassée.
  if (!prochain) return null;
  const valideLe = d.paliers['p7-0']?.valide;
  const finDivision = Math.max(...SOUS_PALIERS.filter((s) => s.palier?.id === 'p7').map((s) => s.ordre));
  if (valideLe && prochain.ordre > finDivision) {
    const [a, m, j] = valideLe.split('-').map(Number);
    const ecart = (new Date(`${aujourdhuiDate}T12:00`) - new Date(a, m - 1, j, 12)) / 86400000;
    if (ecart > 14) return null;
  }
  return lecon;
}

// ------------------------------------------------------------------ plateaux et priorité du jour

/**
 * Plateaux : gestes et leçons dont le temps médian ne baisse plus depuis 2 semaines ou plus
 * (voir maitrise.plateau). Les gestes déjà au niveau expert ne sont pas concernés.
 * @returns {Array<{ type: 'geste'|'lecon', cle: string, nom: string, avant: number, maintenant: number, semaines: number }>}
 */
/** Au-delà de ce nombre de chiffres de travail, les plateaux des gestes de base ne sont plus suivis. */
export const CHIFFRES_GESTES_BASE = 4;
/**
 * Chiffres de travail : le plus grand des formats des leçons validées et du grade visé (0.41 ; un
 * élève positionné haut n'a pas forcément validé les leçons à 5 chiffres).
 */
export function chiffresTravail(d) {
  let vise = 0;
  try { vise = formatExamen(d).chiffres ?? 0; } catch { vise = 0; }
  return Math.max(chiffresAppris(d), vise);
}

export function plateaux(d, date) {
  const liste = [];
  // 0.39 : au-delà du platine, la détection reste active tant que le geste n'a pas 10 % de marge
  // sur l'allure du grade (ou du dan) visé : le platine n'est pas l'allure du 1er kyū ni d'un dan.
  const vise = allureVisee(d);
  const sansMarge = (ev, famille) => ev.niveau.id !== 'expert' || (vise && ev.temps != null && ev.temps > (famille === 'muldiv' ? vise.parProduit : vise.parChiffre) * (1 - MARGE_PLATEAU));
  // 0.40-0.41 : au-delà de 4 chiffres de travail, les gestes de base (petits amis) ne sont plus
  // suivis : un élève très avancé recevait encore des sprints sur +4 petit ami.
  const avance = chiffresTravail(d) > CHIFFRES_GESTES_BASE;
  for (const [cle, f] of Object.entries(d.motifs)) {
    if (cle.endsWith(':direct') || (avance && cle.endsWith(':petit')) || !sansMarge(evaluer(f.hist ?? []), 'addsub')) continue;
    const p = plateauFiche(f, date);
    if (p) liste.push({ type: 'geste', cle, nom: nomMotif(cle), ...p });
  }
  for (const [id, e] of Object.entries(d.paliers)) {
    const sp = SOUS_PALIERS.find((s) => s.id === id);
    if (!sp || sp.type !== 'addsub' || !sansMarge(evaluer(e.hist ?? []), 'addsub')) continue;
    const p = plateauFiche(e, date);
    if (p) liste.push({ type: 'lecon', cle: id, nom: `la leçon « ${sp.titre} »`, cibles: sp.cibles, ...p });
  }
  return liste.sort((a, b) => b.maintenant / b.avant - a.maintenant / a.avant);
}

/**
 * Détecteur de recul (0.39) : un geste qui RALENTIT de 15 % ou plus. Comparaison à format
 * identique seulement (lignes × chiffres), sur les 6 dernières semaines ; les deux semaines les plus
 * récentes, consécutives et d'au moins 10 essais chacune, sont toutes deux au moins 15 % plus lentes
 * que la meilleure semaine d'avant. Déclenche un bloc « réveil » ciblé.
 * @returns {Array<{ cle, nom, format, avant, maintenant }>}  le plus fort recul d'abord
 */
export const RECUL = 0.15;
export const SEMAINES_RECUL = 6;
export function reculs(d, date) {
  const jour = (k) => new Date(`${k}T12:00`).getTime();
  const fin = jour(lundiDe(date));
  const liste = [];
  for (const [cle, f] of Object.entries(d.motifs ?? {})) {
    for (const [format, sem] of Object.entries(f.semF ?? {})) {
      const semaines = Object.entries(sem).filter(([k, ts]) => ts.length >= MIN_ESSAIS_SEMAINE && (fin - jour(k)) / (7 * 86400000) < SEMAINES_RECUL)
        .sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, ts]) => ({ k, m: mediane(ts) }));
      if (semaines.length < 3) continue;
      const [s1, s2] = semaines.slice(-2);
      const consecutives = Math.round((jour(s2.k) - jour(s1.k)) / (7 * 86400000)) === 1 && (fin - jour(s2.k)) / (7 * 86400000) <= 1;
      const avant = Math.min(...semaines.slice(0, -2).map((x) => x.m));
      if (consecutives && s1.m >= avant * (1 + RECUL) && s2.m >= avant * (1 + RECUL)) liste.push({ cle, nom: nomMotif(cle), format, avant, maintenant: s2.m });
    }
  }
  return liste.sort((a, b) => b.maintenant / b.avant - a.maintenant / a.avant);
}
const MIN_ESSAIS_SEMAINE = 10;

/** Sprint de surcharge : part du meilleur rythme à laquelle on force la cadence. */
export const SURCHARGE = 1.15;
/** Marge sur l'allure visée en deçà de laquelle la détection des plateaux reste active (0.39). */
export const MARGE_PLATEAU = 0.1;

/** Allure du prochain grade, ou du prochain dan d'entraînement après le 1er kyū ; null au-delà. */
export function allureVisee(d) {
  const gr = grade(d);
  if (gr.prochain) return allureGrade(gr.prochain);
  if (!gr.obtenu) return null;
  const zen = systemeChoisi(d).id === 'zenkoren';
  const n = zen ? prochainNiveau(d, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN) : prochainDan(d);
  return n ? allureGrade(zen ? gradeDanZenkoren(n) : gradeDan(n)) : null;
}

/**
 * Plateau en × ou ÷ (0.39) : sur les feuilles mesurées (hakari, marches), la médiane de la semaine
 * la plus récente contre celle d'il y a 2 à 3 semaines ; moins de 5 % de gain = plateau. Au moins
 * 2 feuilles par semaine (une feuille vaut des dizaines de produits). Pas de plateau quand l'allure
 * visée est tenue avec 10 % de marge.
 */
export function plateauOperation(d, type, date) {
  const sem = {};
  for (const m of (d.mesures ?? []).filter((x) => x.partie === type && x.source === 'entrainement')) (sem[lundiDe(m.date)] ??= []).push(m.t);
  const p = plateau(Object.fromEntries(Object.entries(sem).map(([k, ts]) => [k, ts.length >= 2 ? [...ts, ...Array(10).fill(mediane(ts))] : ts])), date);
  if (!p) return null;
  const vise = allureVisee(d);
  if (vise && p.maintenant <= vise.parProduit * (1 - MARGE_PLATEAU)) return null;
  const meilleur = Math.min(...(d.mesures ?? []).filter((x) => x.partie === type && x.source === 'entrainement').map((x) => x.t));
  return { ...p, type, meilleur, cible: meilleur / SURCHARGE };
}

const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const jourDe = (date) => Math.floor(new Date(`${date}T12:00`).getTime() / 86400000);

/**
 * Priorité du jour : UNE consigne franche, chiffrée, avec le bon outil.
 *  1. un plateau → un remède, qui change d'un jour à l'autre : surentraînement (moins de chiffres,
 *     plus vite, au rythme du lièvre), marathon sur le geste, ou drill rythmé au métronome ;
 *  2. sinon un geste en difficulté (erreurs avérées) → marathon de 40 lignes pour l'ancrer ;
 *  3. sinon le geste appris le plus lent → marathon de 40 lignes pour l'accélérer.
 * @returns {{ titre, texte, raison, aller: [string, object] } | null}
 */
export function prioriteDuJour(d, date, difficiles = []) {
  const p = plateaux(d, date)[0];
  if (p) {
    const cibles = p.type === 'geste' ? [p.cle] : p.cibles;
    const constat = `${p.nom[0].toUpperCase()}${p.nom.slice(1)} stagne : ${formaterCadence(p.maintenant)}, contre ${formaterCadence(p.avant)} il y a ${p.semaines} semaines.`;
    const remedes = [
      { titre: 'Casser le plateau : surentraînement', texte: 'Moins de chiffres, plus vite : des colonnes à 1 chiffre au rythme du lièvre, qui accélère tant que vous tenez. Le geste doit partir sans réfléchir.', aller: ['rythme', { jeu: 'lievre', cibles, chiffres: 1, accelere: true, auto: true }] },
      { titre: 'Casser le plateau : marathon', texte: '40 lignes d\'affilée sur ce geste, sans remettre à zéro. Le volume ancre le mouvement.', aller: ['rythme', { jeu: 'marathon', cibles, lignes: 40, auto: true }] },
      { titre: 'Casser le plateau : drill rythmé', texte: 'Un drill au métronome : un geste par temps, sans accélérer ni ralentir. La régularité débloque souvent la vitesse.', aller: ['drills', { drill: drillEchauffement(d)?.id, priorite: true }] },
    ];
    // Sprint de surcharge : proposé UNIQUEMENT ici, sur un plateau (la cadence ne monte plus) et
    // pour un geste précis. 20 secondes à 115 % du meilleur rythme tenu sur ce geste.
    if (p.type === 'geste') {
      const record = Math.min(p.avant, p.maintenant);
      const cadence = Math.max(0.5, Math.round((record / SURCHARGE) * 100) / 100);
      remedes.push({ titre: 'Casser le plateau : sprint de surcharge', texte: `20 secondes à ${nf(cadence)} s par ligne, soit ${Math.round(SURCHARGE * 100)} % de votre meilleur rythme sur ce geste. On ne cherche pas la justesse : on habitue la main à une vitesse qu'elle ne connaît pas.`, aller: ['rythme', { jeu: 'lievre', cibles, surcharge: cadence, auto: true }] });
    }
    const r = remedes[jourDe(date) % remedes.length];
    return { ...r, raison: constat };
  }
  const faible = difficiles.find((m) => !m.cle.endsWith(':direct'));
  if (faible) {
    return {
      titre: 'Ancrer un geste', raison: `${nomMotif(faible.cle)} : ${faible.erreurs} erreur${faible.erreurs > 1 ? 's' : ''} récente${faible.erreurs > 1 ? 's' : ''}.`,
      texte: `Faites 40 lignes de marathon sur ${nomMotif(faible.cle)} aujourd'hui, avec le rappel doigté si besoin.`,
      aller: ['rythme', { jeu: 'marathon', cibles: [faible.cle], lignes: 40, auto: true }],
    };
  }
  const lent = gestesLents(d, 1)[0];
  if (lent && lent.ev.niveau.id !== 'expert') {
    return {
      titre: 'Accélérer un geste', raison: `${nomMotif(lent.cle)} est votre geste le plus lent : ${formaterVitesse(lent.ev.temps)}.`,
      texte: `Faites 40 lignes de marathon sur ${nomMotif(lent.cle)} aujourd'hui.`,
      aller: ['rythme', { jeu: 'marathon', cibles: [lent.cle], lignes: 40, auto: true }],
    };
  }
  return null;
}

// ------------------------------------------------------------------ vitesses incohérentes

/** Ordre attendu des vitesses : un geste direct va plus vite qu'un petit ami, etc. */
export const ORDRE_FAMILLES = ['direct', 'petit', 'grand', 'mixte'];
export const NOMS_FAMILLES = { direct: 'gestes directs', petit: 'petits amis', grand: 'grands amis', mixte: 'combinaisons' };
/** Colonnes mesurées « isolées » à partir desquelles une vitesse est jugée fiable. */
export const MESURES_FIABLES = 15;
const familleDe = (c) => (c.startsWith('cascade') ? 'cascade' : c.split(':')[1]);

/**
 * Vitesse incohérente : une famille de gestes plus lente (en situation, temps moyen des colonnes)
 * que la famille plus difficile qui la suit. Ce n'est pas forcément un problème : un geste direct
 * hérite du rythme des colonnes difficiles où il apparaît. On VÉRIFIE donc :
 *  1. pas assez de mesures « isolées » (< 15 colonnes) → test du groupe : 20 colonnes de la famille ;
 *  2. mesures fiables : la famille isolée est rapide → elle va bien ; un geste de la famille reste
 *     nettement plus lent que les autres (> 25 %) → c'est lui qu'il faut travailler ;
 *  3. la famille isolée reste lente → c'est la famille entière qu'il faut accélérer.
 * @returns {{ titre, detail, pourquoi, aller, cle }|null}
 */
export const MARGE_VERIFICATION = 1.1;
/** Allure de l'or (secondes par chiffre, + et −) : une famille aussi rapide seule n'est pas à accélérer. */
const TEMPS_OR = NIVEAUX.find((n) => n.id === 'confirme').temps.addsub;
export function verificationVitesse(d) {
  const appris = motifsAppris(d);
  const situation = {};
  for (const c of TOUS_LES_MOTIFS) {
    const f = d.motifs[c];
    if (!f || !appris.has(c)) continue;
    const ev = evaluer(f.hist ?? []);
    if (ev.essais >= MIN_ESSAIS && ev.temps !== null) (situation[familleDe(c)] ??= []).push({ cle: c, t: ev.temps });
  }
  const medFam = (fam) => (situation[fam]?.length >= 2 ? mediane(situation[fam].map((x) => x.t)) : null);
  for (let i = 0; i < ORDRE_FAMILLES.length - 1; i++) {
    const fam = ORDRE_FAMILLES[i];
    const suivante = ORDRE_FAMILLES.slice(i + 1).find((x) => medFam(x) !== null);
    // Marge de 10 % : à vitesse égale (ou presque), rien d'incohérent, on ne vérifie pas.
    if (!suivante || medFam(fam) === null || medFam(fam) <= medFam(suivante) * MARGE_VERIFICATION) continue;
    const nom = NOMS_FAMILLES[fam];
    const constat = `Vos ${nom}, à ${formaterVitesse(medFam(fam))}, paraissent plus lents que vos ${NOMS_FAMILLES[suivante]}, à ${formaterVitesse(medFam(suivante))}.`;
    const isoles = d.vitesseFamilles?.[fam] ?? [];
    if (isoles.length < MESURES_FIABLES) {
      return { cle: `famille:${fam}`, titre: `Vérifier mes ${nom}`, detail: `20 colonnes rien qu'avec eux`,
        pourquoi: `${constat} Ils sont peut-être ralentis par les colonnes difficiles où ils apparaissent : 20 colonnes rien qu'avec eux donnent leur vraie vitesse.`,
        aller: ['verification', { famille: fam }] };
    }
    const iso = mediane(isoles.slice(-20));
    // 0.40.15 : la famille mesurée seule est comparée à la suivante mesurée seule quand c'est possible
    // (avant : à sa vitesse en situation, souvent ancienne, prise dans des colonnes courtes). Pas plus
    // lente qu'elle (à 10 % près), ou déjà à l'allure de l'or seule : rien à accélérer. Avant, des gestes
    // directs à 50 CPM seuls (petits amis seuls : 51 CPM) étaient proposés chaque jour, devant les
    // grands amis à 28 CPM.
    const isoSuivante = d.vitesseFamilles?.[suivante] ?? [];
    const repere = isoSuivante.length >= MESURES_FIABLES ? mediane(isoSuivante.slice(-20)) : medFam(suivante);
    if (iso <= repere * MARGE_VERIFICATION || iso <= TEMPS_OR) {
      const lent = (situation[fam] ?? []).map((x) => ({ ...x, iso: (d.motifs[x.cle].isole ?? []).length >= MESURES_FIABLES ? mediane(d.motifs[x.cle].isole.slice(-20)) : null }))
        .filter((x) => x.iso !== null && x.iso > 1.25 * iso).sort((a, b) => b.iso - a.iso)[0];
      if (!lent) continue; // famille vérifiée rapide : c'est l'enchaînement avec les autres gestes qui coûte
      return { cle: lent.cle, titre: `Accélérer ${nomMotif(lent.cle)}`, detail: '40 lignes de marathon sur ce geste',
        pourquoi: `Mesuré seul, ${nomMotif(lent.cle)} reste plus lent (${formaterCadence(lent.iso)}) que vos autres ${nom} (${formaterCadence(iso)}) : c'est lui qui freine.`,
        aller: ['rythme', { jeu: 'marathon', cibles: [lent.cle], lignes: 40, auto: true }] };
    }
    return { cle: `famille:${fam}`, titre: `Accélérer mes ${nom}`, detail: '20 colonnes rien qu\'avec eux, en visant la régularité',
      pourquoi: `Même seuls, vos ${nom} restent lents, à ${formaterVitesse(iso)} : il faut les travailler pour eux-mêmes.`,
      aller: ['verification', { famille: fam }] };
  }
  return null;
}

// ------------------------------------------------------------------ objectif choisi

/**
 * Repères PRUDENTS (pas des chiffres officiels) : mois de pratique quotidienne (20 à 30 min)
 * qu'il faut en général à un adulte débutant pour atteindre chaque kyū. Les leçons ne sont qu'une
 * partie du chemin : à partir du 6e kyū, c'est la VITESSE et l'endurance exigées aux examens
 * (colonnes de plus en plus longues, temps limité) qui demandent des mois de drills.
 */
/** Hypothèse prudente : vitesse gagnée par semaine de pratique régulière (planObjectif). */
export const GAIN_VITESSE_SEMAINE = GAIN_REPERE;
/** Feuille de la semaine au format du grade : environ 7 minutes à l'allure de l'examen (0.39). */
export const MINUTES_FEUILLE_SEMAINE = 7;

/**
 * Points (date, ratio à l'allure du grade) d'une partie, pour le gain par semaine : examens de ce
 * grade (mixte), ou feuilles d'entraînement au format (colonnes, ou × ÷).
 */
function pointsVitesse(d, g, a, partie, cleG) {
  const ms = d.mesures ?? [];
  if (partie === 'mixte') return ms.filter((m) => m.partie === 'mixte' && m.grade === cleG && m.source === 'examen').map((m) => ({ date: m.date, ratio: m.ratio }));
  if (partie === 'colonnes') return mesuresAuFormat(d, 'colonnes', formatColonnes(g)).map((m) => ({ date: m.date, ratio: m.t / a.parChiffre }));
  return ['mul', 'div'].filter((k) => g[k]).flatMap((k) => mesuresAuFormat(d, k, null, g[k]?.total)).map((m) => ({ date: m.date, ratio: m.t / a.parProduit }));
}
export const MOIS_REPERE = { 10: 3, 9: 4, 8: 6, 7: 8, 6: 11, 5: 14, 4: 18, 3: 24, 2: 30, 1: 36 };
const ajouterMois = (date, mois) => { const x = new Date(`${date}T12:00`); x.setDate(x.getDate() + Math.round(mois * 30.4)); return x.toISOString().slice(0, 10); };

/** Où en est l'élève, en « mois de pratique » sur l'échelle des repères. */
export function moisAcquis(d) {
  const sys = systemeChoisi(d);
  const obtenu = [...sys.grades].reverse().find((g) => d.records[sys.record(g.id)]?.reussi);
  const base = obtenu ? MOIS_REPERE[obtenu.id] : 0;
  // Avant le 10e kyū : la part des leçons du 10e kyū déjà validées.
  if (!obtenu) {
    const ids = PREREQUIS[10];
    return (MOIS_REPERE[10] * ids.filter((id) => estValide(d, id)).length) / ids.length;
  }
  return base;
}

/**
 * Plan à rebours vers un grade choisi pour une date. Deux contraintes, et le verdict prend la
 * plus dure : les LEÇONS restantes (au rythme mesuré) et le TEMPS DE PRATIQUE réaliste
 * (MOIS_REPERE). Verdict : 'realiste', 'ambitieux' (possible en pratiquant plus), 'irrealiste'
 * (avec une date réaliste et le grade qu'on peut viser à la date choisie).
 * @param {string} gradeId  ex. '6'
 * @param {string} dateCible, date  AAAA-MM-JJ
 */
export function planObjectif(d, gradeId, dateCible, date) {
  const sys = systemeChoisi(d);
  const g = sys.grades.find((x) => x.id === gradeId);
  if (!g) return null;
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const reussi = !!d.records[sys.record(g.id)]?.reussi;
  const manquantes = prerequis(g).filter((id) => !estValide(d, id)).length;
  const jours = Math.round((jour(dateCible) - jour(date)) / 86400000);
  const semaines = Math.max(1 / 7, jours / 7);
  const parSemaine = manquantes / semaines;
  const recentes = SOUS_PALIERS.filter((sp) => !sp.mental && d.paliers[sp.id]?.valide && jour(date) - jour(d.paliers[sp.id].valide) <= 28 * 86400000).length;
  const rythme = recentes / 4;
  // Temps de pratique encore nécessaire (0.38.2) : d'après VOS chiffres quand ils existent.
  //  - leçons : celles qui restent, à votre rythme des 4 dernières semaines ;
  //  - vitesse : l'écart entre votre vitesse mesurée et l'allure du grade, en comptant environ
  //    2 % de vitesse gagnée par semaine de pratique régulière (hypothèse prudente) ;
  //  les deux avancent en même temps : le délai est le plus long des deux. Sans mesure, le repère
  //  général (MOIS_REPERE) sert encore.
  const acquis = moisAcquis(d);
  const repere = Math.max(0, MOIS_REPERE[g.id] - acquis);
  const moisLecons = !manquantes ? 0 : rythme >= 0.25 ? manquantes / rythme / 4.33 : null;
  const a = allureGrade(g);
  // 0.38.4 : colonnes mesurées AU FORMAT du grade quand c'est possible (sinon estimées sur les
  // gestes, « à confirmer ») ; × et ÷ jamais mesurés : signalés, pas ignorés en silence.
  const v = vitesseEleve(d, g);
  const rCol = v.parChiffre != null ? v.parChiffre / a.parChiffre : null;
  const rProd = (g.mul || g.div) && v.parProduit != null ? v.parProduit / a.parProduit : null;
  const ratios = [rCol, rProd].filter((x) => x != null);
  // 0.39 : un examen de ce grade de moins de 3 semaines dit l'allure SOUS EXAMEN ; sinon les
  // feuilles d'entraînement (la partie la plus lente).
  const cleG = `${g.systeme ?? 'nissho'}:${g.id}`;
  const exam = ratioExamen(d, cleG, date);
  const ecart = exam ? exam.ratio : ratios.length ? Math.max(...ratios) : null;
  const muldivNonMesure = !exam && !!(g.mul || g.div) && v.parProduit == null;
  const colonnesAConfirmer = !exam && v.parChiffre != null && !v.colonnesAuFormat;
  // Gain par semaine (0.39) : le repère de 2 %, puis le gain RÉEL lissé sur les semaines mesurées.
  const limitante = exam ? 'mixte' : rProd != null && (rCol == null || rProd > rCol) ? 'produits' : 'colonnes';
  const gh = gainHebdo(semainesRatios(pointsVitesse(d, g, a, limitante, cleG), date));
  const plateauVitesse = gh.plateau && ecart != null && ecart > 1;
  const moisVitesse = ecart == null ? null : ecart <= 1 ? 0 : Math.log(ecart) / -Math.log(1 - gh.gain) / 4.33;
  const base = moisLecons != null && moisVitesse != null ? 'rythme' : 'repere';
  const moisRestants = base === 'rythme' ? Math.max(moisLecons, moisVitesse) : repere;
  const moisDispo = Math.max(0, jours / 30.4);
  const leconsOk = manquantes === 0 || parSemaine <= Math.max(rythme * 1.2, 3);
  let verdict;
  if (jours <= 0) verdict = 'irrealiste';
  else if (moisDispo >= moisRestants && leconsOk) verdict = 'realiste';
  else if (moisDispo >= moisRestants * 0.75 && parSemaine <= 4) verdict = 'ambitieux';
  else verdict = 'irrealiste';
  // Temps quotidien : 20 min au rythme des repères, davantage si la date est serrée.
  const minutesJour = Math.min(60, Math.max(15, Math.round((20 * (moisRestants / Math.max(moisDispo, 0.1))) / 5) * 5));
  // Date réaliste, et le grade qu'on peut viser à la date choisie.
  const dateRealiste = ajouterMois(date, moisRestants);
  const atteignable = [...sys.grades].reverse().find((x) => MOIS_REPERE[x.id] <= acquis + moisDispo) ?? null;
  return {
    grade: g, reussi, manquantes, jours, parSemaine, rythme, minutesJour, verdict, realiste: verdict === 'realiste',
    moisRestants, dateRealiste, atteignable: atteignable && atteignable !== g ? atteignable : null,
    base, moisLecons, moisVitesse, ecartVitesse: ecart, muldivNonMesure, colonnesAConfirmer, format: formatColonnes(g),
    sourceVitesse: exam ? 'examen' : 'entrainement', gainSemaine: gh.gain, gainReel: gh.reel, semainesMesurees: gh.semaines, plateauVitesse,
  };
}

// ------------------------------------------------------------------ consolidation

/**
 * Consolidation : 2 à 7 jours après la validation d'une leçon « stricte » (un seul ami), une
 * planche qui MÉLANGE ce geste avec ceux des leçons précédentes. Répéter en bloc installe le
 * geste ; le mélanger ensuite oblige à le choisir, ce qui le rend durable. Une seule fois par leçon.
 * @returns {object|null}  le sous-palier à consolider
 */
export function consolidationDuJour(d, date) {
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const faites = new Set(d.sessions.filter((s) => s.date !== date && String(s.mode).startsWith('consolidation:')).map((s) => s.mode.slice(14)));
  return ADDSUB.find((sp) => {
    const v = d.paliers[sp.id]?.valide;
    if (!v || sp.cumul || faites.has(sp.id)) return false;
    const ecart = (jour(date) - jour(v)) / 86400000;
    return ecart >= 2 && ecart <= 7;
  }) ?? null;
}
