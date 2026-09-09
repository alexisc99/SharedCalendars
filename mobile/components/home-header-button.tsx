import React from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";

/**
 * Bouton d'en-tête qui ramène directement à l'onglet de départ en un seul
 * tap, quelle que soit la profondeur de navigation (dismissAll() vide toute
 * la pile empilée sur la barre d'onglets au lieu de revenir écran par écran).
 */
export function HomeHeaderButton() {
  return (
    <Pressable
      onPress={() => router.dismissAll()}
      hitSlop={8}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
    >
      <Text style={{ fontSize: 18 }}>🏠</Text>
    </Pressable>
  );
}
