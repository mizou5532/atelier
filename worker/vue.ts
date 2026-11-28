import type { DepotBrut, ProjetBrut } from "./bd";
import { lireReglage } from "./bd";
import { derniereActivite, estEndormi, proposition, statutEffectif } from "../shared/regles";
import { relatif } from "../shared/temps";
import { heuresTravaillees } from "../shared/activite";
import { decouperJour, jourMontrealDe, type IA } from "../shared/historique";
import type { AccueilVue, CarteVue, DetailVue, Fiche, Statut } from "../shared/types";

export function initiales(nom: string): string {
  const mots = nom.replace(/[^\p{L}\p{N}\s.]/gu, " ").split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

export function depotPrincipal(p: ProjetBrut, depots: DepotBrut[]): DepotBrut | undefined {
  const choisi = depots.find((d) => d.github_id === p.depot_principal);
  if (choisi) return choisi;
  const tri = [...depots].sort((a, b) => b.pousse_le.localeCompare(a.pousse_le));
  return tri.find((d) => d.fiche_json) ?? tri[0];
}

export type JalonBrut = { id: number; projet_id: number; titre: string; fait: number; coche_par: "ia" | "main" | null };

export type HistoBrut = { projet_id: number; jour: string; avancement: number };

export function construireCarte(p: ProjetBrut, depots: DepotBrut[], liens: { nom: string; url: string }[], maintenant: Date, jalons: JalonBrut[] = [], histo: HistoBrut[] = []): CarteVue & { _fiche?: Fiche; _principal?: DepotBrut } {
  const principal = depotPrincipal(p, depots);
  const ficheReelle: Fiche | undefined = principal?.fiche_json ? JSON.parse(principal.fiche_json) : undefined;
  const resume = !ficheReelle && principal?.resume_ia_json ? JSON.parse(principal.resume_ia_json) as { derniereEtape: string; prochaineEtape: string; avancement: number | null } : undefined;
  const fiche: Fiche | undefined = ficheReelle ?? (resume ? { derniereEtape: resume.derniereEtape, prochaineEtape: resume.prochaineEtape, avancement: resume.avancement ?? undefined, liens: [], enCours: "" } : undefined);
  const choix = p.statut as Statut | null;
  const statut = statutEffectif(choix, fiche?.statut);
  const propStatut = proposition<Statut>(choix, fiche?.statut, p.statut_ignore as Statut | null);
  const propAvancement = proposition<number>(p.avancement, ficheReelle?.avancement, p.avancement_ignore);
  const jalonsValides = p.jalons_etat === "valide" && jalons.length > 0;
  const faits = jalons.filter((j) => j.fait).length;
  const pctJalons = jalonsValides ? Math.round((faits / jalons.length) * 100) : undefined;
  const derniere = derniereActivite(depots, p.modifie_le);
  const rapides = [...liens];
  if (principal) rapides.push({ nom: "GitHub", url: principal.url });
  return {
    id: p.id, nom: p.nom, couleur: p.couleur, initiales: initiales(p.nom), statut,
    derniere: { ...derniere, relatif: relatif(derniere.quand, maintenant) },
    avancement: p.avancement ?? ficheReelle?.avancement ?? pctJalons ?? resume?.avancement ?? null,
    proposition: { ...(propStatut ? { statut: propStatut } : {}), ...(propAvancement !== null ? { avancement: propAvancement } : {}) },
    derniereEtape: fiche?.derniereEtape, prochaineEtape: fiche?.prochaineEtape,
    enTravail: Boolean(fiche?.enCours), ficheAVerifier: principal?.fiche_etat === "a_verifier", estimeParIA: Boolean(resume) && pctJalons === undefined, jalonsAValider: p.jalons_etat === "propose",
    icone: p.icone ?? null,
    logo: p.logo ? `/api/projets/${p.id}/logo?v=${encodeURIComponent(p.logo_maj ?? "1")}` : null,
    historique: histo.filter((h) => h.jour >= new Date(maintenant.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)).map((h) => ({ jour: h.jour, avancement: h.avancement })),
    deltaSemaine: (() => {
      const actuel = p.avancement ?? ficheReelle?.avancement ?? pctJalons ?? resume?.avancement ?? null;
      const limite = new Date(maintenant.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      const avant = [...histo].filter((h) => h.jour <= limite).sort((a, b) => b.jour.localeCompare(a.jour))[0] ?? [...histo].sort((a, b) => a.jour.localeCompare(b.jour))[0];
      return actuel !== null && avant && avant.avancement !== actuel ? actuel - avant.avancement : null;
    })(),
    heuresSemaine: heuresTravaillees(depots.flatMap((d) => (d.commits_recents_json ? JSON.parse(d.commits_recents_json) as string[] : [])), new Date(maintenant.getTime() - 7 * 86_400_000)),
    voyant: (() => { const v = [...depots].filter((d) => d.ci_etat && d.ci_quand).sort((a, b) => b.ci_quand!.localeCompare(a.ci_quand!))[0]; return v ? { etat: v.ci_etat!, nom: v.ci_nom ?? "", relatif: relatif(v.ci_quand!, maintenant), url: v.ci_url ?? v.url } : null; })(), jalonsResume: jalonsValides ? `${faits} sur ${jalons.length} jalons` : null,
    liensRapides: rapides.slice(0, 2), nbDepots: depots.length,
    _fiche: fiche, _principal: principal,
  };
}

async function donnees(db: D1Database) {
  const [projets, depots, liens, jalons, histo] = await Promise.all([
    db.prepare("SELECT * FROM projets").all<ProjetBrut>(),
    db.prepare("SELECT * FROM depots").all<DepotBrut>(),
    db.prepare("SELECT id, projet_id, nom, url, source FROM liens ORDER BY id").all<{ id: number; projet_id: number; nom: string; url: string; source: "main" | "github" | "fiche" }>(),
    db.prepare("SELECT id, projet_id, titre, fait, coche_par FROM jalons ORDER BY ordre, id").all<JalonBrut>(),
    db.prepare("SELECT projet_id, jour, avancement FROM historique ORDER BY jour").all<HistoBrut>(),
  ]);
  return { projets: projets.results, depots: depots.results, liens: liens.results, jalons: jalons.results, histo: histo.results };
}

const sansPrive = ({ _fiche, _principal, ...c }: CarteVue & { _fiche?: unknown; _principal?: unknown }): CarteVue => c;

export async function construireAccueil(db: D1Database, maintenant: Date): Promise<Omit<AccueilVue, "quotas">> {
  const { projets, depots, liens, jalons, histo } = await donnees(db);
  const seuil = Number((await lireReglage(db, "seuil_endormi_jours")) ?? "30");
  const etat = await db.prepare("SELECT * FROM etat_synchro WHERE id = 1").first<{ derniere_reussite: string | null; erreur: "injoignable" | "cle_refusee" | "interne" | null; erreur_depuis: string | null }>();
  const vue: Omit<AccueilVue, "quotas"> = {
    maj: { derniereReussite: etat?.derniere_reussite ?? null, erreur: etat?.erreur ?? null, erreurDepuis: etat?.erreur_depuis ?? null },
    aClasser: depots.filter((d) => d.projet_id === null && !d.masque && !d.disparu)
      .sort((a, b) => b.pousse_le.localeCompare(a.pousse_le))
      .map((d) => ({ githubId: d.github_id, nom: d.nom_complet.split("/")[1], url: d.url, relatif: relatif(d.pousse_le, maintenant) })),
    enCours: [], endormis: [], idees: [], archives: [],
  };
  for (const p of projets.filter((p) => !p.masque)) {
    const carte = sansPrive(construireCarte(p, depots.filter((d) => d.projet_id === p.id && !d.masque), liens.filter((l) => l.projet_id === p.id), maintenant, jalons.filter((j) => j.projet_id === p.id), histo.filter((h) => h.projet_id === p.id)));
    if (carte.statut === "idee") vue.idees.push(carte);
    else if (["termine", "abandonne", "remplace"].includes(carte.statut)) vue.archives.push(carte);
    else if (carte.statut === "en_pause" || estEndormi(carte.statut, carte.derniere.quand, maintenant, seuil)) vue.endormis.push(carte);
    else vue.enCours.push(carte);
  }
  const recent = (a: CarteVue, b: CarteVue) => b.derniere.quand.localeCompare(a.derniere.quand);
  vue.enCours.sort(recent); vue.endormis.sort(recent); vue.archives.sort(recent);
  return vue;
}

export async function construireDetail(db: D1Database, id: number, maintenant: Date): Promise<DetailVue | null> {
  const { projets, depots, liens, jalons, histo } = await donnees(db);
  const p = projets.find((x) => x.id === id);
  if (!p) return null;
  const siens = depots.filter((d) => d.projet_id === id && !d.masque);
  const leurs = liens.filter((l) => l.projet_id === id);
  const siensJalons = jalons.filter((j) => j.projet_id === id);
  const { _fiche, _principal, ...carte } = construireCarte(p, siens, leurs, maintenant, siensJalons, histo.filter((h) => h.projet_id === id));
  return {
    ...carte,
    notes: p.notes, enCours: _fiche?.enCours ?? "", statutChoisi: p.statut as Statut | null, remplacePar: p.remplace_par,
    liens: leurs.map(({ id, nom, url, source }) => ({ id, nom, url, source })),
    depots: siens.map((d) => ({
      githubId: d.github_id, nom: d.nom_complet.split("/")[1], url: d.url, prive: !!d.prive,
      principal: d.github_id === _principal?.github_id, disparu: !!d.disparu, ficheEtat: d.fiche_etat,
    })),
    commits: _principal ? JSON.parse(_principal.commits_json) : [],
    jalonsEtat: p.jalons_etat ?? "aucun",
    logoSource: p.logo_source ?? null,
    jalons: siensJalons.map((j) => ({ id: j.id, titre: j.titre, fait: !!j.fait, cochePar: j.coche_par })),
  };
}

type LigneCommit = { quand: string; message: string; ia: string; projet_id: number; nom: string; couleur: string; icone: string | null };

async function commitsEntre(db: D1Database, depuis: string, jusqua: string): Promise<LigneCommit[]> {
  return (await db.prepare(
    `SELECT c.quand, c.message, c.ia, p.id AS projet_id, p.nom, p.couleur, p.icone
     FROM commits c JOIN depots d ON d.github_id = c.depot_id JOIN projets p ON p.id = d.projet_id
     WHERE d.masque = 0 AND p.masque = 0 AND c.quand >= ? AND c.quand < ? ORDER BY c.quand`,
  ).bind(depuis, jusqua).all<LigneCommit>()).results;
}

/** Calendrier : chaque jour (heure de Montréal) avec ses projets, son temps estimé et ses IA. */
export async function construireActivite(db: D1Database, maintenant: Date, mois = 12) {
  const depuis = new Date(maintenant.getTime() - mois * 30.44 * 86_400_000).toISOString();
  const lignes = await commitsEntre(db, depuis, new Date(maintenant.getTime() + 86_400_000).toISOString());
  const parJour = new Map<string, LigneCommit[]>();
  for (const l of lignes) {
    const j = jourMontrealDe(l.quand);
    parJour.set(j, [...(parJour.get(j) ?? []), l]);
  }
  const infos = new Map(lignes.map((l) => [l.projet_id, l]));
  return {
    depuis: depuis.slice(0, 10),
    jours: [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, liste]) => {
      const d = decouperJour(jour, liste.map((l) => ({ projetId: l.projet_id, projet: l.nom, quand: l.quand, message: l.message, ia: l.ia as IA })));
      return {
        jour, total: d.total, minutes: d.minutes, ia: d.ia,
        projets: d.projets.map((p) => ({ id: p.projetId, nom: p.projet, couleur: infos.get(p.projetId)!.couleur, icone: infos.get(p.projetId)!.icone, n: p.n, minutes: p.minutes })),
      };
    }),
  };
}

/** Tout sur une journée : projets, temps, part, IA, et chaque changement avec son heure. */
export async function construireJour(db: D1Database, jour: string) {
  const t = Date.parse(`${jour}T12:00:00Z`);
  const lignes = await commitsEntre(db, new Date(t - 86_400_000).toISOString(), new Date(t + 86_400_000).toISOString());
  const d = decouperJour(jour, lignes.map((l) => ({ projetId: l.projet_id, projet: l.nom, quand: l.quand, message: l.message, ia: l.ia as IA })));
  const infos = new Map(lignes.map((l) => [l.projet_id, l]));
  return { ...d, projets: d.projets.map((p) => ({ ...p, couleur: infos.get(p.projetId)?.couleur ?? "violet", icone: infos.get(p.projetId)?.icone ?? null })) };
}
