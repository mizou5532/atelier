import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

const detail = (o = {}) => ({
  id: 1, nom: "IPTV maison", couleur: "violet", initiales: "IM", statut: "en_cours", statutChoisi: "en_cours", remplacePar: null,
  derniere: { quand: "2026-11-22T23:49:16Z", relatif: "hier", aLaMain: false }, avancement: 70, proposition: { avancement: 75 },
  derniereEtape: "Version ordinateur en ligne", prochaineEtape: "Tester le filtre Sport", enTravail: true, ficheAVerifier: false,
  liensRapides: [], nbDepots: 1, notes: "", enCours: "- Je fais : le compteur\n- Prochaine action : brancher le serveur",
  liens: [{ id: 7, nom: "Site", url: "https://exemple.dev", source: "github" }, { id: 8, nom: "Supabase", url: "https://supabase.com", source: "main" }],
  depots: [{ githubId: 1, nom: "iptv-home", url: "https://github.com/mizou5532/iptv-home", prive: false, principal: true, disparu: false, ficheEtat: "ok" }],
  commits: [{ date: "2026-11-22T20:00:00Z", message: "Filtre Sport" }], ...o,
});

const ouvrirProjet = (o) => ouvrir(navigateur, `${site.url}/projet/1`, { reponses: { "GET /api/projets/1": detail(o), "GET /api/reglages": { seuilEndormiJours: 30, masques: { projets: [], depots: [] } } } });

test("bloc En cours de travail et Reprendre", async () => {
  const { page, fermer } = await ouvrirProjet();
  await page.getByText("En cours de travail").waitFor();
  assert.ok(await page.getByText("Je fais : le compteur").isVisible());
  await page.getByRole("button", { name: /Reprendre/ }).click();
  const copie = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copie, "Reprends le projet IPTV maison (dépôt mizou5532/iptv-home). Lis d'abord ETAT.md (section « En cours »), puis PASSATION.md s'il existe, et continue là où le travail s'est arrêté.");
  await page.getByText("Phrase copiée").waitFor();
  await fermer();
});

test("proposition de l'IA : accepter", async () => {
  const { page, envois, fermer } = await ouvrirProjet();
  await page.getByText("L'IA propose maintenant 75 %").waitFor();
  await page.getByRole("button", { name: "Accepter" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.chemin === "/api/projets/1/propositions" && e.corps.champ === "avancement" && e.corps.action === "accepter"));
  await fermer();
});

test("liens : ajouter et retirer", async () => {
  const { page, envois, fermer } = await ouvrirProjet();
  await page.getByRole("button", { name: "+ Lien" }).click();
  await page.getByLabel("Nom du lien").fill("Vercel");
  await page.getByLabel("Adresse").fill("https://vercel.com");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "Retirer Supabase" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.methode === "POST" && e.chemin === "/api/projets/1/liens" && e.corps.url === "https://vercel.com"));
  assert.ok(envois.some((e) => e.methode === "DELETE" && e.chemin === "/api/projets/1/liens/8"));
  assert.equal(await page.getByRole("button", { name: "Retirer Site" }).count(), 0);
  await fermer();
});

test("dépôts : détacher", async () => {
  const { page, envois, fermer } = await ouvrirProjet();
  await page.getByRole("button", { name: "Détacher iptv-home" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.chemin === "/api/depots/1/detacher"));
  await fermer();
});

test("avancement et statut à la main", async () => {
  const { page, envois, fermer } = await ouvrirProjet();
  await page.getByLabel("Avancement (%)").fill("55");
  await page.getByLabel("Avancement (%)").blur();
  await page.getByLabel("Statut").selectOption("en_pause");
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.methode === "PATCH" && e.corps.avancement === 55));
  assert.ok(envois.some((e) => e.methode === "PATCH" && e.corps.statut === "en_pause"));
  await fermer();
});

test("fiche à vérifier", async () => {
  const { page, fermer } = await ouvrirProjet({ ficheAVerifier: true });
  await page.getByText("Fiche à vérifier").waitFor();
  await fermer();
});

test("réglages : seuil et réafficher", async () => {
  const { page, envois, fermer } = await ouvrir(navigateur, `${site.url}/reglages`, { reponses: { "GET /api/reglages": { seuilEndormiJours: 30, masques: { projets: [{ id: 5, nom: "MonDroit.ca" }], depots: [{ githubId: 99, nom: "test" }] } } } });
  await page.getByLabel("Endormi après (jours)").fill("45");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Réafficher MonDroit.ca" }).click();
  await page.getByRole("button", { name: "Réafficher test" }).click();
  await page.waitForTimeout(100);
  assert.ok(envois.some((e) => e.corps?.seuilEndormiJours === 45));
  assert.ok(envois.some((e) => e.corps?.reafficherProjet === 5));
  assert.ok(envois.some((e) => e.corps?.reafficherDepot === 99));
  await fermer();
});
