import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, servir, ouvrir, accueilExemple } from "./outils.mjs";

let navigateur, site;
before(async () => { navigateur = await chromium.launch(); site = await servir(); });
after(async () => { await navigateur.close(); site.fermer(); });

test("voyants vert et rouge sur les cartes", async () => {
  const a = accueilExemple();
  a.enCours[0].voyant = { etat: "succes", nom: "Publier", relatif: "il y a 2 h", url: "https://github.com/x/1" };
  a.enCours[1].voyant = { etat: "echec", nom: "Publier", relatif: "hier", url: "https://github.com/x/2" };
  const { page, fermer } = await ouvrir(navigateur, site.url, { accueil: a });
  await page.getByRole("link", { name: "Mise en ligne réussie · il y a 2 h" }).waitFor();
  const rouge = page.getByRole("link", { name: "Mise en ligne échouée · hier" });
  assert.equal(await rouge.getAttribute("href"), "https://github.com/x/2");
  await fermer();
});
