/**
 * Modèle du soroban (boulier japonais moderne, 1 boule céleste + 4 boules terrestres par tige).
 *
 * Vocabulaire utilisé dans tout le code :
 *  - tige       : une colonne du soroban. Les tiges sont indexées de GAUCHE à DROITE (0 = la plus à gauche).
 *  - barre      : la barre horizontale (poutre) qui sépare le haut et le bas.
 *  - céleste    : la boule du haut, elle vaut 5 quand elle est abaissée contre la barre.
 *  - terrestre  : les 4 boules du bas, chacune vaut 1 quand elle est remontée contre la barre.
 *  - tige des unités : la tige qui porte le chiffre des unités. Elle est marquée d'un point sur la barre,
 *                 comme toutes les tiges situées à 3, 6, 9… rangs à sa gauche (milliers, millions…).
 *
 * Une boule « compte » uniquement quand elle touche la barre. C'est la règle fondamentale de lecture.
 *
 * L'état d'une tige est un petit objet { celeste: boolean, terrestres: 0..4 }.
 * Le chiffre de la tige vaut (celeste ? 5 : 0) + terrestres.
 */

/** Crée l'état d'une tige à partir d'un chiffre 0..9. */
export function etatDepuisChiffre(chiffre) {
  if (!Number.isInteger(chiffre) || chiffre < 0 || chiffre > 9) {
    throw new RangeError(`Chiffre invalide : ${chiffre}`);
  }
  return { celeste: chiffre >= 5, terrestres: chiffre % 5 };
}

/** Valeur (0..9) d'une tige. */
export function chiffreDepuisEtat(etat) {
  return (etat.celeste ? 5 : 0) + etat.terrestres;
}

export class Soroban {
  /**
   * @param {number} nbTiges   nombre de tiges (13 sur un soroban d'étude courant)
   * @param {number} [tigeUnites] index de la tige des unités (par défaut : la plus à droite)
   */
  constructor(nbTiges = 13, tigeUnites = nbTiges - 1) {
    this.nbTiges = nbTiges;
    this.tigeUnites = tigeUnites;
    this.tiges = Array.from({ length: nbTiges }, () => ({ celeste: false, terrestres: 0 }));
    this._ecouteurs = new Set();
  }

  // ---------------------------------------------------------------- écoute des changements

  /**
   * Abonne une fonction aux changements. Elle reçoit
   * { tige, avant, apres, source } — source = 'eleve', 'demo', 'programme'…
   * Retourne une fonction de désabonnement.
   */
  surChangement(fn) {
    this._ecouteurs.add(fn);
    return () => this._ecouteurs.delete(fn);
  }

  _changer(tige, nouvelEtat, source) {
    const avant = { ...this.tiges[tige] };
    if (avant.celeste === nouvelEtat.celeste && avant.terrestres === nouvelEtat.terrestres) return;
    this.tiges[tige] = { ...nouvelEtat };
    const evt = { tige, avant, apres: { ...nouvelEtat }, source };
    this._ecouteurs.forEach((fn) => fn(evt));
  }

  // ---------------------------------------------------------------- lecture

  chiffre(tige) {
    return chiffreDepuisEtat(this.tiges[tige]);
  }

  /** Rang décimal d'une tige : 0 = unités, 1 = dizaines, -1 = dixièmes… */
  rang(tige) {
    return this.tigeUnites - tige;
  }

  /** Une tige porte-t-elle un point de repère (unités, milliers, millions…) ? */
  estMarquee(tige) {
    return this.rang(tige) % 3 === 0;
  }

  /** Valeur entière affichée (les tiges à droite des unités sont ignorées). */
  valeur() {
    let v = 0;
    for (let t = 0; t <= this.tigeUnites; t++) v = v * 10 + this.chiffre(t);
    return v;
  }

  /** Copie de l'état complet (tableau d'états de tiges). */
  instantane() {
    return this.tiges.map((e) => ({ ...e }));
  }

  // ---------------------------------------------------------------- écriture

  definirEtat(tige, etat, source = 'programme') {
    if (etat.terrestres < 0 || etat.terrestres > 4) throw new RangeError('terrestres hors limites');
    this._changer(tige, etat, source);
  }

  definirChiffre(tige, chiffre, source = 'programme') {
    this._changer(tige, etatDepuisChiffre(chiffre), source);
  }

  /**
   * Pose un entier naturel, aligné sur la tige des unités. Les autres tiges sont remises à zéro.
   * decimales : n est exprimé en unités de 10^-decimales (3,75 → n = 375, decimales = 2).
   */
  definirValeur(n, source = 'programme', decimales = 0) {
    if (!Number.isInteger(n) || n < 0) throw new RangeError('Seuls les entiers naturels sont gérés.');
    const chiffres = String(n);
    if (chiffres.length > this.tigeUnites + 1 + decimales) throw new RangeError('Nombre trop grand pour ce soroban.');
    for (let t = 0; t < this.nbTiges; t++) {
      const r = this.rang(t) + decimales;
      const c = r >= 0 && r < chiffres.length ? Number(chiffres[chiffres.length - 1 - r]) : 0;
      this.definirChiffre(t, c, source);
    }
  }

  effacer(source = 'programme') {
    for (let t = 0; t < this.nbTiges; t++) this.definirChiffre(t, 0, source);
  }

  // ---------------------------------------------------------------- gestes de l'élève (clics)

  /**
   * Clic sur la boule céleste : elle bascule (abaissée <-> relevée).
   */
  basculerCeleste(tige, source = 'eleve') {
    const e = this.tiges[tige];
    this._changer(tige, { celeste: !e.celeste, terrestres: e.terrestres }, source);
  }

  /**
   * Clic sur une boule terrestre. k = 0 pour la boule la plus proche de la barre, 3 pour la plus basse.
   * Comme sur un vrai soroban, déplacer une boule entraîne celles qui sont devant elle :
   *  - boule en bas (inactive) : on la remonte avec toutes celles qui la séparent de la barre ;
   *  - boule en haut (active)  : on la descend avec toutes celles qui sont en dessous d'elle.
   */
  pousserTerrestre(tige, k, source = 'eleve') {
    const e = this.tiges[tige];
    const active = k < e.terrestres;
    this._changer(tige, { celeste: e.celeste, terrestres: active ? k : k + 1 }, source);
  }

  /**
   * Applique un mouvement élémentaire produit par le moteur de gestes (voir gestes.js).
   * mouvement = { tige, perle: 'celeste'|'terrestre', delta }
   */
  appliquerMouvement(m, source = 'demo') {
    const e = this.tiges[m.tige];
    if (m.perle === 'celeste') {
      this._changer(m.tige, { celeste: m.delta > 0, terrestres: e.terrestres }, source);
    } else {
      this._changer(m.tige, { celeste: e.celeste, terrestres: e.terrestres + m.delta }, source);
    }
  }
}
