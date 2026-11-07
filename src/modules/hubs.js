/**
 * Pages de cartes des sections du menu : Apprendre, S'entraîner, Se mesurer.
 *
 * Le menu n'a que 5 entrées (Aujourd'hui, Apprendre, S'entraîner, Se mesurer, Progression) ;
 * chaque section ouvre une page de cartes : une par activité, avec une phrase d'explication et
 * ce qui vous concerne (prochaine étape, record, « à faire »).
 *
 * Pour ajouter une activité : ajouter une carte dans CARTES (l'écran doit être déclaré dans app.js).
 */

import { progression, aujourdhui, revisionsDues } from '../core/progression.js';
import { grade, drillEchauffement } from '../core/parcours.js';
import { examenDeLaSemaine, resultatSemaine } from '../core/examen.js';
import { defiSemaine } from '../core/parcours.js';
import { prochainSousPalier, prochainAnzan } from './lecons.js';
import { recordJeu, JEUX } from './jeux.js';
import { h } from '../ui/dom.js';

const bits = (m) => [1, 2, 4].filter((b) => m & b).length;

/** Cartes de chaque section : écran visé, titre, description, info (texte ou null), à faire. */
const CARTES = {
  apprendre: [
    { ecran: 'lecons', titre: 'Leçons guidées', description: 'Le parcours pas à pas : comprendre un geste, l\'ancrer, passer le mini-test.',
      info: () => { const sp = prochainSousPalier(); return sp ? { texte: `Prochaine : ${sp.titre}`, aFaire: true } : { texte: 'Parcours terminé' }; } },
    { ecran: 'lecons', titre: 'Anzan et visualisation', description: 'La piste parallèle du calcul de tête : photo du soroban, image qui s\'estompe, chaîne qui s\'allonge.',
      info: () => { const sp = prochainAnzan(); return sp ? { texte: `Prochaine : ${sp.titre}`, aFaire: true } : null; }, params: () => (prochainAnzan() ? { sousPalier: prochainAnzan().id } : { piste: 'anzan' }) },
    { ecran: 'lecture', titre: 'Lecture des nombres', description: 'Lire et poser un nombre sur le soroban : la base de tout.' },
    { ecran: 'libre', titre: 'Démonstrations', description: 'Voir n\'importe quel calcul geste par geste, au ralenti.' },
    { ecran: 'lexique', titre: 'Lexique', description: 'Anzan, mitori, kyū, petit ami, coupe-file… : tous les mots, définis simplement.' },
  ],
  entrainer: [
    { ecran: 'revisions', titre: 'Révisions du jour', description: 'Les leçons à revoir aujourd\'hui (répétition espacée : J+1, 3, 7, 14, 30).',
      info: () => { const n = revisionsDues().length; return n ? { texte: `${n} à faire aujourd'hui`, aFaire: true } : { texte: 'Rien de dû aujourd\'hui' }; } },
    { ecran: 'drills', titre: 'Drills', description: 'Les suites classiques, du plus simple au 123 456 789 × 9, avec validation et classement bronze à platine. Et les tables.',
      info: () => ({ texte: `À valider : ${drillEchauffement(progression()).titre}` }) },
    { ecran: 'rythme', titre: 'Rythme et endurance', description: 'Marathon ruban (sans remise à zéro) et lièvre (rythme imposé, lecture anticipée).' },
    { ecran: 'planches', titre: 'Planches', description: 'Des colonnes ciblées sur un geste, en mode pur ou avec rappel doigté, imprimables.' },
    { ecran: 'jeux', titre: 'Jeux', description: JEUX.map((j) => j.titre).join(', ') + '.',
      info: () => { const r = JEUX.map((j) => recordJeu(j.id)).filter(Boolean); return r.length ? { texte: r[0] } : null; } },
    { ecran: 'anzan', titre: 'Flash anzan', description: 'Calcul de tête libre : flash, image, mitori, photo du soroban.' },
    { ecran: 'muldiv', titre: 'Multiplication et division', description: 'Multiplications et divisions à la japonaise, avec aide pas à pas.' },
    { ecran: 'dictee', titre: 'Dictée (yomiage)', description: 'Les nombres sont lus à voix haute : on calcule à l\'oreille.' },
    { ecran: 'quotidien', titre: 'Au quotidien', description: 'Ticket de caisse, monnaie, pourcentages, factures.' },
  ],
  mesurer: [
    { ecran: 'examen', titre: 'Passage de kyū', description: 'L\'examen de votre niveau, quand vous voulez : 20 colonnes chronométrées, 70 % pour réussir. Un échec ne coûte rien.',
      info: () => {
        const d = progression();
        const g = examenDeLaSemaine(d);
        if (!g) return null;
        const r = resultatSemaine(d, aujourdhui());
        return r ? { texte: `${g.nom} : ${r.points} / ${r.total} cette semaine${r.reussi ? ' ✓' : ''}` } : { texte: `${g.nom} : quand vous voulez` };
      } },
    { ecran: 'defis', titre: 'Défis chrono', description: 'Défi de la semaine en 3 étoiles, défis libres contre votre fantôme, arcade, échelle des kyū.',
      info: () => { const d = progression(); const s = defiSemaine(d, aujourdhui()); return { texte: `Défi de la semaine : ${bits(d.records[`${s.cle}-etoiles`]?.points ?? 0)} étoile(s) sur 3` }; } },
    { ecran: 'epreuves', titre: 'Épreuves officielles', description: 'Les vrais kyū (10e au 1er), au format des examens japonais.',
      info: () => { const g = grade(progression()); return g.prochain ? { texte: g.pret ? `Prêt pour le ${g.prochain.nom}` : `Prochain : ${g.prochain.nom}`, aFaire: g.pret } : null; } },
  ],
};

function page(id, titre, intro, badge = null) {
  return {
    id,
    titre,
    section: true,
    badge,
    monter(el, app) {
      el.append(h('h1', {}, titre), h('p', { class: 'discret chapeau' }, intro),
        h('div', { class: 'cartes' }, CARTES[id].map((c) => {
          const info = c.info?.();
          return h('button', { class: `carte-hub${info?.aFaire ? ' recommande' : ''}`, onclick: () => app.aller(c.ecran, c.params?.() ?? {}) },
            h('strong', {}, c.titre), h('span', {}, c.description),
            info ? h('span', { class: `carte-info${info.aFaire ? ' a-faire' : ''}` }, info.texte) : null);
        })));
      return null;
    },
  };
}

export const apprendre = page('apprendre', 'Apprendre', 'Comprendre un nouveau geste, le voir, le poser.');
// La pastille des révisions dues est sur « S'entraîner » : c'est là que sont les révisions.
export const entrainer = page('entrainer', 'S\'entraîner', 'Ancrer les gestes jusqu\'au réflexe : volume, rythme, vitesse.', () => revisionsDues().length);
export const mesurer = page('mesurer', 'Se mesurer', 'Travailler sous pression : examens, défis, records.');

/** Section du menu de chaque écran (pour surligner la bonne entrée). */
export const SECTION_DE = Object.fromEntries(Object.entries(CARTES).flatMap(([s, cartes]) => cartes.map((c) => [c.ecran, s])));
