/**
 * Thème graphique (typographie suisse, voir themes.css) et mode clair / sombre. Le mode est
 * mémorisé dans les réglages ; tout est appliqué par les attributs data-theme et data-mode de <html>.
 */

import { reglagesUtilisateur, modifierReglages } from '../core/progression.js';
import { h } from './dom.js';

/** Thème de l'application (typographie suisse). Seul le mode clair / sombre se choisit. */
export const THEME = 'suisse';
export const MODES = [['auto', 'Clair ou sombre selon le système'], ['clair', 'Clair'], ['sombre', 'Sombre']];

/** Applique le thème et le mode mémorisés, et met à jour tous les sélecteurs affichés. */
export function appliquerTheme() {
  const r = reglagesUtilisateur();
  document.documentElement.dataset.theme = THEME;
  document.documentElement.dataset.mode = r.mode ?? 'auto';
  for (const s of document.querySelectorAll('select[data-reglage="mode"]')) s.value = r.mode ?? 'auto';
}

/** Le choix du mode (clair, sombre, selon le système), prêt à afficher. */
export function selecteursTheme() {
  const choix = (cle, options, libelle) => {
    const s = h('select', { 'data-reglage': cle, 'aria-label': libelle, onchange: async (e) => { await modifierReglages({ [cle]: e.target.value }); appliquerTheme(); } },
      options.map(([v, t]) => h('option', { value: v }, t)));
    s.value = reglagesUtilisateur()[cle] ?? options[0][0];
    return s;
  };
  return [choix('mode', MODES, 'Clair ou sombre')];
}
