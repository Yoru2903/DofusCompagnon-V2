# 04 — Règles Métier et Moteur Économique

## DofusCompagnon

---

# 1. Principe du moteur économique

Le moteur économique est un module indépendant, testable hors interface (voir `02 - Architecture Technique.md`, §6). Toutes les formules ci-dessous doivent être implémentées comme fonctions pures, sans dépendance à Prisma, Fastify ou React, prenant des objets métier en entrée et retournant des résultats reproductibles.

---

# 2. Relation Caractéristiques ↔ Runes

## 2.1 Principe

Une **caractéristique** (ex: Vitalité, Force, Sagesse) produit une **famille de runes liées par palier (tier)**, identifiées par un `code` pivot stable :

| Tier | Usage | Préfixe nom | Exemple | Statut fonctionnel V1 |
|---|---|---|---|---|
| `base` | Brisage simple | "Rune X" | Rune Vi | **Critique — utilisé activement** |
| `pa` | Forgemagie | "Rune Pa X" | Rune Pa Vi | Données stockées, non exploitées fonctionnellement |
| `ra` | Forgemagie | "Rune Ra X" | Rune Ra Vi | Données stockées, non exploitées fonctionnellement |

## 2.2 Fiabilité des données runes (rappel)

Sur le jeu de données d'import initial (83 runes), seules les runes **Vi** et **Pa Vi** sont d'origine officielle confirmée (`source_status: official_touch`). Les 81 autres sont issues d'un tableau communautaire (`source_status: community_touch`), à marquer `verification_status = imported` avec un `confidence_level` bas (voir `03`, §6 et `05`, §4 pour le mapping complet).

---

# 3. Formule de calcul — Brisage

## 3.1 Formule générale (par ligne d'effet de l'item brisé)

```text
poids_brute = jet_utilise * poids_unitaire_de_la_caracteristique
runes_obtenues_brutes = (poids_brute * taux_brisage) / pwr_rune_base
runes_entieres = floor(runes_obtenues_brutes)
probabilite_rune_supplementaire = runes_obtenues_brutes - runes_entieres
runes_moyennes = runes_entieres + probabilite_rune_supplementaire   // valeur attendue statistique
```

Où :
- `jet_utilise` = valeur effective de la caractéristique sur l'item brisé (issue de `item_effects`, jet réel constaté ou jet moyen min/max)
- `poids_unitaire_de_la_caracteristique` = **`rune_characteristics.weight`** de la rune de tier `base` correspondant à la caractéristique (arbitré au Lot 4 — en l'absence de source officielle distinguant "poids de ligne" et "poids de rune", `weight` est utilisé pour les deux termes de la formule ; cette valeur unique est la seule disponible et son usage est cohérent avec les résultats observés)
- `taux_brisage` = coefficient de brisage de l'item au moment du brisage (variable, dépend de l'économie serveur — donnée saisie ou observée, jamais présumée fixe). **Toujours transmis en décimal : 0.6 pour 60%, jamais 60.** Toute interface qui recueille ce taux en valeur entière (ex: champ "60") doit le convertir en décimal avant de l'envoyer au moteur.
- `pwr_rune_base` = `rune_characteristics.weight` de la rune de tier `base` correspondant à la caractéristique (identique à `poids_unitaire_de_la_caracteristique` dans l'implémentation actuelle)

Le moteur doit retourner à la fois `runes_entieres` (certain) et `probabilite_rune_supplementaire` (ex: 0.6 = 60% de chance d'obtenir une rune de plus), pour permettre à l'interface d'afficher clairement l'espérance statistique sans la présenter comme un résultat garanti — conformément au principe UX de distinction estimation/résultat réel (`01`, §7).

## 3.2 Cas particulier — Runes PA / PM / PO

**Aucune formule officielle ou fiable n'a pu être identifiée pour ces runes spécifiquement.** Ankama ne communique volontairement aucune formule de brisage/forgemagie. Les tentatives communautaires de reverse engineering (y compris des calculateurs historiquement réputés) présentent des taux d'erreur documentés significatifs et ne sont pas fiables comme référence durable.

**Décision retenue** :
- Appliquer **la même formule générale** (§3.1) aux runes PA/PM/PO que pour les autres caractéristiques par défaut — cohérent avec les témoignages disponibles indiquant un mécanisme proportionnel similaire.
- Marquer systématiquement ce résultat avec un **niveau de confiance bas explicite** dans l'interface (ex: "estimation théorique — écarts observés en jeu") plutôt que de l'afficher comme un résultat fiable au même titre qu'une rune de caractéristique standard.
- Prévoir que ce calcul puisse être affiné plus tard par les données réelles accumulées par les utilisateurs de l'application elles-mêmes (historique de sessions de brisage réelles), qui peuvent devenir une source de calibrage empirique plus fiable que toute source externe.

**Aucune donnée chiffrée externe ne doit être codée en dur comme "officielle" pour PA/PM/PO** — cela violerait le principe de fiabilité non présumée (`01`, §3.2).

## 3.3 Zone d'incertitude à surveiller

Le "poids unitaire de la caractéristique" et le "taux de brisage" peuvent dépendre du niveau de l'item et évoluer dynamiquement selon l'économie du serveur (mécanisme confirmé mais non documenté officiellement). Le moteur doit traiter `taux_brisage` comme une **entrée variable obligatoire** (jamais une constante supposée), saisie ou observée par l'utilisateur au moment du calcul, jamais déduite par défaut.

---

# 4. Formule de calcul — Coût de craft

## Entrées
- Recette (liste d'ingrédients + quantités)
- Prix unitaires des ressources (dernier `price_snapshot` connu, ou prix saisi manuellement pour le calcul)

## Sorties
- Coût unitaire = somme(quantité ingrédient × prix unitaire ingrédient) / quantité produite
- Coût total = coût unitaire × quantité craftée

Le calcul doit conserver la référence aux `price_snapshot_id` utilisés (traçabilité, voir `01`, §3.4) — ne jamais recalculer silencieusement une session passée avec des prix plus récents.

---

# 5. Formule de calcul — Valorisation des runes obtenues

## Entrées
- Runes obtenues (résultat du calcul de brisage, §3)
- Prix runes (dernier `price_snapshot` connu pour chaque rune)

## Sorties
- Valeur totale = somme(quantité rune × prix unitaire rune)

---

# 6. Formule de calcul — Rentabilité

## Entrées
- Coût craft (§4) ou coût d'achat (trade_lines)
- Gain brisage (§5) ou gain de revente (actual_total_sell_price)

## Sorties
- Bénéfice = gain - coût
- Marge = bénéfice / coût
- ROI = bénéfice / coût × 100

Toujours distinguer **prévisionnel** (basé sur prix/estimations au moment du calcul) et **réalisé** (basé sur résultats effectifs constatés) — ne jamais les confondre dans le dashboard ou les statistiques.

**Règle dashboard — Craft (arbitrée au Lot 6) :** une session de craft seule est traitée comme une **dépense réalisée, gain 0** dans les KPIs du dashboard. L'item crafté a une valeur potentielle, mais aucun gain *réalisé* tant qu'il n'est pas vendu (via trade) ou brisé (via breaking). Ce choix est conforme au principe "réalisé pur" du dashboard — le gain n'apparaît qu'une fois l'opération de valorisation effective tracée. Ne jamais additionner une valeur estimée de l'item crafté comme gain dans les KPIs réalisés.

---

# 7. Snapshots économiques — Règle de conservation

Tout calcul de rentabilité significatif (craft, brisage, revente, simulation) doit créer un `economic_snapshots` conservant :
- les prix utilisés (références aux `price_snapshot_id`) ;
- les quantités ;
- les dates ;
- les résultats du calcul.

Objectif : permettre de comprendre une rentabilité passée sans avoir à recalculer, et sans que les prix actuels viennent altérer rétroactivement un résultat historique.

---

# 8. Règles de fiabilité des données — Application au moteur

Le moteur économique ne doit **jamais** traiter une donnée `verification_status = imported` ou `draft` de la même façon qu'une donnée `verified`. Concrètement :

- Si une donnée critique au calcul (prix, jet de caractéristique, poids de rune) est en statut non vérifié, l'interface doit le signaler visuellement à l'utilisateur (principe UX, `01` §7).
- Le moteur ne bloque pas le calcul pour autant (l'application sert justement à organiser la vérification progressive), mais ne doit jamais masquer ce niveau d'incertitude dans le résultat affiché.

---

# 9. Tests obligatoires

Conformément à `02 - Architecture Technique.md` (§15), les fonctions suivantes nécessitent une couverture de tests prioritaire (objectif 80%) :

- Calcul de coût de craft (§4)
- Calcul de brisage, y compris cas particulier PA/PM/PO (§3)
- Calcul de valorisation runes (§5)
- Calcul de rentabilité (§6) — craft, brisage, achat-revente
- Logique d'arrondi/probabilité (`runes_entieres` / `probabilite_rune_supplementaire`)

Les tests doivent couvrir au minimum : cas nominal, cas avec taux de brisage à 0 ou 100%, cas avec données non vérifiées, cas avec effet `is_special = true` (à traiter sans crash, même sans formule garantie).
