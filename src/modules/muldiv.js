/**
 * Multiplication et division, entraînement libre (en dehors du parcours des leçons).
 * Méthodes japonaises standard : 両落とし pour la multiplication, 片落とし pour la division.
 */

import { genererMultiplication, genererDivision, genererMultiplicationDecimale, genererDivisionDecimale, genererDivisionReste } from '../core/multiplication.js';
import { enregistrerSession, traiterErreurOperation, progression } from '../core/progression.js';
import { gradeOperation, reserveKyu } from '../core/formatKyu.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { creerFeuille } from '../ui/feuille.js';
import { ouvrirExplication } from '../ui/explication.js';
import { h, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';
import { tempsParUnite, mediane, SURCOUT_FEUILLE_S } from '../core/maitrise.js';

/** Temps médian par produit des réponses justes (mesure du bloc de vitesse, 0.38). */
function tempsMedian(b, feuille) {
  const t = b.resultats.filter((r) => r.juste && r.ex && !r.autoEvalue).map((r) => (feuille ? tempsParUnite(r.ex, b.dureeMs / b.total, SURCOUT_FEUILLE_S) : tempsParUnite(r.ex, r.dureeMs)));
  return t.length >= 3 ? Math.round(mediane(t) * 100) / 100 : undefined;
}

const reglages = { type: 'mul', x: 2, y: 1, nombre: 10, mode: 'une', partZeros: 0, partArrondis: 0, partRestes: 0, rang: 'millieme', format: 'kyu' };

export default {
  id: 'muldiv',
  titre: 'Multiplication et division',
  monter(el, app, params = {}) {
    let courant = null;
    // Arrivée depuis une proposition (« zéro oublié qui se répète ») : planche de zéros, lancée d'office.
    if (params.zeros) Object.assign(reglages, { partZeros: 1, partArrondis: 0, format: 'libre' });
    if (params.type) reglages.type = params.type;
    // Bloc de vitesse de la séance (hakari) : feuille au format du kyū, longueur donnée.
    for (const k of ['format', 'mode', 'nombre']) if (params[k] != null) reglages[k] = params[k];
    const proposition = params.proposition ?? null;
    const zone = h('div', {});
    const etiquettes = h('span', {});
    const selX = h('select', { onchange: (e) => { reglages.x = Number(e.target.value); } });
    const selY = h('select', { onchange: (e) => { reglages.y = Number(e.target.value); } });
    const options = (sel, max, val) => {
      remplir(sel, ...Array.from({ length: max }, (_, i) => h('option', { value: i + 1 }, `${i + 1} chiffre${i ? 's' : ''}`)));
      sel.value = String(Math.min(val, max));
    };
    let restesSel = null; // créé plus bas, avec les autres fréquences
    let zerosSel = null; let arrondisSel = null; let rangSel = null; let formatSel = null;
    const majLibelles = () => {
      const mul = reglages.type === 'mul';
      const kyu = reglages.format === 'kyu' && !!gradeOperation(progression(), reglages.type);
      for (const x of [etiquettes, zerosSel, arrondisSel, rangSel]) if (x) x.style.display = kyu ? 'none' : '';
      if (formatSel) formatSel.options[0].textContent = gradeOperation(progression(), reglages.type) ? `Au format du ${gradeOperation(progression(), reglages.type).nom}` : 'Au format du kyū visé';
      if (restesSel) restesSel.style.display = !mul && reglages.mode === 'feuille' ? '' : 'none';
      remplir(etiquettes, mul ? 'Multiplicande' : 'Diviseur', ' ', selX, ' ', mul ? 'Multiplicateur' : 'Quotient', ' ', selY);
      // 0.38 : jusqu'à 7 × 5 et ÷ 6 chiffres, quotient 6 (avant : 6 × 4, ÷ 4, quotient 5).
      options(selX, mul ? 7 : 6, reglages.x);
      options(selY, mul ? 5 : 6, reglages.y);
    };
    const typeSel = h('select', { onchange: (e) => { reglages.type = e.target.value; majLibelles(); } },
      h('option', { value: 'mul' }, 'Multiplication (両落とし)'), h('option', { value: 'div' }, 'Division (片落とし)'));
    typeSel.value = reglages.type;
    const modeSel = h('select', { onchange: (e) => { reglages.mode = e.target.value; majLibelles(); } },
      h('option', { value: 'une' }, 'Une par une'), h('option', { value: 'feuille' }, 'Feuille (imprimable)'));
    modeSel.value = reglages.mode;
    formatSel = h('select', { title: 'Au format du kyū : les mêmes découpages, zéros et arrondis que le sujet d\'examen, dans les mêmes proportions.', onchange: (e) => { reglages.format = e.target.value; majLibelles(); } },
      h('option', { value: 'kyu' }, 'Au format du kyū visé'), h('option', { value: 'libre' }, 'Chiffres au choix'));
    formatSel.value = reglages.format;
    const nbSel = h('select', { onchange: (e) => { reglages.nombre = Number(e.target.value); } }, [10, 20].map((n) => h('option', { value: n }, `${n} calculs`)));
    nbSel.value = String(reglages.nombre);
    // Fréquences réglables : part des calculs avec un zéro intérieur, part des calculs à arrondir.
    const PARTS = [[0, 'jamais'], [0.25, '1 sur 4'], [0.5, '1 sur 2'], [1, 'toujours']];
    const choix = (cle, prefixe, options, titre) => {
      const x = h('select', { title: titre, onchange: (e) => { reglages[cle] = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value); } }, options.map(([v, t]) => h('option', { value: v }, `${prefixe}${t}`)));
      x.value = String(reglages[cle]);
      return x;
    };
    zerosSel = choix('partZeros', 'zéros : ', PARTS, 'Part des calculs qui contiennent un zéro à l\'intérieur (406 × 7, quotient 304)');
    arrondisSel = choix('partArrondis', 'arrondis : ', PARTS, 'Part des calculs en décimaux, à arrondir comme à l\'examen');
    rangSel = choix('rang', 'arrondi ', [['millieme', 'au millième'], ['unite', 'à l\'unité'], ['deux', 'au millième ou à l\'unité']], 'Rang de l\'arrondi demandé');
    restesSel = choix('partRestes', 'restes : ', PARTS, 'Part des divisions qui ne tombent pas juste : on répond le quotient ET le reste (feuille seulement)');
    majLibelles();

    /** Un calcul : au format du kyū (tiré d'un sujet), ou entier / zéro intérieur / à arrondir selon les fréquences choisies. */
    let reserve = null;
    const generer = () => {
      const { type, x, y } = reglages;
      const g = reglages.format === 'kyu' ? gradeOperation(progression(), type) : null;
      if (g) {
        if (!reserve || reserve.cle !== `${g.id}-${type}`) reserve = { cle: `${g.id}-${type}`, tirer: reserveKyu(g, type) };
        return reserve.tirer();
      }
      // Divisions avec reste : en feuille seulement (deux cases : quotient et reste).
      if (type === 'div' && reglages.mode === 'feuille' && Math.random() < reglages.partRestes) return genererDivisionReste(x, y);
      if (Math.random() < reglages.partArrondis) {
        const d = reglages.rang === 'unite' || (reglages.rang === 'deux' && Math.random() < 0.5) ? 0 : 3;
        return type === 'mul' ? genererMultiplicationDecimale(Math.max(2, x), Math.max(2, y), d) : genererDivisionDecimale(Math.max(2, x), Math.max(2, y), d);
      }
      // Un zéro intérieur demande au moins 3 chiffres (premier facteur, ou quotient).
      const zeros = Math.random() < reglages.partZeros;
      return type === 'mul' ? genererMultiplication(zeros ? Math.max(3, x) : x, y, zeros) : genererDivision(x, zeros ? Math.max(3, y) : y, zeros);
    };

    el.append(h('h1', {}, 'Multiplication et division'),
      h('details', { class: 'carte' }, h('summary', {}, 'Rappel des méthodes'),
        h('ul', {},
          h('li', {}, h('strong', {}, 'Multiplication 両落とし : '), 'aucun facteur n\'est posé. On pose les produits de table sur deux tiges chacun (6 = « 06 »), en commençant par le chiffre de gauche du multiplicande multiplié par chaque chiffre du multiplicateur. Premier produit : sa dizaine sur la (m+n)-ième tige depuis les unités ; chaque produit suivant une tige plus à droite.'),
          h('li', {}, h('strong', {}, 'Division 片落とし : '), 'seul le dividende est posé. Début du dividende ≥ diviseur : chiffre du quotient deux tiges à gauche ; sinon juste à gauche. On retire ensuite quotient × chaque chiffre du diviseur, sur deux tiges, juste à droite du quotient. Unité du quotient : (chiffres du diviseur + 1) tiges à gauche de l\'unité du dividende.'))),
      h('div', { class: 'reglages' }, typeSel, formatSel, etiquettes, zerosSel, arrondisSel, rangSel, restesSel, nbSel, modeSel,
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
            enregistrerSession({ module: 'muldiv', mode: r.type, reglages: { ...r, proposition }, total: b.total, justes: b.justes, dureeMs: b.dureeMs, t: tempsMedian(b, true) });
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
          await enregistrerSession({ module: 'muldiv', mode: r.type, reglages: { ...r, proposition }, total: b.total, justes: b.justes, dureeMs: b.dureeMs, t: tempsMedian(b, false) });
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
