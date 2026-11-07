/**
 * Exécution d'un drill sur son propre soroban.
 *
 * Seul le chronomètre compte : on démarre, on enchaîne les opérations sur son soroban, on
 * arrête (Entrée). Puis on TAPE le nombre lu sur son soroban (la frappe ne compte pas dans le
 * temps) : l'application le compare au résultat attendu. Validation, médailles et records ne
 * reposent donc que sur un soroban qui affiche vraiment le bon nombre. En cas d'écart, les
 * chiffres qui diffèrent sont signalés, pour retrouver la tige fautive.
 *
 * Aides : points de contrôle (sous-totaux) et DOIGTÉ (la suite exacte des gestes de chaque
 * opération), pour repérer un mouvement qui gêne ou bloque ; chaque opération se rejoue en animation.
 * Fantôme : une barre montre où en serait votre record.
 * Métronome : un clic par opération, au tempo choisi (ou au rythme de votre record), pour enchaîner
 * régulièrement ; « + 5 % » pour accélérer doucement.
 */

import { controles, tigesFausses } from '../core/drills.js';
import { calculerGestes } from '../core/gestes.js';
import { Soroban } from '../core/soroban.js';
import { PanneauDemo, ouvrirDialogue } from './panneauDemo.js';
import { Metronome } from './metronome.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from './dom.js';
import { lireReponse } from '../core/nombres.js';

const ABREV = ['u', 'd', 'c', 'm', 'dm', 'cm', 'M', 'dM', 'cM', 'G', 'dG', 'cG'];
const signe = (op) => (op === '+' ? '+' : '−');

/** Doigté d'une opération : une entrée par étape gestuelle (ex. « d · petit ami : céleste ↓ · index ↓1 »). */
export function doigte(depart, op, n) {
  const nbTiges = String(Math.max(depart, n)).length + 3;
  const s = new Soroban(nbTiges);
  s.definirValeur(depart);
  const { etapes } = calculerGestes(s.instantane(), s.tigeUnites, op, n);
  return etapes.filter((e) => e.mouvements.length).map((e) => {
    const tige = ABREV[s.tigeUnites - e.tige] ?? '?';
    const regle = { 'petit-ami': ' petit ami', 'grand-ami': ' grand ami' }[e.regle] ?? '';
    const gestes = e.mouvements.map((m) => (m.perle === 'celeste'
      ? `céleste ${m.sens === 'descend' ? '↓' : '↑'}`
      : `${m.doigt} ${m.sens === 'monte' ? '↑' : '↓'}${Math.abs(m.delta)}`)).join(' · ');
    return `${tige}${regle} : ${gestes}`;
  });
}

function ecartChiffres(lu, attendu) {
  const f = tigesFausses(lu, attendu);
  const texte = f.length === 1 ? `Une seule tige diffère : les ${f[0]}.`
    : f.length <= 3 ? `${f.length} tiges diffèrent : ${f.reverse().join(', ')}.`
      : `${f.length} tiges diffèrent : le calcul a dû dérailler tôt, reprenez avec les points de contrôle.`;
  return h('div', { class: 'discret' }, texte);
}

/**
 * @param {HTMLElement} conteneur
 * @param {object} d  drill (voir core/drills.js)
 * @param {{ record?: {dureeMs:number}|null, surFin?: (r:{juste:boolean, dureeMs:number}) => any }} o
 */
export function creerDrill(conteneur, d, o = {}) {
  const ctrl = controles(d.operations);
  let etat = 'pret'; // pret | course | verification | fini
  let debut = 0;
  let dureeMs = 0;
  let voirControles = false;
  let voirDoigte = false;

  const chrono = h('span', { class: 'chrono-discret' }, '0,0 s');
  const barreFantome = h('div', { class: 'fantome-barre' }, h('div', {}));
  const libelleFantome = h('span', { class: 'discret' }, o.record ? `fantôme : votre record ${formaterDuree(o.record.dureeMs)}` : 'pas encore de record : ce temps deviendra votre fantôme');
  const btn = h('button', { class: 'btn principal', onclick: () => action() });
  // Vérification : on tape le nombre que montre son soroban.
  const saisieLue = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Nombre lu', 'aria-label': 'Nombre lu sur votre soroban', style: 'display:none' });
  const btnVerifier = h('button', { class: 'btn principal', style: 'display:none', onclick: () => lireSoroban() }, 'Vérifier ', h('kbd', {}, 'Entrée'));
  const btnPerdu = h('button', { class: 'btn', style: 'display:none', onclick: () => verifier(false, null) }, 'Je me suis perdu');
  const caseControles = h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { voirControles = e.target.checked; dessiner(); } }), ' Points de contrôle');
  const caseDoigte = h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { voirDoigte = e.target.checked; dessiner(); } }), ' Doigté');
  const tableau = h('div', { class: 'drill-operations' });
  // Métronome : tempo en opérations par minute
  const metronome = new Metronome();
  const tempoRecord = o.record ? Math.round(60000 / (o.record.dureeMs / d.operations.length)) : null;
  const caseMetronome = h('input', { type: 'checkbox' });
  const choixTempo = h('select', {},
    tempoRecord ? h('option', { value: tempoRecord }, `rythme de mon record (${tempoRecord}/min)`) : null,
    [10, 15, 20, 30, 40, 50, 60, 80, 100, 120].map((t) => h('option', { value: t }, `${t} par minute`)));
  const btnPlus5 = h('button', { class: 'btn', title: 'Accélérer de 5 %', onclick: () => {
    const v = Math.round(Number(choixTempo.value) * 1.05);
    choixTempo.append(h('option', { value: v }, `${v} par minute`));
    choixTempo.value = String(v);
    if (etat === 'course' && caseMetronome.checked) metronome.demarrer(v);
  } }, '+ 5 %');
  const ligneMetronome = h('div', { class: 'ligne metronome' }, h('label', {}, caseMetronome, ' Métronome'), choixTempo, btnPlus5,
    h('span', { class: 'discret' }, 'un clic par opération'));
  const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });

  const racine = h('div', { class: 'drill' },
    h('div', { class: 'ligne' }, btn, saisieLue, btnVerifier, btnPerdu, h('span', { style: 'flex:1' }), caseControles, caseDoigte, chrono),
    o.record !== undefined ? h('div', { class: 'ligne fantome-ligne' }, barreFantome, libelleFantome) : null,
    ligneMetronome,
    tableau, retour);
  conteneur.append(racine);

  function dessiner() {
    tableau.classList.toggle('avec-doigte', voirDoigte);
    remplir(tableau, ...d.operations.map((op, i) => h('div', { class: 'drill-op', title: 'Cliquer pour voir ce geste en animation', onclick: () => montrer(i) },
      h('div', { class: 'drill-op-ligne' },
        h('span', { class: 'num' }, i + 1), h('span', {}, `${signe(op.op)} ${formaterNombre(op.n)}`),
        h('span', { class: 'sous-total' }, voirControles ? `= ${formaterNombre(ctrl[i])}` : '')),
      voirDoigte ? h('div', { class: 'doigte' }, doigte(i === 0 ? 0 : ctrl[i - 1], op.op, op.n).map((g) => h('div', {}, g))) : null)));
  }

  function montrer(i) {
    const depart = i === 0 ? 0 : ctrl[i - 1];
    const op = d.operations[i];
    ouvrirDialogue(`Opération ${i + 1} : ${formaterNombre(depart)} ${signe(op.op)} ${formaterNombre(op.n)}`, null, (corps) => {
      const p = new PanneauDemo(corps);
      p.jouer({ depart, op: op.op, n: op.n }, 'manuel');
      return () => p.detruire();
    });
  }

  function majBouton() {
    btn.style.display = etat === 'pret' || etat === 'course' ? '' : 'none';
    remplir(btn, etat === 'pret' ? 'Démarrer ' : 'J\'ai fini ', h('kbd', {}, 'Entrée'));
    for (const b of [saisieLue, btnVerifier, btnPerdu]) b.style.display = etat === 'verification' ? '' : 'none';
  }

  function action() {
    if (etat === 'pret') {
      etat = 'course';
      racine.dataset.enCours = '1';
      debut = performance.now();
      if (caseMetronome.checked) metronome.demarrer(Number(choixTempo.value));
      remplir(retour, h('span', { class: 'discret' }, 'Posez 0 sur votre soroban et enchaînez. Entrée quand vous avez terminé.'));
    } else if (etat === 'course') {
      dureeMs = performance.now() - debut;
      metronome.arreter();
      etat = 'verification';
      chrono.textContent = formaterDuree(dureeMs);
      retour.className = 'retour';
      remplir(retour, `Temps : ${formaterDuree(dureeMs)}. Tapez maintenant le nombre que montre votre soroban (la frappe ne compte pas dans le temps).`);
    }
    majBouton();
    if (etat === 'verification') saisieLue.focus();
  }

  /** Compare le nombre lu sur le soroban au résultat attendu. */
  function lireSoroban() {
    if (etat !== 'verification') return;
    const lu = lireReponse(saisieLue.value);
    if (lu === null) {
      remplir(retour, 'Tapez le nombre affiché sur votre soroban (seulement des chiffres), puis Entrée.');
      saisieLue.focus();
      return;
    }
    verifier(lu === d.resultat, lu);
  }

  async function verifier(juste, lu) {
    if (etat !== 'verification') return;
    etat = 'fini';
    delete racine.dataset.enCours;
    majBouton();
    retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
    remplir(retour, juste
      ? h('span', {}, h('span', { class: 'grand-signe' }, '✓'), ` Votre soroban montre bien ${formaterNombre(d.resultat)} · ${formaterDuree(dureeMs)}`)
      : h('div', {},
        h('div', {}, h('span', { class: 'grand-signe' }, '✗'), lu === null ? ' Résultat attendu : ' : [' Votre soroban montre ', h('strong', {}, formaterNombre(lu)), ', le résultat attendu est '], h('strong', {}, formaterNombre(d.resultat)), '.'),
        lu !== null ? ecartChiffres(lu, d.resultat) : null,
        h('div', {}, 'Comparez vos étapes aux points de contrôle, et activez le doigté pour repérer le geste qui a coincé.')));
    if (!juste) {
      voirControles = true;
      caseControles.querySelector('input').checked = true;
      dessiner();
    }
    const message = await o.surFin?.({ juste, dureeMs });
    if (message) retour.append(h('div', {}, message));
  }

  const minuterie = setInterval(() => {
    if (etat !== 'course') return;
    const ecoule = performance.now() - debut;
    chrono.textContent = formaterDuree(ecoule);
    if (o.record) {
      const part = Math.min(1, ecoule / o.record.dureeMs);
      barreFantome.firstChild.style.width = `${part * 100}%`;
      barreFantome.classList.toggle('depasse', part >= 1);
    }
  }, 100);

  const sansRaccourcis = raccourcis({
    Enter: () => (etat === 'pret' || etat === 'course' ? action() : etat === 'verification' ? lireSoroban() : false),
  });

  dessiner();
  majBouton();
  return {
    detruire() {
      metronome.arreter();
      clearInterval(minuterie);
      sansRaccourcis();
      racine.remove();
    },
  };
}
