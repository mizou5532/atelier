---
projet: Atelier
statut: en cours
avancement: 95
derniere_etape: Atelier en ligne, cadenas, clés GitHub et Gemini, agent qui résume les projets sans fiche
prochaine_etape: Utiliser Atelier au quotidien; plus tard le script des quotas Claude
mis_a_jour: 2026-11-23 15:45
par: Claude Code
liens:
  - Maquettes: https://claude.ai/artifact/Ty9PkEvXW2hRNGBn8owqD6
---

## En cours
Agent plus autonome (demande du propriétaire, 28 nov.) : chaque nouveau dépôt devient un projet tout seul; à chaque changement poussé, l'agent cherche le logo (projet → site → logo dessiné par l'IA), le lien du site (wrangler, déploiements, CNAME, documents) et le vrai nom, et lit plus de documents (docs/, CLAUDE.md, AGENTS.md).
- Fait : enquête; moteur (migration 0009, worker/decouverte.ts, logo IA dans agent.ts, création automatique, documents docs/ lus par l'agent, routes du logo), 121 tests verts.
- Prochaine action : afficher les logos dans l'interface (cartes, fiche, calendrier) + boutons « Retirer » / « Chercher un logo ».
