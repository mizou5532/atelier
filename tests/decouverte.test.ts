import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { synchroniser } from "../worker/synchro";
import { svgSur } from "../worker/agent";
import {
  adressesDansTexte, adressesWrangler, iconeDuManifeste, iconeParNom, iconesDansHtml, lireJsonc, nomLisible, ressemble,
} from "../worker/decouverte";
import { api } from "./aide";
import type { Env } from "../worker/bd";

const WRANGLER_CALENDRIER = `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "calendrier", // le Worker
  "main": "src/worker.ts",
  "workers_dev": true,
  "d1_databases": [{ "binding": "DB", "database_name": "calendrier", }],
}`;
const MANIFESTE = JSON.stringify({
  name: "Calendrier thermique", description: "Ton calendrier en couleurs.",
  icons: [
    { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icones/icone-masque-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
});
const ARBRE = [
  { chemin: "wrangler.jsonc", taille: 400 },
  { chemin: "web/public/manifest.webmanifest", taille: 500 },
  { chemin: "web/public/icones/icone-192.png", taille: 900 },
  { chemin: "web/public/icones/icone-512.png", taille: 4000 },
  { chemin: "web/public/icones/icone-masque-512.png", taille: 4000 },
  { chemin: "tests/fixtures/logo.png", taille: 100 },
];

describe("découverte : petits outils", () => {
  it("rend un nom de dépôt lisible", () => {
    expect(nomLisible("calendrier-thermique")).toBe("Calendrier thermique");
    expect(nomLisible("bot_rdv__medecin")).toBe("Bot rdv medecin");
  });

  it("lit le JSON avec commentaires sans abîmer les adresses", () => {
    const j = lireJsonc(`{ "a": "https://x.dev/y", // commentaire\n /* bloc */ "b": [1, 2,], }`);
    expect(j).toEqual({ a: "https://x.dev/y", b: [1, 2] });
    expect(lireJsonc("pas du json")).toBeNull();
  });

  it("devine l'adresse d'un projet Cloudflare", () => {
    expect(adressesWrangler(WRANGLER_CALENDRIER, "wrangler.jsonc", "hamzahlal86")).toEqual(["https://calendrier.hamzahlal86.workers.dev"]);
    expect(adressesWrangler(`{ "name": "x", "routes": [{ "pattern": "app.exemple.ca", "custom_domain": true }] }`, "wrangler.jsonc", "moi"))
      .toEqual(["https://app.exemple.ca", "https://x.moi.workers.dev"]);
    expect(adressesWrangler(`name = "site"\npages_build_output_dir = "dist"\n`, "wrangler.toml", "moi")).toEqual(["https://site.pages.dev"]);
    expect(adressesWrangler(`{ "name": "x", "workers_dev": false }`, "wrangler.jsonc", "moi")).toEqual([]);
  });

  it("trouve les adresses citées dans les documents, seulement celles qui ressemblent au projet", () => {
    const texte = "En ligne : https://calendrier.hamzahlal86.workers.dev. Voir aussi https://iptv-home-config.vercel.app/ et https://github.com/x";
    const trouvees = adressesDansTexte(texte);
    expect(trouvees).toEqual(["https://calendrier.hamzahlal86.workers.dev", "https://iptv-home-config.vercel.app/"]);
    expect(trouvees.filter((u) => ressemble(u, ["calendrier-thermique"]))).toEqual(["https://calendrier.hamzahlal86.workers.dev"]);
  });

  it("choisit l'icône du manifeste (192 px, pas la masquable)", () => {
    expect(iconeDuManifeste(JSON.parse(MANIFESTE), "web/public/manifest.webmanifest", ARBRE)).toBe("web/public/icones/icone-192.png");
  });

  it("à défaut, choisit une icône d'après le nom du fichier, hors des dossiers de tests", () => {
    expect(iconeParNom([{ chemin: "tests/fixtures/logo.svg", taille: 10 }, { chemin: "public/favicon.ico", taille: 10 }, { chemin: "public/logo.svg", taille: 10 }])).toBe("public/logo.svg");
    expect(iconeParNom([{ chemin: "tests/logo.svg", taille: 10 }])).toBeNull();
  });

  it("lit les icônes annoncées par une page web", () => {
    const html = `<link rel="icon" href="/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/apple.png">`;
    expect(iconesDansHtml(html, "https://site.dev/")).toEqual(["https://site.dev/apple.png", "https://site.dev/favicon-32.png", "https://site.dev/favicon.ico"]);
  });

  it("garde seulement un dessin SVG sans danger", () => {
    expect(svgSur(`<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a7"/></svg>`)).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svgSur(`<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg>`)).not.toBeNull();
    expect(svgSur(`<svg><script>alert(1)</script></svg>`)).toBeNull();
    expect(svgSur(`<svg><rect onclick="x()"/></svg>`)).toBeNull();
    expect(svgSur(`<svg><image href="https://x.dev/a.png"/></svg>`)).toBeNull();
    expect(svgSur("pas un dessin")).toBeNull();
  });
});

// ---------- Dans la synchronisation ----------

const e = { ...(env as unknown as Env), GEMINI_CLE: "cle-gemini" } as Env;
const db = e.DB;
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const SVG_IA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2a6"/></svg>`;
let pousse = "2026-11-28T03:04:47Z";

function faux(o: { arbre?: typeof ARBRE; siteEnLigne?: boolean } = {}) {
  const appels: string[] = [];
  const f = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree);
    appels.push(url);
    if (url.includes("generativelanguage")) {
      const corps = String(init?.body ?? "");
      const reponse = corps.includes("graphiste") ? { svg: SVG_IA } : { derniere_etape: "Calendrier en ligne", prochaine_etape: "Ajouter les rappels", jalons: [] };
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reponse) }] } }] });
    }
    if (url.includes("/user/repos")) return Response.json(url.includes("page=1") ? [{ id: 500, name: "calendrier-thermique", full_name: "mizou5532/calendrier-thermique", html_url: "https://github.com/mizou5532/calendrier-thermique", homepage: null, private: true, archived: false, default_branch: "main", pushed_at: pousse }] : []);
    if (url.includes("/git/trees/")) return Response.json({ tree: (o.arbre ?? ARBRE).map((x) => ({ path: x.chemin, type: "blob", size: x.taille })) });
    if (url.includes("/contents/wrangler.jsonc")) return new Response(WRANGLER_CALENDRIER);
    if (url.includes("/contents/web/public/manifest.webmanifest")) return new Response(MANIFESTE);
    if (url.includes("/contents/web/public/icones/icone-192.png")) return new Response(PNG);
    if (url.includes("/commits")) return Response.json([]);
    if (url.startsWith("https://calendrier.hamzahlal86.workers.dev")) return o.siteEnLigne === false ? new Response("non", { status: 404 }) : new Response("<html></html>", { headers: { "content-type": "text/html" } });
    return new Response("absent", { status: 404 });
  }) as typeof fetch;
  return { f, appels };
}

const projet = () => db.prepare("SELECT p.* FROM projets p JOIN depots d ON d.projet_id = p.id WHERE d.github_id = 500").first<Record<string, any>>();

describe("découverte dans la synchronisation", () => {
  beforeEach(async () => {
    pousse = "2026-11-28T03:04:47Z";
    await db.batch([
      db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM liens_ignores"), db.prepare("DELETE FROM depots"),
      db.prepare("DELETE FROM projets WHERE nom_auto = 1 OR id > 8"),
      db.prepare("UPDATE projets SET logo = 'data:image/png;base64,AA==', logo_source = 'projet'"), // les projets de départ ont déjà un logo
      db.prepare("UPDATE etat_synchro SET derniere_reussite = '2026-11-27T00:00:00Z' WHERE id = 1"), // pas le tout premier import
    ]);
  });

  it("un nouveau dépôt devient un projet tout seul, avec son vrai nom, son logo et son site", async () => {
    const r = await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux().f);
    expect(r.nouveaux).toBe(0);
    const p = await projet();
    expect(p?.nom).toBe("Calendrier thermique");
    expect(p?.logo_source).toBe("projet");
    expect(p?.logo).toBe(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`);
    const liens = (await db.prepare("SELECT nom, url FROM liens WHERE projet_id = ?").bind(p!.id).all()).results;
    expect(liens).toContainEqual({ nom: "Site", url: "https://calendrier.hamzahlal86.workers.dev" });
    const accueil = (await (await api("/api/accueil")).json()) as any;
    expect(accueil.aClasser).toEqual([]);
    const carte = accueil.enCours.find((c: any) => c.id === p!.id);
    expect(carte.logo).toMatch(new RegExp(`^/api/projets/${p!.id}/logo\\?v=`));
    const image = await api(`/api/projets/${p!.id}/logo`);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(PNG);
  });

  it("ne refait rien tant que le dépôt ne change pas; recommence après un nouveau changement", async () => {
    await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux().f);
    const second = faux();
    await synchroniser(e, new Date("2026-11-28T12:15:00Z"), second.f);
    expect(second.appels.some((u) => u.includes("manifest.webmanifest"))).toBe(false);
    pousse = "2026-11-29T10:00:00Z";
    const troisieme = faux();
    await synchroniser(e, new Date("2026-11-29T12:00:00Z"), troisieme.f);
    expect(troisieme.appels.some((u) => u.includes("manifest.webmanifest"))).toBe(true);
  });

  it("sans icône dans le projet ni sur le site, l'IA dessine un petit logo; il est remplacé dès que le projet a le sien", async () => {
    const sansIcone = ARBRE.filter((x) => !x.chemin.includes("icone") && !x.chemin.includes("manifest"));
    await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux({ arbre: sansIcone }).f);
    let p = await projet();
    expect(p?.logo_source).toBe("ia");
    expect(atob(p!.logo.split(",")[1])).toBe(SVG_IA);
    expect(p?.nom).toBe("Calendrier thermique"); // nom rendu lisible, sans manifeste
    pousse = "2026-11-29T10:00:00Z";
    await synchroniser(e, new Date("2026-11-29T12:00:00Z"), faux().f);
    p = await projet();
    expect(p?.logo_source).toBe("projet");
  });

  it("un site qui ne répond pas n'est pas ajouté", async () => {
    await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux({ siteEnLigne: false }).f);
    const p = await projet();
    expect((await db.prepare("SELECT COUNT(*) AS n FROM liens WHERE projet_id = ? AND nom = 'Site'").bind(p!.id).first<{ n: number }>())?.n).toBe(0);
  });

  it("ton choix gagne : nom changé à la main et logo retiré restent comme tu les as laissés", async () => {
    await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux().f);
    const id = (await projet())!.id;
    await api(`/api/projets/${id}`, { method: "PATCH", corps: { nom: "Mon agenda", logo: null } });
    pousse = "2026-11-29T10:00:00Z";
    await synchroniser(e, new Date("2026-11-29T12:00:00Z"), faux().f);
    const p = await projet();
    expect(p?.nom).toBe("Mon agenda");
    expect(p?.logo).toBeNull();
    expect(p?.logo_source).toBe("retire");
    expect((await api(`/api/projets/${id}/logo`)).status).toBe(404);
    // « Chercher un logo » relance la recherche
    await api(`/api/projets/${id}/logo/chercher`, { method: "POST" });
    await synchroniser(e, new Date("2026-11-29T12:15:00Z"), faux().f);
    expect((await projet())?.logo_source).toBe("projet");
  });

  it("le tout premier import et les dépôts archivés restent dans « À classer »", async () => {
    await db.prepare("UPDATE etat_synchro SET derniere_reussite = NULL WHERE id = 1").run();
    const r = await synchroniser(e, new Date("2026-11-28T12:00:00Z"), faux().f);
    expect(r.nouveaux).toBe(1);
    expect(await projet()).toBeNull();
  });
});
