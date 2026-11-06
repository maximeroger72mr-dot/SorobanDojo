/**
 * Se mesurer : défis sur son soroban.
 *
 *  - Défi de la semaine : la même feuille toute la semaine, adaptée au niveau, en 3 étoiles :
 *      1 précision (≥ 90 % de justes), 2 vitesse (0 erreur et sous le temps « confirmé »),
 *      3 sans filet (5 colonnes NOUVELLES du même format, une par une, au rythme expert).
 *  - Défis libres : N calculs le plus vite possible, contre son fantôme (son record), ou contre
 *    « le maître » tant qu'il n'y a pas de record. Médaille d'après les seuils de niveau.
 *  - Contre-la-montre arcade : 60 s au départ ; chaque calcul juste rajoute du temps (plus avec
 *    une série de 5), chaque erreur en retire 5. Tenir le plus longtemps possible.
 *  - Échelle des kyū : 10 marches de plus en plus dures (colonnes, ×, ÷), une erreur fait rester
 *    sur la marche. Le temps total est le score.
 */

import { genererColonneVariee, creerMemoire } from '../core/generateur.js';
import { genererMultiplication, genererDivision } from '../core/multiplication.js';
import { enregistrerSession, proposerRecord, proposerMeilleurScore, progression, aujourdhui } from '../core/progression.js';
import { defiSemaine, formatSemaine, estValide } from '../core/parcours.js';
import { NIVEAUX, tempsCible, SURCOUT_FEUILLE_S } from '../core/maitrise.js';
import { famille } from '../core/motifs.js';
import { motifsAppris } from './planches.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { creerFeuille } from '../ui/feuille.js';
import { fantomeMaitre, medaille } from '../ui/course.js';
import { rangee, badgeClassement } from '../ui/perles.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

const memoire = creerMemoire(8);
const PENALITE_MS = 5000;
const PENALITE_SEMAINE_MS = 10000;
const ARCADE = { capitalMs: 60000, maxMs: 90000, erreurMs: 5000, serieBonus: 5, coefBonus: 0.8, coefSerie: 1.25 };
const reglages = { type: 'colonnes2', nombre: 20, arcade: 'colonnes1' };
const niveau = (id) => NIVEAUX.find((n) => n.id === id);

/** Colonne limitée aux gestes appris (aucun ami jamais vu). */
function colonne(chiffres, lignes = 5) {
  const appris = motifsAppris();
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  return genererColonneVariee({ chiffres, lignes, autorises: appris, cibles: amis.length ? amis : [...appris] }, memoire);
}

const TYPES = {
  colonnes1: { titre: 'Colonnes, 1 chiffre, 5 lignes', generer: () => colonne(1) },
  colonnes2: { titre: 'Colonnes, 2 chiffres, 5 lignes', generer: () => colonne(2) },
  colonnes3: { titre: 'Colonnes, 3 chiffres, 5 lignes', generer: () => colonne(3) },
  mul21: { titre: 'Multiplications 2 × 1 chiffres', generer: () => genererMultiplication(2, 1) },
  mul22: { titre: 'Multiplications 2 × 2 chiffres', generer: () => genererMultiplication(2, 2) },
  div: { titre: 'Divisions (÷ 1 chiffre, quotient 2 chiffres)', generer: () => genererDivision(1, 2) },
  mix: { titre: 'Mélange (colonnes, multiplications, divisions)', generer: () => [() => colonne(2), () => genererMultiplication(2, 1), () => genererDivision(1, 2)][Math.floor(Math.random() * 3)]() },
};

/**
 * Les 10 marches de l'échelle. Une marche × ou ÷ dont la leçon n'est pas encore validée est
 * remplacée par une colonne plus longue : on ne propose jamais une méthode pas encore apprise.
 */
function marches(d) {
  const mul = estValide(d, 'p6-1');
  const mul22 = estValide(d, 'p6-3');
  const div = estValide(d, 'p7-1');
  const m = (titre, generer) => ({ titre, generer });
  return [
    m('1 chiffre, 4 lignes', () => colonne(1, 4)),
    m('1 chiffre, 4 lignes', () => colonne(1, 4)),
    m('2 chiffres, 5 lignes', () => colonne(2, 5)),
    m('2 chiffres, 5 lignes', () => colonne(2, 5)),
    mul ? m('multiplication 2 × 1', () => genererMultiplication(2, 1)) : m('2 chiffres, 6 lignes', () => colonne(2, 6)),
    div ? m('division ÷ 1 chiffre', () => genererDivision(1, 2)) : m('2 chiffres, 6 lignes', () => colonne(2, 6)),
    m('3 chiffres, 6 lignes', () => colonne(3, 6)),
    m('3 chiffres, 6 lignes', () => colonne(3, 6)),
    mul22 ? m('multiplication 2 × 2', () => genererMultiplication(2, 2)) : m('3 chiffres, 8 lignes', () => colonne(3, 8)),
    m('le boss : 4 chiffres, 8 lignes', () => colonne(4, 8)),
  ];
}

/** Étoiles du défi de la semaine (masque : 1 précision, 2 vitesse, 4 sans filet). */
const ETOILES = [
  { bit: 1, nom: 'Précision', texte: 'la feuille avec au moins 90 % de justes' },
  { bit: 2, nom: 'Vitesse', texte: '0 erreur, sous le temps « confirmé »' },
  { bit: 4, nom: 'Sans filet', texte: '5 colonnes nouvelles du même format, une par une, toutes justes, au rythme expert' },
];
const nbEtoiles = (masque) => ETOILES.filter((e) => masque & e.bit).length;
const etoilesHtml = (masque) => h('span', { class: 'etoiles' }, rangee(nbEtoiles(masque), 3, `${nbEtoiles(masque)} étoile${nbEtoiles(masque) > 1 ? 's' : ''} sur 3`));

export default {
  id: 'defis',
  titre: 'Défis chrono',
  monter(el, app, params = {}) {
    let courant = null;
    let minuterie = null;
    const cle = () => `defi-${reglages.type}-${reglages.nombre}`;
    const records = () => progression().records;
    const arreter = () => { clearInterval(minuterie); minuterie = null; courant?.detruire(); courant = null; };
    const retourBtn = () => h('button', { class: 'lien', onclick: () => accueil() }, '← Défis');
    const select = (k, options, conv = String, apres = null) => {
      const s = h('select', { onchange: (e) => { reglages[k] = conv(e.target.value); apres?.(); } }, options.map(([v, t]) => h('option', { value: v }, t)));
      s.value = String(reglages[k]);
      return s;
    };

    function accueil() {
      arreter();
      remplir(el);
      const semaine = defiSemaine(progression(), aujourdhui());
      const recSemaine = records()[semaine.cle];
      const masque = records()[`${semaine.cle}-etoiles`]?.points ?? 0;
      el.append(h('h1', {}, 'Défis chrono'),
        h('div', { class: 'carte', style: 'margin-bottom:16px' },
          h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, `Défi de la semaine (${semaine.semaine.split('-S')[1]}e semaine) `, etoilesHtml(masque))),
          h('p', {}, `La même feuille toute la semaine, adaptée à votre niveau : ${semaine.description}. Trois étoiles à gagner :`),
          h('ul', {}, ETOILES.map((e) => h('li', { class: masque & e.bit ? '' : 'discret' }, `${Math.log2(e.bit) + 1}. ${e.nom} : ${e.texte}${masque & e.bit ? ' (obtenue)' : ''}`))),
          h('p', { class: 'discret' }, recSemaine ? `Votre meilleur temps cette semaine : ${formaterDuree(recSemaine.dureeMs)}.` : `Pas encore tenté. Score = temps + ${PENALITE_SEMAINE_MS / 1000} s par erreur.`),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => lancerSemaine() }, recSemaine ? 'Refaire la feuille' : 'Relever le défi'),
            h('button', { class: 'btn', onclick: () => lancerSansFilet() }, 'Étoile 3 : sans filet'))));

      const record = h('p', {});
      const majRecord = () => {
        const r = records()[cle()];
        record.textContent = r ? `Votre record : ${formaterDuree(r.dureeMs)} : c'est le rythme de votre fantôme.` : 'Pas encore de record : vous courrez contre le maître (rythme « confirmé »).';
      };
      majRecord();
      const typesOptions = Object.entries(TYPES).map(([k, t]) => [k, t.titre]);
      const recArcade = records()[`arcade-${reglages.arcade}`];
      const recEchelle = records().echelle;
      el.append(h('h2', {}, 'Défis libres'),
        h('p', { class: 'discret' }, `Enchaînez les calculs sur votre soroban. Chaque erreur ajoute ${PENALITE_MS / 1000} secondes. Deux barres : la vôtre et celle du fantôme ; l'écart s'affiche à chaque calcul. Les colonnes ne contiennent que les gestes des leçons validées.`),
        h('div', { class: 'reglages' }, select('type', typesOptions, String, majRecord),
          select('nombre', [10, 20, 30].map((n) => [n, `${n} calculs`]), Number, majRecord),
          h('button', { class: 'btn principal', onclick: () => lancer() }, 'Partez !')),
        record,
        h('h2', {}, 'Contre-la-montre arcade'),
        h('p', { class: 'discret' }, `${ARCADE.capitalMs / 1000} s au départ, qui s'écoulent. Chaque calcul juste rajoute du temps (un peu moins que le temps « confirmé » du calcul ; davantage après ${ARCADE.serieBonus} justes d'affilée). Chaque erreur retire ${ARCADE.erreurMs / 1000} s et casse la série. Trouvez l'équilibre entre vitesse et justesse.`),
        h('div', { class: 'reglages' }, select('arcade', typesOptions.filter(([k]) => k !== 'mix')),
          h('button', { class: 'btn principal', onclick: () => lancerArcade() }, 'Jouer')),
        h('p', { class: 'discret' }, recArcade ? `Record : ${recArcade.points} calculs justes (${formaterDuree(recArcade.dureeMs)} tenues).` : 'Pas encore de record.'),
        h('h2', {}, 'Échelle des kyū'),
        h('p', { class: 'discret' }, '10 marches, de très facile au boss : colonnes de plus en plus longues, et multiplication ou division dès que ces leçons sont validées. Une erreur : on reste sur la marche. Le temps total est votre score.'),
        h('div', { class: 'reglages' }, h('button', { class: 'btn principal', onclick: () => lancerEchelle() }, 'Grimper')),
        h('p', { class: 'discret' }, recEchelle ? `Record : ${formaterDuree(recEchelle.dureeMs)}.` : 'Pas encore de record.'));
    }

    // ------------------------------------------------------------ défis libres
    function lancer() {
      remplir(el, retourBtn(), h('h1', {}, TYPES[reglages.type].titre));
      const r = records()[cle()];
      const generer = TYPES[reglages.type].generer;
      const fantome = r ? { msParExercice: r.dureeMs / reglages.nombre, nom: 'votre record' } : fantomeMaitre(generer, 'confirme');
      courant = creerSerie(el, {
        generer,
        nombre: reglages.nombre,
        chrono: true,
        defi: true,
        fantome,
        surFin: async (b) => {
          courant.detruire();
          courant = null;
          const erreurs = b.total - b.justes;
          const score = b.dureeMs + erreurs * PENALITE_MS;
          await enregistrerSession({ module: 'defis', mode: reglages.type, reglages: { ...reglages }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const nouveau = await proposerRecord(cle(), score);
          const med = medaille(b.dureeMs / b.total, b.resultats.map((x) => x.ex), b.justes, b.total);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(score)),
            h('p', {}, `${b.justes} / ${b.total} justes · temps ${formaterDuree(b.dureeMs)}${erreurs ? ` + ${erreurs} × ${PENALITE_MS / 1000} s de pénalité` : ''}`),
            med ? h('p', {}, badgeClassement(med.nom, med.nom[0].toUpperCase() + med.nom.slice(1)), ' ', med.texte) : null,
            nouveau ? h('p', { class: 'retour ok' }, r ? `Nouveau record : ${formaterDuree(r.dureeMs - score)} de mieux que votre fantôme.` : 'Premier record : votre fantôme est né.') : h('p', { class: 'discret' }, `Fantôme (record) : ${formaterDuree(records()[cle()].dureeMs)}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Rejouer'), h('button', { class: 'btn', onclick: () => accueil() }, 'Changer de défi'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    // ------------------------------------------------------------ arcade
    function lancerArcade() {
      const type = reglages.arcade;
      const generer = TYPES[type].generer;
      let reste = ARCADE.capitalMs;
      let serie = 0;
      let justes = 0;
      const debut = performance.now();
      let dernier = debut;
      const remplissage = h('div', {});
      const jauge = h('div', { class: 'jauge-arcade', role: 'progressbar' }, remplissage);
      const temps = h('strong', {});
      const info = h('span', { class: 'discret' });
      remplir(el, retourBtn(), h('h1', {}, `Arcade · ${TYPES[type].titre}`), jauge, h('div', { class: 'ruban-entete' }, temps, info));
      const maj = () => {
        remplissage.style.width = `${Math.max(0, (100 * reste) / ARCADE.maxMs)}%`;
        jauge.classList.toggle('alerte', reste < 10000);
        temps.textContent = formaterDuree(Math.max(0, reste));
        info.textContent = `${justes} juste${justes > 1 ? 's' : ''} · série ${serie}${serie >= ARCADE.serieBonus ? ' (bonus ×1,25)' : ''}`;
      };
      courant = creerSerie(el, {
        generer,
        nombre: Infinity,
        defi: true,
        fin: () => reste <= 0,
        surExercice: (res, ex) => {
          if (res.juste) {
            justes += 1;
            serie += 1;
            const bonus = tempsCible(ex, niveau('confirme')) * 1000 * ARCADE.coefBonus * (serie >= ARCADE.serieBonus ? ARCADE.coefSerie : 1);
            reste = Math.min(ARCADE.maxMs, reste + bonus);
          } else {
            serie = 0;
            reste -= ARCADE.erreurMs;
            jauge.classList.add('flash');
            setTimeout(() => jauge.classList.remove('flash'), 400);
          }
          maj();
        },
        surFin: async (b) => {
          arreter();
          const tenu = performance.now() - debut;
          await enregistrerSession({ module: 'defis', mode: 'arcade', reglages: { type }, total: b.total, justes: b.justes, dureeMs: tenu });
          const nouveau = await proposerMeilleurScore(`arcade-${type}`, b.justes, { dureeMs: tenu });
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} calcul${b.justes > 1 ? 's' : ''} justes`),
            h('p', {}, `Tenu ${formaterDuree(tenu)} · ${b.total - b.justes} erreur${b.total - b.justes > 1 ? 's' : ''}`),
            nouveau ? h('p', { class: 'retour ok' }, 'Nouveau record !') : h('p', { class: 'discret' }, `Record : ${records()[`arcade-${type}`].points} calculs justes.`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancerArcade() }, 'Rejouer'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
      maj();
      minuterie = setInterval(() => {
        const t = performance.now();
        reste -= t - dernier;
        dernier = t;
        maj();
        if (reste <= 0) courant?.terminer();
      }, 100);
    }

    // ------------------------------------------------------------ échelle des kyū
    function lancerEchelle() {
      const liste = marches(progression());
      let marche = 0;
      const rec = records().echelle;
      remplir(el, retourBtn(), h('h1', {}, 'Échelle des kyū'),
        h('p', { class: 'discret' }, rec ? `Record à battre : ${formaterDuree(rec.dureeMs)}.` : 'Premier essai : grimpez les 10 marches.'));
      courant = creerSerie(el, {
        generer: () => liste[Math.min(marche, liste.length - 1)].generer(),
        nombre: Infinity,
        chrono: true,
        defi: true,
        compteur: () => `marche ${Math.min(marche + 1, liste.length)} / ${liste.length} · ${liste[Math.min(marche, liste.length - 1)].titre}`,
        fin: () => marche >= liste.length,
        surExercice: (res) => { if (res.juste) marche += 1; },
        surFin: async (b) => {
          arreter();
          await enregistrerSession({ module: 'defis', mode: 'echelle', reglages: {}, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const nouveau = await proposerRecord('echelle', b.dureeMs);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(b.dureeMs)),
            h('p', {}, `10 marches en ${b.total} calculs (${b.total - b.justes} erreur${b.total - b.justes > 1 ? 's' : ''}).`),
            nouveau ? h('p', { class: 'retour ok' }, rec ? `Nouveau record : ${formaterDuree(rec.dureeMs - b.dureeMs)} de mieux.` : 'Premier record.') : h('p', { class: 'discret' }, `Record : ${formaterDuree(records().echelle.dureeMs)}.`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancerEchelle() }, 'Regrimper'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    // ------------------------------------------------------------ défi de la semaine
    async function gagnerEtoiles(semaine, bits) {
      const avant = records()[`${semaine.cle}-etoiles`]?.points ?? 0;
      const apres = avant | bits;
      if (apres !== avant) await proposerMeilleurScore(`${semaine.cle}-etoiles`, apres);
      return apres & ~avant; // étoiles nouvellement gagnées
    }

    function lancerSemaine() {
      const semaine = defiSemaine(progression(), aujourdhui());
      const avant = records()[semaine.cle];
      const problemes = semaine.sections.flatMap((s) => s.problemes);
      // Temps « confirmé » de la feuille : seuils du niveau + frappe de chaque réponse.
      const cibleVitesse = problemes.reduce((t, ex) => t + (tempsCible(ex, niveau('confirme')) + SURCOUT_FEUILLE_S) * 1000, 0);
      remplir(el, retourBtn());
      courant = creerFeuille(el, {
        titre: `Défi de la semaine · ${semaine.description}`,
        sections: semaine.sections,
        surFin: (b) => {
          const score = b.dureeMs + (b.total - b.justes) * PENALITE_SEMAINE_MS;
          enregistrerSession({ module: 'defis', mode: 'semaine', reglages: { semaine: semaine.cle }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const reussi = b.justes >= 0.8 * b.total;
          const info = h('p', {});
          const zoneEtoiles = h('p', {});
          const bits = (b.justes >= 0.9 * b.total ? 1 : 0) | (b.justes === b.total && b.dureeMs <= cibleVitesse ? 2 : 0);
          gagnerEtoiles(semaine, bits).then((nouvelles) => {
            const total = records()[`${semaine.cle}-etoiles`]?.points ?? 0;
            remplir(zoneEtoiles, etoilesHtml(total), nouvelles ? ` Nouvelle${nouvelles === 3 ? 's' : ''} étoile${nouvelles === 3 ? 's' : ''} : ${ETOILES.filter((e) => nouvelles & e.bit).map((e) => e.nom).join(', ')} !` : '',
              !(total & 2) ? h('div', { class: 'discret' }, `Étoile vitesse : 0 erreur en moins de ${formaterDuree(cibleVitesse)}.`) : null);
          });
          if (reussi) {
            proposerRecord(semaine.cle, score).then((nouveau) => {
              info.textContent = nouveau ? (avant ? `Nouveau meilleur temps de la semaine : ${formaterDuree(avant.dureeMs - score)} de gagné.` : 'Premier temps de la semaine enregistré.') : `Meilleur temps de la semaine : ${formaterDuree(avant.dureeMs)}.`;
            });
          } else {
            info.textContent = 'Il faut au moins 80 % de justes pour que le temps compte.';
          }
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(score)),
            h('p', {}, `${b.justes} / ${b.total} justes · temps ${formaterDuree(b.dureeMs)}${b.total - b.justes ? ` + ${(b.total - b.justes) * PENALITE_SEMAINE_MS / 1000} s de pénalité` : ''}`),
            zoneEtoiles, info,
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancerSemaine() }, 'Refaire'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour')));
        },
      });
    }

    /** Étoile 3 : 5 colonnes nouvelles (on ne connaît pas les réponses), une par une, au rythme expert. */
    function lancerSansFilet() {
      const semaine = defiSemaine(progression(), aujourdhui());
      const f = formatSemaine(progression());
      const mem = creerMemoire(5);
      const generer = () => genererColonneVariee({ chiffres: f.chiffres, lignes: 5, autorises: f.appris, cibles: f.amis.length ? f.amis : famille('direct') }, mem);
      remplir(el, retourBtn(), h('h1', {}, 'Étoile 3 : sans filet'),
        h('p', { class: 'discret' }, 'Cinq colonnes nouvelles, du format de la semaine. Toutes justes, et plus vite que le maître (rythme expert).'));
      courant = creerSerie(el, {
        generer,
        nombre: 5,
        chrono: true,
        defi: true,
        fantome: fantomeMaitre(generer, 'expert'),
        surFin: async (b) => {
          arreter();
          const cible = b.resultats.reduce((t, x) => t + tempsCible(x.ex, niveau('expert')) * 1000, 0);
          const gagne = b.justes === b.total && b.dureeMs <= cible;
          if (gagne) await gagnerEtoiles(semaine, 4);
          await enregistrerSession({ module: 'defis', mode: 'sans-filet', reglages: { semaine: semaine.cle }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(b.dureeMs)),
            h('p', {}, `${b.justes} / ${b.total} justes · rythme expert : ${formaterDuree(cible)}`),
            h('p', { class: gagne ? 'retour ok' : 'discret' }, gagne ? 'Étoile 3 gagnée : sans filet !' : (b.justes < b.total ? 'Il faut les 5 justes.' : `Encore ${formaterDuree(b.dureeMs - cible)} à gagner.`)),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancerSansFilet() }, 'Retenter'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    if (params.semaine) lancerSemaine();
    else accueil();
    return () => arreter();
  },
};
