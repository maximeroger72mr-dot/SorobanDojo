/**
 * Défis chrono : N calculs sur son soroban, le plus vite possible, contre son « fantôme »
 * (le rythme de son record). Score = temps + 5 s par erreur.
 *
 * Défi de la semaine : la même feuille toute la semaine, adaptée au niveau ; on peut la refaire
 * autant de fois qu'on veut et voir son meilleur temps progresser.
 */

import { genererColonne } from '../core/generateur.js';
import { genererMultiplication, genererDivision } from '../core/multiplication.js';
import { enregistrerSession, proposerRecord, progression, aujourdhui } from '../core/progression.js';
import { defiSemaine } from '../core/parcours.js';
import { motifsAppris } from './planches.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { creerFeuille } from '../ui/feuille.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

const PENALITE_MS = 5000;
const PENALITE_SEMAINE_MS = 10000;
const reglages = { type: 'colonnes2', nombre: 20 };

const TYPES = {
  colonnes1: { titre: 'Colonnes, 1 chiffre, 5 lignes', generer: () => colonne(1) },
  colonnes2: { titre: 'Colonnes, 2 chiffres, 5 lignes', generer: () => colonne(2) },
  colonnes3: { titre: 'Colonnes, 3 chiffres, 5 lignes', generer: () => colonne(3) },
  mul21: { titre: 'Multiplications 2 × 1 chiffres', generer: () => genererMultiplication(2, 1) },
  mul22: { titre: 'Multiplications 2 × 2 chiffres', generer: () => genererMultiplication(2, 2) },
  div: { titre: 'Divisions (÷ 1 chiffre, quotient 2 chiffres)', generer: () => genererDivision(1, 2) },
  mix: { titre: 'Mélange (colonnes, multiplications, divisions)', generer: () => [() => colonne(2), () => genererMultiplication(2, 1), () => genererDivision(1, 2)][Math.floor(Math.random() * 3)]() },
};

/** Colonne limitée aux gestes appris (aucun ami jamais vu). */
function colonne(chiffres) {
  const appris = motifsAppris();
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  return genererColonne({ chiffres, lignes: 5, autorises: appris, cibles: amis.length ? amis : [...appris] });
}

export default {
  id: 'defis',
  titre: 'Défis chrono',
  monter(el, app, params = {}) {
    let courant = null;
    const cle = () => `defi-${reglages.type}-${reglages.nombre}`;
    const records = () => progression().records;

    function accueil() {
      courant?.detruire();
      courant = null;
      remplir(el);
      const semaine = defiSemaine(progression(), aujourdhui());
      const recSemaine = records()[semaine.cle];
      el.append(h('h1', {}, 'Défis chrono'),
        h('div', { class: 'carte', style: 'margin-bottom:16px' },
          h('div', { class: 'ligne' }, h('h2', { style: 'margin:0;flex:1' }, `Défi de la semaine (${semaine.semaine.split('-S')[1]}e semaine)`),
            h('button', { class: 'btn principal', onclick: () => lancerSemaine() }, recSemaine ? 'Améliorer mon temps' : 'Relever le défi')),
          h('p', {}, `La même feuille toute la semaine, adaptée à votre niveau : ${semaine.description}. Refaites-la autant de fois que vous voulez.`),
          h('p', { class: 'discret' }, recSemaine ? `Votre meilleur temps cette semaine : ${formaterDuree(recSemaine.dureeMs)}.` : `Pas encore tenté. Score = temps + ${PENALITE_SEMAINE_MS / 1000} s par erreur.`)));

      const typeSel = h('select', { onchange: (e) => { reglages.type = e.target.value; majRecord(); } },
        Object.entries(TYPES).map(([k, t]) => h('option', { value: k }, t.titre)));
      typeSel.value = reglages.type;
      const nbSel = h('select', { onchange: (e) => { reglages.nombre = Number(e.target.value); majRecord(); } },
        [10, 20, 30].map((n) => h('option', { value: n }, `${n} calculs`)));
      nbSel.value = String(reglages.nombre);
      const record = h('p', {});
      const majRecord = () => {
        const r = records()[cle()];
        record.textContent = r ? `Votre record : ${formaterDuree(r.dureeMs)} : c'est le rythme de votre fantôme.` : 'Pas encore de record pour ce défi.';
      };
      majRecord();
      el.append(h('h2', {}, 'Défis libres'),
        h('p', { class: 'discret' }, `Enchaînez les calculs sur votre soroban. Chaque erreur ajoute ${PENALITE_MS / 1000} secondes. Un « fantôme » avance au rythme de votre record. Les colonnes ne contiennent que les gestes des leçons validées.`),
        h('div', { class: 'reglages' }, typeSel, nbSel, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Partez !')),
        record);
    }

    function lancer() {
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Défis'), h('h1', {}, TYPES[reglages.type].titre));
      const r = records()[cle()];
      courant = creerSerie(el, {
        generer: TYPES[reglages.type].generer,
        nombre: reglages.nombre,
        chrono: true,
        defi: true,
        fantome: r ? { msParExercice: r.dureeMs / reglages.nombre } : null,
        surFin: async (b) => {
          courant.detruire();
          courant = null;
          const erreurs = b.total - b.justes;
          const score = b.dureeMs + erreurs * PENALITE_MS;
          await enregistrerSession({ module: 'defis', mode: reglages.type, reglages: { ...reglages }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const nouveau = await proposerRecord(cle(), score);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(score)),
            h('p', {}, `${b.justes} / ${b.total} justes · temps ${formaterDuree(b.dureeMs)}${erreurs ? ` + ${erreurs} × ${PENALITE_MS / 1000} s de pénalité` : ''}`),
            nouveau ? h('p', { class: 'retour ok' }, r ? `Nouveau record : ${formaterDuree(r.dureeMs - score)} de mieux que votre fantôme.` : 'Premier record : votre fantôme est né.') : h('p', { class: 'discret' }, `Fantôme (record) : ${formaterDuree(records()[cle()].dureeMs)}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Rejouer'), h('button', { class: 'btn', onclick: () => accueil() }, 'Changer de défi'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    function lancerSemaine() {
      const semaine = defiSemaine(progression(), aujourdhui());
      const avant = records()[semaine.cle];
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Défis'));
      courant = creerFeuille(el, {
        titre: `Défi de la semaine · ${semaine.description}`,
        sections: semaine.sections,
        surFin: (b) => {
          const score = b.dureeMs + (b.total - b.justes) * PENALITE_SEMAINE_MS;
          enregistrerSession({ module: 'defis', mode: 'semaine', reglages: { semaine: semaine.cle }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          // Le défi compte comme réussi (et entre dans les records) à partir de 80 % de justes.
          const reussi = b.justes >= 0.8 * b.total;
          const info = h('p', {});
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
            info,
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancerSemaine() }, 'Refaire'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour')));
        },
      });
    }

    if (params.semaine) lancerSemaine();
    else accueil();
    return () => courant?.detruire();
  },
};
