import { useEffect, useState } from "react";
import { Accueil } from "./pages/Accueil";
import { Projet } from "./pages/Projet";
import { Quotas } from "./pages/Quotas";
import { Reglages } from "./pages/Reglages";
import { Semaine } from "./pages/Semaine";
import { Jour } from "./pages/Jour";

export function naviguer(chemin: string) {
  history.pushState(null, "", chemin);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [chemin, setChemin] = useState(location.pathname);
  useEffect(() => {
    const suivre = () => { setChemin(location.pathname); scrollTo(0, 0); };
    addEventListener("popstate", suivre);
    return () => removeEventListener("popstate", suivre);
  }, []);
  const projet = chemin.match(/^\/projet\/(\d+)$/);
  if (projet) return <Projet id={Number(projet[1])} />;
  if (chemin === "/quotas") return <Quotas />;
  if (chemin === "/reglages") return <Reglages />;
  if (chemin === "/semaine") return <Semaine />;
  const jour = chemin.match(/^\/jour\/(\d{4}-\d{2}-\d{2})$/);
  if (jour) return <Jour jour={jour[1]} />;
  return <Accueil />;
}
