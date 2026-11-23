#!/usr/bin/env node
// Sonde temporaire (étape 0) : vérifie que Claude Code fournit les quotas à sa barre d'état.
// N'enregistre QUE la version, les champs de quota et le fait qu'un courriel existe (pas le courriel).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let texte = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (morceau) => (texte += morceau));
process.stdin.on("end", () => {
  let entree = {};
  try { entree = JSON.parse(texte); } catch {}
  let aCourriel = false;
  try {
    const config = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));
    aCourriel = typeof config?.oauthAccount?.emailAddress === "string";
  } catch {}
  const dossier = join(homedir(), ".atelier");
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "sonde.json"), JSON.stringify({ version: entree.version ?? null, rate_limits: entree.rate_limits ?? null, a_courriel: aCourriel }, null, 2));
  process.stdout.write("Atelier : sonde OK");
});
