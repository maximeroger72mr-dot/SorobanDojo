/**
 * Métronome (Web Audio, aucun fichier son) : un clic par temps, le premier temps de chaque
 * groupe un peu plus aigu. Sert à tenir un rythme régulier dans les drills.
 */
export class Metronome {
  constructor() {
    this.ctx = null;
    this.minuterie = null;
    this.temps = 0;
  }

  clic(accent) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1320 : 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  /** @param {number} parMinute  temps par minute ; @param {number} groupe  accent tous les N temps */
  demarrer(parMinute, groupe = 4) {
    this.arreter();
    this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    this.temps = 0;
    const tic = () => { this.clic(this.temps % groupe === 0); this.temps += 1; };
    tic();
    this.minuterie = setInterval(tic, 60000 / parMinute);
  }

  arreter() {
    clearInterval(this.minuterie);
    this.minuterie = null;
  }
}
