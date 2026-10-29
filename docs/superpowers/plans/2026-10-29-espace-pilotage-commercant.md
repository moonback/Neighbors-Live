# Espace de pilotage commerçant — plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases
> à cocher (`- [ ]`) pour le suivi.

**Objectif :** transformer `/commerce` (aujourd'hui : demande de compte + quota) en espace où un
commerçant approuvé prépare, suit et comprend ses offres, avec uniquement des chiffres réellement
mesurés.

**Architecture :** la page serveur `apps/web/src/app/(app)/commerce/page.tsx` reste le point
d'entrée. Une route `GET /api/merchant/dashboard` agrège les publications du commerçant à partir
des colonnes existantes de `videos` (`useful_count`, `comment_count`, statut, `expires_at`,
`offer_terms`) et du nombre de `saved_videos`. Une nouvelle table agrégée par jour,
`video_daily_stats`, compte les vues et les clics sur les actions d'offre, sans identifiant
d'utilisateur. Toute métrique sans mesure est renvoyée `null` et affichée « Statistiques non
disponibles ».

**Stack :** Next.js App Router, Supabase (Postgres + RLS + pgTAP), Zod, next-intl, Vitest,
Playwright.

**Spec :** demande utilisateur du 2026-10-29 (« Plan d'action — Espace de pilotage commerçant
complet »), reprise dans « Contraintes globales ».

## Ce qui existe déjà (ne pas refaire)

- `merchant_profiles` (statut, `daily_quota`, contacts, horaires) ; `POST /api/merchant` crée la
  demande ; `merchantQuota()` dans `commerce/page.tsx` calcule le quota sur 24 h glissantes.
- `videos.is_merchant`, `category = 'shop'`, `offer_terms`, `expires_at` ;
  `getOfferStatus()` dans `apps/web/src/lib/offer-status.ts` donne valide / expirée / invalide.
- Compteurs réels : `useful_count`, `comment_count`, `report_count` ; table `saved_videos`.
- `expire_videos()` passe les vidéos en `expired` et purge les fichiers **sans supprimer la
  ligne** : l'historique des compteurs reste disponible.
- `DELETE /api/videos/[id]` (retrait par l'auteur) ; `GET /api/me/videos` (50 dernières).
- Rate limiting en base : `public.check_rate_limit(p_key, p_rule)`.
- **Aucune mesure de vue ni de clic n'existe aujourd'hui.**

## Contraintes globales

- **Aucun chiffre inventé.** Une statistique n'est affichée que si elle est calculée à partir
  d'événements réellement enregistrés. Sans mesure : « Statistiques non disponibles », jamais
  « 0 vue ».
- **Pas de conversion affichée.** Aucun taux de conversion, ROI, « ventes générées » ni promesse
  de ce type, ni dans l'UI, ni dans les textes FR/EN, ni dans la doc.
- Distinguer « 0 mesuré » (mesure active, aucun événement) de « non mesuré » (`null`).
- Aucune donnée personnelle des voisins exposée au commerçant : uniquement des agrégats par
  vidéo (pas de liste de qui a sauvegardé, aimé ou vu).
- Les tables de mesure ne stockent ni `user_id` ni position (règle vie privée du projet).
- RLS activée sur toute nouvelle table ; chaque policy, fonction SQL et route API a un test.
- Textes UI uniquement via `apps/web/messages/{fr,en}/merchant.json`.
- Nouvelle migration pour tout changement SQL (ne jamais modifier une migration commitée).
- Boucle après chaque tâche : `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, plus
  `pnpm test:db` pour les tâches SQL. Ne cocher « vérifié » dans `PROGRESS.md` que ce qui a tourné.

## Review Focus

1. **Vidéo publiée avant le début des mesures** → vues/clics `null` → « Statistiques non
   disponibles », jamais 0. Test : tâche 3 (`video_stats_null_before_tracking`).
2. **Vidéo mesurée mais jamais vue** → `0` affiché comme « 0 vue mesurée ». Test : tâche 3.
3. **Commerçant non approuvé (pending / rejected) ou utilisateur simple** appelle
   `/api/merchant/dashboard` → 403, aucune donnée. Test : tâche 1.
4. **Spam de `record_video_event`** (boucle client) → limité par `check_rate_limit`, pas de
   compteur gonflé à l'infini. Test pgTAP : tâche 2.
5. **Vidéo masquée par la modération ou expirée** → toujours listée pour son auteur avec son
   statut et ses compteurs historiques, sans lien de lecture. Test : tâche 1.

---

### Tâche 1 : tableau de bord des publications (données existantes uniquement)

**Fichiers :**

- Créer : `apps/web/src/app/api/merchant/dashboard/route.ts` (+ `route.test.ts`)
- Créer : `apps/web/src/lib/merchant-dashboard.ts` (+ `merchant-dashboard.test.ts`)
- Créer : `apps/web/src/components/merchant/MerchantDashboard.tsx`
- Modifier : `apps/web/src/app/(app)/commerce/page.tsx` (bloc `approved`)
- Modifier : `apps/web/messages/fr/merchant.json`, `apps/web/messages/en/merchant.json`

**Interfaces :**

- Produit :
  ```ts
  type MerchantVideoStats = {
    id: string;
    caption: string;
    offerTerms: string;
    status: Database['public']['Enums']['video_status'];
    offerStatus: ReturnType<typeof getOfferStatus>;
    createdAt: string;
    expiresAt: string;
    useful: number;
    comments: number;
    saves: number;
    // null = non mesuré ; reste null tant que la tâche 3 n'est pas livrée
    views: number | null;
    offerClicks: number | null;
    callClicks: number | null;
    directionsClicks: number | null;
  };
  type MerchantDashboard = {
    quota: { used: number; quota: number };
    totals: { active: number; expired: number; useful: number; comments: number; saves: number };
    videos: MerchantVideoStats[];
  };
  function buildMerchantDashboard(
    rows: DashboardRow[],
    saves: Map<string, number>,
    quota: { used: number; quota: number },
    now: Date,
  ): MerchantDashboard;
  ```
- `GET /api/merchant/dashboard` → `MerchantDashboard` ; 401 sans session, 403 si
  `merchant_profiles.status !== 'approved'`.
- Déplacer `merchantQuota()` de `page.tsx` vers `merchant-dashboard.ts` (réutilisé par la route
  et la page).

- [ ] **Étape 1 : tests de `buildMerchantDashboard`** (`merchant-dashboard.test.ts`)
  - `totals.active` compte uniquement `status === 'active'` et `expiresAt > now`.
  - Une vidéo `hidden` ou `expired` reste dans `videos` avec ses compteurs.
  - `views`, `offerClicks`, `callClicks`, `directionsClicks` valent `null` (pas `0`).
  - `saves` vaut `0` quand la vidéo est absente de la map (la table `saved_videos` est une mesure
    réelle depuis sa création).
  - Aucune clé dérivée : `expect(JSON.stringify(result)).not.toMatch(/conversion|roi|rate/i)`.
- [ ] **Étape 2 :** `pnpm --filter web test merchant-dashboard` → FAIL.
- [ ] **Étape 3 :** implémenter. La route lit `videos` avec le client serveur (RLS propriétaire) :
      `author_id = user.id and is_merchant = true`, 100 dernières. Le nombre de sauvegardes par
      vidéo est compté avec le client admin **uniquement en agrégat** (`video_id, count`) sur les
      ids de ces vidéos, car la RLS de `saved_videos` limite chacun à ses propres lignes.
- [ ] **Étape 4 : test de route** (style des tests de route existants) : 401 anonyme,
      403 `pending`, 403 `rejected`, 200 `approved` avec la forme `MerchantDashboard`.
- [ ] **Étape 5 : UI.** `MerchantDashboard` affiche : quota du jour ; bouton « Préparer une
      offre » vers la capture avec la catégorie Commerce présélectionnée (vérifier si `/filmer`
      accepte `?category=shop` ; sinon ajouter la présélection dans `CaptureFlow`) ; totaux ; liste
      des offres (légende, conditions, état via `getOfferStatus`, statut de modération, compteurs).
      Toute valeur `null` → `merchant.dashboard.statsUnavailable` = « Statistiques non
      disponibles ». Action « Retirer » → `DELETE /api/videos/[id]` après confirmation.
- [ ] **Étape 6 :** boucle qualité complète → PASS.
- [ ] **Étape 7 : commit** `feat(web): merchant dashboard with measured counters only`

### Tâche 2 : mesure des vues et des clics d'offre (agrégats sans utilisateur)

**Fichiers :**

- Créer : `supabase/migrations/20261029000900_video_daily_stats.sql`
- Modifier : `supabase/tests/database/010_schema.test.sql`, `020_rls.test.sql`,
  `030_functions.test.sql`
- Créer : `apps/web/src/app/api/videos/[id]/events/route.ts` (+ test)
- Créer : `apps/web/src/lib/video-events.ts` (+ test)
- Modifier : `apps/web/src/components/feed/VideoCard.tsx`,
  `apps/web/src/components/video/VideoPageInteractions.tsx` (déclencheurs)
- Modifier : `packages/shared/src/schemas.ts` (schéma Zod de l'événement)
- Régénérer : `packages/shared/src/database.types.ts` (`pnpm db:types`)

**Interfaces :**

- SQL :
  ```sql
  create type public.video_event_kind as enum ('view', 'offer_click', 'call_click', 'directions_click');
  create table public.video_daily_stats (
    video_id uuid not null references public.videos (id) on delete cascade,
    day date not null,
    kind public.video_event_kind not null,
    count integer not null default 0 check (count >= 0),
    primary key (video_id, day, kind)
  );
  -- RLS activée ; aucune policy d'écriture client ; select réservé à l'auteur de la vidéo
  -- (exists videos v where v.id = video_id and v.author_id = auth.uid()) et à l'admin.
  create function public.record_video_event(p_video uuid, p_kind public.video_event_kind, p_rate_key text)
    returns void;
  -- security definer, search_path = '' ; sans effet si la vidéo n'est pas 'active' ou si
  -- auth.uid() en est l'auteur ; perform check_rate_limit(p_rate_key, 'video_event') ;
  -- upsert count = count + 1 sur (video_id, current_date, kind).
  -- app_config : clé 'merchant_stats_since' = now() au moment de la migration.
  ```
  Ajouter la règle `video_event` au même mécanisme que `publish` / `comment`.
  `p_rate_key` = `auth.uid()` si connecté, sinon un hash HMAC d'un cookie de session anonyme
  calculé par la route (aucune IP stockée en clair).
- `POST /api/videos/[id]/events` body `{ kind }` → 204. Zod à la frontière ; protection CSRF
  comme les autres mutations.
- `trackVideoEvent(videoId: string, kind: VideoEventKind): void` dans `video-events.ts` :
  `fetch` en `keepalive`, ne rejette jamais, dédoublonne `view` par vidéo et par onglet
  (`sessionStorage`, wrappé en try/catch).
  Commentaire attendu dans le code : `shortcut: dédoublonnage des vues côté client, un client
hostile peut gonfler jusqu'à la limite du rate limit ; passer à un dédoublonnage serveur si les
chiffres sont contestés.`
- Déclencheur `view` : vidéo visible ≥ 2 s. Réutiliser l'IntersectionObserver de l'autoplay du
  feed, ne pas en ajouter un second.

- [ ] **Étape 1 : tests pgTAP**
  - schéma : table, PK, RLS activée ;
  - RLS : l'auteur lit ses lignes ; un autre utilisateur et `anon` en lisent 0 ; aucun rôle
    client ne peut `insert / update / delete` ;
  - fonction : un appel → `count = 1` ; deux appels le même jour → `2` ; appel par l'auteur →
    aucun effet ; vidéo `expired` → aucun effet ; au-delà de la limite → exception de rate limit.
- [ ] **Étape 2 :** `pnpm test:db` → FAIL.
- [ ] **Étape 3 :** écrire la migration ; `pnpm db:reset && pnpm db:types`.
- [ ] **Étape 4 :** `pnpm test:db` → PASS.
- [ ] **Étape 5 : tests Vitest** — route : 422 `kind` inconnu, 400/404 id invalide, 204 OK ;
      `trackVideoEvent` : une seule requête `view` pour deux appels, une erreur réseau ne lève rien.
- [ ] **Étape 6 :** implémenter route, `trackVideoEvent`, branchements dans `VideoCard` et
      `VideoPageInteractions` (boutons existants « Voir l'offre », « Appeler », « Itinéraire »).
- [ ] **Étape 7 :** boucle qualité → PASS.
- [ ] **Étape 8 : commit** `feat(db): aggregated daily video view and offer click counters`

### Tâche 3 : brancher les mesures dans le tableau de bord

**Fichiers :**

- Modifier : `apps/web/src/lib/merchant-dashboard.ts` (+ test)
- Modifier : `apps/web/src/app/api/merchant/dashboard/route.ts`
- Modifier : `apps/web/src/components/merchant/MerchantDashboard.tsx`
- Modifier : `apps/web/messages/{fr,en}/merchant.json`

**Interfaces :**

- Consomme : `video_daily_stats`, `app_config.merchant_stats_since` (tâche 2).
- Nouveau paramètre : `buildMerchantDashboard(rows, saves, quota, now, stats)` avec
  `stats: { since: Date; byVideo: Map<string, Partial<Record<VideoEventKind, number>>> }`.
- Règle : vidéo créée avant `since` → métriques mesurées `null` (mesure partielle = non
  disponible). Sinon, valeur absente → `0`.
- Ajout sur chaque vidéo : `dailyViews: { day: string; views: number }[] | null` (7 derniers
  jours), rendu en barres CSS simples, sans dépendance de graphique.

- [ ] **Étape 1 : tests**
  - `video_stats_null_before_tracking` : vidéo créée avant `since` → `views === null`,
    `dailyViews === null`.
  - `video_stats_zero_when_measured` : vidéo créée après `since`, aucune ligne → `views === 0`.
  - Somme correcte sur plusieurs jours et plusieurs `kind`.
  - Toujours aucune clé `conversion|roi|rate`.
- [ ] **Étape 2 :** FAIL → implémenter → PASS.
- [ ] **Étape 3 : UI.** « 12 vues mesurées », « 3 clics sur Voir l'offre », etc. Texte fixe sous
      les statistiques (FR/EN) : « Mesuré depuis le {date}. Les achats en boutique ne sont pas
      visibles par Neighbors Live. » Aucun pourcentage dérivé.
- [ ] **Étape 4 :** boucle qualité → PASS.
- [ ] **Étape 5 : commit** `feat(web): show measured views and offer clicks to merchants`

### Tâche 4 : fiche commerce modifiable par le commerçant approuvé

**Fichiers :**

- Modifier : `apps/web/src/app/api/merchant/route.ts` (ajout `PATCH`, + test)
- Créer si nécessaire : `supabase/migrations/20261029001000_merchant_profile_self_update.sql`
  (vérifier d'abord la policy update de `merchant_profiles` dans `20261025000300_rls.sql`)
- Modifier : `apps/web/src/components/merchant/MerchantForm.tsx` (mode édition)
- Modifier : `supabase/tests/database/020_rls.test.sql`

**Interfaces :**

- `PATCH /api/merchant` : même `schema` Zod que `POST` sans `businessName` (un renommage passe par
  une nouvelle revue admin), mêmes `normalizeWebsite` / `normalizePhone`. 403 si statut ≠
  `approved`.
- Le propriétaire ne peut modifier que `description, website, phone, address, opening_hours` ;
  `status`, `daily_quota`, `reviewed_by`, `business_name` restent hors de portée (privilèges de
  colonnes ou trigger, selon ce que l'existant utilise).

- [ ] **Étape 1 : tests pgTAP** — le propriétaire modifie `phone` ; il ne peut modifier ni
      `status` ni `daily_quota` ; un autre utilisateur ne modifie rien.
- [ ] **Étape 2 : tests de route** — 403 `pending`, 422 site invalide, 200 approuvé.
- [ ] **Étape 3 :** FAIL → implémenter → PASS ; boucle qualité.
- [ ] **Étape 4 : commit** `feat(web): let approved merchants edit their contact details`

### Tâche 5 : documentation, vie privée et vérification de bout en bout

**Fichiers :**

- Modifier : `docs/PRIVACY.md` (mesure agrégée journalière, aucun identifiant, conservation liée
  à la ligne vidéo, cascade à la suppression de compte ; rien à ajouter à l'export personnel car
  aucune donnée par utilisateur)
- Modifier : `docs/DECISIONS.md` (agrégats journaliers sans `user_id` ; refus de toute métrique
  de conversion)
- Modifier : `docs/PROGRESS.md` (une ligne par tâche, statut réellement vérifié, lien vers ce plan)
- Créer : `tests/merchant-dashboard.spec.ts` (Playwright)

- [ ] **Étape 1 : e2e** — commerçant approuvé du seed : ouvre `/commerce`, voit ses offres ; une
      offre antérieure à `merchant_stats_since` affiche « Statistiques non disponibles » ; un autre
      compte ouvre l'offre et clique « Voir l'offre » ; après rechargement, le commerçant voit
      « 1 clic ». Aucun texte de la page ne contient « conversion » ni « % ».
- [ ] **Étape 2 :** `pnpm test:e2e tests/merchant-dashboard.spec.ts` → PASS. Si Supabase local ou
      le worker sont indisponibles, l'écrire tel quel dans `PROGRESS.md`.
- [ ] **Étape 3 :** revue navigateur de `/commerce` en 375 px et en desktop, avec capture.
- [ ] **Étape 4 : commit** `docs: merchant dashboard privacy, decisions and progress`

## Hors périmètre (volontairement)

- Taux de conversion, ROI, chiffre d'affaires, « clients générés » : interdits par la spec.
- Brouillons d'offres sans vidéo : la vidéo vient uniquement de la caméra in-app ; « préparer »
  = ouvrir la capture avec la catégorie Commerce présélectionnée.
- Prolongation d'une offre publiée, publication programmée, paiement / mise en avant.
- Comparaison avec les autres commerces du quartier (fuite de données concurrentes).
