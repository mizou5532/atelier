import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir, accueilExemple } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

test("phrase d'accueil et cartes en cours", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  await page.getByText("Bon retour. 3 projets avancent.").waitFor();
  const cartes = page.locator("[data-carte]");
  assert.equal(await cartes.count(), 3);
  const iptv = cartes.filter({ hasText: "IPTV maison" });
  assert.ok(await iptv.getByText("70 %").isVisible());
  assert.ok(await iptv.getByText("IM", { exact: true }).isVisible());
  assert.ok(await iptv.getByText("en travail").isVisible());
  assert.ok(await cartes.filter({ hasText: "Appli sportive" }).getByText("—", { exact: true }).isVisible());
  await fermer();
});

test("endormis : décider", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, site.url);
  await page.getByText("Endormis · toujours en cours?").waitFor();
  await page.getByRole("button", { name: "MonDroit.ca · 8 mois" }).click();
  for (const nom of ["En pause", "Abandonné", "Terminé", "Remplacé par…"]) assert.ok(await page.getByRole("button", { name: nom }).isVisible());
  await page.getByRole("button", { name: "Abandonné" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.methode === "PATCH" && e.chemin === "/api/projets/5" && e.corps.statut === "abandonne"));
  await fermer();
});

test("dépôt à classer", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, site.url);
  await page.getByRole("button", { name: "Dépôt à classer : test" }).click();
  for (const nom of ["Nouveau projet", "Rattacher à…", "Masquer"]) assert.ok(await page.getByRole("button", { name: nom }).isVisible());
  await page.getByRole("button", { name: "Masquer" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.chemin === "/api/depots/99/classer" && e.corps.action === "masquer"));
  await fermer();
});

test("nouvelle idée", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, site.url);
  await page.getByRole("button", { name: "+ Nouvelle idée" }).click();
  await page.getByLabel("Titre").fill("Mon idée");
  await page.getByLabel("Notes").fill("Quelques lignes");
  await page.getByRole("button", { name: "Garder l'idée" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.methode === "POST" && e.chemin === "/api/projets" && e.corps.nom === "Mon idée" && e.corps.statut === "idee"));
  await fermer();
});

test("bandeau quand la clé GitHub est refusée", async () => {
  const a = accueilExemple();
  a.maj = { derniereReussite: null, erreur: "cle_refusee", erreurDepuis: "2026-11-23T14:05:00Z" };
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a });
  await page.getByText("Clé GitHub refusée : à renouveler").waitFor();
  await fermer();
});

test("téléphone : une colonne, pas de défilement horizontal", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url, { largeur: 390, hauteur: 844 });
  await page.getByText("Bon retour. 3 projets avancent.").waitFor();
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(deborde, false);
  await fermer();
});
