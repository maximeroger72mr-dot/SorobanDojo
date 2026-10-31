/**
 * Vérificateur de gestes (mode pas à pas).
 *
 * On lui donne les étapes attendues (calculées par gestes.js), puis chaque mouvement réel
 * de l'élève. Il répond si le mouvement est juste, et sinon quel était le bon geste.
 *
 * Tolérances volontaires (elles ne changent pas la méthode) :
 *  - plusieurs boules terrestres peuvent être déplacées en un clic ou une par une ;
 *  - à l'intérieur d'une même étape (ex. la « pincée » céleste + terrestres, ou les deux temps
 *    d'un petit ami), l'ordre des deux mouvements est libre, car ils se font presque ensemble.
 * En revanche, l'ordre des étapes est imposé (ex. grand ami : complément d'abord, retenue ensuite).
 */

export class Verificateur {
  constructor(etapes) {
    // On ne garde que les étapes qui comportent des mouvements, avec un « reste à faire » par mouvement.
    this.etapes = etapes
      .filter((e) => e.mouvements.length)
      .map((e) => ({ etape: e, restes: e.mouvements.map((m) => ({ ...m, reste: Math.abs(m.delta) })) }));
    this.index = 0;
  }

  get termine() {
    return this.index >= this.etapes.length;
  }

  /** Étape attendue en ce moment (objet produit par gestes.js), ou null si tout est fait. */
  get etapeCourante() {
    return this.etapes[this.index]?.etape ?? null;
  }

  /** Prochain mouvement attendu, avec delta réduit à ce qui reste à faire. */
  get attendu() {
    const e = this.etapes[this.index];
    if (!e) return null;
    const m = e.restes.find((r) => r.reste > 0);
    return { ...m, delta: Math.sign(m.delta) * m.reste };
  }

  /**
   * Soumet un changement d'état d'une tige ({ tige, avant, apres } comme émis par Soroban).
   * @returns {{ statut: 'ok'|'termine'|'erreur', attendu?, etape? }}
   */
  soumettre({ tige, avant, apres }) {
    if (this.termine) return { statut: 'erreur', attendu: null, etape: null };
    const parts = [];
    if (avant.celeste !== apres.celeste) parts.push({ perle: 'celeste', delta: apres.celeste ? 5 : -5 });
    if (avant.terrestres !== apres.terrestres) parts.push({ perle: 'terrestre', delta: apres.terrestres - avant.terrestres });

    const courant = this.etapes[this.index];
    for (const p of parts) {
      const m = courant.restes.find((r) => r.reste > 0 && r.tige === tige && r.perle === p.perle
        && Math.sign(r.delta) === Math.sign(p.delta) && Math.abs(p.delta) <= r.reste);
      if (!m) return { statut: 'erreur', attendu: this.attendu, etape: courant.etape };
    }
    // Tout est conforme : on décompte.
    for (const p of parts) {
      const m = courant.restes.find((r) => r.reste > 0 && r.tige === tige && r.perle === p.perle
        && Math.sign(r.delta) === Math.sign(p.delta));
      m.reste -= Math.abs(p.delta);
    }
    if (courant.restes.every((r) => r.reste === 0)) this.index += 1;
    return { statut: this.termine ? 'termine' : 'ok' };
  }
}
