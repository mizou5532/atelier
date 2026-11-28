import { useEffect, useState } from "react";
import { LienInterne } from "../composants/Lien";
import { couleur } from "../composants/couleurs";
import { Pastille } from "../composants/CarteProjet";
import { dureeTexte } from "../composants/duree";
import { NOMS_IA, type IA } from "../../shared/historique";

type J = {
  jour: string; total: number; minutes: number; premier: string | null; dernier: string | null; ia: Partial<Record<IA, number>>;
  projets: { projetId: number; projet: string; couleur: string; icone: string | null; logo: string | null; n: number; minutes: number; part: number; premier: string; dernier: string; ia: Partial<Record<IA, number>>; commits: { heure: string; message: string; ia: IA }[] }[];
};

const formatLong = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const decaler = (jour: string, n: number) => new Date(Date.parse(jour + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const listeIA = (ia: Partial<Record<IA, number>>) => Object.entries(ia).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, n]) => `${NOMS_IA[k as IA]} (${n})`).join(", ");

export function Jour({ jour }: { jour: string }) {
  const [j, setJ] = useState<J | null>(null);
  useEffect(() => { setJ(null); fetch(`/api/jour/${jour}`).then((r) => r.json()).then(setJ); }, [jour]);
  const titre = formatLong.format(new Date(jour + "T00:00:00Z"));
  return (
    <main className="page page-fiche">
      <div className="jour-nav">
        <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
        <span className="jour-fleches">
          <LienInterne vers={`/jour/${decaler(jour, -1)}`} className="bouton-doux">‹ Jour précédent</LienInterne>
          <LienInterne vers={`/jour/${decaler(jour, 1)}`} className="bouton-doux">Jour suivant ›</LienInterne>
        </span>
      </div>
      <h1>{titre.charAt(0).toUpperCase() + titre.slice(1)}</h1>
      {!j ? <p className="discret">Chargement…</p> : j.total === 0 ? <p className="discret">Aucune activité ce jour-là.</p> : (
        <>
          <p className="discret">{dureeTexte(j.minutes)} de travail · {j.total} changement{j.total > 1 ? "s" : ""} · de {j.premier} à {j.dernier} · IA : {listeIA(j.ia)}</p>
          <div className="repartition" role="img" aria-label="Répartition du temps par projet">
            {j.projets.map((p) => <span key={p.projetId} style={{ width: `${p.part}%`, background: couleur(p.couleur).fort }} title={`${p.projet} ${Math.round(p.part)} %`} />)}
          </div>
          {j.projets.map((p) => (
            <section key={p.projetId} className="carte">
              <div className="carte-tete">
                {p.logo ? <Pastille carte={{ couleur: p.couleur, initiales: "", logo: p.logo }} taille={44} />
                  : <span className="pastille" aria-hidden="true" style={{ background: couleur(p.couleur).doux, width: 44, height: 44, fontSize: 22 }}>{p.icone ?? "•"}</span>}
                <div className="carte-titre">
                  <LienInterne vers={`/projet/${p.projetId}`} className="carte-nom">{p.projet}</LienInterne>
                  <span className="discret">{dureeTexte(p.minutes)} · {p.n} changement{p.n > 1 ? "s" : ""} · de {p.premier} à {p.dernier}</span>
                </div>
                <span className="part">{Math.round(p.part)} %</span>
              </div>
              <p className="discret">IA : {listeIA(p.ia)}</p>
              <ul className="commits">
                {p.commits.map((c, i) => <li key={i}><span className="discret">{c.heure}</span> {c.message} <span className={`puce-ia ia-${c.ia}`}>{NOMS_IA[c.ia]}</span></li>)}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
