/**
 * Moteur des gestes : traduit une addition ou une soustraction en une suite de mouvements de boules,
 * selon la méthode japonaise standard (deux doigts : pouce et index).
 *
 * Règles appliquées (méthode standard enseignée au Japon) :
 *  - On calcule de GAUCHE à DROITE : on ajoute (ou retire) d'abord le chiffre de plus haut rang.
 *  - Doigts : le POUCE monte les boules terrestres ; l'INDEX descend les boules terrestres
 *    et manœuvre la boule céleste (dans les deux sens).
 *  - Pour chaque chiffre, on choisit dans cet ordre :
 *      1. le geste direct, si les boules nécessaires sont libres ;
 *      2. le « petit ami » (complément à 5) :   +d = +5 − (5−d)   et   −d = +(5−d) − 5 ;
 *      3. le « grand ami » (complément à 10) :  +d = −(10−d) puis +1 sur la tige de gauche (retenue)
 *                                               −d = −1 sur la tige de gauche (emprunt) puis +(10−d).
 *    Pour le grand ami en addition, on retire d'abord le complément sur la tige, puis on pose la retenue.
 *    Pour la soustraction, on emprunte d'abord à gauche, puis on ajoute le complément.
 *    Les sous-opérations peuvent elles-mêmes utiliser un petit ami (ex. 5 + 6) ou une retenue en
 *    cascade (ex. 99 + 1).
 *
 * Le résultat est une liste d'ÉTAPES. Chaque étape a un texte explicatif (le « pourquoi » du geste)
 * et zéro, un ou plusieurs mouvements élémentaires. Une étape sans mouvement est une annonce
 * (par exemple : « on va utiliser le grand ami de 7 »), suivie des étapes qui la réalisent.
 *
 * Mouvement élémentaire : { tige, perle: 'celeste'|'terrestre', delta, doigt: 'pouce'|'index', sens }
 *   delta : variation de valeur (+5/−5 pour la céleste, ±n pour n boules terrestres)
 *   sens  : 'monte' ou 'descend' (direction physique de la boule)
 *
 * MOTIFS : chaque chiffre ajouté ou retiré est aussi classé dans un « motif opératoire »,
 * par exemple '+4:petit' (ajouter 4 avec le petit ami), '-8:mixte' (retirer 8 : grand ami
 * dont le complément se fait par petit ami), 'cascade+' (retenue qui se propage).
 * Ces motifs servent au diagnostic des faiblesses et à la génération ciblée d'exercices.
 * Règles possibles : 'direct', 'petit' (petit ami), 'grand' (grand ami), 'mixte' (grand + petit ami).
 */

import { chiffreDepuisEtat } from './soroban.js';

const NOMS_RANGS = [
  'unités', 'dizaines', 'centaines',
  'milliers', 'dizaines de milliers', 'centaines de milliers',
  'millions', 'dizaines de millions', 'centaines de millions',
  'milliards', 'dizaines de milliards', 'centaines de milliards',
  'billions', 'dizaines de billions', 'centaines de billions',
];

const NOMS_DECIMALES = ['dixièmes', 'centièmes', 'millièmes', 'dix-millièmes'];

/** Nom d'une tige à partir de son rang (0 = unités, −1 = dixièmes…). */
export function nomRang(rang) {
  if (rang < 0) return NOMS_DECIMALES[-rang - 1] ?? `rang ${rang}`;
  return NOMS_RANGS[rang] ?? `rang ${rang}`;
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const boulesT = (n) => (n > 1 ? `${n} boules terrestres` : `${n} boule terrestre`);

/**
 * Règle employée pour AJOUTER le chiffre d à une tige dans l'état donné (sans regarder la retenue).
 * @returns {'direct'|'petit'|'grand'|'mixte'}
 */
export function regleAjout(etat, d) {
  const c = chiffreDepuisEtat(etat);
  if (c + d <= 9) return d >= 5 || etat.terrestres + d <= 4 ? 'direct' : 'petit';
  const k = 10 - d; // complément à retirer
  return k < 5 && etat.terrestres < k ? 'mixte' : 'grand';
}

/**
 * Règle employée pour RETIRER le chiffre d d'une tige dans l'état donné (sans regarder l'emprunt).
 * @returns {'direct'|'petit'|'grand'|'mixte'}
 */
export function regleRetrait(etat, d) {
  const c = chiffreDepuisEtat(etat);
  if (c >= d) return d >= 5 || etat.terrestres >= d ? 'direct' : 'petit';
  const k = 10 - d; // complément à ajouter après l'emprunt
  return k < 5 && etat.terrestres + k > 4 ? 'mixte' : 'grand';
}

/** Erreur levée quand l'opération sort du soroban (résultat négatif ou trop grand). */
export class ErreurCalcul extends Error {}

class Calculateur {
  constructor(etats, tigeUnites) {
    this.etats = etats.map((e) => ({ ...e }));
    this.tigeUnites = tigeUnites;
    this.etapes = [];
    this.motifs = [];        // motifs rencontrés : { cle, tige, role }
    this.motifCourant = null; // motif du chiffre principal en cours (attaché à chaque étape)
  }

  /**
   * Note le motif d'une opération sur une tige.
   * role : 'principal' (chiffre du nombre), 'retenue' (+1 reporté à gauche),
   *        'emprunt' (−1 pris à gauche) ou 'complement' (sous-geste d'un grand ami : non noté).
   */
  noterMotif(op, tige, d, regle, role) {
    let cle;
    if (role === 'principal') cle = `${op}${d}:${regle}`;
    else if (role === 'retenue' || role === 'emprunt') {
      // Une retenue qui tombe sur un 9 (ou un emprunt sur un 0) se propage : c'est la cascade.
      cle = regle === 'grand' || regle === 'mixte' ? `cascade${op}` : `${op}1:${regle}`;
    } else return;
    this.motifs.push({ cle, tige, role });
    if (role === 'principal') this.motifCourant = cle;
  }

  nom(tige) {
    return nomRang(this.tigeUnites - tige);
  }

  chiffre(tige) {
    return chiffreDepuisEtat(this.etats[tige]);
  }

  /** Démarre une nouvelle étape et la renvoie. */
  etape(regle, tige, texte) {
    const e = { regle, tige, texte, motif: this.motifCourant, mouvements: [] };
    this.etapes.push(e);
    return e;
  }

  /** Ajoute un mouvement élémentaire à l'étape et l'applique à l'état interne. */
  mouvoir(etape, tige, perle, delta) {
    const e = this.etats[tige];
    let sens;
    let doigt;
    if (perle === 'celeste') {
      // Abaisser la céleste (+5) ou la relever (−5) : toujours avec l'index.
      if ((delta > 0) === e.celeste) throw new Error('Mouvement de céleste impossible');
      e.celeste = delta > 0;
      sens = delta > 0 ? 'descend' : 'monte';
      doigt = 'index';
    } else {
      const n = e.terrestres + delta;
      if (n < 0 || n > 4) throw new Error('Mouvement de terrestres impossible');
      e.terrestres = n;
      // Monter les terrestres : pouce. Les descendre : index.
      sens = delta > 0 ? 'monte' : 'descend';
      doigt = delta > 0 ? 'pouce' : 'index';
    }
    etape.mouvements.push({ tige, perle, delta, doigt, sens });
  }

  verifierTige(tige) {
    if (tige < 0) throw new ErreurCalcul('Le résultat dépasse la capacité du soroban.');
  }

  /** Ajoute le chiffre d (1..9) sur la tige. */
  ajouter(tige, d, role = 'principal') {
    if (d === 0) return;
    this.verifierTige(tige);
    const c = this.chiffre(tige);
    const e = this.etats[tige];
    const nom = this.nom(tige);
    this.noterMotif('+', tige, d, regleAjout(e, d), role);

    if (c + d <= 9) {
      if (d >= 5) {
        // c ≤ 4, donc la céleste est libre : geste direct.
        const reste = d - 5;
        const texte = reste === 0
          ? `Ajouter 5 aux ${nom} : on abaisse la boule céleste avec l'index.`
          : `Ajouter ${d} aux ${nom} : ${d} = 5 + ${reste}. En un seul geste (pincée), l'index abaisse la boule céleste et le pouce monte ${boulesT(reste)}.`;
        const et = this.etape('direct', tige, texte);
        this.mouvoir(et, tige, 'celeste', 5);
        if (reste) this.mouvoir(et, tige, 'terrestre', reste);
      } else if (e.terrestres + d <= 4) {
        const et = this.etape('direct', tige,
          `Ajouter ${d} aux ${nom} : il y a assez de boules terrestres libres, le pouce en monte ${d}.`);
        this.mouvoir(et, tige, 'terrestre', d);
      } else {
        // Pas assez de terrestres libres, céleste libre : petit ami (complément à 5).
        const k = 5 - d;
        const et = this.etape('petit-ami', tige,
          `Ajouter ${d} aux ${nom} : ${4 - e.terrestres === 0 ? 'aucune boule terrestre n\'est libre' : `il ne reste que ${boulesT(4 - e.terrestres)} libre${4 - e.terrestres > 1 ? 's' : ''}`}. `
          + `Petit ami : ajouter ${d}, c'est ajouter 5 et retirer ${k}. `
          + `L'index abaisse la boule céleste (+5), puis descend ${boulesT(k)} (−${k}).`);
        this.mouvoir(et, tige, 'celeste', 5);
        this.mouvoir(et, tige, 'terrestre', -k);
      }
      return;
    }

    // Le résultat dépasse 9 : grand ami (complément à 10).
    const k = 10 - d;
    this.verifierTige(tige - 1);
    this.etape('grand-ami', tige,
      `Ajouter ${d} aux ${nom} (qui valent ${c}) : on dépasserait 9. `
      + `Grand ami : ajouter ${d}, c'est retirer ${k} puis ajouter 10. `
      + `On retire d'abord ${k} sur les ${nom}, puis on ajoute 1 sur les ${this.nom(tige - 1)} (la retenue).`);
    this.retirer(tige, k, 'complement');
    this.ajouter(tige - 1, 1, 'retenue');
  }

  /** Retire le chiffre d (1..9) de la tige. */
  retirer(tige, d, role = 'principal') {
    if (d === 0) return;
    this.verifierTige(tige);
    const c = this.chiffre(tige);
    const e = this.etats[tige];
    const nom = this.nom(tige);
    this.noterMotif('-', tige, d, regleRetrait(e, d), role);

    if (c >= d) {
      if (d >= 5) {
        // c ≥ 5 : la céleste est en place, et il reste au moins d−5 terrestres.
        const reste = d - 5;
        const texte = reste === 0
          ? `Retirer 5 des ${nom} : l'index relève la boule céleste.`
          : `Retirer ${d} des ${nom} : ${d} = 5 + ${reste}. En un seul geste, l'index relève la boule céleste et descend ${boulesT(reste)}.`;
        const et = this.etape('direct', tige, texte);
        this.mouvoir(et, tige, 'celeste', -5);
        if (reste) this.mouvoir(et, tige, 'terrestre', -reste);
      } else if (e.terrestres >= d) {
        const et = this.etape('direct', tige,
          `Retirer ${d} des ${nom} : il y a assez de boules terrestres contre la barre, l'index en descend ${d}.`);
        this.mouvoir(et, tige, 'terrestre', -d);
      } else {
        // Pas assez de terrestres en place, mais la céleste est là : petit ami.
        const k = 5 - d;
        const et = this.etape('petit-ami', tige,
          `Retirer ${d} des ${nom} : ${e.terrestres === 0 ? 'aucune boule terrestre n\'est contre la barre' : `il n'y a que ${boulesT(e.terrestres)} contre la barre`}. `
          + `Petit ami : retirer ${d}, c'est ajouter ${k} et retirer 5. `
          + `Le pouce monte ${boulesT(k)} (+${k}), puis l'index relève la boule céleste (−5).`);
        this.mouvoir(et, tige, 'terrestre', k);
        this.mouvoir(et, tige, 'celeste', -5);
      }
      return;
    }

    // Pas assez sur la tige : grand ami (emprunt à la tige de gauche).
    const k = 10 - d;
    if (tige - 1 < 0) throw new ErreurCalcul('Le résultat serait négatif.');
    this.etape('grand-ami', tige,
      `Retirer ${d} des ${nom} (qui valent ${c}) : il n'y a pas assez. `
      + `Grand ami : retirer ${d}, c'est retirer 10 puis ajouter ${k}. `
      + `On retire d'abord 1 sur les ${this.nom(tige - 1)} (l'emprunt), puis on ajoute ${k} sur les ${nom}.`);
    this.retirerEmprunt(tige - 1);
    this.ajouter(tige, k, 'complement');
  }

  /** Retire 1 pour un emprunt ; échoue proprement si tout le nombre à gauche est nul. */
  retirerEmprunt(tige) {
    let t = tige;
    while (t >= 0 && this.chiffre(t) === 0) t--;
    if (t < 0) throw new ErreurCalcul('Le résultat serait négatif.');
    this.retirer(tige, 1, 'emprunt');
  }
}

/**
 * Calcule les étapes pour ajouter (op = '+') ou retirer (op = '-') l'entier n
 * à l'état courant du soroban.
 *
 * @param {Array<{celeste:boolean, terrestres:number}>} etats  état de départ (non modifié)
 * @param {number} tigeUnites  index de la tige des unités
 * @param {'+'|'-'} op
 * @param {number} n  entier naturel
 * @returns {{ etapes: Array, etatFinal: Array, motifs: Array<{cle, tige, role}> }}
 */
export function calculerGestes(etats, tigeUnites, op, n, decimales = 0) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('Entier naturel attendu.');
  // Avec des décimales, n est exprimé en unités de 10^-decimales (ex. 3,75 → n = 375, decimales = 2) :
  // ses derniers chiffres tombent sur les tiges à droite de la tige des unités.
  const calc = new Calculateur(etats, tigeUnites);
  const chiffres = String(n);
  const derniere = tigeUnites + decimales;
  if (chiffres.length > derniere + 1 || derniere >= etats.length) throw new ErreurCalcul('Nombre trop grand pour ce soroban.');
  if (op === '-') {
    // Contrôle préalable : on ne calcule pas les nombres négatifs.
    let v = 0;
    for (let t = 0; t <= derniere; t++) v = v * 10 + chiffreDepuisEtat(etats[t]);
    if (n > v) throw new ErreurCalcul('Le résultat serait négatif.');
  }
  // De gauche à droite : chiffre de plus haut rang d'abord.
  for (let i = 0; i < chiffres.length; i++) {
    const rang = chiffres.length - 1 - i - decimales;
    const tige = tigeUnites - rang;
    const d = Number(chiffres[i]);
    if (op === '+') calc.ajouter(tige, d);
    else if (op === '-') calc.retirer(tige, d);
    else throw new Error(`Opération inconnue : ${op}`);
  }
  return { etapes: calc.etapes, etatFinal: calc.etats, motifs: calc.motifs };
}

/** Liste à plat de tous les mouvements (utile pour le mode pas à pas). */
export function tousLesMouvements(etapes) {
  return etapes.flatMap((e) => e.mouvements);
}
