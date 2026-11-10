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
npm run banc       # mesure la qualité des planches (couverture, charge, replis) ; --seuils pour un contrôle
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
| `planche.js` | **planche entière** : graine et code (même graine, même planche), tous les gestes visés présents, colonnes en rampe, bilan |
| `charge.js` | charge d'une colonne d'après ses gestes (direct 0,6 ; petit ami 1 ; grand ami 1,1 ; combinaison et cascade 1,4) |
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
| `nombres.js` | décimaux : lecture des réponses (virgule ou point), arrondis exacts |
| `sauvegarde.js` | export / import (remplacer ou fusionner) |
| `tables.js` | drills des tables de multiplication (81 produits, plus lents, table d'un nombre ou d'un diviseur) |
| `conseils.js` | **conseils « Pour aller plus vite »** (généraux, par palier, par leçon) : à enrichir librement |
| `progression.js` | sauvegarde : séances, répétitions, diagnostic par motif, révisions, records |

Pour ajouter un écran : créer `src/modules/monEcran.js` et l'ajouter à la liste `ECRANS` de `src/app.js`.

## Règles de manipulation (méthode japonaise standard)

- 1 boule céleste (5) et 4 boules terrestres (1) par tige ; une boule compte quand elle touche la barre.
- Pouce : monte les terrestres. Index : descend les terrestres et manœuvre la céleste.
- Calcul de gauche à droite. Ordre de choix : direct, petit ami (complément à 5), grand ami (complément à 10).
- Grand ami en addition : complément d'abord, retenue ensuite. En soustraction : emprunt d'abord.
- Multiplication 両落とし : aucun facteur posé ; produits de table sur deux tiges ; premier produit
  avec sa dizaine sur la (m+n)-ième tige depuis les unités.
- Décimaux : compte signé des chiffres (37,2 → 2 ; 0,85 → 0 ; 0,04 → −1). Multiplication : la dizaine du
  premier produit au rang (compte a + compte b − 1), directement par rapport au point des unités.
  Division : le quotient a compte(dividende) − compte(diviseur) (+1 si le début du dividende ≥ diviseur)
  chiffres avant la virgule. Arrondi : ajouter 5 sur la décimale suivante, puis lire.
- Division 片落とし : seul le dividende est posé ; chiffre du quotient deux tiges à gauche si le début
  du dividende ≥ diviseur, sinon juste à gauche ; unité du quotient (chiffres du diviseur + 1) tiges à gauche.
  Chiffre du quotient ESTIMÉ avec le diviseur arrondi (18 → 20) ; trop grand : corrigé de tête avant
  de poser ; trop petit : +1 au quotient et on retire encore le diviseur.

## Anzan et visualisation

Piste parallèle (`pa` dans `src/core/curriculum.js`) : elle ne bloque jamais le parcours soroban et
le suit avec retard, puisque chaque leçon s'ouvre quand la leçon soroban `apres` est validée.

1. Le cours : voir le soroban dans sa tête.
2. Photo du soroban (1 puis 2 tiges) : un soroban s'affiche un instant, on tape le nombre.
3. Tenir une image : poser un nombre sur le soroban imaginaire, puis comparer (auto-évalué).
4. Anzan par geste. La colonne commence par UN chiffre. La chaîne commence à 2 nombres, s'allonge
   de 1 après 3 réussites de suite et raccourcit de 1 après une erreur. Un petit soroban montre le
   TOTAL qui évolue : il s'estompe avec les réussites (nette, estompée, légère, puis absente).
   Le mini-test se fait à chaîne complète, sans image.
5. 5 nombres à 1 chiffre avec tous les gestes, puis seulement ensuite 2 chiffres.

## Identité graphique

Typographie suisse (`src/themes.css`) : grille asymétrique, noir, blanc et un vermillon, en clair et en
sombre (choix du mode en bas du menu ou dans Progression > Apparence). Trois polices, chacune avec un rôle :
- **Archivo** (« Suisse ») : titres et texte ;
- **IBM Plex Mono** (« Examen Mono ») : les nombres à calculer, c'est-à-dire colonnes (500, 26 à 28 px),
  saisie et correction (700). Chasse fixe : un chiffre = une case, comme une tige du soroban ;
- **Barlow Condensed** (« Chrono Cond ») : la performance, c'est-à-dire chronomètre, records, écart au
  fantôme, scores et statistiques. Jamais dans les colonnes.

Le motif commun est la boule du soroban (`ui/perles.js`). Elle remplace les icônes, les étoiles, les
médailles, la série de jours et les barres de progression.

Les polices sont embarquées en base64 dans `src/polices.css`, généré par `npm run polices` à partir des
paquets @fontsource (licence SIL Open Font License). Aucune requête réseau.

Sous 700 px, le menu devient une barre en bas de l'écran. Les animations sont coupées si le système
demande moins de mouvement. L'impression reste en noir sur blanc, avec le corrigé sur une page séparée.

## Le prof et le menu

- **Menu à 5 entrées** : Aujourd'hui, Apprendre, S'entraîner, Se mesurer, Progression. Les trois
  sections du milieu ouvrent une page de cartes (`modules/hubs.js`), une carte par activité avec sa
  prochaine étape ou son record.
- **Séance du jour (« le prof »)** (`core/prof.js`) :
  - un **mot du prof** : la veille, la décision du jour et pourquoi, l'examen de la semaine, l'objectif ;
  - l'**essentiel**, dans l'ordre et chiffré en minutes : échauffement, révisions, kyū de la semaine
    (en fin de semaine), priorité du jour, **avancer ou ancrer**, consolidation, tables et placement ;
  - le **bonus** : anzan, jeu du jour (il change chaque jour), défi de la semaine, au quotidien.
  - Avancer ou ancrer : on n'avance que si la dernière leçon est acquise (juste ET rapide). Après
    3 jours d'absence, on reprend en ancrant. Une leçon commencée se termine.
- **Kyū de la semaine** (`core/examen.js`) : grades préparatoires du 20e au 11e kyū, un par étape
  du parcours, puis un examen hebdomadaire. 20 colonnes, gestes appris uniquement, temps fixe,
  70 % pour réussir, une seule tentative compte par semaine.
- **Jeux** (`modules/jeux.js`) : le bon geste, complément éclair, survie anzan, chasse à l'erreur.

## Automatiser, tenir, se mesurer

- **Rythme et endurance** (`modules/rythme.js`) :
  - *Marathon ruban* : une colonne sans fin, 5 lignes à la fois, sans remettre à zéro ; sous-total à
    chaque tranche, 1 joker. Ciblé sur un geste, c'est le drill d'automatisation (20 à 50 lignes).
  - *Le lièvre* : la ligne en cours est surlignée, la suivante déjà visible, la passée disparaît, à
    une cadence imposée (+10 % de vitesse toutes les 3 colonnes justes, −10 % après une erreur).
    Il entraîne la lecture anticipée.
- **Mode pur** (planches, marathon, lièvre) : seulement les gestes choisis, aucun geste direct.
  Un geste qui ne peut pas s'enchaîner seul reçoit son miroir (+4 petit ami ↔ −4 petit ami).
- **Rappel doigté** (option) : pouce, index, céleste à côté de chaque ligne. Masqué d'office dans
  une leçon dont le geste est acquis.
- **Plateaux** : temps médians par semaine pour chaque geste et chaque leçon. Moins de 5 % de gain
  en 2 à 3 semaines = plateau. La séance donne alors une **priorité du jour** chiffrée, avec un
  remède qui tourne d'un jour à l'autre : surentraînement au lièvre, marathon, drill rythmé.
  Sans plateau, la priorité va au geste en difficulté, sinon au plus lent.
- **Consolidation** : 2 à 7 jours après une leçon à un seul ami, une planche qui mélange ce geste
  avec les précédents.
- **Défis chrono** : fantôme visible (deux barres, écart affiché à chaque calcul). Sans record, on
  court contre « le maître », calé sur le seuil confirmé. Médailles bronze, argent et or d'après les
  seuils. Défi de la semaine en 3 étoiles (précision, vitesse, sans filet). Contre-la-montre arcade.
  Échelle des kyū en 10 marches.
- **Objectif daté** (séance du jour) : un grade pour une date. L'application calcule les leçons
  restantes, le rythme hebdomadaire nécessaire et le rythme mesuré.
- **Au quotidien** : ticket de caisse, rendu de monnaie, pourcentages (remise, TVA), factures.
- **Résultats négatifs** (leçon facultative, fin du palier 8) : emprunt imaginaire et lecture du complément.

## Niveaux d'acquisition

Calculés sur les 30 derniers essais d'un geste ou d'une leçon : réussite ET temps médian des réussites,
ramené à une unité (secondes par chiffre pour les colonnes, par produit partiel pour × et ÷). Le
chronomètre s'arrête à la première touche tapée : la frappe du résultat n'est pas comptée.

| Niveau | Réussite | Colonnes | × et ÷ |
|---|---|---|---|
| Acquis débutant | ≥ 90 % | ≤ 3 s par chiffre | ≤ 5 s par produit |
| Acquis confirmé | ≥ 95 % | ≤ 1,5 s | ≤ 3 s |
| Acquis expert | ≥ 98 % | ≤ 0,8 s | ≤ 1,8 s |

Une erreur n'est attribuée à un geste que si le résultat le prouve (écart de 5 : boule céleste ;
écart de 1 : retenue ou emprunt, sur une seule ligne possible) ou si l'élève désigne la ligne fautive.

## Épreuves

- 6e au 1er kyū : tableau de référence retenu avec l'utilisateur (mitorizan 10 lignes de 3-4 à 8-10 chiffres,
  multiplication 5 à 11 chiffres au total, division 5 à 10 chiffres diviseur + quotient, seuils 210/300 puis 240/300).
- Décimaux à partir du 3e kyū : la moitié des × et ÷, résultats arrondis au millième (dix-millième pour les ÷ du 1er kyū).
- 10e au 7e kyū : formats publics japonais (Nihon Shuzan Renmei), seuil indicatif de 70 %.
- Soustractions dans le mitorizan dès le 10e kyū.
