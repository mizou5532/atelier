// Outils des tests de navigateur : sert l'interface construite (dist/client) et simule l'API.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };

export async function servir() {
  const racine = join(process.cwd(), "dist/client");
  const serveur = createServer(async (req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
    try {
      const fichier = chemin === "/" ? "/index.html" : chemin;
      const contenu = await readFile(join(racine, fichier));
      res.writeHead(200, { "content-type": TYPES[extname(fichier)] ?? "application/octet-stream" }).end(contenu);
    } catch {
      res.writeHead(200, { "content-type": "text/html" }).end(await readFile(join(racine, "index.html")));
    }
  });
  await new Promise((r) => serveur.listen(0, r));
  return { url: `http://127.0.0.1:${serveur.address().port}`, fermer: () => serveur.close() };
}

const carte = (o) => ({ derniereEtape: undefined, prochaineEtape: undefined, enTravail: false, ficheAVerifier: false, liensRapides: [], nbDepots: 1, proposition: {}, avancement: null, statut: "en_cours", ...o });

export function accueilExemple() {
  return {
    maj: { derniereReussite: new Date(Date.now() - 3 * 60_000).toISOString(), erreur: null, erreurDepuis: null },
    aClasser: [{ githubId: 99, nom: "test", url: "https://github.com/mizou5532/test", relatif: "il y a 3 ans" }],
    enCours: [
      carte({ id: 1, nom: "IPTV maison", couleur: "violet", initiales: "IM", derniere: { quand: "2026-11-22T23:49:16Z", relatif: "hier", aLaMain: false }, avancement: 70, prochaineEtape: "Tester le filtre Sport sur la télé", enTravail: true, liensRapides: [{ nom: "Site", url: "https://exemple.dev" }, { nom: "GitHub", url: "https://github.com/mizou5532/iptv-home" }] }),
      carte({ id: 3, nom: "Pistes", couleur: "vert", initiales: "PI", derniere: { quand: "2026-11-21T22:51:33Z", relatif: "il y a 2 jours", aLaMain: false }, avancement: 98, prochaineEtape: "Essais en ligne" }),
      carte({ id: 4, nom: "Appli sportive", couleur: "bleu", initiales: "AS", derniere: { quand: "2026-11-21T05:01:02Z", relatif: "il y a 2 jours", aLaMain: false }, derniereEtape: "Termes sportifs du Québec" }),
    ],
    endormis: [
      carte({ id: 5, nom: "MonDroit.ca", couleur: "rose", initiales: "MO", derniere: { quand: "2026-03-18T07:30:25Z", relatif: "il y a 8 mois", aLaMain: false }, nbDepots: 2 }),
      carte({ id: 6, nom: "NBA", couleur: "ambre", initiales: "NB", derniere: { quand: "2026-02-24T00:00:00Z", relatif: "il y a 9 mois", aLaMain: false }, nbDepots: 4 }),
    ],
    idees: [carte({ id: 8, nom: "Dépôt entre mes appareils", couleur: "orange", initiales: "DÉ", statut: "idee", derniere: { quand: "2026-11-23T00:00:00Z", relatif: "hier", aLaMain: true }, nbDepots: 0 })],
    archives: [],
    quotas: [],
  };
}

/** Ouvre une page dont l'API est simulée; renvoie la page et la liste des requêtes envoyées. */
export async function ouvrir(navigateur, url, { largeur = 1440, hauteur = 900, accueil = accueilExemple(), reponses = {} } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await contexte.newPage();
  const envois = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const chemin = new URL(req.url()).pathname;
    envois.push({ methode: req.method(), chemin, corps: req.postData() ? JSON.parse(req.postData()) : undefined });
    const cle = `${req.method()} ${chemin}`;
    if (cle in reponses) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(typeof reponses[cle] === "function" ? reponses[cle]() : reponses[cle]) });
    if (cle === "GET /api/accueil") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(accueil) });
    return route.fulfill({ status: req.method() === "POST" && chemin === "/api/projets" ? 201 : 204, contentType: "application/json", body: req.method() === "POST" && chemin === "/api/projets" ? '{"id":42}' : "" });
  });
  await page.goto(url);
  return { page, envois, fermer: () => contexte.close() };
}
