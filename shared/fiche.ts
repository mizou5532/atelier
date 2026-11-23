import { parse } from "yaml";
import { z } from "zod";
import { STATUTS, type Fiche, type Statut } from "./types";

export function normaliserStatut(s: string): Statut | null {
  const cle = s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (STATUTS as readonly string[]).includes(cle) ? (cle as Statut) : null;
}

const texte = z.union([z.string(), z.number(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : String(v))).optional();

const schema = z.object({
  projet: texte,
  statut: z.string().optional(),
  avancement: z.number().int().min(0).max(100).optional(),
  derniere_etape: texte,
  prochaine_etape: texte,
  mis_a_jour: texte,
  par: texte,
  liens: z.array(z.record(z.string(), z.string())).optional(),
});

function sectionEnCours(corps: string): string {
  const lignes = corps.split(/\r?\n/);
  const debut = lignes.findIndex((l) => /^##\s+En cours\s*$/i.test(l.trim()));
  if (debut < 0) return "";
  const suite: string[] = [];
  for (const l of lignes.slice(debut + 1)) {
    if (/^##\s/.test(l)) break;
    if (/^\(Vide\b/i.test(l.trim())) continue;
    suite.push(l);
  }
  return suite.join("\n").trim();
}

/** Lecture de secours, ligne par ligne, quand une IA a écrit « clé: valeur » sans guillemets (ex. un « : » dans la valeur). */
function lectureSimple(entete: string): Record<string, unknown> | null {
  const sortie: Record<string, unknown> = {};
  let liste: Record<string, string>[] | null = null;
  for (const brute of entete.split(/\r?\n/)) {
    const ligne = brute.replace(/\s{2,}#.*$/, "");
    if (!ligne.trim()) continue;
    const element = ligne.match(/^\s+-\s+([^:]+):\s*(.+)$/);
    if (element && liste) { liste.push({ [element[1].trim()]: element[2].trim() }); continue; }
    const paire = ligne.match(/^([a-z_]+):\s*(.*)$/);
    if (!paire) return null;
    if (paire[2] === "") { liste = []; sortie[paire[1]] = liste; continue; }
    liste = null;
    const v = paire[2].trim();
    sortie[paire[1]] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return sortie;
}

export function lireFiche(contenu: string): { etat: "ok"; fiche: Fiche } | { etat: "a_verifier"; raison: string } {
  const m = contenu.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n([\s\S]*))?$/);
  if (!m) return { etat: "a_verifier", raison: "en-tête absent" };
  let brut: unknown;
  try {
    brut = parse(m[1]);
  } catch {
    brut = lectureSimple(m[1]);
    if (brut === null) return { etat: "a_verifier", raison: "en-tête illisible" };
  }
  const v = schema.safeParse(brut ?? {});
  if (!v.success) return { etat: "a_verifier", raison: "valeurs invalides" };
  let statut: Statut | undefined;
  if (v.data.statut !== undefined) {
    const s = normaliserStatut(v.data.statut);
    if (!s) return { etat: "a_verifier", raison: "statut inconnu" };
    statut = s;
  }
  const liens = (v.data.liens ?? []).flatMap((o) => Object.entries(o).map(([nom, url]) => ({ nom, url })));
  return {
    etat: "ok",
    fiche: {
      projet: v.data.projet,
      statut,
      avancement: v.data.avancement,
      derniereEtape: v.data.derniere_etape,
      prochaineEtape: v.data.prochaine_etape,
      misAJour: v.data.mis_a_jour,
      par: v.data.par,
      liens,
      enCours: sectionEnCours(m[2] ?? ""),
    },
  };
}
