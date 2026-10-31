/**
 * Exécution d'un exercice sur le soroban virtuel, avec vérification de chaque geste.
 *
 * Utilisé par les leçons, les tests, les révisions et les planches.
 * Pour chaque terme de l'exercice, le moteur calcule les gestes attendus ; chaque mouvement
 * de l'élève est vérifié. Un mauvais mouvement est annulé (la tige revient à son état
 * précédent), le motif concerné est noté, et le bon geste est mis en évidence.
 *
 * Sans vérification (verifierGestes = false), l'élève calcule librement et appelle valider().
 */

import { calculerGestes } from '../core/gestes.js';
import { Verificateur } from '../core/verificateur.js';

export class ExerciceSoroban {
  /**
   * @param {object} o
   * @param {import('../core/soroban.js').Soroban} o.soroban
   * @param {import('./sorobanVue.js').SorobanVue} o.vue
   * @param {boolean} [o.verifierGestes=true]
   * @param {(info:{etape, attendu}) => void} [o.surErreur]   mauvais geste
   * @param {(i:number) => void} [o.surTerme]                  passage au terme i
   * @param {() => void} [o.surBonGeste]                       geste conforme
   */
  constructor(o) {
    Object.assign(this, { verifierGestes: true, ...o });
    this._desabonner = this.soroban.surChangement((evt) => this._surMouvement(evt));
    this._resoudre = null;
  }

  /**
   * Lance un exercice { depart, termes: [{op, n}], resultat, motifs }.
   * @returns {Promise<{juste:boolean, motifsRates:string[], motifs:string[], dureeMs:number, interrompu?:boolean}>}
   */
  lancer(exercice) {
    this.exercice = exercice;
    this.terme = 0;
    this.motifsRates = [];
    this.debut = performance.now();
    this.soroban.definirValeur(exercice.depart, 'programme');
    this.vue.nettoyer();
    this.vue.definirInteractif(true);
    this._preparerTerme();
    return new Promise((ok) => { this._resoudre = ok; });
  }

  _preparerTerme() {
    const { op, n } = this.exercice.termes[this.terme];
    const r = calculerGestes(this.soroban.instantane(), this.soroban.tigeUnites, op, n);
    this.verif = new Verificateur(r.etapes);
    this.surTerme?.(this.terme);
  }

  _surMouvement(evt) {
    if (evt.source !== 'eleve' || !this._resoudre || !this.verifierGestes) return;
    const r = this.verif.soumettre(evt);
    if (r.statut === 'erreur') {
      // On annule le mouvement : le soroban reste dans l'état attendu.
      this.soroban.definirEtat(evt.tige, evt.avant, 'correction');
      if (r.etape?.motif && !this.motifsRates.includes(r.etape.motif)) this.motifsRates.push(r.etape.motif);
      this.vue.nettoyer();
      if (r.attendu) this.vue.marquerMouvement(r.attendu);
      this.surErreur?.({ etape: r.etape, attendu: r.attendu });
      return;
    }
    this.vue.nettoyer();
    this.surBonGeste?.();
    if (r.statut === 'termine') {
      if (this.terme < this.exercice.termes.length - 1) {
        this.terme += 1;
        this._preparerTerme();
      } else {
        this._terminer(this.motifsRates.length === 0);
      }
    }
  }

  /** Mode sans vérification : l'élève déclare avoir fini. */
  valider() {
    if (!this._resoudre) return;
    this._terminer(this.soroban.valeur() === this.exercice.resultat);
  }

  /** Met en évidence le prochain geste attendu ; renvoie l'étape (pour en afficher le texte). */
  indice() {
    if (!this._resoudre || !this.verif || this.verif.termine) return null;
    this.vue.nettoyer();
    this.vue.marquerMouvement(this.verif.attendu);
    return this.verif.etapeCourante;
  }

  _terminer(juste) {
    const ok = this._resoudre;
    this._resoudre = null;
    this.vue.definirInteractif(false);
    ok({
      juste,
      motifsRates: [...this.motifsRates],
      motifs: this.exercice.motifs,
      dureeMs: performance.now() - this.debut,
    });
  }

  arreter() {
    const ok = this._resoudre;
    this._resoudre = null;
    ok?.({ juste: false, motifsRates: [], motifs: [], dureeMs: 0, interrompu: true });
  }

  detruire() {
    this.arreter();
    this._desabonner();
  }
}
