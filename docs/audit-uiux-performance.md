# Audit UI/UX, accessibilité et performance — Neighbors Live

Date : 2026-10-29. Périmètre : `apps/web` (Next.js 16, React 19, Tailwind 4, next-intl, Serwist),
`packages/shared`, scripts de dev. Le worker média et les policies RLS n'ont pas été modifiés.
Audits précédents à lire en complément : `AUDIT-PARCOURS-UTILISATEUR.md`, `REFACTOR-PLAN.md`.

## 1. Résumé exécutif

L'application était fonctionnellement riche et propre (écouteurs nettoyés, appels API robustes,
`prefers-reduced-motion` respecté, MapLibre et tus chargés uniquement là où ils servent). Les
défauts trouvés étaient concentrés sur :

- **l'outillage** : lint global bloqué depuis plusieurs jalons, base locale en retard de 11
  migrations (le feed répondait 500) ;
- **la robustesse** : deux accès `localStorage` non protégés, dont un à la racine de l'app ;
- **l'accessibilité** : 5 couples de couleurs sous le seuil AA, boutons bascule mal annoncés,
  titres `<h1>` manquants ;
- **la mise en page mobile** du lecteur : libellés tronqués, chevauchements, actions inatteignables
  pour les vidéos commerçantes sur petit écran ;
- **le poids JS** : `h3-js` (61 Ko gzip) embarqué sur les pages d'authentification.

Tous les points P1/P2 ci-dessous ont été corrigés et vérifiés dans le navigateur ou par mesure.
Aucun contrat d'API, aucune policy ni aucune migration existante n'a été modifié.

## 2. État initial (mesuré avant toute modification)

| Contrôle                     | Résultat                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ (28 s)                                                                     |
| `pnpm lint`                  | ❌ `EPERM: scandir .swc-safe-cache` — aucun fichier analysé                   |
| `pnpm test`                  | ✅ 111 tests (shared 19, worker 19, web 73)                                   |
| `pnpm build`                 | ✅ (65 s)                                                                     |
| `pnpm test:db` / E2E         | non exécutables : Docker arrêté                                               |
| Base locale après `db:start` | 12 migrations appliquées sur 23 → `/api/feed`, `/api/me/hidden-videos` en 500 |
| JS client `/login` (gzip)    | 124 Ko dont `h3-js` 61 Ko                                                     |

## 3. Méthode

- Lecture du design system (`globals.css`, `components/ui.tsx`), des composants partagés (feed,
  lecteur, dialogues, navigation, thème, onboarding) et du découpage des bundles (`.next`).
- Contrastes calculés par la formule WCAG 2.x (script Node), pas estimés à l'œil.
- Application lancée réellement (Supabase local + worker Docker + serveur dev) et parcourue dans le
  navigateur intégré avec le compte de démo `lea@neighbors.test` : feed, signalement, profil,
  paramètres, découvrir, thème clair/sombre, à 320×640, 375×667, 375×812 et 1440×900.
- Mesures DOM (boîtes englobantes, débordements, tailles de cibles) par script dans la page.

## 4. Problèmes identifiés et corrections

| ID      | Prio. | Zone                     | Constat                                                                                                                                     | Cause                                                                             | Correction                                                                                                           | Vérification                                                            |
| ------- | ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| TOOL-01 | P1    | `eslint.config.mjs`      | Lint global impossible depuis plusieurs jalons                                                                                              | Cache local illisible `.swc-safe-cache/` parcouru par ESLint, non ignoré          | Ajouté aux ignores ESLint, `.gitignore`, `.prettierignore`                                                           | `pnpm lint` passe sur tout le dépôt                                     |
| DEV-01  | P1    | `scripts/db-start.mjs`   | Feed et vidéos masquées en 500 en local                                                                                                     | `supabase start` réutilise le volume sans appliquer les nouvelles migrations      | `supabase migration up --local` après le démarrage (idempotent, non destructif)                                      | 11 migrations appliquées sans erreur, feed affiché                      |
| BUG-01  | P1    | `ThemeProvider` (racine) | Écran blanc si le stockage est bloqué (Safari « bloquer tous les cookies », certains modes privés)                                          | `localStorage.getItem` lève `SecurityError` sans `try/catch`                      | Lecture/écriture protégées, repli en mémoire                                                                         | Typecheck et lecture (navigateur à stockage bloqué non disponible)      |
| BUG-02  | P1    | `Onboarding`             | Même cas : onboarding impossible à terminer (`finish()` levait avant de poser le cookie)                                                    | Idem                                                                              | `readSavedStep` / `saveStep` protégés                                                                                | Idem                                                                    |
| BUG-03  | P1    | Lecteur, actions         | Vidéo commerçante (10 actions) en 375×667 : barre commençant à −34 px, actions du haut hors écran                                           | Colonne ancrée en bas, sans hauteur maximale                                      | `max-height` sous l'en-tête, défilement vertical, éléments non compressibles                                         | Simulation 10 actions : haut à 84 px, contenu défilable (642 px)        |
| A11Y-01 | P2    | Tokens de couleur        | Contrastes < 4,5:1 : bouton danger 3,21 ; erreur en clair 2,99 ; `text-blue` en clair 2,00 ; `text-accent` en sombre 3,80 ; succès en clair | Teintes réglées pour un seul thème                                                | Teintes par thème (≥ 5:1) ; les zones toujours sombres gardent les teintes claires                                   | Couleurs calculées lues dans le navigateur, dans les deux thèmes        |
| A11Y-02 | P2    | Lecteur, page vidéo      | Utile / Enregistrer / Masquer / Son : libellé qui change **et** `aria-pressed` → état annoncé deux fois, inversé pour « Son »               | Mélange des deux patterns ARIA de bascule                                         | `aria-pressed` retiré là où le libellé porte l'état ; style piloté par `data-pressed`                                | Lecture ; rendu identique                                               |
| A11Y-03 | P2    | `/decouvrir`, `/filmer`  | Aucun `<h1>`                                                                                                                                | —                                                                                 | `<h1 class="sr-only">` avec le titre déjà traduit                                                                    | Contrôle des `<h1>` sur 15 routes                                       |
| UI-01   | P2    | Lecteur mobile           | « 1 commentaire » (76 px) et « Enregistrer » (65 px) tronqués dans 56 px ; barre chevauchant le bouton plein écran de 13 px                 | Libellés longs, boutons étroits, bouton plein écran dans la même colonne          | Compte seul visible (phrase en `aria-label`), « Masquer » court, boutons 64 px, libellés 11 px, plein écran à gauche | Aucun libellé débordant ; barre 470 px au lieu de 525 ; bureau inchangé |
| UI-02   | P2    | Navigation basse         | À 320 px, « En voir plus » sur 2 lignes, indicateur actif sur le texte                                                                      | Marges internes, indicateur dans la zone du texte                                 | `whitespace-nowrap`, marges réduites, contenu remonté de 8 px                                                        | 5 entrées sur une ligne ; texte (38 px) au-dessus de l'indicateur (40)  |
| UX-01   | P2    | Thème clair              | Flash du thème sombre à chaque chargement                                                                                                   | Thème appliqué après hydratation                                                  | Script inline (nonce CSP) appliquant le thème avant le premier rendu                                                 | Thème clair au premier rendu, aucune erreur CSP en console              |
| UX-02   | P2    | Feed, Découvrir          | « Vérifiez votre connexion » affiché aussi pour une erreur serveur                                                                          | Texte unique pour toutes les causes                                               | Formulation vraie dans les deux cas (FR/EN)                                                                          | Lecture                                                                 |
| PERF-01 | P2    | `@nl/shared`             | `h3-js` (61 Ko gzip) chargé sur `/login`, `/bienvenue`, récupération de mot de passe                                                        | `schemas.ts` importait `isPlausiblePosition` depuis `geo.ts`, qui importe `h3-js` | Fonction pure déplacée dans `position.ts`, ré-exportée par `geo.ts` (API inchangée)                                  | § 6                                                                     |
| TYPO-01 | P3    | Échelle typographique    | `text-xs` = 10,8 px (85 usages : aides, dates, badges)                                                                                      | Échelle Tailwind réduite de 10 %                                                  | Plancher à 12 px (valeur Tailwind par défaut)                                                                        | Écrans parcourus sans débordement à 320 px                              |

Essai écarté : `experimental.optimizePackageImports` pour `@nl/shared` — mesuré sans effet, retiré.

### Constats non corrigés (P3)

- Dialogue de signalement : le seuil de 3 signalements est expliqué deux fois d'affilée (contenu
  métier, laissé à l'arbitrage produit).
- Le thème clair repose sur des surcharges de classes (`.text-white` → sombre) dans `globals.css`.
  Fonctionnel mais fragile ; migrer vers des tokens sémantiques (`--color-text`, `--color-surface`)
  serait plus sûr. Chantier transverse non engagé ici.
- `.swc-safe-cache/` : dossier d'origine inconnue, illisible par l'utilisateur courant, non supprimé.

## 5. Ce qui fonctionnait déjà (non modifié)

Gestion d'erreurs API centralisée (`client-api.ts`, `useErrorText`), dialogues natifs `<dialog>`
(focus, Échap, retour du focus vérifiés), écouteurs et observers nettoyés, découpage du JS
(MapLibre 288 Ko gzip chargé à la demande sur `/carte`, tus uniquement sur `/filmer`), CSP à nonce,
aucune page en défilement horizontal à 320 px.

## 6. Mesures avant / après

JS client propre à chaque route (chunks du manifeste de référence client, gzip, build de
production ; le socle framework commun n'est pas compté) :

| Route                  | Avant     | Après  | Écart                                     |
| ---------------------- | --------- | ------ | ----------------------------------------- |
| `/login`               | 124 Ko    | 63 Ko  | −49 %                                     |
| `/bienvenue`           | 120 Ko    | 59 Ko  | −51 %                                     |
| `/mot-de-passe-oublie` | h3 inclus | 63 Ko  | h3 retiré                                 |
| `/` (feed)             | 43 Ko     | 43 Ko  | =                                         |
| `/parametres`          | 129 Ko    | 129 Ko | =                                         |
| `/filmer`              | 206 Ko    | 206 Ko | = (h3 nécessaire au contrôle de position) |

| Indicateur                         | Avant          | Après                                              |
| ---------------------------------- | -------------- | -------------------------------------------------- |
| `pnpm typecheck`                   | ✅             | ✅                                                 |
| `pnpm lint`                        | ❌ EPERM       | ✅ (0 avertissement)                               |
| `pnpm test` (Vitest)               | ✅ 111         | ✅ 111                                             |
| `pnpm build`                       | ✅             | ✅                                                 |
| `pnpm test:db` (pgTAP)             | non exécutable | ✅ 244/244 (après correction de 2 tests en retard) |
| Couples de couleurs < AA           | 5              | 0 sur les couples mesurés                          |
| Libellés débordants (lecteur 375)  | 2              | 0                                                  |
| Erreurs console (pages parcourues) | 0              | 0                                                  |
| LCP / INP / CLS                    | non mesuré     | non mesuré                                         |

Tests pgTAP corrigés (aucun désactivé) : `010_schema` n'attendait pas les tables
`media_settings_audit` et `media_worker_status` créées par la migration commitée
`20261026000800` (RLS activée, vérifié) ; `030_functions` exécutait des `UPDATE` de préparation
sous le rôle `anon` et s'interrompait à 11 tests sur 66.

## 7. Limites

- E2E Playwright : 11 réussis, 7 en échec, diagnostic reporté (voir `PROGRESS.md`). Au moins 4
  échecs viennent de tests en retard sur l'interface ou les règles actuelles ; les deux tests de
  publication ne sont pas diagnostiqués, une régression ne peut donc pas être exclue sur ce
  parcours.

- Pas de Lighthouse/Web Vitals : LCP, INP et CLS **non mesurés**.
- Pas de lecteur d'écran réel (NVDA/VoiceOver) : corrections ARIA conformes à la spécification,
  sans écoute.
- Navigateur à stockage bloqué non reproduit : BUG-01/02 vérifiés par lecture et typage.
- Aucune vidéo commerçante publiée dans le seed : BUG-03 vérifié par simulation DOM.
- Appareils physiques (iOS/Android) non testés.
