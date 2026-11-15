/**
 * Frise du parcours (en tête d'« Apprendre ») : une case par étape du parcours soroban, remplie
 * selon les leçons validées ; l'étape en cours est marquée « vous êtes ici », et les deux
 * prochaines leçons sont annoncées. Une ligne pour la piste anzan, une pour le PROCHAIN grade
 * (jamais plus loin : un objectif trop lointain décourage).
 */

import { PALIERS } from '../core/curriculum.js';
import { h } from './dom.js';

const COURT = { p0: 'Débuter', p1: 'Directs', p2: 'Petits amis', p3: 'Grands amis +', p4: 'Grands amis −', p5: 'Combinaisons', p6: '×', p7: '÷', p8: '5e-4e kyū', pd: 'Décimaux', p9: '1er kyū', pa: 'Anzan' };

/**
 * @param {object} d  progression
 * @param {{ prochain: object|null, anzan: object|null }} o  prochaines leçons (soroban, anzan)
 */
export function frisePiste(d, { prochain, anzan, apres = [], jalon = null }) {
  const valide = (id) => !!d.paliers[id]?.valide;
  const soroban = PALIERS.filter((p) => !p.mental);
  const pa = PALIERS.find((p) => p.mental);
  const caseDe = (p) => {
    const n = p.sousPaliers.filter((sp) => valide(sp.id)).length;
    const total = p.sousPaliers.length;
    const ici = prochain && p.sousPaliers.some((sp) => sp.id === prochain.id);
    return h('div', { class: `frise-etape${n === total ? ' finie' : ''}${ici ? ' ici' : ''}`, title: `${p.titre} : ${n} / ${total} leçons` },
      h('span', { class: 'frise-jauge' }, h('span', { style: `width:${Math.round((100 * n) / total)}%` })),
      h('span', { class: 'frise-nom' }, COURT[p.id] ?? p.titre),
      ici ? h('span', { class: 'frise-ici' }, 'vous êtes ici') : null,
      // Le dernier grade obtenu et le prochain, posés sur l'étape où ils se gagnent (rien au-delà).
      jalon?.dernier?.palier === p.id ? h('span', { class: 'frise-grade obtenu', title: 'Dernier grade obtenu' }, `✓ ${jalon.dernier.court} kyū`) : null,
      jalon?.palier === p.id ? h('span', { class: 'frise-grade prochain', title: `Prochain grade : ${jalon.nom}` }, `→ ${jalon.court} kyū`) : null);
  };
  const faits = soroban.flatMap((p) => p.sousPaliers).filter((sp) => valide(sp.id)).length;
  const total = soroban.flatMap((p) => p.sousPaliers).length;
  const nA = pa ? pa.sousPaliers.filter((sp) => valide(sp.id)).length : 0;
  return h('div', { class: 'carte frise' },
    h('div', { class: 'frise-titre' }, h('strong', {}, 'Mon parcours'), h('span', { class: 'discret' }, ` · ${faits} / ${total} leçons soroban · anzan ${nA} / ${pa?.sousPaliers.length ?? 0}`)),
    h('div', { class: 'frise-ligne' }, soroban.map(caseDe)),
    h('p', { class: 'frise-suite' },
      prochain ? [h('strong', {}, 'Maintenant : '), prochain.titre] : 'Parcours soroban terminé.',
      apres.length ? [h('span', { class: 'discret' }, ' · ensuite : '), apres.map((x) => x.titre).join(', ')] : null,
      anzan ? [h('br'), h('strong', {}, 'Anzan : '), anzan.titre] : null,
      jalon ? [h('br'), h('strong', {}, 'Prochain grade : '), jalon.nom,
        jalon.restantes ? ` · encore ${jalon.restantes} leçon${jalon.restantes > 1 ? 's' : ''}${jalon.jours ? `, soit environ ${jalon.jours} jour${jalon.jours > 1 ? 's' : ''} à votre rythme` : ''}` : ' · ses leçons sont validées : l\'examen blanc est ouvert'] : null));
}
