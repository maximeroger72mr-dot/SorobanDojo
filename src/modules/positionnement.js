/**
 * « J'ai déjà pratiqué : tester mon niveau » (voir core/positionnement.js).
 * 4 paliers de 8 colonnes sur votre soroban ; 7 justes sur 8 pour passer au suivant. Chaque
 * palier réussi valide ses leçons tout de suite (on peut s'arrêter quand on veut).
 */

import { PALIERS_TEST, COLONNES_PALIER, MIN_PALIER, colonneTest } from '../core/positionnement.js';
import { progression, validerParTest, enregistrerSession } from '../core/progression.js';
import { creerSerie } from '../ui/serie.js';
import { h, remplir, formaterDuree } from '../ui/dom.js';

export default {
  id: 'positionnement',
  titre: 'Tester mon niveau',
  monter(el, app) {
    let serie = null;

    function accueil() {
      const deja = progression().positionnement;
      remplir(el, h('h1', {}, 'Tester mon niveau'),
        h('p', { class: 'chapeau discret' }, 'Pour qui a déjà pratiqué : inutile de refaire les leçons que vous maîtrisez.'),
        h('div', { class: 'carte' },
          h('ul', {},
            h('li', {}, `4 paliers de ${COLONNES_PALIER} colonnes, sur votre soroban : ${PALIERS_TEST.map((p) => p.titre.toLowerCase()).join(', ')}.`),
            h('li', {}, `${MIN_PALIER} justes sur ${COLONNES_PALIER} pour passer au palier suivant ; le test s'arrête au premier palier raté.`),
            h('li', {}, 'Chaque palier réussi valide ses leçons. Leur première révision, dans 3 jours, confirme la leçon ou la rouvre.'),
            h('li', {}, 'Seule la justesse compte ici : vos vitesses se mesureront ensuite, en pratiquant.'))),
        deja ? h('p', { class: 'discret' }, `Dernier test le ${new Date(`${deja.date}T12:00`).toLocaleDateString('fr-FR')} : ${deja.lecons} leçon${deja.lecons > 1 ? 's' : ''} validée${deja.lecons > 1 ? 's' : ''}.`) : null,
        h('div', { class: 'ligne' },
          h('button', { class: 'btn principal', onclick: () => palier(0) }, `Commencer : ${PALIERS_TEST[0].titre}`),
          h('button', { class: 'btn', onclick: () => app.aller('seance') }, 'Plus tard')));
    }

    function palier(k) {
      const p = PALIERS_TEST[k];
      remplir(el, h('h1', {}, `Palier ${k + 1} sur ${PALIERS_TEST.length} : ${p.titre}`),
        h('p', { class: 'discret' }, `${COLONNES_PALIER} colonnes. Prenez votre temps : seule la justesse compte.`));
      serie = creerSerie(el, {
        generer: () => colonneTest(p),
        nombre: COLONNES_PALIER,
        defi: true,
        surFin: async (b) => {
          serie.detruire();
          serie = null;
          const reussi = b.justes >= MIN_PALIER;
          await enregistrerSession({ module: 'positionnement', mode: p.id, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          // Les leçons du palier, pas encore validées, le sont « par le test ».
          const avant = p.lecons.filter((id) => progression().paliers[id]?.valide).length;
          if (reussi) {
            await validerParTest(p.lecons);
          }
          const suivant = PALIERS_TEST[k + 1];
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
            reussi
              ? h('p', { class: 'retour ok' }, `Palier réussi : les leçons « ${p.titre} » sont validées${p.lecons.length - avant ? ` (${p.lecons.length - avant} de plus)` : ''}. Première révision dans 3 jours.`)
              : h('p', {}, `Il en fallait ${MIN_PALIER}. Le test s'arrête ici, et c'est très bien : le parcours reprend exactement là où vous en êtes.`),
            h('div', { class: 'ligne' },
              reussi && suivant ? h('button', { class: 'btn principal', onclick: () => palier(k + 1) }, `Palier suivant : ${suivant.titre}`) : null,
              h('button', { class: reussi && suivant ? 'btn' : 'btn principal', onclick: () => app.aller('seance') }, reussi && suivant ? 'M\'arrêter là' : 'Aller à la séance du jour'),
              h('button', { class: 'btn', onclick: () => app.aller('lecons') }, 'Voir le parcours'))));
        },
      });
    }

    accueil();
    return () => serie?.detruire();
  },
};
