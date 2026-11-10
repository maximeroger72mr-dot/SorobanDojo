/**
 * Drills classiques du soroban, à faire sur son propre soroban.
 *
 * Chaque drill est une suite d'opérations connue, avec des points de contrôle (sous-totaux)
 * pour vérifier où l'on en est. Ils entraînent l'enchaînement de TOUS les amis sans réfléchir :
 *  - le même chiffre ajouté en boucle passe par tous les cas de ce chiffre (direct, petit ami,
 *    grand ami, combiné) : c'est le meilleur exercice pour ancrer un chiffre précis ;
 *  - 1 + 2 + 3 + … : la somme des entiers (55, 210, 666, 5050) ;
 *  - 123456789 ajouté 9 fois = 1 111 111 101, précédé de ses variantes courtes
 *    (1, 12, 123, … ajoutés 9 fois) pour monter progressivement en longueur ;
 *  - l'aller-retour : on retire ensuite le même nombre jusqu'à revenir à 0.
 *
 * Avant les grands amis : répétitions qui restent sous 10, pendules (+4… −3… en alternance)
 * et le tour des petits amis, qui n'utilisent que gestes directs et petits amis.
 *
 * Les drills se suivent dans l'ordre du catalogue : il faut valider un drill (2 passages justes
 * sous le temps bronze) pour ouvrir le suivant ; argent, or et platine invitent à y revenir.
 *
 * Format : { id, titre, groupe, description, operations: [{op, n}], resultat }
 */

import { occurrencesColonne } from './generateur.js';
import { POIDS_GESTE } from './charge.js';

const repeter = (n, fois, op = '+') => Array.from({ length: fois }, () => ({ op, n }));
const somme = (ops) => ops.reduce((v, o) => (o.op === '+' ? v + o.n : v - o.n), 0);

function drill(id, titre, groupe, description, operations) {
  return { id, titre, groupe, description, operations, resultat: somme(operations) };
}

/** Le même nombre ajouté `fois` fois, puis éventuellement retiré autant de fois (aller-retour). */
export function drillRepetition(n, fois, allerRetour) {
  const ops = [...repeter(n, fois), ...(allerRetour ? repeter(n, fois, '-') : [])];
  return drill(`rep-${n}-${fois}-${allerRetour ? 'ar' : 'a'}`,
    `${n} ajouté ${fois} fois${allerRetour ? ', puis retiré ' + fois + ' fois' : ''}`,
    'Même nombre répété',
    `Ajouter ${n} en boucle fait passer chaque tige par tous les cas : geste direct, petit ami, grand ami et combinaisons. ${allerRetour ? 'Le retour à 0 entraîne les mêmes amis en soustraction.' : ''}`,
    ops);
}

/** 1 + 2 + … + n (et retour éventuel). */
export function drillSuite(n, allerRetour) {
  const aller = Array.from({ length: n }, (_, i) => ({ op: '+', n: i + 1 }));
  const retour = allerRetour ? Array.from({ length: n }, (_, i) => ({ op: '-', n: n - i })) : [];
  return drill(`suite-${n}-${allerRetour ? 'ar' : 'a'}`,
    `1 + 2 + … + ${n}${allerRetour ? ', puis retour à 0' : ''}`,
    'Avec les grands amis',
    'Chaque nombre suivant change de chiffre : toutes les situations se succèdent.',
    [...aller, ...retour]);
}

const neuf = (d) => Number(String(d).repeat(9));

/**
 * Pendule sur 9 tiges : +a… −b… en alternance (le soroban avance d'un cran par aller-retour)
 * jusqu'au bout, puis −a… +b… jusqu'à 0. Les petits amis tombent sans arrêt, sans grand ami.
 */
function operationsPendule(a, b) {
  const A = neuf(a);
  const B = neuf(b);
  const uniforme = (v) => { const t = String(v).padStart(9, '0'); return v >= 0 && t.length === 9 && [...t].every((x) => x === t[0]); };
  const ops = [];
  let v = 0;
  for (let i = 0; i < 40; i++) {
    const o = i % 2 === 0 ? { op: '+', n: A } : { op: '-', n: B };
    const w = o.op === '+' ? v + A : v - B;
    if (!uniforme(w)) break;
    ops.push(o);
    v = w;
  }
  for (let i = 0; i < 40 && v > 0; i++) {
    const o = i % 2 === 0 ? { op: '-', n: A } : { op: '+', n: B };
    const w = o.op === '-' ? v - A : v + B;
    if (!uniforme(w)) break;
    ops.push(o);
    v = w;
  }
  return ops;
}

/** Aller jusqu'à n × fois, puis retour à 0. */
const allerRetour = (n, fois) => [...repeter(n, fois), ...repeter(n, fois, '-')];

/** Familles d'amis qu'un drill demande (hors gestes directs) : 'petit', 'grand', 'mixte', 'cascade'. */
export function famillesDrill(d) {
  const fam = (c) => (c.startsWith('cascade') ? 'cascade' : c.split(':')[1]);
  return [...new Set(occurrencesColonne(d.operations).flat().map((o) => fam(o.cle)))].filter((f) => f !== 'direct');
}

/** Tiges utilisées par un drill (nombres et sous-totaux). */
export function tigesDrill(d) {
  let v = 0;
  let m = 1;
  for (const o of d.operations) { v = o.op === '+' ? v + o.n : v - o.n; m = Math.max(m, String(o.n).length, String(Math.abs(v)).length); }
  return m;
}
/** Gestes (clés de motifs) qu'un drill demande, gestes directs compris. */
export const clesDrill = (d) => [...new Set(occurrencesColonne(d.operations).flat().map((o) => o.cle))];

/** Nombre de chiffres traités (base du temps de validation). */
export const chiffresDrill = (d) => d.operations.reduce((t, o) => t + String(o.n).length, 0);

/**
 * Classement d'un drill, en secondes par GESTE pondéré. Un chiffre posé par un geste direct va
 * bien plus vite qu'un grand ami : compter des chiffres rendait l'or et le platine trop faciles
 * sur les drills de gestes directs. Bronze = validation (pas trop dur), puis argent, or et
 * platine (niveau d'un bon pratiquant de club) pour revenir s'améliorer. Il faut DEUX passages
 * justes sous le temps bronze pour valider un drill et ouvrir le suivant.
 */
export const CLASSEMENT = [
  { id: 'bronze', nom: 'Bronze', s: 1.6 },
  { id: 'argent', nom: 'Argent', s: 1.0 },
  { id: 'or', nom: 'Or', s: 0.55 },
  { id: 'platine', nom: 'Platine', s: 0.35 },
];
/** Poids d'un geste selon sa famille (un geste direct = 0,6 geste « petit ami »). */
export { POIDS_GESTE };
const memoPoids = new WeakMap();
/** Charge d'un drill : somme des gestes, pondérés par leur difficulté. */
export function poidsDrill(d) {
  if (!memoPoids.has(d)) {
    const famille = (cle) => (cle.startsWith('cascade') ? 'cascade' : cle.split(':')[1]);
    const w = occurrencesColonne(d.operations).flat().reduce((t, o) => t + (POIDS_GESTE[famille(o.cle)] ?? 1), 0);
    memoPoids.set(d, w);
  }
  return memoPoids.get(d);
}
/** Les tiges où le soroban diffère du résultat attendu (alignées à droite, sur les unités). */
export function tigesFausses(lu, attendu) {
  const a = String(Math.abs(lu));
  const b = String(Math.abs(attendu));
  const n = Math.max(a.length, b.length);
  const pa = a.padStart(n, '0');
  const pb = b.padStart(n, '0');
  const noms = ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de mille', 'centaines de mille', 'millions', 'dizaines de millions', 'centaines de millions', 'milliards', 'dizaines de milliards'];
  const fausses = [];
  for (let i = 0; i < n; i++) if (pa[i] !== pb[i]) fausses.push(noms[n - 1 - i] ?? `tige ${n - i}`);
  return fausses;
}

export const VALIDATIONS_DRILL = 2;
export const tempsClassement = (d, id) => Math.round(CLASSEMENT.find((c) => c.id === id).s * poidsDrill(d)) * 1000;
/** Meilleur classement obtenu pour un temps (null : plus lent que bronze). */
export function classement(d, dureeMs) {
  let r = null;
  for (const c of CLASSEMENT) if (dureeMs <= tempsClassement(d, c.id)) r = c;
  return r;
}

/** Liste des drills proposés, DANS L'ORDRE DU PARCOURS : du plus simple au plus long. */
export function catalogueDrills() {
  const liste = [];
  // Premiers pas : une ou deux tiges, gestes directs seulement (échauffement des débutants).
  const premiers = 'Premiers pas';
  liste.push({ ...drill('tige-4', 'Monter et descendre une tige (1 à 4)', premiers,
    'Une seule tige : monter les terrestres une à une jusqu\'à 4, puis les redescendre, deux fois. Pouce pour monter, index pour descendre.',
    [...repeter(1, 4), ...repeter(1, 4, '-'), ...repeter(1, 4), ...repeter(1, 4, '-')]), entree: true });
  liste.push({ ...drill('tige-9', 'Monter et descendre une tige (0 à 9)', premiers,
    'Une seule tige : de 0 à 4, retour, la céleste, de 5 à 9, retour à 5, puis à 0. Tous les gestes directs sur une tige.',
    [...repeter(1, 4), ...repeter(1, 4, '-'), { op: '+', n: 5 }, ...repeter(1, 4), ...repeter(1, 4, '-'), { op: '-', n: 5 }]), entree: true });
  liste.push({ ...drill('pendule-11', 'Pendule sur 2 tiges (+11 × 4, puis −11 × 4)', premiers,
    'Deux tiges : ajouter 11 quatre fois, puis le retirer quatre fois. Les dizaines d\'abord, puis les unités, de gauche à droite.',
    allerRetour(11, 4)), entree: true });
  // Avant les grands amis : uniquement des gestes directs et des petits amis.
  const avant = 'Avant les grands amis';
  liste.push(drill('directs', 'Gestes directs : 111 111 111 × 4, + 555 555 555, puis retour', avant,
    'Que des gestes directs, sur 9 tiges : monter à 4, poser la céleste, puis tout redescendre.',
    [...repeter(neuf(1), 4), { op: '+', n: neuf(5) }, { op: '-', n: neuf(4) }, { op: '-', n: neuf(5) }]));
  liste.push(drill('123-1', '1 × 9 fois', avant, 'Ajouter 1 neuf fois : le passage de 4 à 5 est le premier petit ami.', repeter(1, 9)));
  for (const [d, fois] of [[1, 9], [2, 4], [3, 3], [4, 2]]) {
    liste.push(drill(`r-${d}`, `${neuf(d).toLocaleString('fr-FR')} × ${fois}, puis retour`, avant,
      `Ajouter ${neuf(d).toLocaleString('fr-FR')} tant que la tige ne dépasse pas 9, puis redescendre à 0 : +${d} et −${d} petits amis sur les 9 tiges.`,
      allerRetour(neuf(d), fois)));
  }
  liste.push(drill('r-1234321', '1 234 321 × 2, puis retour', avant,
    'Chaque tige a son chiffre : petits amis +3, +4, −3, −4 mélangés aux gestes directs.', allerRetour(1234321, 2)));
  for (const [a, b] of [[2, 1], [4, 2], [3, 2], [4, 3]]) {
    liste.push(drill(`pendule-${a}-${b}`, `Pendule ${a} / ${b} (+${neuf(a).toLocaleString('fr-FR')}, −${neuf(b).toLocaleString('fr-FR')}…)`, avant,
      `Ajouter ${neuf(a).toLocaleString('fr-FR')}, retirer ${neuf(b).toLocaleString('fr-FR')}, et ainsi de suite jusqu'au bout, puis le chemin inverse jusqu'à 0. Les petits amis tombent sans arrêt.`,
      operationsPendule(a, b)));
  }
  liste.push(drill('tour-petits', 'Le tour des petits amis (pendules 4/3, 3/2, 2/1)', avant,
    'Le grand drill avant les grands amis : les trois pendules à la suite, les 8 petits amis, retour à 0.',
    [...operationsPendule(4, 3), ...operationsPendule(3, 2), ...operationsPendule(2, 1)]));
  // 123456789 et ses variantes progressives : 1, 12, 123… ajoutés 9 fois.
  const base = '123456789';
  for (let k = 2; k <= 9; k++) {
    const n = Number(base.slice(0, k));
    const d = drill(`123-${k}`, `${n.toLocaleString('fr-FR')} × 9 fois`, 'Avec les grands amis',
      k < 9
        ? `Variante courte du grand drill, sur ${k} tige${k > 1 ? 's' : ''} : ajouter ${n.toLocaleString('fr-FR')} neuf fois.`
        : 'Le drill classique : ajouter 123 456 789 neuf fois. Tous les amis interviennent sur toutes les tiges.',
      repeter(n, 9));
    liste.push(d);
  }
  liste.push(drill('123-9-ar', '123 456 789 × 9 fois, puis retour à 0', 'Le grand drill et ses variantes',
    'Aller-retour complet : ajouter 123 456 789 neuf fois, puis le retirer neuf fois.',
    [...repeter(123456789, 9), ...repeter(123456789, 9, '-')]));
  liste.push(drill('987-9', '987 654 321 × 9 fois', 'Le grand drill et ses variantes',
    'La version descendante : ajouter 987 654 321 neuf fois.', repeter(987654321, 9)));
  liste.push(drill('12345679-9', '12 345 679 × 9 fois', 'Le grand drill et ses variantes',
    'Curiosité (sans le 8) : ajouter 12 345 679 neuf fois. Le résultat a une forme remarquable.', repeter(12345679, 9)));
  for (const n of [10, 20, 36, 100]) liste.push(drillSuite(n, false));
  liste.push(drillSuite(36, true));
  return ORDRE.map((id) => liste.find((d) => d.id === id)).filter(Boolean);
}

/** Ordre du parcours des drills : du plus simple au plus long, par groupe de gestes. */
const ORDRE = [
  'tige-4', 'tige-9', 'pendule-11', 'directs', '123-1', 'r-4', 'r-1234321', 'r-3', 'r-2', 'pendule-4-2', 'r-1', 'pendule-4-3', 'pendule-3-2', 'pendule-2-1', 'tour-petits',
  '123-2', 'suite-10-a', '123-3', 'suite-20-a', '123-4', '123-5', '123-6', 'suite-36-a', '123-7', '123-8', '123-9',
  '123-9-ar', '12345679-9', '987-9', 'suite-36-ar', 'suite-100-a',
];

/** Sous-totaux après chaque opération (points de contrôle). */
export function controles(operations) {
  let v = 0;
  return operations.map((o) => (v = o.op === '+' ? v + o.n : v - o.n));
}
