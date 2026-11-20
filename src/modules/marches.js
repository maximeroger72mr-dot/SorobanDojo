/**
 * Marches d'allure (0.38) : de la vitesse des leçons à l'allure d'examen, en 5 jalons par grade.
 * Voir core/marches.js.
 */

import { progression, aujourdhui, enregistrerSession, noterMarche } from '../core/progression.js';
import { etatMarches, feuilleMarche, feuilleMarcheReussie, cleMarches, scoreProjete, dateProjetee, NB_MARCHES, FEUILLES_MARCHE, JUSTES_MARCHE, SECONDES_FRACTIONNE, SERIES_FRACTIONNE, MINUTES_FEUILLE_MARCHE } from '../core/marches.js';
import { formaterTemps } from '../core/maitrise.js';
import { partieDuJour, hakariActif } from '../core/hakari.js';
import { gradeOperation } from '../core/formatKyu.js';
import { creerFeuille } from '../ui/feuille.js';
import { boutonNaoshi } from '../ui/naoshi.js';
import { h, remplir } from '../ui/dom.js';

const dateFr = (x) => new Date(`${x}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export default {
  id: 'marches',
  titre: 'Marches d\'allure',
  monter(el, app, params = {}) {
    let feuille = null;

    function accueil() {
      feuille?.detruire();
      feuille = null;
      remplir(el);
      const d = progression();
      const e = etatMarches(d);
      el.append(h('h1', {}, 'Marches d\'allure'),
        h('p', { class: 'discret chapeau' }, 'De la vitesse des leçons à l\'allure d\'examen, en 5 jalons. Chaque marche se valide sur une feuille courte au format de l\'examen, deux jours différents.'));
      if (!e) { el.append(h('div', { class: 'carte' }, 'Tous les grades et tous les dan sont réussis : les marches s\'arrêtent là.')); return; }
      if (e.dan) el.append(h('p', { class: 'discret' }, `Le 1er kyū est réussi : les marches visent maintenant le ${e.grade.nom} (${e.grade.japonais}), ${e.grade.pointsEpreuve} points sur 300 dans chaque épreuve de 10 minutes.`));
      const g = e.grade;
      if (!e.utiles) {
        el.append(h('div', { class: 'carte' }, `Jusqu'au 7e kyū, l'allure d'examen est plus lente que la vitesse déjà exigée aux leçons : pas besoin de marches. Elles commencent avec le 6e kyū.`));
        return;
      }
      const nomsParties = { mitori: 'colonnes', mul: 'multiplications', div: 'divisions' };
      if (!e.active) el.append(h('div', { class: 'carte avis' }, `Les marches 1 et 2 du ${g.nom} s'ouvrent dès 70 % de ses leçons validées (vous en êtes à ${Math.round((e.partLecons ?? 0) * 100)} %), les marches 3 à 5 quand toutes le sont. Vous pouvez déjà les regarder.`));
      else if (e.anticipees) el.append(h('div', { class: 'carte avis' }, e.attente
        ? `Marches 1 et 2 franchies. Les marches 3 à 5 s'ouvrent quand toutes les leçons du ${g.nom} sont validées : la vitesse a déjà pris de l'avance.`
        : `Marches anticipées : la vitesse monte pendant les leçons, en alternance avec elles. Les feuilles ne portent que sur ce qui est déjà validé (${e.parties.map((k) => nomsParties[k]).join(', ')}). Les marches 3 à 5 viendront après les leçons.`));
      // L'échelle : 5 marches, la courante en évidence.
      el.append(h('div', { class: 'carte' },
        h('h2', { style: 'margin-top:0' }, `Vers le ${g.nom}`),
        h('table', { class: 'table-marches' },
          h('tr', {}, ['Marche', 'Colonnes', '× et ÷', ''].map((x) => h('th', {}, x))),
          e.marches.map((m, i) => h('tr', { class: i < e.validees ? 'valide' : i === e.validees ? 'courante' : '' },
            h('td', {}, `${m.n}${m.n === NB_MARCHES ? ' (allure d\'examen, avec marge)' : ''}`),
            h('td', {}, `${m.cpm} chiffres/min (${formaterTemps(m.parChiffre)} par chiffre)`),
            h('td', {}, `${nf(m.produitsParMinute)} produits/min`),
            h('td', {}, i < e.validees ? `✓${e.dates[i] ? ` ${dateFr(e.dates[i])}` : ''}` : i === e.validees ? `${e.reussites.length} / ${FEUILLES_MARCHE} feuille${e.reussites.length > 1 ? 's' : ''}` : '')))),
        e.courante ? h('p', {}, `Marche ${e.courante.n} : une feuille d'environ ${MINUTES_FEUILLE_MARCHE} minutes au format du ${g.nom}, dans le temps de la marche, avec ${Math.round(JUSTES_MARCHE * 100)} % de justes. Deux fois, deux jours différents${e.reussites.length ? ` (déjà réussie le ${dateFr(e.reussites[0])})` : ''}.`)
          : h('p', { class: 'retour ok' }, `Les 5 marches sont franchies : vous tenez l'allure du ${g.nom} avec de la marge. Place à l'examen !`)));
      // Prédiction honnête.
      const s = scoreProjete(g, d, aujourdhui());
      const date = dateProjetee(e, aujourdhui());
      el.append(h('div', { class: 'carte' },
        h('h2', { style: 'margin-top:0' }, 'Si l\'examen avait lieu aujourd\'hui'),
        s && s.epreuves ? h('div', {},
          h('p', {}, `Chaque épreuve compte à part, sans compensation. À votre vitesse mesurée et avec votre justesse récente (${Math.round(s.taux * 100)} %) : ${s.reussi ? 'ce serait réussi.' : `pas encore : ${s.faible.titre.split(' (')[0].toLowerCase()} est l'épreuve qui bloque.`}`),
          h('table', {}, h('tr', {}, ['Épreuve', 'Projeté', 'Exigé'].map((x) => h('th', {}, x))),
            s.epreuves.map((x) => h('tr', { class: x.ok ? '' : 'a-retravailler' }, h('td', {}, x.titre), h('td', {}, `${x.points} / ${x.pointsMax}`), h('td', {}, `${x.seuil}${x.ok ? ' ✓' : ''}`)))))
        : s ? h('p', {}, `À votre vitesse mesurée et avec votre justesse récente (${Math.round(s.taux * 100)} %), vous traiteriez ${Math.round(s.part * 100)} % du sujet : environ ${s.points} points sur ${s.pointsMax}, pour ${s.seuil} exigés. ${s.reussi ? 'Ce serait réussi.' : 'Pas encore assez.'}`)
          : h('p', {}, 'Pas encore assez de mesures (vitesse des colonnes et des × ÷) pour une projection.'),
        h('p', {}, date ? `Au rythme de vos marches (${Math.round(date.joursParMarche)} jours par marche), l'allure d'examen arriverait vers le ${dateFr(date.date)}.`
          : 'La date projetée s\'affiche après la première marche franchie : on ne la devine pas avant.'),
        s?.source === 'examen' ? h('p', { class: 'discret' }, 'Projection tirée de votre dernier examen de ce grade (moins de 3 semaines) : la vitesse sous examen.') : null,
        s?.aConfirmer ? h('p', { class: 'discret' }, `Vitesse à confirmer : une partie vient encore de vos gestes ou de vos leçons, pas de feuilles au format du ${g.nom}. Une planche ou une marche au format la mesurera.`) : null,
        h('p', { class: 'discret' }, 'Des repères, pas des promesses : la vitesse progresse par paliers, et la fatigue ou la régularité changent tout.')));
      if (e.courante) {
        const parties = [['mitori', 'Colonnes'], ['mul', 'Multiplications'], ['div', 'Divisions']].filter(([k]) => (k === 'mitori' || g[k]) && (!e.parties || e.parties.includes(k)));
        const jour = hakariActif(d) ? partieDuJour(d, aujourdhui()).partie : 'colonnes';
        const sel = h('select', {}, parties.map(([k, t]) => h('option', { value: k }, t)));
        sel.value = jour === 'colonnes' ? 'mitori' : jour;
        if (!parties.some(([k]) => k === sel.value)) sel.value = parties[0][0];
        el.append(h('div', { class: 'ligne' },
          h('button', { class: 'btn principal', onclick: () => lancerFeuille(g, e) }, `Feuille de la marche ${e.courante.n} →`),
          h('span', { class: 'discret' }, 'ou'),
          h('button', { class: 'btn', onclick: () => fractionne(g, e.courante, sel.value, 1) }, `Fractionné : ${SERIES_FRACTIONNE} × ${SECONDES_FRACTIONNE} s`), sel),
        h('p', { class: 'discret' }, `Le fractionné : ${SERIES_FRACTIONNE} mini-feuilles de ${SECONDES_FRACTIONNE} secondes à l'allure de la marche, avec une pause entre chacune. Il habitue la main à une vitesse un peu au-dessus de la sienne, sans la fatigue d'une feuille longue.`));
      }
    }

    function lancerFeuille(g, e) {
      const m = e.courante;
      const f = feuilleMarche(g, m, undefined, null, e.parties);
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Marches d\'allure'),
        h('h1', {}, `Marche ${m.n} sur ${NB_MARCHES} · ${g.nom}`),
        h('p', { class: 'consigne' }, `Marche ${m.n} du ${g.nom} : ${f.minutes.toLocaleString('fr-FR')} minutes, ${Math.round(JUSTES_MARCHE * 100)} % de justes. Ce qui n'est pas fait à la fin du temps compte faux.`));
      feuille = creerFeuille(el, {
        titre: `Marche ${m.n} · ${g.nom} · ${f.minutes.toLocaleString('fr-FR')} min`,
        sections: f.sections,
        minutes: f.minutes,
        mesure: { source: 'entrainement', grade: g },
        surFin: (b) => {
          const reussi = feuilleMarcheReussie(b.justes, b.total);
          enregistrerSession({ module: 'marches', mode: 'feuille', reglages: { grade: g.id, marche: m.n }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const info = h('p', {});
          noterMarche(cleMarches(g), reussi).then((x) => {
            const franchie = (x.validees ?? 0) > e.validees;
            info.textContent = !reussi ? `Pas encore : ${b.justes} sur ${b.total}, il en faut ${Math.ceil(b.total * JUSTES_MARCHE)} dans le temps. Le fractionné aide à passer le cap.`
              : franchie ? `Marche ${m.n} franchie ! ${x.validees < NB_MARCHES ? `La marche ${x.validees + 1} est ouverte.` : 'Toutes les marches sont franchies : vous tenez l\'allure d\'examen.'}`
              : (x.reussites ?? []).length ? `Réussie ! Encore une fois, un autre jour, pour franchir la marche.` : 'Réussie, mais déjà réussie aujourd\'hui : la seconde doit être un autre jour.';
            app.majBadges?.();
          });
          return h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`), info,
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'marche', retour: () => accueil() }), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour aux marches')));
        },
      });
    }

    function fractionne(g, m, cle, k) {
      const f = feuilleMarche(g, m, SECONDES_FRACTIONNE, cle, etatMarches(progression())?.parties ?? null);
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Marches d\'allure'),
        h('h1', {}, `Fractionné ${k} sur ${SERIES_FRACTIONNE}`),
        h('p', { class: 'consigne' }, `Fractionné, série ${k} sur ${SERIES_FRACTIONNE} : à l'allure de la marche ${m.n}.`));
      feuille = creerFeuille(el, {
        titre: `Fractionné ${k} / ${SERIES_FRACTIONNE} · ${f.minutes.toLocaleString('fr-FR')} min`,
        sections: f.sections,
        minutes: f.minutes,
        mesure: { source: 'entrainement', grade: g },
        surFin: (b) => {
          enregistrerSession({ module: 'marches', mode: 'fractionne', reglages: { grade: g.id, marche: m.n, partie: cle }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          return h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            k < SERIES_FRACTIONNE ? h('p', {}, 'Respirez, relâchez la main, puis la série suivante.') : h('p', {}, 'Fractionné terminé.'),
            h('div', { class: 'ligne' },
              k < SERIES_FRACTIONNE ? h('button', { class: 'btn principal', onclick: () => { feuille?.detruire(); fractionne(g, m, cle, k + 1); } }, `Série ${k + 1} →`) : null,
              h('button', { class: 'btn', onclick: () => accueil() }, 'Retour aux marches')));
        },
      });
    }

    /**
     * × ou ÷ en plateau (0.39) : 4 blocs de 90 s à 115 % de la meilleure cadence, au format du kyū ;
     * la justesse se compte sur le cumul des 4 blocs (90 % visés), pas bloc par bloc.
     */
    function surcharge({ type, parProduit }, k = 1, cumul = { justes: 0, total: 0 }) {
      const g = gradeOperation(progression(), type);
      const m = { parChiffre: parProduit / 2, parProduit };
      const f = feuilleMarche(g, m, SECONDES_FRACTIONNE, type);
      const signe = type === 'mul' ? '×' : '÷';
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Marches d\'allure'),
        h('h1', {}, `Sprint de surcharge ${signe} · bloc ${k} sur ${SERIES_FRACTIONNE}`),
        h('p', { class: 'consigne' }, `90 secondes à ${nf(parProduit)} s par produit : 15 % plus vite que votre meilleure cadence. La justesse se compte sur les ${SERIES_FRACTIONNE} blocs ensemble.`));
      feuille = creerFeuille(el, {
        titre: `Surcharge ${signe} · bloc ${k} / ${SERIES_FRACTIONNE} · ${f.minutes.toLocaleString('fr-FR')} min`,
        sections: f.sections,
        minutes: f.minutes,
        surFin: (b) => {
          const c = { justes: cumul.justes + b.justes, total: cumul.total + b.total };
          if (k === SERIES_FRACTIONNE) enregistrerSession({ module: 'marches', mode: 'surcharge', reglages: { partie: type, parProduit }, total: c.total, justes: c.justes, dureeMs: SERIES_FRACTIONNE * SECONDES_FRACTIONNE * 1000 });
          const ok = c.total > 0 && c.justes / c.total >= JUSTES_MARCHE;
          return h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            k < SERIES_FRACTIONNE ? h('p', {}, `Cumul : ${c.justes} justes sur ${c.total}. Respirez, relâchez la main, puis le bloc suivant.`)
              : h('p', { class: ok ? 'retour ok' : '' }, `Cumul des ${SERIES_FRACTIONNE} blocs : ${c.justes} justes sur ${c.total}. ${ok ? 'Tenu à 115 % : le plateau cède. Votre cadence habituelle va paraître lente.' : 'Pas encore 90 % à cette vitesse : c\'est normal, la main a suivi un rythme plus haut. On recommence un autre jour.'}`),
            h('div', { class: 'ligne' },
              k < SERIES_FRACTIONNE ? h('button', { class: 'btn principal', onclick: () => { feuille?.detruire(); surcharge({ type, parProduit }, k + 1, c); } }, `Bloc ${k + 1} →`) : null,
              h('button', { class: 'btn', onclick: () => accueil() }, 'Retour aux marches')));
        },
      });
    }

    const e0 = etatMarches(progression());
    if (params.surcharge) surcharge(params.surcharge);
    else if (params.auto && e0?.courante) lancerFeuille(e0.grade, e0);
    else accueil();
    return () => feuille?.detruire();
  },
};
