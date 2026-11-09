/**
 * Planches : feuilles de colonnes à calculer sur son soroban (imprimables).
 *
 * Réglages : 1, 2 ou 3 chiffres ; 5, 8 ou 10 lignes ; nombre de colonnes ; et surtout la CIBLE.
 * Avec un ami choisi, les colonnes ne contiennent QUE cet ami et des gestes directs, et cet ami
 * revient aussi souvent que possible : c'est la répétition du mouvement. « Tout ce que j'ai appris »
 * se limite aux gestes des leçons validées.
 */

import { genererColonneVariee, creerMemoire, ciblesPures, ErreurGeneration } from '../core/generateur.js';
import { TOUS_LES_MOTIFS, famille, nomMotif, analyserMotif } from '../core/motifs.js';
import { enregistrerSession, proposerRecord, poidsAdaptatifs, motifsEnDifficulte, noterGestes, progression } from '../core/progression.js';
import { motifsAppris as motifsApprisDe, gestesLents, chiffresAppris } from '../core/parcours.js';
import { sousPalier } from '../core/curriculum.js';
import { tempsParUnite, SURCOUT_FEUILLE_S, NIVEAUX, formaterCadence } from '../core/maitrise.js';
import { localiserErreur } from '../core/diagnostic.js';
import { creerFeuille } from '../ui/feuille.js';
import { carteMaitrise } from '../ui/carteMaitrise.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { chiffres: 2, lignes: 5, cible: 'appris', colonnes: 10, selection: new Set() };
const DIRECT = famille('direct');

/** Motifs des leçons validées (plus les gestes directs). */
export const motifsAppris = () => motifsApprisDe(progression());

/** Contraintes strictes pour des gestes donnés : uniquement ces gestes et des gestes directs. */
export function contraintesCibles(cibles) {
  return { autorises: new Set([...DIRECT, ...cibles]), cibles, libelle: cibles.map(nomMotif).join(' + ') };
}

/** Choix de cible proposés (planches, marathon, lièvre). */
export function optionsCibles() {
  const motifsPar = (regle) => TOUS_LES_MOTIFS.filter((c) => analyserMotif(c).regle === regle).map((c) => [c, nomMotif(c)]);
  return [
    ['appris', 'Tout ce que j\'ai appris'],
    ['faibles', 'Mes points faibles'],
    ['lents', 'Vitesse : mes gestes les plus lents'],
    ['Familles', [['famille:petit', 'Tous les petits amis'], ['famille:grand', 'Tous les grands amis'], ['famille:mixte', 'Toutes les combinaisons'], ['famille:cascade', 'Retenues/emprunts en cascade']]],
    ['Petits amis', motifsPar('petit')],
    ['Grands amis', motifsPar('grand')],
    ['Combinaisons', motifsPar('mixte')],
  ];
}

/** Contraintes de génération pour une valeur de cible : { autorises, cibles, libelle }. */
export function contraintes(valeur) {
  if (valeur.startsWith('consolidation:')) {
    // Consolidation : le geste de la leçon, MÉLANGÉ aux gestes appris avant (il reste favori).
    const sp = sousPalier(valeur.slice(14));
    const appris = motifsAppris();
    const anciens = [...appris].filter((c) => !c.endsWith(':direct') && !sp.cibles.includes(c));
    return { autorises: new Set([...appris, ...sp.cibles]), cibles: [...sp.cibles, ...anciens], favoris: sp.cibles, libelle: `Consolidation : ${sp.titre}, mélangé aux gestes précédents` };
  }
  if (valeur === 'tout') return { autorises: null, cibles: TOUS_LES_MOTIFS.filter((c) => !c.endsWith(':direct')), libelle: 'Tout mélangé' };
  if (valeur === 'appris') {
    const appris = motifsAppris();
    const amis = [...appris].filter((c) => !c.endsWith(':direct'));
    return { autorises: appris, cibles: amis.length ? amis : DIRECT, libelle: 'Tout ce que j\'ai appris' };
  }
  let cibles;
  let libelle;
  if (valeur === 'choix') {
    // Sélection libre sur la carte de maîtrise (ex. +4 et −4 ensemble).
    cibles = [...reglages.selection];
    if (!cibles.length) return contraintes('appris');
    libelle = cibles.map(nomMotif).join(' + ');
  } else if (valeur === 'lents') {
    // Planche « vitesse » : les gestes appris les plus lents, pour les faire passer au niveau supérieur.
    cibles = gestesLents(progression()).map((g) => g.cle);
    libelle = 'Vitesse : mes gestes les plus lents';
    if (!cibles.length) return contraintes('appris');
  } else if (valeur === 'faibles') {
    cibles = motifsEnDifficulte().map((m) => m.cle);
    libelle = 'Mes points faibles';
    if (!cibles.length) return contraintes('appris');
  } else if (valeur.startsWith('famille:')) {
    cibles = famille(valeur.slice(8));
    libelle = { petit: 'Tous les petits amis', grand: 'Tous les grands amis', mixte: 'Toutes les combinaisons', cascade: 'Cascades' }[valeur.slice(8)];
  } else {
    cibles = [valeur];
    libelle = nomMotif(valeur);
  }
  // Strict : uniquement les gestes directs et les amis choisis.
  return { autorises: new Set([...DIRECT, ...cibles]), cibles, libelle };
}

/**
 * Mes feuilles : par type (même nombre de chiffres, même cible), la dernière, la moyenne, la
 * meilleure, et la tendance ; puis les 10 dernières feuilles, colorées selon le niveau atteint.
 */
function historiqueFeuilles() {
  const feuilles = progression().feuilles ?? [];
  if (!feuilles.length) return null;
  const couleur = (t) => {
    const n = [...NIVEAUX].reverse().find((x) => x.temps && t <= x.temps.addsub) ?? NIVEAUX[1];
    return `niveau-${n.id}`;
  };
  const types = {};
  for (const f of feuilles) (types[f.cle] ??= []).push(f);
  const lignes = Object.values(types).sort((a, b) => (a.at(-1).date < b.at(-1).date ? 1 : -1)).slice(0, 8).map((liste) => {
    const ts = liste.map((f) => f.t);
    const moyenne = ts.slice(-10).reduce((s, x) => s + x, 0) / Math.min(10, ts.length);
    const meilleure = Math.min(...ts);
    const debut = ts.slice(0, 3);
    const fin = ts.slice(-3);
    const tendance = liste.length >= 6 ? (fin.reduce((s, x) => s + x, 0) / fin.length) / (debut.reduce((s, x) => s + x, 0) / debut.length) - 1 : null;
    return h('tr', {}, h('td', {}, liste[0].libelle), h('td', {}, liste.length),
      h('td', {}, h('span', { class: `pastille-niveau ${couleur(liste.at(-1).t)}` }), ` ${formaterCadence(liste.at(-1).t)}`),
      h('td', {}, formaterCadence(moyenne)), h('td', {}, formaterCadence(meilleure)),
      h('td', {}, tendance === null ? '—' : tendance <= -0.03 ? `${Math.round(-tendance * 100)} % plus rapide` : tendance >= 0.03 ? `${Math.round(tendance * 100)} % plus lent` : 'stable'));
  });
  return h('div', {}, h('h2', {}, 'Mes feuilles'),
    h('p', { class: 'discret' }, 'Cadence en chiffres par minute (CPM : plus c\'est haut, mieux c\'est ; lecture et écriture des réponses déduites), par type de feuille : seules des feuilles du même type se comparent. La couleur suit les niveaux : bronze, argent, or, platine.'),
    h('table', {}, h('tr', {}, ['Type de feuille', 'Feuilles', 'Dernière', 'Moyenne (10 dernières)', 'Meilleure', 'Tendance'].map((x) => h('th', {}, x))), lignes));
}

export default {
  id: 'planches',
  titre: 'Planches',
  monter(el, app, params = {}) {
    let feuille = null;
    if (params.cible) reglages.cible = params.cible;
    if (params.colonnes) reglages.colonnes = params.colonnes;
    if (params.lignes) reglages.lignes = params.lignes;
    if (params.pur !== undefined) reglages.pur = !!params.pur;
    // Planche proposée par la séance : son identifiant (pour la cocher) et son objectif.
    reglages.proposition = params.proposition ?? null;
    if (params.chiffres) reglages.chiffres = params.chiffres;
    // Par défaut, pas plus de chiffres que dans les leçons validées (on peut toujours en choisir plus).
    else if (!progression().reglages?.decouverte) reglages.chiffres = Math.min(reglages.chiffres, chiffresAppris(progression()));
    if (params.consolidation) {
      const sp = sousPalier(params.consolidation);
      Object.assign(reglages, { cible: `consolidation:${sp.id}`, chiffres: Math.max(1, sp.chiffres), lignes: 5, colonnes: 10, pur: false });
    }
    const select = (cle, options, conv = (x) => x) => {
      const s = h('select', { onchange: (e) => { reglages[cle] = conv(e.target.value); } },
        options.map(([v, t]) => (Array.isArray(t)
          ? h('optgroup', { label: v }, t.map(([v2, t2]) => h('option', { value: v2 }, t2)))
          : h('option', { value: v }, t))));
      s.value = String(reglages[cle]);
      return s;
    };
    const motifsPar = (regle) => TOUS_LES_MOTIFS.filter((c) => analyserMotif(c).regle === regle).map((c) => [c, nomMotif(c)]);

    const zone = h('div', {});
    el.append(
      h('h1', {}, 'Planches'),
      h('p', { class: 'discret' }, 'Des colonnes à calculer sur votre soroban, puis à corriger. Choisissez un ami pour en répéter le geste : la planche ne contiendra que lui et des gestes directs. Les feuilles s\'impriment.'),
      h('div', { class: 'reglages' },
        select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres'], [4, '4 chiffres'], [5, '5 chiffres'], [6, '6 chiffres']], Number),
        select('lignes', [[5, '5 lignes'], [8, '8 lignes'], [10, '10 lignes'], [15, '15 lignes']], Number),
        h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { reglages.zeros = e.target.checked; } }), ' zéros internes'),
        h('label', { title: 'Uniquement les gestes choisis, aucun geste direct (sauf la 1re ligne, posée, et la retenue d\'un grand ami).' },
          h('input', { type: 'checkbox', checked: !!reglages.pur, onchange: (e) => { reglages.pur = e.target.checked; } }), ' pur (aucun geste direct)'),
        h('label', { title: 'Rappel des doigts à côté de chaque ligne : pouce, index, céleste.' },
          h('input', { type: 'checkbox', checked: !!reglages.doigte, onchange: (e) => { reglages.doigte = e.target.checked; } }), ' rappel doigté'),
        select('colonnes', [[5, '5 colonnes'], [10, '10 colonnes'], [20, '20 colonnes']], Number),
        select('cible', [
          ['appris', 'Tout ce que j\'ai appris'],
          ['choix', 'Choisir sur la carte (plusieurs gestes)…'],
          ['faibles', 'Mes points faibles'],
          ['lents', 'Vitesse : mes gestes les plus lents'],
          ['tout', 'Tout mélangé'],
          ['Familles', [['famille:petit', 'Tous les petits amis'], ['famille:grand', 'Tous les grands amis'], ['famille:mixte', 'Toutes les combinaisons'], ['famille:cascade', 'Retenues/emprunts en cascade']]],
          ['Petits amis', motifsPar('petit')],
          ['Grands amis', motifsPar('grand')],
          ['Combinaisons', motifsPar('mixte')],
        ]),
        h('button', { class: 'btn principal', onclick: () => { reglages.proposition = null; lancer(); } }, 'Créer la planche')),
      zone, historiqueFeuilles());

    function lancer() {
      feuille?.detruire();
      remplir(zone);
      const r = { ...reglages };
      const c = contraintes(r.cible);
      // Mode pur : seulement les gestes choisis, sans geste direct.
      let notePur = null;
      if (r.pur) {
        try {
          const p = ciblesPures(c.cibles.filter((x) => !x.endsWith(':direct')), r.chiffres);
          Object.assign(c, { autorises: p.autorises, cibles: p.cibles, pur: true, pas: p.pas });
          c.libelle += ' · pur';
          notePur = 'Mode pur : le geste revient une ligne sur deux ; les lignes entre deux ne servent qu\'à replacer la tige (gestes directs ou autres amis de la même famille).';
        } catch (e) {
          if (!(e instanceof ErreurGeneration)) throw e;
          notePur = 'Ce geste ne peut pas former une colonne pure avec ces réglages : planche normale.';
        }
      }
      if (r.proposition && params.objectif) zone.append(h('div', { class: 'carte objectif-planche' }, h('strong', {}, 'Objectif : '), params.objectif));
      if (notePur) zone.append(h('p', { class: 'discret' }, notePur));
      // Mémoire de la taille de la feuille : toutes les colonnes ont des résultats différents.
      const memoire = creerMemoire(r.colonnes);
      const poids = poidsAdaptatifs(c.cibles);
      for (const f of c.favoris ?? []) poids[f] = (poids[f] ?? 1) * 3;
      // Création de la planche : jamais vide, jamais deux colonnes identiques. Si ces réglages ne
      // permettent pas de colonne (cascades à 1 chiffre…), repli explicite : 2 chiffres, puis
      // mode normal, puis tous les gestes appris.
      const config = { chiffres: r.chiffres, lignes: r.lignes, autorises: c.autorises, cibles: c.cibles, poids, zeros: !!r.zeros, pur: !!c.pur, pas: c.pas };
      const replis = [
        [config, null],
        [{ ...config, chiffres: Math.max(2, r.chiffres) }, `Ces colonnes demandent au moins 2 chiffres : planche à ${Math.max(2, r.chiffres)} chiffres.`],
        [{ ...config, chiffres: Math.max(2, r.chiffres), pur: false, autorises: contraintes(r.cible).autorises, cibles: contraintes(r.cible).cibles }, 'Impossible de former ces colonnes en mode pur : planche normale, à 2 chiffres au moins.'],
        [{ ...config, pur: false, ...(({ autorises, cibles }) => ({ autorises, cibles }))(contraintes('appris')) }, 'Impossible de former des colonnes avec ce geste et ces réglages : planche sur tous vos gestes appris.'],
      ];
      let problemes = null;
      for (const [p, message] of replis) {
        try {
          const sigs = new Set();
          problemes = [];
          for (let k = 0; problemes.length < r.colonnes && k < r.colonnes * 4; k++) {
            const col = genererColonneVariee(p, memoire);
            const sig = col.lignes.map((l) => `${l.op}${l.n}`).join();
            if (sigs.has(sig)) continue;
            sigs.add(sig);
            problemes.push(col);
          }
          if (problemes.length < r.colonnes) throw new ErreurGeneration('pas assez de colonnes différentes');
          if (message) zone.append(h('p', { class: 'retour' }, message));
          break;
        } catch (e) {
          if (!(e instanceof ErreurGeneration)) throw e;
          problemes = null;
        }
      }
      if (!problemes) { zone.append(h('p', { class: 'retour erreur' }, 'Impossible de créer cette planche : choisissez d\'autres réglages.')); return; }
      if (problemes.some((x) => x.assoupli)) zone.append(h('p', { class: 'discret' }, 'Pour ce geste, les combinaisons possibles sont peu nombreuses : quelques colonnes répètent une valeur plus souvent que d\'habitude.'));
      const cleRecord = `planche-${r.chiffres}-${r.lignes}-${r.colonnes}-${r.cible}${r.pur ? '-pur' : ''}`;
      feuille = creerFeuille(zone, {
        doigte: !!r.doigte,
        historique: { cle: `planche-${r.chiffres}-${r.lignes}-${r.cible}${r.pur ? '-pur' : ''}`, libelle: `${c.libelle} · ${r.chiffres} chiffre${r.chiffres > 1 ? 's' : ''} · ${r.lignes} lignes` },
        titre: `${c.libelle} · ${r.chiffres} chiffre${r.chiffres > 1 ? 's' : ''} · ${r.lignes} lignes`,
        sections: [{ problemes }],
        surFin: (b) => {
          (async () => {
            const dureeMoyenne = b.dureeMs / b.total;
            for (const x of b.resultats) {
              // Réussite : tous les gestes de la colonne sont crédités. Erreur : seul un geste
              // prouvé par le résultat est mis en cause (jamais d'accusation au hasard).
              const loc = x.juste || x.reponse === null ? null : localiserErreur(x.ex, x.reponse);
              // Le temps d'une feuille est une moyenne : il ne renseigne la vitesse d'un geste que si
              // la planche ne vise QUE ce geste. Sinon, seule la justesse compte.
              const t = c.cibles.length === 1 ? tempsParUnite(x.ex, dureeMoyenne, SURCOUT_FEUILLE_S) : null;
              await noterGestes(x.juste ? x.ex.motifs : [], loc?.motifs ?? [], t);
            }
            await enregistrerSession({ module: 'planches', mode: r.cible, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          })();
          const record = b.justes === b.total ? proposerRecord(cleRecord, b.dureeMs) : Promise.resolve(false);
          const info = h('p', {}, `Réussite ${formaterPourcent(b.justes, b.total)} · temps ${formaterDuree(b.dureeMs)}`);
          record.then((oui) => { if (oui) info.append(' · nouveau record personnel !'); });
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`), info,
            h('p', { class: 'discret' }, 'Sur une colonne fausse, « Expliquer » montre chaque ligne avec ses sous-totaux.'),
            h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle planche'));
        },
      });
    }

    // Sélection de plusieurs gestes sur la carte de maîtrise, visible avec l'option « Choisir sur la carte ».
    const selCible = [...el.querySelectorAll('.reglages select')].find((x) => x.querySelector('option[value="choix"]'));
    const resume = h('p', { class: 'discret' });
    const majResume = () => { resume.textContent = reglages.selection.size ? `Choisis : ${[...reglages.selection].map(nomMotif).join(' · ')}` : 'Cliquez les gestes à travailler ensemble (ex. +4 et −4). Les gestes directs sont toujours permis.'; };
    const zoneChoix = h('div', { class: 'carte zone-choix' }, resume, carteMaitrise({ selection: reglages.selection, surSelection: majResume, sansDirects: true }));
    majResume();
    zone.before(zoneChoix);
    const majChoix = () => { zoneChoix.style.display = reglages.cible === 'choix' ? '' : 'none'; };
    selCible.addEventListener('change', majChoix);
    majChoix();
    if (params.auto) lancer();
    return () => feuille?.detruire();
  },
};
