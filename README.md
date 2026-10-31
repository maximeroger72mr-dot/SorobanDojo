# Soroban : apprendre le boulier japonais

Application de bureau (Electron) pour adultes débutants, entièrement en français.

## Utiliser l'application (sans rien installer)

Page **Releases** du dépôt, « Dernière version » (reconstruite automatiquement à chaque envoi sur `main`) :

| Fichier | Pour qui | Comment |
|---|---|---|
| `Soroban.html` | tout le monde | double-clic : s'ouvre dans le navigateur. Progression gardée dans ce navigateur. |
| `Soroban-…-Windows.exe` | Windows | double-clic, aucune installation. Au premier lancement, Windows peut afficher « Windows a protégé votre ordinateur » : *Informations complémentaires* → *Exécuter quand même* (l'application n'est pas signée). |
| `Soroban-…-Mac.dmg` | Mac | ouvrir, glisser Soroban dans Applications. Premier lancement : clic droit → *Ouvrir* (ou Réglages système → Confidentialité et sécurité → *Ouvrir quand même*). |

`Soroban.html` est aussi présent à la racine du dépôt.

## Développer

```bash
npm install
npm start          # lance l'application Electron
npm test           # tests du moteur
npm run html       # reconstruit Soroban.html (fichier unique)
npm run dist:win   # Windows portable (.exe), à lancer sous Windows
npm run dist:mac   # Mac (.dmg), à lancer sous macOS
```

## Organisation

| Dossier | Rôle |
|---|---|
| `main.cjs`, `preload.cjs` | Processus Electron : fenêtre, menu, sauvegarde JSON dans le dossier utilisateur |
| `src/core/` | Logique pure, sans interface, testée (voir ci-dessous) |
| `src/ui/` | `sorobanVue.js` (soroban SVG), `lecteurDemo.js` et `panneauDemo.js` (démonstrations), `exercice.js` (exécution vérifiée d'un exercice), `seance.js` (série d'exercices, diagnostic), `dom.js` |
| `src/modules/` | Un fichier par écran. Chaque écran exporte `{ id, titre, monter(conteneur, app) }` |
| `tests/` | Tests `node --test` |

Logique (`src/core/`) :

| Fichier | Rôle |
|---|---|
| `soroban.js` | modèle : tiges, boules, valeur |
| `gestes.js` | méthode japonaise : gestes, explications, classement en **motifs** (`+4:petit`, `-8:mixte`, `cascade+`…) |
| `motifs.js` | catalogue des motifs : noms, geste exact (remédiation), exemple canonique |
| `verificateur.js` | vérifie chaque mouvement de l'élève (mode pas à pas) |
| `generateur.js` | exercices et planches aléatoires respectant les contraintes d'un palier |
| `curriculum.js` | **le parcours** : paliers, sous-paliers, explications, démos. À éditer pour changer la progression |
| `revision.js` | révision espacée (Leitner J+1, J+3, J+7, J+14, J+30) |
| `progression.js` | sauvegarde : séances, répétitions, diagnostic par motif, cartes de révision |

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
- [x] Leçons guidées : 6 paliers, 28 sous-paliers, démonstrations, 50 répétitions, mini-test
- [x] Gestes vérifiés un par un, diagnostic par motif, remédiation, génération adaptative
- [x] Révisions espacées (Leitner) et révision ciblée des points faibles
- [x] Planches 1/2/3 chiffres sur 5/8/10 lignes, ciblées par motif
- [x] Fichier unique (`Soroban.html`) et versions Windows/Mac construites automatiquement
- [ ] Séries d'addition/soustraction libres
- [ ] Défis chrono, flash anzan
- [ ] Multiplication et division
- [ ] Épreuves au format officiel
