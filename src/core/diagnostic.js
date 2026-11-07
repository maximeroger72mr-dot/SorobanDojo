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
  if (ex.decimales) return diagnostiquerDecimal(ex, reponse);
  if (ex.type === 'mul') return diagnostiquerMultiplication(ex, reponse);
  if (ex.type === 'div') return diagnostiquerDivision(ex, reponse);
  return diagnostiquerColonne(ex, reponse);
}

/**
 * Localise l'erreur d'une colonne fausse, SEULEMENT quand le résultat le prouve sans ambiguïté :
 *  - écart de 5 sur une tige : un seul geste de boule céleste (petit ami / combiné) sur cette tige ;
 *  - écart de 1 sur une tige : une seule retenue ou un seul emprunt venant de la tige de droite.
 * Sinon renvoie null : on n'accuse aucun geste au hasard (l'élève peut indiquer la ligne lui-même).
 * @returns {{ ligne:number, motifs:string[], raison:string } | null}
 */
export function localiserErreur(ex, reponse) {
  if (ex.type !== 'addsub' || ex.negatif) return null;
  const u = unSeulChiffre(reponse - ex.resultat);
  if (!u) return null;
  const occ = occurrencesColonne(ex.lignes);
  const candidats = [];
  occ.forEach((ms, ligne) => ms.forEach(({ cle, rang }) => {
    const regle = analyserMotif(cle).regle;
    if (Math.abs(u.d) === 5 && rang === u.k && (regle === 'petit' || regle === 'mixte')) candidats.push({ ligne, cle });
    if (Math.abs(u.d) === 1 && u.k >= 1 && rang === u.k - 1 && (regle === 'grand' || regle === 'mixte' || regle === 'cascade')) candidats.push({ ligne, cle });
  }));
  const lignes = [...new Set(candidats.map((c) => c.ligne))];
  if (lignes.length !== 1) return null;
  return {
    ligne: lignes[0],
    motifs: [...new Set(candidats.map((c) => c.cle))],
    raison: Math.abs(u.d) === 5 ? 'boule céleste' : 'retenue ou emprunt',
  };
}

/** Motifs d'une ligne donnée (quand l'élève indique lui-même où il s'est trompé). */
export function motifsDeLigne(ex, ligne) {
  return [...new Set(occurrencesColonne(ex.lignes)[ligne].map((o) => o.cle))];
}
