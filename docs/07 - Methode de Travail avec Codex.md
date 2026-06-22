# 07 — Méthode de Travail avec Codex

## DofusCompagnon

---

# 1. Principe général

Ce corpus est la seule source de vérité. Un prompt d'exécution envoyé à Codex ne redéfinit **jamais** une règle métier de mémoire — il **référence** les documents et sections concernées de ce corpus.

```text
Mauvais prompt : "Crée le module brisage. Une rune correspond à une carac,
le calcul c'est poids × taux / pwr..."
   → règle reformulée de mémoire = risque de divergence avec le corpus

Bon prompt : "Développe le Lot 4 (Craft et Brisage) tel que défini dans
06 - Backlog et Plan d'Execution.md, §5. Le calcul de brisage doit suivre
exactement la formule décrite dans 04 - Regles Metier et Moteur Economique.md, §3.
Le modèle de données est celui de 03 - Modele de Donnees.md, §9.2."
   → le corpus reste l'unique référence, aucune reformulation
```

---

# 2. Structure type d'un prompt d'exécution par lot

1. **Référence au lot** : numéro et nom du lot dans `06 - Backlog et Plan d'Execution.md`
2. **Documents à consulter** : liste explicite des fichiers/sections du corpus concernés
3. **Périmètre exact** : ce qui est inclus / exclu pour ce lot précis (éviter qu'un lot déborde sur le suivant)
4. **Critères d'acceptation** : copiés ou référencés depuis `06`
5. **Format de rapport attendu** : Codex doit produire un rapport d'exécution détaillé (voir §4)

---

# 3. Règle de mise à jour du corpus

Toute ambiguïté découverte pendant le développement (par Codex ou par le porteur de projet) doit être :

1. Tranchée explicitement par le porteur de projet ;
2. **Reversée dans le corpus** (fichier et section concernés) avant de poursuivre le développement du lot ou de passer au suivant ;
3. Jamais simplement répondue à l'oral/au fil de la conversation sans mise à jour écrite.

Objectif : qu'un même cas rencontré une deuxième fois (par Codex ou par un autre outil/contributeur) ne soit jamais retranché différemment faute de mémoire.

## Exemple de processus suivi dans ce projet

- Ambiguïté détectée : positionnement runes PA/PM dans le calcul de brisage
- Recherche et arbitrage : formule générale appliquée, confiance marquée basse
- Mise à jour corpus : `04 - Regles Metier et Moteur Economique.md`, §3.2
- Tout prompt futur concernant le brisage référence cette section, sans avoir besoin de redécouvrir ou rediscuter la règle

---

# 4. Rapport d'exécution Codex — Format attendu

Pour chaque lot livré, Codex doit produire un rapport incluant au minimum :

- Liste des fichiers créés/modifiés
- Résultat des tests automatisés (passants/échouants, couverture obtenue)
- Écarts éventuels constatés entre la demande et l'implémentation réelle, avec justification
- Ambiguïtés rencontrées pendant le développement n'ayant pas de réponse explicite dans le corpus (à remonter au porteur de projet pour arbitrage avant de considérer le lot terminé)

Le porteur de projet relit ce rapport, effectue ses propres tests fonctionnels d'intégration, et confirme ou non la clôture du lot (voir `06`, §1).

---

# 5. Granularité de vérification

- **Tests automatisés** : vérifient la correction technique et la non-régression (responsabilité Codex, exécutés à chaque lot)
- **Tests fonctionnels d'intégration** : vérifient l'adéquation au besoin réel (responsabilité du porteur de projet, sur demandes d'intégration concrètes)
- Le porteur de projet transmet le retour des tests fonctionnels et des rapports Codex pour ajustement itératif avant validation finale du lot

---

# 6. Anti-patterns à éviter

- ❌ Envoyer un prompt isolé par "sprint" sans référence au corpus, en reformulant les règles de mémoire
- ❌ Laisser une règle métier divergente entre deux conversations sans la consolider dans le corpus
- ❌ Démarrer un nouveau lot avant la clôture vérifiée du précédent (sauf décision explicite)
- ❌ Accepter un résultat de calcul économique sans tests automatisés sur les cas limites (`04`, §9)
- ❌ Permettre à Codex de développer un écran avant que les couches métier et données du lot ne soient stabilisées (`02`, §14)
