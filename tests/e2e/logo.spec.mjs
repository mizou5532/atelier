import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir, accueilExemple } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

test("la carte montre le logo du projet; sans logo, l'émoji ou les initiales", async () => {
  const a = accueilExemple();
  a.enCours.unshift({ ...a.enCours[2], id: 9, nom: "Calendrier thermique", initiales: "CT", couleur: "rose", logo: "/api/projets/9/logo?v=1", liensRapides: [{ nom: "Site", url: "https://calendrier.hamzahlal86.workers.dev" }] });
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a });
  const logo = page.locator(".pastille-logo img").first();
  await logo.waitFor();
  assert.equal(await logo.getAttribute("src"), "/api/projets/9/logo?v=1");
  assert.ok(await logo.evaluate((img) => img.complete && img.naturalWidth > 0), "l'image du logo s'affiche");
  await page.getByText("📺").first().waitFor(); // les autres gardent leur émoji
  if (process.env.CAPTURE) await page.screenshot({ path: process.env.CAPTURE });
  await fermer();
});

test("fiche projet : d'où vient le logo, le retirer, en chercher un autre", async () => {
  const detail = {
    id: 9, nom: "Calendrier thermique", couleur: "rose", initiales: "CT", statut: "en_cours", statutChoisi: null, remplacePar: null,
    derniere: { quand: "2026-11-28T03:04:47Z", relatif: "aujourd'hui", aLaMain: false }, avancement: null, proposition: {},
    enTravail: false, ficheAVerifier: false, estimeParIA: true, jalonsResume: null, jalonsAValider: false, icone: null,
    logo: "/api/projets/9/logo?v=1", logoSource: "projet", historique: [], deltaSemaine: null, heuresSemaine: 0, voyant: null,
    liensRapides: [], nbDepots: 1, notes: "", enCours: "", liens: [{ id: 1, nom: "Site", url: "https://calendrier.hamzahlal86.workers.dev", source: "github" }],
    depots: [], commits: [], jalonsEtat: "aucun", jalons: [],
  };
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/projet/9`, { reponses: { "GET /api/projets/9": detail } });
  await page.getByText("trouvé dans le projet").waitFor();
  await page.getByRole("button", { name: "Retirer le logo" }).click();
  await page.getByRole("button", { name: "Chercher un logo" }).click();
  await page.waitForTimeout(200);
  assert.ok(envois.some((x) => x.methode === "PATCH" && x.chemin === "/api/projets/9" && x.corps?.logo === null));
  assert.ok(envois.some((x) => x.methode === "POST" && x.chemin === "/api/projets/9/logo/chercher"));
  await fermer();
});
