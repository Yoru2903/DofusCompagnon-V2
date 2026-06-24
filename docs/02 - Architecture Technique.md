# 02 — Architecture Technique

## DofusCompagnon

---

# 1. Principes techniques directeurs

## 1.1 Priorité à la maintenabilité

Lisibilité, découpage métier, simplicité de compréhension, réduction de la dette technique. Une solution légèrement moins performante mais plus maintenable est toujours privilégiée.

## 1.2 Priorité à l'évolutivité

Le mode local n'est qu'une première étape. Toute fonctionnalité doit être compatible avec : plusieurs utilisateurs, plusieurs groupes, plusieurs sources de données, un futur hébergement distant.

## 1.3 Priorité à la traçabilité

Toute donnée métier sensible doit être reliée à un utilisateur, une date, une source, un historique.

## 1.4 Priorité au mobile

L'application est utilisée pendant les sessions de jeu. Le mobile est la plateforme principale, le desktop un complément.

---

# 2. Stack technique (définitivement tranchée)

**Décision explicite** : ces choix ne sont plus ouverts à discussion, malgré leur statut antérieur de "décision ouverte" dans les documents sources d'origine.

## 2.1 Backend

- Node.js LTS
- **Fastify**
- TypeScript
- **Prisma ORM**
- SQLite

## 2.2 Frontend

- React
- Vite
- TypeScript
- React Router
- TanStack Query

**Note (arbitrée au Lot 6) :** le graphique d'évolution temporelle du Dashboard est implémenté en CSS pur (pas de librairie recharts ou équivalent). Ce choix a été retenu faute d'accès réseau lors du développement et s'avère suffisant pour le besoin V1. Ne pas remplacer par une librairie externe sans raison fonctionnelle avérée — la dépendance supplémentaire ne se justifie que si des besoins graphiques plus avancés apparaissent (graphiques interactifs complexes, multi-séries, export, etc.).

## 2.3 Base de données

SQLite pour les premières versions. Fichier unique, sauvegarde simple, faible administration, portable, compatible Prisma.

Migration future possible vers PostgreSQL si le projet devient un service public à plus grande échelle. **Aucune logique métier ne doit dépendre spécifiquement de SQLite.**

### Exception documentée — Workflow de migration (arbitrée au Lot 1)

Le moteur `prisma migrate dev` / `prisma migrate deploy` peut échouer avec une erreur `Schema engine error` non détaillée sur certains environnements (bug connu et récurrent côté outillage Prisma, indépendant de la validité du schéma). Lorsque ce cas se présente :

1. Le fichier de migration SQL généré par Prisma (`prisma/migrations/<horodatage>_<nom>/migration.sql`) reste la référence de schéma — il doit toujours être créé et versionné normalement, même si `migrate dev` échoue à l'appliquer.
2. Un script local d'application directe du SQL (ex: `backend/scripts/apply-sqlite-migrations.mjs`, exécuté via `npm run db:apply`) peut être utilisé en contournement, à condition de tracer correctement la table `_prisma_migrations` pour rester cohérent avec l'état attendu par Prisma.
3. Cette exception ne dispense pas de la règle générale (§14, règle 5 : *toute modification du schéma passe par migration Prisma*) — le fichier de migration Prisma reste systématiquement généré en premier ; seul le mécanisme d'application au moment du développement local est contourné si nécessaire.
4. Avant toute publication/déploiement hors environnement de développement local, la cause racine de l'échec `migrate dev`/`migrate deploy` doit être investiguée et résolue (vérifier version Prisma, régénération du client, réinstallation des binaires engine) — le contournement par script n'est pas destiné à devenir la méthode permanente de déploiement.

---

# 3. Architecture générale

## 3.1 Principe de couches

```text
Interface (React)
↓
API (Fastify)
↓
Services métier
↓
Repositories
↓
Prisma
↓
SQLite
```

Aucune couche ne contourne la couche inférieure. Aucun accès direct à la base depuis le frontend.

## 3.2 Centralisation de la logique métier

Toute règle métier est implémentée dans un service métier. Ne contiennent **jamais** de logique métier :

- composants React ;
- pages React ;
- routes API (contrôleurs Fastify) ;
- repositories ;
- schéma Prisma.

## 3.3 Architecture orientée domaine

L'organisation suit les domaines métier du jeu, pas les technologies.

Bon : module Craft, module Brisage, module Prix.
Mauvais : module SQL, module API, module Calculs.

---

# 4. Structure globale du projet

```text
dofuscompagnon/
├── backend/
├── frontend/
├── shared/
├── docs/
├── scripts/
└── backups/
```

## 4.1 Structure Backend

```text
backend/
├── src/
│   ├── modules/
│   ├── shared/
│   ├── infrastructure/
│   ├── database/
│   └── tests/
├── prisma/
├── package.json
└── tsconfig.json
```

Chaque module métier suit la même structure :

```text
modules/craft/
├── craft.routes.ts      → exposition API
├── craft.service.ts     → logique métier
├── craft.repository.ts  → accès aux données
├── craft.validator.ts   → validation des entrées
└── craft.types.ts       → définitions TypeScript
```

## 4.2 Structure Frontend

```text
frontend/
├── src/
│   ├── pages/        → assemblage d'écrans, aucune logique métier
│   ├── features/      → un espace par domaine métier
│   ├── components/    → composants génériques réutilisables
│   ├── services/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── layouts/
│   └── router/
```

Exemple feature :

```text
features/craft/
├── components/
├── hooks/
├── services/
└── types/
```

Composants génériques (Button, Modal, Table, SearchInput, Pagination, Card) : aucun ne dépend d'un module métier spécifique.

---

# 5. Modules fonctionnels de référence

| Module | Responsabilités |
|---|---|
| Core | utilisateurs, groupes, rôles, permissions, configuration |
| Données Dofus | items, recettes, métiers, effets, runes, sources, statuts de validation |
| Prix | prix ressources/runes/équipements, historique |
| Craft | sessions craft, calcul de coût, suivi de production |
| Brisage | suivi des brisages, résultats, valorisation |
| Simulateur | calculs prévisionnels, estimations, comparaisons |
| Achat-Revente | achats, ventes, marges, historique |
| Stock | suivi ressources/runes/équipements, valorisation |
| Dashboard | indicateurs, statistiques, synthèses |
| Import / Export | imports, exports, sauvegardes, restauration |

---

# 6. Moteur économique

Module indépendant. Centralise tous les calculs économiques (voir `04 - Regles Metier et Moteur Economique.md` pour les formules).

Doit pouvoir être utilisé par : Craft, Brisage, Simulateur, Achat-Revente, Dashboard.

**Ne doit dépendre ni du frontend, ni des routes, ni de Prisma, ni de SQLite.** Exécutable uniquement à partir d'objets métier, indépendamment du reste de l'application. Permet des calculs reproductibles et testables.

---

# 7. Gestion des dépendances entre modules

Les modules consomment des **services** exposés par d'autres modules, jamais leurs repositories internes.

Correct : `Prix → Service Craft`
Incorrect : `Prix → Repository Craft`

---

# 8. Gestion des identifiants

Toutes les entités métier possèdent : `id`, `created_at`, `updated_at`.

Lorsqu'applicable : `created_by`, `updated_by`, `validated_by`, `group_id`. Ces champs existent dès la première version, même en mode local avec utilisateur par défaut.

---

# 9. Gestion des erreurs

Format unique d'erreur API : `code`, `message`, `details`.

Les erreurs techniques ne sont jamais exposées directement à l'utilisateur. Les erreurs métier sont explicites.

Exemple correct : *"Prix HDV manquant pour cette ressource."*
Exemple incorrect : *"Undefined value."*

---

# 10. Validation des données

Toutes les entrées API sont validées. Aucune donnée utilisateur n'est considérée comme fiable par défaut. Validations centralisées dans les validators de chaque module.

---

# 11. Logs

Niveaux : info, warn, error.

À tracer : imports, validations, suppressions, erreurs critiques, opérations administrateur.

Les calculs métier standards ne doivent pas produire de logs excessifs.

---

# 12. Sécurité

## V1

- réseau local autorisé ;
- authentification **fonctionnelle** dès le socle (voir `01`, §4.2) — pas seulement préparée.

## Mode groupe (évolution ultérieure)

- authentification obligatoire renforcée ;
- séparation stricte des utilisateurs ;
- séparation données personnelles / groupe ;
- droits par rôle ;
- sauvegardes régulières.

## Mode public (non prioritaire, non bloqué)

- authentification robuste ;
- gestion fine des permissions ;
- protection contre les abus ;
- validation stricte des entrées ;
- logs complets ;
- réflexion sur hébergement et modèle économique.

---

# 13. Flux de données standard

```text
Utilisateur
↓
Interface React
↓
API Fastify
↓
Service métier
↓
Repository
↓
Prisma
↓
SQLite
```

Le retour suit le chemin inverse. Aucun accès direct à la base depuis le frontend.

---

# 14. Règles non négociables pour Codex

1. Aucun accès direct à Prisma depuis React.
2. Aucun calcul métier dans les composants.
3. Aucun calcul métier dans les routes Fastify.
4. Toute règle métier appartient à un service.
5. Toute modification du schéma passe par migration Prisma.
6. Toute suppression sensible doit être confirmée.
7. Toute fonctionnalité métier critique doit être testée (voir `06`, critères de validation par lot).
8. Aucun couplage direct entre modules métier (repositories internes jamais exposés).
9. Préférer les services réutilisables.
10. Préserver la compatibilité mobile.
11. Codex ne commence jamais par développer un écran avant que les couches métier et données ne soient stabilisées.

## Ordre de développement recommandé (par fonctionnalité)

1. Modèle métier
2. Schéma Prisma
3. Migration base de données
4. Repository
5. Service métier
6. API
7. Frontend
8. Tests
9. Documentation

---

# 15. Définition de réussite technique

- l'application démarre localement ;
- SQLite est opérationnel, Prisma configuré ;
- React communique avec Fastify ;
- le modèle utilisateur/groupe existe et l'authentification est active ;
- les migrations fonctionnent ;
- un nouveau module métier peut être ajouté sans modifier l'architecture existante ;
- le moteur économique est développable et testable indépendamment de l'interface ;
- 80% de couverture de tests minimum sur les services métier critiques (moteur économique, calculs de rentabilité, calculs de brisage, calculs d'achat-revente, imports). Les composants React ne sont pas prioritaires pour la couverture de tests.
