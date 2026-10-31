/**
 * Planches d'entraînement : colonnes de nombres à 1, 2 ou 3 chiffres, sur 5, 8 ou 10 lignes,
 * mêlant additions et soustractions, avec la possibilité de cibler un motif précis
 * (ex. « −7 grand ami ») qui apparaît alors aussi souvent que possible.
 *
 * Deux modes : gestes vérifiés (chaque mouvement contrôlé) ou réponse seule (calcul libre,
 * vérification du résultat final, comme dans un examen).
 */

import { genererPlanche, tigesPour } from '../core/generateur.js';
import { TOUS_LES_MOTIFS, famille, nomMotif, analyserMotif } from '../core/motifs.js';
import { enregistrerSession, proposerRecord, poidsAdaptatifs, motifsEnDifficulte } from '../core/progression.js';
import { creerSeance } from '../ui/seance.js';
import { h, formaterDuree } from '../ui/dom.js';

const reglages = { chiffres: 1, lignes: 5, cible: 'tout', verifier: true, nombre: 3 };

/** Choix de cible : familles, points faibles, puis chaque motif. */
function cibles(valeur) {
  if (valeur === 'tout') return null;
  if (valeur === 'faibles') {
    const f = motifsEnDifficulte().map((m) => m.cle);
    return f.length ? f : null;
  }
  if (valeur.startsWith('famille:')) return famille(valeur.slice(8));
  return [valeur];
}

export default {
  id: 'planches',
  titre: 'Planches',
  monter(el) {
    let seance = null;
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
      h('p', { class: 'discret' }, 'Une colonne de nombres à calculer d\'affilée, comme sur une feuille d\'exercices. Choisissez un motif pour travailler un point précis.'),
      h('div', { class: 'reglages' },
        select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres']], Number),
        select('lignes', [[5, '5 lignes'], [8, '8 lignes'], [10, '10 lignes']], Number),
        select('cible', [
          ['tout', 'Tout mélangé'],
          ['faibles', 'Mes points faibles'],
          ['Familles', [['famille:petit', 'Tous les petits amis'], ['famille:grand', 'Tous les grands amis'], ['famille:mixte', 'Toutes les combinaisons'], ['famille:cascade', 'Retenues/emprunts en cascade']]],
          ['Petits amis', motifsPar('petit')],
          ['Grands amis', motifsPar('grand')],
          ['Combinaisons', motifsPar('mixte')],
        ]),
        select('nombre', [[1, '1 planche'], [3, '3 planches'], [5, '5 planches']], Number),
        select('verifier', [['true', 'Gestes vérifiés'], ['false', 'Réponse seule']], (v) => v === 'true'),
        h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer')),
      zone);

    function lancer() {
      seance?.detruire();
      zone.replaceChildren();
      const r = { ...reglages };
      const cleRecord = `planche-${r.chiffres}ch-${r.lignes}l-${r.cible}-${r.nombre}`;
      seance = creerSeance(zone, {
        nbTiges: tigesPour(r.chiffres) + 1,
        colonne: true,
        verifierGestes: r.verifier,
        nombre: r.nombre,
        chrono: true,
        pauseSiJuste: false,
        generer: () => {
          const p = genererPlanche({ chiffres: r.chiffres, lignes: r.lignes, cibles: cibles(r.cible), poids: poidsAdaptatifs() });
          // La première ligne est « posée » : c'est une addition à partir de zéro.
          return { depart: 0, termes: p.lignes, resultat: p.resultat, motifs: p.motifs };
        },
        surFin: async (b) => {
          seance.detruire();
          seance = null;
          await enregistrerSession({ module: 'planches', mode: r.verifier ? 'gestes' : 'reponse', reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const record = b.justes === b.total && await proposerRecord(cleRecord, b.dureeMs);
          zone.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total} planche${b.total > 1 ? 's' : ''} juste${b.justes > 1 ? 's' : ''}`),
            h('p', {}, `Temps total ${formaterDuree(b.dureeMs)}${record ? ' · nouveau record personnel !' : ''}`),
            h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle série')));
        },
      });
    }

    return () => seance?.detruire();
  },
};
