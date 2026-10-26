# Roadmap vidéo — Voisino

Objectif : faire de Voisino une application vidéo locale complète (capture, édition, lecture,
social, confiance, statistiques) **sans renier ses principes** :

- **Filmé sur place, maintenant** : pas d’import depuis la galerie, 30 s maximum, position vérifiée
  à la publication. Toute fonctionnalité d’édition ne s’applique qu’aux enregistrements faits dans
  l’app.
- **Vie privée par défaut** : floutage automatique des visages (et des plaques en option), position
  publique arrondie à ~50 m, aucune donnée de visionnage individuelle exposée.
- **Éphémère** : chaque vidéo expire selon sa catégorie ; les dérivés (sous-titres, miniatures,
  variantes HLS) expirent avec elle.
- **PWA d’abord** : tout doit fonctionner dans Safari iOS et Chrome Android, avec dégradation propre
  quand une API manque.

## État actuel (socle existant)

| Domaine    | Déjà en place                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capture    | `getUserMedia` + `MediaRecorder` (MP4 sur Safari, WebM ailleurs), 30 s max avec jauge, **changement de caméra** (cycle entre toutes les caméras, double tap sur l’image, retour automatique si une caméra refuse de s’ouvrir), **lampe torche** si supportée |
| Envoi      | Upload reprenable (tus), file d’attente hors ligne (IndexedDB) avec republication au retour du réseau                                                                                                                                                        |
| Traitement | Worker : floutage visages (YuNet) + plaques (optionnel), transcodage MP4, poster JPEG, suppression de l’original                                                                                                                                             |
| Lecture    | Flux vertical plein écran, autoplay de la carte visible, préchargement de la suivante, URL signées renouvelées                                                                                                                                               |
| Social     | Réactions « utile », commentaires, partage, signalement, profils, commerces                                                                                                                                                                                  |
| Confiance  | Modération par zone, masquage automatique après signalements, appels, journal d’audit                                                                                                                                                                        |

## Vue d’ensemble des 20 fonctionnalités

| #   | Fonctionnalité                                                     | Domaine                 | Priorité | Effort |
| --- | ------------------------------------------------------------------ | ----------------------- | -------- | ------ |
| 1   | Zoom (pincer) et choix d’objectif 0,5× / 1× / 2×                   | Capture                 | P0       | M      |
| 2   | Enregistrement en plusieurs prises (pause / reprise)               | Capture                 | P0       | M      |
| 3   | Minuteur mains libres (3 s / 10 s)                                 | Capture                 | P1       | S      |
| 4   | Changer de caméra **pendant** l’enregistrement                     | Capture                 | P2       | L      |
| 5   | Qualité adaptative à la capture (720p / 1080p, débit selon réseau) | Capture                 | P1       | S      |
| 6   | Découpe (trim) dans l’aperçu                                       | Édition                 | P0       | M      |
| 7   | Texte et autocollants de contexte (lieu, heure, catégorie)         | Édition                 | P1       | L      |
| 8   | Correction automatique (luminosité, nuit) et filtres sobres        | Édition                 | P2       | M      |
| 9   | Sous-titres automatiques (transcription)                           | Édition / Accessibilité | P0       | L      |
| 10  | Choix de la miniature                                              | Édition                 | P1       | S      |
| 11  | Streaming adaptatif HLS multi-débits                               | Lecture                 | P0       | L      |
| 12  | Lecteur avancé (progression, scrub, vitesse, double tap, PiP)      | Lecture                 | P0       | M      |
| 13  | Mode économie de données et préchargement intelligent              | Lecture                 | P1       | M      |
| 14  | Réponses vidéo à une vidéo (fil d’un événement)                    | Social                  | P1       | L      |
| 15  | Abonnements + onglets « Pour toi / À proximité / Suivis »          | Social                  | P0       | L      |
| 16  | Partage enrichi (aperçu vidéo, lien profond, QR commerce)          | Social                  | P1       | M      |
| 17  | Direct vidéo (live) de quartier                                    | Social                  | P2       | XL     |
| 18  | Floutage manuel avant publication + aperçu du floutage             | Confiance               | P0       | L      |
| 19  | Modération assistée (détection de contenus sensibles, empreintes)  | Confiance               | P1       | L      |
| 20  | Statistiques vidéo pour auteurs et commerçants                     | Analytique              | P1       | M      |

Effort : **S** ≈ 1–2 j · **M** ≈ 3–5 j · **L** ≈ 1–2 sem. · **XL** > 3 sem. (une personne).
Priorité : **P0** indispensable pour une app vidéo complète · **P1** forte valeur · **P2** différenciant.

---

## Phase 1 — Capture de niveau « app native »

### 1. Zoom (pincer) et choix d’objectif

- **Pourquoi** : filmer un panneau, une vitrine ou un incident à distance sans s’approcher.
- **Ce que voit l’utilisateur** : pincer pour zoomer ; pastilles « 0,5× · 1× · 2× » au-dessus du
  bouton d’enregistrement (seulement celles que l’appareil propose).
- **Implémentation** :
  - `Camera.tsx` : lire `track.getCapabilities().zoom` ; appliquer
    `track.applyConstraints({ advanced: [{ zoom }] })` sur `pointermove` à deux doigts.
  - Objectifs : regrouper les caméras arrière de `enumerateDevices()` (ultra grand-angle,
    téléobjectif) et proposer un sélecteur ; repli sur le zoom numérique quand `zoom` n’existe pas.
- **Critères d’acceptation** : zoom fluide (≥ 30 i/s) sur Pixel et iPhone récents ; aucun bouton
  affiché pour une capacité absente ; le zoom est conservé pendant l’enregistrement.
- **Risques** : iOS n’expose pas `zoom` dans toutes les versions → repli numérique (recadrage).

### 2. Enregistrement en plusieurs prises (pause / reprise)

- **Pourquoi** : montrer avant/après, ou plusieurs angles, dans la limite de 30 s.
- **Ce que voit l’utilisateur** : maintenir pour filmer, relâcher pour mettre en pause ; la jauge
  montre des segments ; bouton « supprimer la dernière prise ».
- **Implémentation** : `MediaRecorder.pause()` / `resume()` ; jauge segmentée ; pour annuler la
  dernière prise, enregistrer un `MediaRecorder` par segment et concaténer côté worker
  (ffmpeg `concat`) — le client envoie un manifeste de segments.
- **Critères d’acceptation** : durée cumulée plafonnée à `MAX_RECORDING_MS` ; une vidéo publiée sans
  saut audio audible entre les prises.
- **Dépendances** : worker (concaténation).

### 3. Minuteur mains libres

- **Ce que voit l’utilisateur** : icône minuteur (désactivé / 3 s / 10 s), compte à rebours plein
  écran avec bips courts, puis enregistrement automatique.
- **Implémentation** : uniquement client (`Camera.tsx`), annonce `aria-live` du décompte.
- **Critères d’acceptation** : annulable en touchant l’écran ; respecte `prefers-reduced-motion`.

### 4. Changer de caméra pendant l’enregistrement

- **Pourquoi** : filmer la scène puis se filmer pour commenter, sans couper.
- **Implémentation** : enregistrer un flux composé plutôt que la caméra directement :
  `<canvas>` alimenté par la caméra active (`requestVideoFrameCallback`) +
  `canvas.captureStream(30)` + piste audio du micro conservée ; changer de caméra remplace la source
  du canvas sans arrêter le `MediaRecorder`.
- **Critères d’acceptation** : coupure visible < 500 ms au changement ; pas de désynchronisation
  audio ; consommation CPU acceptable sur un Android milieu de gamme.
- **Risques** : coût batterie/CPU du canvas ; à activer seulement si l’appareil tient 30 i/s.

### 5. Qualité adaptative à la capture

- **Implémentation** : choisir 1080p / 720p et `videoBitsPerSecond` selon
  `navigator.connection.effectiveType`, la mémoire (`deviceMemory`) et la taille max
  (`MAX_UPLOAD_BYTES`) ; préférence « Qualité maximale » dans les paramètres.
- **Critères d’acceptation** : aucune vidéo de 30 s ne dépasse `MAX_UPLOAD_BYTES` ; en 3G, envoi
  terminé en moins de 60 s pour 30 s de vidéo.

---

## Phase 2 — Édition légère (sur la vidéo qu’on vient de filmer)

### 6. Découpe (trim)

- **Ce que voit l’utilisateur** : dans l’aperçu, une bande de vignettes avec deux poignées début/fin.
- **Implémentation** : le client envoie `trimStartMs` / `trimEndMs` avec la publication (schéma Zod
  dans `packages/shared/src/schemas.ts`) ; le worker applique `-ss`/`-to` avant le floutage (moins
  d’images à traiter). Vignettes générées côté client via `<video>` + `<canvas>`.
- **Critères d’acceptation** : durée finale ≥ 2 s ; la durée enregistrée en base reflète la découpe.

### 7. Texte et autocollants de contexte

- **Pourquoi** : rendre une vidéo compréhensible sans le son (« Rue barrée jusqu’à 18 h »).
- **Ce que voit l’utilisateur** : ajouter un texte (police, couleur de marque), des autocollants
  générés à partir du contexte : quartier, heure, catégorie, nom du commerce.
- **Implémentation** : calques décrits en JSON (texte, position normalisée, échelle, rotation) ;
  incrustation par le worker (ffmpeg `drawtext`/`overlay`) **après** le floutage pour ne jamais
  masquer un floutage. Longueur et contenu des textes modérés comme les légendes.
- **Critères d’acceptation** : rendu identique entre l’aperçu et la vidéo publiée (± 2 % de position).

### 8. Correction automatique et filtres sobres

- **Implémentation** : correction d’exposition/contraste côté worker (ffmpeg `eq`, `curves`) activée
  par défaut pour les vidéos sombres (luminance moyenne mesurée) ; 3 filtres maximum, aperçu en CSS
  `filter` côté client.
- **Garde-fou** : pas de filtre qui altère la réalité (pas de retouche de visages) — l’app reste un
  outil d’information.

### 9. Sous-titres automatiques

- **Pourquoi** : accessibilité (personnes sourdes ou malentendantes), lecture sans le son.
- **Implémentation** : job `transcribe` dans le worker après le transcodage (modèle Whisper local,
  type `whisper.cpp` small/base FR) → fichier WebVTT stocké à côté de la vidéo, servi par URL signée,
  affiché via `<track kind="subtitles">`. L’auteur peut corriger le texte avant/après publication.
- **Critères d’acceptation** : sous-titres disponibles < 1 min après publication pour 30 s ;
  bouton « CC » dans le lecteur ; le VTT expire avec la vidéo.
- **Risques** : coût CPU du worker → file dédiée et priorité basse ; propos tenus par des tiers →
  passage par la même modération que les légendes.

### 10. Choix de la miniature

- **Implémentation** : curseur sur la bande de vignettes de l’aperçu ; `posterAtMs` envoyé au
  worker, qui extrait l’image **de la vidéo floutée**.
- **Critères d’acceptation** : la miniature n’est jamais tirée de l’original non flouté.

---

## Phase 3 — Lecture fluide

### 11. Streaming adaptatif HLS

- **Pourquoi** : démarrage plus rapide et moins de coupures en 4G faible.
- **Implémentation** : le worker produit des variantes 360p / 540p / 720p (segments fMP4 de 2 s +
  playlist `.m3u8`) ; lecture native sur Safari, `hls.js` chargé à la demande ailleurs ; signature
  des segments (jeton court dans l’URL ou cookie signé du stockage).
- **Critères d’acceptation** : temps avant première image < 1 s en 4G ; aucune régression sur la
  lecture hors ligne existante (repli MP4).
- **Dépendances** : politique de stockage et CSP (`media-src`) à mettre à jour.

### 12. Lecteur avancé

- **Ce que voit l’utilisateur** : barre de progression fine en bas, scrub au glisser, vitesse
  0,5×–2× (appui long), double tap = « utile » avec animation, mode Picture-in-Picture, plein écran
  paysage pour les vidéos horizontales.
- **Implémentation** : `VideoCard.tsx` ; respecter `prefers-reduced-motion` (pas d’animation de
  cœur) ; raccourcis clavier sur desktop (espace, ←/→, M).
- **Critères d’acceptation** : tous les contrôles atteignables au clavier et annoncés par les
  lecteurs d’écran ; cibles tactiles ≥ 44 px.

### 13. Économie de données et préchargement intelligent

- **Implémentation** : paramètre « Économiser les données » (et `navigator.connection.saveData`) :
  pas d’autoplay, qualité basse, préchargement du poster seulement ; sinon préchargement des 2
  prochaines vidéos en Wi-Fi, 1 en mobile. Mise en cache des posters par le service worker.
- **Critères d’acceptation** : consommation mesurée < 50 % du mode normal sur 20 vidéos.

---

## Phase 4 — Social

### 14. Réponses vidéo

- **Pourquoi** : suivre un événement en direct à plusieurs (« la rue est rouverte », « le marché a
  commencé »).
- **Implémentation** : colonne `reply_to_video_id` (même zone obligatoire, profondeur 1) ; écran
  « Répondre en vidéo » qui ouvre la caméra ; fil des réponses sous la vidéo d’origine ; expiration
  alignée sur la vidéo parente au maximum.
- **Critères d’acceptation** : impossible de répondre depuis plus loin que le rayon de la vidéo
  d’origine ; la suppression de la parente masque le fil.

### 15. Abonnements et onglets de flux

- **Ce que voit l’utilisateur** : bouton « Suivre » sur les profils et commerces ; en haut du flux,
  onglets « Pour toi » (score actuel), « À proximité » (tri par distance), « Suivis ».
- **Implémentation** : table `follows (follower_id, followee_id)` + RLS ; RPC `following_videos`
  (toujours limitée au rayon choisi : on suit des voisins, pas des célébrités) ; compteurs sur le
  profil ; notification push optionnelle « @x a publié près de chez vous ».
- **Critères d’acceptation** : un utilisateur bloqué ne peut pas suivre ; pas de liste publique des
  abonnés (vie privée), seulement le nombre.

### 16. Partage enrichi

- **Implémentation** : page `/v/[id]` avec métadonnées Open Graph `og:video` / `og:image` (poster
  flouté), lien profond qui ouvre la PWA installée ; QR code imprimable pour les commerçants
  (« Nos offres en vidéo ») menant à leur profil.
- **Critères d’acceptation** : aperçu correct dans WhatsApp, Messenger, iMessage ; aucune position
  précise dans l’aperçu.

### 17. Direct vidéo de quartier

- **Pourquoi** : « Le quartier en direct » au sens propre — fête de rue, marché, match local.
- **Implémentation** : WebRTC via un SFU géré (LiveKit, Cloudflare Calls) ou WHIP → LL-HLS ;
  limité aux comptes de confiance (réputation, commerçants validés) ; durée maximale (15 min) ;
  floutage en temps réel impossible à garantir → **pas de direct dans les catégories à risque**, rappel
  explicite des règles avant le lancement, coupure immédiate par les modérateurs, enregistrement
  conservé 24 h pour la modération puis supprimé.
- **Critères d’acceptation** : latence < 5 s ; un signalement atteint un modérateur en < 1 min.
- **Risques** : juridiques et de modération élevés — à lancer en bêta fermée sur une zone.

---

## Phase 5 — Confiance et sécurité

### 18. Floutage manuel et aperçu du floutage

- **Pourquoi** : le floutage automatique peut rater un visage, une plaque, un écran ou une adresse.
- **Ce que voit l’utilisateur** : dans l’aperçu, toucher une zone pour la flouter ; le suivi la garde
  sur les images suivantes ; après traitement, l’auteur voit la version floutée et peut la retirer
  avant qu’elle ne soit visible par tous.
- **Implémentation** : zones envoyées en coordonnées normalisées + horodatage ; le worker les
  injecte dans le `BoxTracker` existant (`apps/worker/src/blur/tracker.ts`) comme détections
  supplémentaires ; statut vidéo `review_by_author` facultatif de 2 min avant publication.
- **Critères d’acceptation** : une zone manuelle reste floutée sur toute sa durée de présence ;
  tests unitaires du worker sur des boîtes injectées.

### 19. Modération assistée

- **Implémentation** :
  - Classification automatique (violence, nudité, armes, mineurs) sur quelques images clés par le
    worker ; score stocké, au-dessus d’un seuil → statut `held` + file prioritaire des modérateurs.
  - Empreintes perceptuelles (pHash des images clés) des vidéos supprimées pour bloquer leur
    republication à l’identique.
  - Le modèle **ne supprime jamais seul** : il retient et explique, un humain décide (cohérent avec le
    système d’appels existant).
- **Critères d’acceptation** : taux de faux positifs mesuré sur un jeu de test interne ; chaque
  décision automatique apparaît dans le journal d’audit admin.

---

## Phase 6 — Statistiques

### 20. Statistiques vidéo pour auteurs et commerçants

- **Ce que voit l’utilisateur** : sur chaque vidéo, vues, durée moyenne de visionnage, « utile »,
  partages, et une carte de portée **agrégée par cellule H3** ; pour les commerçants, un tableau de
  bord de la semaine.
- **Implémentation** : événements de visionnage envoyés par lots (`navigator.sendBeacon`) — vue
  comptée à 2 s ; agrégation horaire en base (table `video_stats_hourly`), sans identifiant de
  spectateur stocké ; dédoublonnage par fenêtre courte côté serveur (hash journalier non réversible,
  `IP_HASH_SALT` existant).
- **Critères d’acceptation** : aucune statistique affichée en dessous de 5 vues (anti
  réidentification) ; les statistiques expirent 30 jours après la vidéo.

---

## Ordre de réalisation conseillé

| Itération | Contenu        | Résultat                                                          |
| --------- | -------------- | ----------------------------------------------------------------- |
| 1         | 1, 2, 3, 6, 10 | Capture et édition au niveau des apps natives                     |
| 2         | 11, 12, 13     | Lecture rapide et confortable partout                             |
| 3         | 9, 18          | Accessibilité et vie privée renforcées                            |
| 4         | 15, 16, 5      | Rétention : suivre ses voisins, partager hors de l’app            |
| 5         | 7, 14, 19, 20  | Richesse éditoriale, conversations, confiance, valeur commerçants |
| 6         | 4, 8, 17       | Différenciation : multi-caméra en direct, filtres, live           |

## Exigences transverses (à vérifier pour chaque fonctionnalité)

- **Tests** : unitaires (Vitest) pour la logique pure, e2e Playwright avec les faux périphériques
  Chromium (`--use-fake-device-for-media-stream`), tests SQL pgTAP pour chaque nouvelle table/RPC.
- **Accessibilité** : WCAG 2.2 AA, cibles ≥ 44 px, `prefers-reduced-motion`, sous-titres.
- **Vie privée** : aucun dérivé (miniature, sous-titres, segments HLS, statistiques) ne survit à
  l’expiration de la vidéo ; jamais d’original non flouté exposé.
- **Performance** : budget JS de la page de capture < 150 Ko gzip ; chargement à la demande des
  modules lourds (`hls.js`, éditeur).
- **i18n** : toutes les chaînes en FR et EN dans `apps/web/messages/`.
