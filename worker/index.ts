import { Hono } from "hono";
import type { Env } from "./bd";
import { synchroniser } from "./synchro";
import { routesProjets } from "./routes/projets";
import { routesDepots } from "./routes/depots";
import { routesReglages } from "./routes/reglages";
import { routesQuotas } from "./routes/quotas";
import { routesJalons } from "./routes/jalons";
import { certificatsAccess, verifierJetonAcces, type ChercherCertificats } from "./acces";

export type Dependances = { certificats: ChercherCertificats };
export type Contexte = { Bindings: Env; Variables: { identite: "proprietaire" | "service" } };

const ROUTE_SERVICE = "/api/quotas/claude";

export function creerApp(deps: Dependances = { certificats: certificatsAccess }) {
  const app = new Hono<Contexte>();

  app.use("/api/*", async (c, suite) => {
    const { ACCES_EQUIPE, ACCES_AUD, ACCES_COURRIEL, ACCES_SERVICE_ID } = c.env;
    if (!ACCES_EQUIPE || !ACCES_AUD || !ACCES_COURRIEL) {
      return c.json({ message: "Accès privé non configuré : l'API refuse toute requête." }, 403);
    }
    const verdict = await verifierJetonAcces(
      c.req.header("cf-access-jwt-assertion"),
      { equipe: ACCES_EQUIPE, aud: ACCES_AUD },
      deps.certificats,
    ).catch(() => ({ ok: false as const, raison: "vérification impossible" }));
    if (!verdict.ok) return c.json({ message: "Accès refusé." }, 403);
    if (verdict.courriel && verdict.courriel.toLowerCase() === ACCES_COURRIEL.toLowerCase()) {
      c.set("identite", "proprietaire");
      return suite();
    }
    if (verdict.service && ACCES_SERVICE_ID && verdict.service === ACCES_SERVICE_ID
        && c.req.method === "POST" && c.req.path === ROUTE_SERVICE) {
      c.set("identite", "service");
      return suite();
    }
    return c.json({ message: "Accès refusé." }, 403);
  });

  app.get("/api/sante", (c) => c.json({ ok: true }));
  app.post("/api/rafraichir", async (c) => c.json(await synchroniser(c.env, new Date())));
  app.route("/api", routesProjets);
  app.route("/api", routesDepots);
  app.route("/api", routesReglages);
  app.route("/api", routesQuotas);
  app.route("/api", routesJalons);

  return app;
}

const app = creerApp();

export default {
  fetch: app.fetch,
  async scheduled(_evenement, env, ctx) {
    ctx.waitUntil(synchroniser(env, new Date()).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
