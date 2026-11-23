import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

const DETAIL = {
  id: 1, nom: "IPTV maison", couleur: "violet", initiales: "IM", statut: "en_cours", statutChoisi: "en_cours", remplacePar: null,
  derniere: { quand: "2026-11-22T23:49:16Z", relatif: "hier", aLaMain: false }, avancement: 70, proposition: {},
  prochaineEtape: "Tester le filtre Sport", enTravail: false, ficheAVerifier: false, liensRapides: [], nbDepots: 1, notes: "", enCours: "",
  liens: [], depots: [{ githubId: 1, nom: "iptv-home", url: "https://github.com/mizou5532/iptv-home", prive: false, principal: true, disparu: false, ficheEtat: "ok" }], commits: [],
};

test("parcours complet à l'ordinateur", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, site.url, { reponses: {
    "GET /api/projets/1": DETAIL,
    "GET /api/quotas": { quotas: [], aAssocier: [], courriels: [] },
  } });
  await page.getByText("3 projets avancent.").waitFor();
  await page.getByRole("link", { name: "IPTV maison" }).click();
  await page.getByRole("heading", { name: "IPTV maison" }).waitFor();
  await page.getByRole("button", { name: /Reprendre/ }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Reprends le projet IPTV maison \(dépôt mizou5532\/iptv-home\)/);
  await page.getByRole("link", { name: "‹ Accueil" }).click();
  await page.getByRole("button", { name: "+ Nouvelle idée" }).click();
  await page.getByLabel("Titre").fill("Une idée");
  await page.getByRole("button", { name: "Garder l'idée" }).click();
  await page.getByRole("button", { name: "Dépôt à classer : test" }).click();
  await page.getByRole("button", { name: "Masquer" }).click();
  await page.getByRole("link", { name: "Quotas" }).click();
  await page.getByRole("heading", { name: "Quotas IA" }).waitFor();
  assert.ok(envois.some((e) => e.chemin === "/api/projets" && e.corps.nom === "Une idée"));
  assert.ok(envois.some((e) => e.chemin === "/api/depots/99/classer"));
  await fermer();
});
