# Atelier — consignes pour les IA qui travaillent sur ce projet

## Fiche ETAT.md (priorité haute)
- Après chaque petit pas, mets à jour la section « En cours » d'`ETAT.md` : ce que tu fais, ce qui est fait et la prochaine action précise.
- À la fin de chaque étape validée, mets à jour l'en-tête (statut, avancement estimé d'après le plan, dernière étape, prochaine étape, date, ton nom et ton outil), puis vide « En cours ».
- Respecte les règles de commit de ce projet : la fiche part sur GitHub avec le prochain commit. Dans un environnement temporaire (session dans le nuage), pousse ta branche de travail avant de t'arrêter.
- Si on te dit « Reprends », lis `ETAT.md` (« En cours »), puis `PASSATION.md` s'il existe, et continue.

## Le propriétaire
- Il n'est pas développeur : réponds en français du Québec, simplement, et dis-lui toujours quoi tester.
- Secrets (clés GitHub, Cloudflare, jeton de service) : jamais dans Git, jamais dans une conversation. En local : `.dev.vars`; en ligne : `wrangler secret put` ou secrets GitHub Actions.

## Avant toute modification
1. Lire `PASSATION.md`, puis `docs/superpowers/specs/2026-11-23-atelier-design.md` (la conception approuvée).
2. `git status` et `git log --oneline -10`.

## Règles non négociables (voir la conception, sections 4 à 6)
- Atelier lit GitHub et n'écrit jamais dans les dépôts des projets.
- Atelier ne touche jamais aux comptes IA : aucun jeton d'abonnement lu, stocké ou envoyé; aucun changement de compte automatique.
- Une valeur inconnue s'affiche « — » ou « À compléter », jamais 0.
- Toute requête `/api/*` passe par la garde d'accès (`worker/acces.ts`).
- Migrations D1 : on n'en modifie jamais une déjà appliquée, on en ajoute une nouvelle (ajouts seulement).
- Petits commits vérifiés, messages en français.

## Commandes
```sh
npm test              # tests du Worker et des règles (vitest, base D1 locale)
npm run test:e2e      # construit l'interface et lance les tests de navigateur (API simulée)
npm run typecheck     # vérification TypeScript
npm run dev           # application locale
```
