/**
 * Épreuves au format des examens officiels japonais (珠算検定), du 10e au 1er kyū, et 準1 à 準3.
 * Sujet complet (mitorizan, multiplication, division), compte à rebours, notation par points,
 * seuil de réussite, impression possible. Voir core/epreuves.js pour les formats et leurs sources.
 */

import { manquantesEpreuve } from '../core/prerequis.js';
import { avertirPrerequis } from '../ui/avertissement.js';
import { GRADES, genererSujet, totalPoints, SYSTEMES, systemeChoisi, MINUTES_EPREUVE_ZENKOREN, JUSTES_EPREUVE_ZENKOREN } from '../core/epreuves.js';
import { enregistrerSession, progression, proposerMeilleurScore, reglagesUtilisateur, modifierReglages, noterSessionDan } from '../core/progression.js';
import { verdictAllure, allureGrade } from '../core/allure.js';
import { GRADES_ANZAN, genererSujetAnzan, totalPointsAnzan } from '../core/epreuvesAnzan.js';
import { cpm } from '../core/maitrise.js';
import { creerFeuille } from '../ui/feuille.js';
import { boutonNaoshi } from '../ui/naoshi.js';
import { NIVEAUX_DAN_ZENKOREN, NIVEAUX_ANZAN_DAN_ZENKOREN, MATIERES, OPTIONS_DISPO, CLE_DAN_ZENKOREN, CLE_ANZAN_DAN_ZENKOREN, genererSujetDanZenkoren, genererSujetAnzanDanZenkoren, gradeDanZenkoren, niveauAtteintZenkoren, niveauCumule, meilleurNiveau, prochainNiveau } from '../core/danZenkoren.js';
import { NIVEAUX_DAN, MINUTES_EPREUVE_DAN, CLE_DAN, gradeDan, niveauAtteint, meilleurDan, prochainDan } from '../core/dan.js';
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

const NOMS_SECTIONS = { mitori: 'Mitorizan', mitoriA: 'Additions A', mul: 'Multiplication', div: 'Division' };
/** Épreuve isolée (« sprint ») : 10 minutes, 7/10 exigés, comme dans le format par épreuve. */
const MINUTES_SPRINT = 10;
const SEUIL_SPRINT = 0.7;

function resume(g) {
  if (g.systeme === 'zenkoren') {
    const m = g.mitori;
    const lignes = `${m.lignes} lignes de ${m.min === m.max ? m.min : `${m.min} à ${m.max}`} chiffres`;
    const p = [];
    if (g.mul) p.push(`multiplication 15 × (${g.mul.formes ? g.mul.formes.map(([x, y]) => `${x} × ${y}`).join(' ou ') : `${g.mul.total} chiffres au total`})`);
    if (g.div) p.push(`division 15 × (${g.div.formes ? g.div.formes.map(([x, y]) => `÷ ${x}, quotient ${y}`).join(' ou ') : `diviseur + quotient : ${g.div.total} chiffres`})`);
    if (g.mitoriA) p.push(`additions A 15 × (${lignes}, additions seules)`);
    p.push(`${g.mitoriA ? 'additions-soustractions B' : 'additions-soustractions'} 15 × (${lignes})`);
    return p.join(' · ');
  }
  const m = g.mitori;
  const chiffres = m.chiffresParProbleme ? `${m.min} ou ${m.max}` : m.chiffres;
  const moins = `${m.moins} ligne${m.moins > 1 ? 's' : ''} négative${m.moins > 1 ? 's' : ''}`;
  const p = [`Mitorizan ${m.nb} problèmes de ${m.lignes} nombres à ${chiffres} chiffres ; les problèmes 3, 5, 7 et 9 ont ${moins}${m.negatifs?.[0] ? ', le 9 un résultat négatif' : ''}`];
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
  monter(el, app, params = {}) {
    let feuille = null;
    const cleRecord = (g, section = null) => `${g.systeme === 'zenkoren' ? 'zenkoren' : 'epreuve'}-${g.id}${section ? `-${section}` : ''}`;
    const meilleur = (g) => progression().records[cleRecord(g)];

    function liste() {
      feuille?.detruire();
      feuille = null;
      const sys = systemeChoisi(progression());
      const zen = sys.id === 'zenkoren';
      // Le système suivi pour VOTRE grade : chacun garde ses propres résultats.
      const choix = h('div', { class: 'segments', role: 'group', 'aria-label': 'Système de grades' }, Object.values(SYSTEMES).map((x) =>
        h('button', { class: x.id === sys.id ? 'actif' : '', onclick: async () => { await modifierReglages({ systemeGrades: x.id }); liste(); } }, x.id === 'nissho' ? 'Nisshō (par défaut)' : 'Zenkoren (plus exigeant sur le temps)')));
      remplir(el, h('h1', {}, 'Épreuves officielles'),
        h('p', { class: 'discret' }, 'Sujets au format des examens japonais de soroban. Comme à l\'examen : tout sur votre soroban, dans le temps imparti. Choisissez le système qui compte pour votre grade ; les résultats de chacun sont gardés.'),
        choix,
        // Replié sur téléphone (texte long), ouvert d'office sur grand écran.
        h('details', { class: 'carte a-savoir', style: 'margin:12px 0', ...(typeof window === 'undefined' || window.innerWidth > 700 ? { open: true } : {}) }, h('summary', {}, h('strong', {}, 'À savoir : le format des examens')), ' ', zen
          ? `Zenkoren (全国珠算教育連盟) : chaque épreuve a son propre chrono de ${MINUTES_EPREUVE_ZENKOREN} minutes, sans report de temps : multiplication, division, puis additions-soustractions (au 10e kyū, deux épreuves d'additions, A et B ; au 9e, pas de division). 15 problèmes à 10 points par épreuve, et il faut ${JUSTES_EPREUVE_ZENKOREN} justes sur 15 dans CHACUNE : une seule épreuve en dessous, et l'examen est raté. Zenkoren ne publie pas le nombre de chiffres par problème : l'application reprend celui du même grade Nisshō ; les colonnes sont plus courtes, mais il faut aller 1,3 à 1,9 fois plus vite. Un kyū Zenkoren n'est jamais plus facile que le kyū Nisshō du même rang.`
          : 'Nisshō (Chambre de commerce du Japon, 1er au 3e kyū) et Nihon Shuzan Renmei (les autres) : un seul temps pour tout le sujet, une note globale, sans note minimale par partie. Du 10e au 7e kyū : 20 minutes, 200 points, réussite à 120 (60 au 10e kyū, qui a le même sujet que le 9e). Du 6e au 1er kyū : 30 minutes, 300 points, réussite à 210 (4e au 6e) puis 240 (1er au 3e). En mitorizan, les nombres d\'un problème ont tous la même longueur ; les problèmes 3, 5, 7 et 9 mêlent additions et soustractions. Dès le 3e kyū, la moitié des × et ÷ sont en décimaux, arrondis au millième puis à l\'unité (montants) ; aux 1er et 2e kyū, le problème 9 a un résultat négatif. Les grades 準 (préparatoires) s\'intercalent entre le 4e et le 1er kyū ; ils sont facultatifs. Formats contrôlés sur le règlement de shuzan.jp et les sujets modèles officiels.'),
        optionsExamen(),
        h('div', { class: 'liste-grades' }, (zen ? sys.grades : GRADES).map((g) => h('div', { class: `carte grade${g.jun ? ' grade-jun' : ''}` },
          h('div', { class: 'ligne' },
            h('span', { class: `icone etat-${meilleur(g)?.reussi ? 'fait' : 'ouvert'}` }, meilleur(g)?.reussi ? '✓' : '○'),
            h('strong', { style: 'flex:1' }, `${g.nom} (${g.japonais})`),
            h('span', { class: 'discret' }, g.parEpreuve ? `réussite : ${JUSTES_EPREUVE_ZENKOREN} / 15 dans chaque épreuve${meilleur(g) ? ` · meilleur ${meilleur(g).points} / ${totalPoints(g)}${meilleur(g).reussi ? ' ✓' : ''}` : ''}`
              : `réussite ≥ ${Math.round(g.seuil * totalPoints(g))} / ${totalPoints(g)}${meilleur(g) ? ` · meilleur ${meilleur(g).points} / ${totalPoints(g)}` : ''}`)),
          h('div', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' }, resume(g), g.jun ? ' · grade facultatif, hors de la frise des kyū' : '', g.verifie ? '' : ' · lignes, chiffres et temps conformes au barème ; seul le nombre de lignes à soustraire est estimé (pas de sujet modèle en ligne)'),
          ligneAllure(g),
          (() => { const m = manquantesEpreuve(progression(), g.id); return m.length ? h('p', { class: 'discret', style: 'margin:0 0 8px' }, `Conseillé après ${m.length} leçon${m.length > 1 ? 's' : ''} encore à valider, à commencer par « ${m[0].titre} ».`) : null; })(),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn principal', onclick: () => lancer(g) }, g.parEpreuve ? `Examen complet · ${g.minutes / g.minutesEpreuve} × ${g.minutesEpreuve} min` : `Épreuve complète · ${g.minutes} min`),
            (g.parEpreuve ? ['mul', 'div', 'mitoriA', 'mitori'] : ['mitori', 'mul', 'div']).filter((k) => g[k]).map((k) => {
              const r = progression().records[cleRecord(g, k)];
              const nom = k === 'mitori' && g.mitoriA ? 'Additions B' : NOMS_SECTIONS[k];
              return h('button', { class: 'btn', onclick: () => lancer(g, k) }, `${nom} seule · ${g.parEpreuve ? g.minutesEpreuve : MINUTES_SPRINT} min${r ? ` (${r.points} pts)` : ''}`);
            }))))),
        zen ? [carteDanZenkoren(), carteAnzanDanZenkoren()] : carteDan(),
        listeAnzan());
    }

    /**
     * Dan Zenkoren (0.38.3) : 3 matières obligatoires + les options proposées (denpyōzan, anzan),
     * 7 minutes chacune (anzan : 3). Le niveau : la plus basse des matières, sur le meilleur score
     * de chaque matière parmi cette session et les 2 précédentes.
     */
    function carteDanZenkoren() {
      const d = progression();
      const m = meilleurNiveau(d, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN);
      const vise = prochainNiveau(d, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN) ?? NIVEAUX_DAN_ZENKOREN.at(-1);
      const options = Object.fromEntries(OPTIONS_DISPO.map((k) => [k, h('input', { type: 'checkbox', checked: true })]));
      return h('div', { class: 'carte grade', style: 'margin-top:16px' },
        h('div', { class: 'ligne' },
          h('span', { class: `icone etat-${m ? 'fait' : 'ouvert'}` }, m ? '✓' : '○'),
          h('strong', { style: 'flex:1' }, 'Dan d\'entraînement Zenkoren (珠算段位)'),
          h('span', { class: 'discret' }, m ? `meilleur : ${m.japonais}` : `premier palier : ${NIVEAUX_DAN_ZENKOREN[0].japonais}, ${NIVEAUX_DAN_ZENKOREN[0].points} sur 300`)),
        h('p', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' },
          `30 problèmes à 10 points par matière, 7 minutes (anzan : 3). Obligatoires : multiplication (11 à 12 chiffres au total), division (10 à 11), mitorizan (10 lignes, de 3–6 à 5–10 chiffres) ; au choix : denpyōzan (liasse de bordereaux à l'écran) et anzan. L'ōyō keisan et le kaihō ne sont pas encore là : le dan se calcule sur les matières passées. La plus basse fixe le dan, sur le meilleur score de chaque matière parmi cette session et les deux précédentes. Seuils : ${NIVEAUX_DAN_ZENKOREN.map((x) => `${x.japonais} ${x.points}`).join(', ')}. Format des annales ; la part de décimaux, le denpyōzan et l'anzan au choix sont estimés. Prochain palier visé : ${vise.japonais}.`),
        h('div', { class: 'ligne' }, 'Matières au choix : ', OPTIONS_DISPO.map((k) => h('label', {}, options[k], ` ${MATIERES[k].titre}`))),
        h('button', { class: 'btn principal', style: 'margin-top:8px', onclick: () => demarrerDanZenkoren(OPTIONS_DISPO.filter((k) => options[k].checked)) }, 'Examen de dan Zenkoren'));
    }

    function carteAnzanDanZenkoren() {
      const d = progression();
      const m = meilleurNiveau(d, CLE_ANZAN_DAN_ZENKOREN, NIVEAUX_ANZAN_DAN_ZENKOREN);
      return h('div', { class: 'carte grade', style: 'margin-top:12px' },
        h('div', { class: 'ligne' },
          h('span', { class: `icone etat-${m ? 'fait' : 'ouvert'}` }, m ? '✓' : '○'),
          h('strong', { style: 'flex:1' }, 'Dan d\'anzan Zenkoren (暗算段位)'),
          h('span', { class: 'discret' }, m ? `meilleur : ${m.japonais}` : `premier palier : ${NIVEAUX_ANZAN_DAN_ZENKOREN[0].japonais}, ${NIVEAUX_ANZAN_DAN_ZENKOREN[0].points} sur 200`)),
        h('p', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' },
          `De tête : 40 multiplications, 40 divisions, 40 additions-soustractions, 5 points chacune, 3 minutes par matière, des décimaux. La plus basse des trois fixe le grade, sur le meilleur score de chaque matière parmi cette session et les deux précédentes. Seuils : ${NIVEAUX_ANZAN_DAN_ZENKOREN.map((x) => `${x.japonais.replace('暗算', '')} ${x.points}`).join(', ')}. × de 2 × 2 à 4 × 4, ÷ de 4 à 8 chiffres au total, mitori de 3 chiffres sur 5 lignes jusqu'à des nombres à 4 chiffres sur 6 lignes, soustractions sur les 10 derniers. Format des annales ; la part de décimaux est estimée.`),
        h('button', { class: 'btn principal', onclick: () => demarrerAnzanDanZenkoren() }, 'Examen de dan d\'anzan · 3 × 3 min'));
    }

    /** Bilan commun des dan Zenkoren : scores de la session, meilleurs sur 3 sessions, niveau. */
    function bilanDanZ(b, cle, niveaux, max, retour, relancer) {
      const scores = Object.fromEntries(b.parSection.map((x, i) => [cles[i], x.points]));
      const info = h('div', {});
      noterSessionDan(cle, scores).then((sessions) => {
        const { meilleurs, niveau } = niveauCumule(sessions, niveaux);
        if (niveau) proposerMeilleurScore(cle, niveaux.indexOf(niveau) + 1, { niveau: niveau.id, reussi: true });
        const session = niveauAtteintZenkoren(Object.values(scores), niveaux);
        remplir(info,
          h('div', { class: 'grand' }, niveau ? niveau.japonais : 'Pas encore de dan'),
          h('p', {}, `Cette session seule : ${session ? session.japonais : 'sous le premier palier'}. Avec le meilleur de chaque matière sur vos 3 dernières sessions : ${niveau ? `${niveau.nom} (${niveau.japonais})` : `il faut ${niveaux[0].points} sur ${max} dans chacune`}.`),
          h('table', {}, h('tr', {}, ['Matière', 'Justes', 'Points', 'Meilleur (3 sessions)'].map((x) => h('th', {}, x))),
            b.parSection.map((x, i) => h('tr', {}, h('td', {}, x.titre), h('td', {}, `${x.justes} / ${x.total}`), h('td', {}, `${x.points} / ${x.pointsMax}`), h('td', {}, `${meilleurs[cles[i]]}`)))));
        app.majBadges?.();
      });
      let cles = [];
      return { info, poser: (k) => { cles = k; } };
    }

    function demarrerDanZenkoren(options) {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'),
        h('h1', {}, 'Examen de dan Zenkoren (entraînement)'),
        h('p', { class: 'consigne' }, `Les matières l'une après l'autre, chacune avec son temps, sans revenir en arrière. Denpyōzan : tournez les bordereaux avec les flèches ou Page suivante / précédente, et additionnez la ligne demandée sur les bordereaux indiqués.`));
      const vise = prochainNiveau(progression(), CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN) ?? NIVEAUX_DAN_ZENKOREN.at(-1);
      const sujet = genererSujetDanZenkoren(gradeDanZenkoren(vise), options);
      const cles = sujet.sections.map((x) => x.cle);
      feuille = creerFeuille(el, {
        titre: `Dan Zenkoren · ${sujet.sections.length} matières`,
        sections: sujet.sections,
        parEpreuve: true,
        milliers: !!reglagesUtilisateur().examenPur,
        surFin: (b) => {
          enregistrerSession({ module: 'epreuves', mode: 'dan-zenkoren', reglages: { systeme: 'dan-zenkoren', options }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const x = bilanDanZ(b, CLE_DAN_ZENKOREN, NIVEAUX_DAN_ZENKOREN, 300);
          x.poser(cles);
          return h('div', { class: 'carte bilan' }, x.info, h('p', {}, `Temps utilisé : ${formaterDuree(b.dureeMs)}`),
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'dan-zenkoren', retour: () => liste() }), h('button', { class: 'btn', onclick: () => demarrerDanZenkoren(options) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    function demarrerAnzanDanZenkoren() {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'),
        h('h1', {}, 'Examen de dan d\'anzan Zenkoren (entraînement)'),
        h('p', { class: 'consigne' }, 'De tête, soroban rangé : trois matières de 3 minutes, l\'une après l\'autre.'));
      const sujet = genererSujetAnzanDanZenkoren({ id: 'adz', nom: 'Dan d\'anzan Zenkoren' });
      const cles = sujet.sections.map((x) => x.cle);
      feuille = creerFeuille(el, {
        titre: 'Dan d\'anzan Zenkoren · 3 × 3 min · de tête',
        sections: sujet.sections,
        parEpreuve: true,
        surFin: (b) => {
          enregistrerSession({ module: 'epreuves', mode: 'anzan-dan-zenkoren', reglages: { systeme: 'anzan-dan-zenkoren' }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const x = bilanDanZ(b, CLE_ANZAN_DAN_ZENKOREN, NIVEAUX_ANZAN_DAN_ZENKOREN, 200);
          x.poser(cles);
          return h('div', { class: 'carte bilan' }, x.info,
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'anzan-dan-zenkoren', retour: () => liste() }), h('button', { class: 'btn', onclick: () => demarrerAnzanDanZenkoren() }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    /**
     * Dan d'entraînement (0.38), au barème Nisshō : ×, ÷ et mitorizan, 10 minutes et 300 points
     * chacun ; le dan atteint est le plus haut dont le seuil est tenu dans les trois épreuves.
     */
    function carteDan() {
      const d = progression();
      const m = meilleurDan(d);
      const vise = prochainDan(d) ?? NIVEAUX_DAN.at(-1);
      const apres1 = !!d.records['epreuve-1']?.reussi || !!d.records['zenkoren-1']?.reussi;
      return h('div', { class: 'carte grade', style: 'margin-top:16px' },
        h('div', { class: 'ligne' },
          h('span', { class: `icone etat-${m ? 'fait' : 'ouvert'}` }, m ? '✓' : '○'),
          h('strong', { style: 'flex:1' }, 'Dan d\'entraînement (段位, barème Nisshō)'),
          h('span', { class: 'discret' }, m ? `meilleur : ${m.nom} (${m.japonais})` : `premier palier : ${NIVEAUX_DAN[0].japonais}, ${NIVEAUX_DAN[0].points} points sur 300 par épreuve`)),
        h('p', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' },
          `Trois épreuves de 10 minutes, 300 points chacune : 60 multiplications (11 chiffres au total), 60 divisions (10 chiffres au total), entiers, décimaux au millième et montants à l'unité ; 30 mitorizan de 10 lignes de 5 à 10 chiffres, avec résultats négatifs. Pas de compensation : le dan atteint est le plus haut dont le seuil est tenu dans les TROIS épreuves (${NIVEAUX_DAN.map((x) => `${x.japonais} ${x.points}`).join(', ')}). Prochain palier visé : ${vise.nom} (${vise.japonais}).`),
        apres1 ? null : h('p', { class: 'discret', style: 'margin:0 0 8px' }, 'Conseillé après le 1er kyū.'),
        h('button', { class: 'btn principal', onclick: () => demarrerDan() }, 'Examen de dan · 3 × 10 min'));
    }

    function demarrerDan() {
      el.replaceChildren(h('button', { class: 'lien', onclick: () => liste() }, '← Toutes les épreuves'),
        h('h1', {}, 'Examen de dan (entraînement)'),
        h('p', { class: 'consigne' }, 'Trois épreuves de 10 minutes, l\'une après l\'autre, sans revenir en arrière : multiplication, division, mitorizan. Le dan atteint est le plus haut tenu dans les trois.'));
      const vise = prochainDan(progression()) ?? NIVEAUX_DAN.at(-1);
      const g = gradeDan(vise);
      const sujet = genererSujet(g);
      const milliers = !!reglagesUtilisateur().examenPur;
      feuille = creerFeuille(el, {
        titre: `Dan d'entraînement · 3 × ${MINUTES_EPREUVE_DAN} min${milliers ? ' · examen pur' : ''}`,
        sections: sujet.sections,
        parEpreuve: true,
        milliers,
        surFin: (b) => {
          const points = b.parSection.map((x) => x.points);
          const niveau = niveauAtteint(points);
          enregistrerSession({ module: 'epreuves', mode: 'dan', reglages: { systeme: 'dan', niveau: niveau?.id ?? null }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          if (niveau) proposerMeilleurScore(CLE_DAN, NIVEAUX_DAN.indexOf(niveau) + 1, { niveau: niveau.id, reussi: true, dureeMs: b.dureeMs });
          const suivant = NIVEAUX_DAN[niveau ? NIVEAUX_DAN.indexOf(niveau) + 1 : 0];
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, niveau ? `${niveau.nom} (${niveau.japonais})` : 'Pas encore de dan'),
            h('p', {}, niveau ? `Atteint dans les trois épreuves.${suivant ? ` Prochain palier : ${suivant.japonais}, ${suivant.points} points sur 300 dans chacune.` : ' C\'est le plus haut.'}` : `Il faut ${NIVEAUX_DAN[0].points} points sur 300 dans CHAQUE épreuve pour le ${NIVEAUX_DAN[0].japonais}.`),
            h('table', {}, h('tr', {}, ['Épreuve', 'Justes', 'Points', 'Palier tenu'].map((x) => h('th', {}, x))),
              b.parSection.map((x) => { const t = niveauAtteint([x.points]); return h('tr', { class: suivant && x.points < suivant.points ? 'a-retravailler' : '' }, h('td', {}, x.titre), h('td', {}, `${x.justes} / ${x.total}`), h('td', {}, `${x.points} / ${x.pointsMax}`), h('td', {}, t ? t.japonais : '—')); })),
            h('p', {}, `Temps utilisé : ${formaterDuree(b.dureeMs)}`),
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'dan', retour: () => liste() }), h('button', { class: 'btn', onclick: () => demarrerDan() }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    /** Résumé d'un grade d'anzan : « 50 additions de 3 nombres à 1 chiffre ». */
    const resumeAnzan = (g) => {
      const m = g.mitori;
      const chiffres = (s) => (s.longueurs ? `${s.longueurs.reduce((t, x) => t + x, 0)} chiffres en tout (1 ou 2 par nombre)` : `${s.chiffres} chiffre${s.chiffres > 1 ? 's' : ''}`);
      const series = m.series.map((s) => `${s.nb} de ${s.lignes} nombres à ${chiffres(s)}`).join(', ');
      const p = [`${m.series.reduce((t, s) => t + s.nb, 0)} ${m.soustractions ? 'additions et soustractions' : 'additions'} (${series})`];
      const totaux = (f) => [...new Set(f.series.map((s) => s.total))].join(' puis ');
      if (g.mul) p.push(`${g.mul.nb} multiplications (${totaux(g.mul)} chiffres au total)`);
      if (g.div) p.push(`${g.div.nb} divisions (diviseur + quotient : ${totaux(g.div)} chiffres)`);
      if (g.commun) p.push('le même sujet du 7e au 10e kyū : seul le nombre de points décide du grade');
      return p.join(' · ');
    };

    /** Épreuves d'anzan : même feuille, mais tout de tête, soroban rangé. */
    function listeAnzan() {
      const rec = (g) => progression().records[`epreuve-${g.id}`];
      return [h('h2', {}, 'Épreuves d\'anzan (暗算検定)'),
        h('p', { class: 'discret' }, 'Tout de tête, soroban rangé. 12 minutes pour tout le sujet, dans l\'ordre que vous voulez, 500 points. Format du règlement officiel (日本珠算連盟) et du sujet modèle du 1er kyū ; la répartition des points entre les parties n\'est pas publiée (ici 10 par addition, 5 par × ou ÷). Ces épreuves ne comptent pas pour le grade de soroban.'),
        h('div', { class: 'liste-grades' }, GRADES_ANZAN.map((g) => h('div', { class: 'carte grade' },
          h('div', { class: 'ligne' },
            h('span', { class: `icone etat-${rec(g)?.reussi ? 'fait' : 'ouvert'}` }, rec(g)?.reussi ? '✓' : '○'),
            h('strong', { style: 'flex:1' }, `${g.nom} (${g.japonais})`),
            h('span', { class: 'discret' }, `réussite ≥ ${Math.round(g.seuil * totalPointsAnzan(g))} / ${totalPointsAnzan(g)}${rec(g) ? ` · meilleur ${rec(g).points}` : ''}`)),
          h('div', { class: 'discret', style: 'font-size:0.85rem;margin:4px 0 8px' }, resumeAnzan(g), g.jun ? ' · grade facultatif' : '', g.verifie ? '' : ' · sans sujet modèle en ligne : additions seules, par prudence'),
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
        // Un seul temps pour tout le sujet (一括施行), comme à l'examen.
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
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'epreuve-anzan', retour: () => liste() }), h('button', { class: 'btn', onclick: () => demarrerAnzan(g) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
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
      const zen = !!g.parEpreuve;
      const seuil = zen ? g.seuil : section ? Math.max(SEUIL_SPRINT, g.seuil) : g.seuil;
      const milliers = !section && !!g.milliers && !!reglagesUtilisateur().examenPur;
      if (milliers) el.append(h('p', { class: 'consigne' }, 'Examen pur : écrivez les séparateurs de milliers (« 1 234 567 », ou « 12 345,678 »), comme dans les sujets japonais. L\'application compte faux un nombre écrit sans eux, pour en prendre l\'habitude ; le règlement publié ne le précise pas.'));
      const minutes = zen ? (section ? g.minutesEpreuve : g.minutes) : section ? MINUTES_SPRINT : g.minutes;
      if (zen) el.append(h('p', { class: 'consigne' }, section ? `${g.minutesEpreuve} minutes, ${JUSTES_EPREUVE_ZENKOREN} justes sur 15 pour réussir.` : `${sections.length} épreuves de ${g.minutesEpreuve} minutes, l'une après l'autre, sans revenir en arrière : à la fin du temps, on passe à la suivante. ${JUSTES_EPREUVE_ZENKOREN} justes sur 15 dans CHACUNE.`));
      feuille = creerFeuille(el, {
        titre: `${g.nom} (${g.japonais})${zen ? ' · Zenkoren' : ''}${section ? ` · ${NOMS_SECTIONS[section]} seule` : ''} · ${minutes} minutes${!section && reglagesUtilisateur().examenPur ? ' · examen pur' : ''}`,
        minutes,
        sections,
        parEpreuve: zen && !section,
        milliers,
        // Allure : en option, épreuve complète seulement, jamais en examen pur.
        allure: !zen && !section && reglagesUtilisateur().allureExamen && !reglagesUtilisateur().examenPur ? { part: allureGrade(g).part } : null,
        surFin: (b) => {
          // Zenkoren : 10 justes sur 15 dans CHAQUE épreuve ; Nisshō : la note globale.
          const okSection = (x) => x.justes >= JUSTES_EPREUVE_ZENKOREN;
          const reussi = zen ? b.parSection.every(okSection) : b.points >= seuil * max;
          enregistrerSession({ module: 'epreuves', mode: `${zen ? 'z' : ''}${g.id}${section ? `-${section}` : ''}`, reglages: { systeme: zen ? 'zenkoren' : 'nissho', grade: g.id }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          // Seule l'épreuve complète compte pour le grade ; les sprints gardent leur propre record.
          proposerMeilleurScore(cleRecord(g, section), b.points, { reussi, dureeMs: b.dureeMs });
          const echecs = zen ? b.parSection.filter((x) => !okSection(x)) : [];
          return h('div', { class: 'carte bilan' },
            h('div', { class: 'grand' }, `${b.points} / ${max} points`),
            h('p', { class: reussi ? 'retour ok' : 'retour erreur' }, zen
              ? (reussi ? `Réussi : au moins ${JUSTES_EPREUVE_ZENKOREN} justes sur 15 dans chaque épreuve.` : `Pas encore : ${echecs.map((x) => x.titre.split(' (')[0]).join(', ')} sous ${JUSTES_EPREUVE_ZENKOREN} justes sur 15. Une seule épreuve en dessous suffit à rater, quel que soit le total.`)
              : reussi ? `Réussi (seuil ${Math.round(seuil * max)} points).` : `Pas encore : il faut ${Math.round(seuil * max)} points.`),
            h('table', {}, h('tr', {}, ['Épreuve', 'Justes', 'Points'].map((x) => h('th', {}, x))),
              b.parSection.map((s) => h('tr', { class: zen && !okSection(s) ? 'a-retravailler' : '' }, h('td', {}, s.titre), h('td', {}, `${s.justes} / ${s.total}`), h('td', {}, `${s.points} / ${s.pointsMax}`)))),
            h('p', {}, `Temps utilisé : ${formaterDuree(b.dureeMs)}`),
            rapport(app, b.resultats),
            h('div', { class: 'ligne' }, boutonNaoshi(el, b.resultats, { source: 'epreuve', retour: () => liste() }), h('button', { class: 'btn', onclick: () => demarrer(g, section) }, 'Nouveau sujet'), h('button', { class: 'btn', onclick: () => liste() }, 'Toutes les épreuves')));
        },
      });
    }

    // Lancé depuis la séance (examen complet de la semaine) : le sujet du grade, directement.
    const direct = params.grade && params.auto ? systemeChoisi(progression()).grades.find((g) => g.id === params.grade) : null;
    if (params.danZenkoren && params.auto) demarrerDanZenkoren(OPTIONS_DISPO);
    else if (params.dan && params.auto) demarrerDan();
    else if (direct) demarrer(direct);
    else liste();
    return () => feuille?.detruire();
  },
};
