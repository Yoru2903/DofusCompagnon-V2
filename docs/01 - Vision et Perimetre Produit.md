# 01 — Vision et Périmètre Produit

## DofusCompagnon

---

# 1. Vision

DofusCompagnon est une application web modulaire d'aide à la décision pour **Dofus Touch**, centrée sur les aspects économiques du jeu : craft, brisage, achat-revente, suivi des prix HDV, historique des opérations et calculs de rentabilité.

Philosophie : **suivre, vérifier, calculer, décider.**

L'application doit d'abord fonctionner en local pour faciliter développement et tests, tout en étant conçue dès le départ pour une publication future à un groupe de joueurs, puis potentiellement à une communauté plus large.

---

# 2. Ambition long terme

Trajectoire cible :

1. Application locale personnelle.
2. Application partagée avec un groupe restreint de joueurs.
3. Application multi-utilisateur hébergée.
4. Potentiel outil communautaire public.

Cette ambition impose dès le socle (non négociable, voir `02 - Architecture Technique.md`) :

- une architecture modulaire ;
- une vraie base de données relationnelle ;
- une séparation claire des données globales / utilisateur / groupe ;
- une gestion des utilisateurs et des droits **fonctionnelle dès la V1** ;
- un historique des données économiques ;
- des règles strictes de fiabilité des données Dofus Touch ;
- une capacité d'import, de correction et de validation manuelle.

---

# 3. Règles fondamentales

## 3.1 Dofus Touch uniquement

Toutes les données métier doivent concerner Dofus Touch. Les données issues de Dofus PC ne sont jamais considérées comme valides par défaut. Une information ambiguë, absente ou issue d'une source non identifiée doit être marquée non vérifiée.

## 3.2 Fiabilité non présumée

Aucune donnée Dofus Touch n'est fiable par défaut. Chaque donnée importante porte :

- une source ;
- une date d'import ;
- une date de dernière vérification ;
- un statut de vérification ;
- un niveau de confiance ;
- un auteur ou validateur ;
- une éventuelle note de correction.

## 3.3 Validation finale humaine

L'application peut importer, suggérer ou comparer des données, mais la validation finale des données sensibles revient à l'utilisateur ou à un rôle autorisé. Une donnée importée n'est jamais validée automatiquement.

## 3.4 Traçabilité économique

Chaque action économique doit pouvoir être historisée. Une rentabilité calculée doit toujours pouvoir être reliée à ses hypothèses : prix utilisés, date des prix, quantité, taux de brisage, coût de craft, source du coût, utilisateur ou groupe concerné.

## 3.5 Modularité stricte

Chaque domaine métier est isolé autant que possible. Un module ne dépend jamais directement de l'implémentation interne d'un autre module. Communication via services, API ou modèles de données clairement définis.

---

# 4. Gestion des utilisateurs et droits

## 4.1 Rôles (V1 — granularité volontairement large)

| Rôle | Capacités |
|---|---|
| Admin | Gère utilisateurs, groupes, droits, données globales, imports |
| Contributeur | Ajoute/modifie/propose des données, saisit des prix, crée des sessions |
| Membre | Utilise les calculateurs, crée ses propres sessions, consulte les données du groupe |
| Lecture seule | Consulte uniquement les données autorisées |

**Décision explicite** : la granularité des permissions reste volontairement large en V1 (pas de matrice fine "qui peut modifier un prix vs qui peut ajouter un item"). La distinction entre rôles "super-utilisateur" et utilisateur classique sur des permissions précises sera réévaluée en fonction de la croissance réelle de l'outil et de ses usages observés — ne pas anticiper de schéma de permissions granulaire en V1.

## 4.2 Authentification — fonctionnelle dès la V1 (socle)

**Décision structurante** (corrige le positionnement initial "hors périmètre V1" du backlog d'origine) :

- Les tables `users`, `groups`, `memberships` et les rôles sont créées et actives dès le premier lot de développement.
- Les mécanismes techniques (hash de mot de passe, JWT, middleware d'authentification) sont développés et fonctionnels dès le premier lot — pas seulement préparés en théorie.
- En usage quotidien V1, l'application peut démarrer avec un **user et un groupe par défaut auto-connectés**, pour ne pas freiner le développement des modules métier avant que l'auth ne soit la priorité d'usage réel.
- Aucune migration de schéma ne doit être nécessaire pour activer l'authentification réelle (écran de login, inscription, sessions multiples) — il s'agit uniquement d'activer un comportement déjà codé.

### Valeurs figées (validées au Lot 1, ne pas redéfinir différemment)

| Paramètre | Valeur |
|---|---|
| Email user par défaut | `default@dofuscompagnon.local` |
| Username user par défaut | `default` |
| Rôle user par défaut | `admin` |
| Nom groupe par défaut | `Groupe par defaut` |
| Durée de validité JWT (TTL) | 7 jours |
| Stockage du secret JWT | Variable d'environnement `.env` (jamais commité — doit être présent dans `.gitignore`) |

Ces valeurs sont définitives pour la V1. Toute évolution (ex: TTL plus court en mode public) doit être actée ici avant implémentation.

---

# 5. Séparation des données

## 5.1 Données globales (décrivent le jeu)

items, recettes, ingrédients, effets, runes, caractéristiques, métiers, types d'objets, panoplies, sources de données. Communes à tous les utilisateurs.

## 5.2 Données utilisateur (activité personnelle)

sessions de craft, sessions de brisage, sessions de revente, stock personnel, favoris, préférences, prix saisis personnellement.

## 5.3 Données groupe (activité partagée)

prix HDV de référence, historique commun, données validées par le groupe, stock partagé, corrections proposées, recettes vérifiées par le groupe.

## 5.4 Données importées

Stockées séparément des corrections manuelles. Le système distingue : donnée brute importée / donnée corrigée / donnée validée / donnée rejetée / donnée obsolète.

---

# 6. Périmètre fonctionnel V1 — Définitif

## 6.1 Inclus en V1

- **Authentification fonctionnelle** (socle complet — voir §4.2)
- **Référentiel Dofus Touch** : items, recettes, métiers, sources, caractéristiques, effets, runes
- **Prix HDV** : saisie, historique, fraîcheur (ressources, runes base en priorité, équipements)
- **Moteur économique** : coût craft, valorisation runes, rentabilité, ROI, snapshots (voir `04`)
- **Craft** : sessions, calcul de coût, statistiques
- **Brisage** : sessions, runes obtenues, valorisation, rentabilité réelle (formule détaillée en `04`)
- **Achat-Revente complet** : achats, ventes, marges, historique, prévisionnel vs réalisé *(décision : remonté en V1, initialement hors périmètre dans le backlog d'origine)*
- **Stock complet** : ressources, runes, équipements, valorisation, mouvements *(décision : remonté en V1, initialement hors périmètre dans le backlog d'origine)*
- **Dashboard** : indicateurs, meilleures/pires opérations, filtres (période, métier, joueur, groupe)
- **Simulateur** : craft, brisage, comparaison d'items, sauvegarde

## 6.2 Hors V1 (confirmé)

- **Forgemagie** (usage fonctionnel des runes PA/PM/PO/RA) — les données de prix et de poids sont stockées dès la V1, mais aucun module de calcul/écran dédié à la forgemagie n'est développé
- **Import OCR HDV**, synchronisations externes automatisées
- **Import technique** depuis l'encyclopédie officielle Ankama (source non automatisable — consultation manuelle uniquement)
- **DofApi** — exclusion définitive, projet abandonné et obsolète, ne jamais réintroduire comme source sous quelque forme que ce soit
- **Administration avancée multi-groupe** (invitations, permissions fines au-delà des rôles de base du §4.1)
- **Matrice de permissions fine** par module (voir §4.1 — volontairement reportée)

## 6.3 Modes d'exposition à anticiper (sans développement immédiat)

- mode local ;
- mode réseau local ;
- mode hébergé privé ;
- mode hébergé public.

La V1 reste locale/groupe restreint, mais l'architecture ne doit jamais empêcher ces évolutions (voir `02`).

---

# 7. Principes UX

- mobile-first (plateforme principale d'usage, pendant les sessions de jeu) ;
- saisie rapide, peu de friction ;
- filtres efficaces ;
- recherche insensible à la casse et aux accents ;
- affichage clair des gains et pertes ;
- distinction systématique entre estimation et résultat réel ;
- signalement visible des données manquantes ou non vérifiées ;
- confirmation avant toute action destructive ;
- accès rapide aux modules fréquents.

---

# 8. Définition de réussite produit

Le produit est considéré comme réussi si :

- l'application fonctionne localement avec SQLite ;
- les données globales/utilisateur/groupe sont strictement séparées ;
- l'authentification est fonctionnelle et le modèle users/groups est actif ;
- les modules peuvent être ajoutés sans réécriture globale ;
- les imports ne détruisent jamais une correction manuelle ;
- les calculs critiques (moteur économique) sont testables indépendamment de l'interface ;
- l'interface reste utilisable sur mobile ;
- les évolutions vers un groupe ou un service hébergé restent possibles sans refonte.

---

# Principe directeur final

Toute décision produit doit être évaluée selon trois critères :

1. Est-ce que cela améliore la fiabilité des données ?
2. Est-ce que cela préserve l'évolutivité du projet ?
3. Est-ce que cela aide réellement le joueur à prendre une meilleure décision économique ?

Si une décision ne répond à aucun de ces trois critères, elle doit être remise en question.
