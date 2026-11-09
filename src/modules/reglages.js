/**
 * Réglages : tout ce qui n'est pas « où j'en suis ».
 *  - Sauvegarde (exporter, importer, dernier export, tout effacer) : en premier, c'est la seule
 *    protection des données ;
 *  - Apparence (thème, clair / sombre) ;
 *  - Parcours : mode découverte, test de positionnement ;
 *  - Aide : « Comment ça marche » en 5 points, revoir l'accueil ;
 *  - Version.
 */

import {
  progression, exporterDonnees, importerDonnees, versionNavigateur, noterExport, toutEffacer, reglagesUtilisateur, modifierReglages,
} from '../core/progression.js';
import { telechargerExport } from '../ui/exporter.js';
import { VERSION_APPLI } from '../core/version.js';
import { selecteursTheme } from '../ui/theme.js';
import { ouvrirDialogue } from '../ui/panneauDemo.js';
import { h } from '../ui/dom.js';

/** Comment ça marche : les 5 points à connaître (aussi pour qui revient après une absence). */
export const COMMENT_CA_MARCHE = [
  ['La séance du jour', 'L\'écran « Aujourd\'hui » propose chaque jour un plan : d\'abord l\'essentiel (échauffement, révisions, votre point faible, la leçon), puis un bonus. Chaque point se coche quand il est fait ; la séance se termine d\'elle-même.'],
  ['Une leçon en trois temps', 'Comprendre (le geste, en démonstration), s\'entraîner sur VOTRE soroban (le compteur indique le volume), puis le mini-test. Les leçons d\'amis ajoutent « Reconnaître » : choisir le bon geste avant de l\'exécuter.'],
  ['Les révisions', 'Une leçon validée revient après 1, 3, 7, 14 et 30 jours : 10 calculs pour l\'entretenir. Réussie, elle s\'espace ; ratée, elle revient plus tôt.'],
  ['Les grades', 'Les kyū préparatoires (20e au 11e) jalonnent le parcours ; les kyū officiels (10e au 1er) suivent le format japonais. Tous deux sont dans Se mesurer → Grades, ouverts en permanence : un échec ne coûte rien.'],
  ['La sauvegarde', versionNavigateur ? 'Votre progression vit dans ce navigateur : exportez-la régulièrement (ci-dessus), surtout avant de changer d\'appareil ou d\'effacer les données de navigation.' : 'Votre progression est enregistrée sur cet ordinateur, avec une copie par jour. Exportez-la pour la garder ailleurs ou changer d\'appareil.'],
];

/** Apparence : thème graphique et mode clair / sombre . */
function sectionApparence() {
  return h('div', {}, h('h2', {}, 'Apparence'), h('div', { class: 'reglages' }, ...selecteursTheme()));
}

/** Sauvegarde : export (fichier, presse-papiers) et import (remplacer ou fusionner). */
function sectionSauvegarde(app) {
  const d0 = progression();
  const message = h('p', { class: 'discret' });
  const telecharger = async () => {
    await telechargerExport();
    message.textContent = 'Fichier de sauvegarde créé (dossier Téléchargements).';
  };
  const copier = async () => {
    const texte = exporterDonnees();
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      const zone = h('textarea', {}, texte);
      document.body.append(zone);
      zone.select();
      document.execCommand('copy');
      zone.remove();
    }
    await noterExport();
    message.textContent = 'Sauvegarde copiée dans le presse-papiers.';
  };
  // Tout effacer : double confirmation, et proposition d'export juste avant.
  const effacer = async () => {
    if (!window.confirm('Effacer TOUTE votre progression (leçons, révisions, records, réglages) ? Cette action est définitive.')) return;
    if (window.confirm('Exporter d\'abord une sauvegarde, au cas où ? (OK : exporter puis effacer ; Annuler : effacer sans exporter)')) await telechargerExport();
    if (!window.confirm('Dernière confirmation : tout effacer maintenant ?')) return;
    await toutEffacer();
    app.aller('seance');
  };
  const importer = () => ouvrirDialogue('Importer une sauvegarde', 'Choisissez un fichier .json exporté, ou collez le texte copié.', (corps) => {
    const fichier = h('input', { type: 'file', accept: '.json,application/json' });
    const zone = h('textarea', { class: 'zone-import', placeholder: 'ou collez ici le texte de la sauvegarde' });
    const mode = h('select', {}, h('option', { value: 'fusionner' }, 'Fusionner avec mes données (garder le meilleur des deux)'), h('option', { value: 'remplacer' }, 'Remplacer mes données'));
    const erreur = h('p', { class: 'retour erreur' });
    fichier.addEventListener('change', async () => { zone.value = await fichier.files[0]?.text() ?? ''; });
    corps.append(fichier, zone, h('div', { class: 'ligne' }, mode,
      h('button', { class: 'btn principal', onclick: async (e) => {
        try {
          if (mode.value === 'remplacer' && !window.confirm('Remplacer toutes vos données actuelles par cette sauvegarde ?')) return;
          await importerDonnees(zone.value, mode.value);
          e.target.closest('dialog').close();
          app.aller('reglages');
        } catch (err) {
          erreur.textContent = err.message;
        }
      } }, 'Importer')), erreur);
    return null;
  });
  return h('div', {}, h('h2', {}, 'Sauvegarde'),
    versionNavigateur
      ? h('p', {}, h('strong', {}, 'Version navigateur : '), 'votre progression est enregistrée dans CE navigateur, sur CET appareil, pas dans le fichier Soroban.html. Effacer les données de navigation, changer de navigateur ou d\'appareil la fait disparaître. Exportez-la régulièrement (un rappel s\'affiche si le dernier export date de plus de 14 jours).')
      : h('p', { class: 'discret' }, 'L\'application garde votre progression sur cet ordinateur, avec une copie automatique par jour (les 5 dernières, dans le dossier « sauvegardes » à côté du fichier de progression). Exportez pour la garder ailleurs ou la passer à la version navigateur.'),
    h('p', { class: 'discret' }, `Ce qui est enregistré : vos résultats (séances, leçons, gestes, records), vos réglages et votre texte « Mon pourquoi ». Rien n'est envoyé sur Internet.${d0.dernierExport ? ` Dernier export : ${new Date(`${d0.dernierExport}T12:00`).toLocaleDateString('fr-FR')}.` : ''}`),
    h('div', { class: 'ligne' },
      h('button', { class: 'btn', onclick: telecharger }, 'Exporter (fichier .json)'),
      h('button', { class: 'btn', onclick: copier }, 'Copier dans le presse-papiers'),
      h('button', { class: 'btn', onclick: importer }, 'Importer une sauvegarde')),
    message,
    h('div', { class: 'ligne', style: 'margin-top:18px' }, h('button', { class: 'btn danger', onclick: effacer }, 'Tout effacer…')));
}


export default {
  id: 'reglages',
  titre: 'Réglages',
  monter(el, app) {
    const decouverte = h('label', {},
      h('input', { type: 'checkbox', checked: reglagesUtilisateur().decouverte, onchange: async (ev) => { await modifierReglages({ decouverte: ev.target.checked }); } }),
      ' Mode découverte : ouvrir toutes les leçons et activités sans attendre la validation. L\'entraînement et le mini-test restent nécessaires pour valider ; les avertissements « conseillé après… » disparaissent.');
    el.append(h('h1', {}, 'Réglages'),
      sectionSauvegarde(app),
      sectionApparence(),
      h('h2', {}, 'Parcours'),
      h('div', { class: 'carte' }, decouverte,
        h('p', { style: 'margin-bottom:0' }, 'Vous avez déjà pratiqué ? ',
          h('button', { class: 'lien', onclick: () => app.aller('positionnement') }, 'Tester mon niveau'),
          ' : 4 paliers de 8 colonnes, et les leçons maîtrisées sont validées.')),
      h('h2', {}, 'Comment ça marche'),
      h('div', { class: 'carte' }, h('ol', { class: 'comment-ca-marche' }, COMMENT_CA_MARCHE.map(([t, x]) => h('li', {}, h('strong', {}, t), ' : ', x)))),
      h('div', { class: 'ligne' },
        h('button', { class: 'btn', onclick: () => app.aller('seance', { accueil: true }) }, 'Revoir l\'accueil'),
        h('button', { class: 'btn', onclick: () => app.aller('lexique') }, 'Lexique')),
      h('p', { class: 'discret', style: 'margin-top:24px' }, `Soroban, version ${VERSION_APPLI}${versionNavigateur ? ' (navigateur)' : ''}.`));
    return null;
  },
};
