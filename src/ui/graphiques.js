/**
 * Graphiques de la progression (SVG fait main, sans bibliothèque).
 *
 * Règles suivies (méthode « dataviz ») :
 *  - une seule teinte (bleu) pour les grandeurs ordonnées : clair = peu, foncé = beaucoup ;
 *  - le vert et le rouge restent réservés au juste / faux ;
 *  - traits fins (2 px), grille et axes discrets, info-bulle au survol, légende présente ;
 *  - le texte reste en encre de texte, jamais dans la couleur des données.
 */

import { h, remplir } from './dom.js';
import { NIVEAUX } from '../core/maitrise.js';
import { ajouterJours } from '../core/revision.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (nom, attrs = {}, ...enfants) => {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  enfants.flat().forEach((c) => c && e.append(c));
  return e;
};

/**
 * Couleurs des niveaux d'acquisition, comme des médailles : bronze (en progrès), argent (acquis
 * débutant), or (confirmé), platine violet (expert). Teintes bien distinctes ; le texte de chaque
 * case garde le nom du niveau, la couleur n'est jamais la seule information.
 */
// Les valeurs sont des variables CSS : chaque thème (themes.css) redéfinit ses couleurs.
export const COULEUR_NIVEAU = {
  decouverte: 'var(--niveau-decouverte)', progres: 'var(--niveau-progres)', debutant: 'var(--niveau-debutant)', confirme: 'var(--niveau-confirme)', expert: 'var(--niveau-expert)',
};
export const ENCRE_NIVEAU = {
  decouverte: 'var(--encre-decouverte)', progres: 'var(--encre-progres)', debutant: 'var(--encre-debutant)', confirme: 'var(--encre-confirme)', expert: 'var(--encre-expert)',
};

// ------------------------------------------------------------------ info-bulle partagée

let bulle = null;
export function montrerBulle(evt, contenu) {
  if (!bulle) {
    bulle = h('div', { class: 'infobulle', role: 'tooltip' });
    document.body.append(bulle);
  }
  remplir(bulle, ...(Array.isArray(contenu) ? contenu : [contenu]));
  bulle.style.display = 'block';
  const x = Math.min(evt.clientX + 14, window.innerWidth - bulle.offsetWidth - 8);
  const y = Math.max(8, evt.clientY - bulle.offsetHeight - 10);
  bulle.style.left = `${x}px`;
  bulle.style.top = `${y}px`;
}
export function cacherBulle() {
  if (bulle) bulle.style.display = 'none';
}

// ------------------------------------------------------------------ calendrier de régularité

const PALIERS_MINUTES = [
  { min: 0, couleur: 'var(--cal-0)', libelle: 'aucune pratique' },
  { min: 0.01, couleur: 'var(--cal-1)', libelle: 'moins de 10 min' },
  { min: 10, couleur: 'var(--cal-2)', libelle: '10 à 19 min' },
  { min: 20, couleur: 'var(--cal-3)', libelle: '20 à 39 min' },
  { min: 40, couleur: 'var(--cal-4)', libelle: '40 min et plus' },
];
const palierMinutes = (m) => [...PALIERS_MINUTES].reverse().find((p) => m >= p.min);

/**
 * Calendrier des 18 dernières semaines : une case par jour, plus foncée selon les minutes.
 * @param {Object<string, number>} minutes  minutes par date 'AAAA-MM-JJ'
 */
export function calendrier(minutes, aujourdhui, semaines = 18) {
  const c = 14;
  const pas = c + 2; // 2 px d'écart entre les cases
  const [a, mo, j] = aujourdhui.split('-').map(Number);
  const jourSemaine = (new Date(a, mo - 1, j).getDay() + 6) % 7; // lundi = 0
  const premier = ajouterJours(aujourdhui, -(semaines - 1) * 7 - jourSemaine);
  const largeur = 30 + semaines * pas;
  const svg = s('svg', { viewBox: `0 0 ${largeur} ${7 * pas + 18}`, class: 'calendrier', role: 'img', 'aria-label': 'Calendrier de pratique' });
  ['L', '', 'M', '', 'V', '', 'D'].forEach((t, i) => t && svg.append(s('text', { x: 0, y: 18 + i * pas + 11, class: 'axe-texte' }, t)));
  let moisPrecedent = -1;
  let derniereEtiquette = -10;
  for (let sem = 0; sem < semaines; sem++) {
    for (let d = 0; d < 7; d++) {
      const date = ajouterJours(premier, sem * 7 + d);
      if (date > aujourdhui) continue;
      const m = minutes[date] ?? 0;
      const mois = Number(date.slice(5, 7));
      if (d === 0 && mois !== moisPrecedent) {
        // Pas deux étiquettes de mois trop proches (évite les chevauchements).
        if (sem - derniereEtiquette >= 3) {
          svg.append(s('text', { x: 30 + sem * pas, y: 10, class: 'axe-texte' }, new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { month: 'short' })));
          derniereEtiquette = sem;
        }
        moisPrecedent = mois;
      }
      const rect = s('rect', { x: 30 + sem * pas, y: 18 + d * pas, width: c, height: c, rx: 2, style: `fill:${palierMinutes(m).couleur}`, class: 'case-jour' });
      const texte = `${new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${m ? `${Math.max(1, Math.round(m))} min` : 'pas de pratique'}`;
      rect.addEventListener('pointermove', (e) => montrerBulle(e, texte));
      rect.addEventListener('pointerleave', cacherBulle);
      svg.append(rect);
    }
  }
  const legende = h('div', { class: 'legende' }, 'Moins',
    PALIERS_MINUTES.map((p) => h('span', { class: 'pastille-legende', style: `background:${p.couleur}`, title: p.libelle })), 'Plus');
  return h('div', { class: 'graphique' }, svg, legende);
}

// ------------------------------------------------------------------ volume par semaine

/**
 * Volume par semaine (barres) : exercices ou chiffres calculés, sur les 12 dernières semaines
 * (lundi → dimanche). Une seule teinte ; la valeur au survol et au-dessus de la barre la plus haute.
 * @param {Object<string, number>} parJour  { 'AAAA-MM-JJ': valeur }
 */
export function barresSemaines(parJour, aujourdhui, unite, semaines = 12) {
  const [a, mo, j] = aujourdhui.split('-').map(Number);
  const jourSemaine = (new Date(a, mo - 1, j).getDay() + 6) % 7;
  const lundi = ajouterJours(aujourdhui, -jourSemaine);
  const valeurs = Array.from({ length: semaines }, (_, k) => {
    const debut = ajouterJours(lundi, -(semaines - 1 - k) * 7);
    let v = 0;
    for (let d = 0; d < 7; d++) v += parJour[ajouterJours(debut, d)] ?? 0;
    return { debut, v: Math.round(v) };
  });
  const L = 560;
  const H = 180;
  const m = { g: 10, d: 10, h: 22, b: 22 };
  const max = Math.max(1, ...valeurs.map((x) => x.v));
  const larg = (L - m.g - m.d) / semaines;
  const svg = s('svg', { viewBox: `0 0 ${L} ${H}`, class: 'courbe', role: 'img', 'aria-label': `Volume par semaine (${unite})` });
  valeurs.forEach((x, k) => {
    const hb = ((H - m.h - m.b) * x.v) / max;
    const rect = s('rect', { x: m.g + k * larg + 3, y: H - m.b - hb, width: larg - 6, height: Math.max(hb, x.v ? 1 : 0), class: 'barre-volume' });
    const texte = `Semaine du ${new Date(`${x.debut}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${x.v.toLocaleString('fr-FR')} ${unite}`;
    rect.addEventListener('pointermove', (e) => montrerBulle(e, texte));
    rect.addEventListener('pointerleave', cacherBulle);
    svg.append(rect);
    if (k % 2 === (semaines - 1) % 2) svg.append(s('text', { x: m.g + k * larg + larg / 2, y: H - 6, class: 'axe-texte', 'text-anchor': 'middle' }, new Date(`${x.debut}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })));
    if (x.v === max && x.v && valeurs.findIndex((y) => y.v === max) === k) svg.append(s('text', { x: m.g + k * larg + larg / 2, y: H - m.b - hb - 6, class: 'axe-texte', 'text-anchor': 'middle' }, x.v.toLocaleString('fr-FR')));
  });
  const total = valeurs.reduce((t, x) => t + x.v, 0);
  return h('div', { class: 'graphique' }, h('div', { class: 'titre-graphique' }, `${total.toLocaleString('fr-FR')} ${unite} sur 12 semaines · cette semaine : ${valeurs.at(-1).v.toLocaleString('fr-FR')}`), svg);
}

// ------------------------------------------------------------------ courbe de vitesse d'un geste

/**
 * Cadence (chiffres par minute, CPM) des essais réussis récents (médiane glissante sur 5) : la
 * courbe MONTE quand on progresse. Seuils des niveaux en pointillés (20, 40, 75 CPM).
 */
export function courbeVitesse(hist, famille = 'addsub') {
  const reussis = hist.filter((x) => x.ok && x.t != null).map((x) => x.t);
  if (reussis.length < 5) return h('p', { class: 'discret' }, 'Pas encore assez d\'essais réussis pour tracer la courbe.');
  const glissante = reussis.map((_, i) => {
    const f = reussis.slice(Math.max(0, i - 4), i + 1).sort((a, b) => a - b);
    return 60 / f[Math.floor(f.length / 2)];
  });
  const unite = famille === 'addsub' ? 'CPM' : 'par min';
  const L = 560;
  const H = 220;
  const m = { g: 40, d: 110, h: 12, b: 28 };
  const seuils = NIVEAUX.filter((n) => n.temps).map((n) => ({ nom: n.nom, v: 60 / n.temps[famille] }));
  const ymax = Math.max(...glissante, seuils[1].v) * 1.15;
  const x = (i) => m.g + (i / Math.max(1, glissante.length - 1)) * (L - m.g - m.d);
  const y = (v) => m.h + (1 - v / ymax) * (H - m.h - m.b);
  const svg = s('svg', { viewBox: `0 0 ${L} ${H}`, class: 'courbe', role: 'img', 'aria-label': 'Évolution de la cadence en chiffres par minute' });
  // grille et axe (discrets)
  const pasY = ymax > 120 ? 40 : ymax > 60 ? 20 : 10;
  for (let v = 0; v <= ymax; v += pasY) {
    svg.append(s('line', { x1: m.g, x2: L - m.d, y1: y(v), y2: y(v), class: 'grille' }),
      s('text', { x: m.g - 6, y: y(v) + 4, class: 'axe-texte', 'text-anchor': 'end' }, `${v}`));
  }
  svg.append(s('text', { x: m.g, y: H - 6, class: 'axe-texte' }, `essais réussis (${reussis.length} derniers gardés)`));
  // seuils des niveaux, étiquetés directement
  for (const t of seuils) {
    if (t.v > ymax) continue;
    svg.append(s('line', { x1: m.g, x2: L - m.d, y1: y(t.v), y2: y(t.v), class: 'seuil' }),
      s('text', { x: L - m.d + 6, y: y(t.v) + 4, class: 'axe-texte' }, t.nom.replace('Acquis ', '')));
  }
  // la courbe
  svg.append(s('polyline', { points: glissante.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'trace' }));
  // survol : réticule + info-bulle
  const reticule = s('line', { y1: m.h, y2: H - m.b, class: 'reticule', style: 'display:none' });
  const point = s('circle', { r: 4, class: 'point', style: 'display:none' });
  const zone = s('rect', { x: m.g, y: m.h, width: L - m.g - m.d, height: H - m.h - m.b, fill: 'transparent' });
  zone.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const i = Math.max(0, Math.min(glissante.length - 1, Math.round(((px - m.g) / (L - m.g - m.d)) * (glissante.length - 1))));
    reticule.setAttribute('x1', x(i)); reticule.setAttribute('x2', x(i)); reticule.style.display = '';
    point.setAttribute('cx', x(i)); point.setAttribute('cy', y(glissante[i])); point.style.display = '';
    montrerBulle(e, `Essai ${i + 1} : ${Math.round(glissante[i])} ${unite} (${(60 / glissante[i]).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} s par ${famille === 'addsub' ? 'chiffre' : 'produit'}, médiane des 5 derniers)`);
  });
  zone.addEventListener('pointerleave', () => { reticule.style.display = 'none'; point.style.display = 'none'; cacherBulle(); });
  svg.append(reticule, point, zone);
  return h('div', { class: 'graphique' }, h('div', { class: 'titre-graphique' }, famille === 'addsub' ? 'Cadence en chiffres par minute (CPM, essais réussis) : plus haut = plus rapide' : 'Cadence (par minute, essais réussis)'), svg);
}

