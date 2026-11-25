/**
 * Passage de kyū (voir core/examen.js) : l'examen du niveau où l'on se trouve, accessible en
 * permanence. Chaque tentative compte : réussi (70 %), il donne le grade préparatoire ; raté, il
 * ne retire rien. Le ton est volontairement calme : un échec à un examen est normal.
 */

import { examenDeLaSemaine, resultatSemaine, cleSemaine, PREKYU, prekyuAccessible, prekyuObtenu, cleBlanc, SOCLE, aSocle, completObtenu, sujetExamen, SEUIL, formatBlanc, minutesBlanc, sectionsBlanc, MINUTES_BLANC_SPRINT } from '../core/examen.js';
import { progression, aujourdhui, enregistrerSession, proposerMeilleurScore } from '../core/progression.js';
import { SYSTEMES } from '../core/epreuves.js';
import { creerFeuille } from '../ui/feuille.js';
import { boutonNaoshi } from '../ui/naoshi.js';
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
        el.append(h('div', { class: 'carte' }, h('p', {}, 'Le premier examen (20e kyū) s\'ouvre dès que les leçons « Ajouter 1 à 4 », « Retirer 1 à 4 » et « Le 5 et la pincée » sont validées.'),
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
          // Trois premiers grades : le socle (sans chrono) donne le grade ; le format complet est facultatif.
          aSocle(g) ? h('div', { class: 'carte avis' },
            h('p', { style: 'margin-top:0' }, h('strong', {}, 'Ce grade se passe en deux temps. '), `Phase 1, le socle : ${SOCLE.colonnes} colonnes, SANS chrono, ${Math.ceil(SOCLE.colonnes * SOCLE.seuil)} justes : elle donne le grade${obtenu ? ' (réussie ✓)' : ''}. Phase 2, facultative : le format complet, chronométré${completObtenu(d, g) ? ' (réussie ✓)' : ''}.`),
            h('button', { class: `btn${obtenu ? '' : ' principal'}`, onclick: () => lancerSocle(g) }, `Phase 1 : le socle, sans chrono${obtenu ? ' (refaire)' : ''}`)) : null,
          h('div', { class: 'ligne' },
            h('button', { class: `btn${aSocle(g) && !obtenu ? '' : ' principal'}`, onclick: () => lancer(g, format) }, `${aSocle(g) ? 'Phase 2 (facultative) : format complet' : r || obtenu ? 'Passer l\'examen' : 'Commencer l\'examen'} · ${decrire(format)}`),
            h('button', { class: 'btn', onclick: () => lancer(g, autre) }, `L'autre format : ${decrire(autre)}`))));
      }
      el.append(h('h2', {}, 'Les grades préparatoires'),
        h('p', { class: 'discret' }, 'Les 20e au 11e kyū sont propres à cette application : ils jalonnent le parcours avant le 10e kyū, mais n\'ont aucune valeur officielle (Zenkoren a bien des 15e à 11e kyū, mais avec ses propres sujets, non publiés). Ils ne dépassent jamais le format du 10e kyū : 5 lignes de 2 chiffres. Les vrais kyū (10e au 1er), au format des examens japonais, se passent en « Épreuve officielle », depuis la page Grades.'),
        h('div', { class: 'liste-paliers' }, PREKYU.map((x) => {
          const obtenu = prekyuObtenu(d, x);
          const ouvert = prekyuAccessible(d, x);
          return h('div', { class: `ligne-palier${obtenu ? ' valide' : ''}` },
            h('span', { class: `icone etat-${obtenu ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, obtenu ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, `${x.nom} · ${x.theme}`),
            h('span', { class: 'statut' }, obtenu ? (d.records[`prekyu-${x.id}`]?.date ? `obtenu le ${new Date(`${d.records[`prekyu-${x.id}`].date}T12:00`).toLocaleDateString('fr-FR')}` : 'obtenu par équivalence') : ouvert ? 'accessible' : 'leçons à valider'));
        })));
    }

    /** Phase 1 des premiers grades : le socle, 10 colonnes sans chrono, 80 % : il donne le grade. */
    function lancerSocle(g) {
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Passage de kyū'),
        h('p', { class: 'consigne' }, `Le socle du ${g.nom} : ${SOCLE.colonnes} colonnes, sans chrono. Prenez le temps qu'il faut : seule la justesse compte (${Math.ceil(SOCLE.colonnes * SOCLE.seuil)} justes sur ${SOCLE.colonnes}).`));
      feuille = creerFeuille(el, {
        titre: `${g.nom} · le socle · ${SOCLE.colonnes} colonnes, sans chrono`,
        sections: [{ problemes: sujetExamen(progression(), { ...g, colonnes: SOCLE.colonnes }) }],
        surFin: (b) => {
          const reussi = b.justes >= Math.ceil(b.total * SOCLE.seuil);
          enregistrerSession({ module: 'examen', mode: 'socle', reglages: { grade: g.id, format: 'socle' }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          proposerMeilleurScore(cleSemaine(aujourdhui()), b.justes, { total: b.total, grade: g.id, reussi, dureeMs: b.dureeMs, socle: true }).then(async () => {
            if (reussi) for (const x of PREKYU.slice(0, PREKYU.indexOf(g) + 1)) if (!prekyuObtenu(progression(), x)) await proposerMeilleurScore(`prekyu-${x.id}`, b.justes, { reussi: true, socle: true });
            app.majBadges?.();
          });
          const erreurs = listeErreurs(b.resultats.filter((x) => x.reponse !== null));
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, reussi ? `${g.nom} obtenu : le socle est là. Quand vous voudrez, tentez la phase 2 : le même contenu, en format complet et chronométré. Elle est facultative.`
              : `Pas encore : il faut ${Math.ceil(b.total * SOCLE.seuil)} justes. Rien de grave, et rien de perdu : regardez vos erreurs ci-dessous, puis retentez quand vous voulez.`),
            erreurs ?? null,
            h('div', { class: 'ligne' },
              reussi ? h('button', { class: 'btn', onclick: () => lancer(g) }, 'Phase 2 : format complet, chronométré') : h('button', { class: 'btn principal', onclick: () => lancerSocle(g) }, 'Retenter le socle'),
              h('button', { class: 'btn', onclick: () => accueil() }, 'Retour')));
        },
      });
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
        mesure: { source: 'examen', grade: g.officiel ? SYSTEMES[g.systeme]?.grades.find((x) => x.id === g.officiel) ?? null : null },
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
              if (aSocle(g)) await proposerMeilleurScore(`prekyu-${g.id}-complet`, b.justes, { reussi: true });
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
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'examen', retour: () => accueil() }), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour')));
        },
      });
    }

    if (params.auto) {
      const g = examenDeLaSemaine(progression());
      if (g && aSocle(g) && !prekyuObtenu(progression(), g)) lancerSocle(g); else if (g) lancer(g); else accueil();
    } else accueil();
    return () => feuille?.detruire();
  },
};
