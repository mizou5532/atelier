import { useCallback, useEffect, useState } from "react";
import type { QuotaVue } from "../../shared/types";
import { api } from "../api";
import { LienInterne } from "../composants/Lien";
import { lireSaisieQuota } from "../../shared/quotas";

type Donnees = { quotas: QuotaVue[]; aAssocier: string[]; courriels: { courriel: string; compteId: number }[] };

const NOMS: Record<string, string> = { session: "Session (5 h)", semaine: "Semaine" };

function texteFenetre(f: QuotaVue["fenetres"][number]): string {
  if (f.etat === "plein") return "réinitialisée, pleine";
  if (f.etat === "bloque") return `bloqué${f.reinit ? ` · revient ${f.reinit.jour} ${f.reinit.heure}` : ""}`;
  const reste = f.reste === null ? "—" : `reste ${f.reste} %`;
  return `${reste}${f.reinit ? ` · ${f.reinit.jour} ${f.reinit.heure} (${f.reinit.relatif})` : ""}${f.etat === "a_confirmer" ? " · à confirmer" : ""}`;
}

export function Quotas(_props: { id?: number }) {
  const [d, setD] = useState<Donnees | null>(null);
  const charger = useCallback(async () => setD(await (await fetch("/api/quotas")).json()), []);
  useEffect(() => { charger(); }, [charger]);
  if (!d) return <main className="page"><p className="discret">Chargement…</p></main>;
  const agir = async (a: () => Promise<unknown>) => { await a(); await charger(); };
  const libre = d.quotas.find((q) => q.plusLibre);

  return (
    <main className="page page-fiche">
      <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
      <h1>Quotas IA</h1>
      {libre && <p className="bandeau libre">★ Le plus libre maintenant : {libre.nom}</p>}

      {d.quotas.map((q) => (
        <section key={q.compteId} className={q.plusLibre ? "carte quota libre" : "carte quota"}>
          <h2 className="quota-nom">{q.nom}</h2>
          {q.fenetres.length === 0 && <p className="discret">Pas encore de chiffres.</p>}
          {q.fenetres.map((f) => (
            <div key={f.fenetre} className="quota-ligne">
              <div className="quota-texte"><span>{NOMS[f.fenetre] ?? f.fenetre}</span><span>{texteFenetre(f)}</span></div>
              <div className="barre" role="progressbar" aria-label={`${q.nom}, ${f.fenetre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.reste ?? undefined}>
                {f.reste !== null && <div className="barre-remplie" style={{ width: `${f.reste}%`, background: f.reste < 40 ? "#FB923C" : f.etat === "plein" || f.reste >= 70 ? "#10B981" : "#3B82F6" }} />}
              </div>
              <span className="discret">{f.source === "auto" ? "automatique" : "à la main"} · {f.majRelatif}</span>
            </div>
          ))}
          {q.type !== "claude" && <SaisieMain compteId={q.compteId} enregistrer={(c) => agir(() => api.saisirQuota(c))} />}
        </section>
      ))}

      {d.aAssocier.length > 0 && (
        <section className="carte">
          <h2>Nouveau compte Claude détecté</h2>
          <p className="discret">Dis-moi à quel compte correspond ce courriel (une seule fois).</p>
          {d.aAssocier.map((courriel) => (
            <label key={courriel} className="reglage-ligne">Compte pour {courriel}
              <select aria-label={`Compte pour ${courriel}`} defaultValue="" onChange={(e) => e.target.value && agir(() => api.associerCourriel(courriel, Number(e.target.value)))}>
                <option value="">Choisir…</option>
                {d.quotas.filter((q) => q.type === "claude").map((q) => <option key={q.compteId} value={q.compteId}>{q.nom}</option>)}
              </select>
            </label>
          ))}
        </section>
      )}
      <p className="discret">Les comptes Claude se mettent à jour tout seuls quand tu utilises Claude Code sur ton Mac ou ton PC. Une fois l'heure de retour passée, le quota s'affiche plein sans rien faire.</p>
    </main>
  );
}

function SaisieMain({ compteId, enregistrer }: { compteId: number; enregistrer: (c: { compteId: number; fenetre: string; reste: number | "bloque"; revientDansHeures: number }) => void }) {
  const [modele, setModele] = useState("Gemini Pro");
  const [reste, setReste] = useState("");
  const [heures, setHeures] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <form className="reglage-ligne" onSubmit={(e) => {
      e.preventDefault();
      const lu = lireSaisieQuota(reste, heures);
      if (!lu) { setErreur("Je n'ai pas compris. Exemples : « 60 » ou « bloqué », et « 3 h » ou « 2 jours »."); return; }
      setErreur(null);
      enregistrer({ compteId, fenetre: modele.trim(), ...lu });
    }}>
      <label>Modèle<input value={modele} onChange={(e) => setModele(e.target.value)} required /></label>
      <label>Il reste (%)<input value={reste} onChange={(e) => setReste(e.target.value)} required placeholder="60 ou bloqué" inputMode="numeric" /></label>
      <label>Revient dans (heures)<input value={heures} onChange={(e) => setHeures(e.target.value)} required placeholder="3 h ou 2 jours" /></label>
      <div className="choix"><button type="submit">Enregistrer</button></div>
      {erreur && <p className="carte-note" role="alert">{erreur}</p>}
    </form>
  );
}
