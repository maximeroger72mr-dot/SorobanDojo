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
import { famillesApprises, motifsAppris } from '../core/parcours.js';
import { progression, enregistrerSession, proposerMeilleurScore, noterReponse } from '../core/progression.js';
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
];

/** Meilleur score d'un jeu (texte court), pour les cartes et l'accueil. */
export function recordJeu(id) {
  const r = progression().records;
  if (id === 'geste') return r['jeu-geste'] ? `record ${r['jeu-geste'].points} gestes` : null;
  if (id === 'complement') return ['5', '10', '100'].filter((m) => r[`jeu-complement-${m}`]).map((m) => `à ${m} : ${r[`jeu-complement-${m}`].points}`).join(' · ') || null;
  if (id === 'survie') return r['jeu-survie'] ? `record ${r['jeu-survie'].points} nombres` : null;
  if (id === 'chasse') return r['jeu-chasse'] ? `record ${r['jeu-chasse'].points} / 10` : null;
  return null;
}

export default {
  id: 'jeux',
  titre: 'Jeux',
  monter(el, app, params = {}) {
    let nettoyer = null;
    const changer = (f) => { nettoyer?.(); nettoyer = null; remplir(el); nettoyer = f() ?? null; };
    const retour = () => h('button', { class: 'lien', onclick: () => changer(accueil) }, '← Jeux');
    const bilan = (titre, lignes, rejouer) => h('div', { class: 'carte bilan' }, h('div', { class: 'grand' }, titre), lignes.map((l) => h('p', {}, l)),
      h('div', { class: 'ligne' }, h('button', { class: 'btn principal', onclick: () => changer(rejouer) }, 'Rejouer'), h('button', { class: 'btn', onclick: () => changer(accueil) }, 'Tous les jeux')));

    function accueil() {
      el.append(h('h1', {}, 'Jeux'),
        h('p', { class: 'discret' }, 'Des jeux courts, qui entraînent chacun une compétence précise du soroban. Uniquement avec les gestes que vous avez appris.'),
        h('div', { class: 'cartes' }, JEUX.map((j) => h('button', { class: 'carte-hub', onclick: () => changer({ geste, complement, survie, chasse }[j.id]) },
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

    const direct = { geste, complement, survie, chasse }[params.jeu];
    changer(direct ?? accueil);
    return () => nettoyer?.();
  },
};
