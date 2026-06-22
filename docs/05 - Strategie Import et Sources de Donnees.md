# 05 — Stratégie Import et Sources de Données

## DofusCompagnon

---

# 1. Sources retenues et statut

| Source | Données couvertes | Méthode | Statut |
|---|---|---|---|
| API DofusBook Touch | Équipements + recettes (ingrédients en id/quantité) | Appel HTTP direct, pagination automatique — aucune protection anti-bot constatée à ce jour. URL de base : `https://touch.dofusbook.net/api/items/touch/search/equipment?context=item&page=1&sort=desc` (paramètre `page` incrémenté pour la pagination) | **Source primaire automatisée** |
| Fichier JSON runes (fourni par le porteur de projet) | Runes base/PA/RA, poids forgemagie, bonus, fiabilité par rune | Import fichier statique, à ré-exécuter si le fichier est mis à jour | **Source primaire, import fichier** |
| Encyclopédie officielle Ankama | Référence de vérification ponctuelle | Aucun import technique — consultation manuelle uniquement (rendu visuel non automatisable) | **Hors périmètre import V1**, conservée en `data_sources` pour traçabilité de vérifications manuelles |
| DofApi | — | — | **Exclue définitivement du projet** — projet abandonné et obsolète, ne jamais réintroduire sous quelque forme que ce soit |
| Prix ressources/runes/équipements (HDV) | Prix en jeu | Aucune API (bloqué volontairement par Ankama) | **Saisie manuelle exclusivement**, flux utilisateur continu (voir §5) |

---

# 2. Ressources : génération dérivée, pas import direct

Il n'existe aucune source directe listant les ressources du jeu. Les ressources sont des `items` créés automatiquement par déduction des `ingredient_item_id` présents dans les `recipe_ingredients` importées depuis les équipements DofusBook.

## Règle obligatoire pour le service d'import

Lorsqu'un `ingredient_item_id` référencé dans une recette importée ne correspond à aucun `item` existant en base, créer automatiquement l'item correspondant avec :

- `name` = nom fourni par l'API DofusBook dans `ingredients[].name`
- `is_resource = true`
- `verification_status = "imported"`
- `confidence_level` = faible
- Pas de `level`, `job_id` ou autres attributs détaillés (non fournis par cette voie) tant qu'une vérification manuelle ne les complète pas

---

# 3. Contrat d'import — Équipements (API DofusBook)

## Structure JSON source (endpoint `equipment`, à revalider si un autre `context` est utilisé)

```text
id, official, level, category_id, category_name, category_type,
name, slug, cloth_id, cloth_name,
effects[] {
  id, name (code court, ex: "vi", "fo"),
  type ("E" = caractéristique standard, "O" = effet spécial/sort),
  min, max, spell, spellDesc
},
ingredients[] { item_id, name, count },
constraints[], weapon, skin
```

## Mapping vers le modèle de données

| Champ source | Destination |
|---|---|
| `id`, `name`, `level` | `items` |
| `category_id` / `category_name` | `item_types` |
| `cloth_id` / `cloth_name` | `items.panoply_name` |
| `effects[]` où `type = "E"` | `item_effects` (`characteristic_id` résolu via `effects[].name` = `characteristics.short_name`, `min_value`, `max_value`) |
| `effects[]` où `type = "O"` | **Ignoré en V1** — voir `03 - Modele de Donnees.md`, §13 |
| `ingredients[]` | `recipes` + `recipe_ingredients` (déclenche la génération dérivée des ressources, §2) |
| `weapon`, `skin`, `constraints` | **Non exploités en V1**, à ignorer |

Le service d'import doit conserver le JSON brut dans `import_records.raw_data_json` avant toute transformation, conformément au workflow obligatoire : **Import brut → Analyse → Validation → Publication**. Une donnée importée ne devient jamais automatiquement une donnée validée.

---

# 4. Contrat d'import — Runes (fichier JSON fourni)

Le fichier de référence (`runes-dofus-touch-regenerated.json` ou toute version mise à jour fournie par le porteur de projet) sert de source d'import pour `items` (runes) et `rune_characteristics`.

## Mapping

| Champ source | Destination |
|---|---|
| `code` | Clé pivot pour résoudre/créer `characteristics` (un `code` par caractéristique, partagé entre les 3 tiers) |
| `rune` | `items.name` (un item par entrée) |
| `pwr` | `rune_characteristics.weight` |
| `bonus` | `rune_characteristics.bonus_value` |
| `tier` (`base`/`pa`/`ra`) | `items.rune_tier` |
| `special` (si `true`) | `rune_characteristics.is_special = true` — signale un traitement prudent requis dans le moteur de calcul, sans bloquer l'import |
| `source_status` | Détermine `verification_status` / `confidence_level` / `data_sources` (voir §6) |

Le fichier complet (`meta` inclus) doit être conservé en `import_records.raw_data_json`, y compris les notes de fiabilité (`meta.warning`, `meta.sources`).

---

# 5. Prix : flux utilisateur, pas un import batch

La saisie de prix (ressources, runes, équipements) par les joueurs en jeu est **l'usage normal de l'application**, pas un import au sens du workflow `import_batches`/`import_records`. Chaque saisie crée directement un `price_snapshots`, sans étape de validation administrateur.

Aucune confusion ne doit être faite entre ce flux et le workflow d'import structuré du §3/§4.

---

# 6. Statuts de vérification et sources — Table d'application

| Origine donnée | `verification_status` | `confidence_level` | `data_sources` |
|---|---|---|---|
| Équipements/recettes via API DofusBook | `imported` | Moyen | "DofusBook Touch (API)" |
| Ressources déduites des recettes | `imported` | Faible | Source = recette d'origine |
| Runes base Vi / Pa Vi | `verified` | Haut | "Encyclopédie officielle Dofus Touch" |
| Runes restantes (community_touch) | `imported` | Faible | "Dofastuces — tableau communautaire" |
| Prix ressources/runes/équipements | `imported` (donnée vivante, pas de workflow de validation admin) | — | Saisie utilisateur directe |

---

# 7. Risque technique — Disponibilité de l'API DofusBook

L'API DofusBook ne présente actuellement aucune protection anti-bot identifiée et est consommée par appel HTTP direct avec pagination automatique. Ce point reste un risque de rupture (changement de l'API, blocage IP, évolution des conditions d'usage).

## Règles de conception obligatoires pour Codex

1. Le module d'import doit échouer proprement (logs, statut d'erreur explicite) sans jamais bloquer le reste de l'application si la source devient inaccessible.
2. Le format de contrat d'import (§3/§4) doit rester **découplé du mécanisme de récupération HTTP** : si une protection venait à apparaître, la bascule vers un import manuel par fichier (CSV/JSON) doit être possible sans changement du modèle de données ni du service de mapping — seule l'étape de récupération brute change.
3. La récupération brute (script de pagination HTTP) reste hors périmètre des règles métier Codex ; elle est gérée côté produit/porteur de projet, pas par les services métier eux-mêmes.

---

# 8. Règles non négociables — Import (rappel consolidé)

1. Ne jamais réintroduire DofApi comme source de données, sous quelque forme que ce soit.
2. Ne jamais importer les effets de type `"O"` (sorts d'objet) comme `item_effects` standards.
3. Toujours conserver le JSON brut d'import (équipements et runes) dans `import_records.raw_data_json` avant transformation.
4. Ne jamais traiter une saisie de prix utilisateur comme un import nécessitant validation admin.
5. Toujours distinguer runes `base` (usage brisage, critique V1) des runes `pa`/`ra` (forgemagie, données stockées mais non exploitées en V1) via l'attribut `rune_tier`.
6. Le module d'import équipements doit être résilient à une indisponibilité de l'API DofusBook (§7) sans jamais bloquer le reste de l'application.
7. Ne jamais écraser une correction manuelle existante lors d'un import sans confirmation explicite.
8. Conserver la donnée brute importée même après correction manuelle (historique complet).
9. Permettre de relancer un import sans casser la base locale existante.
