import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { LienInterne } from "../composants/Lien";
import { ChoixTheme } from "../composants/ChoixTheme";
import { changerPreferences, usePreferences } from "../preferences";
import { ACCENTS } from "../../shared/historique";

type R = Awaited<ReturnType<typeof api.reglages>> & { historique?: { commits: number; depots: number; complets: number } };

const NOMS_ACCENTS: Record<(typeof ACCENTS)[number], { nom: string; couleur: string }> = {
  indigo: { nom: "Indigo", couleur: "#4F46E5" }, vert: { nom: "Vert", couleur: "#16A34A" }, orange: { nom: "Orange", couleur: "#EA580C" },
  rose: { nom: "Rose", couleur: "#DB2777" }, bleu: { nom: "Bleu", couleur: "#2563EB" }, ardoise: { nom: "Ardoise", couleur: "#334155" },
};

function Case({ nom, coche, changer }: { nom: string; coche: boolean; changer: (v: boolean) => void }) {
  return <label className="interrupteur"><input type="checkbox" checked={coche} onChange={(e) => changer(e.target.checked)} /> {nom}</label>;
}

export function Reglages(_props: { id?: number }) {
  const p = usePreferences();
  const [r, setR] = useState<R | null>(null);
  const [seuil, setSeuil] = useState("30");
  const charger = useCallback(async () => { const v = (await api.reglages()) as R; setR(v); if (v?.seuilEndormiJours) setSeuil(String(v.seuilEndormiJours)); }, []);
  useEffect(() => { charger(); }, [charger]);
  const agir = async (a: () => Promise<unknown>) => { await a(); await charger(); };
  const section = (cle: keyof typeof p.sections) => (v: boolean) => changerPreferences({ sections: { [cle]: v } });
  const carte = (cle: keyof typeof p.carte) => (v: boolean) => changerPreferences({ carte: { [cle]: v } });
  const nombre = new Intl.NumberFormat("fr-CA");

  return (
    <main className="page page-fiche">
      <LienInterne vers="/" className="retour">‹ Accueil</LienInterne>
      <h1>Réglages</h1>

      <section className="carte">
        <h2>Apparence</h2>
        <p className="etiquette-titre">Thème</p>
        <ChoixTheme />
        <p className="etiquette-titre">Couleur d'accent</p>
        <div className="choix">
          {ACCENTS.map((a) => (
            <button key={a} aria-pressed={p.accent === a} className={p.accent === a ? "choisi" : ""} onClick={() => changerPreferences({ accent: a })}>
              <span className="pastille-couleur" style={{ background: NOMS_ACCENTS[a].couleur }} /> {NOMS_ACCENTS[a].nom}
            </button>
          ))}
        </div>
        <div className="reglage-ligne">
          <label>Espacement
            <select value={p.densite} onChange={(e) => changerPreferences({ densite: e.target.value })}>
              <option value="aeree">Aéré</option><option value="compacte">Compact</option>
            </select>
          </label>
          <label>Cartes par ligne
            <select value={p.colonnes} onChange={(e) => changerPreferences({ colonnes: Number(e.target.value) })}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </label>
        </div>
        <Case nom="Animations" coche={p.animations} changer={(v) => changerPreferences({ animations: v })} />
        <Case nom="Salutation selon l'heure (Bon matin, Bonne soirée…)" coche={p.salutation} changer={(v) => changerPreferences({ salutation: v })} />
      </section>

      <section className="carte">
        <h2>Accueil</h2>
        <p className="discret">Ce que tu veux voir sur la page d'accueil.</p>
        <div className="grille-cases">
          <Case nom="Quotas IA" coche={p.sections.quotas} changer={section("quotas")} />
          <Case nom="Calendrier d'activité" coche={p.sections.calendrier} changer={section("calendrier")} />
          <Case nom="Dépôts à classer" coche={p.sections.aClasser} changer={section("aClasser")} />
          <Case nom="Projets endormis" coche={p.sections.endormis} changer={section("endormis")} />
          <Case nom="Idées en attente" coche={p.sections.idees} changer={section("idees")} />
          <Case nom="Archives" coche={p.sections.archives} changer={section("archives")} />
        </div>
        <label className="reglage-ligne">Mois affichés dans le calendrier
          <select aria-label="Mois affichés dans le calendrier" value={p.moisCalendrier} onChange={(e) => changerPreferences({ moisCalendrier: Number(e.target.value) })}>
            <option value={3}>3 mois</option><option value={6}>6 mois</option><option value={12}>12 mois</option><option value={24}>24 mois</option>
          </select>
        </label>
      </section>

      <section className="carte">
        <h2>Cartes des projets</h2>
        <div className="grille-cases">
          <Case nom="Courbe d'avancement" coche={p.carte.courbe} changer={carte("courbe")} />
          <Case nom="Temps passé" coche={p.carte.heures} changer={carte("heures")} />
          <Case nom="Voyant de mise en ligne" coche={p.carte.voyant} changer={carte("voyant")} />
          <Case nom="Dernière / prochaine étape" coche={p.carte.etapes} changer={carte("etapes")} />
          <Case nom="Jalons" coche={p.carte.jalons} changer={carte("jalons")} />
          <Case nom="Liens rapides" coche={p.carte.liens} changer={carte("liens")} />
        </div>
      </section>

      <form className="carte reglage-ligne" onSubmit={(e) => { e.preventDefault(); agir(() => api.modifierReglages({ seuilEndormiJours: Number(seuil) })); }}>
        <h2 style={{ flexBasis: "100%" }}>Projets endormis</h2>
        <label>Endormi après (jours)<input type="number" min={1} max={3650} value={seuil} onChange={(e) => setSeuil(e.target.value)} /></label>
        <div className="choix"><button type="submit">Enregistrer</button></div>
      </form>

      {r?.historique && (
        <section className="carte">
          <h2>Historique GitHub</h2>
          <p>{nombre.format(r.historique.commits)} changements importés · {r.historique.complets} dépôts sur {r.historique.depots} importés en entier</p>
          <p className="discret">L'import se poursuit tout seul à chaque mise à jour, jusqu'au tout premier changement de chaque dépôt. L'agent s'en sert pour résumer et cocher les jalons.</p>
        </section>
      )}

      {r?.masques && (
        <section className="carte">
          <h2>Éléments masqués</h2>
          {r.masques.projets.length + r.masques.depots.length === 0 && <p className="discret">Rien de masqué.</p>}
          <div className="choix">
            {r.masques.projets.map((x) => <button key={`p${x.id}`} aria-label={`Réafficher ${x.nom}`} onClick={() => agir(() => api.modifierReglages({ reafficherProjet: x.id }))}>Réafficher {x.nom}</button>)}
            {r.masques.depots.map((d) => <button key={`d${d.githubId}`} aria-label={`Réafficher ${d.nom}`} onClick={() => agir(() => api.modifierReglages({ reafficherDepot: d.githubId }))}>Réafficher {d.nom} (dépôt)</button>)}
          </div>
        </section>
      )}
    </main>
  );
}
