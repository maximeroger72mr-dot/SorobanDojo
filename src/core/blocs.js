/**
 * Les exercices des blocs « automatiser » (leçon validée restée en argent) et « volume /
 * vitesse » de la séance du jour.
 *
 * Quatre genres, sur le geste du jour (G) et sur un mélange (M : les dernières leçons et les
 * gestes faibles) :
 *  - volume isolé   : marathon sur G, planche « G » (le geste, des directs, un piège) ;
 *  - volume mélangé : planche « G parmi sa famille », planche d'ancrage, marathon mélangé ;
 *  - vitesse isolée : lièvre qui accélère sur G (ou le remède du plateau) ;
 *  - vitesse mélangée : lièvre mélangé, planche courte et rapide.
 * Avoir un bon CPM sur le geste seul est une chose ; le refaire au milieu d'autres gestes en
 * est une autre : chaque bloc mêle donc isolé ET mélangé.
 *
 * Pour ne jamais refaire exactement les mêmes exercices, chaque genre choisit, parmi ses
 * variantes, celle faite il y a le plus longtemps (stable sur la journée).
 * Fonctions pures.
 */

import { nomMotif } from './motifs.js';
import { evaluer } from './maitrise.js';
import { libellesModes, gesteTravaillable } from './colonneGeste.js';
import { minutesPlanche, secondesParChiffre, formatsPlanche, colonnesPour, dureePlanche, CHIFFRES_GESTE_MAX } from './propositions.js';
import { chiffresAppris, ancrageDuJour, plateaux, SURCHARGE, estValide } from './parcours.js';

const avant = (d, date) => d.sessions.filter((s) => s.date < date);
const du = (d, date) => d.sessions.filter((s) => s.date === date);

/** Le geste le plus lent (ou le plus fragile) d'une liste : le geste du jour. */
export function gesteDuJour(d, cibles, difficiles = []) {
  const amis = cibles.filter((c) => !c.endsWith(':direct'));
  if (!amis.length) return cibles[0] ?? null;
  const faible = difficiles.find((m) => amis.includes(m.cle));
  if (faible) return faible.cle;
  // Le plus lent parmi les gestes MESURÉS ; sans mesure, le premier de la leçon.
  const t = (c) => { const e = evaluer(d.motifs?.[c]?.hist ?? []); return e.essais >= 8 && e.temps != null ? e.temps : -1; };
  return [...amis].sort((a, b) => t(b) - t(a))[0];
}

/** Volume ou vitesse : une séance sur deux (au fil des jours pratiqués, pas du calendrier). */
export function jourVitesse(d, date) {
  return new Set(avant(d, date).map((s) => s.date)).size % 2 === 1;
}

const lignesMarathon = (d, minutes) => Math.max(20, Math.min(60, Math.round((minutes * 60) / (secondesParChiffre(d) * 1.3) / 5) * 5));

/**
 * Toutes les variantes d'un genre, prêtes à lancer, avec de quoi savoir si elles ont été faites.
 * @param {{ g: string|null, mix: string[], format: object, chiffresAncrage: number, plateau: object|null }} c
 */
function variantes(d, genre, c) {
  const { g, mix, format } = c;
  const nom = g ? nomMotif(g) : null;
  // Format d'examen du grade visé (planches sur un geste : 4 chiffres au plus) ; la durée est
  // celle d'une planche de la séance (8 minutes au plus), le nombre de colonnes s'y adapte.
  // `detail` reçoit le nombre de colonnes réellement proposé.
  const geste = { chiffres: Math.min(format.vise.chiffres, CHIFFRES_GESTE_MAX), lignes: format.vise.lignes };
  const planche = (id, titre, detail, p0, pourquoi) => {
    const p1 = { ...p0 };
    const p = { ...p1, colonnes: colonnesPour(d, p1, Math.min(8, dureePlanche(d))) };
    return { id, titre, detail: detail(p.colonnes), pourquoi, minutes: minutesPlanche(d, p),
      aller: ['planches', { ...p, proposition: id, auto: true }], fait: (s) => s.module === 'planches' && s.reglages?.proposition === id };
  };
  const rythme = (id, jeu, cibles, titre, detail, p, minutes, pourquoi) => ({ id, titre, detail, pourquoi, minutes,
    aller: ['rythme', { jeu, cibles, auto: true, ...p }], fait: (s) => s.module === 'rythme' && s.mode === (p.surcharge ? 'surcharge' : jeu) && (s.reglages?.cibles ?? []).includes(cibles[0]) && (cibles.length > 1) === ((s.reglages?.cibles ?? []).length > 1) });
  const v = [];
  if (genre === 'volume-isole' && g) {
    const lignes = lignesMarathon(d, 4);
    v.push(rythme(`marathon:${g}`, 'marathon', [g], `Volume · ${nom}`, `${lignes} lignes de marathon sur ${nom}, sans remettre à zéro`, { lignes }, 4, 'Le volume sur un seul geste installe le mouvement jusqu\'au réflexe.'));
    if (c.planches && gesteTravaillable(g)) v.push(planche(`bloc-seul:${g}`, `Planche · ${libellesModes(g).seul}`, (n) => `${n} colonnes : le geste 2 fois par colonne, des gestes directs et un piège`, { cible: g, mode: 'seul', ...geste }, 'Le geste répété, mais jamais à l\'aveugle : le piège oblige à regarder la tige.'));
  }
  if (genre === 'volume-melange') {
    if (c.planches && g && gesteTravaillable(g)) v.push(planche(`bloc-famille:${g}`, `Planche · ${libellesModes(g).famille}`, (n) => `${n} colonnes : ${nom} au milieu de ses voisins, il faut choisir le bon geste à chaque ligne`, { cible: g, mode: 'famille', ...geste }, 'Bien faire le geste seul ne suffit pas : il faut le refaire au milieu des autres.'));
    if (c.planches) v.push({ id: 'ancrage', titre: 'Planche mélangée · ancrage', detail: 'vos dernières leçons et vos gestes faibles, mélangés (10 colonnes)', minutes: Math.min(8, minutesPlanche(d, { colonnes: 10, lignes: 5, chiffres: c.chiffresAncrage })),
      pourquoi: 'Mélangé, le geste doit être CHOISI, comme dans un vrai calcul : c\'est ce qui le rend durable.',
      aller: ['planches', { ancrage: true, auto: true }], fait: (s) => s.module === 'planches' && s.mode === 'ancrage' });
    if (mix.length > 1) {
      const lignes = lignesMarathon(d, 4);
      v.push(rythme('marathon-mix', 'marathon', mix, 'Volume mélangé · marathon', `${lignes} lignes qui mélangent vos derniers gestes`, { lignes }, 4, 'De longues séries mélangées : la main enchaîne sans se poser la question.'));
    }
  }
  if (genre === 'vitesse-isole' && g) {
    const p = c.plateau;
    if (p && p.type === 'geste' && p.cle === g) {
      const cadence = Math.max(0.5, Math.round((Math.min(p.avant, p.maintenant) / SURCHARGE) * 100) / 100);
      v.push(rythme(`surcharge:${g}`, 'lievre', [g], `Vitesse · sprint de surcharge sur ${nom}`, `20 s à ${Math.round(SURCHARGE * 100)} % de votre meilleur rythme : ${nom} stagne, on force la cadence`, { surcharge: cadence }, 2, 'Habituer la main à une vitesse qu\'elle ne connaît pas casse le plateau.'));
    }
    v.push(rythme(`lievre:${g}`, 'lievre', [g], `Vitesse · ${nom}`, `le lièvre accélère tant que vous tenez, colonnes à 1 chiffre`, { chiffres: 1, accelere: true }, 3, 'Moins de chiffres, plus vite : le geste doit partir sans réfléchir.'));
  }
  if (genre === 'vitesse-melange') {
    if (mix.length) v.push(rythme('lievre-mix', 'lievre', mix, 'Vitesse mélangée · lièvre', 'le lièvre accélère sur vos derniers gestes mélangés', { chiffres: 1, accelere: true }, 3, 'La vitesse qui compte est celle qu\'on garde au milieu des autres gestes.'));
    const k = format.court;
    if (c.planches) v.push(planche('bloc-rapide', 'Vitesse mélangée · planche courte', (n) => `${n} colonnes courtes de ${k.lignes} lignes à ${k.chiffres} chiffre${k.chiffres > 1 ? 's' : ''}, le plus vite possible sans erreur`, { cible: 'appris', chiffres: k.chiffres, lignes: k.lignes }, 'Des colonnes courtes laissent toute la place à la cadence.'));
  }
  return v;
}

/** Parmi les variantes, celle faite il y a le plus longtemps (jamais faite : en premier). */
function moinsRecente(d, date, liste) {
  const passees = avant(d, date);
  const derniere = (x) => { for (let i = passees.length - 1; i >= 0; i--) if (x.fait(passees[i])) return passees[i].date; return ''; };
  return [...liste].sort((a, b) => (derniere(a) < derniere(b) ? -1 : derniere(a) > derniere(b) ? 1 : 0));
}

/** Exercices sur le geste seul, au plus, dans une séance. */
export const MAX_ISOLES = 2;

/**
 * Exercices du jour pour un bloc : une suite de genres (ex. isolé puis mélangé), chacun dans sa
 * variante la moins récente ; on remplit jusqu'à `minutes`, sans répéter une variante.
 * @param {string[]} genres  ordre des genres à alterner
 * @returns {Array<{ id, titre, detail, minutes, aller, fait: boolean, pourquoi, genre }>}
 */
export function exercicesBloc(d, date, { genres, cibles, difficiles = [], minutes, exclure = [], isolesDeja = 0, geste = null }) {
  // `geste` : geste du jour FIGÉ au début de la séance (sinon, une fois travaillé, un autre geste
  // devient « le plus lent » et de nouveaux exercices apparaissent sans fin).
  const g = geste && cibles.includes(geste) ? geste : gesteDuJour(d, cibles, difficiles);
  const a = ancrageDuJour(d);
  const mix = [...new Set([...(a?.cibles ?? []), ...difficiles.map((m) => m.cle)])].filter((x) => !x.endsWith(':direct'));
  // Sans « ami » appris (étape des gestes directs) : le mélange se fait sur les gestes directs.
  const amis = cibles.filter((x) => !x.endsWith(':direct'));
  // Les planches s'ouvrent avec « Le 5 et la pincée » ; avant, le bloc se fait au marathon et au lièvre.
  const ctx = { g, mix: mix.length ? mix : amis.length ? amis : cibles, planches: estValide(d, 'p1-3') || !!d.reglages?.decouverte, format: formatsPlanche(d), chiffresAncrage: Math.min(3, chiffresAppris(d)), plateau: plateaux(d, date)[0] ?? null };
  const aujourdhui = du(d, date);
  const pris = new Set(exclure);
  const parGenre = Object.fromEntries([...new Set(genres)].map((x) => [x, moinsRecente(d, date, variantes(d, x, ctx))]));
  const res = [];
  let total = 0;
  // On remplit en alternant les genres ; une variante doit tenir dans le temps restant (une
  // minute de marge), sauf la toute première, pour ne jamais laisser le bloc vide.
  // Deux exercices AU PLUS sur le geste seul (bloc « automatiser » compris) : au-delà, on passe
  // obligatoirement au mélangé, pour apprendre à reconnaître le geste parmi les autres.
  let isoles = isolesDeja;
  let avance = true;
  while (avance && total < minutes - 1) {
    avance = false;
    for (const genre of genres) {
      const reste = minutes - total;
      if (reste < 2 && res.length) break;
      if (genre.endsWith('-isole') && isoles >= MAX_ISOLES) continue;
      const libres = parGenre[genre].filter((y) => !pris.has(y.id));
      const x = libres.find((y) => y.minutes <= reste + 1) ?? (res.length ? null : libres[0]);
      if (!x) continue;
      if (genre.endsWith('-isole')) isoles += 1;
      pris.add(x.id);
      res.push({ id: x.id, titre: x.titre, detail: x.detail, minutes: x.minutes, aller: x.aller, fait: aujourdhui.some(x.fait), pourquoi: x.pourquoi, genre });
      total += x.minutes;
      avance = true;
    }
  }
  return res;
}
