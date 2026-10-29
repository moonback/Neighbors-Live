# Neighbors Live

**Neighbors Live** est une application web progressive (PWA) de vidéos courtes hyperlocales. Les
habitants y partagent des informations utiles à proximité : alertes, bons plans, événements,
entraide, offres de commerces et objets perdus ou trouvés.

> **État du projet : développement actif.** Le dépôt contient les parcours principaux d’authentification,
> de publication vidéo, de découverte, de modération, d’administration et de commerce. Les limites et
> vérifications réelles sont suivies dans [docs/PROGRESS.md](docs/PROGRESS.md). Les textes juridiques
> sont encore des brouillons : l’application ne doit pas être considérée comme prête pour une
> présentation publique ou une mise en production sans validation complémentaire.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Parcours et règles produit](#parcours-et-règles-produit)
- [Architecture](#architecture)
- [Vie privée et sécurité](#vie-privée-et-sécurité)
- [Prérequis](#prérequis)
- [Démarrage local](#démarrage-local)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Commandes](#commandes)
- [Configuration](#configuration)
- [Tests et CI](#tests-et-ci)
- [Structure du dépôt](#structure-du-dépôt)
- [Déploiement](#déploiement)
- [Limites connues](#limites-connues)
- [Documentation associée](#documentation-associée)

## Fonctionnalités

### Habitants

- Inscription, connexion et récupération de mot de passe par e-mail, avec choix d’un pseudo unique.
- Feed vidéo vertical, filtres par catégorie, rayons de 300 m, 1 km, 3 km, 5 km et 10 km, lecture
  automatique adaptée au réglage de mouvement réduit, pagination et lien direct vers une vidéo.
- Carte interactive des publications proches, avec regroupement des marqueurs.
- Capture depuis la caméra du navigateur, aperçu avant publication, caméra avant/arrière selon la
  plateforme et durée maximale de 30 secondes. L’import d’une vidéo depuis la galerie n’est pas
  proposé.
- Réactions « Utile », commentaires, partage et signalements.
- Vidéos enregistrées et masquées synchronisées au compte, avec gestion depuis le profil.
- Profils publics avec vidéos, réputation et badges; préférences, décisions de modération, export et
  suppression du compte dans les pages personnelles.
- Installation PWA, page hors ligne et notifications Web Push lorsque le navigateur, les permissions
  et les clés de configuration le permettent.

### Commerces

- Présentation de l’offre commerçante et demande de compte commerce.
- Revue administrative des demandes et annuaire des commerces approuvés.
- Après approbation, publication d’offres filmées sur place, avec badge commerce et quota quotidien
  indiqué dans l’espace commerçant.

### Modération et administration

- Signalements par les habitants et masquage automatique au seuil configuré (trois comptes distincts
  par défaut dans le modèle actuel).
- Files de revue par cellule de quartier H3, candidatures de modérateur, décisions journalisées et
  recours.
- Tableau de bord administrateur : utilisateurs et rôles, vidéos et zones, signalements, recours,
  demandes de compte commerce et réglages du traitement média.
- Les réglages du floutage sont capturés au moment de la création du job; les tentatives d’un même job
  réutilisent ces réglages.

Les contrôles d’accès sont appliqués côté serveur et base de données. Une page présente dans
l’interface ne signifie pas à elle seule que tous ses cas d’erreur ont été validés en E2E.

## Parcours et règles produit

### Catégories et durée de visibilité

| Catégorie             | Durée actuelle                           |
| --------------------- | ---------------------------------------- |
| Alerte (`alert`)      | 6 heures                                 |
| Bon plan (`deal`)     | 48 heures                                |
| Événement (`event`)   | Jusqu’à la fin indiquée, au plus 7 jours |
| Entraide (`help`)     | 7 jours                                  |
| Commerce (`shop`)     | Choix de 6, 24, 48, 72 ou 168 heures     |
| Perdu/trouvé (`lost`) | 7 jours                                  |

Les textes affichés et les constantes partagées doivent rester alignés sur ces valeurs.

### Publication vidéo

1. Le navigateur filme avec `MediaRecorder`, vérifie la disponibilité d’une position et refuse une
   précision GPS supérieure à 500 m. La légende est limitée à 140 caractères et l’upload à 500 Mio.
2. `POST /api/videos` valide le contenu, les limites de débit, la cohérence de la position, la durée
   et les règles de compte; la ligne est créée en état `processing`.
3. Le navigateur envoie le fichier au bucket privé `raw-videos` avec l’upload résumable TUS.
4. Un trigger Storage crée un job média. Le worker le réclame avec `SKIP LOCKED`, est réveillé par
   `LISTEN/NOTIFY` et utilise aussi un polling de secours.
5. Le worker détecte et pixellise les visages, transcode en H.264/AAC jusqu’à 720p et produit une
   miniature. Après succès, il active la publication et supprime le fichier brut.
6. Les jobs média échoués sont retentés avec backoff; après épuisement des tentatives, la publication
   est rejetée. Les fichiers expirés ou supprimés sont pris en charge par la purge.

Une clé de requête stable et une réservation SQL idempotente sont implémentées pour éviter la création de
plusieurs lignes quand une réponse réseau se perd. La migration récente doit encore être validée
par les tests de base de données et E2E; voir les limites ci-dessous.

### Feed, carte et alertes

Le feed et la carte utilisent la RPC SQL `nearby_videos` pour filtrer par distance, catégorie, état
et expiration. Le feed utilise un curseur de pagination. Les URL vidéo et miniature sont signées côté
serveur avec une durée limitée.

Les alertes visibles dans le feed sont chargées depuis le feed puis enrichies en temps réel par
Supabase Broadcast sur des cellules H3. Les mises à jour Broadcast en direct sont limitées à un rayon
de 5 km pour respecter la limite de canaux par client; le feed accepte des rayons jusqu’à 10 km.
Le payload temps réel ne contient qu’une position publique approximative.

### File hors ligne

Les enregistrements mis en attente sont conservés dans IndexedDB sur l’appareil. Avant de les
renvoyer, l’application relève la position à nouveau : elle attend une précision suffisante et ne
reprend la publication que si l’appareil reste à moins de 100 m du lieu de capture. Une vidéo de plus
de 6 heures ou éloignée de son lieu d’origine est abandonnée. La reprise complète doit encore être
vérifiée sur appareil et après interruption réseau.

## Architecture

Le dépôt est un monorepo pnpm :

| Dossier           | Responsabilité                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js App Router : pages, routes API, sessions, carte, feed et PWA                        |
| `apps/worker`     | Worker Node : traitement vidéo, floutage, purge et notifications Web Push                   |
| `packages/shared` | Schémas Zod, types générés, constantes, règles de durée de vie et utilitaires géographiques |
| `supabase`        | Configuration locale, migrations Postgres, seed et tests pgTAP                              |
| `tests/e2e`       | Parcours Playwright                                                                         |
| `scripts`         | Démarrage de Supabase local et préparation des médias de démonstration                      |

### Technologies principales

- **Web :** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, next-intl et Serwist.
- **Services :** Supabase Auth, Postgres 17, PostGIS, Storage, Realtime et pg_cron.
- **Géographie :** PostGIS pour la proximité et H3 pour les zones de modération et de diffusion.
- **Carte :** MapLibre GL; OpenFreeMap est le style par défaut, modifiable par configuration.
- **Médias :** TUS, ffmpeg et ONNX Runtime Node; YuNet est le modèle facial fourni.
- **Qualité :** Vitest, pgTAP, Playwright, ESLint, Prettier et TypeScript.

### Routes principales

| Parcours                        | Routes                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Feed, découverte et carte       | `/`, `/decouvrir`, `/carte`, `/v/[id]`                                                     |
| Capture et comptes              | `/filmer`, `/login`, `/bienvenue`, `/onboarding`, `/mot-de-passe-oublie`, `/reinitialiser` |
| Profils et paramètres           | `/u/[username]`, `/me`, `/me/decisions`, `/parametres`                                     |
| Commerces                       | `/commerces`, `/commerces/decouvrir`, `/commerce`                                          |
| Modération et administration    | `/moderation`, `/admin`                                                                    |
| Textes juridiques et hors ligne | `/legal/[slug]`, `/offline`                                                                |

Les routes API se trouvent sous `/api`: authentification, feed/carte, médias et publications, profils,
commentaires, réactions, signalements, modération, commerces, notifications push, export et suppression
de compte.

## Vie privée et sécurité

- Les buckets vidéo sont privés. Les fichiers vidéo signés et les API ne sont pas mis en cache par le
  service worker; seules des pages explicitement publiques peuvent être conservées pour la navigation
  hors ligne. Les navigations personnelles restent réseau uniquement.
- La position exacte de la vidéo est conservée côté base pour la recherche de proximité. Les réponses
  publiques utilisent une position approximative (environ 50 m) et des distances arrondies à 100 m.
  Les coordonnées de recherche du feed ne sont pas enregistrées comme historique.
- Les abonnements d’alerte utilisent une cellule de zone plutôt que la position GPS brute.
- Les tables sont protégées par RLS. Les routes mutatives valident les données, contrôlent l’origine
  de la requête et appliquent des limites de débit.
- Les fichiers vidéo originaux sont supprimés après traitement réussi; les règles de suppression et
  de conservation doivent être vérifiées dans l’environnement réellement déployé.
- Le modèle YuNet peut manquer de très petits visages ou certains angles. Aucun modèle de plaques
  n’est livré ou activé par défaut; l’interface administrateur ne rend pas un modèle absent fiable.
- Les seules variables `NEXT_PUBLIC_*` doivent être publiques. La clé Supabase `service_role`, la clé
  privée VAPID et le sel de hachage restent côté serveur/worker.

`docs/PRIVACY.md` décrit l’état technique de confidentialité, mais **ce n’est pas une notice juridique
finale**. Les informations d’éditeur, sous-traitants réels, durées, transferts et clauses restent à
confirmer. Les pages légales de l’application affichent encore un avertissement de brouillon.

## Prérequis

- Node.js **22.18 ou supérieur** (Node 24 est utilisé dans la CI actuelle).
- pnpm **10.33.2**, version verrouillée par `packageManager`.
- Docker Desktop ou Docker Engine démarré pour Supabase local et le worker conteneurisé.
- Git.

Le conteneur du worker fournit ffmpeg et télécharge le modèle YuNet pendant la construction. Pour
lancer le worker directement hors Docker, installez ffmpeg localement et téléchargez le modèle avec
`pnpm --filter @nl/worker models:download`.

## Démarrage local

Depuis la racine du dépôt :

```powershell
pnpm install
pnpm db:start
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). `pnpm db:start` démarre Supabase local,
applique les migrations et le seed, crée les variables locales nécessaires si elles manquent,
démarre le worker Docker et prépare les médias de démonstration. Les valeurs générées ne sont pas
écrasées lors d’une relance; supprimez une configuration locale uniquement si vous savez qu’elle est
obsolète et que vous pouvez la régénérer.

Ports locaux configurés : API Supabase **56421**, Postgres **56422**, Studio **56423** et Mailpit
**56424**. L’URL de Mailpit est affichée par `pnpm db:start`; utilisez-la pour consulter les messages
de confirmation et de récupération de mot de passe.

Pour démarrer seulement Supabase et préparer le seed sans le worker, dans PowerShell :

```powershell
$env:SKIP_WORKER = '1'
pnpm db:start
Remove-Item Env:SKIP_WORKER
```

Pour arrêter les services locaux :

```powershell
pnpm db:stop
```

Pour réinitialiser la base et recharger les médias de démonstration :

```powershell
pnpm db:reset
```

`pnpm db:reset` détruit les données locales de Supabase avant de rejouer les migrations et le seed.
Ne l’exécutez pas sur une base contenant des données à conserver.

## Comptes de démonstration

Les comptes suivants sont créés par le seed local :

| Rôle                     | E-mail                           |
| ------------------------ | -------------------------------- |
| Habitant                 | `lea@neighbors.test`             |
| Modérateur de Belleville | `modo.belleville@neighbors.test` |
| Commerce                 | `boulangerie@neighbors.test`     |
| Administrateur           | `admin@neighbors.test`           |

Mot de passe local de démonstration : `voisins2026`. **Ces comptes sont réservés à la base locale**;
ne réutilisez pas ces identifiants dans un environnement partagé ou en production.

## Commandes

À exécuter depuis la racine :

| Commande            | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`          | Démarre l’application web en développement                                  |
| `pnpm worker:dev`   | Lance le worker localement; ffmpeg et le modèle YuNet doivent être présents |
| `pnpm db:start`     | Démarre Supabase, le worker Docker et les médias de démonstration           |
| `pnpm db:stop`      | Arrête Supabase local et le worker Compose                                  |
| `pnpm db:reset`     | Réinitialise Supabase local et recharge les données de démonstration        |
| `pnpm db:types`     | Régénère les types Supabase depuis la base locale                           |
| `pnpm typecheck`    | Vérifie TypeScript dans les workspaces                                      |
| `pnpm lint`         | Exécute ESLint sans avertissements                                          |
| `pnpm format`       | Formate les fichiers avec Prettier                                          |
| `pnpm format:check` | Vérifie le formatage sans modifier les fichiers                             |
| `pnpm test`         | Lance les suites unitaires Vitest                                           |
| `pnpm test:db`      | Lance les tests pgTAP; Supabase doit être démarré                           |
| `pnpm test:e2e`     | Lance Playwright; la stack locale et le worker sont nécessaires             |
| `pnpm build`        | Construit les workspaces avec un script de build                            |

Vérification locale habituelle :

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

La CI GitHub Actions exécute ces contrôles ainsi que les suites base de données et E2E. Les E2E
utilisent Chromium et des périphériques/capacités simulés; ils ne remplacent pas les essais sur
appareils iOS et Android physiques.

## Configuration

Pour un développement local standard, préférez `pnpm db:start`, qui génère les valeurs adaptées à
la Supabase locale. `.env.example` contient des exemples/placeholders et ne doit pas être utilisé
comme configuration de production. Ne partagez pas `.env`, `apps/web/.env.local` ou les valeurs de
clés privées.

### Variables publiques du navigateur

| Variable                        | Usage                                           |
| ------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL de l’API Supabase                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon/publishable non secrète                |
| `NEXT_PUBLIC_SITE_URL`          | Origine utilisée pour les callbacks Auth        |
| `NEXT_PUBLIC_MAP_STYLE_URL`     | URL JSON du style MapLibre                      |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | Clé publique utilisée pour les abonnements push |

Toute variable `NEXT_PUBLIC_*` est intégrée au bundle navigateur et ne doit jamais contenir de secret.

### Variables serveur et worker

| Variable                    | Requise / défaut                           | Usage                                                                     |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Requise pour le worker                     | URL Supabase utilisée par le worker                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Requise, secrète                           | Opérations privilégiées serveur/worker; ne jamais exposer au navigateur   |
| `DATABASE_URL`              | Requise pour le worker                     | Connexion Postgres directe pour LISTEN/NOTIFY et la prise des jobs        |
| `VAPID_PRIVATE_KEY`         | Requise, secrète                           | Signature des notifications push                                          |
| `VAPID_SUBJECT`             | Requise                                    | Contact expéditeur `mailto:` ou URL HTTPS                                 |
| `IP_HASH_SALT`              | Requise côté serveur                       | Sel secret pour hacher des identifiants utilisés par les limites de débit |
| `WORKER_ID`                 | Nom d’hôte                                 | Identifiant du worker                                                     |
| `WORKER_CONCURRENCY`        | `1`, de 1 à 8                              | Nombre maximal de jobs médias simultanés                                  |
| `DETECT_EVERY`              | `2`, de 1 à 10                             | Échantillonnage des images analysées                                      |
| `FACE_BLUR_ENABLED`         | `true`                                     | Active le floutage facial si le modèle est disponible                     |
| `FACE_MODEL_PATH`           | `models/face_detection_yunet_2023mar.onnx` | Chemin du modèle YuNet                                                    |
| `PLATE_BLUR_ENABLED`        | `false`                                    | N’activer qu’avec un modèle compatible installé                           |
| `PLATE_MODEL_PATH`          | Sans valeur par défaut                     | Modèle ONNX de plaques; obligatoire si le détecteur est activé            |
| `PLATE_MODEL_DIR`           | `./models/plates` dans l’exemple           | Dossier hôte monté pour le modèle de plaques Docker                       |
| `POLL_INTERVAL_MS`          | `10000` ms                                 | Intervalle de polling de secours des jobs                                 |
| `OUTBOX_INTERVAL_MS`        | `15000` ms                                 | Intervalle de traitement de la file de notifications                      |

Le worker valide sa configuration au démarrage. Le modèle facial est téléchargé et vérifié par
SHA-256 dans le flux Docker. En exécution locale directe, utilisez :

```powershell
pnpm --filter @nl/worker models:download
pnpm worker:dev
```

Aucun modèle de plaques n’est inclus. Pour activer cette fonction, fournissez un modèle ONNX
compatible, configurez `PLATE_MODEL_PATH` et activez `PLATE_BLUR_ENABLED=true`. Le modèle attendu
par l’adaptateur actuel est un détecteur YOLO à une classe, entrée 640 × 640, sortie `[1, 5, N]`
(coordonnées centre/largeur/hauteur et score; RGB normalisé 0–1). Vérifiez licence et couverture du
modèle retenu : l’activation ne garantit pas que toutes les plaques soient détectées.

Les valeurs `PLATE_BLUR_ENABLED` du `.env.example` et le générateur `pnpm db:start` peuvent différer
selon leur usage; pour le démarrage local généré, le worker facial est activé et le détecteur de
plaques est désactivé. Si vous utilisez un fichier d’environnement manuel, gardez les deux options
cohérentes avec les chemins de modèles effectivement présents.

## Tests et CI

- **Vitest** : constantes, schémas et fonctions partagées, routes web avec clients Supabase simulés,
  et logique de traitement du worker.
- **pgTAP** : schéma, fonctions SQL, RLS et permissions selon les rôles.
- **Playwright** : parcours web Chromium avec géolocalisation et caméra simulées. Supabase local,
  Mailpit et le worker sont utilisés par les scénarios qui en dépendent.
- **GitHub Actions** : formatage, lint, types, tests unitaires, build, tests DB et E2E.

Pour les tests DB, démarrez Supabase avec `pnpm db:start` puis lancez `pnpm test:db`. Pour E2E,
la stack locale complète est nécessaire : `pnpm db:start`, puis `pnpm test:e2e`.

Consultez `docs/PROGRESS.md` avant de considérer un contrôle comme validé : ce document date les
commandes réellement exécutées et distingue les résultats historiques des changements non vérifiés.

## Déploiement

L’architecture cible sépare le web, Supabase et le worker média. Le dépôt contient une configuration
Vercel pour le web, mais cela ne déploie pas à lui seul Postgres, Storage, Realtime ni le worker.

Une configuration de production doit encore définir et valider pour le projet cible :

1. Projet Supabase, migrations, RLS, buckets privés, callbacks Auth et domaines autorisés.
2. Variables publiques côté build web et secrets séparés côté serveur et worker.
3. Connexion Postgres du worker, stockage local des modèles ONNX, ffmpeg et capacité de traitement.
4. Clés VAPID, quotas et fréquence de notifications.
5. HTTPS, CSP/HSTS, sauvegardes, restauration, supervision et procédure de suppression des données.
6. Expiration des URL signées et purge effective des fichiers vidéo dans l’environnement déployé.
7. Essais caméra, géolocalisation, notifications et performances sur les appareils réellement ciblés.

Aucune procédure de déploiement bout en bout n’est considérée comme vérifiée. Le lien Vercel de
prévisualisation ne remplace pas la configuration des services Supabase et du worker.

## Limites connues

- Les textes juridiques sont des brouillons avec des informations d’éditeur et de sous-traitants à
  compléter; `docs/PRIVACY.md` est un état technique, pas un avis juridique final.
- Les tests sur téléphones iOS/Android physiques, notifications push réelles et caméra matérielle
  restent à réaliser.
- YuNet peut manquer de petits visages ou de visages partiellement visibles; aucun modèle de plaques
  n’est livré.
- Les notifications temps réel Broadcast couvrent au plus 5 km actuellement, alors que le feed peut
  chercher jusqu’à 10 km.
- La file hors ligne est contrôlée par position et âge; son scénario complet d’interruption/reprise
  n’est pas encore validé de bout en bout.
- Une migration récente ajoute l’idempotence de réservation après perte de réponse réseau. La
  migration et son test DB/E2E dédié restent à appliquer et à vérifier.
- Les parcours d’export, de suppression de compte et plusieurs erreurs réseau demandent encore des
  vérifications E2E; voir l’audit parcours.
- Le serveur vérifie la précision et la cohérence déclarées de la position, mais ne peut pas prouver
  qu’un client modifié a réellement enregistré la vidéo avec la caméra.
- Les pages juridiques et la disponibilité de l’application ne doivent pas être considérées comme
  prêtes pour un lancement public sans validation produit, sécurité, infrastructure et juridique.

## Documentation associée

- [État du projet, commandes vérifiées et limites](docs/PROGRESS.md)
- [Architecture, données et flux](docs/ARCHITECTURE.md)
- [État technique de confidentialité (brouillon)](docs/PRIVACY.md)
- [Audit exhaustif des parcours utilisateur](docs/AUDIT-PARCOURS-UTILISATEUR.md)
- [Audit contenu et UI/UX](AUDIT-CONTENU-UX.md)
- [Roadmap produit, contenu et UX](roadmap.md)
- [Roadmap produit complète : feed mobile, interactions et nouvelles fonctions](docs/ROADMAP-PRODUIT.md)
- [Roadmap vidéo : capture, édition et lecture](roadmap.video.md)
- [Décisions techniques et dépendances](docs/DECISIONS.md)
- [Plan de refactorisation](docs/REFACTOR-PLAN.md)
- [Consignes de contribution et commandes](CLAUDE.md)
