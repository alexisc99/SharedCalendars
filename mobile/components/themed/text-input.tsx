import React from "react";
import { TextInput as RNTextInput, TextInputProps, StyleSheet, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Remplace <TextInput> de react-native partout dans l'app : sans ça, le
 * texte saisi reste noir par défaut (RN), invisible sur fond sombre — et le
 * texte de substitution ("placeholder") n'a aucun contraste correct non plus.
 * Même chose pour la bordure : RN met du noir par défaut dès qu'un
 * borderWidth est posé sans borderColor (cas très courant dans l'app).
 */
export function TextInput({ style, placeholderTextColor, ...rest }: TextInputProps) {
  const scheme = useColorScheme() ?? "light";
  const flat = (StyleSheet.flatten(style) || {}) as {
    color?: string;
    borderColor?: string;
  };
  const color = flat.color ?? Colors[scheme].text;
  const borderColor = flat.borderColor ?? Colors[scheme].border;
  return (
    <RNTextInput
      style={[style, { color, borderColor }]}
      placeholderTextColor={placeholderTextColor ?? Colors[scheme].icon}
      {...rest}
    />
  );
}
