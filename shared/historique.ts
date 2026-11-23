import { z } from "zod";
import { heuresTravaillees } from "./activite";
import { heureMontreal } from "./temps";

export const IAS = ["claude", "codex", "antigravity", "gemini", "copilot", "autre"] as const;
export type IA = (typeof IAS)[number];
export const NOMS_IA: Record<IA, string> = { claude: "Claude", codex: "Codex", antigravity: "Antigravity", gemini: "Gemini", copilot: "Copilot", autre: "Autre / inconnue" };

/** Devine l'IA qui a fait un commit à partir de sa signature (Co-Authored-By, mention de l'outil) ou de l'auteur. */
export function detecterIA(message: string, courriel: string): IA {
  const m = `${message}\n${courriel}`.toLowerCase();
  if (/anthropic\.com|claude code|co-authored-by: claude|\bclaude\b/.test(m)) return "claude";
  if (/codex|openai\.com|chatgpt/.test(m)) return "codex";
  if (/antigravity/.test(m)) return "antigravity";
  if (/gemini|google\.com>/.test(m)) return "gemini";
  if (/copilot/.test(m)) return "copilot";
  return "autre";
}

const formatJour = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montreal", year: "numeric", month: "2-digit", day: "2-digit" });
export const jourMontrealDe = (iso: string) => formatJour.format(new Date(iso));

export type CommitJour = { projetId: number; projet: string; quand: string; message: string; ia: IA };

export function decouperJour(jour: string, commits: CommitJour[]) {
  const duJour = commits.filter((c) => jourMontrealDe(c.quand) === jour).sort((a, b) => a.quand.localeCompare(b.quand));
  const parProjet = new Map<number, CommitJour[]>();
  for (const c of duJour) parProjet.set(c.projetId, [...(parProjet.get(c.projetId) ?? []), c]);
  const compterIA = (liste: CommitJour[]) => liste.reduce<Partial<Record<IA, number>>>((t, c) => ({ ...t, [c.ia]: (t[c.ia] ?? 0) + 1 }), {});
  const projets = [...parProjet.entries()].map(([projetId, liste]) => ({
    projetId,
    projet: liste[0].projet,
    n: liste.length,
    minutes: Math.round(heuresTravaillees(liste.map((c) => c.quand), new Date(0)) * 60),
    premier: heureMontreal(liste[0].quand),
    dernier: heureMontreal(liste[liste.length - 1].quand),
    ia: compterIA(liste),
    commits: liste.map((c) => ({ heure: heureMontreal(c.quand), message: c.message.split("\n")[0], ia: c.ia })),
    part: 0,
  }));
  const totalMinutes = projets.reduce((s, p) => s + p.minutes, 0);
  for (const p of projets) p.part = totalMinutes ? (p.minutes / totalMinutes) * 100 : (p.n / duJour.length) * 100;
  projets.sort((a, b) => b.minutes - a.minutes || b.n - a.n);
  return {
    jour, total: duJour.length, minutes: totalMinutes, projets, ia: compterIA(duJour),
    premier: duJour[0] ? heureMontreal(duJour[0].quand) : null,
    dernier: duJour.length ? heureMontreal(duJour[duJour.length - 1].quand) : null,
  };
}

export const ACCENTS = ["indigo", "vert", "orange", "rose", "bleu", "ardoise"] as const;

export const schemaPreferences = z.object({
  sections: z.object({
    quotas: z.boolean(), calendrier: z.boolean(), aClasser: z.boolean(), endormis: z.boolean(), idees: z.boolean(), archives: z.boolean(),
  }).partial(),
  carte: z.object({ courbe: z.boolean(), heures: z.boolean(), voyant: z.boolean(), etapes: z.boolean(), liens: z.boolean(), jalons: z.boolean() }).partial(),
  accent: z.enum(ACCENTS),
  densite: z.enum(["aeree", "compacte"]),
  colonnes: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  moisCalendrier: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]),
  salutation: z.boolean(),
  animations: z.boolean(),
}).partial().strict();

export type Preferences = {
  sections: { quotas: boolean; calendrier: boolean; aClasser: boolean; endormis: boolean; idees: boolean; archives: boolean };
  carte: { courbe: boolean; heures: boolean; voyant: boolean; etapes: boolean; liens: boolean; jalons: boolean };
  accent: (typeof ACCENTS)[number];
  densite: "aeree" | "compacte";
  colonnes: 2 | 3 | 4;
  moisCalendrier: 3 | 6 | 12 | 24;
  salutation: boolean;
  animations: boolean;
};

export const preferencesParDefaut: Preferences = {
  sections: { quotas: true, calendrier: true, aClasser: true, endormis: true, idees: true, archives: true },
  carte: { courbe: true, heures: true, voyant: true, etapes: true, liens: true, jalons: true },
  accent: "indigo", densite: "aeree", colonnes: 3, moisCalendrier: 12, salutation: true, animations: true,
};

export function fusionnerPreferences(enregistre: unknown): Preferences {
  const v = schemaPreferences.safeParse(enregistre);
  const p = v.success ? v.data : {};
  return {
    ...preferencesParDefaut, ...p,
    sections: { ...preferencesParDefaut.sections, ...(p.sections ?? {}) },
    carte: { ...preferencesParDefaut.carte, ...(p.carte ?? {}) },
  } as Preferences;
}
