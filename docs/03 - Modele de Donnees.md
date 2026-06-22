# 03 — Modèle de Données

## DofusCompagnon

---

# 1. Principe directeur

Toutes les entités manipulées dans le jeu reposent sur une unique entité centrale : `Item`.

Une ressource, une rune, un équipement ou un objet revendable sont tous des Items.

```text
Bave de Bouftou   → Item
Rune Pa Vi        → Item
Bottes Bouftou    → Item
```

---

## 1.1 Règle générale — Suppression logique (arbitrée au Lot 2)

Toute entité supportant une suppression logique (c'est-à-dire dont la suppression n'est pas physique en base mais masquée côté application) doit porter un champ `deleted_at` (timestamp nullable). Une entité est considérée comme supprimée logiquement si `deleted_at IS NOT NULL`.

Cette règle s'applique à toutes les entités du référentiel Dofus Touch et aux entités métier principales. Les tables de liaison ou d'historique pures (ex: `import_records`, `price_snapshots`, `breaking_results`) n'ont pas vocation à être supprimées logiquement — supprimer leur ligne parente est suffisant.

En pratique pour ce modèle, les entités portant `deleted_at` sont au minimum : `items`, `recipes`, `item_types`, `jobs`, `data_sources`, `craft_sessions`, `breaking_sessions`, `trade_sessions`, `stock_locations`.

Aucun champ `is_deleted` booléen ne doit être utilisé à la place — `deleted_at` est le standard retenu pour permettre d'interroger facilement la date de suppression.

---

# 2. Core Utilisateurs

```text
users
- id
- username
- display_name
- email
- password_hash
- is_active
- created_at
- updated_at

groups
- id
- name
- description
- created_by
- created_at
- updated_at

memberships
- id
- user_id
- group_id
- role            → admin | contributor | member | readonly
- created_at
- updated_at
```

**Précision technique (arbitrée au Lot 1)** : le champ `role` est implémenté en `String` côté schéma Prisma (et non en enum natif Prisma), avec validation stricte des valeurs autorisées centralisée dans le service métier (`core.service.ts` ou équivalent), conformément au principe d'indépendance vis-à-vis de SQLite (`02 - Architecture Technique.md`, §2.3 : aucune logique métier ne doit dépendre spécifiquement de SQLite). Ce choix facilite la portabilité future vers PostgreSQL sans contrainte de migration d'enum. Cette règle s'applique à tout futur champ de type énumération du modèle (ex: `verification_status`, `price_type`, `scope`, `snapshot_type`, `rune_tier`) sauf décision contraire explicitement actée.

---

# 3. Référentiel Dofus Touch

```text
item_types
- id
- name
- category
- created_at
- updated_at

jobs
- id
- name
- created_at
- updated_at

items
- id
- name
- level
- item_type_id
- job_id
- is_craftable
- is_rune
- is_resource
- rune_tier              → NOUVEAU : 'base' | 'pa' | 'ra' | null (null si non-rune)
- panoply_name            → NOUVEAU : référence simple à la panoplie (texte, voir §10.2)
- verification_status     → imported | draft | verified | corrected | rejected | obsolete
- confidence_level
- source_id
- created_by
- updated_by
- validated_by
- validated_at
- created_at
- updated_at
```

---

# 4. Sources et Imports

```text
data_sources
- id
- name
- url
- source_type
- reliability_level
- created_at
- updated_at

import_batches
- id
- source_id
- imported_by
- status
- raw_file_name
- notes
- imported_at
- created_at

import_records
- id
- import_batch_id
- entity_type
- external_ref
- raw_data_json       → JSON brut conservé avant toute transformation (obligatoire)
- proposed_data_json
- status
- reviewed_by
- reviewed_at
- created_at
```

---

# 5. Recettes

```text
recipes
- id
- result_item_id
- job_id
- version
- verification_status
- confidence_level
- source_id
- created_by
- updated_by
- validated_by
- validated_at
- created_at
- updated_at

recipe_ingredients
- id
- recipe_id
- ingredient_item_id
- quantity
- created_at
- updated_at
```

---

# 6. Caractéristiques et Effets

```text
characteristics
- id
- code             → NOUVEAU/PRÉCISÉ : clé pivot stable (ex: "vi", "fo", "sa"), partagée entre les 3 tiers de runes d'une même caractéristique
- name
- short_name
- created_at
- updated_at

item_effects
- id
- item_id
- characteristic_id
- min_value
- max_value
- fixed_value
- verification_status
- source_id
- created_at
- updated_at

rune_characteristics
- id
- rune_item_id
- characteristic_id
- weight              → poids de forgemagie (correspond à `pwr` dans les sources d'import)
- bonus_value          → NOUVEAU : valeur fixe apportée par la rune (correspond à `bonus` dans les sources d'import) — absent du modèle initial, requis pour le calcul de brisage
- is_special           → NOUVEAU : flag booléen, vrai si l'effet n'est pas un delta numérique standard (ex: Invocation, Portée) — traitement prudent requis dans le moteur de calcul
- created_at
- updated_at
```

**Important** : `characteristics`, `item_effects` et `rune_characteristics` sont positionnées en priorité de développement avec le référentiel de base (voir `06 - Backlog et Plan d'Execution.md`), car nécessaires dès le calcul de rentabilité de brisage. Elles ne constituent pas un module "avancé" différable.

---

# 7. Historique des Prix

```text
price_snapshots
- id
- item_id
- unit_price
- lot_size
- total_price
- price_type      → resource | rune | item | resale
- scope           → personal | group | global
- user_id
- group_id
- source_id
- observed_at
- created_at
```

Note d'usage : une entrée `price_snapshots` créée par une saisie utilisateur en jeu n'est **jamais** un import au sens du §4 — c'est un flux direct, sans étape `import_batches`/`import_records` (voir `05 - Strategie Import et Sources de Donnees.md`, §5).

---

# 8. Snapshots Économiques

```text
economic_snapshots
- id
- user_id
- group_id
- snapshot_type    → craft_calculation | breaking_calculation | resale_calculation | simulation
- data_json
- created_at
```

---

# 9. Sessions Métier

## 9.1 Craft

```text
craft_sessions
- id
- user_id
- group_id
- name
- session_date
- notes
- created_at
- updated_at

craft_session_lines
- id
- craft_session_id
- item_id
- recipe_id
- quantity
- unit_cost
- total_cost
- cost_source
- economic_snapshot_id
- created_at
- updated_at

craft_session_ingredients
- id
- craft_session_line_id
- ingredient_item_id
- quantity
- unit_price
- total_price
- price_snapshot_id
- created_at
```

## 9.2 Brisage

```text
breaking_sessions
- id
- user_id
- group_id
- name
- session_date
- notes
- created_at
- updated_at

breaking_session_lines
- id
- breaking_session_id
- item_id
- quantity
- unit_cost
- total_cost
- source_craft_line_id
- economic_snapshot_id
- created_at
- updated_at

breaking_results
- id
- breaking_session_line_id
- rune_item_id
- quantity
- unit_price
- total_value
- price_snapshot_id
- created_at
```

## 9.3 Achat-Revente

```text
trade_sessions
- id
- user_id
- group_id
- name
- session_date
- notes
- created_at
- updated_at

trade_lines
- id
- trade_session_id
- item_id
- quantity
- unit_buy_price
- total_buy_price
- expected_unit_sell_price
- expected_total_sell_price
- actual_unit_sell_price
- actual_total_sell_price
- fees
- status
- economic_snapshot_id
- created_at
- updated_at
```

---

# 10. Stock

```text
stock_locations
- id
- name
- scope         → personal | group
- user_id
- group_id
- created_at
- updated_at

stock_movements
- id
- stock_location_id
- item_id
- movement_type
- quantity
- unit_value
- total_value
- related_entity_type
- related_entity_id
- notes
- created_by
- created_at
```

## 10.2 Panoplies (référence simple, non relationnelle en V1)

**Décision** : la panoplie n'est pas une donnée économique. Elle est stockée uniquement à des fins de recherche/filtrage, sans gestion des bonus de panoplie en V1.

Implémentation retenue : champ texte simple `items.panoply_name` (voir §3). Pas de table `panoplies` dédiée en V1.

---

# 11. Simulations

```text
simulations
- id
- user_id
- group_id
- simulation_type
- item_id
- quantity
- result_json
- economic_snapshot_id
- created_at
```

---

# 12. Journal de Validation

```text
validation_logs
- id
- entity_type
- entity_id
- action
- previous_status
- new_status
- user_id
- notes
- created_at
```

---

# 13. Effets exclus du modèle V1

Les **effets spéciaux d'objet** (sorts déclenchés liés à un objet/panoplie, type `"O"` dans la source API DofusBook, ex: "Bouclier Inébranlable") **ne sont pas modélisés en V1**. Ce ne sont pas des `item_effects` au sens du modèle (pas de `characteristic_id`/`min_value`/`max_value` numériques exploitables).

Si un besoin futur apparaît, une table dédiée (ex: `item_special_effects`) devra être créée — ne pas anticiper ce schéma en V1.

---

# 14. Index de référence rapide — Statuts et énumérations

```text
verification_status : imported | draft | verified | corrected | rejected | obsolete
role (memberships)   : admin | contributor | member | readonly
price_type            : resource | rune | item | resale
scope (price/stock)   : personal | group | global
snapshot_type          : craft_calculation | breaking_calculation | resale_calculation | simulation
rune_tier (items)      : base | pa | ra
```
