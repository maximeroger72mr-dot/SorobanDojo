/**
 * Drills : 123456789 et ses variantes progressives, même nombre répété, suite des entiers.
 * Tout se fait sur son soroban ; seul le chronomètre compte (voir ui/drill.js).
 */

import { catalogueDrills, drillRepetition, drillPerso, CLASSEMENT, VALIDATIONS_DRILL, tempsClassement, classement, chiffresDrill } from '../core/drills.js';
import { enregistrerSession, proposerRecord, proposerMeilleurScore, progression, etatDrill, noterDrill } from '../core/progression.js';
import { drillOuvert, prerequisDrill, drillValide, estValide } from '../core/parcours.js';
import { SOUS_PALIERS } from '../core/curriculum.js';
import { creerDrill } from '../ui/drill.js';
import { badgeClassement } from '../ui/perles.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { serie81, serieTable, serieTables, produitLent, cleProduit, produitsARetravailler, serieCriblage, piresProduits, creerAcharnement, CRIBLAGE_S, ACHARNEMENT } from '../core/tables.js';
import { noterProduit, statsTables, reglagesUtilisateur, noterVolume, modifierReglages } from '../core/progression.js';
import { sprintQuotient, raisonnement, classementQuotient, CLASSEMENT_QUOTIENT, COUPLES_SPRINT, PENALITE_MS } from '../core/quotient.js';
import { h, formaterDuree, remplir, raccourcis } from '../ui/dom.js';

const NOMS_FAMILLES = { petit: 'petits amis', grand: 'grands amis', mixte: 'combinaisons', cascade: 'cascades' };

/** Acharnement : secondes laissées pour relire les produits visés et leur résultat avant le départ. */
const SECONDES_RAPPEL = 5;

export default {
  id: 'drills',
  titre: 'Drills',
  paramsRetour: (p = {}) => ({ section: p.section === 'tables' || p.tables || p.quotient ? 'tables' : 'gestes' }),
  titreDe: (p = {}) => (p.section === 'tables' || p.tables || p.quotient ? 'Tables (九九)' : 'Drills de gestes'),
  monter(el, app, params = {}) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); remplir(el); nettoyer = f() ?? null; };
    const record = (id) => progression().records[`drill-${id}`] ?? null;

    // Deux pages : les drills de gestes (additions et soustractions) et les tables (× et ÷).
    let section = params.section ?? (params.tables || params.quotient ? 'tables' : 'gestes');

    function catalogueTables() {
      section = 'tables';
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
      el.append(h('h1', {}, 'Tables (九九)'),
        h('p', { class: 'discret' }, 'Réponse à taper le plus vite possible. La vitesse des produits fait celle des multiplications et des divisions. Chaque erreur coûte 3 secondes dans le défi des 81.'),
        h('div', { class: 'ligne' },
          h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables('81')) }, `Les 81 produits${rec81 ? ` (record ${formaterDuree(rec81.dureeMs)})` : ''}`),
          h('button', { class: 'btn', onclick: () => changer(() => ecranTables('lents')) }, produitsARetravailler(statsTables()).length ? `Mes produits à retravailler (${produitsARetravailler(statsTables()).length})` : 'Mes 20 produits les plus lents'),
        ),
        h('h3', {}, 'Criblage et acharnement'),
        h('p', { class: 'discret' }, `Criblage : les 36 produits de base (2 × 2 à 9 × 9) en ${CRIBLAGE_S} secondes, pour repérer ceux qui accrochent. Acharnement : vos ${ACHARNEMENT.produits} pires produits seulement ; un produit faux ou lent revient ${ACHARNEMENT.retour} questions plus tard, et l'exercice ne s'arrête que lorsque chacun est réussi ${ACHARNEMENT.suite} fois de suite en moins de ${ACHARNEMENT.rapide.toLocaleString('fr-FR')} s. Le chrono s'arrête à la première touche.`),
        h('div', { class: 'ligne' },
          h('button', { class: 'btn', onclick: () => changer(() => ecranRapide('criblage')) }, `Criblage · ${CRIBLAGE_S} s${progression().records['tables-criblage'] ? ` (record ${progression().records['tables-criblage'].points} / 36)` : ''}`),
          h('button', { class: 'btn', onclick: () => changer(() => ecranRapide('acharnement')) }, `Acharnement : ${piresProduits(statsTables()).map(([a, b]) => `${a} × ${b}`).join(', ')}`)),
        h('h3', {}, 'Mes tables, mélangées'),
        choixTable,
        h('button', { class: 'btn', onclick: () => { const t = tablesChoisies(); if (t.length) changer(() => ecranTables(t)); } }, 'Commencer avec ces tables'));
      // Sprint d'estimation du quotient : ouvert dès la première leçon de division (par 1 chiffre),
      // pour que l'estimation soit un réflexe en arrivant à la division par 2 chiffres.
      if (estValide(progression(), 'p7-1') || reglagesUtilisateur().decouverte) {
        const recQ = progression().records['sprint-quotient'];
        const clQ = recQ ? classementQuotient(recQ.dureeMs) : null;
        el.append(h('h2', {}, 'Estimation du quotient (商)'),
          h('p', { class: 'discret' }, `${COUPLES_SPRINT} divisions par 2 chiffres, comme au milieu d'un calcul (150 ÷ 18) : tapez d'UNE touche le vrai chiffre du quotient, déjà corrigé. C'est le réflexe qui fait la vitesse des divisions.`),
          h('p', { class: 'classement-objectifs' }, CLASSEMENT_QUOTIENT.map((c) => badgeClassement(c.id, `${c.nom} ≤ ${formaterDuree(c.s * COUPLES_SPRINT * 1000)}`))),
          h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(ecranQuotient) }, 'Sprint : 20 estimations'),
            recQ ? h('span', { class: 'discret' }, `Record : ${formaterDuree(recQ.dureeMs)}`, clQ ? [' · ', badgeClassement(clQ.id, clQ.nom)] : '') : null));
      }
    }

    function catalogue() {
      if (section === 'tables') { catalogueTables(); return; }
      const drills = catalogueDrills();
      const groupes = [...new Set(drills.map((d) => d.groupe))];
      el.append(h('h1', {}, 'Drills de gestes'),
        h('p', { class: 'discret' }, `Des suites classiques à faire sur votre soroban, chronométrées. Elles se suivent du plus simple au plus long : un drill est validé après ${VALIDATIONS_DRILL} passages justes sous le temps bronze, et ouvre le suivant. Revenez-y ensuite pour décrocher l'argent, l'or et le platine.`));
      const prog = progression();
      for (const g of groupes.filter((x) => x !== 'Même nombre répété')) {
        el.append(h('h2', {}, g), h('div', { class: 'liste-paliers' }, drills.filter((d) => d.groupe === g).map((d) => {
          const ouvert = drillOuvert(prog, d);
          const valide = drillValide(prog, d.id);
          const rec = record(d.id);
          const cl = rec ? classement(d, rec.dureeMs) : null;
          const pre = prerequisDrill(prog, d);
          const chaine = drills.filter((x) => !x.entree);
          const precedent = chaine[chaine.indexOf(d) - 1];
          let statut;
          if (!ouvert) {
            statut = pre.lecons.length ? `après « ${SOUS_PALIERS.find((s) => s.id === pre.lecons[0]).titre} »`
              : pre.familles.length ? `demande : ${pre.familles.map((f) => NOMS_FAMILLES[f]).join(', ')}` : `après « ${precedent?.titre} »`;
          }
          else if (valide) statut = `validé${rec ? ` · record ${formaterDuree(rec.dureeMs)}` : ''}`;
          else statut = `à valider : ${etatDrill(d.id).validations} / ${VALIDATIONS_DRILL} sous ${formaterDuree(tempsClassement(d, 'bronze'))}`;
          return h('button', { class: `ligne-palier${valide ? ' valide' : ''}`, disabled: !ouvert, onclick: () => changer(() => ecran(d)) },
            h('span', { class: `icone etat-${valide ? 'fait' : ouvert ? 'ouvert' : 'ferme'}` }, valide ? '✓' : ouvert ? '○' : '·'), h('span', { class: 'titre' }, d.titre),
            cl ? badgeClassement(cl.id, cl.nom) : null,
            h('span', { class: 'statut' }, statut));
        })));
      }
      const choixN = h('select', {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 333, 777, 999].map((n) => h('option', { value: n }, n)));
      choixN.value = '7';
      const choixFois = h('select', {}, [10, 20, 30].map((n) => h('option', { value: n }, `${n} fois`)));
      const ar = h('input', { type: 'checkbox', checked: true });
      // Générateur : un drill sur mesure (longueur du pas, nombre d'étapes, sous-totaux).
      const gen = { chiffres: 3, varie: false, etapes: 9, forme: 'retour', tousLes: 3, nombre: '', ...(reglagesUtilisateur().drillPerso ?? {}) };
      gen.forme ??= gen.retour === false ? 'aller' : 'retour';
      const sel = (cle, options, conv = Number, apres = null) => { const x = h('select', { onchange: (e) => { gen[cle] = conv(e.target.value); apres?.(); } }, options.map(([v, t]) => h('option', { value: v }, t))); x.value = String(gen[cle]); return x; };
      // Le pas répété peut être saisi (ex. 789 pour cibler les grands amis) ; vide : tiré au
      // hasard, chiffres tous distincts et sans zéro.
      const saisiePas = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-pas', placeholder: 'au hasard', value: gen.nombre ?? '', 'aria-label': 'Nombre à répéter (vide : au hasard)', oninput: (e) => { gen.nombre = e.target.value.replace(/\D/g, '').slice(0, 9); e.target.value = gen.nombre; } });
      const labelPas = h('label', { title: 'Le nombre exact à répéter. Vide : un nombre aux chiffres tous distincts, sans zéro, de la longueur choisie.' }, 'Nombre ', saisiePas);
      const majPas = () => { labelPas.style.display = gen.varie ? 'none' : ''; };
      el.append(h('h2', {}, 'Drill sur mesure'),
        h('p', { class: 'discret' }, 'Composez votre drill : le nombre ajouté (saisi, ou tiré avec des chiffres tous distincts), le nombre d\'étapes, la forme (additions, aller-retour, ou descente : soustractions seules depuis un grand nombre déjà posé) et des sous-totaux de contrôle à intervalles réguliers.'),
        h('div', { class: 'ligne reglages' },
          sel('varie', [['false', 'le même nombre à chaque ligne'], ['true', 'un nombre différent à chaque ligne']], (v) => v === 'true', majPas),
          labelPas,
          h('label', {}, 'Longueur ', sel('chiffres', [[0, 'au hasard (3 à 9 chiffres)'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, `${n} chiffre${n > 1 ? 's' : ''}`])])),
          h('label', {}, 'Étapes ', sel('etapes', [5, 9, 10, 15, 20, 30, 50].map((n) => [n, `${n} lignes`]))),
          sel('forme', [['retour', 'additions, puis retour à 0'], ['aller', 'additions seules'], ['descente', 'descente : soustractions seules, du total à 0']], String),
          h('label', {}, 'Sous-totaux ', sel('tousLes', [[0, 'aucun'], [3, 'toutes les 3 lignes'], [5, 'toutes les 5 lignes'], [10, 'toutes les 10 lignes']])),
          h('button', { class: 'btn principal', onclick: async () => {
            const reglages = { ...gen, nombre: gen.nombre ? Number(gen.nombre) : null };
            await modifierReglages({ drillPerso: { ...gen } });
            changer(() => ecran(drillPerso(reglages), { tousLes: gen.tousLes, reglages }));
          } }, 'Générer et commencer')));
      majPas();
      el.append(h('h2', {}, 'Même nombre répété'),
        h('p', { class: 'discret' }, 'Ajouter le même nombre en boucle fait passer chaque tige par tous les cas : le meilleur exercice pour ancrer les amis d\'un chiffre.'),
        h('div', { class: 'ligne' }, 'Ajouter', choixN, choixFois, h('label', {}, ar, ' puis revenir à 0'),
          h('button', { class: 'btn principal', onclick: () => changer(() => ecran(drillRepetition(Number(choixN.value), Number(choixFois.value), ar.checked))) }, 'Commencer')));
    }

    /** Écran d'un drill ; `retour` permet de revenir ailleurs (ex. séance du jour). */
    function ecran(d, o = {}) {
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogue) }, '← Tous les drills'),
        h('h1', {}, d.titre), h('p', {}, d.description),
        h('p', { class: 'classement-objectifs' }, CLASSEMENT.map((c) => badgeClassement(c.id, `${c.nom} ≤ ${formaterDuree(tempsClassement(d, c.id))}`)),
          d.perso ? h('span', { class: 'discret' }, o.tousLes ? ` · sous-total affiché toutes les ${o.tousLes} lignes` : '')
            : h('span', { class: 'discret' }, ` · validation : ${VALIDATIONS_DRILL} passages justes sous le temps bronze (${Math.min(etatDrill(d.id).validations, VALIDATIONS_DRILL)} / ${VALIDATIONS_DRILL})`)));
      const drill = creerDrill(el, d, {
        record: d.perso ? undefined : record(d.id),
        tousLes: o.tousLes ?? 0,
        surFin: async ({ juste, dureeMs }) => {
          noterVolume(chiffresDrill(d));
          if (d.perso) {
            // Drill sur mesure : pas de record ni de validation (les nombres changent à chaque fois).
            await enregistrerSession({ module: 'drills', mode: 'perso', reglages: { ...o.reglages }, total: 1, justes: juste ? 1 : 0, dureeMs });
            const cl = juste ? classement(d, dureeMs) : null;
            return h('div', { class: 'ligne', style: 'margin-top:8px' },
              cl ? badgeClassement(cl.id, cl.nom) : null,
              h('span', {}, !juste ? 'Résultat faux : reprenez en suivant les sous-totaux.' : cl ? `${cl.nom} à cette allure.` : `Juste, au-dessus du temps bronze (${formaterDuree(tempsClassement(d, 'bronze'))}).`),
              h('button', { class: 'btn principal', onclick: () => changer(() => ecran(drillPerso(o.reglages), o)) }, 'Un autre, même réglage'),
              h('button', { class: 'btn', onclick: () => changer(catalogue) }, 'Tous les drills'));
          }
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
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogueTables) }, '← Tables'), h('h1', {}, titre));
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
            // Diagnostic : les produits faux ou plus lents que 2,5 s, travaillés ensuite chaque jour.
            (() => {
              const r = produitsARetravailler(statsTables());
              return r.length
                ? h('p', {}, h('strong', {}, `À retravailler (${r.length}) : `), r.slice(0, 20).map((c) => c.replace('x', ' × ')).join(' · '), '. Ils reviendront dans « Mes produits à retravailler » et dans la séance du jour, jusqu\'à passer sous 2,5 s.')
                : h('p', { class: 'retour ok' }, 'Aucun produit à retravailler : tous sont justes et sous 2,5 s.');
            })(),
            h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(() => ecranTables(mode)) }, 'Recommencer'), h('button', { class: 'btn', onclick: () => changer(catalogueTables) }, 'Toutes les tables'))),
          listeErreurs(b.resultats) ?? '');
        },
      });
      return () => serie.detruire();
    }

    /**
     * Criblage (36 produits en 60 s) et acharnement (les 4 pires produits, en boucle). Le produit
     * s'affiche, on tape la réponse : elle est validée dès que le bon nombre de chiffres est tapé.
     * Le temps compté s'arrête à la PREMIÈRE touche (la frappe n'est pas du calcul).
     */
    function ecranRapide(mode) {
      const crible = mode === 'criblage';
      const liste = crible ? serieCriblage() : null;
      const cibles = crible ? [] : piresProduits(statsTables());
      const acharne = crible ? null : creerAcharnement(cibles);
      const resultats = [];
      let ex = null;
      let debutEx = 0;
      let premiere = null;
      let debut = null;
      let fini = false;
      let attente = false;
      const enonce = h('div', { class: 'operation estimation' });
      const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', 'aria-label': 'Produit' });
      const compteur = h('span', { class: 'compteur' });
      const chrono = h('span', { class: 'compteur chrono' });
      const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const suivi = h('div', { class: 'ligne suivi-acharnement' });
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogueTables) }, '← Tables'), h('h1', {}, crible ? 'Criblage des tables' : 'Acharnement'),
        h('p', { class: 'discret' }, crible ? `Les 36 produits de base, ${CRIBLAGE_S} secondes. Tapez le produit : il est validé tout seul.` : `Vos ${ACHARNEMENT.produits} pires produits. Chacun doit être réussi ${ACHARNEMENT.suite} fois de suite en moins de ${ACHARNEMENT.rapide.toLocaleString('fr-FR')} s (temps jusqu'à la première touche).`),
        h('div', { class: 'ligne' }, h('span', { style: 'flex:1' }), chrono, compteur), enonce, saisie, suivi, retour);
      const majSuivi = () => {
        if (crible) return;
        const e = acharne.etat();
        remplir(suivi, Object.entries(e.suites).map(([c, n]) => h('span', { class: `pastille-table${n >= ACHARNEMENT.suite ? ' ok' : ''}` }, `${c.replace('x', ' × ')} `, '●'.repeat(Math.min(n, ACHARNEMENT.suite)) + '○'.repeat(Math.max(0, ACHARNEMENT.suite - n)))));
      };
      const poser = () => {
        ex = crible ? liste[resultats.length] ?? null : acharne.suivant();
        if (!ex) { fin(); return; }
        attente = false;
        remplir(enonce, `${ex.a} × ${ex.b}`);
        saisie.value = '';
        saisie.disabled = false;
        saisie.focus();
        premiere = null;
        debutEx = performance.now();
        debut ??= debutEx;
        compteur.textContent = crible ? `${resultats.length + 1} / 36` : `question ${resultats.length + 1}`;
        majSuivi();
      };
      const valider = async () => {
        if (attente || fini || !ex) return;
        const reponse = Number(saisie.value);
        const juste = reponse === ex.resultat;
        const t = ((premiere ?? performance.now()) - debutEx) / 1000;
        attente = true;
        saisie.disabled = true;
        resultats.push({ ex, reponse, juste, t });
        acharne?.repondre(juste, t);
        await noterProduit(cleProduit(ex.a, ex.b), juste, t);
        retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
        const lent = juste && !crible && t > ACHARNEMENT.rapide;
        remplir(retour, juste ? (lent ? `Juste, mais en ${t.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s : la suite repart de zéro.` : '✓') : `✗ ${ex.a} × ${ex.b} = ${ex.resultat}`);
        setTimeout(poser, juste ? (lent ? 700 : 120) : 1100);
      };
      saisie.addEventListener('keydown', (e) => { if (/^\d$/.test(e.key)) premiere ??= performance.now(); if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (saisie.value) valider(); } });
      // Validation dès que le nombre de chiffres attendu est tapé (pas d'Entrée : c'est un réflexe).
      saisie.addEventListener('input', () => { if (ex && saisie.value.replace(/\D/g, '').length >= String(ex.resultat).length) valider(); });
      const minuterie = setInterval(() => {
        if (!debut || fini) return;
        const ecoule = performance.now() - debut;
        chrono.textContent = crible ? `${Math.max(0, Math.ceil(CRIBLAGE_S - ecoule / 1000))} s` : formaterDuree(ecoule);
        if (crible && ecoule >= CRIBLAGE_S * 1000) fin();
      }, 100);
      async function fin() {
        if (fini) return;
        fini = true;
        clearInterval(minuterie);
        const dureeMs = performance.now() - (debut ?? performance.now());
        const justes = resultats.filter((r) => r.juste).length;
        saisie.remove();
        remplir(enonce);
        remplir(retour);
        await enregistrerSession({ module: 'drills', mode: `tables-${mode}`, total: resultats.length, justes, dureeMs });
        const nouveau = crible && await proposerMeilleurScore('tables-criblage', justes);
        const lents = resultats.filter((r) => !r.juste || r.t > ACHARNEMENT.lent);
        const cles = [...new Set(lents.map((r) => cleProduit(r.ex.a, r.ex.b)))];
        const e = acharne?.etat();
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, crible ? `${justes} / 36` : e.abandon ? 'Arrêt' : 'Terminé'),
          crible
            ? h('p', {}, `${resultats.length} produit${resultats.length > 1 ? 's' : ''} traité${resultats.length > 1 ? 's' : ''} en ${formaterDuree(dureeMs)}${nouveau ? ' · nouveau record' : ''}.`)
            : h('p', {}, e.abandon ? `${resultats.length} questions sans y arriver : arrêtez-vous là, et reprenez demain. Ces produits resteront vos cibles.` : `Les ${ACHARNEMENT.produits} produits réussis ${ACHARNEMENT.suite} fois de suite, en ${resultats.length} questions et ${formaterDuree(dureeMs)}.`),
          crible ? h('p', {}, cles.length ? [h('strong', {}, `Faux ou plus lents que ${ACHARNEMENT.lent} s (${cles.length}) : `), cles.map((c) => c.replace('x', ' × ')).join(' · '), '. L\'acharnement les prendra pour cibles.'] : 'Aucun produit faux ni lent.') : null,
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => changer(() => ecranRapide(crible && cles.length ? 'acharnement' : mode)) }, crible && cles.length ? 'Acharnement sur les pires' : 'Recommencer'),
            h('button', { class: 'btn', onclick: () => changer(catalogueTables) }, 'Toutes les tables'))));
      }
      let rappel = null;
      if (crible) poser();
      else {
        // Acharnement : d'abord les produits visés AVEC leur résultat, 5 secondes pour les revoir,
        // puis le départ. On ne teste pas la mémoire à froid : on installe la bonne réponse.
        let reste = SECONDES_RAPPEL;
        saisie.style.display = 'none';
        const decompte = h('p', { class: 'consigne' });
        const majDecompte = () => { decompte.textContent = `Relisez-les. Départ dans ${reste} seconde${reste > 1 ? 's' : ''}…`; };
        const bloc = h('div', {}, h('div', { class: 'rappel-acharnement' }, cibles.map(([a, b]) => h('span', {}, `${a} × ${b} = `, h('strong', {}, String(a * b))))), decompte,
          h('button', { class: 'btn', onclick: () => partir() }, 'Partir tout de suite'));
        const partir = () => { clearInterval(rappel); rappel = null; bloc.remove(); saisie.style.display = ''; poser(); };
        majDecompte();
        enonce.before(bloc);
        rappel = setInterval(() => { reste -= 1; if (reste <= 0) partir(); else majDecompte(); }, 1000);
      }
      return () => { fini = true; clearInterval(minuterie); clearInterval(rappel); };
    }

    /**
     * Sprint d'estimation : une touche (1 à 9) valide aussitôt. Juste : couple suivant. Faux : le
     * raisonnement s'affiche (arrondi, vérification, correction), Entrée pour continuer.
     */
    function ecranSprint(cfg) {
      const couples = cfg.couples();
      let i = 0;
      let erreurs = [];
      let debut = null;
      let attente = false;
      const enonce = h('div', { class: 'operation estimation' });
      const compteur = h('span', { class: 'compteur' });
      const chrono = h('span', { class: 'compteur chrono' }, '0,0 s');
      const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const touches = h('div', { class: 'ligne touches-quotient' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('button', { class: 'btn', onclick: () => repondre(n) }, String(n))));
      el.append(h('button', { class: 'lien', onclick: () => changer(catalogueTables) }, '← Tables'), h('h1', {}, cfg.titre),
        h('p', { class: 'discret' }, cfg.consigne),
        h('div', { class: 'ligne' }, h('span', { style: 'flex:1' }), chrono, compteur), enonce, touches, retour);
      const montrer = () => {
        const c = couples[i];
        remplir(enonce, cfg.enonce(c));
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
        remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, '✗'), ` ${cfg.enonce(c)} → `, h('strong', {}, String(c.q)), ` (et non ${n})`),
          h('div', { class: 'detail' }, cfg.explication(c)),
          h('button', { class: 'btn principal', onclick: suivant }, 'Suivant ', h('kbd', {}, 'Entrée')));
      }
      async function fin() {
        clearInterval(minuterie);
        const dureeMs = performance.now() - debut;
        const score = dureeMs + erreurs.length * PENALITE_MS;
        const justes = couples.length - erreurs.length;
        await enregistrerSession({ module: 'drills', mode: cfg.mode, total: couples.length, justes, dureeMs });
        const nouveau = await proposerRecord(cfg.record, score);
        const cl = cfg.classement(score);
        remplir(enonce);
        touches.remove();
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, `${justes} / ${couples.length}`),
          h('p', {}, `Temps ${formaterDuree(dureeMs)} · score ${formaterDuree(score)} (3 s par erreur)${nouveau ? ' · nouveau record !' : ''}`),
          cl ? h('p', {}, badgeClassement(cl.id, cl.nom)) : h('p', { class: 'discret' }, `Bronze à ${formaterDuree(cfg.bronzeMs)}.`),
          erreurs.length ? h('div', {}, h('h3', {}, 'À revoir'), h('ul', {}, erreurs.map((e) => h('li', {}, `${cfg.enonce(e)} → ${e.q} : ${cfg.explication(e)}`)))) : null,
          h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(() => ecranSprint(cfg)) }, 'Recommencer'), h('button', { class: 'btn', onclick: () => changer(catalogueTables) }, 'Toutes les tables'))));
      }
      const table = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), () => repondre(n)]));
      const sans = raccourcis({ ...table, Enter: () => (attente && retour.classList.contains('erreur') ? suivant() : false) });
      montrer();
      return () => { clearInterval(minuterie); sans(); };
    }

    const ecranQuotient = () => ecranSprint({ couples: sprintQuotient, titre: 'Estimation du quotient', mode: 'quotient', record: 'sprint-quotient',
      consigne: 'Tapez le chiffre du quotient (une touche). Le chrono part au premier couple.',
      enonce: (c) => `${c.a} ÷ ${c.b}`, explication: (c) => raisonnement(c.a, c.b), classement: classementQuotient, bronzeMs: CLASSEMENT_QUOTIENT[0].s * COUPLES_SPRINT * 1000 });

    const direct = params.drill ? catalogueDrills().find((d) => d.id === params.drill) : null;
    changer(params.quotient ? ecranQuotient : params.tables === 'criblage' || params.tables === 'acharnement' ? () => ecranRapide(params.tables) : params.tables ? () => ecranTables(params.tables) : direct ? () => ecran(direct) : catalogue);
    return () => nettoyer?.();
  },
};
