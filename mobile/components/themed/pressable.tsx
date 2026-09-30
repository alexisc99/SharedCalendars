import React from "react";
import { Pressable as RNPressable, PressableProps, StyleSheet, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Remplace <Pressable> de react-native partout dans l'app : la quasi-totalité
 * des boutons de l'app sont des Pressable avec `borderWidth:1` et aucune
 * `borderColor` explicite — RN retombe alors sur du noir par défaut, invisible
 * en mode sombre. Même logique de secours que Text/View : applique la
 * bordure du thème par défaut, sans jamais écraser une couleur déjà fournie.
 */
export function Pressable({ style, ...rest }: PressableProps) {
  const scheme = useColorScheme() ?? "light";
  const borderColor = Colors[scheme].border;

  if (typeof style === "function") {
    return (
      <RNPressable
        style={(state) => {
          const resolved = style(state);
          const flat = (StyleSheet.flatten(resolved) || {}) as { borderColor?: string };
          return [resolved, { borderColor: flat.borderColor ?? borderColor }];
        }}
        {...rest}
      />
    );
  }

  const flat = (StyleSheet.flatten(style) || {}) as { borderColor?: string };
  return <RNPressable style={[style, { borderColor: flat.borderColor ?? borderColor }]} {...rest} />;
}
