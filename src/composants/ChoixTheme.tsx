import { useEffect, useState } from "react";
import { choisirTheme, lireTheme, type Theme } from "../theme";

const CHOIX: { t: Theme; nom: string; icone: string }[] = [
  { t: "clair", nom: "Clair", icone: "☀️" },
  { t: "sombre", nom: "Sombre", icone: "🌙" },
  { t: "auto", nom: "Auto", icone: "🌓" },
];

export function useTheme(): Theme {
  const [t, setT] = useState(lireTheme());
  useEffect(() => {
    const suivre = () => setT(lireTheme());
    addEventListener("atelier-theme", suivre);
    return () => removeEventListener("atelier-theme", suivre);
  }, []);
  return t;
}

/** Trois boutons : Clair, Sombre, Auto (suit l'ordinateur). */
export function ChoixTheme() {
  const actuel = useTheme();
  return (
    <div className="choix" role="group" aria-label="Thème">
      {CHOIX.map((c) => (
        <button key={c.t} aria-pressed={actuel === c.t} className={actuel === c.t ? "choisi" : ""} onClick={() => choisirTheme(c.t)}>
          {c.icone} {c.nom}
        </button>
      ))}
    </div>
  );
}

/** Petit bouton de l'en-tête qui passe d'un thème à l'autre. */
export function BasculeTheme() {
  const actuel = useTheme();
  const i = CHOIX.findIndex((c) => c.t === actuel);
  const suivant = CHOIX[(i + 1) % CHOIX.length];
  return (
    <button className="bouton-doux" title={`Thème : ${CHOIX[i].nom} (cliquer pour ${suivant.nom})`} aria-label={`Thème ${CHOIX[i].nom}, passer à ${suivant.nom}`} onClick={() => choisirTheme(suivant.t)}>
      {CHOIX[i].icone}
    </button>
  );
}
