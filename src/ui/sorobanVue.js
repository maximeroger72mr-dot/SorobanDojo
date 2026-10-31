/**
 * Affichage SVG interactif d'un Soroban (voir core/soroban.js).
 *
 * La vue ne contient aucune règle de calcul : elle dessine l'état du modèle,
 * transmet les clics au modèle, et offre des outils de mise en évidence
 * (surlignage de tiges ou de boules, indication du doigt à utiliser).
 */

import { nomRang } from '../core/gestes.js';

const NS = 'http://www.w3.org/2000/svg';

// Géométrie (unités SVG). Modifier ici pour changer l'aspect général.
const G = {
  ecart: 54,        // distance entre deux tiges
  marge: 18,        // marge intérieure gauche/droite du cadre
  cadre: 12,        // épaisseur du cadre
  bl: 46,           // largeur d'une boule
  bh: 24,           // hauteur d'une boule
  course: 20,       // distance parcourue par une boule entre repos et barre
  barre: 8,         // épaisseur de la barre
  haut: 22,         // espace au-dessus du cadre (indication du doigt)
  bas: 34,          // espace sous le cadre (étiquettes)
};

const ABREV = ['u', 'd', 'c', 'm', 'dm', 'cm', 'M', 'dM', 'cM', 'G', 'dG', 'cG'];

function el(nom, attrs = {}, parent) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/** Contour hexagonal d'une boule (forme bicône vue de face). */
function formeBoule() {
  const { bl: w, bh } = G;
  const h = bh - 2;
  return `0,${h / 2} ${w * 0.2},0 ${w * 0.8},0 ${w},${h / 2} ${w * 0.8},${h} ${w * 0.2},${h}`;
}

export class SorobanVue {
  /**
   * @param {HTMLElement} conteneur
   * @param {import('../core/soroban.js').Soroban} soroban
   * @param {{interactif?: boolean, etiquettes?: boolean, valeurs?: boolean}} options
   *   etiquettes : affiche le rang sous chaque tige (u, d, c…)
   *   valeurs    : affiche le chiffre de chaque tige (aide pour débutant)
   *   surTige    : (tige) => void — rend chaque tige cliquable (exercice de placement)
   */
  constructor(conteneur, soroban, options = {}) {
    this.s = soroban;
    this.options = { interactif: true, etiquettes: false, valeurs: false, ...options };
    this.conteneur = conteneur;

    const n = soroban.nbTiges;
    this.largeur = G.marge * 2 + G.ecart * n;
    this.yBarre = G.haut + G.cadre + G.bh + G.course; // haut de la barre
    this.yBas = this.yBarre + G.barre + G.course + 4 * G.bh; // bas intérieur du cadre
    this.hauteur = this.yBas + G.cadre + G.bas;

    this.svg = el('svg', {
      class: 'soroban',
      viewBox: `0 0 ${this.largeur} ${this.hauteur}`,
      role: 'img',
      'aria-label': 'Soroban',
    });
    this.dessiner();
    conteneur.appendChild(this.svg);

    this._desabonner = soroban.surChangement((evt) => this.mettreAJourTige(evt.tige));
    for (let t = 0; t < n; t++) this.mettreAJourTige(t);
    this.definirInteractif(this.options.interactif);
  }

  xTige(t) {
    return G.marge + G.ecart * t + G.ecart / 2;
  }

  dessiner() {
    const { svg } = this;
    const yCadre = G.haut;
    // Cadre
    el('rect', {
      class: 'cadre', x: 0, y: yCadre, width: this.largeur, height: this.yBas + G.cadre - yCadre, rx: 4,
    }, svg);
    el('rect', {
      class: 'fond', x: G.cadre, y: yCadre + G.cadre,
      width: this.largeur - 2 * G.cadre, height: this.yBas - yCadre - G.cadre,
    }, svg);

    this.groupesTiges = [];
    for (let t = 0; t < this.s.nbTiges; t++) {
      const x = this.xTige(t);
      const g = el('g', { class: 'tige', 'data-tige': t }, svg);
      el('line', { class: 'axe', x1: x, x2: x, y1: yCadre + G.cadre, y2: this.yBas }, g);

      const forme = formeBoule();
      const celeste = el('polygon', { class: 'boule celeste', points: forme, 'data-perle': 'celeste' }, g);
      const terrestres = [0, 1, 2, 3].map((k) => el('polygon', {
        class: 'boule terrestre', points: forme, 'data-perle': 'terrestre', 'data-k': k,
      }, g));

      // Étiquettes sous le cadre
      const yTxt = this.yBas + G.cadre + 15;
      const etiquette = el('text', { class: 'etiquette', x, y: yTxt, 'text-anchor': 'middle' }, g);
      etiquette.textContent = ABREV[this.s.rang(t)] ?? '';
      const titre = el('title', {}, etiquette);
      titre.textContent = nomRang(this.s.rang(t));
      const valeur = el('text', { class: 'valeur-tige', x, y: yTxt + 15, 'text-anchor': 'middle' }, g);

      // Indication du doigt (au-dessus du cadre)
      const doigt = el('text', { class: 'doigt', x, y: G.haut - 6, 'text-anchor': 'middle' }, g);

      this.groupesTiges.push({ g, celeste, terrestres, etiquette, valeur, doigt });
    }

    // Barre et points de repère (dessinés après les tiges, donc par-dessus)
    el('rect', {
      class: 'barre', x: G.cadre, y: this.yBarre, width: this.largeur - 2 * G.cadre, height: G.barre,
    }, svg);
    for (let t = 0; t < this.s.nbTiges; t++) {
      if (this.s.estMarquee(t)) {
        el('circle', { class: 'repere', cx: this.xTige(t), cy: this.yBarre + G.barre / 2, r: 2.2 }, svg);
      }
    }

    // Zones de clic par tige (placement) : un rectangle transparent couvrant toute la tige.
    if (this.options.surTige) {
      for (let t = 0; t < this.s.nbTiges; t++) {
        const zone = el('rect', {
          class: 'zone-tige', 'data-tige': t, x: this.xTige(t) - G.ecart / 2, y: G.haut, width: G.ecart, height: this.yBas + G.cadre - G.haut, fill: 'transparent',
        }, svg);
        zone.addEventListener('pointerdown', (e) => { e.preventDefault(); this.options.surTige(t); });
      }
    }

    // Un seul écouteur pour tout le soroban. pointerdown : réaction immédiate, sans attendre le relâchement.
    this._surPointeur = (e) => {
      if (!this.options.interactif) return;
      const boule = e.target.closest?.('.boule');
      if (!boule) return;
      e.preventDefault();
      const t = Number(boule.parentNode.dataset.tige);
      if (boule.dataset.perle === 'celeste') this.s.basculerCeleste(t, 'eleve');
      else this.s.pousserTerrestre(t, Number(boule.dataset.k), 'eleve');
    };
    svg.addEventListener('pointerdown', this._surPointeur);
    this.appliquerOptions();
  }

  /** Place les boules d'une tige selon l'état du modèle (la transition CSS anime le déplacement). */
  mettreAJourTige(t) {
    const etat = this.s.tiges[t];
    const r = this.groupesTiges[t];
    const x = this.xTige(t) - G.bl / 2;
    const yCel = etat.celeste ? this.yBarre - G.bh : G.haut + G.cadre;
    r.celeste.style.transform = `translate(${x}px, ${yCel}px)`;
    r.celeste.classList.toggle('active', etat.celeste);
    r.terrestres.forEach((b, k) => {
      const active = k < etat.terrestres;
      const y = this.yBarre + G.barre + k * G.bh + (active ? 0 : G.course);
      b.style.transform = `translate(${x}px, ${y}px)`;
      b.classList.toggle('active', active);
    });
    r.valeur.textContent = String(this.s.chiffre(t));
  }

  definirInteractif(oui) {
    this.options.interactif = oui;
    this.svg.classList.toggle('interactif', oui);
  }

  definirOptions(opts) {
    Object.assign(this.options, opts);
    this.appliquerOptions();
  }

  appliquerOptions() {
    this.svg.classList.toggle('avec-etiquettes', !!this.options.etiquettes);
    this.svg.classList.toggle('avec-valeurs', !!this.options.valeurs);
  }

  // ---------------------------------------------------------------- mises en évidence

  /** Ajoute une classe CSS ('erreur', 'ok', 'cible'…) à une tige entière. */
  marquerTige(t, classe) {
    this.groupesTiges[t]?.g.classList.add(classe);
  }

  /** Met en évidence les boules concernées par un mouvement (avant de l'appliquer). */
  marquerMouvement(m) {
    const r = this.groupesTiges[m.tige];
    if (m.perle === 'celeste') {
      r.celeste.classList.add('bouge');
    } else {
      const b = this.s.tiges[m.tige].terrestres;
      const [de, a] = m.delta > 0 ? [b, b + m.delta] : [b + m.delta, b];
      for (let k = de; k < a; k++) r.terrestres[k].classList.add('bouge');
    }
    r.doigt.textContent = m.doigt === 'pouce' ? 'pouce ↑' : `index ${m.sens === 'monte' ? '↑' : '↓'}`;
  }

  /** Retire toutes les mises en évidence. */
  nettoyer() {
    for (const r of this.groupesTiges) {
      r.g.classList.remove('erreur', 'ok', 'cible');
      r.celeste.classList.remove('bouge');
      r.terrestres.forEach((b) => b.classList.remove('bouge'));
      r.doigt.textContent = '';
    }
  }

  detruire() {
    this._desabonner();
    this.svg.removeEventListener('pointerdown', this._surPointeur);
    this.svg.remove();
  }
}
