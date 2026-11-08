/**
 * Drills : 123456789 et ses variantes progressives, même nombre répété, suite des entiers.
 * Tout se fait sur son soroban ; seul le chronomètre compte (voir ui/drill.js).
 */

import { catalogueDrills, drillRepetition, CLASSEMENT, VALIDATIONS_DRILL, tempsClassement, classement, chiffresDrill } from '../core/drills.js';
import { enregistrerSession, proposerRecord, progression, etatDrill, noterDrill } from '../core/progression.js';
import { drillOuvert, manqueDrill, drillValide, estValide } from '../core/parcours.js';
import { creerDrill } from '../ui/drill.js';
import { badgeClassement } from '../ui/perles.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { serie81, serieTable, serieTables, produitLent, cleProduit } from '../core/tables.js';
import { noterProduit, statsTables, reglagesUtilisateur, noterVolume } from '../core/progression.js';
import { sprintQuotient, raisonnement, classementQuotient, CLASSEMENT_QUOTIENT, COUPLES_SPRINT, PENALITE_MS } from '../core/quotient.js';
import { h, formaterDuree, remplir, raccourcis } from '../ui/dom.js';

const NOMS_FAMILLES = { petit: 'petits amis', grand: 'grands amis', mixte: 'combinaisons', cascade: 'cascades' };

export default {
  id: 'drills',
  titre: 'Drills',
  monter(el, app, params = {}) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); remplir(el); nettoyer = f() ?? null; };
    const record = (id) => progression().records[`drill-${id}`] ?? null;

    function catalogue() {
      const drills = catalogueDrills();
      const groupes = [...new Set(drills.map((d) => d.groupe))];
      el.append(h('h1', {}, 'Drills'),
        h('p', { class: 'discret' }, `Des suites classiques à faire sur votre soroban, chronométrées. Elles se suivent du plus simple au plus long : un drill est validé après ${VALIDATIONS_DRILL} passages justes sous le temps bronze, et ouvre le suivant. Revenez-y ensuite pour décrocher l'argent, l'or et le platine.`));
      const prog = progression();
      for (const g of groupes.filter((x) => x !== 'Même nombre répété')) {
        el.append(h('h2', {}, g), h('div', { class: 'liste-paliers' }, drills.filter((d) => d.groupe === g).map((d) => {
          const ouvert = drillOuvert(prog, d);
          const valide = drillValide(prog, d.id);
          const rec = record(d.id);
          const cl = rec ? classement(d, rec.dureeMs) : null;
          const manque = manqueDrill(prog, d);
          const precedent = drills[drills.indexOf(d) - 1];
          let statut;
          if (!ouvert) statut = manque.length ? `demande : ${manque.map((f) => NOMS_FAMILLES[f]).join(', ')}` : `après « ${precedent.titre} »`;
          else if (valide) statut = `validé${rec ? ` · record ${formaterDuree(rec.dureeMs)}` : ''}`;
          else statut = `à valider : ${etatDrill(d.id).validations} / ${VALIDATIONS_DRILL} sous ${formaterDuree(tempsClassement(d, 'bronze'))}`;
          return h('button', { class: `ligne-palier${valide ? ' valide' : ''}`, disabled: !ouvert, onclick: () => changer(() => ecran(d)) },
            h('span', { class: `icone etat-${valide ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, valide ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, d.titre),
            cl ? badgeClassement(cl.id, cl.nom) : null,
            h('span', { class: 'statut' }, statut));
        })));
      }
      // Tables de multiplication (九九)
      // Plusieurs tables au choix, mélangées (cases à cocher), avec deux raccourcis.
      const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19];
      const cases = TABLES.map((n) => h('input', { type: 'checkbox', value: n, checked: [7, 8, 9].includes(n) }));
      const cocher = (liste) => cases.forEach((c) => { c.checked = liste.includes(Number(c.value)); });
      const choixTable = h('div', { class: 'choix-tables' },
        h('div', { class: 'ligne' }, ...cases.map((c, i) => h('label', { class: 'case-table' }, c, ` ${TABLES[i]}`))),
        h('div', { class: 'ligne' },
          h('button', { class: 'lien', onclick: () => cocher([6, 7, 8, 9]) }, '6 à 9'),
          h('button', { class: 'lien', onclick: () => cocher([2, 3, 4, 5, 6, 7, 8, 9]) }, 'toutes (2 à 9)'),
          h('button', { class: 'lien', onclick: () => cocher([12, 13, 14, 15, 16, 17, 18, 19]) }, 'diviseurs (12 à 19)'),
          h('button', { class: 'lien', onclick: () => cocher([]) }, 'aucune')));
      const tablesChoisies = () => cases.filter((c) => c.checked).map((c) => Number(c.value));
      const rec81 = progression().records['tables-81'];
      el.append(h('h2', {}, 'Tables de multiplication (九九)'),
        h('p', { class: 'discret' }, 'Réponse à taper le plus vite possible. La vitesse des produits fait celle des multiplications et des divisions. Chaque erreur coûte 3 secondes dans le défi des 81.'),
        h('div', { class: 'ligne' },
          h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables('81')) }, `Les 81 produits${rec81 ? ` (record ${formaterDuree(rec81.dureeMs)})` : ''}`),
          h('button', { class: 'btn', onclick: () => changer(() => ecranTables('lents')) }, 'Mes 20 produits les plus lents'),
        ),
        h('h3', {}, 'Mes tables, mélangées'),
        choixTable,
        h('button', { class: 'btn', onclick: () => { const t = tablesChoisies(); if (t.length) changer(() => ecranTables(t)); } }, 'Commencer avec ces tables'));
      // Sprint d'estimation du quotient : ouvert après la leçon « estimer et corriger ».
      if (estValide(progression(), 'p7-e') || reglagesUtilisateur().decouverte) {
        const recQ = progression().records['sprint-quotient'];
        const clQ = recQ ? classementQuotient(recQ.dureeMs) : null;
        el.append(h('h2', {}, 'Estimation du quotient (商)'),
          h('p', { class: 'discret' }, `${COUPLES_SPRINT} divisions par 2 chiffres, comme au milieu d'un calcul (150 ÷ 18) : tapez d'UNE touche le vrai chiffre du quotient, déjà corrigé. C'est le réflexe qui fait la vitesse des divisions.`),
          h('p', { class: 'classement-objectifs' }, CLASSEMENT_QUOTIENT.map((c) => badgeClassement(c.id, `${c.nom} ≤ ${formaterDuree(c.s * COUPLES_SPRINT * 1000)}`))),
          h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(ecranQuotient) }, 'Sprint : 20 estimations'),
            recQ ? h('span', { class: 'discret' }, `Record : ${formaterDuree(recQ.dureeMs)}`, clQ ? [' · ', badgeClassement(clQ.id, clQ.nom)] : '') : null));
      }
      const choixN = h('select', {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 333, 777, 999].map((n) => h('option', { value: n }, n)));
      choixN.value = '7';
      const choixFois = h('select', {}, [10, 20, 30].map((n) => h('option', { value: n }, `${n} fois`)));
      const ar = h('input', { type: 'checkbox', checked: true });
      el.append(h('h2', {}, 'Même nombre répété'),
        h('p', { class: 'discret' }, 'Ajouter le même nombre en boucle fait passer chaque tige par tous les cas : le meilleur exercice pour ancrer les amis d\'un chiffre.'),
        h('div', { class: 'ligne' }, 'Ajouter', choixN, choixFois, h('label', {}, ar, ' puis revenir à 0'),
          h('button', { class: 'btn principal', onclick: () => changer(() => ecran(drillRepetition(Number(choixN.value), Number(choixFois.value), ar.checked))) }, 'Commencer')));
    }

    /** Écran d'un drill ; `retour` permet de revenir ailleurs (ex. séance du jour). */
    function ecran(d) {
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'),
        h('h1', {}, d.titre), h('p', {}, d.description),
        h('p', { class: 'classement-objectifs' }, CLASSEMENT.map((c) => badgeClassement(c.id, `${c.nom} ≤ ${formaterDuree(tempsClassement(d, c.id))}`)),
          h('span', { class: 'discret' }, ` · validation : ${VALIDATIONS_DRILL} passages justes sous le temps bronze (${Math.min(etatDrill(d.id).validations, VALIDATIONS_DRILL)} / ${VALIDATIONS_DRILL})`)));
      const drill = creerDrill(el, d, {
        record: record(d.id),
        surFin: async ({ juste, dureeMs }) => {
          noterVolume(chiffresDrill(d));
          await enregistrerSession({ module: 'drills', mode: d.id, reglages: { priorite: !!params.priorite }, total: 1, justes: juste ? 1 : 0, dureeMs });
          const nouveau = juste && await proposerRecord(`drill-${d.id}`, dureeMs);
          const cl = juste ? classement(d, dureeMs) : null;
          const avant = drillValide(progression(), d.id);
          if (cl) await noterDrill(d.id);
          const n = etatDrill(d.id).validations;
          const suivant = CLASSEMENT[CLASSEMENT.findIndex((c) => c.id === cl?.id) + 1];
          const message = !juste ? 'Résultat faux : ce passage ne compte pas. Reprenez lentement, avec les points de contrôle.'
            : !cl ? `Juste, mais au-dessus du temps bronze (${formaterDuree(tempsClassement(d, 'bronze'))}) : encore un peu de rythme.`
              : !avant && n >= VALIDATIONS_DRILL ? `${cl.nom} ! Drill validé : le suivant est ouvert.`
                : !avant ? `${cl.nom} ! Passage validé (${n} / ${VALIDATIONS_DRILL}).`
                  : `${cl.nom}.${suivant ? ` Prochain objectif : ${suivant.nom.toLowerCase()} en ${formaterDuree(tempsClassement(d, suivant.id))}.` : ' Le meilleur classement !'}`;
          return h('div', { class: 'ligne', style: 'margin-top:8px' },
            cl ? badgeClassement(cl.id, cl.nom) : null,
            h('span', {}, message),
            nouveau ? h('strong', {}, ' Nouveau record personnel ! ') : null,
            h('button', { class: 'btn principal', onclick: () => changer(() => ecran(d)) }, 'Recommencer'),
            h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'));
        },
      });
      return () => drill.detruire();
    }

    /** Série de produits de la table : 81, plus lents (20), ou table d'un nombre. */
    function ecranTables(mode) {
      const titre = mode === '81' ? 'Les 81 produits' : mode === 'lents' ? 'Mes produits les plus lents'
        : Array.isArray(mode) ? (mode.length === 1 ? `Table de ${mode[0]}` : `Tables de ${mode.slice(0, -1).join(', ')} et ${mode.at(-1)}`) : `Table de ${mode}`;
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'), h('h1', {}, titre));
      const liste = mode === '81' ? serie81() : Array.isArray(mode) ? serieTables(mode) : typeof mode === 'number' ? serieTable(mode) : null;
      let precedent = null;
      const serie = creerSerie(el, {
        generer: () => {
          const ex = liste ? liste.shift() : produitLent(statsTables(), precedent);
          precedent = cleProduit(ex.a, ex.b);
          return ex;
        },
        nombre: liste ? liste.length : 20,
        chrono: true,
        defi: true,
        surExercice: (res, ex) => (ex.b < 10 && ex.a < 10 ? noterProduit(cleProduit(ex.a, ex.b), res.juste, res.dureeMs / 1000) : null),
        surFin: async (b) => {
          serie.detruire();
          const score = b.dureeMs + (b.total - b.justes) * 3000;
          await enregistrerSession({ module: 'drills', mode: `tables-${mode}`, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const nouveau = mode === '81' && await proposerRecord('tables-81', score);
          el.append(h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
            h('p', {}, `Temps ${formaterDuree(b.dureeMs)}${mode === '81' ? ` · score ${formaterDuree(score)}${nouveau ? ' · nouveau record !' : ''}` : ` · ${formaterDuree(b.dureeMs / b.total)} par produit`}`),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables(mode)) }, 'Recommencer'), h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
      return () => serie.detruire();
    }

    /**
     * Sprint d'estimation : une touche (1 à 9) valide aussitôt. Juste : couple suivant. Faux : le
     * raisonnement s'affiche (arrondi, vérification, correction), Entrée pour continuer.
     */
    function ecranQuotient() {
      const couples = sprintQuotient();
      let i = 0;
      let erreurs = [];
      let debut = null;
      let attente = false;
      const enonce = h('div', { class: 'operation estimation' });
      const compteur = h('span', { class: 'compteur' });
      const chrono = h('span', { class: 'compteur chrono' }, '0,0 s');
      const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const touches = h('div', { class: 'ligne touches-quotient' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('button', { class: 'btn', onclick: () => repondre(n) }, String(n))));
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'), h('h1', {}, 'Estimation du quotient'),
        h('p', { class: 'discret' }, 'Tapez le chiffre du quotient (une touche). Le chrono part au premier couple.'),
        h('div', { class: 'ligne' }, h('span', { style: 'flex:1' }), chrono, compteur), enonce, touches, retour);
      const montrer = () => {
        const c = couples[i];
        remplir(enonce, `${c.a} ÷ ${c.b}`);
        compteur.textContent = `${i + 1} / ${couples.length}`;
        debut ??= performance.now();
      };
      const minuterie = setInterval(() => { if (debut && i < couples.length) chrono.textContent = formaterDuree(performance.now() - debut); }, 100);
      const suivant = () => {
        attente = false;
        retour.className = 'retour';
        remplir(retour);
        i += 1;
        if (i < couples.length) montrer(); else fin();
      };
      function repondre(n) {
        if (attente || i >= couples.length) return;
        const c = couples[i];
        if (n === c.q) { retour.className = 'retour ok'; remplir(retour, h('span', { class: 'grand-signe' }, '✓')); attente = true; setTimeout(suivant, 150); return; }
        erreurs.push({ ...c, reponse: n });
        attente = true;
        retour.className = 'retour erreur';
        remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` ${c.a} ÷ ${c.b} → `, h('strong', {}, String(c.q)), ` (et non ${n})`),
          h('div', { class: 'detail' }, raisonnement(c.a, c.b)),
          h('button', { class: 'btn principal', onclick: suivant }, 'Suivant ', h('kbd', {}, 'Entrée')));
      }
      async function fin() {
        clearInterval(minuterie);
        const dureeMs = performance.now() - debut;
        const score = dureeMs + erreurs.length * PENALITE_MS;
        const justes = couples.length - erreurs.length;
        await enregistrerSession({ module: 'drills', mode: 'quotient', total: couples.length, justes, dureeMs });
        const nouveau = await proposerRecord('sprint-quotient', score);
        const cl = classementQuotient(score);
        remplir(enonce);
        touches.remove();
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, `${justes} / ${couples.length}`),
          h('p', {}, `Temps ${formaterDuree(dureeMs)} · score ${formaterDuree(score)} (3 s par erreur)${nouveau ? ' · nouveau record !' : ''}`),
          cl ? h('p', {}, badgeClassement(cl.id, cl.nom)) : h('p', { class: 'discret' }, `Bronze à ${formaterDuree(CLASSEMENT_QUOTIENT[0].s * COUPLES_SPRINT * 1000)}.`),
          erreurs.length ? h('div', {}, h('h3', {}, 'À revoir'), h('ul', {}, erreurs.map((e) => h('li', {}, `${e.a} ÷ ${e.b} → ${e.q} : ${raisonnement(e.a, e.b)}`)))) : null,
          h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(ecranQuotient) }, 'Recommencer'), h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'))));
      }
      const table = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), () => repondre(n)]));
      const sans = raccourcis({ ...table, Enter: () => (attente && retour.classList.contains('erreur') ? suivant() : false) });
      montrer();
      return () => { clearInterval(minuterie); sans(); };
    }

    const direct = params.drill ? catalogueDrills().find((d) => d.id === params.drill) : null;
    changer(params.quotient ? ecranQuotient : params.tables ? () => ecranTables(params.tables) : direct ? () => ecran(direct) : catalogue);
    return () => nettoyer?.();
  },
};
