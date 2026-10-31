/**
 * Leçons guidées.
 *
 * Carte du parcours (paliers > sous-paliers), puis pour chaque sous-palier trois onglets :
 *  1. Comprendre   : le pourquoi du geste et des démonstrations animées pas à pas ;
 *  2. S'entraîner  : exercices générés à l'infini, À FAIRE SUR SON SOROBAN ; l'élève tape le
 *                    résultat. Une par une (correction immédiate) ou en feuille (imprimable).
 *                    Compteur d'ancrage avant le mini-test ;
 *  3. Mini-test    : 10 exercices, 9 réussites exigées pour valider.
 * Un sous-palier validé entre dans les révisions espacées (voir revisions.js).
 */

import { PALIERS, SOUS_PALIERS, sousPalier, TEST, genererExercice } from '../core/curriculum.js';
import { nomMotif } from '../core/motifs.js';
import {
  etatPalier, compterRepetition, validerPalier, poidsAdaptatifs, enregistrerSession,
  reglagesUtilisateur, modifierReglages, evaluerPalier, noterGestes,
} from '../core/progression.js';
import { tempsParUnite, SURCOUT_FEUILLE_S } from '../core/maitrise.js';
import { localiserErreur } from '../core/diagnostic.js';
import { badgeNiveau, texteEvaluation } from '../ui/niveau.js';
import { PanneauDemo } from '../ui/panneauDemo.js';
import { demoMultiplication, demoDivision } from '../ui/explication.js';
import { creerSerie, encadreDiagnostic, listeErreurs } from '../ui/serie.js';
import { creerFeuille } from '../ui/feuille.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

/** Un sous-palier est accessible si le précédent est validé (ou en mode découverte). */
export function estDebloque(sp) {
  if (sp.ordre === 0 || reglagesUtilisateur().decouverte) return true;
  return !!etatPalier(SOUS_PALIERS[sp.ordre - 1].id).valide;
}

/** Premier sous-palier non validé et accessible (pour les suggestions). */
export function prochainSousPalier() {
  return SOUS_PALIERS.find((sp) => !etatPalier(sp.id).valide && estDebloque(sp)) ?? null;
}

const dateFr = (d) => new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Démonstration d'un exemple de sous-palier, quel que soit son type. */
function demoDe(sp, d) {
  if (sp.type === 'mul') return demoMultiplication(d.a, d.b);
  if (sp.type === 'div') return demoDivision(d.a, d.b);
  return d;
}
const famille = (sp) => (sp.type === 'addsub' || sp.type === 'anzan' ? 'addsub' : 'muldiv');
const poidsDe = (sp) => poidsAdaptatifs(sp.type === 'addsub' || sp.type === 'anzan' ? sp.cibles : []);
const testMin = (sp) => sp.testMin ?? TEST.reussitesMin;

const libelleDemo = (sp, d) => (sp.type === 'mul' ? `${d.a} × ${d.b}` : sp.type === 'div' ? `${d.a} ÷ ${d.b}` : `${d.depart} ${d.op === '+' ? '+' : '−'} ${d.n}`);

export default {
  id: 'lecons',
  titre: 'Leçons guidées',
  monter(el, app, params = {}) {
    let nettoyerVue = null;
    const changer = (f) => { nettoyerVue?.(); remplir(el); el.scrollTop = 0; nettoyerVue = f() ?? null; };

    // ---------------------------------------------------------------- carte du parcours
    function carte() {
      el.append(
        h('h1', {}, 'Leçons guidées'),
        h('p', { class: 'discret' }, `Les calculs se font sur votre soroban ; l'application corrige et explique. Chaque étape : comprendre, s'entraîner (le compteur indique le volume d'ancrage), puis un mini-test de ${TEST.exercices} calculs (${TEST.reussitesMin} réussites exigées).`),
        h('p', { class: 'discret' }, 'Niveaux : En progrès → Acquis débutant → Acquis confirmé → Acquis expert. Un geste est acquis quand il est juste ET rapide ; le niveau se calcule sur vos 30 derniers exercices.'),
      );
      const diag = encadreDiagnostic(null, 3);
      if (diag) el.append(diag);
      for (const palier of PALIERS) {
        el.append(h('h2', {}, palier.titre));
        el.append(h('div', { class: 'liste-paliers' }, palier.sousPaliers.map((brut) => {
          const sp = sousPalier(brut.id);
          const e = etatPalier(sp.id);
          const ouvert = estDebloque(sp);
          let statut;
          let icone;
          if (e.valide) { icone = '✓'; statut = `Validé · révision le ${dateFr(e.carte.echeance)} (boîte ${e.carte.boite})`; }
          else if (!ouvert) { icone = '·'; statut = 'Verrouillé'; }
          else if (e.reps >= sp.repetitions) { icone = '●'; statut = 'Mini-test disponible'; }
          else { icone = '○'; statut = `${e.reps} / ${sp.repetitions}`; }
          return h('button', {
            class: `ligne-palier${e.valide ? ' valide' : ''}`, disabled: !ouvert,
            onclick: () => changer(() => vueSousPalier(sp)),
          }, h('span', { class: 'icone' }, icone), h('span', { class: 'titre' }, sp.titre),
          e.reps ? badgeNiveau(evaluerPalier(sp.id, famille(sp))) : null,
          h('span', { class: 'statut' }, statut));
        })));
      }
      el.append(h('label', { class: 'discret', style: 'display:block;margin-top:24px' },
        h('input', {
          type: 'checkbox', checked: reglagesUtilisateur().decouverte,
          onchange: async (ev) => { await modifierReglages({ decouverte: ev.target.checked }); changer(carte); },
        }),
        ' Mode découverte : ouvrir toutes les leçons sans attendre la validation (l\'entraînement et le mini-test restent nécessaires pour valider).'));
    }

    // ---------------------------------------------------------------- sous-palier
    function vueSousPalier(sp, ongletInitial) {
      const e = etatPalier(sp.id);
      let nettoyerOnglet = null;
      const zone = h('div', {});
      const ongletsDef = [['comprendre', '1. Comprendre'], ['entrainement', '2. S\'entraîner'], ['test', '3. Mini-test']];
      const boutons = ongletsDef.map(([id, texte]) => h('button', { onclick: () => afficher(id) }, texte));
      const suivant = SOUS_PALIERS[sp.ordre + 1];

      el.append(
        h('button', { class: 'lien', onclick: () => changer(carte) }, '← Toutes les leçons'),
        h('div', { class: 'discret' }, sp.palier.titre),
        h('h1', {}, sp.titre),
        h('div', { class: 'segments', style: 'margin:8px 0 16px' }, boutons),
        zone);

      function afficher(id) {
        nettoyerOnglet?.();
        nettoyerOnglet = null;
        remplir(zone);
        boutons.forEach((b, i) => b.classList.toggle('actif', ongletsDef[i][0] === id));
        nettoyerOnglet = { comprendre, entrainement, test: miniTest }[id]();
      }

      // 1. Comprendre ------------------------------------------------
      function comprendre() {
        zone.append(h('div', { class: 'carte pourquoi' }, h('strong', {}, 'Pourquoi ce geste ? '), sp.pourquoi));
        if (sp.type === 'addsub') {
          zone.append(h('p', { class: 'discret' }, sp.cumul && sp.cibles.length > 12 ? 'Tous les gestes vus jusqu\'ici.' : `Gestes travaillés : ${sp.cibles.map(nomMotif).join(' · ')}. ${sp.cumul ? '' : 'Les exercices ne contiennent que ces gestes et des gestes directs.'}`));
        }
        if (sp.type === 'anzan') {
          zone.append(h('div', { class: 'carte' }, h('strong', {}, 'Comment faire : '),
            h('ul', {},
              h('li', {}, `Les nombres s'affichent un par un (${sp.duree.toLocaleString('fr-FR')} s chacun), ${sp.lignes} nombres à ${sp.chiffres} chiffre${sp.chiffres > 1 ? 's' : ''}. Le signe − annonce une soustraction.`),
              h('li', {}, 'Posez la main comme sur le soroban et faites les gestes dans l\'air : le pouce monte, l\'index descend.'),
              h('li', {}, 'Gardez l\'image du soroban : on « voit » le résultat plutôt que de le calculer avec des mots.'),
              h('li', {}, 'Ensuite, entraînez-vous dans « Flash anzan » en réduisant le temps d\'affichage.'))),
          h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Passer à l\'entraînement →'));
          return null;
        }
        zone.append(h('h2', {}, 'Démonstrations'),
          h('p', { class: 'discret' }, 'Regardez le geste, puis refaites-le sur votre soroban avant de passer à la suite.'));
        const choix = h('div', { class: 'ligne' });
        zone.append(choix);
        const panneau = new PanneauDemo(zone);
        sp.demos.forEach((d, i) => choix.append(h('button', { class: 'btn', onclick: () => panneau.jouer(demoDe(sp, d), 'manuel') }, `Exemple ${i + 1} : ${libelleDemo(sp, d)}`)));
        choix.append(h('span', { style: 'flex:1' }), h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Passer à l\'entraînement →'));
        panneau.jouer(demoDe(sp, sp.demos[0]), 'manuel');
        return () => panneau.detruire();
      }

      // 2. Entraînement ----------------------------------------------
      function entrainement() {
        const bandeau = h('div', { class: 'bandeau' });
        let mode = 'une';
        let courant = null;
        const zoneTravail = h('div', {});
        const choixMode = h('div', { class: 'segments' },
          [['une', 'Une par une'], ['feuille', 'Feuille de 10 (imprimable)']].map(([v, t]) => h('button', {
            class: v === mode ? 'actif' : '',
            onclick: (ev) => { mode = v; [...choixMode.children].forEach((b) => b.classList.toggle('actif', b === ev.currentTarget)); lancer(); },
          }, t)));
        zone.append(bandeau, sp.type === 'anzan' ? '' : h('div', { class: 'ligne', style: 'margin-bottom:12px' }, choixMode), zoneTravail);

        const majBandeau = () => {
          const et = etatPalier(sp.id);
          remplir(bandeau, ...[
            h('div', { class: 'jauge' }, h('div', { style: `width:${Math.min(100, (100 * et.reps) / sp.repetitions)}%` })),
            h('span', {}, `Entraînement : ${Math.min(et.reps, sp.repetitions)} / ${sp.repetitions}`),
            badgeNiveau(evaluerPalier(sp.id, famille(sp))),
            h('span', { class: 'discret' }, texteEvaluation(evaluerPalier(sp.id, famille(sp)), famille(sp))),
            et.reps >= sp.repetitions && !et.valide ? h('button', { class: 'btn principal', onclick: () => afficher('test') }, 'Passer le mini-test →') : null,
          ].filter(Boolean));
        };
        majBandeau();
        let lot = { total: 0, justes: 0, dureeMs: 0 };
        const enregistrerLot = () => {
          if (!lot.total) return;
          enregistrerSession({ module: 'lecons', mode: 'entrainement', reglages: { sousPalier: sp.id }, ...lot });
          lot = { total: 0, justes: 0, dureeMs: 0 };
        };
        const compter = async (juste, dureeMs, t) => {
          await compterRepetition(sp.id, juste, t);
          lot.total += 1;
          if (juste) lot.justes += 1;
          lot.dureeMs += dureeMs;
          if (lot.total >= 10) enregistrerLot();
          majBandeau();
        };

        function lancer() {
          courant?.detruire();
          remplir(zoneTravail);
          if (mode === 'une') {
            courant = creerSerie(zoneTravail, {
              generer: () => genererExercice(sp, poidsDe(sp)),
              filtreDiagnostic: sp.autorises,
              evaluation: () => evaluerPalier(sp.id, famille(sp)),
              // Un exercice résolu avec « Je suis bloqué » compte comme répétition, pas pour le niveau.
              surExercice: (res) => compter(res.juste && !res.aide, res.dureeMs, res.t),
            });
          } else {
            const problemes = Array.from({ length: 10 }, () => genererExercice(sp, poidsDe(sp)));
            courant = creerFeuille(zoneTravail, {
              titre: `${sp.titre} · feuille d'entraînement`,
              sections: [{ problemes }],
              surFin: (b) => {
                (async () => {
                  // Sur une feuille, le temps se répartit entre les problèmes.
                  const dureeMoyenne = b.dureeMs / b.total;
                  for (const r of b.resultats) {
                    const t = tempsParUnite(r.ex, dureeMoyenne, SURCOUT_FEUILLE_S);
                    await compter(r.juste, dureeMoyenne, t);
                    const loc = r.juste || r.reponse === null ? null : localiserErreur(r.ex, r.reponse);
                    if (r.ex.motifs) await noterGestes(r.juste ? r.ex.motifs : [], loc?.motifs ?? [], t);
                  }
                  majBandeau();
                })();
                return h('div', { class: 'carte bilan' },
                  h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
                  h('p', {}, `Temps : ${formaterDuree(b.dureeMs)}`),
                  h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle feuille'));
              },
            });
          }
        }
        lancer();
        return () => { courant?.detruire(); enregistrerLot(); };
      }

      // 3. Mini-test --------------------------------------------------
      function miniTest() {
        const et = etatPalier(sp.id);
        if (et.reps < sp.repetitions) {
          zone.append(h('div', { class: 'carte' },
            h('p', {}, `Le mini-test s'ouvre après ${sp.repetitions} exercices d'entraînement. Il en reste ${sp.repetitions - et.reps}.`),
            h('p', { class: 'discret' }, 'C\'est la répétition du geste sur le soroban qui le rend automatique, pas la compréhension seule.'),
            h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Continuer l\'entraînement')));
          return null;
        }
        let serie = null;
        const intro = h('div', { class: 'carte' },
          h('p', {}, `${TEST.exercices} calculs à la suite. Il en faut ${testMin(sp)} justes. Les erreurs sont revues à la fin.`),
          et.valide ? h('p', { class: 'discret' }, `Déjà validé le ${dateFr(et.valide)}. Vous pouvez le repasser pour vous entraîner.`) : null,
          h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer le mini-test'));
        zone.append(intro);

        function lancer() {
          intro.remove();
          serie = creerSerie(zone, {
            generer: () => genererExercice(sp, poidsDe(sp)),
            nombre: TEST.exercices,
            chrono: true,
            defi: true,
            filtreDiagnostic: sp.autorises,
            evaluation: () => evaluerPalier(sp.id, famille(sp)),
            surFin: async (bilan) => {
              serie.detruire();
              serie = null;
              const reussi = bilan.justes >= testMin(sp);
              await enregistrerSession({ module: 'lecons', mode: 'test', reglages: { sousPalier: sp.id }, total: bilan.total, justes: bilan.justes, dureeMs: bilan.dureeMs });
              if (reussi) await validerPalier(sp.id);
              const c = etatPalier(sp.id).carte;
              zone.append(h('div', { class: 'carte bilan' },
                h('div', { class: 'grand' }, `${bilan.justes} / ${bilan.total}`),
                h('p', {}, `Temps : ${formaterDuree(bilan.dureeMs)}`),
                reussi
                  ? h('p', { class: 'retour ok' }, `Leçon validée. Première révision le ${dateFr(c.echeance)}.`)
                  : h('p', {}, `Il faut ${testMin(sp)} réussites. Reprenez un peu d'entraînement, puis retentez.`),
                h('div', { class: 'ligne' },
                  reussi && suivant ? h('button', { class: 'btn principal', onclick: () => changer(() => vueSousPalier(suivant)) }, `Leçon suivante : ${suivant.titre} →`) : null,
                  h('button', { class: 'btn', onclick: () => afficher(reussi ? 'test' : 'entrainement') }, reussi ? 'Repasser le test' : 'Retour à l\'entraînement'),
                  h('button', { class: 'btn', onclick: () => changer(carte) }, 'Toutes les leçons'))),
              listeErreurs(bilan.resultats) ?? '');
              app.majBadges();
            },
          });
        }
        return () => serie?.detruire();
      }

      afficher(ongletInitial ?? (e.reps === 0 ? 'comprendre' : 'entrainement'));
      return () => nettoyerOnglet?.();
    }

    const depart = params.sousPalier ? sousPalier(params.sousPalier) : null;
    changer(() => (depart && estDebloque(depart) ? vueSousPalier(depart) : carte()));
    return () => nettoyerVue?.();
  },
};
