/**
 * Un nombre entier écrit en toutes lettres pour la voix de la dictée, avec des dizaines
 * RÉGULIÈRES : septante, huitante, nonante (au lieu de soixante-dix, quatre-vingts,
 * quatre-vingt-dix). À l'oreille, « nonante-trois » se pose directement (9 puis 3), alors que
 * « quatre-vingt-treize » oblige à attendre la fin du mot pour connaître la dizaine.
 * Fonction pure.
 */

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'septante', 'huitante', 'nonante'];

function sous100(n) {
  if (n <= 16) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (!u) return DIZAINES[d];
  if (d === 1) return `dix-${UNITES[u]}`;
  return u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
}

function sous1000(n) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cent = c === 0 ? '' : c === 1 ? 'cent' : `${UNITES[c]} cent`;
  return [cent, r ? sous100(r) : ''].filter(Boolean).join(' ');
}

/** @param {number} n  entier (négatif accepté : « moins … ») */
export function nombreEnMots(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `moins ${nombreEnMots(-n)}`;
  n = Math.floor(n);
  if (n === 0) return UNITES[0];
  const parts = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1000);
  const reste = n % 1000;
  if (milliards) parts.push(`${sous1000(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) parts.push(`${sous1000(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) parts.push(milliers === 1 ? 'mille' : `${sous1000(milliers)} mille`);
  if (reste) parts.push(sous1000(reste));
  return parts.join(' ');
}
