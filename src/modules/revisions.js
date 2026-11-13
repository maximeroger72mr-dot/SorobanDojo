/**
 * Révisions du jour (répétition espacée, boîtes de Leitner J+1, J+3, J+7, J+14, J+30).
 *
 * Liste les leçons dont la révision est arrivée à échéance. Chacune se révise par un test flash
 * de 10 calculs sur son soroban : 9 réussites font monter la leçon d'une boîte, sinon elle
 * redescend d'une boîte. Propose aussi une révision ciblée sur les points faibles détectés.
 */

import { sousPalier, SOUS_PALIERS, genererExercice } from '../core/curriculum.js';
import { genererColonneVariee, creerMemoire } from '../core/generateur.js';
import { famille, nomMotif } from '../core/motifs.js';
import { INTERVALLES } from '../core/revision.js';
import {
  revisionsDues, etatPalier, enregistrerRevision, enregistrerSession, poidsAdaptatifs,
  motifsEnDifficulte, aujourdhui, statsTables, rouvrirPalier,
} from '../core/progression.js';
import { produitsARetravailler } from '../core/tables.js';
import { questionDoigte } from '../ui/doigte.js';
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
  monter(el, app, params = {}) {
    let serie = null;

    function liste() {
      serie?.detruire();
      serie = null;
      remplir(el);
      app.majBadges();
      // Les plus en retard d'abord (la séance du jour en demande un nombre limité).
      const dues = revisionsDues().map(sousPalier).filter(Boolean).sort((a, b) => etatPalier(a.id).carte.echeance.localeCompare(etatPalier(b.id).carte.echeance));
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
        const m = melangeables();
        if (m.length > 1) el.append(h('button', { class: 'btn principal', style: 'margin-top:8px', onclick: () => melange(m) }, `Révision mélangée : ${m.length} leçons, ${FLASH.exercices} calculs`));
      } else {
        el.append(h('div', { class: 'carte' }, 'Rien à réviser aujourd\'hui.'));
      }

      if (faibles.length) {
        el.append(h('h2', {}, 'Points faibles'),
          h('p', {}, faibles.map((f) => nomMotif(f.cle)).join(' · ')),
          h('button', { class: 'btn principal', onclick: () => cible(faibles.map((f) => f.cle)) }, `Révision ciblée (${FLASH.exercices} calculs)`));
      }

      // Diagnostic des tables : les produits faux ou plus lents que 2,5 s, jusqu'à ce qu'ils passent.
      const produits = produitsARetravailler(statsTables());
      if (produits.length) {
        el.append(h('h2', {}, 'Produits à retravailler'),
          h('p', {}, produits.slice(0, 20).map((c) => c.replace('x', ' × ')).join(' · '), produits.length > 20 ? ' …' : ''),
          h('p', { class: 'discret' }, 'Faux récemment ou plus lents que 2,5 s : ils sortent de la liste dès qu\'ils passent sous 2,5 s sans erreur.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('drills', { tables: 'lents', auto: true }) }, 'Mes produits à retravailler'));
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

    function lancerSerie({ titre, sousTitre, generer, apresBilan, placement = false, sp = null }) {
      remplir(el, 
        h('button', { class: 'lien', onclick: () => liste() }, '← Révisions'),
        h('h1', {}, titre), h('p', { class: 'discret' }, sousTitre));
      serie = (placement ? creerPlacement : creerSerie)(el, {
        generer, nombre: FLASH.exercices, chrono: true, defi: true, pauseErreur: true,
        surFin: async (bilan) => {
          serie.detruire();
          serie = null;
          const message = await apresBilan(bilan);
          const doigte = sp && Math.random() < 0.3 ? questionDoigte(app, sp) : null;
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${bilan.justes} / ${bilan.total}`),
            h('p', {}, `Temps : ${formaterDuree(bilan.dureeMs)} · ${formaterDuree(bilan.dureeMs / bilan.total)} par calcul`),
            h('p', {}, message),
            h('button', { class: 'btn principal', onclick: () => liste() }, 'Retour aux révisions')),
          doigte ?? '', listeErreurs(bilan.resultats) ?? '');
        },
      });
    }

    function flash(sp) {
      lancerSerie({
        titre: `Test flash : ${sp.titre}`,
        sousTitre: `${FLASH.exercices} calculs sur votre soroban. ${FLASH.reussitesMin} réussites font monter la leçon d'une boîte.`,
        generer: () => genererExercice(sp, poidsAdaptatifs(sp.type === 'addsub' ? sp.cibles : [])),
        placement: sp.type === 'placement',
        sp,
        apresBilan: async (b) => {
          const reussi = b.justes >= FLASH.reussitesMin;
          // Leçon validée par le test de positionnement : la première révision confirme ou rouvre.
          if (etatPalier(sp.id).parTest && !etatPalier(sp.id).confirme) {
            if (!reussi) {
              await rouvrirPalier(sp.id);
              await enregistrerSession({ module: 'revisions', mode: 'flash', reglages: { sousPalier: sp.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
              return `Cette leçon avait été validée par le test de positionnement ; elle est rouverte pour la reprendre tranquillement (le mini-test suffit à la revalider).`;
            }
            etatPalier(sp.id).confirme = aujourdhui();
          }
          await enregistrerRevision(sp.id, reussi);
          await enregistrerSession({ module: 'revisions', mode: 'flash', reglages: { sousPalier: sp.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const c = etatPalier(sp.id).carte;
          return reussi
            ? `Automatisme entretenu : boîte ${c.boite}, prochaine révision ${dateFr(c.echeance)}.`
            : `Moins de ${FLASH.reussitesMin} réussites : la leçon redescend en boîte ${c.boite}, à revoir ${dateFr(c.echeance)}.`;
        },
      });
    }

    /**
     * Révision mélangée : 10 calculs qui alternent les leçons dues (les plus en retard d'abord,
     * 5 au plus). Il faut choisir le bon geste à chaque calcul. Chaque leçon garde sa boîte :
     * elle monte si tous ses calculs sont justes (une erreur tolérée à partir de 4 calculs).
     */
    function melange(sps) {
      const ordre = Array.from({ length: FLASH.exercices }, (_, i) => sps[i % sps.length]);
      for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
      let k = 0;
      lancerSerie({
        titre: 'Révision mélangée',
        sousTitre: `${FLASH.exercices} calculs sur votre soroban, mélangés : ${sps.map((x) => `« ${x.titre} »`).join(', ')}. Chaque leçon garde sa boîte de révision.`,
        generer: () => { const sp = ordre[k++ % ordre.length]; return { ...genererExercice(sp, poidsAdaptatifs(sp.type === 'addsub' ? sp.cibles : [])), revision: sp.id }; },
        apresBilan: async (b) => {
          const premiers = new Map();
          for (const r of b.resultats) if (!premiers.has(r.ex)) premiers.set(r.ex, r.juste);
          const lignes = [];
          for (const sp of sps) {
            const res = [...premiers].filter(([ex]) => ex.revision === sp.id).map(([, j]) => j);
            if (!res.length) continue;
            const fautes = res.filter((j) => !j).length;
            const reussi = fautes === 0 || (res.length >= 4 && fautes <= 1);
            await enregistrerRevision(sp.id, reussi);
            const c = etatPalier(sp.id).carte;
            lignes.push(`${sp.titre} : ${res.length - fautes} / ${res.length}, ${reussi ? `boîte ${c.boite}` : `redescend en boîte ${c.boite}`}`);
          }
          await enregistrerSession({ module: 'revisions', mode: 'melange', reglages: { lecons: sps.map((x) => x.id) }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          return lignes.join(' · ');
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

    const melangeables = () => revisionsDues().map(sousPalier).filter((sp) => sp && !['placement', 'lire', 'complement', 'theorie', 'photo', 'tenir'].includes(sp.type))
      .sort((a, b) => etatPalier(a.id).carte.echeance.localeCompare(etatPalier(b.id).carte.echeance)).slice(0, 5);
    if (params.melange && melangeables().length > 1) melange(melangeables());
    else liste();
    return () => serie?.detruire();
  },
};
