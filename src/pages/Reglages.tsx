import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { LienInterne } from "../composants/Lien";

type R = Awaited<ReturnType<typeof api.reglages>>;

export function Reglages(_props: { id?: number }) {
  const [r, setR] = useState<R | null>(null);
  const [seuil, setSeuil] = useState("30");
  const charger = useCallback(async () => { const v = await api.reglages(); setR(v); setSeuil(String(v.seuilEndormiJours)); }, []);
  useEffect(() => { charger(); }, [charger]);
  if (!r) return <main className="page"><p className="discret">Chargement…</p></main>;
  const agir = async (a: () => Promise<unknown>) => { await a(); await charger(); };
  return (
    <main className="page page-fiche">
      <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
      <h1>Réglages</h1>
      <form className="carte reglage-ligne" onSubmit={(e) => { e.preventDefault(); agir(() => api.modifierReglages({ seuilEndormiJours: Number(seuil) })); }}>
        <label>Endormi après (jours)<input type="number" min={1} max={3650} value={seuil} onChange={(e) => setSeuil(e.target.value)} /></label>
        <div className="choix"><button type="submit">Enregistrer</button></div>
      </form>
      <section className="carte">
        <h2>Éléments masqués</h2>
        {r.masques.projets.length + r.masques.depots.length === 0 && <p className="discret">Rien de masqué.</p>}
        <div className="choix">
          {r.masques.projets.map((p) => <button key={`p${p.id}`} aria-label={`Réafficher ${p.nom}`} onClick={() => agir(() => api.modifierReglages({ reafficherProjet: p.id }))}>Réafficher {p.nom}</button>)}
          {r.masques.depots.map((d) => <button key={`d${d.githubId}`} aria-label={`Réafficher ${d.nom}`} onClick={() => agir(() => api.modifierReglages({ reafficherDepot: d.githubId }))}>Réafficher {d.nom} (dépôt)</button>)}
        </div>
      </section>
    </main>
  );
}
