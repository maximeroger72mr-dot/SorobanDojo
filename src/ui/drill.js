/**
 * Exécution d'un drill sur son propre soroban.
 *
 * Seul le chronomètre compte : on démarre, on enchaîne les opérations sur son soroban, on
 * arrête. Le résultat attendu n'apparaît qu'à la fin, pour vérifier (O / N). Le temps n'est
 * retenu comme record que si le soroban affichait le bon résultat.
 *
 * Aides : points de contrôle (sous-totaux) et DOIGTÉ (la suite exacte des gestes de chaque
 * opération), pour repérer un mouvement qui gêne ou bloque ; chaque opération se rejoue en animation.
 * Fantôme : une barre montre où en serait votre record.
 */

import { controles } from '../core/drills.js';
import { calculerGestes } from '../core/gestes.js';
import { Soroban } from '../core/soroban.js';
import { PanneauDemo, ouvrirDialogue } from './panneauDemo.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from './dom.js';

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
  const btnOui = h('button', { class: 'btn ok-btn', style: 'display:none', onclick: () => verifier(true) }, 'Oui ', h('kbd', {}, 'O'));
  const btnNon = h('button', { class: 'btn ko-btn', style: 'display:none', onclick: () => verifier(false) }, 'Non ', h('kbd', {}, 'N'));
  const caseControles = h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { voirControles = e.target.checked; dessiner(); } }), ' Points de contrôle');
  const caseDoigte = h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { voirDoigte = e.target.checked; dessiner(); } }), ' Doigté');
  const tableau = h('div', { class: 'drill-operations' });
  const retour = h('div', { class: 'retour' });

  const racine = h('div', { class: 'drill' },
    h('div', { class: 'ligne' }, btn, btnOui, btnNon, h('span', { style: 'flex:1' }), caseControles, caseDoigte, chrono),
    o.record !== undefined ? h('div', { class: 'ligne fantome-ligne' }, barreFantome, libelleFantome) : null,
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
    btnOui.style.display = etat === 'verification' ? '' : 'none';
    btnNon.style.display = etat === 'verification' ? '' : 'none';
  }

  function action() {
    if (etat === 'pret') {
      etat = 'course';
      debut = performance.now();
      remplir(retour, h('span', { class: 'discret' }, 'Posez 0 sur votre soroban et enchaînez. Entrée quand vous avez terminé.'));
    } else if (etat === 'course') {
      dureeMs = performance.now() - debut;
      etat = 'verification';
      chrono.textContent = formaterDuree(dureeMs);
      retour.className = 'retour';
      remplir(retour, `Temps : ${formaterDuree(dureeMs)}. Résultat attendu : `, h('strong', { class: 'resultat-drill' }, formaterNombre(d.resultat)), '. Votre soroban affiche-t-il ce nombre ?');
    }
    majBouton();
  }

  async function verifier(juste) {
    if (etat !== 'verification') return;
    etat = 'fini';
    majBouton();
    retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
    remplir(retour, juste
      ? h('span', {}, h('span', { class: 'grand-signe' }, '✓'), ` ${formaterDuree(dureeMs)}`)
      : h('span', {}, h('span', { class: 'grand-signe' }, '✗'), ' Comparez vos étapes aux points de contrôle, et activez le doigté pour repérer le geste qui a coincé.'));
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
    Enter: () => (etat === 'pret' || etat === 'course' ? action() : false),
    o: () => (etat === 'verification' ? verifier(true) : false),
    O: () => (etat === 'verification' ? verifier(true) : false),
    n: () => (etat === 'verification' ? verifier(false) : false),
    N: () => (etat === 'verification' ? verifier(false) : false),
  });

  dessiner();
  majBouton();
  return {
    detruire() {
      clearInterval(minuterie);
      sansRaccourcis();
      racine.remove();
    },
  };
}
