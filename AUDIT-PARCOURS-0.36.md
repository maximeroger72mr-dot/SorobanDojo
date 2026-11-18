# AUDIT DU PARCOURS ET DES EXERCICES — Soroban 0.36.0

Complète `SPECS.md` et reprend la grille de `AUDIT-PARCOURS.md` (audit de la 0.21.3). Aucun code n'a été modifié pour cet audit.

**Méthode.** J'ai lu `core/curriculum.js`, `parcours.js`, `prof.js`, `minitest.js`, `maitrise.js`, `revision.js`, `propositions.js`, `blocs.js`, `epreuves.js`, `epreuvesAnzan.js` et les écrans. J'ai ensuite exécuté les générateurs, à graine fixe :
- 200 exercices par leçon de colonnes, tirés comme dans l'application (flux équilibré par blocs de 10) ;
- 100 mini-tests simulés par leçon ;
- 400 exercices par leçon de × et ÷ ;
- 30 sujets d'examen par grade ;
- 20 sujets d'anzan par grade.

**Référence des examens.** Le règlement de 日本珠算連盟 (shuzan.jp) et les sujets modèles officiels : 1er, 2e, 3e, 4e, 6e, 7e et 9e kyū de soroban, 1er kyū d'anzan.

**Limite.** Les mesures utilisent des poids neutres. Chez un élève réel, les poids adaptatifs remontent les gestes peu vus : les déséquilibres mesurés sont un maximum.

Étiquettes : [MESURÉ] = obtenu en exécutant le code ; [LU] = constaté à la lecture du code.

---

## 1. Verdict

Depuis la 0.21.3, le parcours a changé de catégorie :
- il va jusqu'au 1er kyū ;
- chaque grade n'exige que ses leçons ;
- les mini-tests couvrent tous les gestes ;
- les sujets d'examen sont conformes aux sujets officiels.

Les faiblesses restantes sont ailleurs :
- le **passage des leçons aux sujets du 5e au 1er kyū** : la moitié des formes de × et ÷ des sujets ne sont jamais enseignées ;
- la **fidélité au format** : un premier nombre plus long dans la moitié des colonnes, aucun zéro final ;
- quelques **règles trop larges ou trop strictes** : révisions absorbées, portes « or » en début de parcours.

| Partie | 0.21.3 | 0.36.0 | En une phrase |
|---|---|---|---|
| Gestes directs et amis (p1 à p5) | 9/10 | 9,5/10 | Équilibre et couverture désormais mesurés bons ; il reste le premier nombre trop long |
| Multiplication et division (p6, p7) | 8/10 | 8,5/10 | Plus aucun zéro avant sa leçon ; quelques leçons se répètent (p7-1 : 15 sur 50) |
| Décimaux et négatifs (pd) | 6/10 | 8/10 | Bien placés (3e et 2e kyū), arrondi à l'unité présent |
| Vers les kyū supérieurs (p8, p9) | 5/10 | 7/10 | Les longueurs de colonnes sont couvertes jusqu'à 10 chiffres ; les formes de × et ÷ ne le sont qu'à moitié |
| Anzan (pa) | 7,5/10 | 8,5/10 | Va jusqu'au format du 1er kyū d'anzan ; la division à 4 chiffres manque |
| Mini-tests et validation | 7/10 | 9/10 | Tous les gestes visés sont testés à chaque mini-test |
| Lien entre vitesse et examens | 4/10 | 7/10 | Allure par grade affichée, médailles rattachées aux kyū ; le platine ne suffit pas au 1er kyū |
| Fidélité au format d'examen | non évalué | 6,5/10 | Sujets conformes ; leçons et planches pas encore tout à fait |
| Révisions | non évalué | 6/10 | Elles finissent enfin, mais la règle d'absorption est trop large |

---

## 2. Suivi des constats de l'audit 0.21.3

| Constat 0.21.3 | État en 0.36.0 | Preuve |
|---|---|---|
| B-1 Le 6e kyū exigeait tout le parcours | **Corrigé** | `PREREQUIS` : 34 leçons pour le 10e, 58 pour le 6e, 80 pour le 1er |
| B-2 Décimaux avant les colonnes à 4 chiffres | **Corrigé** | Palier `pd` après `p8`, exigé au 3e kyū ; négatifs au 2e |
| B-3 Niveaux de vitesse sans lien avec les examens | **En grande partie corrigé** | Allure du grade affichée ; médaille ↔ kyū ; mini-tests avancés réglés sur 70 % de la cadence du grade. Le platine reste insuffisant au 1er kyū (voir I-3) |
| B-4 Parcours arrêté avant les formats d'examen | **Corrigé pour les colonnes, partiel pour × et ÷** | Colonnes jusqu'à 10 chiffres, 6 × 5, 5 ÷ 5, arrondi à l'unité. Mais la moitié des formes des sujets manque (voir B-1) |
| I-1 « Révision générale » sans tester tous les gestes | **Corrigé** [MESURÉ] | 0 % de mini-tests incomplets sur les 35 leçons de colonnes, 54 gestes sur 54 couverts |
| I-2 Gestes rares sous-représentés | **Très amélioré** [MESURÉ] | `p4-5` : geste le moins vu à 4 % pour 6 % à part égale (avant 2 % pour 5,6 %) ; `p1-1` : 10 % pour 25 % (avant 4 %) |
| I-3 Zéros finaux avant leur leçon | **Corrigé, et dépassé** [MESURÉ] | 0 % dans toutes les leçons de × et ÷. Mais l'examen en a 14 à 20 % : voir I-2 |
| I-4 Reprise après erreur | **Corrigé** | Reprise immédiate quand l'erreur est identifiée (3 au plus par planche), rappels à J+3 et J+7 |
| I-5 Anzan arrêté à 2 chiffres | **Corrigé** | 3 chiffres sur 5, 7 et 10 nombres ; × jusqu'à 3 × 2, ÷ jusqu'à quotient 3 |
| I-6 Dictée hors parcours | **Corrigé** | Dictée anzan par paliers |
| M-1 `p7-1` répétitif | **Toujours là** [MESURÉ] | 15 répétitions sur 50 (la leçon est passée de 30 à 50 exercices) |
| M-2 `p6-a` ne voit que la moitié de la table | Inchangé, sans gravité | Le module Tables couvre les 81 produits |
| M-3 Pas de préparation aux conditions d'examen | **Corrigé** | Leçon `p5-6` « Passer une épreuve : la stratégie » |
| M-4 `p1-1` : le +4 presque absent | **Amélioré** [MESURÉ] | 10 % au lieu de 4 % (25 % à part égale) ; toujours 3 lignes |

---

## 3. Ce qui est bon et doit rester

- **Mini-tests planifiés [MESURÉ].** Sur 100 mini-tests simulés par leçon, aucun ne laisse de côté un geste visé, y compris les leçons à 54 gestes (`p5-5`, `p8-*`, `p9-*`).
- **Leçons ciblées équilibrées [MESURÉ].** Dans les 15 leçons à 2 gestes, chaque geste pèse de 45 à 55 %.
- **Prérequis par grade exacts pour les colonnes [MESURÉ].** Pour les 10 kyū, les leçons exigées enseignent des colonnes au moins aussi longues que celles du sujet (2 × 5 au 10e ; 10 × 10 au 1er).
- **Sujets d'examen conformes [MESURÉ].** Pour chaque grade :
  - nombres de lignes et de chiffres du règlement ;
  - problèmes 3, 5, 7 et 9 mêlés, avec le bon nombre de lignes négatives ;
  - négatif au problème 9 des 1er et 2e kyū ;
  - 14 à 20 % de facteurs terminés par 0 (sujet modèle du 6e kyū : environ 25 %).
- **Mini-tests des leçons avancées réglés sur l'examen [LU].** À partir de `p8-3`, la vitesse exigée vaut 70 % de la cadence du premier grade qui demande la leçon : 2,33 s par chiffre pour `p8-3` (4e kyū), 0,83 s pour `p9-2` (1er kyū).
- **Planches au format du grade visé [MESURÉ].** Au début des grands amis : 5 planches sur 7 au format du 10e kyū (2 chiffres, 5 lignes), une au format suivant, une courte. Toutes durent 5 minutes pour un objectif de 20 minutes.
- **Le prof** n'empile pas : argent pour avancer dans une étape, or en fin d'étape, reprise douce après 3 jours d'absence.

---

## 4. Problèmes constatés

### 4.1 Bloquants

**B-1 · Du 5e au 1er kyū, la moitié des formes de × et ÷ des sujets n'est jamais enseignée [MESURÉ]**

Le sujet découpe « N chiffres au total » comme les sujets modèles. Au 4e kyū, par exemple, on trouve 74 213 × 25 (5 × 2) et 289 153 ÷ 3 961 (diviseur à 4 chiffres, quotient à 2). Les leçons, elles, n'enseignent qu'une forme par niveau.

Part des problèmes entiers du sujet dont la forme n'apparaît dans **aucune** leçon exigée par le grade :

| Kyū | × absentes des leçons exigées | ÷ absentes des leçons exigées |
|---|---|---|
| 10e à 6e | aucune | aucune |
| 5e | 4 × 2 (48 %), 3 × 3 (52 %) : tout | diviseur 3, quotient 2 (51 %) |
| 4e | 5 × 2 (50 %) | ÷3 q3 (51 %), ÷2 q4 (25 %), ÷4 q2 (24 %) |
| 3e | 5 × 2 (49 %) | ÷3 q3 (50 %), ÷4 q2 (28 %), ÷2 q4 (22 %) |
| 2e | 6 × 3 (56 %) | ÷4 q4 (52 %), ÷5 q3 (23 %), ÷3 q5 (25 %) |
| 1er | 7 × 4 (50 %) | ÷6 q4 (21 %), ÷4 q6 (26 %) |

Douze formes ne sont enseignées nulle part : 4 × 2, 5 × 2, 6 × 3, 7 × 4, ÷3 q3, ÷2 q4, ÷4 q2, ÷4 q4, ÷5 q3, ÷3 q5, ÷6 q4, ÷4 q6.

Au 5e kyū, aucune multiplication du sujet n'a été vue en leçon : `p8-5` (3 × 3) n'est exigée qu'au 4e.

La technique ne change pas avec la forme. Ce qui change :
- le **placement** du premier chiffre (quotient long, diviseur court) ;
- l'**endurance** (une division à quotient de 4 chiffres demande 4 estimations à la suite).

Un élève qui valide toutes ses leçons découvre ces formes le jour de l'examen.

### 4.2 Importants

**I-1 · Le premier nombre d'une colonne de leçon a souvent un chiffre de trop [MESURÉ]**

Dans les leçons à plusieurs chiffres, le premier nombre dépasse la longueur annoncée dans 41 à 50 % des colonnes :
- `p4-5` : 50 % ;
- `p5-5` : 48 % ;
- `p8-1` : 41 %, avec par exemple 9 878 puis 9 383 dans une colonne de « 4 chiffres ».

Cause : quand le premier geste est une soustraction avec emprunt sur la tige de tête, le générateur ajoute un chiffre au départ (`generateur.essayerCible`, variable `tete`). C'est voulu pour les leçons à 1 chiffre (une dizaine au départ varie les résultats). Sur les leçons d'examen, l'effet est double :
- l'élève ne s'entraîne pas au format réel, où tous les nombres d'un sujet modèle ont la même longueur ;
- la difficulté est mal placée : à l'examen, la première soustraction n'arrive qu'en 3e ligne, sur un total déjà grand.

**I-2 · Aucun zéro final en leçon, environ un sur cinq à l'examen [MESURÉ]**

L'audit 0.21.3 avait demandé d'exclure les zéros finaux avant `p8-4` ; c'est fait (0 % partout). Mais l'exclusion s'applique aussi **après** : aucune leçon de × et ÷, même `p8-5` à `p9-6`, ne pose 130 × 97 ou 300 ÷ 20. Or l'examen en contient 14 % (7e kyū) à 20 % (4e). La leçon `p8-4` enseigne le zéro **interne** (406 × 7) ; le zéro **final** (42 × 180, quotient 30) se traite pareil, mais il n'est jamais rencontré.

**I-3 · Même en platine partout, le 1er kyū et le 準1 restent hors d'atteinte [MESURÉ]**

Temps pour faire tout le sujet si chaque geste est au seuil de la médaille (3 s de lecture et d'écriture par problème) :

| Kyū | Temps | Argent | Or | Platine | Part faite en or | Part faite en platine | Il faut |
|---|---|---|---|---|---|---|---|
| 10e, 9e | 20 min | 10 min | 6 min | 4 min | 100 % | 100 % | 30 %, 60 % |
| 8e | 20 min | 14 min | 8 min | 5 min | 100 % | 100 % | 60 % |
| 7e | 20 min | 17 min | 10 min | 6 min | 100 % | 100 % | 60 % |
| 6e | 30 min | 34 min | 20 min | 12 min | 100 % | 100 % | 70 % |
| 5e | 30 min | 47 min | 27 min | 17 min | 100 % | 100 % | 70 % |
| 4e | 30 min | 60 min | 35 min | 21 min | 86 % | 100 % | 70 % |
| 準3 | 30 min | 66 min | 38 min | 23 min | 79 % | 100 % | 80 % |
| 3e | 30 min | 69 min | 39 min | 24 min | **76 %** | 100 % | 80 % |
| 準2 | 30 min | 85 min | 48 min | 29 min | 62 % | 100 % | 80 % |
| 2e | 30 min | 104 min | 59 min | 35 min | 51 % | 85 % | 80 % |
| 準1 | 30 min | 122 min | 70 min | 41 min | 43 % | **73 %** | 80 % |
| 1er | 30 min | 143 min | 82 min | 48 min | 37 % | **62 %** | 80 % |

L'équivalence affichée (argent ≈ 6e, or ≈ 4e, platine ≈ 2e) est donc juste. Au-delà, l'échelle s'arrête : rien ne nomme la vitesse du 準1 et du 1er kyū (0,58 s par chiffre, 1,17 s par produit). Le mini-test de `p9-2` l'exige déjà à 70 %, mais aucune médaille ne la marque.

**I-4 · Les révisions « absorbées » sont trop larges [MESURÉ]**

Une leçon sort des révisions dès qu'une leçon plus avancée contenant tous ses gestes atteint la boîte 3. Or `p5-e` (endurance, 54 gestes) contient tous les gestes.

Pour un élève à la fin de `p5` dont les cartes sont en boîte 3, **27 cartes sur 31 sortent des révisions**, toutes absorbées par `p5-e` ou `p5-5`. Leur révision repose alors sur un test flash de **10 colonnes** sur 54 gestes : un geste rare (+1 grand ami) peut ne plus être revu pendant des mois.

**I-5 · Portes « or » en fin d'étape : jusqu'à 50 jours de pratique avant le 10e kyū [LU, calculé]**

Avant le 10e kyū, cinq fins d'étape (p1→p2, p2→p3, p3→p4, p4→p5, p5→p6) demandent l'or sur toutes les leçons de l'étape, pendant au plus 10 jours de pratique chacune (`JOURS_AUTOMATISATION_MAX`). Cela fait jusqu'à 50 jours de pratique, alors que le repère du 10e kyū est de 3 mois (`MOIS_REPERE`).

L'or vaut 1,5 s par chiffre, l'allure du 4e kyū. Le 10e kyū, lui, se réussit à 16 s par chiffre (sujet très court pour 20 minutes).

C'est un choix pédagogique assumé (automatiser avant d'avancer), et la limite de 10 jours l'empêche de bloquer. Mais pour un élève lent, le premier grade officiel peut arriver plus tard que le repère, à cause des portes et non du contenu.

**I-6 · La division de tête à 4 chiffres manque à la piste anzan [MESURÉ]**

Les examens d'anzan du 3e et du 2e kyū (et les 準) demandent des divisions de 4 chiffres au total : ÷2 q2 (50 %), ÷3 q1 (24 %), ÷1 q3 (26 %). La piste passe de ÷2 q1 et ÷1 q2 (3 chiffres) directement à ÷2 q3 (5 chiffres). Le 1er kyū d'anzan demande aussi ÷3 q2 (45 %), absent de la piste.

**I-7 · Le volume des leçons s'effondre quand la charge des sujets explose [MESURÉ]**

| Kyū | Leçons ajoutées | Exercices ajoutés | Sujet : chiffres de colonnes | Sujet : produits de table |
|---|---|---|---|---|
| 10e | 34 | 1 480 | 100 | 40 |
| 8e | 10 | 410 | 160 | 50 |
| 7e | 5 | 170 | 200 | 70 |
| 6e | 9 | 350 | 300 | 200 |
| 5e | 5 | 150 | 400 | 292 |
| 4e | 3 | 80 | 500 | 394 |
| 3e | 6 | 180 | 600 | 437 |
| 2e | 5 | 120 | 800 | 736 |
| 1er | 3 | 80 | 1 000 | 1 084 |

48 % des exercices de leçon (1 480 sur 3 050) servent avant le 10e kyū. Du 4e au 1er, le sujet décuple, mais les leçons n'ajoutent que 80 à 180 exercices par grade.

Ce n'est pas faux en soi : au-delà, le volume vient des planches (au format du grade depuis la 0.36), des blocs de séance et des examens blancs. Mais il n'est **ni compté ni exigé**. Rien ne dit à l'élève de 3e kyū combien de colonnes de 6 chiffres il a faites ce mois-ci, ni combien il en faudrait.

### 4.3 Mineurs

- **M-1 · Leçons répétitives [MESURÉ].** Exercices déjà vus dans la même leçon :

  | Leçon | Répétitions |
  |---|---|
  | `p7-1` (÷ 1 chiffre, quotient 1 chiffre) | 15 sur 50 |
  | `p7-2d` | 12 sur 50 |
  | `p7-2c` | 11,5 sur 50 |
  | `p6-1b` | 11 sur 50 |
  | `p7-2a` | 10,9 sur 30 |
  | `p6-1d` | 9 sur 50 |

  L'espace est petit (64 divisions pour `p7-1`). Une mémoire anti-répétition sur toute la leçon, ou une leçon plus courte, suffirait.
- **M-2 · Leçons d'anzan sans mesure par geste [LU].** Les colonnes de tête ne renvoient pas leurs gestes (`motifs: undefined`) : impossible de vérifier leur équilibre comme pour les leçons sur soroban, et le prof ne sait pas quel geste lâche en anzan.
- **M-3 · Formats non publiés, choisis par l'application [LU].** Deux choix ne viennent d'aucun sujet modèle et sont marqués « format indicatif » dans l'app :
  - le 8e kyū à 2 lignes négatives (interpolation) ;
  - l'anzan du 7e au 10e en additions seules.

  La répartition des points de l'anzan (10, 5 et 5) n'est pas publiée non plus.
- **M-4 · `p9-5` [LU].** Diviseur 4 chiffres, quotient 3, soit 7 chiffres au total. Le 2e kyū en demande 8 (法商合わせて8けた).
- **M-5 · `p1-1` [MESURÉ].** Toujours 3 lignes d'additions à 1 chiffre : le +4 reste à 10 % au lieu de 25 %.

---

## 5. Propositions

### 5.1 Corrections du parcours

| N° | Proposition | Règle |
|---|---|---|
| C-1 | **Élargir les formes des leçons de × et ÷** (répond à B-1) | Pas de nouvelles leçons. On élargit `mMax` / `nMax` / `nqMax` des leçons existantes pour couvrir les découpages du sujet : `p8-5` → 3 × 3, 4 × 2, 4 × 3, 5 × 2 ; `p8-7` → ÷3 q2, ÷3 q3, ÷2 q4, ÷4 q2 ; `p9-3` → 6 × 3 ; `p9-5` → ÷4 q4, ÷5 q3, ÷3 q5 ; `p9-4` / `p9-6` → 7 × 4, ÷6 q4, ÷4 q6. Et `p8-5` passe dans les prérequis du 5e kyū |
| C-2 | **Premier nombre à la longueur annoncée** (répond à I-1) | Dès 2 chiffres, la tête supplémentaire est interdite. Si le geste visé demande un emprunt sur la tige de tête, la colonne commence par une ou deux additions (comme à l'examen, première soustraction en 3e ligne) |
| C-3 | **Zéros finaux réintroduits après leur leçon** (répond à I-2) | À partir de `p8-4` / `p8-6` : environ 15 % d'opérandes terminés par 0, comme à l'examen. On complète `p8-4` d'un exemple « 42 × 180 » |
| C-4 | **Absorption limitée** (répond à I-4) | Une leçon n'absorbe que si elle a au plus 18 gestes (pas les leçons « tous les gestes ») et si elle est dans la même étape ou l'étape suivante. Les leçons à 54 gestes ne retirent rien des révisions |
| C-5 | **Division de tête à 4 chiffres** (répond à I-6) | Nouvelle leçon `pa-d2b` : ÷2 q2 (après `p7-4`) ; `pa-d3` élargie à ÷3 q2 |
| C-6 | **`p9-5` à 8 chiffres** (répond à M-4) | Diviseur 4, quotient 4 (ou 5 et 3) |
| C-7 | **Mémoire anti-répétition sur toute la leçon** (répond à M-1) | Pour les leçons à petit espace (`p7-1`, `p7-2a` à `p7-2d`, `p6-1b`, `p6-1d`) |

### 5.2 Vitesse et volume

| N° | Proposition | Détail |
|---|---|---|
| V-1 | **Une marche au-dessus du platine** (répond à I-3) | Sans toucher aux médailles existantes (votre choix) : un repère « allure du 1er kyū » (0,58 s par chiffre, 103 CPM) sur la courbe et dans les feuilles. Ce n'est pas une médaille de plus |
| V-2 | **Volume au format du grade, compté** (répond à I-7) | « Colonnes au format du 4e kyū ce mois-ci : 85 » dans Progression, à côté de la projection du temps d'examen déjà calculée en fin de planche. Repère indicatif plutôt qu'exigence : en juku, un élève de 3e ou 4e kyū fait plusieurs feuilles par jour |
| V-3 | **Portes « or » graduées** (répond à I-5, à décider) | Garder la règle, mais limiter la porte à 5 jours de pratique pour les étapes d'avant le 10e kyū (au lieu de 10). Ou garder 10 jours et faire passer l'argent comme porte de sortie quand le volume de l'étape est fait. Les deux options respectent « automatiser avant d'avancer » |

### 5.3 Ce qui pourrait venir ensuite (non décidé)

- **Mesure par geste en anzan** (M-2) : renvoyer les gestes des colonnes de tête, pour que le prof sache quel geste lâche en anzan.
- **Feuille « examen complet » dans la séance** à partir du 6e kyū : 10 colonnes + 20 × + 20 ÷ au format exact, chronométrée, une fois par semaine (aujourd'hui, l'examen blanc remplace la leçon le week-end ; on peut aussi l'enrichir).
- **Série de placement** sur les formes nouvelles (B-1) : 20 problèmes où l'on ne pose que le premier chiffre du produit ou du quotient. C'est rapide, et c'est là que les formes inhabituelles piègent.

---

## 6. Ordre de réalisation proposé

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 1 | C-1, C-6 : formes de × et ÷ | Seul point bloquant ; peu de code (bornes des leçons) |
| 2 | C-2, C-3 : premier nombre, zéros finaux | Fidélité au format ; touche le générateur, donc à tester de près |
| 3 | C-4, C-7 : absorption, répétitions | Corrections de règles, rapides |
| 4 | C-5 : division de tête à 4 chiffres | Une leçon de plus |
| 5 | V-1, V-2 : repère du 1er kyū, volume compté | Affichage seulement |
| 6 | V-3 : portes « or » | À décider : c'est un choix pédagogique |

Point d'attention pour le lot 1 : élargir une leçon déjà validée ne la dévalide pas, mais ses révisions poseront des formes nouvelles. Ce qui est voulu.

---

## Annexe A — Leçons de colonnes (200 exercices, 100 mini-tests par leçon)

Colonnes :
- **gestes** : nombre de gestes visés par la leçon ;
- **moins vu / plus vu** : part du geste visé le moins vu et du plus vu (à comparer à la part égale) ;
- **mini-tests incomplets** : part des mini-tests simulés où un geste visé manque ;
- **répétitions** : exercices déjà vus dans la même leçon ;
- **premier nombre trop long** : part des colonnes dont le premier nombre dépasse la longueur annoncée.

Les leçons « 2 et 3 chiffres » alternent deux longueurs : leur dernière colonne n'est pas significative. Pour les leçons à 1 chiffre, une dizaine au départ est voulue.

| Leçon | Gestes | Moins vu / plus vu (égal) | Mini-tests incomplets | Répétitions | Premier nombre trop long |
|---|---|---|---|---|---|
| p1-1 Ajouter 1 à 4 | 4 | 10 % / 44 % (25 %) | 0 % | 0,3 / 20 | voulu (1 chiffre) |
| p1-2 Retirer 1 à 4 | 4 | 20 % / 29 % (25 %) | 0 % | 0 / 20 | voulu |
| p1-3 Le 5 et la pincée | 10 | 10 % / 11 % (10 %) | 0 % | 0 / 20 | voulu |
| p1-4 Directs, 2 et 3 chiffres | 18 | 5 % / 7 % (6 %) | 0 % | 0 / 20 | — |
| p2-1, p2-2, p2-4, p2-5 (2 gestes) | 2 | 45 à 50 % / 50 à 55 % | 0 % | 2,7 à 6 / 50 | voulu |
| p2-3, p2-6 Petits amis 2 et 3 ch. | 4 | 19 à 20 % / 29 à 30 % (25 %) | 0 % | 0 / 50 | — |
| p2-7 Tous les petits amis, 3 ch. | 8 | 11 % / 14 % (12 %) | 0 % | 0 / 50 | **0 %** |
| p3-1, p3-2, p4-1, p4-2 (2 gestes) | 2 | 49 à 50 % / 50 à 51 % | 0 % | 0 à 6,3 / 50 | voulu |
| p3-3, p4-3 (±5 à ±1) | 5 | 19 % / 21 % (20 %) | 0 % | 0 à 1,7 / 50 | voulu |
| p3-4, p4-4 Grands amis 2 et 3 ch. | 9 | 9 % / 14 % (11 %) | 0 % | 0 / 50 | — |
| p4-5 Tous les grands amis, 3 ch. | 18 | 4 % / 7 % (6 %) | 0 % | 0 / 50 | **50 %** |
| p5-1, p5-2 Combinés | 4 | 21 à 22 % / 29 % (25 %) | 0 % | 0,3 à 1,7 / 50 | voulu |
| p5-3 Combinaisons 2 et 3 ch. | 8 | 11 % / 14 % (12 %) | 0 % | 0 / 50 | — |
| p5-4 Cascades | 2 | 48 % / 52 % | 0 % | 0 / 30 | 51 % |
| p5-5 Révision générale (20 au test) | 54 | 1 % / 14 % (2 %) | 0 % | 0 / 50 | **48 %** |
| p5-e7, p5-e8, p5-e Endurance | 54 | 1 % / 12 à 14 % (2 %) | 0 % | 0 / 20 à 30 | 20 à 28 % |
| p8-t1 3 ch., 10 lignes (6e) | 54 | 1 % / 12 % (2 %) | 0 % | 0 / 30 | **42 %** |
| p8-t2 4 ch., 6 à 7 lignes | 54 | 1 % / 14 % (2 %) | 0 % | 0 / 30 | **44 %** |
| p8-1 4 ch., 10 lignes (5e) | 54 | 1 % / 13 % (2 %) | 0 % | 0 / 30 | **46 %** |
| p8-2 Zéros internes | 54 | 1 % / 13 % (2 %) | 0 % | 0 / 30 | **46 %** |
| p8-3 5 et 6 ch. (4e, 3e) | 54 | 1 % / 14 % (2 %) | 0 % | 0 / 20 | 22 % |
| p9-1 7 et 8 ch. (2e) | 54 | 1 % / 14 % (2 %) | 0 % | 0 / 20 | 18 % |
| p9-2 9 et 10 ch. (1er) | 54 | 1 % / 15 % (2 %) | 0 % | 0 / 20 | 24 % |

Le nombre trop long est **toujours le premier** de la colonne (vérifié sur `p4-5`, `p5-5`, `p8-1` : 100 % des cas en position 1).

## Annexe B — Leçons de × et ÷ (400 exercices par leçon)

| Leçon | Formes générées | Opérande finissant par 0 | Répétitions |
|---|---|---|---|
| p6-1a à p6-1d, p6-1 (2 × 1) | 2 × 1 | 0 % | 2,4 à 11 / 50 |
| p6-2 | 3 × 1, 4 × 1 | 0 % | 0 / 50 |
| p6-3a à p6-3, p6-4 | 2 × 2 ; 3 × 2 | 0 % | 0 à 0,7 |
| p7-1 | ÷1 q1 | 0 % | **15 / 50** |
| p7-2a à p7-2d, p7-2 | ÷1 q2 (q3 en p7-2) | 0 % | 0,7 à 12,3 |
| p7-ea, p7-e, p7-3 | ÷2 q1 | 0 % | 1,7 à 2,1 / 50 |
| p7-4a à p7-4 | ÷2 q2 (q1 en p7-4c) | 0 à 5 % | 0,1 à 2,3 |
| p8-4 (zéros internes) | 3 × 1, 4 × 1 | 0 % | 0,2 / 30 |
| p8-6 (zéros internes) | ÷1 q3, ÷2 q3 | 0 % | 0,2 / 30 |
| p8-5 | 3 × 3, 4 × 3 | 0 % | 0 / 30 |
| p8-7 | ÷3 q2 | 0 % | 0 / 30 |
| p9-3 | 4 × 4, 5 × 4 | 0 % | 0 / 30 |
| p9-5 | ÷4 q3 | 0 % | 0 / 30 |
| p9-4 | 6 × 5 | 0 % | 0 / 30 |
| p9-6 | ÷5 q5 | 0 % | 0 / 30 |
| Piste anzan | 2 × 1, 3 × 1, 2 × 2, 3 × 2 ; ÷1 q2, ÷2 q1, ÷2 q3 | 0 % | 0 à 0,8 / 30 |

Sujets d'examen, à comparer : 14 % (7e), 18 % (6e), 20 % (4e), 19 % (1er) de problèmes entiers avec un opérande finissant par 0.

## Annexe C — Seuils de vitesse des mini-tests

| Leçons | Seuil | Repère |
|---|---|---|
| p1 à p5, p8-t1 à p8-2 | 3 s par chiffre | argent (≈ allure du 6e kyū) |
| p6, p7, p8-4, p8-6 | 5 s par produit | argent |
| p8-3 | 2,33 s par chiffre | 70 % de la cadence du 4e kyū |
| p8-5, p8-7 | 4,66 s par produit | 70 % de la cadence du 4e kyū |
| p8-n, p8-n2, p9-1 | 1,16 s par chiffre | 70 % de la cadence du 2e kyū |
| p9-3, p9-5 | 2,33 s par produit | 70 % de la cadence du 2e kyū |
| p9-2 | 0,83 s par chiffre | 70 % de la cadence du 1er kyū |
| p9-4, p9-6 | 1,67 s par produit | 70 % de la cadence du 1er kyū |

## Sources officielles

- Règlement du 珠算能力検定試験 : https://www.shuzan.jp/kentei/shuzan/
- Règlement du 暗算検定試験 : https://www.shuzan.jp/kentei/anzan/
- Sujets modèles (見本) : https://www.shuzan.jp/kentei/mihon/

---

## Suites données (version 0.37.0)

| Proposition | Décision | État |
|---|---|---|
| C-1 Formes de × et ÷ | Validée, adaptée au niveau | Fait, plus : toutes les formes jusqu'au 1er kyū vues en cours, et × ÷ d'entraînement aux proportions du sujet |
| C-2 Premier nombre | Validée, après les grands amis | Fait (leçons et planches) |
| C-3 Zéros finaux | Validée | Fait (15 %) |
| C-4 Absorption limitée | Explication demandée | En attente |
| C-5, C-6, C-7 | Validées | Faits |
| V-1 Au-delà du platine | Remplacée : l'échelle monte d'un cran après le 3e kyū | Fait |
| V-2 Volume au format | Validée, par semaine | Fait ; aucun chiffre sérieux trouvé sur le volume des élèves japonais (seulement des cas individuels dans la presse) |
| V-3 Portes « or » | Stricte jusqu'aux petits amis ; ensuite argent + volume de l'étape, ou 10 jours | Fait |
| Mesure par geste en anzan | Validée | Fait |
| Examen complet hebdomadaire | Validé, dès le 6e kyū passé ; planches ciblées en tête | Fait |
| Série de placement | Validée | Fait (`p8-pl`, `p9-pl`) |
