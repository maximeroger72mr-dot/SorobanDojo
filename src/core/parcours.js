/**
 * Où en est l'élève dans le parcours, et ce qui en découle :
 *  - gestes appris (pour ne jamais proposer un ami jamais vu) ;
 *  - grade obtenu (épreuves réussies) et prochain grade conseillé (leçons prérequises) ;
 *  - drill d'échauffement, défi de la semaine et gestes à accélérer, ADAPTÉS AU NIVEAU.
 *
 * Fonctions pures : elles reçoivent les données de progression (voir progression.js).
 */

import { SOUS_PALIERS, PALIERS } from './curriculum.js';
import { GRADES } from './epreuves.js';
import { famille, nomMotif, TOUS_LES_MOTIFS } from './motifs.js';
import { catalogueDrills, famillesDrill, VALIDATIONS_DRILL, tigesDrill, clesDrill } from './drills.js';
import { evaluer, plateau, mediane, MIN_ESSAIS, formaterVitesse, formaterCadence } from './maitrise.js';
import { genererColonneVariee, creerMemoire } from './generateur.js';
import { genererMultiplication, genererDivision } from './multiplication.js';
import { avecGraine, semaineISO } from './hasard.js';

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
 * (10e : additions et soustractions avec tous les amis, multiplication 2×1 ; 9e : + division
 * ÷1 chiffre ; 8e : × 3×1 et 2×2, ÷ à 2 chiffres ; 7e : ÷ 2 chiffres, quotient 2 chiffres).
 */
const ADDSUB_TOUT = idsPaliers('p1', 'p2', 'p3', 'p4', 'p5');
const K10 = [...ADDSUB_TOUT, 'p6-a', 'p6-0', 'p6-1'];
const K9 = [...K10, 'p7-0', 'p7-1'];
const K8 = [...K9, 'p6-2', 'p6-3', 'p7-2', 'p7-e', 'p7-3'];
const K7 = [...K8, 'p7-4'];
// 6e au 1er kyū : chaque grade n'exige que ce que SON épreuve demande (avant, tout le parcours
// était exigé dès le 6e kyū, décimaux et division par 3 chiffres compris).
const K6 = [...K7, 'p6-4', 'p8-t1'];
const K5 = [...K6, 'p8-t2', 'p8-1', 'p8-2', 'p8-4', 'p8-6'];
const K4 = [...K5, 'p8-3', 'p8-5', 'p8-7'];
const K3 = [...K4, ...idsPaliers('pd')];
const K2 = [...K3, 'p9-1', 'p9-3', 'p9-5', 'p8-n'];
const K1 = [...K2, 'p9-2', 'p9-4', 'p9-6'];
export const PREREQUIS = { 10: K10, 9: K9, 8: K8, 7: K7, 6: K6, 5: K5, 4: K4, 3: K3, 2: K2, 1: K1 };
const prerequis = (g) => PREREQUIS[g.id] ?? SOUS_PALIERS.filter((s) => !s.mental && !s.optionnel && s.type !== 'anzan' && s.type !== 'theorie').map((s) => s.id);

/**
 * Grade : le meilleur kyū réussi en épreuve, et le suivant à préparer.
 * @returns {{ obtenu: object|null, prochain: object|null, manquantes: object[], pret: boolean }}
 */
export function grade(d) {
  let obtenu = null;
  for (const g of GRADES) if (d.records[`epreuve-${g.id}`]?.reussi) obtenu = g; // GRADES va du 10e au 1er
  const prochain = obtenu ? GRADES[GRADES.indexOf(obtenu) + 1] ?? null : GRADES[0];
  const manquantes = prochain ? prerequis(prochain).filter((id) => !estValide(d, id)).map((id) => SOUS_PALIERS.find((s) => s.id === id)) : [];
  return { obtenu, prochain, manquantes, pret: !!prochain && manquantes.length === 0 };
}

/** Nombre de chiffres le plus grand vu dans les leçons d'addition validées (au moins 1). */
export const chiffresAppris = (d) => Math.max(1, ...ADDSUB.filter((sp) => estValide(d, sp.id)).map((sp) => sp.chiffres));

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
  const ouverts = catalogueDrills().filter((x) => faisable(d0, x) && drillOuvert(d0, x) && !(avance && x.entree && !drillValide(d, x.id)));
  return ouverts.find((x) => !drillValide(d, x.id)) ?? ouverts.at(-1) ?? null;
}

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
  return { appris, amis, chiffres: n < 0.4 ? 1 : n < 0.8 ? 2 : 3 };
}

export function defiSemaine(d, date) {
  const { cle: semaine } = semaineISO(date);
  const { appris, amis, chiffres } = formatSemaine(d);
  const mul = estValide(d, 'p6-1');
  const div = estValide(d, 'p7-1');
  const palier = `${chiffres}${mul ? 'm' : ''}${div ? 'd' : ''}${amis.length}`;
  const graine = [...`${semaine}-${palier}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sections = avecGraine(graine, () => {
    const memoire = creerMemoire(10);
    const s = [{ titre: 'Colonnes', problemes: Array.from({ length: mul || div ? 6 : 10 }, () => genererColonneVariee({ chiffres, lignes: 5, autorises: appris, cibles: amis.length ? amis : DIRECT }, memoire)) }];
    if (mul) s.push({ titre: 'Multiplications', problemes: Array.from({ length: 2 }, () => genererMultiplication(2, estValide(d, 'p6-3') ? 2 : 1)) });
    if (div) s.push({ titre: 'Divisions', problemes: Array.from({ length: 2 }, () => genererDivision(1, 2)) });
    return s;
  });
  return { cle: `defi-semaine-${semaine}-${palier}`, semaine, sections, description: `${chiffres} chiffre${chiffres > 1 ? 's' : ''}, gestes appris${mul ? ', multiplications' : ''}${div ? ', divisions' : ''}` };
}

/**
 * Anzan du jour, adapté au niveau : plus on a validé d'étapes d'anzan dans le parcours,
 * plus il y a de nombres, plus ils défilent vite, puis on passe à 2 chiffres.
 */
export function anzanAdapte(d) {
  // Progression lente : on allonge la chaîne avant d'accélérer, et l'image d'aide reste longtemps.
  const k = Math.min(6, SOUS_PALIERS.filter((sp) => sp.type === 'anzan' && estValide(d, sp.id)).length);
  return {
    mode: k < 3 ? 'image' : 'flash',
    chiffres: k >= 6 ? 2 : 1,
    termes: [3, 3, 4, 5, 5, 6, 3][k],
    duree: [3, 2.5, 2.5, 2, 2, 1.5, 3][k],
    questions: 5,
  };
}

/** L'élève est-il arrivé au cours de multiplication (ou au-delà) ? */
export function coursMultiplicationAtteint(d, prochain) {
  const debut = SOUS_PALIERS.find((s) => s.id === 'p6-a').ordre;
  return (prochain ? prochain.ordre >= debut : true) || !!d.paliers['p6-a'] || !!d.paliers['p6-0'];
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
  const valideLe = d.paliers['p7-0']?.valide;
  if (valideLe && prochain && prochain.palier.id === 'p8') {
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
export function plateaux(d, date) {
  const liste = [];
  for (const [cle, f] of Object.entries(d.motifs)) {
    if (cle.endsWith(':direct') || evaluer(f.hist ?? []).niveau.id === 'expert') continue;
    const p = plateau(f.sem, date);
    if (p) liste.push({ type: 'geste', cle, nom: nomMotif(cle), ...p });
  }
  for (const [id, e] of Object.entries(d.paliers)) {
    const sp = SOUS_PALIERS.find((s) => s.id === id);
    if (!sp || sp.type !== 'addsub' || evaluer(e.hist ?? []).niveau.id === 'expert') continue;
    const p = plateau(e.sem, date);
    if (p) liste.push({ type: 'lecon', cle: id, nom: `la leçon « ${sp.titre} »`, cibles: sp.cibles, ...p });
  }
  return liste.sort((a, b) => b.maintenant / b.avant - a.maintenant / a.avant);
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
    if (!suivante || medFam(fam) === null || medFam(fam) < medFam(suivante)) continue;
    const nom = NOMS_FAMILLES[fam];
    const constat = `Vos ${nom} (${formaterVitesse(medFam(fam))}) paraissent plus lents que vos ${NOMS_FAMILLES[suivante]} (${formaterVitesse(medFam(suivante))}).`;
    const isoles = d.vitesseFamilles?.[fam] ?? [];
    if (isoles.length < MESURES_FIABLES) {
      return { cle: `famille:${fam}`, titre: `Vérifier mes ${nom}`, detail: `20 colonnes rien qu'avec eux`,
        pourquoi: `${constat} Ils sont peut-être ralentis par les colonnes difficiles où ils apparaissent : 20 colonnes rien qu'avec eux donnent leur vraie vitesse.`,
        aller: ['verification', { famille: fam }] };
    }
    const iso = mediane(isoles.slice(-20));
    if (iso < medFam(suivante)) {
      const lent = (situation[fam] ?? []).map((x) => ({ ...x, iso: (d.motifs[x.cle].isole ?? []).length >= MESURES_FIABLES ? mediane(d.motifs[x.cle].isole.slice(-20)) : null }))
        .filter((x) => x.iso !== null && x.iso > 1.25 * iso).sort((a, b) => b.iso - a.iso)[0];
      if (!lent) continue; // famille vérifiée rapide : c'est l'enchaînement avec les autres gestes qui coûte
      return { cle: lent.cle, titre: `Accélérer ${nomMotif(lent.cle)}`, detail: '40 lignes de marathon sur ce geste',
        pourquoi: `Mesuré seul, ${nomMotif(lent.cle)} reste plus lent (${formaterCadence(lent.iso)}) que vos autres ${nom} (${formaterCadence(iso)}) : c'est lui qui freine.`,
        aller: ['rythme', { jeu: 'marathon', cibles: [lent.cle], lignes: 40, auto: true }] };
    }
    return { cle: `famille:${fam}`, titre: `Accélérer mes ${nom}`, detail: '20 colonnes rien qu\'avec eux, en visant la régularité',
      pourquoi: `Même seuls, vos ${nom} restent lents (${formaterVitesse(iso)}) : il faut les travailler pour eux-mêmes.`,
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
export const MOIS_REPERE = { 10: 3, 9: 4, 8: 6, 7: 8, 6: 11, 5: 14, 4: 18, 3: 24, 2: 30, 1: 36 };
const ajouterMois = (date, mois) => { const x = new Date(`${date}T12:00`); x.setDate(x.getDate() + Math.round(mois * 30.4)); return x.toISOString().slice(0, 10); };

/** Où en est l'élève, en « mois de pratique » sur l'échelle des repères. */
export function moisAcquis(d) {
  const obtenu = [...GRADES].reverse().find((g) => d.records[`epreuve-${g.id}`]?.reussi);
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
  const g = GRADES.find((x) => x.id === gradeId);
  if (!g) return null;
  const jour = (x) => new Date(`${x}T12:00`).getTime();
  const reussi = !!d.records[`epreuve-${g.id}`]?.reussi;
  const manquantes = prerequis(g).filter((id) => !estValide(d, id)).length;
  const jours = Math.round((jour(dateCible) - jour(date)) / 86400000);
  const semaines = Math.max(1 / 7, jours / 7);
  const parSemaine = manquantes / semaines;
  const recentes = SOUS_PALIERS.filter((sp) => !sp.mental && d.paliers[sp.id]?.valide && jour(date) - jour(d.paliers[sp.id].valide) <= 28 * 86400000).length;
  const rythme = recentes / 4;
  // Temps de pratique encore nécessaire, et temps disponible.
  const acquis = moisAcquis(d);
  const moisRestants = Math.max(0, MOIS_REPERE[g.id] - acquis);
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
  const atteignable = [...GRADES].reverse().find((x) => MOIS_REPERE[x.id] <= acquis + moisDispo) ?? null;
  return {
    grade: g, reussi, manquantes, jours, parSemaine, rythme, minutesJour, verdict, realiste: verdict === 'realiste',
    moisRestants, dateRealiste, atteignable: atteignable && atteignable !== g ? atteignable : null,
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
