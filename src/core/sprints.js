/**
 * Sprints : des réflexes à automatiser à part, hors du calcul complet.
 *
 *  - Division avec reste : « dans 53, combien de fois 7, et combien reste-t-il ? » (7, reste 4).
 *    Le pont entre les tables « à l'endroit » et la division.
 *  - Lecture du complément : un soroban affiche le complément d'un résultat négatif
 *    (99 947 283 après un emprunt imaginaire) ; on tape le résultat (−52 717).
 *  - Arrondi : un nombre avec une décimale de trop, à arrondir au rang demandé (millième, ou
 *    unité pour les montants), sans se tromper de rang.
 *  - Lecture éclair : un grand nombre s'affiche un instant ; on le pose sur le soroban, puis on
 *    le tape. Entraîne la lecture par tranches de 3 chiffres, bien avant les colonnes longues.
 *
 * Fonctions pures de tirage ; les écrans sont dans modules/jeux.js.
 */

import { entier } from './aleatoire.js';

const fr = (n, o) => n.toLocaleString('fr-FR', o);

/** Division avec reste par un diviseur à 1 chiffre : quotient 1 à 9, reste 0 à diviseur − 1. */
export function tirerReste(precedent = null) {
  for (;;) {
    const b = entier(2, 9);
    const q = entier(1, 9);
    // Un reste nul une fois sur six seulement : c'est le reste qu'on entraîne.
    const r = Math.random() < 1 / 6 ? 0 : entier(1, b - 1);
    const a = b * q + r;
    if (precedent && precedent.a === a && precedent.b === b) continue;
    return { a, b, q, r, texte: `${a} ÷ ${b}`, attendu: `${q}${r}`, correction: `${b} × ${q} = ${b * q}, reste ${r}` };
  }
}

/** La réponse tapée (« 74 », « 7 4 », « 7r4 », « 7 reste 4 ») vaut-elle quotient puis reste ? */
export const resteJuste = (q, texte) => String(texte).replace(/\D/g, '') === q.attendu;

/**
 * Complément d'un résultat négatif sur `chiffres` tiges : le soroban affiche 10^chiffres − v.
 * v a entre 1 et `chiffres` chiffres : les 9 de tête (99 947 283) font partie de la lecture.
 */
export function tirerComplement(chiffres, precedent = null) {
  for (;;) {
    const k = entier(Math.max(1, chiffres - 4), chiffres);
    const v = entier(k === 1 ? 1 : 10 ** (k - 1), 10 ** k - 1);
    // Un résultat finissant par 0 change la règle (le « 10 » se prend sur le dernier chiffre non nul) :
    // gardé, mais rare.
    if (v % 10 === 0 && Math.random() < 0.8) continue;
    if (precedent && precedent.v === v) continue;
    const affiche = 10 ** chiffres - v;
    return { chiffres, v, affiche, resultat: -v,
      correction: `${fr(10 ** chiffres)} − ${fr(affiche)} = ${fr(v)} : le résultat est −${fr(v)} (complément à 9 de chaque chiffre, à 10 pour le dernier chiffre non nul)` };
  }
}

/** Réponse au complément : le nombre, avec ou sans le signe moins. */
export const complementJuste = (q, reponse) => reponse !== null && Math.abs(reponse) === q.v;

/**
 * Arrondi : au millième (nombre montré avec 4 ou 5 décimales) ou à l'unité (1 ou 2 décimales).
 * Un cas sur quatre fait remonter une retenue (… 9 suivi de 5 ou plus).
 */
export function tirerArrondi(precedent = null) {
  for (;;) {
    const rang = Math.random() < 0.5 ? 3 : 0;
    const d = rang + entier(1, 2);
    let N = entier(10 ** d, 10 ** (d + entier(1, 3)) - 1);
    if (Math.random() < 0.25) {
      // Retenue : le chiffre du rang vaut 9, le suivant 5 ou plus.
      const coupe = 10 ** (d - rang);
      N = (Math.floor(N / coupe / 10) * 10 + 9) * coupe + entier(5, 9) * (coupe / 10) + (coupe >= 100 ? entier(0, 9) : 0);
    }
    const coupe = 10 ** (d - rang);
    if (N % coupe === 0) continue; // déjà arrondi : rien à faire
    const arrondi = Math.floor(N / coupe) + (N % coupe >= coupe / 2 ? 1 : 0);
    const texte = fr(N / 10 ** d, { minimumFractionDigits: d, maximumFractionDigits: d });
    if (precedent && precedent.texte === texte) continue;
    const suivant = Math.floor((N % coupe) / (coupe / 10));
    return { texte, rang, resultat: arrondi / 10 ** rang, consigne: rang ? 'au millième' : 'à l\'unité',
      correction: `le chiffre qui suit ${rang ? 'le millième' : 'l\'unité'} est ${suivant} : ${suivant >= 5 ? '5 ou plus, on arrondit au-dessus' : 'moins de 5, on garde'} → ${fr(arrondi / 10 ** rang, { minimumFractionDigits: rang, maximumFractionDigits: rang })}` };
  }
}

/** Réponse à l'arrondi, comparée au rang demandé. */
export const arrondiJuste = (q, reponse) => reponse !== null && Math.round(reponse * 1000) === Math.round(q.resultat * 1000);

// ------------------------------------------------------------------ lecture éclair

/** Grand nombre de `chiffres` chiffres, sans 0 en tête ; un zéro interne une fois sur trois dès 4 chiffres. */
export function tirerGrandNombre(chiffres, precedent = null) {
  for (;;) {
    let n = entier(10 ** (chiffres - 1), 10 ** chiffres - 1);
    if (chiffres >= 4 && Math.random() < 1 / 3) {
      const s = String(n).split('');
      s[entier(1, chiffres - 2)] = '0';
      n = Number(s.join(''));
    }
    if (n !== precedent) return n;
  }
}

/** Tranches de 3 chiffres d'un nombre (ce que l'œil doit prendre d'un bloc). */
export const tranches = (chiffres) => Math.ceil(chiffres / 3);
/** Durée d'affichage de départ (secondes) : 0,9 s par tranche. */
export const dureeEclairDepart = (chiffres) => Math.round(90 * tranches(chiffres)) / 100;
export const dureeEclairMin = (chiffres) => Math.round(25 * tranches(chiffres)) / 100;
/** Durée suivante : −10 % après deux réussites de suite, +20 % après une erreur. */
export function dureeEclairSuivante(duree, chiffres, juste, serie) {
  const d = juste ? (serie > 0 && serie % 2 === 0 ? duree * 0.9 : duree) : duree * 1.2;
  return Math.round(Math.min(dureeEclairDepart(chiffres) * 1.5, Math.max(dureeEclairMin(chiffres), d)) * 100) / 100;
}
