/**
 * « J'ai déjà pratiqué : tester mon niveau » (voir core/positionnement.js).
 * On choisit d'abord ce que l'on sait faire : le test commence à ce niveau. Réussi, il valide ce
 * niveau et ceux d'en dessous ; raté, on redescend d'un niveau.
 */

import { PALIERS_TEST, COLONNES_PALIER, MIN_PALIER, colonneTest, suiteTest } from '../core/positionnement.js';
import { progression, validerParTest, enregistrerSession } from '../core/progression.js';
import { creerSerie } from '../ui/serie.js';
import { h, remplir, formaterDuree } from '../ui/dom.js';

export default {
  id: 'positionnement',
  titre: 'Tester mon niveau',
  monter(el, app) {
    let serie = null;

    function accueil() {
      const d = progression();
      const deja = d.positionnement;
      // Niveau proposé par défaut : le premier palier dont les leçons ne sont pas toutes validées.
      const defaut = Math.max(0, PALIERS_TEST.findIndex((p) => !p.lecons.every((id) => d.paliers[id]?.valide)));
      let choix = defaut;
      const options = PALIERS_TEST.map((p, k) => {
        const radio = h('input', { type: 'radio', name: 'niveau-test', value: String(k), onchange: () => { choix = k; bouton.textContent = `Commencer le test : ${p.titre}`; } });
        if (k === defaut) radio.checked = true;
        return h('label', { class: 'choix-niveau' }, radio, h('span', {}, k === 0 ? 'Je débute, ou je ne connais que les gestes directs' : `Je sais faire jusqu'à : ${p.titre.toLowerCase()}`));
      });
      const bouton = h('button', { class: 'btn principal', onclick: () => palier(choix, { rate: null }) }, `Commencer le test : ${PALIERS_TEST[defaut].titre}`);
      remplir(el, h('h1', {}, 'Tester mon niveau'),
        h('p', { class: 'chapeau discret' }, 'Pour qui a déjà pratiqué : inutile de refaire les leçons que vous maîtrisez.'),
        h('div', { class: 'carte' },
          h('h2', { style: 'margin-top:0' }, 'Que savez-vous déjà faire ?'),
          h('div', { class: 'liste-choix-niveau' }, options),
          h('ul', {},
            h('li', {}, `Le test commence au niveau choisi : ${COLONNES_PALIER} exercices sur votre soroban, ${MIN_PALIER} justes pour réussir.`),
            h('li', {}, 'Réussi : ce niveau et tous ceux d\'en dessous sont validés, et vous pouvez tenter le suivant. Raté : on redescend d\'un niveau.'),
            h('li', {}, 'Les leçons validées ont une première révision dans 3 jours, qui confirme la leçon ou la rouvre.'),
            h('li', {}, 'Seule la justesse compte ici : vos vitesses se mesureront ensuite, en pratiquant. Un kyū réussi en examen vaut aussi un test : ses leçons sont validées d\'office.'))),
        deja ? h('p', { class: 'discret' }, `Dernier test le ${new Date(`${deja.date}T12:00`).toLocaleDateString('fr-FR')} : ${deja.lecons} leçon${deja.lecons > 1 ? 's' : ''} validée${deja.lecons > 1 ? 's' : ''}.`) : null,
        h('div', { class: 'ligne' }, bouton,
          h('button', { class: 'btn', onclick: () => app.aller('seance') }, 'Plus tard')));
    }

    function palier(k, etat) {
      const p = PALIERS_TEST[k];
      remplir(el, h('h1', {}, `Test : ${p.titre}`),
        h('p', { class: 'discret' }, `${COLONNES_PALIER} exercices. Prenez votre temps : seule la justesse compte.`));
      serie = creerSerie(el, {
        generer: () => colonneTest(p),
        nombre: COLONNES_PALIER,
        defi: true,
        surFin: async (b) => {
          serie.detruire();
          serie = null;
          const reussi = b.justes >= MIN_PALIER;
          await enregistrerSession({ module: 'positionnement', mode: p.id, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const suite = suiteTest(k, reussi, etat);
          // Réussi : ce palier ET ceux d'en dessous sont validés « par le test ».
          const ids = PALIERS_TEST.slice(0, suite.valides).flatMap((x) => x.lecons);
          const avant = ids.filter((id) => progression().paliers[id]?.valide).length;
          if (ids.length) await validerParTest(ids);
          const suivant = suite.suivant !== null ? PALIERS_TEST[suite.suivant] : null;
          const etatSuivant = reussi ? etat : { rate: k };
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
            reussi
              ? h('p', { class: 'retour ok' }, `Réussi : les leçons jusqu'à « ${p.titre} » sont validées${ids.length - avant ? ` (${ids.length - avant} de plus)` : ''}. Première révision dans 3 jours.`)
              : h('p', {}, suivant ? `Il en fallait ${MIN_PALIER}. Pas grave : on essaie le niveau d'en dessous, « ${suivant.titre} ».` : `Il en fallait ${MIN_PALIER}. Le test s'arrête ici, et c'est très bien : le parcours reprend exactement là où vous en êtes.`),
            h('div', { class: 'ligne' },
              suivant ? h('button', { class: 'btn principal', onclick: () => palier(suite.suivant, etatSuivant) }, `${reussi ? 'Niveau suivant' : 'Niveau d\'en dessous'} : ${suivant.titre}`) : null,
              h('button', { class: suivant ? 'btn' : 'btn principal', onclick: () => app.aller('seance') }, suivant ? 'M\'arrêter là' : 'Aller à la séance du jour'),
              h('button', { class: 'btn', onclick: () => app.aller('lecons') }, 'Voir le parcours'))));
        },
      });
    }

    accueil();
    return () => serie?.detruire();
  },
};
