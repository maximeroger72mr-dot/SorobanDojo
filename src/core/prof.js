/**
 * Le prof : décide, chaque jour, ce qui fait progresser, et le dit franchement.
 *
 *  - decisionDuJour : avancer (nouvelle leçon) ou ancrer (drill sur la dernière leçon). On
 *    n'avance que si la dernière leçon est acquise (juste ET rapide, seuil « débutant ») : cette
 *    condition ne se lève jamais. On attend aussi que l'AVANT-DERNIÈRE leçon soit « acquis
 *    confirmé » ; faute de quoi on ancre, pendant JOURS_ANCRAGE_MAX jours de pratique au plus,
 *    puis on avance quand même (le geste est entré, la vitesse viendra en route).
 *    Après 3 jours d'absence, on reprend en ancrant ; une leçon commencée se termine.
 *  - jeuDuJour : le jeu « bonus » du jour, qui change chaque jour parmi ceux qui ont du sens
 *    au niveau atteint.
 *  - motDuProf : 3 ou 4 phrases : ce qui s'est passé, la décision du jour et pourquoi,
 *    le passage de kyū de la semaine (sans pression), l'objectif.
 *
 * Fonctions pures : elles reçoivent les données de progression (et le prochain sous-palier).
 */

import { SOUS_PALIERS, familleLecon } from './curriculum.js';
import { evaluer } from './maitrise.js';
import { famillesApprises, planObjectif, gestesLents, defiSemaine } from './parcours.js';
import { nomMotif } from './motifs.js';
import { examenDeLaSemaine, resultatSemaine, meilleurPrekyu } from './examen.js';
import { GENERAUX } from './conseils.js';

const jour = (x) => new Date(`${x}T12:00`).getTime();
const ecartJours = (a, b) => Math.round((jour(b) - jour(a)) / 86400000);
const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Jours depuis la dernière séance (null : jamais pratiqué). */
export function joursAbsence(d, date) {
  const dates = d.sessions.map((s) => s.date).filter((x) => x < date).sort();
  return dates.length ? ecartJours(dates.at(-1), date) : null;
}

const LECON_SOROBAN = (sp) => !sp.mental && !['theorie', 'placement', 'lire', 'complement'].includes(sp.type);
const parValidation = (d) => (a, b) => (d.paliers[a.id].valide < d.paliers[b.id].valide ? -1 : d.paliers[a.id].valide > d.paliers[b.id].valide ? 1 : a.ordre - b.ordre);

/** Dernière leçon du parcours soroban validée (la plus récente). */
export function derniereLecon(d) {
  return SOUS_PALIERS.filter((sp) => LECON_SOROBAN(sp) && d.paliers[sp.id]?.valide).sort(parValidation(d)).at(-1) ?? null;
}

/** Avant-dernière leçon du parcours soroban validée (null s'il n'y en a qu'une). */
export function avantDerniereLecon(d) {
  return SOUS_PALIERS.filter((sp) => LECON_SOROBAN(sp) && d.paliers[sp.id]?.valide).sort(parValidation(d)).at(-2) ?? null;
}

/** Jours de pratique d'ancrage, au plus, avant d'ouvrir la leçon suivante malgré tout. */
export const JOURS_ANCRAGE_MAX = 7;

/** Jours de pratique depuis la validation de la dernière leçon (aujourd'hui non compris). */
export function joursDepuisDerniereLecon(d, date) {
  const derniere = derniereLecon(d);
  if (!derniere) return 0;
  const v = d.paliers[derniere.id].valide;
  return new Set(d.sessions.map((s) => s.date).filter((x) => x > v && x < date)).size;
}

/**
 * Niveau atteint sur une leçon (index de maitrise.NIVEAUX) : le meilleur de deux mesures.
 *  - l'historique de la leçon elle-même (ses exercices) ;
 *  - pour une leçon de colonnes, le niveau de TOUS ses gestes sur la carte de maîtrise : des
 *    gestes passés en or ailleurs (planches, marathon, lièvre) valent une leçon confirmée, même
 *    si l'on n'a pas refait la leçon depuis.
 * @returns {{ index:number, essais:number, manque:string[] }}
 */
export function niveauLecon(d, sp) {
  const ev = evaluer(d.paliers[sp.id]?.hist ?? [], familleLecon(sp));
  const cibles = (sp.type ?? 'addsub') === 'addsub' ? (sp.cibles ?? []).filter((c) => !c.endsWith(':direct')) : [];
  if (!cibles.length) return ev;
  const gestes = Math.min(...cibles.map((c) => evaluer(d.motifs?.[c]?.hist ?? [], 'addsub').index));
  return gestes > ev.index ? { ...ev, index: gestes, essais: Math.max(ev.essais, 8), manque: [] } : ev;
}

/** Exercice d'ancrage d'une leçon : marathon sur ses gestes, ou entraînement de la leçon. */
function ancrage(sp) {
  return sp.type === 'addsub'
    ? { aller: ['rythme', { jeu: 'marathon', cibles: sp.cibles, lignes: 30, auto: true }], detail: `30 lignes de marathon sur les gestes de « ${sp.titre} »`, cibles: sp.cibles }
    : { aller: ['lecons', { sousPalier: sp.id, onglet: 'entrainement' }], detail: `entraînement de « ${sp.titre} »` };
}

/**
 * Avancer ou ancrer ?
 * @param {object|null} prochain  prochain sous-palier du parcours soroban (lecons.prochainSousPalier)
 * @returns {{ type: 'lecon'|'ancrage'|'revision', titre, detail, raison, aller, minutes, sp? }}
 */
export function decisionDuJour(d, date, prochain) {
  const absence = joursAbsence(d, date);
  const derniere = derniereLecon(d);
  if (prochain && (d.paliers[prochain.id]?.reps ?? 0) > 0) {
    return { type: 'lecon', titre: 'Leçon', detail: prochain.titre, raison: `Vous avez commencé « ${prochain.titre} » : on la termine.`, aller: ['lecons', { sousPalier: prochain.id }], minutes: 15, sp: prochain };
  }
  if (derniere && absence !== null && absence >= 3) {
    const a = ancrage(derniere);
    return { type: 'ancrage', titre: 'Reprise en douceur', ...a, raison: `${absence} jours sans soroban : pas de nouvelle leçon aujourd'hui, on réveille les gestes de « ${derniere.titre} ».`, minutes: 10, sp: derniere };
  }
  if (derniere) {
    const ev = niveauLecon(d, derniere);
    if (ev.essais >= 8 && ev.index < 2) {
      const a = ancrage(derniere);
      return { type: 'ancrage', titre: 'Ancrage', ...a, raison: `Pas de nouvelle leçon aujourd'hui : « ${derniere.titre} » n'est pas encore acquise (${ev.manque.join(', ')}). Mieux vaut drill qu'empiler.`, minutes: 10, sp: derniere };
    }
  }
  // L'avant-dernière leçon doit être « acquis confirmé » (index 3) ; sinon on ancre encore, mais
  // pas plus de JOURS_ANCRAGE_MAX jours de pratique : au-delà, on avance (débutant est acquis).
  const avant = avantDerniereLecon(d);
  if (prochain && avant) {
    const ev = niveauLecon(d, avant);
    const jours = joursDepuisDerniereLecon(d, date);
    if (ev.essais >= 8 && ev.index < 3 && jours < JOURS_ANCRAGE_MAX) {
      const a = ancrage(avant);
      const reste = JOURS_ANCRAGE_MAX - jours;
      return { type: 'ancrage', titre: 'Ancrage', ...a, raison: `Pas de nouvelle leçon aujourd'hui : « ${avant.titre} » n'est pas encore « acquis confirmé » (${ev.manque.join(', ')}). On fait entrer le mouvement ; la leçon suivante s'ouvrira dès que ce sera le cas, et au plus tard dans ${reste} jour${reste > 1 ? 's' : ''} de pratique.`, minutes: 10, sp: avant };
    }
  }
  if (prochain) {
    return { type: 'lecon', titre: 'Nouvelle leçon', detail: prochain.titre, raison: derniere ? `« ${derniere.titre} » est acquise : on avance.` : 'On commence le parcours.', aller: ['lecons', { sousPalier: prochain.id }], minutes: 15, sp: prochain };
  }
  return { type: 'revision', titre: 'Entretien', detail: '30 lignes de marathon sur tous vos gestes', raison: 'Le parcours est terminé : on entretient la vitesse.', aller: ['rythme', { jeu: 'marathon', lignes: 30, auto: true }], minutes: 10 };
}

/** Jeu « bonus » du jour : il tourne d'un jour à l'autre parmi ceux qui ont du sens au niveau atteint. */
export function jeuDuJour(d, date) {
  const f = famillesApprises(d);
  const jeux = [
    f.has('petit') && { titre: 'Le bon geste', detail: '30 s pour reconnaître le bon ami', aller: ['jeux', { jeu: 'geste' }], mode: 'geste' },
    { titre: 'Complément éclair', detail: f.has('grand') ? 'compléments à 10 en 60 s' : 'compléments à 5 en 60 s', aller: ['jeux', { jeu: 'complement', cible: f.has('grand') ? 10 : 5 }], mode: 'complement' },
    d.paliers['p1-4']?.valide && { titre: 'Chasse à l\'erreur', detail: '10 colonnes : trouvez le sous-total faux', aller: ['jeux', { jeu: 'chasse' }], mode: 'chasse' },
    d.paliers['p1-a']?.valide && { titre: 'Survie anzan', detail: 'la chaîne de tête la plus longue possible', aller: ['jeux', { jeu: 'survie' }], mode: 'survie' },
    f.has('petit') && { titre: 'Contre-la-montre arcade', detail: 'tenir le plus longtemps possible', aller: ['defis', {}], mode: 'arcade' },
    f.has('grand') && { titre: 'L\'escalier', detail: '10 marches, du facile au boss', aller: ['defis', {}], mode: 'echelle' },
  ].filter(Boolean);
  return jeux[Math.floor(jour(date) / 86400000) % jeux.length];
}

/**
 * Le mot du prof : quelques phrases directes.
 * @param {object} decision  resultat de decisionDuJour
 * @param {number} minutesEssentiel  durée estimée de l'essentiel
 */
/**
 * Choix d'une formulation parmi plusieurs, stable sur la journée (pas de changement à chaque
 * affichage) mais différente d'un jour à l'autre : le prof ne répète pas toujours la même phrase.
 */
export function variante(date, cle, liste) {
  let h = 0;
  for (const c of `${date}:${cle}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return liste[h % liste.length];
}

/** Bilan des exercices faits aujourd'hui (toutes activités). */
function bilanDuJour(d, date) {
  const du = d.sessions.filter((s) => s.date === date);
  const total = du.reduce((t, s) => t + (s.total ?? 0), 0);
  const justes = du.reduce((t, s) => t + (s.justes ?? 0), 0);
  return { total, justes, taux: total ? justes / total : null };
}

/**
 * Le mot du prof : des phrases directes, variées d'un jour à l'autre, qui disent ce qui s'est
 * passé, ce qu'on fait aujourd'hui et pourquoi, et donnent un conseil concret.
 * @param {object} decision  resultat de decisionDuJour
 * @param {number} minutesEssentiel  durée estimée de l'essentiel
 */
export function motDuProf(d, date, decision, minutesEssentiel, objectifMinutes, nbEssentiel = 3) {
  const phrases = [];
  const absence = joursAbsence(d, date);
  const v = (cle, liste) => variante(date, cle, liste);
  if (absence === null) phrases.push('Bienvenue ! Je vous propose chaque jour une séance : d\'abord l\'essentiel pour progresser, puis un bonus pour le plaisir.');
  else {
    const veille = d.sessions.filter((s) => s.date < date);
    const derniereDate = veille.at(-1)?.date;
    const du = veille.filter((s) => s.date === derniereDate);
    const total = du.reduce((t, s) => t + (s.total ?? 0), 0);
    const justes = du.reduce((t, s) => t + (s.justes ?? 0), 0);
    const quand = absence === 1 ? 'Hier' : `Il y a ${absence} jours`;
    if (total) {
      const pct = Math.round((100 * justes) / total);
      const commentaire = justes / total < 0.85
        ? v('trop', [' Trop d\'erreurs : on ralentit, la justesse d\'abord.', ' C\'était un peu brouillon : aujourd\'hui, on vise juste avant de viser vite.', ' Beaucoup d\'erreurs : prenez le temps de bien poser chaque geste.'])
        : justes / total >= 0.97 ? v('bien', [' Très propre.', ' Presque sans faute : bravo.', ' Une séance nette.']) : '';
      phrases.push(`${quand} : ${total} exercice${total > 1 ? 's' : ''}, ${pct} % de justes.${commentaire}`);
    }
    if (absence >= 3 && absence < 30) phrases.push(v('retour', ['Content de vous revoir : on reprend en douceur.', 'Une pause de quelques jours, ce n\'est rien : les gestes reviennent vite.']));
  }
  // Ce qui s'est déjà passé AUJOURD'HUI : la séance s'adapte.
  const j = bilanDuJour(d, date);
  if (j.total >= 10) {
    const pct = Math.round(j.taux * 100);
    if (j.taux < 0.8) phrases.push(`Aujourd'hui pour l'instant : ${pct} % de justes sur ${j.total} exercices. ${v('ralentir', ['Ralentissez franchement : un geste juste et lent devient vite rapide, l\'inverse jamais.', 'Pause de 30 secondes, puis reprenez plus lentement, en lisant chaque ligne avant de poser.', 'Activez le rappel doigté (Options) le temps de retrouver des gestes sûrs.'])}`);
    else if (j.taux >= 0.95 && j.total >= 20) phrases.push(`Aujourd'hui : ${pct} % de justes sur ${j.total} exercices. ${v('accelerer', ['Vous pouvez vous autoriser à accélérer un peu.', 'Le geste est sûr : essayez de gagner du temps sur la lecture de la ligne suivante.'])}`);
    else phrases.push(`Aujourd'hui : ${j.total} exercices, ${pct} % de justes. ${v('continuer', ['On continue sur ce rythme.', 'Bonne régularité, gardez-la.'])}`);
  }
  phrases.push(decision.raison);
  const g = examenDeLaSemaine(d);
  if (g) {
    // Le rendez-vous de la semaine, sans échéance ni pression : un échec est normal.
    const r = resultatSemaine(d, date);
    // « L'examen de la semaine » ou « Le 15e kyū prép. » : l'article suit le nom.
    const hebdo = g.id === 'hebdo';
    const Le = hebdo ? 'L\'examen de la semaine' : `Le ${g.nom}`;
    const le = hebdo ? 'l\'examen de la semaine' : `le ${g.nom}`;
    const du = hebdo ? 'de l\'examen de la semaine' : `du ${g.nom}`;
    const obtenu = g.id !== 'hebdo' && d.records[`prekyu-${g.id}`]?.reussi;
    if (r?.reussi) phrases.push(`${g.nom} réussi cette semaine (${r.points} / ${r.total}) : bravo.`);
    else if (r) phrases.push(v('kyu-rate', [`Passage de kyū : ${r.points} / ${r.total} cette semaine, pas encore. C'est normal ; retentez quand vous voulez, après un peu d'entraînement.`,
      `${Le} n'est pas encore passé (${r.points} / ${r.total}) : regardez vos erreurs, et retentez un jour de forme. Rien ne presse.`]));
    else if (!obtenu) phrases.push(v('kyu', [`${Le} est ouvert : passez-le cette semaine, le jour où vous vous sentez en forme. Raté, il ne vous retire rien.`,
      `Quand vous voulez cette semaine : ${le}, pour voir où vous en êtes sous un peu de pression.`,
      `Le passage ${du} vous attend, sans date limite : choisissez un moment calme.`]));
  } else if (!meilleurPrekyu(d)) {
    phrases.push('Le kyū prép. le plus simple (20e) s\'ouvrira dès que les gestes directs seront validés.');
  }
  const o = d.reglages?.objectifGrade;
  if (o) {
    const p = planObjectif(d, o.grade, o.date, date);
    if (p && !p.reussi && p.jours > 0) {
      const dateR = new Date(`${p.dateRealiste}T12:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (p.verdict === 'realiste') phrases.push(`Objectif ${p.grade.nom} : vous êtes dans les temps, tenez le rythme.`);
      else if (p.verdict === 'ambitieux') phrases.push(`Objectif ${p.grade.nom} : c'est serré, il faudrait environ ${p.minutesJour} min par jour (date réaliste : ${dateR}).`);
      else phrases.push(`Objectif ${p.grade.nom} : soyons honnêtes, la date n'est pas réaliste (visez plutôt ${dateR}${p.atteignable ? ` ; d'ici là, le ${p.atteignable.nom} est atteignable` : ''}).`);
    }
  }
  // Le nombre de points conseillés suit le contenu réel de l'essentiel.
  const premiers = nbEssentiel >= 3 ? 'les trois premiers points' : nbEssentiel === 2 ? 'les deux premiers points' : 'le premier point';
  if (minutesEssentiel > objectifMinutes && nbEssentiel > 1) phrases.push(`L'essentiel prend environ ${minutesEssentiel} min (objectif du jour : ${objectifMinutes}). Si le temps manque, faites au moins ${premiers}.`);
  // Un conseil concret, différent chaque jour.
  phrases.push(`Le conseil du jour : ${v('conseil', GENERAUX)}`);
  return phrases;
}
