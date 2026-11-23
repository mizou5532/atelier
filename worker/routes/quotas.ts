import { Hono } from "hono";
import { z } from "zod";
import type { Contexte } from "../index";
import type { QuotaVue } from "../../shared/types";
import { plusLibre, vueQuota, type VueQuota } from "../../shared/quotas";
import { relatif } from "../../shared/temps";
import { corps, invalide } from "./outils";

type Compte = { id: number; nom: string; type: "claude" | "google" | "autre"; ordre: number };
type Ligne = { compte_id: number; fenetre: string; utilise_pct: number | null; bloque: number; reinit_le: string | null; maj_le: string; source: "auto" | "main" };

export async function construireQuotas(db: D1Database, maintenant: Date): Promise<QuotaVue[]> {
  const comptes = (await db.prepare("SELECT * FROM comptes_ia ORDER BY ordre").all<Compte>()).results;
  const lignes = (await db.prepare("SELECT * FROM quotas").all<Ligne>()).results;
  const vues = comptes.map((c) => {
    const siennes = lignes.filter((l) => l.compte_id === c.id)
      .sort((a, b) => (a.fenetre === "session" ? -1 : b.fenetre === "session" ? 1 : a.fenetre.localeCompare(b.fenetre)));
    return { compte: c, fenetres: siennes.map((l) => ({ ligne: l, vue: vueQuota(l, maintenant) })) };
  });
  const libre = plusLibre(vues.map((v) => ({
    id: v.compte.id, type: v.compte.type,
    session: v.fenetres.find((f) => f.ligne.fenetre === "session")?.vue,
    semaine: v.fenetres.find((f) => f.ligne.fenetre === "semaine")?.vue,
  })));
  return vues.map((v) => ({
    compteId: v.compte.id, nom: v.compte.nom, type: v.compte.type, plusLibre: v.compte.id === libre,
    fenetres: v.fenetres.map(({ ligne, vue }: { ligne: Ligne; vue: VueQuota }) => ({
      fenetre: ligne.fenetre, reste: vue.reste, etat: vue.etat, reinit: vue.reinit, source: ligne.source, majRelatif: relatif(ligne.maj_le, maintenant),
    })),
  }));
}

export const routesQuotas = new Hono<Contexte>();

const fenetreClaude = z.object({ utilise_pct: z.number().min(0).max(100), reinit_le: z.number().int().positive() }).strict();

routesQuotas.post("/quotas/claude", async (c) => {
  const b = await corps(c, z.object({ courriel: z.string().email().max(200), session: fenetreClaude.optional(), semaine: fenetreClaude.optional() }).strict());
  if (!b) return invalide(c);
  const db = c.env.DB;
  const courriel = b.courriel.toLowerCase();
  const lien = await db.prepare("SELECT compte_id FROM courriels_claude WHERE courriel = ?").bind(courriel).first<{ compte_id: number | null }>();
  if (!lien) await db.prepare("INSERT INTO courriels_claude (courriel, compte_id) VALUES (?, NULL)").bind(courriel).run();
  if (!lien?.compte_id) return c.body(null, 202);
  const maj = new Date().toISOString();
  const ecrire = (fenetre: string, f: z.infer<typeof fenetreClaude>) => db.prepare(
    `INSERT INTO quotas (compte_id, fenetre, utilise_pct, bloque, reinit_le, maj_le, source) VALUES (?, ?, ?, 0, ?, ?, 'auto')
     ON CONFLICT(compte_id, fenetre) DO UPDATE SET utilise_pct = excluded.utilise_pct, bloque = 0, reinit_le = excluded.reinit_le, maj_le = excluded.maj_le, source = 'auto'`,
  ).bind(lien.compte_id, fenetre, f.utilise_pct, new Date(f.reinit_le * 1000).toISOString(), maj);
  const ecritures = [b.session && ecrire("session", b.session), b.semaine && ecrire("semaine", b.semaine)].filter(Boolean) as D1PreparedStatement[];
  if (ecritures.length) await db.batch(ecritures);
  return c.body(null, 204);
});

routesQuotas.post("/quotas/main", async (c) => {
  const b = await corps(c, z.object({
    compteId: z.number().int(), fenetre: z.string().trim().min(1).max(60),
    reste: z.union([z.number().min(0).max(100), z.literal("bloque")]), revientDansHeures: z.number().min(0).max(24 * 31),
  }).strict());
  if (!b) return invalide(c);
  const maintenant = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO quotas (compte_id, fenetre, utilise_pct, bloque, reinit_le, maj_le, source) VALUES (?, ?, ?, ?, ?, ?, 'main')
     ON CONFLICT(compte_id, fenetre) DO UPDATE SET utilise_pct = excluded.utilise_pct, bloque = excluded.bloque, reinit_le = excluded.reinit_le, maj_le = excluded.maj_le, source = 'main'`,
  ).bind(b.compteId, b.fenetre, b.reste === "bloque" ? null : 100 - b.reste, b.reste === "bloque" ? 1 : 0,
    new Date(maintenant + b.revientDansHeures * 3_600_000).toISOString(), new Date(maintenant).toISOString()).run();
  return c.body(null, 204);
});

routesQuotas.post("/quotas/courriels", async (c) => {
  const b = await corps(c, z.object({ courriel: z.string().email(), compteId: z.number().int() }).strict());
  if (!b) return invalide(c);
  await c.env.DB.prepare("INSERT INTO courriels_claude (courriel, compte_id) VALUES (?, ?) ON CONFLICT(courriel) DO UPDATE SET compte_id = excluded.compte_id")
    .bind(b.courriel.toLowerCase(), b.compteId).run();
  return c.body(null, 204);
});

routesQuotas.get("/quotas", async (c) => {
  const db = c.env.DB;
  const courriels = (await db.prepare("SELECT courriel, compte_id FROM courriels_claude ORDER BY courriel").all<{ courriel: string; compte_id: number | null }>()).results;
  return c.json({
    quotas: await construireQuotas(db, new Date()),
    aAssocier: courriels.filter((x) => x.compte_id === null).map((x) => x.courriel),
    courriels: courriels.filter((x) => x.compte_id !== null).map((x) => ({ courriel: x.courriel, compteId: x.compte_id })),
  });
});
