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
import { manquantesActivite, PREREQUIS_ACTIVITES } from '../core/prerequis.js';
import { avertirPrerequis } from '../ui/avertissement.js';
import { frisePiste } from '../ui/frise.js';
import { SOUS_PALIERS } from '../core/curriculum.js';

const bits = (m) => [1, 2, 4].filter((b) => m & b).length;

/** Cartes de chaque section : écran visé, titre, description, info (texte ou null), à faire. */
export const CARTES = {
  // Apprendre : ce qui fait progresser (les parcours), puis ce qui sert à consulter (la boîte à outils).
  apprendre: [
    { groupe: 'Mes parcours', ecran: 'lecons', titre: 'Leçons guidées', description: 'Le parcours pas à pas : comprendre un geste, l\'ancrer, passer le mini-test.',
      info: () => { const sp = prochainSousPalier(); return sp ? { texte: `Prochaine : ${sp.titre}`, aFaire: true } : { texte: 'Parcours terminé' }; } },
    { groupe: 'Mes parcours', ecran: 'lecons', titre: 'Anzan et visualisation', description: 'La piste parallèle du calcul de tête : photo du soroban, image qui s\'estompe, chaîne qui s\'allonge.',
      info: () => { const sp = prochainAnzan(); return sp ? { texte: `Prochaine : ${sp.titre}`, aFaire: true } : null; }, params: () => (prochainAnzan() ? { sousPalier: prochainAnzan().id } : { piste: 'anzan' }) },
    { groupe: 'Boîte à outils', ecran: 'libre', titre: 'Démonstrations', description: 'Voir n\'importe quel calcul geste par geste, au ralenti.' },
    { groupe: 'Boîte à outils', ecran: 'lecture', titre: 'Lecture libre', description: 'Lire et poser des nombres jusqu\'à 9 chiffres, sans limite (la leçon « Lire et poser un nombre » est dans le parcours).' },
    { groupe: 'Boîte à outils', ecran: 'lexique', titre: 'Lexique', description: 'Anzan, mitori, kyū, petit ami, coupe-file… : tous les mots, définis simplement.' },
  ],
  // S'entraîner, regroupé par OPÉRATION (c'est ainsi que l'on cherche : « où travailler la division ? »).
  entrainer: [
    // Révisions : en tête, sans titre de section (une seule carte, son titre suffit).
    { ecran: 'revisions', titre: 'Révisions du jour', description: 'Les leçons à revoir aujourd\'hui (répétition espacée : J+1, 3, 7, 14, 30).',
      info: () => { const n = revisionsDues().length; return n ? { texte: `${n} à faire aujourd'hui`, aFaire: true } : { texte: 'Rien de dû aujourd\'hui' }; } },
    { groupe: 'Additions et soustractions', ecran: 'planches', prerequis: 'colonnes', titre: 'Planches', description: 'Pour le volume : des colonnes ciblées sur un geste, en mode pur ou avec rappel doigté, imprimables.' },
    { groupe: 'Additions et soustractions', ecran: 'rythme', params: () => ({ voir: 'marathon' }), prerequis: 'colonnes', titre: 'Marathon', description: 'Pour le volume : une longue colonne sans remise à zéro, on tient le plus longtemps possible.' },
    { groupe: 'Additions et soustractions', ecran: 'rythme', params: () => ({ voir: 'lievre' }), prerequis: 'colonnes', titre: 'Lièvre', description: 'Pour la vitesse : un rythme imposé qui accélère ; l\'œil lit la ligne suivante pendant que la main travaille.' },
    { groupe: 'Additions et soustractions', ecran: 'drills', params: () => ({ section: 'gestes' }), titre: 'Drills de gestes', description: 'Pour la vitesse : les suites classiques, d\'une seule tige au 123 456 789 × 9, médailles bronze à platine.',
      info: () => { const x = drillEchauffement(progression()); return x ? { texte: `À valider : ${x.titre}` } : null; } },
    { groupe: 'Additions et soustractions', ecran: 'dictee', prerequis: 'dictee', titre: 'Dictée (yomiage)', description: 'Pour l\'oreille : les nombres sont lus à voix haute, vous calculez sur votre soroban.' },
    { groupe: 'Multiplications et divisions', ecran: 'drills', params: () => ({ section: 'tables' }), titre: 'Tables (九九)', description: 'Pour la vitesse : les 81 produits, vos produits les plus lents, vos tables mélangées ; puis l\'estimation du quotient.',
      info: () => { const r = progression().records['tables-81']; return r ? { texte: `81 produits : record ${Math.round(r.dureeMs / 1000)} s` } : null; } },
    { groupe: 'Multiplications et divisions', ecran: 'muldiv', prerequis: 'muldiv', titre: 'Multiplication et division', description: 'Pour le volume : multiplications et divisions à la japonaise, avec aide pas à pas.' },
    { groupe: 'Calcul de tête', ecran: 'anzan', prerequis: 'anzan', titre: 'Flash anzan', description: 'Calcul de tête en entraînement libre : flash, image, mitori, photo du soroban (la piste guidée est dans Apprendre).' },
    { groupe: 'Calcul de tête', ecran: 'jeux', params: () => ({ jeu: 'survie' }), prerequis: 'anzan', titre: 'Survie anzan', description: 'De tête : la chaîne s\'allonge d\'un nombre à chaque réussite, jusqu\'à l\'erreur.',
      info: () => (recordJeu('survie') ? { texte: recordJeu('survie') } : null) },
    { groupe: 'Appliquer et jouer', ecran: 'quotidien', prerequis: 'quotidien', titre: 'Au quotidien', description: 'Ticket de caisse, monnaie, pourcentages, factures.' },
    { groupe: 'Appliquer et jouer', ecran: 'jeux', titre: 'Jeux', description: JEUX.filter((j) => j.id !== 'survie').map((j) => j.titre).join(', ') + '.',
      info: () => { const r = JEUX.filter((j) => j.id !== 'survie').map((j) => recordJeu(j.id)).filter(Boolean); return r.length ? { texte: r[0] } : null; } },
  ],
  mesurer: [
    { ecran: 'grades', titre: 'Grades', description: 'Votre grade sur une seule frise, du 20e au 1er kyū : le passage de kyū préparatoire et les épreuves officielles.',
      info: () => {
        const d = progression();
        const g = grade(d);
        const ex = examenDeLaSemaine(d);
        const r = ex ? resultatSemaine(d, aujourdhui()) : null;
        if (g.pret) return { texte: `Prêt pour le ${g.prochain.nom}`, aFaire: true };
        return ex ? { texte: r ? `${ex.nom} : ${r.points} / ${r.total} cette semaine${r.reussi ? ' ✓' : ''}` : `${ex.nom} : quand vous voulez` } : null;
      } },
    { ecran: 'defis', prerequis: 'defis', titre: 'Défis chrono', description: 'Défi de la semaine en 3 étoiles, défis libres contre votre fantôme, arcade, l\'escalier.',
      info: () => { const d = progression(); const s = defiSemaine(d, aujourdhui()); return { texte: `Défi de la semaine : ${bits(d.records[`${s.cle}-etoiles`]?.points ?? 0)} étoile(s) sur 3` }; } },
  ],
};

function page(id, titre, intro, badge = null) {
  return {
    id,
    titre,
    section: true,
    badge,
    monter(el, app) {
      el.append(h('h1', {}, titre), h('p', { class: 'discret chapeau' }, intro));
      if (id === 'apprendre') {
        const d = progression();
        const prochain = prochainSousPalier();
        const apres = prochain ? SOUS_PALIERS.filter((sp) => !sp.mental && sp.ordre > prochain.ordre && sp.type !== 'theorie' && !d.paliers[sp.id]?.valide).slice(0, 2) : [];
        el.append(frisePiste(d, { prochain, anzan: prochainAnzan(), apres }));
      }
      el.append(
        // Cartes groupées par section (titre de groupe) quand elles en ont une.
        ...[...new Set(CARTES[id].map((c) => c.groupe ?? ''))].flatMap((g) => [
          g ? h('h2', { class: 'groupe-cartes' }, g) : null,
          h('div', { class: 'cartes' }, CARTES[id].filter((c) => (c.groupe ?? '') === g).map((c) => {
            const manque = c.prerequis ? manquantesActivite(progression(), c.prerequis) : [];
            const info = manque.length ? { texte: `Conseillé après « ${manque[0].titre} »` } : c.info?.();
            const ouvrir = () => app.aller(c.ecran, c.params?.() ?? {});
            return h('button', { class: `carte-hub${info?.aFaire ? ' recommande' : ''}${manque.length ? ' attenue' : ''}`,
              onclick: () => (manque.length ? avertirPrerequis(app, manque, PREREQUIS_ACTIVITES[c.prerequis].utilise, ouvrir) : ouvrir()) },
              h('strong', {}, c.titre), h('span', {}, c.description),
              info ? h('span', { class: `carte-info${info.aFaire ? ' a-faire' : ''}` }, info.texte) : null);
          }))].filter(Boolean)));
      return null;
    },
  };
}

export const apprendre = page('apprendre', 'Apprendre', 'Les parcours qui vous font progresser, et les outils pour consulter.');
// La pastille des révisions dues est sur « S'entraîner » : c'est là que sont les révisions.
export const entrainer = page('entrainer', 'S\'entraîner', 'Ancrer les gestes jusqu\'au réflexe, par opération : volume, rythme, vitesse.', () => revisionsDues().length);
export const mesurer = page('mesurer', 'Se mesurer', 'Travailler sous pression : examens, défis, records.');

/** Section du menu de chaque écran (pour surligner la bonne entrée). */
export const SECTION_DE = {
  ...Object.fromEntries(Object.entries(CARTES).flatMap(([s, cartes]) => cartes.map((c) => [c.ecran, s]))),
  // Écrans ouverts depuis une page intermédiaire (Grades).
  examen: 'mesurer', epreuves: 'mesurer', grades: 'mesurer',
  positionnement: 'apprendre',
};
