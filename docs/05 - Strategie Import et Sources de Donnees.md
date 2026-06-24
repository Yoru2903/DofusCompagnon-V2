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

**Anomalie réelle confirmée en import (Lot 2 correctif)** : `ingredients[].item_id` ne correspond pas systématiquement à un ID de ressource exploitable — il retourne fréquemment l'ID de l'équipement résultat lui-même, rendant la résolution par `item_id` non fiable. La clé de résolution et de génération des ressources déduites est donc **`ingredients[].name` normalisé** (insensible à la casse et aux accents), pas `item_id`. Le champ `item_id` source est conservé dans `raw_data_json` pour traçabilité mais ne doit pas être utilisé comme clé métier.

**Anomalie alias caractéristique Intelligence (découverte au correctif V1 final)** : DofusBook importe l'effet Intelligence sous `code = "in"`, alors que le référentiel runes utilise `code = "ine"`. Une migration de données a aligné les deux. À surveiller impérativement sur tout futur import ou ajout de caractéristique — toujours vérifier que le `code` de l'effet importé correspond exactement au `code` pivot dans `characteristics`, et ne pas supposer que le code DofusBook est canonique.

## Mapping vers le modèle de données

| Champ source | Destination |
|---|---|
| `id`, `name`, `level` | `items` |
| `category_id` / `category_name` | `item_types` |
| `cloth_id` / `cloth_name` | `items.panoply_name` |
| `effects[]` où `type = "E"` | `item_effects` (`characteristic_id` résolu via `effects[].name` = `characteristics.short_name`, `min_value`, `max_value`) |
| `effects[]` où `type = "O"` | **Ignoré en V1** — voir `03 - Modele de Donnees.md`, §13 |
| `ingredients[].name` (normalisé) | Clé de résolution/création des ressources déduites — voir §2 |
| `ingredients[].count` | `recipe_ingredients.quantity` |
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

# 7. Contrainte technique — Transport HTTP pour l'API DofusBook (arbitrée au Lot 2 correctif)

L'API DofusBook est protégée par Cloudflare, qui bloque systématiquement les requêtes émises via `fetch` (transport Undici de Node.js), même avec des headers identiques. La solution validée en production sur la V1 du projet et confirmée par diagnostic est l'utilisation de `node:https.get` (module natif Node.js).

## Règles de transport obligatoires pour Codex

**Transport** : `node:https.get` exclusivement. `fetch` et toute bibliothèque reposant sur Undici (axios par défaut en environnement Node récent, `node-fetch` v3+) sont **interdits** pour les appels vers `touch.dofusbook.net` — ils retournent systématiquement HTTP 403.

**Headers obligatoires** (validés en production) :

```text
User-Agent    : Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
                (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 DofusCompagnon/0.1
Accept        : application/json, text/plain, */*
Accept-Language : fr-FR,fr;q=0.9
Referer       : https://touch.dofusbook.net/
```

**Pagination** : paramètre `page` incrémenté depuis 1, arrêt sur page vide ou page partielle. Garde-fou à 500 pages maximum.

**Temporisation** : 500 ms entre chaque page (délai obligatoire, respectueux de la source).

**Timeout** : 20 secondes par requête.

**Redirections** : ne pas suivre automatiquement.

**Cookies/session** : aucun — l'API ne nécessite ni cookie ni session.

**Format de réponse attendu** : tableau JSON direct, ou objet avec clé `data`, `items`, ou `items.data` — le parser doit tester ces formes dans l'ordre.

**En cas de statut non-2xx** : lever une erreur typée (ex: `DOFUSBOOK_HTTP_<status>`), créer un `import_batches` en statut `failed` avec le statut HTTP dans `report_data`, ne pas lancer l'import métier, ne pas écrire en base.

## Alternative CSV (si l'API devient durablement inaccessible)

Des gabarits CSV sont disponibles dans `docs/csv-templates/` (`dofusbook-items.csv`, `dofusbook-effects.csv`) pour une collecte manuelle alternative. Le workflow métier d'import doit rester compatible avec ces gabarits sans modification du modèle de données.

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
