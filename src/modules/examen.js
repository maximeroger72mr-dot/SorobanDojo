/**
 * Passage de kyū (voir core/examen.js) : l'examen du niveau où l'on se trouve, accessible en
 * permanence. Chaque tentative compte : réussi (70 %), il donne le grade préparatoire ; raté, il
 * ne retire rien. Le ton est volontairement calme : un échec à un examen est normal.
 */

import { examenDeLaSemaine, sectionsExamen, minutesExamen, resultatSemaine, cleSemaine, PREKYU, prekyuAccessible, prekyuObtenu, COLONNES, SEUIL } from '../core/examen.js';
import { progression, aujourdhui, enregistrerSession, proposerMeilleurScore } from '../core/progression.js';
import { creerFeuille } from '../ui/feuille.js';
import { listeErreurs } from '../ui/serie.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

export default {
  id: 'examen',
  titre: 'Passage de kyū',
  parent: 'grades',
  monter(el, app, params = {}) {
    let feuille = null;

    function accueil() {
      feuille?.detruire();
      feuille = null;
      remplir(el);
      const d = progression();
      const g = examenDeLaSemaine(d);
      const r = resultatSemaine(d, aujourdhui());
      el.append(h('h1', {}, 'Passage de kyū'),
        h('p', { class: 'discret' }, `L'examen de votre niveau, sur tout ce que vous avez appris : ${COLONNES} colonnes, un temps fixe, ${Math.round(SEUIL * 100)} % de justes pour réussir. Il est ouvert en permanence : passez-le quand vous vous sentez prêt, autant de fois que vous voulez. La séance du jour vous le rappelle chaque semaine.`));
      if (!g) {
        el.append(h('div', { class: 'carte' }, h('p', {}, 'Le premier examen (20e kyū prép.) s\'ouvre dès que les leçons « Ajouter 1 à 4 », « Retirer 1 à 4 » et « Le 5 et la pincée » sont validées.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('lecons') }, 'Aller aux leçons')));
      } else {
        const min = minutesExamen(g);
        const obtenu = g.id !== 'hebdo' && prekyuObtenu(d, g);
        el.append(h('div', { class: 'carte' },
          h('h2', { style: 'margin-top:0' }, `${g.nom} · ${g.theme}`),
          h('p', {}, `${g.colonnes ?? COLONNES} colonnes de ${g.lignes} lignes à ${g.chiffres} chiffre${g.chiffres > 1 ? 's' : ''}${g.mul ? `, 5 multiplications (${g.mul.titre})` : ''}${g.div ? `, 5 divisions (${g.div.titre})` : ''}, en ${min} minutes. Il faut ${Math.ceil(COLONNES * SEUIL)} réponses justes.`),
          obtenu ? h('p', { class: 'retour ok' }, `Grade obtenu. Le suivant s'ouvrira avec les prochaines leçons ; en attendant, repassez celui-ci quand vous voulez pour garder le rythme d'examen.`)
            : r ? h('p', {}, `Meilleur passage cette semaine : ${r.points} / ${r.total}. Pas encore, et c'est normal : retentez quand vous voulez.`)
              : h('p', {}, 'Installez-vous au calme, soroban prêt, crayon en main. Réussi, il vous donne le grade ; raté, il ne vous retire rien.'),
          h('button', { class: 'btn principal', onclick: () => lancer(g) }, r || obtenu ? 'Passer l\'examen' : 'Commencer l\'examen')));
      }
      el.append(h('h2', {}, 'Les grades préparatoires'),
        h('p', { class: 'discret' }, 'Les « kyū prép. » (20e au 11e) sont propres à cette application : ils jalonnent le parcours avant le 10e kyū, mais n\'ont aucune valeur officielle. Les vrais kyū (10e au 1er), au format des examens japonais, se passent en « Épreuve officielle », depuis la page Grades.'),
        h('div', { class: 'liste-paliers' }, PREKYU.map((x) => {
          const obtenu = prekyuObtenu(d, x);
          const ouvert = prekyuAccessible(d, x);
          return h('div', { class: `ligne-palier${obtenu ? ' valide' : ''}` },
            h('span', { class: `icone etat-${obtenu ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, obtenu ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, `${x.nom} · ${x.theme}`),
            h('span', { class: 'statut' }, obtenu ? `obtenu le ${new Date(`${d.records[`prekyu-${x.id}`].date}T12:00`).toLocaleDateString('fr-FR')}` : ouvert ? 'accessible' : 'leçons à valider'));
        })));
    }

    function lancer(g) {
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Passage de kyū'));
      feuille = creerFeuille(el, {
        titre: `${g.nom} · ${COLONNES} problèmes · ${minutesExamen(g)} minutes`,
        sections: sectionsExamen(progression(), g),
        minutes: minutesExamen(g),
        surFin: (b) => {
          const reussi = b.justes >= Math.ceil(b.total * SEUIL);
          enregistrerSession({ module: 'examen', mode: 'kyu', reglages: { grade: g.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const info = h('p', {});
          proposerMeilleurScore(cleSemaine(aujourdhui()), b.justes, { total: b.total, grade: g.id, reussi, dureeMs: b.dureeMs }).then(async () => {
            // Réussir un grade accorde aussi les grades préparatoires d'avant.
            if (reussi && g.id !== 'hebdo') {
              for (const x of PREKYU.slice(0, PREKYU.indexOf(g) + 1)) if (!prekyuObtenu(progression(), x)) await proposerMeilleurScore(`prekyu-${x.id}`, b.justes, { reussi: true });
            }
            app.majBadges?.();
          });
          const manque = Math.ceil(b.total * SEUIL) - b.justes;
          info.textContent = reussi
            ? `${g.nom} réussi ! Bravo.`
            : `Pas encore${manque <= 3 ? ` : il manquait ${manque} réponse${manque > 1 ? 's' : ''} juste${manque > 1 ? 's' : ''}, c'est tout près` : ''}. C'est normal : un examen se réussit rarement du premier coup, et cet échec ne vous retire rien. Regardez vos erreurs ci-dessous, retravaillez-les tranquillement, et retentez quand vous voulez.`;
          // Colonnes répondues mais fausses (les cases vides : le temps a manqué).
          const erreurs = listeErreurs(b.resultats.filter((x) => x.reponse !== null));
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps : ${formaterDuree(b.dureeMs)} sur ${minutesExamen(g)} min`),
            info,
            erreurs ?? null,
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
