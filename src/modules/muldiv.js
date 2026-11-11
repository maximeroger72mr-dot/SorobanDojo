/**
 * Multiplication et division, entraînement libre (en dehors du parcours des leçons).
 * Méthodes japonaises standard : 両落とし pour la multiplication, 片落とし pour la division.
 */

import { genererMultiplication, genererDivision, genererMultiplicationDecimale, genererDivisionDecimale } from '../core/multiplication.js';
import { enregistrerSession, traiterErreurOperation } from '../core/progression.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { creerFeuille } from '../ui/feuille.js';
import { ouvrirExplication } from '../ui/explication.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { type: 'mul', x: 2, y: 1, nombre: 10, mode: 'une', variante: 'simple' };

export default {
  id: 'muldiv',
  titre: 'Multiplication et division',
  monter(el, app, params = {}) {
    let courant = null;
    // Arrivée depuis une proposition (« zéro oublié qui se répète ») : planche de zéros, lancée d'office.
    if (params.zeros) Object.assign(reglages, { variante: 'zeros', x: Math.max(3, reglages.x), y: reglages.type === 'mul' ? reglages.y : Math.max(3, reglages.y) });
    if (params.type) reglages.type = params.type;
    const zone = h('div', {});
    const etiquettes = h('span', {});
    const selX = h('select', { onchange: (e) => { reglages.x = Number(e.target.value); } });
    const selY = h('select', { onchange: (e) => { reglages.y = Number(e.target.value); } });
    const options = (sel, max, val) => {
      remplir(sel, ...Array.from({ length: max }, (_, i) => h('option', { value: i + 1 }, `${i + 1} chiffre${i ? 's' : ''}`)));
      sel.value = String(Math.min(val, max));
    };
    const majLibelles = () => {
      const mul = reglages.type === 'mul';
      remplir(etiquettes, mul ? 'Multiplicande' : 'Diviseur', ' ', selX, ' ', mul ? 'Multiplicateur' : 'Quotient', ' ', selY);
      options(selX, mul ? 6 : 4, reglages.x);
      options(selY, mul ? 4 : 5, reglages.y);
    };
    const typeSel = h('select', { onchange: (e) => { reglages.type = e.target.value; majLibelles(); } },
      h('option', { value: 'mul' }, 'Multiplication (両落とし)'), h('option', { value: 'div' }, 'Division (片落とし)'));
    typeSel.value = reglages.type;
    const modeSel = h('select', { onchange: (e) => { reglages.mode = e.target.value; } },
      h('option', { value: 'une' }, 'Une par une'), h('option', { value: 'feuille' }, 'Feuille (imprimable)'));
    modeSel.value = reglages.mode;
    const nbSel = h('select', { onchange: (e) => { reglages.nombre = Number(e.target.value); } }, [10, 20].map((n) => h('option', { value: n }, `${n} calculs`)));
    nbSel.value = String(reglages.nombre);
    const varSel = h('select', { title: 'Nombres entiers simples, avec des zéros à l\'intérieur, ou décimaux à arrondir comme à l\'examen', onchange: (e) => { reglages.variante = e.target.value; } },
      h('option', { value: 'simple' }, 'Entiers'), h('option', { value: 'zeros' }, 'Avec des zéros'),
      h('option', { value: 'millieme' }, 'Arrondi au millième'), h('option', { value: 'unite' }, 'Arrondi à l\'unité'), h('option', { value: 'examen' }, 'Mélange d\'examen'));
    varSel.value = reglages.variante;
    majLibelles();

    /** Un calcul, selon la variante : entier, avec zéros, arrondi, ou le mélange des trois. */
    const generer = () => {
      const { type, x, y } = reglages;
      let v = reglages.variante;
      if (v === 'examen') v = ['simple', 'zeros', 'millieme', 'unite'][Math.floor(Math.random() * 4)];
      // Un zéro intérieur demande au moins 3 chiffres (premier facteur, ou quotient).
      const zeros = v === 'zeros';
      if (v === 'millieme' || v === 'unite') {
        const d = v === 'millieme' ? 3 : 0;
        return type === 'mul' ? genererMultiplicationDecimale(Math.max(2, x), Math.max(2, y), d) : genererDivisionDecimale(Math.max(2, x), Math.max(2, y), d);
      }
      return type === 'mul' ? genererMultiplication(zeros ? Math.max(3, x) : x, y, zeros) : genererDivision(x, zeros ? Math.max(3, y) : y, zeros);
    };

    el.append(h('h1', {}, 'Multiplication et division'),
      h('details', { class: 'carte' }, h('summary', {}, 'Rappel des méthodes'),
        h('ul', {},
          h('li', {}, h('strong', {}, 'Multiplication 両落とし : '), 'aucun facteur n\'est posé. On pose les produits de table sur deux tiges chacun (6 = « 06 »), en commençant par le chiffre de gauche du multiplicande multiplié par chaque chiffre du multiplicateur. Premier produit : sa dizaine sur la (m+n)-ième tige depuis les unités ; chaque produit suivant une tige plus à droite.'),
          h('li', {}, h('strong', {}, 'Division 片落とし : '), 'seul le dividende est posé. Début du dividende ≥ diviseur : chiffre du quotient deux tiges à gauche ; sinon juste à gauche. On retire ensuite quotient × chaque chiffre du diviseur, sur deux tiges, juste à droite du quotient. Unité du quotient : (chiffres du diviseur + 1) tiges à gauche de l\'unité du dividende.'))),
      h('div', { class: 'reglages' }, typeSel, etiquettes, varSel, nbSel, modeSel,
        h('button', { class: 'btn', onclick: () => ouvrirExplication(generer()) }, 'Voir un exemple'),
        h('button', { class: 'btn principal', onclick: () => lancer() }, 'Commencer')),
      zone);

    function lancer() {
      courant?.detruire();
      remplir(zone);
      const r = { ...reglages };
      if (r.mode === 'feuille') {
        courant = creerFeuille(zone, {
          titre: `${r.type === 'mul' ? 'Multiplications' : 'Divisions'}`,
          sections: [{ problemes: Array.from({ length: r.nombre }, generer) }],
          surFin: (b) => {
            enregistrerSession({ module: 'muldiv', mode: r.type, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
            return h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
              h('p', {}, `Temps ${formaterDuree(b.dureeMs)}`), h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle feuille'));
          },
        });
        return;
      }
      courant = creerSerie(zone, {
        generer, nombre: r.nombre, chrono: true,
        surFin: async (b) => {
          courant.detruire();
          courant = null;
          await enregistrerSession({ module: 'muldiv', mode: r.type, reglages: r, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          zone.append(h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Réussite ${formaterPourcent(b.justes, b.total)} · ${formaterDuree(b.dureeMs / b.total)} par calcul`),
            h('button', { class: 'btn principal', onclick: () => lancer() }, 'Nouvelle série')), listeErreurs(b.resultats) ?? '');
        },
      });
    }

    if (params.auto) { if (params.zeros) traiterErreurOperation('zero'); lancer(); }
    return () => courant?.detruire();
  },
};
