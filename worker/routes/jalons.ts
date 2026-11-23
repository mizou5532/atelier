import { Hono } from "hono";
import { z } from "zod";
import type { Contexte } from "../index";
import { corps, invalide } from "./outils";

export const routesJalons = new Hono<Contexte>();

routesJalons.post("/projets/:id/jalons/valider", async (c) => {
  await c.env.DB.prepare("UPDATE projets SET jalons_etat = 'valide' WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.body(null, 204);
});

routesJalons.post("/projets/:id/jalons/regenerer", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM jalons WHERE projet_id = ?").bind(id),
    c.env.DB.prepare("UPDATE projets SET jalons_etat = 'aucun', jalons_vus_pour = NULL WHERE id = ?").bind(id),
  ]);
  return c.body(null, 204);
});

routesJalons.post("/projets/:id/jalons", async (c) => {
  const b = await corps(c, z.object({ titre: z.string().trim().min(1).max(120) }).strict());
  if (!b) return invalide(c);
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  const max = await db.prepare("SELECT COALESCE(MAX(ordre), 0) AS m FROM jalons WHERE projet_id = ?").bind(id).first<{ m: number }>();
  await db.batch([
    db.prepare("INSERT INTO jalons (projet_id, ordre, titre) VALUES (?, ?, ?)").bind(id, (max?.m ?? 0) + 1, b.titre),
    db.prepare("UPDATE projets SET jalons_etat = 'valide' WHERE id = ? AND jalons_etat = 'aucun'").bind(id),
  ]);
  return c.body(null, 201);
});

routesJalons.patch("/jalons/:id", async (c) => {
  const b = await corps(c, z.object({ titre: z.string().trim().min(1).max(120).optional(), fait: z.boolean().optional() }).strict());
  if (!b) return invalide(c);
  const id = Number(c.req.param("id"));
  const ecritures: D1PreparedStatement[] = [];
  if (b.titre !== undefined) ecritures.push(c.env.DB.prepare("UPDATE jalons SET titre = ? WHERE id = ?").bind(b.titre, id));
  if (b.fait !== undefined) ecritures.push(c.env.DB.prepare("UPDATE jalons SET fait = ?, coche_par = ? WHERE id = ?").bind(b.fait ? 1 : 0, b.fait ? "main" : null, id));
  if (ecritures.length) await c.env.DB.batch(ecritures);
  return c.body(null, 204);
});

routesJalons.delete("/jalons/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM jalons WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.body(null, 204);
});
