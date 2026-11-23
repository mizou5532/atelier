import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir, accueilExemple } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

const detail = (o) => ({
  id: 1, nom: "IPTV maison", couleur: "violet", initiales: "IM", statut: "en_cours", statutChoisi: "en_cours", remplacePar: null,
  derniere: { quand: "2026-11-22T23:49:16Z", relatif: "hier", aLaMain: false }, avancement: null, proposition: {},
  enTravail: false, ficheAVerifier: false, estimeParIA: false, jalonsResume: null, liensRapides: [], nbDepots: 1, notes: "", enCours: "",
  liens: [], depots: [], commits: [], ...o,
});
const J = [{ id: 1, titre: "Liste des chaînes", fait: true, cochePar: "ia" }, { id: 2, titre: "Serveur maison", fait: false, cochePar: null }];

test("jalons proposés : les valider", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/projet/1`, { reponses: { "GET /api/projets/1": detail({ jalonsEtat: "propose", jalons: J }) } });
  await page.getByText("L'agent propose ces étapes").waitFor();
  await page.getByRole("button", { name: "Valider ces jalons" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.chemin === "/api/projets/1/jalons/valider"));
  await fermer();
});

test("jalons validés : cocher, ajouter, refaire", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/projet/1`, { reponses: { "GET /api/projets/1": detail({ jalonsEtat: "valide", jalons: J, jalonsResume: "1 sur 2 jalons", avancement: 50 }) } });
  await page.getByText("1 sur 2 jalons").waitFor();
  assert.ok(await page.getByText("coché par l'IA").isVisible());
  await page.getByRole("checkbox", { name: "Serveur maison" }).click();
  await page.getByLabel("Nouveau jalon").fill("Version ordinateur");
  await page.getByRole("button", { name: "Ajouter le jalon" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.methode === "PATCH" && e.chemin === "/api/jalons/2" && e.corps.fait === true));
  assert.ok(envois.some((e) => e.methode === "POST" && e.chemin === "/api/projets/1/jalons" && e.corps.titre === "Version ordinateur"));
  await fermer();
});

test("la carte montre les jalons", async () => {
  const a = accueilExemple();
  a.enCours[0].jalonsResume = "3 sur 6 jalons";
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a });
  await page.getByText("3 sur 6 jalons").waitFor();
  await fermer();
});
