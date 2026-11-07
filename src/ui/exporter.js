/** Téléchargement d'une sauvegarde (fichier .json dans Téléchargements). */

import { h } from './dom.js';
import { exporterDonnees, aujourdhui, noterExport } from '../core/progression.js';

export function telechargerTexte(texte, nom) {
  const blob = new Blob([texte], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(a);
  a.click();
  a.remove();
}

/** Exporte la progression actuelle et note la date (rappel d'export). */
export async function telechargerExport() {
  telechargerTexte(exporterDonnees(), `soroban-sauvegarde-${aujourdhui()}.json`);
  await noterExport();
}
