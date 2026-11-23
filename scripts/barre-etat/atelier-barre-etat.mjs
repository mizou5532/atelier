#!/usr/bin/env node
// Barre d'état Claude Code pour Atelier.
// Affiche « Claude · session 40 % · semaine 62 % » et envoie ces chiffres à Atelier (au plus une fois par minute).
// Ne lit QUE : les champs rate_limits reçus de Claude Code, et le courriel du compte connecté (~/.claude.json).
// Ne lit et n'envoie jamais de jeton de connexion.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DOSSIER = join(homedir(), ".atelier");

const fenetre = (f) =>
  f && typeof f.used_percentage === "number" && typeof f.resets_at === "number"
    ? { utilise_pct: f.used_percentage, reinit_le: f.resets_at } : undefined;

export function ligneAffichee(entree) {
  const r = entree?.rate_limits;
  const parties = ["Claude"];
  if (typeof r?.five_hour?.used_percentage === "number") parties.push(`session ${Math.round(r.five_hour.used_percentage)} %`);
  if (typeof r?.seven_day?.used_percentage === "number") parties.push(`semaine ${Math.round(r.seven_day.used_percentage)} %`);
  return parties.join(" · ");
}

export function construireEnvoi(entree, courriel) {
  if (!courriel) return null;
  const session = fenetre(entree?.rate_limits?.five_hour);
  const semaine = fenetre(entree?.rate_limits?.seven_day);
  if (!session && !semaine) return null;
  return { courriel: courriel.toLowerCase(), ...(session ? { session } : {}), ...(semaine ? { semaine } : {}) };
}

export function doitEnvoyer(dossier, envoi, maintenant = Date.now()) {
  const fichier = join(dossier, "dernier-envoi.json");
  const empreinte = JSON.stringify(envoi);
  try {
    const avant = JSON.parse(readFileSync(fichier, "utf8"));
    if (avant.empreinte === empreinte && maintenant - avant.quand < 60_000) return false;
  } catch {}
  mkdirSync(dossier, { recursive: true });
  writeFileSync(fichier, JSON.stringify({ empreinte, quand: maintenant }));
  return true;
}

function lireCourriel() {
  try { return JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"))?.oauthAccount?.emailAddress ?? null; } catch { return null; }
}

async function principal() {
  let texte = "";
  for await (const morceau of process.stdin) texte += morceau;
  let entree = {};
  try { entree = JSON.parse(texte); } catch {}
  process.stdout.write(ligneAffichee(entree));
  try {
    const envoi = construireEnvoi(entree, lireCourriel());
    if (!envoi || !doitEnvoyer(DOSSIER, envoi)) return;
    const acces = JSON.parse(readFileSync(join(DOSSIER, "acces.json"), "utf8"));
    await fetch(`${acces.url.replace(/\/$/, "")}/api/quotas/claude`, {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Access-Client-Id": acces.clientId, "CF-Access-Client-Secret": acces.clientSecret },
      body: JSON.stringify(envoi),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Silence : la barre d'état doit toujours s'afficher, même sans réseau.
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) principal();
