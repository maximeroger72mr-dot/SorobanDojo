/**
 * Questions courtes des leçons « Lire et poser un nombre » et « Les paires qui font 5 / 10 » :
 *  - lire : un soroban s'affiche, on tape le nombre ;
 *  - poser : un nombre s'affiche, on le pose sur SON soroban, Entrée ; le nombre disparaît et
 *    l'on donne le chiffre d'une tige tirée au hasard (la pose devient vérifiable) ;
 *  - complement : « 3 et ? font 5 », on tape le complément.
 *
 * Mêmes options que creerSerie / creerPlacement (generer, nombre, chrono, defi, surExercice,
 * surFin, compteur).
 */

import { Soroban } from '../core/soroban.js';
import { noterReponse } from '../core/progression.js';
import { decrireChiffre } from '../modules/lecture.js';
import { SorobanVue } from './sorobanVue.js';
import { h, raccourcis, formaterDuree, remplir } from './dom.js';

export function creerQuestions(conteneur, o) {
  const opts = { nombre: Infinity, chrono: false, defi: false, ...o };
  const enonce = h('div', { class: 'operation' });
  const consigne = h('p', { class: 'consigne' });
  const zoneSoroban = h('div', { class: 'zone-soroban', style: 'max-width:320px' });
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', 'aria-label': 'Votre réponse' });
  const valider = h('button', { class: 'btn principal', onclick: () => entree() }, 'Valider');
  const zoneSaisie = h('div', { class: 'ligne' }, saisie, valider);
  const pastilles = h('div', { class: 'pastilles' });
  const compteur = h('span', { class: 'compteur' });
  const chrono = h('span', { class: 'compteur chrono' });
  const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
  const racine = h('div', { class: 'serie' },
    h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), chrono, compteur),
    enonce, zoneSoroban, consigne, zoneSaisie, retour);
  conteneur.append(racine);

  let i = 0;
  let ex = null;
  let vue = null;
  let phase = 'question';
  let debutExo = 0;
  let timer = null;
  const debut = performance.now();
  let justes = 0;
  const minuterie = opts.chrono ? setInterval(() => { chrono.textContent = formaterDuree(performance.now() - debut); }, 100) : null;

  const montrerSaisie = (oui) => { zoneSaisie.style.display = oui ? '' : 'none'; if (oui) { saisie.value = ''; saisie.focus(); } };

  function suivant() {
    clearTimeout(timer);
    if (i >= opts.nombre) { terminer(); return; }
    ex = opts.generer();
    compteur.textContent = opts.compteur ? opts.compteur(i) : (Number.isFinite(opts.nombre) ? `${i + 1} / ${opts.nombre}` : '');
    vue?.detruire();
    vue = null;
    remplir(zoneSoroban);
    retour.className = 'retour';
    remplir(retour);
    if (ex.type === 'lire') {
      enonce.textContent = '';
      const s = new Soroban(5);
      s.definirValeur(ex.n);
      vue = new SorobanVue(zoneSoroban, s, { interactif: false, etiquettes: false });
      consigne.textContent = 'Quel nombre montre le soroban ? (La tige des unités est la plus à droite.)';
      phase = 'question';
      montrerSaisie(true);
    } else if (ex.type === 'poser') {
      enonce.textContent = ex.n.toLocaleString('fr-FR');
      consigne.textContent = 'Posez ce nombre sur votre soroban, puis appuyez sur Entrée.';
      phase = 'pose';
      montrerSaisie(false);
      remplir(retour, h('button', { class: 'btn principal', onclick: () => entree() }, 'C\'est posé ', h('kbd', {}, 'Entrée')));
    } else {
      enonce.textContent = `${ex.a} et ? font ${ex.cible}`;
      consigne.textContent = `Tapez ce qui manque à ${ex.a} pour faire ${ex.cible}.`;
      phase = 'question';
      montrerSaisie(true);
    }
    debutExo = performance.now();
  }

  function entree() {
    if (phase === 'pose') {
      // Le nombre disparaît : la réponse se lit sur le soroban de l'élève.
      enonce.textContent = '';
      consigne.textContent = `Sur votre soroban : quel chiffre sur la tige des ${ex.nomTige} ?`;
      remplir(retour);
      phase = 'question';
      montrerSaisie(true);
      debutExo = performance.now();
      return;
    }
    if (phase === 'corrige') { i += 1; suivant(); return; }
    if (phase !== 'question') return;
    const brut = saisie.value.replace(/\s/g, '');
    if (!/^\d+$/.test(brut)) { retour.className = 'retour'; retour.textContent = 'Tapez un nombre.'; return; }
    repondre(Number(brut));
  }

  async function repondre(r) {
    phase = 'traitement';
    const dureeMs = performance.now() - debutExo;
    const juste = r === ex.resultat;
    if (juste) justes += 1;
    pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
    await noterReponse(juste);
    await opts.surExercice?.({ juste, dureeMs, t: dureeMs / 1000 }, ex, i);
    montrerSaisie(false);
    if (juste) {
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'));
      phase = 'transition';
      timer = setTimeout(() => { if (phase === 'transition') { i += 1; suivant(); } }, opts.defi ? 350 : 600);
      return;
    }
    retour.className = 'retour erreur';
    let detail;
    if (ex.type === 'complement') detail = `${ex.a} et ${ex.resultat} font ${ex.cible}.`;
    else if (ex.type === 'lire') detail = `C'était ${ex.n.toLocaleString('fr-FR')}. ${String(ex.n).split('').map((c, k, t) => `${['unités', 'dizaines', 'centaines'][t.length - 1 - k]} : ${decrireChiffre(Number(c))}`).reverse().join(' ; ')}.`;
    else detail = `Le nombre était ${ex.n.toLocaleString('fr-FR')} : ${ex.resultat} sur les ${ex.nomTige} (${decrireChiffre(ex.resultat)}). Vérifiez votre tige des unités : c'est elle qui aligne tout.`;
    remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Réponse : ${ex.resultat}.`),
      h('div', { class: 'detail' }, detail), h('div', { class: 'discret' }, 'Entrée pour continuer.'));
    phase = 'corrige';
  }

  function terminer() {
    phase = 'fin';
    if (minuterie) clearInterval(minuterie);
    vue?.detruire();
    vue = null;
    opts.surFin?.({ justes, total: i, dureeMs: performance.now() - debut, resultats: [] });
  }

  saisie.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); entree(); } });
  const sansRaccourcis = raccourcis({ Enter: () => { if (phase === 'pose' || phase === 'corrige') entree(); } });
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
