/**
 * Drills : 123456789 et ses variantes progressives, même nombre répété, suite des entiers.
 * Tout se fait sur son soroban ; seul le chronomètre compte (voir ui/drill.js).
 */

import { catalogueDrills, drillRepetition } from '../core/drills.js';
import { enregistrerSession, proposerRecord, progression } from '../core/progression.js';
import { creerDrill } from '../ui/drill.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { serie81, serieTable, produitLent, cleProduit } from '../core/tables.js';
import { noterProduit, statsTables } from '../core/progression.js';
import { h, formaterDuree, remplir } from '../ui/dom.js';

export default {
  id: 'drills',
  titre: 'Drills',
  monter(el, app, params = {}) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); remplir(el); nettoyer = f() ?? null; };
    const record = (id) => progression().records[`drill-${id}`] ?? null;

    function catalogue() {
      const drills = catalogueDrills();
      const groupes = [...new Set(drills.map((d) => d.groupe))];
      el.append(h('h1', {}, 'Drills'),
        h('p', { class: 'discret' }, 'Des suites classiques à faire sur votre soroban, chronométrées. Le résultat attendu n\'apparaît qu\'à la fin, pour vérifier. Commencez par les variantes courtes.'));
      // Tables de multiplication (九九)
      const choixTable = h('select', {}, [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19].map((n) => h('option', { value: n }, n < 10 ? `table de ${n}` : `table de ${n} (diviseur)`)));
      choixTable.value = '7';
      const rec81 = progression().records['tables-81'];
      el.append(h('h2', {}, 'Tables de multiplication (九九)'),
        h('p', { class: 'discret' }, 'Réponse à taper le plus vite possible. La vitesse des produits fait celle des multiplications et des divisions. Chaque erreur coûte 3 secondes dans le défi des 81.'),
        h('div', { class: 'ligne' },
          h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables('81')) }, `Les 81 produits${rec81 ? ` (record ${formaterDuree(rec81.dureeMs)})` : ''}`),
          h('button', { class: 'btn', onclick: () => changer(() => ecranTables('lents')) }, 'Mes 20 produits les plus lents'),
          choixTable, h('button', { class: 'btn', onclick: () => changer(() => ecranTables(Number(choixTable.value))) }, 'Commencer cette table')));
      const choixN = h('select', {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 333, 777, 999].map((n) => h('option', { value: n }, n)));
      choixN.value = '7';
      const choixFois = h('select', {}, [10, 20, 30].map((n) => h('option', { value: n }, `${n} fois`)));
      const ar = h('input', { type: 'checkbox', checked: true });
      el.append(h('h2', {}, 'Même nombre répété'),
        h('p', { class: 'discret' }, 'Ajouter le même nombre en boucle fait passer chaque tige par tous les cas : le meilleur exercice pour ancrer les amis d\'un chiffre.'),
        h('div', { class: 'ligne' }, 'Ajouter', choixN, choixFois, h('label', {}, ar, ' puis revenir à 0'),
          h('button', { class: 'btn principal', onclick: () => changer(() => ecran(drillRepetition(Number(choixN.value), Number(choixFois.value), ar.checked))) }, 'Commencer')));
      for (const g of groupes.filter((x) => x !== 'Même nombre répété')) {
        el.append(h('h2', {}, g), h('div', { class: 'liste-paliers' }, drills.filter((d) => d.groupe === g).map((d) => h('button', {
          class: 'ligne-palier', onclick: () => changer(() => ecran(d)),
        }, h('span', { class: 'icone' }, record(d.id) ? '✓' : '○'), h('span', { class: 'titre' }, d.titre),
        h('span', { class: 'statut' }, `${d.operations.length} opérations${record(d.id) ? ` · record ${formaterDuree(record(d.id).dureeMs)}` : ''}`)))));
      }
    }

    /** Écran d'un drill ; `retour` permet de revenir ailleurs (ex. séance du jour). */
    function ecran(d) {
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'),
        h('h1', {}, d.titre), h('p', {}, d.description));
      const drill = creerDrill(el, d, {
        record: record(d.id),
        surFin: async ({ juste, dureeMs }) => {
          await enregistrerSession({ module: 'drills', mode: d.id, total: 1, justes: juste ? 1 : 0, dureeMs });
          const nouveau = juste && await proposerRecord(`drill-${d.id}`, dureeMs);
          return h('div', { class: 'ligne', style: 'margin-top:8px' },
            nouveau ? h('strong', {}, 'Nouveau record personnel ! ') : null,
            h('button', { class: 'btn principal', onclick: () => changer(() => ecran(d)) }, 'Recommencer'),
            h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'));
        },
      });
      return () => drill.detruire();
    }

    /** Série de produits de la table : 81, plus lents (20), ou table d'un nombre. */
    function ecranTables(mode) {
      const titre = mode === '81' ? 'Les 81 produits' : mode === 'lents' ? 'Mes produits les plus lents' : `Table de ${mode}`;
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'), h('h1', {}, titre));
      const liste = mode === '81' ? serie81() : typeof mode === 'number' ? serieTable(mode) : null;
      let precedent = null;
      const serie = creerSerie(el, {
        generer: () => {
          const ex = liste ? liste.shift() : produitLent(statsTables(), precedent);
          precedent = cleProduit(ex.a, ex.b);
          return ex;
        },
        nombre: liste ? liste.length : 20,
        chrono: true,
        defi: true,
        surExercice: (res, ex) => (ex.b < 10 && ex.a < 10 ? noterProduit(cleProduit(ex.a, ex.b), res.juste, res.dureeMs / 1000) : null),
        surFin: async (b) => {
          serie.detruire();
          const score = b.dureeMs + (b.total - b.justes) * 3000;
          await enregistrerSession({ module: 'drills', mode: `tables-${mode}`, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const nouveau = mode === '81' && await proposerRecord('tables-81', score);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps ${formaterDuree(b.dureeMs)}${mode === '81' ? ` · score ${formaterDuree(score)}${nouveau ? ' · nouveau record !' : ''}` : ` · ${formaterDuree(b.dureeMs / b.total)} par produit`}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables(mode)) }, 'Recommencer'), h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
      return () => serie.detruire();
    }

    const direct = params.drill ? catalogueDrills().find((d) => d.id === params.drill) : null;
    changer(params.tables ? () => ecranTables(params.tables) : direct ? () => ecran(direct) : catalogue);
    return () => nettoyer?.();
  },
};
