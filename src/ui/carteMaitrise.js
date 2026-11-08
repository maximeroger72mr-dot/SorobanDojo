/**
 * Carte de maîtrise des gestes : grille (opération et règle × chiffre), case colorée selon le
 * niveau d'acquisition (rampe bleue validée). Deux usages :
 *  - consultation (progression) : un clic ouvre le détail du geste ;
 *  - sélection (planches) : un clic coche / décoche le geste (plusieurs à la fois).
 */

import { TOUS_LES_MOTIFS, nomMotif } from '../core/motifs.js';
import { NIVEAUX, formaterVitesse } from '../core/maitrise.js';
import { progression, evaluerMotif } from '../core/progression.js';
import { motifsAppris, verificationVitesse } from '../core/parcours.js';
import { COULEUR_NIVEAU, ENCRE_NIVEAU, montrerBulle, cacherBulle } from './graphiques.js';

const MEDAILLE = { progres: 'bronze', debutant: 'argent', confirme: 'or', expert: 'platine' };
import { h } from './dom.js';

const LIGNES = [
  ['+', 'direct', 'Ajouter, direct'], ['+', 'petit', 'Ajouter, petit ami'], ['+', 'grand', 'Ajouter, grand ami'], ['+', 'mixte', 'Ajouter, combiné'],
  ['-', 'direct', 'Retirer, direct'], ['-', 'petit', 'Retirer, petit ami'], ['-', 'grand', 'Retirer, grand ami'], ['-', 'mixte', 'Retirer, combiné'],
];

/**
 * @param {{ surClic?: (cle) => void, selection?: Set<string>, surSelection?: (Set) => void, sansDirects?: boolean }} o
 *   selection + surSelection : mode sélection (cases cochables) ; sinon surClic (consultation).
 */
export function carteMaitrise(o = {}) {
  const d = progression();
  const appris = motifsAppris(d);
  const modeSelection = !!o.selection;
  const cellules = [];

  function style(cellule, cle) {
    const pratique = !!d.motifs[cle];
    const id = pratique ? evaluerMotif(cle).niveau.id : null;
    cellule.style.background = pratique ? COULEUR_NIVEAU[id] : '';
    cellule.style.color = pratique ? ENCRE_NIVEAU[id] : '';
    if (modeSelection) cellule.classList.toggle('choisi', o.selection.has(cle));
  }
  function clic(cle, cellule) {
    if (!modeSelection) { o.surClic?.(cle); return; }
    if (o.selection.has(cle)) o.selection.delete(cle); else o.selection.add(cle);
    style(cellule, cle);
    o.surSelection?.(o.selection);
  }
  const lignes = LIGNES.filter(([, regle]) => !(o.sansDirects && regle === 'direct'));
  // Repère « à vérifier » : vitesse incohérente (famille plus lente que la suivante), voir parcours.
  const verif = verificationVitesse(d);
  const aVerifier = (cle) => !!verif && (verif.cle === cle || (verif.cle.startsWith('famille:') && cle.endsWith(`:${verif.cle.slice(8)}`)));
  const tableau = h('table', { class: `carte-maitrise${modeSelection ? ' selection' : ''}` },
    h('tr', {}, h('th', {}), [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('th', {}, n))),
    lignes.map(([op, regle, libelle]) => h('tr', {}, h('th', { class: 'libelle' }, libelle),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
        const cle = `${op}${n}:${regle}`;
        if (!TOUS_LES_MOTIFS.includes(cle)) return h('td', { class: 'vide' });
        const ev = evaluerMotif(cle);
        const pratique = !!d.motifs[cle];
        const cellule = h('td', {
          class: `geste${pratique ? '' : ' non-pratique'}${appris.has(cle) ? '' : ' pas-vu'}${pratique && aVerifier(cle) ? ' a-verifier' : ''}`,
          tabindex: 0, role: modeSelection ? 'checkbox' : 'button',
        }, `${op === '+' ? '+' : '−'}${n}`);
        cellule.addEventListener('click', () => clic(cle, cellule));
        cellule.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clic(cle, cellule); } });
        cellule.addEventListener('pointermove', (e) => montrerBulle(e, [h('strong', {}, nomMotif(cle)), h('br'),
          pratique ? `${ev.niveau.nom} · réussite ${Math.round(ev.reussite * 100)} % · ${formaterVitesse(ev.temps)}${aVerifier(cle) ? ' · vitesse à vérifier' : ''}` : appris.has(cle) ? 'pas encore pratiqué' : 'leçon pas encore validée']));
        cellule.addEventListener('pointerleave', cacherBulle);
        style(cellule, cle);
        cellules.push(cellule);
        return cellule;
      }))));
  const legende = h('div', { class: 'legende' },
    h('span', { class: 'pastille-legende non-pratique' }), 'pas pratiqué',
    NIVEAUX.map((n) => [h('span', { class: 'pastille-legende', style: `background:${COULEUR_NIVEAU[n.id]}` }), `${n.nom}${MEDAILLE[n.id] ? ` (${MEDAILLE[n.id]})` : ''}`]),
    modeSelection ? [h('span', { class: 'pastille-legende choisi-legende' }), 'choisi'] : null);
  return h('div', {}, tableau, legende);
}
