Audit contenu & UI/UX — Neighbors Live
Verdict
Neighbors Live a une proposition utile et différenciante : des vidéos de quartier, proches, temporaires et modérées. La base produit paraît déjà solide côté fonctionnalités. En revanche, la présentation vend encore davantage une application en développement qu’un service prêt à inspirer immédiatement confiance, notamment pour les commerces.

Cet audit s’appuie sur le code et les textes du dépôt. Je n’ai pas pu examiner l’application dans un navigateur : le site local ne répondait pas à l’adresse testée. Les recommandations visuelles ci-dessous sont donc des pistes fondées sur les composants et styles existants, pas sur une inspection pixel par pixel.

Ce qui fonctionne déjà
La promesse de proximité est compréhensible : les rayons de 300 m, 1 km et 3 km sont visibles dans le produit.
Le démarrage explique la valeur, les permissions et les règles de communauté dans Onboarding.tsx.
La confidentialité est un vrai différenciateur : la position publique est approximative, et l’application explique pourquoi elle demande la localisation dans feed.json.
Les écrans prévoient des états utiles : localisation refusée, feed vide, erreur de chargement et publication hors ligne.
Le bouton central « Filmer » rend l’action principale facile à repérer dans BottomNav.tsx.
Les améliorations à plus fort impact

1. Clarifier la promesse — priorité haute
   Le produit mélange plusieurs usages : alertes, entraide, événements, bons plans, commerces et objets perdus. Cette richesse est intéressante, mais elle rend moins évident le premier bénéfice à retenir.

Le titre d’onboarding « Votre quartier, en direct » peut aussi laisser croire à de la vidéo en direct, alors que le produit diffuse des vidéos courtes publiées par les voisins. Je proposerais de mettre en avant l’information locale utile, plutôt que le « direct ».

Proposition de promesse :

Les infos utiles, à deux pas de chez vous.
Alertes, entraide, événements et offres locales en courtes vidéos de quartier.

Et pour rappeler la sécurité sans alourdir l’accroche :

Votre position publique est approximative. Les vidéos sont temporaires et les contenus peuvent être signalés.

La page d’introduction et ses textes se trouvent dans onboarding.json ; la présentation générale est également portée par common.json.

2. Renforcer les signaux de confiance
   L’app demande l’accès à la position et à la caméra : l’utilisateur doit comprendre rapidement pourquoi, quand et avec quelles limites. Le socle est présent, mais certains messages pourraient être mieux calibrés :

« Les visages sont floutés automatiquement » peut sembler garantir qu’aucun visage ne restera visible. Or le suivi du projet documente des limites du floutage.
« Modérées par des habitants du quartier » est une promesse forte : il faut rendre visible ce que la modération signifie concrètement — signalement, examen, décision, recours.
Les règles indiquent bien que ce n’est pas un service d’urgence, mais cette information mérite d’être particulièrement visible dans le parcours des alertes.
Préférer une formulation prudente et transparente, par exemple :

Un floutage automatique des visages est appliqué avant publication. Il peut manquer certains visages : évitez de filmer des personnes reconnaissables et signalez un contenu si nécessaire.

Les limites connues sont répertoriées dans PROGRESS.md, et les textes juridiques se trouvent dans legal.json.

Point à corriger avant toute présentation publique : cette page mentionne encore une connexion « par lien magique », alors que l’application utilise désormais e-mail et mot de passe. Elle contient aussi des champs provisoires entre crochets pour l’éditeur et les coordonnées de contact. Ces incohérences nuisent directement à la crédibilité ; les textes doivent être mis à jour et relus avant lancement.

3. Concevoir deux expériences visuelles cohérentes
   Le thème sombre, le jaune accent et le feed vidéo immersif donnent une identité énergique. Mais l’ensemble risque de faire davantage penser à une application de divertissement qu’à un service local fiable et professionnel.

Je conserverais le mode sombre pour la vidéo et la caméra, mais j’explorerais une interface de découverte plus lumineuse et éditoriale : fonds clairs et chauds, panneaux sobres, typographie plus hiérarchisée, catégories immédiatement lisibles. Les couleurs devraient aussi avoir une signification stable — par exemple, réserver le rouge aux alertes réellement urgentes.

Les couleurs et le thème sont centralisés dans globals.css ; la carte du feed et ses actions sont dans Feed.tsx et VideoCard.tsx.

4. Rendre le feed plus lisible au premier regard
   Le feed superpose la vidéo, la catégorie, la distance, l’expiration, l’auteur et plusieurs actions. C’est pratique pour un usage régulier, mais la quantité d’éléments peut réduire la visibilité de la vidéo et de la légende.

À tester en priorité :

limiter la légende affichée à quelques lignes, avec une ouverture explicite pour lire la suite ;
distinguer plus clairement la catégorie de l’urgence : une « alerte » n’est pas forcément un danger immédiat ;
présenter l’expiration de façon utile — « expire dans 2 h » plutôt qu’un simple horodatage relatif ambigu ;
vérifier sur petits écrans que la légende ne se fait pas recouvrir par les boutons latéraux ;
étudier le regroupement de certains filtres, car les six catégories et le rayon doivent cohabiter dans un espace horizontal réduit.
Le feed vide contient déjà un appel à publier et une option pour élargir le rayon. C’est une bonne base ; il faut garder ces options faciles à trouver et expliquer simplement pourquoi la localisation est nécessaire.

5. Mieux vendre la valeur aux commerces
   L’espace commerçant est aujourd’hui surtout un parcours de demande de compte, avec quota et règles de publication. Le texte « Gratuit dans cette version » donne une impression de prototype, et le commerçant ne voit pas clairement ce qu’il gagne.

Je recommande une page de présentation publique distincte de l’espace réservé aux commerçants, qui explique :

qui verra les offres et dans quel rayon ;
comment une offre est publiée et combien de temps elle reste visible ;
quels résultats seront mesurés, si cette mesure est disponible ;
comment la validation et le badge commerce fonctionnent ;
quelles règles ou limites s’appliquent.
Une accroche possible :

Faites découvrir votre commerce aux voisins.
Publiez une courte vidéo tournée sur place et partagez une offre locale dans votre quartier.

Il faudra éviter de promettre des vues, des conversions ou une portée commerciale mesurée tant que ces fonctions ne sont pas réellement disponibles. Les textes et l’espace actuel figurent dans merchant.json et commerce/page.tsx.

Parcours à simplifier
L’onboarding comporte quatre étapes, dont l’installation de la PWA et les règles. Le contenu est utile, mais ces étapes peuvent retarder l’accès à la valeur réelle de l’application. Je testerais un parcours plus court :

expliquer la promesse en un écran ;
laisser l’utilisateur découvrir le feed ;
demander la localisation au moment où elle devient nécessaire, avec une explication ;
proposer l’installation et les notifications plus tard, quand l’utilisateur en voit l’intérêt.
Il ne s’agit pas de supprimer les règles ou les explications de confidentialité, mais de les montrer au bon moment plutôt que de tout demander avant que l’utilisateur ait découvert le service.

Priorités recommandées
Priorité Action Pourquoi
P0 Aligner les textes d’authentification et les mentions légales avec le produit actuel ; remplacer les champs provisoires avant toute promotion publique. Confiance et crédibilité
P1 Reformuler la promesse, notamment remplacer « en direct » par une formulation qui décrit les vidéos publiées par les voisins. Compréhension immédiate
P1 Créer une présentation publique dédiée aux commerces, sans la confondre avec leur espace connecté. Acquisition et conversion
P1 Simplifier le premier parcours et différer l’installation PWA et les notifications. Réduire la friction
P2 Tester une interface de découverte plus éditoriale, tout en conservant le mode vidéo immersif. Image plus professionnelle
P2 Tester le feed et le composer avec quelques habitants et commerçants sur téléphone réel. Vérifier la compréhension et l’ergonomie mobile
Pour mesurer les progrès, suivre au minimum : la complétion de l’inscription, l’acceptation de la localisation, le délai avant la première vidéo consultée, le taux de publication terminée et le nombre de demandes de compte commerce abouties. Ces mesures doivent rester compatibles avec l’engagement de confidentialité du produit.

En bref : le produit a déjà des arguments solides ; le gain principal viendra d’une promesse plus nette, de textes parfaitement cohérents avec le fonctionnement réel, et d’une présentation commerçante qui explique clairement la valeur — sans surpromesse.
