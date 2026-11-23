import type { AccueilVue, DetailVue } from "../shared/types";

async function appel<T>(chemin: string, init: { method?: string; corps?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api${chemin}`, {
    method: init.method ?? "GET",
    headers: init.corps === undefined ? undefined : { "content-type": "application/json" },
    body: init.corps === undefined ? undefined : JSON.stringify(init.corps),
  });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  const texte = await r.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}

export const api = {
  accueil: () => appel<AccueilVue>("/accueil"),
  projet: (id: number) => appel<DetailVue>(`/projets/${id}`),
  rafraichir: () => appel("/rafraichir", { method: "POST" }),
  creerProjet: (corps: { nom: string; statut?: "idee" | "en_cours"; notes?: string }) => appel<{ id: number }>("/projets", { method: "POST", corps }),
  modifierProjet: (id: number, corps: Record<string, unknown>) => appel(`/projets/${id}`, { method: "PATCH", corps }),
  supprimerProjet: (id: number) => appel(`/projets/${id}`, { method: "DELETE" }),
  proposition: (id: number, champ: "statut" | "avancement", action: "accepter" | "ignorer") => appel(`/projets/${id}/propositions`, { method: "POST", corps: { champ, action } }),
  classer: (githubId: number, corps: { action: "nouveau" } | { action: "rattacher"; projetId: number } | { action: "masquer" }) => appel(`/depots/${githubId}/classer`, { method: "POST", corps }),
  detacher: (githubId: number) => appel(`/depots/${githubId}/detacher`, { method: "POST" }),
  ajouterLien: (id: number, nom: string, url: string) => appel(`/projets/${id}/liens`, { method: "POST", corps: { nom, url } }),
  retirerLien: (id: number, lienId: number) => appel(`/projets/${id}/liens/${lienId}`, { method: "DELETE" }),
  reglages: () => appel<{ seuilEndormiJours: number; masques: { projets: { id: number; nom: string }[]; depots: { githubId: number; nom: string }[] } }>("/reglages"),
  modifierReglages: (corps: Record<string, unknown>) => appel("/reglages", { method: "PATCH", corps }),
  saisirQuota: (corps: { compteId: number; fenetre: string; reste: number | "bloque"; revientDansHeures: number }) => appel("/quotas/main", { method: "POST", corps }),
  validerJalons: (id: number) => appel(`/projets/${id}/jalons/valider`, { method: "POST" }),
  regenererJalons: (id: number) => appel(`/projets/${id}/jalons/regenerer`, { method: "POST" }),
  ajouterJalon: (id: number, titre: string) => appel(`/projets/${id}/jalons`, { method: "POST", corps: { titre } }),
  modifierJalon: (jalonId: number, corps: { titre?: string; fait?: boolean }) => appel(`/jalons/${jalonId}`, { method: "PATCH", corps }),
  retirerJalon: (jalonId: number) => appel(`/jalons/${jalonId}`, { method: "DELETE" }),
  associerCourriel: (courriel: string, compteId: number) => appel("/quotas/courriels", { method: "POST", corps: { courriel, compteId } }),
};
