# PASSATION — Atelier

> À lire en premier par toute IA ou personne qui reprend le projet.

## Le projet en deux phrases
Atelier est l'accueil privé du propriétaire : il voit d'un coup d'œil tous ses projets GitHub (regroupés, avec statut, avancement, étapes, liens), ses idées, ses projets endormis et ses quotas IA, et tout se met à jour seul.
Conçu d'abord pour l'ordinateur (direction A « Couleurs de projets »), avec une version une colonne pour le téléphone.

Conception : `docs/superpowers/specs/2026-11-23-atelier-design.md` · Plan : `docs/superpowers/plans/2026-11-23-atelier-v1.md` · Maquettes : https://claude.ai/artifact/Ty9PkEvXW2hRNGBn8owqD6

## Où on en est (23 novembre 2026)
**Bâti et testé localement :** garde d'accès Cloudflare Access (propriétaire + jeton de service limité aux quotas), base D1 et données de départ, lecture des fiches `ETAT.md`, synchronisation GitHub toutes les 15 minutes, API, accueil, fiche projet (« Reprendre »), réglages, quotas IA (saisie Google, entrée Claude), script de barre d'état.
Tests : `npm test` (vitest) et `npm run test:e2e` (navigateur, API simulée) tous verts.

**Pas encore fait (gestes du propriétaire, guidés) :**
1. Créer le dépôt GitHub privé `atelier` et y pousser ce code; ajouter le secret `CLOUDFLARE_API_TOKEN` (modèle « Edit Cloudflare Workers » + D1 Edit).
2. `wrangler d1 create atelier`, mettre l'identifiant dans `wrangler.jsonc` (`database_id`).
3. Activer Cloudflare Access sur le Worker (workers.dev, son courriel seulement, session 1 mois); mettre `ACCES_EQUIPE`, `ACCES_AUD`, `ACCES_COURRIEL` dans `wrangler.jsonc`.
4. Créer la clé GitHub fine-grained (All repositories, Metadata + Contents en lecture, 1 an) → `wrangler secret put GITHUB_CLE`.
5. Vérifier sur l'iPhone : connexion, « Ajouter à l'écran d'accueil », réouverture le lendemain. Échec → Safari ordinaire.
6. Sonde de barre d'état (`scripts/barre-etat/sonde.mjs`) sur le Mac et le PC : confirmer que `rate_limits` arrive. Puis jeton de service Access « atelier-quotas » (`ACCES_SERVICE_ID`), `~/.atelier/acces.json`, et installation de `atelier-barre-etat.mjs` comme `statusLine`.
7. Ensuite seulement (hors de cette version) : ajouter `ETAT.md` et la règle de la fiche dans iptv-home, pistes et appli-sportive, un projet à la fois avec l'accord du propriétaire.

## Architecture
- `worker/` : Worker Cloudflare (Hono). `acces.ts` garde, `synchro.ts` + `github.ts` lecture GitHub, `decouverte.ts` logo/nom/site, `agent.ts` IA (résumés, jalons, logos), `vue.ts` construction des cartes, `routes/` API.
- `shared/` : types, lecture de fiche, règles (statut, propositions, endormi), temps (Montréal), quotas.
- `src/` : interface React. `pages/` Accueil, Projet, Quotas, Réglages.
- `migrations/` : schéma D1 et données de départ.
- `scripts/barre-etat/` : script installé sur les ordinateurs du propriétaire.

## Journal
- **2026-11-28 (suite) — Claude Code** : le lien du calendrier manquait : un Worker ne peut pas appeler un autre Worker du même compte (erreur Cloudflare 1042), la vérification du site échouait. Ajout du drapeau `global_fetch_strictly_public` et migration 0010 (relance la découverte; nom automatique pour les projets qui portent encore le nom de leur dépôt).
- **2026-11-28 — Claude Code** : agent plus autonome. Nouveau dépôt → projet créé tout seul; à chaque changement poussé, `worker/decouverte.ts` cherche le logo (projet → site → logo dessiné par l'IA, `dessinerLogo` dans `worker/agent.ts`), le vrai nom (manifeste) et le site (wrangler, déploiements GitHub, CNAME, documents; vérifié). L'agent lit aussi docs/ (conception, plan), AGENTS.md, CLAUDE.md. Migration 0009 (logo dans la base, servi par `/api/projets/:id/logo`). Réglage `sous_domaine_workers` = hamzahlal86. Facultatif : ajouter la permission « Deployments : lecture » à la clé GitHub pour trouver les sites Vercel/Netlify.
- **2026-11-23 (après-midi) — Claude Code** : mise en ligne (https://atelier.hamzahlal86.workers.dev), cadenas Access (session 1 mois, politique « Atelier - propriétaire »), clés GitHub et Gemini transmises par GitHub Actions (secrets ATELIER_GITHUB_CLE, ATELIER_GEMINI_CLE), fiches ETAT.md ajoutées à Pistes et à l'appli sportive, agent IA (worker/agent.ts) qui résume les dépôts sans fiche. IPTV : écriture refusée par la protection de la session, résumé par l'agent à la place. Reste : script des quotas Claude (facultatif).
- **2026-11-23 — Claude Code** : conception approuvée, maquettes (direction A choisie), plan en 12 étapes, construction des étapes 1 à 12 en local avec tests. Décisions notées dans le plan et ci-dessus. Reste : la mise en ligne (gestes du propriétaire).
