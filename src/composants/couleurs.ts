export const COULEURS: Record<string, { fort: string; doux: string; texte: string }> = {
  violet: { fort: "#8B5CF6", doux: "#EDE9FE", texte: "#6D28D9" },
  orange: { fort: "#F97316", doux: "#FFEDD5", texte: "#C2410C" },
  vert: { fort: "#22C55E", doux: "#DCFCE7", texte: "#15803D" },
  bleu: { fort: "#3B82F6", doux: "#DBEAFE", texte: "#1D4ED8" },
  rose: { fort: "#EC4899", doux: "#FCE7F3", texte: "#BE185D" },
  ambre: { fort: "#F59E0B", doux: "#FEF3C7", texte: "#B45309" },
};
export const couleur = (nom: string) => COULEURS[nom] ?? COULEURS.violet;
