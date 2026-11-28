import { useEffect, useState } from "react";
import { couleur } from "./couleurs";
import { IconeProjet } from "./CarteProjet";
import { dureeTexte } from "./duree";
import { naviguer } from "../App";
import { usePreferences } from "../preferences";
import { NOMS_IA, type IA } from "../../shared/historique";

type Jour = { jour: string; total: number; minutes: number; ia: Partial<Record<IA, number>>; projets: { id: number; nom: string; couleur: string; icone: string | null; logo?: string | null; n: number; minutes: number }[] };

const formatLong = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatMois = new Intl.DateTimeFormat("fr-CA", { month: "short", timeZone: "UTC" });

export function Calendrier() {
  const prefs = usePreferences();
  const mois = prefs.moisCalendrier;
  const [jours, setJours] = useState<Map<string, Jour> | null>(null);
  const [bulle, setBulle] = useState<{ cle: string; x: number; y: number } | null>(null);
  useEffect(() => {
    fetch(`/api/activite?mois=${mois}`).then((r) => r.json()).then((d: { jours?: Jour[] }) => setJours(new Map((d.jours ?? []).map((j) => [j.jour, j])))).catch(() => setJours(new Map()));
  }, [mois]);
  if (!jours) return null;
  const aujourdhui = new Date();
  const fin = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const semaines = Math.round((mois * 30.44) / 7);
  const debut = fin - ((semaines - 1) * 7 + new Date(fin).getUTCDay()) * 86_400_000;
  const cases: string[] = [];
  for (let t = debut; t <= fin; t += 86_400_000) cases.push(new Date(t).toISOString().slice(0, 10));
  const max = Math.max(60, ...[...jours.values()].map((j) => j.minutes));
  const etiquettes = cases.filter((c, i) => i % 7 === 0).map((c) => (c.slice(8) <= "07" ? formatMois.format(new Date(c + "T00:00:00Z")) : ""));
  const info = bulle ? jours.get(bulle.cle) : undefined;
  const totalMin = [...jours.values()].reduce((s, j) => s + j.minutes, 0);

  return (
    <section className="calendrier-bloc">
      <h2>Activité des {mois} derniers mois <span className="discret">· {jours.size} jours actifs · ~{dureeTexte(totalMin)}</span></h2>
      <div className="calendrier-mois" aria-hidden="true">{etiquettes.map((m, i) => <span key={i}>{m}</span>)}</div>
      <div className="calendrier" onMouseLeave={() => setBulle(null)}>
        {cases.map((cle) => {
          const j = jours.get(cle);
          const haut = j?.projets[0];
          const c = haut ? couleur(haut.couleur).fort : undefined;
          const intensite = j ? Math.min(1, 0.3 + (j.minutes / max) * 0.7) : 0;
          return (
            <button key={cle} className="case" data-jour={cle} aria-label={`${cle} : ${j ? `${j.total} changements` : "aucune activité"}`}
              style={c ? { background: c, opacity: intensite } : undefined}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setBulle({ cle, x: r.left + r.width / 2, y: r.top }); }}
              onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setBulle({ cle, x: r.left + r.width / 2, y: r.top }); }}
              onClick={() => naviguer(`/jour/${cle}`)} />
          );
        })}
      </div>
      {bulle && (
        <div className="bulle-info" role="tooltip" style={{ left: bulle.x, top: bulle.y }}>
          <strong>{formatLong.format(new Date(bulle.cle + "T00:00:00Z"))}</strong>
          {info ? (
            <>
              <span>{dureeTexte(info.minutes)} de travail · {info.total} changement{info.total > 1 ? "s" : ""}</span>
              {info.projets.map((p) => (
                <span key={p.id} className="bulle-ligne"><i style={{ background: couleur(p.couleur).fort }} /><IconeProjet logo={p.logo} icone={p.icone} taille={14} /> {p.nom} · {dureeTexte(p.minutes)}</span>
              ))}
              <span className="discret">IA : {Object.entries(info.ia).map(([k, n]) => `${NOMS_IA[k as IA]} ${n}`).join(", ")}</span>
              <span className="discret">Clique pour le détail</span>
            </>
          ) : <span className="discret">Aucune activité</span>}
        </div>
      )}
    </section>
  );
}
