import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

test("salutation selon l'heure, icône, courbe, progression et heures", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  await page.getByText(/^(Bon matin|Bon après-midi|Bonne soirée|Bonne nuit)\. 3 projets avancent\.$/).waitFor();
  const iptv = page.locator("[data-carte]").filter({ hasText: "IPTV maison" });
  assert.ok(await iptv.getByText("📺").isVisible());
  assert.ok(await iptv.getByRole("img", { name: /Courbe d'avancement/ }).isVisible());
  assert.ok(await iptv.getByText("+12 % cette semaine").isVisible());
  assert.ok(await iptv.getByText("~6 h cette semaine").isVisible());
  await fermer();
});

test("recherche rapide Ctrl+K", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  await page.getByText(/projets avancent/).waitFor();
  await page.keyboard.press("Control+k");
  await page.getByLabel("Chercher un projet").fill("pist");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/projet\/3$/);
  await fermer();
});

test("calendrier d'activité", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  await page.getByRole("heading", { name: /Activité des 12 derniers mois/ }).waitFor();
  assert.equal(await page.locator('[data-jour="2026-11-21"]').count(), 1);
  await fermer();
});

test("endormi expliqué", async () => {
  const { page, fermer } = await ouvrir(navigateur, site.url);
  await page.getByRole("button", { name: "MonDroit.ca · 8 mois" }).click();
  assert.ok(await page.getByText("Arrêté à : Page d'accueil faite").isVisible());
  assert.ok(await page.getByText("Il restait : Formulaire de demande").isVisible());
  await fermer();
});

test("page Ma semaine", async () => {
  const { page, fermer } = await ouvrir(navigateur, `${site.url}/semaine`, { reponses: { "GET /api/semaine": {
    actifs: [{ id: 1, nom: "IPTV maison", icone: "📺", couleur: "violet", heures: 6.2, delta: 12, avancement: 70, derniereEtape: "Version ordi" }],
    echecs: [{ id: 3, nom: "Pistes", url: "https://github.com/x", relatif: "hier" }],
    endormis: [{ id: 5, nom: "MonDroit.ca", relatif: "il y a 8 mois", derniereEtape: "Accueil", prochaineEtape: "Formulaire" }],
    heuresTotal: 6.2,
  } } });
  await page.getByRole("heading", { name: "Ma semaine" }).waitFor();
  assert.ok(await page.getByText("~6 h de travail cette semaine").isVisible());
  assert.ok(await page.getByText("+12 %").isVisible());
  assert.ok(await page.getByRole("link", { name: /Pistes/ }).first().isVisible());
  await fermer();
});

test("🎉 quand un jalon est coché", async () => {
  const detail = { id: 1, nom: "IPTV maison", couleur: "violet", initiales: "IM", icone: "📺", statut: "en_cours", statutChoisi: "en_cours", derniere: { quand: "2026-11-22T00:00:00Z", relatif: "hier", aLaMain: false }, avancement: 50, proposition: {}, liensRapides: [], liens: [], depots: [], commits: [], notes: "", enCours: "", historique: [], heuresSemaine: 0, jalonsEtat: "valide", jalonsResume: "1 sur 2 jalons", jalons: [{ id: 1, titre: "A", fait: true, cochePar: "main" }, { id: 2, titre: "B", fait: false, cochePar: null }] };
  const { page, fermer } = await ouvrir(navigateur, `${site.url}/projet/1`, { reponses: { "GET /api/projets/1": detail } });
  await page.getByRole("checkbox", { name: "B" }).click();
  await page.getByText("🎉 Jalon terminé!").waitFor();
  await fermer();
});

test("mode sombre automatique", async () => {
  const contexte = await navigateur.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  const page = await contexte.newPage();
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(site.url);
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(fond, "rgb(255, 255, 255)");
  await contexte.close();
});

test("choisir Clair, Sombre ou Auto (gardé au rechargement)", async () => {
  const contexte = await navigateur.newContext({ colorScheme: "light", viewport: { width: 1440, height: 900 } });
  const page = await contexte.newPage();
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${site.url}/reglages`);
  const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await fond(), "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Sombre" }).click();
  assert.notEqual(await fond(), "rgb(255, 255, 255)");
  await page.reload();
  assert.notEqual(await fond(), "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Clair" }).click();
  assert.equal(await fond(), "rgb(255, 255, 255)");
  await contexte.close();
});
