/**
 * Soroban libre : manipulation sans consigne, et démonstration de n'importe quelle addition
 * ou soustraction, geste par geste, avec l'explication de chaque mouvement.
 */

import { Soroban } from '../core/soroban.js';
import { calculerGestes, ErreurCalcul } from '../core/gestes.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { LecteurDemo } from '../ui/lecteurDemo.js';
import { h, raccourcis, formaterNombre, remplir } from '../ui/dom.js';

const NOMS_REGLES = { direct: 'direct', 'petit-ami': 'petit ami', 'grand-ami': 'grand ami' };
const VITESSES = { lente: 1500, normale: 900, rapide: 450 };

// Réglages conservés entre deux visites de l'écran (pendant la session).
const reglages = { etiquettes: true, valeurs: false, total: true, mode: 'manuel', vitesse: 'normale' };

export default {
  id: 'libre',
  titre: 'Démonstrations',
  monter(el) {
    const soroban = new Soroban(13);
    let lecteur = null;

    // ---------------------------------------------------------------- interface
    const caseACocher = (cle, texte) => h('label', {},
      h('input', { type: 'checkbox', checked: reglages[cle], onchange: (e) => { reglages[cle] = e.target.checked; appliquer(); } }),
      texte);

    const zoneSoroban = h('div', { class: 'zone-soroban' });
    const valeurTotale = h('div', { class: 'nombre-cible' });
    const btnZero = h('button', { class: 'btn', onclick: () => remettreAZero() }, 'Remettre à zéro ', h('kbd', {}, 'Échap'));

    const choixOp = h('select', {}, h('option', { value: '+' }, 'Ajouter'), h('option', { value: '-' }, 'Retirer'));
    const saisie = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'ex. 7', style: 'width:120px' });
    const choixMode = h('select', { onchange: (e) => { reglages.mode = e.target.value; } },
      h('option', { value: 'manuel' }, 'Étape par étape'), h('option', { value: 'auto' }, 'Automatique'));
    choixMode.value = reglages.mode;
    const choixVitesse = h('select', { onchange: (e) => { reglages.vitesse = e.target.value; } },
      Object.keys(VITESSES).map((v) => h('option', { value: v }, v[0].toUpperCase() + v.slice(1))));
    choixVitesse.value = reglages.vitesse;
    const btnMontrer = h('button', { class: 'btn principal', onclick: () => montrer() }, 'Montrer');
    const btnSuivant = h('button', { class: 'btn', style: 'display:none', onclick: () => lecteur?.suivant() }, 'Suivant ', h('kbd', {}, 'Espace'));
    const btnArreter = h('button', { class: 'btn', style: 'display:none', onclick: () => lecteur?.arreter() }, 'Arrêter');
    const message = h('p', { class: 'retour' });
    const listeEtapes = h('ol', { class: 'etapes' });

    el.append(
      h('h1', {}, 'Démonstrations'),
      h('p', { class: 'discret' }, 'Un soroban virtuel pour MONTRER un geste : posez un nombre (en cliquant les boules), puis demandez une opération pour la voir décomposée geste par geste. Le calcul, lui, se pratique sur votre propre soroban.'),
      h('details', { class: 'carte', style: 'margin-top:12px' },
        h('summary', {}, 'Les gestes de base'),
        h('ul', {},
          h('li', {}, h('strong', {}, 'Le pouce'), ' monte les boules terrestres (du bas). C\'est le doigt le plus fort pour pousser vers le haut.'),
          h('li', {}, h('strong', {}, 'L\'index'), ' descend les boules terrestres et manœuvre la boule céleste (du haut), dans les deux sens.'),
          h('li', {}, 'Une boule terrestre vaut 1, la boule céleste vaut 5. Chaque tige porte donc un chiffre de 0 à 9.'),
          h('li', {}, 'Les points sur la barre repèrent les unités, les milliers, les millions : ils aident à lire les grands nombres.'),
          h('li', {}, 'Remise à zéro sur un vrai soroban : on l\'incline vers soi pour faire glisser les boules du bas, on le repose à plat, puis on fait glisser l\'index le long de la barre, de gauche à droite, pour écarter les boules célestes.'),
        )),
      h('div', { class: 'reglages' },
        caseACocher('etiquettes', 'Rangs'), caseACocher('valeurs', 'Chiffre de chaque tige'), caseACocher('total', 'Valeur totale')),
      zoneSoroban,
      h('div', { class: 'ligne' }, valeurTotale, h('span', { style: 'flex:1' }), btnZero),
      h('h2', {}, 'Voir un calcul geste par geste'),
      h('p', { class: 'discret' }, 'Posez un nombre (ou partez de zéro), puis demandez une opération : l\'application la réalise avec les gestes de la méthode japonaise et explique chacun d\'eux.'),
      h('div', { class: 'ligne' }, choixOp, saisie, choixMode, choixVitesse, btnMontrer, btnSuivant, btnArreter),
      message,
      listeEtapes,
    );

    const vue = new SorobanVue(zoneSoroban, soroban, { interactif: true });

    function appliquer() {
      vue.definirOptions({ etiquettes: reglages.etiquettes, valeurs: reglages.valeurs });
      valeurTotale.style.visibility = reglages.total ? 'visible' : 'hidden';
    }
    const afficherValeur = () => { valeurTotale.textContent = formaterNombre(soroban.valeur()); };
    const desabonner = soroban.surChangement(afficherValeur);
    afficherValeur();
    appliquer();

    function remettreAZero() {
      if (lecteur) return;
      soroban.effacer('eleve');
      remplir(listeEtapes);
      message.textContent = '';
    }

    // ---------------------------------------------------------------- démonstration
    async function montrer() {
      if (lecteur) return;
      const n = Number(saisie.value.replace(/\s/g, ''));
      if (!saisie.value.trim() || !Number.isInteger(n) || n <= 0) {
        message.className = 'retour erreur';
        message.textContent = 'Entrez un nombre entier positif.';
        return;
      }
      let resultat;
      try {
        resultat = calculerGestes(soroban.instantane(), soroban.tigeUnites, choixOp.value, n);
      } catch (e) {
        if (!(e instanceof ErreurCalcul)) throw e;
        message.className = 'retour erreur';
        message.textContent = e.message;
        return;
      }
      const depart = soroban.valeur();
      const signe = choixOp.value === '+' ? '+' : '−';
      message.className = 'retour';
      message.textContent = `${formaterNombre(depart)} ${signe} ${formaterNombre(n)} : on travaille de gauche à droite, en commençant par le chiffre le plus fort.`;

      const items = resultat.etapes.map((et) => h('li', { class: et.mouvements.length ? '' : 'annonce' },
        h('span', { class: 'regle' }, NOMS_REGLES[et.regle] ?? et.regle), et.texte));
      remplir(listeEtapes, ...items);

      vue.definirInteractif(false);
      btnMontrer.disabled = true;
      btnSuivant.style.display = reglages.mode === 'manuel' ? '' : 'none';
      btnArreter.style.display = '';

      lecteur = new LecteurDemo(soroban, vue, resultat.etapes, {
        surEtape: (_et, i) => {
          items.forEach((li, j) => li.classList.toggle('courante', j === i));
          items[i].scrollIntoView({ block: 'nearest' });
        },
      });
      const fini = await lecteur.jouer({ mode: reglages.mode, duree: VITESSES[reglages.vitesse] });
      lecteur = null;
      vue.definirInteractif(true);
      btnMontrer.disabled = false;
      btnSuivant.style.display = 'none';
      btnArreter.style.display = 'none';
      if (fini) {
        message.className = 'retour ok';
        message.textContent = `Résultat : ${formaterNombre(soroban.valeur())}.`;
      } else {
        message.textContent = 'Démonstration interrompue.';
      }
    }

    const sansRaccourcis = raccourcis({
      Escape: () => remettreAZero(),
      Enter: () => { if (!lecteur) montrer(); else lecteur.suivant(); },
      ' ': (e) => {
        if (lecteur) { lecteur.suivant(); return true; }
        return false; // laisser l'espace aux champs de saisie
      },
    });

    return () => {
      lecteur?.arreter();
      sansRaccourcis();
      desabonner();
      vue.detruire();
    };
  },
};
