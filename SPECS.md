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

## Suite livrée (version 0.22.0)

| Lot | État |
|---|---|
| Lièvre : mémoire par réglage, arrêt à la 2e erreur ou sur demande | Fait |
| Parcours : prérequis par grade, décimaux déplacés, palier « Vers le 1er kyū », zéros finaux retirés | Fait |
| Épreuves : formats alignés sur le référentiel (E-1), opérandes sans zéro final (E-2) | Fait, `verifie: false` partout |
| Mini-tests et leçons équilibrés (0 % de mini-tests incomplets, contre 94 % pour la Révision générale) | Fait |
| Reprise des colonnes dont l'erreur est identifiée ; rappels à J+3 et J+7 | Fait |
| Allure par grade, affichage optionnel, examen pur, leçon de stratégie | Fait |
| Dictée anzan par paliers, anzan × et ÷, épreuves d'anzan | Fait (formats d'anzan indicatifs) |
| Non fait : cadence exacte du flash (A-1), sujet d'examen imprimable avec saisie différée (E-4), double passe (P-5), entrée à trois boutons (U-1), générateur injecté (P-6) | À faire |

## Version 0.22.1

| Changement | État |
|---|---|
| Anzan × et ÷ : exercices « de tête » (plus de case « Mains sur le soroban », textes adaptés), option « énoncé masqué après 4 s » | Fait |
| Diagnostic : petit ami ou grand ami fait à l'envers (écart de deux fois le complément) ; le geste n'est accusé que si aucune autre explication ne tient | Fait |
| Piste anzan : marche « 2 chiffres, sans retenue » (`pa-6`) avant les 2 chiffres complets | Fait |
| Flash anzan : cadence calée sur l'horloge (`ui/cadence.js`), sans dérive cumulée | Fait |
| Leçon `p7-e` : bouton vers le sprint d'estimation du quotient | Fait |

## Version 0.23.0

| Changement | État |
|---|---|
| Sprint « division avec reste », relié à `p7-1` | Fait |
| Démonstration « rattraper un quotient trop grand » dans `p7-e` et `p8-7` | Fait |
| Débordement à gauche signalé dans les explications de multiplication ; exemple dédié dans `p6-3` | Fait |
| Sprint « lire un résultat négatif », relié à `p8-n` | Fait |
| Lecture éclair de grands nombres (3 à 10 chiffres), reliée à `p1-4`, `p8-t2`, `p9-1`, `p9-2` | Fait |
| Arrondi éclair, relié à `pd-5` et `pd-6` | Fait |
| Dictée : niveau automatique sur soroban, meilleure voix installée, moins de temps mort au départ | Fait (qualité de la voix non vérifiable ici) |

## Version 0.24.0

| Changement | État |
|---|---|
| Épreuves : formes imposées (2 × 1, 3 × 1, 2 × 2, 3 × 2 ou 2 × 3 ; ÷ 1 chiffre aux 8e et 7e kyū, 2 ÷ 2 au 6e), plus de 4 × 1 | Fait |
| Épreuves : 6 mitorizan d'additions seules puis 4 mêlés ; 10e kyū en additions seules, sans division aux 10e et 9e | Fait |
| Épreuves : seuils 60 / 200 (10e), 120 / 200 (9e au 7e), 210 / 300, 240 / 300 ; résultat négatif imposé au 2e kyū ; tous les × et ÷ arrondis dès le 3e kyū | Fait (`verifie: false` : chiffres donnés par l'utilisateur, sites officiels inaccessibles d'ici) |
| Séparateurs de milliers exigés en « examen pur », du 1er au 3e kyū (`milliersCorrects`) | Fait (espace ou point : la virgule reste le signe décimal) |
| Prérequis des grades réalignés sur les nouvelles formes (`PREREQUIS`) | Fait |
| Flash : décompte en points discrets, nombre toujours centré (signe hors centrage) | Fait |
| Grades de flash en temps total, 20 marches du 10e kyū au 10e dan (`core/flashGrades.js`) | Fait, échelle indicative |
| Épreuves d'anzan : chaque épreuve a son propre temps (`parEpreuve`) | Fait (temps total partagé à parts égales, format indicatif) |
| Piste anzan : `pa-7` (2 chiffres, 6 nombres), `pa-8` (3 chiffres), `pa-m3` (2 × 2), `pa-d2` (÷ 2 chiffres) | Fait |
| Séance : leçon limitée à un tiers de l'objectif, puis planche d'ancrage (3 dernières leçons et gestes faibles), anzan dans l'essentiel | Fait |
| Prof : la dernière leçon doit être « débutant » (toujours) ; l'avant-dernière « confirmé », sinon ancrage, 7 jours de pratique au plus | Fait |
| Examen de la semaine : rappelé en tête de « Pour compléter », adapté au niveau (colonnes à 3-6 chiffres, × et ÷ de la dernière leçon validée) ; le jour où on le passe, il remplace leçon et ancrage | Fait |
| Mini-test des leçons avancées : vitesse à 70 % de la cadence du grade visé ; l'épreuve est conseillée à 100 % | Fait (effet à partir des leçons du 4e kyū ; avant, « débutant » est plus strict) |
| Planches : additions seules, longueurs mêlées, format d'examen, négatifs, décimaux ; jusqu'à 10 chiffres, 20 lignes, 30 colonnes | Fait |
| Feuilles × et ÷ : zéros, arrondi au millième ou à l'unité, mélange d'examen | Fait |
| Erreurs de × et ÷ suivies par type (placement, zéro, quotient trop grand ou trop petit, arrondi, produit), alimentées par les leçons, les feuilles et les épreuves ; entraînement proposé à la 3e en 21 jours | Fait |
| Non fait : montants en yens dans les énoncés, grille officielle des grades de flash, ciblage des feuilles × et ÷ par produit de table | À faire |

## Version 0.24.1

| Changement | État |
|---|---|
| Flash anzan : un flash relancé (second « Commencer », nouveau réglage) restait bloqué après le décompte | Corrigé |
| Planches : création limitée dans le temps (`avecDelai`), repli sur une planche réalisable ; plus d'écran figé à 10 chiffres sur un geste | Corrigé |
| Planches : genre « longueurs mêlées » retiré (le mitorizan est toujours à longueur fixe) ; choix des gestes, mode et zéros masqués pour les genres d'examen | Fait |
| Additions seules : tous les gestes d'addition appris sont permis ; le titre annonce la planche réellement créée | Fait |
| Feuilles : largeur des colonnes selon le plus long nombre (10 chiffres au 1er kyū) | Corrigé |
| Feuilles : vitesse calculée sur les seules réponses saisies ; une feuille incomplète n'entre pas dans les moyennes | Corrigé |

## Version 0.24.2

| Changement | État |
|---|---|
| Mitorizan d'examen : total de chiffres par problème (字数) et longueurs imposées : 35 (5 × 3, 5 × 4), 45, 55, 65 (1 × 5, 3 × 6, 6 × 7), 75 (1 × 6, 4 × 7, 4 × 8, 1 × 9), 90 (1 × 7, 1 × 8, 5 × 9, 3 × 10) ; ordre des lignes tiré au hasard | Fait (règle donnée par l'utilisateur ; au 3e kyū, le total de 65 a été préféré à l'exemple 2 / 6 / 2 qui n'en fait que 60) |

## Version 0.24.3

| Changement | État |
|---|---|
| Feuilles (planches, épreuves, examens) : calées en haut de l'écran dès leur création, quelle que soit la taille de la fenêtre | Fait |

## Version 0.25.0

| Changement | État |
|---|---|
| Tables : criblage (36 produits de 2 × 2 à 9 × 9, 60 s) | Fait |
| Tables : acharnement (4 pires produits ; faux ou plus de 2 s : retour 3 questions plus tard ; fin à 3 réussites de suite en moins de 1,5 s, temps à la première touche ; plafond de 80 questions) | Fait |
| Diagnostic du franchissement (99 → 100) quand l'écart est de 10, 100, 1 000 et que la colonne franchit ce rang | Fait (cité après une ligne oubliée ou doublée si elle explique aussi l'écart) |
| Flash : nombre centré, seul sur un grand écran vide ; titre et réglages masqués pendant le défilement | Fait |
| Flash : vitesse automatique par réglage (un cran plus vite après une série sans faute, un cran moins vite sous 60 %) | Fait |
| Anzan : tapis roulant ; colonne qui s'efface ligne à ligne | Fait |
| Distracteurs : éclats au bord de l'écran ; voix qui lit d'autres nombres au rythme du flash | Fait (voix non vérifiable ici) |
| Sprint de surcharge (une colonne d'environ 20 s à 115 % du meilleur rythme), proposé seulement sur le plateau d'un geste | Fait (rien n'est noté sur la carte de maîtrise) |

## Version 0.25.1

| Changement | État |
|---|---|
| Tapis roulant : mouvement piloté par le script ; il ne s'affichait pas quand le système réduit les animations | Corrigé |
| Colonne qui s'efface : taille des chiffres adaptée pour que toute la colonne tienne à l'écran | Corrigé |
| Acharnement : les 4 produits et leur résultat affichés 5 secondes avant le départ | Fait |
| Distracteurs visuels : « mouches » (petites formes discrètes qui se promènent) à la place des éclats lumineux | Fait |
| Franchissement raté plus une autre erreur : hypothèse à deux causes, donnée seulement si elle est unique et que rien d'autre n'explique l'écart | Fait |

## Version 0.26.0

Idées reprises du site ishizaki88-training.net (lecture des pages de réglages uniquement).

| Changement | État |
|---|---|
| Multiplication : 4 marches devant « 2 chiffres × 1 chiffre » (`p6-1a` à `p6-1d` : sans retenue, avec retenue, produit à un chiffre, produit finissant par 0) | Fait |
| Division : 4 marches devant « ÷ 1 chiffre, quotient 2 et 3 chiffres » (`p7-2a` à `p7-2d` : petits produits, produits à deux chiffres, emprunt, dividende finissant par 0) | Fait |
| Marches héritées : validées d'office si la leçon d'arrivée l'est déjà (`heriterMarches`) | Fait |
| Planches : pyramide de chiffres ou de lignes (3 paliers) ; part de colonnes avec soustractions au format d'examen | Fait |
| Feuilles × et ÷ : part de calculs avec zéro, part de calculs à arrondir, rang de l'arrondi | Fait |
| Flash et tapis roulant : profils de vitesse (constante, qui accélère, départ rapide, accélère puis ralentit), durée totale inchangée | Fait |
| Vitesse automatique à chaque réponse (5 % plus vite si juste, 10 % moins vite si faux), gardée par réglage | Fait |
| Après une erreur en flash : refaire le même calcul, à la même vitesse ou plus lentement (2 reprises), sans recompter | Fait (pas en passage de grade) |
| Non fait : part de divisions avec reste sur les feuilles (la réponse demanderait deux cases : quotient et reste) | À faire |

## Version 0.26.1

| Changement | État |
|---|---|
| Pyramide : jusqu'à 5 paliers en partant de 1 chiffre (ou 3 lignes), 2 colonnes au moins par palier, un titre par palier sur la feuille | Fait |
| Tapis roulant : vitesse de traversée calculée pour que deux nombres ne se chevauchent jamais (0,3 s, profil qui accélère) | Corrigé |
| Leçons : bouton « Un autre exemple (au hasard) », tiré dans les calculs de la leçon et joué pas à pas | Fait |
| Leçons de × et ÷ des paliers 6 et 7 : 50 répétitions (30 pour « deux petits produits », qui n'a que 34 cas) ; placement et table inchangés | Fait |

## Version 0.27.0

| Changement | État |
|---|---|
| Marches 2 × 2 (`p6-3a` à `p6-3c` : sans retenue, avec retenues, retenue qui déborde) ; division par 2 chiffres (`p7-ea` : estimation juste ; `p7-4a`, `p7-4b` : quotient à 2 chiffres, estimations justes puis à corriger) | Fait |
| Leçons de × et ÷ : 30 répétitions au moins partout (leçons longues des paliers 8 et 9 montées de 20 à 30) | Fait |
| Leçons : « Un exemple à faire moi-même » (énoncé seul, puis résultat et démonstration sur demande) | Fait |
| Planches : départ de la pyramide réglable | Fait |
| Feuilles de division : part de divisions avec reste, deux cases (quotient, reste) | Fait (feuille seulement, pas en « une par une ») |
| Séance : la leçon prend la moitié de l'objectif du jour (un tiers avant) | Fait |
| Prof : une leçon de colonnes compte comme « confirmée » (ou « débutant ») si tous ses gestes le sont sur la carte de maîtrise, même sans avoir refait la leçon | Corrigé |
| Échauffement « complément éclair » : un jour sur deux, et plus du tout après un record de 25 | Corrigé |
| Anzan des leçons : case « sans le petit soroban d'aide » (réglage gardé) | Fait |
| Flash sans image : plein écran pendant le défilement, nombre au centre exact de la fenêtre | Corrigé |
| Icône du `.exe` (`build/icon.png`) | Fait |

## Version 0.28.0

| Changement | État |
|---|---|
| Séance du jour en 5 blocs, calibrée sur l'objectif de temps : échauffement, révision (10 calculs mélangés + « À revoir »), leçon (5 à 10 min, une partie seulement si elle est longue), volume ou vitesse (remplit le temps restant), anzan (temps réservé) | Fait |
| Prof : la dernière leçon doit être en or (acquis confirmé) pour ouvrir la suivante ; en argent, on l'automatise (isolé et mélangé, volume et vitesse), au plus 10 jours de pratique, puis on avance (sous l'argent : on attend) | Fait |
| Bloc volume / vitesse (`core/blocs.js`) : une séance sur deux au fil des jours pratiqués (un jour manqué ne décale rien) ; toujours isolé ET mélangé ; la variante faite il y a le plus longtemps d'abord | Fait |
| Examen blanc du vendredi au dimanche, à la place de la leçon, tant qu'il n'est pas passé dans la semaine | Fait |
| Révision mélangée : 10 calculs sur les leçons dues (5 au plus, les plus en retard), chaque leçon garde sa boîte | Fait |
| Anzan du jour : marches (chaîne puis chiffres), on monte après 2 séries ≥ 90 % à ≤ 1,5 s par nombre, on redescend après 2 séries < 70 % ; gestes déjà vus seulement | Fait |
| Piste anzan : chaque leçon attend sa leçon soroban et UNE leçon d'anzan qui la prépare (`BASE_ANZAN`), plus la précédente de la liste ; une leçon validée n'est jamais grisée ; raison du verrou affichée | Corrigé |
| Planches proposées : ciblée et mélangée en alternance ; la cible de vitesse est toujours au-dessus de la vitesse actuelle | Corrigé |
| Mot du prof : thème du jour, constats tirés des données (distance à l'or, écart de vitesse, progrès, erreur qui revient, régularité, anzan), conseil lié à la leçon | Fait |
| Apprendre : frise du parcours (où j'en suis, ce qui vient) ; Progression : courbes anzan (chaîne tenue, vitesse d'affichage) | Fait |

## Version 0.30.0

| Changement | État |
|---|---|
| Grille Nisshō corrigée d'après le récapitulatif fourni : 10 lignes au mitorizan dès le 10e kyū (1 à 2 chiffres aux 10e et 9e, 2 au 8e), 10e kyū = même épreuve que le 9e (seuil 60 / 200), 3e kyū 60 chiffres, 1er kyū 100 chiffres, un résultat négatif dès le 3e kyū | Corrigé (à confirmer sur les sujets officiels) |
| Système Zenkoren (`GRADES_ZENKOREN`) : 7 minutes par épreuve sans report, 15 problèmes à 10 points, 10 / 15 exigés dans CHAQUE épreuve ; ordre ×, ÷, additions ; 10e kyū : additions A et B ; 9e : × et additions | Fait |
| Zenkoren, nombres de chiffres : ceux du même grade Nisshō (le format officiel n'est pas connu) ; colonnes raccourcies (`LIGNES_ZENKOREN`) pour exiger 1,4 à 1,6 fois la cadence Nisshō en colonnes, la même en × et ÷ | Fait (format indicatif) |
| Choix du système de grades (Nisshō par défaut) : Épreuves officielles et Réglages ; chaque système garde ses records ; grade, frise, objectif daté et succès suivent le système choisi | Fait |
| Examen blanc en alternance d'une semaine à l'autre : un sujet de 20 minutes, puis deux sprints de 7 minutes (70 % dans chacun) ; l'autre format reste disponible | Fait |
| Options Zenkoren du 1er au 3e kyū (calcul mental, denpyōzan, calcul appliqué) | À faire |

## Version 0.31.0 (contenu prévu « 0.29 » : les cours)

| Changement | État |
|---|---|
| Marche « Endurance : 10 lignes de 1 à 2 chiffres » (`p5-e`) avant la multiplication, exigée dès le 10e kyū ; validée d'office pour qui a déjà commencé la multiplication | Fait |
| Marche « Diviser par 11 à 19 : l'arrondi trompe de 2 crans » (`p7-4c`, au moins 2 corrections par calcul), exigée au 6e kyū ; textes de `p7-e` et `p7-3` : on corrige autant de fois qu'il faut | Fait |
| Palier p8 réordonné par grade : 6e (`p8-t1`), 5e (`p8-t2, 1, 2, 4, 6`), puis 4e (`p8-3, 5, 7`) ; p9 : bloc du 2e kyū puis du 1er | Fait |
| Résultats négatifs (`p8-n`) déplacés dans le palier des décimaux, exigés au 3e kyū, avec une marche au format d'examen (`p8-n2`, 8 chiffres) | Fait |
| Jalons « 🎯 Xe kyū à votre portée » dans la liste des leçons, après la dernière leçon exigée par chaque grade du système choisi | Fait |

## Version 0.32.0

Corrections de la séance du jour (audit de la 0.31) et organisation.

- **Examen blanc dans la séance :** du vendredi au dimanche, il garde toujours sa place dans
  l'essentiel, même s'il dépasse l'objectif (l'anzan lui cède alors la sienne). Avec un objectif
  de moins de 10 minutes, il reste proposé « pour compléter » et la leçon garde sa place.
- **Séance du débutant :** le bloc volume / vitesse existe dès les gestes directs (lièvre et
  marathon, isolé puis mélangé ; les planches s'ouvrent avec « Le 5 et la pincée »). Une leçon
  coupée reprend le temps libre de l'objectif. Sans geste de colonne dans la dernière leçon
  (× ÷, parcours terminé), le bloc travaille les gestes les plus lents.
- **Planches proposées :** 10 minutes au plus (8 dans un bloc) ; au-delà, on retire des colonnes
  puis des lignes (`propositions.plafonner`). La durée affichée est celle de la planche lancée.
- **« Vérifier mes gestes » :** marge de 10 % (`MARGE_VERIFICATION`) : plus d'alerte à vitesse égale.
- **Argent entre les leçons, or en fin d'étape :** à l'intérieur d'une étape, l'argent suffit
  pour ouvrir la leçon suivante. En fin d'étape, les leçons de l'étape passent en or (la moins
  avancée d'abord, `prof.leconsADorer`), 10 jours de pratique au plus.
- **Examen blanc d'un élève avancé :** le grade le plus élevé dont toutes les leçons sont
  validées et qui n'est pas encore réussi, kyū officiels compris (« 6e kyū (blanc) », record
  `blanc-<système>-<grade>`). Réussir un grade donne par équivalence tous ceux d'en dessous
  (préparatoires et officiels, lus à l'affichage : `prekyuObtenu`, `kyuPasse`). Le kyū officiel
  lui-même se passe toujours en « Épreuve officielle ».
- **Deux exercices au plus sur le geste seul** (`blocs.MAX_ISOLES`, bloc « automatiser »
  compris) : le suivant est obligatoirement mélangé.
- **Réflexes qui s'éteignent :** le placement disparaît une fois le parcours terminé (ou 14 jours
  après l'étape de la division) ; les tables ne reviennent que deux fois par semaine quand il
  n'y a plus de produit à retravailler.
- (La table des grands amis en soustraction, ajoutée ici, a été retirée en 0.33.)
- **Séance en 5 blocs visibles :** une barre de temps (répartition des blocs) et chaque bloc
  repliable ; un bloc terminé se referme. Un seul bouton « Continuer ».
- **Bilan de la semaine** (replié, sous la séance) : pratique des 7 derniers jours, gestes passés
  en or, leçons validées, ce qui stagne, grade à portée (`bilan.bilanHebdo`).
- **Frise du parcours :** le dernier grade obtenu et le PROCHAIN seulement, sur l'étape où ils
  se gagnent, avec les leçons restantes et une estimation en jours si elle est à moins de 60
  jours (`examen.prochainJalon`). Jamais d'objectif lointain.

## Version 0.33.0

- **Un kyū réussi vaut un test de niveau :** épreuve officielle, examen blanc ou grade
  préparatoire réussi valide toutes les leçons que ce grade exige (`examen.leconsParEquivalence`,
  `progression.validerParEquivalence`), au lancement pour les grades déjà obtenus, puis dès
  qu'un grade est réussi. Leçons marquées `parEquivalence`, sans niveau mesuré ; révisions
  étalées sur un mois.
- **Test de niveau :** on choisit d'abord ce que l'on sait faire ; le test commence à ce niveau
  (6 paliers, multiplication et division comprises). Réussi : ce palier et ceux d'en dessous sont
  validés, on peut tenter le suivant. Raté : on redescend d'un palier (`positionnement.suiteTest`).
- **Feuilles et examens :** Entrée sur la dernière case demande « Avez-vous terminé ? » (Entrée
  confirme, Échap revient à la case) au lieu de corriger tout de suite.
- **Tables de multiplication avant la multiplication :** diagnostic des 81 produits à l'ouverture
  de « Grands amis en soustraction », puis tables une séance sur deux pendant cette étape et
  « Combinaisons ». Pendant × et ÷ : chaque jour tant qu'il reste des produits à retravailler.
- **Estimation du quotient :** une séance sur deux dès la première leçon de division par 1
  chiffre (au lieu d'attendre « estimer et corriger »), en alternance avec les tables.
- **Placement (réflexe) :** s'éteint dès qu'il est maîtrisé en Expert.
- **Défi de la semaine :** jusqu'à 5-6 chiffres une fois les additions-soustractions terminées ;
  multiplications jusqu'à 3 × 2, divisions par 2 chiffres, selon les leçons validées.
- **Table des 36 soustractions :** retirée (Drills › Tables et séance).
- **Succès :** noms des chapitres mis à jour (« Décimaux, arrondis et négatifs », « Vers le 6e,
  le 5e et le 4e kyū »).

## Version 0.33.1

- **Arrêt du chrono uniforme :** dans les séries comme dans les drills, Espace OU le premier
  chiffre tapé arrête le chrono (et le métronome), toujours, sans réglage. L'option « Mains sur
  le soroban (Espace) » est supprimée. Dans un drill, la case « Nombre lu » reste visible
  pendant l'exécution.
- **Anzan avec le petit soroban d'aide :** le soroban est en bas à droite de l'écran, hors de l'axe du
  regard, pâle et flou (opacité plafonnée à 0,45, jamais net) ; plus de trait au-dessus du
  nombre ; la réponse se tape au centre.

## Version 0.34.0

- **Drill sur mesure** (Drills de gestes) : longueur du pas (1 à 9 chiffres, ou au hasard de 3 à
  9), le même nombre à chaque ligne ou un nombre différent, 5 à 50 additions, avec ou sans
  retour à 0, et un sous-total affiché toutes les 3, 5 ou 10 lignes (`drills.drillPerso`,
  option `tousLes` de `ui/drill.js`). Médaille à l'allure ; ni record ni validation.
- **Voix de la dictée :** les nombres sont dits en toutes lettres avec septante, huitante,
  nonante (`core/motsNombre.js`) ; case à décocher dans la dictée pour revenir à la lecture
  classique. La voix parasite de l'anzan suit la même règle.
- **Dictée dans la séance :** le mardi et le jeudi, dès « Gestes directs à 2 et 3 chiffres »,
  quand une voix est disponible.
- **Test de grade de flash anzan :** barème de la 日本フラッシュ暗算検定協会 (40 grades, 20e kyū
  au 20e dan ; grille relevée sur kentei.soroban-soft.com/about_test.cgi et
  flash-anzan.jp/school). 10 questions : 7 justes = réussi, 5 ou 6 = presque (on repasse le même
  grade), pas de saut de grade. Du 20e au 11e kyū, « sans retenue » est rendu par des additions
  et soustractions mêlées, chaque tige restant entre 0 et 9 (interprétation : la grille ne
  précise pas le tirage). Records `flash-kentei-<id>` (l'ancienne échelle indicative est abandonnée).
- **Test de flash dans la séance :** le mercredi, une semaine sur deux, sur le grade qui suit le
  meilleur obtenu ; il prend la place de l'anzan du jour.

## Version 0.34.1

- **Drill sur mesure, pas répété :** le nombre peut être SAISI (ex. 789) ; sinon il est tiré
  avec des chiffres tous distincts et sans zéro (`drills.nombreDistinct`).
- **Descente :** troisième forme du drill sur mesure, soustractions seules depuis le total déjà
  posé sur le soroban jusqu'à 0 (`depart` du drill ; `controles(ops, depart)`).

## Version 0.35.0

- **Planche « pincée pure »** (cible `pincee`) : gestes directs seulement, avec les 6 à 9 posés ou
  retirés d'un seul mouvement. Diagnostic automatique (`motifs.diagnosticPincee`) : plus de 30 %
  d'erreurs sur ces gestes (10 essais au moins) ajoute 8 colonnes de rattrapage à la séance et
  aux planches proposées.
- **Endurance par marches :** deux leçons, 7 puis 8 lignes (`p5-e7`, `p5-e8`), avant les 10 lignes.
- **Examen préparatoire en deux temps** (20e, 19e et 18e kyū prép.) : phase 1, le socle, 10
  colonnes sans chrono à 80 %, qui donne le grade ; phase 2, facultative, le format complet
  chronométré à 70 % (`examen.SOCLE`, record `prekyu-<id>-complet`).
- **Entraînement au grade de flash** (menu Flash) : le format exact d'un grade, tous grades
  ouverts, avec l'allure (150 % à 80 % du temps du grade), 5 à 20 questions, vitesse automatique,
  distracteurs, voix parasite, et reprise du même calcul après une erreur.
- **Flash avec instantané du total :** après chaque nombre, l'image fixe du total, de 1,2 s à
  0,3 s (plus court à chaque réussite). Mode d'entraînement seulement, jamais dans un test.
- **Ponts vers l'anzan sans image** (`conseils.PONTS_ANZAN`) : quatre techniques de
  reconstruction dans « Comprendre » ; en leçon, après une erreur une fois l'image presque
  disparue, une consigne s'affiche et le calcul suivant rend l'image très légère, une fois.
- **Décimaux :** exemples déroulés pas à pas dans « Comprendre » (champ `exemples`) pour le
  compte des chiffres, la multiplication et la division de décimaux.

## Version 0.35.1

- **Séance qui ne finissait pas :** les exercices des blocs « automatiser » et « volume /
  vitesse » sont figés au début de la séance (`seance.blocIds`, `seance.gesteBloc`). Avant, un
  exercice fait libérait son temps dans le calibrage, et le « geste le plus lent » changeait une
  fois travaillé : un nouvel exercice prenait la place, sans fin.
- La séance se termine d'elle-même quand tout l'essentiel est fait et que 70 % de l'objectif de
  temps est atteint ; en dessous, un bouton « Terminer la séance » est proposé.

## Version 0.36.0

Audit de la 0.35.1, puis corrections. Sources des examens : règlement de 日本珠算連盟
(shuzan.jp : 珠算能力検定試験, 暗算検定試験) et sujets modèles officiels (見本 : 1er, 2e, 3e,
4e, 6e, 7e et 9e kyū de soroban, 1er kyū d'anzan).

- **Tableau Nisshō conforme :** 10e/9e 5 lignes de 2 chiffres (même sujet) ; 8e 8 lignes ; 7e
  10 lignes ; puis 10 lignes de 3, 4, 5, 6, 8, 10 chiffres (6e → 1er). Les nombres d'un
  problème ont la même longueur, comme dans tous les sujets modèles (le règlement ne fixe que
  le total, 字数). Problèmes 3, 5, 7, 9 mêlés : 4 lignes négatives (3 au 7e, 2 au 8e,
  interpolé, 1 aux 9e/10e), jamais en 1re, 2e ni dernière ligne. Résultat négatif au problème 9,
  1er et 2e kyū seulement. Facteurs terminés par 0 permis ; dès le 3e kyū, moitié de décimaux.
  Grades 準1, 準2, 準3 (facultatifs, hors frise). Prérequis : 8 lignes au 8e, 10 au 7e,
  négatifs au 2e.
- **Anzan conforme :** 7e à 10e un seul sujet de 50 (3, 4, 5 nombres) ; 1er à 6e : 3けた10口,
  7口, 5口, 2けた5口, 5口8字, 5口6字 ; × ÷ 5/4/4/3/3/3 chiffres ; 準 ; 12 minutes pour tout.
  Piste anzan prolongée jusqu'au format du 1er kyū d'anzan.
- **Planches au format du grade visé** (`propositions.formatsPlanche`) : ~70 % au format du
  prochain kyū (dans la limite des leçons validées), ~15 % au format suivant, ~15 % courtes ;
  planches de geste à 4 chiffres au plus. Durée constante : un quart de l'objectif du jour (4 à
  8 min), le nombre de colonnes suit la vitesse mesurée. En fin de feuille au format d'un kyū,
  projection du temps des colonnes de l'examen face à l'allure du grade.
- **Kyū préparatoires** jamais plus durs que le 10e kyū ; examen de la semaine au format visé.
- **Révisions qui finissent :** réussie en boîte 5, une leçon est acquise ; une leçon dont tous
  les gestes sont repris par une leçon plus avancée (boîte 3 ou plus) sort des révisions.
- **Une seule échelle :** bronze, argent, or, platine partout (avant : « acquis débutant /
  confirmé / expert » et médailles) ; argent ≈ allure du 6e kyū, or ≈ 4e, platine ≈ 2e.
- **Robot** réparé (blocs repliés, confirmation de fin de feuille) et exécuté avant toute
  publication ; mobile : « Leçons » dans la barre, raccourcis clavier masqués au toucher, mot du
  prof replié après deux points, doubles filets retirés.

## Version 0.37.0

Suites de `AUDIT-PARCOURS-0.36.md`.

- **Toutes les formes de × et ÷ des sujets vues en leçon** (B-1), adaptées au grade :
  5e (3 × 3, 4 × 2, ÷ 5 chiffres au total ; nouvelle leçon `p8-5a`), 4e (4 × 3, 5 × 2,
  ÷ 6 chiffres ; nouvelle leçon `p8-8`), 準2/2e (`p9-3`, `p9-5`), 準1/1er (`p9-4`, `p9-6`).
  Test : chaque forme de chaque sujet (10e au 1er, 準) apparaît dans les leçons exigées.
- **× et ÷ « au format du kyū »** (écran Multiplication et division, par défaut) : tirés dans
  des sujets du grade visé, donc dans les mêmes proportions (`core/formatKyu.js`).
- **Zéros finaux** (15 %) après les leçons sur les zéros ; **premier nombre à la longueur
  annoncée** après les grands amis (leçons et planches) ; **anti-répétition** des × et ÷ sur les
  30 derniers calculs d'une leçon.
- **Anzan :** division de tête à 4 chiffres (`pa-d4`), `pa-d3` élargie ; gestes de chaque colonne
  comptés à part (`gestesAnzan`), « ce qui lâche » dans Progression.
- **Échelle après le 3e kyū :** tout monte d'un cran (argent = ancien or, or = ancien platine,
  platine = allure du 1er kyū avec 10 % de marge : 0,52 s par chiffre, 1,05 s par produit).
- **Volume au format du kyū visé**, par semaine, dans Progression (aucune source sérieuse ne
  publie le volume des élèves japonais : pas de comparaison).
- **Porte de fin d'étape** souple à partir des grands amis : or partout, ou argent partout avec
  le volume de l'étape fait, ou 10 jours de pratique.
- **Examen complet** (sujet officiel entier du prochain grade) une fois par semaine dans la séance,
  dès le 6e kyū passé ; les planches ciblées passent alors en tête.
- **Séries de placement** sur les formes nouvelles (`p8-pl`, `p9-pl`).

## Version 0.38.0

Suites de `PLAN-ACTION-0.38.md` (deux audits externes de la 0.37.0). Lots 1 à 6 validés.

- **Lot 1, bugs confirmés.**
  - Anzan : le tirage et les mini-tests équilibrent les gestes **mesurés en anzan**
    (`poidsAnzan`, `fluxEquilibre` étendu). Dans p3-a, « +1 grand ami » passe de 1 à environ
    80 apparitions sur 400 chaînes.
  - Divisions décimales à la longueur du sujet (diviseur de 4 à 6 chiffres au 1er kyū ; avant,
    plafonné à 4).
  - Flash et chaînes d'anzan sans nombre répété deux fois de suite.
  - pa-5 ne vise plus les cascades (impossibles à 1 chiffre) ; p7-4c sans quotient en 0.
  - Mention « format indicatif » reformulée ; bascule de l'échelle après le 3e kyū annoncée une
    fois, et rappelée dans la légende des médailles.
- **Lot 2, révisions.** Absorption limitée : une leçon n'en retire une autre des révisions que si
  elle est de la même étape ou de la suivante et vise 18 gestes au plus (19 leçons absorbées sur
  35 au lieu de 27). Révision mélangée : 3 leçons au plus, 5 calculs chacune à 2 leçons, 4 à 3.
- **Lot 3, séance.**
  - À partir du 7e kyū (8e réussi), **un bloc de vitesse par jour** sur colonnes, × ou ÷ : la
    partie la plus loin de l'allure deux jours de pratique sur trois, la rotation le troisième
    (`core/hakari.js`). Pour × et ÷ : une feuille chronométrée au format du kyū, à la longueur du
    temps restant ; son temps médian par produit est enregistré et sert de mesure.
  - **Séance longue** : l'examen blanc n'entre dans la séance qu'à partir de 20 min d'objectif,
    l'examen complet à partir de 30 ; sinon il est proposé à part, à faire à la place de la
    séance, sans compter comme manqué.
  - Sous 20 min : **3 blocs au plus** (leçon, révision, puis volume ou anzan un jour sur deux).
  - 25 min par défaut pour les nouveaux élèves, choisi à l'accueil ; une carte, une fois, propose
    25 min à ceux qui sont à 15.
  - **Mini-tests longs en séries de 5** (plus de 12 min au seuil : p5-5, p5-e, p8-t1, p8-t2,
    p8-1, p8-2, p8-3, p8-5, p8-n2, p9-1, p9-2) ; même exigence au total ; séries valables
    jusqu'au lendemain.
- **Lot 4, de la leçon à l'allure.**
  - **Marches d'allure** (`core/marches.js`, écran « Marches d'allure » dans Se mesurer) : 5 par
    grade, du 6e au 1er kyū, de 70 % de l'allure à l'allure avec 10 % de marge ; feuille courte
    au format (environ 5 min), 90 % de justes, deux jours différents. Proposée dans la séance un
    jour de pratique sur deux une fois les leçons du grade validées. Fractionné : 4 × 90 s.
  - Score projeté et date projetée (d'après le rythme des marches ; rien avant la première).
  - **Naoshi** : « Reprendre mes erreurs » après une épreuve, un examen blanc ou une marche.
- **Lot 5, avancés.** Rythme jusqu'à 10 chiffres ; dictée jusqu'à 6 ; × ÷ libres jusqu'à 7 × 5
  et ÷ 6 chiffres, quotient 6 ; défis au format du kyū visé ; anzan guidé jusqu'à 3 chiffres et
  15 nombres, flash jusqu'à 0,1 s par nombre. Après le 1er kyū : examen complet du 1er kyū
  chaque semaine et planche au format en entretien (au lieu d'un marathon de 30 lignes).
  Dan d'entraînement : **non fait**, format officiel non vérifiable (sources secondaires
  contradictoires).
- **Correctif :** une colonne contient toujours au moins un geste visé par la leçon (environ une
  colonne sur 600 de la leçon « cascades » n'en avait aucune : cause du test intermittent en CI).
- **Lot 6, débutants.** **10e kyū express** : les colonnes (p1 à p5) suffisent, la séance le
  propose ; la multiplication reste exigée au 9e. Défi de la semaine au format du kyū visé dès
  le 7e kyū (même feuille toute la semaine). Porte « or » chiffrée (« 2 leçons sur 3 en or »).
  **Clinique du doigté** : un geste qui lâche, le bon mouvement puis 6 colonnes lentes avec
  rappel doigté, tous les 3 jours au plus. La dictée existait déjà dès p1-4.

## Version 0.38.1

- **Dan d'entraînement** (barème Nisshō fourni par l'utilisateur, `core/dan.js`) : ×, ÷ et
  mitorizan, 10 minutes et 300 points chacun ; 60 × de 11 chiffres au total, 60 ÷ de 10, entiers,
  décimaux au millième et montants à l'unité ; 30 mitorizan de 10 lignes de 5 à 10 chiffres
  (85 au total), mêlés comme aux kyū, un résultat négatif tous les 10 problèmes. Seuils par
  épreuve, sans compensation : 準初段 90, 初段 100, 準二段 110, 二段 120… 七段 220, 八段 240,
  九段 260, 十段 290. Écran Épreuves officielles, avec naoshi.
- **Après le 1er kyū** : l'examen de la semaine devient l'examen de dan (vers le prochain dan
  plein) ; les marches d'allure visent ce dan au lieu de s'éteindre.
- **Projection épreuve par épreuve** (Zenkoren et dan) : chaque épreuve a son temps et son seuil ;
  un total global pouvait annoncer « réussi » avec une division trop lente. L'écran des marches
  montre l'épreuve qui bloque.
- Dan Zenkoren (7 min, 40 ×, 40 ÷, 20 mitori, 20 denpyōzan) : non fait, seuils non fournis et
  denpyōzan sur liasses papier.

## Version 0.38.2

Défauts signalés après la 0.38.1.

- **Mini-test en séries planifié en entier** au départ (équilibré sur ses 15 ou 20 calculs, puis
  découpé) : la révision générale (54 gestes) en oubliait un dans 23 % des tests en séries.
- **pa-5 vise ses 34 amis** (les gestes directs viennent d'eux-mêmes) : avec 52 gestes visés et
  15 chaînes à 1 chiffre, presque tous les mini-tests en oubliaient un ; maintenant aucun.
- **Le mot du prof décrit les exercices retenus** dans la séance, au lieu de recalculer son propre
  geste du jour (il pouvait annoncer +8 grand ami quand les blocs portaient sur les petits amis).
- **Délai de l'objectif à votre rythme** : leçons restantes à votre rythme des 4 dernières
  semaines, et temps pour combler l'écart de vitesse avec l'allure du grade (hypothèse : 2 % par
  semaine) ; le plus long des deux. Le repère général ne sert plus que sans mesure.
- **Défaut de 25 min partout** (une durée de planche retombait sur 15) ; la carte « 15 ou 25
  minutes » ne s'affichait jamais aux anciennes sauvegardes (fusion des réglages par défaut).
- **Examen du week-end** : il ne prend la place de la leçon qu'au premier jour pratiqué de la
  fenêtre ; pas fait ce jour-là, la leçon revient et l'examen reste proposé à part.

## Version 0.38.3

- **Dan d'entraînement Zenkoren** (règles et barèmes fournis par l'utilisateur, `core/danZenkoren.js`),
  dans Épreuves officielles quand le système Zenkoren est choisi :
  - 珠算段位 : multiplication, division, mitorizan (obligatoires) et, au choix, denpyōzan et anzan ;
    30 problèmes à 10 points, 7 minutes par matière (anzan : 3). La plus basse note fixe le dan
    (準初段 80 … 十段 280), sur le meilleur score de chaque matière parmi la session et les deux
    précédentes. L'ōyō keisan et le kaihō ne sont pas proposés : le dan se calcule sur les
    matières passées.
  - Denpyōzan : une liasse de 20 bordereaux de 5 lignes, tournée à l'écran (flèches, Page
    suivante / précédente) ; chaque problème additionne une ligne sur 10 bordereaux.
  - 暗算段位 : 40 ×, 40 ÷, 40 mitori de tête, 5 points, 3 minutes chacun, décimaux ; la plus basse
    fixe le grade (準初段 70 … 十段 190), même règle des 3 sessions.
  - Taille des nombres d'après les annales (fournie par l'utilisateur) : 珠算 × 11 puis 12 chiffres
    (6 × 5, 7 × 4 ; 6 × 6, 7 × 5), ÷ 10 puis 11, mitorizan de 10 lignes de 3–6 à 5–10 chiffres ;
    暗算 × 2 × 2 à 4 × 4 et ÷ de 4 à 8 chiffres par blocs, mitori de 3 chiffres sur 5 lignes puis
    des nombres à 4 chiffres et 6 lignes, soustractions sur les 10 derniers. Estimés et signalés :
    part de décimaux, denpyōzan, anzan au choix.
  - Après le 1er kyū Zenkoren : marches d'allure et examen de la semaine vers le dan Zenkoren.
- **Régularité en semaines tenues** (5 jours sur 7) dans la séance et dans Progression ; la série
  de jours reste en info-bulle.
- **Rappel d'export** tous les 7 jours (version navigateur) ; **compte à rebours** (J−n) vers
  l'objectif daté ; **feuille de la semaine** proposée chaque jour dans « Pour compléter » (le même
  sujet toute la semaine, à battre).

## Version 0.38.4

- **Kyū Zenkoren du 3e au 1er : deux matières au choix**, le denpyōzan (liasse de 20 bordereaux
  à l'écran, 15 problèmes, nombres de 3 à 5, 6 puis 7 chiffres) et l'anzan (5 ×, 5 ÷, 5 mitori de
  tête au format du kyū d'anzan Nisshō du même rang, 3 minutes). Cochées (par défaut, choix
  gardé), elles entrent dans l'examen et COMPTENT : 10 justes sur 15 dans chacune. Format estimé ;
  le calcul appliqué n'est pas proposé. Chacune peut aussi se passer seule.
- **Jour d'examen** : quand l'examen prend la place de la leçon, la leçon du jour passe en tête de
  « Pour compléter » et le mot du prof le dit (avant, elle disparaissait des deux listes).
- **Vitesse vers un grade** (objectif daté, allure des épreuves, prochain grade) :
  - les colonnes se mesurent sur les planches AU FORMAT du grade (au moins ses lignes et ses
    chiffres ; médiane des 5 dernières, 3 s de lecture retirées par colonne) ; sans elles,
    l'estimation par geste reste, marquée « à confirmer sur une planche au format » ;
  - × et ÷ jamais mesurés : « pas encore mesurés », plus jamais « vous tenez déjà l'allure ».
- **Mini-test en séries** : une série finie après minuit ne fait plus perdre le plan ; le morceau
  fait passe en tête du plan, la série suivante prend un morceau pas encore fait.
- **Dan d'anzan Zenkoren** : × décimaux exacts à 3 décimales au plus (jusqu'à 9 avant).
- Le barème du dan d'anzan garde 準初段 puis les dan pleins (barème fourni, sans 準弐段 à 準八段).
- Un essai qui fait plus de points ne retire plus une réussite déjà obtenue (record d'épreuve).

## Version 0.39.0

### Lot 1 · Des mesures de vitesse fiables
- **Mesures sur de vraies feuilles** (`core/mesures.js`) : planches, feuilles des marches, × et ÷ au
  format du kyū, premier passage de la feuille de la semaine (« entraînement ») ; examens blancs et
  épreuves (« sous examen »). Chaque mesure garde son format (lignes × chiffres, ou type et chiffres
  au total). Une feuille réussie à moins de 70 % n'est pas une mesure ; une feuille avec de l'anzan
  ou du denpyō non plus.
- **Vitesse au format du grade partout** : allure des épreuves, objectif daté, score projeté des
  marches, choix de la matière du jour (hakari). Les gestes isolés ne servent plus qu'en secours,
  « à confirmer ». Un examen de ce grade de moins de 3 semaines prime (vitesse sous examen).
- **Temps hebdomadaires par format** (gestes et leçons) : les plateaux se comparent à format égal.
- **Projection du délai** : le repère de 2 % par semaine, puis le gain réel lissé sur 6 à 8
  semaines (pente, bornée à 0,5–4 %), d'autant plus pris en compte que les semaines s'accumulent
  (plein poids à 8). Aucun gain sur 3 semaines : « en plateau », pas de date pour la vitesse.
- **Socle** (examen court des premiers grades) : il ne remplace la leçon qu'au premier jour pratiqué
  du vendredi au dimanche ; les autres jours, il attend en tête de « Pour compléter ».
- **p4-4** : lignes de 2 chiffres, premier nombre de 3 chiffres assez grand pour toutes les
  soustractions (avant : 4 chiffres une fois sur deux).
- **Révisions** : une micro-marche de × ou ÷ sort dès que sa leçon complète est validée, une petite
  leçon dès qu'un format plus grand du même type est solide (les zéros gardent leur révision) ;
  les révisions dues se trient par fragilité (fluidité à reprendre, boîte basse) puis par retard,
  3 au plus par séance.

### Lot 2 · La vitesse progresse pendant les leçons
- **Marches anticipées** : marches 1 et 2 dès 70 % des leçons du grade validées, un jour sur deux,
  sur les seules parties (colonnes, ×, ÷) dont toutes les leçons sont validées ; marches 3 à 5 après
  les leçons.
- **Test flash de révision** : 9 justes ET 85 % au moins de la vitesse habituelle (médiane des 10
  derniers essais réussis), jamais plus exigeant que la médaille de la leçon. Juste mais lent : la
  carte reste dans sa boîte, la leçon est « fluidité à reprendre » et passe en priorité dans les
  blocs de vitesse (et le choix de la matière du jour pour × ÷), jusqu'à l'or. Les leçons sorties
  d'une étape sans l'or y passent aussi (la « dette de vitesse »). Révision mélangée : justesse seule.
- **Plateaux** : la détection reste active au-delà du platine tant que le geste n'a pas 10 % de marge
  sur l'allure du grade ou du dan visé. × et ÷ : plateau sur les feuilles mesurées ; la séance
  propose alors 4 blocs de 90 s à 115 % de la meilleure cadence, justesse sur le cumul.
- **Détecteur de recul** : un geste 15 % plus lent deux semaines de suite (10 essais par semaine au
  moins, même format, 6 dernières semaines) déclenche un bloc « réveil ».
- **Feuille de la semaine** au format du grade : environ 7 minutes à l'allure de l'examen ; seul le
  premier passage de la semaine est une mesure.
- **Lièvre au format du grade** : quand la rotation tombe sur les colonnes un jour de vitesse, des
  colonnes de l'examen au tempo imposé, départ à 100 % de la vitesse mesurée, +3 % après chaque
  colonne juste ; la ligne suivante reste visible (lecture anticipée). Les colonnes courtes restent
  pour les jours de volume.

### Lot 3 · Un vrai mode entretien
- **Rotation séance par séance** (`core/entretien.js`) : colonnes, ×, ÷, anzan et flash (et le
  denpyōzan en Zenkoren quand le grade l'a) ; une séance sur deux, la matière la plus en retard.
  Durée : 40 % de l'objectif du jour (5 à 20 min).
- **Examen de la semaine en alternance** : une semaine l'examen complet chronométré (le seul qui
  compte pour le record), l'autre deux sprints de 7 minutes (colonnes, puis la partie la plus
  lente) et la reprise des erreurs.
- **Format des dan après le 1er kyū** : planches d'entretien en colonnes mêlées de 5 à 10 chiffres.
- **Maintien pur** (plus rien à viser) : l'examen complet du week-end, et à tour de rôle un sprint
  sur la matière la plus faible, le rejeu de la planche la plus récente, le flash anzan.
- **Contrôle tous les 90 jours** des leçons acquises à règle rare (négatifs, décimaux, arrondis) et
  de 4 synthèses (p5-5, p8-3, p9-4, p9-6), sauté après une épreuve du mois qui les contenait ;
  raté ou 15 % plus lent : retour en révision (boîte 3).
- **Fiche facultative « deux mains »** en bas des épreuves, à partir de la préparation du 3e kyū,
  sans seuil ni incitation.
- Écartés à la demande : dictée jusqu'à 10 chiffres, tranches de 3 chiffres surlignées.

## Version 0.40.0

### Bugs
- **Écrans vides après un rechargement** (le jour où une leçon était commencée) : la séance
  n'enregistre plus que l'identifiant de la leçon, retrouvée ensuite dans le curriculum (sa liste de
  gestes autorisés revenait vide à la lecture) ; une séance enregistrée illisible est recalculée, et
  la barre de séance ne peut plus empêcher un écran de s'afficher.
- **Faux records des drills** : un temps de moins de 0,15 s par chiffre, ou plus de 3 fois plus
  rapide que la médiane du drill, ne compte pas (ni record, ni médaille, ni validation) ; Entrée est
  ignorée la première seconde après l'ouverture du drill ; l'écran rappelle de remettre le soroban au
  nombre de départ (le drill finit toujours sur le même nombre). Au chargement, les faux records sont
  recalculés depuis l'historique (meilleur temps plausible) et les validations à tort retirées ;
  bouton « Supprimer ce record ».
- **Bouton « Passer le mini-test »** : place fixe, en tête du bandeau ; largeurs stables.
- Les réglages proposés par la séance (lièvre, marathon) ne restent plus dans l'écran libre ;
  une proposition part des valeurs par défaut.
- **Échauffement** : 3 minutes au plus (record de l'élève, sinon temps bronze + 30 %).
- **Plateaux** : à 5 chiffres et plus, les petits amis ne sont plus suivis.
- **Entre deux grades préparatoires** (le suivant pas encore ouvert) : l'examen de la semaine sur les
  leçons validées, avec un score, au lieu de repasser le grade obtenu ou de rien.
- **Contrôle à 90 jours** : chaque synthèse est reliée au grade qui contient son format (p5-5 :
  10e kyū ; p8-3 : 3e kyū ; p9-4 et p9-6 : 1er kyū ; un examen de dan contient tout).

### Lièvre et marathon qui grandissent (`core/rythmeStade.js`)
- Directs et petits amis : lièvre 1 chiffre × 5 lignes, marathon 1 chiffre (30 à 40 lignes) ;
  grands amis : 2 chiffres × 7 lignes, marathon 2 chiffres ; 10e kyū : lièvre 2 ou 3 chiffres × 10
  lignes, marathon 3 chiffres avec sous-total toutes les 10 lignes ; 6e kyū : lièvre au format du
  grade moins 1 chiffre, marathon 4 ou 5 chiffres avec zéros internes ; dan : lièvre 5 à 7 chiffres
  mêlés, marathon 5 à 10 chiffres mêlés, 20 lignes au moins.
- Durée fixe d'environ 3 min 30 : le nombre de lignes (marathon) ou de colonnes (lièvre) suit la
  vitesse mesurée.
- Variantes tournées d'une séance à l'autre : lièvre qui accélère dans la colonne, lièvre contre son
  fantôme (sa meilleure cadence) ; marathon de soustractions en cascade (après p5-4).

### Progression à l'intérieur des leçons (`core/phases.js`)
- Petits et grands amis (p2 à p4), leçons « 2 et 3 chiffres », colonnes d'endurance (p8, p9) :
  un cycle de formats autour du format de RÉFÉRENCE (celui du mini-test, inchangé).
  - Référence → montée (2 chiffres, 7 à 8 lignes ; 3 chiffres pour les « 2 et 3 chiffres ») après
    6 colonnes justes d'affilée à l'allure argent au départ, après 6 colonnes (justes ou non) au
    retour → endurance (10 lignes) après 6 colonnes justes → retour en référence après 6 colonnes
    justes ; montée et endurance rendent la main à la référence au bout de 12 colonnes.
  - Endurance p8, p9 : 6 lignes, 8 lignes, puis 10 lignes (la référence).
  - Filet : 2 colonnes fausses d'affilée → 3 colonnes au format de référence, doigté affiché.
  - Pas de cascades à 2 chiffres et plus avant p5-4 ; option « Je connais déjà : commencer à 2
    chiffres ».
- Seules les colonnes de référence comptent pour la médaille, le coupe-file (15 premières colonnes
  de référence justes au niveau or) et les temps des gestes ; hors référence, une colonne compte
  pour la justesse et la mesure par format.
- Jauge en gestes visés (répétitions × gestes visés moyens d'une colonne de référence) ; mini-test
  ouvert avec la jauge pleine ET au moins 20 colonnes de référence.
- Leçons « 2 et 3 chiffres » : une colonne sur deux à 3 chiffres, en alternance (mini-test compris),
  au lieu d'un tirage au hasard.

## Version 0.40.1

### Leçons à phases (`core/phases.js`)
- **Minimum de colonnes de référence** avant le mini-test : 40 % des répétitions de la leçon (20 pour
  p2 à p4, 12 pour p8, 8 pour p9) au lieu de 20 partout (une leçon p9 de 20 colonnes passait à près
  de 80).
- **Leçons d'endurance** (p8, p9) : la rampe 6 lignes → 8 lignes → 10 lignes est faite UNE fois, puis
  on reste à 10 lignes (la référence) ; une rampe jamais réussie avance d'une marche au bout de
  12 colonnes. Rampe sautée quand la leçon d'endurance précédente est validée à l'argent ou mieux.
- **Filet** au format le plus simple de la leçon : la référence pour les amis, 6 lignes pour
  l'endurance (avant : 10 lignes, plus dur que la phase remplacée). Il se déclenche après 2 erreurs
  de suite SUR UN GESTE VISÉ (erreur localisée sur un autre geste : ne compte pas ; erreur non
  localisée : compte si la colonne contient un geste visé).
- **Jauge pleine** : on ne remonte plus ; la fin de la leçon se fait au format du mini-test (avant,
  l'élève parfait faisait la leçon la plus longue).
- Coupe-file : les 15 premières colonnes de référence, quel que soit le nombre de colonnes faites.
- La ligne du bouton du mini-test est réservée dès le début (« Le mini-test s'ouvrira ici. »).

### Séance
- **Un seul exercice par geste et par séance** hors bloc « automatiser » : sur un geste en plateau,
  le sprint de surcharge remplace le lièvre ; un geste déjà travaillé (ou reporté) n'a plus de bloc
  ni de planche « pour compléter ».
- Plateaux des petits amis ignorés au-delà de 4 chiffres de travail : le plus grand des formats des
  leçons validées et du grade visé (un élève positionné haut n'a pas forcément validé les leçons à
  5 chiffres).

## Version 0.40.2

- **Jauge des leçons à phases** : les gestes visés des colonnes fausses comptent aussi, comme les
  anciennes répétitions.
- **Endurance de p2 à p4** (et des leçons « 2 et 3 chiffres ») : le mini-test demande 6 colonnes
  faites en endurance (2 chiffres, 10 lignes ; justes ou fausses). Garde : gestes suffisants sans
  endurance faite, la référence passe à l'endurance au bout de 6 colonnes (et la montée tout de
  suite), sans devoir réussir la montée.
- **Dette de vitesse** (`core/fluidite.js`) : une leçon de colonnes sort de la liste quand tous ses
  gestes sont en or (les blocs de vitesse les entraînent ; la médaille de la leçon n'avance qu'en
  leçon : avant, une leçon sortie à l'argent y restait pour toujours). Seule une leçon marquée lente
  en révision force la séance en vitesse (avant, n'importe quelle leçon validée sans l'or la forçait :
  plus aucun jour de volume).
- **Dictée** : paliers sur soroban jusqu'à 10 chiffres (5, 6, 8, 10), ouverts selon les chiffres de
  travail ; mode libre de 1 à 10 chiffres.
- **Entre deux grades préparatoires**, objectif court : au premier jour du créneau (vendredi au
  dimanche), la feuille de la semaine entre dans la séance (l'examen blanc reste proposé à part).

## Version 0.40.3

- **Feuille de la semaine dans la séance principale** : une semaine sans examen dans la séance
  (examen blanc proposé à part, ou aucun examen blanc disponible), la feuille de la semaine y entre au
  premier jour pratiqué du créneau (le vendredi si l'on s'entraîne ce jour-là, sinon samedi ou
  dimanche), sauf si elle est déjà faite cette semaine. Elle garde sa place même avec un objectif court
  (le calibrage la renvoyait dans « Pour compléter »). En 0.40.2, elle n'y entrait que si l'examen
  hebdomadaire était proposé à part.

## Version 0.40.4

### Flash anzan (`ui/cadence.js`)
- À l'écran, la cadence se compte en IMAGES : une seule boucle de rafraîchissement
  (requestAnimationFrame), chaque appel est une image ; une image sautée compte quand même (la série
  ne ralentit pas). La fréquence de l'écran est mesurée une fois (médiane de 20 intervalles), mais ne
  sert qu'à convertir les durées voulues en nombres d'images : ce qui est garanti l'est en images.
- Au moins 1 image vide entre deux nombres, réellement affichée (un nombre n'apparaît jamais dans
  l'image où le précédent a été masqué). Au 20e dan à 60 Hz : 100 ms = 6 images, 5 affichées, 1 vide.
- Pendant le flash, aucun élément n'est créé : le nombre et son signe sont créés une fois par écran,
  seuls le texte et la visibilité changent.
- Écran trop lent pour la vitesse (moins de 2 images d'écran vide voulues entre deux nombres, par
  exemple 60 Hz à 200 ms par nombre et en dessous) : un avertissement sous l'exercice, jamais un blocage.
- Sans affichage (tests, onglet en arrière-plan) : minuterie calée sur l'horloge, comme avant.

### Examens et contenus
- Mitorizan : les lignes à 1 chiffre vont de 1 à 9 (le 1 n'apparaissait jamais : le tirage
  commençait à 2, comme pour × et ÷).
- × ÷ du 3e au 1er kyū : 60 % de décimaux dans la seconde moitié (montants arrondis à l'unité), au lieu
  de la moitié. L'allure du 1er kyū en devient un peu plus serrée : le platine de l'échelle avancée
  passe à 0,51 s par chiffre et 1,02 s par produit (0,52 et 1,05 avant).
- Dictée de tête : paliers jusqu'à 3 chiffres × 10 nombres, puis 4 chiffres × 3 et × 5.
- Anzan des gestes directs (p1-a) : tous les gestes directs, en addition et en soustraction, le 5 et
  la pincée (6 à 9) compris (avant : +1 à +4 seulement).

### Leçons
- Phases : sur une leçon d'introduction à 1 chiffre (p2-1, p3-1…), la montée (7 à 8 lignes) et
  l'endurance (10 lignes) allongent la colonne SANS passer à 2 chiffres ; les leçons à 2 chiffres et
  plus (« 2 et 3 chiffres », synthèses) gardent leur format. « Je connais déjà : commencer aux
  colonnes longues » sur ces leçons.
- Coupe-file : 14 justes sur les 15 premiers exercices (au lieu de 15 sur 15), médiane à l'allure de
  l'or.

### Séance
- Ordre des blocs : échauffement, ANZAN, révision, leçon, volume / vitesse.
- Blocs de 5 minutes au moins : l'anzan dure 5 à 8 minutes (15 % de l'objectif) ; un bloc de volume /
  vitesse de moins de 5 minutes (rien n'y est encore fait) passe dans « Pour compléter », la leçon
  reprend le temps. L'échauffement (3 min au plus), les révisions dues et la leçon ne sont pas
  concernés.
- Plus de jeu dans « Pour compléter » à partir du 6e kyū (les jeux restent dans le menu).

## Version 0.40.5

- **Feuille de 10 d'une leçon à phases** : au « Corriger », chaque colonne entre dans la jauge comme
  en mode « Une par une » (gestes visés, colonnes fausses comprises) et compte comme colonne de
  référence (la feuille est au format du mini-test). Avant, la feuille comptait partout (statistiques,
  réussite, vitesse, coupe-file, gestes) sauf dans la jauge et les compteurs de colonnes.
- La feuille n'a pas de colonnes d'endurance : sous le bilan, un message dit combien il en reste et
  qu'elles se font en mode « Une par une ».
- Au-dessus de la feuille : « Les colonnes de la feuille comptent au moment de « Corriger » : une
  feuille abandonnée avant ne compte pas. »

## Version 0.40.6

- **Feuille de 10 avec l'endurance** : tant que des colonnes d'endurance restent à faire (leçons d'amis
  et « 2 et 3 chiffres »), la feuille en contient, 6 au plus, dans une section à part (« Endurance :
  3 chiffres, 10 lignes ») ; les autres sont au format du mini-test. Au « Corriger », les colonnes du
  format du mini-test comptent comme colonnes de référence, celles d'endurance comme colonnes
  d'endurance (hors médaille et hors temps des gestes, comme en mode « Une par une ») ; toutes entrent
  dans la jauge.
- Sur une feuille, le temps se répartit entre les colonnes au prorata de leur longueur (avant : à
  parts égales, ce qui faussait la vitesse d'une feuille aux colonnes de longueurs différentes).

## Version 0.40.7 : variété des colonnes (sens des lignes)

Constat (mesuré) : le générateur construisait déjà chaque ligne tige par tige à partir du total en
cours, dans les gestes autorisés ; le biais venait du SENS des lignes : une ligne qui vise un geste de
la leçon prend son sens, et en p3 tous les gestes visés sont des additions. En p3-4 : 1 % de
soustractions et des colonnes jusqu'à 4 000 ; en p3-1 à p3-3 : 10 à 15 %, aucune sur les dizaines.

- **Part de sens inverse** (`PART_INVERSE` = 25 %, réglage du générateur `partInverse`) dans une
  leçon ou une planche dont tous les gestes visés vont dans le même sens : soustractions dans une
  leçon d'addition (p3, +9 grand ami…), additions dans une leçon de soustraction (p4, −2 petit ami…).
  Le nombre de lignes inverses d'une colonne est fixé au départ et réparti au hasard sur les lignes
  restantes (pas toujours la même ligne). Leçons mixtes et de synthèse : rien ne change. Anzan : rien
  ne change (chaînes courtes).
  - Leçon d'addition : jamais deux soustractions de suite (lignes de préparation et ligne ajoutée
    pour varier le résultat comprises).
  - Leçon de soustraction : les soustractions s'enchaînent librement ; jamais sous zéro.
  - Format de référence à 1 chiffre : la ligne inverse se fait sur les unités, sans emprunt (−1 à −4,
    −5 direct…) ; impossible à cet endroit : la ligne garde le sens de la leçon.
- **Lignes de dizaines** (−10 à −40 dans une leçon d'addition, +10 à +40 en soustraction) : hors
  format de référence seulement (montée, endurance, planches à 1 chiffre), une par colonne au plus, à
  une position tirée au hasard. Planches ciblées : une ligne directe devient, si possible, une ligne
  de dizaines (les derniers niveaux de repli s'en passent).
- Planches ciblées : les lignes directes changent plus souvent de sens que le geste, jamais deux
  lignes de sens inverse de suite (sauf repli).
- **Total plafonné** à une tige au-dessus du format de la colonne (avant : trois) ; le format d'examen
  garde sa règle. Plafond « souple » : une ligne au-dessus n'est prise que si aucune autre n'est
  possible.
- Mesures (200 colonnes) : soustractions en p3-1 de 10 à 24 %, p3-4 de 1 à 24 % ; p4-1, additions de
  12 à 27 % ; aucune soustraction consécutive en p3 ; aucun total sous zéro. La jauge : moins de gestes
  visés par colonne (p3-1 : 2,28 → 1,75) ; l'objectif de la jauge est calculé sur le même générateur,
  il baisse d'autant : la leçon garde à peu près le même nombre de colonnes.
- Planches ciblées : jamais deux colonnes de même forme sur une planche (les niveaux de repli du
  générateur pouvaient en redonner une ; le robot le relevait environ une fois sur 20 avant la 0.40.7) ;
  niveaux de repli sans répétition et sans ligne de dizaines avant d'autoriser une forme répétée.

## Version 0.40.8

- **Quota de lignes inverses dans les planches ciblées** : atteint (25 % des lignes), plus de ligne
  de dizaines ni de ligne directe inverse favorisée. Les planches de petits amis à 1 chiffre, qui
  avaient déjà beaucoup de soustractions d'elles-mêmes, passent de 36-46 % à 25-35 % de lignes
  inverses (le mode « famille » garde ses autres amis, qui portent leurs propres soustractions).
  Dans les leçons, la ligne de dizaines compte dans la part inverse et n'est pas ajoutée quand la
  part est atteinte ; une ligne de préparation de sens inverse compte aussi.
- **Planches de soustraction à 2 chiffres et plus** : le nombre de départ a toujours une tige de plus
  en tête, haute (5 à 9) : −9 grand ami à 2 chiffres passe de 36-45 % à 27-31 % d'additions.
- **Places des lignes inverses uniformes** : le plan (nombre et places des lignes inverses) est tiré
  UNE fois par colonne et gardé d'un essai à l'autre (`planInverses`). Retiré à chaque essai, il
  favorisait les places les plus faciles : en p3-2 et p3-3, la 3e ligne recevait deux fois plus de
  lignes inverses que les autres. Les premiers essais exigent chaque ligne inverse à sa place ; en
  dernier recours seulement, elle est reportée plus loin.

## Version 0.40.9 : les autres amis en endurance

- **Format de référence inchangé** (mini-test, médaille) ; **montée et planches « seul »** : les lignes
  sans geste visé restent des gestes directs (le geste en cours d'apprentissage reste le seul qui
  demande une décision).
- **Endurance** (leçons d'amis et « 2 et 3 chiffres ») : une ligne au plus par colonne avec un AUTRE
  ami déjà appris (petits amis dans une leçon de grands amis, grands amis des leçons précédentes…), à
  une place tirée au hasard. Il ne compte pas dans la jauge (pas un geste visé) ; une erreur sur lui ne
  déclenche pas le filet. Première leçon de petits amis : aucun autre ami, rien ne change.
- **Jamais de combinaison de deux amis ni de cascade avant p5**, dans aucune phase (garanti par les
  gestes autorisés, vérifié par un test sur toutes les leçons de p1 à p4).

## Version 0.40.10 : plus d'autres amis à partir des grands amis, colonnes longues cadrées

- **À partir des grands amis (p3, p4)**, montée et endurance : les lignes sans geste visé deviennent
  des AUTRES amis déjà appris (petits amis, grands amis des leçons précédentes) chaque fois que la tige
  le permet, au lieu de gestes directs de remplissage. Le nombre d'autres amis est tiré pour CHAQUE
  colonne : 20 à 40 % des lignes en montée, 45 à 65 % en endurance (plafond : pas de proportion fixe).
  Ils ne prennent jamais la place du geste visé (sa part ne baisse pas, la leçon ne s'allonge pas) ; de
  préférence un ami après lequel le geste visé reste possible. En leçon d'addition, quand seul le sens
  inverse permet un ami, une soustraction de plus au plus est admise (≈ 30 % au lieu de 25 %) ;
  jamais deux soustractions de suite. En leçon de soustraction, les additions restent à 25 %. Mesure (1 chiffre, endurance) : environ 30 % de
  geste visé, 35 à 50 % d'autres amis, le reste en directs (dont la ligne de dizaines) : à 1 chiffre,
  une tige vide (0) ou presque pleine n'admet souvent aucun autre ami.
- **Référence, mini-test, planches « seul »** : inchangés. **Petits amis (p2)** : inchangé (une ligne
  au plus en endurance) : trop peu d'amis appris.
- **Colonnes longues** (9 lignes et plus) : lignes resserrées, et la page se cale d'elle-même pour
  montrer la colonne entière et la saisie (la case déjà active ne faisait pas défiler la page).
