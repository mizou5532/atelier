import { dans, heureMontreal, jourMontreal } from "./temps";

export type LigneQuota = { utilise_pct: number | null; bloque: number; reinit_le: string | null; maj_le: string };
export type VueQuota = {
  reste: number | null;
  etat: "normal" | "plein" | "bloque" | "a_confirmer" | "inconnu";
  reinit?: { relatif: string; heure: string; jour: string };
};

const JOUR = 86_400_000;

export function vueQuota(q: LigneQuota, maintenant: Date): VueQuota {
  if (q.reinit_le && new Date(q.reinit_le).getTime() <= maintenant.getTime()) return { reste: 100, etat: "plein" };
  const reinit = q.reinit_le ? { relatif: dans(q.reinit_le, maintenant), heure: heureMontreal(q.reinit_le), jour: jourMontreal(q.reinit_le) } : undefined;
  if (q.bloque) return { reste: 0, etat: "bloque", reinit };
  if (q.utilise_pct === null) return { reste: null, etat: "inconnu", reinit };
  const reste = Math.max(0, Math.min(100, Math.round(100 - q.utilise_pct)));
  const vieux = maintenant.getTime() - new Date(q.maj_le).getTime() > JOUR;
  return { reste, etat: vieux ? "a_confirmer" : "normal", reinit };
}

/** Compte Claude avec le plus de marge dans sa session de 5 h, puis dans sa semaine. */
export function plusLibre(comptes: { id: number; type: string; session?: VueQuota; semaine?: VueQuota }[]): number | null {
  const candidats = comptes.filter((c) => c.type === "claude" && c.session && c.semaine && c.semaine.etat !== "bloque");
  if (candidats.length === 0) return null;
  const score = (v?: VueQuota) => (v?.reste ?? -1);
  candidats.sort((a, b) => Math.min(score(b.session), score(b.semaine)) - Math.min(score(a.session), score(a.semaine)) || score(b.semaine) - score(a.semaine));
  return candidats[0].id;
}

/** Lit la saisie rapide (« 60 % », « bloqué » ; « 3 h », « 1,5 », « 2 jours »). Renvoie null si ça n'a pas de sens. */
export function lireSaisieQuota(reste: string, duree: string): { reste: number | "bloque"; revientDansHeures: number } | null {
  const r = reste.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let valeur: number | "bloque";
  if (r === "bloque") valeur = "bloque";
  else {
    const m = r.match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
    if (!m) return null;
    valeur = Number(m[1].replace(",", "."));
    if (valeur > 100) return null;
  }
  const d = duree.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(h|heures?|j|jours?)?$/);
  if (!d) return null;
  const nombre = Number(d[1].replace(",", "."));
  const heures = d[2]?.startsWith("j") ? nombre * 24 : nombre;
  return { reste: valeur, revientDansHeures: heures };
}
