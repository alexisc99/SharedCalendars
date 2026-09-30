import React from "react";
import { View as RNView, ViewProps, StyleSheet, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Remplace <View> de react-native partout dans l'app pour le mode sombre :
 * donne une couleur de bordure par défaut cohérente avec le thème (RN met
 * du noir par défaut dès qu'un borderWidth est posé sans borderColor —
 * invisible sur fond sombre). Sans effet sur un View sans bordure.
 *
 * Même piège que pour Text : `borderColor: condition ? x : undefined` est un
 * pattern courant ici, et un `undefined` explicite écraserait quand même un
 * défaut posé plus tôt dans le tableau de styles — on aplatit donc le style
 * reçu et on ne retombe sur la bordure du thème que si aucune couleur
 * *réelle* n'a été fournie.
 */
export function View({ style, ...rest }: ViewProps) {
  const scheme = useColorScheme() ?? "light";
  const flat = (StyleSheet.flatten(style) || {}) as { borderColor?: string };
  const borderColor = flat.borderColor ?? Colors[scheme].border;
  return <RNView style={[style, { borderColor }]} {...rest} />;
}
