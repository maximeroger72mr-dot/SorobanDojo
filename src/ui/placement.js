/**
 * Exercice de placement : avant une multiplication ou une division, cliquer LA tige où le calcul
 * commence (dizaine du premier produit, ou premier chiffre du quotient). C'est un réflexe à
 * rendre immédiat : chronométré, avec l'explication de la règle en cas d'erreur.
 *
 * Mêmes options que creerSerie (generer, nombre, chrono, defi, surExercice, surFin, compteur).
 */

import { Soroban } from '../core/soroban.js';
import { noterReponse } from '../core/progression.js';
import { SorobanVue } from './sorobanVue.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from './dom.js';

export function creerPlacement(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, ...o };
  const enonce = h('div', { class: 'operation' });
  const consigne = h('p', { class: 'consigne' });
  const zoneSoroban = h('div', { class: 'zone-soroban placement' });
  const pastilles = h('div', { class: 'pastilles' });
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const retour = h('div', { class: 'retour' });
  const racine = h('div', { class: 'serie' },
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), chrono, compteur),
    enonce, consigne, zoneSoroban, retour);
  conteneur.append(racine);

  let i = 0;
  let ex = null;
  let vue = null;
  let phase = 'question';
  let debutExo = 0;
  let timer = null;
  const debut = performance.now();
  const resultats = [];
  const minuterie = opts.chrono ? setInterval(() => { chrono.textContent = formaterDuree(performance.now() - debut); }, 100) : null;

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre) { terminer(); return; }
    ex = opts.generer();
    phase = 'question';
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
    enonce.textContent = `${formaterNombre(ex.a)} ${ex.op === 'mul' ? '×' : '÷'} ${formaterNombre(ex.b)}`;
    consigne.textContent = ex.op === 'mul'
      ? 'Cliquez la tige où se pose la DIZAINE du premier produit. (La tige des unités est la plus à droite, marquée d\'un point.)'
      : 'Le dividende est posé. Cliquez la tige où se pose le PREMIER chiffre du quotient.';
    vue?.detruire();
    const s = new Soroban(ex.nbTiges);
    if (ex.op === 'div') s.definirValeur(ex.a);
    vue = new SorobanVue(zoneSoroban, s, { interactif: false, etiquettes: false, surTige: (t) => cliquer(s.tigeUnites - t) });
    remplir(retour, h('span', { class: 'discret' }, 'Le plus vite possible.'));
    retour.className = 'retour';
    debutExo = performance.now();
  }

  async function cliquer(rang) {
    if (phase !== 'question') return;
    phase = 'traitement';
    const dureeMs = performance.now() - debutExo;
    const juste = rang === ex.rang;
    const tige = (r) => vue.s.tigeUnites - r;
    vue.marquerTige(tige(ex.rang), 'ok');
    if (!juste) vue.marquerTige(tige(rang), 'erreur');
    resultats.push({ ex, juste, dureeMs, reponse: rang });
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
    await noterReponse(juste);
    await opts.surExercice?.({ juste, dureeMs, t: dureeMs / 1000 }, ex, i);
    if (juste) {
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` ${formaterDuree(dureeMs)}`);
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, opts.defi ? 500 : 700);
      return;
    }
    retour.className = 'retour erreur';
    remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ' La bonne tige est en vert.'),
      h('div', { class: 'detail' }, ex.explication),
      opts.defi ? null : h('div', { class: 'discret' }, 'Entrée pour continuer.'));
    if (opts.defi) {
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, 1500);
    } else {
      phase = 'corrige';
    }
  }

  function terminer() {
    phase = 'fin';
    if (minuterie) clearInterval(minuterie);
    const justes = resultats.filter((r) => r.juste).length;
    opts.surFin?.({ justes, total: resultats.length, dureeMs: performance.now() - debut, resultats: [] });
  }

  const sansRaccourcis = raccourcis({ Enter: () => { if (phase === 'corrige') { i += 1; suivant(); } } });
  suivant();
  return {
    detruire() {
      phase = 'fin';
      clearTimeout(timer);
      if (minuterie) clearInterval(minuterie);
      sansRaccourcis();
      vue?.detruire();
      racine.remove();
    },
  };
}
