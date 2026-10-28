# Roadmap produit complète — Neighbors Live

**Mise à jour :** 27 octobre 2026  
**Statut :** propositions à prioriser ; les idées ne sont pas annoncées comme déjà implémentées.

Cette roadmap complète la [roadmap contenu et UX](../roadmap.md) et la [roadmap vidéo](../roadmap.video.md). Elle traduit les parcours déjà présents dans l’application et le retour sur la visibilité des actions dans le feed mobile en étapes livrables. Les horizons sont relatifs à la décision de démarrer chaque phase ; ce ne sont pas des engagements de date.

## Vision

Neighbors Live aide les habitants à comprendre ce qui se passe à proximité grâce à des vidéos locales courtes, utiles et modérées. Chaque nouveauté doit faciliter la découverte, la contribution ou la confiance sans pousser au partage excessif de la position ni transformer l’app en fil social à engagement artificiel.

### Principes de décision

1. Une action doit avoir un bénéfice local compréhensible et un résultat visible.
2. Les commandes essentielles restent visibles et atteignables sur téléphone, au-dessus des barres système et de navigation.
3. La position exacte ne devient jamais publique et aucun historique de déplacement n’est ajouté pour mesurer l’usage.
4. Les alertes restent des informations communautaires, pas des informations garanties ni un service d’urgence.
5. Les nouvelles interactions nécessitant un état partagé incluent dès le départ API, droits RLS, limites d’abus, traductions et états d’erreur.
6. Prioriser la fiabilité et la lisibilité avant les mécaniques de croissance ou une refonte visuelle étendue.

## Priorités

| Niveau                     | Sens                                                                | Règle de lancement                                    |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| **P0 — Bloquant**          | Sécurité, actions invisibles, publication ou modération peu fiables | Résoudre avant d’élargir l’usage public               |
| **P1 — Cœur d’usage**      | Découverte, actions feed, capture et alertes compréhensibles        | Construire après validation du besoin et des parcours |
| **P2 — Valeur récurrente** | Personnalisation locale, accessibilité avancée, utilité commerçante | Lancer par petites expériences mesurées               |
| **P3 — Exploration**       | Fonctions ambitieuses ou coûteuses sans preuve de demande           | Prototype ou recherche seulement                      |

Les efforts S/M/L désignent une taille relative, pas un engagement de calendrier.

## Phase 0 — rendre le feed mobile utilisable et vérifiable (P0)

**Résultat attendu :** les cinq commandes du feed restent visibles sur les petits écrans et les changements récents sont validés sur un navigateur réel.

| Action                 | Proposition concrète                                                                                                                                       | Taille | Critère d’acceptation                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Rail d’actions mobile  | Garder **Utile**, **Commenter**, **Partager**, **Signaler** et **Son** au-dessus de la vidéo et des barres système ; icône, libellé et état actif lisibles | S      | Chaque commande est visible et activable au viewport mobile étroit, sans chevauchement du texte ni de la navigation |
| Surface glass          | Unifier filtres, métadonnées et commandes en verre sombre translucide avec contraste mesuré, contour léger et fallback opaque                              | S/M    | Texte et icônes restent lisibles sur vidéo claire et sombre ; désactivation du flou n’enlève aucune information     |
| Lisibilité vidéo       | Garder l’image entière et remplir les bandes par un arrière-plan flouté ; ne pas étirer la vidéo                                                           | S      | Ratio et cadrage d’origine conservés ; contrôles non masqués                                                        |
| Zones tactiles         | Cibles d’au moins 44 × 44 px, marge au bord droit, prise en compte de `safe-area-inset-bottom`                                                             | S      | Toutes les commandes principales fonctionnent à une main sur petit écran                                            |
| Vérification visuelle  | Revoir Accueil, Découvrir, carte, capture et feed dans les tailles mobile usuelles et avec texte agrandi                                                   | M      | Captures et écarts documentés ; ne pas déclarer la correction « vérifiée » à partir d’un typecheck seul             |
| Publication résiliente | Valider la réservation idempotente et la reprise TUS après perte réseau ou réponse tardive                                                                 | M      | Une seule publication est créée après reprise ; état et erreur sont compréhensibles                                 |
| Cache et session       | Vérifier navigation hors ligne, déconnexion et changement de compte avec le service worker                                                                 | M      | Aucun contenu privé ne réapparaît depuis le cache après déconnexion ou changement de session                        |

**État au 27 octobre 2026 :** rail mobile compacté et cibles tactiles conservées ; typecheck, lint et Prettier passent. La revue visuelle locale n’a pas pu démarrer (binding SWC natif indisponible, caches SWC refusés). Idempotence et cache privé réseau-seul sont déjà implémentés, mais leurs parcours restent à valider en base, après perte réseau et après déconnexion. Consulter [docs/PROGRESS.md](./PROGRESS.md) pour le détail des limites.

**Dépendances importantes :** la migration d’idempotence ajoutée le 27 octobre doit encore être appliquée/validée côté base et le parcours doit être vérifié. Le rendu mobile récent est codé, mais reste à confirmer dans un navigateur ou appareil réel ; voir [l’état vérifié du projet](./PROGRESS.md). Les consignes `AGENTS.md` demandent l’exploration ARTEMIS avant d’écrire de nouveaux tests mobiles.

## Phase 1 — interactions utiles dans le feed (P1)

**Résultat attendu :** une personne peut retrouver, comprendre et transmettre une vidéo utile sans ajouter de mécanique sociale superflue.

| Fonction / bouton          | Interaction proposée                                                                                          | Priorité | Dépendances et garde-fous                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Enregistrer**            | Ajouter une vidéo aux éléments sauvegardés, avec confirmation et action « Retirer »                           | P1       | Nouveau modèle de sauvegarde privé, RLS, export/suppression du compte, état vide ; aucun favori public                         |
| **Copier le lien**         | Ajouter « Copier le lien » au menu partager avec retour « Lien copié » et aperçu partageable                  | P1       | Aperçu public existant `/v/[id]` et URL média signée courte ; contrôler expiration, retrait/modération et absence de GPS exact |
| **Pourquoi cette vidéo ?** | Expliquer en une phrase la proximité approximative, la catégorie et l’ordre de fraîcheur/utilité              | P1       | Ne pas révéler la position de l’auteur ou une coordonnée précise                                                               |
| **Masquer cette vidéo**    | Retirer immédiatement l’élément du feed de la personne et proposer éventuellement « Masquer cette catégorie » | P1       | Préférence locale/compte clairement décrite ; action réversible dans les réglages                                              |
| **Annuler “Utile”**        | Rendre la réaction réversible et annoncer l’état au lecteur d’écran                                           | P1       | Vérifier API, limitation de fréquence, état optimiste puis reprise en cas d’erreur                                             |
| Commentaires accessibles   | Ouvrir le panneau commentaires sans perdre la position dans le feed ; distinguer chargement, vide et erreur   | P1       | Tester clavier, focus, ouverture/fermeture et reprise de lecture                                                               |
| Contrôle du son            | Bouton avec état explicite « Activer le son / Couper le son », mémorisé selon une règle claire                | P1       | Respecter les restrictions autoplay Safari/iOS et préférences de mouvement                                                     |

### Détails de comportement à standardiser

- Une action ne doit pas être confirmée visuellement avant l’acceptation du serveur, sauf état optimiste clairement annulé si la requête échoue.
- Partager conserve le comportement natif de partage quand il est disponible, puis propose la copie de lien.
- Signaler demande une catégorie et confirme la réception sans révéler l’identité de la personne qui a signalé.
- Les commandes « Enregistrer » et « Masquer » restent disponibles depuis le menu secondaire si le rail est déjà dense.

**Avancement au 28 octobre 2026 :** sauvegarde/masquage et explication de pertinence sont intégrés ; le partage propose désormais le partage natif et la copie explicite du lien vers l’aperçu public. La réaction « Utile » est réversible via l’API, son libellé accessible distingue l’ajout du retrait, et une annonce confirme chaque modification après acceptation serveur. Les commentaires distinguent chargement, vide et erreur (avec nouvel essai) ; l’ouverture des commentaires, du signalement ou du partage suspend la lecture sans démonter le feed. Tests clavier, focus et vérification visuelle de ces panneaux restent à effectuer.

## Phase 2 — découverte du quartier et alertes plus utiles (P1/P2)

**Résultat attendu :** le feed et la carte aident à trouver les informations proches sans rendre le filtrage complexe.

| Fonction                   | Interaction proposée                                                                              | Priorité | Mesure de réussite                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rayon visible              | Afficher le rayon choisi près du filtre et proposer un élargissement simple en état vide          | P1       | La personne comprend la zone couverte et peut élargir en un geste                                                                              |
| Filtres mémorisés          | Retrouver catégories/rayon au retour dans l’app avec « Réinitialiser » visible                    | P1       | Préférences cohérentes entre feed et carte ; aucun historique GPS                                                                              |
| État d’alerte              | Carte d’alerte avec heure, catégorie, statut et lien direct vers le contexte                      | P1       | Alertes anciennes et nouvelles sont différenciées sans prétendre à une vérification officielle                                                 |
| Alertes de zone opt-in     | Choisir un rayon/catégorie et une fréquence de notification, puis mettre en pause                 | P2       | Consentement explicite, fréquence maîtrisée, retrait facile ; préciser que la diffusion temps réel a actuellement ses propres limites de rayon |
| « Toujours d’actualité ? » | Demander à la communauté de confirmer ou signaler qu’une alerte a changé                          | P2       | Expiration et présentation des confirmations documentées ; protections anti-abus et seuils définis                                             |
| Mettre à jour/résoudre     | Auteur ou rôle autorisé peut marquer un événement comme terminé et ajouter une mise à jour courte | P2       | Historique des changements modéré ; pas de suppression trompeuse du contexte initial                                                           |
| Carte → feed               | Ouvrir une vidéo depuis un repère puis revenir à la même zone et au même zoom                     | P1       | Retour stable, coordonnées montrées approximatives seulement                                                                                   |

**État au 28 octobre 2026 :** le rayon courant est affiché dans l’état vide du feed ; le message distingue la recherche générale d’une recherche filtrée par catégorie. Les actions « Voir toutes les catégories » et « Élargir à… » offrent une sortie directe. Rayon et catégorie restent mémorisés et partagés avec la carte via les filtres locaux. Le passage carte → feed propose un retour direct et restaure le cadrage/zoom conservé uniquement en mémoire pendant la navigation client ; le parcours a besoin d’une validation visuelle dans le navigateur.

**Limite actuelle documentée :** le rayon du feed peut atteindre 10 km, tandis que la diffusion d’alertes temps réel est limitée à 5 km en raison du nombre de canaux Realtime. Lorsque le rayon dépasse 5 km, l’interface l’explique même si aucune alerte n’est présente ; les réglages et compteurs ne doivent pas laisser croire que les deux portées sont identiques.

## Phase 3 — capture plus simple et accessible (P1/P2)

La [roadmap vidéo](../roadmap.video.md) détaille les options de capture et d’édition. La séquence suggérée pour le produit est :

1. Stabiliser les erreurs caméra, permission, localisation, réseau et reprise de publication.
2. Ajouter les sous-titres ou une transcription seulement après décision sur coût, consentement, durée de conservation et correction humaine.
3. Ajouter découpe simple et choix d’une miniature sans import galerie ni allongement de la limite de durée.
4. Ajouter une aide de contexte (catégorie, lieu approximatif, heure) avec aperçu avant publication ; conserver une publication sans détails inutiles.
5. Évaluer minuteur ou pause/reprise d’enregistrement après test utilisateur, avant fonctions d’édition coûteuses.

**Boutons possibles :** « Recentrer » sur la capture, « Refaire », « Reprendre l’envoi », « Enregistrer pour plus tard » si la politique hors ligne le permet, et « Vérifier le cadrage ». Toute commande doit annoncer ce qu’elle conserve et ce qu’elle supprime.

## Phase 4 — confiance, modération et commerçants (P1/P2)

### Confiance et modération

- **Suivre mon signalement** : consulter l’état et la décision lorsque le modèle de modération le permet, sans exposer les outils internes ni d’autres signalements.
- **Comprendre la modération** : expliquer seuil d’auto-masquage, examen humain, recours et limites avant le signalement.
- **Corriger un signalement** : permettre de compléter un signalement ou d’annuler une action erronée selon les règles définies.
- **Actions modérateur rapides** : prioriser âge, risque et volume de signalements ; garder motif, historique et audit obligatoires.
- **Sécurité de publication** : proposer un rappel contextuel de ne pas filmer des personnes vulnérables, documents, plaques ou situations dangereuses.

Ces propositions ne font pas de l’app un canal d’urgence. En cas de danger immédiat, les textes existants doivent orienter vers les services d’urgence locaux.

### Commerces

- Ajouter des informations utiles au profil approuvé : horaires confirmés par le commerce, itinéraire externe, téléphone/site si fournis et lien vers les offres actives.
- Sur une vidéo d’offre, proposer **Voir l’offre**, **Appeler** ou **Itinéraire** uniquement si la donnée correspondante est présente et vérifiée par le commerce.
- Afficher validité et conditions de l’offre, date de fin et état expiré ; ne jamais garder une offre expirée comme active.
- État du parcours actuel : le feed, le deep link et les collections distinguent les publications `shop` valides jusqu’à leur `expires_at`, expirées ou invalides (date absente/invalide ou auteur non approuvé). Les conditions sont stockées séparément dans `videos.offer_terms`, saisies obligatoirement pour les nouvelles offres et affichées dans les surfaces publiques/privées ; les publications anciennes sans conditions sont explicitement signalées. Voir [docs/PROGRESS.md](./PROGRESS.md).
- Plus tard, proposer au commerçant un récapitulatif agrégé des vues et interactions uniquement si la mesure respecte la vie privée et si ses limites sont expliquées. Pas de promesse d’audience ou de retour sur investissement.

## Phase 5 — accessibilité et cohérence visuelle continue (P1)

- Contraste des couches glass sur vidéo, thèmes clair/sombre, états actifs et focus visible.
- Navigation clavier, annonces `aria-live`, focus des panneaux et dialogues commentaires/partage/signalement.
- Mouvement réduit, lecture manuelle, commandes vidéo compréhensibles et sous-titres quand disponibles.
- Tailles de texte agrandies, zoom, orientation, encoches, clavier virtuel et safe areas.
- Parité FR/EN idiomatique pour chaque nouvelle chaîne, états d’erreur et annonces accessibles.
- Vérification sur navigateurs cibles réels : Chrome Android et Safari iOS, en plus des tests automatisés compatibles.

Le verre est un traitement de surface, pas un substitut au contraste : prévoir un fond opaque de secours et contrôler les commandes sur plusieurs images réelles.

## Phase 6 — apprendre avant d’ajouter davantage (P2/P3)

Mesurer seulement ce qui permet d’améliorer un parcours, avec durée de conservation, accès et finalité documentés. Ne pas collecter la position exacte dans l’analytics.

| Indicateur                                               | Pourquoi                                          |
| -------------------------------------------------------- | ------------------------------------------------- |
| Actions du rail visibles et activées par taille d’écran  | Détecter les régressions de visibilité mobile     |
| Succès de lecture et reprise après erreur réseau         | Fiabilité perçue                                  |
| Début de capture → publication réussie                   | Repérer les blocages d’envoi                      |
| Temps de traitement média et taux d’échec                | S’assurer que les vidéos deviennent consultables  |
| Délai de traitement des signalements par priorité        | Qualité et capacité de modération                 |
| Utilisation des sauvegardes, filtres et alertes opt-in   | Vérifier l’utilité réelle des nouvelles fonctions |
| État vide → changement de rayon ou première contribution | Comprendre la découverte locale                   |

Ne pas adopter vues publiques, classements d’auteurs, séries quotidiennes ou récompenses avant d’avoir démontré leur utilité sans pression sociale et sans risque de pousser à filmer davantage.

## Idées à ne pas lancer sans preuve

- Messagerie privée : augmente la charge de sécurité, de signalement et de modération.
- Likes publics, abonnés visibles et classements : déplacent l’objectif de l’utilité locale vers la popularité.
- Fil algorithmique opaque : difficile à expliquer et à contrôler dans un produit de proximité.
- Paiement, publicité et promesse de performance commerçante : modèle économique et conformité à décider avant toute interface.
- Signalement « urgence » : risque d’être confondu avec un service d’intervention.

## Séquencement conseillé et résultat de chaque jalon

| Jalon                   | Travaux principaux                                                     | Résultat vérifiable                                                                    |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Feed mobile          | Rail d’actions, safe areas, contraste glass, cadrage vidéo             | Actions utilisables sur petits écrans et rendu réel revu                               |
| 2. Fiabilité            | Idempotence, reprise TUS, cache après déconnexion                      | Pas de doublon après reprise ; données privées absentes du cache                       |
| 3. Feed utile           | Sauvegarder, partager par lien, masquer, expliquer une recommandation  | Schéma/API/RLS et parcours d’erreur inclus ; fonctions comprises en test utilisateur   |
| 4. Quartier             | Rayon, carte-feed, alertes configurables et états d’alerte             | Portées et fraîcheur affichées honnêtement ; réglages révocables                       |
| 5. Capture et confiance | Reprise claire, sous-titres/découpe évalués, modération compréhensible | Publication plus accessible ; règles de conservation et recours documentés             |
| 6. Extension commerce   | Actions d’offre et mesures agrégées si justifiées                      | Informations fournies par le commerce, expirées correctement et sans promesse infondée |

### Définition de terminé pour toute fonctionnalité

1. Problème utilisateur et hypothèse écrits avant le développement.
2. Parcours mobile, clavier, états vide/chargement/erreur et permission refusée spécifiés.
3. Pour un nouvel état partagé : schéma, API, RLS, limites d’abus, export et suppression du compte évalués.
4. Traductions FR/EN et accessibilité livrées avec le comportement.
5. Tests adaptés exécutés après exploration de l’interface conformément aux règles du dépôt ; aucune validation n’est annoncée sans résultat observé.
6. [docs/PROGRESS.md](./PROGRESS.md) mis à jour avec ce qui est codé, vérifié et encore bloqué.

## Première tranche recommandée

1. Terminer la revue visuelle du feed mobile, notamment la pile d’actions et la superposition vidéo.
2. Valider la migration idempotente, la reprise TUS et le cache après déconnexion.
3. Faire tester le feed à quelques habitants : trouver/commenter/partager/signaler une vidéo, puis recueillir les difficultés sans expliquer les commandes.
4. Concevoir le panneau partager avec copie de lien et le bouton sauvegarder, mais confirmer d’abord le modèle d’accès et d’expiration des vidéos partagées.
5. Décider des deux fonctions P1 suivantes à partir des retours : masquer/expliquer la pertinence, ou filtres/rayon mémorisés.
