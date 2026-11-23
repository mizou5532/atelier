import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

const QUOTAS = {
  quotas: [
    { compteId: 1, nom: "Claude 1", type: "claude", plusLibre: false, fenetres: [
      { fenetre: "session", reste: 60, etat: "normal", source: "auto", majRelatif: "il y a 12 min", reinit: { relatif: "dans 2 h", heure: "15 h 20", jour: "lun." } },
      { fenetre: "semaine", reste: 38, etat: "normal", source: "auto", majRelatif: "il y a 12 min", reinit: { relatif: "dans 6 jours", heure: "9 h", jour: "lun." } }] },
    { compteId: 2, nom: "Claude 2", type: "claude", plusLibre: true, fenetres: [
      { fenetre: "session", reste: 100, etat: "plein", source: "auto", majRelatif: "il y a 4 h" },
      { fenetre: "semaine", reste: 82, etat: "normal", source: "auto", majRelatif: "il y a 4 h", reinit: { relatif: "dans 3 jours", heure: "21 h", jour: "jeu." } }] },
    { compteId: 3, nom: "Google (Antigravity)", type: "google", plusLibre: false, fenetres: [] },
  ],
  aAssocier: ["nouveau@exemple.ca"], courriels: [],
};

test("page Quotas : comptes, plus libre, saisie Google, association", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/quotas`, { reponses: { "GET /api/quotas": QUOTAS } });
  await page.getByRole("heading", { name: "Quotas IA" }).waitFor();
  assert.ok(await page.getByText("★ Le plus libre maintenant : Claude 2").isVisible());
  assert.ok(await page.getByText("reste 38 %").isVisible());
  assert.ok(await page.getByText("réinitialisée, pleine").isVisible());
  const google = page.locator("section", { hasText: "Google (Antigravity)" });
  await google.getByLabel("Modèle").fill("Gemini Pro");
  await google.getByLabel("Il reste (%)").fill("60");
  await google.getByLabel("Revient dans (heures)").fill("3");
  await google.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByLabel("Compte pour nouveau@exemple.ca").selectOption("1");
  await page.waitForTimeout(150);
  assert.ok(envois.some((e) => e.chemin === "/api/quotas/main" && e.corps.compteId === 3 && e.corps.fenetre === "Gemini Pro" && e.corps.reste === 60 && e.corps.revientDansHeures === 3));
  assert.ok(envois.some((e) => e.chemin === "/api/quotas/courriels" && e.corps.courriel === "nouveau@exemple.ca" && e.corps.compteId === 1));
  await fermer();
});

test("bulles de l'accueil", async () => {
  const { accueilExemple } = await import("./outils.mjs");
  const a = accueilExemple(); a.quotas = QUOTAS.quotas;
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a });
  await page.getByText("Claude 2 · reste 82 % ★").waitFor();
  assert.ok(await page.getByText("Claude 1 · reste 38 %").isVisible());
  await fermer();
});
