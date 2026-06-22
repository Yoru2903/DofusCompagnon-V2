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

