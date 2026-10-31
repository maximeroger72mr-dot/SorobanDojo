/**
 * Module 1 : lecture et écriture des nombres.
 *
 *  - Mode « Lire »  : le soroban affiche un nombre, l'élève le tape.
 *  - Mode « Poser » : l'application donne un nombre, l'élève le pose sur le soroban.
 *
 * Une série compte 10 nombres. Une réponse juste passe automatiquement à la suivante ;
 * une réponse fausse est expliquée tige par tige, puis l'élève continue avec Entrée.
 */

import { Soroban } from '../core/soroban.js';
import { nomRang } from '../core/gestes.js';
import { nombreDifferent } from '../core/aleatoire.js';
import { enregistrerSession, statistiques } from '../core/progression.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { h, raccourcis, formaterDuree, formaterNombre, formaterPourcent } from '../ui/dom.js';

const TAILLE_SERIE = 10;
const MAX_CHIFFRES = 8;

// Réglages conservés pendant la session.
const reglages = { mode: 'lire', chiffres: 1, etiquettes: true };

/** Décrit en mots les boules qui forment un chiffre sur une tige. */
export function decrireChiffre(c) {
  if (c === 0) return 'aucune boule contre la barre';
  const t = c % 5;
  const terrestres = `${t} boule${t > 1 ? 's' : ''} terrestre${t > 1 ? 's' : ''}`;
  if (c < 5) return terrestres;
  return t === 0 ? 'la boule céleste (5)' : `la boule céleste (5) + ${terrestres}`;
}

/** Explication tige par tige d'un nombre, du rang le plus élevé aux unités. */
function expliquerNombre(n) {
  const chiffres = String(n);
  return chiffres.split('').map((ch, i) => {
    const rang = chiffres.length - 1 - i;
    // « 1 dizaine », « 3 dizaines » : on accorde le premier mot du nom du rang.
    const nom = Number(ch) <= 1 ? nomRang(rang).replace(/^(\S+)s/, '$1') : nomRang(rang);
    return h('li', {}, h('strong', {}, `${ch} ${nom}`), ` : ${decrireChiffre(Number(ch))}`);
  });
}

export default {
  id: 'lecture',
  titre: 'Lecture et écriture',
  monter(el) {
    // ---------------------------------------------------------------- état de la série
    let soroban = null;
    let vue = null;
    let serie = null; // { index, justes, erreurs, debut, debutQuestion, cible, phase, durees }

    // ---------------------------------------------------------------- interface
    const segment = (valeurs, cle, apres) => {
      const boutons = valeurs.map(([v, texte]) => h('button', {
        class: reglages[cle] === v ? 'actif' : '',
        onclick: () => {
          reglages[cle] = v;
          boutons.forEach((b, i) => b.classList.toggle('actif', valeurs[i][0] === v));
          apres();
        },
      }, texte));
      return h('div', { class: 'segments' }, boutons);
    };

    const choixChiffres = h('select', { onchange: (e) => { reglages.chiffres = Number(e.target.value); nouvelleSerie(); } },
      Array.from({ length: MAX_CHIFFRES }, (_, i) => h('option', { value: i + 1 }, `${i + 1} chiffre${i ? 's' : ''}`)));
    choixChiffres.value = String(reglages.chiffres);

    const consigne = h('div', { class: 'consigne' });
    const cible = h('div', { class: 'nombre-cible' });
    const zoneSoroban = h('div', { class: 'zone-soroban' });
    const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', 'aria-label': 'Votre réponse' });
    const btnEffacer = h('button', { class: 'btn', onclick: () => soroban?.effacer('eleve') }, 'Effacer ', h('kbd', {}, 'Échap'));
    const btnValider = h('button', { class: 'btn principal', onclick: () => valider() }, 'Valider ', h('kbd', {}, 'Entrée'));
    const btnCorrection = h('button', { class: 'btn', style: 'display:none', onclick: () => montrerCorrection() }, 'Voir la bonne position');
    const compteur = h('span', { class: 'compteur' });
    const retour = h('div', { class: 'retour' });
    const zoneExercice = h('div', {},
      consigne, cible, zoneSoroban,
      h('div', { class: 'ligne' }, saisie, btnEffacer, btnValider, btnCorrection, h('span', { style: 'flex:1' }), compteur),
      retour);
    const zoneBilan = h('div', { class: 'carte bilan', style: 'display:none' });

    const dejaPratique = !!statistiques().parModule.lecture;
    el.append(
      h('h1', {}, 'Lecture et écriture des nombres'),
      h('p', { class: 'discret' }, 'Avant de calculer, il faut lire le soroban d\'un coup d\'œil et poser un nombre sans hésiter.'),
      h('details', { class: 'carte', style: 'margin-top:12px', open: !dejaPratique },
        h('summary', {}, 'Comment lire un soroban'),
        h('ul', {},
          h('li', {}, 'Chaque tige verticale porte un chiffre. De droite à gauche : unités, dizaines, centaines… comme quand on écrit un nombre.'),
          h('li', {}, h('strong', {}, 'Seules les boules qui touchent la barre du milieu comptent.'), ' Les autres sont « au repos ».'),
          h('li', {}, 'La boule du haut (céleste) vaut 5. Chacune des 4 boules du bas (terrestres) vaut 1. Exemple : céleste + 2 terrestres = 7.'),
          h('li', {}, 'Une tige sans boule contre la barre vaut 0 : le zéro se lit aussi, il garde chaque chiffre à sa place.'),
          h('li', {}, 'Les points sur la barre marquent les unités, puis tous les 3 rangs (milliers, millions) : comme l\'espace dans «\u00a012\u00a0345\u00a0», ils aident à repérer les grands nombres.'),
          h('li', {}, 'Lisez de gauche à droite, comme un nombre écrit : on énonce d\'abord le chiffre le plus fort.'),
        )),
      h('div', { class: 'reglages' },
        segment([['lire', 'Lire'], ['poser', 'Poser']], 'mode', () => nouvelleSerie()),
        choixChiffres,
        h('label', {}, h('input', {
          type: 'checkbox', checked: reglages.etiquettes,
          onchange: (e) => { reglages.etiquettes = e.target.checked; vue?.definirOptions({ etiquettes: e.target.checked }); },
        }), 'Afficher les rangs')),
      zoneExercice,
      zoneBilan,
    );

    // ---------------------------------------------------------------- déroulement
    function nouvelleSerie() {
      vue?.detruire();
      // Deux tiges de plus que nécessaire, pour que la position du nombre se lise (au moins 5 tiges).
      soroban = new Soroban(Math.max(5, reglages.chiffres + 2));
      vue = new SorobanVue(zoneSoroban, soroban, { interactif: false, etiquettes: reglages.etiquettes });
      serie = { index: 0, justes: 0, erreurs: [], durees: [], debut: performance.now(), cible: null, phase: 'question' };
      zoneExercice.style.display = '';
      zoneBilan.style.display = 'none';
      poserQuestion();
    }

    function poserQuestion() {
      const lire = reglages.mode === 'lire';
      serie.cible = nombreDifferent(reglages.chiffres, serie.cible);
      serie.phase = 'question';
      serie.debutQuestion = performance.now();
      vue.nettoyer();
      retour.className = 'retour';
      retour.replaceChildren();
      btnCorrection.style.display = 'none';
      compteur.textContent = `${serie.index + 1} / ${TAILLE_SERIE}`;

      if (lire) {
        consigne.textContent = 'Quel nombre est posé sur le soroban ?';
        cible.style.display = 'none';
        soroban.definirValeur(serie.cible);
        vue.definirInteractif(false);
        saisie.style.display = '';
        saisie.value = '';
        btnEffacer.style.display = 'none';
        saisie.focus();
      } else {
        consigne.textContent = 'Posez ce nombre sur le soroban (aligné à droite, sur les unités) :';
        cible.style.display = '';
        cible.textContent = formaterNombre(serie.cible);
        soroban.effacer();
        vue.definirInteractif(true);
        saisie.style.display = 'none';
        btnEffacer.style.display = '';
        saisie.blur();
      }
    }

    function valider() {
      if (!serie) return;
      if (serie.phase === 'corrige') { suivant(); return; }
      if (serie.phase !== 'question') return;

      const lire = reglages.mode === 'lire';
      let reponse;
      if (lire) {
        const brut = saisie.value.replace(/\s/g, '');
        if (!/^\d+$/.test(brut)) { saisie.focus(); return; }
        reponse = Number(brut);
      } else {
        reponse = soroban.valeur();
      }
      serie.durees.push(performance.now() - serie.debutQuestion);

      if (reponse === serie.cible) {
        serie.justes += 1;
        serie.phase = 'transition';
        retour.className = 'retour ok';
        retour.textContent = 'Juste !';
        if (!lire) for (let t = 0; t < soroban.nbTiges; t++) if (soroban.chiffre(t)) vue.marquerTige(t, 'ok');
        setTimeout(() => { if (serie?.phase === 'transition') suivant(); }, 550);
        return;
      }

      serie.erreurs.push({ attendu: serie.cible, donne: reponse });
      serie.phase = 'corrige';
      retour.className = 'retour erreur';
      if (lire) {
        // On montre le chiffre de chaque tige, et on décrit les boules.
        vue.definirOptions({ valeurs: true });
        retour.replaceChildren(
          `Ce n'est pas ${formaterNombre(reponse)} : le soroban montre ${formaterNombre(serie.cible)}.`,
          h('ul', { class: 'detail' }, expliquerNombre(serie.cible)),
          h('span', { class: 'discret' }, 'Appuyez sur Entrée pour continuer.'));
      } else {
        vue.definirInteractif(false);
        const attendu = new Soroban(soroban.nbTiges);
        attendu.definirValeur(serie.cible);
        for (let t = 0; t < soroban.nbTiges; t++) {
          if (soroban.chiffre(t) !== attendu.chiffre(t)) vue.marquerTige(t, 'erreur');
        }
        retour.replaceChildren(
          `Vous avez posé ${formaterNombre(reponse)}. Les tiges en rouge ne sont pas justes.`,
          h('ul', { class: 'detail' }, expliquerNombre(serie.cible)),
          h('span', { class: 'discret' }, 'Appuyez sur Entrée pour continuer.'));
        btnCorrection.style.display = '';
      }
    }

    function montrerCorrection() {
      vue.nettoyer();
      soroban.definirValeur(serie.cible, 'demo');
      for (let t = 0; t < soroban.nbTiges; t++) if (soroban.chiffre(t)) vue.marquerTige(t, 'ok');
      btnCorrection.style.display = 'none';
    }

    function suivant() {
      vue.definirOptions({ valeurs: false });
      serie.index += 1;
      if (serie.index >= TAILLE_SERIE) terminer();
      else poserQuestion();
    }

    async function terminer() {
      const dureeMs = performance.now() - serie.debut;
      const total = TAILLE_SERIE;
      const { justes } = serie;
      const moyenne = serie.durees.reduce((a, b) => a + b, 0) / serie.durees.length;
      serie.phase = 'fin';
      await enregistrerSession({
        module: 'lecture', mode: reglages.mode, reglages: { chiffres: reglages.chiffres },
        total, justes, dureeMs: serie.durees.reduce((a, b) => a + b, 0), erreurs: serie.erreurs,
      });

      // Conseil pour la suite : progression graduelle du nombre de chiffres.
      let conseil;
      let btnSuite = null;
      if (justes === total && reglages.chiffres < MAX_CHIFFRES) {
        conseil = `Parfait. Vous pouvez passer à ${reglages.chiffres + 1} chiffres.`;
        btnSuite = h('button', { class: 'btn principal', onclick: () => {
          reglages.chiffres += 1;
          choixChiffres.value = String(reglages.chiffres);
          nouvelleSerie();
        } }, `Passer à ${reglages.chiffres + 1} chiffres`);
      } else if (justes >= total - 2) {
        conseil = 'Presque. Une série de plus au même niveau pour fixer les automatismes.';
      } else {
        conseil = 'Prenez votre temps : repérez d\'abord la tige des unités (point le plus à droite), puis lisez chaque tige de gauche à droite.';
      }

      zoneExercice.style.display = 'none';
      zoneBilan.style.display = '';
      zoneBilan.replaceChildren(
        h('div', { class: 'grand' }, `${justes} / ${total}`),
        h('p', {}, `Réussite ${formaterPourcent(justes, total)} · temps moyen ${formaterDuree(moyenne)} par nombre · durée totale ${formaterDuree(dureeMs)}`),
        h('p', {}, conseil),
        h('div', { class: 'ligne', style: 'margin-top:12px' },
          btnSuite,
          h('button', { class: btnSuite ? 'btn' : 'btn principal', onclick: () => nouvelleSerie() }, 'Recommencer ', h('kbd', {}, 'Entrée'))),
      );
    }

    const sansRaccourcis = raccourcis({
      Enter: () => { if (serie?.phase === 'fin') nouvelleSerie(); else valider(); },
      Escape: () => { if (reglages.mode === 'poser' && serie?.phase === 'question') soroban.effacer('eleve'); },
    });

    nouvelleSerie();

    return () => {
      if (serie) serie.phase = 'fin-ecran';
      sansRaccourcis();
      vue?.detruire();
    };
  },
};
