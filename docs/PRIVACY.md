# Confidentialité — état technique

**Statut : document technique de travail, pas une notice juridique finale.** Les coordonnées de
l’éditeur, les sous-traitants réellement utilisés, les transferts éventuels, les durées métier et
les bases juridiques doivent être confirmés par le responsable du service et revus juridiquement
avant une diffusion publique. Les textes de `apps/web/messages/*/legal.json` restent eux aussi des
brouillons.

## Données traitées dans l’application

- Le compte utilise une adresse e-mail, un identifiant utilisateur, un pseudo et les champs de
  profil renseignés. L’authentification et les sessions sont gérées par Supabase Auth.
- Une publication contient une vidéo, sa catégorie, une légende, une position et sa précision au
  moment de la capture. Le serveur refuse les positions dont la précision dépasse 100 m. La
  position exacte est nécessaire aux calculs de proximité et n’est pas renvoyée au client public.
- Les réponses destinées au public utilisent une position approximative et des distances arrondies.
  Les requêtes de position du feed ne sont pas conservées par l’application.
- Les réactions, commentaires, signalements, décisions de modération, demandes commerce et
  préférences nécessaires aux fonctionnalités sont stockés selon les règles d’accès de la base.
- Les abonnements push contiennent l’endpoint et les clés fournis par le navigateur ainsi qu’une
  zone approximative choisie à partir de la position. La position brute n’est pas conservée pour
  cette préférence.
- Une publication hors ligne reste dans IndexedDB du navigateur jusqu’à son envoi ou son abandon.
  Le service worker ne doit mettre en cache que des pages explicitement publiques; les API, vidéos
  signées et autres navigations restent réseau uniquement.

## Vidéos et limites de traitement

Les vidéos brutes sont stockées dans un bucket privé pendant le traitement. Le worker produit une
version traitée, puis supprime l’original après succès. Le floutage de visages est automatisé et
peut manquer de petits visages ou certains mouvements. Le détecteur de plaques n’est pas activé.
Les utilisateurs doivent éviter de filmer des personnes ou informations sensibles sans base
appropriée. Les publications sont éphémères selon leur catégorie; la suppression et les purges
dépendent aussi du fonctionnement des services d’infrastructure.

## Actions de l’utilisateur

Le dépôt comprend des parcours d’export et de suppression de compte. Leur exécution réelle,
l’effacement chez chaque sous-traitant et les durées de conservation doivent être vérifiés dans
l’environnement déployé avant toute promesse publique.

## Informations à confirmer avant publication

1. Identité et coordonnées exactes de l’éditeur et du contact vie privée.
2. Fournisseurs réellement activés (hébergement web, base/auth/storage, worker, e-mail, push,
   cartographie), leurs lieux de traitement et les garanties de transfert applicables.
3. Durées de conservation pour comptes, journaux, signalements, fichiers vidéo, sauvegardes et
   abonnements push.
4. Bases juridiques, droits applicables, procédure de demande et modalités de recours.
5. Revue juridique des textes et validation du comportement de suppression/export en production.
