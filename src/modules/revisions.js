/**
 * Révisions du jour (répétition espacée, boîtes de Leitner J+1, J+3, J+7, J+14, J+30).
 *
 * Liste les leçons dont la révision est arrivée à échéance. Chacune se révise par un test flash
 * de 10 calculs sur son soroban : 9 réussites font monter la leçon d'une boîte, sinon elle revient
 * en boîte 1. Propose aussi une révision ciblée sur les points faibles détectés.
 */

import { sousPalier, SOUS_PALIERS, genererExercice } from '../core/curriculum.js';
import { genererColonneVariee, creerMemoire } from '../core/generateur.js';
import { famille, nomMotif } from '../core/motifs.js';
import { INTERVALLES } from '../core/revision.js';
import {
  revisionsDues, etatPalier, enregistrerRevision, enregistrerSession, poidsAdaptatifs,
  motifsEnDifficulte, aujourdhui,
} from '../core/progression.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { creerPlacement } from '../ui/placement.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

const FLASH = { exercices: 10, reussitesMin: 9 };
const dateFr = (d) => new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const ecartJours = (a, b) => Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 86400000);

export default {
  id: 'revisions',
  titre: 'Révisions du jour',
  badge: () => revisionsDues().length,
  monter(el, app) {
    let serie = null;

    function liste() {
      serie?.detruire();
      serie = null;
      remplir(el);
      app.majBadges();
      const dues = revisionsDues().map(sousPalier).filter(Boolean);
      const faibles = motifsEnDifficulte();
      el.append(h('h1', {}, 'Révisions du jour'),
        h('p', { class: 'discret' }, `Chaque leçon validée revient à intervalles croissants (${INTERVALLES.map((j) => `J+${j}`).join(', ')}). Un test flash de ${FLASH.exercices} calculs sur votre soroban entretient l'automatisme.`));

      if (dues.length) {
        el.append(h('div', { class: 'liste-paliers' }, dues.map((sp) => {
          const c = etatPalier(sp.id).carte;
          const retard = ecartJours(c.echeance, aujourdhui());
          return h('button', { class: 'ligne-palier', onclick: () => flash(sp) },
            h('span', { class: 'icone' }, '●'),
            h('span', { class: 'titre' }, sp.titre, h('span', { class: 'discret' }, ` · ${sp.palier.titre}`)),
            h('span', { class: 'statut' }, `Boîte ${c.boite}${retard > 0 ? ` · en retard de ${retard} j` : ''} · Test flash →`));
        })));
      } else {
        el.append(h('div', { class: 'carte' }, 'Rien à réviser aujourd\'hui.'));
      }

      if (faibles.length) {
        el.append(h('h2', {}, 'Points faibles'),
          h('p', {}, faibles.map((f) => nomMotif(f.cle)).join(' · ')),
          h('button', { class: 'btn principal', onclick: () => cible(faibles.map((f) => f.cle)) }, `Révision ciblée (${FLASH.exercices} calculs)`));
      }

      const avenir = SOUS_PALIERS.map((sp) => ({ sp, c: etatPalier(sp.id).carte }))
        .filter(({ c }) => c && c.echeance > aujourdhui())
        .sort((a, b) => a.c.echeance.localeCompare(b.c.echeance));
      if (avenir.length) {
        el.append(h('h2', {}, 'Prochaines révisions'),
          h('table', {}, h('tr', {}, h('th', {}, 'Leçon'), h('th', {}, 'Boîte'), h('th', {}, 'Date')),
            avenir.slice(0, 12).map(({ sp, c }) => h('tr', {}, h('td', {}, sp.titre), h('td', {}, c.boite), h('td', {}, dateFr(c.echeance))))));
      }
      if (!dues.length && !faibles.length && !avenir.length) {
        el.append(h('p', { class: 'discret' }, 'Les leçons validées apparaîtront ici au fil des jours.'),
          h('button', { class: 'btn', onclick: () => app.aller('lecons') }, 'Aller aux leçons'));
      }
    }

    function lancerSerie({ titre, sousTitre, generer, apresBilan, placement = false }) {
      remplir(el, 
        h('button', { class: 'lien', onclick: () => liste() }, '← Révisions'),
        h('h1', {}, titre), h('p', { class: 'discret' }, sousTitre));
      serie = (placement ? creerPlacement : creerSerie)(el, {
        generer, nombre: FLASH.exercices, chrono: true, defi: true,
        surFin: async (bilan) => {
          serie.detruire();
          serie = null;
          const message = await apresBilan(bilan);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${bilan.justes} / ${bilan.total}`),
            h('p', {}, `Temps : ${formaterDuree(bilan.dureeMs)} · ${formaterDuree(bilan.dureeMs / bilan.total)} par calcul`),
            h('p', {}, message),
            h('button', { class: 'btn principal', onclick: () => liste() }, 'Retour aux révisions')),
          listeErreurs(bilan.resultats) ?? '');
        },
      });
    }

    function flash(sp) {
      lancerSerie({
        titre: `Test flash : ${sp.titre}`,
        sousTitre: `${FLASH.exercices} calculs sur votre soroban. ${FLASH.reussitesMin} réussites font monter la leçon d'une boîte.`,
        generer: () => genererExercice(sp, poidsAdaptatifs(sp.type === 'addsub' ? sp.cibles : [])),
        placement: sp.type === 'placement',
        apresBilan: async (b) => {
          const reussi = b.justes >= FLASH.reussitesMin;
          await enregistrerRevision(sp.id, reussi);
          await enregistrerSession({ module: 'revisions', mode: 'flash', reglages: { sousPalier: sp.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const c = etatPalier(sp.id).carte;
          return reussi
            ? `Automatisme entretenu : boîte ${c.boite}, prochaine révision ${dateFr(c.echeance)}.`
            : `Moins de ${FLASH.reussitesMin} réussites : la leçon revient en boîte 1, à revoir ${dateFr(c.echeance)}.`;
        },
      });
    }

    function cible(cles) {
      // Uniquement les gestes directs et les points faibles : on répète exactement ce qui pose problème.
      const autorises = new Set([...famille('direct'), ...cles]);
      lancerSerie({
        titre: 'Révision ciblée des points faibles',
        sousTitre: cles.map(nomMotif).join(' · '),
        generer: ((memoire) => () => genererColonneVariee({ chiffres: 2, lignes: 5, autorises, cibles: cles, poids: poidsAdaptatifs(cles) }, memoire))(creerMemoire(6)),
        apresBilan: async (b) => {
          await enregistrerSession({ module: 'revisions', mode: 'cible', total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const restants = motifsEnDifficulte().length;
          return restants ? `Encore ${restants} point${restants > 1 ? 's' : ''} faible${restants > 1 ? 's' : ''} : chaque réussite les consolide.` : 'Tous les points faibles sont consolidés.';
        },
      });
    }

    liste();
    return () => serie?.detruire();
  },
};
