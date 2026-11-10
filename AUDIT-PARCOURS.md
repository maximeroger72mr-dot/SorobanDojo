# AUDIT DU PARCOURS ET DES EXERCICES — Soroban 0.21.3

Complète `SPECS.md`. Aucun code n'a été modifié pour cet audit.

Méthode : lecture de `core/curriculum.js`, `parcours.js`, `prof.js`, `minitest.js`, `maitrise.js` et des écrans ; puis mesures en exécutant les générateurs de chaque leçon (400 exercices par leçon, 200 mini-tests simulés, tirage à graine fixe).

Limite des mesures : elles sont faites avec des poids neutres. Chez un élève réel, les poids adaptatifs remontent les gestes peu vus ; les déséquilibres ci-dessous sont donc un maximum, pas une certitude.

---

## 1. Verdict

Le parcours est solide et bien pensé jusqu'au 7e kyū. Il devient incomplet et mal ordonné au-delà, et ses seuils de vitesse ne préparent pas aux examens supérieurs.

| Partie | Note | En une phrase |
|---|---|---|
| Gestes directs et amis (p1 à p5) | 9/10 | Découpage fin, un geste à la fois, explications justes |
| Multiplication et division (p6, p7) | 8/10 | Très bonne leçon d'estimation ; des zéros arrivent avant d'être enseignés |
| Décimaux (pd) | 6/10 | Bien expliqués, mal placés, et un type d'arrondi manque |
| Vers les kyū supérieurs (p8) | 5/10 | S'arrête à 6 chiffres et à 4 × 3 ; le 1er kyū en demande 10 et 6 × 5 |
| Anzan (pa) | 7,5/10 | Progression exemplaire sur l'image ; s'arrête à 2 chiffres, sans × ni ÷ |
| Mini-tests et validation | 7/10 | Justesse ET vitesse : très bien ; mais certains gestes ne sont pas testés |
| Lien entre vitesse et examens | 4/10 | Le niveau « expert » ne suffit pas pour le 1er kyū |

---

## 2. Ce qui est bon et doit rester

- **Un geste à la fois**, puis mélange : 50 colonnes ciblées, puis consolidation 2 à 7 jours après, puis révision espacée.
- **Prérequis mentaux avant le geste** : « les paires qui font 5 » puis « qui font 10 », en temps limité (20 réponses en 60 s).
- **Validation exigeante** : 13 justes sur 15 et une vitesse minimale. Un mini-test réussi par chance mais trop lent ne valide pas.
- **Le prof** : on n'avance que si la dernière leçon est acquise ; après 3 jours d'absence, on réveille les gestes au lieu d'empiler.
- **Leçon d'estimation en division** (`p7-e`) : deux exercices sur trois demandent une correction du chiffre estimé. C'est la vraie difficulté, et elle est travaillée de front.
- **Anzan en retard sur le soroban** : on n'imagine que des gestes déjà automatiques ; l'image d'aide s'estompe ; la chaîne s'allonge après 3 réussites et raccourcit après une erreur.
- **Leçons ciblées équilibrées [MESURÉ]** : dans les leçons à 2 gestes (`+4 et +3`, `−9 et −8`…), chaque geste pèse 44 à 56 % ; aucun exercice sans le geste visé.

---

## 3. Problèmes constatés

### 3.1 Bloquants

**B-1 · Le 6e kyū exige tout le parcours, décimaux compris [MESURÉ]**

`core/parcours.js` ne définit les leçons requises que pour les 10e à 7e kyū. Pour les autres, il exige **toutes** les leçons. Un élève qui a le 7e kyū doit valider 54 leçons pour tenter le 6e, dont les 5 leçons de décimaux, la division par 3 chiffres et les colonnes à 6 chiffres. Aucune n'est au programme du 6e kyū.

**B-2 · Les décimaux passent avant les colonnes à 4 chiffres [LU]**

Le parcours est linéaire. Le palier « Décimaux et arrondis » (contenu du 3e kyū) est placé avant « Vers le 5e et le 4e kyū ». L'élève doit arrondir au millième avant d'avoir fait une colonne de 10 lignes.

**B-3 · Les niveaux de vitesse ne mènent pas aux examens supérieurs [MESURÉ]**

Temps nécessaire pour faire toute l'épreuve, en supposant chaque geste au niveau indiqué (3 s de lecture et d'écriture par problème) :

| Kyū | Temps accordé | Au niveau « débutant » | « confirmé » | « expert » | Part faisable au niveau « confirmé » | Seuil de réussite |
|---|---|---|---|---|---|---|
| 10e à 7e | 20 min | 8 à 17 min | 5 à 10 min | 3 à 6 min | 100 % | 70 % |
| 6e | 30 min | 37 min | 21 min | 13 min | 100 % | 70 % |
| 5e | 30 min | 53 min | 31 min | 19 min | 98 % | 70 % |
| 4e | 30 min | 66 min | 38 min | 23 min | 79 % | 70 % |
| 3e | 30 min | 95 min | 54 min | 33 min | 55 % | 80 % |
| 2e | 30 min | 110 min | 63 min | 38 min | 47 % | 80 % |
| 1er | 30 min | 146 min | 84 min | 50 min | 36 % | 80 % |

Lecture : un élève « confirmé » partout réussit jusqu'au 4e kyū. Au 3e, il ne peut traiter que 55 % du sujet alors qu'il en faut 80 %. Même « expert » partout, il lui faut 50 minutes pour un 1er kyū de 30 minutes. L'application annonce « acquis expert » à un élève qui est encore loin du compte, et rien ne lui dit quelle vitesse viser pour son grade.

**B-4 · Le parcours s'arrête avant les formats d'examen [LU]**

| Ce que l'examen demande | Ce que le parcours enseigne au maximum |
|---|---|
| Colonnes de 8 chiffres (2e kyū), 10 chiffres (1er) | 6 chiffres (`p8-3`) |
| Multiplication à 11 chiffres au total (6 × 5) | 4 × 3 (`p8-5`) |
| Division à 10 chiffres au total (5 × 5) | diviseur à 3 chiffres, quotient à 2 (`p8-7`) |
| Arrondi à l'unité (montants) | arrondi au millième seulement (`pd-5`) |
| Résultat négatif (1er kyū, possible au 2e) | leçon facultative |

### 3.2 Importants

**I-1 · La « Révision générale » valide des gestes qu'elle ne teste pas [MESURÉ]**

`p5-5` vise les 54 gestes. Son mini-test fait 15 colonnes : 94 % des mini-tests laissent de côté au moins un geste, 2,5 en moyenne. Or cette leçon ouvre le 10e kyū et sert de preuve que « tout est su ». Même défaut, moins marqué, sur `p8-t1` (63 % des tests incomplets), `p8-2` (29 %), `p8-t2` (25 %) et `p1-1` (21 %).

**I-2 · Gestes rares sous-représentés dans les leçons de synthèse [MESURÉ]**

| Leçon | Geste le moins vu | Sa part | Part si tout était égal |
|---|---|---|---|
| `p1-1` Ajouter 1 à 4 | +4 direct | 4 % | 25 % |
| `p1-3` Le 5 et la pincée | +5 direct | 5 % | 10 % |
| `p3-4` Grands amis +, 2 et 3 chiffres | +1 grand ami | 4 % | 11 % |
| `p4-4` Grands amis −, 2 et 3 chiffres | −1 grand ami | 4 % | 11 % |
| `p4-5` Tous les grands amis | +1 grand ami | 2 % | 5,6 % |

Cause : ces gestes ne sont possibles que depuis une seule valeur de tige (`+1 grand ami` exige un 9). Le tirage ligne par ligne ne les « prépare » pas assez. C'est le défaut que le planificateur de planche vient de corriger ; il n'est pas encore branché sur les leçons.

**I-3 · Des zéros avant la leçon sur les zéros [MESURÉ]**

« Un produit 00 : on ne pose rien mais on avance d'une tige » est enseigné en `p8-4`. Pourtant un facteur finit par 0 dans 20 % des exercices de `p6-3` (2 × 2), 16 % de `p6-4`, 21 % de `p8-5`, et un diviseur ou un quotient finit par 0 dans 19 % de `p7-4` et de `p8-7`. Le débutant rencontre la difficulté sans l'explication, et ces mêmes exercices sont par ailleurs plus courts à calculer : ils faussent aussi la mesure de vitesse.

**I-4 · Reprise après erreur [LU]**

Une colonne fausse est expliquée, puis rejouée une seule fois le lendemain (30 colonnes gardées, 14 jours). Il n'y a ni reprise immédiate, ni second rappel.

**I-5 · L'anzan s'arrête trop tôt [LU]**

La piste finit à 2 chiffres, 4 nombres. Il n'existe aucune leçon d'anzan en multiplication ni en division, alors que l'écran libre propose déjà des multiplications de tête et que l'examen d'anzan en demande dès le 6e kyū.

**I-6 · La dictée est hors parcours [LU]**

Elle existe (1 à 4 chiffres, débit et pause réglables), mais sans palier, sans validation et sans lien avec l'anzan.

### 3.3 Mineurs

- **M-1** `p7-1` (÷ 1 chiffre, quotient 1 chiffre) : 5,4 exercices répétés sur 30. L'espace est petit (64 divisions) ; une mémoire plus longue suffit.
- **M-2** `p6-a` : 40 exercices tirés parmi 81 produits, donc environ la moitié de la table n'est jamais vue dans la leçon. Sans gravité : le module Tables couvre les 81.
- **M-3** Aucune leçon ne prépare aux conditions d'examen (ordre des parties, quand sauter un problème, relecture de la saisie).
- **M-4** `p1-1` : 3 lignes, additions seules, 1 chiffre ; la colonne sature vite la tige, d'où le `+4` presque absent. Une ligne de plus ou un départ sur deux tiges règle le problème.

---

## 4. Propositions

### 4.1 Corrections du parcours

| N° | Proposition | Règle |
|---|---|---|
| C-1 | **Leçons requises par grade**, pour les dix kyū | 6e : `p8-t1`, `p6-4` ; 5e : + `p8-t2`, `p8-1`, `p8-2`, `p8-4`, `p8-6` ; 4e : + `p8-3`, `p8-5`, `p8-7` ; 3e : + décimaux ; 2e : + négatifs et 7-8 chiffres ; 1er : + 9-10 chiffres, grands × et ÷ |
| C-2 | **Déplacer les décimaux** après « Vers le 5e et le 4e kyū » | Ordre : p7 → p8 (sans les négatifs) → décimaux → nouveau palier « Vers le 1er kyū » |
| C-3 | **Nouveau palier « Vers le 1er kyū »** | Colonnes 7-8 puis 9-10 chiffres ; × 4 × 4 puis 6 × 5 ; ÷ jusqu'à 5 × 5 ; arrondi à l'unité ; résultats négatifs (obligatoire) |
| C-4 | **Zéros finaux exclus** des leçons de × et ÷ avant `p8-4` et `p8-6` | Opérandes sans 0 final ; les leçons « zéros » gardent leurs zéros internes |
| C-5 | **Mini-tests planifiés** | Le mini-test est tiré comme une planche : chaque geste visé au moins une fois quand le nombre de colonnes le permet ; pour `p5-5`, mini-test porté à 20 colonnes |
| C-6 | **Leçons de synthèse équilibrées** | L'entraînement d'une leçon avance par blocs de 10 colonnes planifiés ensemble (même moteur que les planches) |
| C-7 | **Leçon « stratégie d'examen »** | Courte, à lire, avec quiz ; placée avant le premier passage de kyū officiel |

### 4.2 Vitesse : une cible par grade

Garder les trois niveaux actuels, qui servent bien l'apprentissage du geste, et ajouter une **allure du grade visé** :

- pour chaque kyū, l'application calcule la cadence nécessaire pour traiter la part exigée du sujet dans le temps (par exemple, pour le 3e kyū : 80 % de 649 chiffres et de 715 produits en 30 minutes) ;
- l'écran Grades affiche « votre cadence » en face de « la cadence du grade », par partie ;
- le prof s'en sert pour dire franchement si le grade est à portée ;
- pendant l'épreuve, une barre d'allure **en option**, masquée d'office en « examen pur ».

Cela ne change aucun seuil existant et ne retire aucun niveau acquis.

### 4.3 Reprise des colonnes fausses (selon votre consigne)

- Proposée **seulement** quand l'erreur est identifiée sans ambiguïté : une ligne précise est désignée (oubliée, doublée, signe inversé, lue de travers) ou un geste précis est localisé (boule céleste, retenue).
- **Pas systématique** : au plus 3 colonnes par planche, jamais en examen, et l'élève peut passer.
- La première réponse est masquée ; l'indice est dosé : d'abord « reprenez la ligne 4 », puis le geste en cause si la reprise échoue.
- Les autres colonnes fausses suivent le circuit actuel (rejeu le lendemain), étendu à J+3 et J+7.
- Seule la première passe compte pour les statistiques.

### 4.4 Nouvelles activités retenues

| Activité | Contenu | Remarque |
|---|---|---|
| **Dictée anzan** | La dictée actuelle, soroban rangé : on écoute, on calcule de tête, on tape. Paliers de débit et de longueur, branchés sur la piste anzan | Réutilise voix et générateur existants |
| **Anzan × et ÷** | Leçons de multiplication puis de division de tête, après `p6-1` et `p7-1` | Nécessaire avant les examens d'anzan |
| **Examens d'anzan gradés** | Format trouvé pour l'examen de la Ligue : 1er au 6e kyū, 20 additions + 30 multiplications + 30 divisions en 12 minutes ; 7e au 10e, 50 additions en 12 minutes ; réussite à 400/500 (350, 300, 250 pour les 8e, 9e, 10e) | Sources non officielles : chaque grade sera marqué « format indicatif » |
| **Stratégie d'examen** | Leçon courte + allure optionnelle | Voir C-7 et 4.2 |

### 4.5 Autres angles de travail possibles (non décidés)

- **Double passe** : chaque colonne calculée deux fois, saisie seulement si les deux résultats concordent.
- **Colonnes à trous** : le total est donné, une ligne manque.
- **Lecture anticipée à son rythme** : la ligne suivante s'affiche pendant qu'on pose la précédente.
- **Série « sans faute »** : 10 colonnes d'affilée justes, sans chrono, pour les élèves rapides mais imprécis.
- **Paliers de dictée sur soroban**, symétriques de la dictée anzan.

---

## 5. Ordre de réalisation proposé

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 1 | C-1, C-2, C-4 : prérequis par grade, ordre des paliers, zéros finaux | Corrige ce qui bloque ou égare l'élève aujourd'hui ; peu de code |
| 2 | C-5, C-6 : mini-tests et leçons planifiés | Réutilise le planificateur déjà livré |
| 3 | Reprise des fausses (4.3) + diagnostic étendu | Votre priorité, avec la règle « seulement si identifiée » |
| 4 | Allure par grade (4.2), mode « examen pur », leçon de stratégie | Demande les formats d'épreuve corrigés (lot E du `SPECS.md`) |
| 5 | C-3 : palier « Vers le 1er kyū » | Nouveau contenu, long à écrire et à doser |
| 6 | Dictée anzan, anzan × et ÷, examens d'anzan | Nouvelles activités |

Point d'attention pour le lot 1 : déplacer des leçons change l'ordre du parcours d'un élève en cours. La validation des leçons déjà faites est conservée (elle est liée à l'identifiant de la leçon, pas à sa place), mais la « prochaine leçon » proposée peut changer.

---

## Annexe — Mesures par leçon

Colonnes : part du geste visé le moins vu et du plus vu ; part des mini-tests de 15 colonnes où un geste visé manque ; colonnes répétées au cours de la leçon.

| Leçon | Gestes visés | Moins vu / plus vu | Mini-tests incomplets | Répétitions |
|---|---|---|---|---|
| p1-1 Ajouter 1 à 4 | 4 | 4 % / 47 % | 21 % | 0 / 20 |
| p1-2 Retirer 1 à 4 | 4 | 15 % / 44 % | 3 % | 0 / 20 |
| p1-3 Le 5 et la pincée | 10 | 5 % / 14 % | 16 % | 0 / 20 |
| p1-4 Directs, 2 et 3 chiffres | 18 | 2 % / 11 % | 8 % | 0 / 20 |
| p2-1, p2-2, p2-4, p2-5 (2 gestes) | 2 | 46 % / 54 % | 0 % | 3 à 5 / 50 |
| p2-3, p2-6 Petits amis 2 et 3 chiffres | 4 | 16 % / 32 % | 0 % | 0 / 50 |
| p2-7 Tous les petits amis | 8 | 10 % / 15 % | 0 % | 0 / 50 |
| p3-1, p3-2, p4-1, p4-2 (2 gestes) | 2 | 44 % / 56 % | 0 % | 0 à 4 / 50 |
| p3-3, p4-3 (±5 à ±1) | 5 | 15 % / 27 % | 1 à 2 % | 0,5 / 50 |
| p3-4, p4-4 Grands amis 2 et 3 chiffres | 9 | 4 % / 20 % | 2 % | 0 / 50 |
| p4-5 Tous les grands amis | 18 | 2 % / 10 % | 9 % | 0 / 50 |
| p5-1, p5-2 Combinés | 4 | 17 % / 34 % | 1 % | 1 / 50 |
| p5-3 Combinaisons 2 et 3 chiffres | 8 | 8 % / 15 % | 0 % | 0 / 50 |
| p5-4 Cascades | 2 | 42 % / 58 % | 0 % | 0 / 30 |
| p5-5 Révision générale | 54 | 0 % / 15 % | **94 %** | 0 / 50 |
| p8-t1 Transition 3 chiffres | 54 | 1 % / 13 % | **63 %** | 0 / 30 |
| p8-t2 Transition 4 chiffres | 54 | 1 % / 14 % | 25 % | 0 / 30 |
| p8-1 4 chiffres, 10 lignes | 54 | 0 % / 13 % | 5 % | 0 / 30 |
| p8-2 Zéros internes | 54 | 0 % / 12 % | 29 % | 0 / 30 |
| p8-3 5 et 6 chiffres | 54 | 1 % / 14 % | 1 % | 0 / 20 |

| Leçon de × ou ÷ | Opérande finissant par 0 | Répétitions |
|---|---|---|
| p6-1 2 × 1 | 8 % | 0,6 / 30 |
| p6-2 3 et 4 × 1 | 10 % | 0 / 30 |
| p6-3 2 × 2 | **20 %** | 0 / 30 |
| p6-4 3 × 2 | 16 % | 0 / 30 |
| p7-1 ÷ 1, quotient 1 | 0 % | **5,4 / 30** |
| p7-2 ÷ 1, quotient 2 et 3 | 10 % | 0,1 / 30 |
| p7-3 ÷ 2, quotient 1 | 11 % | 0,9 / 30 |
| p7-4 ÷ 2, quotient 2 | **19 %** | 0 / 30 |
| p8-5 3 × 3 et 4 × 3 | **21 %** | 0 / 30 |
| p8-7 ÷ 3 chiffres | **19 %** | 0 / 30 |

Sources pour l'examen d'anzan (non officielles, à confirmer) :
- https://shikakusogo.com/minkanshikaku/anzannihon/
- https://www.sorobanfukyu.com/count/exam2.html
- https://shikaku-mon.com/kyouyou/anzan
