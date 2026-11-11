/**
 * Planches : feuilles de colonnes à calculer sur son soroban (imprimables).
 *
 * Réglages : 1, 2 ou 3 chiffres ; 5, 8 ou 10 lignes ; nombre de colonnes ; et surtout la CIBLE.
 * Avec un ami choisi, les colonnes ne contiennent QUE cet ami et des gestes directs, et cet ami
 * revient aussi souvent que possible : c'est la répétition du mouvement. « Tout ce que j'ai appris »
 * se limite aux gestes des leçons validées.
 */

import { ErreurGeneration } from '../core/generateur.js';
import { libellesModes, gesteTravaillable } from '../core/colonneGeste.js';
import { genererPlanche, genererPlancheGeste, genererPlancheSpeciale, GENRES_PLANCHE } from '../core/planche.js';
import { graineAleatoire } from '../core/hasard.js';
import { TOUS_LES_MOTIFS, famille, nomMotif, analyserMotif } from '../core/motifs.js';
import { enregistrerSession, proposerRecord, poidsAdaptatifs, motifsEnDifficulte, noterGestes, progression, memoriserPlanche, plancheMemorisee } from '../core/progression.js';
import { motifsAppris as motifsApprisDe, gestesLents, chiffresAppris, ancrageDuJour } from '../core/parcours.js';
import { sousPalier } from '../core/curriculum.js';
import { tempsParUnite, SURCOUT_FEUILLE_S, NIVEAUX, formaterCadence } from '../core/maitrise.js';
import { localiserErreur } from '../core/diagnostic.js';
import { creerFeuille } from '../ui/feuille.js';
import { carteMaitrise } from '../ui/carteMaitrise.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { genre: 'gestes', chiffres: 2, lignes: 5, cible: 'appris', colonnes: 10, mode: 'seul', selection: new Set() };
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
    ['ancrage', 'Ancrage : mes dernières leçons et mes gestes faibles'],
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
  if (valeur === 'ancrage') {
    // Ancrage : les gestes des 2 ou 3 dernières leçons, mélangés aux gestes faibles du moment.
    const a = ancrageDuJour(progression());
    if (!a) return contraintes('appris');
    const appris = motifsAppris();
    const faibles = motifsEnDifficulte().map((m) => m.cle).filter((c) => appris.has(c));
    return { autorises: appris, cibles: [...new Set([...a.cibles, ...faibles])], favoris: faibles, libelle: `Ancrage : ${a.lecons.map((sp) => `« ${sp.titre} »`).join(', ')}${faibles.length ? ', avec vos gestes faibles' : ''}` };
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

/**
 * Ce que la planche fait travailler, avant de commencer : son code, sa charge, les gestes visés
 * les plus présents, et les replis (ce que les réglages n'ont pas permis).
 */
function resumePlanche(planche, rejeu) {
  if (!planche.bilan) {
    return h('div', { class: 'carte resume-planche' }, h('strong', {}, `Planche ${planche.code}`), rejeu ? ' (rejouée) ' : ' ',
      h('span', { class: 'discret' }, 'Notez ce code pour la rejouer telle quelle, ou pour saisir plus tard les réponses d\'une planche imprimée.'));
  }
  const b = planche.bilan;
  const vus = Object.entries(b.occurrences).sort((x, y) => y[1] - x[1]);
  const gestes = vus.slice(0, 4).map(([cle, n]) => `${nomMotif(cle)} × ${n}`).join(' · ');
  const reste = vus.length > 4 ? ` · et ${vus.length - 4} autre${vus.length - 4 > 1 ? 's' : ''}` : '';
  const messages = [];
  for (const rp of b.replis ?? []) {
    if (rp.type === 'impossibles') messages.push(`Impossible avec ces réglages, donc absent de la planche : ${rp.cibles.map(nomMotif).join(', ')}.`);
    if (rp.type === 'assoupli') messages.push('Pour ce geste, les combinaisons possibles sont peu nombreuses : quelques colonnes répètent une valeur plus souvent que d\'habitude.');
    if (rp.type === 'simples') messages.push(`${rp.nombre} colonne${rp.nombre > 1 ? 's' : ''} sans piège : le geste et des gestes directs seulement.`);
    if (rp.type === 'sansFamille') messages.push('Aucun autre ami de cette famille n\'est encore appris : la planche travaille le geste seul.');
  }
  if (b.absents?.length) messages.push(`Pas trouvé de place pour : ${b.absents.map(nomMotif).join(', ')}.`);
  return h('div', { class: 'carte resume-planche' },
    h('p', {}, h('strong', {}, `Planche ${planche.code}`), rejeu ? ' (rejouée)' : '',
      h('span', { class: 'discret', title: 'La charge additionne les gestes de la planche : un geste direct pèse 0,6, un petit ami 1, un grand ami 1,1, une combinaison ou une cascade 1,4. Elle sert à comparer deux planches du même format.' }, ` · charge ${Math.round(b.coutTotal)}`)),
    gestes ? h('p', { class: 'discret' }, `Gestes travaillés : ${gestes}${reste}.`) : null,
    messages.map((m) => h('p', { class: 'retour' }, m)));
}

export default {
  id: 'planches',
  titre: 'Planches',
  monter(el, app, params = {}) {
    let feuille = null;
    if (params.cible) { reglages.cible = params.cible; reglages.genre = 'gestes'; }
    if (params.genre) reglages.genre = params.genre;
    if (params.colonnes) reglages.colonnes = params.colonnes;
    if (params.lignes) reglages.lignes = params.lignes;
    // Un geste travaillé seul (« −2 petit ami ») ou parmi sa famille (« −2 parmi les petits amis »).
    if (params.mode) reglages.mode = params.mode;
    // Planche proposée par la séance : son identifiant (pour la cocher) et son objectif.
    reglages.proposition = params.proposition ?? null;
    if (params.chiffres) reglages.chiffres = params.chiffres;
    // Par défaut, pas plus de chiffres que dans les leçons validées (on peut toujours en choisir plus).
    else if (!progression().reglages?.decouverte) reglages.chiffres = Math.min(reglages.chiffres, chiffresAppris(progression()));
    if (params.consolidation) {
      const sp = sousPalier(params.consolidation);
      Object.assign(reglages, { genre: 'gestes', cible: `consolidation:${sp.id}`, chiffres: Math.max(1, sp.chiffres), lignes: 5, colonnes: 10 });
    }
    if (params.ancrage) {
      const a = ancrageDuJour(progression());
      Object.assign(reglages, { genre: 'gestes', cible: 'ancrage', chiffres: a?.chiffres ?? 1, lignes: 5, colonnes: 10 });
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
    // Rejouer une planche par son code (affiché sur la planche, imprimé avec elle).
    const rejouerCode = () => {
      const champ = h('input', { type: 'text', maxlength: 6, size: 8, placeholder: 'Code', 'aria-label': 'Code de la planche à rejouer', autocomplete: 'off' });
      const retour = h('span', { class: 'discret' });
      const ouvrir = () => {
        const p = plancheMemorisee(champ.value);
        retour.textContent = p ? '' : ' Code inconnu : seules les 20 dernières planches sont gardées.';
        if (p) lancer(p);
      };
      champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ouvrir(); } });
      return h('span', { class: 'discret rejouer-code' }, 'ou rejouer le code ', champ, ' ', h('button', { class: 'btn', onclick: ouvrir }, 'Ouvrir'), retour);
    };
    // Pour un geste : « −2 petit ami » (seul, avec des gestes directs et un piège) ou
    // « −2 parmi les petits amis » (au milieu des autres amis de sa famille).
    const choixMode = h('select', { onchange: (e) => { reglages.mode = e.target.value; } });
    const majMode = () => {
      const ok = gesteTravaillable(reglages.cible);
      choixMode.style.display = ok ? '' : 'none';
      if (!ok) return;
      const l = libellesModes(reglages.cible);
      remplir(choixMode, h('option', { value: 'seul' }, l.seul), h('option', { value: 'famille' }, l.famille));
      choixMode.value = reglages.mode === 'famille' ? 'famille' : 'seul';
    };
    majMode();
    el.append(
      h('h1', {}, 'Planches'),
      h('p', { class: 'discret' }, 'Des colonnes à calculer sur votre soroban, puis à corriger. Choisissez un ami pour en répéter le geste : la planche ne contiendra que lui et des gestes directs. Les feuilles s\'impriment.'),
      h('div', { class: 'reglages' },
        select('genre', [['gestes', 'Additions et soustractions'], ['additions', 'Additions seules'], ...Object.entries(GENRES_PLANCHE)], String),
        select('chiffres', Array.from({ length: 10 }, (_, i) => [i + 1, `${i + 1} chiffre${i ? 's' : ''}`]), Number),
        select('lignes', [3, 5, 8, 10, 15, 20].map((n) => [n, `${n} lignes`]), Number),
        h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { reglages.zeros = e.target.checked; } }), ' zéros internes'),
        h('label', { title: 'Rappel des doigts à côté de chaque ligne : pouce, index, céleste.' },
          h('input', { type: 'checkbox', checked: !!reglages.doigte, onchange: (e) => { reglages.doigte = e.target.checked; } }), ' rappel doigté'),
        select('colonnes', [[5, '5 colonnes'], [10, '10 colonnes'], [20, '20 colonnes'], [30, '30 colonnes']], Number),
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
        choixMode,
        h('button', { class: 'btn principal', onclick: () => { reglages.proposition = null; lancer(); } }, 'Créer la planche'),
        rejouerCode()),
      zone, historiqueFeuilles());

    /**
     * Crée et affiche une planche. `rejeu` : une planche déjà créée (bouton « Rejouer », ou code
     * tapé), reprise telle quelle : mêmes colonnes, même ordre.
     */
    function lancer(rejeu = null) {
      feuille?.detruire();
      remplir(zone);
      const r = rejeu ? { ...rejeu.reglages } : { ...reglages };
      let c = rejeu ? { cibles: rejeu.cibles, libelle: rejeu.libelle } : contraintes(r.cible);
      if (r.proposition && params.objectif) zone.append(h('div', { class: 'carte objectif-planche' }, h('strong', {}, 'Objectif : '), params.objectif));
      let planche = rejeu;
      const mode = r.mode === 'famille' ? 'famille' : 'seul';
      if (!planche) {
        const graine = graineAleatoire();
        // Genres d'examen (longueurs mêlées, négatifs, décimaux…) : pas de planificateur de gestes.
        if (GENRES_PLANCHE[r.genre]) {
          try {
            planche = genererPlancheSpeciale({ genre: r.genre, chiffres: r.genre === 'melees' ? Math.max(3, r.chiffres) : r.chiffres, lignes: r.lignes, colonnes: r.colonnes }, graine);
            c = { cibles: [], libelle: GENRES_PLANCHE[r.genre] };
          } catch (e) {
            if (!(e instanceof ErreurGeneration)) throw e;
            zone.append(h('p', { class: 'retour erreur' }, 'Impossible de créer cette planche : choisissez plus de chiffres ou moins de colonnes.'));
            return;
          }
        }
        // Additions seules : seuls les gestes d'addition sont visés, aucune ligne à soustraire.
        if (!planche && r.genre === 'additions') {
          const plus = c.cibles.filter((x) => x.startsWith('+') || x === 'cascade+');
          c = { ...c, cibles: plus.length ? plus : famille('direct').filter((x) => x.startsWith('+')), libelle: `Additions seules · ${c.libelle}`, ops: ['+'] };
        }
        // Un geste : colonnes construites par rôles (le geste 2 fois, un piège, des directs…).
        if (!planche && r.genre !== 'additions' && gesteTravaillable(r.cible)) {
          planche = genererPlancheGeste({ cible: r.cible, mode, chiffres: r.chiffres, lignes: r.lignes, colonnes: r.colonnes, appris: motifsAppris() }, graine);
          if (planche) {
            planche.parRoles = true;
            c = { cibles: [r.cible], libelle: libellesModes(r.cible)[mode] };
          } else {
            zone.append(h('p', { class: 'retour' }, 'Ce geste ne permet pas de former ces colonnes avec ces réglages : planche classique.'));
          }
        }
        if (!planche) {
          const poids = poidsAdaptatifs(c.cibles);
          for (const f of c.favoris ?? []) poids[f] = (poids[f] ?? 1) * 3;
          // Création de la planche : jamais vide, jamais deux colonnes identiques. Si ces réglages ne
          // permettent pas de colonne (cascades à 1 chiffre…), repli explicite : 2 chiffres, puis
          // tous les gestes appris.
          const config = { chiffres: r.chiffres, lignes: r.lignes, colonnes: r.colonnes, autorises: c.autorises, cibles: c.cibles, poids, zeros: !!r.zeros, ops: c.ops };
          const replis = [
            [config, null],
            [{ ...config, chiffres: Math.max(2, r.chiffres) }, `Ces colonnes demandent au moins 2 chiffres : planche à ${Math.max(2, r.chiffres)} chiffres.`],
            // (additions seules : le repli reste sans soustraction, avec moins de lignes s'il le faut)
            c.ops ? [{ ...config, lignes: Math.min(3, r.lignes), chiffres: Math.max(2, r.chiffres) }, 'Avec les gestes appris, des additions seules ne tiennent pas sur autant de lignes : planche à 3 lignes.'] : [{ ...config, ...(({ autorises, cibles }) => ({ autorises, cibles }))(contraintes('appris')) }, 'Impossible de former des colonnes avec ce geste et ces réglages : planche sur tous vos gestes appris.'],
          ];
          for (const [p, message] of replis) {
            try {
              planche = genererPlanche(p, graine);
              if (message) zone.append(h('p', { class: 'retour' }, message));
              break;
            } catch (e) {
              if (!(e instanceof ErreurGeneration)) throw e;
              planche = null;
            }
          }
        }
        if (!planche) { zone.append(h('p', { class: 'retour erreur' }, 'Impossible de créer cette planche : choisissez d\'autres réglages.')); return; }
        Object.assign(planche, { reglages: r, cibles: c.cibles, libelle: c.libelle });
        memoriserPlanche(planche);
      }
      const problemes = planche.colonnes;
      if (planche.parRoles) {
        zone.append(h('p', { class: 'discret' }, mode === 'famille'
          ? 'Le geste 2 fois par colonne, au milieu d\'autres amis de sa famille, avec un piège (le même chiffre fait par un autre geste) et des gestes directs : choisissez le bon geste à chaque ligne.'
          : 'Le geste 2 fois par colonne, des gestes directs, et un piège : le même chiffre, mais en geste direct. Regardez la tige avant d\'agir.'));
      }
      zone.append(resumePlanche(planche, !!rejeu));
      const suffixe = planche.parRoles ? `-${mode}` : '';
      const genre = r.genre && r.genre !== 'gestes' ? r.genre : r.cible;
      const cleRecord = `planche-${r.chiffres}-${r.lignes}-${r.colonnes}-${genre}${suffixe}`;
      const titre = `${c.libelle} · ${r.chiffres} chiffre${r.chiffres > 1 ? 's' : ''} · ${r.lignes} lignes`;
      feuille = creerFeuille(zone, {
        doigte: !!r.doigte,
        reprises: 3, // colonnes fausses dont l'erreur est identifiée : reprise proposée, 3 au plus
        historique: { cle: `planche-${r.chiffres}-${r.lignes}-${genre}${suffixe}`, libelle: titre },
        titre: `${titre} · planche ${planche.code}`,
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
              if (x.ex.motifs) await noterGestes(x.juste ? x.ex.motifs : [], loc?.motifs ?? [], t);
            }
            await enregistrerSession({ module: 'planches', mode: planche.speciale ? `genre:${r.genre}` : r.cible, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          })();
          // Record : seulement sur une planche découverte (rejouée, on connaît déjà les colonnes).
          const record = b.justes === b.total && !rejeu ? proposerRecord(cleRecord, b.dureeMs) : Promise.resolve(false);
          const info = h('p', {}, `Réussite ${formaterPourcent(b.justes, b.total)} · temps ${formaterDuree(b.dureeMs)}`);
          record.then((oui) => { if (oui) info.append(' · nouveau record personnel !'); });
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`), info,
            h('p', { class: 'discret' }, 'Sur une colonne fausse, « Expliquer » montre chaque ligne avec ses sous-totaux. Quand l\'erreur est repérée sur une ligne précise, la colonne peut être reprise tout de suite (3 au plus par planche).'),
            h('div', { class: 'actions' },
              h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle planche'),
              h('button', { class: 'btn', title: 'Les mêmes colonnes, dans le même ordre : pour comparer deux temps sur la même planche.', onclick: () => lancer(planche) }, 'Rejouer cette planche')));
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
    selCible.addEventListener('change', majMode);
    majChoix();
    if (params.auto) lancer();
    return () => feuille?.detruire();
  },
};
