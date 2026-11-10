# SPECS — Soroban 0.21.3 : audit et cahier des charges

Destinataire : agent d'implémentation (Claude Code) travaillant dans `maximeroger72mr-dot/SorobanDojo`.
Base auditée : commit `13b1585`, 105 tests sur 105 au vert.

Conventions de ce document :

- **[MESURÉ]** : chiffre obtenu en exécutant le code du dépôt (banc décrit en annexe A).
- **[LU]** : constaté dans le code source.
- **[SOURCE]** : règle d'examen recoupée par recherche web (pages officielles non ouvertes directement, voir annexe B).
- **[À VÉRIFIER]** : hypothèse à confirmer avant d'implémenter.

Contraintes non négociables :

1. Le soroban physique est le support **exclusif**. Le soroban à l'écran ne sert qu'à montrer. Pas de glisser de boules, pas de physique.
2. Le code reste en JavaScript (modules ES, JSDoc, `node --test`). Les types ci-dessous sont écrits en notation TypeScript pour la précision ; ils se traduisent en JSDoc, sans migration.
3. `Soroban.html` est généré (`npm run html`). On ne le modifie jamais à la main.
4. Référentiel d'examen : Chambre de commerce et d'industrie du Japon (1er au 3e kyū) et Ligue japonaise du soroban, 日本珠算連盟 (4e au 10e kyū).

---

# 1. SYNTHÈSE EXÉCUTIVE & NOTATION

| Axe | Note | Commentaire |
|---|---|---|
| Moteur de gestes et modèle | 9/10 | État logique séparé du rendu, simulateur de gestes testé |
| Pédagogie du parcours | 8,5/10 | Progression fine, révision espacée, maîtrise « juste ET rapide » |
| Planches d'entraînement | 7,5/10 | Très bonnes sur un geste ; faiblesses sur les planches mélangées courtes |
| Conformité des épreuves officielles | 5/10 | Plusieurs écarts de format avec le référentiel choisi |
| Boucle de remédiation après planche | 6/10 | Diagnostic présent, mais rien n'enchaîne sur une reprise ciblée |
| Lisibilité de l'offre (≈ 40 activités) | 6,5/10 | Le « prof » compense ; l'entraînement libre reste touffu |
| **Global** | **7,5/10** | |

## Forces à préserver

- Classement de chaque opération en **motifs** (`+4:petit`, `-8:mixte`, `cascade+`) par simulation réelle, pas par règle approchée.
- Planches « un geste » construites par **rôles** (geste, piège, famille, direct) : c'est la meilleure idée du projet, elle force à regarder la tige avant d'agir.
- Diagnostic prudent : un geste n'est mis en cause que si l'écart le prouve.
- Charge très stable d'une planche à l'autre **[MESURÉ]** : coefficient de variation de 1,6 à 5,6 % par feuille.
- Génération rapide **[MESURÉ]** : 15 à 130 ms par planche. Aucun chantier de performance n'est justifié.

## Faiblesses bloquantes

1. **Épreuves officielles non conformes** au référentiel retenu (détail en section 5) : longueur des lignes du mitorizan, nombre de chiffres en × et ÷, type d'arrondi, problème à résultat négatif.
2. **Planches mélangées courtes incomplètes [MESURÉ]** : sur « tout mélangé », 2 chiffres × 5 lignes × 10 colonnes, la couverture moyenne est de 84 % des gestes. `+1 grand ami` manque dans 69 % des planches, `−1 grand ami` dans 63 %, `+2 grand ami` dans 57 %, l'emprunt en cascade dans 48 %.
3. **Planches non reproductibles [LU]** : pas de graine, sauf pour le défi de la semaine. Impossible de rejouer une planche ratée ou de comparer deux temps sur la même.
4. **Repli brutal [LU]** : dans `modules/planches.js`, si une seule colonne « geste » échoue après 5 essais, toute la planche bascule en « planche classique ». Taux d'échec par colonne **[MESURÉ]** : 2,1 %.
5. **Opérandes de × et ÷ trop faciles [MESURÉ]** : 11 à 15 % des problèmes d'examen ont un facteur qui finit par 0.

## Rectificatif par rapport à mon premier avis

J'avais avancé que le tirage uniforme des épreuves faisait varier la difficulté d'un sujet à l'autre. La mesure ne le confirme pas au niveau de la feuille (variation de 2 à 6 %). Le vrai problème des épreuves est la conformité du format, pas la variance.

## Trois chantiers prioritaires

1. **Conformité des épreuves** (tickets E-1 à E-4).
2. **Planificateur de planche** : quotas de gestes, graine, charge affichée (tickets P-1 à P-6).
3. **Boucle de remédiation** : reprise des colonnes fausses, puis planche ciblée (tickets R-1 à R-3).

---

# 2. BENCHMARK CONCURRENTIEL — Kani Math

Limite : le site `kani-math.com` n'est pas joignable depuis la session d'audit. Ce qui suit vient des extraits de moteur de recherche et reste **[À VÉRIFIER]** en ouvrant le site.

| Fonction annoncée par Kani Math | État dans Soroban | Action |
|---|---|---|
| Outils gratuits dans le navigateur, sans compte | Équivalent (`Soroban.html`) | — |
| Boulier virtuel jusqu'à 15 tiges | 13 tiges, démonstration seulement | Ne pas suivre (support physique exclusif) |
| 22 pages d'exercices par niveau, sprints chronométrés | Parcours + défis chrono | — |
| Générateur de fiches PDF (chiffres, lignes, opérations, nombre, corrigé) | Impression avec corrigé séparé | Égaler : en-tête d'examen, graine imprimée (P-2, E-4) |
| Flash anzan « par règle de boulier », vitesse, chiffres, nombre, voix | Anzan par geste, dictée séparée | Égaler : voix dans le flash (A-2) |
| Examens blancs de l'**anzan kentei** (暗算検定), 10e au 5e kyū gratuits | **Absent** | Rattraper (A-3) |
| Examen flash anzan par paliers, du 20e kyū au 20e dan | Paliers d'image et de vitesse, non gradés | Optionnel (A-4) |
| Niveaux supérieurs réservés à l'application payante | Tout gratuit, hors ligne | Avantage à conserver |

## Où Soroban surclasse déjà

- Pédagogie **au geste** avec piège et famille : rien d'équivalent n'apparaît dans les extraits.
- Diagnostic de l'erreur à partir du résultat, révision espacée, niveaux de maîtrise chronométrés.
- Public adulte francophone, soroban réel en main, aucune donnée envoyée.

## Où Soroban est en retard

- Pas d'épreuve d'anzan gradée.
- Pas de planche partageable (un code ou une graine suffirait).
- Épreuves de kyū moins fidèles au format officiel qu'un site qui s'en réclame.

---

# 3. ARCHITECTURE TECHNIQUE & MACHINES À ÉTATS

## 3.1 Existant à conserver tel quel [LU]

| Couche | Fichiers | Rôle |
|---|---|---|
| État logique | `core/soroban.js` | `tiges[] = { celeste: boolean, terrestres: 0..4 }`, valeur dérivée |
| Méthode | `core/gestes.js`, `core/motifs.js` | Décompose `± n` en mouvements et en motifs |
| Génération | `core/generateur.js`, `core/colonneGeste.js`, `core/epreuves.js`, `core/multiplication.js` | Colonnes, planches, sujets |
| Rendu | `ui/sorobanVue.js` | SVG, abonné à l'état, `transform` CSS |
| Écrans | `modules/*.js` | `{ id, titre, monter(conteneur, app) }` |

L'état et le rendu sont bien séparés. Il n'y a rien à refondre.

## 3.2 Décisions d'architecture

| N° | Décision | Raison |
|---|---|---|
| D-1 | Pas de glisser, pas de `pointermove` sur les boules | Support physique exclusif ; le clic suffit pour les démonstrations |
| D-2 | Remise à zéro : `soroban.definirValeur(0)` puis une seule transition CSS de 150 ms, coupée si `prefers-reduced-motion` | Suffisant pour un outil de démonstration |
| D-3 | Le hasard passe par un générateur injecté, plus par `Math.random` global | Reproductibilité et tests statistiques |
| D-4 | Toute planche est décrite par `(spec, graine)` et se reconstruit à l'identique | Rejouer, partager, imprimer avec corrigé cohérent |
| D-5 | Pas de migration TypeScript, pas de dépendance d'exécution | Fichier unique hors ligne |

## 3.3 Hasard reproductible (D-3)

Aujourd'hui `core/hasard.js` remplace temporairement `Math.random` (`avecGraine`). C'est acceptable en transition, fragile à terme (tout appel asynchrone pendant la génération casserait la reproductibilité).

```ts
// core/hasard.js
export type Rng = () => number;                 // dans [0, 1)
export function creerRng(graine: number): Rng;  // mulberry32, déjà présent
export function graineAleatoire(): number;      // entier 32 bits, via crypto.getRandomValues
export function codeDepuisGraine(g: number): string; // 6 caractères, base 32 sans 0/O/1/I
export function graineDepuisCode(code: string): number | null;

// core/aleatoire.js : même API, plus un rng optionnel en dernier argument
export function entier(min: number, max: number, rng?: Rng): number;
export function choisir<T>(liste: T[], rng?: Rng): T;
export function melanger<T>(liste: T[], rng?: Rng): T[];
export function tirerPondere<K extends string>(cles: K[], poids: Record<K, number>, rng?: Rng): K;
```

Étape 1 (P-1) : la planche s'exécute sous `avecGraine(graine, …)`. Étape 2 (P-6, facultative) : passage du `rng` en paramètre dans `generateur.js` et `colonneGeste.js`, suppression des `Math.random` de `src/core` (25 appels recensés hors `curriculum.js`).

## 3.4 Modèle de données des planches

```ts
type CleMotif = string;                 // '+4:petit', '-8:mixte', 'cascade+'
type Regle = 'direct' | 'petit' | 'grand' | 'mixte' | 'cascade';

interface Ligne { op: '+' | '-'; n: number }

interface Colonne {
  type: 'addsub';
  lignes: Ligne[];                      // la 1re est le nombre posé
  resultat: number;
  motifs: CleMotif[];
  motifsLignes: CleMotif[][];
  roles?: ('G' | 'P' | 'F' | 'D')[];    // planches « un geste »
  cout: number;                         // NOUVEAU, voir 4.2
  assoupli?: boolean;
}

interface SpecPlanche {
  version: 1;
  genre: 'geste' | 'melange' | 'examen';
  chiffres: number;                     // 1..6 ; ou [min, max]
  lignes: number;
  colonnes: number;
  cibles: CleMotif[];
  autorises: CleMotif[] | null;         // null = tout
  mode?: 'seul' | 'famille';
  zeros?: boolean;
  profil?: 'plat' | 'rampe';            // NOUVEAU, voir 4.4
}

interface Planche {
  spec: SpecPlanche;
  graine: number;
  code: string;                         // affiché et imprimé
  colonnes: Colonne[];
  bilan: BilanPlanche;                  // NOUVEAU, voir 4.3
}

interface BilanPlanche {
  occurrences: Record<CleMotif, number>;
  couverture: number;                   // part des cibles vues au moins quotaMin fois
  coutTotal: number;
  coutParColonne: { min: number; max: number; moyenne: number };
  replis: string[];                     // messages de repli, vide si aucun
}
```

## 3.5 Machine à états d'une feuille

```
PRETE ──(1re frappe ou « Commencer »)──▶ EN_COURS
EN_COURS ──(Entrée sur la dernière case | temps écoulé | « Corriger »)──▶ CORRIGEE
CORRIGEE ──(« Reprendre les fausses »)──▶ REPRISE ──(toutes justes ou abandon)──▶ BILAN
CORRIGEE ──(aucune fausse)──▶ BILAN
BILAN ──(« Rejouer cette planche » : même graine)──▶ PRETE
BILAN ──(« Nouvelle planche » : nouvelle graine)──▶ PRETE
```

Règles :

- Le chrono démarre à l'entrée dans `EN_COURS` et s'arrête à `CORRIGEE`. La reprise a son propre chrono, non compté dans le record.
- Seule la première passe alimente les statistiques de maîtrise. La reprise alimente seulement le compteur « corrigée du premier coup ».
- Clavier déjà en place **[LU]** : Entrée passe à la case suivante, puis corrige sur la dernière. À ajouter : flèches haut et bas entre cases, `Échap` ne quitte jamais sans confirmation.
- Pavé numérique : les chiffres, la virgule et `Entrée` du pavé doivent fonctionner dans toutes les cases (test manuel exigé sur Windows, où le séparateur du pavé envoie `.`). `core/nombres.js` accepte déjà virgule et point.

## 3.6 Minuterie du flash anzan

État **[LU]** : `setTimeout` avec affichage sur 85 % de la durée et blanc sur 15 % ; durées de 3 s à 0,3 s. À 0,3 s, une dérive de 16 ms représente 5 %.

Spécification (A-1) :

```ts
// ui/cadence.js
/** Appelle surTic(i) à des instants calés sur l'horloge, sans dérive cumulée. */
export function cadencer(opts: {
  periodeMs: number;        // 200..3000
  nombre: number;
  partVisible: number;      // 0.85
  surAfficher(i: number): void;
  surMasquer(i: number): void;
  signal?: AbortSignal;
}): Promise<{ ecartMaxMs: number }>;
```

- Calcul des échéances à partir de `performance.now()` au départ (échéance `i = t0 + i × période`), boucle `requestAnimationFrame`. Jamais de `setTimeout` enchaînés.
- Plancher à 200 ms. Le prompt initial demandait 50 ms : c'est trois images d'écran, illisible, et sans intérêt pour un adulte débutant.
- `ecartMaxMs` est journalisé ; au-delà de 25 ms, la série est marquée « non chronométrée » et ne compte pas pour un succès.

---

# 4. SPÉCIFICATIONS ALGORITHMIQUES

## 4.1 Planificateur de planche (remplace le tirage colonne par colonne)

Problème : chaque colonne équilibre ses gestes localement, personne ne regarde la planche entière. D'où les gestes rares absents (faiblesse n° 2).

Principe : **budgéter avant de tirer**. On fixe pour la planche un quota par geste, on le répartit entre colonnes, puis chaque colonne reçoit des poids qui reflètent ce qui lui reste à fournir.

```ts
// core/planche.js (nouveau)

export function quotas(spec: SpecPlanche, poidsEleve: Record<CleMotif, number>): Record<CleMotif, number> {
  // Opérations-chiffres disponibles : colonnes × (lignes − 1) × chiffres.
  // Part visée pour les cibles : 45 % (le reste revient aux gestes directs, inévitables).
  const capacite = spec.colonnes * (spec.lignes - 1) * chiffresMoyens(spec) * 0.45;
  // Plancher : chaque cible réalisable au moins 2 fois (1 fois si capacite < 2 × nbCibles).
  // Surplus : réparti au prorata de poidsEleve (dette d'erreurs, lenteur), plafonné à 4 × le plancher.
}

export function repartir(q: Record<CleMotif, number>, colonnes: number, rng: Rng): Record<CleMotif, number>[];
// Tourniquet mélangé : un même geste ne tombe pas deux fois de suite dans la même colonne
// tant que d'autres colonnes n'en ont pas reçu.

export function genererPlanche(spec: SpecPlanche, graine: number, eleve?: ProfilEleve): Planche {
  // 1. q = quotas(spec, poids) ; plan = repartir(q, spec.colonnes, rng)
  // 2. Pour chaque colonne k :
  //      poids_k[c] = 6 si plan[k][c] > 0, sinon 0.3     (cibles « dues » très favorisées)
  //      col = genererColonneVariee({ ...spec, poids: poids_k }, memoire)
  //      reste[c] -= occurrences réelles dans col
  // 3. Rattrapage : tant qu'un geste réalisable reste dû, régénérer la colonne la moins utile
  //    (celle dont le retrait coûte le moins de couverture), 3 passes au plus.
  // 4. Ordonner selon spec.profil (4.4) ; calculer le bilan (4.3).
}
```

Faisabilité : un geste est « réalisable » pour un format si `genererOperation` réussit avec ce geste seul comme cible. `cascade±` n'est pas réalisable à 1 chiffre : il sort des quotas et le repli est écrit dans `bilan.replis`.

Critères chiffrés (vérifiés par le banc, annexe A) :

| Format « tout mélangé » | Couverture actuelle | Cible |
|---|---|---|
| 2 chiffres × 5 lignes × 10 colonnes | 84 % en moyenne, minimum 72 % | ≥ 95 % en moyenne, minimum ≥ 89 % |
| 3 chiffres × 10 lignes × 10 colonnes | 99,5 % | 100 % |
| Tout format : geste réalisable absent | jusqu'à 69 % des planches | ≤ 5 % des planches |

Les planches « un geste » (`colonneGeste.js`) gardent leur construction par rôles. Seul change le repli : on régénère la colonne en échec (20 essais, puis mode sans piège) au lieu d'abandonner la planche.

## 4.2 Coût d'une colonne

Le dépôt possède déjà une pondération par famille (`core/drills.js`, `POIDS_GESTE`). On la réutilise.

```ts
// core/charge.js (nouveau)
export const POIDS_GESTE = { direct: 0.6, petit: 1, grand: 1.1, mixte: 1.4, cascade: 1.4 }; // déplacé depuis drills.js
export function coutColonne(lignes: Ligne[]): number {
  return occurrencesColonne(lignes).flat()
    .reduce((s, o) => s + POIDS_GESTE[analyserMotif(o.cle).regle], 0);
}
```

Usages :

- Affichage sur la planche : « charge 150 » avec repère par rapport à la moyenne du format.
- Temps cible d'une planche = `coutTotal × secondesParUnité(niveau)` au lieu d'un temps par chiffre. Calibrer `secondesParUnité` sur l'historique existant avant de remplacer quoi que ce soit **[À VÉRIFIER]**.
- Références mesurées, pour fixer des bornes de test : 15 par colonne (2 ch. × 5 l.), 44,5 (3 ch. × 10 l.), 67 (5 ch. × 10 l.).

## 4.3 Bilan de planche affiché à l'élève

Sous la planche, avant de commencer :

- gestes travaillés et nombre d'occurrences (les trois plus fréquents, « + n autres ») ;
- charge totale et temps cible aux trois niveaux ;
- code de la planche ;
- messages de repli éventuels, en clair.

## 4.4 Ordre des colonnes

- `plat` (défaut pour les planches « un geste ») : ordre du tirage.
- `rampe` (défaut pour les planches mélangées de 10 colonnes ou plus) : les 2 colonnes les moins coûteuses en tête (échauffement), les plus coûteuses aux positions 60 à 80 %, une colonne moyenne pour finir. Tri stable sur `cout`.

## 4.5 Variété : règles existantes et ajouts

Déjà en place **[LU]**, à conserver : pas de ligne répétée ni annulée, pas de ping-pong, au moins 3 valeurs par colonne, aucune valeur sur plus de la moitié des lignes, résultats et chiffres des unités variés sur la planche, formes de colonne uniques.

À ajouter dans `colonneValide` (mode strict) et à couvrir par test :

| Règle | Énoncé |
|---|---|
| V-1 | Aucun sous-total égal à 0 avant la dernière ligne |
| V-2 | Aucun sous-total « rond » (multiple de 10^chiffres) deux fois dans la colonne |
| V-3 | À 2 chiffres et plus : pas plus de 2 lignes de suite avec le même chiffre des unités |
| V-4 | À 3 chiffres et plus : pas de nombre à chiffres tous identiques (333) plus d'une fois par colonne |
| V-5 | Sur la planche : aucun premier nombre répété (déjà vrai pour « geste », à étendre) |

## 4.6 Opérandes de multiplication et de division

```ts
// core/multiplication.js
/** Facteur d'examen : pas de 0 final, pas de 1 en chiffre unique, au plus un 0 interne. */
export function facteurExamen(k: number, rng?: Rng): number;

/** Série équilibrée : sur n problèmes, chaque chiffre 2..9 apparaît comme multiplicateur
 *  à ±1 près ; les produits de table lents de l'élève sont sur-représentés (× 2, plafonné). */
export function serieMuldiv(spec: { type: 'mul' | 'div'; total: number; nb: number; maxDiviseur?: number },
                            statsTables?: StatsTables, rng?: Rng): Probleme[];
```

Critères : part des problèmes dont un opérande finit par 0 ≤ 1 % (actuel : 11 à 15 %) ; aucun doublon dans un sujet (déjà vrai).

## 4.7 Diagnostic des erreurs

Existant **[LU]** : ligne oubliée, comptée deux fois, signe inversé ; écart de 5 (boule céleste) ; écart de 1 (retenue ou emprunt) ; chiffres voisins inversés ; produit oublié, décalé, doublé ; quotient décalé ou ±1 ; virgule ; arrondi.

Ajouts, toujours avec la règle « on n'accuse que ce que le résultat prouve » :

```ts
type Cause =
  | { code: 'ligne-oubliee' | 'ligne-doublee' | 'signe'; ligne: number }
  | { code: 'celeste' | 'retenue'; rang: number; ligne?: number; motifs?: CleMotif[] }
  | { code: 'lecture-tige'; ligne: number; rang: number }      // NOUVEAU
  | { code: 'decalage-colonne'; ligne: number; sens: 'gauche' | 'droite' } // NOUVEAU
  | { code: 'deux-tiges'; rangs: [number, number] }            // NOUVEAU
  | { code: 'recopie' }                                        // chiffres voisins inversés
  | { code: 'inexpliquee' };

export function diagnostiquerColonne(ex: Colonne, reponse: number): Cause[]; // triées par vraisemblance
```

| Code | Détection | Message |
|---|---|---|
| `lecture-tige` | Il existe une ligne et un rang tels que remplacer UN chiffre de cette ligne par un autre explique exactement l'écart, et cette ligne est la seule dans ce cas | « Ligne 4 : avez-vous lu 478 au lieu de 498 ? » |
| `decalage-colonne` | Écart = 9 × ligne ou −0,9 × ligne (ligne posée une tige trop à gauche ou à droite), ligne unique | « Ligne 3 posée une tige trop à gauche » |
| `deux-tiges` | Écart = a × 10^i + b × 10^j avec a, b dans {±1, ±5} | « Deux tiges fausses : centaines et unités » ; aucun geste accusé |

Le format texte actuel est conservé par une fonction `libelleCause(cause)` ; les écrans ne changent pas.

## 4.8 Sélection adaptative

`poidsEquilibre` **[LU]** pondère selon le nombre d'essais et double le poids des gestes en dette. Deux ajouts :

- **Lenteur** : un geste dont le temps médian dépasse le seuil de son niveau reçoit × 1,5 (hors planches « points faibles », qui le font déjà).
- **Ancienneté** : un geste non vu depuis plus de 14 jours reçoit × 1,5. Champ `dernierEssai` à ajouter à la fiche du motif, avec migration de sauvegarde (version + 1) et test dans `tests/sauvegarde.test.js`.

---

# 5. MATRICE PÉDAGOGIQUE OFFICIELLE 10e ➔ 1er KYŪ

## 5.1 Format des épreuves : référentiel et écarts

Durée et barème : une seule durée pour les trois parties, aucun point négatif. Le prompt initial parlait de « 10 minutes » et de « pénalités » : c'est faux pour ce référentiel.

| Kyū | Organisme | Durée | Mitorizan (10 problèmes) | Multiplication | Division | Réussite |
|---|---|---|---|---|---|---|
| 1er | JCCI | 30 min | 10 lignes, **10 chiffres par ligne** (100 chiffres) ; **1 résultat négatif** en 2e moitié | 20 pb, 11 chiffres au total | 20 pb, 10 chiffres | 240/300 |
| 2e | JCCI | 30 min | 10 lignes, **8 chiffres** (80) ; résultat négatif possible | 20 pb, 9 chiffres | 20 pb, **8** | 240/300 |
| 3e | JCCI | 30 min | 10 lignes, **6 chiffres** (60) ; aucun négatif | 20 pb, **7** | 20 pb, **6** | 240/300 |
| 4e | Ligue | 30 min | 10 lignes, 50 chiffres au total | 20 pb, 7 | 20 pb, **6** | 210/300 |
| 5e | Ligue | 30 min | 10 lignes, 40 chiffres au total | 20 pb, 6 | 20 pb, **5** | 210/300 |
| 6e | Ligue | 30 min | 10 problèmes, 3 chiffres | 20 pb [À VÉRIFIER] | 20 pb, **4** | 210/300 [À VÉRIFIER] |
| 7e, 8e | Ligue | 20 min | 10 problèmes | 10 problèmes | 10 problèmes | [À VÉRIFIER] |
| 9e, 10e | Ligue | 20 min | 10 problèmes | 10 problèmes | **aucune** [À VÉRIFIER] | [À VÉRIFIER] |

En gras : valeurs qui diffèrent de `core/epreuves.js`. Tout est **[SOURCE]** sauf mention contraire.

Arrondis du 1er au 3e kyū **[SOURCE]** : en × comme en ÷, les 10 premiers problèmes sont des nombres sans unité, arrondis **à la 3e décimale** ; les 10 suivants sont des montants en yens, arrondis **à l'unité**.

Écarts constatés dans le code **[LU]** :

| N° | Code actuel | Référentiel |
|---|---|---|
| X-1 | Mitorizan 1er kyū : lignes de 8 à 10 chiffres ; 2e : 7 à 8 ; 3e : 6 à 7 | Longueur fixe : 10, 8, 6 |
| X-2 | Division 2e kyū : 9 chiffres ; 3e : 8 ; 4e : 7 ; 5e : 6 ; 6e : 5 | 8, 6, 6, 5, 4 |
| X-3 | Multiplication 3e kyū : 8 chiffres | 7 |
| X-4 | Seconde moitié des × et ÷ en décimaux, arrondie au millième (dix-millième en ÷ au 1er kyū) | Première moitié au millième, seconde moitié à l'unité |
| X-5 | Aucun résultat négatif en examen ; la leçon `p8-n` est « facultative » | Exigé au 1er kyū, présent au 2e : la leçon devient prérequis de ces deux grades |
| X-6 | 9e kyū avec division | À confirmer sur la fiche officielle avant de toucher |
| X-7 | Seuils `0.7` et `0.8` | Corrects (210 et 240 sur 300) |

Règle de mise en œuvre : `GRADES` devient la seule source de vérité, chaque ligne porte un champ `source` (URL et date de consultation) et un champ `verifie: boolean`. L'écran Grades affiche « format indicatif » tant que `verifie` est faux.

## 5.2 Matrice grade ➔ compétences ➔ leçons

| Kyū | Opérations | Gestes et savoir-faire clés | Leçons du parcours | Critère de passage dans l'application |
|---|---|---|---|---|
| 20e à 11e prép. | Additions et soustractions, 1 à 3 chiffres | Directs, petits amis, grands amis, combinaisons, cascades | `p1` à `p5` | 20 colonnes, 70 %, temps fixe (existant) |
| 10e | Mitorizan 2 chiffres ; × 2 par 1 | Tous les gestes ± ; produit sur deux tiges (« 06 ») | `p5-5`, `p6-a` à `p6-1` | Épreuve ≥ 70 % |
| 9e | Idem, colonnes plus longues | Endurance sur 6 lignes | + `p7-0`, `p7-1` si division confirmée | Épreuve ≥ 70 % |
| 8e | × à 4 chiffres au total ; ÷ à 3 | Placement du premier produit et du quotient | `p6-2`, `p7-2` | Épreuve ≥ 70 % |
| 7e | Mitorizan 10 lignes ; ÷ à 4 | Division par 2 chiffres : estimer, corriger | `p6-3`, `p7-e` à `p7-4` | Épreuve ≥ 70 % |
| 6e | Mitorizan 3 chiffres × 10 lignes ; × 5 ; ÷ 4 | Lecture anticipée, zéros | `p8-t1`, `p6-4` | 210/300, gestes « confirmés » |
| 5e | Mitorizan 4 chiffres ; × 6 ; ÷ 5 | Zéros internes en × et ÷ | `p8-t2`, `p8-1`, `p8-2`, `p8-4`, `p8-6` | 210/300 |
| 4e | Mitorizan 5 chiffres ; × 7 ; ÷ 6 | Division par 3 chiffres | `p8-3`, `p8-5`, `p8-7` | 210/300 |
| 3e | Mitorizan 6 chiffres ; × 7 ; ÷ 6 ; décimaux | Point des unités, arrondi au millième et à l'unité | Palier décimaux complet | 240/300 |
| 2e | Mitorizan 8 chiffres ; × 9 ; ÷ 8 | Résultat négatif par le complément | + `p8-n` (obligatoire) | 240/300 |
| 1er | Mitorizan 10 chiffres ; × 11 ; ÷ 10 | Endurance, 1 négatif garanti | + nouvelles leçons 7 à 10 chiffres (C-2) | 240/300 |

Trou du parcours **[LU]** : les colonnes s'arrêtent à 6 chiffres (`p8-3`) alors que le 3e kyū en demande 6, le 2e 8 et le 1er 10. Il manque les marches 7-8 et 9-10 chiffres (ticket C-2).

## 5.3 Règles de doigté (méthode à deux doigts)

Le code les applique déjà **[LU]** (`core/gestes.js`). Formalisation pour les tests :

```ts
type Doigt = 'pouce' | 'index';
type Mouvement =
  | { perle: 'terrestre'; sens: 'monte' }     // vers la barre : +1
  | { perle: 'terrestre'; sens: 'descend' }   // −1
  | { perle: 'celeste'; sens: 'descend' }     // vers la barre : +5
  | { perle: 'celeste'; sens: 'monte' };      // −5

const DOIGT = (m: Mouvement): Doigt =>
  m.perle === 'terrestre' && m.sens === 'monte' ? 'pouce' : 'index';
```

| Règle | Énoncé |
|---|---|
| Y-1 | Le pouce ne fait que monter des terrestres |
| Y-2 | L'index descend les terrestres et manœuvre la céleste dans les deux sens |
| Y-3 | Pincée (+6 à +9 direct) : index sur la céleste et pouce sur les terrestres, en un seul temps |
| Y-4 | −6 à −9 direct : l'index relève la céleste et descend les terrestres d'un seul mouvement |
| Y-5 | Ordre de choix sur une tige : direct, puis petit ami, puis grand ami |
| Y-6 | Grand ami en addition : complément d'abord, retenue ensuite ; en soustraction : emprunt d'abord |
| Y-7 | Calcul de gauche à droite |

Vocabulaire : les termes *Torite*, *Ishikiri* et *Reiten* du prompt initial ne sont pas attestés ; ne pas les introduire dans l'interface. Le point des unités se dit 定位点 (*teiiten*).

---

# 6. EXPÉRIENCE DE L'APPRENANT

## 6.1 Les quatre modes demandés et l'existant

| Mode demandé | Existant | Verdict |
|---|---|---|
| Dojo Découverte | « Apprendre » : leçons, démonstrations, mini-tests (15 exercices, 13 justes) | Conserver |
| Atelier gestuel | « S'entraîner » : planches, marathon, lièvre, drills | Conserver, simplifier l'entrée (U-1) |
| Arène Anzan | Piste parallèle + entraînement libre | Compléter (A-1 à A-3) |
| Examen blanc | « Se mesurer » : passage de kyū, épreuves officielles | Mettre en conformité (E-1 à E-4) |

Le menu à 5 entrées et la séance du jour sont meilleurs que l'arborescence à 4 modes proposée : ne pas réorganiser.

## 6.2 Propositions pédagogiques

1. **Reprise des fausses** (R-1). Après correction, l'élève refait seulement les colonnes fausses, sans voir sa première réponse. C'est le gain d'apprentissage le plus rentable du document.
2. **Planche de remédiation en un clic** (R-2). Le bilan propose une planche de 5 colonnes sur les gestes mis en cause, à 1 chiffre de moins.
3. **Journal d'erreurs** (R-3). Les colonnes fausses reviennent en révision espacée (J+1, J+3, J+7), comme les leçons.
4. **Allure d'examen** (E-3). Pendant une épreuve, une barre discrète indique l'avance ou le retard sur le rythme nécessaire. Désactivable.
5. **Stratégie d'examen** (C-3). Une leçon courte : ordre des parties, quand sauter un problème, relire sa saisie. Rien de tel aujourd'hui.
6. **Double passe** (P-5). Option de planche : chaque colonne est calculée deux fois ; on ne saisit que si les deux résultats concordent. C'est la méthode de vérification enseignée en classe au Japon **[À VÉRIFIER]**, et elle réduit les erreurs de recopie.
7. **Entrée simplifiée dans l'entraînement** (U-1). Trois boutons en tête de « S'entraîner » : *Ce que le prof conseille*, *Un geste précis*, *Comme à l'examen*. Les cartes actuelles passent en dessous.

---

# 7. FEUILLE DE ROUTE D'IMPLÉMENTATION

Ordre conseillé : P-0, puis E-1 à E-2 (corrections de fond), puis P-1 à P-4, puis R-1 à R-2, puis le reste. Chaque ticket se termine par `npm test` au vert et `npm run html`.

## Lot P — Planches

### P-0 · Banc de qualité des planches
- **Objectif** : mesurer avant de modifier.
- **Fichiers** : `scripts/banc-planches.mjs` (nouveau), `package.json` (script `banc`).
- **DoD** :
  - reproduit les mesures de l'annexe A à ±2 points avec une graine fixe ;
  - sort un JSON : couverture, gestes absents, coût (moyenne, dispersion), répartition des chiffres, taux de repli, durée de génération ;
  - `npm run banc -- --seuils` échoue si un seuil de la section 4.1 ou 4.6 n'est pas tenu.

### P-1 · Graine et code de planche
- **Objectif** : toute planche se rejoue à l'identique.
- **Fichiers** : `core/hasard.js`, `modules/planches.js`, `ui/feuille.js`, `tests/planche.test.js` (nouveau).
- **DoD** :
  - même `(spec, graine)` ⇒ mêmes colonnes (test sur 50 graines) ;
  - code à 6 caractères affiché et imprimé ; champ « Rejouer un code » ;
  - boutons « Rejouer cette planche » et « Nouvelle planche » dans le bilan ;
  - le record n'est proposé que sur une planche jouée pour la première fois.

### P-2 · Planificateur par quotas
- **Objectif** : aucun geste réalisable absent d'une planche mélangée.
- **Fichiers** : `core/planche.js` (nouveau), `modules/planches.js`, `core/examen.js` (`sujetExamen`), `tests/planche.test.js`.
- **DoD** : seuils du tableau 4.1 tenus au banc ; durée de génération ≤ 250 ms par planche ; les 105 tests existants restent verts.

### P-3 · Coût, bilan et ordre des colonnes
- **Objectif** : rendre la charge visible et régulière.
- **Fichiers** : `core/charge.js` (nouveau), `core/drills.js` (import), `core/planche.js`, `ui/feuille.js`.
- **DoD** : `cout` présent sur chaque colonne ; bilan affiché avant le départ (4.3) ; profil `rampe` testé ; dispersion du coût total ≤ 5 % au banc pour tout format de 10 colonnes.

### P-4 · Repli par colonne et règles V-1 à V-5
- **Objectif** : supprimer le basculement en « planche classique » et les colonnes devinables.
- **Fichiers** : `modules/planches.js`, `core/colonneGeste.js`, `core/generateur.js`, `tests/generateur.test.js`.
- **DoD** : sur 1 000 planches « un geste » (tous gestes, 1 et 2 chiffres), 0 basculement complet ; un test par règle V ; tout repli figure dans `bilan.replis`.

### P-5 · Option « double passe »
- **Objectif** : entraîner la vérification.
- **Fichiers** : `ui/feuille.js`, `modules/planches.js`.
- **DoD** : case à cocher ; deux cases par colonne ; correction seulement si elles concordent ; temps par unité divisé par 2 pour les statistiques.

### P-6 · Générateur injecté (facultatif)
- **Objectif** : retirer `Math.random` de `src/core`.
- **Fichiers** : `core/aleatoire.js`, `core/generateur.js`, `core/colonneGeste.js`, `core/epreuves.js`, `core/multiplication.js`.
- **DoD** : `grep -r "Math.random" src/core` ne renvoie que `hasard.js` ; reproductibilité de P-1 inchangée.

## Lot E — Épreuves officielles

### E-1 · Table des grades conforme et sourcée
- **Objectif** : corriger X-1 à X-5.
- **Fichiers** : `core/epreuves.js`, `tests/epreuves.test.js`, `README.md` (section Épreuves).
- **DoD** :
  - valeurs du tableau 5.1 ; champs `source` et `verifie` sur chaque grade ;
  - mitorizan à longueur fixe du 1er au 3e kyū ; pour 4e et 5e, total de chiffres exact (50 et 40) ;
  - × et ÷ du 1er au 3e kyū : problèmes 1 à 10 arrondis à 3 décimales, 11 à 20 à l'unité, consigne affichée en tête de chaque moitié ;
  - 1er kyū : exactement 1 mitorizan à résultat négatif parmi les problèmes 6 à 10 ; 2e kyū : 0 ou 1 ;
  - les lignes **[À VÉRIFIER]** restent inchangées et marquées `verifie: false`.

### E-2 · Opérandes d'examen
- **Objectif** : supprimer les problèmes trop faciles, équilibrer les tables.
- **Fichiers** : `core/multiplication.js`, `core/epreuves.js`, `tests/multiplication.test.js`.
- **DoD** : seuils de 4.6 tenus au banc ; `facteurExamen` et `serieMuldiv` testés.

### E-3 · Conditions d'examen
- **Objectif** : rapprocher l'épreuve du réel.
- **Fichiers** : `modules/epreuves.js`, `ui/feuille.js`.
- **DoD** : une seule minuterie pour les trois parties ; libre passage d'une partie à l'autre ; barre d'allure désactivable ; aucune correction avant la fin ; bilan par partie (points, temps, problèmes non faits) ; saisie complète au pavé numérique vérifiée.

### E-4 · Sujet imprimable
- **Objectif** : passer l'épreuve sur papier.
- **Fichiers** : `ui/feuille.js`, `src/styles.css` (règles d'impression).
- **DoD** : une page par partie, en-tête (grade, durée, code du sujet), corrigé sur page séparée, saisie ultérieure des réponses par le code.

## Lot R — Remédiation

### R-1 · Reprise des colonnes fausses
- **Fichiers** : `ui/feuille.js`, `modules/planches.js`, `core/progression.js`.
- **DoD** : machine à états de 3.5 ; première réponse masquée pendant la reprise ; seule la première passe compte pour la maîtrise ; compteur « corrigée à la reprise » enregistré.

### R-2 · Diagnostic étendu et planche de remédiation
- **Fichiers** : `core/diagnostic.js`, `tests/diagnostic.test.js`, `modules/planches.js`.
- **DoD** : causes `lecture-tige`, `decalage-colonne`, `deux-tiges` avec 3 tests positifs et 3 négatifs chacune ; aucune régression des messages existants ; bouton « 5 colonnes sur ces gestes » dans le bilan.

### R-3 · Journal d'erreurs espacé
- **Fichiers** : `core/progression.js`, `core/revision.js`, `modules/revisions.js`, `core/sauvegarde.js`, `tests/sauvegarde.test.js`.
- **DoD** : colonnes fausses stockées (plafond 200, les plus anciennes sortent) ; retour à J+1, J+3, J+7 ; sorties après 2 réussites ; migration de sauvegarde testée dans les deux sens (import d'une ancienne sauvegarde, fusion).

## Lot A — Anzan

### A-1 · Cadence exacte
- **Fichiers** : `ui/cadence.js` (nouveau), `modules/anzan.js`, `ui/serie.js`.
- **DoD** : dérive cumulée ≤ 1 image sur 20 nombres à 300 ms ; durées de 3 s à 0,2 s ; série marquée « non chronométrée » au-delà de 25 ms d'écart.

### A-2 · Voix dans le flash
- **Fichiers** : `modules/anzan.js`, réutilisation de `modules/dictee.js`.
- **DoD** : option « lire à voix haute » ; masquée si aucune voix française n'est disponible ; indisponible sous 0,7 s par nombre.

### A-3 · Épreuves d'anzan gradées
- **Objectif** : rattraper le concurrent.
- **Fichiers** : `core/epreuvesAnzan.js` (nouveau), `modules/epreuves.js`.
- **DoD** : formats du 暗算検定 de la Ligue, chaque ligne sourcée et `verifie` ; aucun format inventé : sans source, le grade n'est pas proposé.

### A-4 · Échelle flash par paliers (facultatif)
- **DoD** : paliers internes nommés « niveau 1 à 20 », sans se réclamer d'un grade officiel.

## Lot C — Cours

### C-1 · Leçon « résultats négatifs » obligatoire avant le 2e kyū
- **Fichiers** : `core/curriculum.js`, `core/parcours.js` (`PREREQUIS`), `tests/parcours.test.js`.

### C-2 · Marches 7-8 et 9-10 chiffres
- **Fichiers** : `core/curriculum.js`, `tests/curriculum.test.js`.
- **DoD** : deux leçons d'endurance après `p8-3` ; prérequis des 2e et 1er kyū.

### C-3 · Leçon « stratégie d'examen »
- **Fichiers** : `core/curriculum.js` (type `theorie`), `core/conseils.js`.

## Lot U — Interface

### U-1 · Entrée à trois boutons dans « S'entraîner »
- **Fichiers** : `modules/hubs.js`, `src/styles.css`.
- **DoD** : trois actions en tête, cartes existantes conservées dessous ; `npm run verifier` au vert.

---

# ANNEXE A — Banc de mesure

Méthode : import direct des modules de `src/core`, tirages avec `Math.random` (non reproductible à ce stade, d'où le ticket P-0).

| Mesure | Échantillon | Résultat |
|---|---|---|
| Mitorizan 10e kyū, coût par feuille | 300 sujets | moyenne 108, dispersion 5,6 % |
| Mitorizan 1er kyū, coût par feuille | 300 sujets | moyenne 1 018, dispersion 2,0 % |
| Familles de gestes dans un mitorizan | 4 grades | directs 57 à 63 %, grands amis 22 à 24 %, petits amis 7 à 10 %, combinés 6 à 7 %, cascades 1 à 3 % |
| × et ÷ : opérande finissant par 0 | 300 sujets, 3 grades | 11,3 à 15,5 % |
| × et ÷ : doublons dans un sujet | 300 sujets | 0 |
| Planche mélangée 2 ch. × 5 l. | 200 planches | couverture 83,7 % (72 à 97), 15 ms |
| Planche mélangée 3 ch. × 10 l. | 200 planches | couverture 99,5 %, 46 ms |
| Planche mélangée 5 ch. × 10 l. | 200 planches | couverture 100 %, 64 ms |
| Planches « un geste », 1 et 2 chiffres | 680 colonnes | 2,1 % d'échecs, 131 ms par planche |

# ANNEXE B — Sources des règles d'examen

Les pages n'ont pas pu être ouvertes depuis la session d'audit (hôtes bloqués) ; les valeurs viennent des extraits renvoyés par la recherche. À rouvrir et à dater dans le ticket E-1.

- Ligue japonaise du soroban, examen : https://www.shuzan.jp/kentei/shuzan/
- Ligue, principes de l'examen : https://www.shuzan.jp/kentei/shuzan/kihon.html
- Chambre de commerce de Nagasaki (contenu par grade, arrondis) : https://nagasakicci.jp/publics/index/75/
- Wikipédia japonais, 日本商工会議所主催珠算能力検定 : https://ja.wikipedia.org/wiki/日本商工会議所主催珠算能力検定
- Synthèse par grade : https://seo-sem.co.jp/contents/sorobanfukyu/count/exam1.html
- Concurrent : https://www.kani-math.com/ , /tools , /tools/flash-anzan , /tools/abacus-worksheet-generator

# ANNEXE C — Avancement et corrections du document

## Lot P livré (branche `claude/audit-specs`)

| Ticket | État | Résultat mesuré (`npm run banc`) |
|---|---|---|
| P-0 Banc de qualité | Fait | `npm run banc`, `--json`, `--seuils` ; graines fixes |
| P-1 Graine et code | Fait | Code à 6 signes sur la planche et à l'impression ; « Rejouer cette planche » ; rejeu par code (20 dernières planches gardées) ; record seulement sur une planche découverte |
| P-2 Planificateur | Fait | Couverture à 2 chiffres × 5 lignes : 84 % → 100 % ; plus aucun geste réalisable absent à 2 chiffres et plus |
| P-3 Charge, bilan, rampe | Fait | Charge par colonne et par planche, résumé avant de commencer, colonnes en rampe ; dispersion de la charge 2,2 à 4,3 % |
| P-4 Repli par colonne, variété | Fait | Planches « un geste » abandonnées : 0 % (colonne simple en remplacement) ; règles V-1, V-3, V-4 |
| P-5 Double passe | À faire | |
| P-6 Générateur injecté | À faire (facultatif) | |

Écarts par rapport à la spécification :

- Le rejeu par code passe par la mémoire des 20 dernières planches, pas par une reconstruction depuis la graine : les poids dépendent de la progression de l'élève, qui change entre deux séances. La graine reste la source du tirage (tests, banc).
- V-1 (passage par zéro) ne s'applique qu'à partir de 2 chiffres : à 1 chiffre, les colonnes possibles sont trop peu nombreuses. V-2 n'est pas implémentée (cas trop rare pour justifier un rejet).
- Les planches « un geste » demandent 360 ms en moyenne (130 ms avant), à cause des essais supplémentaires avant repli.
- À 1 chiffre × 5 lignes, la couverture « tout mélangé » est de 99,4 % : quelques gestes rares n'ont pas toujours leur place.

## Corrections de l'audit

- **Test instable découvert** : `tests/jeux.test.js` (« −2 petit ami », variété de la planche) échouait environ une fois sur trois sur le commit d'origine (9 échecs sur 25 lancements). L'annonce « 105 tests sur 105 » en tête de ce document reposait sur deux lancements chanceux. Le test tourne maintenant sur une graine fixe.
- **Cause réelle** : certains gestes à 1 chiffre n'offrent presque aucune colonne par rôles. « −1 petit ami » échouait sur 22 % des colonnes et répétait ses formes sur 99 % des planches. Le repli par colonne règle l'abandon ; la répétition des formes à 1 chiffre reste une limite du geste lui-même (conseil : le travailler à 2 chiffres).
- **R-3 existe en partie** : les colonnes fausses sont déjà gardées et rejouées le lendemain (`noterErreurColonne`, écran `erreurs.js`, 30 colonnes sur 14 jours). Le ticket R-3 se réduit à étendre l'espacement (J+3, J+7) au lieu d'un seul rappel.
