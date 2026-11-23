export type Theme = "auto" | "clair" | "sombre";
const CLE = "atelier-theme";

export function lireTheme(): Theme {
  try { const t = localStorage.getItem(CLE); if (t === "clair" || t === "sombre" || t === "auto") return t; } catch {}
  return "auto";
}

export function appliquerTheme(t: Theme = lireTheme()) {
  const sombre = t === "sombre" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = sombre ? "dark" : "light";
}

export function choisirTheme(t: Theme) {
  try { localStorage.setItem(CLE, t); } catch {}
  appliquerTheme(t);
  dispatchEvent(new Event("atelier-theme"));
}

export function suivreSysteme() {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => appliquerTheme());
}
