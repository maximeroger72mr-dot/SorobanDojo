/**
 * Défis chrono : N calculs sur son soroban, le plus vite possible.
 * Score = temps total + 5 secondes par erreur. Meilleur score personnel par type de défi.
 */

import { genererColonne } from '../core/generateur.js';
import { genererMultiplication, genererDivision } from '../core/multiplication.js';
import { enregistrerSession, proposerRecord, progression } from '../core/progression.js';
import { motifsAppris } from './planches.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h, formaterDuree } from '../ui/dom.js';

const PENALITE_MS = 5000;
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
  monter(el) {
    let serie = null;
    const cle = () => `defi-${reglages.type}-${reglages.nombre}`;

    function accueil() {
      serie?.detruire();
      serie = null;
      el.replaceChildren();
      const typeSel = h('select', { onchange: (e) => { reglages.type = e.target.value; majRecord(); } },
        Object.entries(TYPES).map(([k, t]) => h('option', { value: k }, t.titre)));
      typeSel.value = reglages.type;
      const nbSel = h('select', { onchange: (e) => { reglages.nombre = Number(e.target.value); majRecord(); } },
        [10, 20, 30].map((n) => h('option', { value: n }, `${n} calculs`)));
      nbSel.value = String(reglages.nombre);
      const record = h('p', {});
      const majRecord = () => {
        const r = progression().records[cle()];
        record.textContent = r ? `Votre record : ${formaterDuree(r.dureeMs)} (le ${new Date(`${r.date}T12:00`).toLocaleDateString('fr-FR')})` : 'Pas encore de record pour ce défi.';
      };
      majRecord();
      el.append(h('h1', {}, 'Défis chrono'),
        h('p', { class: 'discret' }, `Enchaînez les calculs sur votre soroban, le plus vite possible. Chaque erreur ajoute ${PENALITE_MS / 1000} secondes. Les colonnes ne contiennent que les gestes des leçons validées.`),
        h('div', { class: 'reglages' }, typeSel, nbSel, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Partez !')),
        record);
    }

    function lancer() {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => accueil() }, '← Défis'), h('h1', {}, TYPES[reglages.type].titre));
      serie = creerSerie(el, {
        generer: TYPES[reglages.type].generer,
        nombre: reglages.nombre,
        chrono: true,
        defi: true,
        surFin: async (b) => {
          serie.detruire();
          serie = null;
          const erreurs = b.total - b.justes;
          const score = b.dureeMs + erreurs * PENALITE_MS;
          await enregistrerSession({ module: 'defis', mode: reglages.type, reglages: { ...reglages }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const record = await proposerRecord(cle(), score);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, formaterDuree(score)),
            h('p', {}, `${b.justes} / ${b.total} justes · temps ${formaterDuree(b.dureeMs)}${erreurs ? ` + ${erreurs} × ${PENALITE_MS / 1000} s de pénalité` : ''}`),
            record ? h('p', { class: 'retour ok' }, 'Nouveau record personnel !') : h('p', { class: 'discret' }, `Record : ${formaterDuree(progression().records[cle()].dureeMs)}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Rejouer'), h('button', { class: 'btn', onclick: () => accueil() }, 'Changer de défi'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    accueil();
    return () => serie?.detruire();
  },
};
