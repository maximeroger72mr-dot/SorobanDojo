# Soroban : apprendre le boulier japonais

Application de bureau (Electron) pour adultes débutants, entièrement en français.

## Lancer

```bash
npm install
npm start          # lance l'application
npm test           # tests du moteur (soroban + gestes)
npm run dist:win   # installeur Windows (.exe), à lancer sous Windows
npm run dist:mac   # image disque Mac (.dmg), à lancer sous macOS
```

## Organisation

| Dossier | Rôle |
|---|---|
| `main.cjs`, `preload.cjs` | Processus Electron : fenêtre, menu, sauvegarde JSON dans le dossier utilisateur |
| `src/core/` | Logique pure, sans interface, testée : `soroban.js` (modèle), `gestes.js` (méthode japonaise), `progression.js`, `aleatoire.js` |
| `src/ui/` | `sorobanVue.js` (soroban SVG interactif), `lecteurDemo.js` (animations), `dom.js` (utilitaires) |
| `src/modules/` | Un fichier par écran. Chaque écran exporte `{ id, titre, monter(conteneur, app) }` |
| `tests/` | Tests `node --test` |

Pour ajouter un écran : créer `src/modules/monEcran.js` et l'ajouter à la liste `ECRANS` de `src/app.js`.

## Règles de manipulation (méthode japonaise standard)

Implémentées dans `src/core/gestes.js` :
- 1 boule céleste (5) et 4 boules terrestres (1) par tige ; une boule compte quand elle touche la barre.
- Pouce : monte les terrestres. Index : descend les terrestres et manœuvre la céleste.
- Calcul de gauche à droite (rang le plus élevé d'abord).
- Ordre de choix : geste direct, puis petit ami (complément à 5), puis grand ami (complément à 10).
- Grand ami en addition : on retire le complément, puis on pose la retenue à gauche.
  En soustraction : on emprunte d'abord à gauche, puis on ajoute le complément.

## État d'avancement

- [x] Soroban virtuel interactif, démonstration animée de tout calcul (soroban libre)
- [x] Lecture et écriture des nombres
- [x] Sauvegarde locale et écran de progression (version simple)
- [ ] Leçons guidées
- [ ] Addition/soustraction, mode pas à pas
- [ ] Défis chrono, flash anzan
- [ ] Multiplication et division
- [ ] Épreuves au format officiel
