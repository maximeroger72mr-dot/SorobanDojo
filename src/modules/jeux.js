/**
 * Jeux d'entraînement, courts et utiles :
 *  - Le bon geste : une tige et un chiffre, choisir le geste (direct, petit ami, grand ami,
 *    combiné) le plus vite possible. Entraîne la RECONNAISSANCE, juste avant le réflexe.
 *  - Complément éclair : le complément à 5, 10 ou 100 d'un nombre, en 60 s. Le moteur des amis
 *    (et, à 100, le rendu de monnaie).
 *  - Survie anzan : une chaîne de tête qui s'allonge d'un nombre à chaque réussite.
 *  - Chasse à l'erreur : une colonne déjà calculée, un sous-total faux caché ; trouver la ligne
 *    où il apparaît, en vérifiant sur son soroban. Entraîne la vérification (utile en examen).
 * Seuls les gestes appris sont proposés. Chaque jeu garde son record.
 */

import { analyserOperation, genererColonneVariee, creerMemoire, sousTotaux } from '../core/generateur.js';
import { analyserMotif, famille } from '../core/motifs.js';
import { famillesApprises, motifsAppris, chiffresAppris } from '../core/parcours.js';
import { tirerReste, resteJuste, tirerComplement, complementJuste, tirerArrondi, arrondiJuste, tirerGrandNombre, dureeEclairDepart, dureeEclairSuivante } from '../core/sprints.js';
import { progression, enregistrerSession, proposerMeilleurScore, noterReponse, modifierReglages } from '../core/progression.js';
import { lireReponse } from '../core/nombres.js';
import { Soroban } from '../core/soroban.js';
import { SorobanVue } from '../ui/sorobanVue.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h, raccourcis, formaterDuree, formaterNombre, remplir } from '../ui/dom.js';

const hasard = (l) => l[Math.floor(Math.random() * l.length)];
const entier = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const NOMS_REGLES = { direct: 'Direct', petit: 'Petit ami', grand: 'Grand ami', mixte: 'Combiné' };

export const JEUX = [
  { id: 'geste', titre: 'Le bon geste', description: 'Une tige, un chiffre : choisissez le geste le plus vite possible. 30 secondes.' },
  { id: 'complement', titre: 'Complément éclair', description: 'Le complément à 5, à 10 ou à 100 d\'un nombre. 60 secondes.' },
  { id: 'survie', titre: 'Survie anzan', description: 'De tête : la chaîne s\'allonge d\'un nombre à chaque réussite, jusqu\'à l\'erreur.' },
  { id: 'chasse', titre: 'Chasse à l\'erreur', description: 'Un sous-total faux est caché dans la colonne : trouvez la ligne, soroban en main.' },
  { id: 'reste', titre: 'Division avec reste', description: '53 ÷ 7 : combien de fois, et combien il reste ? Le réflexe à avoir avant de diviser. 60 secondes.' },
  { id: 'eclair', titre: 'Lecture éclair', description: 'Un grand nombre s\'affiche un instant : posez-le sur votre soroban, puis tapez-le. La lecture par tranches de 3 chiffres.' },
  { id: 'arrondi', titre: 'Arrondi éclair', description: 'Un nombre avec une décimale de trop : arrondissez au millième ou à l\'unité, sans vous tromper de rang. 60 secondes.' },
  { id: 'negatif', titre: 'Lire un résultat négatif', description: 'Le soroban affiche le complément (99 947 283) : tapez le résultat (−52 717). 60 secondes.' },
];

/** Meilleur score d'un jeu (texte court), pour les cartes et l'accueil. */
export function recordJeu(id) {
  const r = progression().records;
  if (id === 'geste') return r['jeu-geste'] ? `record ${r['jeu-geste'].points} gestes` : null;
  if (id === 'complement') return ['5', '10', '100'].filter((m) => r[`jeu-complement-${m}`]).map((m) => `à ${m} : ${r[`jeu-complement-${m}`].points}`).join(' · ') || null;
  if (id === 'survie') return r['jeu-survie'] ? `record ${r['jeu-survie'].points} nombres` : null;
  if (id === 'chasse') return r['jeu-chasse'] ? `record ${r['jeu-chasse'].points} / 10` : null;
  if (id === 'reste' || id === 'arrondi') return r[`jeu-${id}`] ? `record ${r[`jeu-${id}`].points} points` : null;
  if (id === 'negatif') return [2, 4, 8].filter((c) => r[`jeu-negatif-${c}`]).map((c) => `${c} tiges : ${r[`jeu-negatif-${c}`].points}`).join(' · ') || null;
  if (id === 'eclair') { const d = progression().reglages?.eclair ?? {}; return Object.keys(d).sort((a, b) => a - b).map((c) => `${c} chiffres : ${d[c].toLocaleString('fr-FR')} s`).join(' · ') || null; }
  return null;
}

export default {
  id: 'jeux',
  titre: 'Jeux',
  // Survie anzan est rangée dans « Calcul de tête » : son fil d'Ariane la nomme.
  titreDe: (p = {}) => (p.jeu === 'survie' ? 'Survie anzan' : 'Jeux'),
  paramsRetour: (p = {}) => (p.jeu === 'survie' ? { jeu: 'survie' } : {}),
  monter(el, app, params = {}) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); nettoyer = null; remplir(el); nettoyer = f() ?? null; };
    // Survie anzan est ouverte depuis « Calcul de tête » : le retour y ramène.
    const versListe = () => (params.jeu === 'survie' ? app.aller('entrainer') : changer(accueil));
    const retour = () => h('button', { class: 'lien', onclick: versListe }, params.jeu === 'survie' ? '← S\'entraîner' : '← Jeux');
    const bilan = (titre, lignes, rejouer) => h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, titre), lignes.map((l) => h('p', {}, l)),
      h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(rejouer) }, 'Rejouer'), h('button', { class: 'btn', onclick: versListe }, params.jeu === 'survie' ? 'S\'entraîner' : 'Tous les jeux')));

    function accueil() {
      el.append(h('h1', {}, 'Jeux'),
        h('p', { class: 'discret' }, 'Des jeux courts, qui entraînent chacun une compétence précise du soroban. Uniquement avec les gestes que vous avez appris.'),
        // « Le bon geste » n'a de sens qu'avec au moins deux gestes à choisir (petits amis appris).
        h('div', { class: 'cartes' }, JEUX.filter((j) => j.id !== 'survie' && (j.id !== 'geste' || famillesApprises(progression()).has('petit') || progression().reglages?.decouverte)).map((j) => h('button', { class: 'carte-hub', onclick: () => changer({ geste, complement, survie, chasse, reste, eclair, arrondi, negatif }[j.id]) },
          h('strong', {}, j.titre), h('span', {}, j.description), recordJeu(j.id) ? h('span', { class: 'carte-info' }, recordJeu(j.id)) : null))));
      return null;
    }

    // ------------------------------------------------------------ le bon geste
    function geste() {
      const familles = ['direct', ...['petit', 'grand', 'mixte'].filter((f) => famillesApprises(progression()).has(f))];
      const DUREE = 30000;
      let question = null;
      let justes = 0;
      let faux = 0;
      let fin = false;
      const zoneTige = h('div', { class: 'flash-image', style: 'max-width:180px' });
      const s = new Soroban(3);
      const vue = new SorobanVue(zoneTige, s, { interactif: false });
      const operation = h('div', { class: 'operation', style: 'font-size:2.6rem' });
      const temps = h('strong', {});
      const score = h('span', { class: 'discret' });
      const retourEl = h('div', { class: 'retour' });
      const boutons = familles.map((f, i) => h('button', { class: 'btn', onclick: () => repondre(f) }, NOMS_REGLES[f], ' ', h('kbd', {}, String(i + 1))));
      el.append(retour(), h('h1', {}, 'Le bon geste'),
        h('p', { class: 'discret' }, 'Le soroban montre la valeur de départ. Quel geste faut-il pour faire l\'opération sur la tige des unités ? Répondez au clavier (1, 2, 3…) ou à la souris.'),
        h('div', { class: 'ruban-entete' }, temps, score), h('div', { class: 'bon-geste' }, zoneTige, operation),
        h('div', { class: 'ligne' }, boutons), retourEl);
      function nouvelle() {
        for (let k = 0; k < 500; k++) {
          const v = entier(0, 19);
          const op = Math.random() < 0.5 ? '+' : '-';
          const n = entier(1, 9);
          const a = analyserOperation(v, op, n, 3);
          if (!a || !a.motifs.length) continue;
          const regle = analyserMotif(a.motifs[0]).regle;
          if (!familles.includes(regle) || (question && question.v === v && question.n === n)) continue;
          question = { v, op, n, regle };
          s.definirValeur(v);
          operation.textContent = `${op === '+' ? '+' : '−'} ${n}`;
          return;
        }
      }
      async function repondre(f) {
        if (fin || !question) return;
        const juste = f === question.regle;
        if (juste) justes += 1; else faux += 1;
        await noterReponse(juste);
        retourEl.className = `retour ${juste ? 'ok' : 'erreur'}`;
        retourEl.textContent = juste ? '✓' : `✗ Précédent : ${question.v} ${question.op === '+' ? '+' : '−'} ${question.n}, c'était ${NOMS_REGLES[question.regle].toLowerCase()}.`;
        nouvelle();
      }
      const debut = performance.now();
      const minuterie = setInterval(async () => {
        const reste = Math.max(0, DUREE - (performance.now() - debut));
        temps.textContent = formaterDuree(reste);
        score.textContent = `${justes} juste${justes > 1 ? 's' : ''} · ${faux} erreur${faux > 1 ? 's' : ''}`;
        if (reste === 0 && !fin) {
          fin = true;
          clearInterval(minuterie);
          const points = Math.max(0, justes - faux);
          await enregistrerSession({ module: 'jeux', mode: 'geste', total: justes + faux, justes, dureeMs: DUREE });
          const nouveau = await proposerMeilleurScore('jeu-geste', points);
          el.append(bilan(`${points} point${points > 1 ? 's' : ''}`, [`${justes} justes, ${faux} erreurs (une erreur retire un point).`, nouveau ? 'Nouveau record !' : recordJeu('geste')], geste));
        }
      }, 100);
      const sans = raccourcis(Object.fromEntries(familles.map((f, i) => [String(i + 1), () => repondre(f)])));
      nouvelle();
      return () => { clearInterval(minuterie); sans(); vue.detruire(); };
    }

    // ------------------------------------------------------------ complément éclair
    function complement() {
      const choix = h('div', { class: 'ligne' }, ['5', '10', '100'].map((m) => h('button', { class: 'btn principal', onclick: () => changer(() => partie(Number(m))) }, `Complément à ${m}`)));
      el.append(retour(), h('h1', {}, 'Complément éclair'),
        h('p', { class: 'discret' }, 'Un nombre s\'affiche : tapez ce qu\'il lui manque pour faire 5, 10 ou 100, puis Entrée. 60 secondes. À 5 : les petits amis ; à 10 : les grands amis ; à 100 : la monnaie.'),
        choix, h('p', { class: 'discret' }, recordJeu('complement') ?? 'Pas encore de record.'));
      return null;
    }
    function partie(m) {
      const DUREE = 60000;
      let n = null;
      let justes = 0;
      let faux = 0;
      let fin = false;
      const nombre = h('div', { class: 'flash-ecran' });
      const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: `complément à ${m}` });
      const temps = h('strong', {});
      const score = h('span', { class: 'discret' });
      const retourEl = h('div', { class: 'retour' });
      el.append(h('button', { class: 'lien', onclick: () => changer(complement) }, '← Complément éclair'), h('h1', {}, `Complément à ${m}`),
        h('div', { class: 'ruban-entete' }, temps, score), nombre, h('div', { class: 'ligne' }, saisie), retourEl);
      const nouveau = () => {
        let x;
        do x = m === 100 ? entier(1, 99) : entier(1, m - 1); while (x === n);
        n = x;
        nombre.textContent = String(n);
        saisie.value = '';
        saisie.focus();
      };
      const valider = async () => {
        if (fin) return;
        const r = lireReponse(saisie.value);
        if (r === null) return;
        const juste = r === m - n;
        if (juste) justes += 1; else faux += 1;
        await noterReponse(juste);
        retourEl.className = `retour ${juste ? 'ok' : 'erreur'}`;
        retourEl.textContent = juste ? '✓' : `✗ ${n} + ${m - n} = ${m}`;
        nouveau();
      };
      const sans = raccourcis({ Enter: () => valider() });
      const debut = performance.now();
      const minuterie = setInterval(async () => {
        const reste = Math.max(0, DUREE - (performance.now() - debut));
        temps.textContent = formaterDuree(reste);
        score.textContent = `${justes} juste${justes > 1 ? 's' : ''} · ${faux} erreur${faux > 1 ? 's' : ''}`;
        if (reste === 0 && !fin) {
          fin = true;
          clearInterval(minuterie);
          saisie.disabled = true;
          const points = Math.max(0, justes - faux);
          await enregistrerSession({ module: 'jeux', mode: `complement-${m}`, total: justes + faux, justes, dureeMs: DUREE });
          const record = await proposerMeilleurScore(`jeu-complement-${m}`, points);
          el.append(bilan(`${points} point${points > 1 ? 's' : ''}`, [`${justes} justes, ${faux} erreurs.`, record ? 'Nouveau record !' : ''], () => partie(m)));
        }
      }, 100);
      nouveau();
      return () => { clearInterval(minuterie); sans(); };
    }

    // ------------------------------------------------------------ sprints de 60 secondes
    /**
     * Sprint générique : une question, une réponse, Entrée, la suivante ; 60 secondes.
     * Score : justes moins erreurs (on ne gagne rien à taper au hasard).
     * @param {{ cle, titre, consigne, tirer, rendre, juste, correction, aide, retourVers, mode }} d
     */
    function sprint(d) {
      const DUREE = 60000;
      let q = null;
      let justes = 0;
      let faux = 0;
      let fin = false;
      const ecran = h('div', { class: 'flash-ecran sprint-ecran' });
      const saisie = h('input', { type: 'text', inputmode: d.clavier ?? 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: d.aide });
      const temps = h('strong', {});
      const score = h('span', { class: 'discret' });
      const retourEl = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      el.append(h('button', { class: 'lien', onclick: () => changer(d.retourVers) }, `← ${d.titreRetour ?? d.titre}`), h('h1', {}, d.titre),
        h('p', { class: 'discret' }, d.consigne),
        h('div', { class: 'ruban-entete' }, temps, score), ecran, h('div', { class: 'ligne' }, saisie), retourEl);
      const nouveau = () => { q = d.tirer(q); remplir(ecran, d.rendre(q)); saisie.value = ''; saisie.focus(); };
      const valider = async () => {
        if (fin || !saisie.value.trim()) return;
        const juste = d.juste(q, saisie.value);
        if (juste === null) return;
        if (juste) justes += 1; else faux += 1;
        await noterReponse(juste);
        retourEl.className = `retour ${juste ? 'ok' : 'erreur'}`;
        retourEl.textContent = juste ? '✓' : `✗ ${d.correction(q)}`;
        nouveau();
      };
      const sans = raccourcis({ Enter: () => valider() });
      const debut = performance.now();
      const minuterie = setInterval(async () => {
        const reste = Math.max(0, DUREE - (performance.now() - debut));
        temps.textContent = formaterDuree(reste);
        score.textContent = `${justes} juste${justes > 1 ? 's' : ''} · ${faux} erreur${faux > 1 ? 's' : ''}`;
        if (reste === 0 && !fin) {
          fin = true;
          clearInterval(minuterie);
          saisie.disabled = true;
          const points = Math.max(0, justes - faux);
          await enregistrerSession({ module: 'jeux', mode: d.mode ?? d.cle, total: justes + faux, justes, dureeMs: DUREE });
          const record = await proposerMeilleurScore(`jeu-${d.cle}`, points);
          el.append(bilan(`${points} point${points > 1 ? 's' : ''}`, [`${justes} justes, ${faux} erreurs.`, record ? 'Nouveau record !' : ''], d.rejouer));
        }
      }, 100);
      nouveau();
      return () => { clearInterval(minuterie); sans(); };
    }

    // Division avec reste : quotient puis reste, deux touches (« 74 » pour 7 reste 4).
    function reste() {
      return sprint({
        cle: 'reste', titre: 'Division avec reste', retourVers: accueil, titreRetour: 'Jeux', rejouer: reste, aide: 'quotient puis reste',
        consigne: 'Dans 53, combien de fois 7, et combien reste-t-il ? Tapez le quotient PUIS le reste, collés : 53 ÷ 7 → 74 (7 fois, reste 4). Reste nul : 56 ÷ 7 → 80. Pas de soroban : c\'est le réflexe qui prépare la division.',
        tirer: (prec) => tirerReste(prec),
        rendre: (q) => q.texte,
        juste: (q, texte) => resteJuste(q, texte),
        correction: (q) => `${q.texte} : ${q.correction} → ${q.attendu}`,
      });
    }

    // Arrondi : au millième ou à l'unité.
    function arrondi() {
      return sprint({
        cle: 'arrondi', titre: 'Arrondi éclair', retourVers: accueil, titreRetour: 'Jeux', rejouer: arrondi, aide: 'arrondi', clavier: 'decimal',
        consigne: 'Arrondissez au rang demandé : on regarde le chiffre SUIVANT ; 5 ou plus, on arrondit au-dessus. À l\'examen, la première moitié des multiplications et des divisions s\'arrondit au millième, la seconde à l\'unité : se tromper de rang coûte le point.',
        tirer: (prec) => tirerArrondi(prec),
        rendre: (q) => [h('div', {}, q.texte), h('div', { class: 'consigne-arrondi' }, `arrondir ${q.consigne}`)],
        juste: (q, texte) => { const r = lireReponse(texte, 3); return r === null ? null : arrondiJuste(q, r); },
        correction: (q) => `${q.texte} ${q.consigne} : ${q.correction}`,
      });
    }

    // Lecture du complément : le soroban affiche le complément d'un résultat négatif.
    function negatif() {
      const choix = h('div', { class: 'ligne' }, [2, 4, 8].map((c) => h('button', { class: 'btn principal', onclick: () => changer(() => partieNegatif(c)) }, `${c} tiges`)));
      el.append(retour(), h('h1', {}, 'Lire un résultat négatif'),
        h('p', { class: 'discret' }, 'Quand une colonne passe sous zéro, on emprunte un 1 imaginaire et le soroban affiche le COMPLÉMENT du résultat. Lecture : le complément à 9 de chaque chiffre, à 10 pour le dernier chiffre non nul. Ici, rien à calculer : le soroban s\'affiche, vous tapez le résultat (le signe moins est facultatif). 60 secondes.'),
        choix, h('p', { class: 'discret' }, recordJeu('negatif') ?? 'Pas encore de record.'));
      return null;
    }
    function partieNegatif(chiffres) {
      let vue = null;
      const fin = sprint({
        cle: `negatif-${chiffres}`, mode: 'negatif', titre: `Lire un résultat négatif · ${chiffres} tiges`, retourVers: negatif, titreRetour: 'Lire un résultat négatif', rejouer: () => partieNegatif(chiffres), aide: 'résultat',
        consigne: `Emprunt imaginaire de ${(10 ** chiffres).toLocaleString('fr-FR')} : le soroban affiche le complément. Tapez le résultat négatif.`,
        tirer: (prec) => tirerComplement(chiffres, prec),
        rendre: (q) => {
          vue?.detruire();
          const zone = h('div', { class: 'photo-soroban' });
          const s = new Soroban(chiffres);
          s.definirValeur(q.affiche);
          vue = new SorobanVue(zone, s, { interactif: false });
          return zone;
        },
        juste: (q, texte) => { const r = lireReponse(texte); return r === null ? null : complementJuste(q, r); },
        correction: (q) => q.correction,
      });
      return () => { fin(); vue?.detruire(); };
    }

    // ------------------------------------------------------------ lecture éclair
    function eclair() {
      const d = progression();
      const conseille = Math.min(10, Math.max(3, chiffresAppris(d) + 1));
      const choix = h('div', { class: 'ligne', style: 'flex-wrap:wrap' }, [3, 4, 5, 6, 7, 8, 9, 10].map((c) => h('button', { class: c === conseille ? 'btn principal' : 'btn', onclick: () => changer(() => partieEclair(c)) }, `${c} chiffres`)));
      el.append(retour(), h('h1', {}, 'Lecture éclair'),
        h('p', { class: 'discret' }, 'Un nombre s\'affiche un court instant, puis disparaît. Posez-le sur votre soroban, puis tapez ce que le soroban affiche. On ne lit pas chiffre par chiffre : on prend chaque tranche de 3 chiffres d\'un bloc (« 407 », « 258 »), repérée par les points de la barre. La durée d\'affichage raccourcit quand vous réussissez, et elle est gardée pour chaque longueur. Utile bien avant les colonnes longues.'),
        choix, h('p', { class: 'discret' }, recordJeu('eclair') ? `Durée atteinte : ${recordJeu('eclair')}` : `Conseillé à votre niveau : ${conseille} chiffres.`));
      return null;
    }
    function partieEclair(chiffres) {
      const TOTAL = 8;
      let actif = true;
      let n = null;
      let k = 0;
      let justes = 0;
      let serie = 0;
      let phase = 'pret';
      let duree = progression().reglages?.eclair?.[chiffres] ?? dureeEclairDepart(chiffres);
      const ecran = h('div', { class: 'flash-ecran' });
      const saisie = h('input', { type: 'text', inputmode: 'numeric', class: 'saisie-nombre', autocomplete: 'off', placeholder: 'ce que votre soroban affiche', disabled: true });
      const btn = h('button', { class: 'btn principal', onclick: () => action() });
      const info = h('span', { class: 'discret' });
      const retourEl = h('div', { class: 'retour', role: 'status', 'aria-live': 'polite' });
      const majBouton = (texte) => { remplir(btn, texte, ' ', h('kbd', {}, 'Entrée')); btn.style.display = texte ? '' : 'none'; };
      const majInfo = () => { info.textContent = `nombre ${Math.min(k + 1, TOTAL)} / ${TOTAL} · ${justes} juste${justes > 1 ? 's' : ''} · affichage ${duree.toLocaleString('fr-FR')} s`; };
      el.append(h('button', { class: 'lien', onclick: () => changer(eclair) }, '← Lecture éclair'), h('h1', {}, `Lecture éclair · ${chiffres} chiffres`),
        h('div', { class: 'ruban-entete' }, info), ecran, h('div', { class: 'ligne' }, saisie, btn), retourEl);
      async function montrer() {
        phase = 'affiche';
        majBouton('');
        remplir(retourEl);
        saisie.value = '';
        saisie.disabled = true;
        n = tirerGrandNombre(chiffres, n);
        const cible = n;
        ecran.textContent = formaterNombre(n);
        await new Promise((ok) => setTimeout(ok, duree * 1000));
        if (!actif || n !== cible) return;
        ecran.textContent = '· · ·';
        phase = 'reponse';
        saisie.disabled = false;
        saisie.focus();
        majBouton('Valider');
      }
      async function action() {
        if (phase === 'pret' || phase === 'suite') { montrer(); return; }
        if (phase !== 'reponse') return;
        const r = lireReponse(saisie.value);
        if (r === null) return;
        const juste = r === n;
        k += 1;
        if (juste) { justes += 1; serie += 1; } else serie = 0;
        await noterReponse(juste);
        duree = dureeEclairSuivante(duree, chiffres, juste, serie);
        await modifierReglages({ eclair: { ...(progression().reglages?.eclair ?? {}), [chiffres]: duree } });
        ecran.textContent = formaterNombre(n);
        saisie.disabled = true;
        retourEl.className = `retour ${juste ? 'ok' : 'erreur'}`;
        retourEl.textContent = juste ? '✓ Juste.' : `✗ Vous avez tapé ${formaterNombre(r)}. Lisez par tranches de 3 chiffres, de gauche à droite.`;
        majInfo();
        if (k >= TOTAL) {
          phase = 'fin';
          majBouton('');
          await enregistrerSession({ module: 'jeux', mode: 'eclair', reglages: { chiffres }, total: TOTAL, justes, dureeMs: TOTAL * duree * 1000 });
          el.append(bilan(`${justes} / ${TOTAL}`, [`Affichage atteint : ${duree.toLocaleString('fr-FR')} s pour ${chiffres} chiffres. Vous repartirez de là.`], () => partieEclair(chiffres)));
          return;
        }
        phase = 'suite';
        majBouton('Nombre suivant');
      }
      majInfo();
      majBouton('Afficher le premier nombre');
      const sans = raccourcis({ Enter: () => action() });
      return () => { actif = false; sans(); };
    }

    // ------------------------------------------------------------ survie anzan
    function survie() {
      const choix = h('div', { class: 'ligne' }, [2.5, 2, 1.5, 1].map((d) => h('button', { class: d === 2 ? 'btn principal' : 'btn', onclick: () => changer(() => chaine(d)) }, `${d.toLocaleString('fr-FR')} s par nombre`)));
      el.append(retour(), h('h1', {}, 'Survie anzan'),
        h('p', { class: 'discret' }, 'De tête, sans soroban (doigts dans l\'air). On commence à 2 nombres à 1 chiffre ; chaque réussite en ajoute un. La première erreur arrête la partie : votre score est la plus longue chaîne réussie.'),
        choix, h('p', { class: 'discret' }, recordJeu('survie') ?? 'Pas encore de record.'));
      return null;
    }
    function chaine(duree) {
      const appris = motifsAppris(progression());
      const amis = [...appris].filter((c) => !c.endsWith(':direct'));
      const memoire = creerMemoire(4);
      let longueur = 2;
      let meilleure = 0;
      let perdu = false;
      el.append(h('button', { class: 'lien', onclick: () => changer(survie) }, '← Survie anzan'), h('h1', {}, 'Survie anzan'));
      const serie = creerSerie(el, {
        generer: () => ({ ...genererColonneVariee({ chiffres: 1, lignes: longueur, autorises: appris, cibles: amis.length ? amis : famille('direct'), premierCourt: true }, memoire), motifs: undefined, flash: { duree, image: 0 } }),
        nombre: Infinity,
        defi: true,
        compteur: () => `chaîne de ${longueur} nombres`,
        fin: () => perdu,
        surExercice: (res) => { if (res.juste) { meilleure = longueur; longueur += 1; } else perdu = true; },
        surFin: async (b) => {
          serie.detruire();
          await enregistrerSession({ module: 'jeux', mode: 'survie', reglages: { duree }, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
          const record = await proposerMeilleurScore('jeu-survie', meilleure, { duree });
          el.append(bilan(`${meilleure} nombres`, [`Plus longue chaîne réussie à ${duree.toLocaleString('fr-FR')} s par nombre.`, record ? 'Nouveau record !' : recordJeu('survie')], () => chaine(duree)), listeErreurs(b.resultats) ?? '');
        },
      });
      return () => serie.detruire();
    }

    // ------------------------------------------------------------ chasse à l'erreur
    function chasse() {
      const appris = motifsAppris(progression());
      const amis = [...appris].filter((c) => !c.endsWith(':direct'));
      const memoire = creerMemoire(10);
      const MANCHES = 10;
      let manche = 0;
      let justes = 0;
      let question = null;
      const debut = performance.now();
      const zone = h('div', {});
      const entete = h('div', { class: 'ruban-entete' });
      const retourEl = h('div', { class: 'retour' });
      el.append(retour(), h('h1', {}, 'Chasse à l\'erreur'),
        h('p', { class: 'discret' }, 'Refaites la colonne sur votre soroban en comparant à chaque ligne avec le sous-total affiché. Cliquez la PREMIÈRE ligne dont le sous-total est faux.'),
        entete, zone, retourEl);
      function nouvelle() {
        retourEl.className = 'retour';
        remplir(retourEl);
        entete.textContent = `Manche ${manche + 1} / ${MANCHES} · ${justes} juste${justes > 1 ? 's' : ''}`;
        const col = genererColonneVariee({ chiffres: 2, lignes: 7, autorises: appris, cibles: amis.length ? amis : famille('direct') }, memoire);
        const st = sousTotaux(col.lignes);
        // L'erreur : un geste raté (une boule, la céleste, une retenue) à partir d'une ligne.
        let k;
        let ecart;
        do {
          k = entier(1, col.lignes.length - 1);
          ecart = hasard([1, -1, 5, -5, 10, -10]);
        } while (st.slice(k).some((x) => x + ecart < 0));
        const affiches = st.map((x, i) => (i >= k ? x + ecart : x));
        question = { k, ecart, vrai: st[k] };
        remplir(zone, h('table', { class: 'colonne' }, col.lignes.map((l, i) => h('tr', { class: 'cliquable', onclick: () => choisir(i) },
          h('td', { class: 'signe' }, i === 0 ? '' : l.op === '+' ? '' : '−'),
          h('td', { class: 'nombre' }, formaterNombre(l.n)),
          h('td', { class: 'sous-total' }, `= ${formaterNombre(affiches[i])}`)))));
      }
      async function choisir(i) {
        if (!question) return;
        const juste = i === question.k;
        const q = question;
        question = null;
        if (juste) justes += 1;
        await noterReponse(juste);
        const nature = Math.abs(q.ecart) === 5 ? 'la céleste' : Math.abs(q.ecart) === 10 ? 'une retenue ou un emprunt' : 'une boule terrestre';
        retourEl.className = `retour ${juste ? 'ok' : 'erreur'}`;
        remplir(retourEl, `${juste ? '✓' : '✗'} L'erreur était à la ligne ${q.k + 1} : le sous-total juste est ${formaterNombre(q.vrai)} (écart de ${q.ecart > 0 ? '+' : ''}${q.ecart} : ${nature}).`);
        manche += 1;
        setTimeout(async () => {
          if (manche < MANCHES) { nouvelle(); return; }
          const dureeMs = performance.now() - debut;
          await enregistrerSession({ module: 'jeux', mode: 'chasse', total: MANCHES, justes, dureeMs });
          const record = await proposerMeilleurScore('jeu-chasse', justes, { dureeMs });
          remplir(zone);
          el.append(bilan(`${justes} / ${MANCHES}`, [`Temps : ${formaterDuree(dureeMs)}.`, record ? 'Nouveau record !' : recordJeu('chasse')], chasse));
        }, juste ? 900 : 2600);
      }
      nouvelle();
      return null;
    }

    // Complément éclair lancé directement à 5 ou à 10 (échauffement de la séance).
    const direct = params.jeu === 'complement' && params.cible ? () => partie(params.cible)
      : params.jeu === 'eclair' && params.chiffres ? () => partieEclair(params.chiffres)
        : { geste, complement, survie, chasse, reste, eclair, arrondi, negatif }[params.jeu];
    changer(direct ?? accueil);
    return () => nettoyer?.();
  },
};
