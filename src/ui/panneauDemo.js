/**
 * Panneau de démonstration : un soroban virtuel (uniquement pour MONTRER), la liste des étapes
 * expliquées, et les commandes (étape suivante / lecture automatique / rejouer).
 *
 * Une démonstration est :
 *  - soit une opération simple   { depart, op, n } ;
 *  - soit une suite d'étapes      { titre, depart, macros: [{ texte, op, valeur }], nbTiges?,
 *                                   etiquettes?, lecture?, rangsResultat? }
 *    Chaque macro est annoncée par son texte, puis décomposée automatiquement en gestes.
 */

import { Soroban } from '../core/soroban.js';
import { calculerGestes } from '../core/gestes.js';
import { SorobanVue } from './sorobanVue.js';
import { LecteurDemo } from './lecteurDemo.js';
import { h, formaterNombre, remplir } from './dom.js';

const NOMS_REGLES = { direct: 'direct', 'petit-ami': 'petit ami', 'grand-ami': 'grand ami', annonce: '' };
const signe = (op) => (op === '+' ? '+' : '−');

/** Convertit une opération simple en démonstration à étapes. */
function normaliser(demo) {
  if (demo.macros) return demo;
  const { depart, op, n } = demo;
  return {
    titre: `${formaterNombre(depart)} ${signe(op)} ${formaterNombre(n)}`,
    depart,
    macros: [{ texte: null, op, valeur: n }],
    lecture: `Résultat : ${formaterNombre(op === '+' ? depart + n : depart - n)}.`,
  };
}

/** Développe les macros en étapes de gestes, en simulant le soroban. */
function developper(demo, nbTiges) {
  const sim = new Soroban(nbTiges);
  sim.definirValeur(demo.depart);
  const etapes = [];
  for (const m of demo.macros) {
    if (m.texte) etapes.push({ regle: 'annonce', texte: m.texte, mouvements: [] });
    if (!m.valeur) continue;
    const r = calculerGestes(sim.instantane(), sim.tigeUnites, m.op, m.valeur);
    for (const e of r.etapes) {
      etapes.push({ ...e, sous: !!m.texte });
      e.mouvements.forEach((mv) => sim.appliquerMouvement(mv));
    }
  }
  return etapes;
}

export class PanneauDemo {
  constructor(conteneur, nbTiges = 7) {
    this.titre = h('div', { class: 'enonce' });
    this.zone = h('div', { class: 'zone-soroban' });
    this.btnSuivant = h('button', { class: 'btn principal', onclick: () => this.lecteur?.suivant() }, 'Étape suivante ', h('kbd', {}, 'Espace'));
    this.btnAuto = h('button', { class: 'btn', onclick: () => this.rejouer('auto') }, 'Lecture automatique');
    this.btnRejouer = h('button', { class: 'btn', onclick: () => this.rejouer('manuel') }, 'Rejouer pas à pas');
    this.liste = h('ol', { class: 'etapes' });
    this.lecture = h('p', { class: 'retour ok' });
    this.racine = h('div', { class: 'panneau-demo' },
      this.titre, this.zone, h('div', { class: 'ligne' }, this.btnSuivant, this.btnAuto, this.btnRejouer), this.lecture, this.liste);
    conteneur.append(this.racine);
    this._creerSoroban(nbTiges, true);
    this._clavier = (e) => {
      if (e.key === ' ' && this.lecteur && this.racine.isConnected) { e.preventDefault(); this.lecteur.suivant(); }
    };
    window.addEventListener('keydown', this._clavier);
  }

  _creerSoroban(nbTiges, etiquettes) {
    if (this.soroban?.nbTiges === nbTiges && this.vue?.options.etiquettes === etiquettes) return;
    this.vue?.detruire();
    this.soroban = new Soroban(nbTiges);
    this.vue = new SorobanVue(this.zone, this.soroban, { interactif: false, etiquettes });
  }

  /** Joue une démonstration. mode : 'manuel' (l'élève avance) ou 'auto'. */
  async jouer(demoBrute, mode = 'manuel') {
    const demo = normaliser(demoBrute);
    this.demo = demoBrute;
    this.lecteur?.arreter();
    const nbTiges = demo.nbTiges ?? Math.max(5, String(Math.max(demo.depart, 1)).length + 3,
      ...demo.macros.map((m) => String(demo.depart + m.valeur).length + 2));
    this._creerSoroban(nbTiges, demo.etiquettes !== false);
    this.soroban.definirValeur(demo.depart);
    this.vue.nettoyer();
    const etapes = developper(demo, nbTiges);
    this.titre.textContent = demo.titre ?? '';
    this.lecture.textContent = '';
    const items = etapes.map((et) => h('li', { class: et.regle === 'annonce' ? 'annonce' : et.sous ? 'sous' : '' },
      NOMS_REGLES[et.regle] ? h('span', { class: 'regle' }, NOMS_REGLES[et.regle]) : null, et.texte));
    remplir(this.liste, ...items);
    this.btnSuivant.style.display = mode === 'manuel' ? '' : 'none';
    const lecteur = new LecteurDemo(this.soroban, this.vue, etapes, {
      surEtape: (_e, i) => {
        items.forEach((li, j) => li.classList.toggle('courante', j === i));
        items[i]?.scrollIntoView({ block: 'nearest' });
      },
    });
    this.lecteur = lecteur;
    const fini = await lecteur.jouer({ mode, duree: 900 });
    if (this.lecteur === lecteur) this.lecteur = null;
    if (fini) {
      this.btnSuivant.style.display = 'none';
      this.lecture.textContent = demo.lecture ?? '';
      for (const r of demo.rangsResultat ?? []) this.vue.marquerTige(this.soroban.tigeUnites - r, 'ok');
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
 * Ouvre une fenêtre modale. `remplir(corps)` construit le contenu et peut renvoyer une fonction
 * de nettoyage, appelée à la fermeture.
 */
export function ouvrirDialogue(titre, texte, remplir) {
  const corps = h('div', {});
  const dlg = h('dialog', { class: 'dialogue' },
    h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, titre),
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Fermer ', h('kbd', {}, 'Échap'))),
    texte ? h('p', {}, texte) : null,
    corps);
  document.body.append(dlg);
  const nettoyer = remplir(corps);
  dlg.addEventListener('close', () => { nettoyer?.(); dlg.remove(); });
  dlg.showModal();
  return dlg;
}

/** Fenêtre « Voir le geste » : démonstration d'un exemple. */
export function ouvrirDemo({ titre, texte, demo }) {
  ouvrirDialogue(titre, texte, (corps) => {
    const panneau = new PanneauDemo(corps);
    panneau.jouer(demo, 'manuel');
    return () => panneau.detruire();
  });
}
