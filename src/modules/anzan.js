/**
 * Flash anzan : des nombres s'affichent brièvement l'un après l'autre ; l'élève les additionne
 * de tête (en visualisant le soroban) et donne la somme.
 * Réglages : chiffres, nombre de termes, durée d'affichage, nombre de questions.
 */

import { nombreAChiffres } from '../core/aleatoire.js';
import { enregistrerSession } from '../core/progression.js';
import { h, raccourcis, formaterNombre, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { chiffres: 1, termes: 5, duree: 1, questions: 10 };
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

export default {
  id: 'anzan',
  titre: 'Flash anzan',
  monter(el) {
    let actif = true;
    let etat = 'repos'; // repos | flash | reponse | corrige | fin
    let question = null;
    let serie = null;

    const select = (cle, options) => {
      const s = h('select', { onchange: (e) => { reglages[cle] = Number(e.target.value); } }, options.map(([v, t]) => h('option', { value: v }, t)));
      s.value = String(reglages[cle]);
      return s;
    };
    const ecran = h('div', { class: 'flash-ecran' });
    const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', placeholder: 'Somme', autocomplete: 'off', style: 'display:none' });
    const retour = h('div', { class: 'retour' });
    const pastilles = h('div', { class: 'pastilles' });
    const btn = h('button', { class: 'btn principal', onclick: () => action() }, 'Commencer ', h('kbd', {}, 'Entrée'));

    el.append(h('h1', {}, 'Flash anzan'),
      h('p', { class: 'discret' }, 'Les nombres apparaissent un par un. Additionnez-les de tête en imaginant les boules bouger sur un soroban, puis tapez la somme.'),
      h('div', { class: 'reglages' },
        select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres'], [4, '4 chiffres']]),
        select('termes', [3, 4, 5, 7, 10, 15].map((n) => [n, `${n} nombres`])),
        select('duree', [[2, '2 s par nombre'], [1.5, '1,5 s'], [1, '1 s'], [0.7, '0,7 s'], [0.5, '0,5 s'], [0.3, '0,3 s']]),
        select('questions', [[5, '5 questions'], [10, '10 questions']])),
      h('div', { class: 'ligne' }, pastilles), ecran, h('div', { class: 'ligne' }, saisie, btn), retour);

    function nouvelleQuestion() {
      const nombres = [];
      while (nombres.length < reglages.termes) {
        const n = nombreAChiffres(reglages.chiffres);
        if (n !== nombres.at(-1) && n !== 0) nombres.push(n);
      }
      return { nombres, somme: nombres.reduce((a, b) => a + b, 0) };
    }

    async function flash() {
      etat = 'flash';
      btn.style.display = 'none';
      saisie.style.display = 'none';
      remplir(retour);
      question = nouvelleQuestion();
      for (const t of ['3', '2', '1']) {
        ecran.textContent = t;
        ecran.className = 'flash-ecran decompte';
        await attendre(400);
        if (!actif) return;
      }
      ecran.className = 'flash-ecran';
      const affichage = reglages.duree * 1000;
      for (const n of question.nombres) {
        ecran.textContent = formaterNombre(n);
        await attendre(affichage * 0.85);
        ecran.textContent = '';
        await attendre(affichage * 0.15);
        if (!actif) return;
      }
      ecran.textContent = '?';
      etat = 'reponse';
      saisie.style.display = '';
      saisie.disabled = false;
      saisie.value = '';
      saisie.focus();
      btn.style.display = '';
      remplir(btn, 'Valider ', h('kbd', {}, 'Entrée'));
    }

    async function action() {
      if (etat === 'repos' || etat === 'fin') {
        serie = { index: 0, justes: 0, debut: performance.now() };
        remplir(pastilles);
        flash();
      } else if (etat === 'reponse') {
        const brut = saisie.value.replace(/\s/g, '');
        if (!/^\d+$/.test(brut)) return;
        const juste = Number(brut) === question.somme;
        if (juste) serie.justes += 1;
        saisie.disabled = true;
        pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
        ecran.textContent = formaterNombre(question.somme);
        retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
        remplir(retour, h('span', { class: 'grand-signe' }, juste ? '✓' : '✗'), juste ? ' Juste.' : ` Vous avez répondu ${formaterNombre(Number(brut))}.`,
          h('div', { class: 'discret' }, `Nombres : ${question.nombres.map(formaterNombre).join(' + ')} = ${formaterNombre(question.somme)}`));
        serie.index += 1;
        etat = 'corrige';
        remplir(btn, serie.index >= reglages.questions ? 'Voir le bilan ' : 'Question suivante ', h('kbd', {}, 'Entrée'));
      } else if (etat === 'corrige') {
        if (serie.index < reglages.questions) { flash(); return; }
        etat = 'fin';
        await enregistrerSession({ module: 'anzan', mode: 'flash', reglages: { ...reglages }, total: serie.index, justes: serie.justes, dureeMs: performance.now() - serie.debut });
        ecran.textContent = `${serie.justes} / ${serie.index}`;
        retour.className = 'retour';
        const conseil = serie.justes === serie.index ? 'Parfait : réduisez la durée d\'affichage ou ajoutez des nombres.' : serie.justes / serie.index < 0.7 ? 'Allongez un peu la durée d\'affichage pour consolider.' : 'Encore une série au même niveau.';
        remplir(retour, `Réussite ${formaterPourcent(serie.justes, serie.index)}. ${conseil}`);
        remplir(btn, 'Nouvelle série ', h('kbd', {}, 'Entrée'));
      }
    }

    const sansRaccourcis = raccourcis({ Enter: () => { if (etat !== 'flash') action(); } });
    return () => { actif = false; sansRaccourcis(); };
  },
};
