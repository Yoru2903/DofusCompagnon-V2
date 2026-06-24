# DofusCompagnon — Corpus de Référence Projet

### Version 2.0 — Fusion complète, document unique faisant foi

---

# À lire en premier

Ce corpus **remplace intégralement** les 5 documents sources précédents (CDC Socle, CDC Technique, Architecture, MLD, Backlog Produit) ainsi que le document correctif intermédiaire ("Prompt Consolidé v1"). Il n'existe plus de contradiction à résoudre entre plusieurs documents : **ce corpus est la seule source de vérité.**

Les 5 documents sources restent archivés pour l'historique des décisions, mais ne doivent plus être utilisés comme référence de travail — en cas de divergence, ce corpus prévaut systématiquement.

---

# Structure du corpus

| Fichier | Contenu |
|---|---|
| `00 - Sommaire et Guide d'Usage.md` | Ce document — navigation et méthode de travail |
| `01 - Vision et Périmètre Produit.md` | Vision, ambition, périmètre fonctionnel V1/hors V1, règles fondamentales |
| `02 - Architecture Technique.md` | Stack, structure projet, principes architecturaux, conventions Codex |
| `03 - Modele de Donnees.md` | MLD complet, à jour, avec tous les compléments (runes, panoplies, bonus) |
| `04 - Regles Metier et Moteur Economique.md` | Formules de calcul (craft, brisage, runes), règles de fiabilité des données |
| `05 - Strategie Import et Sources de Donnees.md` | Sources retenues/exclues, contrats d'import détaillés, risques |
| `06 - Backlog et Plan d'Execution.md` | Lots de développement vérifiables, ordre d'exécution, critères de validation |
| `07 - Methode de Travail avec Codex.md` | Comment formuler un prompt d'exécution à partir de ce corpus, processus de mise à jour |

---

# Méthode de travail (rappel)

1. **Ce corpus est mis à jour en continu.** Toute ambiguïté tranchée pendant le développement doit être reversée ici avant de poursuivre — jamais juste répondue à l'oral puis oubliée.
2. **Aucun prompt d'exécution ne doit redéfinir une règle métier de mémoire.** Un prompt pointe vers le fichier et la section concernés de ce corpus.
3. **Le développement avance par lots vérifiables** (voir `06 - Backlog et Plan d'Execution.md`), pas par sprint temporel figé. Un lot n'est considéré terminé qu'après tests automatisés passants + rapport d'exécution Codex relu.
4. **Toute donnée Dofus Touch importée porte un statut de fiabilité explicite.** Rien n'est présumé vérifié par défaut (voir `04` et `05`).

---

# Historique des versions

- **v1.0** — 5 documents sources indépendants (CDC Socle, CDC Technique, Architecture, MLD, Backlog), contenant des contradictions non résolues (nom du projet, périmètre auth/achat-revente/stock, stack technique, positionnement runes/caractéristiques).
- **v1.5** — Document correctif "Prompt Consolidé" tranchant les contradictions, sans fusion physique des documents.
- **v2.0** — Fusion complète. Intègre en plus : formule de calcul de brisage (avec traitement spécifique PA/PM/PO en confiance basse), contrat d'import détaillé équipements/runes basé sur données bêta réelles, méthode de travail Codex par lots vérifiables.
- **v2.1** — Arbitrages issus du rapport d'exécution du Lot 1 (Socle technique et authentification) : valeurs figées du user/groupe par défaut et paramètres JWT (`01`, §4.2), type `String` validée pour les champs énumération Prisma (`03`, §2), exception documentée sur le workflow de migration Prisma (`02`, §2.3).
- **v2.2** — Arbitrages issus du rapport d'exécution du Lot 2 (Référentiel Dofus Touch) : règle générale `deleted_at` pour la suppression logique (`03`, §1.1), URL concrète de l'API DofusBook Touch figée dans le corpus (`05`, §1).
- **v2.3** — Contrainte technique transport HTTP DofusBook documentée et figée (`05`, §7) : `node:https.get` obligatoire, `fetch`/Undici interdits (blocage Cloudflare confirmé), headers et paramètres de pagination validés en production.
- **v2.4** — Anomalie `ingredients[].item_id` documentée et corrigée (`05`, §3) : clé de résolution des ressources déduites = `ingredients[].name` normalisé (pas `item_id`). Import réel validé : 2440 équipements, 1118 ressources, 1662 recettes, 9205 lignes d'ingrédients, 13160 effets, 0 erreur.
- **v2.5** — Arbitrages issus du Lot 3 (Prix et Moteur Économique) : sémantique des 3 scopes de prix (`personal`/`group`/`global`) et seuil de fraîcheur des prix figé à 7 jours (`03`, §7). Isolation des tests sur `test.db` actée comme bonne pratique à pérenniser.
- **v2.6** — Arbitrages issus du Lot 4 (Craft et Brisage) : `poids_unitaire_de_la_caracteristique` = `rune_characteristics.weight` (même valeur que `pwr_rune_base`, seule donnée disponible en l'absence de source officielle — `04`, §3.1). Dette UX connue : saisie par IDs sans autocomplete catalogue, à traiter au Lot 6.
- **v2.7** — Arbitrages issus du Lot 5 (Achat-Revente et Stock) : taux de frais HDV par défaut fixé à 2% (`fee_rate = 0.02`), configurable par ligne (`03`, §9.3). Configuration LAN validée : Vite + Fastify écoutent sur `0.0.0.0`, proxy `/api` configuré, `start.bat` disponible.
- **v2.8 (finale V1)** — Arbitrages issus du Lot 6 (Dashboard, Simulateur, Refonte UX) : graphique dashboard en CSS pur, pas de librairie externe (`02`, §2.2). Règle dashboard craft = dépense réalisée, gain 0 tant que l'item n'est pas vendu ou brisé (`04`, §6). Dette UX soldée : autocomplete sur 6 modules, navigation cohérente, signaux visuels prix stale/données non vérifiées.
- **v2.9 (correctif V1 final)** — Deux anomalies de données découvertes et corrigées : (1) alias caractéristique Intelligence : `code = "in"` dans DofusBook, `code = "ine"` dans le référentiel runes — migration de données appliquée, à surveiller sur tout futur import ou ajout de caractéristique. (2) `taux_brisage` doit toujours être transmis en décimal (0.6 pour 60%) — ne jamais transmettre la valeur entière (60). Ajout de `craft_session_lines.status` (`active`/`broken`) pour tracer les lignes de craft utilisées en brisage.

---

# Backlog V2 — Référence synthétique

## UX / Interface globale
- Labels explicites sur tous les champs de formulaire (quantité, taux de brisage, coût unitaire, etc.) — actuellement beaucoup de champs sont posés sans titre dans les formulaires
- Refonte page Prix : tableau avec recherche, fiche item détaillée, zone de saisie de prix inline, graphique d'évolution historique
- Détail des simulations sauvegardées cliquable (historique simulateur)
- Heure affichée sur l'historique des simulations
- Édition et suppression d'une session (craft, brisage, trade)
- Autocomplétion dans des cas particuliers à identifier une fois les nouvelles interfaces V2 en place

## Craft
- Filtre autocomplete limité aux équipements craftables uniquement (exclure ressources, runes)

## Brisage
- Remplissage automatique item/quantité/coût depuis la ligne craft sélectionnée
- Valeur par défaut runes = quantité calculée par le moteur (nécessite `taux_brisage` saisi)
- Filtre autocomplete limité aux équipements brisables

## Stock
- Refonte complète : affichage des emplacements créés et de leur contenu
- Valorisation du stock par emplacement (prix des lots)
- Cohérence des mouvements automatiques (craft in, brisage out/in, trade out)

## Simulateur
- Simulation craft : affichage du détail des ingrédients et de leur prix dans les résultats

## Dashboard
- Filtres par métier et par joueur/groupe
- Statistiques avancées (graphiques multi-séries, export)

## Technique / Architecture
- Résolution `prisma migrate dev` (remplacer le contournement `db:apply` par le workflow standard)
- Authentification complète activée : écran de login, inscription, sessions multiples
- Gestion avancée multi-groupe : invitations, interface d'administration fine
- Matrice de permissions fine par module
- Module Forgemagie : calcul et écrans dédiés aux runes PA/RA

## Données / Import
- Vérification manuelle des 81 runes `community_touch` (statut `imported` → `verified`)
- Vérification des alias de caractéristiques DofusBook vs référentiel runes (suite à `in`/`ine`)
- Calibrage empirique de la formule PA/PM/PO à partir des données réelles accumulées

