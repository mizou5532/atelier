import { useCallback, useEffect, useState } from "react";
import type { AccueilVue, CarteVue, DepotVue } from "../../shared/types";
import { api } from "../api";
import { CarteProjet } from "../composants/CarteProjet";
import { BulleQuota } from "../composants/BulleQuota";
import { LienInterne } from "../composants/Lien";
import { heureMontreal, relatif } from "../../shared/temps";

const dateDuJour = () => {
  const t = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Montreal", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function phrase(n: number): string {
  if (n === 0) return "Bon retour. Rien n'avance pour l'instant.";
  return `Bon retour. ${n} projet${n > 1 ? "s avancent" : " avance"}.`;
}

export function Accueil() {
  const [vue, setVue] = useState<AccueilVue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouvelleIdee, setNouvelleIdee] = useState(false);

  const charger = useCallback(async () => {
    try { setVue(await api.accueil()); setErreur(null); } catch { setErreur("Impossible de charger Atelier. Réessaie dans un instant."); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const [echec, setEchec] = useState<string | null>(null);
  const agir = async (action: () => Promise<unknown>, message = "Ça n'a pas marché. Réessaie dans un instant.") => {
    try { await action(); setEchec(null); } catch { setEchec(message); }
    setOuvert(null);
    await charger();
  };

  if (!vue) return <main className="page"><p className="discret">{erreur ?? "Chargement…"}</p></main>;
  const tous = [...vue.enCours, ...vue.endormis, ...vue.idees, ...vue.archives];

  return (
    <main className="page">
      <header className="entete">
        <div>
          <p className="discret">{dateDuJour()}{vue.maj.derniereReussite ? ` · à jour ${relatif(vue.maj.derniereReussite, new Date())}` : ""}</p>
          <h1>{phrase(vue.enCours.length)}</h1>
        </div>
        <nav className="entete-actions" aria-label="Actions">
          <LienInterne vers="/quotas" className="bouton-doux">Quotas</LienInterne>
          <LienInterne vers="/reglages" className="bouton-doux">Réglages</LienInterne>
          <button className="bouton-doux" onClick={() => agir(api.rafraichir, "La mise à jour n'a pas marché. Les dernières données connues restent affichées.")}>Rafraîchir</button>
          <button className="bouton-fort" onClick={() => setNouvelleIdee(true)}>+ Nouvelle idée</button>
        </nav>
      </header>

      {vue.maj.erreur && (
        <p className="bandeau" role="alert">
          {vue.maj.erreur === "cle_refusee" ? "Clé GitHub refusée : à renouveler"
            : vue.maj.erreur === "interne" ? "La mise à jour automatique a planté (problème dans Atelier, pas chez GitHub)"
            : `GitHub injoignable depuis ${vue.maj.erreurDepuis ? heureMontreal(vue.maj.erreurDepuis) : "un moment"}`}
          {" "}— les dernières données connues restent affichées.
        </p>
      )}

      {echec && <p className="bandeau" role="alert">{echec}</p>}

      {nouvelleIdee && <FormIdee fermer={() => setNouvelleIdee(false)} garder={(nom, notes) => agir(async () => { await api.creerProjet({ nom, statut: "idee", notes }); setNouvelleIdee(false); })} />}

      {vue.quotas.length > 0 && <section className="bulles" aria-label="Quotas IA">{vue.quotas.map((q) => <BulleQuota key={q.compteId} quota={q} />)}</section>}

      <section aria-label="En cours" className="grille">
        {vue.enCours.map((c) => <CarteProjet key={c.id} carte={c} />)}
        {vue.enCours.length === 0 && <p className="discret">Aucun projet en cours.</p>}
      </section>

      <div className="bas">
        <section>
          <h2>Endormis · toujours en cours?</h2>
          <div className="etiquettes">
            {vue.endormis.map((c) => (
              <Etiquette key={c.id} texte={`${c.nom} · ${c.statut === "en_pause" ? "en pause" : c.derniere.relatif.replace("il y a ", "")}`} ouvert={ouvert === `p${c.id}`} basculer={() => setOuvert(ouvert === `p${c.id}` ? null : `p${c.id}`)}>
                <Decision carte={c} autres={tous.filter((t) => t.id !== c.id && t.statut !== "idee")} agir={agir} />
              </Etiquette>
            ))}
            {vue.endormis.length === 0 && <span className="discret">Aucun. Bravo.</span>}
          </div>
        </section>
        <section>
          <h2>Idées en attente</h2>
          <div className="etiquettes">
            {vue.idees.map((c) => <LienInterne key={c.id} vers={`/projet/${c.id}`} className="etiquette idee">{c.nom}</LienInterne>)}
            {vue.aClasser.map((d) => (
              <Etiquette key={d.githubId} accent texte={`Dépôt à classer : ${d.nom}`} ouvert={ouvert === `d${d.githubId}`} basculer={() => setOuvert(ouvert === `d${d.githubId}` ? null : `d${d.githubId}`)}>
                <Classement depot={d} projets={tous} agir={agir} />
              </Etiquette>
            ))}
          </div>
          {vue.archives.length > 0 && (
            <details className="archives"><summary>Archives ({vue.archives.length})</summary>
              <div className="etiquettes">{vue.archives.map((c) => <LienInterne key={c.id} vers={`/projet/${c.id}`} className="etiquette">{c.nom}</LienInterne>)}</div>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}

function Etiquette({ texte, ouvert, basculer, children, accent }: { texte: string; ouvert: boolean; basculer: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="etiquette-bloc">
      <button className={accent ? "etiquette accent" : "etiquette"} aria-expanded={ouvert} onClick={basculer}>{texte}</button>
      {ouvert && <div className="panneau">{children}</div>}
    </div>
  );
}

function Decision({ carte, autres, agir }: { carte: CarteVue; autres: CarteVue[]; agir: (a: () => Promise<unknown>) => Promise<void> }) {
  const [remplace, setRemplace] = useState(false);
  const statut = (s: string, extra: object = {}) => () => agir(() => api.modifierProjet(carte.id, { statut: s, ...extra }));
  return (
    <div className="choix">
      <button onClick={statut("en_pause")}>En pause</button>
      <button onClick={statut("abandonne")}>Abandonné</button>
      <button onClick={statut("termine")}>Terminé</button>
      <button onClick={() => setRemplace(true)}>Remplacé par…</button>
      <button onClick={statut("en_cours")}>Toujours en cours</button>
      {remplace && (
        <label>Remplacé par
          <select defaultValue="" onChange={(e) => e.target.value && statut("remplace", { remplacePar: Number(e.target.value) })()}>
            <option value="">Choisir…</option>
            {autres.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function Classement({ depot, projets, agir }: { depot: DepotVue; projets: CarteVue[]; agir: (a: () => Promise<unknown>) => Promise<void> }) {
  const [rattacher, setRattacher] = useState(false);
  return (
    <div className="choix">
      <button onClick={() => agir(() => api.classer(depot.githubId, { action: "nouveau" }))}>Nouveau projet</button>
      <button onClick={() => setRattacher(true)}>Rattacher à…</button>
      <button onClick={() => agir(() => api.classer(depot.githubId, { action: "masquer" }))}>Masquer</button>
      {rattacher && (
        <label>Rattacher à
          <select defaultValue="" onChange={(e) => e.target.value && agir(() => api.classer(depot.githubId, { action: "rattacher", projetId: Number(e.target.value) }))}>
            <option value="">Choisir…</option>
            {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}{p.statut === "idee" ? " (idée)" : ""}</option>)}
          </select>
        </label>
      )}
      <a href={depot.url} target="_blank" rel="noreferrer">Voir sur GitHub</a>
    </div>
  );
}

function FormIdee({ fermer, garder }: { fermer: () => void; garder: (nom: string, notes: string) => void }) {
  const [nom, setNom] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <form className="formulaire" onSubmit={(e) => { e.preventDefault(); if (nom.trim()) garder(nom.trim(), notes); }}>
      <h2>Nouvelle idée</h2>
      <label>Titre<input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={120} /></label>
      <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
      <div className="choix">
        <button type="submit" className="bouton-fort">Garder l'idée</button>
        <button type="button" onClick={fermer}>Annuler</button>
      </div>
    </form>
  );
}
