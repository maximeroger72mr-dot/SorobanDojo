/**
 * Construit Soroban.html : toute l'application dans UN SEUL fichier HTML autonome
 * (code et styles intégrés), qui s'ouvre d'un double-clic dans n'importe quel navigateur récent.
 * La progression est alors sauvegardée dans le navigateur (localStorage).
 *
 * Usage : npm run html
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));

const resultat = await build({
  entryPoints: [join(racine, 'src/app.js')],
  bundle: true,
  format: 'esm',
  target: ['chrome100', 'firefox100', 'safari15'],
  minify: true,
  write: false,
  legalComments: 'none',
});
// Échappe toute séquence « </script » qui fermerait la balise prématurément.
const js = resultat.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// Styles : base, polices embarquées (base64) et thèmes, dans cet ordre.
const css = ['styles.css', 'polices.css', 'themes.css'].map((f) => readFileSync(join(racine, 'src', f), 'utf8')).join('\n');

const html = `<!DOCTYPE html>
<html lang="fr" data-theme="suisse" data-mode="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soroban</title>
<!-- Fichier généré par scripts/construire-html.mjs (version ${version}). Ne pas modifier à la main. -->
<style>${css}</style>
</head>
<body>
<nav id="navigation" aria-label="Navigation principale"></nav>
<main id="defilement"><div id="ecran" class="contenu"></div></main>
<script type="module">${js}</script>
</body>
</html>
`;
writeFileSync(join(racine, 'Soroban.html'), html);
console.log(`Soroban.html construit (${Math.round(html.length / 1024)} Ko).`);
