import { useEffect, useState } from "react";
import { fusionnerPreferences, preferencesParDefaut, type Preferences } from "../shared/historique";

let actuelles: Preferences = preferencesParDefaut;
let chargees = false;
const abonnes = new Set<(p: Preferences) => void>();

function appliquer(p: Preferences) {
  const r = document.documentElement;
  r.dataset.accent = p.accent;
  r.dataset.densite = p.densite;
  r.dataset.animations = p.animations ? "oui" : "non";
  r.style.setProperty("--colonnes", String(p.colonnes));
}

function publier(p: Preferences) {
  actuelles = p;
  appliquer(p);
  abonnes.forEach((f) => f(p));
}

export async function chargerPreferences() {
  if (chargees) return;
  chargees = true;
  try {
    const r = await fetch("/api/preferences");
    if (r.ok) publier(fusionnerPreferences(await r.json()));
  } catch { /* on garde les valeurs par défaut */ }
}

export async function changerPreferences(partiel: Record<string, unknown>) {
  const sections = { ...actuelles.sections, ...((partiel.sections as object) ?? {}) };
  const carte = { ...actuelles.carte, ...((partiel.carte as object) ?? {}) };
  publier({ ...actuelles, ...partiel, sections, carte } as Preferences);
  try {
    await fetch("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(partiel) });
  } catch { /* réessaiera au prochain changement */ }
}

export function usePreferences(): Preferences {
  const [p, setP] = useState(actuelles);
  useEffect(() => {
    abonnes.add(setP);
    chargerPreferences();
    return () => { abonnes.delete(setP); };
  }, []);
  return p;
}
