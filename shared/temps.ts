const FUSEAU = "America/Montreal";

const formatHeure = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
const formatJour = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, weekday: "short" });
const formatDate = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" });

function jourCivil(d: Date): number {
  const [a, m, j] = formatDate.format(d).split("-").map(Number);
  return Date.UTC(a, m - 1, j) / 86_400_000;
}

export function relatif(iso: string, maintenant: Date): string {
  const d = new Date(iso);
  const minutes = Math.floor((maintenant.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  const jours = jourCivil(maintenant) - jourCivil(d);
  if (jours <= 1) return "hier";
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.floor(jours / 30.44);
  if (mois < 12) return `il y a ${mois} mois`;
  const ans = Math.floor(jours / 365.25);
  return `il y a ${ans} an${ans > 1 ? "s" : ""}`;
}

export function heureMontreal(iso: string): string {
  const [h, min] = formatHeure.format(new Date(iso)).split(/\D+/).filter(Boolean).map(Number);
  return min ? `${h} h ${String(min).padStart(2, "0")}` : `${h} h`;
}

export function jourMontreal(iso: string): string {
  return formatJour.format(new Date(iso));
}

export function dans(iso: string, maintenant: Date): string {
  const minutes = Math.ceil((new Date(iso).getTime() - maintenant.getTime()) / 60_000);
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `dans ${heures} h`;
  const jours = Math.round(heures / 24);
  return `dans ${jours} jour${jours > 1 ? "s" : ""}`;
}
