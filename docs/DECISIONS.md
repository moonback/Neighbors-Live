# Décisions et dépendances

Chaque dépendance ajoutée est listée ici avec sa justification. Versions exactes dans les
`package.json`.

## Décisions structurantes

| Date       | Décision                                                             | Raison                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-25 | TypeScript 6.0 (et non 7.0)                                          | `typescript-eslint` 8.x supporte TS < 6.1 ; TS 7 (portage Go) n'est pas encore pris en charge par l'outillage lint.                                                 |
| 2026-10-25 | ESLint 9.39 (et non 10)                                              | `eslint-config-next` 16 embarque `eslint-plugin-react` / `import` non garantis sous ESLint 10.                                                                      |
| 2026-10-25 | Pas d'étape de build pour `@nl/shared`                               | Sources TS importées directement : Next via `transpilePackages`, le worker via le _type stripping_ natif de Node ≥ 22.18 (`erasableSyntaxOnly`). Moins d'outillage. |
| 2026-10-25 | H3 calculé côté application (h3-js), pas en SQL                      | L'extension `h3-pg` n'est pas garantie sur Supabase Cloud. La cellule est calculée et validée côté serveur.                                                         |
| 2026-10-25 | Table `notification_outbox` en plus du modèle demandé                | Découple les déclencheurs SQL (alerte activée, vidéo rejetée) de l'envoi Web Push fait par le worker ; reste « dans Postgres, sans file externe ».                  |
| 2026-10-25 | Temps réel par Broadcast (`realtime.send`) et non `postgres_changes` | `postgres_changes` sur `videos` exposerait la colonne de position exacte.                                                                                           |
| 2026-10-25 | Locale par cookie, pas de préfixe d'URL                              | Une PWA installée garde une seule URL de démarrage ; la langue est un réglage utilisateur.                                                                          |
| 2026-10-25 | Tuiles par défaut : OpenFreeMap                                      | Gratuit, sans clé, données OSM ; remplaçable via `NEXT_PUBLIC_MAP_STYLE_URL`.                                                                                       |

## Dépendances

### Racine (dev)

| Paquet                                                                       | Raison                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-next`, `globals` | Lint imposé ; règles Next/React/a11y.                                                          |
| `prettier`                                                                   | Formatage imposé.                                                                              |
| `husky`, `lint-staged`                                                       | Hooks pre-commit imposés ; lint/format des seuls fichiers indexés.                             |
| `typescript`                                                                 | TS strict.                                                                                     |
| `supabase`                                                                   | CLI Supabase en devDependency (non installée globalement) : `db:start`, migrations, `test db`. |
| `@playwright/test`                                                           | E2E imposés.                                                                                   |

### `@nl/shared`

| Paquet                        | Raison                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `zod`                         | Validation imposée (formulaires, API, env, jobs).       |
| `h3-js`                       | Index H3 imposé pour les quartiers.                     |
| `vitest`, `@types/node` (dev) | Tests unitaires imposés ; types de `Buffer` (curseurs). |

### `@nl/web`

| Paquet                                           | Raison                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `react`, `react-dom`                     | Stack imposée.                                                                                                                        |
| `next-intl`                                      | i18n imposée.                                                                                                                         |
| `@serwist/turbopack`, `serwist`, `esbuild` (dev) | Service worker imposé (Serwist) ; la variante Turbopack est requise par Next 16 (Turbopack par défaut) et compile le SW avec esbuild. |
| `@supabase/supabase-js`, `@supabase/ssr`         | Client Supabase + session par cookies côté serveur (App Router).                                                                      |
| `maplibre-gl`                                    | Carte imposée.                                                                                                                        |
| `tus-js-client`                                  | Upload résumable (TUS, supporté nativement par Supabase Storage) : reprise après coupure réseau.                                      |
| `idb`                                            | Surcouche promesse d'IndexedDB (~1 ko) pour la file de publication hors ligne.                                                        |
| `tailwindcss`, `@tailwindcss/postcss`            | Style imposé.                                                                                                                         |

## Changements de décision

| Date       | Décision                                                              | Raison                                                                                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | Rétablir la précision maximale de localisation de publication à 100 m | Le schéma initial, les tests, l’architecture et la règle produit imposent 100 m ; une migration intermédiaire avait porté la limite DB/RPC à 500 m. Nouvelle migration `20261026000600` de retour à 100 m, sans réécriture d’historique et avec un numéro unique. |

| Date       | Décision                                                                 | Raison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-25 | Authentification par **e-mail + mot de passe** (au lieu du lien magique) | Demande du porteur du projet. Inscription avec pseudo dans le même formulaire, connexion, « mot de passe oublié » par e-mail (flux PKCE via `/auth/callback` → `/reinitialiser`). Politique : 8 à 72 caractères, au moins une lettre et un chiffre (bcrypt tronque au-delà de 72 octets). Limitation de débit par IP et par e-mail haché sur inscription, connexion et réinitialisation ; messages qui ne révèlent pas l'existence d'un compte. Si la confirmation d'e-mail est activée sur le projet Supabase, l'inscription demande de cliquer le lien de confirmation. Comptes de démo locaux : mot de passe `voisins2026`. |
