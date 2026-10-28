# Architecture — Neighbors Live

Plan court, choix figés pour l'exécution. Les justifications de dépendances sont dans `DECISIONS.md`.

## Vue d'ensemble

```
 Navigateur (PWA Next.js)                    Supabase (Postgres+PostGIS, Auth, Storage, Realtime, pg_cron)
 ┌─────────────────────────┐   HTTPS        ┌──────────────────────────────────────────────┐
 │ Caméra (MediaRecorder)  │──TUS upload──▶ │ Storage: raw-videos (privé, upload owner)     │
 │ Feed / Carte / Modé     │                │          videos (privé, lecture via URL signée)│
 │ IndexedDB (file offline)│                │ Tables + RLS, RPC SQL, triggers               │
 │ Service worker (Serwist)│◀─Realtime──────│ Broadcast « alerts:<h3 r7> » (payload public) │
 └──────────┬──────────────┘                └───────────────┬──────────────────────────────┘
            │ fetch /api/* (cookies SameSite, Origin vérifié)        │ pg (service, SKIP LOCKED + LISTEN)
 ┌──────────▼──────────────┐                ┌───────────────▼──────────────┐
 │ Route handlers Next.js  │──service role─▶│ Worker Node (Docker)          │
 │ validation Zod, géo, H3,│                │ ffmpeg + onnxruntime-node     │
 │ URL signées, rate limit │                │ media_jobs, notification_outbox│
 └─────────────────────────┘                └──────────────────────────────┘
```

## Flux principaux

**Publication**

1. Client : enregistre ≤ 30 s (`MediaRecorder`, `mimeType` détecté : `video/mp4` Safari,
   `video/webm;codecs=vp9/vp8` sinon), relève la position (`enableHighAccuracy`), refuse si
   précision > 500 m.
2. `POST /api/videos` : Zod (catégorie, légende ≤ 140, lat/lng/accuracy, `expires_at` événement),
   cohérence position (bornes, précision, pas de saut physiquement impossible depuis la dernière
   publication de l'auteur), rate limit, calcul `h3_cell` (h3-js, rés. 8) → insère `videos`
   (`status='processing'`) et renvoie `video_id` + chemin d'upload `raw-videos/<uid>/<video_id>`.
3. Client : upload TUS résumable (Supabase Storage), jusqu’à 500 MiB, avec le JWT de l'utilisateur ;
   policy storage : insertion uniquement dans son propre dossier, pas de lecture.
4. Trigger sur `storage.objects` (bucket `raw-videos`) → insère `media_jobs(kind='process')` et
   `pg_notify`.
5. Hors ligne : la vidéo + métadonnées vont dans IndexedDB ; au retour réseau, la position est
   relevée à nouveau et la publication n'est rejouée que si elle reste à < 100 m de la position
   d'origine avec une précision ≤ 500 m.

**Traitement (worker)**

- Boucle : `LISTEN media_jobs` + polling de secours ; prise de job via
  `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1)`.
- Pipeline : ffmpeg décode en `rawvideo rgb24` (720p max, fps conservé) → détection (interface
  `Detector`, visages YuNet ONNX une image sur 3 + suivi IoU/interpolation entre détections) →
  pixellisation des boîtes en mémoire → ffmpeg ré-encode H.264 + AAC (audio de la source) + poster.
- Succès : upload `videos/<video_id>.mp4` + poster, `status='active'`, suppression de l'original
  `raw-videos`. Échec : retries backoff exponentiel (3 tentatives), puis `status='rejected'` +
  notification à l'auteur.
- Détecteur de plaques : même interface, désactivé par flag tant qu'aucun modèle fiable n'est
  intégré (état réel documenté dans `PRIVACY.md`).
- Le worker traite aussi `notification_outbox` (envoi Web Push VAPID, regroupement, limite de
  fréquence) et les jobs `purge` (suppression des fichiers des vidéos expirées/supprimées/comptes
  supprimés).

**Lecture (feed / carte)**

- `GET /api/feed?lat&lng&radius&section&category&sort&reducedCategories&cursor` → RPC
  `nearby_videos` (SECURITY DEFINER, `ST_DWithin` sur `geography`,
  `status='active' AND expires_at > now()`). Le fil « Pour vous » classe les vidéos selon la
  fraîcheur, la distance arrondie, les retours « utile » et une priorité explicite aux alertes,
  événements, entraide et offres locales ; les préférences de réduction, mémorisées dans le
  navigateur, pénalisent une catégorie.
  Les rubriques Alertes, Événements, Entraide et Offres (bons plans + commerces) sont filtrables,
  et le mode chronologique reste disponible. La pagination encode le mode de tri dans un curseur
  opaque (`score,id,ref,sort`). La route signe en lot les URL vidéo/poster (TTL court) avec la clé
  service.
- La position de la requête n'est ni stockée ni journalisée.
- Le lien public `/v/[id]` affiche uniquement les vidéos encore publiables via un aperçu et des URL
  média signées à durée courte ; aucune coordonnée exacte n'est incluse. Le feed propose le partage
  natif ou la copie explicite de ce lien.
- Les publications de catégorie `shop` affichent « valide jusqu’à », « expirée » ou « invalide »
  selon `expires_at` et le rôle commerçant approuvé du profil. Le champ vidéo `is_merchant` identifie
  une publication de catégorie Commerce ; il ne suffit pas à valider le statut du vendeur. Les
  actions « Voir l’offre » sont masquées pour une offre expirée/invalide. Les conditions sont
  conservées dans `videos.offer_terms` (280 caractères maximum), distinctes de la légende, et
  transmises par la fonction de réservation de vidéo dans la même transaction. Les anciennes
  publications sans conditions restent lisibles avec un état « non précisées ».
- Les panneaux de commentaires, de signalement et de partage suspendent la lecture du feed ; le
  conteneur de défilement reste monté pour conserver la vidéo et sa position au retour. Le panneau
  de commentaires reste ancré en bas de l’écran, sur toute sa largeur, avec un contenu défilable.
- Carte : `GET /api/map` (même RPC, format GeoJSON) ; MapLibre GL, clustering côté source GeoJSON,
  style de tuiles via `NEXT_PUBLIC_MAP_STYLE_URL`. Le viewport cartographique courant est conservé
  uniquement en mémoire pendant la navigation client vers le feed et retour ; il n'est pas ajouté à
  l'URL ni persisté dans le navigateur ou en base.
- Temps réel : trigger à l'activation d'une alerte → `realtime.send` sur le topic
  `alerts:<cellule H3 rés. 7>` avec un payload public uniquement (id, catégorie, position floutée).
  Le client s'abonne aux cellules couvrant son rayon, limité à 5 km (limite actuelle de canaux
  Realtime) ; la recherche du feed peut aller jusqu'à 10 km et l'interface indique cette différence
  même en l'absence de résultats. Pas de `postgres_changes` sur `videos`.

## Vie privée de la position

- `videos.location` exacte stockée (nécessaire à `ST_DWithin`), **privilèges de colonne révoqués**
  pour `anon`/`authenticated` : seules les fonctions SECURITY DEFINER y accèdent.
- Position publique = point accroché à une grille de ~50 m + décalage déterministe par vidéo
  (hash de l'id), calculée en SQL (`public_point(video)`). Distances renvoyées arrondies à 100 m
  pour empêcher la trilatération.
- Aucune position utilisateur persistée hors `push_subscriptions` (zone choisie = centre d'une
  cellule H3, jamais la position brute).

## Modèle de données (résumé)

`profiles` (pseudo unique, bio, couleur avatar, rôle `user|merchant|admin`, réputation, banni,
réglages) · `videos` · `media_jobs` · `reactions` · `saved_videos` et `hidden_videos` (listes privées
par utilisateur, accessibles via des routes authentifiées et policies RLS) · `comments` · `reports` (unique par
vidéo+reporter) · `moderation_actions` (append-only : aucun UPDATE/DELETE, même service) ·
`appeals` · `zone_moderators(user_id, h3_cell)` · `push_subscriptions` · `merchant_profiles` ·
`rate_limits(key, window_start, count)` · `notification_outbox`.

Fonctions : `nearby_videos`, `expire_videos` (pg_cron toutes les 5 min), `apply_report_threshold`
(trigger sur `reports` : 3 reporters distincts → `hidden`), `is_zone_moderator`,
`moderator_eligible`, `check_rate_limit`, `moderate_video`, `resolve_appeal`, `delete_my_account`.

## Rôles et autorisations

| Rôle               | Mécanisme                                                       |
| ------------------ | --------------------------------------------------------------- |
| anon               | lecture des pages publiques uniquement ; feed via route serveur |
| user               | RLS `auth.uid()` sur ses lignes                                 |
| merchant           | `profiles.role='merchant'` + `merchant_profiles` ; quota N/jour |
| modérateur de zone | ligne `zone_moderators` pour la cellule H3 de la vidéo          |
| admin              | `profiles.role='admin'` ; peut annuler toute décision, bannir   |

Le rôle est lu en base (fonctions `is_admin()`, `is_zone_moderator(cell)`), jamais depuis un claim
modifiable par le client.

## Web

- Next.js App Router, TS strict, Tailwind. `next-intl` sans préfixe d'URL (locale en cookie/réglage),
  `fr` par défaut, `en` prêt.
- La page `/decouvrir` est accessible depuis la navigation sous « En voir plus » ; sa grille
  thématique charge automatiquement à l'ouverture les vidéos du rayon de 3 km via `/api/feed`, avec
  filtres par catégorie, posters signés à durée courte, compteurs de réactions utiles et distances
  arrondies. La géolocalisation est demandée à l'ouverture et n'est pas persistée.
- `@supabase/ssr` (cookies) pour l'auth par e-mail et mot de passe ; pseudo à l'inscription et
  callback PKCE pour les liens de confirmation ou de récupération.
- Mutations sensibles par route handlers (vérif `Origin`, Zod, rate limit) ; lectures simples via
  RPC/RLS.
- Serwist : precache de l'app shell, `NetworkFirst` pour l'API, `CacheFirst` pour les images et
  tuiles, **pas de cache des vidéos signées**, page `/offline`, mise à jour douce (bannière
  « nouvelle version »).
- Les filtres de rayon et de catégorie sont partagés entre le feed et la carte, mémorisés localement
  sans position GPS, et peuvent être réinitialisés vers le rayon par défaut de la surface. Le rayon
  du feed se choisit dans un menu dédié, cohérent avec son interface compacte, aligné sur le bouton
  et affichant clairement la portée active.
- Le choix du son du feed est une préférence locale au navigateur, synchronisée entre onglets ;
  les vidéos démarrent toujours en muet par défaut pour respecter les restrictions d’autoplay.
- En-têtes : CSP stricte (nonce), HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` (caméra/micro/géoloc en `self`).

## Tests

- Vitest : `packages/shared` (géo, schémas), route handlers (Supabase mocké au niveau client),
  worker (détecteur, tracker, pixellisation, retries).
- pgTAP (`supabase test db`) : chaque policy RLS par rôle, chaque fonction SQL.
- Playwright : Chromium avec `--use-fake-device-for-media-stream` + fichier `.y4m`, géolocalisation
  simulée, lecture des e-mails de confirmation/récupération dans Mailpit (Supabase local).

## Local / déploiement

- Local : `pnpm db:start` = Supabase CLI (Postgres, Auth, Storage, Realtime, Mailpit) + migrations +
  `seed.sql` + génération/upload des médias de démo + `docker compose up worker`. `pnpm dev` = web.
- Cible de production envisagée : Supabase Cloud, web sur Vercel, worker sur Fly.io ; le guide de
  déploiement reste à écrire et à vérifier.
