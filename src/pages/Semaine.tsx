import { useEffect, useState } from "react";
import { LienInterne } from "../composants/Lien";
import { couleur } from "../composants/couleurs";

type S = {
  actifs: { id: number; nom: string; icone: string | null; couleur: string; heures: number; delta: number | null; avancement: number | null; derniereEtape?: string }[];
  echecs: { id: number; nom: string; url: string; relatif: string }[];
  endormis: { id: number; nom: string; relatif: string; derniereEtape?: string; prochaineEtape?: string }[];
  heuresTotal: number;
};

export function Semaine(_props: { id?: number }) {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch("/api/semaine").then((r) => r.json()).then(setS); }, []);
  if (!s) return <main className="page"><p className="discret">Chargement…</p></main>;
  return (
    <main className="page page-fiche">
      <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
      <h1>Ma semaine</h1>
      <p className="discret">{s.heuresTotal >= 1 ? `~${Math.round(s.heuresTotal)} h de travail cette semaine` : "Peu de travail cette semaine."}</p>

      <section className="carte">
        <h2>Ce qui a avancé</h2>
        {s.actifs.length === 0 && <p className="discret">Rien cette semaine. Une petite séance?</p>}
        {s.actifs.map((p) => (
          <div key={p.id} className="semaine-ligne">
            <span className="pastille" aria-hidden="true" style={{ background: couleur(p.couleur).doux, width: 36, height: 36 }}>{p.icone ?? "•"}</span>
            <LienInterne vers={`/projet/${p.id}`} className="carte-nom">{p.nom}</LienInterne>
            {p.delta ? <span className={p.delta > 0 ? "hausse" : "baisse"}>{p.delta > 0 ? "+" : ""}{p.delta} %</span> : null}
            {p.heures > 0 && <span className="discret">~{Math.max(1, Math.round(p.heures))} h</span>}
            {p.derniereEtape && <span className="discret">· {p.derniereEtape}</span>}
          </div>
        ))}
      </section>

      {s.echecs.length > 0 && (
        <section className="carte">
          <h2>Ce qui a cassé</h2>
          {s.echecs.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer">● {p.nom} : mise en ligne échouée {p.relatif}</a>)}
        </section>
      )}

      {s.endormis.length > 0 && (
        <section className="carte">
          <h2>Ce qui s'endort</h2>
          {s.endormis.map((p) => (
            <div key={p.id}>
              <LienInterne vers={`/projet/${p.id}`} className="carte-nom">{p.nom}</LienInterne> <span className="discret">· {p.relatif}</span>
              {p.prochaineEtape && <p className="discret">Il restait : {p.prochaineEtape}</p>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
