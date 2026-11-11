/**
 * Synthèse vocale (voix de l'ordinateur, sans internet) pour la dictée de nombres.
 * Si aucune voix n'est disponible, parler() se termine après une durée estimée, sans planter.
 */

const synthese = typeof window !== 'undefined' ? window.speechSynthesis : null;

export const voixDisponible = () => !!synthese;

/** Voix françaises de l'ordinateur (peut être vide au tout premier appel : voir chargerVoix). */
export function voixFrancaises() {
  return (synthese?.getVoices() ?? []).filter((v) => v.lang?.toLowerCase().startsWith('fr'));
}

/**
 * Meilleure voix française installée : les voix « naturelles » (neuronales) d'abord, bien plus
 * fluides que les voix classiques ; puis les voix en ligne ; puis ce qu'il y a. Le français de
 * France passe avant les autres. La qualité dépend de l'ordinateur : l'application ne fait que
 * choisir la meilleure voix disponible.
 */
export function meilleureVoix(voix = voixFrancaises()) {
  const note = (v) => (/natural|neural|naturelle/i.test(v.name) ? 8 : 0) + (/online|google|siri|premium|enhanced|améliorée/i.test(v.name) ? 4 : 0)
    + (/^fr[-_]fr/i.test(v.lang ?? '') ? 2 : 0) + (v.default ? 1 : 0);
  return [...voix].sort((a, b) => note(b) - note(a))[0] ?? null;
}

/** Attend que la liste des voix soit chargée (certains systèmes la chargent en différé). */
export function chargerVoix() {
  return new Promise((ok) => {
    if (!synthese) { ok([]); return; }
    if (synthese.getVoices().length) { ok(voixFrancaises()); return; }
    const fin = () => ok(voixFrancaises());
    synthese.addEventListener('voiceschanged', fin, { once: true });
    setTimeout(fin, 1500);
  });
}

/**
 * Prononce un texte. Résout à la fin de la phrase (ou après une durée estimée si la voix ne
 * signale pas sa fin).
 * @param {{ debit?: number, voix?: string }} o  debit : 0,5 (lent) à 1,6 (rapide) ; voix : nom
 */
export function parler(texte, o = {}) {
  const estimation = (300 + texte.length * 75) / (o.debit ?? 1);
  if (!synthese) return new Promise((ok) => setTimeout(ok, estimation));
  return new Promise((ok) => {
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = o.debit ?? 1;
    // Voix choisie ; sinon la meilleure voix française installée (et non la voix par défaut du système).
    const voix = voixFrancaises().find((v) => v.name === o.voix) ?? meilleureVoix();
    if (voix) u.voice = voix;
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; ok(); } };
    u.onend = terminer;
    u.onerror = terminer;
    setTimeout(terminer, estimation * 2 + 1000); // filet de sécurité
    synthese.speak(u);
  });
}

export function taire() {
  synthese?.cancel();
}
