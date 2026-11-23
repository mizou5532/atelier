import type { DepotBrut, Env } from "./bd";
import { lireFiche } from "../shared/fiche";
import type { Fiche } from "../shared/types";
import { derniereExecution, derniersCommits, ErreurGithub, lireEtatMd, lireFichier, listerDepots, type DepotGithub } from "./github";
import { cocherJalons, proposerJalons, resumerDepot } from "./agent";

export async function synchroniser(env: Env, maintenant: Date, f: typeof fetch = fetch): Promise<{ nouveaux: number; erreur?: "injoignable" | "cle_refusee" | "interne" }> {
  const db = env.DB;
  const quand = maintenant.toISOString();
  let liste: DepotGithub[];
  try {
    liste = await listerDepots(env.GITHUB_CLE, f);
  } catch (e) {
    const type = e instanceof ErreurGithub ? e.type : "injoignable";
    await noterErreur(db, type, quand);
    return { nouveaux: 0, erreur: type };
  }

  try {
    const r = await appliquer(db, env.GITHUB_CLE, liste, quand, f);
    if (!r.erreur) await lireVoyants(db, env.GITHUB_CLE, f);
    if (!r.erreur && env.GEMINI_CLE) {
      await resumerSansFiche(db, env, f);
      await suivreJalons(db, env, f);
    }
    return r;
  } catch (e) {
    console.error("Synchronisation : erreur interne", e);
    await noterErreur(db, "interne", quand);
    return { nouveaux: 0, erreur: "interne" };
  }
}

async function appliquer(db: D1Database, cle: string, liste: DepotGithub[], quand: string, f: typeof fetch): Promise<{ nouveaux: number; erreur?: "cle_refusee" }> {
  const env = { GITHUB_CLE: cle };
  const projetsExistants = new Set((await db.prepare("SELECT id FROM projets").all<{ id: number }>()).results.map((p) => p.id));
  const existants = new Map((await db.prepare("SELECT * FROM depots").all<DepotBrut>()).results.map((d) => [d.github_id, d]));
  const depart = new Map((await db.prepare("SELECT * FROM rattachements_depart").all<{ nom_depot: string; projet_id: number }>()).results.map((r) => [r.nom_depot, r.projet_id]));
  const ecritures: D1PreparedStatement[] = [];
  let nouveaux = 0;

  for (const brut of liste) {
    const g = { ...brut, pushed_at: brut.pushed_at ?? brut.created_at ?? quand };
    const avant = existants.get(g.id);
    if (!avant) {
      const voulu = depart.get(g.name);
      const projet = voulu !== undefined && projetsExistants.has(voulu) ? voulu : null;
      if (projet === null) nouveaux++;
      if (voulu !== undefined) ecritures.push(db.prepare("DELETE FROM rattachements_depart WHERE nom_depot = ?").bind(g.name));
      ecritures.push(db.prepare(
        "INSERT INTO depots (github_id, nom_complet, url, site, prive, archive, branche, pousse_le, projet_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(g.id, g.full_name, g.html_url, g.homepage || null, g.private ? 1 : 0, g.archived ? 1 : 0, g.default_branch, g.pushed_at, projet));
    } else {
      ecritures.push(db.prepare(
        "UPDATE depots SET nom_complet = ?, url = ?, site = ?, prive = ?, archive = ?, branche = ?, pousse_le = ?, disparu = 0 WHERE github_id = ?",
      ).bind(g.full_name, g.html_url, g.homepage || null, g.private ? 1 : 0, g.archived ? 1 : 0, g.default_branch, g.pushed_at, g.id));
    }

    if (avant?.fiche_lue_pour === g.pushed_at && avant.fiche_etat !== "a_verifier") continue;
    try {
      const [texte, commits] = await Promise.all([
        lireEtatMd(env.GITHUB_CLE, g.full_name, g.default_branch, f),
        derniersCommits(env.GITHUB_CLE, g.full_name, g.default_branch, f),
      ]);
      if (texte === null) {
        ecritures.push(db.prepare("UPDATE depots SET fiche_json = NULL, fiche_etat = 'absente', fiche_lue_pour = ?, commits_json = ? WHERE github_id = ?")
          .bind(g.pushed_at, JSON.stringify(commits), g.id));
      } else {
        const lu = lireFiche(texte);
        if (lu.etat === "ok") {
          ecritures.push(db.prepare("UPDATE depots SET fiche_json = ?, fiche_etat = 'ok', fiche_lue_pour = ?, commits_json = ? WHERE github_id = ?")
            .bind(JSON.stringify(lu.fiche), g.pushed_at, JSON.stringify(commits), g.id));
        } else {
          ecritures.push(db.prepare("UPDATE depots SET fiche_etat = 'a_verifier', fiche_lue_pour = ?, commits_json = ? WHERE github_id = ?")
            .bind(g.pushed_at, JSON.stringify(commits), g.id));
        }
      }
    } catch (e) {
      if (e instanceof ErreurGithub && e.type === "cle_refusee") {
        await noterErreur(db, "cle_refusee", quand);
        return { nouveaux: 0, erreur: "cle_refusee" };
      }
      // Lecture ratée pour ce dépôt : on réessaiera au prochain passage.
    }
  }

  const presents = new Set(liste.map((g) => g.id));
  for (const id of existants.keys()) {
    if (!presents.has(id)) ecritures.push(db.prepare("UPDATE depots SET disparu = 1 WHERE github_id = ?").bind(id));
  }
  ecritures.push(db.prepare("UPDATE etat_synchro SET derniere_reussite = ?, erreur = NULL, erreur_depuis = NULL WHERE id = 1").bind(quand));
  await db.batch(ecritures);
  await completerLiens(db);
  return { nouveaux };
}

/** Ajoute les liens connus par GitHub et par les fiches, sans doublon d'adresse. */
export async function completerLiens(db: D1Database): Promise<void> {
  const depots = (await db.prepare("SELECT * FROM depots WHERE projet_id IS NOT NULL AND disparu = 0").all<DepotBrut>()).results;
  const liens = (await db.prepare("SELECT projet_id, url FROM liens").all<{ projet_id: number; url: string }>()).results;
  const ignores = (await db.prepare("SELECT projet_id, url FROM liens_ignores").all<{ projet_id: number; url: string }>()).results;
  const connus = new Set([...liens, ...ignores].map((l) => `${l.projet_id} ${l.url}`));
  const ajouts: D1PreparedStatement[] = [];
  const ajouter = (projet: number, nom: string, url: string, source: "github" | "fiche") => {
    if (!/^https?:\/\//.test(url) || connus.has(`${projet} ${url}`)) return;
    connus.add(`${projet} ${url}`);
    ajouts.push(db.prepare("INSERT INTO liens (projet_id, nom, url, source) VALUES (?, ?, ?, ?)").bind(projet, nom, url, source));
  };
  for (const d of depots) {
    if (d.site) ajouter(d.projet_id!, "Site", d.site, "github");
    if (d.fiche_json) for (const l of (JSON.parse(d.fiche_json) as Fiche).liens) ajouter(d.projet_id!, l.nom, l.url, "fiche");
  }
  if (ajouts.length) await db.batch(ajouts);
}

async function noterErreur(db: D1Database, type: "injoignable" | "cle_refusee" | "interne", quand: string): Promise<void> {
  await db.prepare("UPDATE etat_synchro SET erreur = ?, erreur_depuis = COALESCE(CASE WHEN erreur = ? THEN erreur_depuis END, ?) WHERE id = 1")
    .bind(type, type, quand).run();
}

const RESUMES_PAR_PASSAGE = 3;

/** L'agent résume les dépôts sans fiche qui ont changé depuis leur dernier résumé (au plus 3 par passage). */
async function resumerSansFiche(db: D1Database, env: Env, f: typeof fetch): Promise<void> {
  const aFaire = (await db.prepare(
    `SELECT * FROM depots WHERE fiche_etat = 'absente' AND disparu = 0 AND masque = 0
     AND (resume_ia_pour IS NULL OR resume_ia_pour != pousse_le) ORDER BY pousse_le DESC LIMIT ?`,
  ).bind(RESUMES_PAR_PASSAGE).all<DepotBrut>()).results;
  for (const d of aFaire) {
    try {
      const passation = await lireFichier(env.GITHUB_CLE, d.nom_complet, d.branche, "PASSATION.md", f);
      const readme = passation ? null : await lireFichier(env.GITHUB_CLE, d.nom_complet, d.branche, "README.md", f);
      const resume = await resumerDepot(env.GEMINI_CLE!, env.GEMINI_MODELE || "gemini-3.5-flash-lite", {
        nom: d.nom_complet.split("/")[1], passation, readme, commits: JSON.parse(d.commits_json),
      }, f);
      await db.prepare("UPDATE depots SET resume_ia_json = COALESCE(?, resume_ia_json), resume_ia_pour = ? WHERE github_id = ?")
        .bind(resume ? JSON.stringify(resume) : null, d.pousse_le, d.github_id).run();
    } catch (e) {
      console.error("Agent : résumé impossible pour", d.nom_complet, e);
    }
  }
}

const JALONS_PAR_PASSAGE = 3;

/** L'agent propose des jalons (une fois) puis coche ceux qui sont faits, pour les projets sans pourcentage dans leur fiche. */
async function suivreJalons(db: D1Database, env: Env, f: typeof fetch): Promise<void> {
  const projets = (await db.prepare(
    `SELECT p.id, p.jalons_etat, p.jalons_vus_pour, d.nom_complet, d.branche, d.pousse_le, d.fiche_json, d.commits_json
     FROM projets p JOIN depots d ON d.github_id = (
       SELECT github_id FROM depots WHERE projet_id = p.id AND masque = 0 AND disparu = 0 ORDER BY pousse_le DESC LIMIT 1)
     WHERE p.masque = 0 AND COALESCE(p.statut, 'en_cours') IN ('en_cours', 'en_pause') AND p.jalons_etat != 'propose'
       AND (p.jalons_vus_pour IS NULL OR p.jalons_vus_pour != d.pousse_le)
     ORDER BY d.pousse_le DESC`,
  ).all<{ id: number; jalons_etat: string; jalons_vus_pour: string | null; nom_complet: string; branche: string; pousse_le: string; fiche_json: string | null; commits_json: string }>()).results
    .filter((p) => p.fiche_json === null || (JSON.parse(p.fiche_json) as Fiche).avancement === undefined)
    .slice(0, JALONS_PAR_PASSAGE);
  for (const p of projets) {
    try {
      const document = (await lireFichier(env.GITHUB_CLE, p.nom_complet, p.branche, "PASSATION.md", f))
        ?? (await lireFichier(env.GITHUB_CLE, p.nom_complet, p.branche, "README.md", f));
      const entree = { nom: p.nom_complet.split("/")[1], document, commits: JSON.parse(p.commits_json) };
      const modele = env.GEMINI_MODELE || "gemini-3.5-flash-lite";
      const ecritures: D1PreparedStatement[] = [];
      if (p.jalons_etat === "aucun") {
        const jalons = await proposerJalons(env.GEMINI_CLE!, modele, entree, f);
        if (!jalons) continue; // échec : on réessaiera au prochain passage
        {
          jalons.forEach((j, i) => ecritures.push(db.prepare("INSERT INTO jalons (projet_id, ordre, titre, fait, coche_par) VALUES (?, ?, ?, ?, ?)")
            .bind(p.id, i + 1, j.titre, j.fait ? 1 : 0, j.fait ? "ia" : null)));
          ecritures.push(db.prepare("UPDATE projets SET jalons_etat = 'propose' WHERE id = ?").bind(p.id));
        }
      } else {
        const existants = (await db.prepare("SELECT id, titre, fait FROM jalons WHERE projet_id = ? ORDER BY ordre, id").bind(p.id).all<{ id: number; titre: string; fait: number }>()).results;
        if (existants.some((j) => !j.fait)) {
          const numerotes = existants.map((j, i) => ({ numero: i + 1, titre: j.titre, fait: !!j.fait, id: j.id }));
          const faits = await cocherJalons(env.GEMINI_CLE!, modele, { ...entree, jalons: numerotes }, f);
          for (const n of faits ?? []) ecritures.push(db.prepare("UPDATE jalons SET fait = 1, coche_par = 'ia' WHERE id = ? AND fait = 0").bind(numerotes[n - 1].id));
        }
      }
      ecritures.push(db.prepare("UPDATE projets SET jalons_vus_pour = ? WHERE id = ?").bind(p.pousse_le, p.id));
      await db.batch(ecritures);
    } catch (e) {
      console.error("Agent : jalons impossibles pour", p.nom_complet, e);
    }
  }
}

/** Voyant vert/rouge : dernière exécution GitHub Actions des dépôts rattachés à un projet. */
async function lireVoyants(db: D1Database, cle: string, f: typeof fetch): Promise<void> {
  const depots = (await db.prepare("SELECT github_id, nom_complet, branche FROM depots WHERE projet_id IS NOT NULL AND masque = 0 AND disparu = 0")
    .all<{ github_id: number; nom_complet: string; branche: string }>()).results;
  const resultats = await Promise.all(depots.map((d) => derniereExecution(cle, d.nom_complet, d.branche, f)));
  const ecritures = depots.map((d, i) => {
    const x = resultats[i];
    return db.prepare("UPDATE depots SET ci_etat = ?, ci_nom = ?, ci_quand = ?, ci_url = ? WHERE github_id = ?")
      .bind(x?.etat ?? null, x?.nom ?? null, x?.quand ?? null, x?.url ?? null, d.github_id);
  });
  if (ecritures.length) await db.batch(ecritures);
}
