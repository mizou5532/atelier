import { Hono } from "hono";
import { z } from "zod";
import type { Contexte } from "../index";
import { STATUTS } from "../../shared/types";
import { construireAccueil, construireActivite, construireDetail, construireJour } from "../vue";
import { fusionnerPreferences, schemaPreferences } from "../../shared/historique";
import { construireQuotas } from "./quotas";
import { corps, invalide } from "./outils";

export const PALETTE = ["violet", "orange", "vert", "bleu", "rose", "ambre"];
const urlHttp = z.string().url().refine((u) => /^https?:\/\//i.test(u), "http(s) seulement");

export const routesProjets = new Hono<Contexte>();

routesProjets.get("/accueil", async (c) => {
  const maintenant = new Date();
  return c.json({ ...(await construireAccueil(c.env.DB, maintenant)), quotas: await construireQuotas(c.env.DB, maintenant) });
});

routesProjets.get("/activite", async (c) => {
  const mois = Number(c.req.query("mois") ?? "12");
  return c.json(await construireActivite(c.env.DB, new Date(), [3, 6, 12, 24].includes(mois) ? mois : 12));
});

routesProjets.get("/jour/:jour", async (c) => {
  const jour = c.req.param("jour");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return invalide(c);
  return c.json(await construireJour(c.env.DB, jour));
});

routesProjets.get("/preferences", async (c) => {
  const r = await c.env.DB.prepare("SELECT valeur FROM reglages WHERE cle = 'preferences'").first<{ valeur: string }>();
  return c.json(fusionnerPreferences(JSON.parse(r?.valeur ?? "{}")));
});

routesProjets.patch("/preferences", async (c) => {
  const b = await corps(c, schemaPreferences);
  if (!b) return invalide(c);
  const r = await c.env.DB.prepare("SELECT valeur FROM reglages WHERE cle = 'preferences'").first<{ valeur: string }>();
  const avant = JSON.parse(r?.valeur ?? "{}");
  const apres = { ...avant, ...b, sections: { ...(avant.sections ?? {}), ...(b.sections ?? {}) }, carte: { ...(avant.carte ?? {}), ...(b.carte ?? {}) } };
  await c.env.DB.prepare("INSERT INTO reglages (cle, valeur) VALUES ('preferences', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").bind(JSON.stringify(apres)).run();
  return c.json(fusionnerPreferences(apres));
});

routesProjets.get("/semaine", async (c) => {
  const v = await construireAccueil(c.env.DB, new Date());
  const tous = [...v.enCours, ...v.endormis, ...v.archives];
  return c.json({
    actifs: tous.filter((p) => p.heuresSemaine > 0 || (p.deltaSemaine ?? 0) !== 0)
      .sort((a, b) => b.heuresSemaine - a.heuresSemaine)
      .map((p) => ({ id: p.id, nom: p.nom, icone: p.icone, logo: p.logo, couleur: p.couleur, heures: p.heuresSemaine, delta: p.deltaSemaine, avancement: p.avancement, derniereEtape: p.derniereEtape })),
    echecs: tous.filter((p) => p.voyant?.etat === "echec").map((p) => ({ id: p.id, nom: p.nom, url: p.voyant!.url, relatif: p.voyant!.relatif })),
    endormis: v.endormis.map((p) => ({ id: p.id, nom: p.nom, relatif: p.derniere.relatif, derniereEtape: p.derniereEtape, prochaineEtape: p.prochaineEtape })),
    heuresTotal: Math.round(tous.reduce((s, p) => s + p.heuresSemaine, 0) * 10) / 10,
  });
});

routesProjets.get("/projets/:id", async (c) => {
  const d = await construireDetail(c.env.DB, Number(c.req.param("id")), new Date());
  return d ? c.json(d) : c.json({ message: "Projet introuvable." }, 404);
});

export async function creerProjet(db: D1Database, nom: string, statut: string, notes: string, o: { nomAuto?: boolean } = {}): Promise<number> {
  const n = await db.prepare("SELECT COUNT(*) AS n FROM projets").first<{ n: number }>();
  const maintenant = new Date().toISOString();
  const r = await db.prepare("INSERT INTO projets (nom, couleur, statut, notes, nom_auto, modifie_le, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(nom, PALETTE[(n?.n ?? 0) % PALETTE.length], statut, notes, o.nomAuto ? 1 : 0, maintenant, maintenant).first<{ id: number }>();
  return r!.id;
}

routesProjets.post("/projets", async (c) => {
  const b = await corps(c, z.object({ nom: z.string().trim().min(1).max(120), statut: z.enum(["idee", "en_cours"]).optional(), notes: z.string().max(10_000).optional() }));
  if (!b) return invalide(c);
  const id = await creerProjet(c.env.DB, b.nom, b.statut ?? "en_cours", b.notes ?? "");
  return c.json({ id }, 201);
});

routesProjets.patch("/projets/:id", async (c) => {
  const b = await corps(c, z.object({
    nom: z.string().trim().min(1).max(120).optional(),
    statut: z.enum(STATUTS).optional(),
    remplacePar: z.number().int().nullable().optional(),
    avancement: z.number().int().min(0).max(100).nullable().optional(),
    notes: z.string().max(10_000).optional(),
    depotPrincipal: z.number().int().nullable().optional(),
    masque: z.boolean().optional(),
    icone: z.string().trim().max(8).nullable().optional(),
    logo: z.null().optional(),
  }).strict());
  if (!b) return invalide(c);
  const champs: [string, unknown][] = [];
  if (b.nom !== undefined) champs.push(["nom", b.nom], ["nom_auto", 0]);
  if (b.statut !== undefined) champs.push(["statut", b.statut]);
  if (b.remplacePar !== undefined) champs.push(["remplace_par", b.remplacePar]);
  if (b.avancement !== undefined) champs.push(["avancement", b.avancement]);
  if (b.notes !== undefined) champs.push(["notes", b.notes]);
  if (b.depotPrincipal !== undefined) champs.push(["depot_principal", b.depotPrincipal]);
  if (b.masque !== undefined) champs.push(["masque", b.masque ? 1 : 0]);
  if (b.icone !== undefined) champs.push(["icone", b.icone || null]);
  if (b.logo === null) champs.push(["logo", null], ["logo_source", "retire"], ["logo_maj", new Date().toISOString()]);
  champs.push(["modifie_le", new Date().toISOString()]);
  const r = await c.env.DB.prepare(`UPDATE projets SET ${champs.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .bind(...champs.map(([, v]) => v), Number(c.req.param("id"))).run();
  return r.meta.changes ? c.body(null, 204) : c.json({ message: "Projet introuvable." }, 404);
});

/** Le logo du projet (image gardée dans la base). */
routesProjets.get("/projets/:id/logo", async (c) => {
  const r = await c.env.DB.prepare("SELECT logo FROM projets WHERE id = ?").bind(Number(c.req.param("id"))).first<{ logo: string | null }>();
  const m = r?.logo?.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  if (!m) return c.body(null, 404);
  const octets = Uint8Array.from(atob(m[2]), (x) => x.charCodeAt(0));
  return c.body(octets, 200, {
    "content-type": m[1], "cache-control": "private, max-age=31536000, immutable",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'", "x-content-type-options": "nosniff",
  });
});

/** Demande à l'agent de chercher un logo à nouveau (au prochain passage, ou tout de suite avec « Rafraîchir »). */
routesProjets.post("/projets/:id/logo/chercher", async (c) => {
  const r = await c.env.DB.prepare("UPDATE projets SET logo = NULL, logo_source = NULL, logo_maj = ?, decouverte_pour = NULL WHERE id = ?")
    .bind(new Date().toISOString(), Number(c.req.param("id"))).run();
  return r.meta.changes ? c.body(null, 204) : c.json({ message: "Projet introuvable." }, 404);
});

routesProjets.post("/projets/:id/propositions", async (c) => {
  const b = await corps(c, z.object({ champ: z.enum(["statut", "avancement"]), action: z.enum(["accepter", "ignorer"]) }));
  if (!b) return invalide(c);
  const id = Number(c.req.param("id"));
  const d = await construireDetail(c.env.DB, id, new Date());
  if (!d) return c.json({ message: "Projet introuvable." }, 404);
  const valeur = d.proposition[b.champ];
  if (valeur === undefined) return c.body(null, 204);
  const colonne = b.action === "accepter" ? b.champ : `${b.champ}_ignore`;
  await c.env.DB.prepare(`UPDATE projets SET ${colonne} = ?, modifie_le = ? WHERE id = ?`).bind(valeur, new Date().toISOString(), id).run();
  return c.body(null, 204);
});

routesProjets.delete("/projets/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM depots WHERE projet_id = ?").bind(id).first<{ n: number }>();
  if (n && n.n > 0) return c.json({ message: "Ce projet a des dépôts GitHub : masque-le plutôt." }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM liens WHERE projet_id = ?").bind(id),
    c.env.DB.prepare("UPDATE projets SET remplace_par = NULL WHERE remplace_par = ?").bind(id),
    c.env.DB.prepare("DELETE FROM projets WHERE id = ?").bind(id),
  ]);
  return c.body(null, 204);
});

routesProjets.post("/projets/:id/liens", async (c) => {
  const b = await corps(c, z.object({ nom: z.string().trim().min(1).max(60), url: urlHttp }));
  if (!b) return invalide(c);
  const r = await c.env.DB.prepare("INSERT INTO liens (projet_id, nom, url, source) VALUES (?, ?, ?, 'main') RETURNING id")
    .bind(Number(c.req.param("id")), b.nom, b.url).first<{ id: number }>();
  return c.json({ id: r!.id }, 201);
});

routesProjets.delete("/projets/:id/liens/:lien", async (c) => {
  const projet = Number(c.req.param("id"));
  const lien = await c.env.DB.prepare("SELECT url, source FROM liens WHERE id = ? AND projet_id = ?").bind(Number(c.req.param("lien")), projet).first<{ url: string; source: string }>();
  if (!lien) return c.body(null, 204);
  const ecritures = [c.env.DB.prepare("DELETE FROM liens WHERE id = ? AND projet_id = ?").bind(Number(c.req.param("lien")), projet)];
  if (lien.source !== "main") ecritures.push(c.env.DB.prepare("INSERT OR IGNORE INTO liens_ignores (projet_id, url) VALUES (?, ?)").bind(projet, lien.url));
  await c.env.DB.batch(ecritures);
  return c.body(null, 204);
});
