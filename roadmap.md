# Roadmap contenu, UI/UX et positionnement — Neighbors Live

**Version :** 1.0  
**Date :** 25 octobre 2026  
**Statut :** en cours ; une première passe de contenu et d’onboarding est implémentée. Les phases
ci-dessous restent partiellement ou entièrement à réaliser selon leurs critères de sortie.

Cette roadmap transforme les constats de l’[audit contenu et UI/UX](./AUDIT-CONTENU-UX.md) en
travail livrable et vérifiable. Elle privilégie la confiance, la compréhension et la qualité du
parcours avant une refonte graphique générale.

### Déjà réalisé

- Promesse d’accueil et tagline reformulées autour des informations utiles de quartier, sans
  suggestion de vidéo en direct.
- Onboarding raccourci à trois écrans principaux ; l’installation PWA est facultative et reste
  disponible par accès direct depuis les réglages.
- Mise en page de l’onboarding adaptée aux écrans courts : contenu défilant dans la zone centrale,
  commande principale maintenue en bas.
- Mentions de collecte de compte, de floutage et de modération ajustées au fonctionnement documenté.
- Introduction de l’espace commerçant recentrée sur les offres locales, sans annonce de résultats ou
  de gratuité non vérifiés.
- Page publique `/commerces` ajoutée, avec explication du parcours, des durées, du quota et des
  limites de mesure ; demande reliée à l’espace commerçant authentifié.
- Légendes longues du feed limitées à trois lignes, avec commande « Lire la suite / Réduire ».
- Tests E2E ajoutés pour la présentation publique commerçante, la protection de l’espace de demande
  et le développement/repli d’une longue légende ; ces deux parcours E2E ciblés passent, comme le
  typecheck, le lint, les tests unitaires et le build de production.
- Le feed respecte désormais aussi une préférence de mouvement réduit modifiée pendant la session :
  l’autoplay s’arrête, mais la commande de lecture manuelle reste disponible.
- Le tableau de bord admin présente des indicateurs actionnables, des files et états vides explicites,
  les informations utiles des demandes commerce et un journal des décisions contextualisé ; le
  parcours admin est couvert par un test E2E.
- L’espace commerçant indique la date de réception d’une demande en attente, explique où suivre son
  état sans promettre de délai, et renvoie vers les critères publics après un refus.
- La page admin liste aussi les vidéos `processing` (20 plus anciennes d’abord), leur auteur, leur
  date et le statut/compteur de tentatives du job média lorsqu’il existe. La requête ne sélectionne
  ni coordonnées exactes ni chemins de stockage ; l’E2E vérifie une réservation en traitement puis
  la supprime.

Les corrections ne remplacent pas une revue juridique. Les coordonnées de l’éditeur et les
informations réelles des sous-traitants restent à fournir. Le suivi détaillé est dans
[docs/PROGRESS.md](./docs/PROGRESS.md).

## Objectif produit

Permettre à un nouvel habitant de comprendre ce qu’est Neighbors Live, d’explorer son quartier et,
s’il le souhaite, de publier sans douter de l’usage de ses données ou des limites de la modération.
Permettre à un commerçant de comprendre la proposition et les règles avant de demander l’accès.

### Principes directeurs

1. **Clarté avant effet visuel :** chaque écran répond à un besoin principal et propose une action
   dominante.
2. **Promesses justes :** ne pas dire « en direct », ne pas présenter le floutage comme infaillible,
   ne pas promettre une audience commerciale non mesurée.
3. **Confiance au bon moment :** expliquer la localisation, la caméra, la modération et les
   notifications avant leur demande ou leur usage.
4. **Mobile d’abord :** contrôler les appareils et navigateurs cibles, notamment les zones tactiles
   et la hauteur visible sans défilement.
5. **Mesure respectueuse :** n’enregistrer aucune position GPS précise pour l’analyse produit.
6. **Amélioration progressive :** tester des parcours et prototypes avant d’entreprendre une
   refonte étendue.

## Priorisation

- **P0 — prérequis à toute communication publique :** incohérences qui fragilisent la confiance ou
  présentent mal le fonctionnement réel.
- **P1 — amélioration de l’activation :** proposition de valeur, permissions, onboarding et
  conversion commerçante.
- **P2 — amélioration de la qualité d’usage :** feed, identité visuelle, accessibilité et mesures.
- **P3 — optimisation continue :** itérations issues des tests et indicateurs, seulement après une
  base fiable.

Les tailles **S/M/L** donnent une indication relative de charge, pas une estimation calendaire. Les
phases s’enchaînent selon les dépendances et la capacité de l’équipe.

## Phase 0 — Fiabiliser les contenus et les promesses (P0)

**Résultat attendu :** chaque information visible est cohérente avec l’authentification, le
traitement, la confidentialité et l’état réel du produit.

| Chantier               | Livrables                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventaire des textes  | Liste des écrans, e-mails, messages d’erreur et traductions liées à auth, caméra, position, floutage, modération et commerce                                                                                                   |
| Authentification       | Remplacer toute mention « lien magique » qui ne correspond plus au parcours e-mail/mot de passe                                                                                                                                |
| Mentions légales       | ⬜ Remplacer les champs entre crochets, confirmer responsable de traitement, contact, sous-traitants et hébergement ; obtenir la revue juridique nécessaire. Bloqué par les informations de l’éditeur et le conseil juridique. |
| Floutage et position   | Harmoniser le message de capture et la politique : floutage des visages non infaillible, plaques non floutées, position publique approximative                                                                                 |
| Modération et urgences | Décrire clairement le signalement, le seuil d’auto-masquage, l’examen humain, le recours et l’absence de service d’urgence                                                                                                     |
| Traductions            | Comparer les contenus FR/EN et identifier les clés manquantes, anciennes ou contradictoires                                                                                                                                    |

**Critères de sortie**

- Aucun texte de parcours ne contredit le fonctionnement actuel.
- Aucun placeholder juridique n’est visible dans le produit destiné au public.
- Les limites de floutage et l’absence de détection des plaques sont exprimées sans ambiguïté.
- Les chaînes principales sont validées en français et en anglais.
- Toute revue juridique requise est terminée avant d’annoncer une disponibilité publique.

**Dépendances :** décisions de l’éditeur sur son identité légale, les coordonnées, le modèle
économique et les environnements de production.  
**Taille relative :** M.

## Phase 1 — Clarifier la promesse et le premier parcours (P1)

**Résultat attendu :** une personne comprend la proposition en quelques secondes, atteint la
découverte du quartier et sait quoi faire si elle ne donne pas la permission de localisation.

| Chantier          | Livrables                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Message principal | Nouveau titre, sous-titre, exemples et microtexte de confiance ; retirer « en direct » si le test confirme l’ambiguïté        |
| Onboarding        | Prototype d’un premier écran de valeur et réorganisation des étapes sans supprimer règles et confidentialité                  |
| Permissions       | Explication locale avant l’invite système ; état explicite quand la permission est refusée ; chemin de reprise compréhensible |
| Installation PWA  | Proposition décalée jusqu’à un moment où l’utilisateur a compris la valeur                                                    |
| Notifications     | Demande reportée et reliée à un bénéfice explicite, sans bloquer l’accès à l’application                                      |
| État vide         | Message utile, élargissement de rayon évident et invitation à publier sans suggérer qu’une zone vide est un défaut technique  |

**Critères de sortie**

- Cinq personnes non impliquées dans le projet peuvent expliquer la proposition après une première
  visite ; noter les incompréhensions et réviser jusqu’à ce que le sens soit cohérent.
- Le bouton principal de chaque étape est visible ou son accès est évident sur les tailles mobile
  de référence, sans défilement inattendu.
- Le refus de localisation n’entraîne ni écran bloqué sans explication ni demande répétée en boucle.
- La demande de notification n’apparaît qu’après une explication et peut être ignorée.
- Les variantes d’onboarding sont couvertes par tests manuels ou E2E sur les états essentiels.

**Dépendances :** contenus P0 ; choix sur la découverte sans permission et les options de repli.  
**Taille relative :** M.

## Phase 2 — Rendre feed et publication plus lisibles (P1)

**Résultat attendu :** comprendre rapidement qui publie, quoi, où approximativement et jusqu’à
quand ; terminer une publication sans confusion ni promesse excessive.

| Chantier              | Livrables                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Hiérarchie du feed    | Ordre visuel cohérent entre vidéo, catégorie, auteur, distance approximative et expiration                          |
| Légendes              | ✅ Limite visuelle à trois lignes et commande de lecture étendue ; tests E2E ajoutés                                |
| Catégories et alertes | ✅ En mode « Alerte », distinguer les publications communautaires des alertes officielles et rappeler le 112 ; E2E  |
| Actions vidéo         | ✅ Contrôle du chevauchement, zones tactiles, labels ; échec de lecture annoncé avec possibilité de réessayer ; E2E |
| Expiration            | Libellé compréhensible et cohérent avec la durée restante réelle                                                    |
| Publication           | Revoir les étapes caméra → aperçu → informations → envoi → traitement ; rendre erreurs et progression explicites    |
| Reprise réseau        | ✅ Statuts distincts pour réseau, position imprécise/indisponible, déplacement et ancienneté ; reprise manuelle     |

**Critères de sortie**

- Tests d’utilisabilité sur téléphone couvrant feed, filtre, lecture, commentaire et publication.
- Aucune information essentielle n’est masquée par les contrôles sur les appareils ciblés.
- Les erreurs de caméra, géolocalisation, précision, réseau et upload donnent une action de reprise.
- Les statuts « envoi », « traitement », « publié » et « rejeté » ne sont pas confondus.
- Les cas de lecteur muet, lecteur sonore et animation réduite sont testés.

**Dépendances :** phase 0 ; prototypes phase 1 pour toute modification du parcours d’accès.  
**Taille relative :** M/L selon l’étendue des changements de composants.

## Phase 3 — Concevoir une offre commerçante compréhensible (P1)

**Résultat attendu :** un commerce local comprend la valeur, l’éligibilité, le processus et les
limites avant de déposer une demande.

| Chantier           | Livrables                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Page d’acquisition | ✅ Page publique `/commerces`, distincte de l’espace commerçant authentifié                                                         |
| Proposition        | Bénéfice, format, rayon, durée, critères de validation et quota, exprimés sans jargon ; namespace commerçant disponible en FR et EN |
| Processus          | 🟨 Statut d’attente daté et suivi dans l’espace commerçant ; refus relié aux critères publics ; règle de nouvelle demande à décider |
| Modèle économique  | Décision validée et formulation exacte ; ne pas laisser « gratuit dans cette version » sans contexte                                |
| Mesure             | Inventaire des indicateurs réellement existants ; ne pas afficher de vues, conversions ou portée inventées                          |
| Publication        | Instructions qui aident à créer une offre utile, honnête, filmée sur place et conforme aux règles                                   |

**Critères de sortie** — page implémentée ; validation métier/utilisateur encore requise.

- Des commerçants testeurs savent décrire les étapes et les règles après lecture.
- Aucun résultat commercial ni volume d’audience n’est garanti sans donnée vérifiée.
- La page publique fonctionne sans connexion ; l’espace de gestion reste protégé.
- Le parcours d’une demande est compréhensible jusqu’à son état courant.
- Les textes reflètent exactement les quotas et paramètres configurés.

**Dépendances :** décisions business sur tarif/conditions et politique de validation.  
**Taille relative :** M.

## Phase 4 — Direction visuelle et système d’interface (P2)

**Résultat attendu :** une expérience cohérente et professionnelle, sans effacer le caractère vidéo
et local du produit.

| Chantier                  | Livrables                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Audit visuel              | Inventaire des composants, états, contrastes, espacements et incohérences sur mobile et bureau                                          |
| Prototypes                | Comparaison d’une exploration plus éditoriale avec l’interface sombre actuelle, en conservant feed/caméra immersifs                     |
| Couleurs                  | Sémantique documentée pour accent, catégories, danger, succès, informations et statuts                                                  |
| Typographie et composants | Échelle typographique, boutons, champs, cartes, badges, notices, états de chargement et erreurs                                         |
| Responsive                | Vérification des petits écrans, grandes polices, clavier virtuel, encoches et zones de sécurité                                         |
| Validation                | Tests comparatifs avec utilisateurs ; retenir la piste qui améliore compréhension et confiance, pas uniquement la préférence esthétique |

**Critères de sortie**

- Un prototype cliquable a été testé avec habitants et commerçants ciblés.
- Les choix de couleur restent compréhensibles sans la couleur seule et respectent les contrastes
  mesurés.
- Les zones tactiles et la lisibilité sont contrôlées sur les appareils cibles.
- Les écrans de chargement, vide, erreur, permission refusée et contenu masqué ont le même langage
  visuel.
- Pas de refonte générale avant accord sur le prototype et les composants communs.

**Dépendances :** retours des phases 1–3 ; inventaire sur appareils réels.  
**Taille relative :** L.

## Phase 5 — Accessibilité, internationalisation et qualité mobile (P2)

**Résultat attendu :** les parcours principaux sont utilisables dans des conditions variées,
notamment avec clavier, technologies d’assistance et paramètres d’affichage.

| Chantier                    | Livrables                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clavier et lecteurs d’écran | Revue de navigation, dialogue modal, focus, annonces de statuts et formulaires                                                                                                                                                  |
| Contraste et zoom           | Contrôle des contrastes, zoom navigateur et tailles de police agrandies                                                                                                                                                         |
| Vidéo                       | Contrôles compréhensibles, mode muet explicite, légende visible et alternatives lorsque disponibles                                                                                                                             |
| Cibles tactiles             | 🟨 Lien auteur, filtres et suppression de commentaire portés à 44 px minimum ; autres actions et appareils à auditer                                                                                                            |
| Mouvement                   | ✅ Autoplay du feed arrêté selon `prefers-reduced-motion`, avec lecture manuelle disponible ; E2E                                                                                                                               |
| i18n                        | 🟨 Namespaces commun, auth, feed, vidéo, carte, réglages, notifications et commerce traduits en anglais ; capture, modération, légal et autres sections restent à traduire. Les namespaces incomplets retombent sur le français |
| Appareils                   | Matrice d’essai iPhone Safari, Android Chrome et navigateurs desktop supportés                                                                                                                                                  |
| PWA/push                    | Essais réels d’installation, permissions, réception et désabonnement ; noter les limites par plateforme                                                                                                                         |

**Critères de sortie**

- Aucun blocage clavier connu dans inscription, onboarding, feed, capture et réglages.
- Erreurs et changements d’état sont annoncés aux technologies d’assistance.
- La vidéo et ses actions restent utilisables avec mouvement réduit et contrôle explicite du son.
- Les écarts de plateforme sont documentés plutôt que masqués.
- Les résultats de tests sur appareil réel sont reportés dans le suivi du projet.

**Dépendances :** parcours stabilisés et accès aux appareils de test.  
**Taille relative :** M/L.

## Phase 6 — Mesurer, apprendre et itérer (P3)

**Résultat attendu :** améliorer l’activation et la confiance à partir de données utiles, minimales et
respectueuses de la vie privée.

| Chantier               | Livrables                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline               | Valeurs initiales des indicateurs disponibles et limites de mesure documentées                                                                |
| Événements produit     | Définition minimale des événements : étapes onboarding, demande de permission, premier feed, publication commencée/terminée, demande commerce |
| Protection des données | Revue des données collectées, durée, accès, consentement éventuel et absence de coordonnées GPS précises dans événements/logs                 |
| Expériences            | Hypothèses et critères de succès écrits avant chaque test ; ne modifier qu’un facteur principal à la fois                                     |
| Revue régulière        | Analyse des retours qualitatifs, abandons et erreurs techniques ; conversion en petites améliorations                                         |

**Indicateurs prioritaires**

1. Compréhension de la promesse lors d’un test qualitatif.
2. Taux de fin de l’onboarding.
3. Temps jusqu’au premier contenu ou état vide explicatif.
4. Taux d’acceptation de localisation, interprété par plateforme.
5. Ratio publications actives / captures commencées.
6. Taux de succès du traitement média.
7. Taux de demande commerçante complétée et taux d’approbation, suivis séparément.

**Critères de sortie**

- Chaque indicateur possède une définition, une source, une durée de conservation et un responsable.
- Les coordonnées précises ne sont ni envoyées au système de mesure ni conservées comme historique.
- Les cibles chiffrées sont définies après la baseline, pas inventées à l’avance.
- Une expérience est arrêtée ou conservée selon une règle définie avant sa mise en ligne.

**Dépendances :** revue confidentialité/juridique et instrumentation non intrusive.  
**Taille relative :** M.

## Vue synthétique des dépendances

```text
Phase 0 — cohérence / confiance
    ├── Phase 1 — promesse / onboarding
    │       └── Phase 2 — feed / publication
    ├── Phase 3 — proposition commerçante
    └── Phase 5 — accessibilité et plateforme (peut démarrer en audit)

Phases 1–3 + retours utilisateurs
    └── Phase 4 — direction visuelle et système UI

Parcours stabilisés + revue confidentialité
    └── Phase 6 — mesure et optimisation continue
```

Les audits d’accessibilité et appareils peuvent commencer plus tôt comme diagnostic, mais les
corrections qui dépendent d’un parcours refondu doivent suivre ce parcours pour éviter le travail en
double.

## Rituels de validation et définition de terminé

Pour chaque phase :

1. Formuler le problème utilisateur et l’hypothèse de changement.
2. Vérifier les textes et les comportements réels dans le code avant de les promettre.
3. Tester les maquettes ou le parcours avec des personnes représentatives.
4. Implémenter uniquement après validation de l’approche.
5. Ajouter ou mettre à jour les tests appropriés : unitaires, E2E, accessibilité ou test manuel
   documenté.
6. Exécuter la boucle de qualité du dépôt : typecheck, lint, tests et build.
7. Mettre à jour [docs/PROGRESS.md](./docs/PROGRESS.md) avec l’état vérifié et les écarts restants.

Une tâche est terminée seulement si ses critères d’acceptation sont satisfaits, le contenu est
cohérent dans les langues prises en charge, les états d’erreur essentiels sont couverts et les
limites non validées sont explicitement documentées.

## Hors périmètre tant que non décidé

- Garantir une audience, un nombre de vues ou un retour sur investissement aux commerces.
- Présenter Neighbors Live comme un service d’urgence ou comme une source d’informations vérifiées
  avant modération.
- Promettre un floutage infaillible ou des plaques automatiquement masquées.
- Stocker une position de navigation précise pour analyser les usages.
- Lancer une refonte graphique générale avant d’avoir testé les prototypes et parcours prioritaires.
