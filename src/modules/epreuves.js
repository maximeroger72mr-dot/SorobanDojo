/**
 * Épreuves au format des examens officiels japonais (珠算検定), du 10e au 1er kyū.
 * Sujet complet (mitorizan, multiplication, division), compte à rebours, notation par points,
 * seuil de réussite, impression possible. Voir core/epreuves.js pour les formats et leurs sources.
 */

import { GRADES, genererSujet, totalPoints } from '../core/epreuves.js';
import { enregistrerSession, progression, proposerMeilleurScore } from '../core/progression.js';
import { creerFeuille } from '../ui/feuille.js';
import { h, formaterDuree } from '../ui/dom.js';

function resume(g) {
  const p = [];
  const m = g.mitori;
  p.push(`Mitorizan ${m.nb} problèmes de ${m.lignes} lignes (${m.egal ? `${m.chiffres / m.lignes} chiffres par ligne` : `${m.chiffres} chiffres, longueurs variées`}${m.soustractions ? ', additions et soustractions' : ''})`);
  if (g.mul) p.push(`multiplication ${g.mul.nb} × (${g.mul.total} chiffres au total)`);
  if (g.div) p.push(`division ${g.div.nb} × (diviseur + quotient : ${g.div.total} chiffres)`);
  return p.join(' · ');
}

export default {
  id: 'epreuves',
  titre: 'Épreuves officielles',
  monter(el) {
    let feuille = null;
    const meilleur = (g) => progression().records[`epreuve-${g.id}`];

    function liste() {
      feuille?.detruire();
      feuille = null;
      el.replaceChildren(h('h1', {}, 'Épreuves officielles'),
        h('p', { class: 'discret' }, 'Sujets au format des examens japonais de soroban (珠算検定 : Nihon Shuzan Renmei, et Chambre de commerce du Japon pour les 1er-3e kyū). Comme à l\'examen : tout sur votre soroban, dans le temps imparti, dans l\'ordre de votre choix.'),
        h('div', { class: 'carte', style: 'margin-bottom:12px' }, h('strong', {}, 'À savoir. '),
          'Les formats (nombre de problèmes, chiffres, durée, points) suivent les informations publiques des organisateurs. Les seuils des 4e-10e kyū sont indicatifs (70 %) : à confirmer auprès de la fédération. Aux 1er-3e kyū, l\'examen réel comporte aussi des décimaux et des arrondis ; ici, les nombres sont entiers.'),
        h('div', { class: 'liste-paliers' }, GRADES.map((g) => h('button', { class: 'ligne-palier', onclick: () => lancer(g) },
          h('span', { class: 'icone' }, meilleur(g)?.reussi ? '✓' : '○'),
          h('span', { class: 'titre' }, h('strong', {}, `${g.nom} (${g.japonais})`), h('div', { class: 'discret', style: 'font-size:0.85rem' }, resume(g))),
          h('span', { class: 'statut' }, `${g.minutes} min · ${totalPoints(g)} pts · réussite ≥ ${Math.round(g.seuil * 100)} %${meilleur(g) ? ` · meilleur ${meilleur(g).points}` : ''}`)))));
    }

    function lancer(g) {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'));
      const sujet = genererSujet(g);
      const max = totalPoints(g);
      feuille = creerFeuille(el, {
        titre: `${g.nom} (${g.japonais}) · ${g.minutes} minutes`,
        minutes: g.minutes,
        sections: sujet.sections,
        surFin: (b) => {
          const reussi = b.points >= g.seuil * max;
          enregistrerSession({ module: 'epreuves', mode: g.id, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          proposerMeilleurScore(`epreuve-${g.id}`, b.points, { reussi, dureeMs: b.dureeMs });
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.points} / ${max} points`),
            h('p', { class: reussi ? 'retour ok' : 'retour erreur' }, reussi ? `Réussi (seuil ${Math.round(g.seuil * max)} points).` : `Pas encore : il faut ${Math.round(g.seuil * max)} points.`),
            h('table', {}, h('tr', {}, ['Épreuve', 'Justes', 'Points'].map((x) => h('th', {}, x))),
              b.parSection.map((s) => h('tr', {}, h('td', {}, s.titre), h('td', {}, `${s.justes} / ${s.total}`), h('td', {}, `${s.points} / ${s.pointsMax}`)))),
            h('p', {}, `Temps utilisé : ${formaterDuree(b.dureeMs)}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => lancer(g) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    liste();
    return () => feuille?.detruire();
  },
};
