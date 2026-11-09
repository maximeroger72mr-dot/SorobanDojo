/**
 * Question de doigté (oui / non) en fin de mini-test ou de révision. Ne bloque rien : un « non »
 * montre le geste (démonstration animée pour les gestes d'addition et de soustraction).
 */

import { questionDe } from '../core/doigte.js';
import { noterDoigte } from '../core/progression.js';
import { gesteMotif, exempleMotif, nomMotif } from '../core/motifs.js';
import { ouvrirDemo, ouvrirDialogue } from './panneauDemo.js';
import { h, remplir } from './dom.js';

export function questionDoigte(app, sp) {
  const q = questionDe(sp);
  if (!q) return null;
  const reponse = h('div', {});
  const montrer = () => {
    const cle = sp.type === 'addsub' ? (sp.cibles.find((c) => !c.endsWith(':direct')) ?? sp.cibles[0]) : null;
    if (cle) ouvrirDemo({ titre: nomMotif(cle), texte: gesteMotif(cle), demo: exempleMotif(cle) });
    else ouvrirDialogue('Le bon geste', q.rappel ?? '', () => null);
  };
  const repondre = async (oui) => {
    await noterDoigte(sp.id, q.cle, oui);
    remplir(reponse, oui
      ? h('p', { class: 'retour ok' }, 'Parfait : c\'est ce geste qui deviendra automatique.')
      : h('div', {}, h('p', {}, 'Merci pour votre honnêteté : c\'est maintenant qu\'une habitude se corrige. ', q.rappel ?? ''),
        h('button', { class: 'btn principal', onclick: montrer }, 'Voir le geste')));
  };
  remplir(reponse, h('div', { class: 'ligne' },
    h('button', { class: 'btn', onclick: () => repondre(true) }, 'Oui'),
    h('button', { class: 'btn', onclick: () => repondre(false) }, 'Non, pas toujours')));
  return h('div', { class: 'carte doigte' }, h('strong', {}, 'Votre doigté. '), q.texte,
    h('p', { class: 'discret', style: 'margin:4px 0 8px' }, 'L\'application vérifie vos résultats, pas vos doigts : vous seul pouvez le dire. Rien n\'est bloqué par votre réponse.'), reponse);
}
