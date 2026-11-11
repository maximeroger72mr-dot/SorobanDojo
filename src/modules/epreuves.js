/**
 * Épreuves au format des examens officiels japonais (珠算検定), du 10e au 1er kyū.
 * Sujet complet (mitorizan, multiplication, division), compte à rebours, notation par points,
 * seuil de réussite, impression possible. Voir core/epreuves.js pour les formats et leurs sources.
 */

import { manquantesEpreuve } from '../core/prerequis.js';
import { avertirPrerequis } from '../ui/avertissement.js';
import { GRADES, genererSujet, totalPoints } from '../core/epreuves.js';
import { enregistrerSession, progression, proposerMeilleurScore, reglagesUtilisateur, modifierReglages } from '../core/progression.js';
import { verdictAllure, allureGrade } from '../core/allure.js';
import { GRADES_ANZAN, genererSujetAnzan, totalPointsAnzan } from '../core/epreuvesAnzan.js';
import { cpm } from '../core/maitrise.js';
import { creerFeuille } from '../ui/feuille.js';
import { localiserErreur, diagnostiquer, typeErreurOperation, ENTRAINEMENTS_ERREUR } from '../core/diagnostic.js';
import { nomMotif } from '../core/motifs.js';

/**
 * Rapport d'examen blanc : gestes mis en cause (erreurs localisées en mitorizan) et causes
 * probables en multiplication / division, avec un lien vers une planche ciblée.
 */
function rapport(app, resultats) {
  const gestes = {};
  const causes = {};
  const types = {};
  for (const r of resultats.filter((x) => !x.juste && x.reponse !== null)) {
    if (r.ex.type === 'addsub') {
      for (const m of localiserErreur(r.ex, r.reponse)?.motifs ?? []) gestes[m] = (gestes[m] ?? 0) + 1;
    } else {
      // Type d'erreur reconnu (déjà compté dans le suivi par la feuille) : on le regroupe et on
      // propose son entraînement ; sinon, la cause la plus probable, telle quelle.
      const t = typeErreurOperation(r.ex, r.reponse);
      const c = t ? null : diagnostiquer(r.ex, r.reponse)[0];
      if (t) (types[t] ??= { n: 0, div: false }).n += 1;
      if (t && String(r.ex.type).startsWith('div')) types[t].div = true;
      if (c) causes[c] = (causes[c] ?? 0) + 1;
    }
  }
  const vides = resultats.filter((x) => x.reponse === null).length;
  const elements = [];
  for (const [m, n] of Object.entries(gestes).sort((a, b) => b[1] - a[1])) {
    elements.push(h('li', {}, `${nomMotif(m)} (${n} fois) `, h('button', { class: 'lien', onclick: () => app.aller('planches', { cible: m, auto: true }) }, '→ planche de ce geste')));
  }
  for (const [t, x] of Object.entries(types).sort((a, b) => b[1].n - a[1].n)) {
    const e = ENTRAINEMENTS_ERREUR[t];
    elements.push(h('li', {}, `× et ÷ : ${e.nom} (${x.n} fois) `, h('button', { class: 'lien', onclick: () => app.aller(...e.aller(x.div)) }, `→ ${e.remede}`)));
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
  const melange = m.pures >= m.nb ? ', additions seules' : m.pures ? ` (${m.pures} d'additions seules, ${m.nb - m.pures} avec soustractions${m.negatifs?.[0] ? ', dont un résultat négatif' : ''})` : ', additions et soustractions';
  const p = [`Mitorizan ${m.nb} problèmes de ${m.lignes} lignes de ${m.min === m.max ? m.min : `${m.min} à ${m.max}`} chiffres${melange}`];
  const forme = (f, sep) => (f.formes ? f.formes.map(([x, y]) => `${x} ${sep} ${y} chiffre${y > 1 ? 's' : ''}`).join(' ou ') : null);
  const dec = (f) => (f.decimales ? ', décimaux : arrondi au millième dans la première moitié, à l\'unité dans la seconde' : '');
  if (g.mul) p.push(`multiplication ${g.mul.nb} × (${forme(g.mul, '×') ?? `${g.mul.total} chiffres au total`}${dec(g.mul)})`);
  if (g.div) p.push(`division ${g.div.nb} × (${g.div.formes ? g.div.formes.map(([x, y]) => `diviseur ${x} chiffre${x > 1 ? 's' : ''}, quotient ${y}`).join(' ou ') : `diviseur + quotient : ${g.div.total} chiffres`}${dec(g.div)})`);
  return p.join(' · ');
}

/** Allure du grade en face de celle de l'élève : « 96 CPM à tenir · vous : 71 CPM ». */
function ligneAllure(g) {
  const v = verdictAllure(g, progression());
  const nf = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const ppm = (t) => nf(60 / t);
  const morceau = (nom, besoin, eleve, ok, fmt) => [`${nom} : ${fmt(besoin)} à tenir`, eleve === null ? ' (la vôtre n\'est pas encore mesurée)' : h('span', { class: ok ? 'allure-ok' : 'allure-courte' }, ` · vous : ${fmt(eleve)}`)];
  return h('div', { class: 'discret allure-grade', title: `Cadence qui permet de traiter ${Math.round(v.allure.part * 100)} % du sujet en ${g.minutes} minutes (le seuil de réussite, plus une marge pour les erreurs), en comptant 3 secondes par problème pour lire et écrire.` },
    h('strong', {}, 'Allure : '),
    morceau('colonnes', v.colonnes.besoin, v.colonnes.eleve, v.colonnes.ok, (t) => `${cpm(t)} CPM`),
    g.mul ? [' ; ', morceau('× et ÷', v.muldiv.besoin, v.muldiv.eleve, v.muldiv.ok, (t) => `${ppm(t)} produits par minute`)] : null,
    v.minutes !== null ? `. À votre vitesse : environ ${Math.round(v.minutes)} min pour ${g.minutes} accordées.` : '.');
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
          'Du 6e au 1er kyū : 300 points, réussite à 210 (4e au 6e) puis 240 (1er au 3e) ; dès le 3e kyū, toutes les multiplications et divisions s\'arrondissent. Du 10e au 7e kyū : 200 points, réussite à 120 (60 au 10e kyū). En mitorizan, 6 problèmes d\'additions seules puis 4 avec soustractions. Les séparateurs de milliers (« 1 234 567 ») ne sont exigés qu\'en examen pur, du 1er au 3e kyū, comme à l\'examen où une réponse sans séparateurs est comptée fausse.'),
        optionsExamen(),
        h('div', { class: 'liste-grades' }, GRADES.map((g) => h('div', { class: 'carte grade' },
          h('div', { class: 'ligne' },
            h('span', { class: `icone etat-${meilleur(g)?.reussi ? 'fait' : 'ouvert'}` }, meilleur(g)?.reussi ? '✓' : '○'),
            h('strong', { style: 'flex:1' }, `${g.nom} (${g.japonais})`),
            h('span', { class: 'discret' }, `réussite ≥ ${Math.round(g.seuil * totalPoints(g))} / ${totalPoints(g)}${meilleur(g) ? ` · meilleur ${meilleur(g).points} / ${totalPoints(g)}` : ''}`)),
          h('div', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' }, resume(g), g.verifie ? '' : ' · format indicatif'),
          ligneAllure(g),
          (() => { const m = manquantesEpreuve(progression(), g.id); return m.length ? h('p', { class: 'discret', style: 'margin:0 0 8px' }, `Conseillé après ${m.length} leçon${m.length > 1 ? 's' : ''} encore à valider, à commencer par « ${m[0].titre} ».`) : null; })(),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => lancer(g) }, `Épreuve complète · ${g.minutes} min`),
            ['mitori', 'mul', 'div'].filter((k) => g[k]).map((k) => {
              const r = progression().records[`epreuve-${g.id}-${k}`];
              return h('button', { class: 'btn', onclick: () => lancer(g, k) }, `${NOMS_SECTIONS[k]} seule · ${MINUTES_SPRINT} min${r ? ` (${r.points} pts)` : ''}`);
            }))))),
        listeAnzan());
    }

    /** Résumé d'un grade d'anzan : « 50 additions de 3 nombres à 1 chiffre ». */
    const resumeAnzan = (g) => {
      const m = g.mitori;
      const p = [`${m.nb} ${m.soustractions ? 'additions et soustractions' : 'additions'} de ${m.lignes} nombres à ${m.min} chiffre${m.min > 1 ? 's' : ''}`];
      if (g.mul) p.push(`${g.mul.nb} multiplications (${g.mul.total} chiffres au total)`);
      if (g.div) p.push(`${g.div.nb} divisions (diviseur + quotient : ${g.div.total} chiffres)`);
      return p.join(' · ');
    };

    /** Épreuves d'anzan : même feuille, mais tout de tête, soroban rangé. */
    function listeAnzan() {
      const rec = (g) => progression().records[`epreuve-${g.id}`];
      return [h('h2', {}, 'Épreuves d\'anzan (暗算検定)'),
        h('p', { class: 'discret' }, 'Tout de tête, soroban rangé. Chaque épreuve (additions, multiplications, divisions) a son propre temps : on les passe l\'une après l\'autre, sans revenir en arrière. Format indicatif : il vient de sources non officielles, et la longueur des colonnes a été reconstituée pour que chaque grade soit plus exigeant que le précédent. Ces épreuves ne comptent pas pour le grade de soroban.'),
        h('div', { class: 'liste-grades' }, GRADES_ANZAN.map((g) => h('div', { class: 'carte grade' },
          h('div', { class: 'ligne' },
            h('span', { class: `icone etat-${rec(g)?.reussi ? 'fait' : 'ouvert'}` }, rec(g)?.reussi ? '✓' : '○'),
            h('strong', { style: 'flex:1' }, `${g.nom} (${g.japonais})`),
            h('span', { class: 'discret' }, `réussite ≥ ${Math.round(g.seuil * totalPointsAnzan(g))} / ${totalPointsAnzan(g)}${rec(g) ? ` · meilleur ${rec(g).points}` : ''}`)),
          h('div', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' }, resumeAnzan(g), ' · format indicatif'),
          h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => demarrerAnzan(g) }, `Épreuve d'anzan · ${g.minutes} min`)))))];
    }

    function demarrerAnzan(g) {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'),
        h('p', { class: 'consigne' }, 'De tête, sans toucher le soroban : imaginez-le, puis écrivez le résultat.'));
      const sujet = genererSujetAnzan(g);
      const max = totalPointsAnzan(g);
      feuille = creerFeuille(el, {
        titre: `${g.nom} (${g.japonais}) · ${g.minutes} minutes · de tête`,
        minutes: g.minutes,
        // Chaque épreuve chronométrée séparément : le temps total, partagé à parts égales.
        sections: sujet.sections.map((x) => ({ ...x, minutes: g.minutes / sujet.sections.length })),
        parEpreuve: true,
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
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => demarrerAnzan(g) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    /**
     * Deux options, gardées d'une fois sur l'autre : afficher son allure pendant l'épreuve, et
     * l'examen pur (conditions réelles : aucune aide), qui masque l'allure d'office.
     */
    function optionsExamen() {
      const r = reglagesUtilisateur();
      const caseAllure = h('input', { type: 'checkbox', checked: !!r.allureExamen && !r.examenPur, disabled: !!r.examenPur });
      const casePur = h('input', { type: 'checkbox', checked: !!r.examenPur });
      caseAllure.addEventListener('change', () => modifierReglages({ allureExamen: caseAllure.checked }));
      casePur.addEventListener('change', async () => {
        await modifierReglages({ examenPur: casePur.checked });
        caseAllure.disabled = casePur.checked;
        caseAllure.checked = !casePur.checked && !!reglagesUtilisateur().allureExamen;
      });
      return h('div', { class: 'carte reglages-examen', style: 'margin-bottom:12px' },
        h('label', { title: 'Pendant l\'épreuve, à côté du temps restant : votre avance ou votre retard sur l\'allure à tenir.' }, caseAllure, ' Afficher mon allure pendant l\'épreuve'),
        h('label', { title: 'Comme le jour de l\'examen : le sujet, le temps, rien d\'autre. L\'allure est masquée d\'office.' }, casePur, ' Examen pur (conditions réelles, sans aucune aide)'));
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
      const seuil = section ? Math.max(SEUIL_SPRINT, g.seuil) : g.seuil;
      const milliers = !section && !!g.milliers && !!reglagesUtilisateur().examenPur;
      if (milliers) el.append(h('p', { class: 'consigne' }, 'Examen pur : écrivez les séparateurs de milliers (« 1 234 567 », ou « 12 345,678 »). Sans eux, une réponse juste est comptée fausse, comme à l\'examen.'));
      const minutes = section ? MINUTES_SPRINT : g.minutes;
      feuille = creerFeuille(el, {
        titre: `${g.nom} (${g.japonais})${section ? ` · ${NOMS_SECTIONS[section]} seule` : ''} · ${minutes} minutes${!section && reglagesUtilisateur().examenPur ? ' · examen pur' : ''}`,
        minutes,
        sections,
        milliers,
        // Allure : en option, épreuve complète seulement, jamais en examen pur.
        allure: !section && reglagesUtilisateur().allureExamen && !reglagesUtilisateur().examenPur ? { part: allureGrade(g).part } : null,
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
