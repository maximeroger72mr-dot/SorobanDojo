/**
 * Le prof : décide, chaque jour, ce qui fait progresser, et le dit franchement.
 *
 *  - decisionDuJour : avancer (nouvelle leçon) ou ancrer (drill sur la dernière leçon). On
 *    n'avance que si la dernière leçon est acquise (juste ET rapide, seuil « débutant ») ;
 *    après 3 jours d'absence, on reprend en ancrant ; une leçon commencée se termine.
 *  - jeuDuJour : le jeu « bonus » du jour, qui change chaque jour parmi ceux qui ont du sens
 *    au niveau atteint.
 *  - motDuProf : 3 ou 4 phrases : ce qui s'est passé, la décision du jour et pourquoi,
 *    l'examen de la semaine, l'objectif.
 *
 * Fonctions pures : elles reçoivent les données de progression (et le prochain sous-palier).
 */

import { SOUS_PALIERS, familleLecon } from './curriculum.js';
import { evaluer } from './maitrise.js';
import { famillesApprises, planObjectif } from './parcours.js';
import { examenDeLaSemaine, resultatSemaine, joursRestants, meilleurPrekyu } from './examen.js';

const jour = (x) => new Date(`${x}T12:00`).getTime();
const ecartJours = (a, b) => Math.round((jour(b) - jour(a)) / 86400000);
const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Jours depuis la dernière séance (null : jamais pratiqué). */
export function joursAbsence(d, date) {
  const dates = d.sessions.map((s) => s.date).filter((x) => x < date).sort();
  return dates.length ? ecartJours(dates.at(-1), date) : null;
}

/** Dernière leçon du parcours soroban validée (la plus récente). */
export function derniereLecon(d) {
  return SOUS_PALIERS.filter((sp) => !sp.mental && sp.type !== 'theorie' && sp.type !== 'placement' && d.paliers[sp.id]?.valide)
    .sort((a, b) => (d.paliers[a.id].valide < d.paliers[b.id].valide ? -1 : d.paliers[a.id].valide > d.paliers[b.id].valide ? 1 : a.ordre - b.ordre))
    .at(-1) ?? null;
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
    const ev = evaluer(d.paliers[derniere.id].hist ?? [], familleLecon(derniere));
    if (ev.essais >= 8 && ev.index < 2) {
      const a = ancrage(derniere);
      return { type: 'ancrage', titre: 'Ancrage', ...a, raison: `Pas de nouvelle leçon aujourd'hui : « ${derniere.titre} » n'est pas encore acquise (${ev.manque.join(', ')}). Mieux vaut drill qu'empiler.`, minutes: 10, sp: derniere };
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
    { titre: 'Complément éclair', detail: f.has('grand') ? 'compléments à 10 en 60 s' : 'compléments à 5 en 60 s', aller: ['jeux', { jeu: 'complement' }], mode: 'complement' },
    d.paliers['p1-4']?.valide && { titre: 'Chasse à l\'erreur', detail: '10 colonnes : trouvez le sous-total faux', aller: ['jeux', { jeu: 'chasse' }], mode: 'chasse' },
    d.paliers['p1-a']?.valide && { titre: 'Survie anzan', detail: 'la chaîne de tête la plus longue possible', aller: ['jeux', { jeu: 'survie' }], mode: 'survie' },
    f.has('petit') && { titre: 'Contre-la-montre arcade', detail: 'tenir le plus longtemps possible', aller: ['defis', {}], mode: 'arcade' },
    f.has('grand') && { titre: 'Échelle des kyū', detail: '10 marches, du facile au boss', aller: ['defis', {}], mode: 'echelle' },
  ].filter(Boolean);
  return jeux[Math.floor(jour(date) / 86400000) % jeux.length];
}

/**
 * Le mot du prof : quelques phrases directes.
 * @param {object} decision  resultat de decisionDuJour
 * @param {number} minutesEssentiel  durée estimée de l'essentiel
 */
export function motDuProf(d, date, decision, minutesEssentiel, objectifMinutes) {
  const phrases = [];
  const absence = joursAbsence(d, date);
  if (absence === null) phrases.push('Bienvenue ! Je vous propose chaque jour une séance : d\'abord l\'essentiel pour progresser, puis un bonus pour le plaisir.');
  else {
    const veille = d.sessions.filter((s) => s.date < date);
    const derniereDate = veille.at(-1)?.date;
    const du = veille.filter((s) => s.date === derniereDate);
    const total = du.reduce((t, s) => t + (s.total ?? 0), 0);
    const justes = du.reduce((t, s) => t + (s.justes ?? 0), 0);
    const quand = absence === 1 ? 'Hier' : `Il y a ${absence} jours`;
    if (total) phrases.push(`${quand} : ${total} exercice${total > 1 ? 's' : ''}, ${Math.round((100 * justes) / total)} % de justes.${justes / total < 0.85 ? ' Trop d\'erreurs : on ralentit, la justesse d\'abord.' : ''}`);
  }
  phrases.push(decision.raison);
  const g = examenDeLaSemaine(d);
  if (g) {
    const r = resultatSemaine(d, date);
    const reste = joursRestants(date);
    if (r) phrases.push(r.reussi ? `${g.nom} réussi cette semaine (${r.points} / ${r.total}) : bravo.` : `Examen de la semaine : ${r.points} / ${r.total}, pas encore. On retravaille, et on retente la semaine prochaine.`);
    else phrases.push(reste <= 3 ? `Le ${g.nom} est à passer avant dimanche : c'est dans l'essentiel aujourd'hui.` : `Le ${g.nom} vous attend cette semaine (encore ${reste} jours) : passez-le un jour où vous êtes en forme.`);
  } else if (!meilleurPrekyu(d)) {
    phrases.push('Premier examen (20e kyū) dès que les gestes directs sont validés.');
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
  if (minutesEssentiel > objectifMinutes) phrases.push(`L'essentiel prend environ ${minutesEssentiel} min (objectif du jour : ${objectifMinutes}) : si le temps manque, faites au moins les trois premiers points.`);
  return phrases;
}
