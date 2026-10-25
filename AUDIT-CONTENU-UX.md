# Audit contenu, positionnement et expérience UI/UX

**Projet :** Neighbors Live  
**Date :** 25 octobre 2026  
**Périmètre :** proposition de valeur, textes français, onboarding, navigation, feed, publication,
confiance, commerce et premières pistes visuelles.

## Synthèse exécutive

Neighbors Live dispose d’un socle fonctionnel différenciant : vidéos courtes locales, feed et carte,
publication filmée dans l’application, expiration, modération de quartier et position publique
approximative. Le défi principal n’est pas d’ajouter davantage de fonctions : c’est de faire
comprendre rapidement **à quoi sert l’application**, de rendre sa promesse de confiance crédible et
de réduire les hésitations avant la première découverte ou publication.

L’expérience actuelle parle à la fois d’alertes, d’entraide, d’événements, de commerces, de bons
plans et d’objets perdus. Cette diversité peut enrichir le produit, mais elle dilue son bénéfice
principal si elle est présentée comme une simple liste de catégories. La marque doit d’abord vendre
une idée simple : **les informations utiles de son quartier, en courtes vidéos de voisins**.

### Décisions recommandées

1. Remplacer « Votre quartier, en direct », qui peut faire penser à de la vidéo en direct, par une
   promesse décrivant clairement les publications de voisinage.
2. Corriger les textes juridiques et d’authentification obsolètes avant toute communication publique.
3. Expliquer le floutage comme une mesure d’atténuation, pas comme une garantie infaillible.
4. Faire découvrir la valeur avant de solliciter l’installation PWA et les notifications.
5. Présenter séparément le service aux habitants et la proposition destinée aux commerçants.
6. Tester l’interface sur de vrais téléphones et avec des habitants/commerçants avant de figer une
   nouvelle direction visuelle.

## Méthode et limites de cet audit

L’analyse combine :

- la lecture de l’architecture, du suivi de progression, des composants et des messages français ;
- la consultation de la page d’onboarding partagée dans le navigateur, son instantané accessible et
  une capture d’écran ;
- les limites techniques et parcours non encore testés documentés dans le dépôt.

La capture visible concernait **l’étape 1 de l’onboarding seulement**, sur un viewport de bureau
d’environ 1110 × 500 px. Elle montre un fond sombre uniforme, une colonne centrée, un titre et un
texte explicatif, une progression en quatre segments et le bouton « Passer ». Le contenu se prolonge
sous le bas de la capture et le bouton principal « Suivant » n’y est pas visible. C’est un constat
sur cette capture et cette taille d’écran, pas une conclusion sur tous les appareils.

Le navigateur partagé a aussi signalé une erreur de connexion HMR. Le reste de l’application n’a
pas fait l’objet d’une inspection visuelle interactive complète. Les constats UI des autres pages
sont donc des **hypothèses à valider**, établies à partir des composants et textes du dépôt.

## Diagnostic produit

### Proposition de valeur

**Points forts**

- L’ancrage de proximité est concret : rayons de 300 m, 1 km et 3 km.
- Le format vidéo peut montrer un fait ou une offre plus directement qu’un long texte.
- La durée de vie limitée donne une raison de consulter régulièrement le contenu local.
- Les protections de localisation et la modération peuvent différencier le service d’un réseau
  social généraliste.

**Point de vigilance**

Le produit ne doit pas être vendu comme une application de streaming en direct, une plateforme
d’alerte d’urgence ou un canal commercial garantissant une audience. Ces formulations dépasseraient
les fonctions ou garanties documentées.

**Positionnement conseillé**

> **Les infos utiles, à deux pas de chez vous.**  
> Alertes, entraide, événements et offres locales en courtes vidéos de quartier.

Promesse de confiance associée :

> Votre position publique est approximative. Les vidéos sont temporaires et peuvent être signalées.

### Audiences et besoins

| Audience                         | Besoin concret                                    | Obstacle à lever                                                    | Message à privilégier                                                                               |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Habitant qui découvre            | Comprendre ce qui se passe à proximité            | « Pourquoi donner ma position ? Y a-t-il déjà du contenu ? »        | Explorer les informations utiles proches ; expliquer précisément l’usage de la position             |
| Habitant qui publie              | Partager vite un fait local                       | Permission caméra/localisation, peur d’exposer des personnes        | Une vidéo courte, tournée sur place, avec explication des protections et de leurs limites           |
| Personne qui consulte une alerte | Savoir si l’information est pertinente et récente | Confusion entre alerte de quartier et service d’urgence             | Date, catégorie, portée et rappel visible : le service ne remplace pas le 112                       |
| Commerçant                       | Faire connaître une offre locale                  | Valeur, portée, validation et conditions insuffisamment explicitées | Publier une offre locale, avec conditions et rayon affichés sans promettre de résultats non mesurés |

## Analyse des contenus

### Cohérence des messages — priorité P0

Les textes de confidentialité mentionnent encore la connexion « par lien magique », alors que le
parcours actuel utilise e-mail et mot de passe. Les pages juridiques contiennent également des
champs provisoires entre crochets pour l’éditeur, les coordonnées et l’hébergeur du worker.

**Conséquence :** même si la majorité de l’interface est claire, ces détails donnent une impression
de produit non finalisé et affaiblissent la confiance sur les données personnelles.

**À faire avant lancement ou campagne publique :**

- harmoniser les pages juridiques avec le vrai parcours d’authentification ;
- remplacer les coordonnées et mentions d’hébergement provisoires par les informations exactes ;
- faire relire les textes juridiques par une personne compétente ;
- parcourir les e-mails, erreurs et confirmations pour s’assurer que les parcours racontent la même
  chose.

### Clarté de la promesse — priorité P1

« Votre quartier, en direct » est une accroche mémorable, mais peut laisser croire à des diffusions
en direct. L’application présente des vidéos courtes, publiées puis traitées. Il faut également
éviter de décrire toutes les catégories dans la première phrase : la liste complète fonctionne
mieux après la promesse.

**Exemple de hiérarchie éditoriale :**

1. Bénéfice : « Les infos utiles, à deux pas de chez vous. »
2. Explication : « Des vidéos courtes publiées par les voisins de votre quartier. »
3. Exemples : « Alertes, entraide, événements et offres locales. »
4. Confiance : « Votre position publique est approximative. »

### Confiance, sécurité et précision des promesses — priorité P0/P1

Le texte de capture dit que les visages sont floutés automatiquement. Le suivi du projet précise
que le détecteur peut manquer de très petits visages et que le floutage des plaques est désactivé.
La formulation doit donc éviter de suggérer une protection garantie.

**Formulation recommandée :**

> Un floutage automatique des visages est appliqué avant publication. Il peut manquer certains
> visages : évitez de filmer des personnes reconnaissables et signalez tout contenu préoccupant.
> Le floutage automatique des plaques n’est pas disponible.

La formulation peut être raccourcie dans le parcours de capture, avec un lien vers les détails.
Cette information importante ne doit pas être enfouie dans des conditions longues.

La modération de quartier est une force si son fonctionnement est explicite : expliquer qui peut
signaler, quand un contenu est masqué, qui examine les signalements et comment contester une
décision. Éviter de présenter toute publication comme préalablement vérifiée.

Pour les alertes, maintenir un rappel accessible que l’application ne remplace pas les services de
secours et que le 112 doit être appelé en cas de danger immédiat.

### Onboarding et permissions — priorité P1

L’onboarding actuel comporte quatre étapes : proposition de valeur, permissions, installation PWA
et règles. Les explications des permissions sont responsables et utiles. Le risque est le moment où
elles arrivent : une personne peut devoir parcourir plusieurs écrans avant d’avoir constaté la
valeur du feed.

La localisation est une dépendance réelle de la découverte ; il n’est donc pas toujours possible de
retarder cette permission jusqu’après le feed. Il faut plutôt fournir un contexte clair au moment
où elle devient nécessaire, et conserver un accès de repli explicite en cas de refus.

**Parcours à expérimenter, sans supprimer les protections :**

1. Présenter la promesse en un écran court.
2. Expliquer la localisation juste avant la demande système et indiquer ce qui reste possible en
   cas de refus.
3. Conduire vers la découverte du feed ou un état vide utile.
4. Présenter l’installation et les notifications après une première interaction pertinente.
5. Rendre les règles accessibles depuis la publication et les signalements.

La capture partagée montre le bouton « Suivant » sous le bord inférieur du viewport de bureau
observé. Tester que l’action principale est visible sans défilement sur les hauteurs de fenêtre et
tailles d’écran courantes.

### Feed, catégories et lecture — priorité P1/P2

Le feed superpose la vidéo, la catégorie, la distance, l’expiration, l’auteur et plusieurs actions
verticales. Ce choix est courant dans un feed vidéo immersif, mais la lisibilité réelle dépend des
vidéos, du contraste et de la hauteur disponible.

**Hypothèses à valider sur appareils réels :**

- les contrôles d’action ne recouvrent pas la légende ou les sous-titres ;
- les libellés restent lisibles sur des vidéos claires ou très contrastées ;
- les filtres et le sélecteur de rayon restent utilisables sur les petits écrans ;
- une personne comprend le statut et l’expiration sans confondre ancienneté et urgence ;
- lecture avec son, muet, pause et navigation au clavier sont compréhensibles.

**Pistes de conception :**

- tronquer les légendes longues de façon lisible et permettre leur développement ;
- garder la catégorie distincte d’un indicateur d’urgence ;
- afficher une durée restante compréhensible et testée, par exemple « expire dans 2 h » ;
- explorer une entrée de feed plus éditoriale ou une liste de cartes, sans retirer l’accès au feed
  vidéo ;
- limiter le nombre de filtres exposés simultanément sur petit écran.

### Offre commerçante — priorité P1

L’espace commerçant présente une demande de validation, un quota et des règles, mais raconte peu le
bénéfice commercial. « Gratuit dans cette version » évoque un prototype et soulève une question
tarifaire sans y répondre.

Créer une présentation destinée aux prospects, distincte de l’espace de gestion connecté. Elle
devrait expliquer :

- le type de publication autorisée et le fait qu’elle doit être filmée sur place ;
- le rayon de diffusion et la durée de visibilité ;
- le processus et le délai de validation, dès qu’ils sont définis ;
- les règles de publication et le quota applicable ;
- les indicateurs réellement disponibles, sans inventer de statistiques ou de résultats ;
- les conditions tarifaires réelles, ou préciser que le modèle économique est encore à définir si
  cette information est publique et assumée.

**Proposition de titre :**

> **Faites découvrir votre commerce aux voisins.**  
> Publiez une courte vidéo tournée sur place et partagez une offre locale dans votre quartier.

### Identité visuelle et impression de professionnalisme — priorité P2

Le thème observé dans les styles et sur la capture est sombre, avec un accent jaune et une interface
très épurée. Le feed vidéo et la caméra gagnent à rester immersifs et sombres. Pour la découverte,
les paramètres, la modération et les pages de présentation, une approche plus éditoriale pourrait
mieux évoquer un service local fiable.

**Piste à prototyper, pas décision à imposer sans test :**

- conserver le mode sombre pour vidéo et capture ;
- comparer avec une surface de découverte claire et chaleureuse ;
- réserver le rouge aux alertes réellement urgentes ou aux erreurs importantes ;
- utiliser une hiérarchie typographique stable, des composants cohérents et des espacements
  réguliers ;
- afficher les badges de commerce et les statuts de modération de façon distincte et explicite.

Ne pas entreprendre une refonte complète avant les tests utilisateurs : le mode sombre peut être
un choix intentionnel et le code seul ne permet pas d’en juger la qualité visuelle réelle.

## Accessibilité et qualité d’usage

Le dépôt comprend déjà quelques bonnes pratiques, dont un lien d’évitement, des états annoncés et
des indicateurs de focus. La roadmap devrait vérifier leur cohérence de bout en bout :

- contraste texte/fond et lisibilité des petits textes ;
- tailles minimales des zones tactiles, y compris les actions du feed ;
- focus visible, ordre clavier, fermeture des fenêtres et annonces d’état ;
- réduction des animations et contrôles de lecture ;
- sous-titres ou moyens de comprendre une vidéo sans le son, au moins via une légende claire ;
- textes simples pour les erreurs caméra, réseau et localisation ;
- cohérence des traductions française et anglaise ;
- confort avec zoom navigateur, petits écrans et zones de sécurité iOS.

La conformité doit être mesurée sur les interfaces réelles et ne doit pas être déduite du seul fait
que des attributs d’accessibilité existent dans le code.

## Indicateurs de succès proposés

Établir une valeur de départ avant de définir une cible. Ne pas collecter ni journaliser de position
GPS précise pour mesurer l’usage.

| Indicateur                          | Définition proposée                                                                        | Question qu’il éclaire                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Compréhension de la promesse        | Personnes capables de décrire le service après une première visite                         | La proposition est-elle mémorisable ?     |
| Fin de l’onboarding                 | Sessions qui arrivent au feed / sessions qui commencent l’onboarding                       | Le premier parcours est-il trop long ?    |
| Découverte du feed                  | Temps entre l’arrivée et l’affichage du premier contenu utile ou d’un état vide explicatif | L’utilisateur atteint-il vite la valeur ? |
| Permission de localisation          | Acceptations / demandes affichées, ventilées par plateforme si possible                    | L’explication rassure-t-elle ?            |
| Publication terminée                | Publications actives / démarrages de capture                                               | Où les contributeurs abandonnent-ils ?    |
| Publication techniquement réussie   | Vidéos traitées avec succès / uploads validés                                              | Le parcours média est-il fiable ?         |
| Conversion commerçante              | Demandes commencées puis complétées ; approbations suivies séparément                      | L’offre et le processus sont-ils clairs ? |
| Incidents de compréhension/sécurité | Signalements et retours liés à la position, au floutage ou aux urgences                    | Les promesses sont-elles comprises ?      |

Toute mesure doit respecter la politique de minimisation des données, les choix de consentement
applicables et les engagements de confidentialité du produit.

## Priorités de synthèse

| Priorité | Action                                                                            | Motif                                          |
| -------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| **P0**   | Corriger les incohérences d’authentification et les champs juridiques provisoires | Crédibilité et confiance                       |
| **P1**   | Clarifier la promesse et les limites du floutage                                  | Compréhension sans surpromesse                 |
| **P1**   | Réduire la friction du premier parcours et cadrer les permissions                 | Accéder plus tôt à la valeur                   |
| **P1**   | Concevoir une proposition dédiée aux commerces                                    | Acquisition et conversion                      |
| **P1**   | Tester le feed/capture sur téléphones et auprès d’utilisateurs                    | Valider lisibilité, ergonomie et compréhension |
| **P2**   | Prototyper une direction visuelle plus éditoriale                                 | Perception professionnelle                     |
| **P2**   | Renforcer accessibilité, métriques et cohérence i18n                              | Qualité durable et amélioration mesurable      |

Le séquencement, les livrables et les critères de sortie sont détaillés dans
[roadmap.md](./roadmap.md).

## Fichiers et écrans examinés

- `apps/web/src/components/onboarding/Onboarding.tsx`
- `apps/web/messages/fr/onboarding.json`
- `apps/web/messages/fr/common.json`
- `apps/web/messages/fr/feed.json`
- `apps/web/messages/fr/capture.json`
- `apps/web/messages/fr/auth.json`
- `apps/web/messages/fr/legal.json`
- `apps/web/messages/fr/merchant.json`
- `apps/web/src/components/feed/Feed.tsx`
- `apps/web/src/components/feed/VideoCard.tsx`
- `apps/web/src/components/BottomNav.tsx`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/(app)/commerce/page.tsx`
- `docs/PROGRESS.md`
- `docs/ARCHITECTURE.md`
- Capture partagée de l’étape 1/4 de l’onboarding, 25 octobre 2026.

## Conclusion

Neighbors Live n’a pas besoin de paraître plus « vendeur » en promettant davantage. Il gagnera en
professionnalisme en étant **plus précis, plus cohérent et plus facile à comprendre**. La première
étape consiste à éliminer les contradictions et les mentions provisoires ; la suivante est de
tester une promesse claire et un parcours plus direct ; la refonte visuelle doit venir après les
retours d’habitants et de commerçants.
