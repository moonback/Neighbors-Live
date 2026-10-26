# Audit des parcours utilisateur — Neighbors Live

**Date :** 27 octobre 2026  
**État initial :** audit statique approfondi du dépôt. Corrections partielles documentées en fin de rapport.
**Périmètre :** routes Next.js, composants, handlers API, logique partagée, worker, migrations/RLS, messages FR/EN et tests existants.

## 1. Synthèse exécutive

Neighbors Live possède un socle fonctionnel large : découverte locale, feed et carte, capture dans le navigateur, upload TUS, traitement asynchrone, profils, signalements, recours, espace commerçant, modération, administration, export/suppression des données et fonctions PWA. La sécurité est en partie portée par des contrôles serveur et SQL, avec des tests RLS/pgTAP et une suite Playwright déjà présente.

L’audit du code confirme cependant des parcours incomplets ou des états ambigus : une reprise d’upload peut créer une seconde réservation serveur après une coupure TUS ; les erreurs des files de modération peuvent être affichées comme une file vide ; certains échecs de chargement de profil ou de contenu personnel sont masqués. Le service worker applique une stratégie de cache réseau à toutes les navigations, y compris des routes authentifiées : le risque d’exposition hors ligne doit être vérifié avant diffusion publique.

### État des corrections — 27 octobre 2026

| Sujet                                                          | État                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache des navigations privées                                  | Corrigé dans le code : cache réseau réservé à une liste de pages publiques, anciens caches `pages` purgés à l’activation. À valider dans un navigateur après logout et changement de compte.                                                                                                                                                                                                                                                 |
| Reprise upload après réservation TUS                           | Corrigé : les erreurs de transport/session gardent `videoId` et `uploadPath` dans IndexedDB, et le runner réutilise la réservation.                                                                                                                                                                                                                                                                                                          |
| Réponse perdue après `POST /api/videos`                        | Implémentation ajoutée : identifiant stable généré à la capture, colonne/index unique et verrou transactionnel avant création; une relance retrouve la même réservation. Migration et test DB/E2E restent à exécuter/ajouter.                                                                                                                                                                                                                |
| États d’erreur modération, mes vidéos, espace commerce et push | Corrigés dans l’interface et les messages FR/EN pour les chemins recensés.                                                                                                                                                                                                                                                                                                                                                                   |
| Reprise onboarding et confirmation de mot de passe             | Corrigées : étape conservée localement; confirmation affichée sans redirection immédiate.                                                                                                                                                                                                                                                                                                                                                    |
| Documentation confidentialité                                  | `docs/PRIVACY.md` créé comme état technique de travail; les faits de l’éditeur, sous-traitants, durées et clauses juridiques restent à confirmer.                                                                                                                                                                                                                                                                                            |
| Vérification                                                   | `pnpm typecheck`, `pnpm lint`, `pnpm test` (47 tests existants) et Prettier passent avant l’ajout du dernier patch idempotent; typecheck, lint et tests unitaires repassent après ce patch. Le build échoue au chargement de la liaison native SWC. Aucun nouveau test n’a été écrit : la procédure du dépôt exige d’explorer l’app avec ARTEMIS avant la rédaction; ARTEMIS est bloqué par l’absence de clé multimodale et de device actif. |

Les textes de confidentialité et les conditions restent explicitement des brouillons avec des champs légaux entre crochets. Le dépôt ne contient pas `docs/PRIVACY.md`, bien que les instructions et le suivi le référencent. Les traductions ont une parité structurelle, mais leur rendu et leur qualité idiomatique ne sont pas validés par cette vérification.

### Dix corrections ou vérifications prioritaires

1. **SEC-001 — P0 à confirmer :** vérifier que les navigations authentifiées ne sont pas conservées/servies par le cache du service worker après déconnexion ou changement de compte.
2. **FLOW-001 — P1 :** conserver l’identifiant et le chemin d’une réservation vidéo lorsqu’un upload TUS échoue, puis reprendre cette réservation au lieu d’en créer une nouvelle.
3. **ERROR-001 — P1 :** différencier erreur de chargement et file vide en modération.
4. **COPY-001 — P0 avant diffusion publique :** renseigner les informations d’éditeur, d’hébergement, de contact et les clauses légales, puis faire valider les textes par un juriste.
5. **ERROR-002 — P1/P2 :** exposer les erreurs de chargement des vidéos personnelles au lieu de masquer la section.
6. **ERROR-003 — P2 :** distinguer l’échec de lecture du profil commerçant de l’absence de demande.
7. **ERROR-004 — P2 :** convertir les exceptions de permission/Push en états visibles et récupérables.
8. **FLOW-002 — P2 :** décider si l’onboarding doit reprendre à la dernière étape après rechargement ; actuellement son étape n’est pas persistée.
9. **TEST-001 — P1 :** ajouter un E2E de perte réseau après réservation et reprise, avec assertion d’absence de doublon.
10. **A11Y-001 / TEST-002 — P2 :** compléter les essais clavier, lecteur d’écran, affichage anglais, petits écrans et appareils physiques.

### Éléments non vérifiés

- Rendu visuel interactif des pages et comportement réel du service worker : le serveur local ne répond pas, Docker n’a pas de daemon disponible, et Computer Use s’est arrêté car il ne pouvait pas déterminer avec assez de confiance l’URL de l’onglet Chrome déjà ouvert.
- Tests pgTAP et Playwright pendant cet audit : non exécutés. `supabase status` a échoué avant exécution car Supabase CLI n’a pas pu écrire sa télémétrie dans `%USERPROFILE%\.supabase` hors du workspace ; Docker est indisponible.
- Appareils physiques, Safari/iOS, Android réel, notifications push réelles et expérience hors ligne réelle.
- Revue juridique, identité de l’éditeur, sous-traitants et garanties de transfert.
- Traduction anglaise idiomatique et conformité accessibilité mesurée sur l’interface complète.

## 2. Cartographie des routes et dépendances

Les routes ci-dessous sont recensées dans `apps/web/src/app`. Leur présence ne constitue pas une validation d’accès ou d’exécution.

| Surface              | Routes                                                                 | Utilisateurs et dépendances principales                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrée et découverte | `/`, `/decouvrir`, `/bienvenue`, `/onboarding`                         | Feed et navigation ; onboarding requis par cookie pour certaines pages. La page de feed et la carte lisent le viewer de façon facultative ; les pages d’action appliquent leurs propres redirections.       |
| Authentification     | `/login`, `/mot-de-passe-oublie`, `/reinitialiser`, `/auth/callback`   | Email/mot de passe, pseudo, session Supabase, confirmation éventuelle, callback PKCE et récupération.                                                                                                       |
| Vidéo publique       | `/v/[id]`                                                              | Lien profond vers un contenu encore public ; ressource expirée/inaccessible renvoie l’état indisponible.                                                                                                    |
| Publication          | `/filmer`                                                              | Session et pseudo requis ; caméra/micro, position, IndexedDB, Storage/TUS, API vidéos et worker.                                                                                                            |
| Feed et carte        | `/`, `/carte`                                                          | Géolocalisation du navigateur, filtres, RPC `nearby_videos`/`map_videos`, URL signées, MapLibre.                                                                                                            |
| Profils et données   | `/u/[username]`, `/me`, `/me/decisions`, `/parametres`                 | Profil public, vidéos visibles, préférences, notifications, export, suppression et recours. Pages personnelles protégées par session.                                                                       |
| Commerce             | `/commerces`, `/commerces/decouvrir`, `/commerce`                      | Présentation publique, annuaire (100 entrées max), demande d’accès, attente/refus/approbation et quota.                                                                                                     |
| Modération et admin  | `/moderation`, `/admin`                                                | Application de modérateur, files par cellule H3, appels, décisions ; admin avec recherche, demandes commerce, utilisateurs, journal et jobs média. Accès contrôlé par rôle dans les pages et fonctions SQL. |
| Légal et PWA         | `/legal/[slug]`, `/offline`, `/manifest.webmanifest`, `/serwist/sw.js` | Textes légaux provisoires, page hors ligne, installation/mise à jour et cache applicatif.                                                                                                                   |

### Routes API regroupées par effet

| Domaine          | Routes                                                                                                                                   | Effet serveur / données                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth             | `POST /api/auth/signup`, `/login`, `/logout`, `/reset`, `/password`                                                                      | Supabase Auth, profils/pseudo, limitations de débit, cookies et erreurs génériques.                                                                   |
| Découverte       | `GET /api/feed`, `/api/map`, `/api/videos/[id]/media`                                                                                    | RPC de proximité, position publique floutée, pagination et URL signées.                                                                               |
| Publication      | `POST /api/videos`, `POST /api/videos/[id]/uploaded`, `GET /api/me/videos`, `DELETE /api/videos/[id]`                                    | Validation, réservation, vérification de stockage, mise en queue worker, statut et retrait.                                                           |
| Interactions     | `POST/DELETE /api/videos/[id]/useful`, `GET/POST /api/videos/[id]/comments`, `DELETE /api/comments/[id]`, `POST /api/videos/[id]/report` | Réactions, commentaires, suppression par auteur, signalements et seuil d’auto-masquage en SQL.                                                        |
| Compte           | `GET /api/me/export`, `DELETE /api/me`, `PATCH /api/me/profile`, `PATCH /api/me/settings`                                                | Export, suppression Auth/Storage, modifications du profil et préférences.                                                                             |
| Commerce/push    | `POST /api/merchant`, `POST/DELETE /api/push/subscribe`                                                                                  | Demande commerçante en attente ; abonnement de navigateur et cellule H3.                                                                              |
| Modération/admin | `POST /api/appeals`, `/api/moderation`, `/api/admin`                                                                                     | Dépôt de recours, décisions, application comme modérateur, sanctions, approbation commerce et réglages médias. Les fonctions SQL revérifient le rôle. |

Les mutations passent par le wrapper `route` : contrôle `Origin`, validation Zod, erreurs JSON et `Cache-Control: no-store`. Les requêtes sensibles au rôle délèguent l’autorisation à des RPC SQL. Les règles de table ne sont pas toutes exposées via API et doivent rester auditées dans les migrations/RLS.

## 3. Fiches de parcours

Les constats de cette section proviennent de la lecture du code et des tests ; **aucun parcours n’a été rejoué dans l’application pendant cet audit**.

### F-01 — Première visite et onboarding

- **Profil/objectif :** nouvel habitant ; comprendre le service et entrer dans la découverte.
- **Entrée/prérequis :** `/` ou routes couvertes par `src/proxy.ts`; cookie `nl-onboarded` absent entraîne une redirection vers `/onboarding?next=…`.
- **Étapes :** promesse → explication des permissions → règles → ignorer/terminer → cookie local → retour à la destination. Guide d’installation séparé et facultatif (`?step=install`).
- **Effets/retours :** si connecté, la préférence `onboarded` est aussi envoyée à `/api/me/settings`; la réponse n’est pas vérifiée avant la redirection. Si anonyme, seul le cookie navigateur est posé.
- **Erreurs/alternatives :** retour et skip existent ; rechargement repart de `initialStep`, sans persistance de l’étape courante. L’onboarding explique les permissions mais ne les demande pas lui-même.
- **Accès/fichiers/tests :** `proxy.ts`, `Onboarding.tsx`, `onboarding.json`, API settings ; test Playwright de première visite et skip présent.
- **Lacunes/critères :** décider explicitement de la reprise après rechargement ; vérifier que l’échec d’enregistrement serveur ne donne pas un état trompeur. Critère : tests cookie neuf, signé, skip, reload et `next` interne/externe.
- **Confiance :** élevée sur le code ; faible sur le rendu mobile courant.

### F-02 — Inscription, connexion, session et récupération

- **Profil/objectif :** nouvel utilisateur ou utilisateur existant ; créer/reprendre son compte.
- **Entrée/prérequis :** `/login`, éventuellement `mode=signup` et `next` assaini par `safeNext`.
- **Étapes :** email/mot de passe ; pseudo à l’inscription ; API Auth ; confirmation email éventuelle ; callback PKCE ; onboarding ou redirection ; récupération via email puis nouveau mot de passe.
- **Effets/retours :** création Auth et mise à jour du pseudo ; messages génériques limitant l’énumération d’adresses ; limitation par IP/email hachés. Déconnexion appelle `/api/auth/logout`.
- **Erreurs/alternatives :** validation locale et serveur, email non confirmé, identifiants invalides, callback échoué, lien expiré. Routes protégées redirigent vers login ; plusieurs pages protègent la route elles-mêmes.
- **Accès/fichiers/tests :** `AuthForms.tsx`, `api/auth/*`, `auth/callback/route.ts`, `session.ts`; E2E signup/signin et logout API présents. Reset/expiration de session et email non confirmé ne sont pas couverts par les tests listés.
- **Lacunes/critères :** `NewPasswordForm` marque `done` puis navigue immédiatement à `/`, ce qui peut démonter le formulaire avant que la confirmation soit lue. Critère : après reset exécuté via Mailpit, une confirmation non ambiguë précède l’accès normal.
- **Confiance :** élevée sur l’implémentation ; flux email réel non rejoué ici.

### F-03 — Feed, vidéos, filtres et interactions

- **Profil/objectif :** visiteur ou membre ; trouver une information de proximité et agir dessus.
- **Entrée/prérequis :** `/` ; première position expliquée par `PermissionPrimer`, position obtenue à la demande et relue à chaque visite ; `?lat=&lng=` sert aux démos/tests.
- **Étapes :** position → `GET /api/feed` → lecture, pause/son, navigation et pagination → détail, profil, réaction, commentaire, partage ou signalement.
- **Effets/retours :** pagination par curseur, vidéos actives non expirées, position publique approximative, URL signées courtes ; contrôles de réactions et commentaires ont des retours d’erreur et états de chargement.
- **Alternatives :** localisation refusée indique comment l’autoriser dans les réglages ; contenu vidéo expiré/inaccessible mène à un état indisponible ; échec de lecture propose un nouvel essai ; feed vide propose une action selon les chaînes présentes.
- **Accès/fichiers/tests :** `Feed.tsx`, `VideoCard.tsx`, `Comments.tsx`, `ReportDialog.tsx`, API feed/comment/useful/report ; E2E de lecture, mouvement réduit, reprise vidéo, API interactions et pagination sont présents.
- **Lacunes/critères :** aucune preuve actuelle sur petits écrans ni sur l’ordre clavier, lecteur d’écran, sous-titres ou réseau réel. Vérifier chaque retour visible et annonce d’état.
- **Confiance :** élevée sur les contrôles et les tests écrits ; non vérifié visuellement dans ce run.

### F-04 — Carte et position

- **Profil/objectif :** utilisateur ; repérer les vidéos proches.
- **Entrée/prérequis :** `/carte` ; le rayon par défaut vient des préférences si session disponible.
- **Étapes :** primer localisation → position ou refus → création carte → filtre catégorie/rayon → requête `/api/map` → sélection marqueur/cluster → ouverture dans feed.
- **Effets/retours :** RPC de proximité et coordonnées publiques approximatives ; compteur, chargement, erreur et bouton retry prévus.
- **Alternatives :** refus/erreur présente une instruction et nouvelle tentative ; filtre vide possible. Une position précise de l’utilisateur n’est pas persistée par le hook.
- **Accès/fichiers/tests :** `MapView.tsx`, `MapFiltersDialog.tsx`, `useLocation.ts`, `/api/map`; E2E API de coordonnées floutées, mais pas de couverture complète de la carte interactive repérée.
- **Lacunes/critères :** vérifier le focus clavier et l’usage sans carte visuelle, le refus définitif, absence de marqueurs et erreur réseau sur vrai navigateur.
- **Confiance :** élevée sur les branches codées ; aucune session navigateur exécutée.

### F-05 — Capture, publication et traitement

- **Profil/objectif :** membre avec pseudo ; publier une courte vidéo de son quartier.
- **Entrée/prérequis :** `/filmer` exige session et pseudo ; catégorie commerce réservée au statut approuvé.
- **Étapes :** explication → caméra/micro → enregistrement (30 s max selon constante partagée) → aperçu/refaire → catégorie/légende/durée → position fraîche ≤ 100 m → réservation serveur → upload TUS → confirmation `uploaded` → job worker → `active` ou `rejected` → suivi dans `/me`.
- **Effets/retours :** `create_video` valide identité, précision, cohérence position, quota et débit ; worker traite/floute/transcode, supprime l’original au succès, retente puis rejette ; page vidéo personnelle interroge périodiquement `processing`.
- **Alternatives :** caméra refusée/absente/non supportée affiche un message ; position refusée/imprécise reste récupérable ; hors ligne immédiat conserve vidéo et métadonnées localement ; l’utilisateur peut retirer sa vidéo.
- **Accès/fichiers/tests :** `Camera.tsx`, `CaptureFlow.tsx`, `publish.ts`, `offline-queue.ts`, `OfflineQueueRunner.tsx`, API videos, worker, fonctions SQL ; E2E de publication réussie, précision insuffisante et tests unitaires de format/règles hors ligne présents.
- **Lacune critique :** si la réservation `POST /api/videos` a réussi puis TUS échoue, `PublishError` ne restitue pas `videoId/uploadPath`; `CaptureFlow` met en file blob+meta seulement et le runner rappelle `publish` sans cible existante. Une seconde ligne vidéo peut être réservée, la première restant en `processing` sans job. Aucune reprise réseau automatique ne couvre ce cas.
- **Critère :** test coupe réseau après réponse de réservation, rétablit réseau, vérifie une seule ligne vidéo, reprise du même upload, transition de statut et absence de résidu bloqué.
- **Confiance :** élevée sur le chemin de code ; scénario non exécuté.

### F-06 — Profil, préférences et données

- **Profil/objectif :** membre ; modifier ses informations, régler langue/rayon, consulter ses données ou quitter le service.
- **Entrée/prérequis :** `/parametres`; `/me` redirige vers profil public du membre ; `/u/[username]` public.
- **Étapes :** profil/avatars → sauvegarde API → préférences de rayon/langue/push → export JSON → saisie du pseudo pour suppression → suppression des fichiers, lignes et utilisateur Auth puis déconnexion.
- **Effets/retours :** permissions DB/RLS limitent les champs ; export inclut les données propres, y compris la position exacte des publications ; suppression prépare les chemins, tente Storage, supprime l’utilisateur puis s’appuie aussi sur la purge.
- **Erreurs/alternatives :** formulaire profil et export/suppression ont des retours ; suppression nécessite confirmation explicite dans l’UI. La suppression Storage peut être différée si nettoyage immédiat échoue.
- **Accès/fichiers/tests :** settings forms, image form, `/api/me/*`, SQL export/deletion ; E2E export et suppression présents, RLS couvert en SQL.
- **Lacunes/critères :** aucun test actuel de chaque suppression Storage en échec ni d’export complet vérifié ; documenter clairement les éléments conservés et les délais. Le contrôle qualité juridique reste requis.
- **Confiance :** élevée sur le code et couverture RLS ; non rejoué sur instance locale.

### F-07 — Signalement, modération et recours

- **Profil/objectif :** membre, modérateur de zone, admin ou personne sanctionnée ; signaler, examiner ou contester.
- **Entrée/prérequis :** dialogue de signalement vidéo ; `/moderation` et `/me/decisions` exigent une session ; accès modérateur/admin contrôlé par cellules H3 et SQL.
- **Étapes :** motif/détails → insertion report → auto-masquage au troisième signalement distinct → file modération → décision et note si retrait → historique → recours par l’auteur → revue par un autre modérateur/admin.
- **Effets/retours :** actions historisées et immuables ; les tables report et décisions limitent les données visibles par rôle. Les tests SQL couvrent seuil, accès hors zone, note obligatoire et recours.
- **Erreur/état vide :** **défaut** : les erreurs de `moderation_queue`/`appeals_queue` sont ignorées (`data ?? []`) et peuvent être montrées comme files vides ; l’erreur sur la requête de cellules est aussi absorbée.
- **Accès/fichiers/tests :** `moderation/page.tsx`, `ModerationClient.tsx`, `Decisions.tsx`, API report/moderation/appeals/admin, `020_rls` et `040_moderation`; E2E report→masquage→retrait présent, pas de parcours E2E de recours trouvé.
- **Critères :** injecter erreurs distinctes, prouver un état erreur/action retry séparé d’une file réellement vide ; couvrir dépôt, décision de recours et accès refusé.
- **Confiance :** élevée pour le masquage d’erreur statique et les protections SQL ; UI non rejouée.

### F-08 — Commerce

- **Profil/objectif :** visiteur, candidat, demande en attente/refusée, commerce approuvé.
- **Entrée/prérequis :** `/commerces` public ; `/commerce` exige connexion ; `/commerces/decouvrir` annuaire public authentifié par le groupe d’app ; publication `shop` exige approbation et quota.
- **Étapes :** proposition publique → login éventuel → formulaire entreprise → demande `pending` → décision admin → statut/refus/approbation → quota → vidéo filmée sur place.
- **Effets/retours :** une demande par compte, statut enregistré ; annuaire lit les seuls commerces approuvés, max 100, recherche nom/présentation et lien profil. Modèle sans catégorie/distance pour les commerces.
- **Lacunes :** sur `/commerce`, l’erreur de lecture de `merchant_profiles` est assimilée à absence de demande et peut afficher le formulaire une nouvelle fois. L’API évite le doublon, mais l’utilisateur peut recevoir une erreur de conflit au lieu d’un état serveur dégradé. Quota affiché par requête distincte à recouper avec contrôle SQL.
- **Tests/fichiers :** page publique et soumission de demande testées ; API demande pending/doublon testée ; décision de statut, quota affiché, refus et approbation n’ont pas une couverture E2E complète identifiée.
- **Critères :** essais pending/approved/rejected/quota/erreur serveur, statuts UI alignés sur la réponse et impossibilité d’accès direct aux actions commerce sans approbation.
- **Confiance :** élevée sur les chemins codés, intermédiaire sur les états UI non testés.

### F-09 — Administration

- **Profil/objectif :** admin ; piloter demandes, modération, utilisateurs, journal et worker.
- **Entrée/prérequis :** `/admin` renvoie 404 aux rôles non admin ; les fonctions API/SQL revérifient `is_admin`.
- **Étapes :** indicateurs et files → filtres/recherche/pagination → décision motivée → confirmation UI → RPC SQL → journal.
- **États :** la page traite explicitement plusieurs erreurs de requête ; d’autres chargements secondaires (ex. disponibilité worker) sont convertis en liste vide/absence d’information.
- **Tests/fichiers :** `admin/page.tsx`, `AdminClient.tsx`, `/api/admin`, migrations admin et E2E dashboard. Le test existant ne valide pas chaque type d’action et chaque erreur.
- **Critères :** injecter erreur vs vraie file vide pour chaque section, double clic, recherche sans résultat, action refusée et historique durable.
- **Confiance :** forte sur les garde-fous statiques, non vérifiée dans navigateur à cette phase.

### F-10 — PWA, hors ligne et push

- **Profil/objectif :** utilisateur web installé ou navigateur compatible ; retrouver l’application et recevoir des alertes.
- **Entrée/prérequis :** manifest/service worker ; PushSettings nécessite session, PushManager, Notification et position pour choisir une cellule d’alerte.
- **Étapes :** proposition d’installation facultative → permission notification → position ponctuelle → subscription navigateur + zone H3 → suppression locale et côté serveur.
- **Effets/retours :** stockage zone/cellule, pas du GPS exact ; API et médias signés en NetworkOnly ; notifications gérées par worker.
- **Risque :** le fallback `NetworkFirst` s’applique à toute navigation dans le cache `pages`, sans exclusion visible des routes personnelles/admin. Le code ne montre pas d’effacement de ce cache lors de déconnexion. L’exposition d’une réponse HTML privée est à confirmer dans un navigateur/service worker réel avant de qualifier l’impact.
- **Erreurs :** refus/absence de position ont des messages ; exceptions de `requestPermission`, `pushManager.subscribe`, API de retrait ou `detectState()` ne sont pas toutes capturées, et le retrait ignore le résultat API avant d’afficher `off`.
- **Tests/fichiers :** `sw.ts`, `PwaShell.tsx`, `PushSettings.tsx`, `/api/push/subscribe`; API push testé avec endpoint factice, pas d’essai de notification réelle ni de cache privé offline.
- **Critères :** offline après visite admin/profil, déconnexion puis autre session ; aucune donnée privée présentée depuis cache ; échecs permission/subscribe/unsubscribe annoncés et état serveur cohérent.
- **Confiance :** risque cache établi par le matcher ; exposition réelle non vérifiée.

### F-11 — Internationalisation et accessibilité

- **Langues :** 15 namespaces FR/EN ont été comparés récursivement ; aucune différence de clés ou de tailles de tableaux détectée. `loadMessages` fusionne l’anglais avec le français, donc toute traduction manquante retombe sur le français.
- **Accessibilité observée dans le code :** lien d’évitement, champs étiquetés, annonces `role=status/alert`, progression d’upload, contrôle mouvement réduit, cible tactile 44 px pour certains contrôles, dialogue natif `<dialog>` pour le panneau de filtres.
- **Non établi :** contraste global, focus et tabulation sur tous les écrans, lecteur d’écran, navigation dans la carte, textes anglais effectivement rendus, agrandissement/zoom, sous-titres de vidéos et zones de sécurité sur appareils réels.
- **Tests/fichiers :** tests de couleur générée/CSP et parité de messages ; pas de parcours E2E clavier/lecteur d’écran ni de test anglais global repéré.
- **Critères :** matrice mobile et desktop avec clavier seul, zoom 200 %, lecteur d’écran, mouvement réduit, EN, labels vidéo et audit contraste calculé sur les composants réellement rendus.
- **Confiance :** forte sur parité des fichiers ; aucune conclusion de conformité globale.

## 4. Matrice de couverture

Échelle : **Complet et vérifié** = rejoué avec preuve dans cet audit ; **implémenté mais non vérifié** = code présent, exécution absente ici ; **partiel** = au moins un état, branche ou preuve critique manque ; **manquant** = aucun mécanisme trouvé ; **bloqué** = environnement empêche le contrôle.

| Parcours              | Implémentation    | Explications        | États/erreurs                       | Accessibilité       | Sécurité                         | Tests existants                     | Validation de cet audit / lacunes                                    |
| --------------------- | ----------------- | ------------------- | ----------------------------------- | ------------------- | -------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Onboarding            | Implémenté        | Implémentées        | Partiel (reprise)                   | Partiel             | Cookie non sensible + redirect   | E2E première visite                 | Implémenté mais non vérifié visuellement ; progression non persistée |
| Authentification      | Implémenté        | Implémentées        | Partiel (reset/session expirée)     | Partiel             | Rate limit, Origin, validation   | E2E signup/signin/logout            | Implémenté mais non vérifié ; reset non rejoué                       |
| Feed/interactions     | Implémenté        | Implémentées        | Partiel (certains chargements)      | Partiel             | RLS/API, position floutée        | E2E feed, API, reports              | Implémenté mais non vérifié ; cas mobile/erreur non exhaustifs       |
| Carte                 | Implémenté        | Implémentées        | Implémenté dans le code             | Non vérifié clavier | Position floutée                 | Test API GeoJSON                    | Implémenté mais non vérifié en UI                                    |
| Capture/publication   | Implémenté        | Implémentées        | Partiel (reprise après réservation) | Partiel             | Validation SQL, stockage privé   | Unitaires + E2E succès/précision    | Partiel ; doublon possible après rupture TUS                         |
| Profils/paramètres    | Implémenté        | Partiel             | Partiel (erreur vidéos masquée)     | Partiel             | RLS, export/suppression protégés | E2E export/suppression; SQL RLS     | Partiel ; erreur de chargement et purge non éprouvées                |
| Commerce              | Implémenté        | Implémentées        | Partiel (erreur requête)            | Non vérifié         | Approbation/quota SQL            | E2E landing/API demande             | Partiel ; états décision/quota incomplets en E2E                     |
| Modération/recours    | Implémenté        | Implémentées        | Partiel (erreur traitée comme vide) | Non vérifié         | RLS et fonctions SQL             | pgTAP + E2E report/retrait          | Partiel ; erreurs files et recours E2E manquants                     |
| Admin                 | Implémenté        | Implémentées        | Partiel selon requêtes              | Non vérifié         | Route + RPC admin                | E2E dashboard, pgTAP                | Implémenté mais non vérifié ; actions/erreurs non exhaustives        |
| PWA/offline/push      | Implémenté        | Implémentées        | Partiel (exceptions et cache)       | Non vérifié         | Risque cache à vérifier          | Tests unitaires et API push factice | Bloqué pour validation appareil ; privacy cache prioritaire          |
| Français/anglais      | Implémenté        | Parité structurelle | Fallback FR intentionnel            | Partiel             | Sans objet                       | Contrôle structurel fait            | Rendu et relecture anglaise non vérifiés                             |
| Légal/confidentialité | Brouillon présent | Incomplètes         | N/A                                 | Non vérifié         | Informations éditeur absentes    | Aucun test juridique                | Bloqué avant usage public par données d’éditeur et revue juridique   |

## 5. Registre des lacunes

### SEC-001 — Réponses de navigation privée potentiellement mises en cache

- **Priorité : P0 (validation confidentialité avant mise en production). Confiance : risque statique élevé, impact réel à reproduire.**
- **Preuve/emplacement :** `apps/web/src/app/sw.ts:61-64` applique `NetworkFirst` à chaque `request.mode === 'navigate'` dans le cache `pages`. Plusieurs destinations (`/admin`, `/parametres`, `/commerce`, `/me/decisions`) contiennent des données liées à la session. Aucun effacement du cache `pages` au logout n’est visible dans `sw.ts` ou `LogoutButton.tsx`.
- **Problème/conséquence :** une page personnalisée peut potentiellement rester disponible hors ligne après fermeture de session ou changement de compte sur un appareil partagé. Le code établit un large cache ; il ne prouve pas que le HTML privé est effectivement servi.
- **Correction :** mettre les routes authentifiées en `NetworkOnly` ou utiliser une stratégie conditionnelle sûre, et invalider les caches pertinents à la déconnexion. N’autoriser le cache de pages que pour une liste publique explicitement définie.
- **Acceptation/non-régression :** test navigateur service worker : ouvrir une route personnelle, couper le réseau, se déconnecter/changer d’utilisateur, revisiter ; aucun profil, commentaire privé, écran admin ou données de session ne doit apparaître depuis Cache Storage. Pages publiques hors ligne continuent de respecter le comportement prévu.

### FLOW-001 — Reprise d’un upload réservant une deuxième vidéo

- **Priorité : P1. Confiance : élevée.**
- **Preuve/emplacement :** `apps/web/src/lib/publish.ts` garde `videoId/uploadPath` localement et ne les place pas dans `PublishError`; `CaptureFlow.tsx` met uniquement blob/meta/fix en queue après erreur récupérable ; `OfflineQueueRunner.tsx` appelle `publish` sans paramètre `existing`. Le schéma `QueuedPublication` prévoit `reserved?`, mais l’appel de queue ne le renseigne pas.
- **Problème/conséquence :** coupure après `POST /api/videos` réussi mais pendant TUS : le retry recrée une réservation, peut laisser la première vidéo `processing` sans job et créer un doublon.
- **Correction :** rendre l’opération reprenable avec identifiant, chemin, étapes idempotentes et stratégie d’abandon/purge pour réservations orphelines.
- **Acceptation/non-régression :** E2E coupe réseau entre réservation et fin TUS, restaure la connexion, vérifie même identifiant, une seule vidéo, job unique, statut final et aucune ligne bloquée. Rejouer aussi coupure avant réservation et après upload avant confirmation.

### ERROR-001 — Erreur de file de modération confondue avec état vide

- **Priorité : P1. Confiance : élevée.**
- **Preuve/emplacement :** `apps/web/src/app/(app)/moderation/page.tsx:54-79` ignore les erreurs de requêtes `pendingQuery`, `moderation_queue` et `appeals_queue` et remplace les données nulles par `[]`.
- **Problème/conséquence :** une panne de base/RPC peut indiquer « aucune décision à traiter » à un modérateur et retarder une action de sécurité.
- **Correction :** représenter séparément `loading`, `ready/empty` et `error`, avec nouvel essai et éventuellement corrélation opérationnelle sans détails sensibles.
- **Acceptation :** les erreurs de chaque RPC et de la requête de cellules affichent un message distinct ; une vraie file vide conserve son texte d’état vide.

### ERROR-002 — Échec de récupération des vidéos personnelles masqué

- **Priorité : P2. Confiance : élevée.**
- **Preuve/emplacement :** `apps/web/src/components/profile/MyVideos.tsx:26-27, 45-47, 69` renvoie `null` en cas d’échec et masque toute la section si données nulles ou liste vide.
- **Conséquence :** un membre ne peut pas distinguer « aucune vidéo » d’une erreur réseau et perd le suivi d’une publication bloquée.
- **Correction/acceptation :** afficher chargement, vide, erreur/retry séparément ; test API 500 et feed vide distinct.

### ERROR-003 — Échec de chargement commerçant interprété comme absence de demande

- **Priorité : P2. Confiance : élevée.**
- **Preuve/emplacement :** `apps/web/src/app/(app)/commerce/page.tsx:37-41` lit `data` sans tester `error`, puis affiche le formulaire si `merchant` est nul.
- **Conséquence :** demande existante invisible ; l’utilisateur peut soumettre de nouveau et obtenir un conflit générique.
- **Correction/acceptation :** état d’erreur avec nouvel essai distinct de « aucune demande » ; tests pending/erreur/doublon.

### ERROR-004 — Exceptions push non traduites en état récupérable

- **Priorité : P2. Confiance : élevée sur code, navigateur requis pour reproduction.**
- **Preuve/emplacement :** `PushSettings.tsx` gère un refus explicite mais `enable()` n’a pas de `catch`; `detectState()` est appelé par `.then` sans catch ; `disable()` ignore l’échec HTTP avant d’afficher `off`.
- **Conséquence :** promesse rejetée ou erreur navigateur peut laisser la carte en état `loading`, faire disparaître l’erreur, ou présenter un désabonnement terminé alors que l’API a échoué.
- **Correction/acceptation :** capturer erreurs de permissions, service worker, abonnement, requête et désabonnement ; ne confirmer un changement qu’après accord serveur/local cohérent.

### FLOW-002 — L’étape d’onboarding ne reprend pas après rechargement

- **Priorité : P2. Confiance : élevée.**
- **Preuve/emplacement :** `Onboarding.tsx` initialise l’étape par `useState(initialStep)` et ne persiste `step`; seul le cookie de fin est écrit.
- **Conséquence :** fermeture/rechargement relance l’onboarding au début. Le besoin de reprendre ou recommencer est un choix produit à trancher.
- **Correction/acceptation :** soit persister uniquement le numéro d’étape sans données personnelles, soit préciser que l’onboarding recommence. Test reload, retour, skip.

### FLOW-003 — Confirmation de changement de mot de passe non durable

- **Priorité : P2. Confiance : forte.**
- **Preuve/emplacement :** `AuthForms.tsx` appelle `setDone(true)` puis `router.replace('/')`; la navigation démonte potentiellement le formulaire avant affichage du notice `reset.done`.
- **Conséquence :** l’action peut réussir sans message visible de confirmation ou étape suivante explicite.
- **Correction/acceptation :** afficher une page/notification de succès après retour API puis fournir un lien de connexion, sans rediriger avant que le retour puisse être lu.

### COPY-001 — Mentions légales avec champs provisoires

- **Priorité : P0 avant présentation publique. Confiance : certaine.**
- **Preuve/emplacement :** `apps/web/messages/fr/legal.json` et `en/legal.json` contiennent nom/adresse/contact, hébergeur du worker, localisations/garanties, clauses de responsabilité et contacts entre crochets. La page affiche un bandeau de brouillon ; cela ne remplace pas les données manquantes.
- **Conséquence :** l’utilisateur ne peut pas identifier l’éditeur ni ses voies de contact ; les textes ne peuvent pas servir de version finale.
- **Correction/acceptation :** informations réelles fournies par le responsable du service, cohérence FR/EN, validation juridique documentée avant diffusion.

### COPY-002 — Affirmation tarifaire à confirmer

- **Priorité : P1 avant publication des conditions. Confiance : moyenne.**
- **Preuve/emplacement :** `messages/fr/legal.json` et `en/legal.json` disent que le service est gratuit/de free of charge ; les conditions commerciales définitives ne sont pas établies par les éléments audités.
- **Conséquence :** une promesse tarifaire peut devenir inexacte si le modèle évolue.
- **Correction/acceptation :** confirmer la politique commerciale ; garder un texte identique et exact en FR/EN ou retirer la promesse tant qu’elle n’est pas décidée.

### DOC-001 — Référence à une politique de confidentialité absente

- **Priorité : P2. Confiance : certaine.**
- **Preuve/emplacement :** `CLAUDE.md` et des notes de progression mentionnent `PRIVACY.md` ; aucun `PRIVACY.md` n’existe dans le dépôt. Les informations associées sont dispersées entre `README.md`, messages légaux et architecture.
- **Conséquence :** les limites techniques et engagements de confidentialité risquent de diverger entre documents.
- **Correction/acceptation :** créer/renommer une source de référence cohérente ou corriger les renvois ; vérifier qu’elle décrit exactement position, floutage, stockage, rétention, notifications et suppression.

### TEST-001 — Absence d’E2E de reprise après rupture TUS

- **Priorité : P1.** La suite teste publication complète et certaines règles de file hors ligne, mais aucun scénario ne coupe l’upload après réservation puis vérifie la reprise idempotente.
- **Acceptation :** test décrit sous FLOW-001 ; ajouter assertions DB sur `videos`, `media_jobs`, statut worker et chemin storage.

### TEST-002 — Matrice négative/plateforme incomplète

- **Priorité : P2.** Aucun E2E repéré pour refus caméra, localisation définitivement bloquée, reset email, session expirée, réseau coupé au milieu du feed/commentaire, affichage anglais global, navigation clavier, route inconnue, et push réel sur appareil.
- **Acceptation :** scénarios priorisés en section 7, exécutés sur Chromium desktop et téléphones cibles ; publier les résultats seulement après exécution.

### A11Y-001 — Accessibilité réelle non démontrée

- **Priorité : P2.** Les attributs ARIA et tests de couleur de catégories constituent des preuves locales, pas une démonstration de conformité du produit complet. Carte canvas, dialogues, petits écrans, zoom, lecteurs d’écran et alternatives vidéo restent à vérifier.
- **Acceptation :** revue avec clavier/lecteur d’écran et contraste mesuré sur chaque parcours prioritaire, avec défauts datés et appareils/navigateurs notés.

## 6. Audit des explications et formulations

| Emplacement / moment                                                               | Texte ou état actuel                                                 | Constat                                                                                                                       | Formulation ou action FR                                                                                                               | Formulation ou action EN                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/legal/confidentialite`, `/legal/conditions`, `/legal/regles`, avant usage public | Champs entre crochets ; bandeau « document de travail incomplet »    | Avertissement honnête, mais informations essentielles manquantes ; ne pas remplacer par un texte générique                    | Renseigner l’éditeur, l’adresse, le contact, l’hébergeur, les transferts et les clauses après décision réelle et validation juridique. | Supply actual publisher, address, contact, processor/hosting, transfer safeguards, and clauses after factual/legal review. |
| Conditions générales                                                               | « Le service est gratuit »                                           | La politique tarifaire n’est pas corroborée par un engagement produit pérenne dans le périmètre consulté.                     | À confirmer avec le responsable ; sinon retirer la phrase des conditions jusqu’à décision.                                             | Confirm with the service owner; otherwise remove the statement until pricing policy is decided.                            |
| Capture/onboarding                                                                 | « le floutage … peut en manquer ; les plaques ne sont pas floutées » | Formulation alignée sur l’état documenté ; garder près de la demande de caméra/publication.                                   | Pas de correction proposée.                                                                                                            | No change proposed.                                                                                                        |
| Feed/alertes                                                                       | « publications de la communauté, pas des alertes officielles … 112 » | Limite et prochaine action d’urgence explicites ; vérifier visibilité et contraste dans l’interface réelle.                   | Pas de correction proposée.                                                                                                            | No change proposed.                                                                                                        |
| Localisation refusée                                                               | Explique réglages du navigateur et nouvel essai                      | Texte prévu en FR/EN ; vérifier le chemin quand le navigateur ne permet pas de re-demander sans changement dans les réglages. | Conserver un lien/indication de réglages propre à la plateforme si réalisable ; ne pas relancer en boucle.                             | Keep platform-specific settings guidance where possible; never prompt repeatedly in a loop.                                |
| Traduction anglaise                                                                | 15 fichiers structurellement alignés, fallback FR                    | La parité de clés ne prouve ni rendu EN complet ni idiomaticité.                                                              | Relecture native et essais écran par écran.                                                                                            | Native-language review and rendered journey checks.                                                                        |

## 7. Plan de tests priorisé

Les tests listés ci-dessous sont **à exécuter** sauf les contrôles effectivement indiqués en section 8. Aucun résultat observé n’est inventé.

| ID    | Niveau                 | Préconditions/scénario                                            | Étapes et résultat attendu                                                                                            | Statut / preuve / défaut                                                             |
| ----- | ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| T-001 | E2E + DB               | Utilisateur connecté, worker local                                | Couper réseau après réservation avant TUS ; revenir en ligne ; même vidéo reprise, aucun doublon/résidu `processing`. | À exécuter ; `publish.spec.ts` couvre seulement le succès ; FLOW-001                 |
| T-002 | E2E                    | Permission caméra refusée puis autorisée dans réglages navigateur | Ouvrir filmer, vérifier message/reprise sans perte ; aucun écran bloqué.                                              | À exécuter ; TEST-002                                                                |
| T-003 | E2E/DB                 | Route modération et RPC en erreur                                 | Injecter erreur de file et distinguer du tableau vide, bouton retry fonctionnel.                                      | À exécuter ; ERROR-001                                                               |
| T-004 | E2E                    | `/api/me/videos` en erreur et liste réellement vide               | Erreur visible dans le premier cas, état vide explicite dans le second.                                               | À exécuter ; ERROR-002                                                               |
| T-005 | E2E                    | Commerce pending + backend indisponible                           | Afficher attente si ligne existe ; état erreur si lecture échoue, aucune fausse demande nouvelle.                     | À exécuter ; ERROR-003                                                               |
| T-006 | E2E service worker     | Admin/profil consulté puis offline/logout/changement de compte    | Aucune page ni donnée privée servie depuis cache ; public/offline conforme.                                           | Bloqué par serveur/daemon ; SEC-001                                                  |
| T-007 | E2E                    | Inscription/reset/confirmation email                              | Vérifier messages neutres, Mailpit, lien expiré, mot de passe mis à jour et confirmation visible.                     | À exécuter ; `journeys.spec.ts` ne couvre que signup/signin ; FLOW-003               |
| T-008 | E2E                    | Feed vide, erreur serveur, session expirée                        | Message distinct, action de reprise, redirection de retour sans perte inutile.                                        | À exécuter ; TEST-002                                                                |
| T-009 | E2E/API                | Réaction/commentaire/signalement                                  | Double clic, invalides, déjà signalé, seuil trois reporters, retrait par auteur seulement.                            | Partiellement couvert par test API/E2E existant ; étendre erreurs/double soumission. |
| T-010 | SQL/DB                 | RLS par anon/user/banni/modérateur/admin/commerce                 | Vérifier chaque rôle, cellule de zone, auto-approbation impossible, décisions immuables, quotas et données privées.   | Tests écrits ; `test:db` non lancé pendant cet audit ; bloqué environnement.         |
| T-011 | E2E                    | Demande commerçante pending→approved/rejected                     | Décision admin, retour commerçant, quotas/limite, accès `shop` autorisé uniquement après approbation.                 | Couverture E2E partielle ; à compléter.                                              |
| T-012 | E2E                    | Upload traitement worker en erreur puis succès                    | `processing` reflété, retry et rejet visibles, absence de doublon, original supprimé au succès.                       | SQL couvre retries ; E2E de succès existe, échec média E2E à ajouter.                |
| T-013 | E2E                    | Anglais global, desktop et mobile                                 | Parcourir onboarding, auth, feed, publication, réglages, commerce, erreurs ; aucune chaîne française inattendue.      | À exécuter ; parité structurelle seulement réalisée.                                 |
| T-014 | A11Y manuel/automatisé | Clavier seul, lecteur d’écran, zoom 200 %, mouvement réduit       | Ordre/focus visibles, dialogues fermables, erreurs annoncées, carte alternative et contrôles vidéo utilisables.       | À exécuter ; A11Y-001                                                                |
| T-015 | Manuel appareils       | iPhone Safari + Android Chrome                                    | Caméra/micro, MP4/WebM, géolocalisation, PWA install, push, orientation, safe areas et reprise hors ligne.            | Bloqué sans appareils réels ; mentionné dans `PROGRESS.md`.                          |
| T-016 | E2E                    | Export, suppression, session/stockage                             | Export des données attendues ; suppression account et fichiers, logout, absence de réapparition.                      | E2E et SQL existants ; compléter les erreurs Storage/purge.                          |

## 8. Contrôles réellement exécutés pendant cet audit

| Contrôle                       | Résultat observé                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm test`                    | Réussi : 3 suites, 47 tests (15 shared, 13 web, 19 worker).                                                        |
| `pnpm typecheck`               | Réussi : les workspaces ont terminé sans erreur.                                                                   |
| Parité FR/EN                   | Vérification récursive locale : 15 namespaces, aucun écart structurel. Ce n’est pas une revue de traduction.       |
| `pnpm lint`                    | Réussi : ESLint terminé sans erreur.                                                                               |
| `pnpm test:db`                 | Non exécuté : prérequis Supabase/Docker absent ; `supabase status` n’a pas pu écrire sa télémétrie hors workspace. |
| `pnpm test:e2e`                | Non exécuté : daemon Docker indisponible, stack Supabase/worker non prête ; serveur web local absent.              |
| Inspection navigateur/appareil | Non réalisée : local web inaccessible ; Computer Use a été stoppé sur incertitude de l’URL courante Chrome.        |

La documentation du dépôt rapporte une exécution antérieure de `test:db` (213 assertions) et `test:e2e` (18/18), mais elle indique aussi que plusieurs modifications plus récentes restent non vérifiées. Ces résultats sont conservés comme historique documentaire et ne sont pas présentés comme des exécutions de cet audit.

## 9. Plan de correction

| Priorité | Tâche                                                                 | Complexité                           | Dépendances/fichiers                                                    | Terminé lorsque                                                                                                                    |
| -------- | --------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Vérifier et fermer le risque de cache privé                           | M                                    | `sw.ts`, layout, logout, tests E2E                                      | Aucun contenu personnalisé ne persiste offline après logout/changement de compte ; pages publiques gardent leur stratégie définie. |
| P0       | Finaliser les textes légaux et informations d’éditeur                 | Bloqué par décision métier/juridique | `messages/fr/legal.json`, `messages/en/legal.json`, route légale        | Aucun placeholder ; toutes les informations sont exactes et revue enregistrée avant usage public.                                  |
| P1       | Rendre l’upload idempotent et reprenable                              | M/L                                  | `publish.ts`, `CaptureFlow.tsx`, `offline-queue.ts`, API `/videos`, SQL | Reprise au même ID ou nettoyage explicite, aucune duplication après coupure, E2E/DB passent.                                       |
| P1       | Ajouter états erreur des files modération                             | S/M                                  | `moderation/page.tsx`, messages, tests                                  | Échec réseau ne ressemble jamais à une file vide ; retry et états accessibles.                                                     |
| P1       | Compléter le test de rôles commerce/modération/recours                | M                                    | E2E + SQL tests                                                         | Parcours attente/approbation/refus/recours et refus d’accès couvrent UI et backend.                                                |
| P2       | Rendre erreurs vidéos personnelles et profil commerce visibles        | S                                    | `MyVideos.tsx`, commerce page, messages, tests                          | Chargement, vide et erreur ont trois rendus et actions cohérents.                                                                  |
| P2       | Encadrer erreurs Push                                                 | S/M                                  | `PushSettings.tsx`, API push, tests                                     | Permission, subscription et unsubscribe refusés n’affichent jamais un faux état actif/inactif.                                     |
| P2       | Décider de la reprise onboarding et confirmer succès reset            | S                                    | `Onboarding.tsx`, `AuthForms.tsx`, E2E                                  | Comportement explicite, confirmé et régressions couvertes.                                                                         |
| P2       | Réaliser validation a11y/i18n/appareils                               | M/L                                  | Tous parcours, tests manuels                                            | Résultats par navigateur/appareil enregistrés ; défauts bloquants corrigés et vérifiés.                                            |
| P3       | Compléter textes alternatifs/captions vidéo et mesures non intrusives | M                                    | Feed et produit                                                         | Décision de besoin et exigences définies sans collecte GPS précise.                                                                |

## 10. Checklist de préparation

- [ ] Toutes les routes et variantes de rôle ont un point d’entrée connu.
- [ ] Chaque action importante a une validation serveur et une réponse UI explicite.
- [ ] Les erreurs sont distinctes d’un état vide et offrent une reprise quand elle est possible.
- [ ] Les routes personnelles, rôles et fonctions sensibles sont protégés côté serveur/SQL.
- [ ] Upload/reprise/traitement ne créent ni doublon ni publication bloquée silencieuse.
- [ ] Refus caméra/localisation/notifications donne une prochaine étape sans boucle.
- [ ] Position exacte, fichiers originaux, URL signées et abonnements suivent les règles annoncées.
- [ ] Suppression/export sont testés en cas de succès et d’échec de stockage.
- [ ] Décisions, signalements, recours et accès admin sont testés par rôle.
- [ ] Aucune mention légale temporaire ne reste avant exposition publique.
- [ ] Français et anglais sont relus et affichés correctement dans chaque parcours.
- [ ] Clavier, lecteur d’écran, zoom, contraste, mouvement réduit et cibles tactiles sont vérifiés.
- [ ] E2E, tests SQL, tests unitaires et essais d’appareils ont des résultats datés et reproductibles.
- [ ] Chaque limite non vérifiée est publiée avec son impact et son propriétaire.
