const ECART_SEANCE_MS = 45 * 60_000;
const BONUS_SEANCE_MS = 20 * 60_000;

/** Heures de travail estimées à partir des heures de commit : séances séparées de plus de 45 min, +20 min par séance. */
export function heuresTravaillees(dates: string[], depuis: Date): number {
  const t = dates.map((d) => new Date(d).getTime()).filter((x) => x >= depuis.getTime()).sort((a, b) => a - b);
  if (t.length === 0) return 0;
  let total = 0;
  let debut = t[0];
  let fin = t[0];
  for (const x of t.slice(1)) {
    if (x - fin > ECART_SEANCE_MS) { total += fin - debut + BONUS_SEANCE_MS; debut = x; }
    fin = x;
  }
  total += fin - debut + BONUS_SEANCE_MS;
  return Math.round((total / 3_600_000) * 100) / 100;
}

/** Statistiques hebdomadaires de GitHub (week = dimanche, en secondes) → { "AAAA-MM-JJ": nombre } (jours sans activité omis). */
export function joursDepuisStats(semaines: { week: number; days: number[] }[]): Record<string, number> {
  const sortie: Record<string, number> = {};
  for (const s of semaines) {
    s.days.forEach((n, i) => {
      if (n > 0) sortie[new Date((s.week + i * 86_400) * 1000).toISOString().slice(0, 10)] = n;
    });
  }
  return sortie;
}

export function salutation(maintenant: Date): string {
  const h = Number(new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Montreal", hour: "numeric", hourCycle: "h23" }).format(maintenant).replace(/\D/g, ""));
  if (h >= 5 && h < 12) return "Bon matin";
  if (h >= 12 && h < 18) return "Bon après-midi";
  if (h >= 18 && h < 23) return "Bonne soirée";
  return "Bonne nuit";
}

const simple = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrerProjets<T extends { nom: string }>(projets: T[], recherche: string): T[] {
  const q = simple(recherche.trim());
  return q ? projets.filter((p) => simple(p.nom).includes(q)) : projets;
}
