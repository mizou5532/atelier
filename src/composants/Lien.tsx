import type { CSSProperties, ReactNode } from "react";
import { naviguer } from "../App";

/** Lien interne : garde le vrai <a href> (clic du milieu, accessibilité) sans recharger la page. */
export function LienInterne({ vers, children, className, style }: { vers: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <a href={vers} className={className} style={style} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      naviguer(vers);
    }}>{children}</a>
  );
}
