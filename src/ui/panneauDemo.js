/**
 * Panneau de démonstration réutilisable : un soroban, la liste des étapes expliquées,
 * et les commandes (étape suivante / lecture automatique / rejouer).
 *
 * Utilisé dans « Comprendre » (leçons) et dans la fenêtre « Voir le geste » (remédiation).
 */

import { Soroban } from '../core/soroban.js';
import { calculerGestes } from '../core/gestes.js';
import { SorobanVue } from './sorobanVue.js';
import { LecteurDemo } from './lecteurDemo.js';
import { h, formaterNombre } from './dom.js';

const NOMS_REGLES = { direct: 'direct', 'petit-ami': 'petit ami', 'grand-ami': 'grand ami' };

export class PanneauDemo {
  constructor(conteneur, nbTiges) {
    this.soroban = new Soroban(nbTiges);
    this.titre = h('div', { class: 'enonce' });
    const zone = h('div', { class: 'zone-soroban' });
    this.btnSuivant = h('button', { class: 'btn principal', onclick: () => this.lecteur?.suivant() }, 'Étape suivante ', h('kbd', {}, 'Espace'));
    this.btnAuto = h('button', { class: 'btn', onclick: () => this.rejouer('auto') }, 'Lecture automatique');
    this.btnRejouer = h('button', { class: 'btn', onclick: () => this.rejouer('manuel') }, 'Rejouer pas à pas');
    this.liste = h('ol', { class: 'etapes' });
    this.racine = h('div', { class: 'panneau-demo' },
      this.titre, zone, h('div', { class: 'ligne' }, this.btnSuivant, this.btnAuto, this.btnRejouer), this.liste);
    conteneur.append(this.racine);
    this.vue = new SorobanVue(zone, this.soroban, { interactif: false, etiquettes: true });
    this._clavier = (e) => {
      if (e.key === ' ' && this.lecteur && this.racine.isConnected) { e.preventDefault(); this.lecteur.suivant(); }
    };
    window.addEventListener('keydown', this._clavier);
  }

  /** Joue « depart op n ». mode : 'manuel' (l'élève avance) ou 'auto'. */
  async jouer(demo, mode = 'manuel') {
    this.demo = demo;
    this.lecteur?.arreter();
    const { depart, op, n } = demo;
    this.soroban.definirValeur(depart);
    const { etapes } = calculerGestes(this.soroban.instantane(), this.soroban.tigeUnites, op, n);
    this.titre.textContent = `${formaterNombre(depart)} ${op === '+' ? '+' : '−'} ${formaterNombre(n)}`;
    const items = etapes.map((et) => h('li', { class: et.mouvements.length ? '' : 'annonce' },
      h('span', { class: 'regle' }, NOMS_REGLES[et.regle] ?? et.regle), et.texte));
    this.liste.replaceChildren(...items);
    this.btnSuivant.style.display = mode === 'manuel' ? '' : 'none';
    const lecteur = new LecteurDemo(this.soroban, this.vue, etapes, {
      surEtape: (_e, i) => items.forEach((li, j) => li.classList.toggle('courante', j === i)),
    });
    this.lecteur = lecteur;
    const fini = await lecteur.jouer({ mode, duree: 1000 });
    if (this.lecteur === lecteur) this.lecteur = null;
    if (fini) {
      this.btnSuivant.style.display = 'none';
      this.titre.textContent += ` = ${formaterNombre(this.soroban.valeur())}`;
    }
  }

  rejouer(mode) {
    if (this.demo) this.jouer(this.demo, mode);
  }

  detruire() {
    this.lecteur?.arreter();
    window.removeEventListener('keydown', this._clavier);
    this.vue.detruire();
    this.racine.remove();
  }
}

/**
 * Fenêtre « Voir le geste » : montre un exemple du motif en démonstration pas à pas.
 * @param {{titre:string, texte:string, demo:{depart, op, n}}} o
 */
export function ouvrirDemo({ titre, texte, demo }) {
  const corps = h('div', {});
  const dlg = h('dialog', { class: 'dialogue' },
    h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, titre),
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Fermer ', h('kbd', {}, 'Échap'))),
    h('p', {}, texte),
    corps);
  document.body.append(dlg);
  const nbTiges = Math.max(5, String(demo.depart + demo.n).length + 2);
  const panneau = new PanneauDemo(corps, nbTiges);
  dlg.addEventListener('close', () => { panneau.detruire(); dlg.remove(); });
  dlg.showModal();
  panneau.jouer(demo, 'manuel');
}
