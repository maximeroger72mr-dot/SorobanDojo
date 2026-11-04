/**
 * Rythme et endurance : deux exercices pour AUTOMATISER un geste, sur son soroban.
 *  - Marathon ruban : 20 à 50 lignes (ou sans fin) sans remettre à zéro, sous-total toutes les
 *    5 lignes ; ciblé sur un geste, c'est le drill d'automatisation (voir ui/marathon.js).
 *  - Le lièvre : un rythme imposé qui oblige à lire le nombre suivant pendant que les doigts
 *    posent le précédent (voir ui/lievre.js).
 *
 * La séance du jour y envoie directement (params : { jeu, cibles, chiffres, lignes, accelere, auto })
 * pour ancrer un geste difficile ou casser un plateau.
 */

import { enregistrerSession, proposerRecord, proposerMeilleurScore, progression, evaluerMotif } from '../core/progression.js';
import { ciblesPures, ErreurGeneration } from '../core/generateur.js';
import { nomMotif } from '../core/motifs.js';
import { contraintes, contraintesCibles, optionsCibles } from './planches.js';
import { creerMarathon } from '../ui/marathon.js';
import { creerLievre, cadenceDepart } from '../ui/lievre.js';
import { listeErreurs } from '../ui/serie.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

const reglages = {
  marathon: { cible: 'lents', chiffres: 1, objectif: 30, pur: false, doigte: false },
  lievre: { cible: 'appris', chiffres: 1, lignes: 5, colonnes: 6, cadence: 'auto', metronome: true, pur: false },
};
const sec = (x) => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s`;

/** Contraintes d'après les réglages (ou les gestes imposés par la séance), mode pur compris. */
function contraintesDe(r, cibles) {
  const c = cibles ? contraintesCibles(cibles) : contraintes(r.cible);
  let note = null;
  if (r.pur) {
    try {
      const p = ciblesPures(c.cibles.filter((x) => !x.endsWith(':direct')), r.chiffres);
      Object.assign(c, { autorises: p.autorises, cibles: p.cibles, libelle: `${c.libelle} · pur` });
      if (p.ajoutes.length) note = `Mode pur : ${p.ajoutes.map(nomMotif).join(', ')} ajouté (les gestes alternent + et −).`;
    } catch (e) {
      if (!(e instanceof ErreurGeneration)) throw e;
      note = 'Ces gestes ne peuvent pas former une colonne pure : mode normal.';
    }
  }
  return { c, note };
}

/** Temps médian par chiffre des gestes visés (pour régler le lièvre), ou null. */
function tempsGestes(cibles) {
  const ts = cibles.map((k) => evaluerMotif(k).temps).filter((t) => t !== null);
  return ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : null;
}

export default {
  id: 'rythme',
  titre: 'Rythme et endurance',
  monter(el, app, params = {}) {
    let courant = null;
    const records = () => progression().records;
    const select = (obj, cle, options, conv = (x) => x) => {
      const s = h('select', { onchange: (e) => { obj[cle] = conv(e.target.value); } },
        options.map(([v, t]) => (Array.isArray(t)
          ? h('optgroup', { label: v }, t.map(([v2, t2]) => h('option', { value: v2 }, t2)))
          : h('option', { value: v }, t))));
      s.value = String(obj[cle]);
      return s;
    };
    const caseA = (obj, cle, texte, titre) => h('label', { title: titre ?? '' }, h('input', { type: 'checkbox', checked: !!obj[cle], onchange: (e) => { obj[cle] = e.target.checked; } }), ` ${texte}`);

    function accueil() {
      courant?.detruire();
      courant = null;
      remplir(el);
      const m = reglages.marathon;
      const l = reglages.lievre;
      el.append(h('h1', {}, 'Rythme et endurance'),
        h('p', { class: 'discret' }, 'Deux exercices pour automatiser un geste sur votre soroban : le volume sans interruption (marathon), et le rythme qui oblige l\'œil à lire en avance (lièvre).'),
        h('div', { class: 'carte', style: 'margin-bottom:16px' },
          h('h2', { style: 'margin-top:0' }, 'Marathon ruban'),
          h('p', {}, 'Une seule longue colonne, 5 lignes à la fois, sans jamais remettre le soroban à zéro : vous tapez le sous-total, et la suite part de ce nombre. Une erreur : le joker vous laisse continuer ; deux : fin du marathon.'),
          h('div', { class: 'reglages' },
            select(m, 'cible', optionsCibles()),
            select(m, 'chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres']], Number),
            select(m, 'objectif', [[20, '20 lignes'], [30, '30 lignes'], [40, '40 lignes'], [50, '50 lignes'], ['Infinity', 'sans fin (record de lignes)']], Number),
            caseA(m, 'pur', 'pur (aucun geste direct)'),
            caseA(m, 'doigte', 'rappel doigté'),
            h('button', { class: 'btn principal', onclick: () => lancerMarathon() }, 'Partir'))),
        h('div', { class: 'carte' },
          h('h2', { style: 'margin-top:0' }, 'Le lièvre (rythme imposé)'),
          h('p', {}, 'La ligne en cours est surlignée, la suivante est déjà visible : lisez-la pendant que vos doigts posent la ligne en cours. Le surligneur descend tout seul et la ligne passée disparaît. 3 colonnes justes d\'affilée : le lièvre accélère de 10 %.'),
          h('div', { class: 'reglages' },
            select(l, 'cible', optionsCibles()),
            select(l, 'chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres']], Number),
            select(l, 'lignes', [[5, '5 lignes'], [8, '8 lignes'], [10, '10 lignes']], Number),
            select(l, 'colonnes', [[6, '6 colonnes'], [10, '10 colonnes'], [15, '15 colonnes']], Number),
            select(l, 'cadence', [['auto', 'cadence : selon mes temps'], ...[3, 2.5, 2, 1.6, 1.3, 1, 0.8].map((x) => [x, `départ : ${sec(x)} par ligne`])], (v) => (v === 'auto' ? v : Number(v))),
            caseA(l, 'metronome', 'clic à chaque ligne'),
            caseA(l, 'pur', 'pur'),
            h('button', { class: 'btn principal', onclick: () => lancerLievre() }, 'Partir'))));
      const recL = records()[`lievre-${l.chiffres}-${l.lignes}`];
      if (recL) el.lastChild.append(h('p', { class: 'discret' }, `Votre meilleure cadence (${l.chiffres} chiffre${l.chiffres > 1 ? 's' : ''}, ${l.lignes} lignes) : ${sec(recL.dureeMs / 1000)} par ligne.`));
    }

    // ------------------------------------------------------------ marathon
    function lancerMarathon(cibles = null) {
      const r = { ...reglages.marathon };
      const { c, note: notePur } = contraintesDe(r, cibles);
      // Un seul geste (et son miroir) à 1 chiffre : les lignes se ressemblent forcément.
      const note = [notePur, c.cibles.length <= 2 && r.chiffres === 1
        ? 'Avec un seul geste à 1 chiffre, les lignes se ressemblent forcément : une ligne « relance » (geste direct) déplace parfois le soroban pour que les sous-totaux changent. Pour plus de variété, passez à 2 chiffres.'
        : null].filter(Boolean).join(' ') || null;
      const cle = `marathon-${cibles ? cibles.join('+') : r.cible}${r.pur ? '-pur' : ''}-${r.chiffres}-${r.objectif}`;
      const rec = records()[cle];
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Rythme et endurance'),
        h('h1', {}, `Marathon : ${c.libelle}`),
        h('p', { class: 'discret' }, `${r.chiffres} chiffre${r.chiffres > 1 ? 's' : ''} · ${Number.isFinite(r.objectif) ? `${r.objectif} lignes` : 'sans fin'}${rec ? ` · record : ${Number.isFinite(r.objectif) ? formaterDuree(rec.dureeMs) : `${rec.points} lignes`}` : ''}`),
        note ? h('p', { class: 'discret' }, note) : null);
      courant = creerMarathon(el, {
        contraintes: c,
        chiffres: r.chiffres,
        objectif: r.objectif,
        recordMs: Number.isFinite(r.objectif) ? rec?.dureeMs ?? null : null,
        doigte: r.doigte,
        surFin: async (b) => {
          courant.detruire();
          courant = null;
          const justes = b.resultats.filter((x) => x.juste).length;
          await enregistrerSession({ module: 'rythme', mode: 'marathon', reglages: { ...r, cibles: c.cibles }, total: b.resultats.length, justes, dureeMs: b.dureeMs });
          let nouveau = false;
          if (Number.isFinite(r.objectif)) { if (b.complet) nouveau = await proposerRecord(cle, b.dureeMs); } else nouveau = await proposerMeilleurScore(cle, b.lignes);
          const parLigne = b.lignes ? b.dureeMs / b.lignes : 0;
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.lignes} lignes`),
            h('p', {}, b.complet ? `Objectif tenu en ${formaterDuree(b.dureeMs)}` : 'Marathon interrompu', ` · ${formaterDuree(parLigne)} par ligne`, b.jokerUtilise ? ' · joker utilisé' : ' · sans joker'),
            nouveau ? h('p', { class: 'retour ok' }, 'Nouveau record personnel !') : null,
            h('div', { class: 'ligne' },
              h('button', { class: 'btn principal', onclick: () => lancerMarathon(cibles) }, 'Recommencer'),
              h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }

    // ------------------------------------------------------------ lièvre
    function lancerLievre(cibles = null, accelere = false) {
      const r = { ...reglages.lievre };
      const { c, note } = contraintesDe(r, cibles);
      const cadence = r.cadence === 'auto' ? cadenceDepart(tempsGestes(c.cibles), r.chiffres, accelere) : r.cadence;
      const cle = `lievre-${r.chiffres}-${r.lignes}`;
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Rythme et endurance'),
        h('h1', {}, `Le lièvre : ${c.libelle}`),
        note ? h('p', { class: 'discret' }, note) : null);
      courant = creerLievre(el, {
        contraintes: c,
        chiffres: r.chiffres,
        lignes: r.lignes,
        colonnes: r.colonnes,
        cadence,
        metronome: r.metronome,
        surFin: async (b) => {
          await enregistrerSession({ module: 'rythme', mode: 'lievre', reglages: { ...r, cibles: c.cibles }, total: b.total, justes: b.justes, dureeMs: b.total * r.lignes * cadence * 1000 });
          const nouveau = b.meilleureCadence !== null && await proposerRecord(cle, b.meilleureCadence * 1000);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Départ : ${sec(b.cadenceDepart)} par ligne`, b.meilleureCadence !== null ? ` · meilleure colonne réussie : ${sec(b.meilleureCadence)} par ligne` : '', ` · la prochaine fois : ${sec(b.cadenceFin)}`),
            nouveau ? h('p', { class: 'retour ok' }, 'Nouvelle meilleure cadence !') : null,
            h('div', { class: 'ligne' },
              h('button', { class: 'btn principal', onclick: () => { reglages.lievre.cadence = b.cadenceFin; lancerLievre(cibles); } }, 'Continuer à cette cadence'),
              h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))));
        },
      });
      if (params.auto) courant.demarrer();
    }

    if (params.jeu === 'marathon') {
      if (params.lignes) reglages.marathon.objectif = params.lignes;
      if (params.chiffres) reglages.marathon.chiffres = params.chiffres;
      lancerMarathon(params.cibles ?? null);
    } else if (params.jeu === 'lievre') {
      if (params.chiffres) reglages.lievre.chiffres = params.chiffres;
      reglages.lievre.cadence = 'auto';
      lancerLievre(params.cibles ?? null, !!params.accelere);
    } else accueil();
    return () => courant?.detruire();
  },
};
