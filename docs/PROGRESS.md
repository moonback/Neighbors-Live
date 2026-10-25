# Progression — Neighbors Live

Légende : ⬜ à faire · 🟨 en cours · ✅ fait (codé + tests verts) · 🟢 vérifié (exécuté réellement dans
l'app) · ⚠️ écart documenté.
Règle : rien n'est 🟢 sans exécution réelle. Les écarts sont décrits dans la colonne « Notes ».

Dernière mise à jour : 2026-10-25 — étape 1 (cadrage) terminée.

## 0. Cadrage et fondations

| # | Élément | État | Notes |
|---|---|---|---|
| 0.1 | `CLAUDE.md` | ✅ | |
| 0.2 | `docs/PROGRESS.md` | ✅ | |
| 0.3 | `docs/ARCHITECTURE.md` | ✅ | |
| 0.4 | Monorepo pnpm (apps/web, apps/worker, packages/shared) | ⬜ | |
| 0.5 | TS strict, ESLint, Prettier, husky + lint-staged | ⬜ | |
| 0.6 | GitHub Actions (typecheck, lint, test, build, e2e) | ⬜ | |
| 0.7 | Validation Zod des variables d'env (web + worker) | ⬜ | |
| 0.8 | `docker-compose.yml` worker, `.env.example`, `README.md` | ⬜ | |
| 0.9 | `docs/DECISIONS.md` (justification des dépendances) | ⬜ | |

## 1. Base de données et RLS

| # | Élément | État | Notes |
|---|---|---|---|
| 1.1 | Tables : profiles, videos, media_jobs, reactions, comments, reports, moderation_actions, appeals, zone_moderators, push_subscriptions, merchant_profiles, rate_limits | ⬜ | |
| 1.2 | `videos.location geography(Point,4326)` + GIST, `h3_cell`, `status`, `expires_at`, `accuracy_m` | ⬜ | |
| 1.3 | `nearby_videos(lat, lng, radius_m, cursor, category)` (position publique floutée ~50 m) | ⬜ | |
| 1.4 | `expire_videos()` planifiée via `pg_cron` | ⬜ | |
| 1.5 | `apply_report_threshold()` (3 signalements distincts → masquage) | ⬜ | |
| 1.6 | RLS sur toutes les tables + tests par rôle | ⬜ | |
| 1.7 | Rate limiting en base | ⬜ | |
| 1.8 | `seed.sql` : 3 quartiers, ~40 vidéos, 10 users, 2 modérateurs, 1 admin, 1 commerce | ⬜ | |
| 1.9 | `moderation_actions` immuable (pas d'UPDATE/DELETE) | ⬜ | |

## 2. Comptes et profils

| # | Élément | État | Notes |
|---|---|---|---|
| 2.1 | Magic link email + pseudo unique | ⬜ | |
| 2.2 | Avatar généré (initiales/couleur), bio courte | ⬜ | |
| 2.3 | Page profil : vidéos actives, réputation, badge modérateur | ⬜ | |
| 2.4 | Paramètres : rayon, zone d'alerte, notifications, langue | ⬜ | |
| 2.5 | Export des données | ⬜ | |
| 2.6 | Suppression de compte (profil, vidéos, storage, push) | ⬜ | |

## 3. Capture et publication

| # | Élément | État | Notes |
|---|---|---|---|
| 3.1 | Caméra plein écran, arrière par défaut, bascule | ⬜ | |
| 3.2 | Enregistrement 30 s max + jauge, aperçu, relecture, refaire | ⬜ | |
| 3.3 | Import galerie interdit | ⬜ | |
| 3.4 | Détection `mimeType` (MP4 Safari / WebM Chrome) | ⬜ | |
| 3.5 | Géoloc à la publication, refus si précision > 100 m | ⬜ | |
| 3.6 | Formulaire : catégorie, légende 140 car., durée de vie par catégorie | ⬜ | |
| 3.7 | Upload avec reprise (TUS / resumable) | ⬜ | |
| 3.8 | File hors ligne IndexedDB + republication si position valide | ⬜ | |
| 3.9 | Statut visible processing → active / rejected | ⬜ | |

## 4. Worker média

| # | Élément | État | Notes |
|---|---|---|---|
| 4.1 | Consommation de `media_jobs` (verrouillage `FOR UPDATE SKIP LOCKED`) | ⬜ | |
| 4.2 | Transcodage MP4 H.264 + AAC, 720p max, poster | ⬜ | |
| 4.3 | Floutage visages (ONNX YuNet/UltraFace + suivi simple) | ⬜ | |
| 4.4 | Interface `Detector` + détecteur plaques (flag, état réel dans PRIVACY.md) | ⬜ | |
| 4.5 | Suppression de l'original non flouté | ⬜ | |
| 4.6 | Retries avec backoff → `rejected` + notification auteur | ⬜ | |

## 5. Feed hyperlocal

| # | Élément | État | Notes |
|---|---|---|---|
| 5.1 | Scroll vertical plein écran (scroll-snap), autoplay visible, `playsinline`, muet + bouton son | ⬜ | |
| 5.2 | Préchargement du suivant uniquement | ⬜ | |
| 5.3 | Requête `ST_DWithin`, tri fraîcheur + pertinence, pagination curseur | ⬜ | |
| 5.4 | Filtres catégorie, rayon, bandeau « alertes proches » | ⬜ | |
| 5.5 | Realtime nouvelles alertes | ⬜ | |
| 5.6 | États vide / chargement (skeleton) / erreur | ⬜ | |

## 6. Carte

| # | Élément | État | Notes |
|---|---|---|---|
| 6.1 | MapLibre + tuiles OSM (fournisseur configurable) | ⬜ | |
| 6.2 | Marqueurs, clustering, couleur par catégorie | ⬜ | |
| 6.3 | Aperçu au clic, ouverture dans le feed | ⬜ | |
| 6.4 | « Me localiser », cercle du rayon actif | ⬜ | |

## 7. Interactions

| # | Élément | État | Notes |
|---|---|---|---|
| 7.1 | « Utile » + compteur | ⬜ | |
| 7.2 | Commentaires courts, pagination, suppression par l'auteur | ⬜ | |
| 7.3 | Partage (Web Share API + lien profond) | ⬜ | |
| 7.4 | Signalement avec motif (dont personne reconnaissable, adresse/plaque) | ⬜ | |

## 8. Modération par quartier

| # | Élément | État | Notes |
|---|---|---|---|
| 8.1 | Zones H3 (rés. 8), file par zone | ⬜ | |
| 8.2 | Éligibilité modérateur (14 j, 5 publications non signalées, réputation ≥ seuil configurable) | ⬜ | |
| 8.3 | Masquage auto à 3 signalements distincts | ⬜ | |
| 8.4 | UI modérateur : valider / masquer / supprimer (note obligatoire) / avertir | ⬜ | |
| 8.5 | Journal immuable + réputation mise à jour | ⬜ | |
| 8.6 | Contestation réexaminée par un autre modérateur ou admin | ⬜ | |
| 8.7 | Admin : tableau de bord, annulation, bannissement | ⬜ | |

## 9. Espace commerçants

| # | Élément | État | Notes |
|---|---|---|---|
| 9.1 | Compte commerce + badge | ⬜ | |
| 9.2 | Offres catégorie commerce, durée choisie, N publications/jour | ⬜ | |

## 10. Notifications push

| # | Élément | État | Notes |
|---|---|---|---|
| 10.1 | Web Push VAPID, abonnement par zone + rayon | ⬜ | |
| 10.2 | Notification groupée + limite de fréquence par utilisateur | ⬜ | |
| 10.3 | Onboarding iOS (PWA installée requise) | ⬜ | Test sur vrai iPhone impossible depuis cet environnement : à documenter |

## 11. Onboarding et pages légales

| # | Élément | État | Notes |
|---|---|---|---|
| 11.1 | Onboarding 4 écrans (valeur, permissions expliquées avant chaque demande, installation, règles) | ⬜ | |
| 11.2 | Pages confidentialité, conditions, règles, contact (mention « à valider par un juriste ») | ⬜ | |

## 12. PWA, performance, durcissement

| # | Élément | État | Notes |
|---|---|---|---|
| 12.1 | Manifest (icônes maskable, shortcuts Filmer/Carte) | ⬜ | |
| 12.2 | Service worker Serwist : cache par type, page hors ligne, mise à jour douce | ⬜ | |
| 12.3 | Headers sécurité (CSP, HSTS…), CSRF, sanitisation | ⬜ | |
| 12.4 | Accessibilité (contrastes, clavier, labels, reduced-motion) | ⬜ | |
| 12.5 | Lighthouse > 90 (PWA, perf, a11y) sur écrans clés | ⬜ | |
| 12.6 | `docs/PRIVACY.md` | ⬜ | |
| 12.7 | `docs/DEPLOYMENT.md` | ⬜ | |

## 13. Tests e2e Playwright

| # | Parcours | État | Notes |
|---|---|---|---|
| 13.1 | Inscription | ⬜ | |
| 13.2 | Publication d'une vidéo (caméra simulée `--use-fake-device-for-media-stream`) | ⬜ | |
| 13.3 | Lecture dans le feed | ⬜ | |
| 13.4 | Signalement jusqu'au masquage | ⬜ | |
| 13.5 | Décision d'un modérateur | ⬜ | |
| 13.6 | Suppression de compte | ⬜ | |

## Limites connues (à compléter au fil de l'eau)

- Caméra et push testés uniquement en navigateur desktop simulé ; pas d'appareil physique iOS/Android
  dans cet environnement.
- Supabase CLI et ffmpeg absents en global sur la machine de dev : CLI via devDependency, ffmpeg via
  Docker.
