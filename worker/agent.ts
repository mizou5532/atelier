// Agent : résume un projet qui n'a pas de fiche ETAT.md, à partir de sa passation (ou README) et de ses derniers commits.
// Lecture seule : il n'écrit jamais dans les dépôts.
import { z } from "zod";

export type ResumeIA = { derniereEtape: string; prochaineEtape: string; avancement: number | null };
export type EntreeResume = { nom: string; passation: string | null; readme: string | null; commits: { date: string; message: string }[] };

const LIMITE_TEXTE = 15_000;

const SYSTEME = `Tu résumes l'état d'un projet logiciel personnel pour son propriétaire, qui n'est pas développeur.
Réponds en français du Québec, en phrases courtes et simples (moins de 15 mots chacune).
- derniere_etape : la dernière chose terminée.
- prochaine_etape : la prochaine chose à faire.
- avancement : pourcentage d'avancement du projet (0 à 100) SEULEMENT si le document contient un plan ou une liste d'étapes qui permet de l'estimer; sinon null. N'invente jamais.`;

const schemaReponse = z.object({
  derniere_etape: z.string().min(1).max(300),
  prochaine_etape: z.string().min(1).max(300),
  avancement: z.number().nullable().optional(),
});

export async function resumerDepot(cle: string, modele: string, entree: EntreeResume, f: typeof fetch = fetch): Promise<ResumeIA | null> {
  const document = entree.passation ?? entree.readme;
  if (!document && entree.commits.length === 0) return null;
  const texte = [
    `Projet : ${entree.nom}`,
    document ? `Document (${entree.passation ? "passation" : "README"}) :\n${document.slice(0, LIMITE_TEXTE)}` : "Pas de document.",
    `Derniers changements :\n${entree.commits.map((c) => `- ${c.date.slice(0, 10)} ${c.message}`).join("\n") || "aucun"}`,
  ].join("\n\n");
  try {
    const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEME }] },
        contents: [{ role: "user", parts: [{ text: texte }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { derniere_etape: { type: "STRING" }, prochaine_etape: { type: "STRING" }, avancement: { type: "INTEGER", nullable: true } },
            required: ["derniere_etape", "prochaine_etape"],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const corps = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const brut = corps.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!brut) return null;
    const v = schemaReponse.safeParse(JSON.parse(brut));
    if (!v.success) return null;
    const a = v.data.avancement;
    return {
      derniereEtape: v.data.derniere_etape.trim(),
      prochaineEtape: v.data.prochaine_etape.trim(),
      avancement: typeof a === "number" && Number.isInteger(a) && a >= 0 && a <= 100 ? a : null,
    };
  } catch {
    return null;
  }
}

export type EntreeJalons = { nom: string; document: string | null; commits: { date: string; message: string }[] };

async function demander(cle: string, modele: string, systeme: string, texte: string, schema: object, f: typeof fetch): Promise<unknown | null> {
  try {
    const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systeme }] },
        contents: [{ role: "user", parts: [{ text: texte }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const corps = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const brut = corps.candidates?.[0]?.content?.parts?.[0]?.text;
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

const contexte = (e: EntreeJalons) => [
  `Projet : ${e.nom}`,
  e.document ? `Document du projet :\n${e.document.slice(0, LIMITE_TEXTE)}` : "Pas de document.",
  `Derniers changements :\n${e.commits.map((c) => `- ${c.date.slice(0, 10)} ${c.message}`).join("\n") || "aucun"}`,
].join("\n\n");

const SYSTEME_JALONS = `Tu aides un propriétaire non développeur à suivre l'avancement de son projet personnel.
Propose entre 4 et 8 grands jalons, dans l'ordre, qui mènent de zéro à une « version complète » du projet, d'après le document.
Chaque titre fait moins de 8 mots, en français du Québec, compréhensible par quelqu'un qui ne code pas.
Pour chaque jalon, « fait » vaut true seulement si le document montre clairement qu'il est terminé.`;

export async function proposerJalons(cle: string, modele: string, entree: EntreeJalons, f: typeof fetch = fetch): Promise<{ titre: string; fait: boolean }[] | null> {
  if (!entree.document && entree.commits.length === 0) return null;
  const brut = await demander(cle, modele, SYSTEME_JALONS, contexte(entree), {
    type: "OBJECT",
    properties: { jalons: { type: "ARRAY", items: { type: "OBJECT", properties: { titre: { type: "STRING" }, fait: { type: "BOOLEAN" } }, required: ["titre", "fait"] } } },
    required: ["jalons"],
  }, f);
  const v = z.object({ jalons: z.array(z.object({ titre: z.string().trim().min(1).max(120), fait: z.boolean() })).min(3).max(10) }).safeParse(brut);
  return v.success ? v.data.jalons : null;
}

const SYSTEME_COCHER = `Voici les jalons d'un projet personnel, numérotés. D'après le document et les derniers changements,
donne les numéros des jalons PAS ENCORE cochés qui sont maintenant clairement terminés. Si aucun, renvoie une liste vide. N'invente rien.`;

export async function cocherJalons(cle: string, modele: string, entree: EntreeJalons & { jalons: { numero: number; titre: string; fait: boolean }[] }, f: typeof fetch = fetch): Promise<number[] | null> {
  const liste = entree.jalons.map((j) => `${j.numero}. [${j.fait ? "x" : " "}] ${j.titre}`).join("\n");
  const brut = await demander(cle, modele, SYSTEME_COCHER, `${contexte(entree)}\n\nJalons :\n${liste}`, {
    type: "OBJECT", properties: { faits: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["faits"],
  }, f);
  const v = z.object({ faits: z.array(z.number().int()) }).safeParse(brut);
  if (!v.success) return null;
  const pasFaits = new Set(entree.jalons.filter((j) => !j.fait).map((j) => j.numero));
  return [...new Set(v.data.faits)].filter((n) => pasFaits.has(n));
}
