/**
 * Dictée de nombres (読上算, yomiage-zan) : l'ordinateur lit une colonne de nombres à voix haute,
 * l'élève calcule sur son soroban (ou de tête) en écoutant, puis tape le résultat.
 * But : travailler à l'oreille. Débit, pause entre les nombres et voix réglables.
 *
 * Lecture : « On commence. », puis chaque nombre (« moins … » pour une soustraction),
 * puis « C'est tout. ». Les nombres restent courts (1 à 4 chiffres) pour rester dictables.
 */

import { genererColonne, genererColonneVariee, creerMemoire } from '../core/generateur.js';

const memoire = creerMemoire(6);
import { famille } from '../core/motifs.js';
import { motifsAppris, chiffresAppris } from '../core/parcours.js';
import { progression, enregistrerSession, noterReponse, modifierReglages, reglagesUtilisateur } from '../core/progression.js';
import { PALIERS_DICTEE, DICTEES_PAR_SERIE, palierSuivant, libellePalier, paliersSoroban } from '../core/dicteeAnzan.js';
import { lireReponse } from '../core/nombres.js';
import { chargerVoix, parler, taire, voixDisponible, meilleureVoix } from '../ui/voix.js';
import { rendreEnonce } from '../ui/enonce.js';
import { ouvrirExplication } from '../ui/explication.js';
import { h, raccourcis, formaterNombre, formaterDuree, formaterPourcent, remplir } from '../ui/dom.js';

const reglages = { chiffres: 2, nombres: 5, debit: 1, pause: 0.8, soustractions: true, voix: '', questions: 5, support: 'niveau' };
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Colonne à dicter : gestes appris seulement (aucun ami jamais vu). */
function colonneADicter(reglages) {
  const appris = motifsAppris(progression());
  const amis = [...appris].filter((c) => !c.endsWith(':direct'));
  const ops = reglages.soustractions ? ['+', '-'] : ['+'];
  try {
    return genererColonneVariee({ chiffres: reglages.chiffres, lignes: reglages.nombres, autorises: appris, cibles: (amis.length ? amis : famille('direct')).filter((c) => ops.includes(c[0])), ops }, memoire);
  } catch {
    return genererColonne({ chiffres: reglages.chiffres, lignes: reglages.nombres, autorises: null, cibles: famille('direct').filter((c) => ops.includes(c[0])), ops });
  }
}

export default {
  id: 'dictee',
  titre: 'Dictée (yomiage)',
  monter(el, app, params = {}) {
    if (params.support) reglages.support = params.support;
    let actif = true;
    let etat = 'repos'; // repos | lecture | reponse | corrige | fin
    let ex = null;
    let serie = null;
    let debutReponse = 0;
    let dureeCalcul = null;

    const select = (cle, options, conv = Number) => {
      const s = h('select', { onchange: (e) => { reglages[cle] = conv(e.target.value); } }, options.map(([v, t]) => h('option', { value: v }, t)));
      s.value = String(reglages[cle]);
      return s;
    };
    const selVoix = h('select', { onchange: (e) => { reglages.voix = e.target.value; } }, h('option', { value: '' }, 'Meilleure voix installée'));
    chargerVoix().then((voix) => {
      selVoix.append(...voix.map((v) => h('option', { value: v.name }, v.name)));
      selVoix.value = reglages.voix;
      const m = meilleureVoix(voix);
      if (m) selVoix.options[0].textContent = `Meilleure voix installée (${m.name})`;
      if (!voix.length) avertissement.textContent = 'Aucune voix française n\'a été trouvée sur cet ordinateur : la voix par défaut sera utilisée (Windows : Paramètres > Heure et langue > Voix ; Mac : Réglages > Accessibilité > Contenu énoncé).';
    });
    const avertissement = h('p', { class: 'discret' }, voixDisponible() ? '' : 'La synthèse vocale n\'est pas disponible ici.');
    const indicateur = h('div', { class: 'flash-ecran dictee-ecran' }, '🔈');
    const progres = h('div', { class: 'pastilles' });
    const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', placeholder: 'Résultat', autocomplete: 'off', style: 'display:none' });
    const btn = h('button', { class: 'btn principal', onclick: () => action() });
    const btnReecouter = h('button', { class: 'btn', style: 'display:none', onclick: () => lire(true) }, 'Réécouter');
    const retour = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
    saisie.addEventListener('input', () => { if (etat === 'reponse' && dureeCalcul === null && saisie.value.trim()) dureeCalcul = performance.now() - debutReponse; });

    // Dictée anzan : de tête, par paliers (les réglages de longueur et de débit suivent le palier).
    // Deux échelles de paliers : de tête (dictée anzan), ou sur le soroban à son niveau (pas plus
    // de chiffres que dans les leçons validées). Chacune garde son palier.
    const paliers = () => (reglages.support === 'tete' ? PALIERS_DICTEE : paliersSoroban(chiffresAppris(progression())));
    const clePalier = () => (reglages.support === 'tete' ? 'palierDictee' : 'palierDicteeSoroban');
    const palier = () => Math.min(paliers().length - 1, reglagesUtilisateur()[clePalier()] ?? 0);
    const infoPalier = h('p', { class: 'carte', style: 'margin-bottom:12px' });
    const majPalier = () => {
      const tete = reglages.support === 'tete';
      const auto = reglages.support !== 'soroban';
      infoPalier.style.display = auto ? '' : 'none';
      el.querySelectorAll('.reglages .libre').forEach((x) => { x.style.display = auto ? 'none' : ''; });
      if (tete) remplir(infoPalier, h('strong', {}, `Dictée anzan · palier ${palier() + 1} / ${paliers().length}`), ` : ${libellePalier(palier(), paliers())}. Soroban rangé : écoutez, voyez les boules bouger, puis tapez le résultat. Une série fait ${DICTEES_PAR_SERIE} dictées : 4 justes font monter d'un palier.`);
      else if (auto) remplir(infoPalier, h('strong', {}, `À mon niveau · palier ${palier() + 1} / ${paliers().length}`), ` : ${libellePalier(palier(), paliers())}. Uniquement les gestes de vos leçons validées, et pas plus de chiffres que vous n'en avez appris. Une série fait ${DICTEES_PAR_SERIE} dictées : 4 justes font monter d'un palier (plus de nombres, puis plus vite, puis plus de chiffres).`);
    };
    const libre = (x) => { x.classList.add('libre'); return x; };
    const selSupport = select('support', [['niveau', 'sur mon soroban, à mon niveau'], ['soroban', 'sur mon soroban, réglages libres'], ['tete', 'de tête (dictée anzan)']], String);
    selSupport.addEventListener('change', majPalier);
    el.append(h('h1', {}, 'Dictée (yomiage)'),
      h('p', { class: 'discret' }, 'Les nombres sont lus à voix haute ; calculez en écoutant, sans regarder l\'écran : sur votre soroban, ou de tête (dictée anzan, par paliers). Les additions sont lues telles quelles, les soustractions précédées de « moins ».'),
      infoPalier,
      h('div', { class: 'reglages' },
        selSupport,
        libre(select('chiffres', [[1, '1 chiffre'], [2, '2 chiffres'], [3, '3 chiffres'], [4, '4 chiffres']])),
        libre(select('nombres', [3, 5, 7, 10].map((n) => [n, `${n} nombres`]))),
        libre(h('label', {}, 'Débit', select('debit', [[0.7, 'lent'], [0.85, 'posé'], [1, 'normal'], [1.2, 'rapide'], [1.4, 'très rapide']]))),
        libre(h('label', {}, 'Pause', select('pause', [[0.3, '0,3 s'], [0.6, '0,6 s'], [0.8, '0,8 s'], [1.2, '1,2 s'], [2, '2 s']]))),
        libre(select('soustractions', [['true', 'avec soustractions'], ['false', 'additions seules']], (v) => v === 'true')),
        selVoix,
        libre(select('questions', [[5, '5 dictées'], [10, '10 dictées']]))),
      avertissement, h('div', { class: 'ligne' }, progres), indicateur,
      h('div', { class: 'ligne' }, saisie, btn, btnReecouter), retour);

    function majBouton(texte) {
      remplir(btn, texte, ' ', h('kbd', {}, 'Entrée'));
      btn.style.display = texte ? '' : 'none';
    }
    majBouton('Commencer');
    majPalier();
    // Réglages de la série en cours : ceux de l'écran, ou ceux du palier en dictée anzan.
    let r = { ...reglages };
    const reglagesSerie = () => (reglages.support !== 'soroban' ? { ...reglages, ...paliers()[palier()], questions: DICTEES_PAR_SERIE } : { ...reglages });

    async function lire(reecoute = false) {
      etat = 'lecture';
      majBouton('');
      btnReecouter.style.display = 'none';
      saisie.style.display = 'none';
      remplir(retour);
      const o = { debit: r.debit, voix: reglages.voix };
      indicateur.textContent = '🔈';
      await parler('On commence.', o);
      await attendre(Math.min(r.pause, 0.4) * 1000);
      for (let i = 0; i < ex.lignes.length; i++) {
        if (!actif || etat !== 'lecture') return;
        const l = ex.lignes[i];
        indicateur.textContent = `${i + 1} / ${ex.lignes.length}`;
        await parler(`${l.op === '-' ? 'moins ' : ''}${l.n}`, o);
        await attendre(r.pause * 1000);
      }
      if (!actif) return;
      await parler('C\'est tout.', o);
      indicateur.textContent = '?';
      etat = 'reponse';
      saisie.style.display = '';
      saisie.disabled = false;
      if (!reecoute) saisie.value = '';
      saisie.focus();
      majBouton('Valider');
      btnReecouter.style.display = '';
      debutReponse = performance.now();
      dureeCalcul = null;
    }

    async function action() {
      if (etat === 'repos' || etat === 'fin') {
        serie = { index: 0, justes: 0, dureeMs: 0 };
        r = reglagesSerie();
        remplir(progres);
        ex = colonneADicter(r);
        lire();
      } else if (etat === 'reponse') {
        const r = lireReponse(saisie.value);
        if (r === null) return;
        const juste = r === ex.resultat;
        serie.index += 1;
        if (juste) serie.justes += 1;
        serie.dureeMs += dureeCalcul ?? performance.now() - debutReponse;
        await noterReponse(juste);
        saisie.disabled = true;
        btnReecouter.style.display = 'none';
        progres.append(h('span', { class: `pastille-res ${juste ? 'ok' : 'ko'}` }, juste ? '✓' : '✗'));
        indicateur.textContent = formaterNombre(ex.resultat);
        retour.className = `retour ${juste ? 'ok' : 'erreur'}`;
        remplir(retour, h('div', {}, h('span', { class: 'grand-signe' }, juste ? '✓' : '✗'), juste ? ' Juste.' : ` Vous avez trouvé ${formaterNombre(r)}.`),
          h('div', { class: 'discret' }, 'Ce qui a été dicté :'), rendreEnonce(ex, { compact: true, sousTotaux: !juste }),
          juste ? null : h('button', { class: 'btn', onclick: () => ouvrirExplication(ex) }, 'Expliquer'));
        etat = 'corrige';
        majBouton(serie.index >= r.questions ? 'Voir le bilan' : 'Dictée suivante');
      } else if (etat === 'corrige') {
        if (serie.index < r.questions) { ex = colonneADicter(r); lire(); return; }
        etat = 'fin';
        const tete = r.support === 'tete';
        await enregistrerSession({ module: 'dictee', mode: tete ? 'anzan' : 'yomiage', reglages: { ...r }, total: serie.index, justes: serie.justes, dureeMs: serie.dureeMs });
        if (r.support !== 'soroban') {
          const avant = palier();
          const apres = palierSuivant(avant, serie.justes, serie.index, paliers().length);
          if (apres !== avant) await modifierReglages({ [clePalier()]: apres });
          indicateur.textContent = `${serie.justes} / ${serie.index}`;
          retour.className = 'retour';
          remplir(retour, apres > avant ? `Palier ${apres + 1} atteint : ${libellePalier(apres, paliers())}.` : apres < avant ? `On redescend au palier ${apres + 1} : ${libellePalier(apres, paliers())}.` : `On reste au palier ${avant + 1} : il faut 4 justes sur ${DICTEES_PAR_SERIE} pour monter.`);
          majPalier();
          majBouton('Nouvelle série');
          return;
        }
        indicateur.textContent = `${serie.justes} / ${serie.index}`;
        retour.className = 'retour';
        remplir(retour, `Réussite ${formaterPourcent(serie.justes, serie.index)} · ${formaterDuree(serie.dureeMs / serie.index)} en moyenne après la dictée. `,
          serie.justes === serie.index ? 'Parfait : augmentez le débit ou réduisez la pause.' : 'Si les nombres défilent trop vite, baissez le débit ou allongez la pause.');
        majBouton('Nouvelle série');
      }
    }

    const sansRaccourcis = raccourcis({ Enter: () => { if (etat !== 'lecture') action(); } });
    return () => { actif = false; taire(); sansRaccourcis(); };
  },
};
