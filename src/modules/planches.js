/**
 * Planches : feuilles de colonnes à calculer sur son soroban (imprimables).
 *
 * Réglages : 1, 2 ou 3 chiffres ; 5, 8 ou 10 lignes ; nombre de colonnes ; et surtout la CIBLE.
 * Avec un ami choisi, les colonnes ne contiennent QUE cet ami et des gestes directs, et cet ami
 * revient aussi souvent que possible : c'est la répétition du mouvement. « Tout ce que j'ai appris »
 * se limite aux gestes des leçons validées.
 */

import { genererColonne } from '../core/generateur.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { TOUS_LES_MOTIFS, famille, nomMotif, analyserMotif } from '../core/motifs.js';
import { enregistrerSession, proposerRecord, poidsAdaptatifs, motifsEnDifficulte, noterGestes, etatPalier } from '../core/progression.js';
import { tempsParUnite } from '../core/maitrise.js';
import { localiserErreur } from '../core/diagnostic.js';
import { creerFeuille } from '../ui/feuille.js';
import { h, formaterDuree, formaterPourcent } from '../ui/dom.js';

const reglages = { chiffres: 2, lignes: 5, cible: 'appris', colonnes: 10 };
const DIRECT = famille('direct');

/** Motifs des leçons validées (plus les gestes directs). */
export function motifsAppris() {
  const s = new Set(DIRECT);
  for (const sp of SOUS_PALIERS) if (sp.type === 'addsub' && etatPalier(sp.id).valide) sp.cibles.forEach((c) => s.add(c));
  return s;
}

/** Contraintes de génération pour une valeur de cible : { autorises, cibles, libelle }. */
function contraintes(valeur) {
  if (valeur === 'tout') return { autorises: null, cibles: TOUS_LES_MOTIFS.filter((c) => !c.endsWith(':direct')), libelle: 'Tout mélangé' };
  if (valeur === 'appris') {
    const appris = motifsAppris();
    const amis = [...appris].filter((c) => !c.endsWith(':direct'));
    return { autorises: appris, cibles: amis.length ? amis : DIRECT, libelle: 'Tout ce que j\'ai appris' };
  }
  let cibles;
  let libelle;
  if (valeur === 'faibles') {
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

export default {
  id: 'planches',
  titre: 'Planches',
  monter(el) {
    let feuille = null;
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
        select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres']], Number),
        select('lignes', [[5, '5 lignes'], [8, '8 lignes'], [10, '10 lignes']], Number),
        select('colonnes', [[5, '5 colonnes'], [10, '10 colonnes'], [20, '20 colonnes']], Number),
        select('cible', [
          ['appris', 'Tout ce que j\'ai appris'],
          ['faibles', 'Mes points faibles'],
          ['tout', 'Tout mélangé'],
          ['Familles', [['famille:petit', 'Tous les petits amis'], ['famille:grand', 'Tous les grands amis'], ['famille:mixte', 'Toutes les combinaisons'], ['famille:cascade', 'Retenues/emprunts en cascade']]],
          ['Petits amis', motifsPar('petit')],
          ['Grands amis', motifsPar('grand')],
          ['Combinaisons', motifsPar('mixte')],
        ]),
        h('button', { class: 'btn principal', onclick: () => lancer() }, 'Créer la planche')),
      zone);

    function lancer() {
      feuille?.detruire();
      zone.replaceChildren();
      const r = { ...reglages };
      const c = contraintes(r.cible);
      const problemes = Array.from({ length: r.colonnes }, () => genererColonne({
        chiffres: r.chiffres, lignes: r.lignes, autorises: c.autorises, cibles: c.cibles, poids: poidsAdaptatifs(c.cibles),
      }));
      const cleRecord = `planche-${r.chiffres}-${r.lignes}-${r.colonnes}-${r.cible}`;
      feuille = creerFeuille(zone, {
        titre: `${c.libelle} · ${r.chiffres} chiffre${r.chiffres > 1 ? 's' : ''} · ${r.lignes} lignes`,
        sections: [{ problemes }],
        surFin: (b) => {
          (async () => {
            const dureeMoyenne = b.dureeMs / b.total;
            for (const x of b.resultats) {
              // Réussite : tous les gestes de la colonne sont crédités. Erreur : seul un geste
              // prouvé par le résultat est mis en cause (jamais d'accusation au hasard).
              const loc = x.juste || x.reponse === null ? null : localiserErreur(x.ex, x.reponse);
              await noterGestes(x.juste ? x.ex.motifs : [], loc?.motifs ?? [], tempsParUnite(x.ex, dureeMoyenne));
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

    return () => feuille?.detruire();
  },
};
