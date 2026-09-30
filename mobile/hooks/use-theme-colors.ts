import { useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Jetons du thème courant (clair/sombre), résolus une fois par écran.
 * Utile notamment pour `contentStyle` d'un `Stack.Screen` : définir ses
 * propres options locales (ex: juste pour le padding des zones sûres)
 * remplace entièrement l'objet `contentStyle` hérité du Stack racine plutôt
 * que de le fusionner — sans backgroundColor explicite ici, l'écran retombe
 * sur le fond blanc par défaut du navigateur, même en mode sombre.
 */
export function useThemeColors() {
  const scheme = useColorScheme() ?? "light";
  return Colors[scheme];
}
