# Neighbors Live

Neighbors Live est une PWA de vidéos courtes hyperlocales. Elle permet aux habitants de partager
des informations utiles à proximité (alertes, entraide, événements et offres locales) sous forme de
vidéos éphémères, filmées directement dans l’application et modérées à l’échelle du quartier.

Les rayons proposés sont **300 m, 1 km et 3 km**. L’interface est en français par défaut ; les
messages anglais sont également prévus.

> **État du projet :** application en développement actif. Une grande partie du parcours principal
> (publication, traitement média, feed et carte) est implémentée. Les fonctions terminées, les tests
> réellement exécutés et les limites restantes sont suivis dans [docs/PROGRESS.md](./docs/PROGRESS.md).
> Ce dépôt n’est pas une déclaration de disponibilité en production.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Vie privée et sécurité](#vie-privée-et-sécurité)
- [Prérequis](#prérequis)
- [Démarrage local](#démarrage-local)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Commandes](#commandes)
- [Configuration](#configuration)
- [Tests](#tests)
- [Structure du dépôt](#structure-du-dépôt)
- [Déploiement](#déploiement)
- [Limites connues](#limites-connues)
- [Documentation](#documentation)

## Fonctionnalités

### Côté habitant

- Inscription et connexion par e-mail et mot de passe, choix d’un pseudo unique, récupération du
  mot de passe et préférences de langue et de rayon.
- Feed vidéo vertical avec lecture adaptée aux vidéos courtes, filtres par catégorie et proximité,
  pagination et alertes locales.
- Carte interactive des publications proches, avec regroupement des marqueurs et position publique
  approximative.
- Capture depuis la caméra du navigateur, durée maximale d’environ 30 secondes, aperçu avant
  publication et changement de caméra lorsqu’il est pris en charge.
- Publication avec légende, catégorie, durée de vie et géolocalisation. Les catégories disponibles
  sont `alert`, `deal`, `event`, `help`, `shop` et `lost`.
- Upload résumable via TUS, réactions « utile », commentaires, partage et signalement.
- File de publication hors ligne dans IndexedDB ; la position est contrôlée de nouveau avant la
  reprise d’une publication en attente.
- Profil public, réputation, badges et paramètres personnels.
- Installation PWA, page hors ligne et notifications push selon les permissions et la configuration
  du navigateur.

### Modération et commerces

- Mise en attente des vidéos pendant leur traitement et retrait automatique après expiration.
- Signalements, masquage automatique après le seuil configuré et décisions de modération historisées.
- Files de modération par cellule de quartier H3, appels de modérateur et recours.
- Rôles administrateur et commerce, profils de commerce et quota de publications commerciales.
- Tableau de bord d’administration et pages dédiées à la modération et aux commerces.

Les accès et statuts sont contrôlés côté serveur et en base de données ; la présence d’une page dans
l’interface ne signifie pas que chaque parcours est déjà couvert par un test E2E. Voir
[l’avancement détaillé](./docs/PROGRESS.md).

## Architecture

Le dépôt est un monorepo pnpm composé de trois unités principales :

| Unité             | Responsabilité                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web`        | Application Next.js App Router : interface, routes API, sessions, carte, PWA et upload         |
| `apps/worker`     | Worker Node : traitement vidéo, floutage, purge des fichiers et envoi des notifications        |
| `packages/shared` | Schémas Zod, types, constantes, logique de durée de vie, stockage et utilitaires géographiques |
| `supabase`        | Migrations Postgres, seed local, configuration et tests pgTAP                                  |

### Technologies

- **Web :** Next.js 16, React 19, TypeScript strict, Tailwind CSS 4, next-intl et Serwist.
- **Services :** Supabase (Postgres 17, PostGIS, Auth, Storage, Realtime et pg_cron).
- **Géographie :** PostGIS pour la recherche de proximité et H3 pour les cellules de modération et
  de notification.
- **Carte :** MapLibre GL ; le style OpenFreeMap est utilisé par défaut et peut être remplacé.
- **Médias :** TUS pour l’upload résumable, ffmpeg pour le transcodage, ONNX Runtime et YuNet pour
  la détection des visages.
- **Tests et qualité :** Vitest, pgTAP, Playwright, ESLint, Prettier et TypeScript.
- **Gestion des dépendances :** pnpm workspaces.

### Publication et traitement vidéo

1. Le navigateur enregistre une vidéo avec `MediaRecorder` et demande une position suffisamment
   précise (au plus 100 m d’incertitude).
2. `POST /api/videos` valide les données, les limites de publication, la cohérence de la position,
   la catégorie et la durée de vie ; le serveur crée une publication en état `processing`.
3. Le navigateur envoie le média au bucket privé `raw-videos` avec TUS.
4. Un trigger SQL crée un job ; le worker le prend en charge avec `SKIP LOCKED` et une notification
   `LISTEN/NOTIFY`, avec polling de secours.
5. Le worker détecte et pixellise les visages, transcode en H.264/AAC jusqu’à 720p et crée une
   miniature. En cas de succès, il stocke le média traité, active la publication et supprime
   l’original non flouté.
6. En cas d’échec, le job est retenté avec backoff ; après le nombre maximal de tentatives, la
   vidéo est rejetée. Les vidéos expirées ou supprimées sont purgées par le worker.

### Lecture du feed et carte

Le feed et la carte utilisent la fonction SQL `nearby_videos`, qui filtre par distance, catégorie,
statut et expiration. Le feed est paginé par curseur. Les URL des vidéos et miniatures privées sont
signées côté serveur pour une durée limitée. Les alertes temps réel utilisent Supabase Broadcast
avec une cellule H3 et un payload public minimal ; le client ne s’abonne pas aux changements bruts
de la table des vidéos.

## Vie privée et sécurité

Les règles suivantes font partie de la conception du produit :

- Les buckets vidéo sont privés ; le client n’accède pas directement aux fichiers originaux.
- Les vidéos publiques et les réponses de proximité utilisent une position arrondie/décalée et des
  distances arrondies à 100 m. La position exacte, conservée pour la recherche géographique, n’est
  accessible qu’aux fonctions serveur prévues à cet effet.
- La position de recherche n’est pas enregistrée comme historique utilisateur. Les abonnements
  d’alerte utilisent une cellule de zone plutôt que la position GPS exacte.
- Les mutations passent par des routes serveur avec validation Zod, contrôles d’accès et limites de
  débit ; les tables sont protégées par RLS.
- Les fichiers vidéo signés ne sont pas mis en cache par le service worker. Les en-têtes incluent
  notamment CSP, HSTS, protection contre le framing et Permissions Policy.
- L’import de galerie n’est pas proposé par l’interface : la capture utilise la caméra du navigateur.
- Le détecteur de plaques est désactivé par défaut faute de modèle fiable fourni.

Ces protections ne remplacent pas une revue de sécurité, une validation juridique ou des essais de
terrain avant un lancement public.

## Prérequis

- **Node.js 22.18 ou supérieur** (l’environnement de développement du projet utilise Node 24).
- **pnpm 10** (version attendue dans le dépôt : `10.33.2`).
- **Docker** avec le moteur démarré, requis pour Supabase local et le worker média.
- **Git** pour récupérer le dépôt.

Le worker Docker embarque ffmpeg et télécharge le modèle YuNet pendant sa construction. Pour lancer
le worker directement avec `pnpm worker:dev`, installez aussi le modèle YuNet avec
`pnpm --filter @nl/worker models:download` ; ffmpeg doit alors être installé localement.

## Démarrage local

Depuis la racine du dépôt :

```powershell
pnpm install
pnpm db:start
pnpm dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000).

`pnpm db:start` démarre Supabase local, applique les migrations et le seed configurés, génère les
fichiers d’environnement locaux manquants, construit et lance le worker Docker, puis prépare les
médias de démonstration. Les fichiers `.env` et `apps/web/.env.local` générés sont des secrets
locaux : ne les commitez pas et n’utilisez pas ces valeurs en production.

La configuration Supabase du dépôt utilise les ports **56421** (API), **56422** (Postgres),
**56423** (Studio) et **56424** (Mailpit). Cette plage évite les conflits courants avec d’autres
projets Supabase locaux. Mailpit est indiqué dans la sortie de `pnpm db:start` ; il permet de
récupérer les e-mails de confirmation ou de récupération de mot de passe si nécessaire.

Pour arrêter les services locaux :

```powershell
pnpm db:stop
```

Pour reconstruire la base locale et recharger ses données de démonstration :

```powershell
pnpm db:reset
```

Cette commande réinitialise la base locale ; ne l’utilisez pas sur une base contenant des données à
conserver.

## Comptes de démonstration

Après le seed local, les comptes suivants sont disponibles :

| Rôle                     | E-mail                           |
| ------------------------ | -------------------------------- |
| Administrateur           | `admin@neighbors.test`           |
| Modérateur de Belleville | `modo.belleville@neighbors.test` |
| Commerce                 | `boulangerie@neighbors.test`     |
| Habitant                 | `lea@neighbors.test`             |

Le mot de passe de démonstration est `voisins2026` pour ces comptes. **Ces identifiants sont
réservés à la base locale de démonstration** ; ne les réutilisez pas sur un environnement partagé
ou en production.

## Commandes

À exécuter depuis la racine du monorepo :

| Commande            | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`          | Démarre l’application web Next.js en mode développement                 |
| `pnpm worker:dev`   | Lance le worker Node localement (ffmpeg doit être installé)             |
| `pnpm db:start`     | Démarre Supabase local, le worker Docker et les médias de démonstration |
| `pnpm db:stop`      | Arrête Supabase local et le worker Compose                              |
| `pnpm db:reset`     | Réinitialise la base, rejoue migrations/seed et recharge les médias     |
| `pnpm db:types`     | Régénère les types TypeScript depuis la base locale                     |
| `pnpm typecheck`    | Vérifie les types des workspaces                                        |
| `pnpm lint`         | Exécute ESLint sans avertissements autorisés                            |
| `pnpm format`       | Formate le dépôt avec Prettier                                          |
| `pnpm format:check` | Vérifie le formatage sans modifier les fichiers                         |
| `pnpm test`         | Lance les tests unitaires Vitest des workspaces                         |
| `pnpm test:db`      | Lance les tests pgTAP sur Supabase local                                |
| `pnpm test:e2e`     | Lance Playwright ; nécessite la stack locale et le worker               |
| `pnpm build`        | Construit les applications disposant d’un script de build               |

Validation complète recommandée :

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Les tests E2E utilisent Chromium, une caméra simulée et une position simulée ; ils ne remplacent pas
les essais sur appareil mobile réel.

## Configuration

`pnpm db:start` génère les variables nécessaires au développement local si les fichiers locaux
manquent. Les valeurs ci-dessous décrivent les paramètres importants pour une configuration
manuelle ou un déploiement :

| Variable                                  | Usage                                                               |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                | URL Supabase visible du navigateur                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`           | Clé publique Supabase (anon/publishable), jamais une clé service    |
| `NEXT_PUBLIC_SITE_URL`                    | URL de l’application utilisée pour les liens d’authentification     |
| `NEXT_PUBLIC_MAP_STYLE_URL`               | URL du style MapLibre ; OpenFreeMap est la valeur locale par défaut |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`            | Clé publique VAPID pour les abonnements push                        |
| `SUPABASE_URL`                            | URL Supabase utilisée côté serveur et par le worker                 |
| `SUPABASE_SERVICE_ROLE_KEY`               | Clé secrète service, réservée au serveur et au worker               |
| `DATABASE_URL`                            | Connexion Postgres directe utilisée par le worker                   |
| `VAPID_PRIVATE_KEY`                       | Clé privée VAPID, secrète                                           |
| `VAPID_SUBJECT`                           | Identifiant d’expéditeur VAPID, sous forme `mailto:` ou URL HTTPS   |
| `IP_HASH_SALT`                            | Secret aléatoire pour hacher les IP utilisées par le rate limiting  |
| `WORKER_CONCURRENCY`                      | Nombre de traitements simultanés du worker (1 à 8)                  |
| `WORKER_ID`                               | Identifiant du worker ; par défaut le nom d’hôte                    |
| `DETECT_EVERY`                            | Intervalle d’échantillonnage de la détection des visages            |
| `FACE_BLUR_ENABLED` / `FACE_MODEL_PATH`   | Active YuNet (actif par défaut) et indique le chemin du modèle ONNX |
| `PLATE_BLUR_ENABLED` / `PLATE_MODEL_PATH` | Active le modèle ONNX de plaques, désactivé par défaut              |
| `PLATE_MODEL_DIR`                         | Dossier local monté en lecture seule dans le worker Docker          |
| `POLL_INTERVAL_MS`                        | Intervalle de polling de secours des jobs                           |
| `OUTBOX_INTERVAL_MS`                      | Intervalle de traitement de la file de notifications                |

Les variables `NEXT_PUBLIC_*` sont intégrées au bundle navigateur et ne doivent contenir que des
valeurs publiques. Les variables secrètes sont validées au démarrage côté serveur et dans le worker.
Ne publiez jamais `.env`, `.env.local` ou des clés Supabase/VAPID privées.

Les administrateurs peuvent activer ou désactiver le floutage des visages et des plaques dans
**Administration → Traitement vidéo**, puis ajuster la fréquence d’analyse et les seuils de
confiance. Ces réglages s’appliquent aux nouveaux jobs média. Les variables `*_BLUR_ENABLED` du
worker servent de garde-fous de disponibilité : l’option plaques dans l’admin n’est activable que
si `PLATE_BLUR_ENABLED=true` et qu’un modèle est installé/configuré.

### Modèles du worker média

L’image Docker télécharge le modèle facial YuNet `face_detection_yunet_2023mar.onnx` et vérifie son
SHA-256 pendant la construction. `FACE_MODEL_PATH` est relatif au dossier de travail du worker dans
le conteneur (`/app/apps/worker`) ; gardez sa valeur par défaut sauf si vous fournissez une autre
copie compatible. Pour une exécution locale, la commande `pnpm --filter @nl/worker models:download`
télécharge ce même modèle vers le chemin `FACE_MODEL_PATH` (par défaut `apps/worker/models/…`) et
vérifie le même SHA-256 avant de l’écrire.

Aucun modèle de plaques n’est inclus. Pour l’activer, placez un modèle ONNX compatible dans
`models/plates/` à la racine du dépôt, puis configurez `PLATE_BLUR_ENABLED=true` et
`PLATE_MODEL_PATH=../../models/plates/votre-modele.onnx` dans `.env`. Ce chemin relatif fonctionne
avec le worker direct et Docker ; `PLATE_MODEL_DIR` permet de changer le dossier hôte monté en
lecture seule dans le conteneur. Le détecteur attend un modèle YOLO à une classe, entrée
640 × 640, sortie de détections de forme `[1, 5, N]`, avec coordonnées centre/largeur/hauteur et
score. Le modèle doit traiter l’entrée RGB normalisée de 0 à 1. Le worker refuse de démarrer si un
détecteur activé n’a pas de chemin configuré ou si le fichier est absent. Vérifiez la licence et la
couverture du modèle choisi avant de l’utiliser ; l’activation seule ne garantit pas la détection
fiable de toutes les plaques.

## Tests

- **Vitest** : logique partagée, validations, routes API avec clients Supabase simulés et pipeline
  du worker.
- **pgTAP** : schéma, fonctions SQL, règles RLS et permissions par rôle.
- **Playwright** : parcours web sur Chromium avec appareils et géolocalisation simulés. Les traces
  et vidéos de test sont conservées en cas d’échec selon la configuration Playwright.

Pour exécuter les tests de base de données, démarrer d’abord Supabase local avec `pnpm db:start`.
Les parcours E2E nécessitent également le worker afin que les vidéos publiées soient traitées.

## Structure du dépôt

```text
apps/
  web/                 Application Next.js, interface, API, PWA et messages i18n
  worker/              Worker média, floutage, stockage et notifications
packages/
  shared/              Schémas, types et fonctions partagés
supabase/
  migrations/          Migrations SQL versionnées
  tests/database/      Tests pgTAP
  seed.sql             Données de démonstration
tests/e2e/             Parcours Playwright
scripts/               Démarrage local et préparation des médias de démo
docs/                  Architecture, décisions et progression
```

Les migrations déjà intégrées ne doivent pas être modifiées : toute évolution du schéma doit
ajouter une nouvelle migration.

## Déploiement

L’architecture prévue sépare le web, les services Supabase et le worker média. Les notes
d’architecture mentionnent Supabase Cloud, un hébergement web tel que Vercel et un hébergement
worker tel que Fly.io. La configuration de production, les secrets, les domaines, le stockage et
les politiques de sauvegarde doivent être définis et validés pour le projet cible ; le dépôt ne
fournit pas de procédure de déploiement vérifiée de bout en bout.

Avant toute mise en production, vérifier au minimum :

1. Les variables publiques et secrètes dans les environnements distincts web/worker.
2. Les callbacks d’authentification et URL du site dans Supabase.
3. Les buckets privés, policies Storage/RLS et accès de service.
4. La connectivité Postgres du worker, ffmpeg, le modèle de visages et les jobs de purge.
5. Les clés VAPID, les quotas et la fréquence d’envoi des notifications.
6. Les domaines HTTPS, CSP, HSTS, règles de sauvegarde et procédures de suppression des données.
7. Le comportement réel caméra, géolocalisation, push et performances sur appareils ciblés.

## Limites connues

- La caméra, le microphone et les notifications push n’ont pas été validés sur iPhone ou Android
  physiques ; les tests automatisés utilisent Chromium desktop avec des périphériques simulés.
- La détection des visages YuNet a des limites, notamment pour les très petits visages (environ
  moins de 15 px selon les essais documentés).
- Aucun détecteur de plaques fiable n’est fourni ; cette détection est désactivée par défaut.
- La file hors ligne est couverte par des tests unitaires, mais le parcours complet de reprise hors
  connexion n’est pas automatisé.
- Le parcours d’export/suppression de compte et certains parcours de signalement restent à compléter
  en E2E selon le suivi du projet.
- La reprise TUS après une coupure réseau n’a pas été vérifiée automatiquement.
- Le serveur valide la précision et la cohérence des coordonnées, mais ne peut pas prouver que la
  vidéo a physiquement été enregistrée par la caméra plutôt que fournie par un client modifié.

Le suivi à jour des écarts et des vérifications se trouve dans
[docs/PROGRESS.md](./docs/PROGRESS.md) ; la conception détaillée est dans
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Documentation

- [Audit contenu et UI/UX](./AUDIT-CONTENU-UX.md)
- [Roadmap contenu, UX et positionnement](./roadmap.md)
- [Architecture et flux de données](./docs/ARCHITECTURE.md)
- [Décisions techniques et dépendances](./docs/DECISIONS.md)
- [Avancement, tests exécutés et limites](./docs/PROGRESS.md)
- [Instructions de contribution du dépôt](./CLAUDE.md)
