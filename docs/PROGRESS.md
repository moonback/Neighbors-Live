# Progression — Neighbors Live

Légende : ⬜ à faire · 🟨 en cours · ✅ fait (codé + tests verts) · 🟢 vérifié (exécuté réellement dans
l'app) · ⚠️ écart documenté.
Règle : rien n'est 🟢 sans exécution réelle. Les écarts sont décrits dans la colonne « Notes ».

Dernière mise à jour : 2026-10-26 — namespaces anglais commun, auth, feed, vidéo, carte, profil, réglages, notifications, commerce, capture, modération et onboarding ajoutés ; espace commerçant enrichi avec date de réception et repères de suivi ; liens auteur, filtres et suppression de commentaire dans le feed portent au moins 44 px ; avertissement juridique précisé. Changements à vérifier. Le 2026-10-25, lecteur du feed avec états de chargement/échec et nouvel essai URL, navigation admin contextualisée, recherche utilisateur par pseudo/UUID, pagination serveur et confirmations ajoutées ; contrôles bloqués par dépendances manquantes dans l’environnement. Audit contenu/UX et roadmap documentés ; clarification des
textes, onboarding raccourci, page publique commerçante, lisibilité du feed, reprise hors ligne
explicite et tableau de bord d’administration enrichi, avec file des vidéos en traitement. Typecheck,
lint, 47 tests unitaires, E2E ciblé et build réussis.

## 0. Cadrage et fondations

| #    | Élément                                                                             | État | Notes                                                                        |
| ---- | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| 0.1  | `CLAUDE.md`                                                                         | ✅   |                                                                              |
| 0.2  | `docs/PROGRESS.md`                                                                  | ✅   |                                                                              |
| 0.3  | `docs/ARCHITECTURE.md`                                                              | ✅   |                                                                              |
| 0.4  | Monorepo pnpm (apps/web, apps/worker, packages/shared)                              | 🟢   |                                                                              |
| 0.5  | TS strict, ESLint, Prettier, husky + lint-staged                                    | 🟢   | Hook pre-commit exécuté à chaque commit                                      |
| 0.6  | GitHub Actions (typecheck, lint, test, build, e2e)                                  | ✅   | Workflow écrit ; pas encore exécuté sur GitHub (pas de remote)               |
| 0.7  | Validation Zod des variables d'env (web + worker)                                   | 🟢   | `instrumentation.ts` (web), `loadEnv` (worker)                               |
| 0.8  | `docker-compose.yml` worker, `.env.example`, `README.md`                            | ✅   | README détaillé ajouté                                                       |
| 0.9  | `docs/DECISIONS.md`                                                                 | ✅   |                                                                              |
| 0.10 | `pnpm db:start` génère les `.env`, démarre Supabase, le worker et charge les médias | 🟢   | Ports 564xx (543xx/553xx occupés par d'autres projets sur la machine de dev) |

## 1. Base de données et RLS

| #   | Élément                                                                      | État | Notes                                                                  |
| --- | ---------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1.1 | Tables du modèle (+ `user_settings`, `app_config`, `notification_outbox`)    | 🟢   |                                                                        |
| 1.2 | `location geography` + GIST, `h3_cell`, `status`, `expires_at`, `accuracy_m` | 🟢   | + `public_location` floutée (trigger)                                  |
| 1.3 | `nearby_videos` (positions floutées, distances par 100 m, curseur)           | 🟢   | pgTAP + feed réel                                                      |
| 1.4 | `expire_videos()` via `pg_cron` (5 min)                                      | ✅   | pgTAP ; planification vérifiée dans `cron.job`                         |
| 1.5 | `apply_report_threshold()`                                                   | ✅   | pgTAP (3 reporters → masquée + journal)                                |
| 1.6 | RLS sur toutes les tables + tests par rôle                                   | ✅   | 212 assertions pgTAP                                                   |
| 1.7 | Rate limiting en base                                                        | ✅   | publication, commentaire, signalement, connexion (IP et e-mail hachés) |
| 1.8 | `seed.sql` : 3 quartiers, 14 comptes, ~38 vidéos actives/masquées            | 🟢   | Généré par `packages/shared/scripts/gen-seed.mjs`                      |
| 1.9 | `moderation_actions` immuable                                                | ✅   | pgTAP (update/delete/truncate refusés)                                 |

## 2. Comptes et profils

| #   | Élément                                   | État | Notes                                                                   |
| --- | ----------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 2.1 | E-mail + mot de passe + pseudo unique     | ✅   | Inscription, connexion et réinitialisation du mot de passe implémentées |
| 2.2 | Avatar généré, bio                        | 🟢   |                                                                         |
| 2.3 | Page profil, réputation, badges           | 🟢   |                                                                         |
| 2.4 | Paramètres : rayon, langue, notifications | 🟢   | Zone d'alerte = abonnement push (10.1)                                  |
| 2.5 | Export des données                        | ✅   | Route codée ; e2e à écrire                                              |
| 2.6 | Suppression de compte                     | ✅   | Route codée ; e2e à écrire                                              |

## 3. Capture et publication

| #   | Élément                                         | État | Notes                                                                                                     |
| --- | ----------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| 3.1 | Caméra plein écran, arrière par défaut, bascule | 🟢   | Chromium caméra simulée (e2e) ; **pas testé sur téléphone physique**                                      |
| 3.2 | 30 s max + jauge, aperçu, refaire               | 🟢   | e2e                                                                                                       |
| 3.3 | Import galerie interdit                         | 🟢   | Aucun `input[type=file]` (assertion e2e) ; limite : le serveur ne peut pas prouver l'origine d'un fichier |
| 3.4 | `mimeType` MP4/WebM                             | ✅   | Tests unitaires ; WebM vérifié en e2e, MP4 Safari non testé sur appareil                                  |
| 3.5 | Refus si précision > 100 m                      | 🟢   | e2e (450 m refusé) + validation serveur                                                                   |
| 3.6 | Formulaire catégorie / légende / durée de vie   | 🟢   |                                                                                                           |
| 3.7 | Upload résumable (TUS)                          | 🟢   | e2e ; reprise après coupure non testée automatiquement                                                    |
| 3.8 | File hors ligne IndexedDB                       | ✅   | Règles testées (unitaires) ; parcours hors ligne complet non automatisé                                   |
| 3.9 | Statut processing → active / rejected           | 🟢   | e2e (processing → active)                                                                                 |

## 4. Worker média

| #   | Élément                                      | État | Notes                                                                        |
| --- | -------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| 4.1 | `media_jobs` + `SKIP LOCKED` + LISTEN        | 🟢   |                                                                              |
| 4.2 | H.264/AAC 720p + poster                      | 🟢   | Vérifié (ffprobe)                                                            |
| 4.3 | Floutage visages YuNet + suivi               | 🟢   | Vérifié sur photo de foule ; visages < ~15 px non couverts (voir PRIVACY.md) |
| 4.4 | Interface `Detector` + plaques derrière flag | ⚠️   | Aucun modèle de plaques fourni : détecteur désactivé par défaut              |
| 4.5 | Suppression de l'original                    | 🟢   | Vérifié en base après e2e                                                    |
| 4.6 | Retries + backoff → rejected + notification  | ✅   | pgTAP                                                                        |

## 5. Feed

| #   | Élément                                                   | État | Notes                                  |
| --- | --------------------------------------------------------- | ---- | -------------------------------------- |
| 5.1 | Scroll-snap, autoplay visible, playsinline, muet + son    | 🟢   |                                        |
| 5.2 | Préchargement du suivant uniquement                       | 🟢   | Vérifié : 2 sources chargées           |
| 5.3 | `ST_DWithin`, tri fraîcheur + utilité + distance, curseur | 🟢   |                                        |
| 5.4 | Filtres, rayon, bandeau alertes                           | 🟢   |                                        |
| 5.5 | Realtime alertes                                          | 🟢   | Vérifié en activant une alerte en base |
| 5.6 | États vide / chargement / erreur                          | ✅   |                                        |

## 6. Carte

| #       | Élément                                                      | État | Notes                  |
| ------- | ------------------------------------------------------------ | ---- | ---------------------- |
| 6.1–6.4 | MapLibre, clustering, couleurs, aperçu, me localiser, cercle | 🟢   | OpenFreeMap par défaut |

## 7. Interactions

| #       | Élément                                   | État | Notes                                  |
| ------- | ----------------------------------------- | ---- | -------------------------------------- |
| 7.1–7.4 | Utile, commentaires, partage, signalement | ✅   | Routes + UI ; e2e signalement à écrire |

## 8–13

Modération, commerces, push (envoi), onboarding, pages légales, PWA, durcissement, e2e restants :
voir sections suivantes au fil de l'avancement.

### Améliorations contenu et UI/UX

| Élément                                                                  | État | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promesse d’accueil et tagline clarifiées                                 | ✅   | Texte centré sur les informations utiles en courtes vidéos, sans ambiguïté de direct                                                                                                                                                                                                                                                                                                                                                                                                               |
| Installation PWA facultative, hors du parcours principal                 | ✅   | Guide d’installation accessible séparément via `/onboarding?step=install`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Action principale d’onboarding visible et contenu défilant               | ✅   | Vérification E2E ajoutée au viewport mobile 375 × 500                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Textes de confidentialité, floutage et modération alignés                | ✅   | Limites du floutage et examen après signalements explicités                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Présentation commerçant améliorée                                        | ✅   | Copie mise à jour ; page publique répertoriée ci-dessous                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Page publique de présentation commerçant                                 | ✅   | `/commerces`, chemin de demande redirigé vers l’espace connecté ; E2E réussi                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Légende longue du feed développable                                      | ✅   | Limitation à trois lignes avec contrôle accessible ; E2E réussi                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Mouvement réduit dans le feed                                            | ✅   | L’autoplay se met en pause ; lecture manuelle disponible ; E2E réussi                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contexte des alertes et consigne d’urgence                               | ✅   | Alerte communautaire distinguée d’une alerte officielle ; appel au 112 rappelé ; E2E                                                                                                                                                                                                                                                                                                                                                                                                               |
| Retour en cas d’échec de lecture vidéo                                   | ✅   | Message de reprise accessible ; état pause conservé ; E2E réussi                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Statuts de reprise des vidéos hors ligne                                 | ✅   | Position, précision, réseau, déplacement et délai distingués ; E2E du délai réussi                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tableau de bord d’administration                                         | ✅   | File des vidéos `processing` (20 plus anciennes, auteur, date, état et tentatives du job) ; E2E vérifié                                                                                                                                                                                                                                                                                                                                                                                            |
| Navigation, recherche et protections de l’administration                 | 🟨   | Ancres de section responsive ; recherche pseudo/UUID et pagination serveur utilisateurs ; journal filtrable par action, acteur UUID et type de cible avec pagination ; confirmations commerce/sanction/révocation ; contrôle atomique des décisions commerce avec migration et assertion pgTAP. Les nouvelles modifications ne sont pas validées par TypeScript, ESLint, Vitest, pgTAP ou Playwright : liens `node_modules` cassés, cache hors ligne incomplet et accès réseau au registre refusé. |
| États de chargement du lecteur du feed                                   | 🟨   | Affiche un état de chargement, une erreur compréhensible et un nouvel essai si l’URL signée manque ou échoue ; récupération automatique limitée à une tentative. Scénario E2E ajouté mais non exécuté faute des dépendances Playwright.                                                                                                                                                                                                                                                            |
| Mentions juridiques finales                                              | ⬜   | Bandeau renforcé pour signaler le brouillon incomplet et les champs entre crochets ; coordonnées, sous-traitants réels et validation juridique restent requis avant lancement                                                                                                                                                                                                                                                                                                                      |
| Clarté du statut des demandes commerce                                   | 🟨   | Date de réception, explication du suivi et lien vers les critères après refus ajoutés ; consigne de nouvelle demande à décider côté métier ; changements non vérifiés par les contrôles automatisés                                                                                                                                                                                                                                                                                                |
| Zones tactiles des commandes du feed                                     | 🟨   | Liens auteur, filtres et suppression de commentaire portent au moins 44 px ; autres cibles et appareils restent à auditer ; modifications non vérifiées par les contrôles automatisés                                                                                                                                                                                                                                                                                                              |
| Traduction anglaise de l’espace commerçant                               | 🟨   | Namespace complet ajouté pour la page publique et l’espace authentifié ; cohérence et rendu non vérifiés automatiquement                                                                                                                                                                                                                                                                                                                                                                           |
| Traductions anglaises du feed et des contrôles vidéo                     | 🟨   | Namespaces feed, vidéo et commun complets ; autres écrans retombent encore partiellement sur le français ; rendu non vérifié automatiquement                                                                                                                                                                                                                                                                                                                                                       |
| Traduction anglaise de l’authentification                                | 🟨   | Namespace auth complet pour connexion, inscription, récupération et changement de mot de passe ; rendu non vérifié automatiquement                                                                                                                                                                                                                                                                                                                                                                 |
| Traductions anglaises de la carte, des réglages et du push               | 🟨   | Namespaces traduits, y compris les consignes iOS et de confidentialité de localisation ; rendu non vérifié automatiquement                                                                                                                                                                                                                                                                                                                                                                         |
| Traductions anglaises de la capture, de la modération et de l’onboarding | 🟨   | Messages traduits ; revue de rendu et validation linguistique native non effectuées                                                                                                                                                                                                                                                                                                                                                                                                                |
| Traduction anglaise des profils                                          | 🟨   | États du profil et des publications traduits ; revue du rendu non effectuée                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Direction visuelle complète et tests utilisateurs                        | ⬜   | Non réalisée ; à prototyper et tester sur appareils physiques                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Limites connues

- Caméra/micro et push : testés uniquement dans Chromium desktop avec périphériques simulés ;
  aucun iPhone ni Android physique dans cet environnement.
- Le volet navigateur de l'outil de dev bloque caméra et géolocalisation : vérifications faites via
  Playwright et le paramètre `?lat=&lng=`.
- Le guide d’installation PWA est désormais facultatif dans l’onboarding, mais reste accessible
  directement depuis le réglage push.
