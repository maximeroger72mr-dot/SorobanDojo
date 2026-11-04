/**
 * Au quotidien : le soroban au service de la vie courante (ticket de caisse, monnaie,
 * pourcentages, factures). Même fonctionnement que les autres séries : on calcule sur son
 * soroban, on tape le résultat (en euros, avec la virgule), l'application corrige et donne
 * la méthode (de tête et au soroban). Voir core/quotidien.js.
 */

import { SORTES } from '../core/quotidien.js';
import { enregistrerSession } from '../core/progression.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { sorte: 'ticket', nombre: 10 };

const ASTUCES = [
  'Rendre la monnaie : on complète comme un commerçant, jusqu\'à l\'euro rond, puis jusqu\'au billet. C\'est le grand ami en grand.',
  '10 % : on décale la virgule d\'un rang. 5 % : la moitié de 10 %. 15 % : 10 % + 5 %. 20 % : 10 % doublé.',
  '25 % : le quart (la moitié de la moitié). 75 % : le tout moins un quart.',
  'Une remise de 30 % : on paie 70 %, donc × 0,7 directement, sans calculer la remise à part.',
  'Prix TTC avec 20 % de TVA : × 1,2. Prix HT à partir du TTC : ÷ 1,2.',
  'Ticket de caisse : au soroban, on ajoute les prix nombre par nombre, la virgule sur le point des unités : les centimes tombent toujours sur les deux mêmes tiges.',
];

export default {
  id: 'quotidien',
  titre: 'Au quotidien',
  monter(el) {
    let serie = null;
    function accueil() {
      serie?.detruire();
      serie = null;
      remplir(el);
      const choix = h('select', { onchange: (e) => { reglages.sorte = e.target.value; } }, Object.entries(SORTES).map(([k, s]) => h('option', { value: k }, s.titre)));
      choix.value = reglages.sorte;
      const nb = h('select', { onchange: (e) => { reglages.nombre = Number(e.target.value); } }, [5, 10, 20].map((n) => h('option', { value: n }, `${n} calculs`)));
      nb.value = String(reglages.nombre);
      el.append(h('h1', {}, 'Au quotidien'),
        h('p', { class: 'discret' }, 'Le soroban pour la vie de tous les jours : additionner un ticket de caisse, rendre la monnaie, calculer une remise ou une TVA, vérifier une facture. Calculez sur votre soroban, tapez le résultat en euros (avec la virgule).'),
        h('div', { class: 'reglages' }, choix, nb, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer')),
        h('div', { class: 'carte vitesse' }, h('strong', {}, 'Les méthodes'), h('ul', {}, ASTUCES.map((a) => h('li', {}, a)))));
    }
    function lancer() {
      const r = { ...reglages };
      remplir(el, h('button', { class: 'lien', onclick: () => accueil() }, '← Au quotidien'), h('h1', {}, SORTES[r.sorte].titre));
      serie = creerSerie(el, {
        generer: SORTES[r.sorte].generer,
        nombre: r.nombre,
        chrono: true,
        surFin: async (b) => {
          serie.detruire();
          serie = null;
          await enregistrerSession({ module: 'quotidien', mode: r.sorte, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Réussite ${formaterPourcent(b.justes, b.total)} · ${formaterDuree(b.dureeMs)}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancer() }, 'Encore'), h('button', { class: 'btn', onclick: () => accueil() }, 'Retour'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
    }
    accueil();
    return () => serie?.detruire();
  },
};
