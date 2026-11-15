/**
 * Passage de kyū (voir core/examen.js) : l'examen du niveau où l'on se trouve, accessible en
 * permanence. Chaque tentative compte : réussi (70 %), il donne le grade préparatoire ; raté, il
 * ne retire rien. Le ton est volontairement calme : un échec à un examen est normal.
 */

import { examenDeLaSemaine, resultatSemaine, cleSemaine, PREKYU, prekyuAccessible, prekyuObtenu, cleBlanc, SEUIL, formatBlanc, minutesBlanc, sectionsBlanc, MINUTES_BLANC_SPRINT } from '../core/examen.js';
import { progression, aujourdhui, enregistrerSession, proposerMeilleurScore } from '../core/progression.js';
import { SYSTEMES } from '../core/epreuves.js';
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
        h('p', { class: 'discret' }, `L'examen de votre niveau, sur tout ce que vous avez appris, ${Math.round(SEUIL * 100)} % de justes pour réussir. Deux formats, en alternance d'une semaine à l'autre : un sujet de 20 minutes (tenir la concentration longtemps), puis deux sprints de ${MINUTES_BLANC_SPRINT} minutes, chacun avec son chrono et son verdict (aller vite, sans compensation). Ouvert en permanence ; la séance du jour le propose du vendredi au dimanche.`));
      if (!g) {
        el.append(h('div', { class: 'carte' }, h('p', {}, 'Le premier examen (20e kyū prép.) s\'ouvre dès que les leçons « Ajouter 1 à 4 », « Retirer 1 à 4 » et « Le 5 et la pincée » sont validées.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('lecons') }, 'Aller aux leçons')));
      } else {
        const format = formatBlanc(aujourdhui());
        const autre = format === 'long' ? 'sprints' : 'long';
        const decrire = (f) => (f === 'long' ? 'un sujet de 20 minutes' : `deux sprints de ${MINUTES_BLANC_SPRINT} minutes`);
        const obtenu = g.id !== 'hebdo' && !g.officiel && prekyuObtenu(d, g);
        el.append(h('div', { class: 'carte' },
          h('h2', { style: 'margin-top:0' }, `${g.nom} · ${g.theme}`),
          h('p', {}, `Cette semaine : ${decrire(format)}. Colonnes de ${g.lignes} lignes à ${g.chiffres} chiffre${g.chiffres > 1 ? 's' : ''}${g.mul ? `, multiplications (${g.mul.titre})` : ''}${g.div ? `, divisions (${g.div.titre})` : ''}. Il faut ${Math.round(SEUIL * 100)} % de réponses justes${format === 'sprints' ? ' dans CHAQUE sprint' : ''}.`),
          obtenu ? h('p', { class: 'retour ok' }, `Grade obtenu. Le suivant s'ouvrira avec les prochaines leçons ; en attendant, repassez celui-ci quand vous voulez pour garder le rythme d'examen.`)
            : r ? h('p', {}, `Meilleur passage cette semaine : ${r.points} / ${r.total}. Pas encore, et c'est normal : retentez quand vous voulez.`)
              : h('p', {}, g.officiel ? 'Installez-vous au calme, soroban prêt, crayon en main. Réussi, il valide ce niveau et tous les grades d\'en dessous, par équivalence (le kyū officiel se passe ensuite en « Épreuve officielle ») ; raté, il ne vous retire rien.' : 'Installez-vous au calme, soroban prêt, crayon en main. Réussi, il vous donne le grade ; raté, il ne vous retire rien.'),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => lancer(g, format) }, `${r || obtenu ? 'Passer l\'examen' : 'Commencer l\'examen'} · ${decrire(format)}`),
            h('button', { class: 'btn', onclick: () => lancer(g, autre) }, `L'autre format : ${decrire(autre)}`))));
      }
      el.append(h('h2', {}, 'Les grades préparatoires'),
        h('p', { class: 'discret' }, 'Les « kyū prép. » (20e au 11e) sont propres à cette application : ils jalonnent le parcours avant le 10e kyū, mais n\'ont aucune valeur officielle. Les vrais kyū (10e au 1er), au format des examens japonais, se passent en « Épreuve officielle », depuis la page Grades.'),
        h('div', { class: 'liste-paliers' }, PREKYU.map((x) => {
          const obtenu = prekyuObtenu(d, x);
          const ouvert = prekyuAccessible(d, x);
          return h('div', { class: `ligne-palier${obtenu ? ' valide' : ''}` },
            h('span', { class: `icone etat-${obtenu ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, obtenu ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, `${x.nom} · ${x.theme}`),
            h('span', { class: 'statut' }, obtenu ? (d.records[`prekyu-${x.id}`]?.date ? `obtenu le ${new Date(`${d.records[`prekyu-${x.id}`].date}T12:00`).toLocaleDateString('fr-FR')}` : 'obtenu par équivalence') : ouvert ? 'accessible' : 'leçons à valider'));
        })));
    }

    function lancer(g, format = formatBlanc(aujourdhui())) {
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Passage de kyū'));
      const sections = sectionsBlanc(progression(), g, format);
      const sprints = format === 'sprints';
      if (sprints) el.append(h('p', { class: 'consigne' }, `Deux sprints de ${MINUTES_BLANC_SPRINT} minutes, l'un après l'autre : à la fin du temps, on passe au suivant. ${Math.round(SEUIL * 100)} % de justes dans chacun.`));
      feuille = creerFeuille(el, {
        titre: `${g.nom} · ${sprints ? `2 sprints de ${MINUTES_BLANC_SPRINT} minutes` : `${sections.reduce((t, x) => t + x.problemes.length, 0)} problèmes · ${minutesBlanc(format)} minutes`}`,
        sections,
        minutes: minutesBlanc(format),
        parEpreuve: sprints,
        surFin: (b) => {
          const okSprint = (x) => x.justes >= Math.ceil(x.total * SEUIL);
          const reussi = sprints ? b.parSection.every(okSprint) : b.justes >= Math.ceil(b.total * SEUIL);
          enregistrerSession({ module: 'examen', mode: 'kyu', reglages: { grade: g.id, format }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const info = h('p', {});
          proposerMeilleurScore(cleSemaine(aujourdhui()), b.justes, { total: b.total, grade: g.id, reussi, dureeMs: b.dureeMs }).then(async () => {
            // Réussir un grade accorde aussi les grades préparatoires d'avant.
            // Un kyū officiel réussi en examen blanc : les grades d'en dessous suivent par équivalence.
            if (reussi && g.officiel) await proposerMeilleurScore(cleBlanc(SYSTEMES[g.systeme], g.officiel), b.justes, { reussi: true, total: b.total });
            else if (reussi && g.id !== 'hebdo') {
              for (const x of PREKYU.slice(0, PREKYU.indexOf(g) + 1)) if (!prekyuObtenu(progression(), x)) await proposerMeilleurScore(`prekyu-${x.id}`, b.justes, { reussi: true });
            }
            app.majBadges?.();
          });
          const manque = sprints ? Math.max(...b.parSection.map((x) => Math.ceil(x.total * SEUIL) - x.justes)) : Math.ceil(b.total * SEUIL) - b.justes;
          const parSprint = sprints ? ` ${b.parSection.map((x, i) => `Sprint ${i + 1} : ${x.justes} / ${x.total}${okSprint(x) ? ' ✓' : ''}`).join(' · ')}.` : '';
          info.textContent = (reussi
            ? `${g.nom} réussi ! Bravo.${g.officiel ? ' Les grades d\'en dessous sont acquis par équivalence. Le kyū officiel, lui, se passe en « Épreuve officielle » (page Grades), au format japonais.' : ''}`
            : `Pas encore${manque <= 3 ? ` : il manquait ${manque} réponse${manque > 1 ? 's' : ''} juste${manque > 1 ? 's' : ''}, c'est tout près` : ''}. C'est normal : un examen se réussit rarement du premier coup, et cet échec ne vous retire rien. Regardez vos erreurs ci-dessous, retravaillez-les tranquillement, et retentez quand vous voulez.`) + parSprint;
          // Colonnes répondues mais fausses (les cases vides : le temps a manqué).
          const erreurs = listeErreurs(b.resultats.filter((x) => x.reponse !== null));
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps : ${formaterDuree(b.dureeMs)} sur ${minutesBlanc(format)} min`),
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
