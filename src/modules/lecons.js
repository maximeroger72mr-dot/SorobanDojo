/**
 * Leçons guidées.
 *
 * Carte du parcours (paliers > sous-paliers), puis pour chaque sous-palier trois onglets :
 *  1. Comprendre   : le pourquoi du geste et des démonstrations animées pas à pas ;
 *  2. S'entraîner  : exercices générés à l'infini, gestes vérifiés, compteur d'ancrage (50) ;
 *  3. Mini-test    : 10 exercices sans indice, 9 réussites exigées pour valider.
 * Un sous-palier validé entre dans les révisions espacées (voir revisions.js).
 */

import { PALIERS, SOUS_PALIERS, sousPalier, REPETITIONS_REQUISES, TEST } from '../core/curriculum.js';
import { genererExercice, tigesPour } from '../core/generateur.js';
import { nomMotif } from '../core/motifs.js';
import {
  etatPalier, compterRepetition, validerPalier, poidsAdaptatifs, enregistrerSession,
  reglagesUtilisateur, modifierReglages,
} from '../core/progression.js';
import { PanneauDemo } from '../ui/panneauDemo.js';
import { creerSeance, encadreDiagnostic } from '../ui/seance.js';
import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';

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

export default {
  id: 'lecons',
  titre: 'Leçons guidées',
  monter(el, app, params = {}) {
    let nettoyerVue = null;
    const changer = (f) => { nettoyerVue?.(); el.replaceChildren(); el.scrollTop = 0; nettoyerVue = f() ?? null; };

    // ---------------------------------------------------------------- carte du parcours
    function carte() {
      const decouverte = reglagesUtilisateur().decouverte;
      el.append(
        h('h1', {}, 'Leçons guidées'),
        h('p', { class: 'discret' }, `Chaque étape : comprendre le geste, ${REPETITIONS_REQUISES} répétitions d'entraînement, puis un mini-test de ${TEST.exercices} calculs (${TEST.reussitesMin} réussites exigées).`),
      );
      const diag = encadreDiagnostic(null, 3);
      if (diag) el.append(diag);

      for (const palier of PALIERS) {
        el.append(h('h2', {}, palier.titre));
        el.append(h('div', { class: 'liste-paliers' }, palier.sousPaliers.map((spBrut) => {
          const sp = sousPalier(spBrut.id);
          const e = etatPalier(sp.id);
          const ouvert = estDebloque(sp);
          let statut;
          let icone;
          if (e.valide) { icone = '✓'; statut = `Validé · révision le ${dateFr(e.carte.echeance)} (boîte ${e.carte.boite})`; }
          else if (!ouvert) { icone = '·'; statut = 'Verrouillé'; }
          else if (e.reps >= REPETITIONS_REQUISES) { icone = '●'; statut = 'Mini-test disponible'; }
          else { icone = '○'; statut = `${e.reps} / ${REPETITIONS_REQUISES} répétitions`; }
          return h('button', {
            class: `ligne-palier${e.valide ? ' valide' : ''}`, disabled: !ouvert,
            onclick: () => changer(() => vueSousPalier(sp)),
          }, h('span', { class: 'icone' }, icone), h('span', { class: 'titre' }, sp.titre), h('span', { class: 'statut' }, statut));
        })));
      }
      el.append(h('label', { class: 'discret', style: 'display:block;margin-top:24px' },
        h('input', {
          type: 'checkbox', checked: decouverte,
          onchange: async (ev) => { await modifierReglages({ decouverte: ev.target.checked }); changer(carte); },
        }),
        ' Mode découverte : ouvrir toutes les leçons sans attendre la validation (les compteurs et les tests restent obligatoires pour valider).'));
    }

    // ---------------------------------------------------------------- sous-palier
    function vueSousPalier(sp, ongletInitial) {
      const e = etatPalier(sp.id);
      let nettoyerOnglet = null;
      const zone = h('div', {});
      const ongletsDef = [
        ['comprendre', '1. Comprendre'],
        ['entrainement', '2. S\'entraîner'],
        ['test', '3. Mini-test'],
      ];
      const boutons = ongletsDef.map(([id, texte]) => h('button', { onclick: () => afficher(id) }, texte));
      const suivant = SOUS_PALIERS[sp.ordre + 1];

      el.append(
        h('button', { class: 'lien', onclick: () => changer(carte) }, '← Toutes les leçons'),
        h('div', { class: 'discret' }, sp.palier.titre),
        h('h1', {}, sp.titre),
        h('div', { class: 'segments', style: 'margin:8px 0 16px' }, boutons),
        zone,
      );

      function afficher(id) {
        nettoyerOnglet?.();
        nettoyerOnglet = null;
        zone.replaceChildren();
        boutons.forEach((b, i) => b.classList.toggle('actif', ongletsDef[i][0] === id));
        if (id === 'comprendre') nettoyerOnglet = comprendre();
        if (id === 'entrainement') nettoyerOnglet = entrainement();
        if (id === 'test') nettoyerOnglet = miniTest();
      }

      // 1. Comprendre ------------------------------------------------
      function comprendre() {
        zone.append(
          h('div', { class: 'carte pourquoi' }, h('strong', {}, 'Pourquoi ce geste ? '), sp.pourquoi),
          h('p', { class: 'discret' }, 'Motifs travaillés : ', sp.cibles.length > 12 ? 'tous' : sp.cibles.map(nomMotif).join(' · ')),
          h('h2', {}, 'Démonstrations'),
        );
        const choix = h('div', { class: 'ligne' });
        zone.append(choix);
        const nbTiges = Math.max(5, tigesPour(sp.chiffres));
        const panneau = new PanneauDemo(zone, nbTiges);
        sp.demos.forEach((d, i) => choix.append(h('button', {
          class: 'btn', onclick: () => panneau.jouer(d, 'manuel'),
        }, `Exemple ${i + 1} : ${d.depart} ${d.op === '+' ? '+' : '−'} ${d.n}`)));
        choix.append(h('span', { style: 'flex:1' }), h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Passer à l\'entraînement →'));
        panneau.jouer(sp.demos[0], 'manuel');
        return () => panneau.detruire();
      }

      // 2. Entraînement ----------------------------------------------
      function entrainement() {
        const bandeau = h('div', { class: 'bandeau' });
        zone.append(bandeau);
        let lot = { total: 0, justes: 0, dureeMs: 0 };
        const majBandeau = () => {
          const et = etatPalier(sp.id);
          const pret = et.reps >= REPETITIONS_REQUISES;
          bandeau.replaceChildren(...[
            h('div', { class: 'jauge' }, h('div', { style: `width:${Math.min(100, (100 * et.reps) / REPETITIONS_REQUISES)}%` })),
            h('span', {}, `Répétitions : ${Math.min(et.reps, REPETITIONS_REQUISES)} / ${REPETITIONS_REQUISES}`,
              et.reps ? ` · réussite ${formaterPourcent(et.justes, et.reps)}` : ''),
            pret && !et.valide ? h('button', { class: 'btn principal', onclick: () => afficher('test') }, 'Passer le mini-test →') : null,
          ].filter(Boolean));
        };
        majBandeau();
        const enregistrerLot = () => {
          if (!lot.total) return;
          enregistrerSession({ module: 'lecons', mode: 'entrainement', reglages: { sousPalier: sp.id }, ...lot });
          lot = { total: 0, justes: 0, dureeMs: 0 };
        };
        const seance = creerSeance(zone, {
          nbTiges: tigesPour(sp.chiffres),
          generer: () => genererExercice(sp, poidsAdaptatifs()),
          motifsSuivis: sp.autorises,
          surExercice: async (res) => {
            await compterRepetition(sp.id, res.juste);
            lot.total += 1;
            if (res.juste) lot.justes += 1;
            lot.dureeMs += res.dureeMs;
            if (lot.total >= 10) enregistrerLot();
            majBandeau();
          },
        });
        return () => { seance.detruire(); enregistrerLot(); };
      }

      // 3. Mini-test --------------------------------------------------
      function miniTest() {
        const et = etatPalier(sp.id);
        if (et.reps < REPETITIONS_REQUISES) {
          zone.append(h('div', { class: 'carte' },
            h('p', {}, `Le mini-test s'ouvre après ${REPETITIONS_REQUISES} répétitions d'entraînement. Il vous en reste ${REPETITIONS_REQUISES - et.reps}.`),
            h('p', { class: 'discret' }, 'Ce volume ancre le geste dans la main : c\'est la répétition qui rend le mouvement automatique, pas la compréhension seule.'),
            h('button', { class: 'btn principal', onclick: () => afficher('entrainement') }, 'Continuer l\'entraînement')));
          return null;
        }
        let seance = null;
        const intro = h('div', { class: 'carte' },
          h('p', {}, `${TEST.exercices} calculs, sans indice. Il faut ${TEST.reussitesMin} calculs réussis sans aucune erreur de geste.`),
          et.valide ? h('p', { class: 'discret' }, `Déjà validé le ${dateFr(et.valide)}. Vous pouvez repasser le test pour vous entraîner.`) : null,
          h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer le mini-test'));
        zone.append(intro);

        function lancer() {
          intro.remove();
          seance = creerSeance(zone, {
            nbTiges: tigesPour(sp.chiffres),
            generer: () => genererExercice(sp, poidsAdaptatifs()),
            nombre: TEST.exercices,
            indices: false,
            chrono: true,
            motifsSuivis: sp.autorises,
            surFin: async (bilan) => {
              seance.detruire();
              seance = null;
              const reussi = bilan.justes >= TEST.reussitesMin;
              await enregistrerSession({ module: 'lecons', mode: 'test', reglages: { sousPalier: sp.id }, total: bilan.total, justes: bilan.justes, dureeMs: bilan.dureeMs });
              if (reussi) await validerPalier(sp.id);
              const carteR = etatPalier(sp.id).carte;
              zone.append(h('div', { class: 'carte bilan' },
                h('div', { class: 'grand' }, `${bilan.justes} / ${bilan.total}`),
                h('p', {}, `Temps : ${formaterDuree(bilan.dureeMs)}`),
                reussi
                  ? h('p', { class: 'retour ok' }, `Sous-palier validé. Première révision le ${dateFr(carteR.echeance)}.`)
                  : h('p', {}, `Il faut ${TEST.reussitesMin} réussites. Reprenez quelques séries d'entraînement, puis retentez.`),
                h('div', { class: 'ligne' },
                  reussi && suivant ? h('button', { class: 'btn principal', onclick: () => changer(() => vueSousPalier(suivant)) }, `Leçon suivante : ${suivant.titre} →`) : null,
                  h('button', { class: 'btn', onclick: () => afficher(reussi ? 'test' : 'entrainement') }, reussi ? 'Repasser le test' : 'Retour à l\'entraînement'),
                  h('button', { class: 'btn', onclick: () => changer(carte) }, 'Toutes les leçons'))));
            },
          });
        }
        return () => seance?.detruire();
      }

      afficher(ongletInitial ?? (e.reps === 0 ? 'comprendre' : 'entrainement'));
      return () => nettoyerOnglet?.();
    }

    const depart = params.sousPalier ? sousPalier(params.sousPalier) : null;
    changer(() => (depart && estDebloque(depart) ? vueSousPalier(depart) : carte()));
    return () => nettoyerVue?.();
  },
};

