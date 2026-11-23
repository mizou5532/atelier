import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

const JOUR = {
  jour: "2026-11-21", total: 3, minutes: 95, premier: "13 h", dernier: "17 h 50", ia: { claude: 2, antigravity: 1 },
  projets: [{ projetId: 3, projet: "Pistes", couleur: "vert", icone: "💼", n: 3, minutes: 95, part: 100, premier: "13 h", dernier: "17 h 50", ia: { claude: 2, antigravity: 1 },
    commits: [{ heure: "13 h", message: "Banque de réponses", ia: "claude" }, { heure: "17 h 50", message: "Passation", ia: "antigravity" }] }],
};

test("survol d'une case : la bulle d'information", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  const c = page.locator('[data-jour="2026-11-21"]');
  await c.hover();
  const bulle = page.getByRole("tooltip");
  await bulle.waitFor();
  assert.match(await bulle.innerText(), /21 novembre/);
  assert.match(await bulle.innerText(), /Pistes/);
  assert.match(await bulle.innerText(), /1 h 35/);
  assert.match(await bulle.innerText(), /Claude/);
  await fermer();
});

test("clic sur une case : la page de la journée", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url, { reponses: { "GET /api/jour/2026-11-21": JOUR } });
  await page.locator('[data-jour="2026-11-21"]').click();
  await page.waitForURL(/\/jour\/2026-11-21$/);
  await page.getByRole("heading", { name: /samedi 21 novembre/i }).waitFor();
  assert.ok(await page.getByText("1 h 35 de travail").isVisible());
  assert.ok(await page.getByText("100 %").first().isVisible());
  assert.ok(await page.getByText("Banque de réponses").isVisible());
  assert.ok(await page.getByText("Antigravity").first().isVisible());
  assert.ok(await page.getByRole("link", { name: "‹ Jour précédent" }).isVisible());
  await fermer();
});

test("paramètres : cacher les quotas, couleur d'accent, enregistrés", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/reglages`, { reponses: { "GET /api/reglages": { seuilEndormiJours: 30, masques: { projets: [], depots: [] }, historique: { commits: 1234, depots: 11, complets: 9 } } } });
  await page.getByRole("heading", { name: "Accueil" }).waitFor();
  await page.getByRole("checkbox", { name: "Quotas IA" }).uncheck();
  await page.getByRole("button", { name: "Vert" }).click();
  await page.getByLabel("Mois affichés dans le calendrier").selectOption("24");
  await page.waitForTimeout(150);
  assert.ok(envois.some((e) => e.chemin === "/api/preferences" && e.corps?.sections?.quotas === false));
  assert.ok(envois.some((e) => e.chemin === "/api/preferences" && e.corps?.accent === "vert"));
  assert.ok(envois.some((e) => e.chemin === "/api/preferences" && e.corps?.moisCalendrier === 24));
  assert.ok(await page.getByText("1 234 changements importés").isVisible());
  await fermer();
});

test("l'accueil respecte les préférences", async () => {
  const { accueilExemple } = await import("./outils.mjs");
  const a = accueilExemple();
  a.quotas = [{ compteId: 1, nom: "Claude 1", type: "claude", plusLibre: false, fenetres: [] }];
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a, prefs: { sections: { quotas: false, calendrier: false }, salutation: false } });
  await page.getByText(/3 projets avancent/).waitFor();
  assert.equal(await page.getByLabel("Quotas IA").count(), 0);
  assert.equal(await page.getByRole("heading", { name: /Activité des/ }).count(), 0);
  assert.ok(await page.getByText(/^Bon retour\. 3 projets avancent\.$/).isVisible());
  await fermer();
});
