# Neighbors Live — instructions pour Claude

PWA de vidéos courtes hyperlocales (rayon 300 m / 1 km / 3 km), filmées dans l'app, géolocalisées,
éphémères, modérées par quartier (H3). Interface en français, i18n prête.

**Avant toute reprise de travail : lire `docs/PROGRESS.md`** (état de chaque fonctionnalité) puis
`docs/ARCHITECTURE.md`. Mettre `PROGRESS.md` à jour à chaque jalon.

## Commandes

| Commande                                       | Effet                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                 | Installe le monorepo (pnpm workspaces)                                                                   |
| `pnpm db:start`                                | Démarre Supabase local (CLI via devDependency), applique migrations + `seed.sql`, lance le worker Docker |
| `pnpm db:reset`                                | Réinitialise la base locale (migrations + seed)                                                          |
| `pnpm db:types`                                | Régénère `packages/shared/src/database.types.ts`                                                         |
| `pnpm dev`                                     | Lance le web (Next.js) en dev                                                                            |
| `pnpm worker:dev`                              | Lance le worker média hors Docker (nécessite ffmpeg local)                                               |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Qualité                                                                                                  |
| `pnpm test`                                    | Tests unitaires Vitest (tous les packages)                                                               |
| `pnpm test:db`                                 | Tests SQL/RLS contre la base locale                                                                      |
| `pnpm test:e2e`                                | Playwright (`/tests`), nécessite Supabase local + worker                                                 |
| `pnpm build`                                   | Build de production                                                                                      |

Boucle obligatoire après chaque bloc : `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Structure

```
apps/web          Next.js App Router + TS strict + Tailwind + next-intl + Serwist
apps/worker       Node : transcodage ffmpeg, floutage ONNX, consommation de media_jobs
packages/shared   Types, schémas Zod, utilitaires géo (H3, arrondi de position), constantes
supabase          migrations/, seed.sql, config.toml, tests SQL
tests             e2e Playwright
docs              ARCHITECTURE, DECISIONS, PRIVACY, DEPLOYMENT, PROGRESS
```

## Conventions

- TypeScript `strict`, pas de `any` non justifié. Zod à chaque frontière (formulaires, API, env, jobs).
- Commits atomiques en anglais, Conventional Commits (`feat(web): …`, `fix(db): …`, `chore: …`).
- Code et identifiants en anglais ; textes UI uniquement via `next-intl` (`apps/web/messages/fr.json`).
- Migrations SQL versionnées dans `supabase/migrations/` (jamais modifier une migration déjà commitée :
  en ajouter une nouvelle).
- Toute nouvelle dépendance est justifiée dans `docs/DECISIONS.md`.
- Ne jamais désactiver une règle ESLint / un test pour « faire passer ». Corriger la cause.
- Chaque policy RLS, fonction SQL et route API a au moins un test.

## Règles non négociables (vie privée & sécurité)

- **Position exacte jamais renvoyée au client** : toute réponse publique passe par une position
  arrondie/décalée (~50 m). Aucun historique de position utilisateur stocké.
- Bucket vidéos **privé**, URL signées courtes. Aucun secret côté client (`NEXT_PUBLIC_*` = publics
  uniquement). Variables d'env validées par Zod au démarrage (web et worker).
- **RLS activée sur toutes les tables**, policies explicites et testées par rôle (anon, user,
  modérateur de zone, admin, commerce).
- Rate limiting en base (publication, commentaires, signalements, connexion).
- Validation serveur de tout ce qui vient du client, y compris cohérence de la position (précision
  ≤ 100 m, coordonnées plausibles).
- Headers de sécurité (CSP, HSTS…), protection CSRF sur les mutations, sanitisation des textes.
- Import galerie interdit : la vidéo vient uniquement de `getUserMedia` / `MediaRecorder`.
- Original non flouté supprimé après traitement réussi. Suppression de compte = suppression effective
  (profil, vidéos, fichiers storage, abonnements push).

## Honnêteté

Ne marquer « vérifié » dans `PROGRESS.md` que ce qui a été réellement exécuté. Tout écart (push iOS
non testé sur vrai appareil, caméra non testée sur appareil physique, détecteur de plaques désactivé…)
est écrit explicitement dans `PROGRESS.md`, `PRIVACY.md` et le rapport final.

## Environnement de dev constaté

Windows 10, Node 24, pnpm 10, Docker 28. Supabase CLI et ffmpeg non installés globalement :
CLI via devDependency `supabase` (`pnpm exec supabase`), ffmpeg dans l'image Docker du worker.
