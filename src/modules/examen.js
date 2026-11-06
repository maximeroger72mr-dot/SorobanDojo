/**
 * Kyū de la semaine (voir core/examen.js) : un examen chronométré, une fois par semaine, sur
 * tout ce qui a été appris. La 1re tentative de la semaine compte ; les suivantes sont de
 * l'entraînement. Réussi (70 %), il donne le grade préparatoire correspondant.
 */

import { examenDeLaSemaine, sujetExamen, minutesExamen, resultatSemaine, cleSemaine, joursRestants, PREKYU, prekyuAccessible, prekyuObtenu, COLONNES, SEUIL } from '../core/examen.js';
import { progression, aujourdhui, enregistrerSession, proposerMeilleurScore } from '../core/progression.js';
import { creerFeuille } from '../ui/feuille.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

export default {
  id: 'examen',
  titre: 'Kyū de la semaine',
  monter(el, app, params = {}) {
    let feuille = null;

    function accueil() {
      feuille?.detruire();
      feuille = null;
      remplir(el);
      const d = progression();
      const g = examenDeLaSemaine(d);
      const r = resultatSemaine(d, aujourdhui());
      el.append(h('h1', {}, 'Kyū de la semaine'),
        h('p', { class: 'discret' }, `Chaque semaine, un examen sous pression sur tout ce que vous avez appris : ${COLONNES} colonnes, un temps fixe, ${Math.round(SEUIL * 100)} % de justes pour réussir. Seule la première tentative de la semaine compte.`));
      if (!g) {
        el.append(h('div', { class: 'carte' }, h('p', {}, 'Le premier examen (20e kyū) s\'ouvre dès que les leçons « Ajouter 1 à 4 », « Retirer 1 à 4 » et « Le 5 et la pincée » sont validées.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('lecons') }, 'Aller aux leçons')));
      } else {
        const min = minutesExamen(g);
        el.append(h('div', { class: 'carte' },
          h('h2', { style: 'margin-top:0' }, `${g.nom} · ${g.theme}`),
          h('p', {}, `${COLONNES} colonnes de ${g.lignes} lignes à ${g.chiffres} chiffre${g.chiffres > 1 ? 's' : ''}, en ${min} minutes. Il faut ${Math.ceil(COLONNES * SEUIL)} réponses justes.`),
          r ? h('p', { class: r.reussi ? 'retour ok' : '' }, `Cette semaine : ${r.points} / ${r.total}${r.reussi ? ' : réussi !' : ' : pas encore.'} Prochain examen la semaine prochaine ; vous pouvez le refaire pour vous entraîner (cela ne compte pas).`)
            : h('p', {}, h('strong', {}, `À passer cette semaine (encore ${joursRestants(aujourdhui())} jour${joursRestants(aujourdhui()) > 1 ? 's' : ''}).`), ' Installez-vous au calme, soroban prêt, crayon en main.'),
          h('button', { class: 'btn principal', onclick: () => lancer(g) }, r ? 'S\'entraîner sur le même format' : 'Commencer l\'examen')));
      }
      el.append(h('h2', {}, 'Les grades préparatoires'),
        h('p', { class: 'discret' }, 'Avant le 10e kyū officiel, un grade par étape du parcours. Ensuite, les vrais kyū se passent dans « Épreuves officielles ».'),
        h('div', { class: 'liste-paliers' }, PREKYU.map((x) => {
          const obtenu = prekyuObtenu(d, x);
          const ouvert = prekyuAccessible(d, x);
          return h('div', { class: `ligne-palier${obtenu ? ' valide' : ''}` },
            h('span', { class: `icone etat-${obtenu ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, obtenu ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, `${x.nom} · ${x.theme}`),
            h('span', { class: 'statut' }, obtenu ? `obtenu le ${new Date(`${d.records[`prekyu-${x.id}`].date}T12:00`).toLocaleDateString('fr-FR')}` : ouvert ? 'accessible' : 'leçons à valider'));
        })));
    }

    function lancer(g) {
      const d = progression();
      const compte = !resultatSemaine(d, aujourdhui());
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Kyū de la semaine'));
      feuille = creerFeuille(el, {
        titre: `${g.nom} · ${COLONNES} colonnes · ${minutesExamen(g)} minutes${compte ? '' : ' (entraînement)'}`,
        sections: [{ problemes: sujetExamen(d, g) }],
        minutes: minutesExamen(g),
        surFin: (b) => {
          const reussi = b.justes >= Math.ceil(b.total * SEUIL);
          enregistrerSession({ module: 'examen', mode: compte ? 'semaine' : 'entrainement', reglages: { grade: g.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const info = h('p', {});
          if (compte) {
            proposerMeilleurScore(cleSemaine(aujourdhui()), b.justes, { total: b.total, grade: g.id, reussi, dureeMs: b.dureeMs }).then(async () => {
              // Réussir un grade accorde aussi les grades préparatoires d'avant.
              if (reussi && g.id !== 'hebdo') {
                for (const x of PREKYU.slice(0, PREKYU.indexOf(g) + 1)) if (!prekyuObtenu(progression(), x)) await proposerMeilleurScore(`prekyu-${x.id}`, b.justes, { reussi: true });
              }
              info.textContent = reussi ? `${g.nom} réussi ! Bravo.` : `Pas cette fois : il fallait ${Math.ceil(b.total * SEUIL)} justes. Retravaillez vos erreurs, le prochain examen est la semaine prochaine.`;
              app.majBadges?.();
            });
          } else {
            info.textContent = 'Entraînement : ce passage ne compte pas pour le grade.';
          }
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps : ${formaterDuree(b.dureeMs)} sur ${minutesExamen(g)} min`),
            info,
            h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'));
        },
      });
    }

    if (params.auto) {
      const g = examenDeLaSemaine(progression());
      if (g) lancer(g); else accueil();
    } else accueil();
    return () => feuille?.detruire();
  },
};
