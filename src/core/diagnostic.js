/**
 * Diagnostic d'une réponse fausse, à partir du seul résultat tapé.
 *
 * L'élève calcule sur son propre soroban : l'application ne voit pas les gestes. Elle compare
 * la réponse au résultat et cherche les erreurs typiques qui expliquent l'écart :
 * ligne oubliée, signe inversé, retenue ou emprunt oublié (grand ami), boule céleste mal
 * gérée (petit ami), produit partiel oublié ou décalé, chiffres inversés en recopiant…
 *
 * Renvoie une liste de phrases (les plus probables d'abord). Liste vide : pas d'explication simple.
 */

import { nomRang } from './gestes.js';
import { occurrencesColonne } from './generateur.js';
import { analyserMotif } from './motifs.js';

const signe = (op) => (op === '+' ? '+' : '−');
const valeurSignee = (l) => (l.op === '+' ? l.n : -l.n);

/** Si x = d × 10^k avec un seul chiffre non nul, renvoie { d, k } ; sinon null. */
function unSeulChiffre(x) {
  if (x === 0) return null;
  const a = Math.abs(x);
  const s = String(a);
  if (s.slice(1).split('').some((c) => c !== '0')) return null;
  return { d: Math.sign(x) * Number(s[0]), k: s.length - 1 };
}

function chiffresEchanges(reponse, resultat) {
  const a = String(reponse);
  const b = String(resultat);
  if (a.length !== b.length) return false;
  const diff = [...a].map((c, i) => (c !== b[i] ? i : -1)).filter((i) => i >= 0);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

/** Causes générales liées à l'écart sur une seule tige. */
function causesEcartTige(ecart) {
  const u = unSeulChiffre(ecart);
  if (!u) return [];
  const tige = `les ${nomRang(u.k)}`;
  const plus = u.d > 0 ? 'en trop' : 'en moins';
  if (Math.abs(u.d) === 5) {
    return [`Écart de 5 sur ${tige} (${plus}) : probablement la boule céleste. Vérifiez les petits amis (+5 −… / +… −5) sur cette tige.`];
  }
  if (Math.abs(u.d) === 1 && u.k >= 1) {
    return [`Écart de 1 sur ${tige} (${plus}) : probablement une retenue ou un emprunt du grand ami, posé deux fois ou oublié sur la tige de droite.`];
  }
  return [`Écart de ${Math.abs(u.d)} ${plus} sur ${tige} uniquement : une seule tige semble fausse.`];
}

/**
 * Ami fait À L'ENVERS : le complément ajouté au lieu d'être retiré, ou l'inverse.
 *  - petit ami +4 = +5 −1, fait +5 +1 : le résultat a 2 de trop (deux fois le complément) ;
 *  - grand ami +8 = −2 +10, fait +2 +10 : 4 de trop ; en soustraction, autant de moins.
 * L'écart vaut donc ± 2 × complément sur la tige du geste. Renvoie les gestes de la colonne
 * qui expliquent exactement l'écart (souvent aucun, parfois plusieurs : à l'appelant de trancher).
 * @returns {Array<{ ligne:number, cle:string, rang:number, complement:number, famille:'petit'|'grand' }>}
 */
export function amisInverses(ex, reponse) {
  if (ex.type !== 'addsub' || ex.negatif || ex.decimales || reponse === null) return [];
  const ecart = reponse - ex.resultat;
  if (ecart === 0) return [];
  const trouves = [];
  occurrencesColonne(ex.lignes).forEach((ms, ligne) => ms.forEach(({ cle, rang }) => {
    const { op, d, regle } = analyserMotif(cle);
    if (regle !== 'petit' && regle !== 'grand') return;
    const complement = (regle === 'petit' ? 5 : 10) - d;
    if (ecart === (op === '+' ? 2 : -2) * complement * 10 ** rang) trouves.push({ ligne, cle, rang, complement, famille: regle });
  }));
  return trouves;
}

/** Phrase d'explication d'un ami fait à l'envers. */
function phraseAmiInverse({ ligne, cle, rang, complement, famille }) {
  const { op, d } = analyserMotif(cle);
  const base = famille === 'petit' ? 5 : 10;
  const juste = op === '+' ? (famille === 'petit' ? `+5 −${complement}` : `−${complement} +10`) : (famille === 'petit' ? `+${complement} −5` : `−10 +${complement}`);
  const fait = op === '+' ? (famille === 'petit' ? `+5 +${complement}` : `+${complement} +10`) : (famille === 'petit' ? `−${complement} −5` : `−10 −${complement}`);
  return `Ligne ${ligne + 1}, sur les ${nomRang(rang)} : ${signe(op)}${d} est un ${famille === 'petit' ? 'petit' : 'grand'} ami (${juste}). Le résultat correspond à ${fait} : le complément à ${base} (${complement}) a été ${op === '+' ? 'ajouté au lieu d\'être retiré' : 'retiré au lieu d\'être ajouté'}.`;
}

/**
 * Franchissements d'une colonne : les lignes où le total change de longueur (97 + 8 = 105 passe
 * à 3 chiffres ; 102 − 5 = 97 repasse à 2). C'est là que les adultes accrochent le plus.
 * @returns {Array<{ ligne:number, avant:number, apres:number, rang:number, monte:boolean }>}
 */
export function franchissements(lignes) {
  const liste = [];
  let v = 0;
  lignes.forEach((l, i) => {
    const avant = v;
    v += valeurSignee(l);
    const a = String(Math.abs(avant)).length;
    const b = String(Math.abs(v)).length;
    if (i > 0 && a !== b && avant > 0 && v > 0) liste.push({ ligne: i, avant, apres: v, rang: Math.max(a, b) - 1, monte: b > a });
  });
  return liste;
}

/**
 * Franchissement mis en cause par une réponse fausse : l'écart est exactement 10, 100, 1 000…
 * (une seule tige, d'une unité, pas les unités) et la colonne franchit un rang au moins aussi
 * haut. Sinon null : sans franchissement dans la colonne, on n'accuse rien.
 */
export function franchissementEnCause(ex, reponse) {
  if (ex.type !== 'addsub' || ex.negatif || ex.decimales || !ex.lignes || reponse === null) return null;
  const u = unSeulChiffre(reponse - ex.resultat);
  if (!u || Math.abs(u.d) !== 1 || u.k < 1) return null;
  // Le franchissement le plus proche du rang fautif (99 → 100 pour un écart de 10 ou de 100).
  return franchissements(ex.lignes).filter((f) => f.rang >= u.k && f.rang <= u.k + 1).sort((a, b) => a.rang - b.rang)[0] ?? null;
}

/**
 * Diagnostic d'une colonne d'addition/soustraction.
 * @param {{lignes:Array<{op,n}>, resultat:number}} ex
 */
export function diagnostiquerColonne(ex, reponse) {
  const ecart = reponse - ex.resultat;
  if (ecart === 0) return [];
  const causes = [];
  ex.lignes.forEach((l, i) => {
    const v = valeurSignee(l);
    const nom = i === 0 ? `la 1re ligne (${l.n})` : `la ligne ${i + 1} (${signe(l.op)}${l.n})`;
    if (ecart === -v) causes.push(`Le résultat correspond à un oubli de ${nom}.`);
    if (ecart === v) causes.push(`Le résultat correspond à ${nom} comptée deux fois.`);
    if (i > 0 && ecart === -2 * v) causes.push(`Le résultat correspond à ${nom} faite avec le mauvais signe.`);
  });
  // Ami fait à l'envers : plus précis que « écart de 2 sur une tige », donc dit en premier.
  const inverses = ex.lignes ? amisInverses({ type: 'addsub', ...ex }, reponse) : [];
  causes.push(...inverses.slice(0, 2).map(phraseAmiInverse));
  // Franchissement : le total change de longueur (99 → 100) et la réponse est fausse d'exactement
  // 10, 100, 1 000… C'est le passage d'une tige à la suivante qui a lâché. On l'accuse en premier,
  // sauf si une ligne oubliée, doublée ou de signe inversé explique déjà l'écart.
  const f = franchissementEnCause(ex, reponse);
  if (f) {
    const phrase = `Vous perdez votre image ou votre doigté au passage ${f.monte ? 'aux' : 'sous les'} ${nomRang(f.rang)} (${f.avant} → ${f.apres}, ligne ${f.ligne + 1}) : ${f.monte ? 'la retenue' : 'l\'emprunt'} en cascade n'est pas fluide.`;
    if (causes.length) causes.push(phrase); else causes.unshift(phrase);
  }
  causes.push(...causesEcartTige(ecart));
  if (chiffresEchanges(reponse, ex.resultat)) causes.push('Deux chiffres voisins sont inversés : erreur de lecture ou de recopie du soroban ?');
  return causes;
}

/** Diagnostic d'une multiplication a × b (両落とし). */
export function diagnostiquerMultiplication(ex, reponse) {
  const { a, b, resultat } = ex;
  const ecart = reponse - resultat;
  if (ecart === 0) return [];
  const causes = [];
  if (reponse * 10 === resultat || reponse === resultat * 10) {
    causes.push('Le résultat est décalé d\'une tige : revoyez la position du premier produit (nombre total de chiffres des deux facteurs).');
  }
  const ca = String(a).split('').map(Number);
  const cb = String(b).split('').map(Number);
  const total = ca.length + cb.length;
  ca.forEach((x, i) => cb.forEach((y, j) => {
    const p = x * y * 10 ** (total - 2 - i - j);
    if (ecart === -p) causes.push(`Le produit ${x} × ${y} semble oublié.`);
    if (ecart === 9 * p) causes.push(`Le produit ${x} × ${y} semble posé une tige trop à gauche.`);
    if (ecart * 10 === -9 * p) causes.push(`Le produit ${x} × ${y} semble posé une tige trop à droite.`);
    if (ecart === p) causes.push(`Le produit ${x} × ${y} semble ajouté deux fois.`);
  }));
  causes.push(...causesEcartTige(ecart));
  if (chiffresEchanges(reponse, resultat)) causes.push('Deux chiffres voisins sont inversés en recopiant.');
  return causes;
}

/** Diagnostic d'une division a ÷ b (片落とし). */
export function diagnostiquerDivision(ex, reponse) {
  const { b, resultat } = ex;
  if (reponse === resultat) return [];
  const causes = [];
  if (reponse * 10 === resultat || reponse === resultat * 10 || reponse * 100 === resultat || reponse === resultat * 100) {
    causes.push('Le quotient est décalé : revoyez la règle « deux tiges / juste à gauche » et la position de l\'unité (chiffres du diviseur + 1).');
  }
  const u = unSeulChiffre(reponse - resultat);
  if (u && Math.abs(u.d) === 1) {
    causes.push(u.d > 0
      ? `Un chiffre du quotient est trop grand de 1 (${nomRang(u.k)}) : le produit ne pouvait pas être retiré, il fallait diminuer le chiffre.`
      : `Un chiffre du quotient est trop petit de 1 (${nomRang(u.k)}) : le reste était encore plus grand que ${b}.`);
  }
  if (chiffresEchanges(reponse, resultat)) causes.push('Deux chiffres voisins sont inversés en recopiant.');
  return causes;
}

/** Décimaux : virgule mal placée, ou arrondi. */
function diagnostiquerDecimal(ex, reponse) {
  const causes = [];
  for (const k of [1, 2, 3]) {
    if (Math.abs(reponse * 10 ** k - ex.resultat) < 1e-9 || Math.abs(reponse - ex.resultat * 10 ** k) < 1e-9) {
      causes.push('La virgule est mal placée : comptez les décimales des deux nombres (multiplication), ou rendez d\'abord le diviseur entier (division).');
    }
  }
  const pas = 10 ** -(ex.decimales ?? 0);
  if (Math.abs(Math.abs(reponse - ex.resultat) - pas) < pas / 10) {
    causes.push(`Écart d'une unité sur la dernière décimale : vérifiez l'arrondi (on regarde la décimale suivante : 5 ou plus, on arrondit au-dessus).`);
  }
  return causes;
}

/** Photo du soroban : quelle tige a été mal lue, et comment (céleste ou terrestres). */
export function diagnostiquerPhoto(ex, reponse) {
  if (reponse === ex.resultat) return [];
  const noms = ['unités', 'dizaines', 'centaines'];
  const causes = [];
  const a = String(ex.n).split('').reverse();
  const r = String(Math.max(0, reponse)).split('').reverse();
  for (let i = 0; i < Math.max(a.length, r.length); i++) {
    const x = Number(a[i] ?? 0);
    const y = Number(r[i] ?? 0);
    if (x === y) continue;
    const tige = `tige des ${noms[i] ?? `rang ${i + 1}`}`;
    if (Math.abs(x - y) === 5) causes.push(`${tige} : la céleste a été mal vue (elle ${x >= 5 ? 'était' : 'n\'était pas'} contre la barre).`);
    else if ((x >= 5) === (y >= 5)) causes.push(`${tige} : ${x % 5} terrestre${x % 5 > 1 ? 's' : ''} contre la barre, pas ${y % 5}. Regardez le groupe d'un coup d'œil, sans compter.`);
    else causes.push(`${tige} : ${x}, et non ${y}. Lisez la céleste d'abord, puis les terrestres.`);
  }
  return causes;
}

export function diagnostiquer(ex, reponse) {
  if (ex.type === 'photo' || ex.type === 'tenir') return diagnostiquerPhoto(ex, reponse);
  if (ex.type === 'quotidien' || ex.negatif) return ex.astuce ? [ex.astuce] : [];
  if (ex.type === 'table') {
    return reponse === ex.resultat ? [`Le nombre est juste, mais il s'écrit sur DEUX tiges : « ${ex.attendu} ». La tige des dizaines compte même vide.`] : [`${ex.a} × ${ex.b} = ${ex.attendu}.`];
  }
  if (ex.decimales || ex.virgules) return diagnostiquerDecimal(ex, reponse);
  if (ex.type === 'mul') return diagnostiquerMultiplication(ex, reponse);
  if (ex.type === 'div') return diagnostiquerDivision(ex, reponse);
  return diagnostiquerColonne(ex, reponse);
}

/**
 * Localise l'erreur d'une colonne fausse, SEULEMENT quand le résultat le prouve sans ambiguïté :
 *  - écart de 5 sur une tige : un seul geste de boule céleste (petit ami / combiné) sur cette tige ;
 *  - écart de 1 sur une tige : une seule retenue ou un seul emprunt venant de la tige de droite ;
 *  - écart de deux fois un complément : un seul ami de la colonne fait à l'envers (amisInverses).
 * Sinon renvoie null : on n'accuse aucun geste au hasard (l'élève peut indiquer la ligne lui-même).
 * @returns {{ ligne:number, motifs:string[], raison:string } | null}
 */
export function localiserErreur(ex, reponse) {
  if (ex.type !== 'addsub' || ex.negatif) return null;
  const u = unSeulChiffre(reponse - ex.resultat);
  const occ = occurrencesColonne(ex.lignes);
  const candidats = [];
  if (u) {
    occ.forEach((ms, ligne) => ms.forEach(({ cle, rang }) => {
      const regle = analyserMotif(cle).regle;
      if (Math.abs(u.d) === 5 && rang === u.k && (regle === 'petit' || regle === 'mixte')) candidats.push({ ligne, cle, raison: 'boule céleste' });
      if (Math.abs(u.d) === 1 && u.k >= 1 && rang === u.k - 1 && (regle === 'grand' || regle === 'mixte' || regle === 'cascade')) candidats.push({ ligne, cle, raison: 'retenue ou emprunt' });
    }));
  }
  // Ami à l'envers : seulement si aucune ligne oubliée, doublée ou de signe inversé n'explique
  // aussi l'écart (3 + 4 + 2 répondu 11 : le +4 à l'envers, ou le +2 fait deux fois ? on ne sait pas).
  const ecart = reponse - ex.resultat;
  const parLigne = ex.lignes.some((l, i) => { const v = valeurSignee(l); return ecart === v || ecart === -v || (i > 0 && ecart === -2 * v); });
  if (!parLigne) for (const a of amisInverses(ex, reponse)) candidats.push({ ligne: a.ligne, cle: a.cle, raison: `${a.famille} ami fait à l'envers` });
  // Une seule ligne ET une seule explication : sinon on n'accuse aucun geste.
  const lignes = [...new Set(candidats.map((c) => c.ligne))];
  const raisons = [...new Set(candidats.map((c) => c.raison))];
  if (lignes.length !== 1 || raisons.length !== 1) return null;
  return { ligne: lignes[0], motifs: [...new Set(candidats.map((c) => c.cle))], raison: raisons[0] };
}

/** Motifs d'une ligne donnée (quand l'élève indique lui-même où il s'est trompé). */
export function motifsDeLigne(ex, ligne) {
  return [...new Set(occurrencesColonne(ex.lignes)[ligne].map((o) => o.cle))];
}

/**
 * Erreur IDENTIFIÉE sans ambiguïté sur une colonne : une seule ligne peut expliquer l'écart.
 * Sert à proposer une reprise immédiate (« reprenez la ligne 4 »), qui n'a de sens que si l'on
 * sait où regarder. Sinon null : la colonne suit le circuit normal (rejouée un autre jour).
 *
 * Explications reconnues, chacune pour UNE ligne :
 *  - ligne oubliée, comptée deux fois, ou faite avec le mauvais signe ;
 *  - un chiffre de la ligne lu ou posé pour un autre (écart sur une seule tige, cohérent avec ce chiffre) ;
 *  - ligne posée une tige trop à gauche ou trop à droite ;
 *  - geste localisé par le résultat (boule céleste, retenue ou emprunt : voir localiserErreur).
 * Deux lignes candidates : ambigu, donc null.
 * @returns {{ ligne:number, type:string, indice:string, detail:string, motifs:string[] } | null}
 */
export function erreurIdentifiee(ex, reponse) {
  if (ex.type !== 'addsub' || ex.negatif || ex.decimales || reponse === null || reponse === ex.resultat) return null;
  const ecart = reponse - ex.resultat;
  const candidats = [];
  const noter = (ligne, type, detail) => candidats.push({ ligne, type, detail });
  ex.lignes.forEach((l, i) => {
    const v = valeurSignee(l);
    const nom = `${i === 0 ? '' : signe(l.op)}${l.n}`;
    if (ecart === -v) noter(i, 'oubliee', `La ligne ${i + 1} (${nom}) n'a pas été faite.`);
    if (ecart === v) noter(i, 'doublee', `La ligne ${i + 1} (${nom}) a été faite deux fois.`);
    if (i > 0 && ecart === -2 * v) noter(i, 'signe', `La ligne ${i + 1} (${nom}) a été faite avec le mauvais signe.`);
    if (ecart === 9 * v) noter(i, 'decalee', `La ligne ${i + 1} (${nom}) a été posée une tige trop à gauche.`);
    if (ecart * 10 === -9 * v) noter(i, 'decalee', `La ligne ${i + 1} (${nom}) a été posée une tige trop à droite.`);
    // Un chiffre lu pour un autre : l'écart tient sur une tige, et le chiffre « lu » reste un chiffre.
    const u = unSeulChiffre(l.op === '+' ? ecart : -ecart);
    if (u && u.k < String(l.n).length) {
      const vrai = Number(String(l.n).at(-1 - u.k));
      const lu = vrai + u.d;
      const enTete = u.k === String(l.n).length - 1;
      if (lu >= (enTete ? 1 : 0) && lu <= 9) noter(i, 'lecture', `Ligne ${i + 1} (${nom}) : un ${vrai} lu ou posé comme un ${lu} sur les ${nomRang(u.k)}.`);
    }
  });
  const loc = localiserErreur(ex, reponse);
  if (loc) noter(loc.ligne, 'geste', `Ligne ${loc.ligne + 1} : ${loc.raison} (${loc.motifs.join(', ')}).`);
  const lignes = [...new Set(candidats.map((c) => c.ligne))];
  if (lignes.length !== 1) return null;
  // Plusieurs lectures de la même ligne : on garde la plus précise (le geste, sinon la première).
  const c = candidats.find((x) => x.type === 'geste') ?? candidats[0];
  return { ligne: c.ligne, type: c.type, indice: `L'erreur est à la ligne ${c.ligne + 1}.`, detail: c.detail, motifs: loc?.motifs ?? [] };
}

/**
 * TYPE d'une erreur de multiplication ou de division, quand le résultat tapé le prouve. Ces
 * types se comptent comme on compte les gestes ratés en colonnes : une erreur qui se répète
 * appelle un entraînement précis (voir ENTRAINEMENTS_ERREUR, progression.erreursOperationRepetees).
 *  - placement : résultat décalé d'une ou plusieurs tiges (ou virgule mal placée) ;
 *  - zero : un zéro du résultat oublié, ou un zéro en trop ;
 *  - quotient-grand / quotient-petit : un chiffre du quotient faux de 1 ;
 *  - arrondi : dernière décimale fausse de 1, ou résultat tronqué au lieu d'être arrondi ;
 *  - produit : un produit partiel oublié, doublé ou décalé d'une tige.
 * Sinon null : on ne classe pas au hasard.
 * @returns {'placement'|'zero'|'quotient-grand'|'quotient-petit'|'arrondi'|'produit'|null}
 */
export function typeErreurOperation(ex, reponse) {
  if (!ex || reponse === null || reponse === undefined || ex.mental) return null;
  const mul = ex.type === 'mul' || ex.type === 'muldec';
  const div = ex.type === 'div' || ex.type === 'divdec';
  if (!mul && !div) return null;
  const dec = ex.decimales ?? 0;
  const R = Math.round(ex.resultat * 10 ** dec);
  const r = Math.round(reponse * 10 ** dec);
  if (R === r || r <= 0) return null;
  // Mêmes chiffres, à une puissance de 10 près : le résultat est décalé.
  const nu = (x) => String(x).replace(/0+$/, '');
  const brut = (x) => String(x).replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  if (brut(reponse) === brut(ex.resultat) || nu(r) === nu(R)) return 'placement';
  // Arrondi : une unité d'écart sur la dernière décimale demandée.
  if (ex.arrondi && Math.abs(r - R) === 1) return 'arrondi';
  // Zéro oublié ou en trop : mêmes chiffres non nuls, dans le même ordre.
  const sansZero = (x) => String(x).replace(/0/g, '');
  if (sansZero(r) === sansZero(R) && String(r).length !== String(R).length) return 'zero';
  if (div) {
    const u = unSeulChiffre(r - R);
    if (u && Math.abs(u.d) === 1) return u.d > 0 ? 'quotient-grand' : 'quotient-petit';
    return null;
  }
  // Multiplication entière : un produit partiel oublié, doublé ou décalé.
  if (ex.type === 'mul' && Number.isInteger(ex.a) && Number.isInteger(ex.b)) {
    const ca = String(ex.a).split('').map(Number);
    const cb = String(ex.b).split('').map(Number);
    const total = ca.length + cb.length;
    const ecart = reponse - ex.resultat;
    for (let i = 0; i < ca.length; i++) for (let j = 0; j < cb.length; j++) {
      const p = ca[i] * cb[j] * 10 ** (total - 2 - i - j);
      if (p && (ecart === -p || ecart === p || ecart === 9 * p || ecart * 10 === -9 * p)) return 'produit';
    }
  }
  return null;
}

/** Nom de chaque type d'erreur, et l'entraînement qui le corrige (écran, paramètres). */
export const ENTRAINEMENTS_ERREUR = {
  placement: { nom: 'résultat décalé d\'une tige', remede: 'Placement du premier produit ou du premier chiffre du quotient', aller: (div) => ['lecons', { sousPalier: div ? 'p7-0' : 'p6-0', onglet: 'entrainement' }] },
  zero: { nom: 'zéro oublié ou en trop', remede: 'Planche de multiplications et divisions avec des zéros', aller: () => ['muldiv', { zeros: true, auto: true }] },
  'quotient-grand': { nom: 'chiffre du quotient trop grand', remede: 'Estimation du quotient', aller: () => ['drills', { quotient: true }] },
  'quotient-petit': { nom: 'chiffre du quotient trop petit', remede: 'Estimation du quotient', aller: () => ['drills', { quotient: true }] },
  arrondi: { nom: 'arrondi faux', remede: 'Arrondi éclair', aller: () => ['jeux', { jeu: 'arrondi' }] },
  produit: { nom: 'produit partiel oublié, doublé ou décalé', remede: 'Tables : vos produits les plus lents', aller: () => ['drills', { tables: 'lents', auto: true }] },
};
