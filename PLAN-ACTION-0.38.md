# PLAN D'ACTION UNIFIÉ — après les audits externes de la 0.37.0

Deux audits externes de la version 0.37.0, lus en entier :
- **Audit A**, « Audit de l'application Soroban, version 0.37.0 » (16 pages). Mesure des générateurs, simulation de 10 000 adultes sur 6 ans, sources japonaises.
- **Audit B**, « Audit complet de l'application Soroban » (11 pages). Lecture du code, 5 profils d'élèves, comparaison avec la pratique en juku.

**Méthode.** Chaque défaut cité ci-dessous a été **vérifié dans le code** (lecture, ou exécution des générateurs). La colonne « Vérifié » indique le résultat. Une simulation ne prouve rien à elle seule : les chiffres de l'audit A sur les délais sont des **ordres de grandeur**, issus d'un modèle (loi de puissance de la vitesse, 1 minute de leçon pour 5 minutes de pratique). Les écarts entre rythmes de travail sont plus solides que les délais absolus.

---

## 1. Convergences critiques : confirmées par les deux audits

| # | Défaut | Audit A | Audit B | Vérifié | Gravité |
|---|---|---|---|---|---|
| K-1 | **Pas de × ni ÷ dans les blocs quotidiens.** Dès le 6e kyū, × et ÷ font 200 points sur 300, mais les blocs « automatiser » et « volume / vitesse » ne proposent que des colonnes | Séance recommandée : kake-zan et wari-zan au format du grade, 6 à 8 min | F-1 critique : « angle mort » | Oui : aucune opération dans `blocs.js` ; les × ÷ n'arrivent que par les leçons et l'examen du week-end | **Critique** |
| K-2 | **Pas de programme pour gagner la vitesse d'examen** une fois les leçons validées (« mur de vitesse ») | Critique : à 30 min/j, environ 1 an d'attente au 2e kyū et 3 à 4 ans au 1er (simulation) | F-2 : après le 3e kyū, les leçons p9 sont « scolaires », pas un programme de préparation | Oui : après les leçons, il ne reste que les planches, l'allure affichée et l'examen hebdomadaire ; aucun palier ni jalon de vitesse | **Critique** |
| K-3 | **Rien après le 1er kyū** | Majeur : ni dan, ni flash au-delà de 3 chiffres et 4 nombres | F-2 critique : la séance retombe sur « 30 lignes de marathon », l'examen complet disparaît | Oui : `decisionDuJour` → marathon ; `examenCompletHebdo` → null quand il n'y a plus de grade suivant | **Critique** pour un élève avancé |
| K-4 | **Séance mal dimensionnée** : 15 min par défaut, trop de blocs courts, examen de 20 à 30 min imposé le week-end | Majeur : 15 min double les délais ; recommande 25 à 30 min | F-7 : 5 changements d'activité en 15 min ; examen imposé dès 10 min d'objectif | Oui : `objectifMinutes: 15` ; examen dans l'essentiel dès `objectif >= 10` | **Majeur** |
| K-5 | **Plafonds pour les avancés** dans les modules libres | Flash guidé ≤ 3 chiffres et 4 nombres | F-4 : rythme ≤ 3 chiffres, dictée ≤ 4, × ÷ libre ≤ 6 × 4, défis ≤ 6 chiffres | Oui (rythme : menu 1 à 3 chiffres) | **Majeur** |
| K-6 | **Zenkoren incomplet à partir du 準3** : les 2 épreuves au choix (anzan, denpyō, ōyō) manquent | Majeur | Conformité Zenkoren environ 75 % | Oui. Mais le contenu de ces épreuves **n'est pas publié** : on ne peut pas le reproduire fidèlement | Majeur, **difficile à corriger** |
| K-7 | **Répétitions dans les petits espaces** (colonnes à 1 chiffre, leçons à 2 gestes, ÷ 1 chiffre) | Mineur : 3 à 5 colonnes répétées sur 50 | Mineur : `colonneGeste` à 1 chiffre | En partie : réduit en 0.37 pour × ÷ (p7-1 : de 15 à 5 sur 50) ; pas pour les colonnes à 1 chiffre | Mineur |
| K-8 | **Doigté non vérifié** (seulement déclaré) | Majeur | Mentionné (profil débutant) | Oui, par construction | Majeur, **difficile à corriger** |

## 2. Défauts vus par un seul audit, et vérifiés

| # | Défaut | Source | Vérifié | Gravité |
|---|---|---|---|---|
| U-1 | **Anzan : le planificateur ne voit pas les gestes** (il lit `motifs`, vide en anzan) : aucun équilibrage, mini-tests incomplets | A (critique) | **Oui** : dans p3-a, « +1 grand ami » 2 fois sur 1 600 gestes, « +2 grand ami » 14 fois | **Critique** |
| U-2 | **Divisions décimales tronquées** : `Math.min(nd, 4)` dans `genererDivGrade` | B (majeur) | **Oui** : 220 divisions décimales sur 220 au 1er kyū ont un diviseur de 4 chiffres (il en faut 4 à 6). Touche aussi le 2e, le 準1 et le 準2 | **Majeur** (format d'examen faux) |
| U-3 | **Mini-tests de 20 à 33 minutes** à partir de p8 (au seuil de validation) | A (critique) | Oui par le calcul : p8-1 = 600 chiffres × 3 s = 30 min au seuil. À une vitesse réelle de 1,5 s, environ 15 min, ce qui dépasse quand même une séance de 15 min | **Majeur** |
| U-4 | **Révisions mélangées** : 10 calculs pour 3 à 5 leçons, soit 2 calculs par leçon qui décident de sa boîte | B (critique, avec F-3) | **Oui** | **Majeur** |
| U-5 | **Absorption des révisions** (27 leçons sur 31 retirées par p5-5 ou p5-e) | B (critique) | Oui : c'est le C-4 de l'audit interne, en attente de ta décision | **Majeur** |
| U-6 | **Bascule silencieuse de l'échelle** après le 3e kyū : les médailles reculent sans explication | B (majeur) | **Oui** : aucune annonce | Majeur (expérience) |
| U-7 | **Doublons consécutifs en flash anzan** (même nombre deux fois de suite) | B (mineur) | **Oui** : aucun contrôle dans `questionFlash` | Mineur, mais gênant à haute vitesse |
| U-8 | **pa-5 vise les cascades**, impossibles à 1 chiffre | A (mineur) | Oui par construction (une cascade demande au moins 2 tiges) | Mineur |
| U-9 | **p7-4c : 4 % de quotients finissant par 0** avant la leçon sur les zéros | A (mineur) | Oui (5 % mesuré dans l'audit interne) | Mineur |
| U-10 | **8e kyū et 準3 marqués « indicatif »** alors que le barème de Hyōgo confirme le format | A (mineur) | **Nuancé** : le barème confirme lignes et chiffres, pas le nombre de lignes négatives (ce que la mention signalait) | Mineur : reformuler la mention |
| U-11 | **34 leçons avant le premier grade officiel** ; « 10e kyū express » proposé | A (majeur) | **Juste** : au 10e kyū, il faut 60 points sur 200 et le mitorizan seul en rapporte 100 | Majeur pour la motivation |
| U-12 | **Métronome des drills** trop rapide au départ (10 par minute sur 123456789 × 9) ; écart or / platine sur les petits drills | B (mineur) | Plausible, non mesuré | Mineur |

## 3. Arbitrages : là où les audits divergent, ou contredisent une de tes décisions

| Sujet | Audit A | Audit B | Ta décision actuelle | Mon avis |
|---|---|---|---|---|
| **Objectif par défaut** | 25 min ; 15 min devient « jour chargé » | Garder 15 min, mais 3 blocs au plus | 15 min | **Les deux** : 25 min proposé au premier lancement (choix explicite), et un mode 15 min à 3 blocs au plus. L'examen du week-end passe en « séance longue », pas dans l'essentiel sous 20 min |
| **Porte « or » des étapes 1 et 2** | — | L'assouplir (5 jours, ou 30 CPM) | Garder l'or strict jusqu'aux petits amis | **Garder ta règle** : aucune mesure ne montre de blocage réel. Seul ajout : afficher où l'élève en est (« 2 leçons sur 3 en or ») |
| **Premier nombre de p4-5** | — | Défaut (50 % à 4 chiffres) | Correction seulement après les grands amis | **Garder ta règle** : ce n'est pas un bug |
| **Leçons p9 après le 3e kyū** | Garder, et ajouter des marches d'allure | En faire des paliers de préparation pilotés par l'allure | Toutes les formes vues en cours | **Combiner** : garder p9 (ta règle « toutes les formes vues »), découper ses mini-tests, puis enchaîner sur les marches d'allure |
| **Doigté** | Caméra, en local | Fiche « vitesse 1er kyū » à deux mains | — | **Ni l'un ni l'autre pour l'instant.** La caméra est lourde, peu fiable et touche à la vie privée. Le doigté à deux mains (ryōte-shiki) est une méthode discutée. Proposition : une « clinique du doigté » guidée d'une minute quand une erreur de geste se répète (le diagnostic de la pincée existe déjà) |
| **Seuils régionaux** (Tokyo : 70 points par épreuve) | Option | — | Barème national (shuzan.jp : pas de minimum) | Option dans Réglages, **plus tard** |
| **Calendrier des sessions japonaises** | Proposé | — | — | **Non** : peu utile pour un adulte qui ne passe pas l'examen au Japon |
| **Délais de la simulation** (1er kyū : 3 % en 6 ans à 15 min/j) | Présentés comme résultats | — | — | **À lire comme un ordre de grandeur.** Le message tient (15 min/j ne suffit pas pour les grades hauts), les chiffres exacts dépendent du modèle |

## 4. Mon avis sur les propositions

| Proposition | Source | Avis | Pourquoi |
|---|---|---|---|
| Hakari × ÷ dans les blocs quotidiens dès le 7e kyū, sur la partie la plus en retard (allure) | B, A | **Oui, prioritaire** | Corrige K-1. Les briques existent : × ÷ « au format du kyū » (0.37) et `verdictAllure` |
| Échelle d'allure par grade : 5 marches, de la cadence de validation à l'allure d'examen avec 10 % de marge, chacune validée sur une feuille courte au format | A | **Oui, prioritaire** | Corrige K-2 : un jalon toutes les 2 à 4 semaines au lieu de 2 ans d'attente |
| Séries fractionnées (4 × 90 s à l'allure cible) | A | Oui, dans les marches | Bon outil de vitesse, peu de code |
| Prédiction honnête (date, score projeté) | A, B | **Oui** | Les deux audits la demandent ; l'allure et le volume sont déjà mesurés |
| Naoshi : « reprendre mes erreurs » après une épreuve | B | **Oui** | Petit, et c'est une pratique de juku |
| Mini-tests longs découpés en 3 séries de 5, sur 1 ou 2 jours | A | **Oui** | Corrige U-3 sans baisser l'exigence (13 sur 15 au total) |
| Le prof ne propose pas une leçon plus longue que le temps restant | A | Oui | Simple |
| Séance selon le budget : 3 blocs au plus pour 15 min ; examen complet en « séance longue » | B, A | **Oui** | Corrige K-4 |
| Détection de fatigue (erreurs des 5 dernières colonnes qui doublent) | A, B | Oui, mais plus tard | Utile ; il faut un seuil prudent pour ne pas arrêter l'élève à tort |
| Corrections de code : U-1, U-2, U-7, U-8, U-9, mention « indicatif » | A, B | **Oui, tout de suite** | Bugs confirmés, petits |
| Révisions : C-4 (absorption) et mélange limité à 2 ou 3 leçons de 4 à 5 calculs | B | **Oui** | Deux audits sur trois signalent l'absorption ; il faut ton accord pour C-4 |
| Annonce de la bascule d'échelle après le 3e kyū | B | **Oui** | Une carte une seule fois, et un rappel dans la légende |
| Plafonds levés : rythme 10 chiffres, dictée, × ÷ libres jusqu'à 7 × 5 et ÷6 q6, défis au format du kyū | B | **Oui** | Corrige K-5 |
| Flash étendu (3 chiffres, 15 nombres, temps total réglable) ; aucun doublon | A, B | **Oui** | Corrige K-5 et U-7 |
| Dan d'entraînement (× 60, ÷ 60, mitori 30 en 10 min ; barème en points) | A | **Oui, marqué « entraînement »** | Corrige K-3. Le format vient de sources secondaires (Wikipédia, CCI de Sendai) : le vérifier sur une source officielle de 日本珠算連盟 avant de le coder |
| Cycle d'entretien après le 1er kyū (examen hebdomadaire du 1er kyū ou du dan, hakari sur la partie faible) | B | **Oui** | Corrige K-3 |
| 10e kyū express (passer le 10e dès p5-5, le mitorizan suffisant) | A | **Oui** | Juste sur le barème ; réduit le décrochage du débutant |
| Lecture à voix haute courte dès p2 (dictée de 3 à 5 nombres) | A | Oui | Pratique de juku ; la dictée existe déjà |
| Feuille du jour (même sujet toute la semaine, à battre) | A | Oui, plus tard | Bonne idée d'émulation sans classement en ligne |
| Bilan mensuel | A | Plus tard | Le Bilan imprimable existe déjà |
| Double passe (nido-zan) | B | Plus tard | Utile pour les rapides imprécis ; déjà noté (P-5) |
| Zenkoren : épreuves au choix | A, B | **Non pour l'instant** | Contenu non publié : on inventerait le format |
| Doigté par caméra | A | **Non** | Voir les arbitrages |
| Fiche ryōte-shiki (deux mains) | B | Non (au mieux une note) | Méthode discutée, sans source officielle |
| Seuils régionaux, calendrier japonais | A | Non, ou plus tard | Peu de valeur pour l'élève visé |
| Métronome des drills plus lent ; mémoire des planches plus longue ; anti-répétition persistante | B | Oui, au fil de l'eau | Mineurs, peu de code |

## 5. Plan d'action unifié

| Lot | Contenu | Défauts corrigés | Pourquoi dans cet ordre |
|---|---|---|---|
| **1 · Bugs confirmés** | Anzan : planificateur branché sur les gestes de l'anzan (leçons et mini-tests). Divisions décimales à 5 et 6 chiffres au diviseur. Flash sans doublon. pa-5 sans cascades. p7-4c sans zéro final. Mention « indicatif » reformulée. Annonce de l'échelle après le 3e kyū | U-1, U-2, U-6, U-7, U-8, U-9, U-10 | Faux aujourd'hui ; peu de code ; tests faciles |
| **2 · Révisions** | C-4 (si tu le valides) ; mélange limité à 2 ou 3 leçons de 4 à 5 calculs chacune | U-4, U-5 | Petit, et deux audits le demandent |
| **3 · Séance** | Hakari × ÷ dans les blocs dès le 7e kyū, sur la partie la plus en retard. Budget : 3 blocs au plus à 15 min ; examen complet en « séance longue ». 25 min proposé au premier lancement. Mini-tests longs en 3 séries de 5. Aucune leçon plus longue que le temps restant | K-1, K-4, U-3 | Le cœur du travail quotidien |
| **4 · De la leçon à l'allure** | Échelle d'allure (5 marches par grade, feuilles courtes, séries fractionnées). Prédiction de score et de date. Naoshi après épreuve | K-2 | Le défaut critique des deux audits ; s'appuie sur le lot 3 |
| **5 · Avancés** | Plafonds levés (rythme, dictée, × ÷ libres, défis). Flash étendu. Cycle d'entretien après le 1er kyū. Dan d'entraînement, après vérification du format | K-3, K-5 | Profil le moins nombreux, mais aujourd'hui sans rien |
| **6 · Débutants et motivation** | 10e kyū express. Lecture à voix haute dès p2. Progression affichée sur les portes « or ». Clinique du doigté. Feuille du jour | U-11, K-8 (en partie) | Réduit le décrochage des premiers mois |
| Plus tard | Fatigue, double passe, bilan mensuel, seuils régionaux | — | Utiles, non urgents |
| Non retenu | Zenkoren au choix (format non publié), caméra, calendrier japonais, ryōte-shiki | K-6, K-8 | Expliqué plus haut |

## 6. Ce que les audits ne disent pas, et qu'il faut garder en tête

- **La séance devient le produit.** Les leçons et les examens sont jugés bons par les deux audits. Les points critiques (K-1, K-2, K-4) touchent tous l'organisation du temps. Les lots 3 et 4 changeront donc ce que l'élève voit chaque jour : à tester sur une vraie semaine avant de publier.
- **Ne pas tout empiler.** Hakari, marches d'allure, examen complet, anzan, révisions : sur 25 minutes, il faudra **choisir** chaque jour, pas tout proposer. Règle proposée : un seul bloc de vitesse par jour, en rotation (colonnes, ×, ÷), sur la partie la plus en retard.

## 7. Suites données (version 0.38.0)

Lots 1 à 6 validés, avec ces choix :

| Point | Décision | État |
|---|---|---|
| C-4 Absorption | Étape proche (même étape ou suivante) et 18 gestes au plus | Fait |
| Bloc de vitesse dès le 7e kyū | La partie la plus en retard 2 jours sur 3, rotation colonnes / × / ÷ le 3e | Fait (`core/hakari.js`) |
| Objectif du jour | 25 min proposé à l'accueil ; carte unique pour ceux qui sont à 15 | Fait |
| Examen complet | Dans la séance à partir de 30 min d'objectif (examen blanc : 20), sinon « séance longue » à part | Fait |
| Mini-tests longs | Séries de 5, même exigence au total, valables jusqu'au lendemain | Fait |
| Marches d'allure | 2 feuilles réussies, 2 jours différents, 90 % de justes | Fait (`core/marches.js`) |
| 10e kyū express | Dès la fin des colonnes (p5) | Fait |
| Flash | Jusqu'à 3 chiffres et 15 nombres | Fait |
| Dan d'entraînement | Format officiel introuvable depuis l'environnement (shuzan.jp inaccessible), sources secondaires contradictoires | **En attente** |
| Lecture à voix haute dès p2 | La dictée est déjà proposée dès p1-4, deux fois par semaine | Rien à changer |
