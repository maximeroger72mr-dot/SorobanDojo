/**
 * Thème graphique et mode clair / sombre (voir themes.css). Le choix est mémorisé dans les
 * réglages et appliqué par les attributs data-theme et data-mode de <html>.
 */

import { reglagesUtilisateur, modifierReglages } from '../core/progression.js';
import { h } from './dom.js';

/** Thèmes proposés. « Actuel » garde l'ancien style, pour comparer. */
export const THEMES = [['actuel', 'Actuel'], ['examen', 'Feuille d\'examen'], ['chrono', 'Chronométrage'],
  ['suisse', 'Typographie suisse'], ['instrument', 'Instrument'], ['signal', 'Signalétique']];
export const MODES = [['auto', 'Clair ou sombre selon le système'], ['clair', 'Clair'], ['sombre', 'Sombre']];

/** Applique le thème et le mode mémorisés, et met à jour tous les sélecteurs affichés. */
export function appliquerTheme() {
  const r = reglagesUtilisateur();
  document.documentElement.dataset.theme = r.theme ?? 'actuel';
  document.documentElement.dataset.mode = r.mode ?? 'auto';
  for (const s of document.querySelectorAll('select[data-reglage="theme"]')) s.value = r.theme ?? 'actuel';
  for (const s of document.querySelectorAll('select[data-reglage="mode"]')) s.value = r.mode ?? 'auto';
}

/** Les deux listes de choix (thème, mode), prêtes à afficher. */
export function selecteursTheme() {
  const choix = (cle, options, libelle) => {
    const s = h('select', { 'data-reglage': cle, 'aria-label': libelle, onchange: async (e) => { await modifierReglages({ [cle]: e.target.value }); appliquerTheme(); } },
      options.map(([v, t]) => h('option', { value: v }, cle === 'theme' ? `Thème : ${t}` : t)));
    s.value = reglagesUtilisateur()[cle] ?? options[0][0];
    return s;
  };
  return [choix('theme', THEMES, 'Thème graphique'), choix('mode', MODES, 'Clair ou sombre')];
}
