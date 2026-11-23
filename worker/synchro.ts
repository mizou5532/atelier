import type { DepotBrut, Env } from "./bd";
import { lireFiche } from "../shared/fiche";
import type { Fiche } from "../shared/types";
import { derniersCommits, ErreurGithub, lireEtatMd, listerDepots, type DepotGithub } from "./github";

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
    return await appliquer(db, env.GITHUB_CLE, liste, quand, f);
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

    if (avant?.fiche_lue_pour === g.pushed_at) continue;
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
