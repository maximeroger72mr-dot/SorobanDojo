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

## Principe

Le calcul se fait **sur un vrai soroban**. L'application crée les exercices (colonnes, planches,
multiplications, divisions, drills, sujets d'examen), vérifie le résultat tapé, diagnostique
l'erreur probable et **montre** le geste sur un soroban virtuel quand il faut expliquer.

## Organisation

| Dossier | Rôle |
|---|---|
| `main.cjs`, `preload.cjs` | Processus Electron : fenêtre, menu, sauvegarde JSON dans le dossier utilisateur |
| `src/core/` | Logique pure, sans interface, testée (voir ci-dessous) |
| `src/ui/` | `sorobanVue.js` (soroban SVG de démonstration), `panneauDemo.js` + `lecteurDemo.js` (démonstrations), `explication.js` (« Expliquer »), `serie.js` (exercices un par un), `feuille.js` (feuilles imprimables), `enonce.js`, `dom.js` |
| `src/modules/` | Un fichier par écran. Chaque écran exporte `{ id, titre, monter(conteneur, app) }` |
| `tests/` | Tests `node --test` |

Logique (`src/core/`) :

| Fichier | Rôle |
|---|---|
| `soroban.js` | modèle : tiges, boules, valeur |
| `gestes.js` | méthode japonaise : gestes, explications, classement en **motifs** (`+4:petit`, `-8:mixte`, `cascade+`…) |
| `motifs.js` | catalogue des motifs : noms, geste exact (remédiation), exemple canonique |
| `generateur.js` | colonnes aléatoires **strictement** limitées aux motifs permis, avec répétition maximale de la cible |
| `curriculum.js` | **le parcours** : paliers, sous-paliers, répétitions, explications, démos. À éditer pour changer la progression |
| `multiplication.js` | multiplication 両落とし et division 片落とし : génération et étapes de démonstration |
| `diagnostic.js` | causes probables d'une réponse fausse (ligne oubliée, retenue, céleste, produit décalé…) |
| `drills.js` | 123456789 et variantes, même nombre répété, suite des entiers |
| `epreuves.js` | formats des examens japonais (10e au 1er kyū) et génération des sujets |
| `maitrise.js` | **niveaux d'acquisition** (juste ET rapide), vitesse par chiffre, équilibrage des fréquences. Seuils réglables en tête de fichier |
| `revision.js` | révision espacée (Leitner J+1, J+3, J+7, J+14, J+30) |
| `parcours.js` | gestes appris, grade obtenu / prochain (leçons prérequises), échauffement, défi de la semaine et gestes lents **adaptés au niveau** |
| `regularite.js` | minutes par jour, série de jours (un jour de repos par semaine toléré) |
| `succes.js` | les succès (40, par thème et par palier) |
| `bilan.js` | bilan de séance (instantané au début, comparaison à la fin) |
| `hasard.js` | hasard reproductible (même défi toute la semaine), semaine ISO |
| `progression.js` | sauvegarde : séances, répétitions, diagnostic par motif, révisions, records |

Pour ajouter un écran : créer `src/modules/monEcran.js` et l'ajouter à la liste `ECRANS` de `src/app.js`.

## Règles de manipulation (méthode japonaise standard)

- 1 boule céleste (5) et 4 boules terrestres (1) par tige ; une boule compte quand elle touche la barre.
- Pouce : monte les terrestres. Index : descend les terrestres et manœuvre la céleste.
- Calcul de gauche à droite. Ordre de choix : direct, petit ami (complément à 5), grand ami (complément à 10).
- Grand ami en addition : complément d'abord, retenue ensuite. En soustraction : emprunt d'abord.
- Multiplication 両落とし : aucun facteur posé ; produits de table sur deux tiges ; premier produit
  avec sa dizaine sur la (m+n)-ième tige depuis les unités.
- Division 片落とし : seul le dividende est posé ; chiffre du quotient deux tiges à gauche si le début
  du dividende ≥ diviseur, sinon juste à gauche ; unité du quotient (chiffres du diviseur + 1) tiges à gauche.

## Niveaux d'acquisition

Calculés sur les 30 derniers essais d'un geste ou d'une leçon : réussite ET temps médian des réussites,
ramené à une unité (secondes par chiffre pour les colonnes, par produit partiel pour × et ÷, après
retrait de 1,5 s de lecture et de frappe).

| Niveau | Réussite | Colonnes | × et ÷ |
|---|---|---|---|
| Acquis débutant | ≥ 90 % | ≤ 3 s par chiffre | ≤ 5 s par produit |
| Acquis confirmé | ≥ 95 % | ≤ 1,5 s | ≤ 3 s |
| Acquis expert | ≥ 98 % | ≤ 0,8 s | ≤ 1,8 s |

Une erreur n'est attribuée à un geste que si le résultat le prouve (écart de 5 : boule céleste ;
écart de 1 : retenue ou emprunt, sur une seule ligne possible) ou si l'élève désigne la ligne fautive.

## Épreuves : sources et limites

Mitorizan avec additions et soustractions dès le 10e kyū. Formats d'après les informations publiques du Nihon Shuzan Renmei et de la Chambre de commerce et
d'industrie du Japon (珠算能力検定) : mitorizan 10 problèmes « 10 lignes N chiffres », multiplication et
division 20 problèmes (10 aux 7e-10e kyū), 20 ou 30 minutes, 200 ou 300 points, 240/300 pour les 1er-3e kyū.
Restent à confirmer : les seuils des 4e-10e kyū (70 % indicatif) ; les décimaux et arrondis des 1er-3e kyū
(les sujets sont ici en nombres entiers).
