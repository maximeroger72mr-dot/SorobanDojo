/**
 * Épreuves au format des examens officiels japonais (珠算検定), du 10e au 1er kyū.
 * Sujet complet (mitorizan, multiplication, division), compte à rebours, notation par points,
 * seuil de réussite, impression possible. Voir core/epreuves.js pour les formats et leurs sources.
 */

import { manquantesEpreuve } from '../core/prerequis.js';
import { avertirPrerequis } from '../ui/avertissement.js';
import { GRADES, genererSujet, totalPoints } from '../core/epreuves.js';
import { enregistrerSession, progression, proposerMeilleurScore } from '../core/progression.js';
import { creerFeuille } from '../ui/feuille.js';
import { localiserErreur, diagnostiquer } from '../core/diagnostic.js';
import { nomMotif } from '../core/motifs.js';

/**
 * Rapport d'examen blanc : gestes mis en cause (erreurs localisées en mitorizan) et causes
 * probables en multiplication / division, avec un lien vers une planche ciblée.
 */
function rapport(app, resultats) {
  const gestes = {};
  const causes = {};
  for (const r of resultats.filter((x) => !x.juste && x.reponse !== null)) {
    if (r.ex.type === 'addsub') {
      for (const m of localiserErreur(r.ex, r.reponse)?.motifs ?? []) gestes[m] = (gestes[m] ?? 0) + 1;
    } else {
      const c = diagnostiquer(r.ex, r.reponse)[0];
      if (c) causes[c] = (causes[c] ?? 0) + 1;
    }
  }
  const vides = resultats.filter((x) => x.reponse === null).length;
  const elements = [];
  for (const [m, n] of Object.entries(gestes).sort((a, b) => b[1] - a[1])) {
    elements.push(h('li', {}, `${nomMotif(m)} (${n} fois) `, h('button', { class: 'lien', onclick: () => app.aller('planches', { cible: m, auto: true }) }, '→ planche de ce geste')));
  }
  for (const [c, n] of Object.entries(causes).sort((a, b) => b[1] - a[1])) elements.push(h('li', {}, `${c}${n > 1 ? ` (${n} fois)` : ''}`));
  if (vides) elements.push(h('li', {}, `${vides} problème${vides > 1 ? 's' : ''} sans réponse : travaillez la vitesse (défis, planches « vitesse »).`));
  return h('div', {}, h('h3', {}, 'Rapport'),
    elements.length ? h('ul', {}, elements) : h('p', { class: 'discret' }, 'Rien de particulier à signaler.'),
    h('p', { class: 'discret' }, 'Les erreurs de mitorizan dont la cause n\'est pas prouvée par le résultat ne sont attribuées à aucun geste.'));
}
import { h, formaterDuree, remplir } from '../ui/dom.js';

const NOMS_SECTIONS = { mitori: 'Mitorizan', mul: 'Multiplication', div: 'Division' };
/** Épreuve isolée (« sprint ») : 10 minutes, 7/10 exigés, comme dans le format par épreuve. */
const MINUTES_SPRINT = 10;
const SEUIL_SPRINT = 0.7;

function resume(g) {
  const m = g.mitori;
  const p = [`Mitorizan ${m.nb} problèmes de ${m.lignes} lignes de ${m.min === m.max ? m.min : `${m.min} à ${m.max}`} chiffres${m.soustractions ? ', additions et soustractions' : ''}`];
  const dec = (f) => (f.decimales ? `, moitié en décimaux (arrondi ${f.decimales === 4 ? 'au dix-millième' : 'au millième'})` : '');
  if (g.mul) p.push(`multiplication ${g.mul.nb} × (${g.mul.total} chiffres au total${dec(g.mul)})`);
  if (g.div) p.push(`division ${g.div.nb} × (diviseur + quotient : ${g.div.total} chiffres${dec(g.div)})`);
  return p.join(' · ');
}

export default {
  id: 'epreuves',
  titre: 'Épreuves officielles',
  parent: 'grades',
  monter(el, app) {
    let feuille = null;
    const meilleur = (g) => progression().records[`epreuve-${g.id}`];

    function liste() {
      feuille?.detruire();
      feuille = null;
      remplir(el, h('h1', {}, 'Épreuves officielles'),
        h('p', { class: 'discret' }, 'Sujets au format des examens japonais de soroban (珠算検定 : Nihon Shuzan Renmei, et Chambre de commerce du Japon pour les 1er-3e kyū). Comme à l\'examen : tout sur votre soroban, dans le temps imparti, dans l\'ordre de votre choix.'),
        h('div', { class: 'carte', style: 'margin-bottom:12px' }, h('strong', {}, 'À savoir. '),
          'Du 6e au 1er kyū : tableau de référence retenu (seuils 210/300 puis 240/300, décimaux à partir du 3e kyū, réponses arrondies comme indiqué). Du 10e au 7e kyū : formats publics japonais, seuil indicatif de 70 %. Les séparateurs de milliers sont acceptés dans les réponses, jamais exigés.'),
        h('div', { class: 'liste-grades' }, GRADES.map((g) => h('div', { class: 'carte grade' },
          h('div', { class: 'ligne' },
            h('span', { class: `icone etat-${meilleur(g)?.reussi ? 'fait' : 'ouvert'}` }, meilleur(g)?.reussi ? '✓' : '○'),
            h('strong', { style: 'flex:1' }, `${g.nom} (${g.japonais})`),
            h('span', { class: 'discret' }, `réussite ≥ ${Math.round(g.seuil * 100)} %${meilleur(g) ? ` · meilleur ${meilleur(g).points} / ${totalPoints(g)}` : ''}`)),
          h('div', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' }, resume(g)),
          (() => { const m = manquantesEpreuve(progression(), g.id); return m.length ? h('p', { class: 'discret', style: 'margin:0 0 8px' }, `Conseillé après ${m.length} leçon${m.length > 1 ? 's' : ''} encore à valider, à commencer par « ${m[0].titre} ».`) : null; })(),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => lancer(g) }, `Épreuve complète · ${g.minutes} min`),
            ['mitori', 'mul', 'div'].filter((k) => g[k]).map((k) => {
              const r = progression().records[`epreuve-${g.id}-${k}`];
              return h('button', { class: 'btn', onclick: () => lancer(g, k) }, `${NOMS_SECTIONS[k]} seule · ${MINUTES_SPRINT} min${r ? ` (${r.points} pts)` : ''}`);
            }))))));
    }

    /** Avant les leçons conseillées : on prévient, sans bloquer. */
    function lancer(g, section = null) {
      const manque = manquantesEpreuve(progression(), g.id);
      if (manque.length) avertirPrerequis(app, manque, `des gestes et des opérations du ${g.nom}`, () => demarrer(g, section));
      else demarrer(g, section);
    }

    /** Lance l'épreuve complète, ou une seule épreuve (section) en 10 minutes. */
    function demarrer(g, section = null) {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'));
      const sujet = genererSujet(g);
      const sections = section ? sujet.sections.filter((x) => x.cle === section) : sujet.sections;
      const max = sections.reduce((t, x) => t + x.problemes.length * x.points, 0);
      const seuil = section ? SEUIL_SPRINT : g.seuil;
      const minutes = section ? MINUTES_SPRINT : g.minutes;
      feuille = creerFeuille(el, {
        titre: `${g.nom} (${g.japonais})${section ? ` · ${NOMS_SECTIONS[section]} seule` : ''} · ${minutes} minutes`,
        minutes,
        sections,
        surFin: (b) => {
          const reussi = b.points >= seuil * max;
          enregistrerSession({ module: 'epreuves', mode: section ? `${g.id}-${section}` : g.id, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          // Seule l'épreuve complète compte pour le grade ; les sprints gardent leur propre record.
          proposerMeilleurScore(section ? `epreuve-${g.id}-${section}` : `epreuve-${g.id}`, b.points, { reussi, dureeMs: b.dureeMs });
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.points} / ${max} points`),
            h('p', { class: reussi ? 'retour ok' : 'retour erreur' }, reussi ? `Réussi (seuil ${Math.round(seuil * max)} points).` : `Pas encore : il faut ${Math.round(seuil * max)} points.`),
            h('table', {}, h('tr', {}, ['Épreuve', 'Justes', 'Points'].map((x) => h('th', {}, x))),
              b.parSection.map((s) => h('tr', {}, h('td', {}, s.titre), h('td', {}, `${s.justes} / ${s.total}`), h('td', {}, `${s.points} / ${s.pointsMax}`)))),
            h('p', {}, `Temps utilisé : ${formaterDuree(b.dureeMs)}`),
            rapport(app, b.resultats),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => demarrer(g, section) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    liste();
    return () => feuille?.detruire();
  },
};
