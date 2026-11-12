/** Version de l'application (tenue égale à package.json : un test le vérifie). */
export const VERSION_APPLI = '0.24.3';

/** Compare deux versions « a.b.c » : négatif si a < b, 0 si égales, positif si a > b. */
export function comparerVersions(a, b) {
  const pa = String(a ?? '0').split('.').map(Number);
  const pb = String(b ?? '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}
