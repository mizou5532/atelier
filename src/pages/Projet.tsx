import { useCallback, useEffect, useState } from "react";
import type { DetailVue, Statut } from "../../shared/types";
import { api } from "../api";
import { Barre, Pastille } from "../composants/CarteProjet";
import { couleur } from "../composants/couleurs";
import { LienInterne } from "../composants/Lien";
import { naviguer } from "../App";

const NOMS_STATUTS: Record<Statut, string> = {
  idee: "Idée", en_cours: "En cours", en_pause: "En pause", termine: "Terminé", abandonne: "Abandonné", remplace: "Remplacé",
};

export function phraseReprise(d: Pick<DetailVue, "nom" | "depots">): string {
  const principal = d.depots.find((x) => x.principal) ?? d.depots[0];
  const depot = principal ? ` (dépôt ${new URL(principal.url).pathname.slice(1)})` : "";
  return `Reprends le projet ${d.nom}${depot}. Lis d'abord ETAT.md (section « En cours »), puis PASSATION.md s'il existe, et continue là où le travail s'est arrêté.`;
}

export function Projet({ id }: { id?: number }) {
  const [d, setD] = useState<DetailVue | null>(null);
  const [copie, setCopie] = useState(false);
  const [ajoutLien, setAjoutLien] = useState(false);
  const charger = useCallback(async () => setD(await api.projet(id!)), [id]);
  useEffect(() => { charger(); }, [charger]);
  if (!d) return <main className="page"><p className="discret">Chargement…</p></main>;
  const c = couleur(d.couleur);
  const agir = async (a: () => Promise<unknown>) => { await a(); await charger(); };

  return (
    <main className="page page-fiche">
      <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
      <header className="fiche-tete">
        <Pastille carte={d} taille={56} />
        <div>
          <h1>{d.nom}</h1>
          <p className="discret">{NOMS_STATUTS[d.statut]} · dernière activité {d.derniere.relatif}{d.derniere.aLaMain ? " (à la main)" : ""}</p>
        </div>
      </header>

      {d.ficheAVerifier && <p className="bandeau">Fiche à vérifier : le fichier ETAT.md de ce projet est illisible ou incomplet. Les dernières bonnes valeurs restent affichées.</p>}

      <div className="fiche-grille">
        <section className="carte">
          <h2>Avancement</h2>
          <Barre valeur={d.avancement} nom={d.couleur} />
          {d.proposition.avancement !== undefined && (
            <div className="proposition" style={{ background: c.doux, color: c.texte }}>
              <span>L'IA propose maintenant {d.proposition.avancement} %</span>
              <div className="choix">
                <button onClick={() => agir(() => api.proposition(d.id, "avancement", "accepter"))}>Accepter</button>
                <button onClick={() => agir(() => api.proposition(d.id, "avancement", "ignorer"))}>Ignorer</button>
              </div>
            </div>
          )}
          {d.proposition.statut && (
            <div className="proposition" style={{ background: c.doux, color: c.texte }}>
              <span>L'IA propose : {NOMS_STATUTS[d.proposition.statut]}</span>
              <div className="choix">
                <button onClick={() => agir(() => api.proposition(d.id, "statut", "accepter"))}>Accepter le statut</button>
                <button onClick={() => agir(() => api.proposition(d.id, "statut", "ignorer"))}>Ignorer le statut</button>
              </div>
            </div>
          )}
          <div className="reglage-ligne">
            <label>Avancement (%)
              <input type="number" min={0} max={100} defaultValue={d.avancement ?? ""} key={`a${d.avancement}`}
                onBlur={(e) => { const v = e.target.value === "" ? null : Math.max(0, Math.min(100, Math.round(Number(e.target.value)))); if (v !== d.avancement) agir(() => api.modifierProjet(d.id, { avancement: v })); }} />
            </label>
            <label>Icône
              <input defaultValue={d.icone ?? ""} key={`i${d.icone}`} maxLength={8} style={{ width: 80 }}
                onBlur={(e) => e.target.value !== (d.icone ?? "") && agir(() => api.modifierProjet(d.id, { icone: e.target.value }))} />
            </label>
            <label>Statut
              <select value={d.statutChoisi ?? d.statut} onChange={(e) => agir(() => api.modifierProjet(d.id, { statut: e.target.value }))}>
                {Object.entries(NOMS_STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="carte">
          <h2>Étapes</h2>
          <p className="etiquette-titre">Dernière étape</p><p>{d.derniereEtape ?? "À compléter"}</p>
          <p className="etiquette-titre">Prochaine étape</p><p className="fort">{d.prochaineEtape ?? "À compléter"}</p>
        </section>
      </div>

      <Jalons d={d} agir={agir} />

      <section className="carte encours" style={{ borderColor: c.doux }}>
        <h2 style={{ color: c.texte }}>En cours de travail</h2>
        {d.enCours ? <pre className="encours-texte">{d.enCours}</pre> : <p className="discret">Rien en cours : la dernière étape est terminée.</p>}
        <button className="bouton-fort" onClick={async () => { await navigator.clipboard.writeText(phraseReprise(d)); setCopie(true); setTimeout(() => setCopie(false), 4000); }}>
          Reprendre (copier la phrase pour ton IA)
        </button>
        {copie && <p className="discret" role="status">Phrase copiée : colle-la dans Claude ou Antigravity.</p>}
      </section>

      <div className="fiche-grille">
        <section className="carte">
          <h2>Liens</h2>
          <div className="choix">
            {d.liens.map((l) => (
              <span key={l.id} className="lien-bloc">
                <a href={l.url} target="_blank" rel="noreferrer">{l.nom}</a>
                {<button aria-label={`Retirer ${l.nom}`} className="mini" onClick={() => agir(() => api.retirerLien(d.id, l.id))}>×</button>}
              </span>
            ))}
            <button onClick={() => setAjoutLien(true)}>+ Lien</button>
          </div>
          {ajoutLien && (
            <form className="reglage-ligne" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              agir(async () => { await api.ajouterLien(d.id, String(f.get("nom")), String(f.get("url"))); setAjoutLien(false); });
            }}>
              <label>Nom du lien<input name="nom" required maxLength={60} /></label>
              <label>Adresse<input name="url" type="url" required placeholder="https://" /></label>
              <div className="choix"><button type="submit">Ajouter</button></div>
            </form>
          )}
        </section>

        <section className="carte">
          <h2>Dépôts rattachés</h2>
          {d.depots.length === 0 && <p className="discret">Aucun dépôt : projet suivi à la main.</p>}
          {d.depots.map((x) => (
            <div key={x.githubId} className="depot-ligne">
              <a href={x.url} target="_blank" rel="noreferrer">{x.nom}</a>
              <span className="discret">{x.principal ? "★ principal" : ""}{x.disparu ? " · disparu de GitHub" : ""}{x.prive ? "" : " · public"}</span>
              <div className="choix">
                {!x.principal && <button onClick={() => agir(() => api.modifierProjet(d.id, { depotPrincipal: x.githubId }))}>Principal</button>}
                <button aria-label={`Détacher ${x.nom}`} onClick={() => agir(() => api.detacher(x.githubId))}>Détacher</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="carte">
        <h2>Notes</h2>
        <textarea defaultValue={d.notes} key={d.notes} rows={4} aria-label="Notes" onBlur={(e) => e.target.value !== d.notes && agir(() => api.modifierProjet(d.id, { notes: e.target.value }))} />
        {d.commits.length > 0 && (<>
          <h2>Derniers changements</h2>
          <ul className="commits">{d.commits.map((m, i) => <li key={i}><span className="discret">{new Date(m.date).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Montreal" })}</span> {m.message}</li>)}</ul>
        </>)}
      </section>

      <div className="choix">
        <button onClick={() => agir(async () => { await api.modifierProjet(d.id, { masque: true }); naviguer("/"); })}>Masquer ce projet</button>
        {d.depots.length === 0 && <button onClick={() => { if (confirm(`Supprimer « ${d.nom} » d'Atelier? (Rien n'est touché sur GitHub.)`)) agir(async () => { await api.supprimerProjet(d.id); naviguer("/"); }); }}>Supprimer</button>}
      </div>
    </main>
  );
}

function Jalons({ d: brut, agir }: { d: DetailVue; agir: (a: () => Promise<unknown>) => Promise<void> }) {
  const d = { ...brut, jalons: brut.jalons ?? [], jalonsEtat: brut.jalonsEtat ?? "aucun" };
  const [nouveau, setNouveau] = useState("");
  const [fete, setFete] = useState(false);
  const cocher = (id: number, fait: boolean) => agir(async () => {
    await api.modifierJalon(id, { fait });
    if (fait) { setFete(true); setTimeout(() => setFete(false), 3000); }
  });
  const ajout = (
    <form className="reglage-ligne" onSubmit={(e) => { e.preventDefault(); if (nouveau.trim()) agir(async () => { await api.ajouterJalon(d.id, nouveau.trim()); setNouveau(""); }); }}>
      <label>Nouveau jalon<input value={nouveau} onChange={(e) => setNouveau(e.target.value)} maxLength={120} /></label>
      <div className="choix"><button type="submit">Ajouter le jalon</button></div>
    </form>
  );
  return (
    <section className="carte">
      <h2>Jalons {d.jalonsResume ? `· ${d.jalonsResume}` : ""}</h2>
      {d.jalonsEtat === "aucun" && d.jalons.length === 0 && <p className="discret">L'agent proposera des jalons à la prochaine activité du projet. Tu peux aussi en ajouter toi-même.</p>}
      {d.jalonsEtat === "propose" && <p className="discret">L'agent propose ces étapes jusqu'à une version complète. Corrige-les au besoin, puis valide.</p>}
      <ul className="jalons">
        {d.jalons.map((j) => (
          <li key={j.id}>
            <label className="jalon">
              <input type="checkbox" checked={j.fait} aria-label={j.titre} onChange={(e) => cocher(j.id, e.target.checked)} />
              <span className={j.fait ? "jalon-fait" : ""}>{j.titre}</span>
            </label>
            {j.cochePar === "ia" && <span className="discret">coché par l'IA</span>}
            <button className="mini" aria-label={`Retirer ${j.titre}`} onClick={() => agir(() => api.retirerJalon(j.id))}>×</button>
          </li>
        ))}
      </ul>
      {fete && <p className="fete" role="status">🎉 Jalon terminé!</p>}
      {d.jalonsEtat === "propose" && <div className="choix"><button className="bouton-fort" onClick={() => agir(() => api.validerJalons(d.id))}>Valider ces jalons</button></div>}
      {ajout}
      {d.jalons.length > 0 && <div className="choix"><button onClick={() => { if (confirm("Effacer ces jalons et en demander de nouveaux à l'agent?")) agir(() => api.regenererJalons(d.id)); }}>Refaire la proposition</button></div>}
    </section>
  );
}
