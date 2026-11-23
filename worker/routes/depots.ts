import { Hono } from "hono";
import { z } from "zod";
import type { Contexte } from "../index";
import { corps, invalide } from "./outils";
import { creerProjet } from "./projets";
import { completerLiens } from "../synchro";

export const routesDepots = new Hono<Contexte>();

routesDepots.post("/depots/:id/classer", async (c) => {
  const b = await corps(c, z.discriminatedUnion("action", [
    z.object({ action: z.literal("nouveau") }),
    z.object({ action: z.literal("rattacher"), projetId: z.number().int() }),
    z.object({ action: z.literal("masquer") }),
  ]));
  if (!b) return invalide(c);
  const db = c.env.DB;
  const id = Number(c.req.param("id"));
  const d = await db.prepare("SELECT nom_complet FROM depots WHERE github_id = ?").bind(id).first<{ nom_complet: string }>();
  if (!d) return c.json({ message: "Dépôt introuvable." }, 404);
  if (b.action === "masquer") {
    await db.prepare("UPDATE depots SET masque = 1 WHERE github_id = ?").bind(id).run();
    return c.body(null, 204);
  }
  let projet: number;
  if (b.action === "nouveau") {
    projet = await creerProjet(db, d.nom_complet.split("/")[1], "en_cours", "");
  } else {
    const p = await db.prepare("SELECT statut FROM projets WHERE id = ?").bind(b.projetId).first<{ statut: string | null }>();
    if (!p) return c.json({ message: "Projet introuvable." }, 404);
    projet = b.projetId;
    if (p.statut === "idee") await db.prepare("UPDATE projets SET statut = 'en_cours', modifie_le = ? WHERE id = ?").bind(new Date().toISOString(), projet).run();
  }
  await db.prepare("UPDATE depots SET projet_id = ?, masque = 0 WHERE github_id = ?").bind(projet, id).run();
  await completerLiens(db);
  return c.body(null, 204);
});

routesDepots.post("/depots/:id/detacher", async (c) => {
  await c.env.DB.prepare("UPDATE depots SET projet_id = NULL WHERE github_id = ?").bind(Number(c.req.param("id"))).run();
  return c.body(null, 204);
});
