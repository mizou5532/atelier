import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { construireEnvoi, ligneAffichee, doitEnvoyer } from "../../scripts/barre-etat/atelier-barre-etat.mjs";

const ENTREE = {
  model: { display_name: "Opus" }, session_id: "secret-de-session", transcript_path: "/x",
  rate_limits: { five_hour: { used_percentage: 40, resets_at: 1795450000 }, seven_day: { used_percentage: 62, resets_at: 1795700000 } },
};

test("ligne affichée", () => {
  assert.equal(ligneAffichee(ENTREE), "Claude · session 40 % · semaine 62 %");
  assert.equal(ligneAffichee({}), "Claude");
});

test("l'envoi ne contient que le courriel et les quotas", () => {
  const e = construireEnvoi(ENTREE, "Moi@Exemple.ca");
  assert.deepEqual(e, { courriel: "moi@exemple.ca", session: { utilise_pct: 40, reinit_le: 1795450000 }, semaine: { utilise_pct: 62, reinit_le: 1795700000 } });
  assert.equal(construireEnvoi({}, "moi@exemple.ca"), null);
  assert.equal(construireEnvoi(ENTREE, null), null);
});

test("un seul envoi par minute pour les mêmes chiffres", () => {
  const dossier = mkdtempSync(join(tmpdir(), "atelier-"));
  const e = construireEnvoi(ENTREE, "moi@exemple.ca");
  assert.equal(doitEnvoyer(dossier, e, 1_000_000), true);
  assert.equal(doitEnvoyer(dossier, e, 1_030_000), false);
  assert.equal(doitEnvoyer(dossier, { ...e, session: { utilise_pct: 41, reinit_le: 1795450000 } }, 1_031_000), true);
  assert.equal(doitEnvoyer(dossier, { ...e, session: { utilise_pct: 41, reinit_le: 1795450000 } }, 1_100_000), true);
  assert.ok(existsSync(join(dossier, "dernier-envoi.json")));
  assert.ok(!readFileSync(join(dossier, "dernier-envoi.json"), "utf8").includes("secret-de-session"));
});
