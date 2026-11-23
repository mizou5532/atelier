import { Hono } from "hono";
import { z } from "zod";
import type { Contexte } from "../index";
import { lireReglage } from "../bd";
import { corps, invalide } from "./outils";

export const routesReglages = new Hono<Contexte>();

routesReglages.get("/reglages", async (c) => {
  const db = c.env.DB;
  const projets = (await db.prepare("SELECT id, nom FROM projets WHERE masque = 1 ORDER BY nom").all<{ id: number; nom: string }>()).results;
  const depots = (await db.prepare("SELECT github_id, nom_complet FROM depots WHERE masque = 1 ORDER BY nom_complet").all<{ github_id: number; nom_complet: string }>()).results;
  const h = await db.prepare("SELECT (SELECT COUNT(*) FROM commits) AS commits, COUNT(*) AS depots, SUM(import_complet) AS complets FROM depots WHERE projet_id IS NOT NULL AND masque = 0").first<{ commits: number; depots: number; complets: number | null }>();
  return c.json({
    historique: { commits: h?.commits ?? 0, depots: h?.depots ?? 0, complets: h?.complets ?? 0 },
    seuilEndormiJours: Number((await lireReglage(db, "seuil_endormi_jours")) ?? "30"),
    masques: { projets, depots: depots.map((d) => ({ githubId: d.github_id, nom: d.nom_complet.split("/")[1] })) },
  });
});

routesReglages.patch("/reglages", async (c) => {
  const b = await corps(c, z.object({
    seuilEndormiJours: z.number().int().min(1).max(3650).optional(),
    reafficherProjet: z.number().int().optional(),
    reafficherDepot: z.number().int().optional(),
  }).strict());
  if (!b) return invalide(c);
  const db = c.env.DB;
  const ecritures: D1PreparedStatement[] = [];
  if (b.seuilEndormiJours !== undefined) ecritures.push(db.prepare("INSERT INTO reglages (cle, valeur) VALUES ('seuil_endormi_jours', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").bind(String(b.seuilEndormiJours)));
  if (b.reafficherProjet !== undefined) ecritures.push(db.prepare("UPDATE projets SET masque = 0 WHERE id = ?").bind(b.reafficherProjet));
  if (b.reafficherDepot !== undefined) ecritures.push(db.prepare("UPDATE depots SET masque = 0 WHERE github_id = ?").bind(b.reafficherDepot));
  if (ecritures.length) await db.batch(ecritures);
  return c.body(null, 204);
});
