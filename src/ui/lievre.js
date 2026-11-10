/**
 * Le lièvre : un rythme imposé, qui entraîne la LECTURE ANTICIPÉE (Leçon 0 : « l'œil a un nombre
 * d'avance sur la main »).
 *
 * Une colonne s'affiche ligne par ligne : la ligne en cours est surlignée, la suivante est déjà
 * visible (on la lit pendant que les doigts posent la ligne en cours), les autres sont cachées.
 * Toutes les T secondes, le surligneur descend et la ligne passée disparaît : si les doigts ont
 * du retard sur les yeux, la ligne est perdue. À la fin, on tape le résultat.
 *
 * 3 colonnes justes d'affilée : le lièvre accélère de 10 %. Une erreur : il ralentit de 10 %.
 * La course ne s'arrête qu'à la DEUXIÈME erreur, ou quand l'élève le décide (« Arrêter ») : tant
 * qu'on tient, on continue. La cadence atteinte est rendue à chaque colonne (surCadence), pour
 * que la course suivante sur le même réglage reparte de là au lieu de repartir de zéro.
 * Option métronome : un clic à chaque ligne, pour garder un écart régulier entre les nombres.
 * Les gestes sont notés sur la carte de maîtrise, au temps de la cadence imposée.
 */

import { genererColonneVariee, creerMemoire, ErreurGeneration } from '../core/generateur.js';
import { genererColonneGeste, creerMemoirePlanche } from '../core/colonneGeste.js';
import { motifsAppris } from '../core/parcours.js';
import { noterReponse, noterGestes, poidsAdaptatifs, noterVolume, progression } from '../core/progression.js';
import { localiserErreur } from '../core/diagnostic.js';
import { lireReponse } from '../core/nombres.js';
import { Metronome } from './metronome.js';
import { h, raccourcis, formaterNombre, remplir } from './dom.js';

const ACCELERATION = 0.9;
export const CADENCE_MIN = 0.5;
export const CADENCE_MAX = 6;
const borne = (x) => Math.min(CADENCE_MAX, Math.max(CADENCE_MIN, Math.round(x * 100) / 100));
const sec = (x) => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s`;

/**
 * @param {HTMLElement} conteneur
 * @param {object} o
 * @param {{ autorises: Set|null, cibles: string[], libelle: string }} o.contraintes
 * @param {number} o.chiffres
 * @param {number} o.lignes          lignes par colonne
 * @param {number} o.cadence         secondes par ligne au départ
 * @param {number} [o.erreursMax=2] la course s'arrête à cette erreur
 * @param {number} [o.colonnes]      nombre de colonnes au plus (par défaut : sans limite)
 * @param {boolean} [o.metronome]
 * @param {(cadence:number) => any} [o.surCadence]  après chaque colonne : la cadence à retenir
 * @param {(bilan) => any} o.surFin  { justes, total, erreurs, arret, cadenceDepart, meilleureCadence, cadenceFin }
 */
export function creerLievre(conteneur, o) {
  const memoire = creerMemoire(6);
  const memoireGeste = creerMemoirePlanche();
  const metronome = o.metronome ? new Metronome() : null;
  let cadence = borne(o.cadence);
  let meilleure = null; // cadence la plus rapide d'une colonne réussie
  let serie = 0;
  let k = 0;
  let justes = 0;
  let erreurs = 0;
  const erreursMax = o.erreursMax ?? 2;
  const colonnesMax = o.colonnes ?? Infinity;
  let col = null;
  let phase = 'pret';
  let minuterie = null;

  const infoCadence = h('strong', {});
  const compteur = h('span', { class: 'discret' });
  const zone = h('div', {});
  const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'Résultat', 'aria-label': 'Résultat', disabled: true });
  const btn = h('button', { class: 'btn principal', onclick: () => action() });
  const btnArret = h('button', { class: 'btn', style: 'display:none', title: 'Finir la course maintenant : la cadence atteinte est gardée pour la prochaine fois.', onclick: () => finir('choix') }, 'Arrêter');
  const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
  const racine = h('div', { class: 'lievre-jeu' },
    h('div', { class: 'ruban-entete' }, infoCadence, compteur),
    h('p', { class: 'ruban-consigne' }, 'Posez la ligne surlignée en lisant déjà la suivante. Le surligneur n\'attend pas : la ligne passée disparaît.'),
    zone, h('div', { class: 'ligne' }, saisie, btn, btnArret), retour);
  conteneur.append(racine);
  const majBouton = (t) => { remplir(btn, t, ' ', h('kbd', {}, 'Entrée')); btn.style.display = t ? '' : 'none'; };
  const majEntete = () => {
    infoCadence.textContent = `Lièvre : ${sec(cadence)} par ligne`;
    const reste = erreursMax - erreurs;
    compteur.textContent = `colonne ${k + 1} · ${justes} juste${justes > 1 ? 's' : ''} · ${reste > 1 ? `${reste} erreurs permises` : 'plus qu\'une erreur permise'}`;
  };

  function colonne() {
    const g = o.contraintes.geste;
    col = null;
    // Un geste : colonnes par rôles (le geste 2 fois, un piège, des directs…), variées sur la série.
    if (g) for (let e = 0; e < 5 && !col; e++) { try { col = genererColonneGeste({ ...g, chiffres: o.chiffres, lignes: o.lignes, appris: motifsAppris(progression()) }, memoireGeste); } catch (err) { if (!(err instanceof ErreurGeneration)) throw err; } }
    col ??= genererColonneVariee({ chiffres: o.chiffres, lignes: o.lignes, autorises: o.contraintes.autorises, cibles: o.contraintes.cibles, poids: poidsAdaptatifs(o.contraintes.cibles) }, memoire);
    const lignes = col.lignes.map((l, i) => h('tr', { class: 'avenir' },
      h('td', { class: 'signe' }, i === 0 ? '' : l.op === '+' ? '+' : '−'),
      h('td', { class: 'nombre' }, formaterNombre(l.n))));
    remplir(zone, h('table', { class: 'colonne lievre' }, lignes));
    return lignes;
  }

  /** Fait défiler le surligneur : ligne i en cours, i+1 visible, le reste caché. */
  function lancerColonne() {
    phase = 'defile';
    racine.dataset.enCours = '1';
    majEntete();
    majBouton('');
    btnArret.style.display = 'none';
    remplir(retour);
    saisie.value = '';
    saisie.disabled = true;
    const lignes = colonne();
    let i = -1;
    const etape = () => {
      i += 1;
      lignes.forEach((tr, j) => { tr.className = j < i ? 'passee' : j === i ? 'courante' : j === i + 1 ? 'suivante' : 'avenir'; });
      if (i < lignes.length) metronome?.clic(i === 0);
      if (i >= lignes.length) {
        clearInterval(minuterie);
        phase = 'reponse';
        saisie.disabled = false;
        saisie.focus();
        majBouton('Valider');
      }
    };
    // Un temps d'avance : la 1re ligne est visible (« suivante ») avant le premier temps.
    lignes[0].className = 'suivante';
    metronome && (metronome.ctx ??= new (window.AudioContext || window.webkitAudioContext)());
    minuterie = setTimeout(() => { etape(); minuterie = setInterval(etape, cadence * 1000); }, 1200);
  }

  async function action() {
    if (phase === 'pret' || phase === 'suite') { lancerColonne(); return; }
    if (phase !== 'reponse') return;
    const rep = lireReponse(saisie.value);
    if (rep === null) return;
    const juste = rep === col.resultat;
    noterVolume(col.lignes.reduce((s, l) => s + String(l.n).length, 0));
    await noterReponse(juste);
    // Carte de maîtrise : une colonne juste crédite ses gestes, au temps de la cadence imposée
    // (on l'a tenue, donc au moins aussi vite) ; une erreur n'accuse qu'un geste prouvé.
    const t = cadence / o.chiffres;
    if (juste) await noterGestes(col.motifs, [], t);
    else await noterGestes([], localiserErreur(col, rep)?.motifs ?? [], t);
    k += 1;
    saisie.disabled = true;
    zone.querySelectorAll('tr').forEach((tr) => { tr.className = ''; });
    if (juste) {
      justes += 1;
      serie += 1;
      meilleure = meilleure === null ? cadence : Math.min(meilleure, cadence);
      const accelere = serie % 3 === 0;
      if (accelere) cadence = borne(cadence * ACCELERATION);
      retour.className = 'retour ok';
      remplir(retour, h('span', { class: 'grand-signe' }, '✓'), ` Juste : ${formaterNombre(col.resultat)}.`, accelere ? ` Le lièvre accélère : ${sec(cadence)} par ligne.` : '');
    } else {
      serie = 0;
      erreurs += 1;
      cadence = borne(cadence / ACCELERATION);
      retour.className = 'retour erreur';
      remplir(retour, h('span', { class: 'grand-signe' }, '✗'), ` Le résultat était ${formaterNombre(col.resultat)}. Le lièvre ralentit : ${sec(cadence)} par ligne.`,
        erreurs < erreursMax ? ` Encore ${erreursMax - erreurs} erreur${erreursMax - erreurs > 1 ? 's' : ''} permise${erreursMax - erreurs > 1 ? 's' : ''} : on continue.` : '');
    }
    o.surCadence?.(cadence);
    if (erreurs >= erreursMax) { finir('erreurs'); return; }
    if (k >= colonnesMax) { finir('fin'); return; }
    phase = 'suite';
    majEntete();
    majBouton('Colonne suivante');
    btnArret.style.display = '';
  }

  /** Fin de la course : à la dernière erreur permise, ou parce que l'élève l'a décidé. */
  function finir(arret) {
    if (phase === 'fin' || phase === 'defile') return;
    phase = 'fin';
    delete racine.dataset.enCours;
    majBouton('');
    btnArret.style.display = 'none';
    saisie.disabled = true;
    o.surFin?.({ justes, total: k, erreurs, arret, cadenceDepart: borne(o.cadence), meilleureCadence: meilleure, cadenceFin: cadence });
  }

  majEntete();
  majBouton('Partir');
  const sansRaccourcis = raccourcis({ Enter: () => action() });
  return {
    detruire() {
      clearTimeout(minuterie);
      clearInterval(minuterie);
      metronome?.arreter();
      sansRaccourcis();
      racine.remove();
    },
    demarrer: () => action(),
  };
}

/**
 * Cadence de départ du lièvre (secondes par ligne), d'après le temps médian des gestes visés :
 * un peu plus lente que votre rythme actuel, pour commencer à l'aise ; `accelere` part plus vite
 * (surentraînement pour casser un plateau).
 * @param {number|null} tParChiffre  temps médian par chiffre (null : inconnu)
 */
export function cadenceDepart(tParChiffre, chiffres, accelere = false) {
  const base = tParChiffre ? tParChiffre * chiffres * 1.3 : 1.6 + chiffres;
  return borne(base * (accelere ? 0.85 : 1));
}

/**
 * Cadence de reprise : la dernière cadence atteinte sur ce réglage, un peu ralentie (5 %) pour
 * se remettre en main. `accelere` (surentraînement) repart à la cadence atteinte, sans marge.
 * @param {number} memorisee  dernière cadence gardée (secondes par ligne)
 */
export function cadenceReprise(memorisee, accelere = false) {
  return borne(memorisee * (accelere ? 1 : 1.05));
}

/** Clé de la mémoire du lièvre : un réglage = les gestes visés, la façon, les chiffres, les lignes. */
export function cleLievre({ cibles, mode = '', chiffres, lignes }) {
  return `${[...cibles].sort().join(' ')}|${mode}|${chiffres}|${lignes}`;
}
