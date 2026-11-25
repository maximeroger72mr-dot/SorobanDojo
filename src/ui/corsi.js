/**
 * 0.41 : test de mémoire visuo-spatiale (empan de Corsi, 2 minutes). Des cases s'allument l'une
 * après l'autre sur une grille de 3 × 3 ; on les touche ensuite dans le même ordre. La suite s'allonge
 * d'une case après une réussite ; deux échecs à la même longueur arrêtent le test. L'empan (la plus
 * longue suite réussie) règle la longueur de départ des chaînes d'anzan : selon Barner et al. (2016),
 * cette mémoire prédit la progression en anzan, et l'entraînement ne la change guère.
 */

import { h, remplir } from './dom.js';

const attendre = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * @param {HTMLElement} conteneur
 * @param {(empan: number) => void} surFin
 */
export function testCorsi(conteneur, surFin) {
  const cases = Array.from({ length: 9 }, (_, i) => h('button', { class: 'corsi-case', 'aria-label': `Case ${i + 1}`, disabled: true }));
  const grille = h('div', { class: 'corsi-grille' }, cases);
  const message = h('p', { class: 'retour', role: 'status', 'aria-live': 'polite' }, 'Regardez les cases qui s\'allument, puis touchez-les dans le même ordre.');
  remplir(conteneur, h('div', { class: 'carte corsi' }, h('h2', { style: 'margin-top:0' }, 'Mémoire visuelle (2 minutes)'), message, grille));
  let longueur = 2;
  let echecs = 0;
  let empan = 0;
  let fini = false;

  async function manche() {
    const suite = [];
    while (suite.length < longueur) { const k = Math.floor(Math.random() * 9); if (suite.at(-1) !== k) suite.push(k); }
    cases.forEach((c) => { c.disabled = true; });
    message.textContent = `Suite de ${longueur} : regardez.`;
    await attendre(600);
    for (const k of suite) {
      cases[k].classList.add('allumee');
      await attendre(650);
      cases[k].classList.remove('allumee');
      await attendre(250);
    }
    message.textContent = 'À vous : touchez les cases dans le même ordre.';
    const reponse = [];
    await new Promise((fin) => {
      cases.forEach((c, i) => {
        c.disabled = false;
        c.onclick = () => {
          reponse.push(i);
          c.classList.add('touchee');
          setTimeout(() => c.classList.remove('touchee'), 200);
          if (reponse.length === suite.length) fin();
        };
      });
    });
    const ok = reponse.every((x, i) => x === suite[i]);
    if (ok) { empan = longueur; longueur += 1; echecs = 0; message.textContent = 'Juste.'; } else { echecs += 1; message.textContent = 'Pas tout à fait.'; }
    await attendre(700);
    if (echecs >= 2 || longueur > 9) {
      fini = true;
      cases.forEach((c) => { c.disabled = true; });
      message.textContent = `Votre empan : ${empan} case${empan > 1 ? 's' : ''}. Les chaînes d'anzan partiront de ${Math.max(2, empan - 2)} nombres, puis s'allongeront à votre rythme.`;
      surFin(empan);
      return;
    }
    manche();
  }
  manche();
  return { detruire: () => { fini = true; } };
}
