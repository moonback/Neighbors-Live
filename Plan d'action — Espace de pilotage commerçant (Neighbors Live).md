# Plan d'action — Espace de pilotage commerçant (Neighbors Live)

Oct 28, 2026 · @Maysson

## Objectif et principes

Transformer `/commerce`, aujourd'hui une page de demande de compte avec un quota, en espace de pilotage où le commerçant prépare, suit et comprend ses offres. Livraison en 5 lots sur environ 8 semaines : P1 (lots 0 à 3, fin S6) couvre modèles, validité, historique et statuts ; P2 (lot 4, fin S8) couvre les statistiques.

**Valeur visée :** aider les commerçants à comprendre leur présence sur Neighbors Live et à gérer leurs publications.

Principes non négociables :

- **Aucun chiffre inventé.** Une statistique n'est affichée que si elle est calculée à partir d'événements réellement enregistrés. Sans mesure, l'interface dit « Statistiques non disponibles », jamais « 0 vue ».
- **Pas de conversion affichée.** L'application ne voit pas les achats en boutique ; aucun taux de conversion ni retour sur investissement n'est calculé ou promis.
- **Vie privée d'abord.** Aucun identifiant de spectateur ni position de spectateur stockés ; seuil minimal avant affichage ; statistiques supprimées avec leur durée de conservation.
- **Règles du dépôt respectées.** Migrations nouvelles uniquement, RLS testée par rôle, Zod à chaque frontière, textes FR/EN via `next-intl`, `PROGRESS.md` mis à jour honnêtement à chaque jalon.

## État des lieux dans le code

Les fondations existent (conditions, expiration, statuts vidéo, motifs de masquage) mais rien n'est regroupé côté commerçant, et aucune mesure d'audience n'existe.

| Besoin                 | Existant                                                                                                                                                                                                   | Manque                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Modèles de vidéos      | Capture uniquement via `MediaRecorder` (import galerie interdit), catégorie `shop`                                                                                                                         | Aucun modèle ; un modèle ne peut pas être une vidéo préfabriquée, ce sera un guide de tournage + champs préremplis         |
| Conditions et validité | `videos.offer_terms` (280 car., obligatoire pour les nouvelles offres), `expires_at` (6 h à 7 jours), `lib/offer-status.ts` (valide / expirée / invalide)                                                  | Pas de date de début ; validité non visible dans `/commerce` ; aucune alerte avant expiration                              |
| Historique             | `GET /api/me/videos` : 50 dernières vidéos, tous statuts, avec `hidden_reason`                                                                                                                             | Pas de filtre offres, pas de pagination ; job `purge` et règle « aucun dérivé après expiration »                           |
| Statistiques           | `useful_count` et `comment_count` réels sur `videos`                                                                                                                                                       | Aucun événement de vue ; proposition `video_stats_hourly` dans la roadmap (point 20), non implémentée                      |
| Statut et motifs       | `video_status` (processing, active, hidden, removed, expired, rejected), `hidden_reason` (`reports`, `moderator`, `processing_failed`, `upload_timeout`), `moderation_actions.note`, recours sous 30 jours | Codes affichés bruts ou pas du tout ; refus de compte commerçant sans motif (`admin_review_merchant` ne prend pas de note) |

Point d'attention : les offres sont **post-modérées** (signalements, modérateurs de zone). « Statut de validation » désigne donc, sans décision contraire, l'état de traitement et de modération, pas une validation préalable (voir Décisions).

Fichiers concernés : `apps/web/src/app/(app)/commerce/page.tsx`, `app/api/me/videos/route.ts`, `app/api/merchant/route.ts`, `lib/offer-status.ts`, `components/moderation/Decisions.tsx`, `messages/{fr,en}/merchant.json`, `supabase/migrations/`.

## Périmètre fonctionnel et critères d'acceptation

Cinq chantiers ; les quatre premiers sont P1, les statistiques P2 car elles dépendent d'une mesure à construire.

### C1 — Modèles de vidéos pour les offres courantes (P1)

Un modèle est un **guide de tournage + des valeurs préremplies**, pas une vidéo fournie : la vidéo reste filmée sur place.

- 6 modèles initiaux : promotion en pourcentage, arrivage / nouveauté, offre du jour, happy hour / créneau, fin de série / déstockage, événement en boutique.
- Chaque modèle fournit : légende suggérée (≤ 140 car.), conditions types (≤ 280 car.) avec champs à compléter, durée de visibilité par défaut, 3 à 4 plans conseillés affichés pendant la capture (ex. « 5 s vitrine, 10 s produit, 5 s prix »), rappel des règles (pas de visage reconnaissable de client, prix exact).
- Bouton « Reprendre cette offre » sur une offre de l'historique : préremplit légende, conditions et durée (nouvelle vidéo obligatoire).
- **Acceptation :** depuis `/commerce`, choisir un modèle ouvre `/filmer` en catégorie `shop` avec champs préremplis et modifiables ; aucun champ prérempli n'est publié sans passer par le formulaire ; modèles traduits FR/EN.

### C2 — Conditions et dates de validité clairement visibles (P1)

- Ajouter une date de début facultative `offer_starts_at` (≥ publication, < `expires_at`) pour les offres annoncées à l'avance.
- Afficher partout le même bloc : « Valable du … au … » (date et heure locales), conditions, état (à venir, valide, expire bientôt, expirée, invalide).
- Étendre `getOfferStatus` avec `upcoming` et `ending_soon` (< 2 h restantes) et couvrir chaque cas par un test.
- Aperçu avant publication : le commerçant voit l'offre telle que les voisins la verront.
- **Acceptation :** aucune offre sans conditions saisies ne peut être publiée ; les anciennes offres affichent « Conditions non précisées » ; le statut affiché dans `/commerce`, le feed et `/v/[id]` vient de la même fonction.

### C3 — Historique des offres publiées et expirées (P1)

- Liste paginée des offres du commerçant, filtres : En cours, À venir, Expirées, Masquées ou refusées.
- Chaque ligne : légende, conditions, dates, statut, motif éventuel, compteurs réels disponibles, actions (voir, partager, reprendre, retirer).
- Après expiration, la vidéo et le poster restent purgés ; l'historique conserve uniquement les métadonnées (légende, conditions, dates, statut) pendant une durée à décider (proposition : 12 mois), documentée dans `PRIVACY.md`.
- **Acceptation :** une offre expirée apparaît dans « Expirées » sans lecteur vidéo et avec la mention « Vidéo supprimée après expiration » ; la suppression du compte efface aussi l'historique ; l'export personnel inclut l'historique.

### C4 — Statistiques agrégées de consultation (P2)

- Par offre et par semaine : vues (lecture ≥ 2 s), spectateurs uniques estimés par jour, « utile », commentaires, partages, clics « Voir l'offre », « Appeler », « Itinéraire ».
- Affichage seulement si la mesure est active pour la période et si le seuil est atteint (voir Mesure des statistiques).
- **Acceptation :** aucun nombre n'est affiché pour une période antérieure à l'activation de la mesure ; en dessous du seuil l'interface affiche « Moins de 5 » ; aucune notion de conversion ou de chiffre d'affaires.

### C5 — Statut de validation et motifs de refus (P1)

- Statut lisible pour chaque offre : En traitement, Publiée, À venir, Masquée (en attente de revue), Retirée par la modération, Échec du traitement, Expirée.
- Motif traduit depuis `hidden_reason` et la dernière `moderation_actions` (type + note du modérateur), avec lien vers le recours tant que la fenêtre de 30 jours est ouverte.
- Compte commerçant refusé : motif obligatoire choisi dans une liste (informations incomplètes, activité non commerciale, doublon, autre + note) et indication de la possibilité de redemander.
- **Acceptation :** aucun code technique (`processing_failed`…) n'est visible ; tout masquage ou retrait affiche un motif ; un refus de compte sans motif est impossible côté SQL.

## Modèle de données, migrations et API

Sept migrations nouvelles (aucune migration existante modifiée), chacune avec ses tests pgTAP et la régénération de `database.types.ts`.

| Migration (ordre)          | Contenu                                                                                                                                                                                                                                                                                | Lot |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `merchant_offer_templates` | Table `offer_templates` (clé, catégorie, durée par défaut, actif) ; textes dans `next-intl`, pas en base ; lecture `authenticated`                                                                                                                                                     | 1   |
| `video_offer_starts_at`    | `videos.offer_starts_at timestamptz null`, contrainte `offer_starts_at < expires_at` et `category = 'shop'` ; `template_key text null` ; extension de la RPC de réservation et de `nearby_videos` / `get_public_video` (une offre à venir n'est pas diffusée avant sa date, à décider) | 1   |
| `merchant_offer_history`   | Vue ou RPC `my_offers(p_filter, p_cursor)` SECURITY DEFINER limitée à `auth.uid()` ; job `purge` modifié pour supprimer les fichiers et conserver la ligne métadonnées ; purge des métadonnées après la durée retenue (pg\_cron)                                                       | 2   |
| `merchant_review_reason`   | `merchant_profiles.review_reason text`, `review_note text`, `reviewed_at` ; `admin_review_merchant(p_admin, p_user, p_approve, p_reason, p_note)` refuse un rejet sans motif ; ancienne signature conservée puis dépréciée                                                             | 2   |
| `video_status_reason_view` | Fonction `my_video_status(p_video)` : statut, `hidden_reason`, dernier `moderation_actions` (type, note, date), recours possible                                                                                                                                                       | 2   |
| `video_view_events`        | Table de réception non journalisée `video_view_buffer` (video\_id, kind, day\_hash, bucket\_hour) sans identifiant utilisateur ni IP en clair ; agrégation en `video_stats_hourly` ; `app_config.stats_enabled_at`                                                                     | 4   |
| `merchant_stats_rpc`       | `merchant_offer_stats(p_video)` et `merchant_weekly_stats(p_week)` : refusent si appelant ≠ auteur, appliquent le seuil, renvoient `null` avant `stats_enabled_at`                                                                                                                     | 4   |

### Routes API

- `GET /api/merchant/templates` — modèles actifs (commerçant approuvé).
- `GET /api/merchant/offers?filter=&cursor=` — historique paginé (Zod sur les paramètres).
- `GET /api/merchant/offers/[id]` — détail : statut, motif, recours, compteurs, statistiques si disponibles.
- `POST /api/merchant/offers/[id]/withdraw` — retrait par le commerçant (statut `removed`, action journalisée).
- `POST /api/videos` — accepte `offerStartsAt` et `templateKey` facultatifs.
- `POST /api/events/view` — réception par lots (`sendBeacon`), vérification `Origin`, rate limit, aucune réponse dépendante du contenu.
- Admin : la route de décision commerçant exige `reason` quand `approve = false`.

Chaque route : `requireUser`, contrôle du rôle lu en base, test Vitest (401, 403, 422, succès).

## Mesure des statistiques

Une statistique n'existe dans l'interface que si elle sort de `video_stats_hourly` ou d'un compteur réel de `videos`. Tout le reste est absent, pas estimé.

### Définitions (à figer avant le développement)

| Indicateur                 | Définition                                                                                             | Source                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Vue                        | Lecture visible ≥ 2 s dans le feed, la carte ou `/v/[id]`, hors auteur                                 | Événement client                       |
| Spectateurs uniques (jour) | Hash journalier non réversible (`IP_HASH_SALT` + session + date), dédoublonné puis jeté à l'agrégation | Événement client                       |
| « Utile », commentaires    | Compteurs existants                                                                                    | `videos.useful_count`, `comment_count` |
| Partages                   | Clic sur partage natif ou copie du lien                                                                | Événement client                       |
| Actions commerce           | Clics « Voir l'offre », « Appeler », « Itinéraire »                                                    | Événement client                       |

Non mesuré et jamais affiché : conversions, ventes, visites en boutique, portée géographique fine, profil des spectateurs.

### Chaîne technique

1. Le client envoie des lots d'événements via `navigator.sendBeacon` (aucune position, aucun identifiant de compte).
2. `POST /api/events/view` valide (Zod), limite le débit, calcule le hash journalier et insère dans le tampon.
3. Un job pg\_cron horaire agrège le tampon dans `video_stats_hourly` puis vide le tampon.
4. Les RPC commerçant lisent uniquement l'agrégat.

### Règles d'affichage

- Seuil : aucun chiffre en dessous de 5 vues par offre et par période ; afficher « Moins de 5 ».
- Date d'activation `stats_enabled_at` affichée (« Mesuré depuis le … ») ; les offres antérieures affichent « Non mesuré ».
- Conservation : agrégats supprimés 30 jours après l'expiration de l'offre (règle roadmap) ; le récapitulatif hebdomadaire n'est pas conservé au-delà, sauf décision contraire.
- Mention fixe sous chaque bloc : ce que compte une vue, et que les bloqueurs ou le mode hors ligne peuvent sous-estimer les chiffres.
- Bandeau de la landing `/commerces` (« pas encore de statistiques ») mis à jour seulement après activation réelle en production.

### Validation de la mesure

Avant affichage public : comparaison sur une offre de test entre lectures réelles contrôlées (ex. 20 lectures sur 5 appareils) et agrégat ; écart documenté dans `PROGRESS.md`. Mise à jour de `PRIVACY.md` et des mentions légales (finalité, durée, base légale) avant activation.

## Écrans et parcours commerçant

`/commerce` devient un tableau de bord à onglets pour un compte approuvé ; les états « demande », « en attente » et « refusée » restent tels quels, enrichis du motif de refus.

1. **Vue d'ensemble** — offres en cours et à venir avec temps restant, quota sur 24 h, alertes (offre masquée, expiration dans moins de 2 h, recours en cours), bouton « Publier une offre ».
2. **Publier** — choix d'un modèle ou « Offre libre » → capture guidée `/filmer` avec plans conseillés → formulaire (légende, conditions, début facultatif, durée) → aperçu voisin → publication → suivi du traitement.
3. **Mes offres** — historique filtrable (En cours, À venir, Expirées, Masquées ou refusées), détail par offre : statut, motif, recours, compteurs réels, statistiques (P2), « Reprendre », « Retirer ».
4. **Statistiques** (P2) — semaine en cours et précédente, par offre ; état vide explicite tant que la mesure n'est pas active.
5. **Profil commerce** — coordonnées existantes (site, téléphone, adresse), aperçu de la fiche publique.

Exigences transverses : cibles ≥ 44 px, focus visible, `aria-live` pour les changements de statut, mouvement réduit, mobile d'abord puis grand écran (sidebar existante), toutes les chaînes dans `messages/fr/merchant.json` et `messages/en/merchant.json` avec parité vérifiée.

Libellés de statut proposés :

| Code interne                                       | Libellé commerçant                              | Action proposée                                    |
| -------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `processing`                                       | En cours de traitement                          | Attendre ; rafraîchissement automatique            |
| `active` + début futur                             | À venir                                         | Modifier les conditions avant le début (à décider) |
| `active`                                           | Publiée                                         | Partager, retirer                                  |
| `hidden` / `reports`                               | Masquée après signalements, en attente de revue | Consulter les règles                               |
| `hidden` / `moderator`, `removed`                  | Retirée par la modération + note                | Faire un recours (30 jours)                        |
| `rejected` / `processing_failed`, `upload_timeout` | La vidéo n'a pas pu être traitée                | Republier                                          |
| `expired`                                          | Expirée — vidéo supprimée                       | Reprendre l'offre                                  |

## Plan de livraison

La P1 est livrable en 6 semaines, la P2 en semaine 8 si la décision D4 est prise à temps. Estimation pour un développeur full-stack, à recaler après le lot 0.

&#91;embedded content: Livraison · 5 lots sur 8 semaines, 3 jalons\]

Les lots 1 et 2 se chevauchent en S3 : l'historique réutilise le statut d'offre étendu au lot 1.

| Lot                       | Semaines | Tâches principales                                                                                                                              | Terminé quand                                                                      |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0 — Préparation           | S1       | Réparer Docker / PostgreSQL local et le lint (`EPERM`) ; trancher D1 à D4 ; figer les définitions de mesure ; maquettes basse fidélité          | pgTAP et E2E exécutables en local et en CI ; décisions écrites dans `DECISIONS.md` |
| 1 — Modèles et validité   | S2–S3    | Migrations `offer_templates`, `offer_starts_at` ; 6 modèles FR/EN ; capture guidée ; `getOfferStatus` étendu ; bloc de validité unique ; aperçu | Publication via modèle de bout en bout en E2E                                      |
| 2 — Historique et statuts | S3–S5    | RPC `my_offers`, purge adaptée, `my_video_status`, motifs traduits, motif de refus commerçant obligatoire, retrait par le commerçant            | Une offre expirée, masquée ou retirée apparaît avec le bon libellé et son motif    |
| 3 — Tableau de bord       | S5–S6    | Onglets de `/commerce`, alertes, accessibilité, parité FR/EN, recette avec commerçants pilotes, `PROGRESS.md`                                   | Recette P1 signée                                                                  |
| 4 — Statistiques          | S6–S8    | Tampon d'événements, `sendBeacon`, agrégation pg\_cron, RPC avec seuil, onglet Statistiques, `PRIVACY.md`, validation de la mesure              | Chiffres de test conformes aux lectures contrôlées ; activation en production      |

## Tests, recette et indicateurs de réussite

Un lot n'est terminé que lorsque `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, `pnpm test:db` et les E2E concernés passent réellement ; sinon l'écart est écrit dans `PROGRESS.md`.

- [ ] **pgTAP** : chaque nouvelle colonne, contrainte, RPC et policy, testée par rôle (anon, user, merchant, modérateur, admin) ; un commerçant ne lit jamais l'historique ou les statistiques d'un autre.
- [ ] **pgTAP** : rejet de compte sans motif refusé ; offre avec `offer_starts_at ≥ expires_at` refusée ; purge conserve les métadonnées et supprime les fichiers.
- [ ] **Vitest** : `getOfferStatus` (7 états, fuseau horaire), mapping statut/motif → libellé, routes `/api/merchant/*` et `/api/events/view` (401, 403, 422, rate limit).
- [ ] **Vitest** : agrégation (seuil de 5, aucune donnée avant activation, dédoublonnage journalier, auteur exclu).
- [ ] **Playwright** : modèle → capture simulée → publication → statut « Publiée » ; offre masquée par 3 signalements → motif visible → recours ; expiration simulée → offre dans « Expirées » sans vidéo.
- [ ] **Accessibilité** : revue clavier et lecteur d'écran du tableau de bord ; contraste des badges de statut.
- [ ] **Appareils réels** : Chrome Android et Safari iOS pour la capture guidée et l'envoi des événements.
- [ ] **Recette métier** : 3 à 5 commerçants pilotes publient au moins une offre avec un modèle.

Indicateurs de réussite (mesurés seulement une fois l'instrumentation active, sans cible chiffrée inventée) :

- part des offres publiées via un modèle ;
- part des offres avec conditions complètes et dates cohérentes ;
- nombre de demandes au support sur « pourquoi mon offre n'apparaît pas », avant et après le lot 2 ;
- taux de reprise d'une offre expirée.

## Risques et décisions à prendre

Quatre décisions bloquent le démarrage des lots concernés ; les trancher avant la semaine 1.

### Décisions

- [ ] **D1 — Validation préalable des offres ?** Aujourd'hui, post-modération. Option A : garder la post-modération et afficher l'état de modération (recommandé pour P1). Option B : file de validation avant diffusion pour la catégorie `shop`, avec statut « En attente de validation » (charge de modération et délai à annoncer). Bloque le lot 2.
- [ ] **D2 — Durée de conservation de l'historique** (métadonnées sans vidéo) : proposition 12 mois ; conforme à la règle « aucun dérivé après expiration » seulement si on acte que légende et conditions ne sont pas des dérivés média. Bloque le lot 2.
- [ ] **D3 — Offres à venir** : diffusées dès la publication avec « À partir du … », ou retenues jusqu'à la date de début ? La limite de 7 jours d'expiration s'applique-t-elle depuis la publication ou depuis le début ? Bloque le lot 1.
- [ ] **D4 — Activation des statistiques** : base légale, information des spectateurs, seuil (5 proposé) et conservation (30 jours proposés) validés juridiquement. Bloque le lot 4.

### Risques

| Risque                                                                           | Effet                                                          | Parade                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Statistiques affichées avant mesure fiable                                       | Perte de confiance, promesse trompeuse                         | Drapeau `stats_enabled_at`, état « Non mesuré », recette de validation de la mesure |
| Réidentification de spectateurs sur de petites zones                             | Atteinte à la vie privée                                       | Seuil de 5, pas de découpage géographique ni horaire fin, aucun identifiant stocké  |
| Historique en conflit avec la purge                                              | Non-conformité `PRIVACY.md`                                    | Décision D2, purge des fichiers inchangée, test pgTAP                               |
| Environnement local instable (Docker, PostgreSQL, `EPERM` sur `.swc-safe-cache`) | Migrations et pgTAP non vérifiés, comme sur les jalons récents | Réparer l'environnement en lot 0 ; CI comme référence                               |
| Modèles perçus comme contenus génériques                                         | Offres uniformes, moins utiles                                 | Modèles à champs à compléter, tests avec commerçants pilotes                        |
| Ad blockers et mode hors ligne                                                   | Vues sous-estimées                                             | Mention explicite sous les statistiques                                             |
