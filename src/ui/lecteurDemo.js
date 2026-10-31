/**
 * Lecteur de démonstration : rejoue des étapes calculées par core/gestes.js sur un soroban affiché.
 *
 * Deux modes :
 *  - 'auto'   : enchaîne les étapes à la vitesse choisie ;
 *  - 'manuel' : attend un appel à suivant() entre chaque étape (l'élève avance à son rythme).
 */

const attendre = (ms, signal) => new Promise((ok, ko) => {
  const id = setTimeout(ok, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); ko(new DOMException('arrêt', 'AbortError')); }, { once: true });
});

export class LecteurDemo {
  /**
   * @param {import('../core/soroban.js').Soroban} soroban
   * @param {import('./sorobanVue.js').SorobanVue} vue
   * @param {Array} etapes
   * @param {{surEtape?: (etape, index) => void, surFin?: () => void}} rappels
   */
  constructor(soroban, vue, etapes, rappels = {}) {
    Object.assign(this, { soroban, vue, etapes, rappels });
    this.controle = new AbortController();
    this._suivant = null;
  }

  /**
   * Lance la démonstration.
   * @param {{mode?: 'auto'|'manuel', duree?: number}} opts  duree : temps (ms) par mouvement
   * @returns {Promise<boolean>} true si terminée, false si interrompue
   */
  async jouer({ mode = 'auto', duree = 900 } = {}) {
    const signal = this.controle.signal;
    try {
      for (let i = 0; i < this.etapes.length; i++) {
        const etape = this.etapes[i];
        if (mode === 'manuel' && i > 0) await this._attendreSuivant(signal);
        this.rappels.surEtape?.(etape, i);
        if (etape.mouvements.length === 0) {
          // Simple annonce : laisser le temps de la lire.
          if (mode === 'auto') await attendre(duree * 1.6, signal);
          continue;
        }
        for (const m of etape.mouvements) {
          this.vue.marquerMouvement(m);
          await attendre(duree * 0.55, signal);
          this.soroban.appliquerMouvement(m, 'demo');
          await attendre(duree * 0.45, signal);
          this.vue.nettoyer();
        }
        if (mode === 'auto') await attendre(duree * 0.5, signal);
      }
      this.rappels.surFin?.();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') { this.vue.nettoyer(); return false; }
      throw e;
    }
  }

  _attendreSuivant(signal) {
    return new Promise((ok, ko) => {
      this._suivant = ok;
      signal.addEventListener('abort', () => ko(new DOMException('arrêt', 'AbortError')), { once: true });
    });
  }

  /** En mode manuel : passe à l'étape suivante. */
  suivant() {
    const f = this._suivant;
    this._suivant = null;
    f?.();
  }

  arreter() {
    this.controle.abort();
  }
}
