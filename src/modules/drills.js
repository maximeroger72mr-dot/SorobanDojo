/**
 * Drills : 123456789 et ses variantes progressives, même nombre répété, suite des entiers.
 *
 * Tout se fait sur son soroban. L'application affiche les opérations, chronomètre, vérifie le
 * résultat final, et donne les points de contrôle (sous-totaux) pour retrouver une erreur.
 * Chaque étape peut être montrée en démonstration. Meilleur temps personnel par drill.
 */

import { catalogueDrills, drillRepetition, controles } from '../core/drills.js';
import { enregistrerSession, proposerRecord, progression } from '../core/progression.js';
import { PanneauDemo, ouvrirDialogue } from '../ui/panneauDemo.js';
import { h, raccourcis, formaterDuree, formaterNombre } from '../ui/dom.js';

const signe = (op) => (op === '+' ? '+' : '−');

export default {
  id: 'drills',
  titre: 'Drills',
  monter(el) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); el.replaceChildren(); nettoyer = f() ?? null; };

    function catalogue() {
      const drills = catalogueDrills();
      const groupes = [...new Set(drills.map((d) => d.groupe))];
      const record = (id) => progression().records[`drill-${id}`];
      el.append(h('h1', {}, 'Drills'),
        h('p', { class: 'discret' }, 'Des suites classiques à faire sur votre soroban, chronométrées. Le résultat est connu : on sait tout de suite si c\'est juste. Commencez par les variantes courtes.'));
      // Même nombre répété : constructeur
      const choixN = h('select', {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 333, 777, 999].map((n) => h('option', { value: n }, n)));
      choixN.value = '7';
      const choixFois = h('select', {}, [10, 20, 30].map((n) => h('option', { value: n }, `${n} fois`)));
      const ar = h('input', { type: 'checkbox', checked: true });
      el.append(h('h2', {}, 'Même nombre répété'),
        h('p', { class: 'discret' }, 'Ajouter le même nombre en boucle fait passer chaque tige par tous les cas : le meilleur exercice pour ancrer les amis d\'un chiffre (ex. 7 : +7 direct, +7 grand ami, +7 combiné…).'),
        h('div', { class: 'ligne' }, 'Ajouter', choixN, choixFois, h('label', {}, ar, ' puis revenir à 0'),
          h('button', { class: 'btn principal', onclick: () => changer(() => ecranDrill(drillRepetition(Number(choixN.value), Number(choixFois.value), ar.checked))) }, 'Commencer')));
      for (const g of groupes.filter((x) => x !== 'Même nombre répété')) {
        el.append(h('h2', {}, g), h('div', { class: 'liste-paliers' }, drills.filter((d) => d.groupe === g).map((d) => h('button', {
          class: 'ligne-palier', onclick: () => changer(() => ecranDrill(d)),
        }, h('span', { class: 'icone' }, record(d.id) ? '✓' : '○'), h('span', { class: 'titre' }, d.titre),
        h('span', { class: 'statut' }, `${d.operations.length} opérations · = ${formaterNombre(d.resultat)}${record(d.id) ? ` · record ${formaterDuree(record(d.id).dureeMs)}` : ''}`)))));
      }
    }

    function ecranDrill(d) {
      const ctrl = controles(d.operations);
      let debut = null;
      let fini = false;
      let controlesVisibles = false;
      const chrono = h('span', { class: 'chrono-feuille' }, '0,0 s');
      const minuterie = setInterval(() => { if (debut && !fini) chrono.textContent = formaterDuree(performance.now() - debut); }, 100);
      const tableau = h('div', { class: 'drill-operations' });
      const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', placeholder: 'Résultat final', autocomplete: 'off' });
      const btnDebut = h('button', { class: 'btn principal', onclick: () => commencer() }, 'Démarrer le chrono ', h('kbd', {}, 'Entrée'));
      const btnValider = h('button', { class: 'btn principal', style: 'display:none', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
      const btnControles = h('button', { class: 'btn', onclick: () => { controlesVisibles = !controlesVisibles; dessiner(); } }, 'Points de contrôle');
      const retour = h('div', { class: 'retour' });

      function dessiner() {
        tableau.replaceChildren(...d.operations.map((o, i) => h('div', { class: 'drill-op', title: 'Cliquer pour voir ce geste', onclick: () => montrer(i) },
          h('span', { class: 'num' }, i + 1), h('span', {}, `${signe(o.op)} ${formaterNombre(o.n)}`),
          h('span', { class: 'sous-total' }, controlesVisibles ? `= ${formaterNombre(ctrl[i])}` : ''))));
      }
      function montrer(i) {
        const depart = i === 0 ? 0 : ctrl[i - 1];
        const o = d.operations[i];
        ouvrirDialogue(`Étape ${i + 1} : ${formaterNombre(depart)} ${signe(o.op)} ${formaterNombre(o.n)}`, null, (corps) => {
          const p = new PanneauDemo(corps);
          p.jouer({ depart, op: o.op, n: o.n }, 'manuel');
          return () => p.detruire();
        });
      }
      function commencer() {
        debut = performance.now();
        btnDebut.style.display = 'none';
        btnValider.style.display = '';
        saisie.focus();
      }
      async function valider() {
        if (fini || !debut) return;
        const brut = saisie.value.replace(/[\s.]/g, '');
        if (!/^\d+$/.test(brut)) return;
        fini = true;
        const dureeMs = performance.now() - debut;
        const juste = Number(brut) === d.resultat;
        saisie.disabled = true;
        btnValider.style.display = 'none';
        await enregistrerSession({ module: 'drills', mode: d.id, total: 1, justes: juste ? 1 : 0, dureeMs });
        const record = juste && await proposerRecord(`drill-${d.id}`, dureeMs);
        if (juste) {
          retour.className = 'retour ok';
          retour.replaceChildren(h('span', { class: 'grand-signe' }, '✓'), ` Juste en ${formaterDuree(dureeMs)}${record ? ' : nouveau record personnel !' : ''}`);
        } else {
          controlesVisibles = true;
          dessiner();
          retour.className = 'retour erreur';
          retour.replaceChildren(h('span', { class: 'grand-signe' }, '✗'), ` Résultat attendu : ${formaterNombre(d.resultat)}. Comparez les points de contrôle avec vos étapes, et cliquez une opération pour revoir le geste.`);
        }
        retour.append(h('div', { class: 'ligne', style: 'margin-top:8px' },
          h('button', { class: 'btn principal', onclick: () => changer(() => ecranDrill(d)) }, 'Recommencer'),
          h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills')));
      }

      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'),
        h('h1', {}, d.titre), h('p', {}, d.description),
        h('p', { class: 'discret' }, 'Posez 0 sur votre soroban, démarrez le chrono, enchaînez toutes les opérations, puis tapez le résultat final.'),
        h('div', { class: 'ligne' }, btnDebut, chrono, h('span', { style: 'flex:1' }), btnControles),
        tableau, h('div', { class: 'ligne', style: 'margin-top:12px' }, saisie, btnValider), retour);
      dessiner();
      const sansRaccourcis = raccourcis({ Enter: () => (debut ? valider() : commencer()) });
      return () => { clearInterval(minuterie); sansRaccourcis(); };
    }

    changer(catalogue);
    return () => nettoyer?.();
  },
};
