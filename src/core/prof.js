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
import { evaluer, NIVEAUX, mediane } from './maitrise.js';
import { famillesApprises, planObjectif, gestesLents, defiSemaine, anzanAdapte } from './parcours.js';
import { nomMotif } from './motifs.js';
import { examenDeLaSemaine, resultatSemaine, meilleurPrekyu } from './examen.js';
import { GENERAUX, conseilsVitesse } from './conseils.js';

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

/**
 * Jours de pratique d'automatisation, au plus, avant d'ouvrir la leçon suivante malgré tout :
 * une leçon validée mais restée en argent (acquis débutant) s'automatise d'abord ; au-delà, on
 * avance quand même (le geste est entré, la vitesse viendra en route).
 */
export const JOURS_AUTOMATISATION_MAX = 10;
export const JOURS_ANCRAGE_MAX = JOURS_AUTOMATISATION_MAX;

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

/** Gestes d'une leçon de colonnes (sans les gestes directs, sauf s'il n'y a qu'eux). */
export function gestesLecon(sp) {
  if (!sp || (sp.type ?? 'addsub') !== 'addsub') return [];
  const amis = (sp.cibles ?? []).filter((c) => !c.endsWith(':direct'));
  return amis.length ? amis : (sp.cibles ?? []);
}

/** Exercice d'automatisation d'une leçon : marathon sur ses gestes, ou entraînement de la leçon. */
function ancrage(sp) {
  return sp.type === 'addsub'
    ? { aller: ['rythme', { jeu: 'marathon', cibles: sp.cibles, lignes: 30, auto: true }], detail: `30 lignes de marathon sur les gestes de « ${sp.titre} »`, cibles: sp.cibles }
    : { aller: ['lecons', { sousPalier: sp.id, onglet: 'entrainement' }], detail: `entraînement de « ${sp.titre} »` };
}

/**
 * Avancer ou automatiser ?
 *  - une leçon commencée se termine (on peut n'en faire qu'une partie par jour) ;
 *  - la dernière leçon validée doit être en OR (acquis confirmé) pour ouvrir la suivante :
 *    tant qu'elle est en argent, on l'AUTOMATISE (volume, vitesse, mélangé) ; au-delà de
 *    JOURS_AUTOMATISATION_MAX jours de pratique, on avance quand même ;
 *  - après 3 jours d'absence, on reprend en douceur.
 * @param {object|null} prochain  prochain sous-palier du parcours soroban (lecons.prochainSousPalier)
 * @returns {{ type: 'lecon'|'automatiser'|'revision', titre, detail, raison, aller, minutes, sp?, cibles? }}
 */
export function decisionDuJour(d, date, prochain) {
  const absence = joursAbsence(d, date);
  const derniere = derniereLecon(d);
  if (prochain && (d.paliers[prochain.id]?.reps ?? 0) > 0) {
    return { type: 'lecon', titre: 'Leçon', detail: prochain.titre, raison: `Vous avez commencé « ${prochain.titre} » : on la continue.`, aller: ['lecons', { sousPalier: prochain.id }], minutes: 15, sp: prochain };
  }
  if (derniere && absence !== null && absence >= 3) {
    const a = ancrage(derniere);
    return { type: 'automatiser', titre: 'Reprise en douceur', ...a, raison: `${absence} jours sans soroban : pas de nouvelle leçon aujourd'hui, on réveille les gestes de « ${derniere.titre} ».`, minutes: 10, sp: derniere, reprise: true };
  }
  if (derniere && prochain) {
    const ev = niveauLecon(d, derniere);
    const jours = joursDepuisDerniereLecon(d, date);
    // Sous l'argent : on ne peut pas avancer (la leçon n'est pas vraiment acquise).
    const bloque = ev.essais >= 8 && ev.index < 2;
    if (ev.essais >= 8 && ev.index < 3 && (bloque || jours < JOURS_AUTOMATISATION_MAX)) {
      const a = ancrage(derniere);
      const reste = JOURS_AUTOMATISATION_MAX - jours;
      const niveau = bloque ? 'pas encore en argent' : 'en argent';
      return { type: 'automatiser', titre: 'Automatiser', ...a, sp: derniere, minutes: 10,
        detail: `« ${derniere.titre} »`,
        raison: `« ${derniere.titre} » est validée mais ${niveau} : on l'automatise avant d'empiler. ${bloque ? 'La leçon suivante attend l\'argent.' : `La leçon suivante s'ouvre dès l'or, et au plus tard dans ${reste} jour${reste > 1 ? 's' : ''} de pratique.`}` };
    }
  }
  if (prochain) {
    return { type: 'lecon', titre: 'Nouvelle leçon', detail: prochain.titre, raison: derniere ? `« ${derniere.titre} » est en or : on avance.` : 'On commence le parcours.', aller: ['lecons', { sousPalier: prochain.id }], minutes: 15, sp: prochain };
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
 * Le mot du prof : peu de phrases, mais qui apportent quelque chose.
 *  1. le thème du jour (ce qu'on vient faire, en une phrase) ;
 *  2. ce qui s'est passé (hier, ou déjà aujourd'hui), seulement quand c'est parlant ;
 *  3. un ou deux CONSTATS tirés des données, qui changent d'un jour à l'autre : l'écart de
 *     vitesse qui freine, un progrès mesuré, la distance à l'or, l'erreur qui revient, la
 *     régularité, l'anzan ;
 *  4. un conseil de technique lié au geste du jour ;
 *  5. l'examen blanc (vendredi à dimanche) et l'objectif daté, quand c'est utile.
 * @param {object} decision  resultat de decisionDuJour
 * @param {{ theme?: string, difficiles?: object[], vitesse?: boolean }} o
 */
export function motDuProf(d, date, decision, o = {}) {
  const { theme = null, difficiles = [] } = typeof o === 'object' && o ? o : {};
  const phrases = [];
  const absence = joursAbsence(d, date);
  const v = (cle, liste) => variante(date, cle, liste);
  if (theme) phrases.push(theme);
  if (absence === null) phrases.push('Bienvenue ! Chaque jour, une séance à la durée de votre objectif : échauffement, révision, leçon, volume ou vitesse, anzan.');
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
        ? v('trop', [' Trop d\'erreurs : aujourd\'hui, la justesse d\'abord, la vitesse ensuite.', ' C\'était brouillon : lisez chaque ligne avant de poser les doigts.', ' Beaucoup d\'erreurs : ralentissez franchement, un geste juste et lent devient vite rapide.'])
        : justes / total >= 0.97 ? v('bien', [' Très propre : vous pouvez pousser la vitesse.', ' Presque sans faute : bravo.', ' Une séance nette.']) : '';
      phrases.push(`${quand} : ${total} exercice${total > 1 ? 's' : ''}, ${pct} % de justes.${commentaire}`);
    }
    if (absence >= 3 && absence < 30) phrases.push(v('retour', ['Content de vous revoir : on reprend en douceur.', 'Une pause de quelques jours, ce n\'est rien : les gestes reviennent vite.']));
  }
  // Ce qui s'est déjà passé AUJOURD'HUI : la séance s'adapte.
  const j = bilanDuJour(d, date);
  if (j.total >= 10) {
    const pct = Math.round(j.taux * 100);
    if (j.taux < 0.8) phrases.push(`Aujourd'hui pour l'instant : ${pct} % de justes sur ${j.total} exercices. ${v('ralentir', ['Ralentissez : un geste juste et lent devient vite rapide, l\'inverse jamais.', 'Pause de 30 secondes, puis reprenez en lisant chaque ligne avant de poser.', 'Activez le rappel doigté (Options) le temps de retrouver des gestes sûrs.'])}`);
    else if (j.taux >= 0.95 && j.total >= 20) phrases.push(`Aujourd'hui : ${pct} % de justes sur ${j.total} exercices. ${v('accelerer', ['Vous pouvez vous autoriser à accélérer.', 'Le geste est sûr : gagnez du temps en lisant la ligne suivante pendant que la main finit.'])}`);
  }
  if (decision.type !== 'lecon' || !theme) phrases.push(decision.raison);

  // Les constats : la distance à l'or d'abord (quand on automatise), puis un ou deux autres.
  const constats = constatsDuJour(d, date, decision, difficiles);
  const premiers = constats.filter((c) => c.prioritaire);
  const autres = constats.filter((c) => !c.prioritaire);
  let decal = 0;
  for (const c of `${date}`) decal = (decal * 31 + c.charCodeAt(0)) >>> 0;
  const choisis = [...premiers, ...autres.map((_, i) => autres[(i + decal) % autres.length])].slice(0, premiers.length ? 2 : 2);
  phrases.push(...choisis.map((c) => c.texte));

  // Un conseil de technique, lié au geste ou à la leçon du jour.
  const sp = decision.sp;
  const lies = sp ? conseilsVitesse(sp) : [];
  phrases.push(`Le conseil du jour : ${v('conseil', lies.length ? lies : GENERAUX)}`);

  // L'examen blanc : du vendredi au dimanche, sans pression.
  const g = examenDeLaSemaine(d);
  const jourSemaine = new Date(`${date}T12:00`).getDay();
  if (g) {
    const r = resultatSemaine(d, date);
    if (r?.reussi) phrases.push(`${g.nom} réussi cette semaine (${r.points} / ${r.total}) : bravo.`);
    else if (r) phrases.push(`Examen blanc : ${r.points} / ${r.total} cette semaine. Regardez vos erreurs : elles disent quoi travailler la semaine prochaine.`);
    else if ([5, 6, 0].includes(jourSemaine)) phrases.push(v('kyu', [`L'examen blanc (${g.nom}) est ouvert jusqu'à dimanche : chronométré, sans aide. Raté, il ne vous retire rien.`,
      `Ce week-end, l'examen blanc remplace la leçon : ${g.nom}, en conditions réelles.`]));
  } else if (!meilleurPrekyu(d)) {
    phrases.push('Le premier examen blanc (20e kyū prép.) s\'ouvrira dès que les gestes directs seront validés.');
  }
  const ob = d.reglages?.objectifGrade;
  if (ob) {
    const p = planObjectif(d, ob.grade, ob.date, date);
    if (p && !p.reussi && p.jours > 0 && (p.verdict !== 'realiste' || jourSemaine === 1)) {
      const dateR = new Date(`${p.dateRealiste}T12:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (p.verdict === 'realiste') phrases.push(`Objectif ${p.grade.nom} : vous êtes dans les temps, tenez le rythme.`);
      else if (p.verdict === 'ambitieux') phrases.push(`Objectif ${p.grade.nom} : c'est serré, il faudrait environ ${p.minutesJour} min par jour (date réaliste : ${dateR}).`);
      else phrases.push(`Objectif ${p.grade.nom} : soyons honnêtes, la date n'est pas réaliste (visez plutôt ${dateR}${p.atteignable ? ` ; d'ici là, le ${p.atteignable.nom} est atteignable` : ''}).`);
    }
  }
  return phrases;
}

const cpmDe = (t) => Math.round(60 / t);

/** Ce que disent les données, en phrases concrètes (chacune avec ce qu'on en fait). */
export function constatsDuJour(d, date, decision, difficiles = []) {
  const res = [];
  const motifs = d.motifs ?? {};
  const ev = (c) => evaluer(motifs[c]?.hist ?? []);
  // Distance à l'or de la leçon qu'on automatise.
  if (decision.type === 'automatiser' && decision.sp && !decision.reprise) {
    const n = niveauLecon(d, decision.sp);
    const or = NIVEAUX[3];
    const fam = familleLecon(decision.sp);
    if (n.temps != null) {
      const manque = [];
      if (n.reussite < or.reussite) manque.push(`${Math.round(n.reussite * 100)} % de justes au lieu de ${Math.round(or.reussite * 100)} %`);
      if (n.temps > or.temps[fam]) manque.push(fam === 'addsub' ? `${cpmDe(n.temps)} CPM au lieu de ${cpmDe(or.temps.addsub)}` : `${nf(n.temps)} s au lieu de ${nf(or.temps[fam])} s`);
      if (manque.length) res.push({ prioritaire: true, texte: `Pour l'or sur « ${decision.sp.titre} » : ${manque.join(', et ')}. Les exercices du jour visent exactement ça.` });
    }
  }
  // L'écart de vitesse qui freine : le geste le plus lent face aux gestes directs.
  const lents = gestesLents(d, 1);
  const directs = Object.keys(motifs).filter((c) => c.endsWith(':direct')).map((c) => ev(c)).filter((e) => e.temps != null && e.essais >= 8).map((e) => e.temps).sort((a, b) => a - b);
  if (lents[0] && directs.length) {
    const tDirect = directs[Math.floor(directs.length / 2)];
    const ratio = lents[0].ev.temps / tDirect;
    if (ratio >= 1.4) res.push({ texte: `${nomMotif(lents[0].cle)} tourne à ${cpmDe(lents[0].ev.temps)} CPM, vos gestes directs à ${cpmDe(tDirect)} : c'est là que vos colonnes ralentissent. ${ratio >= 2 ? 'Au moins deux fois plus lent : il se cherche encore, il faut du volume.' : 'L\'écart se réduit avec le volume et la vitesse mélangée.'}` });
  }
  // Un progrès mesuré (semaine récente contre 2 à 3 semaines avant).
  const lundiDe = (x) => { const t = new Date(`${x}T12:00`); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t; };
  let meilleur = null;
  for (const [c, f] of Object.entries(motifs)) {
    const sem = Object.entries(f.sem ?? {}).filter(([, ts]) => ts.length >= 10).sort(([a], [b]) => (a < b ? 1 : -1));
    if (sem.length < 2) continue;
    const recent = sem[0];
    if ((lundiDe(date) - new Date(`${recent[0]}T12:00`)) / 86400000 > 7) continue;
    const ref = sem.find(([k]) => { const e = (new Date(`${recent[0]}T12:00`) - new Date(`${k}T12:00`)) / (7 * 86400000); return e >= 2 && e <= 4; });
    if (!ref) continue;
    const mAv = mediane(ref[1]);
    const mAp = mediane(recent[1]);
    const gain = mAv / mAp - 1;
    if (gain >= 0.1 && (!meilleur || gain > meilleur.gain)) meilleur = { c, gain, avant: mAv, apres: mAp };
  }
  if (meilleur) res.push({ texte: `${nomMotif(meilleur.c)} est passé de ${cpmDe(meilleur.avant)} à ${cpmDe(meilleur.apres)} CPM en quelques semaines (+${Math.round(meilleur.gain * 100)} %) : le volume paie, continuez.` });
  // L'erreur qui revient, avec une explication du geste.
  const faible = difficiles.find((m) => !m.cle.endsWith(':direct'));
  if (faible) {
    const r = faible.cle.split(':')[1];
    const pourquoi = { petit: 'souvent, on lance l\'ami alors que le geste direct suffisait, ou l\'inverse : regardez si la boule du 5 est libre avant d\'agir', grand: 'souvent, la retenue sur la tige de gauche est oubliée : posez-la AVANT de retirer le complément', mixte: 'c\'est un geste en trois temps : dites-le dans votre tête (« +10, −5, +… ») les premières fois' }[r] ?? 'reprenez-le lentement, avec le rappel doigté';
    res.push({ texte: `${nomMotif(faible.cle)} : ${faible.erreurs} erreur${faible.erreurs > 1 ? 's' : ''} récente${faible.erreurs > 1 ? 's' : ''} ; ${pourquoi}.` });
  }
  // La régularité, sur 14 jours.
  const jours = new Set(d.sessions.map((s) => s.date).filter((x) => x < date && (new Date(`${date}T12:00`) - new Date(`${x}T12:00`)) / 86400000 <= 14)).size;
  if (jours >= 10) res.push({ texte: `${jours} jours de pratique sur les 14 derniers : c'est cette régularité qui fait les automatismes.` });
  else if (jours >= 2 && jours <= 5) res.push({ texte: `${jours} jours de pratique sur les 14 derniers : un peu chaque jour fixe mieux les gestes qu'une longue séance de temps en temps.` });
  // L'anzan : où on en est, et la marche suivante.
  if (d.sessions.some((s) => s.module === 'anzan')) {
    const a = anzanAdapte(d);
    res.push({ texte: `Anzan : ${a.termes} nombres à ${a.chiffres} chiffre${a.chiffres > 1 ? 's' : ''}, ${nf(a.duree)} s par nombre. ${a.raison[0].toUpperCase()}${a.raison.slice(1)}.` });
  }
  return res;
}
