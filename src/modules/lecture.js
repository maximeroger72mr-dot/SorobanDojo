/**
 * Lecture et écriture des nombres.
 *
 *  - « Lire » : l'application montre un soroban, l'élève tape le nombre affiché.
 *  - « Poser sur mon soroban » : l'application donne un nombre, l'élève le pose sur SON soroban,
 *    puis appuie sur Entrée : l'application montre la bonne position et l'élève compare
 *    (O : identique, N : différent). En cas de différence, chaque tige est expliquée.
 *
 * Le retour reste affiché (✓ / ✗) et une bande de pastilles garde la trace de la série de 10.
 */

import { Soroban } from '../core/soroban.js';
import { nomRang } from '../core/gestes.js';
import { nombreDifferent } from '../core/aleatoire.js';
import { enregistrerSession, statistiques } from '../core/progression.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { h, raccourcis, formaterDuree, formaterNombre, formaterPourcent, remplir } from '../ui/dom.js';

const TAILLE_SERIE = 10;
const MAX_CHIFFRES = 9;
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
    const nom = Number(ch) <= 1 ? nomRang(rang).replace(/^(\S+)s/, '$1') : nomRang(rang);
    return h('li', {}, h('strong', {}, `${ch} ${nom}`), ` : ${decrireChiffre(Number(ch))}`);
  });
}

export default {
  id: 'lecture',
  titre: 'Lecture des nombres',
  monter(el) {
    let soroban = null;
    let vue = null;
    let serie = null;

    const segment = (valeurs, cle, apres) => {
      const boutons = valeurs.map(([v, texte]) => h('button', {
        class: reglages[cle] === v ? 'actif' : '',
        onclick: () => { reglages[cle] = v; boutons.forEach((b, i) => b.classList.toggle('actif', valeurs[i][0] === v)); apres(); },
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
    const btnValider = h('button', { class: 'btn principal', onclick: () => valider() });
    const btnOui = h('button', { class: 'btn ok-btn', onclick: () => autoEvaluer(true) }, 'Identique ', h('kbd', {}, 'O'));
    const btnNon = h('button', { class: 'btn ko-btn', onclick: () => autoEvaluer(false) }, 'Différent ', h('kbd', {}, 'N'));
    const pastilles = h('div', { class: 'pastilles' });
    const compteur = h('span', { class: 'compteur' });
    const retour = h('div', { class: 'retour' });
    const zoneExercice = h('div', {},
      h('div', { class: 'ligne' }, pastilles, h('span', { style: 'flex:1' }), compteur),
      consigne, cible, zoneSoroban,
      h('div', { class: 'ligne' }, saisie, btnValider, btnOui, btnNon),
      retour);
    const zoneBilan = h('div', { class: 'carte bilan', style: 'display:none' });

    el.append(
      h('h1', {}, 'Lecture des nombres'),
      h('p', { class: 'discret' }, 'Avant de calculer, il faut lire le soroban d\'un coup d\'œil et poser un nombre sans hésiter.'),
      h('details', { class: 'carte', style: 'margin-top:12px', open: !statistiques().parModule.lecture },
        h('summary', {}, 'Comment lire un soroban'),
        h('ul', {},
          h('li', {}, 'Chaque tige porte un chiffre. De droite à gauche : unités, dizaines, centaines…'),
          h('li', {}, h('strong', {}, 'Seules les boules qui touchent la barre du milieu comptent.')),
          h('li', {}, 'La boule du haut (céleste) vaut 5 ; chacune des 4 boules du bas (terrestres) vaut 1.'),
          h('li', {}, 'Une tige sans boule contre la barre vaut 0.'),
          h('li', {}, 'Les points sur la barre marquent les unités puis tous les 3 rangs (milliers, millions). Choisissez un point comme tige des unités et alignez vos nombres dessus.'),
        )),
      h('div', { class: 'reglages' },
        segment([['lire', 'Lire'], ['poser', 'Poser sur mon soroban']], 'mode', () => nouvelleSerie()),
        choixChiffres,
        h('label', {}, h('input', {
          type: 'checkbox', checked: reglages.etiquettes,
          onchange: (e) => { reglages.etiquettes = e.target.checked; vue?.definirOptions({ etiquettes: e.target.checked }); },
        }), 'Afficher les rangs')),
      zoneExercice, zoneBilan);

    function nouvelleSerie() {
      vue?.detruire();
      soroban = new Soroban(Math.max(5, reglages.chiffres + 2));
      vue = new SorobanVue(zoneSoroban, soroban, { interactif: false, etiquettes: reglages.etiquettes });
      serie = { index: 0, justes: 0, durees: [], erreurs: [], debut: performance.now(), cible: null, phase: 'question' };
      remplir(pastilles);
      zoneExercice.style.display = '';
      zoneBilan.style.display = 'none';
      question();
    }

    function question() {
      const lire = reglages.mode === 'lire';
      serie.cible = nombreDifferent(reglages.chiffres, serie.cible);
      serie.phase = 'question';
      serie.debutQuestion = performance.now();
      vue.nettoyer();
      vue.definirOptions({ valeurs: false });
      retour.className = 'retour';
      remplir(retour);
      compteur.textContent = `${serie.index + 1} / ${TAILLE_SERIE}`;
      btnOui.style.display = 'none';
      btnNon.style.display = 'none';
      btnValider.style.display = '';
      if (lire) {
        consigne.textContent = 'Quel nombre est posé sur le soroban ?';
        cible.style.display = 'none';
        zoneSoroban.style.display = '';
        soroban.definirValeur(serie.cible);
        saisie.style.display = '';
        saisie.disabled = false;
        saisie.value = '';
        remplir(btnValider, 'Valider ', h('kbd', {}, 'Entrée'));
        saisie.focus();
      } else {
        consigne.textContent = 'Posez ce nombre sur votre soroban, puis appuyez sur Entrée pour comparer :';
        cible.style.display = '';
        cible.textContent = formaterNombre(serie.cible);
        zoneSoroban.style.display = 'none';
        saisie.style.display = 'none';
        remplir(btnValider, 'Comparer ', h('kbd', {}, 'Entrée'));
        btnValider.focus();
      }
    }

    function noter(juste) {
      serie.durees.push(performance.now() - serie.debutQuestion);
      if (juste) serie.justes += 1;
      else serie.erreurs.push(serie.cible);
      pastilles.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
    }

    function valider() {
      if (!serie) return;
      if (serie.phase === 'corrige') { suivant(); return; }
      if (serie.phase !== 'question') return;
      if (reglages.mode === 'poser') {
        // Montrer la bonne position et laisser l'élève comparer avec son soroban.
        serie.phase = 'comparer';
        serie.dureeQuestion = performance.now() - serie.debutQuestion;
        soroban.definirValeur(serie.cible);
        zoneSoroban.style.display = '';
        consigne.textContent = 'Voici la bonne position. Votre soroban est-il identique ?';
        btnValider.style.display = 'none';
        btnOui.style.display = '';
        btnNon.style.display = '';
        return;
      }
      const brut = saisie.value.replace(/\s/g, '');
      if (!/^\d+$/.test(brut)) { saisie.focus(); return; }
      const reponse = Number(brut);
      const juste = reponse === serie.cible;
      noter(juste);
      saisie.disabled = true;
      if (juste) {
        retour.className = 'retour ok';
        remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${formaterNombre(serie.cible)}`);
        serie.phase = 'transition';
        setTimeout(() => { if (serie?.phase === 'transition') suivant(); }, 900);
        return;
      }
      serie.phase = 'corrige';
      vue.definirOptions({ valeurs: true });
      retour.className = 'retour erreur';
      remplir(retour, 
        h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` Vous avez lu ${formaterNombre(reponse)}, le soroban montre `, h('strong', {}, formaterNombre(serie.cible)), '.'),
        h('ul', { class: 'detail' }, expliquerNombre(serie.cible)),
        h('span', { class: 'discret' }, 'Entrée pour continuer.'));
    }

    function autoEvaluer(identique) {
      if (serie?.phase !== 'comparer') return;
      serie.debutQuestion = performance.now() - serie.dureeQuestion;
      noter(identique);
      btnOui.style.display = 'none';
      btnNon.style.display = 'none';
      if (identique) {
        retour.className = 'retour ok';
        remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ' Bien posé.');
        serie.phase = 'transition';
        setTimeout(() => { if (serie?.phase === 'transition') suivant(); }, 700);
        return;
      }
      serie.phase = 'corrige';
      vue.definirOptions({ valeurs: true });
      retour.className = 'retour erreur';
      remplir(retour, 
        h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ' Comparez tige par tige :'),
        h('ul', { class: 'detail' }, expliquerNombre(serie.cible)),
        h('span', { class: 'discret' }, 'Corrigez votre soroban, puis Entrée pour continuer.'));
      btnValider.style.display = '';
      remplir(btnValider, 'Suivant ', h('kbd', {}, 'Entrée'));
    }

    function suivant() {
      serie.index += 1;
      if (serie.index >= TAILLE_SERIE) terminer();
      else question();
    }

    async function terminer() {
      serie.phase = 'fin';
      const total = TAILLE_SERIE;
      const dureeMs = serie.durees.reduce((a, b) => a + b, 0);
      await enregistrerSession({ module: 'lecture', mode: reglages.mode, reglages: { chiffres: reglages.chiffres }, total, justes: serie.justes, dureeMs, erreurs: serie.erreurs });
      const parfait = serie.justes === total;
      zoneExercice.style.display = 'none';
      zoneBilan.style.display = '';
      remplir(zoneBilan, 
        h('div', { class: 'grand' }, `${serie.justes} / ${total}`),
        h('p', {}, `Réussite ${formaterPourcent(serie.justes, total)} · temps moyen ${formaterDuree(dureeMs / total)} par nombre`),
        serie.erreurs.length ? h('p', {}, `À revoir : ${serie.erreurs.map(formaterNombre).join(' · ')}`) : null,
        h('p', {}, parfait && reglages.chiffres < MAX_CHIFFRES ? `Parfait : passez à ${reglages.chiffres + 1} chiffres.` : parfait ? 'Parfait.' : 'Repérez d\'abord la tige des unités (le point), puis lisez de gauche à droite.'),
        h('div', { class: 'ligne' },
          parfait && reglages.chiffres < MAX_CHIFFRES ? h('button', { class: 'btn principal', onclick: () => { reglages.chiffres += 1; choixChiffres.value = String(reglages.chiffres); nouvelleSerie(); } }, `Passer à ${reglages.chiffres + 1} chiffres`) : null,
          h('button', { class: 'btn', onclick: () => nouvelleSerie() }, 'Recommencer ', h('kbd', {}, 'Entrée'))));
    }

    const sansRaccourcis = raccourcis({
      Enter: () => { if (serie?.phase === 'fin') nouvelleSerie(); else valider(); },
      o: () => (serie?.phase === 'comparer' ? autoEvaluer(true) : false),
      O: () => (serie?.phase === 'comparer' ? autoEvaluer(true) : false),
      n: () => (serie?.phase === 'comparer' ? autoEvaluer(false) : false),
      N: () => (serie?.phase === 'comparer' ? autoEvaluer(false) : false),
    });

    nouvelleSerie();
    return () => { if (serie) serie.phase = 'fin-ecran'; sansRaccourcis(); vue?.detruire(); };
  },
};
