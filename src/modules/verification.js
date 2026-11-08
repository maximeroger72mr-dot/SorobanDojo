/**
 * Vérifier ma vitesse : 20 colonnes d'une seule famille de gestes (ou d'un seul geste), une par
 * une et chronométrées, pour mesurer leur VRAIE vitesse, sans les colonnes difficiles autour.
 * Proposé par la séance quand une famille paraît plus lente que la famille plus difficile
 * (voir parcours.verificationVitesse). Chaque colonne compte aussi comme un entraînement normal.
 */

import { progression, enregistrerSession, poidsAdaptatifs } from '../core/progression.js';
import { motifsAppris, NOMS_FAMILLES, MESURES_FIABLES } from '../core/parcours.js';
import { genererColonneVariee, creerMemoire } from '../core/generateur.js';
import { famille as familleMotifs, nomMotif } from '../core/motifs.js';
import { mediane, formaterVitesse } from '../core/maitrise.js';
import { creerSerie, listeErreurs } from '../ui/serie.js';
import { h } from '../ui/dom.js';

export const COLONNES_VERIFICATION = 20;

export default {
  id: 'verification',
  titre: 'Vérifier ma vitesse',
  monter(el, app, params = {}) {
    const d = progression();
    const appris = motifsAppris(d);
    const directs = familleMotifs('direct');
    const cibles = params.geste ? [params.geste]
      : params.famille === 'direct' ? directs : familleMotifs(params.famille ?? 'petit').filter((c) => appris.has(c));
    const nom = params.geste ? nomMotif(params.geste) : `vos ${NOMS_FAMILLES[params.famille] ?? 'gestes'}`;
    el.append(h('h1', {}, 'Vérifier ma vitesse'),
      h('p', {}, `${COLONNES_VERIFICATION} colonnes rien qu'avec ${nom}, une par une. Calculez à votre rythme habituel, sans forcer : on mesure votre vraie vitesse, sans les colonnes difficiles qui la ralentissent d'habitude.`));
    if (!cibles.length) {
      el.append(h('p', {}, 'Rien à vérifier pour l\'instant.'));
      return null;
    }
    const memoire = creerMemoire(COLONNES_VERIFICATION);
    const autorises = new Set([...directs, ...cibles]);
    let serie = creerSerie(el, {
      generer: () => genererColonneVariee({ chiffres: 2, lignes: 5, autorises, cibles, poids: poidsAdaptatifs(cibles) }, memoire),
      nombre: COLONNES_VERIFICATION,
      chrono: true,
      surFin: async (b) => {
        serie.detruire();
        serie = null;
        await enregistrerSession({ module: 'verification', mode: params.geste ?? `famille:${params.famille}`, total: b.total, justes: b.justes, dureeMs: b.dureeMs });
        const fam = params.famille;
        const isoles = fam ? progression().vitesseFamilles?.[fam] ?? [] : progression().motifs[params.geste]?.isole ?? [];
        const t = isoles.length ? mediane(isoles.slice(-20)) : null;
        el.append(h('div', { class: 'carte bilan' },
          h('div', { class: 'grand' }, `${b.justes} / ${b.total}`),
          t !== null ? h('p', {}, `Vitesse mesurée seule : `, h('strong', {}, formaterVitesse(t)), isoles.length < MESURES_FIABLES ? ` (encore ${MESURES_FIABLES - isoles.length} colonnes justes pour une mesure fiable)` : '.') : null,
          h('p', { class: 'discret' }, 'Le prof en tient compte dès la prochaine séance : si la vitesse est bonne, rien à faire ; sinon, il proposera de quoi la travailler.'),
          h('button', { class: 'btn principal', onclick: () => app.aller('seance') }, 'Retour à la séance')),
          listeErreurs(b.resultats) ?? '');
      },
    });
    return () => serie?.detruire();
  },
};
