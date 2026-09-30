import React from "react";
import { Text as RNText, TextProps, StyleSheet, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Remplace <Text> de react-native partout dans l'app pour le mode sombre :
 * applique la couleur de texte du thème par défaut (au lieu du noir fixe de
 * RN, invisible sur fond sombre).
 *
 * Beaucoup d'écrans écrivent `color: condition ? accent : undefined` (pour
 * "coloré si sélectionné, sinon la couleur normale") — un `undefined`
 * explicite dans un style react-native écrase quand même la valeur d'un
 * style précédent dans le tableau, donc un simple `style={[{color:theme},
 * style]}` ne suffit pas : on aplatit le style reçu et on ne retombe sur la
 * couleur du thème que si aucune couleur *réelle* n'a été fournie.
 */
export function Text({ style, ...rest }: TextProps) {
  const scheme = useColorScheme() ?? "light";
  const flat = (StyleSheet.flatten(style) || {}) as { color?: string };
  const color = flat.color ?? Colors[scheme].text;
  return <RNText style={[style, { color }]} {...rest} />;
}
