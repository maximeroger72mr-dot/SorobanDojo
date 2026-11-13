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

- Référentiel : Chambre de commerce et d'industrie du Japon (1er au 3e kyū), Ligue japonaise du soroban (4e au 10e kyū).
- 1er au 6e kyū : 10 mitorizan, 20 multiplications, 20 divisions, 30 minutes, 300 points (réussite à 240, ou 210 du 4e au 6e).
- Mitorizan : lignes de longueur fixe (10, 8, 6, 5, 4, 3 chiffres du 1er au 6e kyū) ; un résultat négatif au 1er kyū.
- × et ÷ du 1er au 3e kyū : un problème sur deux en décimaux, arrondi au millième dans la première moitié, à l'unité dans la seconde.
- 10e au 7e kyū : formats inspirés des fiches publiques, 20 minutes, seuil indicatif de 70 %.
- Chaque grade porte `verifie: false` tant que sa fiche officielle n'a pas été contrôlée : l'écran indique « format indicatif ».
- **Allure** (`core/allure.js`) : pour chaque grade, la cadence à tenir pour traiter la part exigée du sujet dans le temps, en face de celle de l'élève. Pendant l'épreuve, l'avance ou le retard s'affiche en option ; l'« examen pur » le masque d'office.
- **Épreuves d'anzan** (`core/epreuvesAnzan.js`) : 12 minutes, de tête ; format venu de sources non officielles, en partie reconstitué.

## Nouveautés de la version 0.22

- **Planches** : planche tirée en entier (tous les gestes visés présents), code de planche, « Rejouer », charge affichée, colonnes en rampe ; `npm run banc` mesure la qualité.
- **Reprise** : sur une planche, une colonne fausse peut être reprise tout de suite, seulement si l'erreur est repérée sur une ligne précise (3 au plus). Les colonnes ratées reviennent le lendemain, puis à J+3 et J+7.
- **Lièvre** : la cadence atteinte est gardée pour chaque réglage ; la course ne s'arrête qu'à la 2e erreur, ou sur demande.
- **Parcours** : chaque kyū n'exige que les leçons de son épreuve ; décimaux après le palier 5e-4e kyū ; palier « Vers le 1er kyū » (7 à 10 chiffres, × 6 × 5, ÷ 5 × 5, arrondi à l'unité, résultats négatifs) ; leçon de stratégie d'examen ; mini-tests où chaque geste de la leçon est posé.
- **Anzan** : leçons de multiplication et de division de tête, dictée anzan par paliers, épreuves d'anzan.

## Nouveautés de la version 0.27

- **Marches** pour 2 × 2 et pour la division par 2 chiffres ; 30 répétitions au moins dans toutes les leçons de multiplication et de division.
- **Un exemple à faire soi-même** dans chaque leçon, avec résultat et démonstration sur demande.
- **Divisions avec reste** sur les feuilles (deux cases), pyramide à départ réglable.
- **Anzan** : flash en plein écran, nombre au centre ; le petit soroban d'aide des leçons peut être retiré.
- **Séance** : leçon plus longue, et une leçon dont les gestes sont déjà en or n'est plus bloquée.

## Nouveautés de la version 0.26

- **Leçons par petites marches** : quatre marches avant « 2 chiffres × 1 chiffre » et quatre avant la division à quotient de 2 chiffres, une difficulté à la fois.
- **Planches en pyramide** : de plus en plus de chiffres, ou de plus en plus de lignes. Parts réglables de soustractions, de zéros et d'arrondis.
- **Flash et tapis roulant** : profils de vitesse, vitesse qui monte tant que les réponses sont justes, et reprise du même calcul (au besoin plus lentement) après une erreur.

## Nouveautés de la version 0.25

- **Tables** : criblage des 36 produits en une minute, et acharnement sur vos 4 pires produits jusqu'à 3 réussites rapides de suite.
- **Anzan** : nombre centré sur un écran vide, vitesse qui s'ajuste seule, tapis roulant, colonne qui s'efface ligne à ligne, distracteurs (éclats lumineux, voix parasite).
- **Diagnostic du franchissement** : une erreur de 10, 100 ou 1 000 au passage d'un rang (99 → 100) est nommée.
- **Sprint de surcharge** : 20 secondes à 115 % de votre meilleur rythme, proposé seulement quand un geste stagne.
- Les feuilles se calent en haut de l'écran dès leur création.

## Nouveautés de la version 0.24

- **Épreuves plus proches des examens** : découpage des chiffres imposé par grade, 6 mitorizan d'additions seules sur 10, seuils officiels, résultat négatif au 2e kyū, tous les calculs arrondis dès le 3e kyū. En « examen pur », du 1er au 3e kyū, les séparateurs de milliers sont exigés.
- **Séance partagée** : un peu de leçon, puis une planche d'ancrage sur les dernières leçons, puis deux minutes d'anzan. La leçon suivante attend que l'avant-dernière soit « acquis confirmé », 7 jours de pratique au plus.
- **Examen de la semaine** adapté au niveau, à passer le jour que l'on veut.
- **Erreurs de multiplication et de division suivies par type** : quand la même revient, l'entraînement correspondant est proposé.
- **Planches** : additions seules, longueurs mêlées, format d'examen, résultats négatifs, décimaux, jusqu'à 10 chiffres. Feuilles × et ÷ avec zéros et arrondis.
- **Anzan** : grades de flash en temps total (10e kyū au 10e dan, échelle indicative), épreuves chronométrées une par une, quatre nouvelles leçons, affichage du flash centré.

## Nouveautés de la version 0.23

- **Sprints** (`core/sprints.js`, écran Jeux, reliés aux leçons par un bouton) : division avec reste (avant la première division), lecture éclair de grands nombres (dès les gestes directs à 2 et 3 chiffres), arrondi éclair, lecture d'un résultat négatif sur le soroban.
- **Division** : démonstration animée du rattrapage d'un chiffre de quotient trop grand, sans tout effacer (1 chiffre du diviseur rendu, ou 2 avec un diviseur à 3 chiffres).
- **Multiplication** : la retenue qui déborde à gauche des deux tiges d'un produit est signalée dans toutes les explications ; l'index gauche ne bouge pas.
- **Dictée** : « à mon niveau » (paliers automatiques, pas plus de chiffres que dans les leçons validées) ; la meilleure voix française installée est choisie d'office.

Voir `SPECS.md` (cahier des charges) et `AUDIT-PARCOURS.md` (audit du parcours).
