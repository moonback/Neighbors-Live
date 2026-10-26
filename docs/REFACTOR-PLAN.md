# Plan d'audit et de refactorisation — Neighbors Live

État relevé le 26 octobre 2026. Le dépôt contient déjà une V1 étendue et plusieurs améliorations
documentées récemment ; ce plan s'appuie sur le code présent et évite de réimplémenter les parcours
déjà opérationnels.

## État vérifié avant intervention

- Monorepo pnpm : Next.js 16.4.3 / React 19, `apps/web`, worker média, `packages/shared`, Supabase,
  Vitest et Playwright sont présents. Les dépendances sont déjà installées à la racine.
- L'authentification, le feed paginé, MapLibre, la capture vidéo, TUS, la reprise hors ligne, les
  pages de profil et paramètres, les routes d'administration et la modération sont implémentés.
- Le dashboard admin a déjà des vues de demandes commerçantes, utilisateurs et décisions, avec
  filtres et pagination pour les utilisateurs/décisions. La page inclut aussi des données de
  traitement média. Les autorisations restent vérifiées côté serveur.
- Les composants UI et styles partagés existent. Les traductions sont séparées en namespaces FR/EN.
- Les textes onboarding/capture indiquent déjà que le floutage facial peut manquer des visages et
  que les plaques ne sont pas floutées. Les mentions légales FR contiennent encore des champs
  provisoires qui nécessitent les coordonnées et choix juridiques réels du responsable du service.
- Incohérence P1 constatée : `common.slogan` dit encore « Le quartier en direct » / « Your
  neighborhood, live », en contradiction avec le positionnement demandé et le fonctionnement réel.
- Les composants d'administration sont encore de grands composants client/serveur (AdminClient,
  AdminWorkspace, page admin) ; les vues commerce et média sont déjà partiellement isolées. Une
  extraction supplémentaire doit suivre les responsabilités constatées, sans morcellement artificiel.
- Tests existants : Vitest partagé/web/worker, pgTAP et Playwright. Il n'existe pas de suite de
  tests dédiée aux composants React dans `apps/web`; les tests E2E couvrent certains parcours déjà
  documentés dans `PROGRESS.md`.
- L'arbre Git présente `output.md` comme modifié avant cette intervention ; ce fichier est hors
  périmètre et doit être conservé sans modification.

## Priorités

| Priorité | Constat / tâche                                                                                                                                   | Critère de sortie                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0       | Préserver les contrôles serveur, RLS, secrets, uploads privés et la confidentialité de localisation pendant toute refactorisation.                | Aucun changement d'accès ou de schéma sans besoin démontré ; typecheck, tests SQL disponibles et revue des routes impactées.  |
| P0       | Ne pas publier des mentions légales avec des champs provisoires comme si elles étaient finalisées.                                                | Les informations réelles de l'éditeur, contacts et hébergeur sont fournies par le responsable ; aucune donnée n'est inventée. |
| P1       | Aligner le slogan et les textes de découverte FR/EN sur des vidéos locales publiées, sans promesse de direct.                                     | Catalogues FR/EN cohérents et rendu sans ancienne formulation trompeuse.                                                      |
| P1       | Consolider la navigation mobile de l'espace admin et la cohérence de ses états opérationnels.                                                     | Tous les domaines réellement présents restent atteignables au clavier et sur téléphone ; aucun lien décoratif.                |
| P1       | Réduire les responsabilités des grands composants admin/feed/capture seulement là où cela améliore l'isolation et les tests.                      | Composants extraits réutilisables, frontières serveur/client inchangées, pas de duplication métier.                           |
| P2       | Vérifier contraste, focus, tailles tactiles, petits écrans, réduction de mouvement et états de requête sur les parcours modifiés.                 | Revue des écrans et tests adaptés ; écarts non vérifiables documentés.                                                        |
| P2       | Comparer l'identité des pages éditoriales/admin avec le thème sombre du feed/caméra, en s'appuyant sur tokens existants.                          | Tokens cohérents, aucun décalage de contraste ou de marque introduit.                                                         |
| P3       | Ajouter des fonctions nouvelles (pagination de nouvelles files, instrumentation, analytics) uniquement si l'API/modèle et la valeur sont établis. | Critères, sécurité et modèle vérifiés avant toute implémentation ; pas de fausses données.                                    |

## Vérification environnementale et limites

- Les consignes Next locales demandent de consulter `node_modules/next/dist/docs/` avant les
  changements utilisant une API Next. Ce dossier n'est pas présent dans l'installation actuelle ;
  les changements doivent donc rester sur les APIs déjà employées dans le dépôt.
- ARTEMIS a été diagnostiqué : aucun appareil n'était connecté, une instance `Medium_Phone` a été
  lancée, mais l'environnement ARTEMIS est bloqué par l'absence d'une clé API multimodale. Il faut
  résoudre ce blocage et explorer l'application sur appareil avant d'écrire de nouveaux tests UI
  mobiles, conformément à `AGENTS.md`.
- Le serveur ADB a échoué à son premier démarrage ; l'auto-diagnostic ARTEMIS l'a redémarré.
- L'exécution des suites locales et des commandes finales reste à faire. Supabase/Docker et les
  E2E doivent être vérifiés séparément ; leurs indisponibilités seront documentées sans annoncer de
  réussite non observée.

## Séquencement de réalisation

1. Corriger les formulations métier discordantes et les petites incohérences de navigation/identité.
2. Examiner les vues admin et composants partagés liés ; extraire uniquement les unités cohérentes.
3. Vérifier la parité des catalogues FR/EN et le comportement de la navigation responsive.
4. Après exploration ARTEMIS, ajouter/adopter des tests ciblés pour les interactions modifiées ;
   exécuter ensuite typecheck, lint, tests, tests DB/E2E disponibles et build.
5. Mettre à jour `PROGRESS.md` avec les résultats réellement obtenus et ce qui reste bloqué.
