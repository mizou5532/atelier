import { useEffect, useState } from "react";
import { couleur } from "./couleurs";

type Jour = { jour: string; total: number; projets: { id: number; nom: string; couleur: string; n: number }[] };

const formatJour = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

export function Calendrier() {
  const [jours, setJours] = useState<Map<string, Jour> | null>(null);
  useEffect(() => {
    fetch("/api/activite").then((r) => r.json()).then((d: { jours?: Jour[] }) => setJours(new Map((d.jours ?? []).map((j) => [j.jour, j])))).catch(() => setJours(new Map()));
  }, []);
  if (!jours) return null;
  // 26 semaines, colonnes = semaines (dimanche en haut), jusqu'à aujourd'hui
  const aujourdhui = new Date();
  const fin = Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate());
  const debut = fin - (26 * 7 - 1 + new Date(fin).getUTCDay()) * 86_400_000;
  const cases: { cle: string; j?: Jour }[] = [];
  for (let t = debut; t <= fin; t += 86_400_000) {
    const cle = new Date(t).toISOString().slice(0, 10);
    cases.push({ cle, j: jours.get(cle) });
  }
  return (
    <section className="calendrier-bloc">
      <h2>Activité des 6 derniers mois</h2>
      <div className="calendrier">
        {cases.map(({ cle, j }) => {
          const haut = j?.projets[0];
          const intensite = j ? Math.min(1, 0.35 + j.total / 10) : 0;
          const c = haut ? couleur(haut.couleur).fort : undefined;
          const titre = `${formatJour.format(new Date(cle + "T00:00:00Z"))} : ${j ? `${j.total} changement${j.total > 1 ? "s" : ""} · ${j.projets.map((p) => `${p.nom} ${p.n}`).join(", ")}` : "aucune activité"}`;
          return <span key={cle} className="case" title={titre} style={c ? { background: c, opacity: intensite } : undefined} />;
        })}
      </div>
    </section>
  );
}
