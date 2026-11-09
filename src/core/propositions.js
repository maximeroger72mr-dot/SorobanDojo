/**
 * Propositions pour compléter la séance du jour, puis après la séance (« Et maintenant ? »).
 * Fonctions pures : elles reçoivent les données de progression et la date.
 *
 *  - UNE planche, avec un objectif pédagogique clair. Quand elle est faite, la suivante prend
 *    sa place (pas forcément plus dure : renforcer, automatiser, consolider, endurance, un cran
 *    au-dessus…). Dans les juku, la feuille d'exercices est la base du travail.
 *  - un flash anzan réglé sur le niveau, lancé directement ;
 *  - un jeu lancé directement (bonne variante), ou parfois le défi de la semaine.
 *  - pour un objectif de temps élevé : d'autres planches, un drill (record à portée), un
 *    examen blanc.
 * Rien de ce qui a déjà été fait aujourd'hui n'est reproposé.
 *
 * Durées : estimées sur la vitesse réelle de l'apprenant (temps par chiffre de ses feuilles).
 */

import { NIVEAUX, cpm, mediane } from './maitrise.js';
import { nomMotif } from './motifs.js';
import { gestesLents, chiffresAppris, anzanAdapte, estValide, defiSemaine, famillesApprises, coursMultiplicationAtteint, drillValide } from './parcours.js';
import { catalogueDrills, tempsClassement, CLASSEMENT } from './drills.js';
import { examenDeLaSemaine, minutesExamen } from './examen.js';
import { semaineISO } from './hasard.js';
import { produitsARetravailler } from './tables.js';

const jourNum = (date) => Math.floor(new Date(`${date}T12:00`).getTime() / 86400000);
const sessionsDu = (d, date) => d.sessions.filter((s) => s.date === date);

/** Temps par chiffre de l'apprenant sur ses feuilles (médiane des 10 dernières), 3 s par défaut. */
export function secondesParChiffre(d) {
  const t = (d.feuilles ?? []).slice(-10).map((f) => f.t).filter((x) => x > 0);
  return Math.min(8, Math.max(0.6, mediane(t) ?? 3));
}

/** Durée d'une planche : le calcul, plus l'écriture des réponses (5 s par colonne). */
export const minutesPlanche = (d, p) => Math.max(2, Math.round((p.colonnes * (p.lignes * p.chiffres * secondesParChiffre(d) + 5)) / 60));

/**
 * Les planches possibles, dans l'ordre de priorité pédagogique ; chacune a un id stable, pour
 * savoir si elle a été faite aujourd'hui (session « planches » avec reglages.proposition).
 * @param {Array<{cle}>} difficiles  gestes en difficulté (erreurs avérées), voir motifsEnDifficulte
 */
export function planchesPossibles(d, difficiles = []) {
  if (!estValide(d, 'p1-3') && !d.reglages?.decouverte) return [];
  const ch = chiffresAppris(d);
  const liste = [];
  const faible = difficiles.find((m) => !m.cle.endsWith(':direct'));
  if (faible) {
    liste.push({ id: `renforcer:${faible.cle}`, but: 'Renforcer', titre: `Planche « ${nomMotif(faible.cle)} »`, cible: faible.cle, pur: true, chiffres: 1, lignes: 5, colonnes: 10,
      objectif: `Renforcer un geste qui se trompe : 10 colonnes justes sur 10, sans chercher la vitesse.` });
  }
  const lents = gestesLents(d, 2);
  for (const [k, lent] of lents.entries()) {
    const suivant = NIVEAUX[lent.ev.index + 1]?.temps?.addsub;
    const quel = k === 0 ? 'votre geste le plus lent' : 'un de vos gestes les plus lents';
    liste.push({ id: `automatiser:${lent.cle}`, but: 'Automatiser', titre: `Planche « ${nomMotif(lent.cle)} »`, cible: lent.cle, pur: true, chiffres: 1, lignes: 6, colonnes: 10,
      objectif: suivant ? `Automatiser ${quel} : viser ${cpm(suivant)} CPM (vous êtes à ${cpm(lent.ev.temps)}).` : `Automatiser ${quel} (${cpm(lent.ev.temps)} CPM) : un rythme égal, sans réfléchir.` });
  }
  liste.push({ id: 'consolider', but: 'Consolider', titre: 'Planche mélangée', cible: 'appris', chiffres: ch, lignes: 5, colonnes: 10,
    objectif: 'Consolider : tous vos gestes mélangés, il faut CHOISIR le bon à chaque ligne, comme en examen.' });
  liste.push({ id: 'endurance', but: 'Endurance', titre: 'Planche d\'endurance', cible: 'appris', chiffres: ch, lignes: ch >= 3 ? 10 : 8, colonnes: 5,
    objectif: 'Endurance : des colonnes longues, en gardant le même rythme de la 1re à la dernière ligne.' });
  if (ch < 6) {
    liste.push({ id: 'cran', but: 'Un cran au-dessus', titre: `Planche à ${ch + 1} chiffres`, cible: 'appris', chiffres: ch + 1, lignes: 5, colonnes: 5,
      objectif: `Un cran au-dessus : ${ch + 1} chiffres par nombre, la justesse d'abord, la vitesse suivra.` });
  }
  liste.push({ id: 'vitesse', but: 'Vitesse', titre: 'Planche courte et rapide', cible: 'appris', chiffres: Math.max(1, ch - 1), lignes: 4, colonnes: 10,
    objectif: 'Vitesse : des colonnes courtes avec moins de chiffres, le plus vite possible sans erreur.' });
  return liste.map((p) => ({ ...p, minutes: minutesPlanche(d, p) }));
}

const planchesFaites = (d, date) => new Set(sessionsDu(d, date).filter((s) => s.module === 'planches').map((s) => s.reglages?.proposition).filter(Boolean));

/** Une proposition de planche, prête à lancer (aller). */
const versPlanche = (p) => ({
  type: 'planche', id: p.id, titre: p.titre, but: p.but, detail: p.objectif, minutes: p.minutes,
  aller: ['planches', { cible: p.cible, pur: !!p.pur, chiffres: p.chiffres, lignes: p.lignes, colonnes: p.colonnes, proposition: p.id, objectif: p.objectif, auto: true }],
});

/** Les n prochaines planches non faites aujourd'hui (la liste tourne : la suivante prend la place). */
export function prochainesPlanches(d, date, difficiles = [], n = 1, exclure = []) {
  const faites = planchesFaites(d, date);
  // Pas deux fois le même geste dans la séance (la priorité du jour le travaille déjà).
  const restantes = planchesPossibles(d, difficiles).filter((p) => !faites.has(p.id) && !exclure.includes(p.cible));
  return restantes.slice(0, n).map(versPlanche);
}

/** Flash anzan réglé sur le niveau (après « Gestes directs à 2 et 3 chiffres »). */
export function anzanPropose(d, date) {
  if (!estValide(d, 'p1-4') && !d.reglages?.decouverte) return null;
  if (sessionsDu(d, date).some((s) => s.module === 'anzan')) return null;
  const a = anzanAdapte(d);
  return { type: 'anzan', titre: 'Flash anzan', but: 'Calcul de tête', minutes: 3,
    detail: `${a.questions} calculs de tête de ${a.termes} nombres à ${a.chiffres} chiffre${a.chiffres > 1 ? 's' : ''}, ${a.duree.toLocaleString('fr-FR')} s par nombre : réglé sur votre niveau.`,
    aller: ['anzan', { ...a, auto: true }] };
}

/** Le jeu, lancé directement dans la bonne variante ; parfois le défi de la semaine à la place. */
export function jeuPropose(d, date) {
  const du = sessionsDu(d, date);
  // Défi de la semaine : seulement s'il n'a pas encore été tenté cette semaine, un jour sur deux.
  const semaine = semaineISO(date).cle;
  const defiTente = d.sessions.some((s) => s.module === 'defis' && ['semaine', 'sans-filet'].includes(s.mode) && semaineISO(s.date).cle === semaine);
  if (estValide(d, 'p1-3') && !defiTente && jourNum(date) % 2 === 0) {
    return { type: 'defi', titre: 'Défi de la semaine', but: 'Se mesurer', minutes: 5, detail: 'La même feuille toute la semaine : tentez-la une première fois pour avoir votre repère.', aller: ['defis', { semaine: true }] };
  }
  const f = famillesApprises(d);
  const cible = coursMultiplicationAtteint(d, null) && d.paliers['p6-a']?.valide ? 100 : f.has('grand') ? 10 : 5;
  const jeux = [
    { mode: `complement-${cible}`, titre: `Complément éclair à ${cible}`, detail: `60 s de compléments à ${cible} : ${cible === 5 ? 'le moteur des petits amis' : cible === 10 ? 'le moteur des grands amis' : 'le rendu de monnaie'}.`, aller: ['jeux', { jeu: 'complement', cible }] },
    f.has('petit') && { mode: 'geste', titre: 'Le bon geste', detail: '30 s pour reconnaître le bon ami.', aller: ['jeux', { jeu: 'geste' }] },
    estValide(d, 'p1-4') && { mode: 'chasse', titre: 'Chasse à l\'erreur', detail: '10 colonnes : trouvez le sous-total faux, soroban en main.', aller: ['jeux', { jeu: 'chasse' }] },
    estValide(d, 'p1-a') && { mode: 'survie', titre: 'Survie anzan', detail: 'La chaîne de tête la plus longue possible.', aller: ['jeux', { jeu: 'survie' }] },
  ].filter(Boolean).filter((j) => !du.some((s) => s.module === 'jeux' && s.mode === j.mode));
  if (!jeux.length) return null;
  const j = jeux[jourNum(date) % jeux.length];
  return { type: 'jeu', titre: j.titre, but: 'Jouer', minutes: 2, detail: j.detail, aller: j.aller };
}

/** Le drill dont la médaille suivante est la plus proche (en secondes). */
export function drillAPortee(d, date) {
  if (sessionsDu(d, date).some((s) => s.module === 'drills' && !String(s.mode).startsWith('tables') && s.mode !== 'quotient')) return null;
  let meilleur = null;
  for (const x of catalogueDrills()) {
    const rec = d.records[`drill-${x.id}`];
    if (!rec || !drillValide(d, x.id)) continue;
    for (const c of CLASSEMENT) {
      const ecart = rec.dureeMs - tempsClassement(x, c.id);
      if (ecart > 0) {
        const relatif = ecart / rec.dureeMs;
        if (relatif < 0.25 && (!meilleur || relatif < meilleur.relatif)) meilleur = { drill: x, medaille: c, ecart, relatif };
        break;
      }
    }
  }
  if (!meilleur) return null;
  return { type: 'drill', titre: `Drill : ${meilleur.drill.titre}`, but: 'Record à portée', minutes: 3,
    detail: `Il vous manque ${Math.ceil(meilleur.ecart / 1000)} s pour la médaille ${meilleur.medaille.nom.toLowerCase()}.`,
    aller: ['drills', { drill: meilleur.drill.id }] };
}

/** Examen blanc : le passage de kyū de votre niveau, pour l'entraînement (objectif de temps long). */
export function examenBlanc(d, date) {
  const g = examenDeLaSemaine(d);
  if (!g || sessionsDu(d, date).some((s) => s.module === 'examen')) return null;
  return { type: 'examen', titre: `Examen blanc · ${g.nom}`, but: 'Conditions d\'examen', minutes: minutesExamen(g),
    detail: '20 colonnes chronométrées, comme le jour J : un échec ne coûte rien.', aller: ['examen', {}] };
}

/** Tables : vos produits à retravailler (une fois la multiplication commencée). */
function tablesProposees(d, date) {
  const n = produitsARetravailler(d.tables ?? {}).length;
  if (!n || sessionsDu(d, date).some((s) => s.module === 'drills' && String(s.mode).startsWith('tables'))) return null;
  return { type: 'tables', titre: 'Mes produits à retravailler', but: 'Tables', minutes: 2, detail: `${n} produit${n > 1 ? 's' : ''} faux ou plus lent${n > 1 ? 's' : ''} que 2,5 s.`, aller: ['drills', { tables: 'lents', auto: true }] };
}

/**
 * Propositions pour compléter : toujours une planche, un flash anzan et un jeu (ou le défi) ;
 * avec beaucoup de temps restant, d'autres planches, un drill, un examen blanc, les tables.
 * @param {number} minutesRestantes  temps restant avant l'objectif du jour (0 : séance finie)
 */
export function propositions(d, date, difficiles = [], minutesRestantes = 0, exclure = []) {
  const liste = [...prochainesPlanches(d, date, difficiles, 1, exclure), anzanPropose(d, date), jeuPropose(d, date)].filter(Boolean);
  let total = liste.reduce((t, x) => t + x.minutes, 0);
  if (minutesRestantes > total) {
    const autres = prochainesPlanches(d, date, difficiles, 3, exclure);
    const extra = [autres[1], drillAPortee(d, date), tablesProposees(d, date), examenBlanc(d, date), autres[2]].filter(Boolean);
    for (const x of extra) {
      if (total >= minutesRestantes) break;
      liste.splice(liste.length - 1, 0, x); // avant le jeu, qui reste en dernier
      total += x.minutes;
    }
  }
  return liste;
}
