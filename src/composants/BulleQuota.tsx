import type { QuotaVue } from "../../shared/types";
import { LienInterne } from "./Lien";

const TEINTES = { libre: { fond: "#ECFDF5", fort: "#10B981", texte: "#065F46" }, normal: { fond: "#EFF6FF", fort: "#3B82F6", texte: "#1E3A8A" }, bas: { fond: "#FFF7ED", fort: "#FB923C", texte: "#7C2D12" } };

export function resume(q: QuotaVue): { titre: string; detail: string; teinte: keyof typeof TEINTES } {
  const principale = q.fenetres.find((f) => f.fenetre === "semaine") ?? q.fenetres[0];
  const session = q.fenetres.find((f) => f.fenetre === "session");
  if (!principale) return { titre: `${q.nom} · —`, detail: "pas encore de chiffres", teinte: "normal" };
  const reste = principale.etat === "bloque" ? "bloqué" : principale.etat === "plein" ? "plein" : principale.reste === null ? "—" : `reste ${principale.reste} %`;
  const quand = principale.reinit ? `revient ${principale.reinit.jour} ${principale.reinit.heure}` : "";
  const detail = q.plusLibre ? `le plus libre${session?.etat === "plein" ? " · session pleine" : ""}` : principale.etat === "a_confirmer" ? "à confirmer" : quand;
  const teinte = q.plusLibre ? "libre" : (principale.reste ?? 100) < 40 || principale.etat === "bloque" ? "bas" : "normal";
  return { titre: `${q.nom} · ${reste}${q.plusLibre ? " ★" : ""}`, detail, teinte };
}

export function BulleQuota({ quota }: { quota: QuotaVue }) {
  const r = resume(quota);
  const t = TEINTES[r.teinte];
  const lettres = quota.type === "google" ? "G" : quota.nom.replace(/\D/g, "") ? `C${quota.nom.replace(/\D/g, "")}` : quota.nom.slice(0, 2).toUpperCase();
  return (
    <LienInterne vers="/quotas" className="bulle" style={{ background: t.fond }}>
      <span className="bulle-pastille" aria-hidden="true" style={{ background: t.fort }}>{lettres}</span>
      <span className="bulle-texte">
        <strong>{r.titre}</strong>
        <span style={{ color: t.texte }}>{r.detail}</span>
      </span>
    </LienInterne>
  );
}
