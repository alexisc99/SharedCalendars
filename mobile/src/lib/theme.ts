export const FREE_THEMES = ["default", "blue", "green", "red"] as const;
export const PREMIUM_THEMES = ["gold", "night-sky", "gradient-purple"] as const;

export const THEME_COLORS: Record<string, string> = {
  default: "#4f46e5",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  gold: "#d4af37",
  "night-sky": "#312e81",
  "gradient-purple": "#7c3aed",
};

/** Le thème est la seule source de vérité pour la couleur affichée dans l'app. */
export function colorForTheme(theme?: string | null): string {
  if (theme && THEME_COLORS[theme]) return THEME_COLORS[theme];
  return THEME_COLORS.default;
}
