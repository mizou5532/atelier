import type { Statut } from "./types";

export function statutEffectif(choix: Statut | null, fiche: Statut | undefined): Statut {
  return choix ?? fiche ?? "en_cours";
}

/** Valeur que l'IA propose au propriétaire, ou null s'il n'y a rien à proposer. */
export function proposition<T>(choix: T | null, fiche: T | undefined, ignore: T | null): T | null {
  if (choix === null || fiche === undefined) return null;
  if (fiche === choix || fiche === ignore) return null;
  return fiche;
}

export function derniereActivite(depots: { pousse_le: string }[], modifieLe: string): { quand: string; aLaMain: boolean } {
  if (depots.length === 0) return { quand: modifieLe, aLaMain: true };
  const quand = depots.map((d) => d.pousse_le).sort().at(-1)!;
  return { quand, aLaMain: false };
}

export function estEndormi(statut: Statut, derniere: string, maintenant: Date, seuilJours: number): boolean {
  if (statut !== "en_cours") return false;
  return maintenant.getTime() - new Date(derniere).getTime() > seuilJours * 86_400_000;
}
