# 06 — Backlog et Plan d'Exécution

## DofusCompagnon

---

# 1. Principe de découpage

Le développement avance par **lots vérifiables**, pas par sprint temporel figé. Un lot regroupe un ensemble cohérent de tables + services + tests, livrable et contrôlable indépendamment, dans l'ordre de dépendance technique défini en `02 - Architecture Technique.md` (§14 : Modèle métier → Schéma Prisma → Migration → Repository → Service → API → Frontend → Tests → Documentation).

**Un lot n'est considéré terminé qu'après :**
1. Tests automatisés passants (couverture conforme à `02`, §15) ;
2. Rapport d'exécution détaillé de Codex relu par le porteur de projet ;
3. Tests fonctionnels du porteur de projet sur les critères d'acceptation du lot.

Aucun lot suivant ne démarre tant que le précédent n'est pas validé selon ces trois critères, sauf décision explicite contraire du porteur de projet.

---

# 2. Lot 1 — Socle technique et authentification

## Contenu technique
- Initialisation backend Fastify + frontend React/Vite + TypeScript, ESLint, Prettier
- Prisma + SQLite + première migration
- Architecture modulaire (modules/shared/infrastructure/database/tests)
- Infrastructure de tests (Vitest)
- Tables : `users`, `groups`, `memberships`
- Authentification fonctionnelle : hash mot de passe, JWT, middleware (voir `01`, §4.2)
- User et groupe par défaut auto-connectés pour le développement courant

## Critères d'acceptation
- Le backend démarre, le frontend démarre, les deux communiquent
- Base de données créée automatiquement, migrations fonctionnelles
- Architecture conforme à `02`
- Les tests s'exécutent correctement
- Un utilisateur peut être créé, authentifié, et un JWT valide est délivré

---

# 3. Lot 2 — Référentiel Dofus Touch

## Contenu technique
- Tables : `data_sources`, `item_types`, `jobs`, `items`, `recipes`, `recipe_ingredients`, `characteristics`, `item_effects`, `rune_characteristics`
- Service d'import équipements depuis API DofusBook (voir `05`, §3)
- Génération dérivée automatique des ressources (voir `05`, §2)
- Import du référentiel runes depuis fichier JSON (voir `05`, §4)
- Statuts de vérification appliqués selon `05`, §6

## Critères d'acceptation
- CRUD complet sur items, recettes, métiers, sources
- Import équipements fonctionnel, avec conservation du JSON brut (`import_records`)
- Ressources générées automatiquement et correctement marquées `imported`/confiance faible
- 83 runes importées avec `rune_tier` et statuts de fiabilité corrects (2 `verified`, 81 `imported`)
- Recherche insensible à la casse et aux accents opérationnelle

---

# 4. Lot 3 — Prix et Moteur Économique

## Contenu technique
- Table : `price_snapshots`, `economic_snapshots`
- Service de saisie de prix (flux utilisateur direct, voir `05`, §5)
- Moteur économique indépendant : coût craft, valorisation runes, calcul de brisage (avec cas PA/PM/PO, voir `04`, §3), rentabilité, ROI
- Historique et fraîcheur des prix

## Critères d'acceptation
- Saisie de prix fonctionnelle (ressource, rune, équipement), historisée
- Moteur économique testable indépendamment de l'interface, couverture ≥ 80%
- Formule de brisage validée sur cas nominal + cas limites (taux 0%/100%, donnée non vérifiée, effet spécial)
- Snapshots économiques conservant prix/quantités/dates utilisés pour chaque calcul

---

# 5. Lot 4 — Craft et Brisage

## Contenu technique
- Tables : `craft_sessions`, `craft_session_lines`, `craft_session_ingredients`, `breaking_sessions`, `breaking_session_lines`, `breaking_results`
- Écrans de session craft (création, ajout items, calcul coût réel, historique, statistiques)
- Écrans de session brisage (création, objets brisés, runes obtenues, valorisation, rentabilité réelle)

## Critères d'acceptation
- Une session de craft complète peut être créée, calculée, historisée
- Une session de brisage complète peut être créée, avec calcul de runes obtenues conforme à `04`, §3
- Distinction prévisionnel/réalisé visible et correcte

---

# 6. Lot 5 — Achat-Revente et Stock

## Contenu technique
- Tables : `trade_sessions`, `trade_lines`, `stock_locations`, `stock_movements`
- Écrans achat-revente (achats, ventes, marges, prévisionnel vs réalisé)
- Écrans stock (suivi ressources/runes/équipements, valorisation, mouvements)

## Critères d'acceptation
- Une session d'achat-revente complète peut être créée et suivie jusqu'à la vente réalisée
- Le stock reflète les mouvements liés aux sessions craft/brisage/trade
- Marge brute et nette calculées correctement

---

# 7. Lot 6 — Dashboard et Simulateur

## Contenu technique
- Dashboard : indicateurs globaux, meilleures/pires opérations, filtres (période, métier, joueur, groupe)
- Simulateur : craft, brisage, comparaison d'items, sauvegarde (`simulations`)

## Critères d'acceptation
- Dashboard affichant des données réelles issues des lots précédents, distinguant réalisé/prévisionnel
- Simulateur capable de produire une estimation sans nécessiter d'opération réelle préalable
- Simulations sauvegardables et consultables

---

# 8. Hors périmètre (rappel — voir `01`, §6.2)

Non planifiés dans cette suite de lots :
- Forgemagie fonctionnelle
- Import OCR HDV / synchronisations externes
- Import technique encyclopédie officielle
- Administration avancée multi-groupe
- Matrice de permissions fine

Ces éléments pourront faire l'objet de nouveaux lots ultérieurs, avec mise à jour préalable du corpus de référence (notamment `01` et `04`).

---

# 9. Processus de validation par lot (rappel méthode)

Voir `07 - Methode de Travail avec Codex.md` pour le détail du processus : formulation du prompt d'exécution, lecture du rapport Codex, remontée des écarts au corpus de référence avant de poursuivre.
